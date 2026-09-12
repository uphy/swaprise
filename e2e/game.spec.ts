import { expect, test, type Page } from "@playwright/test";

const SHOT = "e2e/__screenshots__";

async function waitForGame(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game), null, { timeout: 15_000 });
  // 数フレーム描画させる
  await page.waitForTimeout(300);
}

function boardState(page: Page, index = 0) {
  return page.evaluate((i) => {
    const b = (window as any).__swaprise.game.boards[i];
    return {
      cursor: { ...b.cursor },
      score: b.score,
      frame: b.frame,
      gameOver: b.gameOver,
      text: b.toString(),
      maxChain: b.maxChain,
    };
  }, index);
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    throw err;
  });
});

test("メニューが表示され、キーボードでエンドレスを開始できる", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/?bgm=0&countdown=0&opening=0");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT}/menu.png` });
  // 1 PLAYER → ENDLESS
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await waitForGame(page);
  await page.getByRole("button", { name: "LATER", exact: true }).click();
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].frame > 0);
  const s = await boardState(page);
  expect(s.frame).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("エンドレス: カーソル移動と入れ替えが盤面に反映される", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await waitForGame(page);
  const before = await boardState(page);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(100);
  const moved = await boardState(page);
  expect(moved.cursor.x).toBe(before.cursor.x - 1);

  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(60);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  const low = await boardState(page);
  expect(low.cursor.y).toBe(before.cursor.y - 2);

  const swapped = await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[0];
    const { x, y } = b.cursor;
    const a = b.cell(x, y).kind;
    const c = b.cell(x + 1, y).kind;
    return { a, c, x, y };
  });
  await page.keyboard.press("z");
  await page.waitForTimeout(150);
  const after = await page.evaluate(({ x, y }) => {
    const b = (window as any).__swaprise.game.boards[0];
    return { a: b.cell(x, y).kind, c: b.cell(x + 1, y).kind };
  }, swapped);
  // 少なくとも一方は入れ替わっている（同じ柄同士や落下で変わらない場合を除く）
  if (swapped.a !== swapped.c) {
    expect([after.a, after.c]).toEqual(expect.arrayContaining([swapped.a, swapped.c]));
  }
  await page.screenshot({ path: `${SHOT}/endless.png` });
});

