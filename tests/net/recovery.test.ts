import { describe, expect, it, vi } from "vitest";
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    constructor(protected ctx: any, protected env: any) {}
  },
}));
// Worker のグローバル型をブラウザ側の型検査へ取り込まない。
const workerModule = "../../worker/coordinator";
const { Coordinator } = await import(workerModule);
import { GAME_VERSION } from "../../src/net/protocol";

describe("古い参加記録からの復旧", () => {
  for (const active of [false, true]) {
    it(active ? "有効な部屋の参加記録は維持する" : "閉じた部屋の参加記録を解消して新しい部屋を作れる", async () => {
      const values = new Map<string, any>([
        ["active:user", { roomId: "old", expires: Date.now() + 660000 }],
      ]);
      const storage = {
        get: async (key: string) => values.get(key),
        put: async (key: string, value: any) => { values.set(key, value); },
        delete: async (key: string) => values.delete(key),
        getAlarm: async () => 1,
      };
      const roomFetch = vi.fn(async (request: Request) => Response.json(
        new URL(request.url).pathname === "/membership" ? { active } : { ok: true },
      ));
      const coordinator = new Coordinator(
        { storage, getWebSockets: () => [] } as any,
        { ROOMS: { idFromName: (id: string) => id, get: () => ({ fetch: roomFetch }) } } as any,
      );
      const response = await coordinator.fetch(new Request("https://internal/api/rooms", {
        method: "POST", headers: { "X-Session": "user" },
        body: JSON.stringify({ version: GAME_VERSION, name: "Guest" }),
      }));
      expect(response.status).toBe(active ? 409 : 200);
      expect(roomFetch).toHaveBeenCalled();
      if (active) expect(values.get("active:user").roomId).toBe("old");
      else expect(values.get("active:user").roomId).toBe((await response.json() as any).roomId);
    });
  }
});

const roomModule = "../../worker/room";
const { Room } = await import(roomModule);
import { RoomEngine } from "../../worker/room-engine";
async function savedRoom(age: number, phase: "waiting" | "closed" = "waiting") {
  const engine = new RoomEngine("invite", () => {});
  engine.join({ session: "user", token: "old", name: "Guest" });
  engine.state.phase = phase;
  const values = new Map<string, any>([["room", {
    id: "room", invite: "invite", touched: Date.now() - age,
    members: engine.members, state: engine.state,
  }]]);
  let ready: Promise<void> = Promise.resolve();
  const storage = {
    get: async (key: string) => values.get(key),
    put: async (key: string, value: any) => { values.set(key, structuredClone(value)); },
    setAlarm: vi.fn(async (_at: number) => {}),
  };
  const room = new Room({
    storage, getWebSockets: () => [], waitUntil: (p: Promise<unknown>) => { void p; },
    blockConcurrencyWhile: (fn: () => Promise<void>) => { ready = fn(); },
  } as any, { COORDINATOR: { idFromName: (id: string) => id, get: () => ({ fetch: async () => Response.json({ ok: true }) }) } } as any);
  await ready;
  return { room, values, storage };
}
describe("招待URLの有効期限", () => {
  it("24時間以内の部屋は有効で、参加すると期限を延ばす", async () => {
    const { room, values, storage } = await savedRoom(23 * 3600000);
    const status = await room.fetch(new Request("https://internal/api/rooms/room/status", {
      headers: { "X-Session": "user" },
    }));
    expect(await status.json()).toEqual({ active: true, expired: false });
    const joined = await room.fetch(new Request("https://internal/join", {
      method: "POST", body: JSON.stringify({ invite: "invite", member: { session: "guest", token: "new", name: "Guest" } }),
    }));
    expect(joined.status).toBe(200);
    expect(values.get("room").touched).toBeGreaterThan(Date.now() - 1000);
    expect(storage.setAlarm).toHaveBeenCalledWith(expect.any(Number));
    expect(storage.setAlarm.mock.calls.at(-1)![0]).toBeLessThanOrEqual(Date.now() + 60000);
  });
  it("24時間を過ぎた部屋は掃除処理を待たず期限切れと返す", async () => {
    const { room } = await savedRoom(24 * 3600000 + 1000);
    const status = await room.fetch(new Request("https://internal/api/rooms/room/status", {
      headers: { "X-Session": "user" },
    }));
    expect(await status.json()).toEqual({ active: false, expired: true });
    const joined = await room.fetch(new Request("https://internal/join", {
      method: "POST", body: JSON.stringify({ invite: "invite", member: { session: "guest", token: "new", name: "Guest" } }),
    }));
    expect(joined.status).toBe(410);
    expect((await joined.json()).error).toContain("expired");
  });
  it("更新前に閉じた部屋も24時間以内なら同じ招待で入り直せる", async () => {
    const { room, values } = await savedRoom(3600000, "closed");
    const joined = await room.fetch(new Request("https://internal/join", {
      method: "POST", body: JSON.stringify({ invite: "invite", member: { session: "user", token: "new", name: "Guest" } }),
    }));
    expect(joined.status).toBe(200);
    expect(values.get("room").state.phase).toBe("waiting");
    expect(values.get("room").members[0].token).toBe("new");
  });
});

