import { test, expect } from '@playwright/test';

test('host reload restores tutorial and timed minigame from rejoin snapshot', async ({ browser }) => {
  const host = await browser.newPage();
  const errors = [];
  host.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  host.on('pageerror', (error) => errors.push(String(error)));
  await host.goto('/host.html');
  await host.click('#create-btn');
  await expect(host.locator('#screen-lobby')).toBeVisible();
  const code = await host.locator('#room-code').innerText();

  const players = await Promise.all(['Alpha', 'Bravo'].map(async (name) => {
    const page = await browser.newPage();
    await page.goto('/');
    await page.evaluate(({ code, name }) => new Promise((resolve, reject) => {
      const socket = io();
      socket.once('connect', () => socket.emit('player:join', { code, name }, (res) => {
        if (res?.ok) resolve(); else reject(new Error(res?.error || 'join failed'));
      }));
    }), { code, name });
    return page;
  }));

  await expect(host.locator('#player-count')).toHaveText('2');
  await host.click('#start-btn');
  await expect(host.locator('#screen-run')).toBeVisible();
  await expect(host.locator('#host-content')).toContainText('How to play');

  await host.reload();
  await expect(host.locator('#screen-run')).toBeVisible();
  await expect(host.locator('#host-content')).toContainText('How to play');
  await expect(host.locator('#next-btn')).toBeVisible();

  await host.click('#next-btn');
  await expect(host.locator('#host-content')).toContainText(/submitted|seconds|s/);
  await host.reload();
  await expect(host.locator('#screen-run')).toBeVisible();
  await expect(host.locator('#host-bar')).toBeVisible();
  await expect(host.locator('#skip-btn')).toBeVisible();

  expect(errors, `host errors: ${errors.join(' | ')}`).toEqual([]);
  await Promise.all(players.map((page) => page.close()));
  await host.close();
});
