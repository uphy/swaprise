import { describe, expect, it } from "vitest";
import { Game, LESSONS, NO_INPUT, boardForLesson, type Lesson } from "../../src/core";

function lessonGame(id: string): Game {
  const index = LESSONS.findIndex((l) => l.id === id);
  expect(index).toBeGreaterThanOrEqual(0);
  return new Game({ mode: "lesson", seed: 1, lesson: index });
}

function swapAt(g: Game, x: number, y: number): void {
  g.tick([{ ...NO_INPUT, cursorTo: { x, y }, swap: true }]);
}

function runFrames(g: Game, frames: number): void {
  for (let i = 0; i < frames && !g.finished; i++) g.tick([NO_INPUT]);
}

/** 静止するまで進める。せり上がりのない面なので、いずれ止まる。 */
function settle(g: Game): void {
  for (let i = 0; i < 2000; i++) {
    g.tick([NO_INPUT]);
    if (g.finished || g.boards[0].isSettled()) return;
  }
}

describe("レッスン", () => {
  it("固定の面はせり上がらず、次の行もなく、手数の制限もない", () => {
    const g = lessonGame("clear");
    const b = g.boards[0];
    expect(b.nextRow).toEqual([]);
    expect(b.movesLeft).toBeNull();
    runFrames(g, 600);
    expect(b.risenRows).toBe(0);
    // 手動せり上げも効かない
    g.tick([{ ...NO_INPUT, raise: true }]);
    expect(b.risenRows).toBe(0);
  });

  it("clear: 目印の入れ替えで 3 枚揃い、消え終わると finished になる", () => {
    const g = lessonGame("clear");
    const { x, y } = LESSONS[0].hint!;
    swapAt(g, x, y);
    runFrames(g, 10);
    expect(g.lessonDone).toBe(true);
    expect(g.finished).toBe(false);
    settle(g);
    expect(g.finished).toBe(true);
  });

  it("drop: 動かしたパネルが穴に落ちて縦に揃う。落ちる前は未達成", () => {
    const g = lessonGame("drop");
    swapAt(g, 2, 3);
    runFrames(g, 5);
    expect(g.lessonDone).toBe(false);
    settle(g);
    expect(g.lessonDone).toBe(true);
  });

  it("chain: 消えた上のパネルが落ちて揃うと 2 連鎖で達成。1 回消えただけでは未達成", () => {
    const g = lessonGame("chain");
    swapAt(g, 0, 1);
    runFrames(g, 10);
    expect(g.boards[0].stats.chains).toBe(0);
    expect(g.lessonDone).toBe(false);
    settle(g);
    expect(g.boards[0].maxChain).toBe(2);
    expect(g.lessonDone).toBe(true);
  });

  it("combo: 落とした 1 枚で 5 枚が一度に消えて達成", () => {
    const g = lessonGame("combo");
    swapAt(g, 2, 2);
    settle(g);
    expect(g.boards[0].stats.combos).toBe(1);
    expect(g.lessonDone).toBe(true);
  });

  it("active: 点滅している間に入れ替えると落ちてくる 2 枚と揃って 2 連鎖になり達成", () => {
    const g = lessonGame("active");
    swapAt(g, 0, 0);
    runFrames(g, 20);
    // 消去中（点滅）に横の 2 枚を入れ替える
    expect(g.boards[0].isSettled()).toBe(false);
    swapAt(g, 4, 0);
    expect(g.boards[0].stats.activeSwaps).toBe(1);
    settle(g);
    expect(g.boards[0].maxChain).toBe(2);
    expect(g.lessonDone).toBe(true);
  });

  it("active: 消え終わってから入れ替えると連鎖にならず未達成", () => {
    const g = lessonGame("active");
    swapAt(g, 0, 0);
    settle(g);
    expect(g.lessonDone).toBe(false);
    // 着地から 12 フレームは連鎖フラグが残る（通常のルール）。人が見てから動かす間は過ぎている
    runFrames(g, 20);
    swapAt(g, 4, 0);
    settle(g);
    expect(g.boards[0].stats.activeSwaps).toBe(0);
    expect(g.boards[0].maxChain).toBe(1);
    expect(g.lessonDone).toBe(false);
  });

  it("active: 点滅と猶予は通常の 2 倍", () => {
    const slow = boardForLesson(LESSONS.find((l) => l.id === "active")!, 1);
    const normal = boardForLesson({ ...LESSONS.find((l) => l.id === "active")!, timingScale: undefined }, 1);
    const framesToSettle = (b: typeof slow): number => {
      b.tick({ ...NO_INPUT, cursorTo: { x: 0, y: 0 }, swap: true });
      for (let i = 1; i < 2000; i++) {
        b.tick(NO_INPUT);
        if (b.isSettled()) return i;
      }
      return -1;
    };
    const s = framesToSettle(slow);
    const n = framesToSettle(normal);
    expect(n).toBeGreaterThan(0);
    expect(s).toBeGreaterThan(n * 1.5);
  });

  it("rise: せり上がる乱数の盤面で、2 連鎖で達成", () => {
    const g = lessonGame("rise");
    const b = g.boards[0];
    expect(b.nextRow.length).toBe(6);
    runFrames(g, 60 * 30);
    expect(b.risenRows).toBeGreaterThan(0);
    expect(g.lessonDone).toBe(false);
  });

  it("rise: せり上げ続けて天井に届くと終わるが、達成にはならない", () => {
    const g = lessonGame("rise");
    for (let i = 0; i < 60 * 60 && !g.finished; i++) g.tick([{ ...NO_INPUT, raise: true }]);
    expect(g.finished).toBe(true);
    expect(g.boards[0].gameOver).toBe(true);
    expect(g.lessonDone).toBe(false);
  });

  it("課の番号は範囲に収める", () => {
    expect(new Game({ mode: "lesson", seed: 1, lesson: 99 }).lessonIndex).toBe(LESSONS.length - 1);
    expect(new Game({ mode: "lesson", seed: 1, lesson: -1 }).lessonIndex).toBe(0);
  });

  it("固定の面は最初から揃っている所がない", () => {
    for (const lesson of LESSONS.filter((l): l is Lesson & { rows: string[] } => !!l.rows)) {
      const g = new Game({ mode: "lesson", seed: 1, lesson: LESSONS.indexOf(lesson) });
      runFrames(g, 30);
      expect(g.lessonDone, lesson.id).toBe(false);
    }
  });
});
