import { Board } from "./board";
import { COLS, ROWS } from "./constants";
import { EMPTY, NO_INPUT, type Kind } from "./types";

/**
 * パズルモードの面。せり上がりなしの盤面を、決められた手数（入れ替え回数）で全部消す。
 * 面データは `puzzles.ts` に持ち、`tools/make-puzzles.ts` が生成する。
 */
export interface PuzzleStage {
  /** 使える入れ替えの回数。 */
  moves: number;
  /** 盤面を上から下へ1行ずつ。`.` は空、`0`〜`4` は柄。各行 COLS 文字、行数は ROWS 以下。空の行は省いてよい。 */
  rows: string[];
  /** 生成時に見つけた解。`x,y` を空白で区切る（x は左の列、y は下から数えた段）。テストが Board で再生して全消しを確かめる。 */
  solution?: string;
}

export interface PuzzleMove {
  x: number;
  y: number;
}

/** 面の数。6 ステージ × 10 面。 */
export const PUZZLE_STAGES = 6;
export const PUZZLES_PER_STAGE = 10;

/** 0 始まりの通し番号を「1-1」の形にする。 */
export function puzzleName(index: number): string {
  return `${Math.floor(index / PUZZLES_PER_STAGE) + 1}-${(index % PUZZLES_PER_STAGE) + 1}`;
}

/**
 * ソルバー用の盤面。静止した盤面（浮いているパネルも消去中のパネルもない）だけを表す。
 * index = y * COLS + x、y は下から数える。値は柄か EMPTY。
 */
export type Grid = Int8Array;

export function emptyGrid(): Grid {
  return new Int8Array(ROWS * COLS).fill(EMPTY);
}

export function gridAt(g: Grid, x: number, y: number): Kind {
  return g[y * COLS + x];
}

/** 面データの行文字列から盤面を作る。形が崩れていれば例外。 */
export function parseRows(rows: string[]): Grid {
  if (rows.length > ROWS) throw new Error(`rows: ${rows.length} > ${ROWS}`);
  const g = emptyGrid();
  rows.forEach((line, i) => {
    if (line.length !== COLS)
      throw new Error(`row ${i}: "${line}" は ${COLS} 文字でない`);
    const y = rows.length - 1 - i;
    for (let x = 0; x < COLS; x++) {
      const ch = line[x];
      if (ch === ".") continue;
      const k = Number(ch);
      if (!Number.isInteger(k) || k < 0 || k > 5)
        throw new Error(`row ${i}: "${ch}" は柄でない`);
      g[y * COLS + x] = k;
    }
  });
  return g;
}

/** 盤面を行文字列にする。いちばん高いパネルより上の空の行は省く。 */
export function formatRows(g: Grid): string[] {
  let top = -1;
  for (let i = 0; i < g.length; i++)
    if (g[i] !== EMPTY) top = Math.floor(i / COLS);
  const rows: string[] = [];
  for (let y = top; y >= 0; y--) {
    let line = "";
    for (let x = 0; x < COLS; x++) {
      const k = g[y * COLS + x];
      line += k === EMPTY ? "." : String(k);
    }
    rows.push(line);
  }
  return rows;
}

export function panelCount(g: Grid): number {
  let n = 0;
  for (let i = 0; i < g.length; i++) if (g[i] !== EMPTY) n++;
  return n;
}

/** `Board.setColumns` に渡す形（列ごとに下から並べた柄）。盤面が静止していれば各列は下から詰まっている。 */
export function gridColumns(g: Grid): Kind[][] {
  const columns: Kind[][] = [];
  for (let x = 0; x < COLS; x++) {
    const col: Kind[] = [];
    for (let y = 0; y < ROWS; y++) {
      const k = g[y * COLS + x];
      if (k === EMPTY) break;
      col.push(k);
    }
    columns.push(col);
  }
  return columns;
}

/** 同じ盤面かどうかの比較・重複除去に使う文字列。 */
export function gridKey(g: Grid): string {
  let s = "";
  for (let i = 0; i < g.length; i++) s += String.fromCharCode(48 + g[i] + 1);
  return s;
}

/**
 * 柄ごとの枚数が 1 か 2 のものがあると、その柄は二度と揃わないので全消しできない。
 * 探索の枝刈りと、生成した面の検査に使う。
 */
