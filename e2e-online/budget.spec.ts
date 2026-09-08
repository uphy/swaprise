import { test, expect } from "@playwright/test";
import { WebSocket } from "ws";
import { GAME_VERSION, PROTOCOL } from "../src/net/protocol";

/** ブラウザの休止に影響されず、実際のDOへ10分間の最大頻度の入力を送る。 */
test("10分の通信・保存量が1試合の予約予算に収まる", async ({
  playwright,
  baseURL,
}) => {
  test.skip(process.env.ONLINE_BENCHMARK !== "1", "長時間の計測は明示実行する");
  test.setTimeout(660000);
  const origin = baseURL!;
  const contexts = await Promise.all(
    [0, 1].map(() =>
      playwright.request.newContext({
        baseURL: origin,
        extraHTTPHeaders: { Origin: origin },
      }),
    ),
  );
  const sockets: WebSocket[] = [];
  const timers: ReturnType<typeof setInterval>[] = [];
  const states = [0, 1].map(() => ({
    phase: "",
    frame: 0,
    next: 0,
    match: "",
    result: null as unknown,
    error: "",
  }));
  try {
    for (const c of contexts)
      expect((await c.post("/api/session")).ok()).toBe(true);
    const response = await contexts[0].post("/api/rooms", {
      data: { version: GAME_VERSION, name: "計測A" },
    });
    expect(response.ok()).toBe(true);
    const room = await response.json();
    const joined = await contexts[1].post(`/api/rooms/${room.roomId}/join`, {
      data: {
        version: GAME_VERSION,
        invite: room.invite,
        name: "計測B",
      },
    });
    expect(joined.ok()).toBe(true);
    const connections = [room, await joined.json()];
    for (let i = 0; i < 2; i++) {
      const cookies = (await contexts[i].storageState()).cookies
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      const ws = new WebSocket(
        `${origin.replace(/^http/, "ws")}/api/rooms/${room.roomId}/ws`,
        {
          headers: { Cookie: cookies, Origin: origin },
        },
      );
      sockets.push(ws);
      const state = states[i];
      const send = (message: unknown) => ws.send(JSON.stringify(message));
      ws.on("error", (e) => {
        state.error = e.message;
      });
      ws.on("close", (code) => {
        if (!state.result) state.error = `closed ${code}`;
      });
      ws.on("open", () => {
        send({
          type: "hello",
          protocol: PROTOCOL,
          version: GAME_VERSION,
          token: connections[i].token,
          visible: true,
        });
        send({ type: "latency", rtt: 20 });
        send({ type: "ready" });
      });
      ws.on("message", (raw) => {
        const m = JSON.parse(raw.toString());
        if (m.type === "state") {
          state.phase = m.state.phase;
          state.result = m.state.result;
          if (m.state.match && state.match !== m.state.match.id) {
            state.match = m.state.match.id;
            state.next = m.state.match.delay;
          }
        }
        if (m.type === "frames") state.frame = m.startFrame + m.frames.length;
        if (m.type === "error") state.error = m.message;
      });
      const no = { moveX: 0, moveY: 0, swap: false, raise: false };
      timers.push(
        setInterval(() => {
          if (
            state.phase !== "playing" ||
            ws.readyState !== WebSocket.OPEN ||
            state.next > state.frame + 9
          )
            return;
          send({
            type: "input",
            matchId: state.match,
            startFrame: state.next,
            inputs: [no, no, no],
            ack: state.frame,
          });
          state.next += 3;
        }, 50),
      );
    }
    await expect
      .poll(() => states.every((s) => s.frame > 60), { timeout: 15000 })
      .toBe(true);
    console.log("ONLINE_BUDGET_STARTED", new Date().toISOString());
    await expect
      .poll(
        () => states.every((s) => !!s.result) || states.some((s) => !!s.error),
        {
          timeout: 640000,
          intervals: [1000],
        },
      )
      .toBe(true);
    console.log("ONLINE_BUDGET_CLIENTS", JSON.stringify(states));
    const metrics = await (
      await contexts[0].get(`/api/rooms/${room.roomId}/metrics`)
    ).json();
    console.log("ONLINE_BUDGET_MEASUREMENT", JSON.stringify(metrics));
    expect(states.every((s) => !s.error)).toBe(true);
    expect(metrics.result).toEqual({ winner: -1, reason: "timeout" });
    expect(metrics.frame).toBeGreaterThan(34000);
    // 実クライアントの定期ハッシュとpingを最大720通として加算する。
    expect(
      (metrics.messages + 720) / 20 + metrics.connections + 10,
    ).toBeLessThan(1500);
    expect(metrics.writes + metrics.chunks + 10).toBeLessThan(3000);
  } finally {
    timers.forEach(clearInterval);
    sockets.forEach((ws) => ws.close());
    await Promise.all(contexts.map((c) => c.dispose()));
  }
});
