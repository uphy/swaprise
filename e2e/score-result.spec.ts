import { test, expect, type Page } from "@playwright/test";
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
async function finish(page: Page, score = 777) {
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await page.evaluate((score) => {
    const p = (window as any).__swaprise;
    p.game.boards[0].score = score; p.game.finished = true;
  }, score);
  await expect(page.getByRole("region", { name: "RESULT", exact: true })).toBeVisible();
}
for (const mode of ["endless", "timeattack"]) {
  test(`${mode}: personal comparison and own nearby ranking; retry is always available`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("swaprise.scores.publish.v1", "true");
      localStorage.setItem("swaprise.highscores.v1", JSON.stringify({ endless: [{ score: 700 }], timeattack: [{ score: 700 }] }));
    });
    await page.route("**/api/session", (r) => r.fulfill({ json: { ok: true } }));
    let published = false;
    await page.route("**/api/scores", async (r) => { published = true; await r.fulfill({ json: { ok: true } }); });
    await page.route("**/api/scores?*", async (r) => {
      const id = new URL(r.request().url()).searchParams.get("around");
      if (!published) return r.fulfill({ status: 404, json: {} });
      await r.fulfill({ json: { rank: 63, total: 100, scores: [
        { id: "before", name: "Same name", score: 800, maxChain: 3, rank: 62 },
        { id, name: "<img src=x>", score: 777, maxChain: 3, rank: 63 },
        { id: "after", name: "Same name", score: 760, maxChain: 3, rank: 64 },
      ] } });
    });
    await page.goto(`/?mode=${mode}&bgm=0&countdown=0`);
    await finish(page);
    await expect(page.getByRole("region", { name: "RESULT" })).toContainText("New best! +77");
    await expect(page.getByRole("status")).toContainText("#63 / 100 records");
    await expect(page.locator("[aria-current=true]")).toContainText("<img src=x> · THIS RUN");
    expect(await page.locator(".score-result ol").evaluate((el) => getComputedStyle(el).listStylePosition)).toBe("inside");
    await expect(page.locator(".score-result img")).toHaveCount(0);
    const retry = page.getByRole("button", { name: "RETRY", exact: true });
    const box = await retry.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(56); expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await retry.click();
    await expect(page.locator(".score-result")).toHaveCount(0);
    await finish(page, 700);
    await expect(page.locator(".result-summary")).toContainText("77 to your best");
    await expect(page.locator(".result-summary")).toContainText("vs previous 1 average: -10%");
  });
}
test("private results make no requests and menu remains available after rotation", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.scores.publish.v1", "false"));
  const requests: string[] = []; page.on("request", (r) => { if (r.url().includes("/api/")) requests.push(r.url()); });
  await page.goto("/?mode=endless&bgm=0&countdown=0"); await finish(page);
  await expect(page.getByRole("status")).toContainText("Private record"); expect(requests).toEqual([]);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole("button", { name: "MENU", exact: true }).click();
  await expect(page.locator(".score-result")).toHaveCount(0);
});
test("time up blocks input, settles the last chain, then posts final points with 7200 input frames", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.scores.publish.v1", "true"));
  await page.route("**/api/session", (r) => r.fulfill({ json: { ok: true } }));
  const posts: any[] = [];
  await page.route("**/api/scores", (r) => { posts.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true } }); });
  await page.route("**/api/scores?*", (r) => r.fulfill({ status: 503, json: {} }));
  await page.goto("/?mode=timeattack&countdown=0&bgm=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await page.evaluate(() => {
    const p = (window as any).__swaprise; p.scene.scene.pause();
    const b = p.game.boards[0]; b.frame = 7199; b.score = 0;
    b.setColumns([[2, 1, 0, 0, 4, 0, 1, 1, 3], [4, 3], [4, 3]]);
    b.cursor.x = 0; b.cursor.y = 4;
    p.tick([{ moveX: 0, moveY: 0, swap: true, raise: false }]);
  });
  expect(await page.evaluate(() => (window as any).__swaprise.game.timeUp)).toBe(true);
  expect(await page.evaluate(() => (window as any).__swaprise.game.finished)).toBe(false);
  expect(posts).toHaveLength(0); await expect(page.locator(".score-result")).toHaveCount(0);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    for (let i = 0; i < 2000 && !p.game.finished; i++) p.tick([{ moveX: 1, moveY: 1, swap: true, raise: true }]);
    p.scene.scene.resume();
  });
  await expect(page.locator(".score-result")).toBeVisible();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]).toMatchObject({ score: 220, maxChain: 3, frames: 7200, rules: "scores-ta-v2" });
  await expect(page.getByRole("status")).toContainText("Could not load rankings");
  await page.getByRole("button", { name: "RETRY", exact: true }).click();
  await expect(page.locator(".score-result")).toHaveCount(0);
});
