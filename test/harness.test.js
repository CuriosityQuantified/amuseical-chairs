// 20-bot end-to-end harness. Every bug in this system is a 20-player
// concurrency bug: bots join, play every minigame with plausible random
// submissions, include silent non-submitters, a mid-round disconnect +
// reconnect, and a masher in the musical-chairs finale — and the game must
// play every enabled game exactly once, run the full 19-round chairs
// elimination tournament, and reach a winner by highest total.

import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createServer } from '../server/app.js';
import { ROSTER } from '../server/games.js';
import { cupsLevel } from '../shared/cups.js';
import { trayLevel } from '../shared/tray.js';
import { parseValue } from '../shared/fractions.js';
import { solveScramble } from '../shared/anagram.js';
import { solveGrid } from '../shared/wordhunt.js';
import { areaRatio } from '../shared/area.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Await a promise with a deadline whose timer is cleaned up on resolution —
// a bare Promise.race(sleep) would keep the test process alive for the full
// timeout even after a pass.
async function withDeadline(promise, ms, msg) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(msg)), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Fast pacing so a full 20-player game runs in seconds. Game mechanics are
// untouched — only phase timings shrink.
const TEST_CONFIG = {
  // The harness exercises every roster game, including deliberately default-off
  // games such as Anagram Rush; production rooms retain their fair defaults.
  enabled: Object.fromEntries(ROSTER.map((game) => [game.key, true])),
  gameDuration: 900,
  musicMs: 60,
  tutorialMs: 50,
  redemptionPrepMs: 80,
  redemptionLeadMs: 200,
  postGreenTimeout: 800,
  hardTimeout: 1500,
  closeGraceMs: 300,
  // Completion-mode games (cups, issue #46) have no shared deadline: they close
  // on all-submit or this safety backstop. The harness has silent
  // non-submitters, so without a short backstop the cups round would hang until
  // the 15-minute production default. Keep it just above gameDuration so the
  // stalled room still closes deterministically in seconds.
  completionSafetyMs: 1200,
};

