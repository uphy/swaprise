import { expect, test, devices, type Page } from "@playwright/test";

const SHOT = "e2e/__screenshots__";

/** 盤面のマス (x,y) の画面上の中心座標を求める。 */
async function cellCenter(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([cx, cy]) => {
      const p = (window as any).__swaprise;
      const t = p.scene.touches[0];
      const canvas = document.querySelector("canvas")!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / p.layout.width;
      const scaleY = rect.height / p.layout.height;
      const gx = t.ox + cx * 32 + 16;
      const gy = t.oy + (11 - cy) * 32 + 16 - p.game.boards[0].riseProgress * 32;
      return { x: rect.left + gx * scaleX, y: rect.top + gy * scaleY };
    },
    [x, y],
  );
}

/** 盤面のすぐ下の左端（盤面の外で、▲ ▲ ▲ のボタンからも外れた余白）の画面座標。ここを押してもせり上がらないことを確かめるのに使う。 */
async function belowBoard(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const p = (window as any).__swaprise;
    const t = p.scene.touches[0];
    const canvas = document.querySelector("canvas")!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / p.layout.width;
    const scaleY = rect.height / p.layout.height;
    return { x: rect.left + (t.ox + 8) * scaleX, y: rect.top + (t.oy + 12 * 32 + 40) * scaleY };
  });
}

/** 盤面の下の「▲ ▲ ▲」ボタンの画面座標。 */
async function raiseButton(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const p = (window as any).__swaprise;
    const h = p.scene.raiseHints[0];
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const scaleX = rect.width / p.layout.width;
    const scaleY = rect.height / p.layout.height;
    return { x: rect.left + h.x * scaleX, y: rect.top + h.y * scaleY };
  });
}

function kinds(page: Page, x1: number, x2: number, y: number): Promise<number[]> {
  return page.evaluate(
    ([a, b, row]) => {
      const board = (window as any).__swaprise.game.boards[0];
      return [board.cell(a, row).kind, board.cell(b, row).kind];
    },
    [x1, x2, y],
  );
}

test("マウス: クリックで入れ替え、ドラッグで入れ替え。▲ ▲ ▲ を押している間はせり上がり、盤面の外の余白を押してもせり上がらない", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);

  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].cursor.visible)).toBe(true);

  // (1,1) と (2,1) の境目をクリック → 1回で入れ替わる
  const tapBefore = await kinds(page, 1, 2, 1);
  const c1 = await cellCenter(page, 1, 1);
  const c2 = await cellCenter(page, 2, 1);
  await page.mouse.click((c1.x + c2.x) / 2, c1.y);
  await page.waitForTimeout(150);
  const cursor = await page.evaluate(() => ({ ...(window as any).__swaprise.game.boards[0].cursor }));
  expect(cursor).toEqual({ x: 1, y: 1 });
  expect(await kinds(page, 1, 2, 1)).toEqual([tapBefore[1], tapBefore[0]]);

  const before = await kinds(page, 3, 4, 0);
  const from = await cellCenter(page, 3, 0);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y, { steps: 4 });
  await page.mouse.move(from.x + 40, from.y, { steps: 4 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  const after = await kinds(page, 3, 4, 0);
  expect(after).toEqual([before[1], before[0]]);

  // 盤面の下の ▲ ▲ ▲ を押している間はせり上がり、離すと止まる
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
  });
  await page.waitForTimeout(200);
  const manualRows = () => page.evaluate(() => (window as any).__swaprise.game.boards[0].stats.manualRows as number);
  const raising = () => page.evaluate(() => (window as any).__swaprise.scene.touches[0].raising as boolean);
  const button = await raiseButton(page);
  const rowsBeforeButton = await manualRows();
  await page.mouse.move(button.x, button.y);
  await page.mouse.down();
  await page.waitForFunction((n) => (window as any).__swaprise.game.boards[0].stats.manualRows > n, rowsBeforeButton);
  expect(await raising()).toBe(true);
  await page.mouse.up();
  await page.waitForTimeout(100);
  expect(await raising()).toBe(false);

  // 盤面の外の余白（ボタンから外れた所）を押してもせり上がらない。誤タップが多かったので、余白のせり上げは外した
  const below = await belowBoard(page);
  const rowsBefore = await manualRows();
  await page.mouse.move(below.x, below.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  const raisingBelow = await raising();
  await page.mouse.up();
  expect(raisingBelow).toBe(false);
  expect(await manualRows()).toBe(rowsBefore);
});

test("ドラッグしたパネルは、入れ替え先の下が空ならそこで落ち、谷を越えて運べない", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  // 列1が底まで空の谷。(0,1) のパネルを右へ3マスぶんドラッグする
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1], [], [2, 3], [4, 2], [0], [3]]);
  });
  await page.waitForTimeout(100);
  const from = await cellCenter(page, 0, 1);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y, { steps: 4 });
  await page.mouse.move(from.x + 60, from.y, { steps: 4 });
  await page.mouse.move(from.x + 100, from.y, { steps: 4 });
  await page.waitForTimeout(500);
  await page.mouse.up();
  const after = await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    return { landed: b.cell(1, 0).kind, origin: b.cell(0, 1).kind, far: b.cell(2, 1).kind, farther: b.cell(3, 1).kind };
  });
  // 谷に落ちて (1,0) に着地。列2・3の行1は元のまま
  expect(after).toEqual({ landed: 1, origin: -1, far: 3, farther: 2 });
});