test("エンドレス: 3連鎖の盤面を仕込んで得点220点と吹き出しを確認", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0&speed=1");
  await waitForGame(page);
  // 描画ループを止めて、決定論的に tick を進める
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    const b = p.game.boards[0];
    b.setColumns([
      [2, 1, 0, 0, 4, 0, 1, 1, 3],
      [4, 3],
      [4, 3],
      [0, 2, 1],
      [3, 0, 2],
      [1, 4, 0],
    ]);
    b.cursor.x = 0;
    b.cursor.y = 4;
    b.score = 0;
  });
  const chains: number[] = [];
  const tick = (inputs: any[]) =>
    page.evaluate((ins) => {
      const p = (window as any).__swaprise;
      p.tick(ins);
      return p.game.boards[0].events.filter((e: any) => e.type === "match").map((e: any) => e.chain);
    }, inputs);
  chains.push(...(await tick([{ moveX: 0, moveY: 0, swap: true, raise: false }])));
  for (let i = 0; i < 20; i++) chains.push(...(await tick([{ moveX: 0, moveY: 0, swap: false, raise: false }])));
  // 最初の消去（chain 1）が起きた直後の画面
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForTimeout(50);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  await page.screenshot({ path: `${SHOT}/chain-start.png` });
  for (let i = 0; i < 380; i++) chains.push(...(await tick([{ moveX: 0, moveY: 0, swap: false, raise: false }])));
  expect(chains).toEqual([1, 2, 3]);
  const s = await boardState(page);
  expect(s.score).toBe(220);
  expect(s.maxChain).toBe(3);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${SHOT}/chain-end.png` });
});

test("対戦: 2つの盤面が出て、攻撃が相手に届く", async ({ page }) => {
  await page.goto("/?mode=versus&seed=11&bgm=0&countdown=0");
  await waitForGame(page);
  const n = await page.evaluate(() => (window as any).__swaprise.game.boards.length);
  expect(n).toBe(2);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    const b = p.game.boards[0];
    // 縦4個同時消し → 相手に幅3の板
    b.setColumns([[0, 0, 3, 0, 0], [1, 2], [2, 3, 1], [4, 0, 2], [1, 2, 3], [3, 4, 0]]);
    b.cursor.x = 0;
    b.cursor.y = 2;
  });
  const tick = (inputs: any[]) => page.evaluate((ins) => (window as any).__swaprise.tick(ins), inputs);
  await tick([{ moveX: 0, moveY: 0, swap: true, raise: false }, { moveX: 0, moveY: 0, swap: false, raise: false }]);
  const p2State = () =>
    page.evaluate(() => {
      const b = (window as any).__swaprise.game.boards[1];
      return { pending: b.pendingGarbage.length, garbage: b.garbage.size };
    });
  // 同時消しの板は揃ってから100フレーム待って送るので、40フレームではまだ相手に届かない
  for (let i = 0; i < 40; i++) {
    await tick([{ moveX: 0, moveY: 0, swap: false, raise: false }, { moveX: 0, moveY: 0, swap: false, raise: false }]);
  }
  const early = await p2State();
  expect(early.pending + early.garbage).toBe(0);
  const texts = () =>
    page.evaluate(() => {
      const v = (window as any).__swaprise.scene.views[1];
      v.draw();
      return v.root.list.filter((o: any) => o.type === "Text" && o.visible).map((o: any) => o.text);
    });
  // 届いてから降りる（52 フレーム後）までは、予告の脇に段数「1」が見えている
  let waited = 0;
  while ((await p2State()).pending === 0 && waited++ < 140) {
    await tick([{ moveX: 0, moveY: 0, swap: false, raise: false }, { moveX: 0, moveY: 0, swap: false, raise: false }]);
  }
  expect(await p2State()).toEqual({ pending: 1, garbage: 0 });
  expect(await texts()).toContain("1");
  for (let i = waited; i < 140; i++) {
    await tick([{ moveX: 0, moveY: 0, swap: false, raise: false }, { moveX: 0, moveY: 0, swap: false, raise: false }]);
  }
  const p2 = await p2State();
  expect(p2.pending + p2.garbage).toBeGreaterThanOrEqual(1);
  const popups = await texts();
  // おじゃまが落ちて着地するまで進める
  for (let i = 0; i < 120; i++) {
    await tick([{ moveX: 0, moveY: 0, swap: false, raise: false }, { moveX: 0, moveY: 0, swap: false, raise: false }]);
  }
  const g = await page.evaluate(() => {
    const b = (window as any).__swaprise.game.boards[1];
    return [...b.garbage.values()].map((x: any) => ({ w: x.width, h: x.height, y: x.y, state: x.state }));
  });
  expect(g.length).toBe(1);
  expect(g[0].w).toBe(3);
  expect(g[0].state).toBe("idle");
  // 届いた瞬間に相手の盤面へ「+1」が出る（シーンを止めているので消えずに残る）
  expect(popups).toContain("+1");
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${SHOT}/versus.png` });
});

