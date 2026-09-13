import { describe, expect, it } from "vitest";
import {
  Board,
  Game,
  NO_INPUT,
  PUZZLES,
  PUZZLES_PER_STAGE,
  PUZZLE_STAGES,
  analyzeMove,
  boardForStage,
  countSolutions,
  formatRows,
  gridFromBoard,
  hasDeadKind,
  panelCount,
  parseRows,
  parseSolution,
  puzzleName,
  replayOnBoard,
  resolve,
  settle,
  solutionSignature,
  solve,
  swapResolved,
  type PuzzleStage,
} from "../../src/core";
import { run } from "./helpers";

/** 1手で消える面。(2,0) と (3,0) を入れ替えると下段が 0 0 0 になる。 */
const ONE_MOVE: PuzzleStage = { moves: 1, rows: ["00.0.."] };
/** 往復の確認用。 */
const SHAPE: PuzzleStage = {
  moves: 2,
  rows: ["1.....", "1.....", "01....", "00.1.."],
};

describe("パズル: 盤面の文字列", () => {
  it("行文字列と盤面を往復できる", () => {
    const g = parseRows(SHAPE.rows);
    expect(formatRows(g)).toEqual(SHAPE.rows);
    expect(panelCount(g)).toBe(7);
  });

  it("幅が違う行は受け付けない", () => {
    expect(() => parseRows(["00"])).toThrow();
  });
});

describe("パズル: ソルバーの盤面の進行", () => {
  it("床に着いた3つ並びが消えて上が落ちる", () => {
    const g = parseRows(["2.....", "000..."]);
    resolve(g);
    expect(formatRows(g)).toEqual(["2....."]);
  });

  it("浮いているパネルは落ちてから揃う", () => {
    // (0,1) の 0 は入れ替えで空中に出た想定。落ちて下段の 0 0 と揃う
    const g = parseRows(["0.....", ".00..."]);
    resolve(g);
    expect(panelCount(g)).toBe(0);
  });

  it("入れ替えで揃わないときは盤面だけ変わる", () => {
    const g = parseRows(["01...."]);
    const r = swapResolved(g, 0, 0)!;
    expect(formatRows(r)).toEqual(["10...."]);
    // 両方空、同じ柄の入れ替えは意味がない
    expect(swapResolved(g, 3, 0)).toBeNull();
    expect(swapResolved(parseRows(["00...."]), 0, 0)).toBeNull();
  });
});

describe("パズル: ソルバー", () => {
  it("1手の解を見つける", () => {
    const g = parseRows(ONE_MOVE.rows);
    expect(solve(g, 1)).toEqual([{ x: 2, y: 0 }]);
    expect(countSolutions(g, 1)).toBe(1);
  });

  it("2手の面は1手では解けない", () => {
    const st = PUZZLES.find((p) => p.moves === 2)!;
    const g = parseRows(st.rows);
    expect(solve(g, 1)).toBeNull();
    const sol = solve(g, 2);
    expect(sol).not.toBeNull();
    expect(sol!.length).toBe(2);
    expect(replayOnBoard(st, sol!)).toBe(true);
  });

  it("揃わない枚数の柄が残る面は解けない", () => {
    const g = parseRows(["00...."]);
    expect(hasDeadKind(g)).toBe(true);
    expect(solve(g, 3)).toBeNull();
  });

  it("盤面の数の上限を超えたら打ち切る", () => {
    const g = parseRows(PUZZLES[PUZZLES.length - 1].rows);
    expect(solve(g, 5, { maxStates: 1 })).toBeNull();
  });
});

