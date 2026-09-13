import { expect, test, type Page } from "@playwright/test";

/** 盤面の結果画面のボタンを、名前と主ボタンかどうかで一覧にする。 */
async function overlayButtons(page: Page): Promise<{ name: string; primary: boolean }[]> {
  await page.waitForFunction(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return v.overlay.visible && v.overlay.list.some((o: any) => o.name === "retry");
  });
  return page.evaluate(() =>
    (window as any).__swaprise.scene.views[0].overlay.list
      .filter((o: any) => typeof o.primary === "boolean")
      .map((o: any) => ({ name: o.name, primary: o.primary })),
  );
}

function finishGame(page: Page): Promise<void> {
  return page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.game.boards[0].gameOver = true;
    p.game.finished = true;
  });
}

test("エンドレスの結果は RETRY だけが主ボタン", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await finishGame(page);
  const buttons = await overlayButtons(page);
  expect(buttons.filter((b) => b.primary).map((b) => b.name)).toEqual(["retry"]);
  expect(buttons.map((b) => b.name)).toContain("menu");
});

test("レッスンを終えると NEXT LESSON だけが主ボタンで、RETRY は主ボタンでない", async ({ page }) => {
  await page.goto("/?mode=lesson&lesson=1&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    p.tick([{ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x: 3, y: 1 } }]);
    for (let i = 0; i < 3000 && !p.game.finished; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
    p.scene.scene.resume();
  });
  const buttons = await overlayButtons(page);
  expect(buttons.filter((b) => b.primary).map((b) => b.name)).toEqual(["next"]);
});

test("レッスンで届かない手のあとは RESET が主ボタンになる。それまでは主ボタンでない", async ({ page }) => {
  await page.goto("/?mode=lesson&lesson=1&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect(await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("lesson-reset").primary)).toBe(false);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    p.tick([{ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x: 0, y: 0 } }]);
    for (let i = 0; i < 60; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
    p.scene.scene.resume();
  });
  expect(await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("lesson-reset").primary)).toBe(true);
});

test("ポーズは RESUME だけが主ボタン", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.keyboard.press("p");
  const buttons = await page.evaluate(() =>
    (window as any).__swaprise.scene.pauseButtons.map((b: any) => ({ text: b.text, primary: b.primary })),
  );
  expect(buttons.filter((b: any) => b.primary).map((b: any) => b.text)).toEqual(["RESUME"]);
});

test("パズルの面選びは PLAY が主ボタンで、選んだ面は主ボタンの黄色を使わない", async ({ page }) => {
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => !!(window as any).__swapriseScenes?.menu);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    m.index = 0;
    m.select();
    m.index = 2;
    m.select();
  });
  await page.waitForFunction(() => !!(window as any).__swapriseScenes.menu.picker);
  const info = await page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    const buttons = m.picker.panel.list.filter((o: any) => typeof o.primary === "boolean");
    return { primary: buttons.filter((b: any) => b.primary).map((b: any) => b.text), selected: buttons.filter((b: any) => b.selected).length };
  });
  expect(info.primary).toEqual(["PLAY"]);
  expect(info.selected).toBeGreaterThan(0);
});