it("退出の通知が遅れても、同じ部屋へ入り直した参加記録を消さない", async () => {
  const values = new Map<string, any>([
    ["active:user", { roomId: "room", token: "new", expires: Date.now() + 660000 }],
  ]);
  const coordinator = new Coordinator({ storage: {
    get: async (key: string) => values.get(key),
    delete: async (key: string) => values.delete(key),
  } } as any, {} as any);
  await coordinator.fetch(new Request("https://internal/release", {
    method: "POST", headers: { "X-Session": "user" },
    body: JSON.stringify({ roomId: "room", token: "old" }),
  }));
  expect(values.get("active:user")?.token).toBe("new");
  await coordinator.fetch(new Request("https://internal/release", {
    method: "POST", headers: { "X-Session": "user" },
    body: JSON.stringify({ roomId: "room", token: "new" }),
  }));
  expect(values.has("active:user")).toBe(false);
});

it("同じ部屋の招待URLなら参加中の本人も再参加できる", async () => {
  const roomId = "11111111-1111-4111-8111-111111111111";
  const values = new Map<string, any>([["active:user", { roomId, token: "old", expires: Date.now() + 660000 }]]);
  const coordinator = new Coordinator({
    storage: {
      get: async (key: string) => values.get(key),
      put: async (key: string, value: any) => { values.set(key, value); },
      getAlarm: async () => 1,
    }, getWebSockets: () => [],
  } as any, { ROOMS: {
    idFromName: (id: string) => id,
    get: () => ({ fetch: async () => Response.json({ active: true, ok: true }) }),
  } } as any);
  const response = await coordinator.fetch(new Request(`https://internal/api/rooms/${roomId}/join`, {
    method: "POST", headers: { "X-Session": "user" },
    body: JSON.stringify({ version: GAME_VERSION, invite: "invite" }),
  }));
  expect(response.status).toBe(200);
  expect(values.get("active:user").token).not.toBe("old");
});

