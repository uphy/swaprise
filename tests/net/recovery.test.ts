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
    setAlarm: vi.fn(async () => {}),
  };
  const room = new Room({
    storage, getWebSockets: () => [],
    blockConcurrencyWhile: (fn: () => Promise<void>) => { ready = fn(); },
  } as any, {} as any);
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
    expect(storage.setAlarm).toHaveBeenCalledWith(values.get("room").touched + 86400000);
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
