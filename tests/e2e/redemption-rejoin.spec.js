import { test, expect } from '@playwright/test';

test('two players restore the Musical Chairs reaction UI after a player rejoin', async ({ browser }) => {
  const host = await browser.newPage();
  const players = [];
  const errors = [];
  host.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  host.on('pageerror', (error) => errors.push(String(error)));
  try {
    await host.goto('/host.html');
    await host.click('#create-btn');
    await expect(host.locator('#screen-lobby')).toBeVisible();
    const code = (await host.locator('#room-code').innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{4}$/);
    for (const name of ['Alpha', 'Bravo']) {
      const page = await browser.newPage();
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`${name}: ${msg.text()}`); });
      page.on('pageerror', (error) => errors.push(`${name}: ${error}`));
      await page.goto('/');
      await page.fill('#join-code', code);
      await page.fill('#join-name', name);
      await page.click('#join-btn');
      await expect(page.locator('#screen-play')).toBeVisible();
      players.push(page);
    }

    const toggles = host.locator('#game-toggles label');
    for (let i = 0; i < await toggles.count(); i++) {
      const label = toggles.nth(i);
      const checkbox = label.locator('input');
      if ((await label.innerText()).includes('RGB')) await checkbox.check();
      else await checkbox.uncheck();
    }
    await host.click('#start-btn');
    await expect(host.locator('#screen-run')).toBeVisible();
    // Skip the regular game's music, tutorial, and timed game.
    await host.click('#next-btn');
    await host.click('#next-btn');
    await expect(host.locator('#skip-btn')).toBeVisible();
    await host.click('#skip-btn');
    await expect(host.locator('#next-btn')).toBeVisible();
    await host.click('#next-btn');
    // Skip the finale music and tutorial. The next phase is redemption.
    await host.click('#next-btn');
    await host.click('#next-btn');
    await expect(players[0].locator('#tapzone')).toBeVisible();
    await expect(players[0].locator('#tapzone-text')).toContainText('WAIT FOR GREEN');

    await players[0].reload();
    await players[0].fill('#join-code', code);
    await players[0].fill('#join-name', 'Alpha');
    await players[0].click('#join-btn');
    await expect(players[0].locator('#screen-play')).toBeVisible();
    await expect(players[0].locator('#tapzone')).toBeVisible();
    await expect(players[0].locator('#tapzone-text')).toContainText('WAIT FOR GREEN');
    await expect(players[1].locator('#tapzone')).toBeVisible();
    expect(errors, `browser errors: ${errors.join(' | ')}`).toEqual([]);
  } finally {
    await Promise.all(players.map((page) => page.close()));
    await host.close();
  }
});
