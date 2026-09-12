import { expect, test } from "@playwright/test";

for (const mode of ["cpu", "versus"]) {
  test(`${mode}: 勝った側は上へ広がり、負けた側は下へ崩れ、確定盤面は変えない`, async ({ page }) => {
    await page.goto(`/?mode=${mode}&seed=7&bgm=0&countdown=0`);
    await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
    const result = await page.evaluate(() => {
      const { game, scene } = (window as any).__swaprise;
      scene.scene.pause();
      game.boards.forEach((b: any) => {
        b.setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
        b.noRise = true;
        b.riseProgress = 0;
      });
      const before = JSON.stringify(game.boards.map((b: any) => b.cells));
      // 右側の勝利も検証し、常に左側が祝われる取り違えを防ぐ。
      game.winner = 1;
      game.finished = true;
      scene.update(0, 0);
      const effects = scene.views.map((v: any) => v.resultEffect);
      if (effects.some((e: any) => !e)) return null;
      const positions = () => effects.map((e: any) => e.panels.map((p: any) => ({ x: p.image.x, y: p.image.y })));
      const initial = positions();
      for (let i = 0; i < 36; i++) scene.update(0, 1000 / 60);
      const moved = positions();
      const hidden = scene.views.every((v: any) => v.cells.flat().every((c: any) => !c.visible) && !v.cursor.visible);
      // 画面の回転後も同じ局所座標で継続し、結果の再通知でやり直さない。
      scene.views[0].place(40, 14, 0.5, "right");
      scene.views[0].playResult("lose");
      const repeated = positions();
      for (let i = 0; i < 120; i++) scene.update(0, 1000 / 60);
      return {
        outcomes: effects.map((e: any) => e.outcome), initial, moved, repeated, hidden,
        after: JSON.stringify(game.boards.map((b: any) => b.cells)), before,
        finished: effects.every((e: any) => e.root.length === 0),
        titles: scene.views.map((v: any) => v.overlayTitle.text),
      };
    });
    expect(result).not.toBeNull();
    expect(result!.outcomes).toEqual(["lose", "win"]);
    expect(result!.initial.every((p: any[]) => p.length === 12)).toBe(true);
    for (const [i, direction] of [[0, 1], [1, -1]]) {
      result!.moved[i].forEach((p: any, j: number) => {
        expect((p.y - result!.initial[i][j].y) * direction).toBeGreaterThan(10);
      });
    }
    expect(result!.repeated).toEqual(result!.moved);
    expect(result!.hidden).toBe(true);
    expect(result!.after).toBe(result!.before);
    expect(result!.finished).toBe(true);
    expect(result!.titles).toEqual(["LOSE", "WIN"]);
  });
}

test("引き分けでは勝敗の演出を出さない", async ({ page }) => {
  await page.goto("/?mode=cpu&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect(await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    scene.scene.pause();
    game.winner = -1;
    game.finished = true;
    scene.update(0, 0);
    return scene.views.every((v: any) => !v.resultEffect && v.overlayTitle.text === "DRAW");
  })).toBe(true);
});

test("勝利のパネルは上昇から下降へ転じ、落ち始めても見える", async ({ page }) => {
  await page.goto("/?mode=cpu&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  const samples = await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    scene.scene.pause();
    game.boards.forEach((board: any) => {
      board.setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
      board.noRise = true;
      board.riseProgress = 0;
    });
    game.winner = 0;
    game.finished = true;
    scene.update(0, 0);
    const effect = scene.views[0].resultEffect;
    const snapshot = () => effect.panels.map(({ image }: any) => ({ x: image.x, y: image.y, alpha: image.alpha }));
    const values = [snapshot()];
    for (let step = 0; step < 6; step++) {
      scene.update(0, 200);
      values.push(snapshot());
    }
    return values;
  });
  expect(samples[0]).toHaveLength(12);
  samples[0].forEach((initial: any, i: number) => {
    expect(samples[1][i].y).toBeLessThan(initial.y);
    // 等間隔の測定で、鉛直速度が上向きから下向きへ滑らかに変わる。
    const rising = samples[2][i].y - samples[1][i].y;
    const slowing = samples[3][i].y - samples[2][i].y;
    const falling = samples[6][i].y - samples[5][i].y;
    expect(rising).toBeLessThan(0);
    expect(slowing).toBeGreaterThan(rising);
    expect(falling).toBeGreaterThan(0);
    expect(samples[6][i].alpha).toBeGreaterThan(0.3);
    // 水平方向は一定の勢いを保ち、重力で鉛直方向だけが加速する。
    expect(samples[6][i].x - samples[5][i].x).toBeCloseTo(samples[2][i].x - samples[1][i].x, 5);
  });
});
