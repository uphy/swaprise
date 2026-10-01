import { expect, test, type Page } from "@playwright/test";

// 連鎖はゲームの時計で 1 段 2 秒ほどかかり、headless の描画は 60fps を割ることがあるので、待ちを長めにとる
test.describe.configure({ timeout: 120_000 });

/**
 * 同じ組み方で 2〜10 連鎖ができる盤面。(0,0) の空きへ列 1 の最下段を抜くと、列 1 の柄が 1 段ずつ落ちて
 * 列 1・2・3 と列 2・3・4 の横の揃いが交互に起きる。10 連鎖は 6 種目の柄（ばつ印）を使う
 */
const CHAINS: Record<number, number[][]> = {
  2: [[], [0, 4], [4, 2], [4, 2], [2], []],
  3: [[], [3, 0, 0], [0, 2, 0], [0, 2, 0], [2], []],
  5: [[], [2, 3, 1, 4], [3, 4, 1, 3, 4], [3, 4, 1, 3, 4], [4, 3], []],
};

/** 遊ぶ人の盤面（i）を組み、(0,0) で入れ替えて連鎖を始める。連鎖はゲームの時計で進む */
async function startChain(page: Page, columns: number[][], board = 0): Promise<void> {
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await page.evaluate(([cols, i]) => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    const b = p.game.boards[i];
    b.setColumns(cols);
    b.riseProgress = 0;
    b.stopTimer = 0;
    b.cursor.x = 0;
    b.cursor.y = 0;
    const idle = { moveX: 0, moveY: 0, swap: false, raise: false };
    p.tick(p.game.boards.map((_: unknown, j: number) => (j === i ? { ...idle, swap: true } : idle)));
    p.scene.scene.resume();
  }, [columns, board] as const);
}

/** 連鎖の一段ごとの揺れの型と大きさを記録する */
async function recordShakes(page: Page, view = 0): Promise<void> {
  await page.evaluate((i) => {
    const v = (window as any).__swaprise.scene.views[i];
    const orig = v.chainImpact.bind(v);
    v.shakeLog = [];
    v.chainImpact = (chain: number) => {
      orig(chain);
      v.shakeLog.push({ chain, type: v.lastShake.type, amp: v.lastShake.amp });
    };
  }, view);
}

test("連鎖の一段ごとに連鎖した盤面だけが揺れ、2 連鎖は沈むだけ、3・4 連鎖は縦、5 連鎖は縦横。カメラと HUD は動かない", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await recordShakes(page);
  const hudBefore = await page.evaluate(() => {
    const v = (window as any).__swaprise.scene.views[0];
    const st = v.statsBounds();
    return { score: [v.scoreText.x, v.scoreText.y], stats: [st.y, st.x + st.width] };
  });
  // 揺れている最中の描画を 1 つ記録する。次の描画の直前に、枠の位置・カメラ・HUD を読む（読む時点で前の描画のずれが反映されている）
  await page.evaluate(() => {
    const { scene } = (window as any).__swaprise;
    const v = scene.views[0];
    const orig = v.stepShake.bind(v);
    let prev = { x: 0, y: 0 };
    v.stepShake = (delta: number) => {
      if (!v.during && v.lastShake?.chain >= 3 && Math.abs(prev.y) > 0.5) {
        const cam = scene.cameras.main;
        const st = v.statsBounds();
        v.during = {
          camera: [cam.scrollX, cam.scrollY, cam.shakeEffect.isRunning],
          offset: prev,
          frameAt: [v.frame.x, v.frame.y],
          score: [v.scoreText.x, v.scoreText.y],
          stats: [st.y, st.x + st.width],
        };
      }
      prev = orig(delta);
      return prev;
    };
  });
  await startChain(page, CHAINS[5]);
  await page.waitForFunction(() => Boolean((window as any).__swaprise.scene.views[0].during), undefined, { timeout: 45_000 });
  const during = await page.evaluate(() => (window as any).__swaprise.scene.views[0].during);
  expect(during.camera).toEqual([0, 0, false]);
  expect(during.score).toEqual(hudBefore.score);
  // 札は中身（MAX の数字）で幅が変わるので、上端と右端（盤面の右端に揃えてある）で比べる
  expect(during.stats).toEqual(hudBefore.stats);
  // 枠は揺れのぶんだけずれる（枠の絵は盤面の左上から縁と影の幅 31 だけ外に置いてある）
  expect(during.frameAt[0]).toBeCloseTo(-31 + during.offset.x, 5);
  expect(during.frameAt[1]).toBeCloseTo(-31 + during.offset.y, 5);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].lastSummary?.lines[0] === "5 CHAIN", undefined, { timeout: 45_000 });
  const log = await page.evaluate(() => (window as any).__swaprise.scene.views[0].shakeLog);
  expect(log).toEqual([
    { chain: 2, type: "dip", amp: 0.045 },
    { chain: 3, type: "vertical", amp: 0.065 },
    { chain: 4, type: "vertical", amp: 0.08 },
    { chain: 5, type: "both", amp: 0.11 },
  ]);
  // 揺れ終わったら元の位置に戻る
  await page.waitForFunction(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return v.shakeOffset.x === 0 && v.shakeOffset.y === 0 && v.frame.y === -31;
  });
});

