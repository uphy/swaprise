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

test("危険状態ではピンチの曲に切り替わり、抜けるとゲーム曲に戻る。終了後は止まり、メニューではメニュー曲", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  // AudioContext はユーザー操作のあとでしか動かないので、1回クリックしてから始める
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("game");

  // 上2段にパネルを入れて危険状態にする
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(300);
  const danger = await bgmState(page);
  expect(danger).toEqual({ playing: "game", tune: "danger", danger: true });

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
});

test("対戦: 相手だけがピンチでも曲は変わらず、自分がピンチのときだけ変わる", async ({ page }) => {
  await page.goto("/?mode=versus&seed=11&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("game");

  // 相手（boards[1]）だけを上2段まで積んでも、自分の曲は変わらない
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[1];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(300);
  expect(await bgmState(page)).toEqual({ playing: "game", tune: "game", danger: false });

  // 自分（boards[0]）も上2段まで積むと、ピンチの曲に切り替わる
  await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    b.setColumns([[0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0], [1], [2], [3], [4], [0]]);
  });
  await page.waitForTimeout(300);
  expect(await bgmState(page)).toEqual({ playing: "game", tune: "danger", danger: true });
});

test("メニューで画面が隠れると曲が止まり、戻ると鳴り直す", async ({ page }) => {
  await page.goto("/?countdown=0");
  await page.mouse.click(10, 10);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("menu");

  await setHidden(page, true);
  await page.waitForTimeout(400);
  expect((await bgmState(page)).playing).toBeNull();

  await setHidden(page, false);
  await page.waitForTimeout(300);
  expect((await bgmState(page)).playing).toBe("menu");
});
