import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.scores.publish.v1", "true"));
});
test("endless hints preview the current board without changing the game; assisted runs are unranked", async ({ page }) => {
  const uploads: string[] = [];
  page.on("request", r => { if (r.method() === "POST" && r.url().includes("/api/")) uploads.push(r.url()); });
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await expect(page.locator(".coach-open")).toBeVisible();
  const original = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.setPaused(true);
    p.game.boards[0].setColumns([[2, 1, 0, 0, 4, 0, 1, 1, 3], [4, 3], [4, 3]]);
    return JSON.stringify(p.game.boards[0].syncState());
  });
  await page.getByRole("button", { name: "HINT", exact: true }).click();
  await page.getByRole("button", { name: "FIND CHAIN", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Found 3-chain", { timeout: 15000 });
  await page.getByRole("button", { name: "PLAY / PAUSE", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Preview complete: 3-chain", { timeout: 20000 });
  expect(await page.evaluate(() => JSON.stringify((window as any).__swaprise.game.boards[0].syncState()))).toBe(original);
  await page.getByRole("button", { name: "BACK TO GAME", exact: true }).click();
  await expect(page.locator(".training")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.paused)).toBe(true);
  await page.evaluate(() => { const p = (window as any).__swaprise; p.game.boards[0].score = 987654; p.scene.finish(); });
  expect(await page.evaluate(() => localStorage.getItem("swaprise.highscores.v1") ?? "")).not.toContain("987654");
  expect(uploads).toEqual([]);
});
test("closing during search cancels; merely opening leaves ranked eligibility intact", async ({ page }) => {
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await page.getByRole("button", { name: "HINT", exact: true }).click();
  expect(await page.evaluate(() => (window as any).__swaprise.scene.assisted)).toBe(false);
  await page.getByRole("button", { name: "FIND CHAIN", exact: true }).click();
  await page.getByRole("button", { name: "BACK TO GAME", exact: true }).click();
  await expect(page.locator(".training")).toHaveCount(0);
  await page.waitForTimeout(200);
  await expect(page.locator(".training")).toHaveCount(0);
  await page.goto("/?mode=timeattack&bgm=0&countdown=0");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".coach-open")).toHaveCount(0);
});