function recoveringCoordinator() {
  const values = new Map<string, any>([["active:user", {
    roomId: "old", token: "token", expires: Date.now() + 660000,
  }]]);
  const roomFetch = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (path === "/membership") return Response.json({ active: true });
    if (path === "/recovery") return Response.json({ connection: { roomId: "old", token: "token", invite: "invite" } });
    return Response.json({ ok: true });
  });
  const coordinator = new Coordinator({ storage: {
    get: async (key: string) => values.get(key),
    put: async (key: string, value: any) => { values.set(key, value); },
    delete: async (key: string) => values.delete(key),
    getAlarm: async () => 1,
  }, getWebSockets: () => [] } as any, { ROOMS: {
    idFromName: (id: string) => id, get: () => ({ fetch: roomFetch }),
  } } as any);
  const post = (path: string, data: unknown = {}) => coordinator.fetch(new Request(`https://internal${path}`, {
    method: "POST", headers: { "X-Session": "user" }, body: JSON.stringify(data),
  }));
  return { values, roomFetch, post };
}
it("タブの保存情報を失ってもCookieの本人識別から参加中の部屋を取得できる", async () => {
  const { post } = recoveringCoordinator();
  const response = await post("/api/online/recovery");
  expect(response.status).toBe(200);
  expect((await response.json()).connection).toEqual({ roomId: "old", token: "token", invite: "invite" });
});
it("HTTPで退出し、同じ要求を繰り返しても安全に完了する", async () => {
  const { post, values, roomFetch } = recoveringCoordinator();
  for (let i = 0; i < 2; i++) {
    const response = await post("/api/online/leave", { roomId: "old", token: "token" });
    expect(response.status).toBe(200);
  }
  expect(values.has("active:user")).toBe(false);
  expect(roomFetch.mock.calls.some(([r]) => new URL(r.url).pathname === "/leave")).toBe(true);
});
it("旧タブの退出では新しい参加を解除しない", async () => {
  const { post, values, roomFetch } = recoveringCoordinator();
  const response = await post("/api/online/leave", { roomId: "old", token: "outdated" });
  expect(response.status).toBe(200);
  expect(values.get("active:user").token).toBe("token");
  expect(roomFetch).not.toHaveBeenCalled();
});
it("遅れたランダム待機への復帰通知では新しい参加を解除しない", async () => {
  const { post, values } = recoveringCoordinator();
  await post("/return", { session: "user", roomId: "older", token: "outdated", since: 1 });
  expect(values.get("active:user").roomId).toBe("old");
  expect(values.has("return:user")).toBe(false);
});

