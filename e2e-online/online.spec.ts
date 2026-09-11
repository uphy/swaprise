import { test, expect, type Page } from "@playwright/test";
import { GAME_VERSION } from "../src/net/protocol";
async function enter(page: Page) {
  await page.goto("/?opening=0");
  await page.waitForFunction(() => !!(window as any).__swapriseScenes?.menu);
  const typography = await page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    const canvas = m.game.canvas;
    const scale = m.cameras.main.zoom * canvas.getBoundingClientRect().width / canvas.width;
    const item = { size: parseFloat(m.texts[3].style.fontSize) * scale, family: m.texts[3].style.fontFamily };
    m.index = 3;
    m.select();
    return item;
  });
  await expect(
    page.getByRole("button", { name: "INVITE FRIEND", exact: true }),
  ).toBeVisible();
  return typography;
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
  await p.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await expect(p.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
  await q.goto(p.url());
  await q.getByRole("textbox").fill("参加した人");
  await q.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
  // READY の操作はない。参加した時点で両者の RTT が測れ次第、カウントダウンが始まる
  await expect(p.getByRole("button", { name: "READY", exact: true })).toHaveCount(0);
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 120,
  );
  await q.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 120,
  );
  expect(
    await q.evaluate(() => (window as any).__swapriseOnline.session.player),
  ).toBe(1);
  await p.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await p.getByRole("button", { name: "SURRENDER", exact: true }).click();
  await p.getByRole("button", { name: "YES, SURRENDER", exact: true }).click();
  await expect(q.getByRole("status")).toContainText("YOU WIN");
  await expect(p.getByRole("status")).toContainText("YOU LOSE");
  // CPU 対戦と同じように、盤面の上にも勝敗を出す
  const overlays = (page: Page) =>
    page.evaluate(() =>
      (window as any).__swapriseOnline.views.map((v: any) => ({
        title: v.overlayTitle.text,
        visible: v.overlay.visible,
      })),
    );
  expect(await overlays(p)).toEqual([
    { title: "LOSE", visible: true },
    { title: "WIN", visible: true },
  ]);
  expect(await overlays(q)).toEqual([
    { title: "LOSE", visible: true },
    { title: "WIN", visible: true },
  ]);
  const old = await p.evaluate(
    () => (window as any).__swapriseOnline.session.state.match.id,
  );
  await p.getByRole("button", { name: "REMATCH" }).click();
  await q.getByRole("button", { name: "REMATCH" }).click();
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
  await p.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await p.waitForFunction(() => (window as any).__swapriseOnline?.queue?.readyState === WebSocket.OPEN);
  const oldQueue = await p.evaluateHandle(() => (window as any).__swapriseOnline.queue);
  await p.getByRole("button", { name: "CANCEL", exact: true }).click();
  await p.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await p.waitForFunction(() => (window as any).__swapriseOnline?.queue?.readyState === WebSocket.OPEN);
  // キャンセルした接続の終了通知が、次の待機を始めた後に届く順序を再現する。
  expect(await p.evaluate((old) => {
    const scene = (window as any).__swapriseOnline;
    const current = scene.queue;
    old.onclose(new CloseEvent("close"));
    return current !== null && scene.queue === current;
  }, oldQueue)).toBe(true);
  await oldQueue.dispose();
  await enter(q);
  await q.getByRole("button", { name: "FIND MATCH", exact: true }).click();
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
  await p.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "FIND MATCH", exact: true }).click();
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
  await p.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "FIND MATCH", exact: true }).click();
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
    const scene = (window as any).__swapriseOnline;
    // CIが次の待機判定へ進むまでせり上げ続けないよう、1段で止める。
    Object.defineProperty(scene, "raise", {
      configurable: true,
      get: () => scene.session.lockstep.game.boards[scene.session.player].stats.manualRows === 0,
    });
  });
  await p.waitForFunction(() => {
    const s = (window as any).__swapriseOnline;
    return (
      s.session.lockstep.game.boards[s.session.player].stats.manualRows > 0
    );
  });
  await p.evaluate(() => {
    Object.defineProperty((window as any).__swapriseOnline, "raise", {
      configurable: true, writable: true, value: false,
    });
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
  await expect(p.getByRole("status")).toContainText(/YOU WIN|YOU LOSE/);
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
  await p.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await p.waitForFunction(
    () => !!(window as any).__swapriseOnline?.session?.state,
  );
  await expect(
    p.getByRole("button", { name: "CANCEL", exact: true }),
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
  await p.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "FIND MATCH", exact: true }).click();
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
  await p.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await enter(q);
  await q.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60,
  );
  await p.evaluate(() => {
    (window as any).__swapriseOnline.session.lockstep.game.boards[0].score += 1;
  });
  await expect(p.getByRole("status")).toContainText("NO CONTEST", {
    timeout: 15000,
  });
  await expect(q.getByRole("status")).toContainText("NO CONTEST");
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
          .getByRole("button", { name: "FIND MATCH", exact: true })
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
    .getByRole("button", { name: "FIND MATCH", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "CANCEL", exact: true }),
  ).toBeVisible();
  await page.waitForFunction(() => (window as any).__swapriseOnline?.queue?.readyState === WebSocket.OPEN);
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

