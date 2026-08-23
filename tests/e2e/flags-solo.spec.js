import { test, expect } from '@playwright/test';

function assertTwoByFour(boxes) {
  const rows = new Map();
  for (const box of boxes) {
    const y = Math.round(box.y);
    const row = [...rows.keys()].find((candidate) => Math.abs(candidate - y) <= 2) ?? y;
    rows.set(row, [...(rows.get(row) || []), box]);
  }
  expect(rows.size).toBe(2);
  for (const row of rows.values()) {
    expect(row).toHaveLength(4);
    row.sort((a, b) => a.x - b.x);
    for (let index = 1; index < row.length; index++) expect(row[index].x).toBeGreaterThanOrEqual(row[index - 1].x + row[index - 1].width - 1);
  }
}

test('flags solo: all ten rounds use real pointer input, feedback, responsive 2x4 choices, and one submit', async ({ page }) => {
  const pageErrors = [];
  const consoleErrors = [];
  let submissions = 0;
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('websocket', (socket) => socket.on('framesent', ({ payload }) => {
    if (String(payload).includes('player:submit')) submissions++;
  }));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.fill('#join-name', 'Flags E2E');
  await page.click('#solo-btn');
  await page.locator('#content button', { hasText: 'Flag Finder' }).click();
  await page.locator('#content button', { hasText: 'Play' }).click();

  for (let round = 1; round <= 10; round++) {
    await expect(page.locator('.flags-progress')).toHaveText(`Round ${round} of 10`);
    const image = page.locator('.flag-image');
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', /^\/assets\/flags\/[a-f0-9]{20}\.png$/);
    const dimensions = await image.evaluate((element) => ({ complete: element.complete, width: element.naturalWidth, height: element.naturalHeight }));
    expect(dimensions.complete).toBe(true);
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);

    const options = page.locator('.flag-option');
    await expect(options).toHaveCount(8);
    const boxes = await options.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right };
    }));
    assertTwoByFour(boxes);
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThanOrEqual(round === 1 ? 54 : 48);
    }

    const option = options.nth(0);
    const clickPoint = await option.boundingBox();
    await page.mouse.click(clickPoint.x + clickPoint.width / 2, clickPoint.y + clickPoint.height / 2);
    const feedback = page.locator('.flags-feedback');
    await expect(feedback).toContainText('Selected:');
    await expect(feedback).toContainText('Correct:');
    await expect(feedback).toContainText(/Correct|Incorrect/);

    if (round === 1) await page.setViewportSize({ width: 390, height: 844 });
  }

  await expect(page.locator('#content')).toContainText(/\d+\/10 flags/);
  expect(submissions).toBe(1);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
