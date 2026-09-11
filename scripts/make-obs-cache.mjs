#!/usr/bin/env node
// =============================================================================
// OBS 파일 목록으로 obs_cache.json 을 만듭니다.
//
// 페이지는 OBS 에 직접 접속하지 않고 이 파일만 읽습니다. 그래서 OBS 에 새 산출물이
// 올라가면 이 스크립트를 다시 돌려 파일을 갱신해야 표에 반영됩니다.
// (cron 에 걸어두면 손이 안 갑니다. 예: 10분마다)
//
// 쓰는 법 - 둘 중 하나
//
//   1) OBS 가 로컬에 마운트되어 있거나 파일이 디렉터리에 있을 때
//      node scripts/make-obs-cache.mjs --dir /mnt/obs/release data/obs_cache.json
//
//   2) 파일 이름 목록만 있을 때 (한 줄에 하나)
//      node scripts/make-obs-cache.mjs --list files.txt data/obs_cache.json
//
//      목록은 어떻게 뽑아도 됩니다. 예를 들어 S3 계열이면
//        aws s3 ls s3://버킷/release/ | awk '{print $4}' > files.txt
//      HTTP 목록 페이지라면 브라우저에서 복사해 붙여 넣어도 됩니다.
//
// 옵션
//   --prefix release/   key 앞에 붙일 경로. OBS_BASE_URL 뒤에 이 key 가 붙어
//                       다운로드 주소가 됩니다. 기본값은 release/ 입니다.
// =============================================================================
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const dir = opt('--dir', null);
const listFile = opt('--list', null);
let keyPrefix = opt('--prefix', 'release/');

// 출력 파일은 옵션이 아닌 첫 번째 인자입니다.
const positional = argv.filter((a, i) => {
  if (a.startsWith('--')) return false;
  return !argv[i - 1]?.startsWith('--');
});
const output = positional[0] ?? null;

if (!dir && !listFile) {
  console.error('사용법:');
  console.error('  node scripts/make-obs-cache.mjs --dir /mnt/obs/release [출력파일]');
  console.error('  node scripts/make-obs-cache.mjs --list files.txt   [출력파일]');
  console.error('  --prefix release/   key 앞에 붙일 경로 (기본값 release/)');
  process.exit(1);
}

if (keyPrefix && !keyPrefix.endsWith('/')) keyPrefix += '/';

const files = [];

if (dir) {
  // 하위 디렉터리까지 훑습니다. key 는 지정한 디렉터리 기준 상대경로입니다.
  const walk = (base, rel = '') => {
    let entries;
    try {
      entries = readdirSync(join(base, rel), { withFileTypes: true });
    } catch (e) {
      console.error(`${join(base, rel)}: 읽을 수 없습니다 - ${e.message}`);
      process.exit(1);
    }
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(base, childRel);
        continue;
      }
      const st = statSync(join(base, childRel));
      files.push({
        key: keyPrefix + childRel,
        filename: entry.name,
        last_modified: st.mtime.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        size: st.size,
      });
    }
  };
  walk(dir);
} else {
  let raw;
  try {
    raw = readFileSync(listFile, 'utf8');
  } catch (e) {
    console.error(`${listFile}: 읽을 수 없습니다 - ${e.message}`);
    process.exit(1);
  }
  for (const line of raw.split('\n')) {
    // 경로가 섞여 있어도 되도록 마지막 조각을 파일명으로 씁니다.
    const name = line.trim().split('/').pop();
    if (!name) continue;
    files.push({
      key: keyPrefix + name,
      filename: name,
      // 목록만으로는 알 수 없는 값입니다. 화면에서는 '-' 로 비워 보입니다.
      last_modified: null,
      size: 0,
    });
  }
}

const json = JSON.stringify({
  updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  files,
}, null, 2) + '\n';

if (output) {
  writeFileSync(output, json);
  console.error(`${output} 에 썼습니다. 파일 ${files.length}개.`);
} else {
  process.stdout.write(json);
  console.error(`파일 ${files.length}개.`);
}

if (files.length === 0) {
  console.error('비어 있습니다. 경로나 목록을 확인하세요.');
} else {
  console.error(`첫 항목: ${files[0].key}`);
  console.error('\n다음: node scripts/validate.mjs 로 obs_prefix 와 맞는지 확인하세요.');
}
