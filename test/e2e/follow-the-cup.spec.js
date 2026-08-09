import { test, expect } from '@playwright/test';

const nonTransparentPixels = async (canvas) => canvas.evaluate((element) => {
  const pixels = element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
  let count = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i]) count += 1;
  }
  return count;
});

test('Follow the Cup plays and submits all ten levels in solo practice', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Practice solo/i }).click();
  await page.getByRole('button', { name: /Follow the Cup/i }).click();
  await page.getByRole('button', { name: /Play/i }).click();

  const tag = page.locator('#game-root .mash-count');
  const note = page.locator('#game-root .trial-note');
  const canvas = page.locator('#game-root canvas.game');
  const seenLevels = [];

  for (let level = 1; level <= 10; level += 1) {
    await expect(tag).toContainText(`LEVEL ${level}`);
    await expect(note).toHaveText(/Where is it\? Tap a cup\./);
    await expect(canvas).toBeVisible();
    expect(await nonTransparentPixels(canvas), `level ${level} canvas is blank`).toBeGreaterThan(0);
    seenLevels.push(level);

    const box = await canvas.boundingBox();
    expect(box, `level ${level} canvas has no bounding box`).not.toBeNull();
    // The selected cup is intentionally not asserted: this path verifies that
    // misses still advance and that the player can finish the complete run.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  await expect(page.locator('#content')).toContainText('Follow the Cup:');
  await expect(page.locator('#content')).toContainText('Unscored practice run.');
  expect(seenLevels).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(pageErrors).toEqual([]);
});
