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
import { ROSTER, MULTI_STAGE, NEEDS_AGGREGATION } from '../server/games.js';
import { HOST_EDITABLE_CONFIG } from '../server/room.js';

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

// ---- 4. multi-stage games are wired end to end ------------------------------
// A multi-stage game that scores per-player on submit would score stage one's
// raw payload; one whose client has no stage-aware entry point would render
// its writing stage twice and never collect a vote or a guess.
const MULTI_STAGE_DECL = (s) => s === 'variable' || (typeof s === 'number' && s >= 2);
for (const key of MULTI_STAGE) {
  const game = ROSTER.find((g) => g.key === key);
  if (!game) {
    fail('server/games.js', `MULTI_STAGE lists "${key}", which is not on the roster`);
    continue;
  }
  if (!MULTI_STAGE_DECL(game.stages)) {
    fail('server/games.js',
      `multi-stage game "${key}" must declare stages: <number ≥ 2> or 'variable' on the roster`);
  }
  if (!NEEDS_AGGREGATION.has(key)) {
    fail('server/games.js', `multi-stage game "${key}" must also be in NEEDS_AGGREGATION`);
  }
  const block = clientSrc.slice(clientSrc.indexOf(`GameClients.${key} =`));
  if (!/startStage\s*\(/.test(block.slice(0, 800))) {
    fail('public/js/games.js', `multi-stage game "${key}" needs a stage-aware startStage()`);
  }
}
for (const game of ROSTER) {
  if (MULTI_STAGE_DECL(game.stages) && !MULTI_STAGE.has(game.key)) {
    fail('server/games.js',
      `roster game "${game.key}" declares stages: ${JSON.stringify(game.stages)} but is not in MULTI_STAGE`);
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

// ---- 6. the host config panel stays one knob --------------------------------
// The lobby's host config is minigame duration, the per-game toggles, and
// nothing else. Sliders keep growing back: "Games this session" and "Practice
// round first" have each been removed once and returned with a later feature,
// because a control that renders and pushes a value looks correct from every
// angle — no test failed, so nothing said otherwise. This rule says otherwise.
//
// Adding a host option on purpose means changing three things together: the
// control in public/host.html, its id in the map below, and
// HOST_EDITABLE_CONFIG in server/room.js. Everything else in the room config
// is an internal default and stays off the host screen.
const ALLOWED_HOST_CONTROLS = new Map([
  ['cfg-dur', 'gameDuration'],  // range: minigame duration, in seconds
  ['cfg-dur-val', null],        // its live read-out — display, not a control
]);
const controlList = [...ALLOWED_HOST_CONTROLS.keys()].join(', ');

const hostHtml = read('public/host.html');
if (!hostHtml.includes('class="config-grid"')) {
  fail('public/host.html', 'no .config-grid — the host config panel moved; move this rule with it');
}
for (const [, id] of hostHtml.matchAll(/id="(cfg-[^"]*)"/g)) {
  if (!ALLOWED_HOST_CONTROLS.has(id)) {
    fail('public/host.html',
      `host config control "#${id}" is not an allowed host option — the lobby is ${controlList} and nothing else`);
  }
}
for (const id of ALLOWED_HOST_CONTROLS.keys()) {
  if (!hostHtml.includes(`id="${id}"`)) {
    fail('public/host.html',
      `allowed host control "#${id}" is missing — if removing it was deliberate, drop it from the allowlist in scripts/check.mjs`);
  }
}

const hostJs = read('public/js/host.js');
for (const [, id] of hostJs.matchAll(/\$\('(cfg-[^']*)'\)/g)) {
  if (!ALLOWED_HOST_CONTROLS.has(id)) {
    fail('public/js/host.js', `wires up host config control "#${id}", which is not an allowed host option`);
  }
}
// Every pushConfig() call site sends a patch of exactly one key; that key has
// to be one the server will still accept from the lobby.
for (const [, key] of hostJs.matchAll(/pushConfig\(\s*\{\s*([A-Za-z0-9_]+)\s*:/g)) {
  if (!HOST_EDITABLE_CONFIG.has(key)) {
    fail('public/js/host.js',
      `pushes config key "${key}", which server/room.js does not accept from the lobby (HOST_EDITABLE_CONFIG)`);
  }
}

// The two ends of the allowlist have to agree: a key the server accepts that
// no control writes is a knob waiting to be re-exposed, and a control writing
// a key the server drops is a slider that silently does nothing.
const controlKeys = new Set([...ALLOWED_HOST_CONTROLS.values()].filter(Boolean));
controlKeys.add('enabled');  // the per-game toggles, built at runtime from the roster
for (const key of HOST_EDITABLE_CONFIG) {
  if (!controlKeys.has(key)) {
    fail('server/room.js', `HOST_EDITABLE_CONFIG accepts "${key}", which no allowed host control writes`);
  }
}
for (const key of controlKeys) {
  if (!HOST_EDITABLE_CONFIG.has(key)) {
    fail('server/room.js', `host controls write "${key}", which HOST_EDITABLE_CONFIG does not accept`);
  }
}

// ---- report ------------------------------------------------------------------
if (problems.length) {
  console.error(`✗ ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`✓ checked ${files.length} files, ${ROSTER.length} roster games, ${MULTI_STAGE.size} multi-stage`);
