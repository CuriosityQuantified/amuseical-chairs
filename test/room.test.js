// Room-level integration for the score-attack format: every enabled game is
// played exactly once by everyone, scores are normalized 0–1000 per game and
// accumulate. The finale is the musical-chairs BONUS tournament: (players−1)
// reaction rounds, slowest out each round, 3× points by final placement
// (1st = 3000 … last = 0). Highest cumulative total wins the session.

import test from 'node:test';
import assert from 'node:assert/strict';
import { Room, EXTEND_MS } from '../server/room.js';
import { ROSTER } from '../server/games.js';

const stubIo = () => ({ to: () => ({ emit: () => {} }) });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, ms = 5000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return;
    await sleep(20);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function addPlayer(room, id, name) {
  room.players.set(id, {
    id, name, socketId: `sock-${id}`, connected: true,
    reconnectToken: `test-reconnect-${id}`,
    disconnectedAt: null, sync: null, joinedAt: Date.now(),
  });
}

// Enable only the given keys.
function onlyGames(...keys) {
  const enabled = {};
  for (const g of ROSTER) enabled[g.key] = keys.includes(g.key);
  return enabled;
}

const FAST = {
  gameDuration: 800, musicMs: 60, tutorialMs: 0,
  redemptionPrepMs: 60, redemptionLeadMs: 120,
  postGreenTimeout: 800, hardTimeout: 1500, closeGraceMs: 200,
};

test('score attack: every game once, totals accumulate, chairs finale, highest total wins', async () => {
  const room = new Room(stubIo(), 'TEST', {
    ...FAST,
    enabled: onlyGames('spacemash', 'stopclock'),
  }, undefined, { allowClientScoredCompetitive: true });
  try {
    const ids = ['p1', 'p2', 'p3'];
    ids.forEach((id, i) => addPlayer(room, id, `Player${i + 1}`));
    assert.equal(room.start().ok, true);
    assert.equal(room.queue.length, 2, 'both enabled games queued once each');

    const playedKeys = [];
    const submitFor = (key, id, quality) => {
      // quality: 0 = best, larger = worse
      if (key === 'spacemash') room.handleSubmit(id, { count: 100 - quality * 20, flagged: false });
      else room.handleSubmit(id, { best: 100 + quality * 150 });
    };

    // ---- game 1: p3 never submits ----
    await waitFor(() => room.phase === 'minigame', 3000, 'first minigame');
    playedKeys.push(room.round.games[0].key);
    submitFor(playedKeys[0], 'p1', 0);
    submitFor(playedKeys[0], 'p2', 1);
    await waitFor(() => room.phase === 'scores', 3000, 'first scores');

    const board1 = room.lastScores;
    const row = (board, id) => board.find((r) => r.id === id);
    assert.equal(row(board1, 'p1').points, 1000, 'best submitter gets 1000');
    assert.equal(row(board1, 'p3').points, 0, 'non-submitter scores 0');
    assert.ok(room.players.has('p3'), 'non-submitter is never removed');
    assert.equal(row(board1, 'p1').rank, 1);

    // ---- game 2: everyone submits, p3 is best ----
    room.hostNext();
    await waitFor(() => room.phase === 'minigame', 3000, 'second minigame');
    playedKeys.push(room.round.games[0].key);
    submitFor(playedKeys[1], 'p1', 2);
    submitFor(playedKeys[1], 'p2', 1);
    submitFor(playedKeys[1], 'p3', 0);
    await waitFor(() => room.phase === 'scores', 3000, 'second scores');

    assert.deepEqual([...playedKeys].sort(), ['spacemash', 'stopclock'],
      'each enabled game played exactly once');
    const board2 = room.lastScores;
    assert.equal(row(board2, 'p3').points, 1000, 'p3 wins game 2');
    for (const id of ids) {
      assert.equal(row(board2, id).total,
        row(board1, id).total + row(board2, id).points,
        `${id} total accumulates across games`);
    }

    // ---- musical chairs finale: 3 players → 2 elimination rounds ----
    const totalsBefore = new Map([...room.totals].map(([id, t]) => [id, Math.round(t)]));
    room.hostNext();
    await waitFor(() => room.phase === 'redemption', 3000, 'chairs round 1');
    assert.equal(room.redemption.participants.length, 3, 'everyone starts the finale');
    assert.equal(room.redemption.mode, 'chairs');
    assert.equal(room.chairs.totalRounds, 2, 'rounds = players − 1');
    assert.equal(room.chairs.round, 1);

    // Round 1: p3 is slowest → eliminated, 2 chairs at stake.
    await waitFor(() => room.redemption && room.redemption.tGreen, 3000, 'go 1');
    room.handleRedemptionReport('p1', { status: 'ok', rawMs: 200, earlyPresses: 0 });
    room.handleRedemptionReport('p2', { status: 'ok', rawMs: 300, earlyPresses: 0 });
    room.handleRedemptionReport('p3', { status: 'ok', rawMs: 400, earlyPresses: 0 });
    await waitFor(() => room.phase === 'chairs_result', 3000, 'round 1 result');
    assert.deepEqual(room.chairs.eliminated, ['p3'], 'slowest player is out first');
    assert.deepEqual([...room.chairs.active].sort(), ['p1', 'p2'], 'survivors keep chairs');

    // Round 2 (final): p2 slowest → p1 takes the last chair.
    room.hostNext();
    await waitFor(() => room.phase === 'redemption' && room.chairs.round === 2, 3000, 'chairs round 2');
    assert.equal(room.redemption.participants.length, 2, 'eliminated players sit out');
    await waitFor(() => room.redemption && room.redemption.tGreen, 3000, 'go 2');
    room.handleRedemptionReport('p1', { status: 'ok', rawMs: 210, earlyPresses: 0 });
    room.handleRedemptionReport('p2', { status: 'ok', rawMs: 320, earlyPresses: 0 });
    await waitFor(() => room.phase === 'chairs_result', 3000, 'final round result');

    // Bonus scoring: 3× by placement — 1st 3000, 2nd 1500, 3rd 0.
    room.hostNext();
    await waitFor(() => room.phase === 'winner', 3000, 'winner');
    const standings = room.finalStandings;
    assert.equal(standings.length, 3, 'all players in final standings');
    for (let i = 1; i < standings.length; i++) {
      assert.ok(standings[i - 1].total >= standings[i].total, 'standings sorted by total');
    }
    assert.equal(room.winnerId, standings[0].id);
    const totalOf = (id) => standings.find((s) => s.id === id).total;
    assert.equal(totalOf('p1'), totalsBefore.get('p1') + 3000, 'tournament winner banks 3000 (3×)');
    assert.equal(totalOf('p2'), totalsBefore.get('p2') + 1500, '2nd of 3 banks 1500');
    assert.equal(totalOf('p3'), totalsBefore.get('p3') + 0, 'first out banks 0');
  } finally {
    room.destroy();
  }
});