// A bot's payload for one stage of one game. `bot` is threaded through so a
// multi-stage game can remember what this device wrote in stage one.
function botPayload(key, data, rnd, stage = 1, bot = null) {
  if (key === 'icebreaker') {
    // Stage 1 writes a fun fact; every stage after it is one fact on screen
    // and the whole room as the candidate list.
    if (stage === 1) return { text: `${bot?.name || 'Someone'} once did thing ${Math.floor(rnd() * 1000)}` };
    const options = data.options || [];
    if (!options.length) return {};
    return { factId: data.factId, pick: options[Math.floor(rnd() * options.length)].id };
  }
  if (key === 'caption') {
    if (stage === 2) {
      // Vote for other people's entries only — a bot that spends its ballot on
      // itself would have those votes dropped server-side and we would learn
      // nothing about the vote spread.
      const others = (data.entries || []).filter((e) => e.text !== bot?.myCaption);
      const shuffled = others.slice().sort(() => rnd() - 0.5);
      return { votes: shuffled.slice(0, data.votesPerPlayer || 1).map((e) => e.id) };
    }
    const text = `${bot?.name || 'Someone'} says thing ${Math.floor(rnd() * 1000)}`;
    if (bot) bot.myCaption = text;
    return { text };
  }
  switch (key) {
    case 'rgb': return { r: Math.floor(rnd() * 256), g: Math.floor(rnd() * 256), b: Math.floor(rnd() * 256) };
    case 'oddoneout': return { cleared: 2 + Math.floor(rnd() * 20) };
    case 'bisect': return { guesses: data.targets.map((t) => Math.max(0, Math.min(100, t + (rnd() * 20 - 10)))) };
    case 'area': return { guesses: data.trials.map((trial) => Math.max(0, Math.min(100, areaRatio(trial) + (rnd() * 16 - 8)))) };
    case 'trace': return { deviation: 0.01 + rnd() * 0.08, coverage: 0.92 + rnd() * 0.08 };
    case 'dots': return { guesses: data.counts.map((c) => Math.max(1, Math.round(c * (0.5 + rnd())))) };
    case 'stopclock': return { best: rnd() * 1500 };
    // Keeps the beat with human jitter: the nth beat is due at intervalMs * n
    // after the count-in, ±80ms. A bot that mashed instead would score the
    // floor — that property is pinned deterministically in metronome.test.js
    // rather than here, where every bot's payload is random.
    case 'metronome': return {
      offsets: [...Array(data.silentBeats)].map(
        (_, i) => data.intervalMs * (i + 1) + (rnd() * 160 - 80)),
    };
    case 'gridflash': return { picks: data.patterns.map(() => [...Array(8)].map(() => Math.floor(rnd() * 25))) };
    // Remembers the tray like a person: flags every changed slot except one
    // (a human miss), derived from the round seed through the same module the
    // real client animates — a bot that tapped blindly would flag random
    // slots and the whole room would tie on noise.
    case 'tray': {
      const level = trayLevel(data.seed);
      const picks = level.changed.slice(0, level.changed.length - 1);
      // Half the time, also misremember one unchanged slot as changed.
      if (rnd() < 0.5) {
        const wrong = [...Array(12).keys()].find((i) => !level.changed.includes(i));
        picks.push(wrong);
      }
      return { picks };
    }
    // Issue #46: every player plays all ten levels and a miss no longer ends
    // the run. The bot tracks the ball well early and loses it more often as
    // the shuffle speeds up — each level independently correct or a
    // neighbouring cup. Derived from the round seed through the same module the
    // real client animates, so the point total (100·level per correct level)
    // varies across bots and the room does not tie at the floor.
    case 'cups': {
      return {
        picks: [...Array(data.maxLevels)].map((_, i) => {
          const level = i + 1;
          const plan = cupsLevel(data.seed, level, data);
          // Harder (faster) levels are missed more often.
          const missChance = level / (data.maxLevels + 2);
          const missed = rnd() < missChance;
          return { level, cupIndex: missed ? (plan.ball + 1) % plan.cups : plan.ball };
        }),
      };
    }
    case 'flags': {
      // The harness cannot see the server answer. It submits one safe option
      // per round and proves that ten ordered choices are accepted.
      return { choices: data.rounds.map(() => Math.floor(rnd() * 8)) };
    }
    case 'readroom': return { answer: rnd() < 0.5, prediction: Math.floor(rnd() * 101) };
    case 'typing': return { typed: data.sentence.slice(0, 5 + Math.floor(rnd() * data.sentence.length)), elapsedMs: 15000 + rnd() * 20000 };
    case 'anagram': {
      const solved = [];
      for (let i = 0; i < (data.scrambles || []).length; i++) {
        if (rnd() < 0.7) solved.push({ index: i, word: solveScramble(data.scrambles[i]) });
      }
      return { solved };
    }
    case 'wordhunt': {
      // Find real words on the shared grid, then submit a randomized subset so
      // bots don't all tie on the full solution — a human finds some, not all.
      const all = solveGrid(data.grid);
      return { words: all.filter(() => rnd() < 0.6) };
    }
    case 'stroop': {
      // A plausible human: answer each card's ink mostly right, sometimes fall
      // for the printed word (a wrong pick), and run out of time before the end.
      const items = data.items || [];
      const names = (data.palette || []).map((c) => c.name);
      const reached = Math.max(1, Math.floor(items.length * (0.4 + rnd() * 0.4)));
      const picks = [];
      for (let i = 0; i < reached; i++) {
        const correct = items[i].ink;
        const wrong = names.filter((n) => n !== correct);
        const color = rnd() < 0.8 || !wrong.length ? correct : wrong[Math.floor(rnd() * wrong.length)];
        picks.push({ index: i, color });
      }
      return { picks };
    }
    case 'spacemash': return { count: 40 + Math.floor(rnd() * 70), flagged: false };
    case 'slingshot': return { best: rnd() * 40 };
    // Falls somewhere in the round like a person. The server clamps to the
    // room's real duration, so a bot that "survives" past the deadline is
    // scored at the maximum — the same claim a cheater could make, and the
    // reason the clamp is pinned in balance.test.js rather than here.
    case 'balance': return { survivedMs: Math.floor(rnd() * 45000) };
    // Answers ~70% of the pairs like a fast human with a calculator — the
    // same parse-compare anyone can do from the on-screen text. The pure
    // guesser (net clamped to zero, not half) is pinned deterministically in
    // fractions.test.js rather than here, where every bot's payload is random.
    case 'fractions': {
      const picks = [];
      let correct = 0;
      let wrong = 0;
      for (const pair of data.pairs || []) {
        const mine = parseValue(pair.left) > parseValue(pair.right) ? 'left' : 'right';
        const pick = rnd() < 0.7 ? mine : (mine === 'left' ? 'right' : 'left');
        picks.push(pick);
        if (pick === mine) correct++;
        else wrong++;
      }
      return { picks, correct, wrong };
    }
    default: return {};
  }
}

