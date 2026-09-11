import { test, expect, devices, type Page } from "@playwright/test";
const pixel = devices["Pixel 7"];
test.use({ viewport: pixel.viewport, isMobile: true, hasTouch: true });
async function finish(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.game.boards[0].score = 777; p.game.boards[0].maxChain = 3;
    p.game.boards[0].gameOver = true; p.game.finished = true;
  });
}
for (const mode of ["endless", "timeattack"]) {
  test(`${mode}: opt-in once, auto publish, shared name and local record`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("swaprise.name.v1", "Existing"));
    const posts: any[] = [];
    await page.route("**/api/session", (r) => r.fulfill({ json: { ok: true } }));
    await page.route("**/api/scores", (r) => { posts.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true } }); });
    await page.goto(`/?mode=${mode}&bgm=0&countdown=0`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveValue("Existing");
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    expect(await page.evaluate(() => (window as any).__swaprise.game.boards[0].frame)).toBe(0);
    await page.getByRole("textbox").fill("New name");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "SAVE AND PLAY" }).click();
    await finish(page);
    await expect.poll(() => posts.length).toBe(1);
    expect(posts[0]).toMatchObject({ mode, name: "New name", score: 777, maxChain: 3 });
    expect(await page.evaluate((m) => JSON.parse(localStorage.getItem("swaprise.highscores.v1")!)[m][0].score, mode)).toBe(777);
    await page.goto(`/?mode=${mode}&bgm=0&countdown=0`);
    await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}
test("later keeps scores local, no session or upload requests", async ({ page }) => {
  const requests: string[] = []; page.on("request", (r) => { if (r.url().includes("/api/")) requests.push(r.url()); });
  await page.goto("/?mode=endless&countdown=0&bgm=0");
  await page.getByRole("button", { name: "LATER", exact: true }).click();
  await finish(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("swaprise.highscores.v1"))).not.toBeNull();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("swaprise.scores.publish.v1"))).toBe("false");
});
test("settings share online name and rankings handle network failures safely", async ({ page }) => {
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.evaluate(() => (window as any).__swapriseScenes.menu.showSettings());
  await page.evaluate(() => (window as any).__swapriseScenes.menu.overlay.buttons.find((b: any) => b.name === "player-settings").emit("pointerdown"));
  await page.getByRole("textbox").pressSequentially("Space R Z name");
  await page.getByRole("button", { name: "SAVE", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("swaprise.name.v1"))).toBe("Space R Z name");
  await page.evaluate(() => { const s = (window as any).__swapriseScenes.menu; s.closeOverlay(); s.showRecords(); });
  await page.route("**/api/scores?*", (r) => r.fulfill({ status: 503, json: {} }));
  await page.getByRole("button", { name: "ONLINE", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Could not load rankings");
  await page.unroute("**/api/scores?*");
  await page.route("**/api/scores?*", (r) => r.fulfill({ json: { scores: [{ id: "one", name: "<img src=x onerror=alert(1)>", score: 321, maxChain: 2, createdAt: Date.now() }] } }));
  await page.getByRole("button", { name: "RETRY", exact: true }).click();
  await expect(page.getByRole("listitem")).toContainText("<img src=x onerror=alert(1)>");
  await expect(page.locator("dialog img")).toHaveCount(0);
  await page.getByRole("button", { name: "TIME ATTACK", exact: true }).click();
  await expect(page.getByRole("button", { name: "TIME ATTACK", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "THIS DEVICE" }).click();
  await expect(page.getByRole("heading", { name: "ENDLESS TOP 5" })).toBeVisible();
  await page.getByRole("button", { name: "CLOSE", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
