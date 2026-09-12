import { expect, test, devices } from "@playwright/test";

const pixel = devices["Pixel 7"];
test.use({
  viewport: pixel.viewport,
  deviceScaleFactor: pixel.deviceScaleFactor,
  isMobile: pixel.isMobile,
  hasTouch: pixel.hasTouch,
  userAgent: pixel.userAgent,
});

test("戻る操作: ゲーム中は何も起きず、ページも離れない", async ({ page }) => {
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

  const activeScenes = () =>
    page.evaluate(() =>
      (window as any).__swaprise.scene.scene.manager.getScenes(true).map((s: any) => s.scene.key),
    );
  const frameAt = await page.evaluate(() => (window as any).__swaprise.game.boards[0].frame);
  await page.goBack();
  await page.waitForFunction((f) => (window as any).__swaprise.game.boards[0].frame > f + 30, frameAt);
  expect(await page.evaluate(() => (window as any).__swaprise?.scene.paused)).toBe(false);
  expect(await activeScenes()).toEqual(["game"]);
  expect(page.url()).toContain("seed=7");
  // 離れないこととやめる手順の案内を、盤面の外に数秒だけ出す
  const shown = await page.evaluate(() => {
    const s = (window as any).__swaprise.scene;
    const bottom = Math.max(...s.views.map((v: any) => v.oy + 384 * v.scale));
    return { visible: s.backHintText.visible, text: s.backHintText.text, top: s.backHintText.y - s.backHintText.height / 2, boardBottom: bottom };
  });
  expect(shown.visible).toBe(true);
  expect(shown.text).toContain("Back does not leave the game");
  expect(shown.top).toBeGreaterThan(shown.boardBottom);
  await page.waitForFunction(() => !(window as any).__swaprise.scene.backHintText.visible, null, { timeout: 8000 });

  // 何度戻っても同じ。ポーズ中・終了後も同じ
  await page.goBack();
  await page.goBack();
  await page.evaluate(() => (window as any).__swaprise.scene.setPaused(true));
  await page.goBack();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__swaprise?.scene.paused)).toBe(true);
  expect(await activeScenes()).toEqual(["game"]);
  expect(page.url()).toContain("seed=7");

  // メニューへ戻ると、積んだ履歴は消えて元のURLに戻る
  await page.evaluate(() => (window as any).__swaprise.scene.toMenu());
  await page.waitForFunction(
    () => (window as any).__swaprise.scene.scene.manager.getScenes(true).map((s: any) => s.scene.key).join() === "menu",
  );
  expect(page.url()).toContain("seed=7");
});