test("2 人対戦では連鎖した側の盤面だけが揺れる", async ({ page }) => {
  await page.goto("/?mode=versus&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  await recordShakes(page, 0);
  await recordShakes(page, 1);
  await startChain(page, CHAINS[3], 1);
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[1].shakeLog.length >= 2, undefined, { timeout: 45_000 });
  const r = await page.evaluate(() => {
    const { scene } = (window as any).__swaprise;
    return { left: scene.views[0].shakeLog, right: scene.views[1].shakeLog.map((s: any) => s.chain), feel: scene.views.map((v: any) => v.chainFeel) };
  });
  expect(r.feel).toEqual([true, true]);
  expect(r.left).toEqual([]);
  expect(r.right).toEqual([2, 3]);
});

test("CPU の盤面は連鎖しても揺らさない", async ({ page }) => {
  await page.goto("/?mode=cpu&cpu=easy&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views.map((v: any) => v.chainFeel))).toEqual([true, false]);
});

/**
 * 揺れの大きさはパネル 1 枚の大きさの割合で決まり、端末の DPR や画面の幅で変わらない。
 * 6 連鎖の揺れを 60fps で進め、揺れが最も大きい瞬間のパネルの画面上のずれ（CSS px）をその画面のパネル 1 枚（CSS px）で割って、
 * DPR 1 と 3、スマホ縦と PC で比べる
 */
test("揺れはパネル 1 枚の割合で決まり、DPR や画面の幅で変わらない", async ({ browser }) => {
  const results: { name: string; panel: number; ratio: number }[] = [];
  for (const [name, viewport, dpr, mobile] of [
    ["スマホ縦 DPR 3", { width: 390, height: 844 }, 3, true],
    ["スマホ縦 DPR 1", { width: 390, height: 844 }, 1, true],
    ["PC DPR 1", { width: 1280, height: 720 }, 1, false],
  ] as const) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
    await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
    const r = await page.evaluate(() => {
      const { scene } = (window as any).__swaprise;
      scene.scene.pause();
      const v = scene.views[0];
      // 画面に出ている一番下の段のパネル
      const img = v.cells[0].find((c: any) => c.visible);
      v.draw(0);
      const rest = img.getBounds();
      v.chainImpact(6);
      // 揺れの向きと位相は毎回ランダムなので、比べるために揃える
      v.shake.phase = 0;
      v.shake.dir = 1;
      let bestX = 0;
      while (v.shake) {
        const { x } = v.stepShake(1000 / 60);
        if (Math.abs(x) > Math.abs(bestX)) bestX = x;
      }
      // 横に最も大きくずれた瞬間の絵を描いて、パネルの画面上の位置を測る
      v.stepShake = () => ({ x: bestX, y: 0, k: 1 });
      v.draw(0);
      delete v.stepShake;
      const moved = img.getBounds();
      const canvas = document.querySelector("canvas")!;
      // 論理 px 1 つが何 CSS px か
      const css = (canvas.getBoundingClientRect().width / scene.scale.width) * scene.cameras.main.zoom;
      const panel = 32 * v.scale * css;
      return { panel, ratio: (Math.abs(moved.x - rest.x) * css) / panel };
    });
    results.push({ name, ...r });
    await context.close();
  }
  // 6 連鎖はパネルの 12.5% の縦横の揺れ。60fps の描画で拾うので山の頂上は少し欠ける
  for (const r of results) {
    expect(r.ratio, r.name).toBeGreaterThan(0.125 * 0.6);
    expect(r.ratio, r.name).toBeLessThanOrEqual(0.125 + 1e-6);
    expect(r.ratio, r.name).toBeCloseTo(results[0].ratio, 3);
  }
});