test('repeating join on the same socket returns the existing player instead of minting a second identity', () => {
  const room = new Room(stubIo(), 'ONES', {});
  try {
    const socket = { id: 'sock-one', join() {}, data: {} };
    const first = room.join(socket, { name: 'Alpha' });
    const second = room.join(socket, { name: 'Bravo' });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.playerId, first.playerId);
    assert.equal(room.players.size, 1);
    assert.equal(room.players.get(first.playerId).name, 'Alpha');
  } finally {
    room.destroy();
  }
});

test('a socket already bound to one player cannot reconnect as a different player', () => {
  const room = new Room(stubIo(), 'SWAP', {});
  try {
    addPlayer(room, 'p1', 'Alpha');
    addPlayer(room, 'p2', 'Bravo');
    room.players.get('p1').socketId = 'sock-shared';
    room.players.get('p2').socketId = 'sock-other';

    const socket = { id: 'sock-shared', join() {}, data: { playerId: 'p1' } };
    const attempt = room.join(socket, { playerId: 'p2', reconnectToken: 'test-reconnect-p2' });

    assert.equal(attempt.error, 'This connection is already bound to another player.');
    assert.equal(room.players.get('p1').socketId, 'sock-shared');
    assert.equal(room.players.get('p2').socketId, 'sock-other');
  } finally {
    room.destroy();
  }
});

