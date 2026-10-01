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
    await expect(page.getByRole("status")).toContainText("#63 / 100 players");
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
  expect(posts[0]).toMatchObject({ score: 220, maxChain: 3, frames: 7200, rules: "scores-ta-v3" });
  await expect(page.getByRole("status")).toContainText("Could not load rankings");
  await page.getByRole("button", { name: "RETRY", exact: true }).click();
  await expect(page.locator(".score-result")).toHaveCount(0);
});

/** 終わらせて、終わった時刻と結果画面が出た時刻（ページの performance.now）を返す。skip なら終わった直後に Enter を送る */
async function endAndTime(page: Page, score: number, skip: boolean): Promise<{ title: string; shownAtEnd: boolean; wait: number }> {
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0 && !(window as any).__swaprise.scene.ended);
  return page.evaluate(({ score, skip }) => new Promise((resolve) => {
    const p = (window as any).__swaprise;
    let endedAt = 0;
    let title = "";
    let shownAtEnd = false;
    const observer = new MutationObserver(() => {
      if (!document.querySelector(".score-result") || !endedAt) return;
      observer.disconnect();
      resolve({ title, shownAtEnd, wait: performance.now() - endedAt });
    });
    observer.observe(document.body, { childList: true });
    p.game.boards[0].score = score; p.game.boards[0].gameOver = true; p.game.finished = true;
    const poll = (): void => {
      if (!p.scene.ended) { requestAnimationFrame(poll); return; }
      endedAt = performance.now();
      title = p.scene.views[0].overlayTitle.text;
      shownAtEnd = Boolean(document.querySelector(".score-result"));
      if (skip) window.dispatchEvent(new KeyboardEvent("keydown", { code: "Enter", key: "Enter", keyCode: 13 }));
    };
    poll();
  }), { score, skip });
}
for (const mode of ["endless", "timeattack"]) {
  test(`${mode}: the board shows the end for a moment before the result, and Enter skips the wait`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("swaprise.scores.publish.v1", "false"));
    await page.goto(`/?mode=${mode}&bgm=0&countdown=0`);
    // 終わった直後は結果画面ではなく盤面の見出しが見えていて、約 1 秒で結果画面に替わる
    const first = await endAndTime(page, 500, false);
    expect(first.shownAtEnd).toBe(false);
    expect(first.title).toBe("GAME OVER");
    expect(first.wait).toBeGreaterThanOrEqual(900);
    await expect(page.locator(".score-result")).toBeVisible();
    // 新記録なので紙吹雪が結果画面の上に降る。結果画面は半透明で、盤面が透ける
    await expect(page.locator(".score-result .result-confetti")).toHaveCount(1);
    expect(await page.locator(".score-result").evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(/rgba\(/);

    // やり直した 2 回目は、Enter で待たずに結果画面へ進む（新記録でないので紙吹雪はない）
    await page.getByRole("button", { name: "RETRY", exact: true }).click();
    await expect(page.locator(".score-result")).toHaveCount(0);
    const second = await endAndTime(page, 100, true);
    expect(second.wait).toBeLessThan(600);
    await expect(page.locator(".score-result .result-confetti")).toHaveCount(0);
  });
}
test("R during the end display retries at once without waiting for the result", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.scores.publish.v1", "false"));
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await page.evaluate(() => { const p = (window as any).__swaprise; (window as any).__oldGame = p.game; p.game.boards[0].gameOver = true; p.game.finished = true; });
  await page.waitForFunction(() => (window as any).__swaprise.scene.ended);
  await page.keyboard.press("r");
  await page.waitForFunction(() => (window as any).__swaprise.game !== (window as any).__oldGame, null, { timeout: 600 });
  await expect(page.locator(".score-result")).toHaveCount(0);
});
for (const mode of ["endless", "timeattack"]) {
  test(`${mode}: a 0-point run shows the result but is neither kept on this device nor offered for publishing`, async ({ page }) => {
    // 公開の可否は未決。0 点では「初めての記録！」も公開の問いも出さず、RECORDS にも進みの記録にも残さない
    await page.addInitScript(() => localStorage.removeItem("swaprise.scores.publish.v1"));
    const posts: unknown[] = [];
    await page.route("**/api/**", (r) => { if (r.request().method() === "POST") posts.push(r.request().url()); return r.fulfill({ json: { ok: true } }); });
    await page.goto(`/?mode=${mode}&bgm=0&countdown=0`);
    await finish(page, 0);
    const result = page.getByRole("region", { name: "RESULT", exact: true });
    await expect(result).toContainText("0 POINTS");
    await expect(result).not.toContainText("First record!");
    await expect(page.locator(".result-consent")).toBeHidden();
    await expect(page.getByRole("button", { name: "RETRY", exact: true })).toBeVisible();
    const stored = await page.evaluate((mode) => ({
      scores: JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}")[mode] ?? [],
      progress: Object.keys(localStorage).filter((k) => k.startsWith("swaprise.progress.")),
      pending: localStorage.getItem("swaprise.scores.pending.v1"),
    }), mode);
    expect(stored.scores).toEqual([]);
    expect(stored.progress).toEqual([]);
    expect(stored.pending).toBeNull();
    expect(posts).toEqual([]);
    // 点を取った次の回は、これまでどおり初めての記録として公開を聞く
    await page.getByRole("button", { name: "RETRY", exact: true }).click();
    await expect(page.locator(".score-result")).toHaveCount(0);
    await finish(page, 120);
    await expect(page.getByRole("region", { name: "RESULT", exact: true })).toContainText("First record!");
    await expect(page.locator(".result-consent")).toBeVisible();
  });
}
