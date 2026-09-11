#!/usr/bin/env node
// =============================================================================
// tools.json 검증기 — 의존성 없음
//
//   node scripts/validate.mjs
//
// 스키마(schema/tools.schema.json)를 그대로 읽어 검사하므로, 규칙은 스키마
// 한 곳에서만 관리합니다. 스키마로 표현할 수 없는 것(중복, 프리픽스 겹침,
// OBS 대조)은 아래 크로스체크에서 따로 봅니다.
//
// PHP 쪽 lib/tools.php 의 tools_validate() 와 같은 규칙을 봅니다. 화면에서
// 저장한 파일도 이 검사를 통과해야 합니다.
// =============================================================================
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const err = (p, m) => errors.push(`${p}: ${m}`);
const warn = (p, m) => warnings.push(`${p}: ${m}`);

// -- 파일 찾기 ----------------------------------------------------------------
// data/ 를 웹 루트 밖으로 옮겼을 수 있으므로 몇 군데를 순서대로 봅니다.
const dataPath = [
  process.env.TOOLS_JSON,
  resolve(root, 'data/tools.json'),
  resolve(root, 'tools.json'),
].find((p) => p && existsSync(p));

if (!dataPath) {
  console.error('tools.json 을 찾을 수 없습니다. TOOLS_JSON 환경변수로 경로를 지정하세요.');
  process.exit(1);
}

const schemaPath = resolve(root, 'schema/tools.schema.json');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

let data;
let schema;
try {
  data = readJson(dataPath);
} catch (e) {
  console.error(`${dataPath}: JSON 파싱 실패 — ${e.message}`);
  process.exit(1);
}
try {
  schema = readJson(schemaPath);
} catch (e) {
  console.error(`${schemaPath}: 스키마를 읽을 수 없습니다 — ${e.message}`);
  process.exit(1);
}

// -- 스키마 검사 --------------------------------------------------------------
// 이 스키마가 쓰는 키워드만 다룹니다: $ref, type, const, enum, required,
// properties, additionalProperties, items, pattern, minLength.
function deref(node) {
  if (!node || !node.$ref) return node;
  const path = node.$ref.replace(/^#\//, '').split('/');
  return path.reduce((acc, key) => acc?.[key], schema);
}

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function check(value, node, path) {
  node = deref(node);
  if (!node) return;

  if (node.type && typeOf(value) !== node.type) {
    // integer 는 number 로도 들어올 수 있어 한 번 더 봅니다.
    if (!(node.type === 'integer' && Number.isInteger(value))) {
      err(path, `${node.type} 이어야 하는데 ${typeOf(value)} 입니다.`);
      return;
    }
  }
  if ('const' in node && value !== node.const) {
    err(path, `${JSON.stringify(node.const)} 이어야 합니다.`);
  }
  if (node.enum && !node.enum.includes(value)) {
    err(path, `${node.enum.join(' | ')} 중 하나여야 합니다.`);
  }
  if (typeof value === 'string') {
    if (node.minLength !== undefined && value.length < node.minLength) {
      err(path, '비어 있을 수 없습니다.');
    }
    if (node.pattern && !new RegExp(node.pattern).test(value)) {
      err(path, `형식이 맞지 않습니다 (${node.pattern}).`);
    }
  }
  if (node.type === 'object' && value && typeof value === 'object') {
    for (const key of node.required ?? []) {
      if (!(key in value)) err(path, `'${key}' 가 없습니다.`);
    }
    for (const [key, child] of Object.entries(value)) {
      const sub = node.properties?.[key];
      if (!sub) {
        if (node.additionalProperties === false) {
          err(`${path}.${key}`, '스키마에 없는 필드입니다.');
        }
        continue;
      }
      check(child, sub, `${path}.${key}`);
    }
  }
  if (node.type === 'array' && Array.isArray(value) && node.items) {
    value.forEach((item, i) => check(item, node.items, `${path}[${i}]`));
  }
}

check(data, schema, 'tools.json');

// -- 크로스체크 ---------------------------------------------------------------
// 스키마가 표현할 수 없는 규칙들입니다.
const tools = Array.isArray(data.tools) ? data.tools : [];
const seenId = new Map();
const prefixes = new Map();

for (const [i, t] of tools.entries()) {
  const where = t?.tool ? `tools[${i}] (${t.tool})` : `tools[${i}]`;

  if (t?.id) {
    if (seenId.has(t.id)) err(where, `id '${t.id}' 가 ${seenId.get(t.id)} 와 중복입니다.`);
    else seenId.set(t.id, where);
  }
  if (t?.obs_prefix) {
    if (prefixes.has(t.obs_prefix)) {
      err(where, `obs_prefix '${t.obs_prefix}' 를 ${prefixes.get(t.obs_prefix)} 와 함께 씁니다. 산출물이 섞입니다.`);
    } else {
      prefixes.set(t.obs_prefix, where);
    }
  }
}

// 한 프리픽스가 다른 프리픽스의 앞부분이면, 매칭은 더 긴 쪽이 이깁니다.
// 동작은 하지만 의도한 것이 아닐 때가 많아 경고로 남깁니다.
for (const [a, whereA] of prefixes) {
  for (const b of prefixes.keys()) {
    if (a !== b && b.startsWith(a)) {
      warn(whereA, `obs_prefix '${a}' 가 '${b}' 의 앞부분입니다. 더 긴 '${b}' 가 우선 적용됩니다.`);
    }
  }
}

// -- OBS 캐시 대조 (있을 때만) ------------------------------------------------
const obsPath = [
  process.env.OBS_CACHE,
  resolve(root, 'data/obs_cache.json'),
].find((p) => p && existsSync(p));

if (obsPath) {
  let files = [];
  try {
    files = readJson(obsPath).files ?? [];
  } catch (e) {
    warn('obs_cache.json', `읽을 수 없습니다 — ${e.message}`);
  }

  const names = files.map((f) => f.filename ?? '').filter(Boolean);
  const matched = new Set();

  for (const [prefix, where] of prefixes) {
    const hits = names.filter((n) => n.startsWith(prefix));
    if (hits.length === 0) {
      warn(where, `obs_prefix '${prefix}' 에 걸리는 OBS 파일이 없습니다. 표에서 빈칸으로 보입니다.`);
    }
    hits.forEach((n) => matched.add(n));
  }

  // 어느 도구에도 귀속되지 않는 OBS 파일 = tools.json 에 등록이 빠진 산출물
  const orphans = names.filter((n) => !matched.has(n));
  if (orphans.length > 0) {
    warn('obs_cache.json', `어느 obs_prefix 에도 걸리지 않는 파일 ${orphans.length}개: ${orphans.slice(0, 5).join(', ')}${orphans.length > 5 ? ' …' : ''}`);
  }
}

// -- 결과 --------------------------------------------------------------------
for (const w of warnings) console.warn(`  경고  ${w}`);
for (const e of errors) console.error(`  오류  ${e}`);

const label = dataPath.replace(root + '/', '');
if (errors.length > 0) {
  console.error(`\n${label}: 오류 ${errors.length}건, 경고 ${warnings.length}건`);
  process.exit(1);
}
console.log(`\n${label}: 정상 (도구 ${tools.length}개, 경고 ${warnings.length}건)`);
