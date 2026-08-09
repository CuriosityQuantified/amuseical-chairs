// Issue #48 end-to-end proof: per-turn answer feedback in a real browser.
//
// Canonical game is Bisect the Line — after each of its five taps the device
// must visibly show the player's own answer, the correct answer, a
// correct/incorrect state, turn progress, and a Next control, and must NOT
// advance to the next turn until that feedback was shown. A second applicable
// game (Proportion Sense) proves the same contract on a different interaction.
// No page errors and no console errors are tolerated.

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

function trackErrors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  return { consoleErrors, pageErrors };
}

async function enterSoloGame(page, buttonText, key) {
  await page.goto('/');
  await page.fill('#join-name', 'E2E');
  await page.click('#solo-btn');
  const gameButton = page.locator('#content button', { hasText: buttonText });
  await expect(gameButton).toBeVisible();
  await gameButton.click();
  const playButton = page.locator('#content button', { hasText: 'Play' });
  await expect(playButton).toBeVisible();
  await playButton.click();
  await page.waitForFunction((k) => window.__lastMinigame && window.__lastMinigame.key === k, key);
}

const panel = (page) => page.locator('[data-testid="turn-feedback"]');
const nextBtn = (page) => page.locator('[data-testid="feedback-next"]');

async function assertFeedbackShown(page, turnNo, total) {
  const fb = panel(page);
  await expect(fb).toBeVisible();
  await expect(fb).toContainText('Your answer');
  await expect(fb).toContainText('Correct answer');
  // A correct/incorrect state badge and turn progress are present.
  await expect(fb.locator('.fb-state')).toBeVisible();
  await expect(fb).toContainText(`${turnNo} of ${total}`);
  await expect(nextBtn(page)).toBeVisible();
}

// Continue past the feedback. The explicit Next control dismisses it; the panel
// also auto-advances after a readable delay, so tolerate it already being gone
// (no sleeps, no race). The pre-turn assertions prove the next turn never
// appears while feedback is up.
async function continueTurn(page) {
  await nextBtn(page).click({ timeout: 1200 }).catch(() => {});
  await expect(panel(page)).toHaveCount(0);
}

test('bisect: feedback after each of five turns, before the next turn', async ({ page }) => {
  const { consoleErrors, pageErrors } = trackErrors(page);
  await enterSoloGame(page, 'Bisect the Line', 'bisect');

  const canvas = page.locator('#game-root canvas');
  await expect(canvas).toBeVisible();

  for (let turn = 1; turn <= 5; turn++) {
    // The prompt for THIS turn must be showing (the previous turn's feedback
    // has been dismissed) and no feedback panel is up yet.
    const prompt = page.locator('#game-root h2.center');
    await expect(prompt).toContainText('Tap at');
    await expect(panel(page)).toHaveCount(0);

    // Real pointer click on the line at roughly the middle.
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);

    // Feedback appears for the committed turn, before the next turn is drawn.
    await assertFeedbackShown(page, turn, 5);

    // Continue explicitly; the next prompt only appears after this.
    await continueTurn(page);
  }

  // After the fifth turn's continuation the round submits.
  await expect(page.locator('#content')).toContainText(/Submitted|practice run/, { timeout: 10_000 });

  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});

test('proportion sense: feedback after each of four confirmations', async ({ page }) => {
  const { consoleErrors, pageErrors } = trackErrors(page);
  await enterSoloGame(page, 'Proportion Sense', 'area');

  const confirm = page.locator('#game-root button', { hasText: 'Confirm' });
  await expect(confirm).toBeVisible();

  for (let turn = 1; turn <= 4; turn++) {
    await expect(panel(page)).toHaveCount(0);
    await confirm.click();
    await assertFeedbackShown(page, turn, 4);
    await continueTurn(page);
  }

  await expect(page.locator('#content')).toContainText(/Submitted|practice run/, { timeout: 10_000 });

  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([]);
});
