import { expect, test, type Page } from "@playwright/test";

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

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    throw err;
  });
});

// 音を鳴らせる環境（Android の PWA、よく音を鳴らしているサイトの Chrome）。
// Chromium に操作なしの自動再生を許すと、インストール済みの PWA と同じ扱いになる。launchOptions はファイルの最上位でしか使えないので、別ファイルにしている
test.use({ launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] } });

test("せり上がり → 入れ替え → 連鎖 → 題字と待たずに進み、メニューへ切り替わる", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  expect(await activeScenes(page)).toEqual(["opening"]);
  // メニューはまだ出ていない
  expect(await page.evaluate(() => Boolean((window as any).__swapriseScenes.menu))).toBe(false);
  expect(await phase(page)).toBe("rise");
  await waitPhase(page, "swap");
  expect(await unlocked(page)).toBe(true);
  expect((await promptState(page)).visible).toBe(false);
  await waitPhase(page, "chain");
  await page.screenshot({ path: `${SHOT}/opening-chain.png` });
  await waitPhase(page, "reveal");
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

test("続きが始まったあとにキーを押すとすぐメニューへ飛び、そのキーはメニューの操作にならない", async ({ page }) => {
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  await waitPhase(page, "swap");
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

test("せり上がりの途中の操作は飛ばさずに続きを始め、続きが始まってからのクリックで飛ばせる", async ({ page }) => {
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  expect(await phase(page)).toBe("rise");
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(100);
  expect(await phase(page)).toBe("swap");
  expect(await activeScenes(page)).toEqual(["opening"]);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu), null, { timeout: 1500 });
  await page.waitForTimeout(300);
  expect(await activeScenes(page)).toEqual(["menu"]);
  expect(await page.evaluate(() => Boolean((window as any).__swaprise))).toBe(false);
});
