import { expect, test } from "@playwright/test";

test("メニューから始めたゲームを Esc で抜けると、メニューが描画されて再度始められる", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?bgm=0&countdown=0&opening=0");
  await page.waitForTimeout(400);
  // 1 PLAYER → ENDLESS
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  // 初回案内の Escape は「あとで」。次の Escape がゲームからメニューへ戻る。
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  const active = () =>
    page.evaluate(() => (window as any).__swaprise.scene.scene.manager.getScenes(true).map((s: any) => s.scene.key));
  expect(await active()).toEqual(["menu"]);
  expect(errors).toEqual([]);
  // メニューが動いている（カーソル移動と再開始ができる）。前回がエンドレスなので 1 PLAYER を開くとカーソルは ENDLESS。その下が TIME ATTACK
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__swapriseScenes.menu.index)).toBe(0);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__swapriseScenes.menu.index)).toBe(1);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  expect(await active()).toEqual(["game"]);
  const mode = await page.evaluate(() => (window as any).__swaprise.game.mode);
  expect(mode).toBe("timeattack");
  expect(errors).toEqual([]);
});

test("ゲームオーバー後に Esc でメニューへ戻る", async ({ page }) => {
  await page.goto("/?mode=endless&seed=3&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    const col: number[] = [];
    for (let r = 0; r < 12; r++) col.push(r % 2);
    b.setColumns([col]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.finished);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const active = await page.evaluate(() => {
    const s = (window as any).__swaprise.scene;
    return s.scene.manager.getScenes(true).map((x: any) => x.scene.key);
  });
  expect(active).toEqual(["menu"]);
});
