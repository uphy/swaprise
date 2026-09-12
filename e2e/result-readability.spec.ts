import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 412, height: 800 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: "ja-JP" });

for (const mode of ["endless", "timeattack", "puzzle"]) {
  test(`${mode}: スマホの終了表示を大きく読み取れ、回転しても操作できる`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("swaprise.scores.publish.v1", "false"));
    await page.goto(`/?mode=${mode}&bgm=0&countdown=0`);
    await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
    await page.evaluate(() => {
      const { game } = (window as any).__swaprise;
      game.boards[0].score = 12345;
      game.puzzleResult = "clear";
      game.finished = true;
    });
    if (mode === "puzzle") {
      await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].overlayBody.alpha === 1);
      const text = await page.evaluate(() => {
        const { scene } = (window as any).__swaprise;
        const view = scene.views[0];
        const body = view.overlayBody;
        const canvas = scene.game.canvas;
        const scale = view.scale * scene.cameras.main.zoom * canvas.getBoundingClientRect().width / canvas.width;
        return { font: parseFloat(body.style.fontSize) * scale, width: body.width, text: body.text };
      });
      expect(text.font).toBeGreaterThanOrEqual(26);
      expect(text.width).toBeLessThanOrEqual(176);
      expect(text.text).toContain("残り手数");
      return;
    }
    await expect(page.locator(".score-result")).toBeVisible();
    const fonts = await page.locator(".score-result").evaluate((root) => ({
      score: parseFloat(getComputedStyle(root.querySelector(".result-summary strong")!).fontSize),
      body: parseFloat(getComputedStyle(root.querySelector(".result-summary p")!).fontSize),
      overflow: root.scrollWidth > root.clientWidth,
    }));
    expect(fonts.score).toBeGreaterThanOrEqual(44);
    expect(fonts.body).toBeGreaterThanOrEqual(22);
    expect(fonts.overflow).toBe(false);
    await page.setViewportSize({ width: 915, height: 412 });
    const scroll = page.locator(".score-result .score-content");
    expect(await scroll.evaluate((el) => el.clientHeight)).toBeGreaterThan(100);
    // 結果の本文をスクロールしても、再開操作は画面内に残る。
    await scroll.evaluate((el) => el.scrollTop = el.scrollHeight);
    const retry = page.getByRole("button", { name: "リトライ", exact: true });
    const box = (await retry.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(412);
    await retry.click();
    await expect(page.locator(".score-result")).toHaveCount(0);
  });
}

test("短いタイムアタックでも大きな戦績画面を出し、完走に時間切れとは書かない", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.scores.publish.v1", "true"));
  const requests: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/")) requests.push(r.url()); });
  await page.goto("/?mode=timeattack&time=1&seed=7&bgm=0&countdown=0");
  const result = page.locator(".score-result");
  await expect(result).toBeVisible({ timeout: 10000 });
  await expect(result).not.toContainText("時間切れ");
  await expect(result.locator("h2")).toHaveCount(0);
  expect(await result.locator(".result-summary strong").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(60);
  await expect(result).toContainText("最大連鎖");
  expect(requests).toEqual([]);
  await page.getByRole("button", { name: "リトライ", exact: true }).click();
  await expect(result).toHaveCount(0);
});