test('disconnect clears every player record still attached to the socket', () => {
  const room = new Room(stubIo(), 'GHST', {});
  try {
    addPlayer(room, 'p1', 'Ghost A');
    addPlayer(room, 'p2', 'Ghost B');
    room.players.get('p1').socketId = 'sock-ghost';
    room.players.get('p2').socketId = 'sock-ghost';

    room.handleDisconnect({ id: 'sock-ghost', data: { playerId: 'p2' } });

    assert.equal(room.players.get('p1').connected, false);
    assert.equal(room.players.get('p2').connected, false);
    assert.equal(room.players.get('p1').socketId, null);
    assert.equal(room.players.get('p2').socketId, null);
    assert.ok(room.players.get('p1').disconnectedAt);
    assert.ok(room.players.get('p2').disconnectedAt);
  } finally {
    room.destroy();
  }
});

// gamesPerSession is an internal default, not a host option: every hosted
// session plays all of its enabled games (0), and the K-of-N draw stays here
// as the pacing lever a room can be constructed with.
test('gamesPerSession draws K of N — a two-stage game must not outgrow the meeting slot', () => {
  const enabled = {};
  for (const g of ROSTER) enabled[g.key] = true;

  const all = new Room(stubIo(), 'FULL', { ...FAST, enabled }, undefined, { allowClientScoredCompetitive: true });
  const four = new Room(stubIo(), 'FULL', { ...FAST, enabled, gamesPerSession: 4 }, undefined, { allowClientScoredCompetitive: true });
  const over = new Room(stubIo(), 'FULL', { ...FAST, enabled, gamesPerSession: 99 }, undefined, { allowClientScoredCompetitive: true });
  try {
    for (const room of [all, four, over]) {
      addPlayer(room, 'p1', 'Anna');
      addPlayer(room, 'p2', 'Ben');
      room.clearTimer('music');
    }
    all.start();
    four.start();
    over.start();

    assert.equal(all.queue.length, ROSTER.length, '0 means every enabled game');
    assert.equal(four.queue.length, 4, 'K of N');
    assert.equal(over.queue.length, ROSTER.length, 'K is clamped to what is enabled');
    assert.equal(new Set(four.queue).size, 4, 'still no repeats');
    // Same room code → same seeded shuffle, so K of N is a prefix of the full
    // draw: which games you get is as random as the order they come in.
    assert.deepEqual(four.queue, all.queue.slice(0, 4));
    // The progress ladder counts the drawn games plus the chairs finale.
    assert.equal(four.progressInfo().totalGames, 5);
  } finally {
    for (const room of [all, four, over]) room.destroy();
  }
});

// The host lobby is one knob — minigame duration — plus the per-game toggles.
// "Games this session" and "Practice round first" were both host controls once
// and both grew back with a later feature. scripts/check.mjs catches the lobby
// half of that; this is the server half, and it is the stronger one: a control
// cannot come back if the server neither publishes the value nor accepts it.
test('the host config surface is minigame duration and the game toggles, nothing else', () => {
  const room = new Room(stubIo(), 'CFGX', {});
  try {
    assert.deepEqual(
      Object.keys(room.publicConfig()).sort(),
      ['enabled', 'gameDuration', 'maxDelay', 'minDelay', 'roster'],
      'publicConfig publishes no value the lobby is not allowed to change');

    const internals = { ...room.config };
    assert.equal(room.updateConfig({
      gameDuration: 30000,
      enabled: { stopclock: false },
      gamesPerSession: 4,
      tutorialMs: 0,
    }).ok, true, 'a patch carrying dropped keys still applies the ones that are allowed');

    assert.equal(room.config.gameDuration, 30000, 'the one host knob applies');
    assert.equal(room.config.enabled.stopclock, false, 'per-game toggles apply');
    assert.equal(room.config.gamesPerSession, internals.gamesPerSession,
      'gamesPerSession is internal — the lobby cannot reach it');
    assert.equal(room.config.tutorialMs, internals.tutorialMs,
      'and neither can it reach any other pacing default');
  } finally {
    room.destroy();
  }
});

