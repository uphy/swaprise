import { describe, expect, it } from "vitest";
import { parseTrack, toTrackRow } from "../../src/net/track";

const PLAYER = "0f6c5c1e-9b7a-4d2e-8c3f-1a2b3c4d5e6f";

describe("parseTrack", () => {
  it("受け付けた出来事を整え、無い項目は空にする", () => {
    const p = parseTrack({ event: "start", player: PLAYER, mode: "cpu", detail: "hard" });
    expect(p).toEqual({
      event: "start", player: PLAYER, mode: "cpu", detail: "hard", outcome: "", referrer: "", source: "",
      locale: "", first: "0", display: "browser", version: "", seconds: 0,
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
});

describe("toTrackRow", () => {
  it("端末 id を index に、出来事の列を docs の並びで blobs に置く", () => {
    const p = parseTrack({ event: "visit", player: PLAYER, referrer: "news.ycombinator.com", source: "x", locale: "ja", first: "1", version: "2026-09-13 abc1234" })!;
    expect(toTrackRow(p, "JP")).toEqual({
      indexes: [PLAYER],
      blobs: ["visit", "", "", "", "news.ycombinator.com", "x", "JP", "ja", "1", "browser", "2026-09-13 abc1234"],
      doubles: [0],
    });
  });
});
