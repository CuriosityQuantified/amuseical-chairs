import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import test from 'node:test';
import { promisify } from 'node:util';
import { io as connect } from 'socket.io-client';
import { createServer } from '../server/app.js';

const execFileAsync = promisify(execFile);
const repoRoot = new URL('..', import.meta.url).pathname;
let httpServer;
let io;
let baseUrl;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openSocket(options = {}) {
  return new Promise((resolve, reject) => {
    const socket = connect(baseUrl, {
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

test('rotating a claimed source address does not evade the join budget', async () => {
  const sockets = [];
  try {
    let limited = null;
    for (let i = 0; i < 25; i++) {
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
    assert.ok(limited, 'rotating claimed IPs still hits a per-connection budget per guess');
  } finally {
    for (const socket of sockets) socket.disconnect();
  }
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