describe("パズル: 技法の判定", () => {
  const techs = (rows: string[], x: number, y: number): string =>
    [...analyzeMove(parseRows(rows), { x, y })!.techniques].sort().join("");

  it("横・縦・落として揃える・連鎖・同時消し・何も消えない を見分ける", () => {
    expect(techs(["00.0.."], 2, 0)).toBe("H");
    // (1,2) の 0 を左の列へ入れて縦 3 つ
    expect(techs([".0....", "01....", "01...."], 0, 2)).toBe("V");
    // (0,2) の 0 を右へ出すと (1,0) まで落ちて横 3 つ
    expect(techs(["0.....", "1.....", "1.00.."], 0, 2)).toBe("FH");
    // 下段の 0 が消えると上の 1 が落ちて (3,0) の 1 と横 3 つ（連鎖）
    expect(techs([".11...", "0010.."], 2, 0)).toBe("CH");
    // 1 手で 2 つの並びが同時に消える
    expect(techs(["001011"], 2, 0)).toBe("DH");
    expect(techs(["01...."], 0, 0)).toBe("N");
    // 同じ柄同士・空同士の入れ替えは意味がない
    expect(analyzeMove(parseRows(["00...."]), { x: 0, y: 0 })).toBeNull();
  });

  it("解の並びを signature にし、2手以上は順番が決まる面に ! を付ける", () => {
    expect(solutionSignature(parseRows(ONE_MOVE.rows), [{ x: 2, y: 0 }])).toBe(
      "H",
    );
    PUZZLES.forEach((st) => {
      const sig = solutionSignature(
        parseRows(st.rows),
        parseSolution(st.solution ?? ""),
      );
      expect(sig.split("!")[0].split("-")).toHaveLength(st.moves);
    });
  });
});

describe("パズル: Board のルール", () => {
  it("せり上がりがなく、次の行もなく、手動せり上げも効かない", () => {
    const b = boardForStage(ONE_MOVE);
    expect(b.nextRow).toEqual([]);
    run(b, 2000, { ...NO_INPUT, raise: true });
    expect(b.stats.manualRows).toBe(0);
    expect(b.panelCount()).toBe(3);
    expect(b.movesLeft).toBe(1);
  });

  it("成功した入れ替えだけを手と数え、静止していない間は受け付けない", () => {
    const b = new Board({ seed: 1, kinds: 5, initialHeight: 0, moveLimit: 3 });
    b.setColumns([[0], [1], [], [], [], []]);
    b.cursor.x = 0;
    b.cursor.y = 0;
    // 空同士の入れ替えは失敗するので手数は減らない
    b.cursor.x = 3;
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(3);
    b.cursor.x = 0;
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(2);
    // 入れ替えのアニメーション中（4フレーム）は次の入れ替えを受け付けない
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(2);
    expect(settle(b)).toBe(true);
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(1);
    settle(b);
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(0);
    settle(b);
    // 手数が尽きたら入れ替えできない
    b.tick({ ...NO_INPUT, swap: true });
    expect(b.movesLeft).toBe(0);
    expect(b.cell(0, 0).kind).toBe(1);
  });
});

describe("パズル: Game の判定", () => {
  it("全消しで clear", () => {
    const g = new Game({ mode: "puzzle", seed: 1, puzzle: ONE_MOVE });
    expect(g.puzzle).toBe(ONE_MOVE);
    expect(g.boards).toHaveLength(1);
    expect(g.finished).toBe(false);
    g.tick([{ ...NO_INPUT, cursorTo: { x: 2, y: 0 }, swap: true }]);
    for (let i = 0; i < 600 && !g.finished; i++) g.tick([NO_INPUT]);
    expect(g.finished).toBe(true);
    expect(g.puzzleResult).toBe("clear");
    expect(g.boards[0].gameOver).toBe(false);
  });

  it("手数を使い切ってパネルが残ったら fail。判定は盤面が静止してから", () => {
    const g = new Game({ mode: "puzzle", seed: 1, puzzle: ONE_MOVE });
    // 消えない入れ替え
    g.tick([{ ...NO_INPUT, cursorTo: { x: 0, y: 0 }, swap: true }]);
    expect(g.boards[0].movesLeft).toBe(0);
    expect(g.finished).toBe(false);
    for (let i = 0; i < 600 && !g.finished; i++) g.tick([NO_INPUT]);
    expect(g.finished).toBe(true);
    expect(g.puzzleResult).toBe("fail");
    expect(g.boards[0].panelCount()).toBe(3);
  });

  it("stage で面データを引く。範囲外は端に丸める", () => {
    expect(new Game({ mode: "puzzle", seed: 1, stage: 3 }).puzzle).toBe(
      PUZZLES[3],
    );
    expect(new Game({ mode: "puzzle", seed: 1, stage: 999 }).stage).toBe(
      PUZZLES.length - 1,
    );
    expect(new Game({ mode: "endless", seed: 1 }).puzzle).toBeNull();
    expect(new Game({ mode: "endless", seed: 1 }).stage).toBe(-1);
  });
});

