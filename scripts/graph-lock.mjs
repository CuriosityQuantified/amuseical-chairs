#!/usr/bin/env node
// Distils graphify's manifest into a committable freshness lock.
//
// graphify already knows the MD5 of every file it indexed — it keeps them in
// graphify-out/manifest.json to decide what to re-extract. That file is not
// committable: it also carries each file's mtime, which is checkout time on a
// fresh clone, so every machine's first rebuild would rewrite all 38 entries
// and manufacture a conflict on a file the union merge driver does not cover.
//
// This writes the same information stripped to what a freshness check needs:
// path -> hashes, sorted. Same code in, byte-identical lock out, on any machine.
// `scripts/check.mjs` rule 7 verifies it; `npm run graph` regenerates it. No
// dependencies, in keeping with the rest of scripts/.
//
// Both hashes are recorded, because they mean different things and only one of
// them is CI's business. `ast` is the tree-sitter pass: free, deterministic,
// refreshed by `npm run graph`, so rule 7 hard-fails on it. `semantic` is the
// LLM pass, which is the ONLY way a doc gets into the graph at all — graphify
// blanks it when a file changes, and only `npm run graph:rebuild` with a backend
// can restore it. Recording just `ast` would report a rewritten README as fresh
// when its doc nodes still describe the old prose, so rule 7 warns on `semantic`
// separately rather than lying about it or failing a build that cannot fix it.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MANIFEST = join(ROOT, 'graphify-out/manifest.json');
const LOCK = join(ROOT, 'graphify-out/graph-lock.json');

if (!existsSync(MANIFEST)) {
  console.error(
    'graph-lock: graphify-out/manifest.json not found — run `npm run graph` (or ' +
    '`npm run graph:rebuild`) first; graphify writes the manifest as it extracts.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const files = {};
let semanticBehind = 0;
for (const path of Object.keys(manifest).sort()) {
  const entry = manifest[path] || {};
  // An entry with no ast_hash was never successfully parsed; recording an empty
  // hash would make rule 7 unfalsifiable for that file, so leave it out and say so.
  if (!entry.ast_hash) {
    console.warn(`graph-lock: skipping ${path} — no ast_hash in the manifest`);
    continue;
  }
  // graphify blanks semantic_hash when a file changes. Record null rather than ''
  // so the lock states "no semantic pass covers this content" outright.
  const semantic = entry.semantic_hash || null;
  if (!semantic) semanticBehind++;
  files[path] = { ast: entry.ast_hash, semantic };
}

writeFileSync(LOCK, `${JSON.stringify({ files }, null, 2)}\n`, 'utf8');
const n = Object.keys(files).length;
console.log(`graph-lock: wrote ${n} file hashes to graphify-out/graph-lock.json` +
  (semanticBehind ? ` (${semanticBehind} awaiting a semantic pass)` : ''));