// There is no practice round and no way to ask for one — not a host checkbox,
// not a config key, not a phase. A session opens on game one, for points.
test('no practice round: start() opens on a scored game, whatever the config says', async () => {
  const room = new Room(stubIo(), 'NOPR', {
    ...FAST, practice: true, enabled: onlyGames('stopclock'),
  }, undefined, { allowClientScoredCompetitive: true });
  const phases = [];
  const setPhase = room.setPhase.bind(room);
  room.setPhase = (name, data) => { phases.push(name); return setPhase(name, data); };
  try {
    assert.equal('practice' in room.config, false, 'asking for one does not even make it into the config');
    addPlayer(room, 'a', 'Anna');
    addPlayer(room, 'b', 'Ben');
    room.start();

    await waitFor(() => room.phase === 'minigame', 3000, 'first minigame');
    assert.equal(room.round.practice, undefined, 'the first round is a real one');
    assert.equal(room.round.games[0].key, 'stopclock');
    assert.equal(room.gamePayload(room.round.games[0]).gameNumber, 1,
      'and it is game 1 of the session, not a warm-up before it');

    room.handleSubmit('a', { best: 100 });
    room.handleSubmit('b', { best: 400 });
    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    assert.equal(room.lastScores.find((r) => r.id === 'a').points, 1000,
      'the first thing the room played counted');
    assert.equal(phases.includes('practice_done'), false, 'no practice_done phase, ever');
  } finally {
    room.destroy();
  }
});

test('2-player finale: one round, placement bonus (3000 / 0) can flip the lead', async () => {
  const room = new Room(stubIo(), 'TESB', {
    ...FAST,
    enabled: onlyGames('stopclock'),
  }, undefined, { allowClientScoredCompetitive: true });
  try {
    addPlayer(room, 'a', 'Anna');
    addPlayer(room, 'b', 'Ben');
    room.start();
    await waitFor(() => room.phase === 'minigame', 3000, 'minigame');
    room.handleSubmit('a', { best: 100 });
    room.handleSubmit('b', { best: 900 });
    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    room.hostNext();
    await waitFor(() => room.phase === 'redemption', 3000, 'finale');
    assert.equal(room.chairs.totalRounds, 1, '2 players → a single round');
    await waitFor(() => room.redemption && room.redemption.tGreen, 3000, 'go');
    // Anna mashes into the hard timeout (999999); Ben merely freezes on
    // green (10000) — Ben is less slow, takes the only chair, and the 3×
    // placement bonus overturns Anna's minigame lead.
    room.handleRedemptionReport('a', { status: 'hardTimeout', rawMs: null, earlyPresses: 40 });
    room.handleRedemptionReport('b', { status: 'postGreenTimeout', rawMs: null, earlyPresses: 0 });
    await waitFor(() => room.phase === 'chairs_result', 3000, 'result');
    assert.equal(room.chairs.eliminated[0], 'a');
    room.hostNext();
    await waitFor(() => room.phase === 'winner', 3000, 'winner');
    assert.equal(room.winnerId, 'b', 'last chair pays 3000 — bonus round flips the lead');
    assert.equal(room.finalStandings.length, 2);
    assert.equal(room.finalStandings[0].total, 3000, 'Ben: 0 from games + 3000 bonus');
    assert.equal(room.finalStandings[1].total, 1000, 'Anna: 1000 from games + 0 bonus');
  } finally {
    room.destroy();
  }
});

test('host cannot skip a chairs redemption round before player reports arrive', async () => {
  const room = new Room(stubIo(), 'SKIP', {
    ...FAST,
    enabled: onlyGames('stopclock'),
  }, undefined, { allowClientScoredCompetitive: true });
  try {
    addPlayer(room, 'a', 'Alpha');
    addPlayer(room, 'b', 'Bravo');
    room.start();
    await waitFor(() => room.phase === 'minigame', 3000, 'minigame');
    room.handleSubmit('a', { best: 100 });
    room.handleSubmit('b', { best: 200 });
    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    room.hostNext();
    await waitFor(() => room.phase === 'redemption', 3000, 'finale');

    assert.deepEqual(room.hostNext(), { ok: false, error: 'pending_reports' });
    assert.equal(room.phase, 'redemption', 'host skip is rejected until chairs reports arrive');
    assert.equal(room.redemption.reports.size, 0, 'no synthetic results are created');

    await waitFor(() => room.redemption && room.redemption.tGreen, 3000, 'go');
    const tGreen = room.redemption.tGreen;
    // Reports must arrive after the claimed reaction time could have elapsed
    // (a report that claims 210 ms but arrives instantly would be disqualified
    // as an impossible pre-green timing).
    await sleep(Math.max(0, tGreen - Date.now()) + 220);
    room.handleRedemptionReport('a', { status: 'ok', rawMs: 210, earlyPresses: 0 });
    await sleep(110);
    room.handleRedemptionReport('b', { status: 'ok', rawMs: 320, earlyPresses: 0 });
    await waitFor(() => room.phase === 'chairs_result', 3000, 'result');
    assert.equal(room.chairs.eliminated[0], 'b', 'actual slowest reporter is eliminated');
  } finally {
    room.destroy();
  }
});

