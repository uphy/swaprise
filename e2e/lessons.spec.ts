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

// 同梱の Fredoka は I と V の組を詰めすぎ、canvas の「ACTIVE CHAIN」が「ACTME CHAIN」に読めた。Fredoka の大文字だけの行はカーニングを切って描く。
// 小文字の説明文まで切ると字間が広がって行数が増えたので、説明文は通常のカーニングのまま。
// 行数は環境の字幅で変わる（Linux の Chromium は字幅を丸めて広く測り、通常のカーニングでも 320×568 で 5 行になる）ので、行数ではなく字幅で確かめる。
// 説明の最後の行が画面に収まることは、下の背の低い縦持ちのテストで確かめる
test("レッスン 5: ACTIVE CHAIN の見出しはカーニングなし、小文字の説明文は通常のカーニングで描く", async ({ page }) => {
  await openLesson(page, 5);
  await page.waitForFunction(() => (window as any).__swaprise.scene.children.list.some((o: any) => o.type === "Text" && o.text.includes("ACTIVE CHAIN")));
  const widths = await page.evaluate(() => {
    const o = (window as any).__swaprise.scene.children.getByName("lesson-text");
    const [title, body] = o.getWrappedText();
    const ref = document.createElement("canvas").getContext("2d")!;
    ref.font = o.context.font;
    const w = (s: string, k: CanvasFontKerning) => ((ref.fontKerning = k), ref.measureText(s).width);
    return {
      title, body,
      titleText: o.context.measureText(title).width, titleNone: w(title, "none"), titleNormal: w(title, "normal"),
      bodyText: o.context.measureText(body).width, bodyNone: w(body, "none"), bodyNormal: w(body, "normal"),
    };
  });
  expect(widths.title).toContain("ACTIVE CHAIN");
  // 見出しはカーニングの有無で幅が変わる（IV の組が詰まる）ので、比べる意味がある
  expect(widths.titleNone).not.toBe(widths.titleNormal);
  expect(widths.titleText).toBe(widths.titleNone);
  expect(widths.bodyNone).not.toBe(widths.bodyNormal);
  expect(widths.bodyText).toBe(widths.bodyNormal);
});

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
      label: v.labelText.text,
      info: v.infoLine,
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

