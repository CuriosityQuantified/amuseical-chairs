#!/usr/bin/env node
// Static checks that `node --test` structurally cannot do.
//
// The browser half of this app has no build step: `public/js/*.js` are ES
// modules the server hands to the browser verbatim, importing `/shared/*.js`
// by absolute URL. Node cannot import them, so nothing in the test suite ever
// parses them, and nothing verifies that a game on the server roster actually
// has a client to play it on. Every one of those gaps is a runtime-only break
// that reaches a room full of people before it reaches a test.
//
// Run with `npm run check`. No dependencies — this repo stays install-light.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ROSTER, TWO_STAGE, NEEDS_AGGREGATION } from '../server/games.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const problems = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const rel = (abs) => relative(ROOT, abs);

function walk(dir, out = []) {
  for (const name of readdirSync(join(ROOT, dir))) {
    const abs = join(ROOT, dir, name);
    if (statSync(abs).isDirectory()) walk(join(dir, name), out);
    else if (name.endsWith('.js') || name.endsWith('.mjs')) out.push(rel(abs));
  }
  return out;
}

const SOURCE_DIRS = ['server', 'shared', 'test', 'scripts', 'public/js'];
const files = SOURCE_DIRS.flatMap((d) => walk(d));

// ---- 1. everything parses ---------------------------------------------------
// `node --check` parses without executing, which is the only way to cover the
// browser modules at all.
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', join(ROOT, file)], { stdio: 'pipe' });
  } catch (err) {
    fail(file, `syntax error\n${String(err.stderr || err.message).trim()}`);
  }
}

// ---- 2. browser modules resolve in a browser --------------------------------
// There is no bundler and no import map: a bare specifier like `import x from
// 'three'` is a 404 on a player's phone, and only there.
const BARE_IMPORT = /(?:^|\n)\s*import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;
for (const file of files.filter((f) => f.startsWith('public/js/'))) {
  const src = read(file);
  for (const [, spec] of src.matchAll(BARE_IMPORT)) {
    if (!spec.startsWith('/') && !spec.startsWith('./') && !spec.startsWith('../')) {
      fail(file, `bare import "${spec}" — the browser has no bundler; use an absolute /path`);
    }
  }
  // Dynamic imports too (the slingshot loads three.js this way).
  for (const [, spec] of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (!spec.startsWith('/') && !spec.startsWith('.')) {
      fail(file, `bare dynamic import "${spec}" — use an absolute /path`);
    }
  }
}

// ---- 3. the roster, its clients, and its tutorials agree --------------------
// Adding a game touches three files in two languages of runtime. Missing any
// one of them fails only when that game is drawn, in front of the room.
const clientSrc = read('public/js/games.js');
const tutorialSrc = read('public/js/tutorials.js');

const clientKeys = new Set(
  [...clientSrc.matchAll(/GameClients\.([A-Za-z0-9_]+)\s*=/g)].map((m) => m[1])
);
// TUTORIALS entries are `key: [` at one level of indentation.
const tutorialBody = tutorialSrc.slice(tutorialSrc.indexOf('const TUTORIALS'));
const tutorialKeys = new Set(
  [...tutorialBody.matchAll(/\n {2}([A-Za-z0-9_]+):\s*\[/g)].map((m) => m[1])
);

for (const game of ROSTER) {
  if (!clientKeys.has(game.key)) {
    fail('public/js/games.js', `roster game "${game.key}" has no GameClients.${game.key}`);
  }
  if (!tutorialKeys.has(game.key)) {
    fail('public/js/tutorials.js', `roster game "${game.key}" has no tutorial`);
  }
}
for (const key of clientKeys) {
  if (!ROSTER.some((g) => g.key === key)) {
    fail('server/games.js', `GameClients.${key} has no entry on the server roster`);
  }
}
// The chairs finale has a tutorial but is not a roster game — everything else
// with a tutorial should be one.
for (const key of tutorialKeys) {
  if (key !== 'chairs' && !ROSTER.some((g) => g.key === key)) {
    fail('server/games.js', `tutorial "${key}" has no entry on the server roster`);
  }
}

// ---- 4. two-stage games are wired end to end --------------------------------
// A two-stage game that scores per-player on submit would score stage one's
// raw payload; one whose client has no stage-aware entry point would render
// its writing stage twice and never collect a vote.
for (const key of TWO_STAGE) {
  const game = ROSTER.find((g) => g.key === key);
  if (!game) {
    fail('server/games.js', `TWO_STAGE lists "${key}", which is not on the roster`);
    continue;
  }
  if (game.stages !== 2) {
    fail('server/games.js', `two-stage game "${key}" must declare stages: 2 on the roster`);
  }
  if (!NEEDS_AGGREGATION.has(key)) {
    fail('server/games.js', `two-stage game "${key}" must also be in NEEDS_AGGREGATION`);
  }
  const block = clientSrc.slice(clientSrc.indexOf(`GameClients.${key} =`));
  if (!/startStage\s*\(/.test(block.slice(0, 800))) {
    fail('public/js/games.js', `two-stage game "${key}" needs a stage-aware startStage()`);
  }
}
for (const game of ROSTER) {
  if (game.stages === 2 && !TWO_STAGE.has(game.key)) {
    fail('server/games.js', `roster game "${game.key}" declares stages: 2 but is not in TWO_STAGE`);
  }
}

// ---- 5. seeded content stays seeded -----------------------------------------
// Round content must be identical for every player. Math.random() in the
// server's content generation or in shared pure logic silently desyncs a room,
// and no unit test catches it because each player passes on their own.
for (const file of files.filter((f) => f.startsWith('server/') || f.startsWith('shared/'))) {
  const src = read(file);
  src.split('\n').forEach((line, i) => {
    if (!line.includes('Math.random()')) return;
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;  // prose about the rule
    // room.js uses it as a default argument for the room-code generator, which
    // is not round content.
    if (/rng = Math\.random/.test(line)) return;
    fail(file, `line ${i + 1}: Math.random() — round content must come from the seeded rng`);
  });
}

// ---- report ------------------------------------------------------------------
if (problems.length) {
  console.error(`✗ ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`✓ checked ${files.length} files, ${ROSTER.length} roster games, ${TWO_STAGE.size} two-stage`);