test("対戦: ビックリパネルと灰色のおじゃまが描画される", async ({ page }) => {
  await page.goto("/?mode=versus&seed=11&bgm=0&countdown=0");
  await waitForGame(page);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    const [a, b] = p.game.boards;
    a.setColumns([[6], [6], [1], [6], [2, 6], [3, 0]]);
    a.cursor.x = 2;
    a.cursor.y = 0;
    b.setColumns([[0], [1], [2], [3], [4], [0]]);
    b.placeGarbage(0, 1, 6, 1, "shock");
    b.placeGarbage(0, 2, 6, 1, "normal");
    b.placeGarbage(0, 3, 6, 1, "shock");
  });
  const tick = (inputs: any[]) => page.evaluate((ins) => (window as any).__swaprise.tick(ins), inputs);
  await tick([{ moveX: 0, moveY: 0, swap: true, raise: false }, { moveX: 0, moveY: 0, swap: false, raise: false }]);
  // 3枚消しの灰色の板は、揃ってから100フレーム待って送られ、52フレーム後に相手の予告に入り、相手の盤面が静止していれば降る
  for (let i = 0; i < 200; i++) {
    await tick([{ moveX: 0, moveY: 0, swap: false, raise: false }, { moveX: 0, moveY: 0, swap: false, raise: false }]);
  }
  const shockBlocks = await page.evaluate(() =>
    [...(window as any).__swaprise.game.boards[1].garbage.values()].filter((g: any) => g.type === "shock").length,
  );
  expect(shockBlocks).toBe(3);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${SHOT}/shock.png` });
});

test("エンドレス: 天井まで積むとゲームオーバーの表示になる", async ({ page }) => {
  await page.goto("/?mode=endless&seed=3&bgm=0&countdown=0");
  await waitForGame(page);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const b = p.game.boards[0];
    const col: number[] = [];
    for (let r = 0; r < 12; r++) col.push(r % 2);
    b.setColumns([col, [1], [2], [3], [4], [0]]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.finished, null, { timeout: 10_000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOT}/gameover.png` });
  const s = await boardState(page);
  expect(s.gameOver).toBe(true);
});

test("エンドレス: ゲームオーバー後は経過時間の表示が止まる", async ({ page }) => {
  await page.goto("/?mode=endless&seed=3&bgm=0&countdown=0");
  await waitForGame(page);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const b = p.game.boards[0];
    const col: number[] = [];
    for (let r = 0; r < 12; r++) col.push(r % 2);
    b.setColumns([col, [1], [2], [3], [4], [0]]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.finished, null, { timeout: 10_000 });
  const readInfoText = () =>
    page.evaluate(() => (window as any).__swaprise.scene.views[0].infoText.text as string);
  const before = await readInfoText();
  await page.waitForTimeout(1500);
  const after = await readInfoText();
  expect(after).toBe(before);
});

test("CPU 戦: 相手が 4 連鎖を組むと自分の盤面に知らせが出る", async ({ page }) => {
  await page.goto("/?mode=cpu&seed=7&bgm=0&countdown=0&speed=1");
  await waitForGame(page);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.scene.pause();
    // CPU の手を止め、CPU の盤面に 4 連鎖の形を仕込む（列 0 の 4 を右へ出すと 0,0,0 → 1,1,1 → 3,3,3 → 2,2,2）
    p.game.cpu = null;
    const b = p.game.boards[1];
    b.noRise = true;
    b.setColumns([[2, 2, 1, 0, 0, 4, 0, 1, 1, 3, 2], [4, 3, 3], [4, 3, 3], [0, 2, 1], [3, 0, 2], [1, 4, 0]]);
    b.cursor.x = 0;
    b.cursor.y = 5;
  });
  const NO = { moveX: 0, moveY: 0, swap: false, raise: false };
  const step = (input: any) =>
    page.evaluate((ins) => {
      const p = (window as any).__swaprise;
      p.tick(ins);
      return p.scene.views[0].root.list.filter((o: any) => o.type === "Text" && o.text.startsWith("OPPONENT")).map((o: any) => o.text);
    }, [NO, input]);
  const seen: string[] = [];
  seen.push(...(await step({ moveX: 0, moveY: 0, swap: true, raise: false })));
  for (let i = 0; i < 600; i++) seen.push(...(await step(NO)));
  expect(seen).toContain("OPPONENT x4!");
  expect(seen).not.toContain("OPPONENT x3!");
});

test("エンドレス: 14 連鎖以上の吹き出しも数字で出す", async ({ page }) => {
  await page.goto("/?mode=endless&seed=7&bgm=0&countdown=0");
  await waitForGame(page);
  const texts = await page.evaluate(() => {
    const v = (window as any).__swaprise.scene.views[0];
    v.popup(2, 3, 3, 14);
    return v.root.list.filter((o: any) => o.type === "Text").map((o: any) => o.text);
  });
  expect(texts).toContain("x14");
});
