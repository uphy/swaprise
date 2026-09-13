import { expect, test, devices, type Page } from "@playwright/test";

const SHOT = "e2e/__screenshots__";

async function openLesson(page: Page, n: number): Promise<void> {
  await page.goto(`/?mode=lesson&lesson=${n}&bgm=0&countdown=0`);
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(200);
}

/** 描画ループを止めて、カーソルを置いて入れ替える。 */
async function swapAt(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ({ x, y }) => (window as any).__swaprise.tick([{ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x, y } }]),
    { x, y },
  );
}

async function tickUntilFinished(page: Page, max = 3000): Promise<void> {
  await page.evaluate((max) => {
    const p = (window as any).__swaprise;
    for (let i = 0; i < max && !p.game.finished; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
  }, max);
}

test("レッスン 1: 説明と課の名前を出し、せり上がりもバーもなく、3 枚消すと NICE! になって記録が残り、NEXT LESSON で次の課へ", async ({ page }) => {
  await openLesson(page, 1);
  const info = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const v = p.scene.views[0];
    return {
      mode: p.game.mode,
      lesson: p.game.lessonIndex,
      nextRow: p.game.boards[0].nextRow.length,
      movesLeft: p.game.boards[0].movesLeft,
      label: v.scoreText.text,
      info: v.infoText.text,
      bar: p.scene.raiseHints[0].visible,
      text: p.scene.children.getByName("lesson-text")?.text,
      reset: Boolean(p.scene.children.getByName("lesson-reset")),
    };
  });
  expect(info).toMatchObject({ mode: "lesson", lesson: 0, nextRow: 0, movesLeft: null, label: "LESSON 1 / 6", info: "", bar: false, reset: true });
  // 目印は最初から出る
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].hintCells)).toEqual([{ x: 3, y: 1 }, { x: 4, y: 1 }]);
  expect(info.text).toContain("CLEAR 3");
  expect(info.text).toContain("Line up 3 of the same panel");
  await page.screenshot({ path: `${SHOT}/lesson-1.png` });

  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  await swapAt(page, 3, 1);
  await tickUntilFinished(page);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForFunction(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return v.overlay.visible && v.overlay.list.some((o: any) => o.name === "next");
  });
  const result = await page.evaluate(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return { title: v.overlayTitle.text, body: v.overlayBody.text, next: v.overlay.list.find((o: any) => o.name === "next").txt.text };
  });
  expect(result.title).toBe("NICE!");
  expect(result.body).toContain("You cleared 3 panels");
  expect(result.next).toBe("NEXT LESSON");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}").lessons);
  expect(stored).toEqual([0]);
  await page.screenshot({ path: `${SHOT}/lesson-1-done.png` });

  await page.evaluate(() => (window as any).__swaprise.scene.views[0].overlay.list.find((o: any) => o.name === "next").emit("pointerdown"));
  await page.waitForFunction(() => (window as any).__swaprise?.game?.lessonIndex === 1);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("lesson-text").text)).toContain("DROP");
});

test("レッスン 1: 届かない手で盤面が静止すると RESET の案内が出て、RESET で最初の形に戻る", async ({ page }) => {
  await openLesson(page, 1);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  // 下の段の無関係な 2 枚を入れ替える
  await swapAt(page, 0, 0);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    for (let i = 0; i < 60; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
  });
  const stuck = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { visible: p.scene.children.getByName("lesson-stuck").visible, text: p.scene.children.getByName("lesson-stuck").text, hint: p.scene.views[0].hintCells, done: p.game.lessonDone };
  });
  expect(stuck).toEqual({ visible: true, text: "The board changed. RESET puts it back.", hint: [], done: false });
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.screenshot({ path: `${SHOT}/lesson-1-stuck.png` });
  await page.evaluate(() => (window as any).__swaprise.scene.children.getByName("lesson-reset").emit("pointerdown"));
  await page.waitForFunction(() => {
    const p = (window as any).__swaprise;
    return p.game.boards[0].frame < 30 && !p.scene.children.getByName("lesson-stuck").visible;
  });
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].hintCells)).toEqual([{ x: 3, y: 1 }, { x: 4, y: 1 }]);
});

