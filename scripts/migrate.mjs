#!/usr/bin/env node
// =============================================================================
// 예전 tools.json 을 현재 구조로 바꿉니다. 한 번만 쓰는 스크립트입니다.
//
//   node scripts/migrate.mjs 예전파일.json > data/tools.json
//
// 예전 구조는 릴리즈와 에셋을 파일에 직접 적었지만, 지금은 그 정보를 OBS 에서
// obs_prefix 로 가져오므로 옮기지 않습니다. 옮기지 않은 필드는 stderr 에
// 알려주므로, 필요한 것이 있으면 표에서 직접 채워 넣으시면 됩니다.
// =============================================================================
import { readFileSync } from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('사용법: node scripts/migrate.mjs 예전파일.json > data/tools.json');
  process.exit(1);
}

let old;
try {
  old = JSON.parse(readFileSync(input, 'utf8'));
} catch (e) {
  console.error(`${input}: JSON 파싱 실패 — ${e.message}`);
  process.exit(1);
}

const dropped = new Map();
const note = (field, where) => {
  if (!dropped.has(field)) dropped.set(field, []);
  dropped.get(field).push(where);
};

const taken = new Set();
const makeId = (name) => {
  const base = String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tool';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
};

// url 이 없는 링크는 스키마가 거부하므로 넣지 않습니다.
const link = (label, url) => (url ? [{ label, url }] : []);

const tools = (old.tools ?? []).map((t) => {
  const where = t.tool ?? '(이름 없음)';
  const latest = (t.releases ?? [])[0];

  for (const f of ['summary', 'category', 'tags', 'maintainer']) {
    if (t[f] !== undefined && t[f] !== '' && !(Array.isArray(t[f]) && t[f].length === 0)) note(f, where);
  }
  if (t.releases?.length) note('releases (버전·에셋·검증)', where);

  return {
    id: makeId(t.tool),
    tool: t.tool ?? '',
    obs_prefix: t.obs_prefix ?? '',
    os_supported: t.os_supported ?? [],
    // 예전 구조에 없던 항목입니다. 표에서 채워 넣으세요.
    product_supported: [],
    manual: link('Manual', t.docs_url),
    // 최신 릴리즈의 notes 를 비고 문구로 옮깁니다.
    remarks_text: latest?.notes ?? '',
    remarks_links: link('Git Repo', t.repo_url),
  };
});

if (old.hub) note('hub (name·tagline·description·download_base)', '파일 전체');

process.stdout.write(JSON.stringify({
  schema_version: 1,
  updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00'),
  tools,
}, null, 2) + '\n');

console.error(`도구 ${tools.length}개를 옮겼습니다.`);
if (dropped.size > 0) {
  console.error('\n옮기지 않은 필드 (지금 구조에 자리가 없습니다):');
  for (const [field, wheres] of dropped) {
    console.error(`  ${field}  ←  ${[...new Set(wheres)].join(', ')}`);
  }
}
console.error('\nproduct_supported 는 예전 파일에 없던 항목이라 비어 있습니다. 표에서 채워 넣으세요.');
