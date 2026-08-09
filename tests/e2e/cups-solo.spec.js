// Issue #46 end-to-end proof: Follow the Cup, solo, all ten levels, with REAL
// pointer input on the visible canvas.
//
// This is the acceptance test the unit suites cannot give: that a real browser
// running the real bundle renders a visible canvas each level, that clicking
// the correct cup (derived from the SAME shared module the app animates from,
// not by mutating app state) advances the run, that ten levels play through
// with no page or console errors, and that the run submits at the end.
//
// The correct cup is DERIVED, never forced: we import /shared/cups.js in the
// page to read where the ball is (it is on screen for anyone watching — that is
// the game), compute that cup's on-canvas coordinate, and issue a genuine
// mouse click there. No synthetic app events, no state writes.

import { test, expect } from '@playwright/test';

const CUP_TONE_NOTE = 'Where is it? Tap a cup.'; // the "choose" phase prompt

test.describe.configure({ mode: 'serial' });

test('cups solo: ten levels of real clicks, visible canvas, clean console, final submit', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/');

  // Enter solo practice.
  await page.fill('#join-name', 'E2E');
  await page.click('#solo-btn');

  // The solo menu lists every game; pick Follow the Cup.
  const cupsButton = page.locator('#content button', { hasText: 'Follow the Cup' });
  await expect(cupsButton).toBeVisible();
  await cupsButton.click();

  // A how-to tutorial plays first; the lone player presses Play to start.
  const playButton = page.locator('#content button', { hasText: 'Play' });
  await expect(playButton).toBeVisible();
  await playButton.click();

  // The minigame is up: wait for the read-only diagnostic seam to publish the
  // round's clientData (seed, baseCups, maxLevels) and for the canvas.
  await page.waitForFunction(() => window.__lastMinigame && window.__lastMinigame.key === 'cups');
  const meta = await page.evaluate(() => window.__lastMinigame);
  expect(meta.completion).toBe(true); // completion-mode: no countdown / auto-submit
  const { seed, baseCups, maxLevels } = meta.clientData;
  expect(maxLevels).toBe(10);

  const canvas = page.locator('#game-root canvas');
  await expect(canvas).toBeVisible();

  // Derive the correct cup for a level and its on-canvas x, using the SAME
  // shared module the client animates from. Mirrors homeXs()/cupW() geometry.
  async function levelPlan(level) {
    return await page.evaluate(async ({ seed, baseCups, level }) => {
      const mod = await import('/shared/cups.js');
      const plan = mod.cupsLevel(seed, level, { baseCups });
      return { ball: plan.ball, cups: plan.cups, swapMs: plan.swapMs, swaps: plan.swaps.length };
    }, { seed, baseCups, level });
  }

  // Sample the canvas: nonzero client size + non-uniform, non-transparent
  // pixels. A blank/transparent canvas fails here. The client paints every
  // rAF frame, so we poll rather than one-shot sample — the only way to fail
  // is a canvas that NEVER renders within the timeout, not one caught in the
  // gap before its first paint.
  const sampleCanvas = () => page.evaluate(() => {
    const c = document.querySelector('#game-root canvas');
    if (!c) return { ok: false, reason: 'no canvas' };
    const rect = c.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return { ok: false, reason: `tiny ${rect.width}x${rect.height}` };
    const g = c.getContext('2d');
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let opaque = 0;
    const seenColors = new Set();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) opaque++;
      if (i % 400 === 0) seenColors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
    return { ok: opaque > 0 && seenColors.size > 1, opaque, colors: seenColors.size, w: rect.width, h: rect.height };
  });
  async function assertCanvasRendered(level) {
    let last = null;
    await expect
      .poll(async () => { last = await sampleCanvas(); return last.ok; },
        { timeout: 15_000, message: () => `level ${level}: canvas visible & non-transparent (${JSON.stringify(last)})` })
      .toBe(true);
  }

  // The x of a cup index in CSS pixels relative to the canvas, from the client's
  // own layout: PAD = 24, w = canvas CSS width, homeX(i) = PAD + (w-2*PAD)*((i+0.5)/n).
  async function cupClickPoint(cupIndex, cups) {
    return await page.evaluate(({ cupIndex, cups }) => {
      const c = document.querySelector('#game-root canvas');
      const rect = c.getBoundingClientRect();
      const PAD = 24;
      const w = rect.width;
      const x = PAD + (w - 2 * PAD) * ((cupIndex + 0.5) / cups);
      return { x: rect.left + x, y: rect.top + rect.height / 2 };
    }, { cupIndex, cups });
  }

  const noteText = () => page.locator('#game-root p.trial-note').innerText().catch(() => '');

  for (let level = 1; level <= 10; level++) {
    const plan = await levelPlan(level);

    // The level renders (beat → reveal → shuffle → choose). Assert the canvas
    // is up and visible while the shuffle is happening.
    await assertCanvasRendered(level);

    // Wait for the "choose" phase: the client only accepts a tap then.
    await expect
      .poll(async () => await noteText(), { timeout: 30_000, message: `level ${level}: reach choose phase` })
      .toContain(CUP_TONE_NOTE);

    // Canvas is still rendered at the choose moment.
    await assertCanvasRendered(level);

    // Real pointer click on the correct cup.
    const pt = await cupClickPoint(plan.ball, plan.cups);
    await page.mouse.move(pt.x, pt.y);
    await page.mouse.down();
    await page.mouse.up();

    if (level < 10) {
      // The verdict shows, then the next level's beat card. Wait until the
      // choose prompt is gone (verdict/next-level) before looping.
      await expect
        .poll(async () => await noteText(), { timeout: 30_000, message: `level ${level}: leave choose phase` })
        .not.toContain(CUP_TONE_NOTE);
    }
  }

  // After level 10 the client submits itself. In solo practice the transient
  // "✓ Submitted" screen is quickly replaced by the unscored result card
  // ("🔧 Follow the Cup: <raw> pts"). Accept either as proof of completion.
  await expect
    .poll(async () => await page.locator('#content').innerText(),
      { timeout: 30_000, message: 'run submitted / completed' })
    .toMatch(/Submitted|Follow the Cup/);

  // No page errors and no console errors across the whole run.
  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(consoleErrors, `console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
});
