import { expect, test, type Page } from "@playwright/test";

/** 縦→縦→横の 3 連鎖ができる盤面。(0,4) の 4 を右の空白へ抜く（tests/core/board.test.ts の CHAIN3）。 */
const CHAIN3 = [[2, 1, 0, 0, 4, 0, 1, 1, 3], [4, 3], [4, 3]];
/** 右端の列を天井まで積む。縦にも横にも揃わない並び。これがあると危険な状態（panic）になり、停止が 2 倍になる */
const TALL = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2];

/** 盤面を組み、入れ替えを 1 回入れてから動かす。連鎖はゲームの時計で進む */
async function startChain(page: Page, columns: number[][]): Promise<void> {
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await page.evaluate((cols) => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    const b = p.game.boards[0];
    b.setColumns(cols);
    b.riseProgress = 0;
    b.stopTimer = 0;
    b.cursor.x = 0;
    b.cursor.y = 4;
    const idle = { moveX: 0, moveY: 0, swap: false, raise: false };
    p.tick(p.game.boards.map((_: unknown, i: number) => (i === 0 ? { ...idle, swap: true } : idle)));
    p.scene.scene.resume();
  }, columns);
}

test("連鎖の終わりに連鎖数・得点・停止秒数の締めを出し、せり上げバーが STOP の残り秒数のゲージになって、止まり終えたら戻る", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await startChain(page, CHAIN3);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].lastSummary !== null, undefined, { timeout: 15_000 });
  const r = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const v = p.scene.views[0];
    const bar = p.scene.raiseHints[0];
    return { summary: v.lastSummary, stopping: bar.stopping, text: bar.stopText.text, textW: bar.stopText.width, barW: bar.width, stopTimer: p.game.boards[0].stopTimer };
  });
  // 30 + 80 + 110 点。3 連鎖の停止は 2 秒 + 1 秒
  expect(r.summary.lines).toEqual(["3 CHAIN", "+220  STOP 3s"]);
  // 盤面（192×384）の中に収まる
  expect(r.summary.x).toBeGreaterThanOrEqual(0);
  expect(r.summary.x + r.summary.width).toBeLessThanOrEqual(192);
  expect(r.summary.y).toBeGreaterThanOrEqual(0);
  expect(r.summary.y + r.summary.height).toBeLessThanOrEqual(384);
  expect(r.stopTimer).toBeGreaterThan(0);
  expect(r.stopping).toBe(true);
  expect(r.text).toMatch(/^STOP \d+\.\ds$/);
  expect(r.textW).toBeLessThanOrEqual(r.barW);
  // 締めは 1 秒弱で消える
  await page.waitForFunction(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return v.root.list.every((o: any) => !(o.type === "Container" && o.list?.some((t: any) => t.text === "3 CHAIN")));
  }, undefined, { timeout: 3_000 });
  // 止まり終えたら元のせり上げバーに戻る
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].stopTimer === 0, undefined, { timeout: 8_000 });
  await page.waitForFunction(() => !(window as any).__swaprise.scene.raiseHints[0].stopping);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.raiseHints[0].stopText.visible)).toBe(false);
});

test("危険な状態で連鎖すると、締めとゲージに PINCH ×2 が付き、停止が 2 倍になる", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await startChain(page, [...CHAIN3, [], [], TALL]);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].lastSummary !== null, undefined, { timeout: 15_000 });
  const r = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const b = p.game.boards[0];
    const bar = p.scene.raiseHints[0];
    return { lines: p.scene.views[0].lastSummary.lines, pinch: b.stopPinch, total: b.stopTotal, text: bar.stopText.text, stopping: bar.stopping };
  });
  expect(r.lines).toEqual(["3 CHAIN", "+220  STOP 6s", "PINCH ×2"]);
  expect(r.pinch).toBe(true);
  expect(r.total).toBe(360);
  expect(r.stopping).toBe(true);
  expect(r.text).toContain("PINCH ×2");
});

test("CPU 戦は自分の盤面だけに締めとゲージを出し、CPU の盤面は下の縁の線のまま", async ({ page }) => {
  await page.goto("/?mode=cpu&cpu=easy&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  const r = await page.evaluate(() => {
    const [me, cpu] = (window as any).__swaprise.scene.views;
    return { me: [me.chainSummary, me.stopOnBar], cpu: [cpu.chainSummary, cpu.stopOnBar] };
  });
  expect(r.me).toEqual([true, true]);
  expect(r.cpu).toEqual([false, false]);
});
