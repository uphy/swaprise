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
    const orb = scene.bg.orbs[0];
    const position = { x: orb.x, y: orb.y, scale: orb.scale };
    for (let i = 0; i < 60; i++) scene.update(0, 1000 / 60);
    return {
      before,
      after: { sky: getComputedStyle(document.body).backgroundImage, pulse: getComputedStyle(document.body, "::before").opacity },
      position, afterPosition: { x: orb.x, y: orb.y, scale: orb.scale },
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

test("光の玉は canvas ではなく画面全体の固定要素にあり、canvas の外の余白にも続く", async ({ page }) => {
  // PC の横長の窓。canvas（800x520 の比）の上下に余白ができる
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => !!(window as any).__swapriseScenes?.menu);
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const orbs = document.getElementById("orbs")!;
    const rect = orbs.getBoundingClientRect();
    const canvas = document.querySelector("canvas")!.getBoundingClientRect();
    return {
      count: orbs.querySelectorAll(".orb").length,
      covers: rect.top === 0 && rect.left === 0 && rect.width === window.innerWidth && rect.height === window.innerHeight,
      canvasTop: canvas.top,
      behindCanvas: Number(getComputedStyle(orbs).zIndex) < Number(getComputedStyle(document.getElementById("app")!).zIndex),
      pointer: getComputedStyle(orbs).pointerEvents,
    };
  });
  expect(info.count).toBe(10);
  expect(info.covers).toBe(true);
  expect(info.canvasTop).toBeGreaterThan(40);
  expect(info.behindCanvas).toBe(true);
  expect(info.pointer).toBe("none");
  // 玉は動く（メニューでも update が呼ばれる）
  const before = await page.evaluate(() => (window as any).__swapriseScenes.menu.bgView.orbs.map((o: any) => o.y));
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (window as any).__swapriseScenes.menu.bgView.orbs.map((o: any) => o.y));
  expect(after).not.toEqual(before);
});

test("対戦は危険な側の外周だけ赤くなり、天井接触を強調して復帰時に滑らかに戻す", async ({ page }) => {
  await start(page, "versus");
  const result = await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    const b = game.boards[1];
    const view = scene.views[1];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
    for (let i = 0; i < 60; i++) scene.update(0, 1000 / 60);
    const danger = { left: scene.views[0].dangerGlow?.root.visible, right: view.dangerGlow?.root.visible, inside: view.bgColor, level: view.dangerGlow?.level };
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1], [1], [2], [3], [4], [0]]);
    for (let i = 0; i < 30; i++) scene.update(0, 1000 / 60);
    const ceiling = view.dangerGlow?.ceiling.alpha;
    b.setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
    scene.update(0, 1000 / 60);
    const recovering = view.dangerGlow?.level;
    for (let i = 0; i < 120; i++) scene.update(0, 1000 / 60);
    return { danger, ceiling, recovering, recovered: view.dangerGlow?.root.visible };
  });
  expect(result.danger).toMatchObject({ left: false, right: true, inside: 0x1c1730 });
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

