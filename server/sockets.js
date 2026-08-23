// Socket.IO wiring. Persistent websockets are non-negotiable — the clock
// sync protocol depends on them (spec §8).

import QRCode from 'qrcode';
import crypto from 'node:crypto';
import { Room, makeRoomCode } from './room.js';

const MAX_EVENT_BYTES = 32 * 1024;
const JOIN_FAILURE = 'Room or reconnect credential not found.';


function withinPayloadLimit(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8') <= MAX_EVENT_BYTES;
  } catch {
    return false;
  }
}

function takeRateToken(socket, name, limit, windowMs) {
  const now = Date.now();
  socket.data.rateLimits ||= new Map();
  const recent = (socket.data.rateLimits.get(name) || []).filter((at) => now - at < windowMs);
  if (recent.length >= limit) {
    socket.data.rateLimits.set(name, recent);
    return false;
  }
  recent.push(now);
  socket.data.rateLimits.set(name, recent);
  return true;
}

function clientAddress(socket) {
  // Failed-join throttling is keyed to the immediate TCP peer, not to
  // user-supplied forwarding headers. If deployment-specific proxy trust is
  // needed later, it must be added with an explicit trusted-proxy allowlist
  // before any forwarded client address is consulted.
  return socket.conn.remoteAddress || socket.handshake.address || 'unknown';
}

function failedJoinAllowed(failedJoins, socket) {
  const now = Date.now();
  const key = crypto.createHash('sha256').update(clientAddress(socket)).digest('hex');
  const recent = (failedJoins.get(key) || []).filter((at) => now - at < 60_000);
  if (recent.length >= 30) {
    failedJoins.set(key, recent);
    return false;
  }
  recent.push(now);
  failedJoins.set(key, recent);
  // Bound the process-wide tracker even if many source addresses touch it.
  // A hard cap (not just expired-entry cleanup) stops address churn from
  // growing the map without limit.
  if (failedJoins.size > 10_000) {
    for (const [address, attempts] of failedJoins) {
      if (!attempts.some((at) => now - at < 60_000)) failedJoins.delete(address);
      if (failedJoins.size <= 8_000) break;
    }
  }
  if (failedJoins.size > 12_000) {
    failedJoins.clear();
  }
  return true;
}

function failedJoinResponse(failedJoins, socket) {
  return failedJoinAllowed(failedJoins, socket)
    ? { error: JOIN_FAILURE }
    : { error: 'Too many failed joins — try again later.' };
}

function publicOrigin(socket) {
  const configured = String(process.env.APP_PUBLIC_ORIGIN || '').replace(/\/$/, '');
  if (configured) return configured;
  const requestOrigin = String(socket.handshake.headers.origin || '').replace(/\/$/, '');
  if (requestOrigin) return requestOrigin;
  const host = String(socket.handshake.headers.host || 'localhost');
  return `${socket.handshake.secure ? 'https' : 'http'}://${host}`;
}

function guarded(socket, event, { limit, windowMs = 60_000, ack = false }, handler) {
  return (...args) => {
    const callback = ack ? args.find((value) => typeof value === 'function') : null;
    const payload = args.find((value) => typeof value !== 'function');
    if (!withinPayloadLimit(payload)) return callback?.({ error: 'Payload exceeds the application limit.' });
    if (!takeRateToken(socket, event, limit, windowMs)) {
      return callback?.({ error: 'Too many requests — try again shortly.' });
    }
    return handler(...args);
  };
}

