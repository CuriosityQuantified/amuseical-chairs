// Server-authoritative per-turn feedback (issue #48): the commit-gated,
// forward-only Anagram reveal protocol.
//
// Contract proven here:
//  - the hidden answer stream is never in the broadcast clientData;
//  - a player can only reveal a turn they have reached (no jumping ahead to
//    enumerate the whole stream), and only after locking their own answer;
//  - the locked answers — not a re-submittable final payload — are what score,
//    so learning an answer via the reveal cannot inflate a score;
//  - two players keep independent cursors and never see each other's data;
//  - hostile identity/index/payload inputs are rejected without crashing.
//
// Both the Room method and the real Socket.IO `player:reveal` handler (wired by
// attachSockets) are exercised.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/room.js';
import { attachSockets } from '../server/sockets.js';
import { ROSTER, buildGameData, computeMetric } from '../server/games.js';
import { seededRng } from '../shared/rng.js';

const stubIo = () => ({ to: () => ({ emit: () => {} }) });

function addPlayer(room, id, name) {
  room.players.set(id, {
    id, name, socketId: `sock-${id}`, connected: true,
    disconnectedAt: null, sync: null, joinedAt: Date.now(),
  });
}

// Put a room into an anagram minigame with real server-built data, the same way
// startGame would, without driving the tutorial timers.
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

test('reveal: forward-only — a player walks turns in order, cannot jump ahead', () => {
  const { room, secret } = anagramRoom();
  // Reached turn is 0; asking for a future turn is refused (no enumeration).
  assert.match(room.revealTurn('p1', 3, '').error, /not reached/i);
  assert.match(room.revealTurn('p1', 1, '').error, /not reached/i);
  // Walking in order returns each answer.
  assert.equal(room.revealTurn('p1', 0, 'x').answer, secret.answers[0]);
  assert.equal(room.revealTurn('p1', 1, 'y').answer, secret.answers[1]);
  assert.equal(room.revealTurn('p1', 2, 'z').answer, secret.answers[2]);
  // Still cannot leap past the new frontier.
  assert.match(room.revealTurn('p1', 5, '').error, /not reached/i);
});

test('reveal: re-requesting a reached turn is idempotent and never relocks', () => {
  const { room, secret } = anagramRoom();
  assert.equal(room.revealTurn('p1', 0, 'wrong').answer, secret.answers[0]);
  // A reconnect that replays turn 0 gets the same answer, and the originally
  // locked (wrong) answer is NOT overwritten by a now-correct guess.
  assert.equal(room.revealTurn('p1', 0, secret.answers[0]).answer, secret.answers[0]);
  const locked = room.lockedSolved(room.round.games[0], 'p1');
  assert.deepEqual(locked, [{ index: 0, word: 'wrong' }]);
});

test('reveal: two players keep independent cursors and private answers', () => {
  const { room, secret } = anagramRoom();
  // p1 advances to turn 1; p2 is still on turn 0. Order-independent.
  assert.equal(room.revealTurn('p1', 0, 'a').answer, secret.answers[0]);
  assert.equal(room.revealTurn('p1', 1, 'b').answer, secret.answers[1]);
  // p2 cannot use p1's progress to jump ahead.
  assert.match(room.revealTurn('p2', 1, '').error, /not reached/i);
  assert.equal(room.revealTurn('p2', 0, 'c').answer, secret.answers[0]);
  // The payload carries only the authoritative correct answer, never a player's
  // submission — so it cannot leak one player's answer to another.
  assert.deepEqual(Object.keys(room.revealTurn('p2', 0, 'c')).sort(), ['answer', 'index']);
});

test('reveal: hostile turn indices are rejected, never throw', () => {
  const { room } = anagramRoom();
  for (const bad of [-1, 9999, 1.5, NaN, 'x', null, undefined, {}, [], Infinity]) {
    assert.doesNotThrow(() => room.revealTurn('p1', bad, ''));
    assert.ok(room.revealTurn('p1', bad, '').error, `index ${String(bad)} rejected`);
  }
});

