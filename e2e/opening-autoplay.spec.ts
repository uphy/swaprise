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

test("メニューの曲は閃光の直前に始まり、メニューへ切り替わっても鳴らし直さない", async ({ page }) => {
  // ?bgm=0 を付けずに開く。曲の状態は __swapriseAudio から読む
  await page.goto("/");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  const bgm = (): Promise<{ playing: string | null; step: number }> =>
    page.evaluate(() => {
      const a = (window as any).__swapriseAudio;
      return { playing: a.bgm?.playing ?? null, step: a.bgm?.step ?? -1 };
    });
  await waitPhase(page, "chain");
  expect((await bgm()).playing).toBeNull();
  await waitPhase(page, "reveal");
  expect((await bgm()).playing).toBe("menu");
  // 曲の頭（1 拍目）から始まっている。16 分音符 1 つが約 124 ms（120.5 BPM）
  expect((await bgm()).step).toBeLessThan(8);
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu) && (window as any).__swapriseScenes.opening.phase === "done");
  await page.waitForTimeout(1500);
  const after = await bgm();
  expect(after.playing).toBe("menu");
  // メニューに切り替わっても曲は途中から続いている。閃光からここまで約 2.4 秒 = 19 歩。切り替えで鳴らし直していれば 12 歩ほどに戻る
  expect(after.step).toBeGreaterThan(17);
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

test("タッチ端末は全画面に入るまで TAP TO START で待ち、そのタップで全画面に入ってから続く", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  // 音は鳴らせるが、全画面を望んでいてまだ入っていないので待つ
  await waitPhase(page, "wait");
  expect(await unlocked(page)).toBe(true);
  expect(await promptState(page)).toEqual({ text: "TAP TO START", visible: true });
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.touchscreen.tap(206, 700);
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  // 全画面に入ったあとは自動で続き、メニューまで進む
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu), null, { timeout: 8000 });
  expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await ctx.close();
});

test("全画面を切ってあるタッチ端末は待たずに続く", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem("swaprise.fullscreen.v1", "0"));
  const page = await ctx.newPage();
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.opening));
  await waitPhase(page, "swap");
  expect((await promptState(page)).visible).toBe(false);
  await ctx.close();
});