class Bot {
  constructor(url, name, behavior) {
    this.url = url;
    this.name = name;
    this.behavior = behavior; // 'normal' | 'nosubmit' | 'masher' | 'flaky'
    this.playerId = null;
    this.reconnectToken = null;
    this.reconnected = false;
    this.scoreCards = [];     // every you:score payload received
    this.myCaption = null;    // what this bot wrote in a two-stage game
    this.socket = null;
  }

  async join(code) {
    this.code = code;
    this.socket = connect(this.url, { transports: ['websocket'], forceNew: true });
    this.wire(this.socket);
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error(`${this.name} join timeout`)), 5000);
      this.socket.emit('player:join', {
        code,
        name: this.name,
        playerId: this.playerId,
        reconnectToken: this.reconnectToken,
      }, (res) => {
        clearTimeout(to);
        if (res.error) return reject(new Error(res.error));
        this.playerId = res.playerId;
        this.reconnectToken = res.reconnectToken;
        resolve();
      });
    });
  }

  wire(s) {
    s.on('phase', async (p) => {
      if (p.name === 'minigame') {
        if (this.behavior === 'nosubmit' || this.behavior === 'masher') return;
        if (this.behavior === 'flaky' && !this.reconnected) {
          // Drop mid-game, come back with the stored playerId.
          this.reconnected = true;
          s.disconnect();
          await sleep(250);
          await this.join(this.code);
          return;
        }
        await sleep(10 + Math.random() * 120);
        s.emit('player:submit', {
          payload: botPayload(p.key, p.clientData, Math.random, p.stage || 1, this),
        });
      }
    });
    s.on('you:score', (card) => { this.scoreCards.push(card); });
    s.on('redemption:go', async (p) => {
      if (!p.participants.includes(this.playerId)) return;
      if (this.behavior === 'masher') {
        // A masher's client-side machine never shows green (proven in
        // redemption.test.js under a fake clock); its report is the hard
        // timeout with a pile of early presses.
        await sleep(30);
        this.socket.emit('redemption:report', { status: 'hardTimeout', rawMs: null, earlyPresses: 812 });
      } else {
        const rawMs = 180 + Math.random() * 350;
        // Press at the claimed reaction time, then report after processing
        // latency. A report that claims rawMs but arrives immediately would be
        // an impossible pre-green timing and is disqualified server-side.
        await sleep(Math.max(0, p.tGreen - Date.now()) + rawMs + 30 + Math.random() * 80);
        this.socket.emit('redemption:report', {
          status: 'ok',
          rawMs,
          earlyPresses: Math.random() < 0.25 ? 1 : 0,
        });
      }
    });
  }

  close() { try { this.socket?.disconnect(); } catch { /* done */ } }
}

