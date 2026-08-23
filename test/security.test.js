import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import test from 'node:test';
import { promisify } from 'node:util';
import { io as connect } from 'socket.io-client';
import { createServer } from '../server/app.js';
import { buildReveal } from '../server/games.js';
import { Room } from '../server/room.js';

const execFileAsync = promisify(execFile);
const repoRoot = new URL('..', import.meta.url).pathname;
let httpServer;
let io;
let baseUrl;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectSocket(url, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = connect(url, {
      path: '/socket.io',
      transports: ['polling'],
      forceNew: true,
      reconnection: false,
      timeout: 3_000,
      ...options,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket.IO connection timed out'));
    }, 4_000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    });
  });
}

function openSocket(options = {}) {
  return connectSocket(baseUrl, options);
}

async function withServer(run, serverOptions = {}) {
  const { httpServer: localServer, io: localIo, rooms } = createServer(serverOptions);
  await new Promise((resolve) => localServer.listen(0, '127.0.0.1', resolve));
  const localBaseUrl = `http://127.0.0.1:${localServer.address().port}`;
  const openLocalSocket = (options = {}) => connectSocket(localBaseUrl, options);
  try {
    return await run({ baseUrl: localBaseUrl, openSocket: openLocalSocket, emitAck, rooms });
  } finally {
    localIo.close();
    await new Promise((resolve) => localServer.close(resolve));
  }
}

function emitAck(socket, event, payload, timeout = 2_000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ timedOut: true, value: null });
      }
    }, timeout);
    socket.emit(event, payload, (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ timedOut: false, value });
    });
  });
}

