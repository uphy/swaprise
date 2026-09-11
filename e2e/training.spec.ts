import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test("CPU hints, demonstration, slow playback, retry and lesson change stay local", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/")) requests.push(r.url()); });
  await page.goto("/?mode=training&bgm=0");
  await expect(page.getByRole("heading", { name: "CHAIN PRACTICE", exact: true })).toBeVisible();
  const before = await page.evaluate(() => JSON.stringify((window as any).__swapriseTraining.board.syncState()));
  await page.getByRole("button", { name: "HINT", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("highlighted area");
  expect(await page.evaluate(() => JSON.stringify((window as any).__swapriseTraining.board.syncState()))).toBe(before);
  await page.getByRole("button", { name: "HINT", exact: true }).click();
  await expect(page.locator(".training-hint")).toHaveCount(2);
  const pair = page.locator(".training-hint");
  await pair.nth(0).tap(); await pair.nth(1).tap();
  await expect(page.getByRole("status")).toContainText("Success!", { timeout: 15000 });
  await page.getByRole("button", { name: "TRY AGAIN", exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify((window as any).__swapriseTraining.board.syncState()))).toBe(before);
  await page.getByRole("button", { name: "DEMONSTRATION", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Demonstration ready");
  await page.getByRole("button", { name: "SLOW: OFF", exact: true }).click();
  await page.getByRole("button", { name: "RESUME", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__swapriseTraining.board.frame)).toBeGreaterThan(1);
  await page.getByRole("button", { name: "SLOW: ON", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Demonstration complete", { timeout: 15000 });
  await page.getByRole("button", { name: "NEXT LESSON", exact: true }).click();
  await expect(page.getByRole("combobox")).toHaveValue("1");
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("swaprise.highscores.v1"))).toBeNull();
  await page.getByRole("button", { name: "MENU", exact: true }).click();
  await expect(page.locator(".training")).toHaveCount(0);
});
test("enter via 1 PLAYER and cancel thinking by changing lesson", async ({ page }) => {
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.evaluate(() => { const s = (window as any).__swapriseScenes.menu; s.enterGroup("1p"); s.index = 3; s.select(); });
  await expect(page.locator(".training")).toBeVisible();
  await page.getByRole("button", { name: "HINT", exact: true }).click();
  await page.getByRole("combobox").selectOption("3");
  await expect(page.getByRole("status")).toContainText("Build a 3-chain");
  await expect(page.locator(".training-hint")).toHaveCount(0);
});

test("swipe a three-chain on a narrow Japanese mobile screen", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, locale: "ja-JP" });
  const page = await context.newPage();
  try {
    await page.goto("/?mode=training&bgm=0");
    await page.getByRole("combobox").selectOption("3");
    const hint = page.getByRole("button", { name: "ヒント", exact: true });
    await hint.click();
    await expect(page.getByRole("status")).toContainText("白枠のあたり");
    await hint.click();
    const pair = page.locator(".training-hint");
    await expect(pair).toHaveCount(2);
    const left = (await pair.nth(0).boundingBox())!;
    const right = (await pair.nth(1).boundingBox())!;
    await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
    await page.mouse.down();
    await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByRole("status")).toContainText("成功", { timeout: 15000 });
    expect(await page.locator(".training").evaluate((root) => root.scrollWidth <= root.clientWidth)).toBe(true);
  } finally { await context.close(); }
});
