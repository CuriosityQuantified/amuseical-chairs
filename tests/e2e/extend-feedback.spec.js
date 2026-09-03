import { test, expect } from '@playwright/test';

test('host can extend once and sees feedback for a rejected second click', async ({ browser }) => {
  const host = await browser.newPage();
  const errors = [];
  host.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  host.on('pageerror', (error) => errors.push(String(error)));
  const players = [];
  await host.goto('/host.html');
  await host.click('#create-btn');
  await expect(host.locator('#screen-lobby')).toBeVisible();
  const code = (await host.locator('#room-code').innerText()).trim();

  try {
    for (const name of ['Alpha', 'Bravo']) {
      const player = await browser.newPage();
      await player.goto('/');
      await player.fill('#join-code', code);
      await player.fill('#join-name', name);
      await player.click('#join-btn');
      await expect(player.locator('#screen-play')).toBeVisible();
      players.push(player);
    }

    await expect(host.locator('#player-count')).toHaveText('2');
    const toggles = host.locator('#game-toggles label');
    for (let i = 0; i < await toggles.count(); i++) {
      const label = toggles.nth(i);
      const checkbox = label.locator('input');
      if ((await label.innerText()).includes('RGB Color Match')) await checkbox.check();
      else await checkbox.uncheck();
    }
    await host.click('#start-btn');
    await expect(host.locator('#host-content')).toContainText('How to play');
    await host.click('#next-btn');
    await expect(host.locator('#host-bar')).toBeVisible();
    const extend = host.locator('#extend-btn');
    await expect(extend).toBeVisible();
    await extend.click();
    await expect(extend).toBeDisabled();
    await expect(host.locator('#host-content')).toContainText(/\d+s/);
    await expect(host.locator('#extend-feedback')).toHaveText('Timer extended by 15 seconds.');

    // Force the second browser click to prove a rejected acknowledgement is
    // rendered, even if a stale client sends the request after success.
    await extend.evaluate((button) => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await expect(host.locator('#extend-feedback')).toHaveText('Timer already extended.');
    await expect(extend).toBeDisabled();

    await host.click('#skip-btn');
    await expect(extend).toBeEnabled();
    await expect(host.locator('#extend-feedback')).toHaveText('');
  } finally {
    await Promise.all(players.map((player) => player.close()));
    await host.close();
  }
});