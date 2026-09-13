import { describe, expect, it } from "vitest";
import { referrerHost, trackingHost, visitFields } from "../../src/render/analytics";

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
