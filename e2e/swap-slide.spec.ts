import { expect, test } from "@playwright/test";

/**
 * 入れ替えは論理では 1 tick で終わる（TIMING.swap = 1）ので、そのまま描くと 1 フレームで 1 マス跳ぶ。
 * 描画は元の位置から滑って追いつく（BoardView.slide）。パネルの絵の x を見て、入れ替え直後は途中にあり、やがて揃うことを確かめる
 */
test("入れ替えたパネルは 1 フレームで跳ばず、元の位置から滑って追いつく", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  const xs = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    const b = p.game.boards[0];
    b.setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
    b.riseProgress = 0;
    b.cursor.x = 2;
    b.cursor.y = 1;
    p.tick([{ moveX: 0, moveY: 0, swap: true, raise: false }]);
    const view = p.scene.views[0];
    const at = () => [view.cells[1][2].x, view.cells[1][3].x] as const;
    view.draw(1000 / 60);
    const first = at();
    view.draw(1000 / 60);
    const second = at();
    view.draw(1000);
    return { first, second, settled: at() };
  });
  // 列 2 のパネルは列 3 から（x = 96 から 64 へ）、列 3 のパネルは列 2 から（64 から 96 へ）滑る
  expect(xs.first[0]).toBeGreaterThan(64);
  expect(xs.first[0]).toBeLessThan(96);
  expect(xs.first[1]).toBeGreaterThan(64);
  expect(xs.first[1]).toBeLessThan(96);
  // 次のフレームでは近づいている
  expect(xs.second[0]).toBeLessThan(xs.first[0]);
  expect(xs.second[1]).toBeGreaterThan(xs.first[1]);
  expect(xs.settled).toEqual([64, 96]);
});
