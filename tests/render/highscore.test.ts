import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadHighScores, MAX_RIVALS, onlineRecordLine, recentRivals, recordOnlineResult, rivalRecord } from "../../src/render/highscore";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});

describe("recordOnlineResult", () => {
  it("勝ち・負け・引き分けを別に数える", () => {
    recordOnlineResult("m1", "win");
    recordOnlineResult("m2", "lose");
    recordOnlineResult("m3", "lose");
    const r = recordOnlineResult("m4", "draw");
    expect(r).toEqual({ wins: 1, losses: 2, draws: 1, lastMatch: "m4", rivals: {} });
    expect(loadHighScores().online).toEqual(r);
  });

  it("同じ試合は二度数えない（結果画面へ再接続したとき）", () => {
    recordOnlineResult("m1", "win");
    const r = recordOnlineResult("m1", "win");
    expect(r).toMatchObject({ wins: 1, losses: 0 });
  });

  it("旧い保存形式（online なし）を読んでも空の通算になり、他の記録は残る", () => {
    localStorage.setItem("swaprise.highscores.v1", JSON.stringify({ endless: [], cpu: { easy: { wins: 3, losses: 1 } } }));
    const h = loadHighScores();
    expect(h.online).toEqual({ wins: 0, losses: 0, draws: 0, lastMatch: "", rivals: {} });
    expect(h.cpu.easy).toEqual({ wins: 3, losses: 1 });
  });

  it("表示は引き分けがあるときだけ D を付ける", () => {
    expect(onlineRecordLine({ wins: 12, losses: 8, draws: 0 })).toBe("12W 8L");
    expect(onlineRecordLine({ wins: 12, losses: 8, draws: 1 })).toBe("12W 8L 1D");
  });

  it("相手の id があれば相手別にも数え、名前は最後に見たものに追いかける", () => {
    recordOnlineResult("m1", "win", { id: "a", name: "taro" }, 1000);
    recordOnlineResult("m2", "lose", { id: "a", name: "TARO" }, 2000);
    recordOnlineResult("m3", "draw", { id: "b", name: "hana" }, 3000);
    const r = loadHighScores().online;
    expect(r).toMatchObject({ wins: 1, losses: 1, draws: 1 });
    expect(r.rivals).toEqual({
      a: { name: "TARO", wins: 1, losses: 1, draws: 0, at: 2000 },
      b: { name: "hana", wins: 0, losses: 0, draws: 1, at: 3000 },
    });
    expect(rivalRecord("a")).toMatchObject({ wins: 1, losses: 1 });
    expect(rivalRecord("zzz")).toBeNull();
    expect(recentRivals().map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("相手の id が空（旧クライアント）なら通算にだけ入れる", () => {
    recordOnlineResult("m1", "win", { id: "", name: "old" });
    const r = loadHighScores().online;
    expect(r).toMatchObject({ wins: 1, rivals: {} });
  });

  it("同じ試合を二度数えないのは相手別も同じ", () => {
    recordOnlineResult("m1", "win", { id: "a", name: "taro" });
    recordOnlineResult("m1", "win", { id: "a", name: "taro" });
    expect(loadHighScores().online.rivals.a).toMatchObject({ wins: 1 });
  });

  it("相手が上限を超えたら最後に対戦した日時が古い相手から捨てる", () => {
    for (let i = 0; i < MAX_RIVALS + 1; i++) recordOnlineResult(`m${i}`, "win", { id: `r${i}`, name: "x" }, i);
    const rivals = loadHighScores().online.rivals;
    expect(Object.keys(rivals)).toHaveLength(MAX_RIVALS);
    expect(rivals.r0).toBeUndefined();
    expect(rivals.r1).toBeDefined();
  });
});
