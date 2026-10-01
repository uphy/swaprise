import { expect, test } from "@playwright/test";

test("連鎖の吹き出しは揃ったパネルの上に出て盤面からはみ出さず、連鎖数で大きくなる（5・6・8・10 連鎖で段階が上がる）", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  const r = await page.evaluate(() => {
    const { scene } = (window as any).__swaprise;
    scene.scene.pause();
    const v = scene.views[0];
    v.board.riseProgress = 0;
    const show = (e: any) => { v.popup({ panels: 3, ...e }); return { ...v.lastPopup }; };
    return {
      // 左端の列の中ほどの 3 枚（行 5）。1 段上に出る
      mid: show({ chain: 2, left: 0, right: 2, top: 5, bottom: 5 }),
      // 一番上の行の左端。上に場所がないので盤面の中に収める
      edge: show({ chain: 2, left: 0, right: 0, top: 11, bottom: 9 }),
      x3: show({ chain: 3, left: 3, right: 5, top: 2, bottom: 2 }),
      x4: show({ chain: 4, left: 3, right: 5, top: 2, bottom: 2 }),
      x5: show({ chain: 5, left: 5, right: 5, top: 4, bottom: 2 }),
      x6: show({ chain: 6, left: 3, right: 5, top: 2, bottom: 2 }),
      x8: show({ chain: 8, left: 3, right: 5, top: 2, bottom: 2 }),
      x9: show({ chain: 9, left: 0, right: 0, top: 11, bottom: 9 }),
      x10: show({ chain: 10, left: 0, right: 0, top: 11, bottom: 9 }),
      x13: show({ chain: 13, left: 5, right: 5, top: 4, bottom: 2 }),
      boardW: 192, boardH: 384, cell: 32,
    };
  });
  const inside = (p: any) => {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(r.boardW);
    expect(p.y + p.height).toBeLessThanOrEqual(r.boardH);
  };
  for (const p of [r.mid, r.edge, r.x3, r.x4, r.x5, r.x6, r.x8, r.x9, r.x10, r.x13]) inside(p);
  // 行 5 の上端は (12 - 1 - 5) * 32 = 192。吹き出しはその上に収まり、消えるパネルに重ならない
  expect(r.mid.y + r.mid.height).toBeLessThanOrEqual((12 - 1 - 5) * r.cell);
  expect(r.x3.y + r.x3.height).toBeLessThanOrEqual((12 - 1 - 2) * r.cell);
  expect(r.x3.size / r.mid.size).toBeCloseTo(1.25, 1);
  expect(r.x4.size / r.mid.size).toBeCloseTo(1.4, 1);
  expect(r.x5.size / r.mid.size).toBeCloseTo(1.5, 1);
  expect(r.x6.size / r.mid.size).toBeCloseTo(1.65, 1);
  expect(r.x8.size / r.mid.size).toBeCloseTo(1.85, 1);
  expect(r.x9.size).toBe(r.x8.size);
  expect(r.x10.size / r.mid.size).toBeCloseTo(2.05, 1);
  expect(r.x13.size).toBe(r.x10.size);
  // 板は半透明で、1 段上のパネル（連鎖で次に落ちてくるものなど）を隠しきらない
  expect(r.mid.plateAlpha).toBeLessThanOrEqual(0.65);
});