export function attachSockets(io, { allowClientScoredCompetitive = false } = {}) {
  const rooms = new Map();
  // Shared across sockets for this server instance so reconnecting does not
  // reset a source's failed-code budget; isolated across test/server instances.
  const failedJoins = new Map();

  const destroyRoom = (room) => {
    room.destroy();
    rooms.delete(room.code);
  };

  io.on('connection', (socket) => {
    const room = () => rooms.get(socket.data.roomCode);

    // NTP-style time endpoint (spec §5.2). Client sends t0, we ack with t1;
    // the client records t2 on receipt and computes rtt + offset.
    socket.on('sync:ping', guarded(socket, 'sync:ping', { limit: 30, windowMs: 10_000, ack: true }, (t0, cb) => {
      if (typeof cb === 'function') cb({ t0, t1: Date.now() });
    }));

    socket.on('host:create', guarded(socket, 'host:create', { limit: 3, ack: true }, async (payload, cb) => {
      if (typeof cb !== 'function') return;
      try {
        let code;
        do { code = makeRoomCode(); } while (rooms.has(code));
        const r = new Room(io, code, payload?.config || {}, destroyRoom, { allowClientScoredCompetitive });
        rooms.set(code, r);
        r.hostSocketId = socket.id;
        socket.join(`room:${code}`);
        socket.join(`host:${code}`);
        socket.data.roomCode = code;
        socket.data.isHost = true;
        const joinUrl = `${publicOrigin(socket)}/?code=${code}`;
        let qr = null;
        try {
          qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 480 });
        } catch { /* QR is decorative — never block room creation on it */ }
        cb({ ok: true, code, hostKey: r.hostKey, joinUrl, qr, config: r.publicConfig() });
      } catch (err) {
        console.error('host:create', err);
        cb({ error: 'Could not create room.' });
      }
    }));

    socket.on('host:rejoin', guarded(socket, 'host:rejoin', { limit: 10, ack: true }, ({ code, hostKey } = {}, cb) => {
      const r = rooms.get(String(code || '').toUpperCase());
      if (!r || r.hostKey !== hostKey) return cb?.(failedJoinResponse(failedJoins, socket));
      const previousHost = r.hostSocketId && io.sockets.sockets.get(r.hostSocketId);
      if (previousHost && previousHost.id !== socket.id) {
        previousHost.data.isHost = false;
        previousHost.data.roomCode = null;
        previousHost.leave(`host:${r.code}`);
        previousHost.leave(`room:${r.code}`);
      }
      r.hostSocketId = socket.id;
      r.clearTimer('empty');
      socket.join(`room:${r.code}`);
      socket.join(`host:${r.code}`);
      socket.data.roomCode = r.code;
      socket.data.isHost = true;
      cb?.({ ok: true, code: r.code, snapshot: r.snapshot(null), config: r.publicConfig() });
    }));

    socket.on('player:join', guarded(socket, 'player:join', { limit: 20, ack: true }, ({ code, name, playerId, reconnectToken } = {}, cb) => {
      if (typeof cb !== 'function') return;
      const r = rooms.get(String(code || '').toUpperCase());
      if (!r) return cb(failedJoinResponse(failedJoins, socket));
      const result = r.join(socket, { name, playerId, reconnectToken });
      if (result.error && playerId) return cb(failedJoinResponse(failedJoins, socket));
      if (result.ok) r.clearTimer('empty');
      cb(result);
    }));

    // Solo practice: one person, no host screen. The lone player creates a
    // private room and drives it (any game or the reaction round, unscored).
    socket.on('solo:create', guarded(socket, 'solo:create', { limit: 3, ack: true }, ({ name } = {}, cb) => {
      if (typeof cb !== 'function') return;
      let code;
      do { code = makeRoomCode(); } while (rooms.has(code));
      const r = new Room(io, code, {}, destroyRoom, { allowClientScoredCompetitive });
      r.solo = true;
      rooms.set(code, r);
      const joined = r.join(socket, { name });
      // The creator is the solo owner: only this player may drive the room
      // (Strix re-scan 2026-08-23: solo-room takeover).
      if (joined.ok) r.soloOwnerId = joined.playerId;
      cb(joined);
    }));

    const soloOnly = (fn) => (...args) => {
      const r = room();
      const cb = args.find((a) => typeof a === 'function');
      if (!r || !r.solo || !socket.data.playerId) return cb?.({ error: 'Not in a solo room.' });
      if (r.soloOwnerId && socket.data.playerId !== r.soloOwnerId) return cb?.({ error: 'Not in a solo room.' });
      fn(r, ...args);
    };

    socket.on('solo:play', guarded(socket, 'solo:play', { limit: 30, ack: true }, soloOnly((r, payload, cb) => cb?.(r.startTest(payload?.key)))));
    socket.on('solo:redemption', guarded(socket, 'solo:redemption', { limit: 10, ack: true }, soloOnly((r, _p, cb) => cb?.(r.startRedemptionTest()))));
    socket.on('solo:menu', guarded(socket, 'solo:menu', { limit: 30, ack: true }, soloOnly((r, _p, cb) => cb?.(r.backToLobby()))));
    // The lone player's Next: skips a tutorial, or advances a between-stages
    // reveal that a hosted room's Next would advance.
    socket.on('solo:skip', guarded(socket, 'solo:skip', { limit: 30, ack: true }, soloOnly((r, _p, cb) => cb?.(r.soloAdvance()))));

    socket.on('sync:report', guarded(socket, 'sync:report', { limit: 6 }, (sync) => {
      const r = room();
      if (r && socket.data.playerId) r.recordSync(socket.data.playerId, sync);
    }));

    socket.on('player:submit', guarded(socket, 'player:submit', { limit: 120, windowMs: 10 * 60_000 }, ({ payload } = {}) => {
      const r = room();
      if (r && socket.data.playerId) r.handleSubmit(socket.data.playerId, payload);
    }));

    // Per-turn answer feedback for games whose correct answer is a server
    // secret (Anagram, issue #48). The ack goes back to THIS socket only, so a
    // player only ever learns their own current game's turn answer.
    socket.on('player:reveal', guarded(socket, 'player:reveal', { limit: 120, ack: true }, ({ index, word } = {}, cb) => {
      if (typeof cb !== 'function') return;
      try {
        const r = room();
        if (r && socket.data.playerId) cb(r.revealTurn(socket.data.playerId, index, word));
        else cb({ error: 'Not in a room.' });
      } catch (err) {
        // A reveal is advisory feedback — never let it escape as an unhandled
        // server exception.
        console.error('player:reveal', err);
        cb({ error: 'Reveal failed.' });
      }
    }));

    socket.on('redemption:report', guarded(socket, 'redemption:report', { limit: 30, windowMs: 10 * 60_000 }, (report) => {
      const r = room();
      if (r && socket.data.playerId) r.handleRedemptionReport(socket.data.playerId, report);
    }));

    const hostOnly = (fn) => (...args) => {
      const r = room();
      if (!r || !socket.data.isHost) return;
      fn(r, ...args);
    };

    socket.on('host:start', guarded(socket, 'host:start', { limit: 10, ack: true }, hostOnly((r, _p, cb) => cb?.(r.start()))));
    socket.on('host:test', guarded(socket, 'host:test', { limit: 30, ack: true }, hostOnly((r, payload, cb) => cb?.(r.startTest(payload?.key)))));
    socket.on('host:next', guarded(socket, 'host:next', { limit: 240, windowMs: 10 * 60_000, ack: true }, hostOnly((r, _p, cb) => cb?.(r.hostNext()))));
    // Moderation: pull a player-authored entry off the projector mid-stage.
    socket.on('host:hide', guarded(socket, 'host:hide', { limit: 60, ack: true }, hostOnly((r, payload, cb) => cb?.(r.hideEntry(payload?.entryId)))));
    socket.on('host:config', guarded(socket, 'host:config', { limit: 60, ack: true }, hostOnly((r, payload, cb) => cb?.(r.updateConfig(payload || {})))));
    // Live host actions (issue #55) — mid-game, host-only, NOT lobby config.
    socket.on('host:skip', guarded(socket, 'host:skip', { limit: 20, ack: true }, hostOnly((r, _p, cb) => cb?.(r.skipGame()))));
    socket.on('host:extend', guarded(socket, 'host:extend', { limit: 20, ack: true }, hostOnly((r, _p, cb) => cb?.(r.extendTimer()))));

    socket.on('disconnect', () => {
      const r = room();
      if (r) r.handleDisconnect(socket);
    });
  });

  return rooms;
}
