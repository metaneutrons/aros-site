#!/usr/bin/env node
// Keeps the release numbers on the landing page out of the source code.
//
//   node scripts/sync-releases.mjs          fetch the latest stable releases and
//                                           write src/data/releases.json
//   node scripts/sync-releases.mjs --live   compare the deployed page with the
//                                           latest releases and report
//                                           stale=true|false on GITHUB_OUTPUT
//
// The committed src/data/releases.json is the cache. A network or rate-limit
// failure keeps it unchanged and the build goes on with the last known
// versions. A response that is not a stable SemVer release aborts instead:
// a broken contract must not hide behind the cache.

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = path.join(root, 'src/data/releases.json');
const SOURCES = {
  tools: 'metaneutrons/aros-tools',
  toolchains: 'metaneutrons/aros-toolchains',
};
const SEMVER_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;
const SITE = 'https://aros.metaneutrons.cc/';

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

async function fetchLatest(repo) {
  const headers = {
    accept: 'application/vnd.github+json',
    'user-agent': 'aros-site-sync',
    'x-github-api-version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  let response;
  try {
    response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    return { transient: `${repo}: ${error.message}` };
  }
  if (response.status === 403 || response.status === 429 || response.status >= 500) {
    return { transient: `${repo}: HTTP ${response.status}` };
  }
  if (!response.ok) {
    fail(`${repo}: unexpected HTTP ${response.status}`);
  }
  const release = await response.json();
  if (release.draft || release.prerelease) {
    fail(`${repo}: the latest release is not a stable release`);
  }
  const match = SEMVER_TAG.exec(release.tag_name ?? '');
  if (match === null) {
    fail(`${repo}: tag ${JSON.stringify(release.tag_name)} is not vMAJOR.MINOR.PATCH`);
  }
  return { tag: release.tag_name };
}

function record(repo, tag) {
  return {
    tag,
    version: tag.slice(1),
    url: `https://github.com/${repo}/releases/tag/${tag}`,
  };
}

async function latestAll() {
  const result = {};
  const transient = [];
  for (const [key, repo] of Object.entries(SOURCES)) {
    const latest = await fetchLatest(repo);
    if (latest.transient) {
      transient.push(latest.transient);
    } else {
      result[key] = record(repo, latest.tag);
    }
  }
  return { result, transient };
}

const live = process.argv.includes('--live');
const { result, transient } = await latestAll();

if (live) {
  if (transient.length > 0) {
    console.warn(`warning: cannot decide, keeping the deployed page (${transient.join('; ')})`);
    await emit(false);
  } else {
    const html = await (await fetch(SITE, { signal: AbortSignal.timeout(20_000) })).text();
    const missing = Object.values(result).filter((entry) => !html.includes(entry.url));
    for (const entry of missing) {
      console.log(`deployed page lacks ${entry.url}`);
    }
    await emit(missing.length > 0);
  }
} else {
  let cached = {};
  try {
    cached = JSON.parse(await readFile(dataFile, 'utf8'));
  } catch {
    // no cache yet
  }
  if (transient.length > 0) {
    console.warn(`warning: using cached release data (${transient.join('; ')})`);
  }
  const merged = { ...cached, ...result };
  for (const key of Object.keys(SOURCES)) {
    if (!merged[key]) {
      fail(`no release data for ${key}: network failed and there is no cache`);
    }
  }
  const next = `${JSON.stringify(merged, null, 2)}\n`;
  let previous = '';
  try {
    previous = await readFile(dataFile, 'utf8');
  } catch {
    // first run
  }
  if (next !== previous) {
    await writeFile(dataFile, next);
    console.log(`updated ${path.relative(root, dataFile)}`);
  } else {
    console.log('release data unchanged');
  }
}

async function emit(stale) {
  console.log(`stale=${stale}`);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `stale=${stale}\n`);
  }
}
