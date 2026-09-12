import { expect, test, devices, type Page } from "@playwright/test";

const pixel = devices["Pixel 7"];
test.use({
  viewport: pixel.viewport,
  deviceScaleFactor: pixel.deviceScaleFactor,
  isMobile: pixel.isMobile,
  hasTouch: pixel.hasTouch,
  userAgent: pixel.userAgent,
});

/** 論理座標を画面（client）座標にする。 */
async function toScreen(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([gx, gy]) => {
      const p = (window as any).__swaprise;
      const rect = document.querySelector("canvas")!.getBoundingClientRect();
      const s = rect.width / p.layout.width;
      return { x: rect.left + gx * s, y: rect.top + gy * s };
    },
    [x, y],
  );
}

test("縦持ちの CPU 対戦は自分の盤面が等倍、CPU の盤面が半分。画面端に 24dp 以上の余白", async ({ page }) => {
  await page.goto("/?mode=cpu&cpu=easy&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = rect.width / p.layout.width;
    const [me, cpu] = p.scene.views;
    return {
      layout: { w: p.layout.width, h: p.layout.height, portrait: p.layout.portrait },
      scales: [me.scale, cpu.scale],
      left: rect.left + me.ox * s,
      right: window.innerWidth - (rect.left + (cpu.ox + 192 * cpu.scale) * s),
      cellPx: 32 * s,
    };
  });
  // 340 × 839 / 412 = 692 だが上限 640 で止まる
  expect(info.layout).toEqual({ w: 340, h: 640, portrait: true });
  expect(info.scales).toEqual([1, 0.5]);
  expect(info.left).toBeGreaterThanOrEqual(24);
  expect(info.right).toBeGreaterThanOrEqual(24);
  // 自分のマスは指で押せる大きさ（36dp 以上）
  expect(info.cellPx).toBeGreaterThanOrEqual(36);
});

test("画面のポーズボタンで止まり、ポーズ画面の RESUME で再開する。SOUND の切り替えは保存される", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  const btn = await page.evaluate(() => {
    const b = (window as any).__swaprise.scene.pauseButton;
    return { x: b.x, y: b.y };
  });
  const at = await toScreen(page, btn.x, btn.y);
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(100);
  const paused = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { paused: p.scene.paused, menu: p.scene.pauseMenu.visible, rows: p.game.boards[0].stats.manualRows };
  });
  expect(paused).toEqual({ paused: true, menu: true, rows: 0 });

  // ポーズ画面の SOUND を押すとミュートになり、localStorage に残る
  const sound = await page.evaluate(() => {
    const scene = (window as any).__swaprise.scene;
    const b = scene.pauseButtons.find((x: any) => x.text.startsWith("SOUND"));
    return { x: b.x + scene.pauseMenu.x, y: b.y + scene.pauseMenu.y };
  });
  const soundAt = await toScreen(page, sound.x, sound.y);
  await page.touchscreen.tap(soundAt.x, soundAt.y);
  await page.waitForTimeout(100);
  const muted = await page.evaluate(() => {
    const scene = (window as any).__swaprise.scene;
    const b = scene.pauseButtons.find((x: any) => x.text.startsWith("SOUND"));
    return { text: b.text, stored: localStorage.getItem("swaprise.mute.v1"), stillPaused: scene.paused };
  });
  expect(muted).toEqual({ text: "SOUND: OFF", stored: "on", stillPaused: true });

  const resume = await page.evaluate(() => {
    const scene = (window as any).__swaprise.scene;
    const b = scene.pauseButtons.find((x: any) => x.text === "RESUME");
    return { x: b.x + scene.pauseMenu.x, y: b.y + scene.pauseMenu.y };
  });
  const resumeAt = await toScreen(page, resume.x, resume.y);
  await page.touchscreen.tap(resumeAt.x, resumeAt.y);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.paused)).toBe(false);
});

test("回転すると横持ち用のレイアウトに置き直し、ゲームは続く", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { frame: p.game.boards[0].frame, portrait: p.layout.portrait, text: p.game.boards[0].toString() };
  });
  expect(before.portrait).toBe(true);

  await page.setViewportSize({ width: pixel.viewport.height, height: pixel.viewport.width });
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    return {
      frame: p.game.boards[0].frame,
      layout: { w: p.layout.width, h: p.layout.height, portrait: p.layout.portrait, phone: p.layout.phoneLandscape },
      canvasCenter: rect.left + rect.width / 2,
      windowCenter: window.innerWidth / 2,
      boardTop: p.scene.views[0].oy,
      hud: p.scene.views[0].hud,
      cellPx: (32 * rect.width) / p.layout.width,
    };
  });
  // 横持ちのスマホは高さ 412 固定、幅は縦横比（839×412 → 839）。盤面は高さいっぱいで HUD は横
  expect(after.layout).toEqual({ w: 839, h: 412, portrait: false, phone: true });
  expect(after.frame).toBeGreaterThan(before.frame);
  // canvas は中央に置かれる（CSS と Phaser の二重の中央寄せでずれない）
  expect(Math.abs(after.canvasCenter - after.windowCenter)).toBeLessThan(2);
  expect(after.boardTop).toBe(14);
  expect(after.hud).toBe("right");
  expect(after.cellPx).toBeGreaterThanOrEqual(31);

  // 戻すと縦持ちに戻る
  await page.setViewportSize({ width: pixel.viewport.width, height: pixel.viewport.height });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__swaprise.layout.portrait)).toBe(true);
});

