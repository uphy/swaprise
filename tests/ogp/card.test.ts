import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CARD_H, CARD_W, encodePng, renderCard } from "../../src/ogp/card";
import { cardText } from "../../src/ogp/font";

describe("結果カードの描画", () => {
  it("1200×630 の PNG になり、同じ内容なら同じ絵", async () => {
    const spec = { mode: "ENDLESS", main: "12,340", caption: "POINTS", subs: [{ text: "MAX CHAIN ×7" }, { text: "RANK #38 / 512" }] };
    const raw = renderCard(spec);
    expect(raw.length).toBe(CARD_W * CARD_H * 3);
    expect(renderCard(spec)).toEqual(raw);
    const png = await encodePng(CARD_W, CARD_H, raw, (d) => deflateSync(d));
    expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer, png.byteOffset);
    expect(view.getUint32(16)).toBe(CARD_W);
    expect(view.getUint32(20)).toBe(CARD_H);
    expect(png.length).toBeLessThan(200_000);
  });

  it("主役が長くても横幅に収まる大きさに縮み、長い名前でも描ける", () => {
    expect(() => renderCard({ mode: "ONLINE", main: "DRAW", subs: [{ text: "VS " + "W".repeat(12) + "  9999W 9999L" }, { text: "MAX CHAIN ×99" }] })).not.toThrow();
    expect(() => renderCard({ mode: "ENDLESS", main: "99,999,999", caption: "POINTS", subs: [] })).not.toThrow();
  });

  it("小文字は大文字に、字形のない文字は ? に寄せる", () => {
    expect(cardText("Taro 3w")).toBe("TARO 3W");
    expect(cardText("太郎")).toBe("??");
  });
});
