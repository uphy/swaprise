import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, mode: string): Promise<void> {
  await page.goto(`/?mode=${mode}&seed=7&bgm=0&countdown=0`);
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    scene.scene.pause();
    game.boards.forEach((b: any) => {
      b.setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
      b.noRise = true;
    });
  });
}

test("残り時間で空色が変わり、無音でも最後の10秒は秒に同期して光る", async ({ page }) => {
  await start(page, "timeattack");
  const result = await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    const at = (seconds: number) => {
      game.boards[0].frame = game.timeLimit - seconds * 60;
      scene.update(0, 0);
      return {
        sky: getComputedStyle(document.body).backgroundImage,
        pulse: Number(getComputedStyle(document.body, "::before").opacity),
      };
    };
    const skies = [120, 60, 30, 10].map((s) => at(s).sky);
    const full = at(9).pulse;
    const between = at(8.5).pulse;
    const before = at(11).pulse;
    const end = at(0).pulse;
    return { skies, full, between, before, end };
  });
  expect(new Set(result.skies).size).toBe(4);
  expect(result.full).toBeGreaterThan(result.between);
  expect(result.before).toBe(0);
  expect(result.end).toBe(0);
});

test("ポーズ中は背景も止まり、画面回転で残り時間の色を保ち、メニューでは時間の光が消える", async ({ page }) => {
  await start(page, "timeattack");
  const state = await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    game.boards[0].frame = game.timeLimit - 9 * 60;
    scene.update(0, 0);
    const before = { sky: getComputedStyle(document.body).backgroundImage, pulse: getComputedStyle(document.body, "::before").opacity };
    scene.paused = true;
    const orb = scene.bg.orbs[0].img;
    const position = { x: orb.x, y: orb.y, scale: orb.scaleX };
    for (let i = 0; i < 60; i++) scene.update(0, 1000 / 60);
    return {
      before,
      after: { sky: getComputedStyle(document.body).backgroundImage, pulse: getComputedStyle(document.body, "::before").opacity },
      position, afterPosition: { x: orb.x, y: orb.y, scale: orb.scaleX },
    };
  });
  expect(state.after).toEqual(state.before);
  expect(state.afterPosition).toEqual(state.position);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => (window as any).__swaprise.scene.layout.portrait);
  // レイアウト変更後の最初の描画で、同じ時間の空色が復元される。
  const sky = await page.evaluate(() => {
    (window as any).__swaprise.scene.update(0, 0);
    return getComputedStyle(document.body).backgroundImage;
  });
  expect(sky).toBe(state.before.sky);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.start("menu"));
  await page.waitForFunction(() => document.body.dataset.sky === "menu");
  expect(await page.evaluate(() => getComputedStyle(document.body, "::before").opacity)).toBe("0");
});

test("対戦は危険な側の外周だけ赤くなり、天井接触を強調して復帰時に滑らかに戻す", async ({ page }) => {
  await start(page, "versus");
  const result = await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    const b = game.boards[1];
    const view = scene.views[1];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
    for (let i = 0; i < 60; i++) scene.update(0, 1000 / 60);
    const danger = { left: scene.views[0].dangerGlow?.root.visible, right: view.dangerGlow?.root.visible, inside: view.bg.fillColor, level: view.dangerGlow?.level };
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1], [1], [2], [3], [4], [0]]);
    for (let i = 0; i < 30; i++) scene.update(0, 1000 / 60);
    const ceiling = view.dangerGlow?.ceiling.alpha;
    b.setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
    scene.update(0, 1000 / 60);
    const recovering = view.dangerGlow?.level;
    for (let i = 0; i < 120; i++) scene.update(0, 1000 / 60);
    return { danger, ceiling, recovering, recovered: view.dangerGlow?.root.visible };
  });
  expect(result.danger).toMatchObject({ left: false, right: true, inside: 0x1e1e2a });
  expect(result.ceiling).toBeGreaterThan(0.3);
  expect(result.recovering).toBeGreaterThan(0);
  expect(result.recovering).toBeLessThan(result.danger.level);
  expect(result.recovered).toBe(false);
});

test("落下中のおじゃまが天井を通過しただけでは外周の警告を出さない", async ({ page }) => {
  await start(page, "versus");
  const visible = await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    game.boards[0].receiveGarbage([{ width: 6, height: 1, type: "normal" }]);
    const shown: boolean[] = [];
    for (let i = 0; i < 100; i++) {
      scene.update(0, 1000 / 60);
      shown.push(scene.views[0].dangerGlow?.root.visible);
    }
    return [...new Set(shown)];
  });
  expect(visible).toEqual([false]);
});

test("ピンチの赤い光が左右の上隅まで途切れずにつながる", async ({ page }) => {
  await start(page, "endless");
  const alpha = await page.evaluate(() => {
    const scene = (window as any).__swaprise.scene;
    const texture = scene.textures.get("danger-outline").getSourceImage();
    if (!(texture instanceof HTMLCanvasElement)) return null;
    const context = texture.getContext("2d")!;
    const at = (x: number, y: number) => context.getImageData(x, y, 1, 1).data[3];
    // 上辺・左右の上隅を、枠から同じ距離で比較する。
    return { top: at(128, 24), left: at(24, 24), right: at(texture.width - 25, 24), inside: at(128, 80) };
  });
  expect(alpha).not.toBeNull();
  expect(alpha!.top).toBeGreaterThan(100);
  expect(alpha!.left).toBe(alpha!.top);
  expect(alpha!.right).toBe(alpha!.top);
  expect(alpha!.inside).toBe(0);
});
