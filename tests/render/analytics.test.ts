import { describe, expect, it } from "vitest";
import { playFields, referrerHost, trackingHost, visitFields } from "../../src/render/analytics";

describe("trackingHost", () => {
  it("本番と PR プレビューの Worker だけに送り、手元の dev / preview には送らない", () => {
    expect(trackingHost("swaprise.uphy.dev")).toBe(true);
    expect(trackingHost("swaprise-pr-66.yuhi-ishikura.workers.dev")).toBe(true);
    expect(trackingHost("localhost")).toBe(false);
    expect(trackingHost("127.0.0.1")).toBe(false);
    expect(trackingHost("192.168.1.20")).toBe(false);
  });
});

describe("referrerHost", () => {
  it("流入元のホスト名だけを残し、自分のサイト内の遷移と壊れた URL は空にする", () => {
    expect(referrerHost("https://t.co/abc?x=1", "swaprise.uphy.dev")).toBe("t.co");
    expect(referrerHost("https://swaprise.uphy.dev/?room=1", "swaprise.uphy.dev")).toBe("");
    expect(referrerHost("", "swaprise.uphy.dev")).toBe("");
    expect(referrerHost("not a url", "swaprise.uphy.dev")).toBe("");
  });
});

describe("visitFields", () => {
  it("utm_source・初回かどうか・ホーム画面からかをまとめる", () => {
    expect(visitFields({ referrer: "https://news.ycombinator.com/item?id=1", search: "?utm_source=hn&utm_medium=post", ownHost: "swaprise.uphy.dev", hasPlayer: false, standalone: false }))
      .toEqual({ referrer: "news.ycombinator.com", source: "hn", first: "1", display: "browser" });
    expect(visitFields({ referrer: "", search: "", ownHost: "swaprise.uphy.dev", hasPlayer: true, standalone: true }))
      .toEqual({ referrer: "", source: "", first: "0", display: "standalone" });
  });
});

describe("playFields", () => {
  const board = { score: 1230, maxChain: 3, panelsCleared: 45, level: 7, risenRows: 20, stats: { swaps: 40, matches: 12, swapMatches: 9, chains: 3, combos: 1, manualRows: 4 } };
  it("盤面と操作の集計を PLAY_STATS の項目にまとめる", () => {
    const f = playFields({ board, touch: { stats: { drags: 10, dragSteps: 30, dragMidStops: 5, taps: 0 } }, keys: { stats: { keySwaps: 2 } }, touchDevice: true, portrait: true });
    expect(f).toEqual({
      input: "touch", orientation: "portrait",
      stats: { score: 1230, maxChain: 3, swaps: 40, matches: 12, swapMatches: 9, chains: 3, combos: 1, panels: 45, risenRows: 20, manualRows: 4, level: 7, drags: 10, dragSteps: 30, dragMidStops: 5, taps: 0, keySwaps: 2 },
    });
  });
  it("主な操作は入れ替えを多く出した側。キーが多ければ keys、そうでなければタッチ端末なら touch、PC なら mouse", () => {
    const touch = { stats: { drags: 1, dragSteps: 2, dragMidStops: 0, taps: 3 } };
    expect(playFields({ board, touch, keys: { stats: { keySwaps: 6 } }, touchDevice: true, portrait: false }).input).toBe("keys");
    expect(playFields({ board, touch, keys: { stats: { keySwaps: 5 } }, touchDevice: false, portrait: false })).toMatchObject({ input: "mouse", orientation: "landscape" });
    expect(playFields({ board, touch: null, keys: null, touchDevice: false, portrait: false }).stats).toMatchObject({ drags: 0, keySwaps: 0 });
  });
});
