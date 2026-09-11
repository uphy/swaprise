import { expect, test, devices, type Page } from "@playwright/test";

const SHOT = "e2e/__screenshots__";

const activeScenes = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const s = (window as any).__swapriseScenes.opening;
    return s.scene.manager.getScenes(true).map((x: any) => x.scene.key);
  });
const phase = (page: Page): Promise<string> => page.evaluate(() => (window as any).__swapriseScenes.opening.phase);
const waitPhase = (page: Page, p: string): Promise<unknown> => page.waitForFunction((p) => (window as any).__swapriseScenes?.opening?.phase === p, p);
const unlocked = (page: Page): Promise<boolean> => page.evaluate(() => (window as any).__swapriseAudio.unlocked);
const promptState = (page: Page): Promise<{ text: string; visible: boolean }> =>
  page.evaluate(() => {
    const p = (window as any).__swapriseScenes.opening.children.getByName("prompt");
    return { text: p.text, visible: p.visible };
  });

/**
 * 操作の前には音を鳴らせないブラウザ（iOS Safari など）を再現する。
 * headless Chromium も既定では操作の前は AudioContext が suspended だが、それに頼らず、作った直後に suspend して確実にする。
 * resume() は実際の操作（キー・タップ）の中で呼ばれ、そこから鳴らせるようになる
 */
const lockAudio = (page: Page): Promise<unknown> =>
  page.addInitScript(() => {
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        void this.suspend();
      }
    };
  });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    throw err;
  });
});

test("音を鳴らせない環境では、せり上がったあと PRESS ANY KEY で待ち、最初の操作で音が解禁されて続きが始まる", async ({ page }) => {
  await lockAudio(page);
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  await waitPhase(page, "wait");
  expect(await unlocked(page)).toBe(false);
  expect(await promptState(page)).toEqual({ text: "PRESS ANY KEY", visible: true });
  await page.screenshot({ path: `${SHOT}/opening-wait.png` });
  // 待っている間は自動では進まない
  await page.waitForTimeout(1200);
  expect(await phase(page)).toBe("wait");
  expect(await activeScenes(page)).toEqual(["opening"]);
  // 最初の操作は「始める」。飛ばさないし、メニューの操作にもならない
  await page.keyboard.press("Enter");
  await waitPhase(page, "swap");
  await page.waitForFunction(() => (window as any).__swapriseAudio.unlocked);
  expect((await promptState(page)).visible).toBe(false);
  expect(await page.evaluate(() => Boolean((window as any).__swapriseScenes.menu))).toBe(false);
  await waitPhase(page, "chain");
  // 次の操作は「飛ばす」
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu), null, { timeout: 1500 });
  await page.waitForTimeout(300);
  expect(await activeScenes(page)).toEqual(["menu"]);
  expect(await page.evaluate(() => (window as any).__swapriseScenes.menu.children.getByName("crumb").text)).toBe("");
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

  test("題字は SWAP / RISE の 2 行になり、音を鳴らせないときは TAP TO START で待つ。タップで始まり、次のタップで飛ばせる", async ({ page }) => {
    await lockAudio(page);
    await page.goto("/?bgm=0");
    await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
    await waitPhase(page, "wait");
    expect((await promptState(page)).text).toBe("TAP TO START");
    await page.screenshot({ path: `${SHOT}/opening-mobile-wait.png` });
    const box = (await page.locator("canvas").boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await waitPhase(page, "swap");
    await page.waitForFunction(() => (window as any).__swapriseAudio.unlocked);
    await waitPhase(page, "chain");
    await page.screenshot({ path: `${SHOT}/opening-mobile.png` });
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu), null, { timeout: 1500 });
    await page.waitForTimeout(300);
    expect(await activeScenes(page)).toEqual(["menu"]);
    expect(await page.evaluate(() => Boolean((window as any).__swaprise))).toBe(false);
  });
});
