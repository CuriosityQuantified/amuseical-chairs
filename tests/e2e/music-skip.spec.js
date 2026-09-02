import { test, expect } from '@playwright/test';

test('skipping music does not overwrite a later Caption Battle prompt', async ({ browser }) => {
  const host = await browser.newPage();
  const errors = [];
  host.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  host.on('pageerror', (error) => errors.push(String(error)));

  await host.goto('/host.html');
  await host.click('#create-btn');
  await expect(host.locator('#screen-lobby')).toBeVisible();
  const code = (await host.locator('#room-code').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{4}$/);
  const players = [];
  for (const name of ['Alpha', 'Bravo']) {
    const page = await browser.newPage();
    await page.goto('/');
    await page.fill('#join-code', code);
    await page.fill('#join-name', name);
    await page.click('#join-btn');
    await expect(page.locator('#screen-play')).toBeVisible();
    players.push(page);
  }

  try {
    const toggles = host.locator('#game-toggles label');
    for (let i = 0; i < await toggles.count(); i++) {
      const label = toggles.nth(i);
      const checkbox = label.locator('input');
      if ((await label.innerText()).includes('Caption Battle')) await checkbox.check();
      else {
        await checkbox.uncheck();
        await host.waitForTimeout(100);
      }
    }

    await expect(host.locator('#player-count')).toHaveText('2');
    await host.click('#start-btn');
    await expect(host.locator('#host-content')).toContainText('How to play');
    await host.click('#next-btn');

    for (const [page, answer] of players.map((page, i) => [page, `caption ${i}`])) {
      await expect(page.locator('#game-root input')).toBeVisible();
      await page.locator('#game-root input').fill(answer);
      await page.getByRole('button', { name: 'Lock it in' }).click();
    }

    await expect(host.locator('#host-content h2')).toBeVisible();
    const prompt = await host.locator('#host-content h2').innerText();
    expect(prompt).not.toBe('🛑 THE MUSIC STOPPED!');
    await host.waitForTimeout(7_500);
    await expect(host.locator('#host-content h2')).toHaveText(prompt);
    expect(errors, `host errors: ${errors.join(' | ')}`).toEqual([]);
  } finally {
    await Promise.all(players.map((page) => page.close()));
    await host.close();
  }
});