describe("パズル: 戻す・進める・ヒント", () => {
  const swapAt = (g: Game, x: number, y: number): void => {
    g.tick([{ ...NO_INPUT, cursorTo: { x, y }, swap: true }]);
    for (let i = 0; i < 600 && !g.boards[0].isSettled(); i++) g.tick([NO_INPUT]);
  };
  const rows = (g: Game): string[] => formatRows(gridFromBoard(g.boards[0]));

  it("打った手を履歴に積み、戻すと 1 手前の盤面と手数に戻る。失敗の結果からも戻せる", () => {
    const g = new Game({ mode: "puzzle", seed: 1, puzzle: SHAPE });
    const start = rows(g);
    swapAt(g, 1, 0);
    expect(g.puzzleMoves).toEqual([{ x: 1, y: 0 }]);
    const after1 = rows(g);
    expect(after1).not.toEqual(start);
    swapAt(g, 2, 0);
    expect(g.boards[0].movesLeft).toBe(0);
    for (let i = 0; i < 600 && !g.finished; i++) g.tick([NO_INPUT]);
    expect(g.puzzleResult).toBe("fail");
    expect(g.puzzleUndo()).toBe(true);
    expect(g.finished).toBe(false);
    expect(g.puzzleResult).toBeNull();
    expect(g.boards[0].movesLeft).toBe(1);
    expect(rows(g)).toEqual(after1);
    expect(g.boards[0].cursor).toEqual({ x: 2, y: 0 });
    expect(g.puzzleUndo()).toBe(true);
    expect(rows(g)).toEqual(start);
    expect(g.boards[0].movesLeft).toBe(2);
    expect(g.puzzleUndo()).toBe(false);
  });

  it("進めるは戻した手を打ち直す。新しい手を打つと進める手は消える", () => {
    const g = new Game({ mode: "puzzle", seed: 1, puzzle: SHAPE });
    swapAt(g, 0, 0);
    const after1 = rows(g);
    expect(g.puzzleCanRedo).toBe(false);
    g.puzzleUndo();
    expect(g.puzzleCanRedo).toBe(true);
    expect(g.puzzleRedoMove()).toBe(true);
    expect(g.puzzleCanRedo).toBe(false);
    expect(rows(g)).toEqual(after1);
    expect(g.puzzleMoves).toEqual([{ x: 0, y: 0 }]);
    expect(g.boards[0].movesLeft).toBe(1);
    g.puzzleUndo();
    swapAt(g, 2, 0);
    expect(g.puzzleCanRedo).toBe(false);
    expect(g.puzzleRedoMove()).toBe(false);
  });

  it("動いている間は戻せない。全消しのあとも戻さない", () => {
    const g = new Game({ mode: "puzzle", seed: 1, puzzle: ONE_MOVE });
    g.tick([{ ...NO_INPUT, cursorTo: { x: 2, y: 0 }, swap: true }]);
    g.tick([NO_INPUT]);
    expect(g.boards[0].isSettled()).toBe(false);
    expect(g.puzzleUndo()).toBe(false);
    for (let i = 0; i < 600 && !g.finished; i++) g.tick([NO_INPUT]);
    expect(g.puzzleResult).toBe("clear");
    expect(g.puzzleUndo()).toBe(false);
  });

  it("ヒントは次の 1 手と技法を返す。解から外れたら解き直し、残りの手数で解けなければ null", () => {
    const g = new Game({ mode: "puzzle", seed: 1, stage: 14 }); // 2-5: N-N-HVCD!
    const sol = parseSolution(PUZZLES[14].solution!);
    const h0 = g.puzzleHint()!;
    expect(h0.move).toEqual(sol[0]);
    expect(h0.techniques).toEqual(new Set(["N"]));
    swapAt(g, sol[0].x, sol[0].y);
    swapAt(g, sol[1].x, sol[1].y);
    const h2 = g.puzzleHint()!;
    expect(h2.move).toEqual(sol[2]);
    expect(h2.techniques).toEqual(new Set(["H", "V", "C", "D"]));
    // 解の順を入れ替えた手（2 手目を先に打つ）からは解けないので null
    g.puzzleUndo();
    g.puzzleUndo();
    swapAt(g, sol[1].x, sol[1].y);
    expect(g.puzzleHint()).toBeNull();
    // 解から外れても残りの手数で解ける盤面ならソルバーが手を返す
    const g2 = new Game({ mode: "puzzle", seed: 1, puzzle: { moves: 2, rows: ["00.0.."] } });
    swapAt(g2, 4, 0);
    const h = g2.puzzleHint()!;
    expect(h.move).toEqual({ x: 2, y: 0 });
    expect(h.techniques).toEqual(new Set(["H"]));
  });

  it("パズル以外では履歴を積まず、戻す・進める・ヒントは何もしない", () => {
    const g = new Game({ mode: "endless", seed: 1 });
    g.tick([{ ...NO_INPUT, swap: true }]);
    expect(g.puzzleMoves).toEqual([]);
    expect(g.puzzleUndo()).toBe(false);
    expect(g.puzzleRedoMove()).toBe(false);
    expect(g.puzzleHint()).toBeNull();
  });
});

