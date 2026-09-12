import { describe, expect, it } from "vitest";
import { bakeLoopCrossfade, loopPosition } from "../../src/render/loopBuffer";

describe("bakeLoopCrossfade", () => {
  it("区間の終わりを区間の直前の音に溶かし、継ぎ目で区間の直前の音そのものになる", () => {
    const sr = 1000;
    // 0..1 秒: 一定の 0.5、1..2 秒（区間の直前）: 一定の -0.5、2..4 秒: 区間
    const ch = new Float32Array(sr * 4);
    ch.fill(0.5, 0, sr);
    ch.fill(-0.5, sr, 2 * sr);
    ch.fill(0.25, 2 * sr, 4 * sr);
    expect(bakeLoopCrossfade(ch, sr, 2, 4, 0.1)).toBe(true);
    // 溶かしの手前は区間の音のまま
    expect(ch[4 * sr - 101]).toBeCloseTo(0.25, 6);
    // 溶かしの入口は区間の音、出口は直前の音（等パワー: cos/sin）
    expect(ch[4 * sr - 100]).toBeCloseTo(0.25, 6);
    expect(ch[4 * sr - 1]).toBeCloseTo(0.25 * Math.cos((99 / 100) * (Math.PI / 2)) + -0.5 * Math.sin((99 / 100) * (Math.PI / 2)), 6);
    // 真ん中は両方が同じ重み
    const mid = ch[4 * sr - 50];
    expect(mid).toBeCloseTo(0.25 * Math.SQRT1_2 + -0.5 * Math.SQRT1_2, 6);
    // 区間の頭や直前の音は書き換えない
    expect(ch[2 * sr]).toBeCloseTo(0.25, 6);
    expect(ch[2 * sr - 1]).toBeCloseTo(-0.5, 6);
  });

  it("区間の直前に溶かすぶんの音がなければ何もしない", () => {
    const ch = new Float32Array(1000).fill(0.3);
    expect(bakeLoopCrossfade(ch, 1000, 0.02, 0.9, 0.06)).toBe(false);
    expect(ch).toEqual(new Float32Array(1000).fill(0.3));
  });

  it("区間の終わりが素材の外なら何もしない", () => {
    const ch = new Float32Array(1000).fill(0.3);
    expect(bakeLoopCrossfade(ch, 1000, 0.5, 1.2, 0.06)).toBe(false);
  });
});

describe("loopPosition", () => {
  it("loopEnd までは頭からの経過そのもので、そのあとは区間の中を回る", () => {
    expect(loopPosition(-0.1, 16, 60)).toBe(0);
    expect(loopPosition(3, 16, 60)).toBe(3);
    expect(loopPosition(59.9, 16, 60)).toBeCloseTo(59.9);
    expect(loopPosition(60, 16, 60)).toBeCloseTo(16);
    expect(loopPosition(61, 16, 60)).toBeCloseTo(17);
    // 2 周目の終わり → 3 周目の頭
    expect(loopPosition(60 + 44 + 1, 16, 60)).toBeCloseTo(17);
  });
});