test.before(async () => {
  ({ httpServer, io } = createServer());
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

test.after(async () => {
  io.close();
  await new Promise((resolve) => httpServer.close(resolve));
});

test('public server does not expose sensitive files or encoded traversal', async () => {
  const health = await fetch(`${baseUrl}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  for (const route of [
    '/.env',
    '/.git/config',
    '/package.json',
    '/server/app.js',
    '/shared/%2e%2e/server/app.js',
    '/%2e%2e/%2e%2e/etc/passwd',
  ]) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.ok(response.status < 200 || response.status >= 300, `${route} unexpectedly returned ${response.status}`);
  }
});

test('public responses apply the complete application-controlled security header policy', async () => {
  for (const route of ['/', '/host.html', '/healthz']) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.headers.get('x-powered-by'), null, `${route} exposes Express`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(response.headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
    assert.match(response.headers.get('strict-transport-security') || '', /max-age=31536000/);
    const csp = response.headers.get('content-security-policy') || '';
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'self' https:\/\/static\.cloudflareinsights\.com/);
    assert.match(csp, /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);
    assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
    assert.match(csp, /img-src 'self' data:/);
    assert.match(csp, /connect-src 'self' wss:\/\/amuseical\.com https:\/\/cloudflareinsights\.com/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /object-src 'none'/);
  }
});

test('Socket.IO rejects a browser connection from an untrusted Origin', async () => {
  await assert.rejects(
    openSocket({ extraHeaders: { Origin: 'https://evil.example' } }),
    /origin|forbidden|xhr poll error|websocket error/i,
  );
});

test('browser application avoids direct HTML/code execution sinks', async () => {
  for (const file of [
    'public/js/player.js',
    'public/js/host.js',
    'public/js/games.js',
    'public/js/chairs.js',
    'public/js/tutorials.js',
  ]) {
    const source = await fs.readFile(file, 'utf8');
    assert.doesNotMatch(source, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(|\beval\s*\(|\bnew\s+Function\s*\(/, file);
  }
});

test('external assessment rejects targets outside its explicit scope before networking', async () => {
  const baseEnv = {
    ...process.env,
    SECURITY_ALLOWED_HOSTS: 'amuseical.com',
    SECURITY_ALLOWED_ORIGINS: 'https://amuseical.com',
    SECURITY_REQUIRE_HTTPS: 'true',
  };
  await assert.rejects(
    execFileAsync(process.execPath, [
      'scripts/security-assessment.mjs',
      '--target', 'http://amuseical.com',
      '--no-browser', '--no-socket',
    ], { cwd: repoRoot, env: baseEnv }),
    (error) => /requires an HTTPS target/.test(error.stderr),
  );
  await assert.rejects(
    execFileAsync(process.execPath, [
      'scripts/security-assessment.mjs',
      '--target', 'https://unapproved.example',
      '--no-browser', '--no-socket',
    ], { cwd: repoRoot, env: baseEnv }),
    (error) => /not in SECURITY_ALLOWED_HOSTS/.test(error.stderr),
  );
  await assert.rejects(
    execFileAsync(process.execPath, [
      'scripts/security-assessment.mjs',
      '--target', 'https://amuseical.com:8443',
      '--no-browser', '--no-socket',
    ], { cwd: repoRoot, env: baseEnv }),
    (error) => /not in SECURITY_ALLOWED_ORIGINS/.test(error.stderr),
  );
});

test('failed room-code guesses are throttled by source address across sockets', async () => {
  await withServer(async ({ openSocket }) => {
    const sockets = [];
    try {
      let limited = null;
      for (let i = 0; i < 35; i++) {
        const socket = await openSocket({ extraHeaders: { 'CF-Connecting-IP': '203.0.113.10' } });
        sockets.push(socket);
        const attempt = await emitAck(socket, 'player:join', { code: `ZZ${String(i).padStart(2, '0')}`, name: 'probe' });
        if (/too many|try again/i.test(attempt.value?.error || '')) {
          limited = attempt.value;
          break;
        }
      }
      assert.ok(limited, 'expected repeated failed room-code attempts from one source to be throttled');
      assert.equal(limited.error, 'Too many failed joins — try again later.');
    } finally {
      for (const socket of sockets) socket.disconnect();
    }
  });
});

test('rotating a claimed source address does not evade the join budget', async () => {
  await withServer(async ({ openSocket }) => {
    const sockets = [];
    try {
      let limited = null;
      for (let i = 0; i < 35; i++) {
        const socket = await openSocket({ extraHeaders: { 'CF-Connecting-IP': `203.0.113.${10 + i}` } });
        sockets.push(socket);
        const attempt = await emitAck(socket, 'player:join', { code: `ZZ${String(i).padStart(2, '0')}`, name: 'probe' });
        if (/too many|try again/i.test(attempt.value?.error || '')) {
          limited = attempt.value;
          break;
        }
        assert.equal(attempt.value?.error, 'Room or reconnect credential not found.',
          'every unthrottled miss stays indistinguishable from room absence');
      }
      assert.ok(limited, 'rotating claimed IPs should still hit the same source-address budget');
      assert.equal(limited.error, 'Too many failed joins — try again later.');
    } finally {
      for (const socket of sockets) socket.disconnect();
    }
  });
});

test('Socket.IO bounds oversized application payloads before room processing', async () => {
  const host = await openSocket();
  const player = await openSocket();
  try {
    const created = await emitAck(host, 'host:create', { origin: baseUrl, config: {} }, 8_000);
    assert.equal(created.value?.ok, true);
    const joined = await emitAck(player, 'player:join', { code: created.value.code, name: 'bounded' });
    assert.equal(joined.value?.ok, true);
    const result = await emitAck(player, 'player:reveal', {
      index: 0,
      word: 'x'.repeat(40_000),
    });
    assert.match(result.value?.error || '', /payload|large|limit/i);
    assert.equal(player.connected, true);
  } finally {
    host.disconnect();
    player.disconnect();
  }
});

test('per-event quotas reject a burst but preserve the socket connection', async () => {
  const socket = await openSocket();
  try {
    let limited = null;
    for (let i = 0; i < 35; i++) {
      const result = await emitAck(socket, 'sync:ping', Date.now());
      if (/too many|try again/i.test(result.value?.error || '')) {
        limited = result.value;
        break;
      }
    }
    assert.ok(limited, 'expected sync burst to be throttled');
    assert.equal(socket.connected, true);
  } finally {
    socket.disconnect();
  }
});

test('fresh transports share one source budget across host and solo room creation', async () => {
  await withServer(async ({ openSocket: openLocalSocket, rooms }) => {
    const sockets = [];
    try {
      const first = await openLocalSocket();
      sockets.push(first);
      const hostCreated = await emitAck(first, 'host:create', { config: {} }, 8_000);
      assert.equal(hostCreated.value?.ok, true);
      first.disconnect();

      const second = await openLocalSocket();
      sockets.push(second);
      const soloCreated = await emitAck(second, 'solo:create', { name: 'Solo' });
      assert.equal(soloCreated.value?.ok, true);
      second.disconnect();

      // A third fresh transport has no fresh budget: the source-address bucket
      // is shared across sockets AND across host:create / solo:create.
      const third = await openLocalSocket();
      sockets.push(third);
      const blocked = await emitAck(third, 'host:create', { config: {} }, 8_000);
      assert.match(blocked.value?.error || '', /too many rooms/i);
      assert.equal(rooms.size, 2, 'rejected creation allocates no Room');
    } finally {
      for (const socket of sockets) socket.disconnect();
    }
  }, { roomCreateLimit: 2, maxRooms: 100 });
});

test('the process-wide room cap fails closed before allocating another room', async () => {
  await withServer(async ({ openSocket: openLocalSocket, rooms }) => {
    const sockets = [];
    try {
      for (let i = 0; i < 2; i++) {
        const socket = await openLocalSocket();
        sockets.push(socket);
        const created = await emitAck(socket, 'host:create', { config: {} }, 8_000);
        assert.equal(created.value?.ok, true);
      }
      const blockedSocket = await openLocalSocket();
      sockets.push(blockedSocket);
      const blocked = await emitAck(blockedSocket, 'solo:create', { name: 'Overflow' });
      assert.match(blocked.value?.error || '', /too many rooms/i);
      assert.equal(rooms.size, 2, 'hard cap is not exceeded');
    } finally {
      for (const socket of sockets) socket.disconnect();
    }
  }, { roomCreateLimit: 10, maxRooms: 2 });
});

test('Socket.IO enforces host-only actions and host rejoin credentials', async () => {
  const sockets = [];
  try {
    const host = await openSocket();
    sockets.push(host);
    const created = await emitAck(host, 'host:create', { origin: 'https://evil.example', config: {} }, 8_000);
    assert.equal(created.value?.ok, true);
    assert.equal(new URL(created.value.joinUrl).origin, baseUrl,
      'join URL uses the validated request origin, not client input');
    const { code, hostKey } = created.value;
    assert.match(code, /^[A-HJ-NP-Z]{4}$/);
    assert.match(hostKey, /^[0-9a-f-]{36}$/i);

    const playerOne = await openSocket();
    const playerTwo = await openSocket();
    const wrongHost = await openSocket();
    sockets.push(playerOne, playerTwo, wrongHost);

    const phases = [];
    const configEvents = [];
    playerOne.on('phase', (value) => phases.push(value));
    host.on('room:config', (value) => configEvents.push(value));

    const joinedOne = await emitAck(playerOne, 'player:join', { code, name: '<security-probe>' });
    const joinedTwo = await emitAck(playerTwo, 'player:join', { code, name: 'A'.repeat(500) });
    assert.equal(joinedOne.value?.ok, true);
    assert.equal(joinedTwo.value?.ok, true);
    assert.match(joinedOne.value?.reconnectToken || '', /^[A-Za-z0-9_-]{40,}$/);
    const joinedOneToken = joinedOne.value.reconnectToken;
    const joinedTwoToken = joinedTwo.value.reconnectToken;
    const rosterJson = JSON.stringify(joinedTwo.value.snapshot?.players || []);
    assert.equal(rosterJson.includes(joinedOneToken), false);
    assert.equal(rosterJson.includes(joinedTwoToken), false);
    assert.equal(JSON.stringify(joinedTwo.value.snapshot).includes('reconnectToken'), false);
    assert.ok(joinedTwo.value.name.length <= 20);

    const attacker = await openSocket();
    const legitimateReconnect = await openSocket();
    sockets.push(attacker, legitimateReconnect);
    const stolenPublicId = await emitAck(attacker, 'player:join', {
      code,
      name: 'ignored',
      playerId: joinedOne.value.playerId,
    });
    assert.equal(stolenPublicId.value?.ok, undefined);
    assert.equal(stolenPublicId.value?.error, 'Room or reconnect credential not found.');
    const rejoined = await emitAck(legitimateReconnect, 'player:join', {
      code,
      name: 'ignored',
      playerId: joinedOne.value.playerId,
      reconnectToken: joinedOne.value.reconnectToken,
    });
    assert.equal(rejoined.value?.ok, true);
    assert.equal(rejoined.value?.playerId, joinedOne.value.playerId);
    // The room-lifetime credential stays stable so a lost reconnect ACK can
    // be retried; only the socket binding moves.
    assert.equal(rejoined.value?.reconnectToken, joinedOne.value.reconnectToken,
      'a successful reconnect keeps the room-lifetime bearer credential');

    // The same credential is idempotent: a retried reconnect after a lost ACK
    // succeeds rather than locking the player out.
    const retried = await emitAck(legitimateReconnect, 'player:join', {
      code,
      name: 'ignored',
      playerId: joinedOne.value.playerId,
      reconnectToken: joinedOne.value.reconnectToken,
    });
    assert.equal(retried.value?.ok, true, 'retrying with the same credential succeeds');

    // Old connections are evicted when a new socket takes over the identity.
    await wait(150);
    const staleSubmit = await emitAck(playerOne, 'player:reveal', { index: 0, word: 'stale' }, 500);
    assert.equal(staleSubmit.value?.error, 'Not in a room.');

    const wrongRejoin = await emitAck(wrongHost, 'host:rejoin', { code, hostKey: '00000000-0000-0000-0000-000000000000' });
    assert.equal(wrongRejoin.value?.ok, undefined);
    assert.equal(wrongRejoin.value?.error, 'Room or reconnect credential not found.');

    const unauthorizedStart = await emitAck(playerOne, 'host:start', {}, 500);
    const unauthorizedConfig = await emitAck(playerOne, 'host:config', { gameDuration: 500 }, 500);
    await wait(100);
    assert.equal(unauthorizedStart.timedOut, true);
    assert.equal(unauthorizedConfig.timedOut, true);
    assert.equal(phases.length, 0);
    assert.equal(configEvents.length, 0);
  } finally {
    for (const socket of sockets) socket.disconnect();
  }
});

test('host authority does not leak across rooms via socket state reuse', async () => {
  // An attacker who hosts their own room must not inherit host control over a
  // victim room by joining it as a player on the same socket (Strix 2026-08-23,
  // cross-room state reuse, CVSS 8.2).
  await withServer(async ({ openSocket, emitAck }) => {
    const sockets = [];
    try {
      const victimHost = await openSocket();
      const attacker = await openSocket();
      sockets.push(victimHost, attacker);

      // Victim room with its own host.
      const victim = await emitAck(victimHost, 'host:create', { config: { gameDuration: 30000 } });
      assert.equal(victim.value?.ok, true);
      const victimCode = victim.value.code;

      // Attacker becomes host of their own room…
      const own = await emitAck(attacker, 'host:create', { config: {} });
      assert.equal(own.value?.ok, true);
      const ownCode = own.value.code;
      assert.notEqual(ownCode, victimCode);

      // …then joins the victim room as a plain player on the same socket.
      const joined = await emitAck(attacker, 'player:join', { code: victimCode, name: 'Sneak' });
      assert.equal(joined.value?.ok, true, 'attacker can join the victim room as a player');

      // Host actions against the victim room must NOT be authorized.
      const config = await emitAck(attacker, 'host:config', { gameDuration: 120000 }, 500);
      const start = await emitAck(attacker, 'host:start', {}, 500);
      assert.equal(config.timedOut, true, 'host:config on the victim room times out');
      assert.equal(start.timedOut, true, 'host:start on the victim room times out');

      // The real host of the victim room is unaffected.
      const legitConfig = await emitAck(victimHost, 'host:config', { gameDuration: 45000 });
      assert.equal(legitConfig.value?.ok, true, 'the recorded victim host still controls the room');
    } finally {
      for (const socket of sockets) socket.disconnect();
    }
  });
});

test('same-room host/player role transitions cannot preserve stale authority or targeting', async () => {
  await withServer(async ({ openSocket, emitAck, rooms }) => {
    const sockets = [];
    try {
      const originalHost = await openSocket();
      const player = await openSocket();
      sockets.push(originalHost, player);

      const created = await emitAck(originalHost, 'host:create', { config: {} });
      assert.equal(created.value?.ok, true);
      const { code, hostKey } = created.value;

      // Host -> player on the same transport is rejected; the real host role
      // remains singular and authoritative.
      const hostAsPlayer = await emitAck(originalHost, 'player:join', { code, name: 'HostPlayer' });
      assert.equal(hostAsPlayer.value?.ok, undefined);
      assert.equal(hostAsPlayer.value?.error, 'A host connection cannot join as a player.');
      assert.equal(rooms.get(code).players.size, 0, 'host did not mint a player record');
      const stillHost = await emitAck(originalHost, 'host:config', { gameDuration: 45000 });
      assert.equal(stillHost.value?.ok, true, 'host authority remains intact after rejection');

      // Player -> host with the real host credential is allowed, but the old
      // player binding is disconnected first so direct sends cannot target it.
      const joined = await emitAck(player, 'player:join', { code, name: 'Promoted' });
      assert.equal(joined.value?.ok, true);
      const promotedId = joined.value.playerId;
      const promoted = await emitAck(player, 'host:rejoin', { code, hostKey });
      assert.equal(promoted.value?.ok, true);
      assert.equal(rooms.get(code).players.get(promotedId).socketId, null);
      assert.equal(rooms.get(code).players.get(promotedId).connected, false);
      assert.equal(rooms.get(code).hostSocketId, player.id, 'promoted socket is the sole recorded host');
      let leaked = false;
      player.once('you:score', () => { leaked = true; });
      rooms.get(code).emitPlayer(promotedId, 'you:score', { points: 999 });
      await wait(100);
      assert.equal(leaked, false, 'former player direct-target events no longer reach the host');
    } finally {
      for (const socket of sockets) socket.disconnect();
    }
  });
});

test('moving a socket to a new room stops prior-room broadcasts', async () => {
  // Strix 2026-08-23, CVSS 5.3: a socket that joins room B must not keep
  // receiving room A's room:players / phase / you:score traffic.
  await withServer(async ({ openSocket, emitAck, rooms }) => {
    const sockets = [];
    try {
      const hostA = await openSocket();
      const hostB = await openSocket();
      const mover = await openSocket();
      sockets.push(hostA, hostB, mover);

      const roomA = await emitAck(hostA, 'host:create', { config: {} });
      const roomB = await emitAck(hostB, 'host:create', { config: {} });
      const codeA = roomA.value.code;
      const codeB = roomB.value.code;
      assert.notEqual(codeA, codeB);

      // Join room A, then move the same socket to room B.
      const joinedA = await emitAck(mover, 'player:join', { code: codeA, name: 'Mover' });
      assert.equal(joinedA.value?.ok, true);
      const oldPlayerId = joinedA.value.playerId;
      const joinedB = await emitAck(mover, 'player:join', { code: codeB, name: 'Mover' });
      assert.equal(joinedB.value?.ok, true, 'same socket joins a second room');
      assert.equal(rooms.get(codeA).players.get(oldPlayerId).socketId, null,
        'the old Room no longer targets the moved socket directly');
      assert.equal(rooms.get(codeA).players.get(oldPlayerId).connected, false,
        'the old player association is disconnected');

      // Room-A broadcasts and direct player sends must no longer reach it.
      let leaked = false;
      const probe = () => { leaked = true; };
      mover.on('phase', probe);
      mover.on('room:players', probe);
      mover.on('you:score', probe);
      rooms.get(codeA).emitPlayer(oldPlayerId, 'you:score', { points: 999 });
      await emitAck(hostA, 'host:start', {});
      await wait(300);
      mover.off('phase', probe);
      mover.off('room:players', probe);
      mover.off('you:score', probe);
      assert.equal(leaked, false, 'no room-A broadcast or direct score reaches the moved socket');
    } finally {
      for (const socket of sockets) socket.disconnect();
    }
  });
});

test('icebreaker answered reveal is per-player, not a shared full guesses array', () => {
  // Strix 2026-08-23, CVSS 4.3: the answered reveal must only carry the
  // receiving player's own guesses[] row; reconnect snapshots use the same
  // player-specific redaction.
  const reveal = buildReveal('icebreaker', [
    { stage: 1, entries: [{ playerId: 'p-alice', payload: { text: 'I play bass' } }] },
    { stage: 2, clientData: { round: 2, totalRounds: 3, text: 'Who plays bass?', hidden: false }, secret: { answer: 'p-bob' }, entries: [
      { playerId: 'p-alice', payload: { pick: 'p-bob' } },
      { playerId: 'p-bob', payload: { pick: 'p-alice' } },
    ] },
  ]);
  assert.equal(reveal.answer.guesses.length, 2, 'fixture has two guess rows');

  const sent = [];
  const stubIo = {
    to(roomName) {
      return { emit(event, data) { sent.push({ roomName, event, data }); } };
    },
    sockets: { sockets: new Map() },
  };
  const room = new Room(stubIo, 'REV', { enabled: { icebreaker: true } }, () => {});
  try {
    room.players.set('p-alice', { id: 'p-alice', name: 'Alice', socketId: 'sock-alice' });
    room.players.set('p-bob', { id: 'p-bob', name: 'Bob', socketId: 'sock-bob' });
    room.emitReveal({ ...reveal.answer, answered: true });

    const alicePayload = sent.find((e) => e.roomName === 'sock-alice');
    const bobPayload = sent.find((e) => e.roomName === 'sock-bob');
    assert.deepEqual(alicePayload.data.guesses.map((r) => r.playerId), ['p-alice']);
    assert.deepEqual(bobPayload.data.guesses.map((r) => r.playerId), ['p-bob']);
    assert.equal(alicePayload.data.name, 'reveal', 'personalized payload preserves the phase name');

    const hostPayload = sent.find((e) => e.roomName === 'host:REV');
    assert.equal(hostPayload.data.guesses.length, 2, 'host keeps the full projector reveal');
    assert.equal(sent.some((e) => e.roomName === 'room:REV'), false,
      'answered guesses are never broadcast to the whole player room');

    room.phase = 'reveal';
    room.reveal = { answered: true, answer: { ...reveal.answer, answered: true }, teaser: reveal.teaser };
    assert.deepEqual(room.snapshot('p-alice').reveal.guesses.map((r) => r.playerId), ['p-alice']);
    assert.equal(room.snapshot(null).reveal.guesses.length, 2, 'host snapshot remains complete');
  } finally {
    room.destroy();
  }
});

test('host:create drops internal config keys and keeps only the documented host knobs', async () => {
  const { httpServer: localServer, io: localIo, rooms } = createServer();
  await new Promise((resolve) => localServer.listen(0, '127.0.0.1', resolve));
  const localBaseUrl = `http://127.0.0.1:${localServer.address().port}`;
  const host = await connectSocket(localBaseUrl, { transports: ['websocket'] });
  try {
    const created = await emitAck(host, 'host:create', {
      origin: localBaseUrl,
      config: {
        gameDuration: 30000,
        enabled: { rgb: false, bisect: true, area: true },
        gamesPerSession: 1,
        minDelay: 500,
        maxDelay: 500,
      },
    }, 8_000);

    assert.equal(created.value?.ok, true);
    assert.equal(created.value?.config?.gameDuration, 30000, 'the documented gameDuration knob still applies at create time');
    assert.equal(created.value?.config?.enabled?.rgb, false, 'documented per-game toggles still apply at create time');
    assert.equal(created.value?.config?.minDelay, 2000, 'internal pacing defaults are not overridable via host:create');
    assert.equal(created.value?.config?.maxDelay, 6000, 'internal pacing defaults stay at their server value');

    const room = rooms.get(created.value.code);
    assert.ok(room, 'created room is present in the server room map');
    assert.equal(room.config.gamesPerSession, 0, 'host:create cannot lower the K-of-N draw');
    assert.equal(room.config.minDelay, 2000, 'server room config ignores hidden create-time minDelay');
    assert.equal(room.config.maxDelay, 6000, 'server room config ignores hidden create-time maxDelay');
  } finally {
    host.disconnect();
    for (const room of rooms.values()) room.destroy();
    localIo.close();
    await new Promise((resolve) => localServer.close(resolve));
  }
});
