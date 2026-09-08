import { test, expect, type Page } from "@playwright/test";
import { GAME_VERSION } from "../src/net/protocol";
async function enter(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__swapriseScenes?.menu);
  await page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    m.index = 3;
    m.select();
  });
  await expect(
    page.getByRole("button", { name: "友達を招待", exact: true }),
  ).toBeVisible();
}
test("招待URLから2人で対戦し、降参して再戦する", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  q.on("pageerror", (e) => errors.push(e.message));
  await enter(p);
  await p.getByRole("textbox").fill("招待した人");
  await p.getByRole("button", { name: "友達を招待", exact: true }).click();
  await expect(p.getByRole("button", { name: "招待URLを共有" })).toBeVisible();
  await q.goto(p.url());
  await q.getByRole("textbox").fill("参加した人");
  await q.getByRole("button", { name: "部屋に参加", exact: true }).click();
  await p.getByRole("button", { name: "準備完了", exact: true }).click();
  await q.getByRole("button", { name: "準備完了", exact: true }).click();
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 120,
  );
  await q.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 120,
  );
  expect(
    await q.evaluate(() => (window as any).__swapriseOnline.session.player),
  ).toBe(1);
  await p.getByRole("button", { name: "設定", exact: true }).click();
  await p.getByRole("button", { name: "降参する", exact: true }).click();
  await p.getByRole("button", { name: "降参して終了", exact: true }).click();
  await expect(q.getByRole("status")).toContainText("勝ち");
  await expect(p.getByRole("status")).toContainText("負け");
  const old = await p.evaluate(
    () => (window as any).__swapriseOnline.session.state.match.id,
  );
  await p.getByRole("button", { name: "もう一度対戦" }).click();
  await q.getByRole("button", { name: "もう一度対戦" }).click();
  await p.waitForFunction(
    (id) =>
      (window as any).__swapriseOnline.session.state.match.id !== id &&
      (window as any).__swapriseOnline.session.lockstep.frame > 60,
    old,
  );
  expect(errors).toEqual([]);
  await a.close();
  await b.close();
});
test("ランダム待機はキャンセルでき、2人揃うと自動で開始する", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  await enter(p);
  await p.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await p.getByRole("button", { name: "キャンセル", exact: true }).click();
  await p.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60,
  );
  await q.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60,
  );
  await a.close();
  await b.close();
});
test("再読込で同じ席へ復帰し、対戦を再開できる", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  await enter(p);
  await p.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 240,
  );
  const id = await q.evaluate(
    () => (window as any).__swapriseOnline.session.state.match.id,
  );
  await q.reload();
  await q.waitForFunction((match) => {
    const s = (window as any).__swapriseOnline?.session;
    return (
      s?.state?.phase === "playing" &&
      s.lockstep.match.id === match &&
      s.lockstep.frame > 360
    );
  }, id);
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 360,
  );
  await a.close();
  await b.close();
});
test("スマホで自分の盤面を大きく表示し、せり上げと回転ができる", async ({
  browser,
}) => {
  const a = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  await enter(p);
  await p.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60,
  );
  expect(
    await p.evaluate(() => {
      const s = (window as any).__swapriseOnline;
      return [
        s.views[s.session.player].scale,
        s.views[1 - s.session.player].scale,
      ];
    }),
  ).toEqual([1, 0.5]);
  await p.screenshot({ path: "/tmp/swaprise-online-portrait.png" });
  await p.evaluate(() => {
    (window as any).__swapriseOnline.raise = true;
  });
  await p.waitForFunction(() => {
    const s = (window as any).__swapriseOnline;
    return (
      s.session.lockstep.game.boards[s.session.player].stats.manualRows > 0
    );
  });
  await p.evaluate(() => {
    (window as any).__swapriseOnline.raise = false;
  });
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForFunction(
    () => (window as any).__swapriseOnline.layout.phoneLandscape,
  );
  await p.screenshot({ path: "/tmp/swaprise-online-landscape.png" });
  await p.setViewportSize({ width: 390, height: 844 });
  await q.evaluate(() =>
    (window as any).__swapriseOnline.session.send({ type: "surrender" }),
  );
  await expect(p.getByRole("status")).toContainText("勝ち");
  expect(
    await p
      .getByRole("status")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(20);
  await p.screenshot({ path: "/tmp/swaprise-online-result-large.png" });
  await a.close();
  await b.close();
});
test("相手が部屋へ接続できなければ、ランダム待機へ戻る", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  await q.routeWebSocket("**/api/rooms/*/ws", () => {});
  await enter(p);
  await p.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await p.waitForFunction(
    () => !!(window as any).__swapriseOnline?.session?.state,
  );
  await expect(
    p.getByRole("button", { name: "キャンセル", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await a.close();
  await b.close();
});
test("片方が画面を隠すと停止し、戻ると同じ試合を再開する", async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  await enter(p);
  await p.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60,
  );
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await q.waitForFunction(
    () => (window as any).__swapriseOnline.session.state.phase === "suspended",
  );
  await q.waitForFunction(() =>
    (window as any).__swapriseOnline.session.state.seats.some(
      (s: any) => s.grace < 13000,
    ),
  );
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await q.waitForFunction(
    () => (window as any).__swapriseOnline.session.state.phase === "playing",
  );
  await p.waitForFunction(
    () => (window as any).__swapriseOnline.session.lockstep.frame > 180,
  );
  await a.close();
  await b.close();
});
test("盤面が食い違った場合は両者とも無効試合になる", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  await enter(p);
  await p.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "対戦相手を探す", exact: true }).click();
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60,
  );
  await p.evaluate(() => {
    (window as any).__swapriseOnline.session.lockstep.game.boards[0].score += 1;
  });
  await expect(p.getByRole("status")).toContainText("無効試合", {
    timeout: 15000,
  });
  await expect(q.getByRole("status")).toContainText("無効試合");
  await a.close();
  await b.close();
});

