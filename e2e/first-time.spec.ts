import { expect, test, type Page } from "@playwright/test";

// 初めて遊ぶ人への案内（src/render/firstTime.ts）。記録のない人には 1 PLAYER で LEARN に枠を置き、
// 初めての ENDLESS では操作の一文を盤面に出して最初の入れ替えで消す。記録を持つ人の見え方は変えない

async function openMenu(page: Page, stored?: object): Promise<void> {
  if (stored) await page.addInitScript((s) => localStorage.setItem("swaprise.highscores.v1", JSON.stringify(s)), stored);
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu?.cards?.length));
  await page.waitForTimeout(200);
}

/** 1 PLAYER を開いた直後の枠の位置と、LEARN の説明 */
async function open1p(page: Page): Promise<{ index: number; focus: boolean; learnHot: boolean; caption: string }> {
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (window as any).__swapriseScenes.menu.children.getByName("crumb").text === "1 PLAYER ▸");
  return menuState(page);
}

function menuState(page: Page): Promise<{ index: number; focus: boolean; learnHot: boolean; caption: string }> {
  return page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    return { index: m.index, focus: m.focusVisible, learnHot: m.cards[3].hot, caption: m.children.getByName("item-learn-caption").text };
  });
}

test("記録のない人が 1 PLAYER を開くと、枠は LEARN にあり「はじめての人はここから」と添える。Enter でレッスン 1 が始まる", async ({ page }) => {
  await openMenu(page);
  expect(await open1p(page)).toEqual({ index: 3, focus: true, learnHot: true, caption: "new here? start here" });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect(await page.evaluate(() => ({ mode: (window as any).__swaprise.game.mode, lesson: (window as any).__swaprise.scene.lesson }))).toEqual({ mode: "lesson", lesson: 0 });
});

test("前回 ENDLESS に入っただけで記録がなければ、LEARN を先に見せる", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.lastmode.v1", JSON.stringify({ mode: "endless" })));
  await openMenu(page);
  expect((await open1p(page)).index).toBe(3);
});

test("レッスンを 1 つ終えたら、1 PLAYER の枠と LEARN の説明は従来どおり", async ({ page }) => {
  await openMenu(page, { lessons: [0] });
  expect(await open1p(page)).toEqual({ index: 0, focus: false, learnHot: false, caption: "1 / 6 LESSONS" });
});

test("ENDLESS の記録を持つ人は、レッスンを終えていなくても従来どおり（前回のモードに枠）", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.lastmode.v1", JSON.stringify({ mode: "timeattack" })));
  await openMenu(page, { endless: [{ score: 1200, maxChain: 2, date: "2026-09-01" }] });
  expect(await open1p(page)).toEqual({ index: 1, focus: false, learnHot: false, caption: "0 / 6 LESSONS" });
});

test.describe("スマホ", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  test("記録のない人が 1 PLAYER をタップしても、枠は LEARN に残る（指の下の ENDLESS に移らない）", async ({ page }) => {
    await openMenu(page);
    const pos = await page.evaluate(() => {
      const m = (window as any).__swapriseScenes.menu;
      const card = m.children.getByName("group-1p-card");
      const rect = document.querySelector("canvas")!.getBoundingClientRect();
      const cam = m.cameras.main;
      const s = (rect.width / m.scale.width) * cam.zoom;
      return { x: rect.left + (card.x - cam.worldView.x) * s, y: rect.top + (card.y - cam.worldView.y) * s };
    });
    await page.touchscreen.tap(pos.x, pos.y);
    await page.waitForFunction(() => (window as any).__swapriseScenes.menu.children.getByName("crumb").text === "1 PLAYER ▸");
    await page.waitForTimeout(300);
    expect(await menuState(page)).toEqual({ index: 3, focus: true, learnHot: true, caption: "new here? start here" });
  });

  test("初めての ENDLESS はなぞる操作の一文を出す", async ({ page }) => {
    await page.goto("/?mode=endless&bgm=0&countdown=0");
    await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
    expect(await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("endless-hint")?.text)).toBe("Drag a panel left or right to swap it.");
  });
});