export function hasDeadKind(g: Grid): boolean {
  const count = new Map<Kind, number>();
  for (let i = 0; i < g.length; i++) {
    const k = g[i];
    if (k !== EMPTY) count.set(k, (count.get(k) ?? 0) + 1);
  }
  for (const n of count.values()) if (n < 3) return true;
  return false;
}

/** 下に空きがない（床から詰まっている）パネルのマスを true にする。 */
function groundedMask(g: Grid): Uint8Array {
  const mask = new Uint8Array(g.length);
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      const i = y * COLS + x;
      if (g[i] === EMPTY) break;
      mask[i] = 1;
    }
  }
  return mask;
}

/** 落ちるパネルをすべて落とす。動いたら true。 */
function gravity(g: Grid): boolean {
  let moved = false;
  for (let x = 0; x < COLS; x++) {
    let write = 0;
    for (let y = 0; y < ROWS; y++) {
      const i = y * COLS + x;
      const k = g[i];
      if (k === EMPTY) continue;
      if (y !== write) {
        g[write * COLS + x] = k;
        g[i] = EMPTY;
        moved = true;
      }
      write++;
    }
  }
  return moved;
}

/** 床に着いているパネルの中で、縦横に3つ以上並んだものを集める。並びごとに向きとマスを返す。 */
function matchRuns(
  g: Grid,
  grounded: Uint8Array,
): { dir: "h" | "v"; cells: number[] }[] {
  const runs: { dir: "h" | "v"; cells: number[] }[] = [];
  for (let y = 0; y < ROWS; y++) {
    let x = 0;
    while (x < COLS) {
      const i = y * COLS + x;
      if (!grounded[i]) {
        x++;
        continue;
      }
      const k = g[i];
      let end = x + 1;
      while (end < COLS && grounded[y * COLS + end] && g[y * COLS + end] === k)
        end++;
      if (end - x >= 3) {
        const cells: number[] = [];
        for (let j = x; j < end; j++) cells.push(y * COLS + j);
        runs.push({ dir: "h", cells });
      }
      x = end;
    }
  }
  for (let x = 0; x < COLS; x++) {
    let y = 0;
    while (y < ROWS) {
      const i = y * COLS + x;
      if (!grounded[i]) {
        y++;
        continue;
      }
      const k = g[i];
      let end = y + 1;
      while (end < ROWS && grounded[end * COLS + x] && g[end * COLS + x] === k)
        end++;
      if (end - y >= 3) {
        const cells: number[] = [];
        for (let j = y; j < end; j++) cells.push(j * COLS + x);
        runs.push({ dir: "v", cells });
      }
      y = end;
    }
  }
  return runs;
}

/** 床に着いているパネルの中で、縦横に3つ以上並んだもののマスを集める。 */
function findMatches(g: Grid, grounded: Uint8Array): number[] {
  const hit = new Uint8Array(g.length);
  for (const run of matchRuns(g, grounded))
    for (const i of run.cells) hit[i] = 1;
  const list: number[] = [];
  for (let i = 0; i < g.length; i++) if (hit[i]) list.push(i);
  return list;
}

/**
 * 盤面が静止するまで、揃ったパネルの消去と落下を繰り返す（その場で書き換える）。
 *
 * Board の進行を粗くしたもの。床に着いているパネルだけが揃い、浮いているパネルは落ちてから揃う。
 * 落ちる速さの違いで着地の順が変わる細かい挙動は再現しないので、見つけた解は Board で再生して確かめる（`replayOnBoard`）。
 */
export function resolve(g: Grid): void {
  for (;;) {
    const matched = findMatches(g, groundedMask(g));
    if (matched.length > 0) {
      for (const i of matched) g[i] = EMPTY;
      gravity(g);
      continue;
    }
    if (!gravity(g)) return;
  }
}

/**
 * (x, y) と (x+1, y) を入れ替えて静止するまで進めた盤面を返す。
 * 両方空、または同じ柄で何も変わらない入れ替えは null。
 */
export function swapResolved(g: Grid, x: number, y: number): Grid | null {
  const i = y * COLS + x;
  const a = g[i];
  const b = g[i + 1];
  if (a === b) return null;
  const next = new Int8Array(g);
  next[i] = b;
  next[i + 1] = a;
  resolve(next);
  return next;
}