test("旧タブの待機列も新しいタブから解除できる", async ({ context, page }) => {
  await enter(page);
  await page.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  await page.waitForFunction(() => (window as any).__swapriseOnline?.queue?.readyState === WebSocket.OPEN);
  const next = await context.newPage();
  await next.goto("/?opening=0");
  await next.waitForFunction(() => !!(window as any).__swapriseScenes?.menu);
  await next.evaluate(() => {
    const menu = (window as any).__swapriseScenes.menu;
    menu.index = 3;
    menu.select();
  });
  await next.getByRole("button", { name: "CANCEL SEARCH", exact: true }).click();
  await next.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await expect(next.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
});

test("退室通信が遅れても次のランダム待機へ移れる", async ({ browser }) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
  ]);
  const [p, q] = await Promise.all(contexts.map((c) => c.newPage()));
  await p.route("**/api/online/leave", async (route) => {
    // 通信障害の注入。画面の表示待ちには固定時間を使わない。
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  for (const page of [p, q]) {
    await enter(page);
    await page
      .getByRole("button", { name: "FIND MATCH", exact: true })
      .click();
  }
  await p.waitForFunction(
    () => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60,
  );
  await p.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await p.getByRole("button", { name: "SURRENDER", exact: true }).click();
  await p.getByRole("button", { name: "YES, SURRENDER", exact: true }).click();
  await p.getByRole("button", { name: "NEXT MATCH", exact: true }).click();
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
    const menuType = await enter(page);
    const onlineType = await page.getByRole("button", { name: "FIND MATCH", exact: true }).evaluate((el) => {
      const style = getComputedStyle(el);
      return { size: parseFloat(style.fontSize), family: style.fontFamily };
    });
    expect(onlineType.size).toBeCloseTo(menuType.size, 1);
    expect(onlineType.family.replaceAll('"', '')).toBe(menuType.family.replaceAll('"', ''));
    const buttons = await page.locator(".online-actions button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const r = button.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, width: r.width };
      }),
    );
    for (const button of buttons) {
      expect(button.top).toBeGreaterThanOrEqual(0);
      expect(button.bottom).toBeLessThanOrEqual(viewport.height);
      expect(button.width).toBeLessThanOrEqual(400);
    }
    await page.screenshot({ path: `/tmp/swaprise-online-lobby-${viewport.width}.png` });
    await page
      .getByRole("button", { name: "FIND MATCH", exact: true })
      .click();
    const size = await page.evaluate(() => {
      const root = document.querySelector(".online-panel")!;
      const button = root.querySelector("button")!;
      return {
        width: button.getBoundingClientRect().width,
        panelHeight: root.getBoundingClientRect().height,
        font: parseFloat(
          getComputedStyle(root.querySelector("[role=status]")!).fontSize,
        ),
        height: button.getBoundingClientRect().height,
      };
    });
    expect(size.width).toBeLessThanOrEqual(400);
    expect(size.width / size.height).toBeLessThanOrEqual(6.3);
    expect(size.font).toBeGreaterThanOrEqual(18);
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
      .getByRole("button", { name: "FIND MATCH", exact: true })
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