test("盤面を2本指で押している間はせり上げ。離すと止まる", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  // 揃いのない静かな盤面にして、消去でせり上げが止まらないようにする
  await page.evaluate(() => {
    (window as any).__swaprise.game.boards[0].setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
  });
  const view = await page.evaluate(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return { ox: v.ox, oy: v.oy };
  });
  const a = await toScreen(page, view.ox + 48, view.oy + 200);
  const b = await toScreen(page, view.ox + 144, view.oy + 200);
  const cdp = await page.context().newCDPSession(page);
  const rowsBefore = await page.evaluate(() => (window as any).__swaprise.game.boards[0].stats.manualRows);
  // 入れ替えが起きていないことは、最下段の並びがそのまま（せり上がって1段上がるだけ）なことで確かめる
  const bottomBefore = await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    return [0, 1, 2, 3, 4, 5].map((x) => b.cell(x, 0).kind);
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y, id: 0 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y, id: 0 }, { x: b.x, y: b.y, id: 1 }] });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.touches[0].raising)).toBe(true);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(100);
  const rowsAfter = await page.evaluate(() => (window as any).__swaprise.game.boards[0].stats.manualRows);
  expect(rowsAfter).toBeGreaterThan(rowsBefore);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.touches[0].raising)).toBe(false);
  // 2本指で押しただけでは入れ替えが起きない
  const bottomAfter = await page.evaluate(
    (rows) => {
      const b = (window as any).__swaprise.game.boards[0];
      return [0, 1, 2, 3, 4, 5].map((x) => b.cell(x, rows).kind);
    },
    rowsAfter - rowsBefore,
  );
  expect(bottomAfter).toEqual(bottomBefore);
});

test("盤面の下のせり上げバーを1本指で押している間はせり上げ。離すと止まる。バーの脇の余白では せり上がらない", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    (window as any).__swaprise.game.boards[0].setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
  });
  const hint = await page.evaluate(() => {
    const h = (window as any).__swaprise.scene.raiseHints[0];
    return { x: h.x, y: h.y, w: h.width, h: h.height };
  });
  // 当たり判定は指で押せる大きさ（44dp 以上）
  expect(hint.w).toBeGreaterThanOrEqual(44);
  expect(hint.h).toBeGreaterThanOrEqual(44);
  const manualRows = () => page.evaluate(() => (window as any).__swaprise.game.boards[0].stats.manualRows as number);
  const raising = () => page.evaluate(() => (window as any).__swaprise.scene.touches[0].raising as boolean);
  const cdp = await page.context().newCDPSession(page);

  const at = await toScreen(page, hint.x, hint.y);
  const rowsBefore = await manualRows();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y: at.y, id: 0 }] });
  await page.waitForFunction((n) => (window as any).__swaprise.game.boards[0].stats.manualRows > n, rowsBefore);
  expect(await raising()).toBe(true);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(100);
  expect(await raising()).toBe(false);

  // バーの脇（盤面より左の余白）は、押してもせり上がらない
  const view = await page.evaluate(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return { ox: v.ox };
  });
  const beside = await toScreen(page, view.ox - 10, hint.y);
  const rowsBeside = await manualRows();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: beside.x, y: beside.y, id: 0 }] });
  await page.waitForTimeout(500);
  const raisingBeside = await raising();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect(raisingBeside).toBe(false);
  expect(await manualRows()).toBe(rowsBeside);
});

test("消去中もスマホのせり上げボタンで上げられ、消去対象が盤面に追従する", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  const hint = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.game.boards[0].setColumns([[0], [0], [0]]);
    const h = p.scene.raiseHints[0]; return { x: h.x, y: h.y };
  });
  const at = await toScreen(page, hint.x, hint.y);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...at, id: 0 }] });
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].risenRows > 0);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const state = await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    return { row: b.risenRows, state: b.cell(0, b.risenRows).state, kind: b.cell(0, b.risenRows).kind };
  });
  expect(state.row).toBeGreaterThan(0); expect(state.state).not.toBe("idle"); expect(state.kind).toBe(0);
});

