import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadHighScores, onlineRecordLine, recordOnlineResult } from "../../src/render/highscore";

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
    expect(r).toEqual({ wins: 1, losses: 2, draws: 1, lastMatch: "m4" });
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
    expect(h.online).toEqual({ wins: 0, losses: 0, draws: 0, lastMatch: "" });
    expect(h.cpu.easy).toEqual({ wins: 3, losses: 1 });
  });

  it("表示は引き分けがあるときだけ D を付ける", () => {
    expect(onlineRecordLine({ wins: 12, losses: 8, draws: 0, lastMatch: "" })).toBe("12W 8L");
    expect(onlineRecordLine({ wins: 12, losses: 8, draws: 1, lastMatch: "" })).toBe("12W 8L 1D");
  });
});