test("レッスン 5: 最初の消去が始まった瞬間に右の 2 枚に目印が出て、点滅中に入れ替えるとアクティブ連鎖で達成", async ({ page }) => {
  await openLesson(page, 5);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].hintCells)).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  await swapAt(page, 0, 0);
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    for (let i = 0; i < 20; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
  });
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].hintCells)).toEqual([{ x: 4, y: 0 }, { x: 5, y: 0 }]);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${SHOT}/lesson-5-hint.png` });
  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  await swapAt(page, 4, 0);
  // 入れ替えたら目印は消える
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].hintCells)).toEqual([]);
  await tickUntilFinished(page);
  expect(await page.evaluate(() => {
    const g = (window as any).__swaprise.game;
    return { done: g.lessonDone, chain: g.boards[0].maxChain, active: g.boards[0].stats.activeSwaps };
  })).toEqual({ done: true, chain: 2, active: 1 });
});

test("レッスン 6: せり上がる盤面でバーが出て、達成すると PLAY ENDLESS でエンドレスへ", async ({ page }) => {
  await openLesson(page, 6);
  const info = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { nextRow: p.game.boards[0].nextRow.length, bar: p.scene.raiseHints[0].visible, reset: Boolean(p.scene.children.getByName("lesson-reset")) };
  });
  expect(info).toEqual({ nextRow: 6, bar: true, reset: false });
  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  // 2 連鎖を組む代わりに達成の印を立て、静止を待って終える
  await page.evaluate(() => { (window as any).__swaprise.game.lessonDone = true; });
  await tickUntilFinished(page);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForFunction(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return v.overlay.visible && v.overlay.list.some((o: any) => o.name === "next");
  });
  expect(await page.evaluate(() => (window as any).__swaprise.scene.views[0].overlay.list.find((o: any) => o.name === "next").txt.text)).toBe("PLAY ENDLESS");
  await page.evaluate(() => (window as any).__swaprise.scene.views[0].overlay.list.find((o: any) => o.name === "next").emit("pointerdown"));
  await page.waitForFunction(() => (window as any).__swaprise?.game?.mode === "endless");
});

test("レッスン 6: せり上げ続けて天井に届くと GAME OVER で、記録されず NEXT も出ない", async ({ page }) => {
  await openLesson(page, 6);
  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    for (let i = 0; i < 60 * 60 && !p.game.finished; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: true }]);
  });
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].overlay.visible);
  await page.waitForTimeout(1000);
  const result = await page.evaluate(() => {
    const v = (window as any).__swaprise.scene.views[0];
    return { title: v.overlayTitle.text, next: v.overlay.list.some((o: any) => o.name === "next"), lessons: JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}").lessons ?? [] };
  });
  expect(result).toEqual({ title: "GAME OVER", next: false, lessons: [] });
});

test("メニューの 1 PLAYER に LEARN があり、まだ終えていない最初の課から始まる", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("swaprise.highscores.v1", JSON.stringify({ lessons: [0, 1] }));
  });
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => !!(window as any).__swapriseScenes?.menu);
  await page.waitForTimeout(300);
  const caption = await page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    m.index = 0;
    m.select();
    return { label: m.texts[3].text.trim(), caption: m.captions[3].text };
  });
  expect(caption).toEqual({ label: "LEARN", caption: "2 / 6 LESSONS" });
  await page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    m.index = 3;
    m.select();
  });
  await page.waitForFunction(() => (window as any).__swaprise?.game?.mode === "lesson");
  expect(await page.evaluate(() => (window as any).__swaprise.game.lessonIndex)).toBe(2);
});

test.describe("スマホ", () => {
  const pixel = devices["Pixel 7"];
  test.use({ viewport: pixel.viewport, deviceScaleFactor: pixel.deviceScaleFactor, isMobile: pixel.isMobile, hasTouch: pixel.hasTouch, userAgent: pixel.userAgent });
  test("縦持ちでは説明が盤面の下に収まり、タッチの操作で書かれている", async ({ page }) => {
    await openLesson(page, 1);
    const info = await page.evaluate(() => {
      const p = (window as any).__swaprise;
      const text = p.scene.children.getByName("lesson-text");
      const reset = p.scene.children.getByName("lesson-reset");
      return { text: text.text, bottom: reset.y + 16, height: p.layout.height };
    });
    expect(info.text).toContain("Drag a panel sideways");
    expect(info.bottom).toBeLessThan(info.height);
    await page.screenshot({ path: `${SHOT}/lesson-1-phone.png` });
  });
});

test.describe("スマホ・メニュー", () => {
  const pixel = devices["Pixel 7"];
  test.use({ viewport: pixel.viewport, deviceScaleFactor: pixel.deviceScaleFactor, isMobile: pixel.isMobile, hasTouch: pixel.hasTouch, userAgent: pixel.userAgent });
  test("1 PLAYER の 5 つ目（BACK）が下段の RECORDS / SETTINGS と重ならない", async ({ page }) => {
    await page.goto("/?bgm=0&opening=0");
    await page.waitForFunction(() => !!(window as any).__swapriseScenes?.menu);
    await page.waitForTimeout(300);
    const pos = await page.evaluate(() => {
      const m = (window as any).__swapriseScenes.menu;
      m.index = 0;
      m.select();
      const back = m.texts[4];
      const tool = m.tools[1];
      return { items: m.texts.length, backBottom: back.y + back.height / 2, toolTop: tool.y - 17, screen: m.cameras.main.height / m.cameras.main.zoom };
    });
    expect(pos.items).toBe(5);
    expect(pos.backBottom).toBeLessThan(pos.toolTop);
    expect(pos.toolTop + 34).toBeLessThan(pos.screen);
    await page.screenshot({ path: `${SHOT}/menu-1p-phone.png` });
  });
});

test.describe("スマホ・日本語", () => {
  const pixel = devices["Pixel 7"];
  test.use({ viewport: pixel.viewport, deviceScaleFactor: pixel.deviceScaleFactor, isMobile: pixel.isMobile, hasTouch: pixel.hasTouch, userAgent: pixel.userAgent, locale: "ja-JP" });
  test("日本語の説明は空白がなくても折り返され、画面の幅に収まる", async ({ page }) => {
    await openLesson(page, 3);
    const info = await page.evaluate(() => {
      const p = (window as any).__swaprise;
      const text = p.scene.children.getByName("lesson-text");
      return { text: text.text, left: text.x - text.width / 2, right: text.x + text.width / 2, width: p.layout.width };
    });
    expect(info.text).toContain("連鎖");
    expect(info.left).toBeGreaterThanOrEqual(0);
    expect(info.right).toBeLessThanOrEqual(info.width);
    await page.screenshot({ path: `${SHOT}/lesson-3-phone-ja.png` });
    // 達成の一言も盤面の幅に収まる
    await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
    await swapAt(page, 0, 1);
    await tickUntilFinished(page);
    await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
    await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].overlay.visible);
    const body = await page.evaluate(() => {
      const v = (window as any).__swaprise.scene.views[0];
      return { text: v.overlayBody.text, width: v.overlayBody.width, board: 6 * 32 };
    });
    expect(body.text).toContain("2連鎖");
    expect(body.width).toBeLessThanOrEqual(body.board);
    await page.screenshot({ path: `${SHOT}/lesson-3-phone-ja-done.png` });
  });
});
