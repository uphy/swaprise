import { expect, test, devices } from "@playwright/test";

const phone = devices["Pixel 7"];
test.use({ viewport: phone.viewport, isMobile: true, hasTouch: true, deviceScaleFactor: phone.deviceScaleFactor });

test("解凍は最下段の右から色が見え、残る上段はおじゃまの姿を保つ", async ({ page }) => {
  await page.goto("/?mode=endless&seed=3&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  const first = await page.evaluate(() => {
    const { scene, game } = (window as any).__swaprise;
    scene.paused = true; // 演出を特定のフレームで検証する。ポーズ画面は開かない。
    const b = game.boards[0];
    b.noRise = true;
    b.riseProgress = 0;
    b.setColumns([[0], [0], [1], [0], [2], [3]]);
    b.placeGarbage(0, 1, 6, 3, "normal");
    b.cursor.x = 2;
    b.cursor.y = 0;
    b.tick({ moveX: 0, moveY: 0, swap: true, raise: false });
    const g = [...b.garbage.values()][0] as any;
    while (g.state !== "transforming") b.tick();
    while (b.cell(5, 1).revealAt > 0) b.tick();
    scene.views[0].draw();
    return {
      right: scene.views[0].cells[1][5].texture.key,
      expected: `panel-${b.cell(5, 1).revealKind}`,
      left: scene.views[0].cells[1][4].texture.key,
    };
  });
  expect(first.right).toBe(first.expected);
  expect(first.left).not.toMatch(/^panel-/);

  const revealed = await page.evaluate(() => {
    const { scene, game } = (window as any).__swaprise;
    const b = game.boards[0];
    // 最上段までめくり終わっても、まだ変換せずに待つ。
    while (b.cell(0, 3).revealAt > 0) b.tick();
    scene.views[0].draw();
    const g = [...b.garbage.values()][0] as any;
    return {
      bottom: scene.views[0].cells[1].map((img: any) => img.texture.key),
      expected: b.cells[1].map((c: any) => `panel-${c.revealKind}`),
      upper: [2, 3].flatMap((y) => scene.views[0].cells[y].map((img: any) => img.texture.key)),
      state: g.state,
      y: g.y,
    };
  });
  expect(revealed.bottom).toEqual(revealed.expected);
  expect(revealed.upper).toEqual(Array(12).fill("garbage"));
  expect(revealed.state).toBe("transforming");
  expect(revealed.y).toBe(1);
  await page.screenshot({ path: "e2e/__screenshots__/mobile-garbage-reveal.png" });
});