for (const rtt of [40, 100, 200]) {
  test(`往復${rtt}msと揺らぎがある回線でも対戦が進む`, async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    const timers = new Set<ReturnType<typeof setTimeout>>();
    try {
      for (const page of pages) {
        await page.routeWebSocket("**/api/rooms/*/ws", (ws) => {
          const server = ws.connectToServer();
          const forward = (target: typeof ws) => {
            let due = 0;
            let sequence = 0;
            return (message: string | Buffer) => {
              // WebSocketの順序を維持し、片道0〜10msの揺らぎを加える。
              due = Math.max(due, Date.now() + rtt / 2 + (sequence++ % 11));
              const timer = setTimeout(
                () => {
                  timers.delete(timer);
                  target.send(message);
                },
                Math.max(0, due - Date.now()),
              );
              timers.add(timer);
            };
          };
          ws.onMessage(forward(server));
          server.onMessage(forward(ws));
        });
        await enter(page);
        await page
          .getByRole("button", { name: "対戦相手を探す", exact: true })
          .click();
      }
      for (const page of pages) {
        await page.waitForFunction(
          () =>
            (window as any).__swapriseOnline?.session?.lockstep?.frame > 600,
        );
        const state = await page.evaluate(() => {
          const s = (window as any).__swapriseOnline.session;
          return {
            phase: s.state.phase,
            delay: s.state.match.delay,
            frame: s.lockstep.frame,
          };
        });
        expect(state.phase).toBe("playing");
        expect(state.delay).toBeGreaterThanOrEqual(
          Math.min(18, Math.ceil(rtt / (1000 / 60)) + 4),
        );
        console.log("ONLINE_LATENCY", JSON.stringify({ rtt, ...state }));
      }
    } finally {
      timers.forEach(clearTimeout);
      await Promise.all(contexts.map((c) => c.close()));
      timers.forEach(clearTimeout);
    }
  });
}

