import { test, expect } from '@playwright/test';

test('solo practice ignores rapid duplicate game selections without alerts', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto('/');
  await page.fill('#join-name', 'Rapid Solo');
  await page.click('#solo-btn');

  const button = page.locator('#content button', { hasText: 'RGB Color Match' });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  const immediateState = await button.evaluate((choice) => {
    choice.click();
    return {
      choiceCount: document.querySelectorAll('#content .solo-choice').length,
      disabled: choice.disabled,
    };
  });
  expect(immediateState.choiceCount).toBe(24);
  expect(immediateState.disabled).toBe(true);
  for (let click = 0; click < 3; click++) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  await expect(page.locator('#content')).toContainText('RGB Color Match');
  await expect.poll(() => dialogs).toEqual([]);
});
