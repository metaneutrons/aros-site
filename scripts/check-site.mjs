import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const required = new Set([
  '404.html',
  'favicon.svg',
  'index.html',
  'robots.txt',
  'site.webmanifest',
  'sitemap-0.xml',
  'sitemap-index.xml',
  'social-card.png',
  'social-card.svg',
]);
const files = new Set();
const publicOrigin = new URL('https://aros.metaneutrons.cc/');

function fail(message) {
  throw new Error(message);
}

async function walk(directory) {
  const status = await lstat(directory);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    fail(`output path is not a real directory: ${directory}`);
  }
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      fail(`output contains a symbolic link: ${entryPath}`);
    }
    if (entry.isDirectory()) {
      await walk(entryPath);
    } else if (entry.isFile()) {
      files.add(path.relative(root, entryPath));
    } else {
      fail(`output contains a non-regular entry: ${entryPath}`);
    }
  }
}

function publicPathToFile(pathname) {
  const relative = pathname.replace(/^\/+/, '');
  if (pathname.endsWith('/')) {
    return path.join(relative, 'index.html');
  }
  return relative;
}

function verifyLinks(file, html) {
  const ids = new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
  );
  for (const match of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const reference = match[1];
    if (reference.startsWith('#')) {
      if (!ids.has(reference.slice(1))) {
        fail(`${file} references a missing local anchor: ${reference}`);
      }
      continue;
    }
    const target = new URL(reference, publicOrigin);
    if (target.protocol !== 'https:' || target.username || target.password) {
      fail(`${file} contains an unsafe URL: ${reference}`);
    }
    if (target.origin !== publicOrigin.origin) {
      continue;
    }
    if (target.pathname === '/aros-tools' || target.pathname.startsWith('/aros-tools/')) {
      continue;
    }
    const targetFile = publicPathToFile(target.pathname);
    if (!files.has(targetFile)) {
      fail(`${file} references a missing site asset: ${reference}`);
    }
    if (target.hash && target.pathname === '/') {
      const landing = target.hash.slice(1);
      if (!ids.has(landing)) {
        fail(`${file} references a missing landing-page anchor: ${target.hash}`);
      }
    }
  }
}

try {
  await walk(root);
  const missing = [...required].filter((entry) => !files.has(entry));
  if (missing.length > 0) {
    fail(`output is missing required files: ${missing.join(', ')}`);
  }
  const htmlFiles = [...files].filter((file) => file.endsWith('.html'));
  const htmlByFile = new Map();
  for (const file of htmlFiles) {
    const html = await readFile(path.join(root, file), 'utf8');
    htmlByFile.set(file, html);
    verifyLinks(file, html);
  }
  const index = htmlByFile.get('index.html');
  for (const marker of [
    '<title>AROS — engineering for the next build</title>',
    'href="/aros-tools/"',
    'href="https://github.com/metaneutrons/AROS-NX"',
    'href="https://github.com/metaneutrons/aros-toolchains"',
  ]) {
    if (!index.includes(marker)) {
      fail(`landing page lacks required marker: ${marker}`);
    }
  }
  console.log(
    `validated ${files.size} regular landing-page assets and ${htmlFiles.length} HTML documents`,
  );
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
