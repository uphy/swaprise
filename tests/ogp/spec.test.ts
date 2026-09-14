import { describe, expect, it } from "vitest";
import { cardMeta, cardSpec, parseShare, shareParams, type ShareResult } from "../../src/ogp/spec";

const roundTrip = (r: ShareResult): ShareResult | null => parseShare(new URLSearchParams(shareParams(r).toString()));

describe("共有 URL のパラメータ", () => {
  it("各モードの結果が URL を経て同じ形で戻る", () => {
    const results: ShareResult[] = [
      { mode: "endless", score: 12340, chain: 7, id: "3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b" },
      { mode: "timeattack", score: 9870, chain: 4 },
      { mode: "puzzle", stage: "3-2", clear: true, left: 0 },
      { mode: "puzzle", stage: "10-10", clear: false },
      { mode: "lesson", n: 3, total: 10 },
      { mode: "cpu", level: "hard", result: "win", chain: 9 },
      { mode: "versus", result: "draw", chain: 2 },
      { mode: "online", result: "lose", chain: 3, vs: "Taro", wins: 3, losses: 1 },
      { mode: "online", result: "win", chain: 5 },
    ];
    for (const r of results) expect(roundTrip(r)).toEqual(r);
  });

  it("範囲外・欠け・不正な値は読まない", () => {
    for (const q of [
      "", "m=endless", "m=endless&s=abc&c=1", "m=endless&s=1&c=100", "m=endless&s=1&c=1&id=nope", "m=endless&s=123456789012&c=1",
      "m=puzzle&st=3-2", "m=puzzle&st=x&r=clear", "m=puzzle&st=3-2&r=clear&left=abc",
      "m=lesson&n=0&total=10", "m=lesson&n=11&total=10",
      "m=cpu&lv=insane&r=win&c=1", "m=cpu&lv=hard&r=meh&c=1", "m=versus&r=win", "m=online&r=win", "m=story",
    ]) expect(parseShare(new URLSearchParams(q)), q).toBeNull();
  });

  it("オンラインの相手の名前は 12 文字までに切る", () => {
    const r = parseShare(new URLSearchParams("m=online&r=win&c=1&vs=" + encodeURIComponent("あ".repeat(20))));
    expect(r).toEqual({ mode: "online", result: "win", chain: 1, vs: "あ".repeat(12) });
  });
});

describe("カードの中身", () => {
  it("得点は主役で、順位は公開済みのときだけ副情報に付く", () => {
    const r: ShareResult = { mode: "endless", score: 12340, chain: 7 };
    expect(cardSpec(r)).toEqual({ mode: "ENDLESS", main: "12,340", caption: "POINTS", subs: [{ text: "MAX CHAIN ×7" }] });
    expect(cardSpec(r, { rank: 38, total: 512 }).subs).toEqual([{ text: "MAX CHAIN ×7" }, { text: "RANK #38 / 512" }]);
    expect(cardMeta(r, { rank: 38, total: 512 })).toEqual({
      title: "12,340 points · max chain x7 – SWAPRISE",
      description: expect.stringContaining("ランキング 38 位 / 512 件。"),
    });
  });

  it("勝敗と CLEAR は色付きの単語が主役", () => {
    expect(cardSpec({ mode: "cpu", level: "hard", result: "win", chain: 9 })).toMatchObject({ mode: "VS CPU", main: "WIN", mainColor: 0xffe066, subs: [{ text: "CPU HARD" }, { text: "MAX CHAIN ×9" }] });
    expect(cardSpec({ mode: "puzzle", stage: "3-2", clear: true, left: 2 })).toMatchObject({ main: "CLEAR", subs: [{ text: "STAGE 3-2" }, { text: "2 MOVES LEFT" }] });
    expect(cardSpec({ mode: "puzzle", stage: "3-2", clear: false })).toMatchObject({ main: "FAILED", subs: [{ text: "STAGE 3-2" }] });
    expect(cardSpec({ mode: "online", result: "lose", chain: 3, vs: "Taro", wins: 3, losses: 1 }).subs).toEqual([{ text: "VS Taro  3W 1L" }, { text: "MAX CHAIN ×3" }]);
    expect(cardMeta({ mode: "online", result: "lose", chain: 3, vs: "Taro", wins: 3, losses: 1 }).title).toBe("Lost vs Taro (3W 1L) · max chain x3 – SWAPRISE");
    expect(cardMeta({ mode: "lesson", n: 3, total: 10 }).title).toBe("Lesson 3 / 10 clear – SWAPRISE");
  });
});
