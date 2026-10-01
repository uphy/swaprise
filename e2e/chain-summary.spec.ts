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
  // 停止は連鎖の途中に減らないので、締めを出した時点のゲージは締めの秒数（3 秒）とほぼ同じ
  expect(Number(r.text.match(/[\d.]+/)![0])).toBeGreaterThanOrEqual(2.5);
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

/** 表示中の締めの見え方。fade は中身の不透明度（手を動かすと下がる） */
async function summaryState(page: Page): Promise<{ fade: number; dimmed: boolean; plateAlpha: number; hold: number; y: number; height: number; stackTop: number } | null> {
  return page.evaluate(() => {
    const v = (window as any).__swaprise.scene.views[0];
    const s = v.lastSummary;
    if (!s || !v.summaryFade) return null;
    return { fade: v.summaryFade.alpha, dimmed: s.dimmed, plateAlpha: s.plateAlpha, hold: s.hold, y: s.y, height: s.height, stackTop: s.stackTop };
  });
}

test("締めの地の板は盤面が透ける薄さで、入れ替え・カーソル移動・せり上げをするとすぐ薄くなる (N1)", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  for (const [key, what] of [["z", "入れ替え"], ["ArrowRight", "カーソル移動"], ["x", "せり上げ"]] as const) {
    await startChain(page, CHAIN3);
    await page.waitForFunction(() => {
      const v = (window as any).__swaprise.scene.views[0];
      return v.lastSummary?.lines[0] === "3 CHAIN" && v.summaryFade?.alpha === 1 && v.summary?.alpha === 1;
    }, undefined, { timeout: 15_000 });
    const before = await summaryState(page);
    expect(before!.plateAlpha, what).toBeLessThanOrEqual(0.4);
    expect(before!.dimmed, what).toBe(false);
    // 入れ替えが空振りしない場所（最下段の左端）にカーソルを置く
    await page.evaluate(() => {
      const c = (window as any).__swaprise.game.boards[0].cursor;
      c.x = 0;
      c.y = 0;
    });
    const t0 = Date.now();
    if (key === "x") {
      // せり上げは押している間だけ上がる
      await page.keyboard.down(key);
      await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].lastSummary.dimmed, undefined, { timeout: 2_000 });
      await page.keyboard.up(key);
    } else await page.keyboard.press(key);
    await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].summaryFade?.alpha <= 0.3 + 1e-6, undefined, { timeout: 2_000, polling: 16 });
    // 120ms で薄くなる。headless の描画の遅れを見込んで、締めがとどまる長さ（730ms）よりずっと短いことを確かめる
    expect(Date.now() - t0, what).toBeLessThan(600);
    expect((await summaryState(page))!.dimmed, what).toBe(true);
    // 消えるのを待ってから次へ
    await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].summary === null, undefined, { timeout: 5_000 });
  }
});

test("危険な状態（PINCH）で消したときは締めが 0.6 秒ほどで引っ込む (N1)", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await startChain(page, [...CHAIN3, [], [], TALL]);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].lastSummary !== null, undefined, { timeout: 15_000, polling: 16 });
  const t0 = Date.now();
  const s = await summaryState(page);
  expect(s!.hold).toBe(600);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].summary === null, undefined, { timeout: 5_000, polling: 16 });
  // 出る 180ms・とどまる 600ms・消える 240ms
  expect(Date.now() - t0).toBeLessThan(1_500);
  // PINCH でなければ 3 連鎖の締めは 730ms とどまる
  await startChain(page, CHAIN3);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].lastSummary?.lines[1] === "+220  STOP 3s", undefined, { timeout: 15_000 });
  expect((await summaryState(page))!.hold).toBe(730);
});

test("いちばん高い列より上に空きがあれば、締めはその列に重ならない高さに出る (N1)", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  // 右端の列を 8 段（盤面の上から 4 段目まで）積む。揃わない並びで、天井には届かない
  await startChain(page, [...CHAIN3, [], [], [0, 1, 2, 0, 1, 2, 0, 1]]);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].lastSummary !== null, undefined, { timeout: 15_000 });
  const s = (await summaryState(page))!;
  expect(s.stackTop).toBeLessThan(384 * 0.3 + s.height);
  // ふだんの高さ（上から 3 割）から、列の上の空きへ寄せる
  expect(s.y).toBeLessThan(Math.round(384 * 0.3));
  expect(s.y).toBeGreaterThanOrEqual(0);
  expect(s.y + s.height).toBeLessThanOrEqual(s.stackTop);
  // 列が低ければふだんの高さのまま
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].summary === null, undefined, { timeout: 5_000 });
  await startChain(page, CHAIN3);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].summary !== null, undefined, { timeout: 15_000 });
  expect((await summaryState(page))!.y).toBe(Math.round(384 * 0.3));
});

for (const [name, viewport, mobile] of [
  ["スマホ縦", { width: 390, height: 844 }, true],
  ["スマホ横", { width: 844, height: 390 }, true],
  ["PC", { width: 1280, height: 720 }, false],
] as const) {
  test(`停止中もせり上げバーの右端に山形を残し、STOP の文字と重ならない（${name}） (N2)`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
    await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
    // 停止を直に与える。いちばん長い文字（10 秒台、2 倍なら PINCH ×2 付き）と、得た瞬間の閃きで文字が大きくなるときを測る
    for (const pinch of [false, true]) {
      await page.evaluate((p) => {
        const b = (window as any).__swaprise.game.boards[0];
        b.stopTimer = 659;
        b.stopTotal = 660;
        b.stopPinch = p;
      }, pinch);
      await page.waitForFunction(() => (window as any).__swaprise.scene.raiseHints[0].stopping);
      for (let i = 0; i < 2; i++) {
        const r = await page.evaluate(() => {
          const bar = (window as any).__swaprise.scene.raiseHints[0];
          const t = bar.stopText;
          return { glyph: bar.stopGlyph, w: bar.barW, textRight: t.x + t.displayWidth / 2, textLeft: t.x - t.displayWidth / 2, text: t.text };
        });
        expect(r.glyph, `${name} pinch=${pinch}`).not.toBeNull();
        // 山形はバーの中、右端に寄る
        expect(r.glyph.x + r.glyph.half).toBeLessThanOrEqual(r.w / 2);
        expect(r.glyph.x).toBeGreaterThan(r.w / 4);
        // 文字は山形の左に収まり、バーの左端からもはみ出さない
        expect(r.textRight, r.text).toBeLessThan(r.glyph.x - r.glyph.half);
        expect(r.textLeft, r.text).toBeGreaterThanOrEqual(-r.w / 2);
        await page.waitForTimeout(400);
      }
    }
    // 停止が終わると、ふだんの真ん中の山形に戻る
    await page.evaluate(() => {
      (window as any).__swaprise.game.boards[0].stopTimer = 0;
    });
    await page.waitForFunction(() => !(window as any).__swaprise.scene.raiseHints[0].stopping);
    expect(await page.evaluate(() => (window as any).__swaprise.scene.raiseHints[0].stopGlyph)).toBeNull();
    await context.close();
  });
}