test("ドラッグの途中で揃ったパネルはその場で消え、先へは運べない（原作どおり）", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  // 最下段 [1,0,1,1,2,3]。(0,0) の柄1を右へ1マス動かすと x=1..3 で柄1が3枚揃う
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[1], [0], [1], [1], [2], [3]]);
  });
  await page.waitForTimeout(100);
  const from = await cellCenter(page, 0, 0);
  const to = await cellCenter(page, 4, 0);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // 4マスぶんを一気に引く。途中の x=1 で揃うので、そこで消えて x=4 までは運ばれない
  await page.mouse.move(to.x, from.y, { steps: 8 });
  await page.waitForTimeout(600);
  await page.mouse.up();
  const after = await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    return { cleared: b.panelsCleared, x4: b.cell(4, 0).kind, x5: b.cell(5, 0).kind, x0: b.cell(0, 0).kind };
  });
  expect(after).toEqual({ cleared: 3, x4: 2, x5: 3, x0: 0 });
});

test.describe("スマホ縦画面", () => {
  const pixel = devices["Pixel 7"];
  test.use({
    viewport: pixel.viewport,
    deviceScaleFactor: pixel.deviceScaleFactor,
    isMobile: pixel.isMobile,
    hasTouch: pixel.hasTouch,
    userAgent: pixel.userAgent,
  });

  test("掴んだパネルと移動先を表示し、素早く離しても指定列まで届く", async ({ page }) => {
    await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
    await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
    await page.evaluate(() => {
      const b = (window as any).__swaprise.game.boards[0];
      b.noRise = true;
      b.riseProgress = 0;
      b.setColumns([[0], [1], [2], [3], [4], [0]]);
    });
    const from = await cellCenter(page, 0, 0);
    const to = await cellCenter(page, 4, 0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    expect(await page.evaluate(() => (window as any).__swaprise.scene.touches[0].feedback))
      .toEqual({ x: 0, y: 0, targetX: 0 });
    await page.screenshot({ path: `${SHOT}/mobile-touch-selection.png` });
    expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].cursor.visible)).toBe(false);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [to] });
    expect(await page.evaluate(() => (window as any).__swaprise.scene.touches[0].feedback?.targetX)).toBe(4);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForFunction(() => {
      const p = (window as any).__swaprise;
      return p.game.boards[0].cell(4, 0).kind === 0 && p.scene.touches[0].feedback === null;
    });
  });

  test("縦レイアウトになり、タッチのタップ・ドラッグが効く", async ({ page }) => {
    await page.goto("/?bgm=0&countdown=0");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT}/mobile-menu.png` });

    await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
    await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
    await page.waitForTimeout(300);
    const size = await page.evaluate(() => {
      const p = (window as any).__swaprise;
      const canvas = document.querySelector("canvas")!;
      return { w: p.layout.width, h: p.layout.height, backing: canvas.width / p.layout.width, dpr: Math.ceil(devicePixelRatio) };
    });
    // 幅 300 固定、高さは画面の縦横比（Pixel 7 は 412×839 → 611）。canvas は DPR 倍
    expect(size).toEqual({ w: 300, h: 611, backing: size.dpr, dpr: size.dpr });
    await page.screenshot({ path: `${SHOT}/mobile-endless.png` });

    // (2,0) と (3,0) の境目をタップ → 1回で入れ替わる
    const tapBefore = await kinds(page, 2, 3, 0);
    const from = await cellCenter(page, 2, 0);
    const next = await cellCenter(page, 3, 0);
    await page.touchscreen.tap((from.x + next.x) / 2, from.y);
    await page.waitForTimeout(150);
    const cursor = await page.evaluate(() => ({ ...(window as any).__swaprise.game.boards[0].cursor }));
    expect(cursor).toEqual({ x: 2, y: 0 });
    expect(await kinds(page, 2, 3, 0)).toEqual([tapBefore[1], tapBefore[0]]);
    await page.waitForTimeout(1200); // タップで揃った場合の消去処理を待つ

    const before = await kinds(page, 2, 3, 0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + 25, y: from.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + 45, y: from.y }] });
    await page.waitForTimeout(150);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(100);
    const after = await kinds(page, 2, 3, 0);
    expect(after).toEqual([before[1], before[0]]);

    // 盤面の下を1本の指で押し続けてもせり上がらない（2本指のせり上げは mobile.spec で確かめる）
    await page.waitForTimeout(1500);
    const below = await belowBoard(page);
    const rowsBefore = await page.evaluate(() => (window as any).__swaprise.game.boards[0].stats.manualRows);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: below.x, y: below.y }] });
    await page.waitForTimeout(500);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const rowsAfter = await page.evaluate(() => (window as any).__swaprise.game.boards[0].stats.manualRows);
    expect(rowsAfter).toBe(rowsBefore);

    await page.goto("/?mode=versus&seed=7&bgm=0&countdown=0");
    await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOT}/mobile-versus.png` });
  });
});
