// Room = one game session. All state is in-memory and ephemeral by design —
// no database, no persistence.
//
// Format: every player plays every enabled minigame once (each normalized
// 0–1000 across the players who played it and added to a running total),
// then the musical-chairs finale: a BONUS elimination tournament of
// (players − 1) reaction rounds. Each round the slowest player loses their
// chair; the tournament runs until one player remains, and everyone banks
// 3× points by final placement (1st = 3000 … last = 0). Highest cumulative
// total wins the session.

import crypto from 'node:crypto';
import { seededRng, shuffle } from '../shared/rng.js';
import { normalizeError, normalizeScore } from '../shared/normalize.js';
import { scoreRedemptionReport } from '../shared/redemption-core.js';
import {
  ROSTER,
  ROSTER_BY_KEY,
  NEEDS_AGGREGATION,
  MULTI_STAGE,
  buildGameData,
  buildStages,
  buildReveal,
  computeMetric,
  aggregateGame,
  formatRaw,
} from './games.js';

// Ambiguity-free room-code alphabet: no I or O (and digits are excluded).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeRoomCode(rng = Math.random) {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return code;
}

// The host lobby exposes exactly one knob (minigame duration) plus the
// per-game toggles; HOST_EDITABLE_CONFIG below is the enforcement, and
// scripts/check.mjs fails the build if the UI grows a second one. Everything
// else here is an internal default — settable when a room is constructed (the
// bot harness drives the pacing knobs that way) but never from the lobby.
const DEFAULTS = {
  gameDuration: 45000,
  tutorialMs: 9000,        // animated how-to screen before each game; 0 = off
  // K-of-N draw: how many of the enabled games a session actually plays.
  // 0 = all of them, which is what every hosted session plays: this was a host
  // slider ("Games this session") and is deliberately not one any more.
  gamesPerSession: 0,
  // One unscored Stop the Clock before the real games, so broken devices
  // surface early. Was a host checkbox ("Practice round first"); now always on.
  practice: true,
  minDelay: 2000,
  maxDelay: 6000,
  earlyPressPenalty: 0.1,
  postGreenTimeout: 10000,
  hardTimeout: 25000,
  slingshotDistance: 60,
  // pacing knobs (the low clamps exist so the bot harness can run a full
  // game in seconds)
  musicMs: null,           // null = seeded 4–7s
  redemptionPrepMs: 2500,  // client re-sync window before green is scheduled
  redemptionLeadMs: 3000,  // T_green broadcast this far ahead
  closeGraceMs: 1500,      // late-submission grace after a game's deadline
};

function sanitizeConfig(raw = {}) {
  const c = { ...DEFAULTS };
  const numIn = (v, lo, hi, dflt) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
  };
  c.gameDuration = numIn(raw.gameDuration, 500, 120000, DEFAULTS.gameDuration);
  c.tutorialMs = numIn(raw.tutorialMs, 0, 30000, DEFAULTS.tutorialMs);
  c.gamesPerSession = Math.round(numIn(raw.gamesPerSession, 0, ROSTER.length, DEFAULTS.gamesPerSession));
  c.practice = raw.practice != null ? !!raw.practice : DEFAULTS.practice;
  c.minDelay = numIn(raw.minDelay, 500, 10000, DEFAULTS.minDelay);
  c.maxDelay = numIn(raw.maxDelay, c.minDelay, 15000, Math.max(c.minDelay, DEFAULTS.maxDelay));
  c.earlyPressPenalty = numIn(raw.earlyPressPenalty, 0, 0.5, DEFAULTS.earlyPressPenalty);
  c.postGreenTimeout = numIn(raw.postGreenTimeout, 1000, 30000, DEFAULTS.postGreenTimeout);
  c.hardTimeout = numIn(raw.hardTimeout, 1000, 60000, DEFAULTS.hardTimeout);
  c.slingshotDistance = numIn(raw.slingshotDistance, 30, 150, DEFAULTS.slingshotDistance);
  c.musicMs = raw.musicMs != null ? numIn(raw.musicMs, 50, 15000, null) : null;
  c.redemptionPrepMs = numIn(raw.redemptionPrepMs, 50, 10000, DEFAULTS.redemptionPrepMs);
  c.redemptionLeadMs = numIn(raw.redemptionLeadMs, 100, 10000, DEFAULTS.redemptionLeadMs);
  c.closeGraceMs = numIn(raw.closeGraceMs, 0, 5000, DEFAULTS.closeGraceMs);
  c.enabled = {};
  for (const g of ROSTER) {
    c.enabled[g.key] = raw.enabled && raw.enabled[g.key] != null ? !!raw.enabled[g.key] : true;
  }
  return c;
}

// The complete set of config keys the host screen may change from the lobby.
// `updateConfig` drops everything else, so a control that reappears in the
// lobby UI has no server to talk to. Growing this list is a deliberate act:
// scripts/check.mjs asserts it against the controls in public/host.html, and
// both have to change together.
export const HOST_EDITABLE_CONFIG = new Set(['gameDuration', 'enabled']);

