import { test, expect } from '@playwright/test';

test('player accepts lowercase room codes and rejects invalid four-character values', async ({ browser }) => {
  const host = await browser.newPage();
  const player = await browser.newPage();
  try {
    await host.goto('/host.html');
    await host.click('#create-btn');
    await expect(host.locator('#screen-lobby')).toBeVisible();
    const code = await host.locator('#room-code').innerText();

    await player.goto('/');
    await player.fill('#join-code', code.toLowerCase());
    await player.fill('#join-name', 'Lowercase');
    await player.click('#join-btn');
    await expect(player.locator('#screen-play')).toBeVisible();
    await expect(host.locator('#player-count')).toHaveText('1');

    await player.goto('/');
    await player.fill('#join-code', '!!!!');
    await player.fill('#join-name', 'Invalid');
    await player.click('#join-btn');
    await expect(player.locator('#join-error')).toHaveText('Enter the 4-letter room code.');
    await expect(player.locator('#screen-join')).toBeVisible();
  } finally {
    await host.close();
    await player.close();
  }
});