test('a pre-green redemption report is disqualified; an honest post-green report still wins', async () => {
  const room = new Room(stubIo(), 'PREK', { ...FAST, enabled: onlyGames('spacemash') });
  try {
    addPlayer(room, 'cheat', 'Cheater');
    addPlayer(room, 'fair', 'Fair');
    room.start();
    await waitFor(() => room.phase === 'minigame', 3000, 'minigame');
    room.handleSubmit('cheat', { count: 40, flagged: false });
    room.handleSubmit('fair', { count: 41, flagged: false });
    await waitFor(() => room.phase === 'scores', 3000, 'scores');
    room.hostNext();
    await waitFor(() => room.phase === 'redemption', 3000, 'finale');
    await waitFor(() => room.redemption && room.redemption.tGreen, 3000, 'go');
    const tGreen = room.redemption.tGreen;
    // Forged report: sent before the green signal, claiming a plausible 100 ms.
    room.handleRedemptionReport('cheat', { status: 'ok', rawMs: 100, earlyPresses: 0 });
    const forged = room.redemption.reports.get('cheat');
    assert.equal(forged.status, 'tooFast', 'pre-green report is disqualified, not scored');
    assert.equal(forged.flagged, true);
    assert.equal(forged.finalMs, 999999, 'it cannot outrank any honest report');
    // Honest report: press at green + 400 ms, report right after.
    await sleep(Math.max(0, tGreen - Date.now()) + 400);
    room.handleRedemptionReport('fair', { status: 'ok', rawMs: 400, earlyPresses: 0 });
    await waitFor(() => room.phase === 'chairs_result', 3000, 'result');
    assert.equal(room.chairs.eliminated[0], 'cheat', 'the disqualified cheater loses the round');
  } finally {
    room.destroy();
  }
});

test('client-scored games are blocked from hosted competitive sessions', () => {
  const room = new Room(stubIo(), 'BLK1', {
    ...FAST,
    enabled: { ...onlyGames('trace', 'stopclock', 'slingshot', 'balance'), rgb: true },
  });
  try {
    addPlayer(room, 'p1', 'Anna');
    addPlayer(room, 'p2', 'Ben');
    // Not advertised, and reported as disabled to the lobby.
    const cfg = room.publicConfig();
    for (const key of ['trace', 'stopclock', 'slingshot', 'balance']) {
      assert.equal(cfg.roster.some((g) => g.key === key), false, `${key} hidden from the hosted lobby`);
      assert.equal(cfg.enabled[key], false, `${key} reported disabled`);
    }
    assert.ok(cfg.roster.some((g) => g.key === 'rgb'), 'unaffected games are still advertised');
    assert.equal(cfg.enabled.rgb, true, 'unaffected games keep their configured state');
    // Blocked games never enter the competitive queue even when configured on.
    assert.equal(room.start().ok, true);
    for (const key of ['trace', 'stopclock', 'slingshot', 'balance']) {
      assert.ok(!room.queue.includes(key), `${key} never queued`);
    }
    assert.ok(room.queue.includes('rgb'));
  } finally {
    room.destroy();
  }
  // A session with ONLY blocked games enabled cannot start.
  const only = new Room(stubIo(), 'BLK1B', { ...FAST, enabled: onlyGames('trace', 'stopclock', 'slingshot', 'balance') });
  try {
    addPlayer(only, 'p1', 'Anna');
    addPlayer(only, 'p2', 'Ben');
    assert.equal(only.start().error, 'Enable at least one game.');
    assert.equal(only.phase, 'lobby');
  } finally {
    only.destroy();
  }
});