test('20 bots: every game once, per-game scores, chairs finale, winner by total', async () => {
  const { httpServer, io, rooms } = createServer({ allowClientScoredCompetitive: true, allowInternalCreateConfig: true });
  await new Promise((r) => httpServer.listen(0, r));
  const url = `http://localhost:${httpServer.address().port}`;

  const host = connect(url, { transports: ['websocket'], forceNew: true });
  const bots = [];
  const stagesSeen = [];    // { key, stage, totalStages } per minigame phase
  const reveals = [];       // { round, answered } per reveal phase
  const scoreboards = [];
  let chairsSeen = 0;
  let winnerPayload = null;

  try {
    // ---- host creates the room ----
    const created = await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('create timeout')), 5000);
      host.emit('host:create', { origin: url, config: TEST_CONFIG }, (res) => {
        clearTimeout(to);
        res.error ? reject(new Error(res.error)) : resolve(res);
      });
    });
    assert.match(created.code, /^[A-HJ-NP-Z]{4}$/, 'room code is 4 ambiguity-free letters');

    const winnerReached = new Promise((resolve) => {
      host.on('phase', (p) => {
        if (p.name === 'minigame') {
          stagesSeen.push({ key: p.key, stage: p.stage || 1, totalStages: p.totalStages || 1 });
        }
        if (p.name === 'scores') {
          scoreboards.push(p.leaderboard);
          setTimeout(() => host.emit('host:next', {}, () => {}), 30);
        }
        // Tutorials no longer auto-advance — the host starts each game.
        // Chairs round results wait for the host's Next, and so does every
        // Icebreaker reveal: once to put the answer up, once to move on.
        if (p.name === 'tutorial' || p.name === 'chairs_result' || p.name === 'reveal') {
          if (p.name === 'reveal') reveals.push({ round: p.round, answered: p.answered });
          setTimeout(() => host.emit('host:next', {}, () => {}), 20);
        }
        if (p.name === 'redemption') chairsSeen++;
        if (p.name === 'winner') { winnerPayload = p; resolve(p); }
      });
    });

    // ---- 20 bots join: 16 normal, 1 flaky, 2 silent non-submitters, 1 masher ----
    for (let i = 0; i < 20; i++) {
      const behavior = i === 19 ? 'masher' : i >= 17 ? 'nosubmit' : i === 5 ? 'flaky' : 'normal';
      bots.push(new Bot(url, `Bot${String(i).padStart(2, '0')}`, behavior));
    }
    await Promise.all(bots.map((b) => b.join(created.code)));

    const startRes = await new Promise((resolve) => host.emit('host:start', {}, resolve));
    assert.equal(startRes.ok, true);

    await withDeadline(winnerReached, 90000, `game never reached a winner (phase=${rooms.get(created.code)?.phase}; queueIndex=${rooms.get(created.code)?.queueIndex}; game=${rooms.get(created.code)?.round?.games?.[rooms.get(created.code)?.round?.gameIndex]?.key || 'none'})`);
    // The host's winner event doesn't guarantee every bot has drained its own
    // socket queue (the finale you:score) yet.
    await sleep(500);

    // ---- assertions ----
    const enabledCount = ROSTER.length;
    const firstStages = stagesSeen.filter((s) => s.stage === 1);
    assert.equal(firstStages.length, enabledCount, 'every enabled game played');
    assert.equal(new Set(firstStages.map((s) => s.key)).size, enabledCount, 'no game repeats');
    assert.equal(chairsSeen, bots.length - 1,
      'chairs tournament runs players − 1 elimination rounds');

    // Two-stage games re-enter `minigame` for stage two. Without this the
    // harness would silently stop covering the new phase.
    const twoStageKeys = ROSTER.filter((g) => g.stages === 2).map((g) => g.key);
    for (const key of twoStageKeys) {
      const stages = stagesSeen.filter((s) => s.key === key).map((s) => s.stage);
      assert.deepEqual(stages, [1, 2], `${key} played both stages, in order`);
      assert.ok(stagesSeen.every((s) => s.key !== key || s.totalStages === 2),
        `${key} labels itself as two-stage in the phase payload`);
    }

    // Icebreaker is as long as the room: one guessing stage per bot that
    // actually wrote a fun fact (16 normal + the flaky one that reconnects
    // in time to write; the 2 silent bots and the masher never do). Every
    // fact goes out on its own, in order, and every one of them stops for a
    // two-press reveal before the next one starts.
    const ice = stagesSeen.filter((s) => s.key === 'icebreaker');
    const factCount = ice.length - 1;
    assert.ok(factCount >= 16, `every writing bot's fact became a round (${factCount})`);
    assert.deepEqual(ice.map((s) => s.stage), [...Array(ice.length).keys()].map((i) => i + 1),
      'the facts went out one at a time, in order, and never in parallel');
    assert.equal(ice[0].totalStages, 1,
      'before the room has written anything, the game cannot know its own length');
    assert.ok(ice.slice(1).every((s) => s.totalStages === ice.length),
      'and every guessing stage knows how long it turned out to be');
    assert.deepEqual(reveals.map((r) => r.answered),
      [...Array(factCount)].flatMap(() => [false, true]),
      'every fun fact was discussed first and answered second — including the last');
    assert.deepEqual(reveals.filter((r) => !r.answered).map((r) => r.round),
      [...Array(factCount).keys()].map((i) => i + 1));

    // Per-game scoreboards: full roster of 20 on every one, totals monotone.
    assert.equal(scoreboards.length, enabledCount, 'a scoreboard after every game');
    for (const board of scoreboards) {
      assert.equal(board.length, 20, 'nobody is ever dropped from the scoreboard');
      for (let i = 1; i < board.length; i++) {
        assert.ok(board[i - 1].total >= board[i].total, 'scoreboard sorted by total');
      }
    }

    // Every submitting bot saw a personal score card after every game + finale.
    for (const b of bots) {
      if (b.behavior === 'normal') {
        assert.equal(b.scoreCards.length, enabledCount + 1,
          `${b.name} saw a score after every game and the finale`);
        for (const card of b.scoreCards) {
          assert.ok(Number.isFinite(card.points) && Number.isFinite(card.total),
            'score cards carry points and running total');
        }
      }
    }

    // Winner is the highest total; standings are complete and sorted.
    assert.ok(winnerPayload.winnerName, 'a winner is declared');
    const standings = winnerPayload.standings;
    assert.equal(standings.length, 20, 'all 20 in final standings — no elimination');
    for (let i = 1; i < standings.length; i++) {
      assert.ok(standings[i - 1].total >= standings[i].total, 'standings sorted by total');
    }
    assert.equal(winnerPayload.winnerId, standings[0].id);

    const masher = bots[19];
    const masherRow = standings.find((s) => s.id === masher.playerId);
    assert.equal(masherRow.total, 0,
      'masher never scored: no submissions, first out of chairs → 0 bonus');
    assert.notEqual(winnerPayload.winnerId, masher.playerId, 'masher must not win');

    const standingNames = standings.map((s) => s.name);
    for (const b of bots) assert.ok(standingNames.includes(b.name), `${b.name} in final standings`);

    // The flaky bot reconnected successfully with its identity intact.
    assert.equal(bots[5].reconnected, true);
  } finally {
    for (const b of bots) b.close();
    host.disconnect();
    // Rooms hold live timers (including a 15-minute empty-room TTL) that
    // would keep the test process's event loop alive.
    for (const room of rooms.values()) room.destroy();
    io.close();
    httpServer.close();
  }
});

