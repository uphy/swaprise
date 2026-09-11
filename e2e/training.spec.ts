import { test, expect, type Page } from "@playwright/test";
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.scores.publish.v1", "true"));
});
async function prepare(page: Page, multi = false) {
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.scene));
  await expect(page.locator(".coach-controls")).toBeHidden();
  return page.evaluate(multi => {
    const p = (window as any).__swaprise; p.scene.setPaused(true);
    p.game.boards[0].setColumns(multi ? [[2,3,0,0,4,0,1,1,3],[4,1],[4,3]] : [[2,1,0,0,4,0,1,1,3],[4,3],[4,3]]);
    return JSON.stringify(p.game.boards[0].syncState());
  }, multi);
}
async function openHint(page: Page) {
  const point = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const button = p.scene.pauseButtons.find((b: any) => b.name === "pause-hint");
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const scale = rect.width / p.layout.width;
    return { x: rect.left + button.x * scale, y: rect.top + button.y * scale };
  });
  await page.touchscreen.tap(point.x, point.y);
}
test("hints use the existing view, animate one move, rewind and preserve the original", async ({ page }) => {
  const original = await prepare(page);
  const view = await page.evaluateHandle(() => (window as any).__swaprise.scene.views[0]);
  await openHint(page);
  await expect(page.locator(".coach-controls button:visible")).toHaveCount(3);
  await expect(page.locator(".training")).toHaveCount(0);
  const next = page.getByRole("button", { name: "NEXT STEP", exact: true });
  const previous = page.getByRole("button", { name: "PREVIOUS STEP", exact: true });
  for (const button of [next, previous]) {
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(64); expect(box.width).toBeGreaterThanOrEqual(100);
  }
  await expect(next).toBeEnabled({ timeout: 15000 });
  expect(await page.evaluate(view => (window as any).__swaprise.scene.views[0] === view, view)).toBe(true);
  expect(await page.evaluate(() => Boolean((window as any).__swaprise.scene.views[0].hintPair))).toBe(true);
  await next.click();
  await expect.poll(() => page.evaluate(() => (window as any).__swaprise.scene.coach.running)).toBe(true);
  await expect(next).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].preview === (window as any).__swaprise.scene.coach.board)).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__swaprise.scene.coach.running), { timeout: 15000 }).toBe(false);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.coach.board.maxChain)).toBe(3);
  expect(await page.evaluate(() => JSON.stringify((window as any).__swaprise.game.boards[0].syncState()))).toBe(original);
  await previous.click(); await expect(next).toBeEnabled(); await expect(previous).toBeDisabled();
  // Exit and pause in the same task, before the live game gets another frame.
  await page.evaluate(() => { const s = (window as any).__swaprise.scene; s.closeCoach(); s.setPaused(true); });
  expect(await page.evaluate(() => JSON.stringify((window as any).__swaprise.game.boards[0].syncState()))).toBe(original);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].preview)).toBeNull();
});
test("opening once excludes records, cancellation is safe, restart restores eligibility", async ({ page }) => {
  await prepare(page);
  await openHint(page);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.scoreRun)).toBeNull();
  await page.getByRole("button", { name: "HINT", exact: true }).click();
  await expect(page.getByRole("button", { name: "NEXT STEP", exact: true })).toBeHidden();
  await page.evaluate(() => { const p = (window as any).__swaprise; p.scene.setPaused(true); p.game.boards[0].score = 987654; p.scene.finish(); });
  expect(await page.evaluate(() => localStorage.getItem("swaprise.highscores.v1") ?? "")).not.toContain("987654");
  await page.evaluate(() => (window as any).__swaprise.scene.restart());
  await expect(page.locator(".coach-controls")).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as any).__swaprise.scene.assisted)).toBe(false);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.scoreRun)).not.toBeNull();
});
test("multiple moves never auto-advance, and PREVIOUS interrupts animation", async ({ page }) => {
  await prepare(page, true);
  await openHint(page);
  const next = page.getByRole("button", { name: "NEXT STEP", exact: true });
  const previous = page.getByRole("button", { name: "PREVIOUS STEP", exact: true });
  await expect(next).toBeEnabled({ timeout: 15000 });
  const initial = await page.evaluate(() => JSON.stringify((window as any).__swaprise.scene.coach.board.syncState()));
  await next.click();
  await expect(next).toBeEnabled({ timeout: 15000 });
  const stopped = await page.evaluate(() => JSON.stringify((window as any).__swaprise.scene.coach.board.syncState()));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => JSON.stringify((window as any).__swaprise.scene.coach.board.syncState()))).toBe(stopped);
  await next.click(); await previous.click();
  expect(await page.evaluate(() => JSON.stringify((window as any).__swaprise.scene.coach.board.syncState()))).toBe(stopped);
  await previous.click();
  expect(await page.evaluate(() => JSON.stringify((window as any).__swaprise.scene.coach.board.syncState()))).toBe(initial);
});