test("段階ごとに揺れの型・吹き出し・閃光・締めがはっきり変わり、揺れはパネルの 17% を超えない", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  const rows = await page.evaluate(() => {
    const { scene } = (window as any).__swaprise;
    scene.scene.pause();
    const v = scene.views[0];
    v.board.riseProgress = 0;
    return [2, 3, 4, 5, 6, 7, 8, 9, 10, 14].map((chain) => {
      v.chainImpact(chain);
      const flash = v.boardFlash?.visible ? v.boardFlash.alpha : 0;
      let frames = 0;
      // 4ms 刻みで進めて、揺れの山を測る（60fps の刻みでは周期 55ms の縦揺れの山を拾い損ねる）
      while (v.shake && frames < 1000) {
        v.stepShake(4);
        frames++;
      }
      const shake = { ...v.lastShake };
      v.popup({ panels: 3, chain, left: 0, right: 2, top: 6, bottom: 6 });
      const popup = { ...v.lastPopup };
      v.showSummary({ chain, score: 1000, stop: 600, pinch: false });
      const summary = { ...v.lastSummary };
      return { chain, shake, frames, flash, popup, summary };
    });
  });
  const by = (c: number) => rows.find((r) => r.chain === c)!;
  // 揺れの型
  expect(rows.map((r) => r.shake.type)).toEqual(["dip", "vertical", "vertical", "both", "both", "both", "long", "long", "long", "long"]);
  // 2 連鎖は沈むだけ（横にも上にも動かない）、3・4 連鎖は縦だけ、5 連鎖から横にも揺れる
  expect(by(2).shake.peakX).toBe(0);
  expect(by(2).shake.peakUp).toBe(0);
  expect(by(3).shake.peakX).toBe(0);
  expect(by(5).shake.peakX).toBeGreaterThan(0);
  // 大きさ（パネルに対する割合）は連鎖数で増え、上限 17% を超えない。よく出る 2〜4 連鎖でもスマホで見える大きさにする
  // （縦持ちのパネル約 43 CSS px で、2 連鎖 1.9 px・3 連鎖 2.8 px・4 連鎖 3.4 px・5 連鎖 4.7 px）
  const amps = rows.map((r) => r.shake.amp);
  for (let i = 1; i < amps.length; i++) expect(amps[i]).toBeGreaterThanOrEqual(amps[i - 1]);
  expect(amps.slice(0, 4)).toEqual([0.045, 0.065, 0.08, 0.11]);
  expect(by(6).shake.amp).toBe(0.125);
  expect(by(10).shake.amp).toBe(0.17);
  // 実際に動いた量（60fps で拾った山）も、2・3・4・5 連鎖で前の段階より大きい
  expect(by(2).shake.peakDown / 32).toBeGreaterThan(0.04);
  expect(by(3).shake.peakDown).toBeGreaterThan(by(2).shake.peakDown);
  expect(by(4).shake.peakDown).toBeGreaterThan(by(3).shake.peakDown);
  expect(by(5).shake.peakDown).toBeGreaterThan(by(4).shake.peakDown);
  for (const r of rows) {
    expect(r.shake.peakDown / 32).toBeLessThanOrEqual(0.17 + 1e-6);
    // 横は横持ちの札まで（パネルの 15.6%）、上は得点の板まで（6.3%）の隙間に収める
    expect(r.shake.peakX / 32).toBeLessThanOrEqual(0.14 + 1e-6);
    expect(r.shake.peakUp / 32).toBeLessThanOrEqual(0.055 + 1e-6);
  }
  // 3 連鎖からは揺れの前に盤面が 1〜1.6% ふくらむ（2 連鎖は沈むだけ）
  expect(rows.map((r) => r.shake.punch)).toEqual([0, 0.01, 0.01, 0.013, 0.013, 0.013, 0.016, 0.016, 0.016, 0.016]);
  // 長さ: 8 連鎖からは長めに減衰する
  expect(by(8).frames).toBeGreaterThan(by(7).frames * 1.4);
  expect(by(10).frames).toBeGreaterThan(by(8).frames);
  // 閃光は 5 連鎖から、段階で強くなる
  expect(by(4).flash).toBe(0);
  expect(by(5).flash).toBeGreaterThan(0);
  expect(by(6).flash).toBeGreaterThan(by(5).flash);
  expect(by(8).flash).toBeGreaterThan(by(6).flash);
  expect(by(10).flash).toBeGreaterThan(by(8).flash);
  // 吹き出しの数字は 5・6・8・10 連鎖で大きくなり、盤面の中に収まる
  expect(by(6).popup.size).toBeGreaterThan(by(5).popup.size);
  expect(by(8).popup.size).toBeGreaterThan(by(6).popup.size);
  expect(by(10).popup.size).toBeGreaterThan(by(8).popup.size);
  expect(by(14).popup.size).toBe(by(10).popup.size);
  // 締めの表示は 5・8・10 連鎖で見出しが大きく、長くとどまり、8 連鎖から縁が光る
  expect(by(8).summary.scale).toBeGreaterThan(by(5).summary.scale);
  expect(by(10).summary.scale).toBeGreaterThan(by(8).summary.scale);
  expect(by(8).summary.hold).toBeGreaterThan(by(5).summary.hold);
  expect(by(10).summary.hold).toBeGreaterThan(by(8).summary.hold);
  expect([by(5).summary.glow, by(8).summary.glow, by(10).summary.glow]).toEqual([false, true, true]);
  for (const r of rows) {
    for (const box of [r.popup, r.summary]) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(192);
      expect(box.y + box.height).toBeLessThanOrEqual(384);
    }
  }
});