test("ランダム待機中の同じセッションは招待部屋を作れない", async ({ page }) => {
  await enter(page);
  await page
    .getByRole("button", { name: "対戦相手を探す", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "キャンセル", exact: true }),
  ).toBeVisible();
  const status = await page.evaluate(async (version) => {
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "二重参加", version }),
    });
    return response.status;
  }, GAME_VERSION);
  expect(status).toBe(409);
});

test("退室通信が遅れても次のランダム待機へ移れる", async ({ browser }) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const [p, q] = await Promise.all(contexts.map((c) => c.newPage()));
  await p.routeWebSocket("**/api/rooms/*/ws", (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      if (JSON.parse(message.toString()).type === "leave")
        setTimeout(() => server.send(message), 300);
      else server.send(message);
    });
  });
  for (const page of [p, q]) {
    await enter(page);
    await page
      .getByRole("button", { name: "対戦相手を探す", exact: true })
      .click();
  }
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60,
  );
  await p.getByRole("button", { name: "設定", exact: true }).click();
  await p.getByRole("button", { name: "降参する", exact: true }).click();
  await p.getByRole("button", { name: "降参して終了", exact: true }).click();
  await p.getByRole("button", { name: "次の相手を探す", exact: true }).click();
  await p.waitForFunction(
    () =>
      (window as any).__swapriseOnline?.queue?.readyState === WebSocket.OPEN,
  );
  await Promise.all(contexts.map((c) => c.close()));
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`スマホの待機ダイアログ ${viewport.width} は大きな文字と押しやすいボタンで表示する`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();
    await enter(page);
    await page
      .getByRole("button", { name: "対戦相手を探す", exact: true })
      .click();
    const size = await page.evaluate(() => {
      const root = document.querySelector(".online-panel")!;
      const button = root.querySelector("button")!;
      return {
        width: root.getBoundingClientRect().width,
        panelHeight: root.getBoundingClientRect().height,
        font: parseFloat(
          getComputedStyle(root.querySelector("[role=status]")!).fontSize,
        ),
        height: button.getBoundingClientRect().height,
      };
    });
    expect(size.width).toBeGreaterThanOrEqual(viewport.width - 32);
    expect(size.panelHeight).toBeGreaterThanOrEqual(viewport.height - 32);
    expect(size.font).toBeGreaterThanOrEqual(28);
    expect(size.height).toBeGreaterThanOrEqual(64);
    await page.screenshot({ path: `/tmp/swaprise-online-dialog-${viewport.width}.png` });
    await context.close();
  });

}

test("自分の交換は通信の確定を待たず次のtickで描画する", async ({
  browser,
}) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const [p, q] = await Promise.all(contexts.map((c) => c.newPage()));
  for (const page of [p, q]) {
    await enter(page);
    await page
      .getByRole("button", { name: "対戦相手を探す", exact: true })
      .click();
  }
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 120,
  );
  const state = await p.evaluate(() => {
    const s = (window as any).__swapriseOnline;
    s.game.loop.sleep();
    const board = s.session.lockstep.game.boards[s.session.player];
    board.setColumns([
      [0, 1],
      [2, 3],
      [4, 0],
      [1, 2],
      [3, 4],
      [0, 1],
    ]);
    s.prediction?.reset();
    s.accumulator = 0;
    s.playerInput.poll = () => ({
      moveX: 0,
      moveY: 0,
      swap: true,
      raise: false,
      cursorTo: { x: 0, y: 0 },
    });
    s.update(0, 1000 / 60);
    return {
      visible: s.views[s.session.player].board.cell(0, 0).state,
      confirmed: board.cell(0, 0).state,
    };
  });
  expect(state.visible).toBe("swapping");
  expect(state.confirmed).not.toBe("swapping");
  await Promise.all(contexts.map((c) => c.close()));
});