test.describe("iPhone 14", () => {
  const iphone = devices["iPhone 14"];
  test.use({
    viewport: iphone.viewport,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: iphone.isMobile,
    hasTouch: iphone.hasTouch,
    userAgent: iphone.userAgent,
  });

  test("縦持ちレイアウトになり、canvas は DPR 3 で作られて中央に置かれる", async ({ page }) => {
    await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
    await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const p = (window as any).__swaprise;
      const canvas = document.querySelector("canvas")!;
      const rect = canvas.getBoundingClientRect();
      return {
        layout: { w: p.layout.width, h: p.layout.height, portrait: p.layout.portrait, touch: p.layout.touch },
        backing: [canvas.width, canvas.height],
        centerDx: Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2),
        cellPx: (32 * rect.width) / p.layout.width,
      };
    });
    // iPhone 14 の Safari は 390×664 なので、高さは下限の 500 まで下がる
    expect(info.layout).toEqual({ w: 300, h: 511, portrait: true, touch: true });
    expect(info.backing).toEqual([900, 1533]);
    expect(info.centerDx).toBeLessThan(2);
    expect(info.cellPx).toBeGreaterThanOrEqual(36);
  });
});

test("横持ちの 2P 対戦は盤面を左右の端に寄せ、HUD を内側に置く", async ({ page }) => {
  await page.setViewportSize({ width: pixel.viewport.height, height: pixel.viewport.width });
  await page.goto("/?mode=versus&seed=7&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = rect.width / p.layout.width;
    const [a, b] = p.scene.views;
    return {
      huds: [a.hud, b.hud],
      left: rect.left + a.ox * s,
      right: window.innerWidth - (rect.left + (b.ox + 192) * s),
      gap: (b.ox - (a.ox + 192)) * s,
      pauseX: p.scene.pauseButton.x,
      w: p.layout.width,
    };
  });
  expect(info.huds).toEqual(["right", "left"]);
  // 画面端のジェスチャ領域（24dp）は避けつつ、端に寄せる
  expect(info.left).toBeGreaterThanOrEqual(24);
  expect(info.left).toBeLessThan(60);
  expect(info.right).toBeGreaterThanOrEqual(24);
  expect(info.right).toBeLessThan(60);
  // 2つの盤面の間に、両方の HUD と VS が入る幅がある
  expect(info.gap).toBeGreaterThan(300);
  expect(info.pauseX).toBe(info.w / 2);
});

test("SETTINGS の FULL SCREEN ボタンで全画面の希望が保存され、もう一度押すと戻る", async ({ page }) => {
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__swapriseScenes.menu.children.getByName("settings").emit("pointerdown"));
  await page.waitForTimeout(200);
  const btn = await page.evaluate(() => {
    const scene = (window as any).__swapriseScenes.menu;
    const b = scene.children.getByName("settings-panel")?.list.find((o: any) => o.name === "fullscreen");
    if (!b) return null;
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = (rect.width / scene.scale.width) * scene.cameras.main.zoom;
    return { x: rect.left + b.x * s, y: rect.top + b.y * s, text: b.text };
  });
  expect(btn).not.toBeNull();
  expect(btn!.text).toBe("FULL SCREEN: OFF");
  const at = { x: btn!.x, y: btn!.y };
  await page.touchscreen.tap(at.x, at.y);
  // Fullscreen API の完了と表示の更新は別なので、両方が揃うまで待つ。
  await page.waitForFunction(() => {
    const scene = (window as any).__swapriseScenes.menu;
    const button = scene.children.getByName("settings-panel").list.find((o: any) => o.name === "fullscreen");
    return localStorage.getItem("swaprise.fullscreen.v1") === "1" &&
      Boolean(document.fullscreenElement) && button.text === "FULL SCREEN: ON";
  });
  const on = await page.evaluate(() => ({
    stored: localStorage.getItem("swaprise.fullscreen.v1"),
    active: Boolean(document.fullscreenElement),
    text: (window as any).__swapriseScenes.menu.children.getByName("settings-panel").list.find((o: any) => o.name === "fullscreen").text,
  }));
  expect(on.stored).toBe("1");
  // headless でも Fullscreen API は通る。通ったならボタンの表示が ON に変わる
  if (on.active) expect(on.text).toBe("FULL SCREEN: ON");
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForFunction(() => localStorage.getItem("swaprise.fullscreen.v1") === "0" && !document.fullscreenElement);
  const off = await page.evaluate(() => ({ stored: localStorage.getItem("swaprise.fullscreen.v1"), active: Boolean(document.fullscreenElement) }));
  expect(off).toEqual({ stored: "0", active: false });
});