test('a crafted host config cannot re-enable client-scored games in a hosted room', () => {
  const room = new Room(stubIo(), 'BLK2', { ...FAST, enabled: onlyGames('spacemash') });
  try {
    assert.equal(room.updateConfig({ enabled: { trace: true, stopclock: true } }).ok, true);
    assert.equal(room.config.enabled.trace, false, 'updateConfig forces the block back on');
    assert.equal(room.config.enabled.stopclock, false);
    assert.equal(room.publicConfig().enabled.trace, false, 'the lobby sees the enforced state');
    addPlayer(room, 'p1', 'Anna');
    addPlayer(room, 'p2', 'Ben');
    assert.equal(room.start().ok, true);
    assert.ok(!room.queue.includes('trace') && !room.queue.includes('stopclock'),
      'blocked games never enter the competitive queue');
    assert.ok(room.queue.includes('spacemash'));
  } finally {
    room.destroy();
  }
});

test('test-only opt-in and solo rooms still play client-scored games', () => {
  // The harness/constructor opt-in (never settable from a client payload).
  const optIn = new Room(stubIo(), 'BLK3', { ...FAST, enabled: onlyGames('stopclock') }, undefined, { allowClientScoredCompetitive: true });
  try {
    assert.ok(optIn.publicConfig().roster.some((g) => g.key === 'stopclock'), 'opt-in advertises the game');
    addPlayer(optIn, 'p1', 'Anna');
    addPlayer(optIn, 'p2', 'Ben');
    assert.equal(optIn.start().ok, true);
    assert.ok(optIn.queue.includes('stopclock'), 'opt-in queues the game');
  } finally {
    optIn.destroy();
  }
  // Solo practice keeps the full roster (unscored, nothing at stake).
  const solo = new Room(stubIo(), 'SOLO', {}, undefined, {});
  try {
    solo.solo = true;
    const cfg = solo.publicConfig();
    assert.ok(cfg.roster.some((g) => g.key === 'trace'));
    assert.ok(cfg.roster.some((g) => g.key === 'balance'));
    assert.equal(cfg.enabled.trace, true, 'solo defaults keep the game on');
  } finally {
    solo.destroy();
  }
});

