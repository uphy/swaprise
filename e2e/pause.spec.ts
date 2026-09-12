import { expect, test } from "@playwright/test";

/** document.hidden を偽装して visibilitychange を投げる。Phaser はこれを見て "hidden" / "visible" を出す。 */
async function setHidden(page: import("@playwright/test").Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

test("画面が隠れるとポーズし、BGM が止まる。戻ってタップすると再開する", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  // 最初のフレームが進むまで待つ。固定時間だと CI の負荷（4 並列）で最初の描画が間に合わないことがある
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].frame > 0);
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => (window as any).__swaprise.game.boards[0].frame);
  expect(before).toBeGreaterThan(0);

  await setHidden(page, true);
  await page.waitForTimeout(100);
  const hidden = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { paused: p.scene.paused, frame: p.game.boards[0].frame, pauseVisible: p.scene.pauseMenu.visible };
  });
  expect(hidden.paused).toBe(true);
  expect(hidden.pauseVisible).toBe(true);

  await setHidden(page, false);
  await page.waitForTimeout(300);
  // 戻っただけでは再開しない
  const afterVisible = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { paused: p.scene.paused, frame: p.game.boards[0].frame };
  });
  expect(afterVisible.paused).toBe(true);
  expect(afterVisible.frame).toBe(hidden.frame);

  // ポーズ画面のボタン以外をタップすると再開し、フレームが進む
  await page.mouse.click(40, 40);
  await page.waitForTimeout(300);
  const resumed = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { paused: p.scene.paused, frame: p.game.boards[0].frame };
  });
  expect(resumed.paused).toBe(false);
  expect(resumed.frame).toBeGreaterThan(afterVisible.frame);
});

test("window の blur でもポーズする", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.paused)).toBe(true);
  await page.keyboard.press("p");
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.paused)).toBe(false);
});
