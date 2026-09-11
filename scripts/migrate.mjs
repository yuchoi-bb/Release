#!/usr/bin/env node
// =============================================================================
// 예전 tools.json 을 현재 구조로 바꿉니다.
//
//   node scripts/migrate.mjs 예전파일.json data/tools.json
//   node scripts/migrate.mjs 예전파일.json            (표준출력으로)
//
// 출력 파일을 인자로 주면 변환에 성공했을 때만 씁니다. `>` 리다이렉션은 명령이
// 실패해도 대상 파일을 먼저 비우기 때문에, 덮어쓸 때는 인자 쪽을 쓰세요.
//
// 두 가지 예전 형식을 도구마다 알아서 구분합니다.
//   A) remarks 가 링크 배열인 형식   { tool, obs_prefix, os_supported,
//                                     product_supported, manual, remarks }
//   B) releases 를 파일에 적던 형식  { tool, obs_prefix, os_supported, summary,
//                                     repo_url, docs_url, releases[] }
// 이미 현재 구조인 파일을 넣어도 안전합니다.
// =============================================================================
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('사용법: node scripts/migrate.mjs 예전파일.json [출력파일.json]');
  console.error('  출력 파일을 주면 성공했을 때만 씁니다. 생략하면 표준출력으로 내보냅니다.');
  process.exit(1);
}

let old;
try {
  old = JSON.parse(readFileSync(input, 'utf8'));
} catch (e) {
  console.error(`${input}: JSON 파싱 실패 — ${e.message}`);
  process.exit(1);
}

const notes = [];
const dropped = new Map();
const drop = (field, where) => {
  if (!dropped.has(field)) dropped.set(field, new Set());
  dropped.get(field).add(where);
};

// -- 값 다듬기 ----------------------------------------------------------------

// 예전 라벨에는 화면 표시용 불릿이 값 안에 박혀 있었습니다("* Manual").
// 지금은 페이지가 불릿을 직접 그리므로 떼어냅니다. 남겨두면 불릿이 두 번 찍힙니다.
const cleanLabel = (s) => String(s ?? '').replace(/^[\s*•▸-]+/, '').trim();
const text = (s) => String(s ?? '').trim();
const list = (v) => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);

/** {label,url} 배열을 다듬습니다. url 이 없으면 스키마가 거부하므로 버립니다. */
function links(value, where, field) {
  if (!Array.isArray(value)) return null;
  const out = [];
  const seen = new Set();

  for (const l of value) {
    if (!l || typeof l !== 'object') continue;
    const url = text(l.url);
    const label = cleanLabel(l.label);

    if (!url) {
      if (label) notes.push(`${where}: ${field} 의 '${label}' 은 URL 이 없어 뺐습니다.`);
      continue;
    }
    if (!/^https?:\/\//i.test(url)) {
      notes.push(`${where}: ${field} 의 '${label || url}' 은 http/https 가 아니라 뺐습니다.`);
      continue;
    }
    const key = `${label} ${url}`;
    if (seen.has(key)) {
      notes.push(`${where}: ${field} 에 '${label}' 이 중복이라 하나만 남겼습니다.`);
      continue;
    }
    seen.add(key);
    out.push({ label, url });
  }
  return out;
}

const one = (label, url) => (text(url) ? [{ label, url: text(url) }] : []);

// -- id ------------------------------------------------------------------------
const taken = new Set();
function makeId(name) {
  const base = String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tool';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

// -- 도구 하나 -----------------------------------------------------------------
function convert(t) {
  const where = text(t.tool) || '(이름 없음)';
  const latest = Array.isArray(t.releases) ? t.releases[0] : null;

  // 형식 B 에만 있고 지금 표에 자리가 없는 것들
  for (const f of ['summary', 'category', 'tags', 'maintainer']) {
    const v = t[f];
    if (v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) drop(f, where);
  }
  if (Array.isArray(t.releases) && t.releases.length) drop('releases (버전·에셋·검증)', where);

  // 형식 A 는 remarks 가 링크 배열, 형식 B 는 repo_url 하나뿐입니다.
  const remarkLinks = links(t.remarks, where, 'remarks')
    ?? links(t.remarks_links, where, 'remarks_links')
    ?? one('Git Repo', t.repo_url);

  const manual = links(t.manual, where, 'manual') ?? one('Manual', t.docs_url);

  return {
    id: text(t.id) || makeId(t.tool),
    tool: text(t.tool),
    obs_prefix: text(t.obs_prefix),
    os_supported: list(t.os_supported),
    product_supported: list(t.product_supported),
    manual,
    // 형식 B 는 최신 릴리즈의 notes 를 비고 문구로 옮깁니다.
    remarks_text: text(t.remarks_text) || text(latest?.notes),
    remarks_links: remarkLinks,
  };
}

const tools = (old.tools ?? []).map(convert);
if (old.hub) drop('hub (name·tagline·description·download_base)', '파일 전체');

// -- 눈에 띄는 값은 고치지 않고 알려만 줍니다 -----------------------------------
for (const t of tools) {
  for (const os of t.os_supported) {
    if (/^window\b/i.test(os) && !/^windows\b/i.test(os)) {
      notes.push(`${t.tool}: os_supported 의 "${os}" 는 "Windows" 오타로 보입니다. 값은 그대로 두었습니다.`);
    }
  }
  for (const p of t.product_supported) {
    if (/[()]/.test(p)) {
      notes.push(`${t.tool}: product_supported 의 "${p}" 에 괄호가 섞여 있습니다. 값은 그대로 두었습니다.`);
    }
  }
  if (!t.obs_prefix) {
    notes.push(`${t.tool}: obs_prefix 가 비어 있습니다. OBS 산출물이 하나도 안 잡힙니다.`);
  }
}

// -- 출력 ---------------------------------------------------------------------
const json = JSON.stringify({
  schema_version: 1,
  updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'),
  tools,
}, null, 2) + '\n';

// 여기까지 왔으면 변환이 끝났으므로, 이제 써도 원본을 잃지 않습니다.
if (output) {
  writeFileSync(output, json);
  console.error(`${output} 에 썼습니다. 도구 ${tools.length}개.`);
} else {
  process.stdout.write(json);
  console.error(`도구 ${tools.length}개를 옮겼습니다.`);
}

if (notes.length) {
  console.error('\n손본 것과 확인하실 것:');
  for (const n of notes) console.error(`  ${n}`);
}
if (dropped.size) {
  console.error('\n옮기지 않은 필드 (지금 구조에 자리가 없습니다):');
  for (const [field, wheres] of dropped) console.error(`  ${field}  ${[...wheres].join(', ')}`);
}