/**
 * 1手の「技法」。面の解き方の種類を表し、似た面が並ばないように生成時に使う。
 *
 * - H: 横に揃えて消す
 * - V: 縦に揃えて消す
 * - F: 入れ替えた直後は揃わず、パネルが落ちてから揃う
 * - C: 消えた後に落ちたパネルがまた揃う（連鎖）
 * - D: 1回の消去で2つ以上の並びが同時に消える
 * - N: 何も消えない（次の手のための準備）
 */
export type Technique = "H" | "V" | "F" | "C" | "D" | "N";

/** 入れ替えを1手進めながら、その手で起きたことを集める。次の静止盤面も返す（意味のない入れ替えは null）。 */
export function analyzeMove(
  g: Grid,
  m: PuzzleMove,
): { techniques: Set<Technique>; next: Grid } | null {
  const i = m.y * COLS + m.x;
  if (g[i] === g[i + 1]) return null;
  const next = new Int8Array(g);
  next[i] = g[i + 1];
  next[i + 1] = g[i];
  const t = new Set<Technique>();
  // 入れ替え直後（落ちる前）に揃いがなく、落ちてから揃えば「落として揃える」手
  const immediate = matchRuns(next, groundedMask(next)).length > 0;
  let clears = 0;
  for (;;) {
    const runs = matchRuns(next, groundedMask(next));
    if (runs.length > 0) {
      clears++;
      if (clears === 1 && !immediate) t.add("F");
      if (clears >= 2) t.add("C");
      if (runs.length >= 2) t.add("D");
      for (const run of runs) {
        t.add(run.dir === "h" ? "H" : "V");
        for (const j of run.cells) next[j] = EMPTY;
      }
      gravity(next);
      continue;
    }
    if (!gravity(next)) break;
  }
  if (clears === 0) t.add("N");
  return { techniques: t, next };
}

/**
 * 解の手順を「技法の並び」にする。手ごとに技法を H/V/F/C/D/N の順に並べ、手の間は "-" で区切る。
 * 例: "H" は横1手、"FV-H" は落として縦に消してから横1手。
 * 2手以上で、手順を逆にしても全消しになるなら末尾に "" を、ならなければ "!"（順番が決まる面）を付ける。
 */
export function solutionSignature(start: Grid, moves: PuzzleMove[]): string {
  const order: Technique[] = ["H", "V", "F", "C", "D", "N"];
  let g: Grid = start;
  const parts: string[] = [];
  for (const m of moves) {
    const r = analyzeMove(g, m);
    if (!r) return "?";
    parts.push(order.filter((k) => r.techniques.has(k)).join(""));
    g = r.next;
  }
  let sig = parts.join("-");
  if (moves.length >= 2) {
    let h: Grid | null = start;
    for (const m of [...moves].reverse()) {
      h = h ? swapResolved(h, m.x, m.y) : null;
    }
    if (!h || panelCount(h) !== 0) sig += "!";
  }
  return sig;
}

/** 静止した盤面で意味のある入れ替えを列挙する（上の空の段は飛ばす）。 */
function* candidateMoves(g: Grid): Generator<PuzzleMove> {
  let top = 0;
  for (let i = 0; i < g.length; i++)
    if (g[i] !== EMPTY) top = Math.floor(i / COLS);
  for (let y = 0; y <= top; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      const i = y * COLS + x;
      if (g[i] !== g[i + 1]) yield { x, y };
    }
  }
}

export interface SolveOptions {
  /**
   * 広げる盤面の数の上限。超えたら打ち切って null を返す（解なしと区別しない）。
   * 生成時に、探索が重すぎる面を捨てるために使う。
   */
  maxStates?: number;
}

/**
 * 全消しできる最短の手順を maxMoves 手まで探す。見つからなければ null。
 * 静止盤面の幅優先探索。同じ盤面は一度しか広げず、揃わない柄が残った盤面は捨てる。
 */