test.describe("スマホ・日本語", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "ja-JP" });
  test("LEARN の添え書きと ENDLESS の一文は日本語で出す", async ({ page }) => {
    await openMenu(page);
    await page.evaluate(() => { const m = (window as any).__swapriseScenes.menu; m.index = 0; m.select(); });
    expect((await menuState(page)).caption).toBe("はじめての人はここから");
    await page.goto("/?mode=endless&bgm=0&countdown=0");
    await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
    expect(await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("endless-hint")?.text)).toBe("パネルを左右に\nなぞって入れ替えよう");
  });
});

const hint = (page: Page) => page.evaluate(() => {
  const h = (window as any).__swaprise.scene.children.getByName("endless-hint");
  return h ? { text: h.text, visible: h.visible } : null;
});

test("初めての ENDLESS はキー操作の一文を出し、最初の入れ替えで消す。次の ENDLESS では出ない", async ({ page }) => {
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  expect(await hint(page)).toEqual({ text: "Arrow keys move.\nZ swaps.", visible: true });
  // カーソルを動かすだけでは消えない
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(200);
  expect(await hint(page)).not.toBeNull();
  // 入れ替えたら消える。カーソルを下の段（パネルのある段）へ下ろしてから Z
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("z");
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].stats.swaps > 0);
  await page.waitForFunction(() => !(window as any).__swaprise.scene.children.getByName("endless-hint"));
  expect(await page.evaluate(() => localStorage.getItem("swaprise.endlesshint.v1"))).toBe("1");
  // 2 回目の ENDLESS では出ない
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 30);
  expect(await hint(page)).toBeNull();
});

test("入れ替えずに R でやり直した ENDLESS では、まだ一文を出す", async ({ page }) => {
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await page.keyboard.press("r");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0 && (window as any).__swaprise.scene.children.getByName("endless-hint"));
  expect((await hint(page))?.visible).toBe(true);
});

test("ENDLESS の記録を持つ人には、ENDLESS の一文を出さない。他のモードにも出さない", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("swaprise.highscores.v1", JSON.stringify({ endless: [{ score: 1200, maxChain: 2, date: "2026-09-01" }] })));
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  expect(await hint(page)).toBeNull();
  await page.goto("/?mode=timeattack&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  expect(await hint(page)).toBeNull();
});

test("PC の下端の案内に移動・入れ替え・せり上げのキーがある。2P 対戦は従来の案内", async ({ page }) => {
  const bottom = () => page.evaluate(() => {
    const h = (window as any).__swaprise.scene.hintText;
    return { text: h.text, visible: h.visible, right: h.x + h.width / 2, width: (window as any).__swaprise.layout.width };
  });
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  const b = await bottom();
  expect(b.text).toBe("←↑↓→: move   Z: swap   X: raise   P: pause   R: restart   Esc: menu   M: mute");
  expect(b.visible).toBe(true);
  expect(b.right).toBeLessThanOrEqual(b.width);
  await page.goto("/?mode=versus&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  expect((await bottom()).text).toBe("P: pause   R: restart   Esc: menu   M: mute");
});

test("HOW TO PLAY の最後に LEARN への誘いがあり、ボタンでレッスンが始まる", async ({ page }) => {
  await openMenu(page, { lessons: [0, 1] });
  const texts = await page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    m.showHowTo();
    const out: string[] = [];
    const walk = (o: any): void => {
      if (typeof o.text === "string") out.push(o.text);
      (o.list ?? []).forEach(walk);
    };
    walk(m.overlay.panel);
    return out;
  });
  expect(texts.some((s) => s.trimEnd().endsWith("New here? LEARN teaches the basics in 6 short lessons."))).toBe(true);
  expect(texts).toContain("START LESSONS");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  // まだ終えていない最初の課から
  expect(await page.evaluate(() => ({ mode: (window as any).__swaprise.game.mode, lesson: (window as any).__swaprise.scene.lesson }))).toEqual({ mode: "lesson", lesson: 2 });
});