export class Room {
  constructor(io, code, config, onEmpty = () => {}) {
    this.io = io;
    this.code = code;
    this.config = sanitizeConfig(config);
    this.onEmpty = onEmpty;
    this.hostKey = crypto.randomUUID();
    this.hostSocketId = null;
    this.players = new Map(); // id -> player
    this.phase = 'lobby';
    this.queue = [];          // game keys, each played exactly once
    this.queueIndex = 0;
    this.totals = new Map();  // playerId -> cumulative points
    this.round = null;        // current single-game round (also practice/test)
    this.reveal = null;       // between-stages reveal the host is holding on
    this.lastScores = null;   // leaderboard rows from the last scored game
    this.redemption = null;
    this.chairs = null;       // musical-chairs elimination tournament state
    this.afterMusic = null;   // what the music phase leads into
    this.tutorial = null;     // current tutorial info (for reconnect snapshots)
    this.afterTutorial = null;
    this.winnerId = null;
    this.finalStandings = null;
    this.timers = new Map();
    this.solo = false;        // solo practice room: the lone player drives it
    this.testCounter = 0;
    this.destroyed = false;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }

  // ---- plumbing -----------------------------------------------------------

  setTimer(name, fn, ms) {
    if (this.destroyed) return;
    this.clearTimer(name);
    const t = setTimeout(() => {
      this.timers.delete(name);
      try { fn(); } catch (err) { console.error(`room ${this.code} timer ${name}:`, err); }
    }, ms);
    // Unref'd timers never hold the process open (the listening server does
    // that in production); they still fire on schedule while it runs.
    t.unref?.();
    this.timers.set(name, t);
  }

  clearTimer(name) {
    const t = this.timers.get(name);
    if (t) { clearTimeout(t); this.timers.delete(name); }
  }