test('reveal: unknown player, non-secret game, wrong phase, empty stream all rejected', () => {
  const { room } = anagramRoom();
  assert.ok(room.revealTurn('ghost', 0, '').error);
  const saved = room.round.games[0].key;
  room.round.games[0].key = 'bisect';
  assert.match(room.revealTurn('p1', 0, '').error, /No per-turn reveal/);
  room.round.games[0].key = saved;
  room.phase = 'lobby';
  assert.match(room.revealTurn('p1', 0, '').error, /No active turn/);
  room.phase = 'minigame';
  room.round.games[0].secret = {};
  assert.ok(room.revealTurn('p1', 0, '').error);
});

test('score: locked answers are authoritative — peeking cannot inflate a score', () => {
  const { room, secret } = anagramRoom();
  const g = room.round.games[0];

  // p1 cheats: locks blanks to peek at each answer, then submits a final
  // payload claiming every turn correct. Scored on the LOCKED blanks → 0.
  room.revealTurn('p1', 0, '');
  room.revealTurn('p1', 1, '');
  room.handleSubmit('p1', { solved: [{ index: 0, word: secret.answers[0] }, { index: 1, word: secret.answers[1] }] });
  assert.equal(g.metrics.get('p1'), 0, 'inflated claim ignored; locked blanks scored');

  // p2 plays honestly: locks the correct words, then submits. Scored 2.
  room.revealTurn('p2', 0, secret.answers[0]);
  room.revealTurn('p2', 1, secret.answers[1]);
  room.handleSubmit('p2', { solved: [{ index: 0, word: secret.answers[0] }, { index: 1, word: secret.answers[1] }] });
  assert.equal(g.metrics.get('p2'), 2, 'locked correct answers scored');
});

test('score: a player who never reveals is scored from the payload (harness parity)', () => {
  const { room, secret } = anagramRoom();
  const g = room.round.games[0];
  const payload = { solved: [{ index: 0, word: secret.answers[0] }] };
  room.handleSubmit('p1', payload);
  // No reveals recorded → identical to the pre-feedback scoring path.
  assert.equal(g.metrics.get('p1'), computeMetric('anagram', payload, g.secret, g.clientData, room.config));
  assert.equal(g.metrics.get('p1'), 1);
});

// --- real socket-level integration (not only direct Room calls) -------------

function fakeSocket(id) {
  const handlers = new Map();
  return {
    id, data: {}, rooms: new Set(),
    on: (ev, fn) => handlers.set(ev, fn),
    join() {}, emit() {},
    fire: (ev, ...args) => handlers.get(ev) && handlers.get(ev)(...args),
  };
}

function fakeIo() {
  let connFn = null;
  return {
    on: (ev, fn) => { if (ev === 'connection') connFn = fn; },
    to: () => ({ emit: () => {} }),
    connect: (socket) => connFn && connFn(socket),
  };
}

test('socket: player:reveal routes each ack to its own requester, forward-only', () => {
  const io = fakeIo();
  const rooms = attachSockets(io);
  const { room, secret } = anagramRoom();
  rooms.set('TEST', room);

  const s1 = fakeSocket('s1'); io.connect(s1); s1.data.roomCode = 'TEST'; s1.data.playerId = 'p1';
  const s2 = fakeSocket('s2'); io.connect(s2); s2.data.roomCode = 'TEST'; s2.data.playerId = 'p2';

  const acks = {};
  s1.fire('player:reveal', { index: 0, word: 'ans' }, (r) => { acks.a = r; });
  s2.fire('player:reveal', { index: 1, word: '' }, (r) => { acks.b = r; });

  assert.deepEqual(acks.a, { index: 0, answer: secret.answers[0] }, 'p1 gets its own turn 0 answer');
  assert.match(acks.b.error, /not reached/i, 'p2 cannot jump to turn 1 from turn 0');

  // A socket with no player identity is refused.
  const anon = fakeSocket('anon'); io.connect(anon); anon.data.roomCode = 'TEST';
  let anonAck;
  anon.fire('player:reveal', { index: 0 }, (r) => { anonAck = r; });
  assert.ok(anonAck.error);

  // Malformed payload (no object) does not throw and still acks an error/first turn.
  let badAck;
  s1.fire('player:reveal', undefined, (r) => { badAck = r; });
  assert.ok(badAck && (badAck.error || badAck.index === 0));
});
