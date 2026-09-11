// ToolHub Release page — renders tools.json as a filterable download catalog.

const OS_ALIASES = {
  window: 'windows', windows: 'windows', win: 'windows',
  linux: 'linux',
  macos: 'macos', mac: 'macos', osx: 'macos', darwin: 'macos',
};

const OS_LABELS = { windows: 'Windows', linux: 'Linux', macos: 'macOS' };
const CHANNEL_LABELS = { stable: 'Stable', rc: 'RC', beta: 'Beta', alpha: 'Alpha' };
const STATUS_LABELS = { verified: '검증 완료', pending: '검증 중', unverified: '미검증' };

const el = (id) => document.getElementById(id);

const state = {
  tools: [],
  hub: {},
  query: '',
  os: new Set(),
  channels: new Set(),
  verifiedOnly: false,
};

/** "Windows (x64, x86, arm64)" -> { os, arches, label } */
function parseOsSupported(entry) {
  const m = /^\s*([^(]+?)\s*(?:\(([^)]*)\))?\s*$/.exec(String(entry));
  if (!m) return null;
  const key = m[1].toLowerCase().replace(/[^a-z]/g, '');
  const os = OS_ALIASES[key];
  if (!os) return null;
  const arches = (m[2] || '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
  return { os, arches, label: OS_LABELS[os] };
}

function formatSize(bytes) {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) { n /= 1024; u += 1; }
  return `${n >= 10 || u === 0 ? Math.round(n) : n.toFixed(1)} ${units[u]}`;
}

/** An explicit url wins; otherwise derive one from hub.download_base. */
function assetUrl(tool, release, asset) {
  if (asset.url) return asset.url;
  const base = state.hub.download_base;
  if (!base) return '';
  return `${base.replace(/\/$/, '')}/${tool.tool}-${release.version}/${asset.file}`;
}

function verifyCommands(asset) {
  return [
    `# Windows (PowerShell)`,
    `Get-FileHash -Algorithm SHA256 .\\${asset.file}`,
    ``,
    `# macOS / Linux`,
    `shasum -a 256 ${asset.file}`,
    ``,
    `# 기대값`,
    asset.sha256,
  ].join('\n');
}

// --- rendering ------------------------------------------------------------

function badge(text, cls = '') {
  const b = document.createElement('span');
  b.className = `badge ${cls}`.trim();
  b.textContent = text;
  return b;
}

function renderAssetRow(tool, release, asset) {
  const tr = document.createElement('tr');

  const file = document.createElement('td');
  file.className = 'file';
  file.textContent = asset.file;
  tr.append(file);

  const platform = document.createElement('td');
  platform.textContent = `${OS_LABELS[asset.os] ?? asset.os} · ${asset.arch}`;
  tr.append(platform);

  const size = document.createElement('td');
  size.className = 'size';
  size.textContent = formatSize(asset.size);
  tr.append(size);

  const hash = document.createElement('td');
  const hashWrap = document.createElement('div');
  hashWrap.className = 'hash';
  const code = document.createElement('code');
  code.textContent = `${asset.sha256.slice(0, 12)}…`;
  code.title = asset.sha256;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'copy';
  copy.textContent = 'SHA-256 복사';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(asset.sha256);
      copy.textContent = '복사됨';
    } catch {
      copy.textContent = '복사 실패';
    }
    setTimeout(() => { copy.textContent = 'SHA-256 복사'; }, 1500);
  });
  hashWrap.append(code, copy);
  hash.append(hashWrap);
  tr.append(hash);

  const dl = document.createElement('td');
  const link = document.createElement('a');
  link.className = 'dl';
  link.textContent = '다운로드';
  const url = assetUrl(tool, release, asset);
  if (url) {
    link.href = url;
  } else {
    link.setAttribute('aria-disabled', 'true');
    link.textContent = '준비 중';
  }
  dl.append(link);
  tr.append(dl);

  return tr;
}

function renderRelease(tool, release, isLatest) {
  const details = document.createElement('details');
  details.className = 'release';
  if (isLatest) details.open = true;

  const summary = document.createElement('summary');
  const version = document.createElement('span');
  version.className = 'release-version';
  version.textContent = `v${release.version}`;
  summary.append(version);
  summary.append(badge(CHANNEL_LABELS[release.channel] ?? release.channel));
  const status = release.verification?.status ?? 'unverified';
  summary.append(badge(STATUS_LABELS[status] ?? status, status));
  const date = document.createElement('span');
  date.className = 'release-date';
  date.textContent = release.released_at ?? '';
  summary.append(date);
  details.append(summary);

  const body = document.createElement('div');
  body.className = 'release-body';

  if (release.notes) {
    const notes = document.createElement('p');
    notes.className = 'release-notes';
    notes.textContent = release.notes;
    body.append(notes);
  }

  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  const table = document.createElement('table');
  table.innerHTML =
    '<thead><tr><th>파일</th><th>플랫폼</th><th>크기</th><th>체크섬</th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const asset of release.assets ?? []) {
    tbody.append(renderAssetRow(tool, release, asset));
  }
  table.append(tbody);
  scroll.append(table);
  body.append(scroll);

  const first = release.assets?.[0];
  if (first) {
    const help = document.createElement('details');
    help.className = 'verify-help';
    const helpSummary = document.createElement('summary');
    helpSummary.textContent = '체크섬 검증 방법';
    const pre = document.createElement('pre');
    pre.textContent = verifyCommands(first);
    help.append(helpSummary, pre);
    body.append(help);
  }

  details.append(body);
  return details;
}

