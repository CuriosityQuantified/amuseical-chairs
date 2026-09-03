import { test, expect } from '@playwright/test';

test('player reload during a timed minigame rejoins without a duplicate', async ({ browser }) => {
  const host = await browser.newPage();
  const player = await browser.newPage();
  const other = await browser.newPage();
  const errors = [];
  player.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  player.on('pageerror', (error) => errors.push(String(error)));

  await host.goto('/host.html');
  await host.click('#create-btn');
  await expect(host.locator('#screen-lobby')).toBeVisible();
  const code = await host.locator('#room-code').innerText();

  await player.goto(`/?code=${code}`);
  await player.fill('#join-name', 'Reloading');
  await player.click('#join-btn');
  await expect(player.locator('#screen-play')).toBeVisible();
  const tokenBeforeReload = await player.evaluate((roomCode) =>
    localStorage.getItem(`mc_reconnect_${roomCode}`), code);

  await other.goto('/');
  await other.evaluate(({ code: roomCode }) => new Promise((resolve, reject) => {
    const socket = io();
    socket.once('connect', () => socket.emit('player:join', {
      code: roomCode,
      name: 'Other',
    }, (res) => res?.ok ? resolve() : reject(new Error(res?.error || 'join failed'))));
  }), { code });
  await expect(host.locator('#player-count')).toHaveText('2');

  await host.click('#start-btn');
  await expect(host.locator('#host-content')).toContainText('How to play');
  await host.click('#next-btn');
  await expect(host.locator('#host-bar')).toBeVisible();
  await expect(player.locator('#screen-play')).toBeVisible();

  await player.reload();
  await expect(player.locator('#screen-play')).toBeVisible();
  await expect(player.locator('#screen-join')).toBeHidden();
  await expect(player.locator('#content')).toHaveText(/\S+/);
  const tokenAfterReload = await player.evaluate((roomCode) =>
    localStorage.getItem(`mc_reconnect_${roomCode}`), code);
  expect(tokenAfterReload).toBeTruthy();
  expect(tokenAfterReload).not.toBe(tokenBeforeReload);
  await expect(host.locator('#player-count')).toHaveText('2');
  expect(errors, `player errors: ${errors.join(' | ')}`).toEqual([]);

  await Promise.all([host.close(), player.close(), other.close()]);
});
