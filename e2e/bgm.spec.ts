import { expect, test, type Page } from "@playwright/test";

/** document.hidden を偽装して visibilitychange を投げる。Phaser はこれを見て "hidden" / "visible" を出す。 */
async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);
}

function bgmState(page: Page) {
  return page.evaluate(() => {
    const a = (window as any).__swapriseAudio;
    return { playing: a.bgm?.playing ?? null, tune: a.bgm?.tune ?? null, danger: a.danger };
  });
}

/** 曲の音量（効果音に対する比）。ゲーム中はメニューの半分 */
const bgmLevel = (page: Page): Promise<number> => page.evaluate(() => (window as any).__swapriseAudio.bgmLevel);

test("危険状態ではピンチの曲に切り替わり、抜けるとゲーム曲に戻る。終了後は止まり、メニューではメニュー曲", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  // AudioContext はユーザー操作のあとでしか動かないので、1回クリックしてから始める
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("game");
  // ゲーム中の曲は効果音が聞こえるようメニューより小さい
  expect(await bgmLevel(page)).toBeCloseTo(0.25);

  // 高さ 11 までパネルを入れて危険状態にする
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(300);
  const danger = await bgmState(page);
  expect(danger).toEqual({ playing: "game", tune: "danger", danger: true });
  expect(await bgmLevel(page)).toBeCloseTo(0.25);

  // 低くしてピンチを抜けても、すぐには戻らない（数秒おきに出入りしても曲が行き来しないように）
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(300);
  expect(await bgmState(page)).toEqual({ playing: "game", tune: "danger", danger: false });
  // 抜けたまま待つとゲーム曲に戻る
  await page.waitForFunction(() => (window as any).__swapriseAudio.bgm?.tune === "game", null, { timeout: 5000 });
  expect(await bgmState(page)).toEqual({ playing: "game", tune: "game", danger: false });

  // 抜けてすぐ戻ると、ピンチの曲のまま
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(300);
  expect((await bgmState(page)).tune).toBe("danger");
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(3000);
  expect(await bgmState(page)).toEqual({ playing: "game", tune: "danger", danger: true });
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2], [1], [2], [3], [4], [0]]);
  });
  await page.waitForFunction(() => (window as any).__swapriseAudio.bgm?.tune === "game", null, { timeout: 5000 });

  // 天井まで積んで終わらせる
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1], [1], [2], [3], [4], [0]]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.finished, null, { timeout: 15_000 });
  await page.waitForTimeout(200);
  expect(await bgmState(page)).toEqual({ playing: null, tune: null, danger: false });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  expect(await bgmState(page)).toEqual({ playing: "menu", tune: "menu", danger: false });
  expect(await bgmLevel(page)).toBeCloseTo(0.5);
});

