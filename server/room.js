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
  COMPLETION_MODE,
  buildGameData,
  buildStages,
  buildReveal,
  computeMetric,
  aggregateGame,
  formatRaw,
} from './games.js';

// Games whose per-turn correct answer is a server secret (never in the
// broadcast clientData), so the client must ask the server for its own turn
// answer to show per-turn feedback (issue #48). The secret is stored on the
// game stage as `secret.answers` (one entry per turn/round).
const PER_TURN_SECRET = new Set(['anagram']);

// Temporary competitive-integrity mitigation (Strix pentest 2026-08-22/23):
// these games submit client-computed summary metrics that the server only
// sanity-clamps, so hosted competitive sessions must not queue them until
// scoring is recomputed server-side from authoritative interaction data.
// Solo practice and the lobby's unscored solo test run stay available.
const COMPETITIVE_CLIENT_SCORING_DISABLED = new Set([
  'trace', 'stopclock', 'slingshot', 'balance',
  'oddoneout', 'typing', 'spacemash',
  'cups',
]);

// Whether a game may be queued in a competitive session. Solo rooms and a
// test-only server/constructor opt-in (never settable from a client payload)
// are exempt; everything else must not expose client-trusted scoring.
function clientScoredGameAllowed(room, key) {
  return room.solo || room.allowClientScoredCompetitive || !COMPETITIVE_CLIENT_SCORING_DISABLED.has(key);
}

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
  // Completion-mode games (cups) have no shared deadline — the room closes when
  // everyone has submitted, or the host advances. This long backstop is the
  // last resort so one non-submitter can never hang the room forever. The bot
  // harness and tests override it to a tiny value to close deterministically.
  completionSafetyMs: 15 * 60 * 1000,
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
  c.completionSafetyMs = numIn(raw.completionSafetyMs, 1, 60 * 60 * 1000, DEFAULTS.completionSafetyMs);
  c.enabled = {};
  for (const g of ROSTER) {
    c.enabled[g.key] = raw.enabled && raw.enabled[g.key] != null
      ? !!raw.enabled[g.key]
      : g.defaultEnabled !== false;
  }
  return c;
}

// The complete set of config keys the host screen may change from the lobby.
// `updateConfig` drops everything else, so a control that reappears in the
// lobby UI has no server to talk to. Growing this list is a deliberate act:
// scripts/check.mjs asserts it against the controls in public/host.html, and
// both have to change together.
export const HOST_EDITABLE_CONFIG = new Set(['gameDuration', 'enabled']);

export function pickHostEditableConfig(raw = {}) {
  const patch = {};
  for (const [key, value] of Object.entries(raw || {})) {
    if (HOST_EDITABLE_CONFIG.has(key)) patch[key] = value;
  }
  return patch;
}

// One-shot mid-game deadline extension (issue #55). A live host ACTION, not a
// lobby config key — deliberately kept OUT of HOST_EDITABLE_CONFIG so it
// bypasses the lobby config allowlist. Fixed increment so a host cannot use it
// to tilt scoring toward specific players.
export const EXTEND_MS = 15000;

function newReconnectToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function reconnectTokenMatches(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class Room {
  constructor(io, code, config, onEmpty = () => {}, options = {}) {
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
    this.round = null;        // current single-game round (also a solo test run)
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
    // Test-harness opt-in that re-enables client-scored games in competitive
    // sessions. Server/constructor-sourced only — no client payload can set
    // it, so a remote participant cannot un-block the vulnerable games.
    this.allowClientScoredCompetitive = !!options.allowClientScoredCompetitive;
    this.sessionStartedAt = null; // when the competitive queue began (finale gate)
    this.soloOwnerId = null;      // the single player allowed in a solo room
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

  // The answered reveal is sent per player with only that player's own
  // `guesses[]` row, never the full array (Strix 2026-08-23, CVSS 4.3: a
  // normal participant must not read other players' picks and scores). The
  // host room (`host:CODE`) still gets the full view — the projector is the
  // whole point of the reveal. The teaser has no guesses and is safe to fan
  // out as-is.
  emitReveal(payload) {
    const progress = this.progressInfo();
    if (!payload || payload.answered !== true || !Array.isArray(payload.guesses)) {
      this.emitAll('phase', { ...payload, name: 'reveal', progress });
      return;
    }
    for (const p of this.players.values()) {
      if (!p.socketId) continue;
      const guesses = payload.guesses.filter((row) => row.playerId === p.id);
      this.io.to(p.socketId).emit('phase', { ...payload, guesses, name: 'reveal', progress });
    }
    // The host projector keeps the complete reveal (tally + all rows).
    this.emitHost('phase', { ...payload, name: 'reveal', progress });
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

  playersForSocket(socketId) {
    if (!socketId) return [];
    return [...this.players.values()].filter((p) => p.socketId === socketId);
  }

  scheduleLobbyKick(playerId) {
    if (this.phase !== 'lobby') return;
    this.setTimer(`kick:${playerId}`, () => {
      const p = this.players.get(playerId);
      if (this.phase === 'lobby' && p && !p.connected && !p.socketId) {
        this.players.delete(playerId);
        this.broadcastPlayers();
      }
    }, 60000);
  }

  disconnectPlayer(playerId, at = Date.now()) {
    const p = this.players.get(playerId);
    if (!p) return false;
    this.clearTimer(`kick:${playerId}`);
    const changed = p.connected || p.disconnectedAt == null || p.socketId != null;
    p.connected = false;
    p.socketId = null;
    p.disconnectedAt = at;
    this.scheduleLobbyKick(playerId);
    return changed;
  }

  disconnectSocketPlayers(socketId, keepPlayerId = null) {
    let changed = false;
    const at = Date.now();
    for (const p of this.playersForSocket(socketId)) {
      if (p.id === keepPlayerId) continue;
      changed = this.disconnectPlayer(p.id, at) || changed;
    }
    return changed;
  }

  // ---- join / reconnect ---------------------------------------------------

  join(socket, { name, playerId, reconnectToken }) {
    const socketPlayers = this.playersForSocket(socket.id);
    if (playerId && this.players.has(playerId)) {
      if (socketPlayers.length && !socketPlayers.some((p) => p.id === playerId)) {
        return { error: 'This connection is already bound to another player.' };
      }
      const p = this.players.get(playerId);
      if (!reconnectTokenMatches(p.reconnectToken, reconnectToken)) {
        return { error: 'Reconnect credential is invalid or expired.' };
      }
      // Keep the room-lifetime credential stable so a lost reconnect ACK can
      // be retried safely. The public player ID remains suitable for roster
      // and score references, never proof of identity on its own.
      const previousSocketId = p.socketId;
      if (previousSocketId && previousSocketId !== socket.id) {
        this.disconnectSocketPlayers(previousSocketId, p.id);
      }
      this.disconnectSocketPlayers(socket.id, p.id);
      p.socketId = socket.id;
      p.connected = true;
      p.disconnectedAt = null;
      // Evict the previous socket from this room's trust boundary. The old
      // transport may still be alive (Socket.IO reconnects), so it must not
      // retain room state after the identity moves.
      if (previousSocketId && previousSocketId !== socket.id) {
        const previous = this.io.sockets?.sockets?.get(previousSocketId);
        if (previous) {
          previous.data.roomCode = null;
          previous.data.playerId = null;
          previous.leave?.(`room:${this.code}`);
        }
      }
      this.clearTimer(`kick:${p.id}`);
      socket.join(`room:${this.code}`);
      socket.data.roomCode = this.code;
      socket.data.playerId = p.id;
      this.broadcastPlayers();
      return {
        ok: true,
        playerId: p.id,
        reconnectToken: p.reconnectToken,
        name: p.name,
        snapshot: this.snapshot(p.id),
      };
    }
    if (socketPlayers.length) {
      const p = socketPlayers.find((candidate) => candidate.id === socket.data.playerId) || socketPlayers[0];
      this.disconnectSocketPlayers(socket.id, p.id);
      this.clearTimer(`kick:${p.id}`);
      p.socketId = socket.id;
      p.connected = true;
      p.disconnectedAt = null;
      socket.join(`room:${this.code}`);
      socket.data.roomCode = this.code;
      socket.data.playerId = p.id;
      this.broadcastPlayers();
      return {
        ok: true,
        playerId: p.id,
        reconnectToken: p.reconnectToken,
        name: p.name,
        snapshot: this.snapshot(p.id),
      };
    }
    if (this.solo && this.soloOwnerId && this.players.size > 0) {
      // Solo practice rooms are single-occupant. A second user who knows the
      // room code must not be able to join or reset the owner's session
      // (Strix re-scan 2026-08-23: solo-room takeover).
      return { error: 'Solo rooms are private to their owner.' };
    }
    if (this.phase !== 'lobby' && this.phase !== 'minigame') {
      // Fresh players may join during the lobby or an active minigame (the
      // issue #54 late-join feature: they score 0 for missed games and play
      // the rest). Joining once the queue is exhausted — scores, the chairs
      // finale, redemption, or the winner reveal — would let a stranger sit
      // into the finale and change the outcome (Strix re-scan 2026-08-23).
      return { error: 'Room is no longer accepting new players.' };
    }
    if (this.phase === 'minigame' && this.queueIndex >= this.queue.length - 1) {
      // The last queued competitive minigame is the finale's door: joining
      // here would put a fresh entrant straight into the musical-chairs
      // finale without playing the regular games (Strix 2026-08-23, HIGH).
      return { error: 'Room is no longer accepting new players.' };
    }
    if (this.players.size >= 30) return { error: 'Room is full (30 players max).' };
    let cleanName = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 20) || 'Player';
    const names = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    let finalName = cleanName;
    let i = 2;
    while (names.has(finalName.toLowerCase())) finalName = `${cleanName} ${i++}`;
    const p = {
      id: crypto.randomUUID(),
      reconnectToken: newReconnectToken(),
      name: finalName,
      socketId: socket.id,
      connected: true,
      disconnectedAt: null,
      sync: null,
      joinedAt: Date.now(),
    };
    this.players.set(p.id, p);
    // Late join (issue #54): a player admitted after the lobby is a full
    // player, not a spectator. Seed a 0 total so scoreGame/leaderboard show
    // an explicit zero row for the games they missed (each missed game
    // already scores 0 for non-submitters, so cumulative back-fill is 0).
    if (this.phase !== 'lobby') this.totals.set(p.id, 0);
    socket.join(`room:${this.code}`);
    socket.data.roomCode = this.code;
    socket.data.playerId = p.id;
    this.broadcastPlayers();
    return {
      ok: true,
      playerId: p.id,
      reconnectToken: p.reconnectToken,
      name: p.name,
      snapshot: this.snapshot(p.id),
    };
  }

  handleDisconnect(socket) {
    if (socket.id === this.hostSocketId) this.hostSocketId = null;
    const changed = this.disconnectSocketPlayers(socket.id);
    if (changed) this.broadcastPlayers();
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
    if (this.phase === 'minigame' && this.round) {
      const g = this.round.games[this.round.gameIndex];
      if (g && p && !g.submissions.has(p.id)) {
        snap.game = this.gamePayload(g);
      }
    }
    if (this.phase === 'scores' && this.lastScores) {
      snap.scores = this.lastScores;
    }
    if (this.phase === 'reveal' && this.reveal) {
      // Host snapshots (playerId=null) keep the full projector reveal; player
      // reconnect snapshots contain only that player's own guesses[] row.
      snap.reveal = this.revealPayload(playerId);
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
    const roster = ROSTER
      .filter(({ key }) => clientScoredGameAllowed(this, key))
      .map(({ key, name, category, stages, defaultEnabled }) =>
        ({ key, name, category, stages: stages || 1, defaultEnabled: defaultEnabled !== false }));
    const publicEnabled = Object.fromEntries(
      Object.entries(enabled).map(([key, on]) => [key, clientScoredGameAllowed(this, key) ? on : false]));
    return { gameDuration, minDelay, maxDelay, enabled: publicEnabled, roster };
  }

  updateConfig(raw) {
    if (this.phase !== 'lobby') return { error: 'Config can only change in the lobby.' };
    // Anything outside the allowlist is dropped rather than rejected: a stale
    // host tab pushing a knob that no longer exists should not fail the whole
    // patch, and a hand-crafted socket payload should not be able to reach an
    // internal default.
    const patch = pickHostEditableConfig(raw);
    this.config = sanitizeConfig({ ...this.config, ...patch, enabled: { ...this.config.enabled, ...(patch.enabled || {}) } });
    // A crafted host payload cannot re-enable client-scored games in a
    // competitive session — the block is enforced after every config patch.
    if (!clientScoredGameAllowed(this, 'trace')) {
      for (const key of COMPETITIVE_CLIENT_SCORING_DISABLED) this.config.enabled[key] = false;
    }
    this.emitAll('room:config', this.publicConfig());
    return { ok: true };
  }

  // ---- game flow ----------------------------------------------------------

  start() {
    if (this.phase !== 'lobby') return { error: 'Already started.' };
    if (this.players.size < 2) return { error: 'Need at least 2 players.' };
    const enabledKeys = ROSTER
      .filter((g) => this.config.enabled[g.key] && clientScoredGameAllowed(this, g.key))
      .map((g) => g.key);
    if (!enabledKeys.length) return { error: 'Enable at least one game.' };
    // K-of-N draw: seeded shuffle first, then take the first K. Which games a
    // session plays is as random as their order, and 0 still means "all".
    const drawn = shuffle(seededRng(`${this.code}:queue`), enabledKeys);
    const k = this.config.gamesPerSession;
    this.queue = k > 0 && k < drawn.length ? drawn.slice(0, k) : drawn;
    this.queueIndex = 0;
    this.totals = new Map([...this.players.keys()].map((id) => [id, 0]));
    // The finale gate needs the moment the competitive queue began: anyone who
    // joins later is a mid-session entrant, not a finale participant.
    this.sessionStartedAt = Date.now();
    // Straight into game one: there is no practice round. Anyone who wants to
    // shake a game out before the session runs it from the lobby's solo test.
    this.nextGame();
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
      // Per-player per-turn feedback state for server-secret games (issue #48):
      // { next: cursor, locked: Map<index, word> }. A turn's answer is revealed
      // only once the player has locked their own answer for it, and the locked
      // answers — not a re-submittable final payload — are what get scored, so
      // learning an answer via the reveal is useless for inflating a score.
      reveals: new Map(),
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
      // Completion-mode games (cups) run to completion, not to a deadline: the
      // client ignores the countdown/auto-submit and submits when the player
      // finishes all levels. `duration`/`deadline` stay in the payload for
      // shape compatibility but are not counted down.
      completion: COMPLETION_MODE.has(g.key),
      // Multi-stage games label themselves the way the chairs rounds do.
      stage: g.stage || 1,
      totalStages: g.totalStages || 1,
      // A stage that has a better name for itself than "stage 3 of 7".
      stageName: g.stageName || null,
      test: !!this.round.test,
    };
  }

  // A guessing stage is one tap — it does not need a whole minigame slot, and
  // a variable-length game runs one per player. Scaling off gameDuration (with
  // no absolute floor) keeps the host's duration knob meaningful and keeps the
  // bot harness able to run a whole session in seconds.
  stageDuration(g) {
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
      queueIndex: this.queueIndex,
    });
    this.round = {
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
    g.duration = duration;
    g.extended = false;
    this.setPhase('minigame', this.gamePayload(g, duration));
    this.emitHost('host:progress', { submitted: 0, total: this.players.size });
    if (COMPLETION_MODE.has(g.key)) {
      // No shared deadline: the room closes on all-submit (handleSubmit) or a
      // host advance (hostNext → closeGame). The only timer is a long safety
      // backstop so a stalled/disconnected non-submitter can't hang the room.
      this.setTimer('game', () => this.closeGame(g.token), this.config.completionSafetyMs);
    } else {
      this.setTimer('game', () => this.closeGame(g.token), duration + this.config.closeGraceMs);
    }
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
    // Teaser first (no guesses). The answered reveal is per-player via
    // emitReveal so nobody sees another player's guesses[] row.
    this.setPhase('reveal', this.revealPayload());
    return true;
  }

  revealPayload(playerId = null) {
    const r = this.reveal;
    if (!r) return {};
    const payload = r.answered ? r.answer : r.teaser;
    if (!r.answered || !Array.isArray(payload.guesses) || !playerId) return payload;
    return { ...payload, guesses: payload.guesses.filter((row) => row.playerId === playerId) };
  }

  // Host (or the solo player) advancing the reveal: first press puts the
  // answer up, second press starts the next stage — or scores the game, when
  // the stage just revealed was its last.
  advanceReveal() {
    const r = this.reveal;
    if (!r) return { ok: true };
    if (!r.answered) {
      r.answered = true;
      this.emitReveal(this.revealPayload());
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

  // Host action (issue #55): end the current timed game immediately, taking the
  // EXACT same path a natural deadline would — closeGame(token) — so scoring,
  // non-submitters scoring 0, and multi-stage progression are all identical.
  // Host-only + active-game authorization is enforced by the caller (sockets.js).
  // Completion-mode games (cups) are skippable too — closeGame handles their
  // safety-timer close — the host UI simply hides the button for them by choice.
  skipGame() {
    if (this.phase !== 'minigame' || !this.round) return { error: 'No active game to skip.' };
    const g = this.round.games[this.round.gameIndex];
    if (!g || g.closed) return { error: 'No active game to skip.' };
    this.closeGame(g.token);
    return { ok: true };
  }

  // Host action (issue #55): add a fixed increment to the CURRENT game's shared
  // deadline, once, and re-broadcast ONE synced deadline to every client so all
  // countdowns move together. Not a per-client nudge and not a config change:
  // only the shared deadline, the derived duration, and the server close timer
  // move. Completion-mode games have no shared deadline and are rejected.
  extendTimer() {
    if (this.phase !== 'minigame' || !this.round) return { error: 'No active game to extend.' };
    const g = this.round.games[this.round.gameIndex];
    if (!g || g.closed) return { error: 'No active game to extend.' };
    if (COMPLETION_MODE.has(g.key)) return { error: 'This game has no timer to extend.' };
    if (g.extended) return { error: 'Timer already extended.' };
    g.extended = true;
    g.deadline += EXTEND_MS;
    g.duration += EXTEND_MS;   // always numeric: startGame set it before minigame phase
    // Reschedule the single server close timer to the new deadline.
    this.setTimer('game', () => this.closeGame(g.token), Math.max(0, g.deadline - Date.now()) + this.config.closeGraceMs);
    // One synced re-broadcast: identical deadline/duration for every client.
    this.emitAll('game:extend', { key: g.key, stage: g.stage || 1, deadline: g.deadline, duration: g.duration });
    return { ok: true, deadline: g.deadline, duration: g.duration };
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
      // For a server-secret game, score the answers the player LOCKED before
      // each reveal, not a re-submittable final payload — so a client that used
      // reveals to peek at answers cannot then claim turns it locked blank.
      let scoringPayload = payload;
      if (PER_TURN_SECRET.has(g.key)) {
        const locked = this.lockedSolved(g, playerId);
        if (locked) scoringPayload = { ...(payload && typeof payload === 'object' ? payload : {}), solved: locked };
      }
      const metric = computeMetric(g.key, scoringPayload, g.secret, g.clientData, this.config);
      if (metric != null) g.metrics.set(playerId, metric);
    }
    const total = this.players.size;
    const submitted = g.submissions.size;
    // Progress count only — never live scores.
    this.emitAll('host:progress', { submitted, total });
    this.emitPlayer(playerId, 'submit:ack', { gameIndex: this.round.gameIndex });
    if (submitted >= total) this.closeGame(g.token);
  }

  // Server-authoritative per-turn feedback (issue #48). Returns ONLY the
  // requesting player's own current-game turn answer, and only for games whose
  // answer is a server secret. Every input is validated: an unknown player, a
  // non-secret game, a wrong phase, or a bad/out-of-range index yields an error
  // object, never a crash and never another player's data.
  revealTurn(playerId, index, word) {
    if (!this.players.has(playerId)) return { error: 'Not in this room.' };
    if (this.phase !== 'minigame' || !this.round) return { error: 'No active turn.' };
    const g = this.round.games[this.round.gameIndex];
    if (!g || !PER_TURN_SECRET.has(g.key)) return { error: 'No per-turn reveal for this game.' };
    const answers = g.secret && Array.isArray(g.secret.answers) ? g.secret.answers : null;
    if (!answers) return { error: 'No answer available.' };
    // Require a real integer — no string/null coercion — so a hostile client
    // cannot smuggle a non-index value that happens to coerce into range.
    if (!Number.isInteger(index) || index < 0 || index >= answers.length) return { error: 'Bad turn index.' };
    let st = g.reveals.get(playerId);
    if (!st) { st = { next: 0, locked: new Map() }; g.reveals.set(playerId, st); }
    // Forward-only: a player may reveal the turn they have reached, never a
    // future one. This blocks enumerating the whole hidden answer stream by
    // jumping ahead; a client can only walk turns in order.
    if (index > st.next) return { error: 'Turn not reached.' };
    // Lock this player's own answer for the turn the FIRST time it is revealed;
    // a later re-request (e.g. after a reconnect) is idempotent and never lets
    // them relock a better answer once they have seen the correct one.
    // Cap the stored word: no real answer needs more, and it stops a hostile
    // client amplifying memory by locking megabyte strings on every turn.
    if (!st.locked.has(index)) st.locked.set(index, (typeof word === 'string' ? word : '').slice(0, 64));
    if (index === st.next) st.next = index + 1;
    return { index, answer: answers[index] };
  }

  // The server-authoritative per-turn answers a player locked in via reveals,
  // as a scoring payload. Only used for server-secret games (Anagram) and only
  // when the player actually used the reveal path; otherwise scoring falls back
  // to the submitted payload (e.g. the bot harness, which never reveals).
  lockedSolved(g, playerId) {
    const st = g.reveals && g.reveals.get(playerId);
    if (!st || st.locked.size === 0) return null;
    return [...st.locked.entries()].map(([index, word]) => ({ index, word }));
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
  // the room did across every stage of it, then score — or, for a solo test
  // run, just show what happened.
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
    // Defensive finale gate (Strix 2026-08-23, HIGH): only players who were
    // in the room when the competitive queue began may enter the finale. The
    // join gate rejects late fresh entrants at the door, but this keeps a
    // late-join hole from ever reseeding the finale participants.
    const sessionStart = this.sessionStartedAt || 0;
    const ids = [...this.players.entries()]
      .filter(([, p]) => (p.joinedAt || 0) <= sessionStart)
      .map(([id]) => id);
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
      this.setTimer('redemption', () => this.finishRedemption({ allowMissing: true }),
        c.redemptionLeadMs + c.hardTimeout + 5000);
    }, c.redemptionPrepMs);
  }

  handleRedemptionReport(playerId, report) {
    const red = this.redemption;
    if (!red || !red.tGreen) return;
    if (!red.participants.includes(playerId) || red.reports.has(playerId)) return;
    const p = this.players.get(playerId);
    const receivedAt = Date.now();
    const scored = scoreRedemptionReport(report, {
      earlyPressPenalty: this.config.earlyPressPenalty,
      tGreen: red.tGreen,
      receivedAt,
      // A player's clock-sync confidence bounds how much earlier than the
      // claimed reaction the report may legitimately arrive (Strix 2026-08-22:
      // pre-green reports must be disqualified, not just flagged).
      earliestArrivalSlackMs: Math.max(25, Math.min(150, (p?.sync?.jitter ?? 0) + 25)),
    });
    // Server-side sanity: a clean (no-early-press) report should arrive
    // roughly rtt after T_green + reportedTime. Flag, don't crash.
    if (scored.status === 'ok' && scored.earlyPresses === 0) {
      const rtt = p?.sync?.minRtt ?? 200;
      const expected = red.tGreen + scored.rawMs + rtt + 1500;
      if (receivedAt > expected + 1000) scored.flagged = true;
    }
    red.reports.set(playerId, scored);
    this.emitAll('redemption:progress', { reported: red.reports.size, total: red.participants.length });
    if (red.reports.size >= red.participants.length) this.finishRedemption();
  }

  finishRedemption({ allowMissing = false } = {}) {
    const red = this.redemption;
    if (!red) return;
    const allReported = red.reports.size >= red.participants.length;
    if (red.mode === 'chairs' && !allowMissing && !allReported) return { ok: false, error: 'pending_reports' };
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
      case 'redemption': {
        const result = this.finishRedemption();
        return result || { ok: true };
      }
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