test("3 連鎖からは揺れる前に盤面が一瞬ふくらみ、得点などの HUD はふくらまない", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  const r = await page.evaluate(() => {
    const { scene } = (window as any).__swaprise;
    scene.scene.pause();
    const v = scene.views[0];
    const img = v.cells[0].find((c: any) => c.visible);
    v.draw(0);
    const rest = { y: img.y, w: img.displayWidth, score: v.scoreText.scaleX, scoreY: v.scoreText.y };
    v.chainImpact(8);
    // 跳ねの山（ふくらみ始めて 30ms ほど）。揺れはまだ始まっていない
    v.stepShake(30);
    v.draw(0);
    const at = { y: img.y, w: img.displayWidth, k: v.shakeOffset.k, offset: [v.shakeOffset.x, v.shakeOffset.y], score: v.scoreText.scaleX, scoreY: v.scoreText.y };
    // 跳ねが終わると揺れに移り、倍率は 1 に戻る
    v.stepShake(30);
    v.stepShake(30);
    v.draw(0);
    return { rest, at, after: { k: v.shakeOffset.k, w: img.displayWidth } };
  });
  expect(r.at.k).toBeGreaterThan(1.012);
  expect(r.at.k).toBeLessThanOrEqual(1.016 + 1e-6);
  expect(r.at.offset).toEqual([0, 0]);
  // パネルは大きくなり、中心（上から 2 割）より下にある最下段は下へずれる
  expect(r.at.w / r.rest.w).toBeCloseTo(r.at.k, 5);
  expect(r.at.y).toBeGreaterThan(r.rest.y);
  expect([r.at.score, r.at.scoreY]).toEqual([r.rest.score, r.rest.scoreY]);
  expect(r.after.k).toBe(1);
  expect(r.after.w).toBeCloseTo(r.rest.w, 5);
});

