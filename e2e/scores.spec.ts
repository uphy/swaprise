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
  await page.setViewportSize({ width: 915, height: 412 });
  await page.waitForTimeout(250);
  await expect(page.getByRole("textbox")).toHaveValue("Space R Z name");
  await page.getByRole("button", { name: "SAVE", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("swaprise.name.v1"))).toBe("Space R Z name");
  // 閉じた後に保留していたキャンバスの回転レイアウトが反映される。
  await page.waitForTimeout(250);
  await page.evaluate(() => { const s = (window as any).__swapriseScenes.menu; s.closeOverlay(); s.showRecords(); });
  await page.route("**/api/scores?*", (r) => r.fulfill({ status: 503, json: {} }));
  await page.getByRole("button", { name: "ONLINE", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Could not load rankings");
  await page.unroute("**/api/scores?*");
  await page.route("**/api/scores?*", (r) => r.fulfill({ json: { scores: [{ id: "one", name: "<img src=x onerror=alert(1)>", score: 321, maxChain: 2, createdAt: Date.now() }] } }));
  await page.getByRole("button", { name: "RETRY", exact: true }).click();
  await expect(page.getByRole("listitem")).toContainText("<img src=x onerror=alert(1)>");
  expect(await page.getByRole("listitem").evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(22);
  await expect(page.locator("dialog img")).toHaveCount(0);
  await page.getByRole("button", { name: "TIME ATTACK", exact: true }).click();
  await expect(page.getByRole("button", { name: "TIME ATTACK", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "THIS DEVICE" }).click();
  await expect(page.getByRole("heading", { name: "ENDLESS TOP 5" })).toBeVisible();
  await page.getByRole("button", { name: "CLOSE", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("failed uploads survive reload, retry with the same ID, and opt-out clears pending", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("swaprise.scores.publish.v1")) localStorage.setItem("swaprise.scores.publish.v1", "true");
  });
  await page.route("**/api/session", (r) => r.fulfill({ json: { ok: true } }));
  const posts: any[] = [];
  let fail = true;
  await page.route("**/api/scores", (r) => { posts.push(r.request().postDataJSON()); return r.fulfill({ status: fail ? 503 : 201, json: { ok: !fail } }); });
  await page.goto("/?mode=endless&countdown=0&bgm=0");
  await finish(page);
  await expect.poll(() => posts.length).toBe(1);
  const id = posts[0].id;
  await page.goto("/?bgm=0");
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].id).toBe(id);
  fail = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("swaprise.scores.pending.v1")!))).toEqual([]);
  expect(posts[2].id).toBe(id);
  fail = true;
  await page.goto("/?mode=timeattack&countdown=0&bgm=0");
  await finish(page);
  await expect.poll(() => posts.length).toBe(4);
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.evaluate(() => {
    const s = (window as any).__swapriseScenes.menu; s.showSettings();
    s.overlay.buttons.find((b: any) => b.name === "player-settings").emit("pointerdown");
  });
  await page.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "SAVE", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("swaprise.scores.pending.v1")!))).toEqual([]);
});

test("custom runs do not prompt or upload even with publication enabled", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.scores.publish.v1", "true"));
  const requests: string[] = []; page.on("request", (r) => { if (r.url().includes("/api/")) requests.push(r.url()); });
  await page.goto("/?mode=endless&seed=7&countdown=0&bgm=0");
  await finish(page);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("swaprise.highscores.v1"))).not.toBeNull();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(requests).toEqual([]);
});

for (const viewport of [{ width: 360, height: 640 }, { width: 844, height: 390 }]) {
  test(`records keep navigation visible while 50 rows scroll: ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/scores?*", (route) => route.fulfill({ json: { scores: Array.from({ length: 50 }, (_, i) => ({
      id: String(i), name: `Player ${i + 1}`, score: 99999 - i, maxChain: 5, createdAt: Date.now(),
    })) } }));
    await page.goto("/?bgm=0");
    await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
    await page.evaluate(() => (window as any).__swapriseScenes.menu.showRecords());
    await page.getByRole("button", { name: "ONLINE", exact: true }).click();
    await expect(page.getByRole("listitem")).toHaveCount(50);
    const close = page.getByRole("button", { name: "CLOSE", exact: true });
    const before = await close.boundingBox();
    await page.locator(".score-content").evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByText("Player 50", { exact: true })).toBeInViewport();
    await expect(close).toBeInViewport();
    await expect(page.getByRole("button", { name: "THIS DEVICE" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "TIME ATTACK", exact: true })).toBeInViewport();
    expect(await close.boundingBox()).toEqual(before);
    expect(await page.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await close.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("player screen is concise and follows the keyboard's visual viewport", async ({ page }) => {
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("textbox").evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(22);
  const primary = page.getByRole("button", { name: "SAVE AND PLAY" });
  expect(await primary.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(20);
  expect((await primary.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.locator("details")).not.toHaveAttribute("open", "");
  // Desktop automation cannot open a phone OS keyboard: emulate its viewport resize.
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, "height", { configurable: true, value: 320 });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  const save = page.getByRole("button", { name: "SAVE AND PLAY" });
  const bounds = (await save.boundingBox())!;
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(320);
  await page.getByRole("textbox").fill("Mobile player");
  await save.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("swaprise.name.v1"))).toBe("Mobile player");
});
