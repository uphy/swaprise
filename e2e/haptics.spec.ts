import { expect, test, devices } from "@playwright/test";

const pixel = devices["Pixel 7"];
test.use({
  viewport: pixel.viewport,
  deviceScaleFactor: pixel.deviceScaleFactor,
  isMobile: pixel.isMobile,
  hasTouch: pixel.hasTouch,
  userAgent: pixel.userAgent,
});

/** navigator.vibrate を差し替えて呼び出しを記録する。 */
const RECORD_VIBRATE = `
  window.__vibrations = [];
  try {
    Navigator.prototype.vibrate = function (p) { window.__vibrations.push(p); return true; };
  } catch (e) {}
`;

test("揃うと自分の盤面だけ震え、メニューの切り替えで止まる", async ({ page }) => {
  await page.addInitScript(RECORD_VIBRATE);
  await page.goto("/?mode=cpu&cpu=easy&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    (window as any).__vibrations = [];
    // 1P: 3枚消し。2P（CPU）: 4枚同時消し
    p.game.boards[0].setColumns([[0], [0], [1], [0], [2], [3]]);
    p.game.boards[0].cursor.x = 2;
    p.game.boards[0].cursor.y = 0;
    p.game.boards[1].setColumns([[0, 0, 3, 0, 0], [1, 2]]);
    // 一時停止前に CPU が送っていた攻撃を捨てる（着地の振動が混ざらないように）
    for (const b of p.game.boards) b.pendingGarbage = [];
    // 以後 CPU には手を打たせない。CPU が続けて消すと2枚目の板が着地して振動が増える
    p.game.cpu = null;
  });
  const tick = (inputs: any[]) => page.evaluate((ins) => (window as any).__swaprise.tick(ins), inputs);
  // 何もしない入力で n フレーム進める。1 フレームごとに evaluate すると CI の遅い描画に引きずられて時間切れになるので、まとめて進める
  const ticks = (n: number) => page.evaluate((count) => {
    for (let i = 0; i < count; i++) (window as any).__swaprise.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
  }, n);
  await tick([{ moveX: 0, moveY: 0, swap: true, raise: false }]);
  await ticks(8);
  const calls = await page.evaluate(() => (window as any).__vibrations);
  expect(calls).toEqual([15]);

  // CPU 側で4枚揃っても震えない。その攻撃（幅3の板）が自分の盤面に着地したときに震える
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    (window as any).__vibrations = [];
    const b = p.game.boards[1];
    b.cursor.x = 0;
    b.cursor.y = 2;
    b.trySwap();
  });
  let cpuMatched = false;
  for (let i = 0; i < 40 && !cpuMatched; i++) {
    await tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
    cpuMatched = await page.evaluate(() => (window as any).__swaprise.game.boards[1].events.some((e: any) => e.type === "match"));
  }
  expect(cpuMatched).toBe(true);
  expect(await page.evaluate(() => (window as any).__vibrations)).toEqual([]);
  // 板は揃ってから100フレーム待って送られ、52フレーム後に予告に入ってから降る
  await ticks(300);
  expect(await page.evaluate(() => (window as any).__vibrations)).toEqual([70]);

  // 厚い板ほど長く震える
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    (window as any).__vibrations = [];
    p.game.boards[0].pendingGarbage.push({ width: 6, height: 2, type: "normal" });
  });
  await ticks(200);
  expect(await page.evaluate(() => (window as any).__vibrations)).toEqual([90]);

  // メニューで OFF にすると保存され、以後は震えない
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const toggle = await page.evaluate(() => {
    const scene = (window as any).__swaprise.scene.scene.manager.getScene("menu");
    // SETTINGS を開いて VIBRATION を押す
    scene.children.getByName("settings").emit("pointerdown");
    const t = scene.children.getByName("settings-panel").list.find((o: any) => o.name === "vibration");
    t.emit("pointerdown");
    return { text: t.text, stored: localStorage.getItem("swaprise.haptics.v1") };
  });
  expect(toggle.text.startsWith("VIBRATION: OFF")).toBe(true);
  expect(toggle.stored).toBe("off");

  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    (window as any).__vibrations = [];
    p.game.boards[0].setColumns([[0], [0], [1], [0], [2], [3]]);
    p.game.boards[0].cursor.x = 2;
    p.game.boards[0].cursor.y = 0;
  });
  await tick([{ moveX: 0, moveY: 0, swap: true, raise: false }]);
  await ticks(8);
  expect(await page.evaluate(() => (window as any).__swaprise.game.boards[0].panelsCleared)).toBe(3);
  expect(await page.evaluate(() => (window as any).__vibrations)).toEqual([]);
});
