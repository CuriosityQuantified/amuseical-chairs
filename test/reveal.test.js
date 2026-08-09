// Server-authoritative per-turn feedback (issue #48): Room.revealTurn.
//
// Proves the security contract: a player can ask the server only for their own
// current-game turn answer; two players can independently request different
// turns; hostile identity/index/payload inputs never crash and never expose
// another player's submission; and the initial broadcast clientData never
// carries the hidden answer stream.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/room.js';
import { ROSTER, buildGameData } from '../server/games.js';
import { seededRng } from '../shared/rng.js';

const stubIo = () => ({ to: () => ({ emit: () => {} }) });

function addPlayer(room, id, name) {
  room.players.set(id, {
    id, name, socketId: `sock-${id}`, connected: true,
    disconnectedAt: null, sync: null, joinedAt: Date.now(),
  });
}

// Put the room into an anagram minigame with real server-built data, the same
// way startGame would, without driving the tutorial timers.
function anagramRoom() {
  const room = new Room(stubIo(), 'TEST', {});
  addPlayer(room, 'p1', 'Ana');
  addPlayer(room, 'p2', 'Bo');
  const meta = ROSTER.find((g) => g.key === 'anagram');
  const { clientData, secret } = buildGameData('anagram', {
    rng: seededRng('anagram-reveal-test'),
    config: room.config,
    used: {},
  });
  room.phase = 'minigame';
  room.round = { games: [room.makeStage(meta, clientData, secret)], gameIndex: 0, extras: {} };
  return { room, clientData, secret };
}

test('reveal: initial clientData never carries the hidden answer stream', () => {
  const { clientData, secret } = anagramRoom();
  assert.ok(Array.isArray(clientData.scrambles), 'clientData exposes only scrambles');
  assert.equal(clientData.answers, undefined, 'no answers in clientData');
  assert.ok(Array.isArray(secret.answers) && secret.answers.length > 0, 'answers live server-side');
  assert.equal(clientData.scrambles.length, secret.answers.length);
});

test('reveal: each player gets only their own requested turn answer', () => {
  const { room, secret } = anagramRoom();
  const a = room.revealTurn('p1', 0);
  const b = room.revealTurn('p2', 2);
  assert.deepEqual(a, { index: 0, answer: secret.answers[0] });
  assert.deepEqual(b, { index: 2, answer: secret.answers[2] });
  // The payload carries only the authoritative correct answer — never any
  // player's submission — so it cannot leak one player's answer to another.
  assert.deepEqual(Object.keys(a).sort(), ['answer', 'index']);
});

test('reveal: two players sit on different turns simultaneously', () => {
  const { room, secret } = anagramRoom();
  // p1 on turn 1, p2 still on turn 0 — independent, order-independent.
  assert.equal(room.revealTurn('p2', 0).answer, secret.answers[0]);
  assert.equal(room.revealTurn('p1', 1).answer, secret.answers[1]);
  assert.equal(room.revealTurn('p2', 0).answer, secret.answers[0]);
});

test('reveal: hostile turn indices are rejected, never throw', () => {
  const { room } = anagramRoom();
  for (const bad of [-1, 9999, 1.5, NaN, 'x', null, undefined, {}, [], Infinity]) {
    assert.doesNotThrow(() => room.revealTurn('p1', bad));
    assert.ok(room.revealTurn('p1', bad).error, `index ${String(bad)} rejected`);
  }
});

test('reveal: unknown player is rejected', () => {
  const { room } = anagramRoom();
  assert.ok(room.revealTurn('ghost', 0).error);
});

test('reveal: non-secret game exposes no per-turn reveal', () => {
  const { room } = anagramRoom();
  room.round.games[0].key = 'bisect';
  assert.match(room.revealTurn('p1', 0).error, /No per-turn reveal/);
});

test('reveal: outside a minigame there is no turn to reveal', () => {
  const { room } = anagramRoom();
  room.phase = 'lobby';
  assert.match(room.revealTurn('p1', 0).error, /No active turn/);
});

test('reveal: missing/empty answer stream is handled, not crashed', () => {
  const { room } = anagramRoom();
  room.round.games[0].secret = {};
  assert.ok(room.revealTurn('p1', 0).error);
});
