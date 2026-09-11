import { expect, test, devices } from "@playwright/test";

const pixel = devices["Pixel 7"];
test.use({
  viewport: pixel.viewport,
  deviceScaleFactor: pixel.deviceScaleFactor,
  isMobile: pixel.isMobile,
  hasTouch: pixel.hasTouch,
  userAgent: pixel.userAgent,
});

test("戻る操作: 1回目はポーズ、2回目でメニュー。ページは離れない", async ({ page }) => {
  await page.goto("/?bgm=0&countdown=0&opening=0");
  await page.waitForTimeout(300);
  await page.goto("/?mode=versus&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);

  // 縦持ちの対戦は、画面端のジェスチャ領域（約24dp）に盤面がかからない
  const margins = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const canvas = document.querySelector("canvas")!;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / p.layout.width;
    const left = p.scene.views[0];
    const right = p.scene.views[1];
    return {
      left: rect.left + left.ox * scale,
      right: window.innerWidth - (rect.left + (right.ox + 192 * right.scale) * scale),
    };
  });
  expect(margins.left).toBeGreaterThanOrEqual(24);
  expect(margins.right).toBeGreaterThanOrEqual(24);

  await page.goBack();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__swaprise?.scene.paused)).toBe(true);
  expect(page.url()).toContain("seed=7");

  await page.goBack();
  await page.waitForTimeout(400);
  const active = await page.evaluate(() =>
    (window as any).__swaprise.scene.scene.manager.getScenes(true).map((s: any) => s.scene.key),
  );
  expect(active).toEqual(["menu"]);
  expect(page.url()).toContain("seed=7");
});