test("招待部屋は退出後も同じURLで再参加でき、両者がFIND MATCHへ移れる", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  await enter(p);
  await p.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await expect(p.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
  const invite = p.url();
  await q.goto(invite);
  await q.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
  // 参加した時点で READY の操作なしに始まる
  for (const page of [p, q])
    await page.waitForFunction(() => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60);
  const saved = await Promise.all([p, q].map((page) => page.evaluate(
    () => sessionStorage.getItem("swaprise.connection.v1")!,
  )));
  // 降参して結果画面から出る。招待部屋では相手が残り、次の参加者を待つ
  await p.getByRole("button", { name: "SETTINGS", exact: true }).click();
  await p.getByRole("button", { name: "SURRENDER", exact: true }).click();
  await p.getByRole("button", { name: "YES, SURRENDER", exact: true }).click();
  await q.getByRole("button", { name: "BACK TO MENU" }).click();
  await expect(q.locator(".online-ui")).toHaveCount(0);
  await expect(p.getByRole("status")).toContainText("Waiting for your friend");
  await p.waitForFunction(() => (window as any).__swapriseOnline.views.length === 0);
  await p.getByRole("button", { name: "LEAVE ROOM" }).click();
  await expect(p.locator(".online-ui")).toHaveCount(0);
  // 1人ずつ入り直す。2人が揃うと始まってしまうので、確かめたら出てから次の人が入る
  for (const [index, page] of [p, q].entries()) {
    // 更新前のアプリが保存した、退出済みの接続情報を再現する。
    await page.evaluate((connection) => sessionStorage.setItem("swaprise.connection.v1", connection), saved[index]);
    await page.goto(invite);
    await page.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Waiting for your friend");
    await page.getByRole("button", { name: "LEAVE ROOM" }).click();
  }
  for (const page of [p, q]) {
    await enter(page);
    await page.getByRole("button", { name: "FIND MATCH", exact: true }).click();
  }
  for (const page of [p, q])
    await page.waitForFunction(() => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60);
  await a.close();
  await b.close();
});

test("期限切れの招待URLは開いた時点で説明し、新しい部屋を作れる", async ({ page }) => {
  // 期限切れで削除された部屋と同じ、保存データがないURL。
  await page.goto("/?room=11111111-1111-4111-8111-111111111111#invite=expired");
  await expect(page.getByRole("status")).toHaveText("This invite link has expired. Create a new room or find a match.");
  await expect(page.getByRole("button", { name: "JOIN ROOM", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "FIND MATCH", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await expect(page.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
});

test("招待者は画面を閉じても同じURLへ戻れ、残った接続も新しいタブへ切り替わる", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  await enter(p);
  await p.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await expect(p.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
  const invite = p.url();
  await q.goto(invite);
  await q.getByRole("button", { name: "JOIN ROOM", exact: true }).click();
  await q.waitForFunction(() => (window as any).__swapriseOnline?.session?.player === 1);
  await p.close();
  const reopened = await a.newPage();
  await reopened.goto(invite);
  await reopened.getByRole("button", { name: "RESUME HERE", exact: true }).click();
  await reopened.waitForFunction(() => (window as any).__swapriseOnline?.session?.player === 0);
  await reopened.waitForFunction(() => (window as any).__swapriseOnline?.session?.lockstep?.frame > 60);
  const replacement = await a.newPage();
  await replacement.goto(invite);
  await replacement.getByRole("button", { name: "RESUME HERE", exact: true }).click();
  await expect(reopened.getByRole("status")).toHaveText("This room was opened in another tab.");
  await replacement.waitForFunction(() => (window as any).__swapriseOnline?.session?.state?.phase === "playing" && (window as any).__swapriseOnline.session.lockstep.frame > 120);
  expect(await replacement.evaluate(() => (window as any).__swapriseOnline.session.player)).toBe(0);
  await a.close();
  await b.close();
});