test('late join: mid-session joiner scores subsequent games and 0 for missed', async () => {
  // Two pre-existing players, two games. The latecomer joins after game 1
  // has been scored, plays game 2, and should have 0 for game 1 and
  // non-zero for game 2. Normalization for game 2 must be unaffected.
  const room = new Room(stubIo(), 'LATE', {
    ...FAST,
    enabled: onlyGames('spacemash', 'stopclock'),
  }, undefined, { allowClientScoredCompetitive: true });
  try {
    addPlayer(room, 'p1', 'Player1');
    addPlayer(room, 'p2', 'Player2');
    assert.equal(room.start().ok, true);

    const submitFor = (key, id, quality) => {
      if (key === 'spacemash') room.handleSubmit(id, { count: 100 - quality * 20, flagged: false });
      else room.handleSubmit(id, { best: 100 + quality * 150 });
    };

    // ---- game 1: play without the latecomer ----
    await waitFor(() => room.phase === 'minigame', 3000, 'first minigame');
    const game1Key = room.round.games[0].key;
    submitFor(game1Key, 'p1', 0); // p1 best
    submitFor(game1Key, 'p2', 1);
    await waitFor(() => room.phase === 'scores', 3000, 'first scores');

    const board1 = room.lastScores;
    assert.equal(board1.find((r) => r.id === 'p1').points, 1000, 'p1 gets 1000 in game 1');

    // ---- admit the latecomer mid-session ----
    const fakeSocket = { id: 'sock-late', join() {}, data: {} };
    const joinResult = room.join(fakeSocket, { name: 'Late', playerId: undefined });

    assert.equal(joinResult.ok, true, 'late join succeeds — not an error');
    const lateId = joinResult.playerId;
    assert.ok(lateId, 'joinResult includes a playerId');
    assert.ok(room.players.has(lateId), 'latecomer is in room.players');

    // Back-fill: latecomer must be in totals with 0
    assert.ok(room.totals.has(lateId), 'latecomer back-filled into room.totals');
    assert.equal(room.totals.get(lateId), 0, 'latecomer back-fill total is 0');

    // Existing player totals are preserved
    const p1TotalAfterGame1 = room.totals.get('p1');
    assert.ok(p1TotalAfterGame1 > 0, 'p1 total unchanged after late join');

    // Reconnect guard: an existing player can still reconnect unchanged
    const rcSocket = { id: 'sock-rc', join() {}, data: {} };
    const rcResult = room.join(rcSocket, { name: 'x', playerId: 'p1', reconnectToken: 'test-reconnect-p1' });
    assert.equal(rcResult.ok, true, 'reconnect for existing player still works');
    assert.equal(room.totals.get('p1'), p1TotalAfterGame1, 'reconnect does not change totals');

    // ---- game 2: everyone including the latecomer submits ----
    room.hostNext();
    await waitFor(() => room.phase === 'minigame', 3000, 'second minigame');
    const game2Key = room.round.games[0].key;
    submitFor(game2Key, 'p1', 2); // p1 worst in game 2
    submitFor(game2Key, 'p2', 1);
    submitFor(game2Key, lateId, 0); // latecomer is best
    await waitFor(() => room.phase === 'scores', 3000, 'second scores');

    const board2 = room.lastScores;

    // Normalization for game 2 is unaffected — best submitter gets 1000
    const lateRow = board2.find((r) => r.id === lateId);
    assert.ok(lateRow, 'latecomer appears in game-2 scores');
    assert.equal(lateRow.points, 1000, 'latecomer (best submitter) gets 1000 in game 2');

    // Latecomer total = game-1 contribution (0) + game-2 points (1000)
    assert.equal(lateRow.total, 1000,
      "latecomer total == game-2 points only (0 from missed game 1)");

    // Existing players' totals accumulated across both games correctly
    const p1Row = board2.find((r) => r.id === 'p1');
    const p2Row = board2.find((r) => r.id === 'p2');
    assert.equal(p1Row.total, board1.find((r) => r.id === 'p1').total + p1Row.points,
      'p1 total accumulates across games');
    assert.equal(p2Row.total, board1.find((r) => r.id === 'p2').total + p2Row.points,
      'p2 total accumulates across games');
  } finally {
    room.destroy();
  }
});

// ---- issue #55: host mid-session controls -----------------------------------

// A recording io captures room-level emits so we can assert the single
// synced broadcast that extendTimer must produce. The hostOnly wrapper in
// sockets.js enforces non-host rejection at the socket layer; tests call
// Room methods directly and rely on the phase guard for the same effect.
const recordingIo = () => {
  const events = [];
  return { events, to: (room) => ({ emit: (event, data) => events.push({ room, event, data }) }) };
};

test('host skip: ends current game immediately, scoring exactly like a natural deadline (submitters keep results, non-submitters 0, session advances)', async () => {
  const room = new Room(stubIo(), 'TEST', {
    ...FAST,
    enabled: onlyGames('spacemash', 'stopclock'),
  }, undefined, { allowClientScoredCompetitive: true });
  try {
    addPlayer(room, 'p1', 'Player1');
    addPlayer(room, 'p2', 'Player2');
    addPlayer(room, 'p3', 'Player3');
    assert.equal(room.start().ok, true);

    await waitFor(() => room.phase === 'minigame', 3000, 'first minigame');
    const g = room.round.games[room.round.gameIndex];
    const key = g.key;

    // p1 best, p2 worse, p3 does NOT submit
    if (key === 'spacemash') {
      room.handleSubmit('p1', { count: 100, flagged: false });
      room.handleSubmit('p2', { count: 60, flagged: false });
    } else {
      room.handleSubmit('p1', { best: 100 });
      room.handleSubmit('p2', { best: 400 });
    }

    // Skip must not throw and must return {ok:true}
    const result = room.skipGame();
    assert.equal(result.ok, true, 'skipGame returns {ok:true}');

    // Scores must arrive well before the natural gameDuration elapses
    await waitFor(() => room.phase === 'scores', 3000, 'scores after skip');

    const board = room.lastScores;
    const row = (id) => board.find((r) => r.id === id);
    assert.equal(row('p1').points, 1000, 'best submitter keeps 1000');
    assert.equal(row('p3').points, 0, 'non-submitter scores 0');
    assert.ok(room.players.has('p3'), 'non-submitter is still in the room');
    // queueIndex advanced: queued second game still pending
    assert.ok(room.queue.length > 0, 'session has not ended — a second game is queued');

    // Calling skipGame when NOT in minigame must return an error, not throw
    assert.equal(room.phase, 'scores', 'sanity: currently in scores phase');
    const errResult = room.skipGame();
    assert.ok(errResult && typeof errResult.error === 'string', 'skipGame outside minigame returns an error object');
  } finally {
    room.destroy();
  }
});

