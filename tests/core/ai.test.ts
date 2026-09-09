import { describe, expect, it } from "vitest";
import { Board, COLS, CPU_PARAMS, CpuPlayer, Game, NO_INPUT, ROWS, type CpuLevel } from "../../src/core";

function playAlone(level: CpuLevel, seed: number, frames: number): Board {
  const b = new Board({ seed, speedLevel: 5 });
  const cpu = new CpuPlayer(b, level);
  for (let f = 0; f < frames && !b.gameOver; f++) b.tick(cpu.next());
  return b;
}

/** 2つの CPU を戦わせる。勝者（0 = 左）を返す。決着しなければ -1。 */
function duel(left: CpuLevel, right: CpuLevel, seed: number, maxFrames = 60 * 60 * 5): number {
  const game = new Game({ mode: "versus", seed, speedLevel: 10 });
  const a = new CpuPlayer(game.boards[0], left);
  const b = new CpuPlayer(game.boards[1], right);
  for (let f = 0; f < maxFrames && !game.finished; f++) game.tick([a.next(), b.next()]);
  return game.winner;
}

describe("対戦の初期盤面", () => {
  it("2人対戦・CPU 対戦・オンライン（versus）は、2人が同じ初期盤面と同じ次の行から始める", () => {
    for (const mode of ["versus", "cpu"] as const) {
      const game = new Game({ mode, seed: 7 });
      const [a, b] = game.boards;
      expect(a.toString(), mode).toBe(b.toString());
      expect(a.nextRow, mode).toEqual(b.nextRow);
    }
  });
});

describe("CPU プレイヤー", () => {
  it("カーソルは1マスずつしか動かず、入れ替えはカーソル位置でだけ行う", () => {
    const b = new Board({ seed: 3, noRise: true });
    const cpu = new CpuPlayer(b, "hard");
    for (let f = 0; f < 600; f++) {
      const input = cpu.next();
      expect(Math.abs(input.moveX) + Math.abs(input.moveY)).toBeLessThanOrEqual(2);
      expect(input.cursorTo).toBeUndefined();
      b.tick(input);
      expect(b.cursor.x).toBeGreaterThanOrEqual(0);
      expect(b.cursor.x).toBeLessThanOrEqual(COLS - 2);
      expect(b.cursor.y).toBeLessThanOrEqual(ROWS - 1);
    }
  });

  it("どの難易度でも1分以内にパネルを消し、ゲームオーバーにならない", () => {
    for (const level of ["easy", "normal", "hard"] as CpuLevel[]) {
      for (let seed = 1; seed <= 3; seed++) {
        const b = playAlone(level, seed, 60 * 60);
        expect(b.gameOver, `${level} seed=${seed}`).toBe(false);
        expect(b.panelsCleared, `${level} seed=${seed}`).toBeGreaterThan(0);
      }
    }
  });

  it("hard は easy より多く消す", () => {
    let hard = 0;
    let easy = 0;
    for (let seed = 1; seed <= 3; seed++) {
      hard += playAlone("hard", seed, 60 * 60).panelsCleared;
      easy += playAlone("easy", seed, 60 * 60).panelsCleared;
    }
    expect(hard).toBeGreaterThan(easy);
  });

  it("hard と easy を4回戦わせると hard が3回以上勝つ", () => {
    let hardWins = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const w = duel("hard", "easy", seed);
      if (w === 0) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(3);
  });

  it("cpu モードの Game は 2P 側を CPU が動かし、1P が放置すると負ける", () => {
    const game = new Game({ mode: "cpu", seed: 5, speedLevel: 30, cpuLevel: "normal" });
    for (let f = 0; f < 60 * 60 * 5 && !game.finished; f++) game.tick([NO_INPUT]);
    expect(game.finished).toBe(true);
    expect(game.winner).toBe(1);
    expect(game.boards[1].panelsCleared).toBeGreaterThan(0);
  });
});

/** 1回の入れ替えでは何も揃わず、おじゃまが乗っていて危険状態なので手動せり上げもできない盤面（実機で CPU が止まった場面）。 */
function stuckBoard(): Board {
  const b = new Board({ seed: 1, initialHeight: 0, noRise: true });
  b.setColumns([
    [6, 2, 3],
    [1],
    [0, 2, 0],
    [1, 4, 0],
    [0, 3, 3],
    [2, 4, 1, 1, 2, 0],
  ]);
  b.placeGarbage(0, 6, 6, 2);
  b.placeGarbage(0, 8, 5, 1);
  return b;
}

function firstEvents(b: Board, cpu: CpuPlayer, frames: number): { swap: number; match: number } {
  let swap = -1;
  let match = -1;
  for (let f = 0; f < frames && match < 0; f++) {
    b.tick(cpu.next());
    if (swap < 0 && b.events.some((e) => e.type === "swap")) swap = b.frame;
    if (b.events.some((e) => e.type === "match")) match = b.frame;
  }
  return { swap, match };
}

describe("CPU が止まらない", () => {
  it("1回の入れ替えで揃う手がない盤面でも、パネルを運んで揃える", () => {
    for (const level of ["easy", "normal", "hard"] as CpuLevel[]) {
      const b = stuckBoard();
      const { swap, match } = firstEvents(b, new CpuPlayer(b, level), 60 * 10);
      expect(swap, `${level} swap`).toBeGreaterThan(0);
      expect(match, `${level} match`).toBeGreaterThan(0);
    }
  });

  it("穴に落とす先の足場を作ってから落とす手順を見つける", () => {
    // 行1の 0 0 に3つ目の 0 を落としたいが、列2は底まで空。先に行0の 0 を列2へ動かして足場にする
    const b = new Board({ seed: 1, initialHeight: 0, noRise: true });
    b.setColumns([
      [1, 0, 3, 0, 3, 1, 0, 1],
      [3, 0, 4],
      [],
      [0],
      [6, 3],
      [4],
    ]);
    const { match } = firstEvents(b, new CpuPlayer(b, "hard"), 60 * 10);
    expect(match).toBeGreaterThan(0);
  });

  it("相手が放置していても、入れ替えが4秒以上途切れない", () => {
    for (const level of ["easy", "normal", "hard"] as CpuLevel[]) {
      for (let seed = 1; seed <= 4; seed++) {
        const game = new Game({ mode: "cpu", seed, speedLevel: 1, cpuLevel: level });
        const b = game.boards[1];
        let lastSwap = 0;
        let worst = 0;
        for (let f = 0; f < 60 * 90 && !game.finished; f++) {
          game.tick([NO_INPUT]);
          if (b.events.some((e) => e.type === "swap")) lastSwap = b.frame;
          worst = Math.max(worst, b.frame - lastSwap);
        }
        // 上限は「思考の待ち ＋ カーソルを盤面の端から端まで運ぶ時間」。easy は思考100F・移動16F/マスなので7秒ほどになる
        const p = CPU_PARAMS[level];
        const limit = Math.max(240, p.thinkDelay + p.moveInterval * (COLS + ROWS) + 4);
        expect(worst, `${level} seed=${seed}`).toBeLessThanOrEqual(limit);
      }
    }
  });
});