test("ピンチの赤い光が枠の丸い角に沿ってつながり、角と光の間に隙間を出さない", async ({ page }) => {
  await start(page, "endless");
  const alpha = await page.evaluate(() => {
    const scene = (window as any).__swaprise.scene;
    const glow = scene.views[0].dangerGlow;
    const texture = scene.textures.get("danger-outline").getSourceImage();
    if (!(texture instanceof HTMLCanvasElement) || !glow) return null;
    const context = texture.getContext("2d")!;
    // 盤面の座標で指定し、光の画像の座標に直して読む
    const margin = -glow.outline.x;
    const boardW = texture.width - margin * 2;
    const at = (bx: number, by: number) => context.getImageData(Math.floor(bx + margin), Math.floor(by + margin), 1, 1).data[3];
    // 枠の縁の幅と角の丸み（BoardView の FRAME_PAD・FRAME_RADIUS）
    const { pad, radius } = glow.frame ?? { pad: 7, radius: 15 };
    // 枠の左上・右上の角の丸みの中心と、そこから斜め外への点
    const diag = (cx: number, sx: number, distance: number) => at(cx + sx * distance / Math.SQRT2, -pad + radius - distance / Math.SQRT2);
    return {
      // 枠の外形から 6px 外の点を、上辺と左右の上隅で比べる
      top: at(boardW / 2, -pad - 6),
      left: diag(-pad + radius, -1, radius + 6),
      right: diag(boardW + pad - radius, 1, radius + 6),
      // 丸い枠の角のすぐ外（以前は四角い光の穴の内側で透明になり、背景の青が透けていた）
      gap: diag(-pad + radius, -1, radius + 1),
      inside: at(boardW / 2, 40),
    };
  });
  expect(alpha).not.toBeNull();
  expect(alpha!.top).toBeGreaterThan(100);
  expect(Math.abs(alpha!.left - alpha!.top)).toBeLessThanOrEqual(8);
  expect(Math.abs(alpha!.right - alpha!.top)).toBeLessThanOrEqual(8);
  expect(alpha!.gap).toBeGreaterThan(150);
  expect(alpha!.inside).toBe(0);
});

test("CPU戦の空色は自分の積み上がりに応じて変わり、復帰とポーズに追従する", async ({ page }) => {
  await start(page, "cpu");
  const result = await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    const stack = (index: number, height: number) => game.boards[index].setColumns([
      Array.from({ length: height }, (_, y) => y % 5), [1], [2], [3], [4], [0],
    ]);
    const sky = () => getComputedStyle(document.body).backgroundImage;
    const settle = () => { for (let i = 0; i < 180; i++) scene.update(0, 1000 / 60); };
    stack(0, 6); settle();
    const low = sky();
    stack(1, 11); settle();
    const opponent = sky();
    stack(0, 9); settle();
    const middle = sky();
    stack(0, 11); settle();
    const high = sky();
    scene.paused = true;
    stack(0, 6); settle();
    const paused = sky();
    scene.paused = false;
    scene.update(0, 1000 / 60);
    const recovering = sky();
    settle();
    return { low, opponent, middle, high, paused, recovering, recovered: sky() };
  });
  expect(result.opponent).toBe(result.low);
  expect(new Set([result.low, result.middle, result.high]).size).toBe(3);
  expect(result.paused).toBe(result.high);
  expect(result.recovering).not.toBe(result.low);
  expect(result.recovered).toBe(result.low);
});

test.describe("日本語での対戦結果", () => {
  test.use({ locale: "ja-JP" });
  test("結果見出しは WIN / LOSE で表示する", async ({ page }) => {
    await start(page, "cpu");
    const titles = await page.evaluate(() => {
      const { game, scene } = (window as any).__swaprise;
      game.winner = 0;
      game.finished = true;
      scene.update(0, 1000 / 60);
      return scene.views.map((view: any) => view.overlayTitle.text);
    });
    expect(titles).toEqual(["WIN", "LOSE"]);
  });
});

test("危険のときは枠そのものを赤く染め、危険な列の上端のマスに赤い帯を出す", async ({ page }) => {
  await start(page, "endless");
  const result = await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    const b = game.boards[0];
    const glow = scene.views[0].dangerGlow;
    const before = { front: glow.front.visible, bezel: glow.bezel.alpha };
    // 左端の列だけ 10 段。ほかの列は低い
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4], [1], [2], [3], [4], [0]]);
    b.noRise = true;
    for (let i = 0; i < 60; i++) scene.update(0, 1000 / 60);
    const frontIndex = scene.views[0].root.list.indexOf(glow.front);
    const cornerIndex = Math.max(...scene.views[0].corners.map((c: any) => scene.views[0].root.list.indexOf(c)));
    return { before, front: glow.front.visible, bezel: glow.bezel.alpha, columns: glow.columns, above: frontIndex > cornerIndex };
  });
  expect(result.before).toEqual({ front: false, bezel: 0 });
  expect(result.front).toBe(true);
  expect(result.bezel).toBeGreaterThan(0.5);
  expect(result.columns).toEqual([true, false, false, false, false, false]);
  expect(result.above).toBe(true);
});
