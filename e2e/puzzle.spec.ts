import { expect, test } from "@playwright/test";

/** 記録された解を順に入れ替えて、面をクリアする。 */
async function playSolution(page: import("@playwright/test").Page): Promise<void> {
  const moves: { x: number; y: number }[] = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return String(p.game.puzzle.solution)
      .split(" ")
      .map((t: string) => {
        const [x, y] = t.split(",").map(Number);
        return { x, y };
      });
  });
  for (const m of moves) {
    await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].isSettled());
    await page.evaluate((mv) => {
      const p = (window as any).__swaprise;
      p.tick([{ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: mv }]);
    }, m);
  }
}

test("パズル: 面の名前と残り手数を出し、解どおりに入れ替えると CLEAR になって記録が残り、NEXT で次の面へ", async ({ page }) => {
  await page.goto("/?mode=puzzle&stage=1-1&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const v = p.scene.views[0];
    return {
      mode: p.game.mode,
      stage: p.game.stage,
      boards: p.game.boards.length,
      nextRow: p.game.boards[0].nextRow.length,
      movesLeft: p.game.boards[0].movesLeft,
      score: v.scoreText.text,
      text: v.infoText.text,
      // 次の行のパネルは描かない
      nextVisible: v.nextCells.some((img: any) => img.visible),
    };
  });
  expect(info.mode).toBe("puzzle");
  expect(info.stage).toBe(0);
  expect(info.boards).toBe(1);
  expect(info.nextRow).toBe(0);
  expect(info.score).toBe("PUZZLE 1-1");
  expect(info.text).toBe(`MOVES ${info.movesLeft}`);
  expect(info.nextVisible).toBe(false);

  await playSolution(page);
  await page.waitForFunction(() => (window as any).__swaprise.game.finished, null, { timeout: 15_000 });
  await page.waitForTimeout(1000);
  const result = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const v = p.scene.views[0];
    return {
      result: p.game.puzzleResult,
      title: v.overlayTitle.text,
      text: v.infoText.text,
      next: v.overlay.list.find((o: any) => o.name === "next")?.text ?? null,
      stored: JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}"),
    };
  });
  expect(result.result).toBe("clear");
  expect(result.title).toBe("CLEAR");
  expect(result.text).toBe("MOVES 0");
  expect(result.next).toBe("NEXT  1-2");
  expect(result.stored.puzzle).toEqual([0]);

  // NEXT で次の面
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.views[0].overlay.list.find((o: any) => o.name === "next").emit("pointerdown");
  });
  await page.waitForFunction(() => (window as any).__swaprise?.game?.stage === 1);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].scoreText.text)).toBe("PUZZLE 1-2");
});

test("パズル: 消えない入れ替えで手数を使い切ると FAILED。手数が尽きたあとの入れ替えは効かない", async ({ page }) => {
  await page.goto("/?mode=puzzle&stage=1&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
  // 1-1 は 1 手。いちばん左の2マスを入れ替えても消えない面を前提にせず、解でない入れ替えを探して使う
  const used = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const b = p.game.boards[0];
    const before = b.panelCount();
    const [sx, sy] = String(p.game.puzzle.solution).split(" ")[0].split(",").map(Number);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 5; x++) {
        if (x === sx && y === sy) continue;
        const a = b.cell(x, y).kind;
        const c = b.cell(x + 1, y).kind;
        if (a === c) continue; // 両方空か同じ柄
        p.tick([{ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x, y } }]);
        return { before, movesLeft: b.movesLeft };
      }
    }
    return null;
  });
  expect(used).not.toBeNull();
  await page.waitForFunction(() => (window as any).__swaprise.game.finished, null, { timeout: 15_000 });
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const v = p.scene.views[0];
    return {
      result: p.game.puzzleResult,
      title: v.overlayTitle.text,
      body: v.overlayBody.text,
      movesLeft: p.game.boards[0].movesLeft,
      stored: JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}"),
    };
  });
  expect(result.result).toBe("fail");
  expect(result.title).toBe("FAILED");
  expect(result.body).toMatch(/^\d+ PANELS LEFT$/);
  expect(result.movesLeft).toBe(0);
  expect(result.stored.puzzle ?? []).toEqual([]);
});

test("メニュー: 1P PUZZLE で面選びが開き、クリア済みの次の面が選ばれている。Enter で始まる", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("swaprise.highscores.v1", JSON.stringify({ puzzle: [0, 1] }));
  });
  await page.goto("/?bgm=0&opening=0");
  await page.waitForTimeout(400);
  // 1 PLAYER → 3 番目の PUZZLE。キーは間を空けて押す（続けて押すと Phaser が取りこぼす）
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__swapriseScenes.menu.children.getByName("crumb").text)).toBe("1 PLAYER ▸");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__swapriseScenes.menu.index)).toBe(2);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const picker = await page.evaluate(() => {
    const scene = (window as any).__swapriseScenes.menu;
    const panel = scene.children.getByName("puzzle-picker");
    if (!panel) return null;
    const texts = panel.list.map((o: any) => o.text).filter((t: any) => typeof t === "string");
    return { texts, face1: panel.list.find((o: any) => o.name === "face-1")?.text, face3: panel.list.find((o: any) => o.name === "face-3")?.text };
  });
  expect(picker).not.toBeNull();
  expect(picker!.face1).toBe("✓1");
  expect(picker!.face3).toBe("3");
  expect(picker!.texts.some((t: string) => t.startsWith("PUZZLE 1-3   "))).toBe(true);
  expect(picker!.texts).toContain(" STAGE 1 ");
  // 右で面を送り、Enter で始める
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  const started = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { mode: p.game.mode, stage: p.game.stage };
  });
  expect(started).toEqual({ mode: "puzzle", stage: 3 });
});