test("LEARN と PUZZLE では使わない得点の数字を出さず、エンドレスには出す", async ({ page }) => {
  const scoreVisible = () => page.evaluate(() => (window as any).__swaprise.scene.views[0].scoreText.visible);
  for (const url of ["/?mode=lesson&lesson=1&bgm=0&countdown=0", "/?mode=puzzle&bgm=0"]) {
    await page.goto(url);
    await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
    expect(await scoreVisible()).toBe(false);
  }
  await page.goto("/?mode=endless&bgm=0&countdown=0");
  await page.waitForFunction(() => (window as any).__swaprise?.game.boards[0].frame > 0);
  expect(await scoreVisible()).toBe(true);
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
  test("1 PLAYER の 4 枚目（LEARN）のカードが下段の RECORDS / SETTINGS と重ならない", async ({ page }) => {
    await page.goto("/?bgm=0&opening=0");
    await page.waitForFunction(() => !!(window as any).__swapriseScenes?.menu);
    await page.waitForTimeout(300);
    const pos = await page.evaluate(() => {
      const m = (window as any).__swapriseScenes.menu;
      m.index = 0;
      m.select();
      const learn = m.children.getByName("item-learn-card");
      const tool = m.tools[1];
      return { items: m.texts.length, learnBottom: learn.y + learn.height / 2, toolTop: tool.y - tool.height / 2, toolBottom: tool.y + tool.height / 2, screen: m.cameras.main.height / m.cameras.main.zoom };
    });
    expect(pos.items).toBe(5);
    expect(pos.learnBottom).toBeLessThan(pos.toolTop);
    expect(pos.toolBottom).toBeLessThan(pos.screen);
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
    // 一言（3 行）の下端が NEXT の上端より上にあり、SHARE は出ない
    await page.waitForFunction(() => (window as any).__swaprise.scene.views[0].overlay.list.some((o: any) => o.name === "next"));
    const layout = await page.evaluate(() => {
      const v = (window as any).__swaprise.scene.views[0];
      const next = v.overlay.list.find((o: any) => o.name === "next");
      return { bodyBottom: v.overlayBody.y + v.overlayBody.height, nextTop: next.y - 18, share: v.overlay.list.some((o: any) => o.txt?.text === "SHARE") };
    });
    expect(layout.bodyBottom).toBeLessThan(layout.nextTop);
    expect(layout.share).toBe(false);
    await page.screenshot({ path: `${SHOT}/lesson-3-phone-ja-done.png` });
  });

  test("届かない手のあとの案内（2 行）が RESET と縦に重ならない", async ({ page }) => {
    await openLesson(page, 1);
    await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
    await swapAt(page, 0, 0);
    await page.evaluate(() => {
      const p = (window as any).__swaprise;
      for (let i = 0; i < 60; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }]);
    });
    const pos = await page.evaluate(() => {
      const p = (window as any).__swaprise;
      const stuck = p.scene.children.getByName("lesson-stuck");
      const reset = p.scene.children.getByName("lesson-reset");
      return { visible: stuck.visible, stuckTop: stuck.y, stuckBottom: stuck.y + stuck.height, resetTop: reset.y - reset.height / 2, resetBottom: reset.y + reset.height / 2, screen: p.layout.height };
    });
    expect(pos.visible).toBe(true);
    // RESET は盤面の上の行にあり、案内（説明の下）とは縦に離れている
    expect(pos.resetBottom).toBeLessThan(pos.stuckTop);
    expect(pos.resetTop).toBeGreaterThanOrEqual(0);
    expect(pos.stuckBottom).toBeLessThanOrEqual(pos.screen);
    await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
    await page.screenshot({ path: `${SHOT}/lesson-1-stuck-phone-ja.png` });
  });
});

// 背の低い縦持ち（論理の高さ約 533px）では、説明と RESET を盤面の下に積むと画面の下にはみ出し、
// 説明の最後の行が切れて RESET が見えなかった。盤面を縮めて説明を収め、RESET は盤面の上の行に置く
for (const [w, h] of [[320, 568], [360, 640], [375, 667]]) {
  for (const locale of ["en-US", "ja-JP"]) {
    test.describe(`${w}×${h}・${locale}`, () => {
      test.use({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale });
      test("レッスン 1〜6 で説明の最後の行と RESET が画面に収まり、盤面・名前の札・ポーズボタンと重ならない", async ({ page }) => {
        for (let n = 1; n <= 6; n++) {
          await openLesson(page, n);
          const r = await page.evaluate(() => {
            const p = (window as any).__swaprise;
            const s = p.scene;
            const text = s.children.getByName("lesson-text");
            const reset = s.children.getByName("lesson-reset");
            const v = s.views[0];
            const label = v.labelText.getBounds();
            const pause = s.pauseButton;
            return {
              screen: p.layout.height,
              width: p.layout.width,
              textTop: text.y,
              textBottom: text.y + text.height,
              boardBottom: v.oy + 384 * v.scale,
              reset: reset ? { top: reset.y - reset.height / 2, bottom: reset.y + reset.height / 2, left: reset.x - reset.width / 2, right: reset.x + reset.width / 2 } : null,
              boardTop: v.oy,
              labelRight: label.right,
              pauseLeft: pause.x - pause.width / 2,
            };
          });
          const at = `lesson ${n}`;
          expect(r.textBottom, at).toBeLessThanOrEqual(r.screen);
          expect(r.textTop, at).toBeGreaterThan(r.boardBottom);
          if (n <= 5) expect(r.reset, at).not.toBeNull();
          if (r.reset) {
            expect(r.reset.top, at).toBeGreaterThanOrEqual(0);
            expect(r.reset.bottom, at).toBeLessThanOrEqual(r.boardTop);
            expect(r.reset.left, at).toBeGreaterThan(r.labelRight);
            expect(r.reset.right, at).toBeLessThanOrEqual(r.pauseLeft);
          }
        }
      });
    });
  }
}