/** 盤面の縁（ベゼル）から周りの HUD・せり上げバー・ポーズボタンまでの隙間を、方向ごとにパネル 1 枚の割合で測る */
async function gaps(page: Page): Promise<{ view: number; label: string; side: "up" | "down" | "side"; gap: number }[]> {
  return page.evaluate(() => {
    const { scene } = (window as any).__swaprise;
    const out: { view: number; label: string; side: "up" | "down" | "side"; gap: number }[] = [];
    scene.views.forEach((v: any, i: number) => {
      if (!v.chainFeel) return;
      const s = v.scale;
      const bez = { l: v.ox - 7 * s, t: v.oy - 7 * s, r: v.ox + (192 + 7) * s, b: v.oy + (384 + 7) * s };
      const els: { label: string; l: number; t: number; r: number; b: number }[] = [];
      const add = (label: string, b: { x: number; y: number; width: number; height: number } | null) => {
        if (b && b.width > 0) els.push({ label, l: b.x, t: b.y, r: b.x + b.width, b: b.y + b.height });
      };
      // 得点の板は数字の上下 15px（局所座標で -39〜-9）。横置きの HUD は数字の範囲で測る
      if (v.scoreText.visible) {
        const b = v.scoreText.getBounds();
        add("score", v.hud === "top" ? { x: b.x, y: v.oy - 39 * s, width: b.width, height: 30 * s } : b);
      }
      if (v.labelText.visible) add("label", v.labelText.getBounds());
      add("stats", v.statsBounds());
      const bar = scene.raiseHints?.[i];
      if (bar?.visible) add("bar", bar.getBounds());
      if (scene.pauseButton?.visible) add("pause", scene.pauseButton.getBounds());
      for (const e of els) {
        const h = e.r > bez.l && e.l < bez.r;
        const vv = e.b > bez.t && e.t < bez.b;
        const panel = 32 * s;
        if (h && vv) out.push({ view: i, label: e.label, side: "side", gap: 0 });
        else if (h) out.push(e.b <= bez.t ? { view: i, label: e.label, side: "up", gap: (bez.t - e.b) / panel } : { view: i, label: e.label, side: "down", gap: (e.t - bez.b) / panel });
        else if (vv) out.push({ view: i, label: e.label, side: "side", gap: (e.r <= bez.l ? bez.l - e.r : e.l - bez.r) / panel });
      }
    });
    return out;
  });
}

for (const [name, viewport, mobile] of [
  ["スマホ縦", { width: 390, height: 844 }, true],
  ["スマホ横", { width: 844, height: 390 }, true],
  ["PC", { width: 1280, height: 720 }, false],
] as const) {
  test(`一番大きな揺れと拡大の跳ねでも盤面の縁が HUD・せり上げバー・ポーズボタンに届かない（${name}）`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    for (const mode of ["endless", "timeattack", "versus"]) {
      await page.goto(`/?mode=${mode}&seed=7&bgm=0&countdown=0`);
      await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
      // 各段階の揺れと拡大の跳ねを細かい刻みで進めて、盤面の縁が上・下・横へ最も動いた量を測る（跳ねの山も拾えるよう 4ms 刻み）
      const peak = await page.evaluate(() => {
        const v = (window as any).__swaprise.scene.views[0];
        const p = { up: 0, down: 0, side: 0 };
        for (const chain of [3, 5, 8, 12]) {
          v.chainImpact(chain);
          while (v.shake) v.stepShake(4);
          const e = v.lastShake.edge;
          p.up = Math.max(p.up, e.up / 32);
          p.down = Math.max(p.down, e.down / 32);
          p.side = Math.max(p.side, e.side / 32);
        }
        return p;
      });
      expect(peak.down).toBeGreaterThan(0.15);
      const list = await gaps(page);
      expect(list.length).toBeGreaterThan(0);
      for (const g of list) expect(g.gap, `${mode} view${g.view} ${g.label} ${g.side}`).toBeGreaterThan(peak[g.side]);
    }
    await context.close();
  });
}
