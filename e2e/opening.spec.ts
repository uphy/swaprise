import { expect, test, devices, type Page } from "@playwright/test";

const SHOT = "e2e/__screenshots__";

const activeScenes = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const s = (window as any).__swapriseScenes.opening;
    return s.scene.manager.getScenes(true).map((x: any) => x.scene.key);
  });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    throw err;
  });
});

test("起動するとオープニングが流れ、せり上がり → 入れ替え → 連鎖 → 題字のあとメニューへ進む", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  expect(await activeScenes(page)).toEqual(["opening"]);
  // メニューはまだ出ていない
  expect(await page.evaluate(() => Boolean((window as any).__swapriseScenes.menu))).toBe(false);
  const phase = (): Promise<string> => page.evaluate(() => (window as any).__swapriseScenes.opening.phase);
  expect(await phase()).toBe("rise");
  await page.waitForFunction(() => (window as any).__swapriseScenes.opening.phase === "swap");
  await page.waitForFunction(() => (window as any).__swapriseScenes.opening.phase === "chain");
  await page.screenshot({ path: `${SHOT}/opening-chain.png` });
  await page.waitForFunction(() => (window as any).__swapriseScenes.opening.phase === "reveal");
  await page.screenshot({ path: `${SHOT}/opening-reveal.png` });
  // 自動でメニューへ。題字はオープニングの最後と同じ位置（menuTitle）に描かれている。
  // 横長のレイアウト（800×520）は背が低い扱い（compact）なので y は 36
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu) && (window as any).__swapriseScenes.opening.phase === "done");
  await page.waitForTimeout(400);
  expect(await activeScenes(page)).toEqual(["menu"]);
  const title = await page.evaluate(() => {
    const t = (window as any).__swapriseScenes.menu.children.getByName("title");
    return { text: t.text, y: t.y };
  });
  expect(title).toEqual({ text: "SWAPRISE", y: 36 });
  expect(errors).toEqual([]);
});

test("オープニングの途中でキーを押すとすぐメニューへ飛び、そのキーはメニューの操作にならない", async ({ page }) => {
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu), null, { timeout: 1500 });
  await page.waitForTimeout(300);
  expect(await activeScenes(page)).toEqual(["menu"]);
  // Enter が 1 PLAYER の決定として二重に効いていない（最上位のまま）
  expect(await page.evaluate(() => (window as any).__swapriseScenes.menu.children.getByName("crumb").text)).toBe("");
  expect(await page.evaluate(() => Boolean((window as any).__swaprise))).toBe(false);
  // メニューは動く
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__swapriseScenes.menu.children.getByName("crumb").text)).toBe("1 PLAYER ▸");
});

test("オープニングの途中のクリックでも飛ばせる", async ({ page }) => {
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  await page.waitForTimeout(300);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu), null, { timeout: 1500 });
  await page.waitForTimeout(300);
  expect(await activeScenes(page)).toEqual(["menu"]);
  expect(await page.evaluate(() => Boolean((window as any).__swaprise))).toBe(false);
});

test("?opening=0 と ?mode= の直接開始ではオープニングを出さない", async ({ page }) => {
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  expect(await page.evaluate(() => Boolean((window as any).__swapriseScenes.opening))).toBe(false);

  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect(await page.evaluate(() => Boolean((window as any).__swapriseScenes?.opening))).toBe(false);
});

test("ゲームからメニューへ戻るときはオープニングを繰り返さない", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.scene.manager.getScenes(true).map((s: any) => s.scene.key))).toEqual(["menu"]);
  expect(await page.evaluate(() => Boolean((window as any).__swapriseScenes?.opening))).toBe(false);
});

test.describe("縦持ちのスマホ", () => {
  const pixel = devices["Pixel 7"];
  test.use({
    viewport: pixel.viewport,
    deviceScaleFactor: pixel.deviceScaleFactor,
    isMobile: pixel.isMobile,
    hasTouch: pixel.hasTouch,
    userAgent: pixel.userAgent,
  });

  test("題字は SWAP / RISE の 2 行になり、タップで飛ばせる", async ({ page }) => {
    await page.goto("/?bgm=0");
    await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
    await page.waitForFunction(() => (window as any).__swapriseScenes.opening.phase === "chain");
    await page.screenshot({ path: `${SHOT}/opening-mobile.png` });
    const box = (await page.locator("canvas").boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu), null, { timeout: 1500 });
    await page.waitForTimeout(300);
    expect(await activeScenes(page)).toEqual(["menu"]);
    expect(await page.evaluate(() => Boolean((window as any).__swaprise))).toBe(false);
  });
});
