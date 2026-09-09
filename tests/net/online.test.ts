import { describe, expect, it } from "vitest";
import { RoomEngine } from "../../worker/room-engine";
import { emptyBudget, reserve } from "../../worker/budget";
import { Lockstep } from "../../src/net/lockstep";
import { stateHash } from "../../src/net/hash";
import { NO_INPUT } from "../../src/core/types";
import {
  displayName,
  validInput,
  type ServerMessage,
} from "../../src/net/protocol";
function setup() {
  const messages: ServerMessage[][] = [[], []];
  const room = new RoomEngine("invite", (i, m) => messages[i].push(m));
  for (let i = 0; i < 2; i++) {
    room.join({ session: `s${i}`, token: `t${i}`, name: `n${i}` });
    room.connect(i, true, 0);
    room.message(i, { type: "latency", rtt: 20 }, 0);
    room.message(i, { type: "ready" }, 0);
  }
  room.start("match", 42, 0);
  room.clock(3000);
  return { room, messages };
}
describe("オンラインの入力同期", () => {
  it("同じ入力列で2端末が一致し、再配信では二重にtickしない", () => {
    const { room, messages } = setup();
    const clients = [
      new Lockstep(room.state.match!),
      new Lockstep(room.state.match!),
    ];
    for (let tick = 0; tick < 600; tick++) {
      for (let i = 0; i < 2; i++) {
        for (const m of messages[i].splice(0))
          if (m.type === "frames") {
            clients[i].receive(m.startFrame, m.frames);
            clients[i].receive(m.startFrame, m.frames);
          }
        const c = clients[i];
        const batch = c.capture(() => ({
          ...NO_INPUT,
          moveX: tick % 15 === 0 ? (i === 0 ? 1 : -1) : 0,
          swap: tick % 17 === 0,
        }));
        if (batch)
          room.message(
            i,
            { type: "input", matchId: "match", ...batch, ack: c.frame },
            3000 + (tick * 1000) / 60,
          );
        c.step();
      }
    }
    expect(clients[0].frame).toBeGreaterThan(500);
    expect(clients[0].frame).toBe(clients[1].frame);
    expect(stateHash(clients[0].game)).toBe(stateHash(clients[1].game));
  });
  it("入力欠番では進まず、先行入力の蓄積に上限がある", () => {
    const c = new Lockstep({ id: "x", seed: 1, delay: 6, version: "x" });
    let calls = 0;
    for (let i = 0; i < 100; i++) {
      c.capture(() => {
        calls++;
        return NO_INPUT;
      });
      expect(c.step()).toBe(false);
    }
    expect(c.frame).toBe(0);
    expect(calls).toBeLessThanOrEqual(3);
  });
  it("同じ送信済みフレームの内容変更を拒否する", () => {
    const { room } = setup();
    const m = {
      type: "input" as const,
      matchId: "match",
      startFrame: 6,
      inputs: [NO_INPUT, NO_INPUT, NO_INPUT],
      ack: 0,
    };
    room.message(0, m, 3000);
    room.message(0, m, 3000);
    expect(() =>
      room.message(
        0,
        { ...m, inputs: [{ ...NO_INPUT, swap: true }, NO_INPUT, NO_INPUT] },
        3000,
      ),
    ).toThrow();
  });
  it("同期ずれは勝敗にせず無効にする", () => {
    const { room } = setup();
    room.history = Array.from({ length: 120 }, () => [NO_INPUT, NO_INPUT]);
    room.message(
      0,
      { type: "hash", matchId: "match", frame: 120, hash: "aaaaaaaa" },
      3000,
    );
    room.message(
      1,
      { type: "hash", matchId: "match", frame: 120, hash: "bbbbbbbb" },
      3000,
    );
    expect(room.state.result).toEqual({ winner: -1, reason: "desync" });
  });
  it("切断を繰り返しても猶予をリセットしない", () => {
    const { room } = setup();
    room.disconnect(1, 3100);
    room.message(
      0,
      { type: "resume", matchId: "match", frame: 6, hash: "aaaaaaaa" },
      3100,
    );
    room.clock(8100);
    expect(room.state.seats[1]!.grace).toBe(10000);
    room.connect(1, true, 8100);
    room.message(
      1,
      { type: "resume", matchId: "match", frame: 6, hash: "aaaaaaaa" },
      8100,
    );
    expect(room.state.phase).toBe("playing");
    room.disconnect(1, 8200);
    room.message(
      0,
      { type: "resume", matchId: "match", frame: 12, hash: "bbbbbbbb" },
      8200,
    );
    room.clock(18200);
    expect(room.state.result).toEqual({ winner: 0, reason: "disconnect" });
  });
});
describe("無料枠・入力形式", () => {
  it("招待分を残し、同じ試合を二重予約しない", () => {
    const b = emptyBudget();
    for (let i = 0; i < 15; i++)
      expect(reserve(b, `r${i}`, "random")).toBe(true);
    expect(reserve(b, "r15", "random")).toBe(false);
    expect(reserve(b, "r0", "random")).toBe(true);
    for (let i = 0; i < 5; i++)
      expect(reserve(b, `i${i}`, "invite")).toBe(true);
    expect(reserve(b, "last", "invite")).toBe(false);
  });
  it("不正座標・型を拒否し表示名を正規化する", () => {
    expect(validInput(NO_INPUT)).toBe(true);
    expect(validInput({ ...NO_INPUT, cursorTo: { x: NaN, y: 0 } })).toBe(false);
    expect(validInput({ ...NO_INPUT, raise: "false" })).toBe(false);
    expect(displayName(" \n\u0000 ")).toBe("Guest");
  });
});
describe("切断と結果の境界", () => {
  it("両者が切断した場合は、先に猶予切れになっても勝者を決めない", () => {
    const { room } = setup();
    room.disconnect(0, 3100);
    room.message(
      1,
      { type: "resume", matchId: "match", frame: 6, hash: "aaaaaaaa" },
      3100,
    );
    room.clock(4000);
    room.disconnect(1, 4000);
    room.clock(18100);
    expect(room.state.result).toEqual({ winner: -1, reason: "server" });
  });
  it("同じ端末の二重接続は拒否する", () => {
    const { room } = setup();
    expect(() => room.connect(0, true, 3200)).toThrow("another tab");
  });
  it("両者で一致した最終結果だけを確定する", () => {
    const { room } = setup();
    room.message(
      0,
      { type: "hash", matchId: "match", frame: 6, hash: "deadbeef", winner: 1 },
      3100,
    );
    expect(room.state.result).toBeNull();
    room.message(
      1,
      { type: "hash", matchId: "match", frame: 6, hash: "deadbeef", winner: 1 },
      3101,
    );
    expect(room.state.result).toEqual({ winner: 1, reason: "normal" });
  });
});
it("両者の入力が同時に途絶えた場合も無効試合にする", () => {
  const { room } = setup();
  room.clock(5000);
  room.clock(20000);
  expect(room.state.result).toEqual({ winner: -1, reason: "server" });
});
it("待機中に保存したRTTと準備状態から開始できる", () => {
  const room = new RoomEngine("invite", () => {});
  for (let i = 0; i < 2; i++) {
    room.join({ session: `s${i}`, token: `t${i}`, name: "Guest" });
    room.connect(i, true, 0);
    room.message(i, { type: "latency", rtt: 50 }, 0);
    room.message(i, { type: "ready" }, 0);
  }
  const restored = new RoomEngine("invite", () => {});
  restored.state = structuredClone(room.state);
  expect(restored.canStart()).toBe(true);
});