export function solve(
  start: Grid,
  maxMoves: number,
  opts: SolveOptions = {},
): PuzzleMove[] | null {
  if (panelCount(start) === 0) return [];
  if (hasDeadKind(start)) return null;
  const maxStates = opts.maxStates ?? Number.POSITIVE_INFINITY;
  interface Node {
    g: Grid;
    parent: Node | null;
    move: PuzzleMove | null;
  }
  const visited = new Set<string>([gridKey(start)]);
  let frontier: Node[] = [{ g: start, parent: null, move: null }];
  const pathOf = (n: Node, last: PuzzleMove): PuzzleMove[] => {
    const path: PuzzleMove[] = [last];
    for (let cur: Node | null = n; cur && cur.move; cur = cur.parent)
      path.push(cur.move);
    return path.reverse();
  };
  for (let depth = 1; depth <= maxMoves; depth++) {
    const next: Node[] = [];
    for (const node of frontier) {
      for (const m of candidateMoves(node.g)) {
        const r = swapResolved(node.g, m.x, m.y);
        if (!r) continue;
        if (panelCount(r) === 0) return pathOf(node, m);
        if (depth === maxMoves || hasDeadKind(r)) continue;
        const k = gridKey(r);
        if (visited.has(k)) continue;
        visited.add(k);
        if (visited.size > maxStates) return null;
        next.push({ g: r, parent: node, move: m });
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}

/**
 * ちょうど moves 手で全消しする手順の数（cap で打ち切る）。面の一意性の目安にする。
 * 途中で全消しした手順は数えない（それは短い解として別に扱う）。
 */
export function countSolutions(
  start: Grid,
  moves: number,
  cap = 100,
  opts: SolveOptions = {},
): number {
  const maxStates = opts.maxStates ?? Number.POSITIVE_INFINITY;
  const memo = new Map<string, number>();
  const rec = (g: Grid, left: number): number => {
    if (left === 0) return panelCount(g) === 0 ? 1 : 0;
    if (panelCount(g) === 0 || hasDeadKind(g)) return 0;
    const key = `${left}:${gridKey(g)}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let n = 0;
    for (const m of candidateMoves(g)) {
      const r = swapResolved(g, m.x, m.y);
      if (!r) continue;
      n += rec(r, left - 1);
      if (n >= cap || memo.size > maxStates) break;
    }
    memo.set(key, n);
    return n;
  };
  return rec(start, moves);
}

export function formatSolution(moves: PuzzleMove[]): string {
  return moves.map((m) => `${m.x},${m.y}`).join(" ");
}

export function parseSolution(s: string): PuzzleMove[] {
  if (!s.trim()) return [];
  return s
    .trim()
    .split(/\s+/)
    .map((t) => {
      const [x, y] = t.split(",").map(Number);
      return { x, y };
    });
}

/** パズル用の Board を作って面を置く。 */
export function boardForStage(stage: PuzzleStage, seed = 0): Board {
  const g = parseRows(stage.rows);
  const board = new Board({
    seed,
    kinds: 5,
    initialHeight: 0,
    moveLimit: stage.moves,
  });
  board.setColumns(gridColumns(g));
  // カーソルは面の高さの範囲に置く
  board.cursor.x = 2;
  board.cursor.y = Math.max(0, Math.min(5, stage.rows.length - 1));
  return board;
}

/** 静止した Board からソルバー用の盤面を作る。ROWS より上のパネルは持たない（パズルにはない）。 */
export function gridFromBoard(board: Board): Grid {
  const g = emptyGrid();
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) g[y * COLS + x] = board.cell(x, y).kind;
  return g;
}

/** 盤面が静止するまで進める。上限を超えたら false。 */
export function settle(board: Board, maxFrames = 3000): boolean {
  for (let i = 0; i < maxFrames; i++) {
    if (board.isSettled()) return true;
    board.tick(NO_INPUT);
  }
  return board.isSettled();
}

/**
 * 手順を本物の Board で再生し、全消しになれば true。
 * ソルバーの粗い進行と Board の実際の進行がずれていないことをここで確かめる。
 */
export function replayOnBoard(
  stage: PuzzleStage,
  moves: PuzzleMove[],
): boolean {
  const board = boardForStage(stage);
  for (const m of moves) {
    if (!settle(board)) return false;
    board.tick({ ...NO_INPUT, cursorTo: { x: m.x, y: m.y }, swap: true });
  }
  if (!settle(board)) return false;
  return board.panelCount() === 0;
}
