import { expect, test, type Page } from "@playwright/test";

const TALL = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2];
/** 右端の列が高さ 9。危険だが天井には届いていない */
const DANGER = [[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], TALL.slice(0, 9)];
/** 右端の列が天井に届いている。(2,3) を入れ替えると 3 行目が揃い、右端の列が 1 段下がって天井から離れる */
const TOUCH = [[0, 1], [2, 3], [1, 2, 3, 0], [2, 3, 4, 1], [3, 4, 1, 0], TALL];

async function setColumns(page: Page, columns: number[][], stop = 0): Promise<void> {
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await page.evaluate(
    ({ cols, stop }) => {
      const p = (window as any).__swaprise;
      const b = p.game.boards[0];
      b.setColumns(cols);
      b.riseProgress = 0;
      b.stopTimer = stop;
      b.stopTotal = stop;
      b.deathTimer = 0;
    },
    { cols: columns, stop },
  );
}

const grace = (page: Page) =>
  page.evaluate(() => {
    const p = (window as any).__swaprise;
    const g = p.scene.views[0].dangerGlow;
    return { ...g.grace, deathTimer: p.game.boards[0].deathTimer, gameOver: p.game.boards[0].gameOver };
  });

test("高さ 9 の危険では猶予の輪を出さず、天井に届くと輪が出て減り、消して天井から離れると消える", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await setColumns(page, DANGER);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].dangerGlow.front.visible);
  expect((await grace(page)).visible).toBe(false);

  await setColumns(page, TOUCH);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    for (let i = 0; i < 30; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].dangerGlow.grace.visible);
  const counting = await grace(page);
  expect(counting.state).toBe("counting");
  expect(counting.left).toBeLessThan(1);
  expect(counting.text).toMatch(/^\d\.\d$/);

  // 入れ替えて揃え、天井から下ろす
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const b = p.game.boards[0];
    b.cursor.x = 2;
    b.cursor.y = 3;
    p.tick([{ moveX: 0, moveY: 0, swap: true, raise: false }]);
  });
  await page.waitForFunction(() => !(window as any).__swaprise.game.boards[0].panic);
  await page.waitForFunction(() => !(window as any).__swaprise.scene.views[0].dangerGlow.grace.visible);
  expect((await grace(page)).gameOver).toBe(false);
});

test("停止中は天井に届いていても輪が水色で止まって負けず、停止が切れると減りだして猶予切れで負ける", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await setColumns(page, TOUCH, 150);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].dangerGlow.grace.visible);
  const held = await grace(page);
  expect(held.state).toBe("stop");
  expect(held.deathTimer).toBe(0);
  expect(held.left).toBe(1);
  // 停止が切れるまで時計を進める（headless は実時間の進みが遅いので、ゲームの時計を直接進める）。切れると数え始める
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const idle = { moveX: 0, moveY: 0, swap: false, raise: false };
    while (p.game.boards[0].stopTimer > 0) p.tick([idle]);
    for (let i = 0; i < 10; i++) p.tick([idle]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].dangerGlow.grace.state === "counting");
  const counting = await grace(page);
  expect(counting.left).toBeLessThan(1);
  expect(counting.gameOver).toBe(false);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const idle = { moveX: 0, moveY: 0, swap: false, raise: false };
    for (let i = 0; i < 130 && !p.game.boards[0].gameOver; i++) p.tick([idle]);
  });
  expect((await grace(page)).gameOver).toBe(true);
});
