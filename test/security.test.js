import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { io as connect } from 'socket.io-client';
import { createServer } from '../server/app.js';

let httpServer;
let io;
let baseUrl;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openSocket() {
  return new Promise((resolve, reject) => {
    const socket = connect(baseUrl, {
      path: '/socket.io',
      transports: ['polling'],
      forceNew: true,
      reconnection: false,
      timeout: 3_000,
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

test('Socket.IO enforces host-only actions and host rejoin credentials', async () => {
  const sockets = [];
  try {
    const host = await openSocket();
    sockets.push(host);
    const created = await emitAck(host, 'host:create', { origin: baseUrl, config: {} }, 8_000);
    assert.equal(created.value?.ok, true);
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
    assert.ok(joinedTwo.value.name.length <= 20);

    const wrongRejoin = await emitAck(wrongHost, 'host:rejoin', { code, hostKey: '00000000-0000-0000-0000-000000000000' });
    assert.equal(wrongRejoin.value?.ok, undefined);
    assert.match(wrongRejoin.value?.error || '', /Room not found/);

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
