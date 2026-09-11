#!/usr/bin/env node
// Dependency-free validator for tools.json.
// Checks structure, cross-field consistency, and release hygiene.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const err = (p, m) => errors.push(`${p}: ${m}`);
const warn = (p, m) => warnings.push(`${p}: ${m}`);

const OS = ['windows', 'linux', 'macos'];
const ARCH = ['x64', 'x86', 'arm64', 'arm', 'universal'];
const CHANNELS = ['stable', 'rc', 'beta', 'alpha'];
const STATUS = ['verified', 'pending', 'unverified'];
const PLACEHOLDER_SHA = '0'.repeat(64);

// Maps the display form in os_supported ("Windows (x64, arm64)") to os + arch list.
const OS_ALIASES = {
  window: 'windows', windows: 'windows', win: 'windows',
  linux: 'linux',
  macos: 'macos', mac: 'macos', osx: 'macos', darwin: 'macos',
};

export function parseOsSupported(entry) {
  const m = /^\s*([^(]+?)\s*(?:\(([^)]*)\))?\s*$/.exec(entry);
  if (!m) return null;
  const key = m[1].toLowerCase().replace(/[^a-z]/g, '');
  const os = OS_ALIASES[key];
  if (!os) return null;
  const arches = (m[2] || '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  return { os, arches, label: m[1].trim() };
}

const doc = JSON.parse(readFileSync(resolve(root, 'tools.json'), 'utf8'));

if (!/^\d+\.\d+\.\d+$/.test(doc.schema_version ?? '')) {
  err('schema_version', 'must be a semver string, e.g. "1.0.0"');
}
if (!Array.isArray(doc.tools)) {
  err('tools', 'must be an array');
  report();
}

const seenTools = new Set();

for (const [i, tool] of doc.tools.entries()) {
  const tp = `tools[${i}]`;
  const name = tool.tool;

  if (!name) err(tp, 'missing "tool"');
  else if (seenTools.has(name)) err(tp, `duplicate tool name "${name}"`);
  else seenTools.add(name);

  const p = name ? `tools[${name}]` : tp;

  if (!tool.obs_prefix) err(p, 'missing "obs_prefix"');

  // os_supported -> the platform matrix the tool claims to cover.
  const declared = new Map(); // os -> Set(arch)
  if (!Array.isArray(tool.os_supported) || tool.os_supported.length === 0) {
    err(p, 'os_supported must be a non-empty array');
  } else {
    for (const entry of tool.os_supported) {
      const parsed = parseOsSupported(entry);
      if (!parsed) {
        err(p, `os_supported entry "${entry}" is not parseable (expected "OS (arch, arch)")`);
        continue;
      }
      if (parsed.label.toLowerCase() === 'window') {
        warn(p, `os_supported "${entry}": use "Windows", not "Window"`);
      }
      if (parsed.arches.length === 0) {
        warn(p, `os_supported "${entry}" declares no architectures`);
      }
      for (const a of parsed.arches) {
        if (!ARCH.includes(a)) err(p, `os_supported "${entry}": unknown arch "${a}"`);
      }
      if (!declared.has(parsed.os)) declared.set(parsed.os, new Set());
      for (const a of parsed.arches) declared.get(parsed.os).add(a);
    }
  }

  if (!Array.isArray(tool.releases) || tool.releases.length === 0) {
    err(p, 'releases must be a non-empty array');
    continue;
  }

  const seenVersions = new Set();
  for (const [j, rel] of tool.releases.entries()) {
    const rp = `${p}.releases[${rel.version ?? j}]`;

    if (!rel.version) err(rp, 'missing "version"');
    else if (seenVersions.has(rel.version)) err(rp, `duplicate version "${rel.version}"`);
    else seenVersions.add(rel.version);

    if (!CHANNELS.includes(rel.channel)) {
      err(rp, `channel must be one of ${CHANNELS.join(', ')}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rel.released_at ?? '')) {
      err(rp, 'released_at must be YYYY-MM-DD');
    }

    const v = rel.verification;
    if (!v || !STATUS.includes(v.status)) {
      err(rp, `verification.status must be one of ${STATUS.join(', ')}`);
    } else if (v.status === 'verified') {
      if (!v.verified_by) err(rp, 'verified releases need verification.verified_by');
      if (!v.verified_at) err(rp, 'verified releases need verification.verified_at');
    }

    if (!Array.isArray(rel.assets) || rel.assets.length === 0) {
      err(rp, 'assets must be a non-empty array');
      continue;
    }

    const seenFiles = new Set();
    const covered = new Map();

    for (const asset of rel.assets) {
      const ap = `${rp}.${asset.file ?? '<no file>'}`;

      if (!asset.file) { err(ap, 'missing "file"'); continue; }
      if (seenFiles.has(asset.file)) err(ap, 'duplicate asset filename');
      seenFiles.add(asset.file);

      // obs_prefix is the contract for asset naming, so enforce it.
      if (tool.obs_prefix && !asset.file.startsWith(tool.obs_prefix)) {
        err(ap, `filename must start with obs_prefix "${tool.obs_prefix}"`);
      }
      if (rel.version && !asset.file.includes(rel.version)) {
        warn(ap, `filename does not contain version "${rel.version}"`);
      }

      if (!OS.includes(asset.os)) err(ap, `os must be one of ${OS.join(', ')}`);
      if (!ARCH.includes(asset.arch)) err(ap, `arch must be one of ${ARCH.join(', ')}`);

      if (!/^[0-9a-f]{64}$/.test(asset.sha256 ?? '')) {
        err(ap, 'sha256 must be 64 lowercase hex characters');
      } else if (asset.sha256 === PLACEHOLDER_SHA) {
        warn(ap, 'sha256 is still the all-zero placeholder');
      }

      if (asset.size !== undefined && (!Number.isInteger(asset.size) || asset.size < 0)) {
        err(ap, 'size must be a non-negative integer');
      } else if (!asset.size) {
        warn(ap, 'size is 0 or missing');
      }

      if (!asset.url && !doc.hub?.download_base) {
        err(ap, 'asset has no url and hub.download_base is not set to derive one from');
      }

      if (OS.includes(asset.os) && ARCH.includes(asset.arch)) {
        if (!covered.has(asset.os)) covered.set(asset.os, new Set());
        covered.get(asset.os).add(asset.arch);
      }
    }

    // Every platform the tool advertises should actually have a downloadable asset.
    for (const [os, arches] of declared) {
      for (const arch of arches) {
        if (!covered.get(os)?.has(arch)) {
          warn(rp, `os_supported declares ${os}/${arch} but this release ships no such asset`);
        }
      }
    }
    for (const [os, arches] of covered) {
      for (const arch of arches) {
        if (!declared.get(os)?.has(arch)) {
          err(rp, `ships ${os}/${arch} asset but os_supported does not declare it`);
        }
      }
    }
  }
}

report();

function report() {
  for (const w of warnings) console.warn(`warn  ${w}`);
  for (const e of errors) console.error(`error ${e}`);
  const counts = `${errors.length} error(s), ${warnings.length} warning(s)`;
  if (errors.length) {
    console.error(`\ntools.json is invalid — ${counts}`);
    process.exit(1);
  }
  console.log(`tools.json is valid — ${counts}`);
  process.exit(0);
}
