import { test, expect, type Page } from "@playwright/test";
async function online(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__swapriseScenes?.menu || !!document.querySelector(".online-ui"));
  await page.evaluate(() => {
    if (document.querySelector(".online-ui")) return;
    const menu = (window as any).__swapriseScenes.menu;
    menu.index = 3;
    menu.select();
  });
}
async function create(page: Page) {
  await online(page);
  await page.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await expect(page.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
}
test("元のタブと保存情報を失ってもトップページから復帰し、別の部屋へ移れる", async ({ context, page }) => {
  await create(page);
  const old = await page.evaluate(() => JSON.parse(sessionStorage.getItem("swaprise.connection.v1")!));
  await page.close();
  const replacement = await context.newPage();
  await online(replacement);
  await replacement.getByRole("button", { name: "RESUME HERE" }).click();
  await expect(replacement.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
  const token = await replacement.evaluate(() => JSON.parse(sessionStorage.getItem("swaprise.connection.v1")!).token);
  expect(token).not.toBe(old.token);
  // 古いタブの遅延退出は、新しい参加を解除しない。
  await replacement.evaluate(async (old) => {
    await fetch("/api/online/leave", { method: "POST", body: JSON.stringify(old) });
  }, old);
  await expect(replacement.getByRole("button", { name: "LEAVE ROOM" })).toBeVisible();
  await replacement.getByRole("button", { name: "LEAVE ROOM" }).click();
  await expect(replacement.locator(".online-ui")).toHaveCount(0);
  await online(replacement);
  await replacement.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await expect(replacement.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
});
test("別の招待URLから既存の部屋を退出し、招待先で対戦を開始できる", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const host = await a.newPage();
    const guest = await b.newPage();
    await create(host);
    const invite = host.url();
    await create(guest);
    await guest.goto(invite);
    await guest.getByRole("button", { name: "LEAVE AND CONTINUE" }).click();
    await guest.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
    for (const p of [host, guest]) await p.waitForFunction(() => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60);
  } finally { await a.close(); await b.close(); }
});
test("HTTP退出の応答を失っても復帰情報を保持し、再試行で退出できる", async ({ page }) => {
  await create(page);
  await page.route("**/api/online/leave", async (route) => {
    await route.fetch();
    await route.abort();
  });
  await page.getByRole("button", { name: "LEAVE ROOM" }).click();
  await expect(page.getByRole("button", { name: "RETRY", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("swaprise.pending-leave.v1"))).not.toBeNull();
  await page.unroute("**/api/online/leave");
  await page.getByRole("button", { name: "RETRY", exact: true }).click();
  await expect(page.locator(".online-ui")).toHaveCount(0);
  await online(page);
  await expect(page.getByRole("button", { name: "INVITE FRIEND", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("swaprise.pending-leave.v1"))).toBeNull();
});
test("部屋作成の応答を失ってもサーバーから参加情報を回収できる", async ({ page }) => {
  await online(page);
  await page.route("**/api/rooms", async (route) => { await route.fetch(); await route.abort(); });
  await page.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await page.getByRole("button", { name: "RESUME HERE" }).click();
  await expect(page.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
});
test("再開APIの応答を失っても新しいトークンを再取得できる", async ({ context, page }) => {
  await create(page);
  await page.close();
  const next = await context.newPage();
  await online(next);
  await next.route("**/api/online/resume", async (route) => { await route.fetch(); await route.abort(); });
  await next.getByRole("button", { name: "RESUME HERE" }).click();
  await expect(next.getByRole("button", { name: "RETRY", exact: true })).toBeVisible();
  await next.unroute("**/api/online/resume");
  await next.getByRole("button", { name: "RETRY", exact: true }).click();
  await next.getByRole("button", { name: "RESUME HERE" }).click();
  await expect(next.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
});
test("WebSocketが切れた状態でもHTTPで退出できる", async ({ page }) => {
  await create(page);
  await page.evaluate(() => (window as any).__swapriseOnline.session.dispose());
  await page.getByRole("button", { name: "LEAVE ROOM" }).click();
  await expect(page.locator(".online-ui")).toHaveCount(0);
  await online(page);
  await page.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await expect(page.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
});
for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`復旧操作がスマホ画面内に収まる ${viewport.width}`, async ({ context, page }, testInfo) => {
    await create(page);
    await page.close();
    const next = await context.newPage();
    await next.setViewportSize(viewport);
    await online(next);
    const resume = next.getByRole("button", { name: "RESUME HERE" });
    const leave = next.getByRole("button", { name: "LEAVE AND CONTINUE" });
    await expect(resume).toBeVisible();
    await expect(leave).toBeVisible();
    for (const button of [resume, leave]) {
      const bounds = (await button.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    }
    await next.screenshot({ path: testInfo.outputPath("recovery.png") });
    await leave.click();
    await expect(next.getByRole("button", { name: "INVITE FRIEND", exact: true })).toBeVisible();
  });
}
test("退出できない通信状態でもメニューへ戻れ、再入場時に退出を再試行する", async ({ page }) => {
  await create(page);
  await page.route("**/api/online/leave", (route) => route.abort());
  await page.getByRole("button", { name: "LEAVE ROOM" }).click();
  await expect(page.getByRole("button", { name: "RETRY", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "BACK TO MENU", exact: true }).click();
  await expect(page.locator(".online-ui")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("swaprise.pending-leave.v1"))).not.toBeNull();
  await page.unroute("**/api/online/leave");
  await page.evaluate(() => {
    const menu = (window as any).__swapriseScenes.menu;
    menu.index = 3;
    menu.select();
  });
  await expect(page.getByRole("button", { name: "INVITE FRIEND", exact: true })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("swaprise.pending-leave.v1"))).toBeNull();
});
