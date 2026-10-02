import { expect, test, devices } from "@playwright/test";

const pixel = devices["Pixel 7"];
test.use({
  viewport: pixel.viewport,
  deviceScaleFactor: pixel.deviceScaleFactor,
  isMobile: pixel.isMobile,
  hasTouch: pixel.hasTouch,
  userAgent: pixel.userAgent,
});

test("メニューの RECORDS をタップすると上位5件の一覧が開き、CLOSE で閉じる", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "swaprise.highscores.v1",
      JSON.stringify({
        endless: [
          { score: 4321, maxChain: 4, date: "2026-09-01", swaps: 400 },
          { score: 1000, maxChain: 2, date: "2026-09-02" },
        ],
        cpu: { easy: { wins: 1, losses: 0 }, normal: { wins: 0, losses: 2 }, hard: { wins: 0, losses: 0 } },
        online: { wins: 3, losses: 1, draws: 1, lastMatch: "m" },
      }),
    );
  });
  await page.goto("/?bgm=0&opening=0");
  await page.waitForTimeout(400);
  // 記録のテキストを叩く
  const pos = await page.evaluate(() => {
    const scene = (window as any).__swapriseScenes.menu;
    const t = scene.children.getByName("records");
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = (rect.width / scene.scale.width) * scene.cameras.main.zoom;
    return { x: rect.left + t.x * s, y: rect.top + t.y * s };
  });
  await page.touchscreen.tap(pos.x, pos.y);
  // 行は 順位・得点・最大連鎖・1 手あたり・日付 の列。得点は桁区切り。1 手あたりは swaps を持つ記録だけに出る
  const rows = page.getByRole("listitem");
  await expect(rows.nth(0)).toContainText("4,321");
  await expect(rows.nth(0)).toContainText("MAX CHAIN ×4");
  await expect(rows.nth(0)).toContainText("PTS / SWAP 10.8");
  await expect(rows.nth(0)).toContainText("2026-09-01");
  await expect(rows.nth(1)).toContainText("1,000");
  await expect(rows.nth(1)).not.toContainText("PTS / SWAP");
  await expect(rows.nth(1)).toContainText("2026-09-02");
  await expect(page.getByRole("listitem").filter({ hasText: "NORMAL" })).toContainText("0W 2L");
  // オンラインの通算は 1 行。引き分けは D、勝率は引き分けを除いて出す
  const online = page.getByRole("listitem").filter({ hasText: "TOTAL" });
  await expect(online).toContainText("3W 1L 1D");
  await expect(online).toContainText("75%");
  await page.getByRole("button", { name: "CLOSE", exact: true }).tap();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("結果画面の SHARE で navigator.share に得点が渡る", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: unknown) => {
        (window as any).__shared.push(data);
        return Promise.resolve();
      },
    });
  });
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.game.boards[0].score = 777;
    p.game.boards[0].maxChain = 3;
    p.game.boards[0].gameOver = true;
    p.game.finished = true;
  });
  // 結果のボタンは終了の 800ms 後に出る
  await page.waitForFunction(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return v.overlay.list.some((o: any) => o.text === "SHARE");
  });
  const share = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const v = p.scene.views[0];
    const b = v.overlay.list.find((o: any) => o.text === "SHARE");
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = rect.width / p.layout.width;
    // overlay は盤面の中央が原点
    return { x: rect.left + (v.ox + 96 + b.x) * s, y: rect.top + (v.oy + 192 + b.y) * s };
  });
  await page.touchscreen.tap(share.x, share.y);
  await page.waitForTimeout(200);
  const shared = await page.evaluate(() => (window as any).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0].text).toBe("SWAPRISE  SCORE 777  MAX CHAIN x3");
  // URL は結果の共有 URL。貼った先で Worker がこの得点のカードを出す。ポートは PREVIEW_PORT で変わるので固定しない
  expect(shared[0].url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/r\?m=endless&s=777&c=3(&id=[0-9a-f-]{36})?$/);
});

test("RECORDS の行は得点がいちばん大きい。最大連鎖・1 手あたり・日付・順位より大きく出す", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("swaprise.highscores.v1", JSON.stringify({ timeattack: [{ score: 1684, maxChain: 3, date: "2026-09-28", swaps: 79 }] }));
  });
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => (window as any).__swapriseScenes?.menu?.children.getByName("records"));
  // 開き方は上のテスト（RECORDS をタップ）で確かめているので、ここは直に開く
  await page.evaluate(() => (window as any).__swapriseScenes.menu.showRecords());
  const row = page.getByRole("listitem").filter({ hasText: "1,684" });
  await expect(row).toContainText("MAX CHAIN ×3");
  const sizes = await row.evaluate((li) => {
    const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    const height = (el: Element) => el.getBoundingClientRect().height;
    const score = li.querySelector(".rec-score")!;
    const others = [li.querySelector("b")!, ...li.querySelectorAll(".rec-meta span")];
    return { score: px(score), scoreHeight: height(score), others: others.map(px), otherHeights: others.map(height) };
  });
  for (const size of sizes.others) expect(sizes.score).toBeGreaterThan(size * 1.3);
  for (const h of sizes.otherHeights) expect(sizes.scoreHeight).toBeGreaterThan(h);
});

// 得点の数字と大文字の見出し・ボタンは、結果画面と同じく字間を 0.08em 広げる（Fredoka の太字は 0 と 0 がくっついて見えた）
test("RECORDS の得点・見出し・ボタンは字間を 0.08em 広げる", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("swaprise.highscores.v1", JSON.stringify({ timeattack: [{ score: 1684, maxChain: 3, date: "2026-09-28", swaps: 79 }] }));
  });
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => (window as any).__swapriseScenes?.menu?.children.getByName("records"));
  await page.evaluate(() => (window as any).__swapriseScenes.menu.showRecords());
  const row = page.getByRole("listitem").filter({ hasText: "1,684" });
  const spacing = (el: Element) => parseFloat(getComputedStyle(el).letterSpacing) / parseFloat(getComputedStyle(el).fontSize);
  for (const target of [row.locator(".rec-score"), page.getByRole("button", { name: "CLOSE" }), page.locator(".rec-card h3").first()]) {
    expect(await target.evaluate(spacing)).toBeCloseTo(0.08, 2);
  }
});