test('2-player game runs to a winner', async () => {
  const { httpServer, io, rooms } = createServer({ allowClientScoredCompetitive: true, allowInternalCreateConfig: true });
  await new Promise((r) => httpServer.listen(0, r));
  const url = `http://localhost:${httpServer.address().port}`;
  const host = connect(url, { transports: ['websocket'], forceNew: true });
  const bots = [0, 1].map((i) => new Bot(url, `Duo${i}`, 'normal'));
  try {
    const created = await new Promise((resolve, reject) => {
      host.emit('host:create', { origin: url, config: TEST_CONFIG }, (res) =>
        res.error ? reject(new Error(res.error)) : resolve(res));
    });
    const winner = new Promise((resolve) => {
      host.on('phase', (p) => {
        if (p.name === 'scores' || p.name === 'tutorial'
            || p.name === 'chairs_result' || p.name === 'reveal') {
          setTimeout(() => host.emit('host:next', {}, () => {}), 20);
        }
        if (p.name === 'winner') resolve(p);
      });
    });
    await Promise.all(bots.map((b) => b.join(created.code)));
    await new Promise((resolve) => host.emit('host:start', {}, resolve));
    const w = await withDeadline(winner, 60000, 'no winner');
    assert.ok(w.winnerName);
    assert.equal(w.standings.length, 2);
    assert.ok(w.standings[0].total >= w.standings[1].total);
  } finally {
    for (const b of bots) b.close();
    host.disconnect();
    for (const room of rooms.values()) room.destroy();
    io.close();
    httpServer.close();
  }
});
