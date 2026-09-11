import { describe, expect, it } from "vitest";
import { Game, NO_INPUT, TIME_ATTACK_FRAMES } from "../../src/core";

describe("タイムアタック", () => {
  it("制限時間は既定で2分（7200フレーム）", () => {
    const g = new Game({ mode: "timeattack", seed: 1 });
    expect(g.timeLimit).toBe(TIME_ATTACK_FRAMES);
    expect(TIME_ATTACK_FRAMES).toBe(120 * 60);
    expect(g.framesLeft).toBe(TIME_ATTACK_FRAMES);
  });

  it("時間切れで終わる。盤面はゲームオーバーにならず得点が残る", () => {
    const g = new Game({ mode: "timeattack", seed: 1, timeLimitFrames: 300 });
    for (let i = 0; i < 299; i++) g.tick([NO_INPUT]);
    expect(g.finished).toBe(false);
    expect(g.framesLeft).toBe(1);
    g.tick([NO_INPUT]);
    expect(g.finished).toBe(true);
    expect(g.timeUp).toBe(true);
    expect(g.boards[0].gameOver).toBe(false);
    expect(g.framesLeft).toBe(0);
    // 終わったあとは進まない
    g.tick([NO_INPUT]);
    expect(g.boards[0].frame).toBe(300);
  });

  it("時間内に天井へ届いたら通常のゲームオーバー", () => {
    const g = new Game({ mode: "timeattack", seed: 1, timeLimitFrames: 100_000 });
    // 手動せり上げを押し続けて天井まで積む
    for (let i = 0; i < 20_000 && !g.finished; i++) g.tick([{ ...NO_INPUT, raise: true }]);
    expect(g.finished).toBe(true);
    expect(g.timeUp).toBe(false);
    expect(g.boards[0].gameOver).toBe(true);
  });

  it("他のモードには制限時間がない", () => {
    expect(new Game({ mode: "endless", seed: 1 }).timeLimit).toBeNull();
    expect(new Game({ mode: "endless", seed: 1 }).framesLeft).toBeNull();
    expect(new Game({ mode: "cpu", seed: 1 }).timeLimit).toBeNull();
  });
  it("最後のフレームまで交換でき、その後は入力・せり上がりを止めて連鎖を完走する", () => {
    const g = new Game({ mode: "timeattack", seed: 1, timeLimitFrames: 1 });
    const b = g.boards[0];
    b.setColumns([[2, 1, 0, 0, 4, 0, 1, 1, 3], [4, 3], [4, 3]]);
    b.cursor.x = 0; b.cursor.y = 4;
    g.tick([{ ...NO_INPUT, swap: true }]);
    expect(g.timeUp).toBe(true);
    expect(g.finished).toBe(false);
    expect(b.events.some((e) => e.type === "swap")).toBe(true);
    const cursor = { ...b.cursor }, rise = b.riseProgress;
    for (let i = 0; i < 2000 && !g.finished; i++) {
      g.tick([{ ...NO_INPUT, moveX: -1, moveY: 1, swap: true, raise: true }]);
      expect(b.events.some((e) => e.type === "swap" || e.type === "move")).toBe(false);
      expect(b.riseProgress).toBe(rise);
      expect(b.cursor).toEqual(cursor);
    }
    expect(g.finished).toBe(true);
    expect(b.isSettled()).toBe(true);
    expect(b.score).toBe(220);
    expect(b.maxChain).toBe(3);
    expect(b.frame).toBeGreaterThan(1);
    expect(g.framesLeft).toBe(0);
    const frame = b.frame;
    g.tick([NO_INPUT]); expect(b.frame).toBe(frame);
  });
  it("最後のフレームにせり上がった行も消去判定してから確定する", () => {
    const g = new Game({ mode: "timeattack", seed: 1, timeLimitFrames: 1 });
    const b = g.boards[0]; b.setColumns([]);
    b.nextRow = [0, 0, 0, 1, 2, 3]; b.riseProgress = 0.99999;
    g.tick([{ ...NO_INPUT, raise: true }]);
    expect(g.timeUp).toBe(true); expect(g.finished).toBe(false);
    for (let i = 0; i < 1000 && !g.finished; i++) g.tick([NO_INPUT]);
    expect(g.finished).toBe(true); expect(b.score).toBe(31);
    expect(b.risenRows).toBe(1);
  });
});
