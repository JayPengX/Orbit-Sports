// Adds ?v=<build> to every local module import in public/ (app.js, lib/,
// lib/locales/), so a deploy never runs the new app.js with a module the
// browser cached from the last deploy: GitHub Pages lets browsers reuse a
// file for 10 minutes, and a stale locale file shows raw text keys. The
// service worker matches its cache ignoring the query, so it still serves
// these offline. Run by the deploy workflow only.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const version = process.argv[2];
if (!version) throw new Error('usage: node scripts/stamp-modules.mjs <build>');
const root = new URL('../public/', import.meta.url).pathname;

async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(path)));
    else if (/\.m?js$/.test(entry.name) && entry.name !== 'sw.js') out.push(path);
  }
  return out;
}

// './x.mjs', '../locales/x.mjs' after from / import( / new URL(.
const LOCAL = /((?:from|import\(|new URL\()\s*['"])(\.\.?\/[^'"?]+\.m?js)(['"])/g;
for (const path of await files(root)) {
  const text = await readFile(path, 'utf8');
  const stamped = text.replace(LOCAL, (_, before, file, after) => `${before}${file}?v=${version}${after}`);
  if (stamped !== text) await writeFile(path, stamped);
}