it("閉じた招待部屋への再参加は元の参加者でも拒否する", () => {
  const room = new RoomEngine("invite", () => {});
  for (let i = 0; i < 2; i++) {
    room.join({ session: `s${i}`, token: `t${i}`, name: `n${i}` });
    room.connect(i, true, 0);
  }
  room.state.phase = "closed";
  expect(room.state.phase).toBe("closed");
  for (let i = 0; i < 2; i++)
    expect(() => room.join({ session: `s${i}`, token: "new", name: "Guest" }))
      .toThrow("This room has closed.");
});

it("招待部屋を退出しても相手の席を残し、同じ人が入り直せる", () => {
  const room = new RoomEngine("invite", () => {});
  for (let i = 0; i < 2; i++) {
    room.join({ session: `s${i}`, token: `t${i}`, name: `n${i}` });
    room.connect(i, true, 0);
    room.message(i, { type: "ready" }, 0);
  }
  room.message(1, { type: "leave" }, 0);
  expect(room.state.phase).toBe("waiting");
  expect(room.members[1]).toBeNull();
  expect(room.state.seats[0]?.connected).toBe(true);
  expect(room.state.seats[0]?.ready).toBe(false);
  expect(room.join({ session: "s1", token: "new", name: "Returned" })).toBe(1);
  expect(room.members[1]?.token).toBe("new");
  room.message(0, { type: "leave" }, 0);
  room.message(1, { type: "leave" }, 0);
  expect(room.state.phase).toBe("waiting");
  expect(room.members).toEqual([null, null]);
  expect(room.join({ session: "s0", token: "again", name: "Returned" })).toBe(0);
});
it("対戦後に招待部屋を退出すると盤面を片付けて次の参加者を待つ", () => {
  const { room } = setup();
  room.finish(0, "normal");
  room.message(1, { type: "leave" }, 4000);
  expect(room.state.phase).toBe("waiting");
  expect(room.state.match).toBeNull();
  expect(room.state.result).toBeNull();
  expect(room.history).toEqual([]);
  expect(room.canStart()).toBe(false);
});

it("同じ参加者が招待URLを開き直すと、元の席を新しい接続情報で使える", () => {
  const room = new RoomEngine("invite", () => {});
  room.join({ session: "owner", token: "old", name: "Owner" });
  expect(room.join({ session: "owner", token: "new", name: "Owner" })).toBe(0);
  expect(room.members[0]?.token).toBe("new");
  expect(room.members[1]).toBeNull();
});