test("CPU対戦: 相手だけがピンチでも曲は変わらず、自分がピンチのときだけ変わる", async ({ page }) => {
  await page.goto("/?mode=cpu&cpu=easy&seed=11&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("game");

  // 相手（boards[1]）だけを危険な高さまで積んでも、自分の曲は変わらない
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[1];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(300);
  expect(await bgmState(page)).toEqual({ playing: "game", tune: "game", danger: false });

  // 自分（boards[0]）も危険な高さまで積むと、ピンチの曲に切り替わる
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(300);
  expect(await bgmState(page)).toEqual({ playing: "game", tune: "danger", danger: true });
});

test("メニューで画面が隠れると曲が止まり、戻ると止めた位置から鳴り直す", async ({ page }) => {
  await page.goto("/?countdown=0&opening=0");
  await page.mouse.click(10, 10);
  await page.waitForFunction(() => {
    const b = (window as any).__swapriseAudio.bgm;
    return b?.samples.menu === "ready" && b.position !== null && b.position > 0.5;
  });
  expect((await bgmState(page)).playing).toBe("menu");
  const before: number = await page.evaluate(() => (window as any).__swapriseAudio.bgm.position);

  await setHidden(page, true);
  await page.waitForTimeout(400);
  expect((await bgmState(page)).playing).toBeNull();
  expect(await page.evaluate(() => (window as any).__swapriseAudio.bgm.position)).toBeNull();

  await setHidden(page, false);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("menu");
  // 頭からではなく、止めた位置の続き
  const after: number = await page.evaluate(() => (window as any).__swapriseAudio.bgm.position);
  expect(after).toBeGreaterThanOrEqual(before);
  expect(after).toBeLessThan(before + 1.5);
});


test("VS対戦: 2Pのピンチでも曲が変わる", async ({ page }) => {
  await page.goto("/?mode=versus&seed=11&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.mouse.click(10, 10);
  await page.waitForFunction(() => (window as any).__swapriseAudio.bgm?.playing === "game");
  await page.evaluate(() => {
    const boards = (window as any).__swaprise.game.boards;
    boards[0].setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
    boards[1].setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
    boards.forEach((b: any) => { b.noRise = true; });
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[1].danger);
  expect(await bgmState(page)).toEqual({ playing: "game", tune: "danger", danger: true });
});

test("VS対戦: 低い盤面へのおじゃま落下ではピンチ曲を流さず、高い位置への着地では流す", async ({ page }) => {
  await page.goto("/?mode=versus&seed=11&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.mouse.click(10, 10);
  await page.waitForFunction(() => (window as any).__swapriseAudio.bgm?.playing === "game");
  const result = await page.evaluate(() => {
    const { game, scene } = (window as any).__swaprise;
    const audio = (window as any).__swapriseAudio;
    game.boards.forEach((b: any) => {
      b.setColumns([[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]);
      b.noRise = true;
    });
    const b = game.boards[0];
    b.receiveGarbage([{ width: 6, height: 1, type: "normal" }]);
    const tunes: string[] = [];
    for (let i = 0; i < 100; i++) {
      scene.update(0, 1000 / 60);
      tunes.push(audio.bgm.tune);
    }
    const low = { tunes: [...new Set(tunes)], garbage: [...b.garbage.values()].map((g: any) => ({ y: g.y, state: g.state })) };
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4], [1], [2], [3], [4], [0]]);
    b.placeGarbage(0, 12, 6, 1);
    for (let i = 0; i < 10; i++) scene.update(0, 1000 / 60);
    const high = { tune: audio.bgm.tune, garbage: [...b.garbage.values()].map((g: any) => ({ y: g.y, state: g.state })) };
    scene.paused = true;
    return { low, high };
  });
  expect(result.low.garbage).toEqual([{ y: 2, state: "idle" }]);
  expect(result.low.tunes).toEqual(["game"]);
  expect(result.high.garbage).toEqual([{ y: 10, state: "idle" }]);
  expect(result.high.tune).toBe("danger");
});

test("メニュー曲は音声ファイルを頭から鳴らし、区間の終わりで区間の頭へ戻って繰り返す", async ({ page }) => {
  await page.goto("/?countdown=0&opening=0");
  await page.mouse.click(10, 10);
  await page.waitForFunction(() => {
    const b = (window as any).__swapriseAudio.bgm;
    return b?.samples.menu === "ready" && b.position !== null;
  });
  expect(await bgmState(page)).toEqual({ playing: "menu", tune: "menu", danger: false });
  const loop = await page.evaluate(() => (window as any).__swapriseAudio.bgm.loop);
  expect(loop.start).toBeCloseTo(15.97, 1);
  expect(loop.end).toBeCloseTo(59.78, 1);
  // 区間の終わりの 0.3 秒前へ飛ばすと、区間の頭へ戻って続く（曲は止まらない）
  await page.evaluate(() => {
    const b = (window as any).__swapriseAudio.bgm;
    b.seek(b.loop.end - 0.3);
  });
  await page.waitForTimeout(800);
  const pos = await page.evaluate(() => (window as any).__swapriseAudio.bgm.position);
  expect(pos).toBeGreaterThanOrEqual(loop.start);
  expect(pos).toBeLessThan(loop.start + 1.2);
  expect(await bgmState(page)).toEqual({ playing: "menu", tune: "menu", danger: false });
});

test.describe("音声ファイルを読み込めないとき", () => {
  // Service Worker が precache から本物を返すと 404 の route をすり抜けるので、このテストだけ止める
  test.use({ serviceWorkers: "block" });

  test("メニュー曲を読み込めないときは合成の予備の曲を鳴らす", async ({ page }) => {
    await page.route("**/audio/menu.mp3", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("/?countdown=0&opening=0");
    await page.mouse.click(10, 10);
    await page.waitForFunction(() => (window as any).__swapriseAudio.bgm?.samples.menu === "failed");
    await page.waitForTimeout(300);
    expect(await bgmState(page)).toEqual({ playing: "menu", tune: "menu", danger: false });
    // 合成の曲はシーケンサが歩む
    expect(await page.evaluate(() => (window as any).__swapriseAudio.bgm.position)).toBeNull();
    expect(await page.evaluate(() => (window as any).__swapriseAudio.bgm.step)).toBeGreaterThan(0);
  });
});

test("ゲーム曲は音声ファイルを頭から鳴らして 2〜25 小節を繰り返し、ピンチの曲は導入なしで始まり、戻るときは止めた小節の頭から続く", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.mouse.click(10, 10);
  await page.waitForFunction(() => {
    const b = (window as any).__swapriseAudio.bgm;
    return b?.samples.game === "ready" && b.position !== null;
  });
  expect(await bgmState(page)).toEqual({ playing: "game", tune: "game", danger: false });
  const loop = await page.evaluate(() => (window as any).__swapriseAudio.bgm.loop);
  expect(loop.start).toBeCloseTo(2.29, 1);
  expect(loop.end).toBeCloseTo(56.63, 1);
  // 区間の終わりの 0.3 秒前へ飛ばすと、区間の頭へ戻って続く
  await page.evaluate(() => {
    const b = (window as any).__swapriseAudio.bgm;
    b.seek(b.loop.end - 0.3);
  });
  await page.waitForTimeout(800);
  const wrapped = await page.evaluate(() => (window as any).__swapriseAudio.bgm.position);
  expect(wrapped).toBeGreaterThanOrEqual(loop.start);
  expect(wrapped).toBeLessThan(loop.start + 1.2);

  // ピンチに入るとピンチの曲を導入なしで 9 小節目から鳴らす。抜けて戻ると、切り替えたときの小節の頭からゲーム曲が続く
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForFunction(() => (window as any).__swapriseAudio.bgm.tune === "danger");
  await page.waitForFunction(() => (window as any).__swapriseAudio.bgm.samples.danger === "ready" && (window as any).__swapriseAudio.bgm.position !== null);
  const dangerLoop = await page.evaluate(() => (window as any).__swapriseAudio.bgm.loop);
  expect(dangerLoop.start).toBeCloseTo(12.85, 1);
  expect(dangerLoop.end).toBeCloseTo(38.44, 1);
  const dangerPos = await page.evaluate(() => (window as any).__swapriseAudio.bgm.position);
  expect(dangerPos).toBeGreaterThanOrEqual(dangerLoop.start);
  expect(dangerPos).toBeLessThan(dangerLoop.start + 2);
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2], [1], [2], [3], [4], [0]]);
  });
  await page.waitForFunction(() => (window as any).__swapriseAudio.bgm.tune === "game", null, { timeout: 5000 });
  await page.waitForTimeout(300);
  const resumed = await page.evaluate(() => (window as any).__swapriseAudio.bgm.position);
  expect(resumed).toBeGreaterThanOrEqual(loop.start);
  expect(resumed).toBeLessThan(loop.start + 2.3 + 1.5);
});
