import { expect, test } from "@playwright/test";

test("タイムアタック: 完走すると盤面に TIME UP を短く出し、結果画面には終了理由の見出しを出さず、得点と記録を残す", async ({ page }) => {
  await page.goto("/?mode=timeattack&seed=7&bgm=0&countdown=0&time=3");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { limit: p.game.timeLimit, text: p.scene.views[0].timeText.text, info: p.scene.views[0].infoLine, boards: p.game.boards.length };
  });
  expect(info.limit).toBe(180);
  expect(info.boards).toBe(1);
  // 残り時間は盤面の上の板にあり、下の札の並びには入れない
  expect(info.text).toMatch(/^0:0[123]$/);
  expect(info.info).toMatch(/^SPEED 1/);

  await page.waitForFunction(() => (window as any).__swaprise.game.finished, null, { timeout: 10_000 });
  const result = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const v = p.scene.views[0];
    return {
      timeUp: p.game.timeUp,
      gameOver: p.game.boards[0].gameOver,
      title: v.overlayTitle.text,
      time: v.timeText.text,
      stored: JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}"),
    };
  });
  expect(result.timeUp).toBe(true);
  expect(result.gameOver).toBe(false);
  // 盤面には短く TIME UP を出す。結果画面には終了理由の見出しを出さない
  expect(result.title).toBe("TIME UP");
  await expect(page.locator(".score-result")).toBeVisible();
  await expect(page.locator(".score-result h2")).toHaveCount(0);
  expect(result.time).toBe("0:00");
  expect(result.stored.timeattack).toHaveLength(1);
  expect(result.stored.endless ?? []).toHaveLength(0);
});

test("タイムアタック: 残り時間は得点と同じ大きさで盤面の上に出し、最後の 10 秒は秒を盤面に大きく出す", async ({ page }) => {
  await page.goto("/?mode=timeattack&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  const top = await page.evaluate(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return { timeY: v.timeText.y, scoreY: v.scoreText.y, timeSize: v.timeText.style.fontSize, scoreSize: v.scoreText.style.fontSize, count: v.countText.visible, timeX: v.timeText.x, scoreX: v.scoreText.x };
  });
  expect(top.timeY).toBeLessThan(0);
  expect(top.timeY).toBe(top.scoreY);
  expect(top.timeSize).toBe(top.scoreSize);
  expect(top.timeX).toBeLessThan(top.scoreX);
  expect(top.count).toBe(false);
  // 残り 5 秒
  await page.evaluate(() => { const p = (window as any).__swaprise; p.game.boards[0].frame = p.game.timeLimit - 5 * 60 + 1; });
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].countText.visible);
  const count = await page.evaluate(() => { const v = (window as any).__swaprise.scene.views[0]; return { text: v.countText.text, alpha: v.countText.alpha }; });
  expect(Number(count.text)).toBeGreaterThanOrEqual(4);
  expect(Number(count.text)).toBeLessThanOrEqual(5);
  expect(count.alpha).toBeLessThan(0.6);
  // 数字は盤面の井戸の上、パネルの下に描き、パネルの色を濁らせない
  const order = await page.evaluate(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return { count: v.root.getIndex(v.countText), frame: v.root.getIndex(v.frame), panel: v.root.getIndex(v.cells[0][0]), next: v.root.getIndex(v.nextCells[0]) };
  });
  expect(order.count).toBeGreaterThan(order.frame);
  expect(order.count).toBeLessThan(order.panel);
  expect(order.count).toBeLessThan(order.next);
});
