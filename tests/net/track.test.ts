import { describe, expect, it } from "vitest";
import { PLAY_STATS, emptyPlayStats, parseTrack, toTrackRow } from "../../src/net/track";

const PLAYER = "0f6c5c1e-9b7a-4d2e-8c3f-1a2b3c4d5e6f";

describe("parseTrack", () => {
  it("受け付けた出来事を整え、無い項目は空にする", () => {
    const p = parseTrack({ event: "start", player: PLAYER, mode: "cpu", detail: "hard" });
    expect(p).toEqual({
      event: "start", player: PLAYER, mode: "cpu", detail: "hard", outcome: "", referrer: "", source: "",
      locale: "", first: "0", display: "browser", version: "", seconds: 0, input: "", orientation: "", stats: emptyPlayStats(),
    });
  });
  it("未知の出来事・id の形違い・JSON でないものは捨てる", () => {
    expect(parseTrack({ event: "click", player: PLAYER })).toBeNull();
    expect(parseTrack({ event: "visit", player: "me" })).toBeNull();
    expect(parseTrack({ event: "visit" })).toBeNull();
    expect(parseTrack(null)).toBeNull();
    expect(parseTrack("visit")).toBeNull();
  });
  it("長い文字列は切り、秒は整数に丸めて上限を付ける", () => {
    const p = parseTrack({ event: "end", player: PLAYER, mode: "x".repeat(40), referrer: "y".repeat(200), seconds: 12.6, first: "1", display: "standalone" })!;
    expect(p.mode).toHaveLength(16);
    expect(p.referrer).toHaveLength(128);
    expect(p.seconds).toBe(13);
    expect(p.first).toBe("1");
    expect(p.display).toBe("standalone");
    expect(parseTrack({ event: "end", player: PLAYER, seconds: 1e9 })!.seconds).toBe(86400);
    expect(parseTrack({ event: "end", player: PLAYER, seconds: -5 })!.seconds).toBe(0);
    expect(parseTrack({ event: "end", player: PLAYER, seconds: "9" })!.seconds).toBe(0);
    expect(parseTrack({ event: "visit", player: PLAYER, first: "yes", display: "tv" })).toMatchObject({ first: "0", display: "browser" });
  });
  it("プレイの集計は知っている項目だけ整数で受け、主な操作と向きは決まった値だけ通す", () => {
    const p = parseTrack({ event: "end", player: PLAYER, input: "touch", orientation: "portrait", stats: { swaps: 12.4, swapMatches: 3, extra: 9, score: -1, level: "9", drags: 1e9 } })!;
    expect(p.input).toBe("touch");
    expect(p.orientation).toBe("portrait");
    expect(p.stats).toEqual({ ...emptyPlayStats(), swaps: 12, swapMatches: 3, drags: 1_000_000 });
    expect(parseTrack({ event: "end", player: PLAYER, input: "voice", orientation: "upside", stats: "none" })).toMatchObject({ input: "", orientation: "", stats: emptyPlayStats() });
  });
});

describe("toTrackRow", () => {
  it("端末 id を index に、出来事の列を docs の並びで blobs に置く", () => {
    const p = parseTrack({ event: "visit", player: PLAYER, referrer: "news.ycombinator.com", source: "x", locale: "ja", first: "1", version: "2026-09-13 abc1234" })!;
    expect(toTrackRow(p, "JP")).toEqual({
      indexes: [PLAYER],
      blobs: ["visit", "", "", "", "news.ycombinator.com", "x", "JP", "ja", "1", "browser", "2026-09-13 abc1234", "", ""],
      doubles: [0, ...PLAY_STATS.map(() => 0)],
    });
  });
  it("end のプレイの集計を double2 以降に PLAY_STATS の並びで置く。列は Analytics Engine の上限 20 に収まる", () => {
    const stats = Object.fromEntries(PLAY_STATS.map((k, i) => [k, i + 1]));
    const p = parseTrack({ event: "end", player: PLAYER, mode: "endless", seconds: 90, input: "keys", orientation: "landscape", stats })!;
    const row = toTrackRow(p, "JP");
    expect(row.blobs.slice(11)).toEqual(["keys", "landscape"]);
    expect(row.doubles).toEqual([90, ...PLAY_STATS.map((_, i) => i + 1)]);
    expect(row.doubles.length).toBeLessThanOrEqual(20);
    expect(row.blobs.length).toBeLessThanOrEqual(20);
  });
});
