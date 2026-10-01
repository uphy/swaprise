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
      score: v.labelText.text,
      text: v.infoLine,
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
  // 結果のボタンは 0.8 秒後に出る。固定時間で待つと CI の負荷で揺れるので、NEXT が出るまで待つ
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].overlay.list.some((o: any) => o.name === "next"));
  const result = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const v = p.scene.views[0];
    return {
      result: p.game.puzzleResult,
      title: v.overlayTitle.text,
      text: v.infoLine,
      body: v.overlayBody.text,
      next: v.overlay.list.find((o: any) => o.name === "next")?.text ?? null,
      stored: JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}"),
      undo: { alpha: p.scene.puzzleButtons.undo.alpha, enabled: Boolean(p.scene.puzzleButtons.undo.input?.enabled) },
      movesColor: v.chips[0].value.style.color,
    };
  });
  expect(result.result).toBe("clear");
  expect(result.title).toBe("CLEAR");
  // 残り手数（いつも 0）ではなく、解いた面と段の中の進みを出す
  expect(result.body).toBe("1-1 CLEAR  1/10");
  expect(result.body).not.toContain("MOVES LEFT");
  // クリアのあとは手を戻せないので、UNDO は暗く、押せない
  expect(result.undo).toEqual({ alpha: 0.4, enabled: false });
  await page.keyboard.press("u");
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__swaprise.game.puzzleResult)).toBe("clear");
  expect(result.text).toBe("MOVES 0");
  // 解き終えたあとの残り 0 手は警告ではないので、札を警告色の赤のままにしない (V2)
  expect(result.movesColor).toBe("#f4f4f8");
  expect(result.next).toBe("NEXT  1-2");
  expect(result.stored.puzzle).toEqual([0]);

  // NEXT で次の面
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.scene.views[0].overlay.list.find((o: any) => o.name === "next").emit("pointerdown");
  });
  await page.waitForFunction(() => (window as any).__swaprise?.game?.stage === 1);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].labelText.text)).toBe("PUZZLE 1-2");
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
      movesColor: v.chips[0].value.style.color,
      stored: JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}"),
    };
  });
  expect(result.result).toBe("fail");
  // 解けずに手数が尽きたときは警告色のまま
  expect(result.movesColor).toBe("#ff8a94");
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
  // メニューができてから押す。固定の待ちだけだと、ビルド直後の最初の読み込みで間に合わず Enter が落ちた
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.waitForTimeout(200);
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

test("パズル: カウントダウンなしで始まり、UNDO で 1 手戻り、REDO で打ち直せる。手を打つとヒントは消える", async ({ page }) => {
  // countdown=0 を付けなくても待たずに始まる
  await page.goto("/?mode=puzzle&stage=6&bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect(await page.evaluate(() => (window as any).__swaprise.scene.starting)).toBe(false);
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].frame > 0);

  // 1-6 は 2 手。解の 1 手目を打つ
  const first = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const [x, y] = String(p.game.puzzle.solution).split(" ")[0].split(",").map(Number);
    p.tick([{ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x, y } }]);
    return { x, y, movesLeft: p.game.boards[0].movesLeft, moves: p.game.puzzleMoves };
  });
  expect(first.movesLeft).toBe(1);
  expect(first.moves).toEqual([{ x: first.x, y: first.y }]);
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].isSettled());

  // ヒントを 2 回押すと、文が出てから盤面に目印が出る。UNDO で消える
  await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("hint").emit("pointerdown"));
  const hint1 = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { text: p.scene.children.getByName("puzzle-hint").text, visible: p.scene.children.getByName("puzzle-hint").visible, cells: p.scene.views[0].hintCells };
  });
  expect(hint1.visible).toBe(true);
  expect(hint1.text).toMatch(/^Next move: /);
  expect(hint1.cells).toEqual([]);
  await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("hint").emit("pointerdown"));
  const hint2 = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const [x, y] = String(p.game.puzzle.solution).split(" ")[1].split(",").map(Number);
    return { cells: p.scene.views[0].hintCells, expected: [{ x, y }, { x: x + 1, y }] };
  });
  expect(hint2.cells).toEqual(hint2.expected);

  await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("undo").emit("pointerdown"));
  const undone = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { movesLeft: p.game.boards[0].movesLeft, moves: p.game.puzzleMoves, canRedo: p.game.puzzleCanRedo, hintVisible: p.scene.children.getByName("puzzle-hint").visible, cells: p.scene.views[0].hintCells };
  });
  expect(undone).toEqual({ movesLeft: 2, moves: [], canRedo: true, hintVisible: false, cells: [] });

  await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("redo").emit("pointerdown"));
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].isSettled());
  const redone = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { movesLeft: p.game.boards[0].movesLeft, moves: p.game.puzzleMoves, canRedo: p.game.puzzleCanRedo };
  });
  expect(redone).toEqual({ movesLeft: 1, moves: [{ x: first.x, y: first.y }], canRedo: false });
});

