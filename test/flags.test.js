import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { seededRng } from '../shared/rng.js';
import { flagRounds } from '../shared/flags.js';
import { buildGameData, COMPLETION_MODE, computeMetric, formatRaw, ROSTER_BY_KEY } from '../server/games.js';
import { Room } from '../server/room.js';
import { EXPECTED_FLAGS, FLAGS_SOURCE, isPng, parseFlagTable } from '../scripts/scrape-flags.mjs';
import manifest from '../data/flags-manifest.json' with { type: 'json' };

const ROOT = new URL('..', import.meta.url).pathname;
const stubIo = () => ({ to: () => ({ emit: () => {} }) });

function addPlayer(room, id) {
  room.players.set(id, {
    id, name: id, socketId: `sock-${id}`, connected: true,
    reconnectToken: `reconnect-${id}`, disconnectedAt: null, sync: null, joinedAt: Date.now(),
  });
}

test('offline source snapshot, manifest, and 197 committed PNG assets agree exactly', async () => {
  const html = await readFile(join(ROOT, 'data/flags-source-snapshot.html'), 'utf8');
  const parsed = parseFlagTable(html);
  assert.equal(manifest.source, FLAGS_SOURCE);
  assert.equal(manifest.count, EXPECTED_FLAGS);
  assert.deepEqual(manifest.flags, parsed);
  assert.equal(new Set(parsed.map((flag) => flag.name)).size, EXPECTED_FLAGS);
  assert.equal(new Set(parsed.map((flag) => flag.asset)).size, EXPECTED_FLAGS);
  const files = await readdir(join(ROOT, 'public/assets/flags'));
  assert.equal(files.length, EXPECTED_FLAGS);
  assert.deepEqual(new Set(files), new Set(parsed.map((flag) => flag.asset.split('/').at(-1))));
  assert.throws(() => parseFlagTable('<img src="https://evil.example/flags-normal/x.png"></td><td>Bad</td>'), /Unsafe flag source URL/);
  for (const flag of parsed) {
    assert.match(flag.asset, /^\/assets\/flags\/[a-f0-9]{20}\.png$/);
    assert.equal(flag.asset.toLowerCase().includes(flag.name.toLowerCase()), false, 'asset path must not disclose the answer');
    assert.ok(isPng(await readFile(join(ROOT, 'public', flag.asset))), `${flag.name} must have a decodable PNG`);
  }
});

test('flag rounds are deterministic and satisfy all target and option rules', () => {
  const a = flagRounds(manifest.flags, seededRng('flags-test'));
  const b = flagRounds(manifest.flags, seededRng('flags-test'));
  const c = flagRounds(manifest.flags, seededRng('flags-other'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 10);
  assert.equal(new Set(a.map((round) => round.target)).size, 10);
  const priorTargets = new Set();
  for (const round of a) {
    assert.equal(round.options.length, 8);
    assert.equal(new Set(round.options).size, 8);
    assert.equal(round.options.filter((name) => name === round.target).length, 1);
    for (const prior of priorTargets) assert.equal(round.options.includes(prior), false, 'a prior target cannot be a later distractor');
    priorTargets.add(round.target);
  }
});

test('server keeps answers secret and scores valid, missing, malformed, stale, and extra choices', () => {
  const data = buildGameData('flags', { rng: seededRng('flags-score'), config: {}, used: {} });
  assert.equal(data.clientData.rounds.length, 10);
  assert.equal(Object.hasOwn(data.clientData.rounds[0], 'target'), false);
  assert.equal(Object.hasOwn(data.clientData, 'seed'), false);
  assert.equal(JSON.stringify(data.clientData).includes(data.secret.answers[0]), true, 'the correct name can appear only among the eight choices');
  const perfect = data.secret.rounds.map((round) => round.options.indexOf(round.target));
  const partial = perfect.map((choice, index) => index < 6 ? choice : (choice + 1) % 8);
  assert.equal(computeMetric('flags', { choices: perfect }, data.secret, data.clientData, {}), 10);
  assert.equal(computeMetric('flags', { choices: partial }, data.secret, data.clientData, {}), 6);
  assert.equal(computeMetric('flags', { choices: perfect.map((choice) => (choice + 1) % 8) }, data.secret, data.clientData, {}), 0);
  assert.equal(computeMetric('flags', undefined, data.secret, data.clientData, {}), null);
  assert.equal(computeMetric('flags', { choices: perfect.slice(0, 9) }, data.secret, data.clientData, {}), null);
  assert.equal(computeMetric('flags', { choices: [...perfect, 0] }, data.secret, data.clientData, {}), null);
  assert.equal(computeMetric('flags', { choices: ['0', null, {}, [], 8, -1, ...perfect.slice(6)] }, data.secret, data.clientData, {}), 4);
  assert.equal(formatRaw('flags', 7, { choices: perfect }), '7/10 flags');
  assert.equal(formatRaw('flags', null), 'no submission');
});

test('room locks each revealed flag answer, ignores duplicate/stale submits, and keeps host override', () => {
  const room = new Room(stubIo(), 'FLG1', { tutorialMs: 0, completionSafetyMs: 60_000 });
  try {
    addPlayer(room, 'p1');
    addPlayer(room, 'p2');
    assert.equal(room.startTest('flags').ok, true);
    assert.equal(room.phase, 'minigame');
    const game = room.round.games[0];
    const phase = room.gamePayload(game);
    assert.equal(COMPLETION_MODE.has('flags'), true);
    assert.equal(ROSTER_BY_KEY.get('flags').completion, 'all-rounds');
    assert.equal(phase.completion, true);
    assert.equal(phase.duration, null);
    assert.equal(phase.deadline, null);

    const perfect = game.secret.rounds.map((round) => round.options.indexOf(round.target));
    const firstWrong = (perfect[0] + 1) % 8;
    assert.deepEqual(room.revealTurn('p1', 1, 'future'), { error: 'Turn not reached.' });
    assert.equal(room.revealTurn('p1', 0, game.secret.rounds[0].options[firstWrong]).answer, game.secret.answers[0]);
    assert.equal(room.revealTurn('p1', 0, game.secret.answers[0]).answer, game.secret.answers[0]);
    for (let index = 1; index < 10; index++) {
      assert.equal(room.revealTurn('p1', index, game.secret.answers[index]).answer, game.secret.answers[index]);
    }
    assert.deepEqual(room.revealTurn('p1', 10, ''), { error: 'Bad turn index.' });

    room.handleSubmit('p1', { choices: perfect });
    assert.equal(game.metrics.get('p1'), 9, 'the first locked answer wins over a forged final payload');
    assert.equal(game.submissions.size, 1);
    room.handleSubmit('p1', { choices: perfect });
    assert.equal(game.submissions.size, 1, 'duplicate submission is ignored');
    assert.equal(room.phase, 'minigame', 'the non-submitter keeps the completion game open');
    assert.equal(room.hostNext().ok, true, 'host can close a stalled completion game');
    assert.notEqual(room.phase, 'minigame');
    room.handleSubmit('p2', { choices: perfect });
    assert.equal(game.submissions.size, 1, 'stale submission after close is ignored');
  } finally {
    room.destroy();
  }
});