  destroy() {
    this.destroyed = true;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  emitAll(event, data) { this.io.to(`room:${this.code}`).emit(event, data); }
  emitHost(event, data) { this.io.to(`host:${this.code}`).emit(event, data); }
  emitPlayer(playerId, event, data) {
    const p = this.players.get(playerId);
    if (p && p.socketId) this.io.to(p.socketId).emit(event, data);
  }

  setPhase(name, data = {}) {
    this.phase = name;
    this.lastActivity = Date.now();
    // `name` last: it is what every client switches on, and no payload field
    // may shadow it.
    this.emitAll('phase', { ...data, name, progress: this.progressInfo() });
  }

  alive() { return [...this.players.values()]; }

  // Total events = every queued game + the musical-chairs finale.
  progressInfo() {
    const total = (this.queue.length || 0) + 1;
    return {
      players: this.players.size,
      game: Math.min(this.queueIndex + 1, total),
      totalGames: total,
    };
  }

  playerSummaries() {
    return [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      total: Math.round(this.totals.get(p.id) || 0),
      sync: p.sync || null,
    }));
  }

  broadcastPlayers() {
    this.emitAll('room:players', { players: this.playerSummaries() });
  }

  // ---- join / reconnect ---------------------------------------------------

  join(socket, { name, playerId }) {
    if (playerId && this.players.has(playerId)) {
      // Reconnect: rebind socket — nobody loses their identity or score for
      // a wifi hiccup; they simply may have missed submissions.
      const p = this.players.get(playerId);
      p.socketId = socket.id;
      p.connected = true;
      p.disconnectedAt = null;
      this.clearTimer(`kick:${p.id}`);
      socket.join(`room:${this.code}`);
      socket.data.roomCode = this.code;
      socket.data.playerId = p.id;
      this.broadcastPlayers();
      return { ok: true, playerId: p.id, name: p.name, snapshot: this.snapshot(p.id) };
    }
    if (this.phase !== 'lobby') return { error: 'Game already started — ask the host for a rematch.' };
    if (this.players.size >= 30) return { error: 'Room is full (30 players max).' };
    let cleanName = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'Player';
    const names = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    let finalName = cleanName;
    let i = 2;
    while (names.has(finalName.toLowerCase())) finalName = `${cleanName} ${i++}`;
    const p = {
      id: crypto.randomUUID(),
      name: finalName,
      socketId: socket.id,
      connected: true,
      disconnectedAt: null,
      sync: null,
      joinedAt: Date.now(),
    };
    this.players.set(p.id, p);
    socket.join(`room:${this.code}`);
    socket.data.roomCode = this.code;
    socket.data.playerId = p.id;
    this.broadcastPlayers();
    return { ok: true, playerId: p.id, name: p.name, snapshot: this.snapshot(p.id) };
  }

  handleDisconnect(socket) {
    const pid = socket.data.playerId;
    if (socket.id === this.hostSocketId) this.hostSocketId = null;
    if (pid && this.players.has(pid)) {
      const p = this.players.get(pid);
      if (p.socketId === socket.id) {
        p.connected = false;
        p.disconnectedAt = Date.now();
        // In the lobby a vanished player is removed after 60s; mid-game they
        // are kept (missed submissions score 0, identity survives).
        if (this.phase === 'lobby') {
          this.setTimer(`kick:${pid}`, () => {
            if (this.phase === 'lobby' && this.players.get(pid) && !this.players.get(pid).connected) {
              this.players.delete(pid);
              this.broadcastPlayers();
            }
          }, 60000);
        }
        this.broadcastPlayers();
      }
    }
    const anyConnected =
      this.hostSocketId || [...this.players.values()].some((p) => p.connected);
    if (!anyConnected) {
      this.setTimer('empty', () => this.onEmpty(this), 15 * 60 * 1000);
    }
  }

  recordSync(playerId, sync) {
    const p = this.players.get(playerId);
    if (!p || !sync) return;
    p.sync = {
      offset: Number(sync.offset) || 0,
      minRtt: Math.max(0, Number(sync.minRtt) || 0),
      jitter: Math.max(0, Number(sync.jitter) || 0),
    };
    // Per-player clock-sync confidence for the host screen.
    p.sync.quality =
      p.sync.minRtt < 150 && p.sync.jitter < 60 ? 'good'
      : p.sync.minRtt < 400 && p.sync.jitter < 200 ? 'ok'
      : 'poor';
    this.broadcastPlayers();
  }

  snapshot(playerId) {
    const p = playerId ? this.players.get(playerId) : null;
    const snap = {
      code: this.code,
      phase: this.phase,
      solo: this.solo,
      players: this.playerSummaries(),
      progress: this.progressInfo(),
      config: this.publicConfig(),
      you: p ? { id: p.id, name: p.name, total: Math.round(this.totals.get(p.id) || 0) } : null,
      winnerId: this.winnerId,
      finalStandings: this.finalStandings,
    };
    if ((this.phase === 'minigame' || this.phase === 'practice') && this.round) {
      const g = this.round.games[this.round.gameIndex];
      if (g && p && !g.submissions.has(p.id)) {
        snap.game = this.gamePayload(g);
      }
    }
    if (this.phase === 'scores' && this.lastScores) {
      snap.scores = this.lastScores;
    }
    if (this.phase === 'reveal' && this.reveal) {
      snap.reveal = this.revealPayload();
    }
    if (this.phase === 'tutorial' && this.tutorial) {
      snap.tutorial = { ...this.tutorial };
    }
    return snap;
  }

  // What the host and player screens are allowed to see. A config key that is
  // not here cannot be rendered as a control, because no client ever learns
  // its value.
  publicConfig() {
    const { gameDuration, minDelay, maxDelay, enabled } = this.config;
    const roster = ROSTER.map(({ key, name, category, stages }) =>
      ({ key, name, category, stages: stages || 1 }));
    return { gameDuration, minDelay, maxDelay, enabled, roster };
  }

  updateConfig(raw) {
    if (this.phase !== 'lobby') return { error: 'Config can only change in the lobby.' };
    // Anything outside the allowlist is dropped rather than rejected: a stale
    // host tab pushing a knob that no longer exists should not fail the whole
    // patch, and a hand-crafted socket payload should not be able to reach an
    // internal default.
    const patch = {};
    for (const [key, value] of Object.entries(raw || {})) {
      if (HOST_EDITABLE_CONFIG.has(key)) patch[key] = value;
    }
    this.config = sanitizeConfig({ ...this.config, ...patch, enabled: { ...this.config.enabled, ...(patch.enabled || {}) } });
    this.emitAll('room:config', this.publicConfig());
    return { ok: true };
  }

  // ---- game flow ----------------------------------------------------------

  start() {
    if (this.phase !== 'lobby') return { error: 'Already started.' };
    if (this.players.size < 2) return { error: 'Need at least 2 players.' };
    const enabledKeys = ROSTER.filter((g) => this.config.enabled[g.key]).map((g) => g.key);
    if (!enabledKeys.length) return { error: 'Enable at least one game.' };
    // K-of-N draw: seeded shuffle first, then take the first K. Which games a
    // session plays is as random as their order, and 0 still means "all".
    const drawn = shuffle(seededRng(`${this.code}:queue`), enabledKeys);
    const k = this.config.gamesPerSession;
    this.queue = k > 0 && k < drawn.length ? drawn.slice(0, k) : drawn;
    this.queueIndex = 0;
    this.totals = new Map([...this.players.keys()].map((id) => [id, 0]));
    if (this.config.practice) this.startPractice();
    else this.nextGame();
    return { ok: true };
  }

  // One playable stage of one game. A multi-stage game produces several: the
  // ones after stage 1 are appended when stage 1 closes, each with its own
  // token, submissions map and deadline.
  makeStage(meta, clientData, secret, stage = 1, opts = {}) {
    return {
      ...meta,
      clientData,
      secret,
      submissions: new Map(),
      metrics: new Map(),
      token: crypto.randomUUID(),
      stage,
      // A game whose length depends on what the room submitted does not know
      // its total until stage 1 closes; until then it labels itself as one.
      totalStages: opts.totalStages ?? (meta.stages === 2 ? 2 : 1),
      stageName: opts.stageName || null,
      // Does the room stop for a reveal after this stage, before the next one?
      reveal: !!opts.reveal,
      // Fraction of the configured minigame duration this stage gets.
      durationScale: opts.durationScale || 1,
    };
  }

  // The candidate list a guessing game offers: everyone in the room, in join
  // order. The game reorders it once, seeded, so every screen agrees.
  playerOptions() {
    return [...this.players.values()].map((p) => ({ id: p.id, name: p.name }));
  }

  // Practice: one un-scored Stop the Clock so broken devices surface before
  // the real games, not during them.
  startPractice() {
    const rng = seededRng(`${this.code}:practice`);
    const { clientData, secret } = buildGameData('stopclock', { rng, config: this.config, used: {} });
    this.round = {
      practice: true,
      games: [this.makeStage(ROSTER_BY_KEY.get('stopclock'), clientData, secret)],
      gameIndex: 0,
    };
    this.startTutorial(
      { key: 'stopclock', gameName: 'Stop the Clock', practice: true },
      () => this.startGame(0)
    );
  }

  // Solo test: run any single game from the lobby, unscored, any player count
  // (host playtesting). Uses a throwaway content pool — the real session's
  // no-repeat pool is unaffected.
  startTest(key) {
    if (this.phase !== 'lobby') return { error: 'Games can only be tested from the lobby.' };
    const meta = ROSTER_BY_KEY.get(key);
    if (!meta) return { error: `Unknown game "${key}".` };
    if (this.players.size < 1) return { error: 'Need at least 1 player joined to test.' };
    this.testCounter += 1;
    const { clientData, secret } = buildGameData(key, {
      rng: seededRng(`${this.code}:test:${key}:${this.testCounter}`),
      config: this.config,
      used: {},
    });
    this.round = {
      practice: false,
      test: true,
      games: [this.makeStage(meta, clientData, secret)],
      gameIndex: 0,
      extras: {},
    };
    this.startTutorial({ key, gameName: meta.name, test: true }, () => this.startGame(0));
    return { ok: true };
  }

  // The "musical chairs" moment itself, solo: a full reaction round with
  // everyone present as participants. Unscored, nothing at stake.
  startRedemptionTest() {
    if (this.phase !== 'lobby') return { error: 'Finish the current game first.' };
    if (this.players.size < 1) return { error: 'Need at least 1 player joined to test.' };
    this.round = null;
    this.startTutorial(
      { key: 'chairs', gameName: 'Musical Chairs', test: true },
      () => this.startRedemption([...this.players.keys()], 'test')
    );
    return { ok: true };
  }

  backToLobby() {
    this.clearTimer('game');
    this.clearTimer('redemption');
    this.clearTimer('tutorial');
    this.round = null;
    this.reveal = null;
    this.redemption = null;
    this.chairs = null;
    this.tutorial = null;
    this.afterTutorial = null;
    this.setPhase('lobby', {});
    this.broadcastPlayers();
    return { ok: true };
  }

  gamePayload(g, duration) {
    const dur = duration ?? this.stageDuration(g);
    return {
      gameNumber: this.queueIndex + 1,
      key: g.key,
      gameName: g.name,
      gameType: g.type,
      category: g.category,
      clientData: g.clientData,
      duration: dur,
      deadline: g.deadline ?? Date.now() + dur,
      // Multi-stage games label themselves the way the chairs rounds do.
      stage: g.stage || 1,
      totalStages: g.totalStages || 1,
      // A stage that has a better name for itself than "stage 3 of 7".
      stageName: g.stageName || null,
      practice: !!this.round.practice,
      test: !!this.round.test,
    };
  }

  // A guessing stage is one tap — it does not need a whole minigame slot, and
  // a variable-length game runs one per player. Scaling off gameDuration (with
  // no absolute floor) keeps the host's duration knob meaningful and keeps the
  // bot harness able to run a whole session in seconds.
  stageDuration(g) {
    if (this.round?.practice) return Math.min(this.config.gameDuration, 30000);
    return Math.max(1, Math.round(this.config.gameDuration * (g.durationScale || 1)));
  }

  // Music plays (avatars circle the chairs on the host screen), then the
  // next event starts. The host can skip the music with Next.
  playMusicThen(data, fn) {
    const rng = seededRng(`${this.code}:music:${this.queueIndex}`);
    const musicMs = this.config.musicMs ?? 4000 + Math.floor(rng() * 3000);
    this.afterMusic = fn;
    this.setPhase('music', { duration: musicMs, ...data });
    this.setTimer('music', fn, musicMs);
  }

  nextGame() {
    if (this.queueIndex >= this.queue.length) return this.startChairsFinale();
    const key = this.queue[this.queueIndex];
    const meta = ROSTER_BY_KEY.get(key);
    const { clientData, secret } = buildGameData(key, {
      rng: seededRng(`${this.code}:g${this.queueIndex}:${key}`),
      config: this.config,
      used: this.usedContent || (this.usedContent = {}),
    });
    this.round = {
      practice: false,
      games: [this.makeStage(meta, clientData, secret)],
      gameIndex: 0,
      extras: {},
    };
    this.playMusicThen(
      { gameNames: [meta.name], gameNumber: this.queueIndex + 1 },
      () => this.startTutorial(
        { key, gameName: meta.name, gameNumber: this.queueIndex + 1 },
        () => this.startGame(0)
      )
    );
  }

  // Animated how-to screen (what to do / what to avoid) shown before every
  // game. Never advances on its own: the host's Next — or the solo player's
  // Play — starts the game. tutorialMs = 0 still disables tutorials entirely.
  startTutorial(info, fn) {
    if (!this.config.tutorialMs) return fn();
    this.afterTutorial = fn;
    this.tutorial = { ...info };
    this.setPhase('tutorial', { ...this.tutorial });
  }

  endTutorial() {
    this.clearTimer('tutorial');
    const fn = this.afterTutorial;
    this.afterTutorial = null;
    this.tutorial = null;
    fn?.();
  }

  skipTutorial() {
    if (this.phase !== 'tutorial') return { error: 'No tutorial to skip.' };
    this.endTutorial();
    return { ok: true };
  }

  // Solo practice has no host screen: the lone player drives the phases the
  // host's Next would drive. Deliberately narrow — it advances a tutorial or
  // a reveal, and nothing that could start or score a real session.
  soloAdvance() {
    if (this.phase === 'tutorial') return this.skipTutorial();
    if (this.phase === 'reveal') return this.advanceReveal();
    return { error: 'Nothing to advance.' };
  }

  startGame(idx) {
    const g = this.round.games[idx];
    if (!g) return;
    this.round.gameIndex = idx;
    const duration = this.stageDuration(g);
    g.deadline = Date.now() + duration;
    this.setPhase('minigame', this.gamePayload(g, duration));
    this.emitHost('host:progress', { submitted: 0, total: this.players.size });
    this.setTimer('game', () => this.closeGame(g.token), duration + this.config.closeGraceMs);
  }

  // Queue every stage that follows stage one — built out of what the room
  // submitted to stage one — and start the first of them. Returns true when
  // at least one actually started. A degenerate pool (nobody wrote anything,
  // or only one player did) has nothing to vote or guess on: the rest of the
  // game is skipped and stage one is scored as-is, so the room always reaches
  // a scores screen.
  startStages(g, entries) {
    let built = null;
    try {
      built = buildStages(g.key, entries, {
        rng: seededRng(`${this.code}:g${this.queueIndex}:${g.key}:stages`),
        clientData: g.clientData,
        players: this.playerOptions(),
        config: this.config,
      });
    } catch (err) {
      console.error(`room ${this.code} buildStages ${g.key}:`, err);
      return false;
    }
    if (!built || !built.length) return false;
    const meta = ROSTER_BY_KEY.get(g.key);
    const totalStages = built.length + 1;
    const firstIdx = this.round.games.length;
    // Stage one only learns how long its own game is once it has closed.
    g.totalStages = totalStages;
    built.forEach((s, i) => {
      this.round.games.push(this.makeStage(meta, s.clientData, s.secret, i + 2, {
        totalStages,
        stageName: s.stageName,
        reveal: s.reveal,
        durationScale: s.durationScale,
      }));
    });
    this.startGame(firstIdx);
    return true;
  }

  // Every stage of the game currently being played, oldest first, flattened
  // for the pure scoring code in games.js. Stops at the stage on screen: a
  // variable-length game queues all of its stages up front, and the ones
  // nobody has played yet must not be revealed or scored.
  stageHistory() {
    return (this.round?.games || []).slice(0, (this.round?.gameIndex ?? 0) + 1).map((g) => ({
      stage: g.stage || 1,
      clientData: g.clientData,
      secret: g.secret,
      entries: [...g.submissions.entries()].map(([playerId, payload]) => ({ playerId, payload })),
    }));
  }

  // A stage closed and this game stops here for a reveal: the room argues out
  // loud over who it was, the host presses Next to put the answer on the
  // projector, and Next again starts the next stage (or scores the game, if
  // that was the last one). Two host presses, one control — the same Next
  // that drives everything else. Returns false when there is no reveal to
  // show, and the caller carries on.
  betweenStages(g) {
    const nextIndex = this.round.gameIndex + 1;
    let built = null;
    try {
      built = buildReveal(g.key, this.stageHistory());
    } catch (err) {
      console.error(`room ${this.code} buildReveal ${g.key}:`, err);
    }
    if (!built) return false;
    const head = { key: g.key, gameName: g.name, stage: g.stage, totalStages: g.totalStages };
    this.reveal = {
      nextIndex,
      answered: false,
      // The answer is deliberately NOT in the teaser: this goes to every
      // device, and a player watching their own socket would have it before
      // the room does.
      teaser: { ...head, ...this.withNames(built.teaser), answered: false },
      answer: { ...head, ...this.withNames(built.answer), answered: true },
    };
    this.setPhase('reveal', this.revealPayload());
    return true;
  }

  revealPayload() {
    const r = this.reveal;
    if (!r) return {};
    return r.answered ? r.answer : r.teaser;
  }

  // Host (or the solo player) advancing the reveal: first press puts the
  // answer up, second press starts the next stage — or scores the game, when
  // the stage just revealed was its last.
  advanceReveal() {
    const r = this.reveal;
    if (!r) return { ok: true };
    if (!r.answered) {
      r.answered = true;
      this.setPhase('reveal', this.revealPayload());
      return { ok: true };
    }
    this.reveal = null;
    if (r.nextIndex < this.round.games.length) this.startGame(r.nextIndex);
    else this.finishGame(this.round.games[this.round.gameIndex]);
    return { ok: true };
  }

  // Authorship is server-side for the whole voting/guessing stage; names are
  // attached only once the game is over, or once the host has revealed the
  // answer, and the reveal is the point.
  withNames(extra) {
    if (!extra) return extra;
    const nameOf = (id) => (id ? (this.players.get(id)?.name || '?') : null);
    const out = { ...extra };
    if (Array.isArray(extra.board)) {
      out.board = extra.board.map((row) => ({ ...row, name: nameOf(row.playerId) || '?' }));
    }
    // Icebreaker: one row per fact, plus the shape of the room's argument.
    if (Array.isArray(extra.rounds)) {
      out.rounds = extra.rounds.map((row) => ({ ...row, name: nameOf(row.playerId) }));
    }
    if (Array.isArray(extra.tally)) {
      out.tally = extra.tally.map((row) => ({ ...row, name: nameOf(row.playerId) || '?' }));
    }
    if (Array.isArray(extra.guesses)) {
      out.guesses = extra.guesses.map((row) => ({
        ...row,
        name: nameOf(row.playerId) || '?',
        pickedName: nameOf(row.pickedId) || '?',
      }));
    }
    // Not `name`: a phase payload's own `name` is the phase, and this object
    // is spread straight into one.
    if ('playerId' in extra) out.authorName = nameOf(extra.playerId);
    return out;
  }

  // Host moderation for pooled player text. The host screen is projected in a
  // work meeting and there is no undo on a room full of people reading
  // something — pulling an entry removes it from every screen immediately and
  // voids every vote cast for it.
  hideEntry(entryId) {
    if (this.phase !== 'minigame') return { error: 'Nothing on screen to hide.' };
    const g = this.round?.games[this.round.gameIndex];
    const id = String(entryId || '');
    // A pooled stage (Caption Battle) shows many entries at once.
    if (Array.isArray(g?.clientData?.entries)) {
      if (!g.clientData.entries.some((e) => e.id === id)) return { error: 'Unknown entry.' };
      const hidden = new Set(g.clientData.hidden || []);
      hidden.add(id);
      // Note: votesPerPlayer deliberately does NOT shrink — ballots already
      // cast stay valid, and the hidden entry is dropped at aggregation.
      g.clientData = { ...g.clientData, hidden: [...hidden] };
      this.emitAll('game:data', { key: g.key, stage: g.stage || 1, clientData: g.clientData });
      return { ok: true, hidden: g.clientData.hidden };
    }
    // A single-entry stage (Icebreaker projects one fun fact at a time). The
    // text is dropped from the payload outright — nothing downstream, on any
    // screen or in the reveal, can render what it no longer has.
    if (g?.clientData?.factId) {
      if (g.clientData.factId !== id) return { error: 'Unknown entry.' };
      g.clientData = { ...g.clientData, hidden: true, text: '' };
      this.emitAll('game:data', { key: g.key, stage: g.stage || 1, clientData: g.clientData });
      return { ok: true, hidden: true };
    }
    return { error: 'This game has no pooled entries.' };
  }

  handleSubmit(playerId, payload) {
    if (this.phase !== 'minigame') return;
    const p = this.players.get(playerId);
    if (!p) return;
    const g = this.round.games[this.round.gameIndex];
    if (!g || g.submissions.has(playerId)) return;
    g.submissions.set(playerId, payload ?? {});
    if (!NEEDS_AGGREGATION.has(g.key)) {
      const metric = computeMetric(g.key, payload, g.secret, g.clientData, this.config);
      if (metric != null) g.metrics.set(playerId, metric);
    }
    const total = this.players.size;
    const submitted = g.submissions.size;
    // Progress count only — never live scores.
    this.emitAll('host:progress', { submitted, total });
    this.emitPlayer(playerId, 'submit:ack', { gameIndex: this.round.gameIndex });
    if (submitted >= total) this.closeGame(g.token);
  }

  closeGame(token) {
    const g = this.round?.games[this.round.gameIndex];
    if (!g || g.token !== token || g.closed) return;
    g.closed = true;
    this.clearTimer('game');
    const entries = [...g.submissions.entries()].map(([playerId, payload]) => ({ playerId, payload }));

    if (MULTI_STAGE.has(g.key)) {
      // Stage one: don't score — build the stages that follow out of the pool
      // of stage-one submissions and re-enter `minigame` with a fresh token, a
      // fresh submissions map and its own deadline.
      if (g.stage === 1 && this.startStages(g, entries)) return;
      // A stage that stops for a reveal does so on the LAST one too: the room
      // gets its answer out loud before anything is scored.
      if (g.reveal && this.betweenStages(g)) return;
      // Otherwise straight on to the next stage. Nothing is scored until the
      // last stage of the game closes.
      if (this.round.gameIndex < this.round.games.length - 1) {
        return this.startGame(this.round.gameIndex + 1);
      }
    }
    this.finishGame(g);
  }

  // The last stage of a game has closed (and been revealed): aggregate what
  // the room did across every stage of it, then score — or, for a practice or
  // test run, just show what happened.
  finishGame(g) {
    const entries = [...g.submissions.entries()].map(([playerId, payload]) => ({ playerId, payload }));
    if (NEEDS_AGGREGATION.has(g.key)) {
      const { metrics, extra } = aggregateGame(g.key, entries, {
        clientData: g.clientData,
        secret: g.secret,
        stages: this.stageHistory(),
      });
      g.metrics = metrics;
      if (this.round.extras) this.round.extras[g.key] = this.withNames(extra);
    }
    if (this.round.test) {
      // Raw metric per player, no normalization — solo results would all
      // normalize to the same score anyway.
      const results = [...this.players.values()]
        .filter((p) => g.submissions.has(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          raw: formatRaw(g.key, g.metrics.get(p.id) ?? null, g.submissions.get(p.id)),
          metric: g.metrics.get(p.id) ?? null,
        }));
      this.setPhase('test_done', {
        key: g.key,
        gameName: g.name,
        results,
        total: this.players.size,
        extras: this.round.extras,
      });
      return;
    }
    if (this.round.practice) {
      this.setPhase('practice_done', { submitted: g.submissions.size, total: this.players.size });
      return;
    }
    this.scoreGame(g);
  }

  // Normalize this game 0–1000 across the players who played it, add to the
  // running totals, and show everyone where they stand. Non-submitters get 0.
  scoreGame(g) {
    const players = [...this.players.values()];
    const submitters = players.filter((p) => g.metrics.has(p.id));
    const values = submitters.map((p) => g.metrics.get(p.id));
    const normalized = values.length
      ? (g.type === 'error' ? normalizeError(values) : normalizeScore(values))
      : [];
    const points = new Map();
    submitters.forEach((p, i) => points.set(p.id, normalized[i]));
    for (const p of players) {
      if (!points.has(p.id)) points.set(p.id, 0);
      this.totals.set(p.id, (this.totals.get(p.id) || 0) + points.get(p.id));
    }
    const rows = players
      .map((p) => ({
        id: p.id,
        name: p.name,
        raw: formatRaw(g.key, g.metrics.get(p.id) ?? null, g.submissions.get(p.id)),
        points: Math.round(points.get(p.id)),
        total: Math.round(this.totals.get(p.id)),
      }))
      .sort((a, b) => b.total - a.total)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    this.lastScores = rows;
    this.queueIndex++;
    this.setPhase('scores', {
      key: g.key,
      gameName: g.name,
      gameNumber: this.queueIndex,       // the game just finished
      leaderboard: rows,
      nextIsChairs: this.queueIndex >= this.queue.length,
      extras: this.round.extras,
    });
    for (const r of rows) {
      this.emitPlayer(r.id, 'you:score', {
        gameName: g.name, raw: r.raw, points: r.points, total: r.total,
        rank: r.rank, of: rows.length,
      });
    }
    this.broadcastPlayers();
    // Host advances from scores (host:next) → next game / chairs finale.
  }

  // ---- musical chairs finale (bonus elimination tournament) ----------------
  //
  // (players − 1) reaction rounds. Every round: chairs = players in the round
  // minus one, the slowest reaction is eliminated, everyone else keeps a
  // chair. The last player standing wins the tournament, and everyone banks
  // 3× bonus points by final placement (1st = 3000 … last = 0).

  startChairsFinale() {
    this.round = null;
    const ids = [...this.players.keys()];
    this.chairs = {
      active: ids,              // still holding a chair
      eliminated: [],           // elimination order: first out first
      totalRounds: Math.max(1, ids.length - 1),
      round: 0,
    };
    this.playMusicThen(
      { gameNames: ['Musical Chairs'], gameNumber: this.queue.length + 1, chairs: true },
      () => this.startTutorial(
        { key: 'chairs', gameName: 'Musical Chairs', chairs: true },
        () => this.startChairsRound()
      )
    );
  }

  startChairsRound() {
    if (!this.chairs) return;
    this.chairs.round += 1;
    this.startRedemption(this.chairs.active, 'chairs');
  }

  startRedemption(participantIds, mode) {
    const c = this.config;
    this.redemption = {
      participants: participantIds,
      mode,
      reports: new Map(),
      tGreen: null,
      startedAt: Date.now(),
    };
    const names = participantIds.map((id) => this.players.get(id)?.name || '?');
    const chairsInfo = mode === 'chairs' && this.chairs ? {
      round: this.chairs.round,
      totalRounds: this.chairs.totalRounds,
      chairCount: Math.max(1, participantIds.length - 1),
      bonus: true,
      outNames: this.chairs.eliminated.map((id) => this.players.get(id)?.name || '?'),
    } : {};
    this.setPhase('redemption', {
      participants: participantIds,
      participantNames: names,
      mode,
      scored: mode === 'chairs',
      prepMs: c.redemptionPrepMs,
      ...chairsInfo,
    });
    // Give clients a resync window, then broadcast the absolute server-time
    // T_green a couple of seconds ahead.
    this.setTimer('redemption', () => {
      if (!this.redemption) return;
      const tGreen = Date.now() + c.redemptionLeadMs;
      this.redemption.tGreen = tGreen;
      this.emitAll('redemption:go', {
        tGreen,
        participants: participantIds,
        minDelay: c.minDelay,
        maxDelay: c.maxDelay,
        postGreenTimeout: c.postGreenTimeout,
        hardTimeout: c.hardTimeout,
      });
      this.setTimer('redemption', () => this.finishRedemption(),
        c.redemptionLeadMs + c.hardTimeout + 5000);
    }, c.redemptionPrepMs);
  }

  handleRedemptionReport(playerId, report) {
    const red = this.redemption;
    if (!red || !red.tGreen) return;
    if (!red.participants.includes(playerId) || red.reports.has(playerId)) return;
    const scored = scoreRedemptionReport(report, { earlyPressPenalty: this.config.earlyPressPenalty });
    // Server-side sanity: a clean (no-early-press) report should arrive
    // roughly rtt after T_green + reportedTime. Flag, don't crash.
    const p = this.players.get(playerId);
    if (scored.status === 'ok' && scored.earlyPresses === 0) {
      const rtt = p?.sync?.minRtt ?? 200;
      const expected = red.tGreen + scored.rawMs + rtt + 1500;
      if (Date.now() > expected + 1000) scored.flagged = true;
    }
    red.reports.set(playerId, scored);
    this.emitAll('redemption:progress', { reported: red.reports.size, total: red.participants.length });
    if (red.reports.size >= red.participants.length) this.finishRedemption();
  }

  finishRedemption() {
    const red = this.redemption;
    if (!red) return;
    this.redemption = null;
    this.clearTimer('redemption');
    const results = red.participants.map((id, i) => {
      const scored = red.reports.get(id) ||
        { finalMs: 999999, rawMs: null, earlyPresses: 0, status: 'noReport', flagged: false };
      return { id, name: this.players.get(id)?.name || '?', order: i, ...scored };
    });
    results.sort((a, b) => a.finalMs - b.finalMs || a.order - b.order);

    if (red.mode === 'test') {
      // Solo/test run: show reaction results, nothing at stake.
      this.setPhase('redemption_test_done', {
        results: results.map((r) => ({
          id: r.id, name: r.name, status: r.status, rawMs: r.rawMs,
          earlyPresses: r.earlyPresses, finalMs: Math.round(r.finalMs), flagged: r.flagged,
        })),
      });
      return;
    }

    // Tournament round: the slowest player loses their chair; everyone else
    // is seated and survives to the next round.
    if (red.mode !== 'chairs' || !this.chairs) return;
    const roundResults = results.map((r) => ({
      id: r.id, name: r.name, status: r.status,
      rawMs: r.rawMs != null ? Math.round(r.rawMs) : null,
      finalMs: Math.round(r.finalMs),
      earlyPresses: r.earlyPresses, flagged: r.flagged,
    }));
    const out = results[results.length - 1];
    this.chairs.active = this.chairs.active.filter((id) => id !== out.id);
    this.chairs.eliminated.push(out.id);
    this.setPhase('chairs_result', {
      round: this.chairs.round,
      totalRounds: this.chairs.totalRounds,
      final: this.chairs.active.length <= 1,
      results: roundResults,                                    // fastest → slowest
      survivors: roundResults.slice(0, -1).map(({ id, name }) => ({ id, name })),
      eliminated: { id: out.id, name: out.name, place: this.chairs.active.length + 1 },
    });
    // Host advances (host:next) → next round, or bonus scoring + winner.
  }

  // Bonus scoring: 3× points by final tournament placement. Linear like a
  // normal game's 0–1000 spread, tripled: 1st = 3000, last = 0.
  scoreChairsTournament() {
    const ch = this.chairs;
    if (!ch) return this.declareWinner();
    this.chairs = null;
    const ordinal = (n) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
    };
    // Placement order: last survivor first, then eliminated in reverse order.
    const order = [...ch.active, ...[...ch.eliminated].reverse()];
    const n = order.length;
    const chairsBoard = order.map((id, i) => {
      const place = i + 1;
      const points = n > 1 ? Math.round((3000 * (n - place)) / (n - 1)) : 3000;
      this.totals.set(id, (this.totals.get(id) || 0) + points);
      return {
        place, id,
        name: this.players.get(id)?.name || '?',
        points,
        total: Math.round(this.totals.get(id) || 0),
      };
    });
    for (const r of chairsBoard) {
      this.emitPlayer(r.id, 'you:score', {
        gameName: 'Musical Chairs',
        raw: `${ordinal(r.place)} place`,
        points: r.points, total: r.total,
        rank: r.place, of: n,
      });
    }
    this.broadcastPlayers();
    this.declareWinner(chairsBoard);
  }

  // ---- winner --------------------------------------------------------------

  declareWinner(chairsBoard = null) {
    const standings = [...this.players.values()]
      .map((p) => ({ id: p.id, name: p.name, total: Math.round(this.totals.get(p.id) || 0) }))
      .sort((a, b) => b.total - a.total)
      .map((s, i) => ({ place: i + 1, ...s }));
    this.winnerId = standings[0]?.id || null;
    this.finalStandings = standings;
    this.setPhase('winner', {
      winnerId: this.winnerId,
      winnerName: standings[0]?.name || '?',
      standings,
      chairsBoard,
    });
    this.broadcastPlayers();
  }

  // Rematch: same lobby, fresh session state.
  reset() {
    this.clearTimer('game'); this.clearTimer('music'); this.clearTimer('redemption'); this.clearTimer('tutorial');
    this.tutorial = null;
    this.afterTutorial = null;
    this.phase = 'lobby';
    this.queue = [];
    this.queueIndex = 0;
    this.totals = new Map();
    this.usedContent = {};
    this.round = null;
    this.reveal = null;
    this.lastScores = null;
    this.redemption = null;
    this.chairs = null;
    this.afterMusic = null;
    this.winnerId = null;
    this.finalStandings = null;
    for (const [id, p] of this.players) if (!p.connected) this.players.delete(id);
    this.setPhase('lobby', {});
    this.broadcastPlayers();
  }

  // Host "next" — the single advance control. Also acts as a skip for any
  // phase that could stall (dead client mid-game, etc).
  hostNext() {
    switch (this.phase) {
      case 'lobby': return this.start();
      case 'test_done':
      case 'redemption_test_done':
        return this.backToLobby();
      case 'practice_done': this.nextGame(); return { ok: true };
      case 'minigame': {
        const g = this.round?.games[this.round.gameIndex];
        if (g) this.closeGame(g.token);
        return { ok: true };
      }
      case 'music': {
        this.clearTimer('music');
        const fn = this.afterMusic;
        this.afterMusic = null;
        fn?.();
        return { ok: true };
      }
      case 'tutorial':
        this.endTutorial();
        return { ok: true };
      case 'reveal':
        return this.advanceReveal();
      case 'scores':
        this.nextGame();
        return { ok: true };
      case 'redemption':
        this.finishRedemption();
        return { ok: true };
      case 'chairs_result':
        if (this.chairs && this.chairs.active.length > 1) this.startChairsRound();
        else this.scoreChairsTournament();
        return { ok: true };
      case 'winner':
        this.reset();
        return { ok: true };
      default:
        return { ok: true };
    }
  }
}