it("招待URLの期限と切断した席の期限を分け、60秒後に他室へ移れる", async () => {
  vi.useFakeTimers();
  try {
    const { room, values } = await savedRoom(0);
    vi.advanceTimersByTime(60001);
    const response = await room.fetch(new Request("https://internal/membership", { headers: { "X-Session": "user" } }));
    expect(await response.json()).toEqual({ active: false, expired: false });
    expect(values.get("room").members[0]).toBeNull();
  } finally { vi.useRealTimers(); }
});
it("HTTP退出処理が失敗したら参加記録を保持し、再試行できる", async () => {
  const { post, values, roomFetch } = recoveringCoordinator();
  roomFetch.mockResolvedValueOnce(Response.json({ error: "temporary failure" }, { status: 503 }));
  expect((await post("/api/online/leave", { roomId: "old", token: "token" })).status).toBe(503);
  expect(values.has("active:user")).toBe(true);
  expect((await post("/api/online/leave", { roomId: "old", token: "token" })).status).toBe(200);
  expect(values.has("active:user")).toBe(false);
});
it("日次上限に達しても参加確認と退出はできる", async () => {
  const { post, values } = recoveringCoordinator();
  values.set("budget:" + new Date().toISOString().slice(0, 10), { requests: 100000, writes: 100000 });
  expect((await post("/api/online/recovery")).status).toBe(200);
  expect((await post("/api/online/leave", { roomId: "old", token: "token" })).status).toBe(200);
});
it("再開はトークンを更新し、旧トークンの退出から部屋を守る", async () => {
  const { room, values } = await savedRoom(0);
  const post = (path: string, data: unknown) => room.fetch(new Request(`https://internal${path}`, { method: "POST", body: JSON.stringify(data) }));
  const resumed = await post("/takeover", { session: "user", token: "old" });
  expect(resumed.status).toBe(200);
  const connection = (await resumed.json()).connection;
  expect(connection.token).not.toBe("old");
  await post("/leave", { session: "user", token: "old" });
  expect(values.get("room").members[0].token).toBe(connection.token);
  expect((await (await post("/recovery", { session: "user" })).json()).connection.token).toBe(connection.token);
  expect((await (await post("/recovery", { session: "another-user" })).json()).connection).toBeNull();
});
it("参加記録の期限を過ぎても実際に在室していれば復旧できる", async () => {
  const { values, post } = recoveringCoordinator();
  values.get("active:user").expires = Date.now() - 1;
  expect((await (await post("/api/online/recovery")).json()).connection.roomId).toBe("old");
});
it("再開の更新途中に旧トークンの退出が来ても参加記録を消さない", async () => {
  const { post, values, roomFetch } = recoveringCoordinator();
  roomFetch.mockResolvedValueOnce(Response.json({ ok: true, stale: true }));
  expect((await post("/api/online/leave", { roomId: "old", token: "token" })).status).toBe(200);
  expect(values.has("active:user")).toBe(true);
});
it("待機キャンセルとマッチ成立が重なっても同じ待機から割り当てた部屋を退出できる", async () => {
  const { post, values } = recoveringCoordinator();
  values.get("active:user").queueId = "queue";
  await post("/api/online/recovery");
  expect(values.get("active:user").queueId).toBe("queue");
  expect((await post("/api/online/leave", { queueId: "queue" })).status).toBe(200);
  expect(values.has("active:user")).toBe(false);
});
it("待機列へ接続する前に旧版の拒否理由をHTTPで取得できる", async () => {
  const { post } = recoveringCoordinator();
  const response = await post("/api/queue/status", { version: "outdated" });
  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe("UPDATE_REQUIRED");
});
it("待機列の事前確認で既存の参加状態を区別できる", async () => {
  const { post } = recoveringCoordinator();
  const response = await post("/api/queue/status", { version: GAME_VERSION });
  expect(response.status).toBe(409);
  expect((await response.json()).code).toBe("PARTICIPATION_EXISTS");
});
it("日次上限によるランダム対戦の拒否と通常の受付を区別する", async () => {
  const { post, values } = recoveringCoordinator();
  values.delete("active:user");
  expect((await post("/api/queue/status", { version: GAME_VERSION })).status).toBe(200);
  values.set("budget:" + new Date().toISOString().slice(0, 10), { requests: 50000, writes: 50000, duration: 1, rooms: 1, starts: [] });
  const response = await post("/api/queue/status", { version: GAME_VERSION });
  expect(response.status).toBe(429);
  expect((await response.json()).code).toBe("DAILY_LIMIT");
});

it("待機中にゲーム版が上がった接続は、掃除処理で閉じて再読み込みを促す", async () => {
  const values = new Map<string, any>();
  const fakeSocket = (version: string) => {
    const a = { queueId: "q-" + version, session: "s-" + version, name: "Guest", visible: true, since: Date.now(), last: Date.now(), version };
    return { readyState: 1, deserializeAttachment: () => a, serializeAttachment: () => {}, send: vi.fn(), close: vi.fn() };
  };
  const stale = fakeSocket("online-v0");
  const fresh = fakeSocket(GAME_VERSION);
  const coordinator = new Coordinator({
    storage: {
      get: async (key: string) => values.get(key),
      put: async (key: string, value: any) => { values.set(key, value); },
      delete: async (key: string) => values.delete(key),
      list: async () => new Map(),
      setAlarm: async () => {},
    },
    getWebSockets: () => [stale, fresh],
  } as any, {} as any);
  await coordinator.alarm();
  expect(stale.send).toHaveBeenCalledWith(expect.stringContaining("reload"));
  expect(stale.close).toHaveBeenCalled();
  expect(fresh.send).not.toHaveBeenCalled();
  expect(fresh.close).not.toHaveBeenCalled();
});