describe("パズル: 面データ", () => {
  it("6 ステージ × 10 面ある", () => {
    expect(PUZZLES).toHaveLength(PUZZLE_STAGES * PUZZLES_PER_STAGE);
    expect(puzzleName(0)).toBe("1-1");
    expect(puzzleName(PUZZLES.length - 1)).toBe("6-10");
  });

  it("各面は形が正しく、置いた時点で揃っておらず、揃わない柄も残っていない", () => {
    PUZZLES.forEach((st, i) => {
      const g = parseRows(st.rows);
      expect(st.rows.length, puzzleName(i)).toBeLessThanOrEqual(8);
      expect(st.moves, puzzleName(i)).toBeGreaterThanOrEqual(1);
      expect(st.moves, puzzleName(i)).toBeLessThanOrEqual(5);
      const settled = new Int8Array(g);
      resolve(settled);
      expect(formatRows(settled), puzzleName(i)).toEqual(st.rows);
      expect(hasDeadKind(g), puzzleName(i)).toBe(false);
    });
  });

  it("記録された解は手数どおりで、本物の Board で再生すると全消しになる", () => {
    PUZZLES.forEach((st, i) => {
      const sol = parseSolution(st.solution ?? "");
      expect(sol.length, puzzleName(i)).toBe(st.moves);
      expect(replayOnBoard(st, sol), puzzleName(i)).toBe(true);
    });
  });

  it("1手少なくては解けない（ソルバーの範囲で）", () => {
    PUZZLES.forEach((st, i) => {
      if (st.moves === 1) return;
      const g = parseRows(st.rows);
      expect(
        solve(g, st.moves - 1, { maxStates: 150_000 }),
        puzzleName(i),
      ).toBeNull();
    });
  });

  it("同じステージの中で解き方（技法の並び）が重ならない", () => {
    for (let s = 0; s < PUZZLE_STAGES; s++) {
      const sigs = PUZZLES.slice(
        s * PUZZLES_PER_STAGE,
        (s + 1) * PUZZLES_PER_STAGE,
      ).map((st) =>
        solutionSignature(parseRows(st.rows), parseSolution(st.solution ?? "")),
      );
      expect(new Set(sigs).size, `stage ${s + 1}: ${sigs.join(" ")}`).toBe(
        sigs.length,
      );
    }
  });

  it("同じ面が2つない", () => {
    const keys = new Set(PUZZLES.map((st) => st.rows.join("/")));
    expect(keys.size).toBe(PUZZLES.length);
  });
});
