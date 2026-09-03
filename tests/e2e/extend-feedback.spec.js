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

    // A real user click after success must not change the disabled control.
    await extend.click({ force: true });
    await expect(host.locator('#extend-feedback')).toHaveText('Timer extended by 15 seconds.');

    // A stale client can still send a second request. Exercise the real click
    // path after enabling the control and verify the rejected acknowledgement.
    await extend.evaluate((button) => { button.disabled = false; });
    await extend.click();
    await expect(host.locator('#extend-feedback')).toHaveText('Timer already extended.');
    await expect(extend).toBeEnabled();

    await host.click('#skip-btn');
    await expect(extend).toBeEnabled();
    await expect(host.locator('#extend-feedback')).toHaveText('');
    expect(errors, `host errors: ${errors.join(' | ')}`).toEqual([]);
  } finally {
    await Promise.all(players.map((player) => player.close()));
    await host.close();
  }
});