test('host extend: moves the shared deadline once by EXTEND_MS, broadcast identically to all clients, and rejects a second extend', async () => {
  const io = recordingIo();
  const room = new Room(io, 'TEST', {
    ...FAST,
    gameDuration: 5000,  // large enough that the deadline won't fire mid-test
    enabled: onlyGames('spacemash'),
  });
  try {
    addPlayer(room, 'p1', 'Player1');
    addPlayer(room, 'p2', 'Player2');
    assert.equal(room.start().ok, true);

    await waitFor(() => room.phase === 'minigame', 3000, 'minigame');

    const g = room.round.games[0];
    const before = g.deadline;

    // Snapshot config and clientData before extend
    const configSnapshot = JSON.stringify(room.config);
    const clientDataSnapshot = JSON.stringify(g.clientData);

    // Clear any prior events and call extendTimer
    io.events.length = 0;
    const extResult = room.extendTimer();
    assert.equal(extResult.ok, true, 'extendTimer returns {ok:true}');
    assert.equal(g.deadline, before + EXTEND_MS, 'deadline moved by exactly EXTEND_MS');

    // Exactly one game:extend event, targeting the whole room
    const extendEvents = io.events.filter((e) => e.event === 'game:extend');
    assert.equal(extendEvents.length, 1, 'exactly one game:extend broadcast (not per-player)');
    assert.equal(extendEvents[0].room, 'room:TEST', 'broadcast targets the room channel');
    assert.equal(extendEvents[0].data.deadline, g.deadline, 'broadcast deadline matches server deadline');

    // Second extend must be rejected (one-shot)
    const secondResult = room.extendTimer();
    assert.ok(secondResult && typeof secondResult.error === 'string', 'second extend returns an error');
    assert.equal(g.deadline, before + EXTEND_MS, 'deadline unchanged after rejected second extend');

    // Extend must not mutate config or seeded clientData
    assert.equal(JSON.stringify(room.config), configSnapshot, 'config unchanged after extend');
    assert.equal(JSON.stringify(g.clientData), clientDataSnapshot, 'clientData unchanged after extend');

    // Extend when not in active game must return error
    const freshRoom = new Room(stubIo(), 'FRESH', {});
    try {
      const lobbyErr = freshRoom.extendTimer();
      assert.ok(lobbyErr && typeof lobbyErr.error === 'string', 'extendTimer in lobby returns an error');
    } finally {
      freshRoom.destroy();
    }
  } finally {
    room.destroy();
  }
});

test('host extend: every player receives the same single deadline (no per-client nudge)', async () => {
  const io = recordingIo();
  const room = new Room(io, 'TEST', {
    ...FAST,
    gameDuration: 5000,
    enabled: onlyGames('spacemash'),
  });
  try {
    addPlayer(room, 'p1', 'Player1');
    addPlayer(room, 'p2', 'Player2');
    addPlayer(room, 'p3', 'Player3');
    assert.equal(room.start().ok, true);

    await waitFor(() => room.phase === 'minigame', 3000, 'minigame');

    io.events.length = 0;
    room.extendTimer();

    const extendEvents = io.events.filter((e) => e.event === 'game:extend');
    // One room-level emit regardless of player count — not per-player
    assert.equal(extendEvents.length, 1, 'single room-level emit for 3 players');
    assert.equal(extendEvents[0].room, 'room:TEST', 'targets whole room, not individual sockets');
  } finally {
    room.destroy();
  }
});