test("パズル: 手数を使い切って FAILED になっても UNDO で 1 手戻って続きを遊べる", async ({ page }) => {
  await page.goto("/?mode=puzzle&stage=1&bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const b = p.game.boards[0];
    const [sx, sy] = String(p.game.puzzle.solution).split(" ")[0].split(",").map(Number);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 5; x++) {
        if ((x === sx && y === sy) || b.cell(x, y).kind === b.cell(x + 1, y).kind) continue;
        p.tick([{ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x, y } }]);
        return;
      }
    }
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.finished, null, { timeout: 15_000 });
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].overlay.list.some((o: any) => o.name === "retry"));
  await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("undo").emit("pointerdown"));
  const after = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const v = p.scene.views[0];
    return {
      finished: p.game.finished,
      result: p.game.puzzleResult,
      movesLeft: p.game.boards[0].movesLeft,
      overlay: v.overlay.visible,
      retry: v.overlay.list.some((o: any) => o.name === "retry"),
      ended: p.scene.ended,
    };
  });
  expect(after).toEqual({ finished: false, result: null, movesLeft: 1, overlay: false, retry: false, ended: false });
  // 戻したあと解を打てばクリアできる
  await playSolution(page);
  await page.waitForFunction(() => (window as any).__swaprise.game.puzzleResult === "clear", null, { timeout: 15_000 });
});

test("メニュー: 面選びを開いている間は後ろのメニュー（題字・カード・下段）を隠し、閉じたときと遊んで戻ったときは出す", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => (window as any).__swapriseScenes?.menu?.cards?.length);
  await page.waitForTimeout(200);
  const state = () => page.evaluate(() => {
    const scene = (window as any).__swapriseScenes.menu;
    const shown = (o: any) => o.visible;
    const menu = [...(scene.title?.layers ?? []), ...scene.cards.flatMap((c: any) => c.objects), ...scene.tools, ...scene.footer];
    const panel = scene.children.getByName("puzzle-picker");
    return {
      open: Boolean(panel),
      menuVisible: menu.filter(shown).length,
      menuTotal: menu.length,
    };
  });
  const before = await state();
  expect(before.menuVisible).toBe(before.menuTotal);
  await page.evaluate(() => (window as any).__swapriseScenes.menu.showPuzzlePicker());
  const open = await state();
  expect(open.open).toBe(true);
  expect(open.menuVisible).toBe(0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  const closed = await state();
  expect(closed.open).toBe(false);
  expect(closed.menuVisible).toBe(closed.menuTotal);
  // 面選びから遊び始め、メニューへ戻ったときもメニューが出ている
  await page.evaluate(() => (window as any).__swapriseScenes.menu.showPuzzlePicker());
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (window as any).__swaprise?.game?.mode === "puzzle");
  await page.evaluate(() => (window as any).__swaprise.scene.toMenu());
  await page.waitForFunction(() => (window as any).__swapriseScenes.menu.scene.isActive() && (window as any).__swapriseScenes.menu.cards.length);
  await page.waitForTimeout(200);
  const back = await state();
  expect(back.open).toBe(false);
  expect(back.menuVisible).toBe(back.menuTotal);
});

test("パズル: 最初の段の 1〜3 面だけ、目標と手数を盤面に出す。クリアの結果を出したら隠す", async ({ page }) => {
  const goal = () => page.evaluate(() => {
    const p = (window as any).__swaprise;
    const g = p.scene.children.getByName("puzzle-goal");
    const v = p.scene.views[0];
    return g ? { text: g.text, visible: g.visible, moves: p.game.puzzle.moves, inBoard: g.x > v.ox && g.x < v.ox + 192 * v.scale && g.y > v.oy && g.y < v.oy + 100 * v.scale } : null;
  });
  for (const stage of ["1-1", "1-2", "1-3"]) {
    await page.goto(`/?mode=puzzle&stage=${stage}&bgm=0&countdown=0`);
    await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
    const shown = await goal();
    expect(shown).not.toBeNull();
    // 手数は面ごとの値から作る
    expect(shown!.text).toBe(shown!.moves === 1 ? "CLEAR ALL PANELS IN 1 MOVE" : `CLEAR ALL PANELS IN ${shown!.moves} MOVES`);
    expect(shown!.visible).toBe(true);
    expect(shown!.inBoard).toBe(true);
  }
  // 解くと結果の見出しと重ならないよう隠す
  await playSolution(page);
  await page.waitForFunction(() => (window as any).__swaprise.game.finished, null, { timeout: 15_000 });
  await page.waitForFunction(() => (window as any).__swaprise.scene.ended);
  await page.waitForTimeout(100);
  expect((await goal())!.visible).toBe(false);
  // 4 面目からは出さない
  await page.goto("/?mode=puzzle&stage=1-4&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  expect(await goal()).toBeNull();
});

test("パズル: 目標の文言は日本語でも出す", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ja-JP" });
  const page = await context.newPage();
  await page.goto("/?mode=puzzle&stage=1-1&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("puzzle-goal")?.text)).toBe("1手ですべてのパネルを消そう");
  await context.close();
});

test("メニュー: 面選びの手数は日本語でも日本語で出す (U6)", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ja-JP" });
  await context.addInitScript(() => {
    localStorage.setItem("swaprise.highscores.v1", JSON.stringify({ puzzle: [0] }));
  });
  const page = await context.newPage();
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu.children.getByName("puzzle-picker")));
  const read = () =>
    page.evaluate(() => {
      const panel = (window as any).__swapriseScenes.menu.children.getByName("puzzle-picker");
      return panel.list.map((o: any) => o.text).filter((t: any) => typeof t === "string" && t.startsWith("パズル 1-"));
    });
  // 2 面目（1 手）
  expect(await read()).toEqual(["パズル 1-2   1手"]);
  // 1 面目はクリア済み。左へ送る
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(100);
  const texts = await read();
  expect(texts).toHaveLength(1);
  expect(texts[0]).toMatch(/^パズル 1-1   \d+手   クリア済み$/);
  expect(texts[0]).not.toMatch(/MOVE/);
  await context.close();
});