function renderTool(tool) {
  const card = document.createElement('article');
  card.className = 'tool';
  card.id = `tool-${tool.tool}`;

  const head = document.createElement('div');
  head.className = 'tool-head';
  const name = document.createElement('h2');
  name.className = 'tool-name';
  name.textContent = tool.tool;
  head.append(name);
  if (tool.summary) {
    const summary = document.createElement('p');
    summary.className = 'tool-summary';
    summary.textContent = tool.summary;
    head.append(summary);
  }
  card.append(head);

  const meta = document.createElement('div');
  meta.className = 'meta-row';
  const latest = tool.releases?.[0];
  if (latest) meta.append(badge(`v${latest.version}`, 'version'));
  for (const entry of tool.os_supported ?? []) {
    const parsed = parseOsSupported(entry);
    meta.append(badge(parsed ? `${parsed.label} (${parsed.arches.join(', ')})` : entry));
  }
  for (const tag of tool.tags ?? []) meta.append(badge(`#${tag}`));
  card.append(meta);

  for (const [i, release] of (tool.releases ?? []).entries()) {
    card.append(renderRelease(tool, release, i === 0));
  }

  return card;
}

// --- filtering ------------------------------------------------------------

function toolMatches(tool) {
  if (state.query) {
    const haystack = [
      tool.tool, tool.summary, tool.category, tool.maintainer,
      ...(tool.tags ?? []), ...(tool.os_supported ?? []),
    ].filter(Boolean).join(' ').toLowerCase();
    if (!haystack.includes(state.query)) return false;
  }

  if (state.os.size) {
    const toolOs = new Set(
      (tool.os_supported ?? []).map(parseOsSupported).filter(Boolean).map((p) => p.os),
    );
    if (![...state.os].some((os) => toolOs.has(os))) return false;
  }

  const releases = tool.releases ?? [];
  const visible = releases.filter((r) => {
    if (state.channels.size && !state.channels.has(r.channel)) return false;
    if (state.verifiedOnly && r.verification?.status !== 'verified') return false;
    return true;
  });

  return visible.length > 0 ? { ...tool, releases: visible } : false;
}

function render() {
  const list = el('tools');
  list.textContent = '';

  const matched = state.tools.map(toolMatches).filter(Boolean);
  for (const tool of matched) list.append(renderTool(tool));

  el('empty').hidden = matched.length > 0;
  el('result-count').textContent =
    `${matched.length}개 도구 / 전체 ${state.tools.length}개`;
}

// --- filter controls ------------------------------------------------------

function buildChips(container, values, labels, selected) {
  container.textContent = '';
  for (const value of values) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = labels[value] ?? value;
    chip.setAttribute('aria-pressed', 'false');
    chip.addEventListener('click', () => {
      const on = chip.getAttribute('aria-pressed') === 'true';
      chip.setAttribute('aria-pressed', String(!on));
      if (on) selected.delete(value); else selected.add(value);
      render();
    });
    container.append(chip);
  }
}

function setupFilters() {
  const osValues = [...new Set(
    state.tools.flatMap((t) => (t.os_supported ?? []).map(parseOsSupported))
      .filter(Boolean).map((p) => p.os),
  )];
  const channelValues = [...new Set(
    state.tools.flatMap((t) => (t.releases ?? []).map((r) => r.channel)).filter(Boolean),
  )];

  buildChips(el('os-filters'), osValues, OS_LABELS, state.os);
  buildChips(el('channel-filters'), channelValues, CHANNEL_LABELS, state.channels);

  let debounce;
  el('q').addEventListener('input', (e) => {
    clearTimeout(debounce);
    const value = e.target.value.trim().toLowerCase();
    debounce = setTimeout(() => { state.query = value; render(); }, 120);
  });

  el('verified-only').addEventListener('change', (e) => {
    state.verifiedOnly = e.target.checked;
    render();
  });
}

// --- boot -----------------------------------------------------------------

/** Newest version first, so releases[0] is always the latest. */
function sortReleases(tool) {
  const releases = [...(tool.releases ?? [])].sort((a, b) => {
    const byDate = String(b.released_at ?? '').localeCompare(String(a.released_at ?? ''));
    if (byDate !== 0) return byDate;
    return String(b.version).localeCompare(String(a.version), undefined, { numeric: true });
  });
  return { ...tool, releases };
}

async function main() {
  try {
    const res = await fetch('./tools.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`tools.json 요청 실패 (HTTP ${res.status})`);
    const doc = await res.json();

    state.hub = doc.hub ?? {};
    state.tools = (doc.tools ?? []).map(sortReleases);

    if (state.hub.name) {
      el('hub-name').textContent = state.hub.name;
      document.title = state.hub.name;
    }
    el('hub-tagline').textContent = state.hub.tagline ?? '';
    el('hub-desc').textContent = state.hub.description ?? '';
    el('hub-updated').textContent = state.hub.updated_at
      ? `마지막 갱신: ${state.hub.updated_at}` : '';

    setupFilters();
    render();
  } catch (e) {
    const box = el('error');
    box.hidden = false;
    box.textContent = `카탈로그를 불러오지 못했습니다: ${e.message}`;
  }
}

main();
