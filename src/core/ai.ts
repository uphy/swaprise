import { Board } from "./board";
import { COLS, ROWS } from "./constants";
import { EMPTY, NO_INPUT, type Input } from "./types";

export type CpuLevel = "easy" | "normal" | "hard";

interface CpuParams {
  /** 次の手を考え始めるまでの待ち（フレーム）。 */
  thinkDelay: number;
  /** カーソルを1マス動かす間隔（フレーム）。 */
  moveInterval: number;
  /** 読みの深さ。1回の消しに使う入れ替えの上限。 */
  depth: number;
  /** 消したあとの連鎖・消去中のアクティブ連鎖を読むか。 */
  lookahead: boolean;
  /** 打つ手があっても、盤面の最大高さがこれ未満なら手動せり上げで材料を増やす。 */
  raiseBelow: number;
  /** 消去中に、消えたあとの盤面を見て仕込むアクティブ連鎖の手数の上限。0 なら1手だけ。 */
  activeDepth: number;
  /** 危険（盤面が高い）ときの思考待ち（フレーム）。thinkDelay がこれより大きくても、危険時はこちらを使う。 */
  dangerWait: number;
}

/**
 * 難易度ごとの手加減。以前の easy を normal、normal を hard に繰り下げ、easy はさらに遅くした
 * （カーソル移動が初心者には速すぎ、盤面が高くなる危険時だけ思考6Fまで機敏になる保険が常時効いていたため、
 * thinkDelay をどれだけ緩めても casual 相手の平均勝ち時間が193秒のままだった。dangerWait でこの保険を
 * 難易度ごとに変えられるようにし、easy だけ危険時も鈍いままにした。あわせて raiseBelow を上げ、
 * easy 自身が積極的に手動せり上げして自分の首を絞めるようにしたところ、casual 相手の平均勝ち時間が
 * 77秒・勝率95%まで縮んだ）。
 * hard の思考・移動間隔は繰り下げた以前の normal のものだが、lookahead と activeDepth は
 * 以前の hard の値のまま残し、消去中に次の連鎖を仕込む動きは引き続き hard だけができるようにした。
 */
export const CPU_PARAMS: Record<CpuLevel, CpuParams> = {
  easy: { thinkDelay: 90, moveInterval: 28, depth: 1, lookahead: false, raiseBelow: 8, activeDepth: 0, dangerWait: 90 },
  normal: { thinkDelay: 100, moveInterval: 16, depth: 1, lookahead: false, raiseBelow: 2, activeDepth: 0, dangerWait: 6 },
  hard: { thinkDelay: 50, moveInterval: 10, depth: 2, lookahead: true, raiseBelow: 3, activeDepth: 2, dangerWait: 6 },
};

/** 評価用の盤面。柄は 0 以上、空は EMPTY、動けないもの（入れ替え・落下中）は BLOCK、おじゃまは GARBAGE、消去中は CLEARING。 */
const BLOCK = -2;
const GARBAGE = -3;
const CLEARING = -4;
type Grid = number[][];

/** (x, y) と (x+1, y) の入れ替え。 */
interface Swap {
  x: number;
  y: number;
}

interface Cell {
  x: number;
  y: number;
}

/** 候補手。swaps を順に打つと消える（はず）。 */
interface Plan {
  swaps: Swap[];
  score: number;
}

/** 1回の思考で実際にシミュレーションする多手の候補数の上限。 */
const SIMULATE_LIMIT = 24;
/** 普段の読みで手が見つからないときに、代わりに読む深さ。どの難易度でも止まらないための保険。 */
const FALLBACK_DEPTH = 8;
/** 直前に入れ替えた場所をすぐ戻さないための猶予（フレーム）。 */
const NO_UNDO_FRAMES = 90;

function snapshot(board: Board): Grid {
  const g: Grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < COLS; c++) {
      const cell = board.cells[r][c];
      if (cell.garbage >= 0) row.push(GARBAGE);
      else if (cell.kind === EMPTY) row.push(EMPTY);
      else if (cell.state === "idle") row.push(cell.kind);
      else if (cell.state === "matched" || cell.state === "popped") row.push(CLEARING);
      else row.push(BLOCK);
    }
    g.push(row);
  }
  return g;
}

function clone(g: Grid): Grid {
  return g.map((row) => row.slice());
}

function hasClearing(g: Grid): boolean {
  return g.some((row) => row.includes(CLEARING));
}

/** 柄のパネルだけを落とす。BLOCK とおじゃまは動かない。 */
function settle(g: Grid, cols: number[]): void {
  for (const c of cols) {
    let moved = true;
    while (moved) {
      moved = false;
      for (let r = 1; r < ROWS; r++) {
        if (g[r][c] >= 0 && g[r - 1][c] === EMPTY) {
          g[r - 1][c] = g[r][c];
          g[r][c] = EMPTY;
          moved = true;
        }
      }
    }
  }
}

/**
 * 消去中のパネルが消えたあとの盤面を作る。消えたパネルの上に乗っていたパネル（＝落ちて連鎖フラグが付くもの）を
 * flags に記録しながら落とす。アクティブ連鎖の読みに使う。
 */
function futureAfterClear(g: Grid): { grid: Grid; flags: boolean[][] } {
  const grid = clone(g);
  const flags: boolean[][] = grid.map((row) => row.map(() => false));
  for (let c = 0; c < COLS; c++) {
    let above = false;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c] === CLEARING) {
        grid[r][c] = EMPTY;
        above = true;
      } else if (above && grid[r][c] >= 0) {
        flags[r][c] = true;
      } else if (grid[r][c] === EMPTY || grid[r][c] === GARBAGE || grid[r][c] === BLOCK) {
        above = false;
      }
    }
    let moved = true;
    while (moved) {
      moved = false;
      for (let r = 1; r < ROWS; r++) {
        if (grid[r][c] >= 0 && grid[r - 1][c] === EMPTY) {
          grid[r - 1][c] = grid[r][c];
          grid[r][c] = EMPTY;
          flags[r - 1][c] = flags[r][c];
          flags[r][c] = false;
          moved = true;
        }
      }
    }
  }
  return { grid, flags };
}

/** 揃っているマスの一覧。 */
function findMatches(g: Grid): Cell[] {
  const set = new Set<number>();
  for (let y = 0; y < ROWS; y++) {
    let x = 0;
    while (x < COLS) {
      const k = g[y][x];
      if (k < 0) {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < COLS && g[y][end] === k) end++;
      if (end - x >= 3) for (let i = x; i < end; i++) set.add(y * COLS + i);
      x = end;
    }
  }
  for (let x = 0; x < COLS; x++) {
    let y = 0;
    while (y < ROWS) {
      const k = g[y][x];
      if (k < 0) {
        y++;
        continue;
      }
      let end = y + 1;
      while (end < ROWS && g[end][x] === k) end++;
      if (end - y >= 3) for (let i = y; i < end; i++) set.add(i * COLS + x);
      y = end;
    }
  }
  return [...set].map((k) => ({ x: k % COLS, y: Math.floor(k / COLS) }));
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function touchesGarbage(g: Grid, cells: Cell[]): boolean {
  for (const { x, y } of cells) {
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (g[ny][nx] === GARBAGE) return true;
    }
  }
  return false;
}

function hasGarbage(g: Grid): boolean {
  return g.some((row) => row.includes(GARBAGE));
}

function maxHeight(board: Board): number {
  let h = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = ROWS - 1; r >= 0; r--) {
      const cell = board.cells[r][c];
      if (cell.kind !== EMPTY || cell.garbage >= 0) {
        h = Math.max(h, r + 1);
        break;
      }
    }
  }
  return h;
}

// ------------------------------------------------------------------ 経路

/** パネルをこのマスへ動かせるか。柄のパネルか、支えのある空マス。 */
function passable(g: Grid, x: number, y: number): boolean {
  const v = g[y][x];
  if (v >= 0) return true;
  if (v !== EMPTY) return false;
  return y === 0 || g[y - 1][x] !== EMPTY;
}

/** 列 x の行 fromY から落としたとき止まる行。 */
function landingRow(g: Grid, x: number, fromY: number): number {
  let r = fromY;
  while (r > 0 && g[r - 1][x] === EMPTY) r--;
  return r;
}

/**
 * 行 y の列 sx にある柄 kind のパネルを列 tx まで横に運ぶ入れ替え列。
 * 同じ柄のパネルを跨ぐときは入れ替え不要（どちらを運んでも同じ）。届かなければ null。
 */
function rowPath(g: Grid, kind: number, sx: number, y: number, tx: number): Swap[] | null {
  const swaps: Swap[] = [];
  const dir = Math.sign(tx - sx);
  for (let c = sx; c !== tx; c += dir) {
    const n = c + dir;
    if (!passable(g, n, y)) return null;
    if (g[y][n] !== kind) swaps.push({ x: Math.min(c, n), y });
  }
  return swaps;
}

/**
 * (sx, sy) の柄 kind のパネルを、行 sy を横に動かして列 d の穴に落とし、行 ty で列 tx まで運ぶ入れ替え列。
 * 左右どちらに動かすかは短いほう。届かなければ null。
 */
function dropPath(g: Grid, kind: number, sx: number, sy: number, tx: number, ty: number): Swap[] | null {
  let best: Swap[] | null = null;
  for (const dir of [-1, 1]) {
    const swaps: Swap[] = [];
    for (let c = sx + dir; c >= 0 && c < COLS; c += dir) {
      const v = g[sy][c];
      if (v !== EMPTY && v < 0) break;
      if (v !== kind) swaps.push({ x: Math.min(c - dir, c), y: sy });
      if (v !== EMPTY) continue;
      const land = landingRow(g, c, sy);
      if (land === ty) {
        const rest = rowPath(g, kind, c, ty, tx);
        if (rest && (!best || swaps.length + rest.length < best.length)) best = [...swaps, ...rest];
      }
      if (land < sy) break;
    }
  }
  return best;
}

function pathTo(g: Grid, kind: number, sx: number, sy: number, tx: number, ty: number): Swap[] | null {
  if (ty === sy) return rowPath(g, kind, sx, sy, tx);
  if (ty < sy) return dropPath(g, kind, sx, sy, tx, ty);
  return null;
}

interface Source {
  x: number;
  y: number;
}

/** 目標マスごとの経路（ソース × 目標）。 */
type Route = { source: Source; target: Cell; swaps: Swap[] };

/**
 * 複数の経路を、互いに邪魔しない順に並べる。
 * 右へ動くものは目標が右のものから、左へ動くものは目標が左のものから打つと、運ぶパネル同士が交差しない。
 */
function orderRoutes(routes: Route[]): Swap[] {
  const right = routes.filter((r) => r.target.x > r.source.x).sort((a, b) => b.target.x - a.target.x);
  const left = routes.filter((r) => r.target.x < r.source.x).sort((a, b) => a.target.x - b.target.x);
  const stay = routes.filter((r) => r.target.x === r.source.x);
  return [...right, ...left, ...stay].flatMap((r) => r.swaps);
}

/** 柄ごとの、盤面上の idle パネルの位置。 */
function panelsByKind(g: Grid): Map<number, Source[]> {
  const m = new Map<number, Source[]>();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const k = g[y][x];
      if (k < 0) continue;
      let list = m.get(k);
      if (!list) m.set(k, (list = []));
      list.push({ x, y });
    }
  }
  return m;
}

interface Candidate {
  swaps: Swap[];
  cost: number;
}

/**
 * 横3つ・縦3つを揃える手順の候補を、入れ替え回数が depth 以下のものに限って列挙する。
 * 経路は元の盤面で計算した見積もりなので、採用前に simulate で確かめる。
 */
function enumerateGoals(g: Grid, depth: number): Candidate[] {
  const out: Candidate[] = [];
  const byKind = panelsByKind(g);
  for (const [kind, panels] of byKind) {
    if (panels.length < 3) continue;
    // 横: 行 y の列 t..t+2
    for (let y = 0; y < ROWS; y++) {
      if (!passable(g, 0, y) && !passable(g, 1, y) && !passable(g, 2, y) && !passable(g, 3, y)) continue;
      const sources = panels.filter((p) => p.y >= y);
      if (sources.length < 3) continue;
      // ソースごとの、この行の各列への経路
      const routes = sources.map((s) => {
        const r: (Swap[] | null)[] = [];
        for (let tx = 0; tx < COLS; tx++) {
          const p = pathTo(g, kind, s.x, s.y, tx, y);
          r.push(p && p.length <= depth ? p : null);
        }
        return r;
      });
      for (let t = 0; t + 2 < COLS; t++) {
        if (!passable(g, t, y) || !passable(g, t + 1, y) || !passable(g, t + 2, y)) continue;
        let best: Route[] | null = null;
        let bestCost = depth + 1;
        const n = sources.length;
        for (let i = 0; i < n; i++) {
          const pi = routes[i][t];
          if (!pi || pi.length >= bestCost) continue;
          for (let j = i + 1; j < n; j++) {
            const pj = routes[j][t + 1];
            if (!pj || pi.length + pj.length >= bestCost) continue;
            for (let l = j + 1; l < n; l++) {
              const pl = routes[l][t + 2];
              if (!pl) continue;
              const cost = pi.length + pj.length + pl.length;
              if (cost >= bestCost) continue;
              bestCost = cost;
              best = [
                { source: sources[i], target: { x: t, y }, swaps: pi },
                { source: sources[j], target: { x: t + 1, y }, swaps: pj },
                { source: sources[l], target: { x: t + 2, y }, swaps: pl },
              ];
            }
          }
        }
        if (best && bestCost >= 2) out.push({ swaps: orderRoutes(best), cost: bestCost });
      }
    }
    // 縦: 列 x の行 y..y+2
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y + 2 < ROWS; y++) {
        if (!passable(g, x, y)) continue;
        const routes: Route[] = [];
        const used = new Set<Source>();
        let cost = 0;
        for (let i = 0; i < 3 && cost <= depth; i++) {
          const ty = y + i;
          let bestSwaps: Swap[] | null = null;
          let bestSource: Source | null = null;
          for (const s of panels) {
            if (s.y < ty || used.has(s)) continue;
            const p = pathTo(g, kind, s.x, s.y, x, ty);
            if (p && (!bestSwaps || p.length < bestSwaps.length)) {
              bestSwaps = p;
              bestSource = s;
            }
          }
          if (!bestSwaps || !bestSource) {
            cost = depth + 1;
            break;
          }
          used.add(bestSource);
          cost += bestSwaps.length;
          routes.push({ source: bestSource, target: { x, y: ty }, swaps: bestSwaps });
        }
        if (cost >= 2 && cost <= depth) out.push({ swaps: routes.flatMap((r) => r.swaps), cost });
      }
    }
  }
  return out;
}

/** 入れ替え列を盤面に適用し、揃った時点で止める。揃わない・打てない手が含まれるなら null。 */
function simulate(g: Grid, swaps: Swap[]): { grid: Grid; matched: Cell[]; used: number } | null {
  const sim = clone(g);
  for (let i = 0; i < swaps.length; i++) {
    if (!applySwap(sim, swaps[i])) return null;
    const matched = findMatches(sim);
    if (matched.length > 0) return { grid: sim, matched, used: i + 1 };
  }
  return null;
}

/** 入れ替え列を全部適用する。途中で揃ってしまう・打てない手が含まれるなら null。 */
function simulateAll(g: Grid, swaps: Swap[]): Grid | null {
  const sim = clone(g);
  for (const s of swaps) {
    if (!applySwap(sim, s)) return null;
    if (findMatches(sim).length > 0) return null;
  }
  return sim;
}

/** 1回の入れ替えを盤面に適用して落とす。打てない手なら false。 */
function applySwap(sim: Grid, { x, y }: Swap): boolean {
  const a = sim[y][x];
  const c = sim[y][x + 1];
  if (a < EMPTY || c < EMPTY) return false;
  if (a === EMPTY && c === EMPTY) return false;
  if (a === c) return false;
  sim[y][x] = c;
  sim[y][x + 1] = a;
  settle(sim, [x, x + 1]);
  return true;
}

/** 消去中のパネルが全部消えるまでのフレーム数。消去中でなければ 0。 */
function framesUntilCleared(board: Board): number {
  let max = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board.cells[r][c];
      if (cell.state === "matched" || cell.state === "popped") max = Math.max(max, cell.removeAt);
    }
  }
  return max;
}

/**
 * CPU プレイヤー。Board を読んで1フレーム分の Input を返す。
 * カーソルは人と同じく1マスずつ動かし、入れ替えもカーソル位置でしか行わない。
 *
 * 手の探し方:
 * 1. 1回の入れ替えで揃う手（消去中ならアクティブ連鎖になる手も）
 * 2. 横3つ・縦3つを目標に、パネルを運ぶ・穴に落とす手順を depth 手まで読む
 * 3. 消去中は、消えたあとの盤面を目標に同じ読みをして、落ちてくるパネルで揃う手順（アクティブ連鎖）を仕込む
 * それぞれ「消える枚数・連鎖・おじゃま隣接」で価値を付け、手数ぶんを引いて最も良い手順の最初の1手を打つ。
 * 打つ手がなければ、危険でない限り手動せり上げで材料を増やす。
 */
export class CpuPlayer {
  private readonly p: CpuParams;
  private target: Swap | null = null;
  /** いま実行中の手順の、次の1手以降。 */
  private pending: Swap[] = [];
  private wait: number;
  private moveTimer = 0;
  private raising = false;
  private lastSwap: { x: number; y: number; frame: number } | null = null;
  /** 仕込んだアクティブ連鎖で揃う予定のマス（消去後の位置）。消去中はこれを壊す手を打たない。 */
  private plan: Cell[] | null = null;
  private lastRise = 0;

  constructor(
    private readonly board: Board,
    readonly level: CpuLevel,
  ) {
    // 値をコピーして持つ。CPU_PARAMS[level] への参照のままだと、casualPlayer（tools/sim/proxy.ts）が
    // CPU_PARAMS.easy を一時的に書き換えて戻すトリックをしたときに、生成後の書き戻しが this.p にも及んでしまう。
    this.p = { ...CPU_PARAMS[level] };
    this.wait = this.p.thinkDelay;
  }

  next(): Input {
    const b = this.board;
    if (b.gameOver) return NO_INPUT;
    // せり上がりで盤面が1段上がったら、狙っている位置も1段上げる
    if (b.riseProgress < this.lastRise) this.shiftUp();
    this.lastRise = b.riseProgress;
    const danger = maxHeight(b) >= ROWS - 3;

    if (this.target) {
      const { x, y } = this.target;
      if (b.cursor.x === x && b.cursor.y === y) {
        this.target = null;
        this.wait = danger ? Math.min(this.p.thinkDelay, this.p.dangerWait) : this.p.thinkDelay;
        this.lastSwap = { x, y, frame: b.frame };
        return { ...NO_INPUT, swap: true };
      }
      if (++this.moveTimer < this.p.moveInterval) return NO_INPUT;
      this.moveTimer = 0;
      return {
        ...NO_INPUT,
        moveX: Math.sign(x - b.cursor.x) as -1 | 0 | 1,
        moveY: Math.sign(y - b.cursor.y) as -1 | 0 | 1,
      };
    }

    if (this.wait > 0) {
      this.wait--;
      return { ...NO_INPUT, raise: this.raising && !danger };
    }

    // 普段の読みで手がなければ、深く読み直す（止まったままにならないための保険）
    const best = this.pickMove(danger, this.p.depth) ?? (this.p.depth < FALLBACK_DEPTH ? this.pickMove(danger, FALLBACK_DEPTH) : null);
    if (best) {
      this.target = best.swaps[0];
      this.pending = best.swaps.slice(1);
      this.raising = !danger && maxHeight(b) < this.p.raiseBelow;
      this.moveTimer = this.p.moveInterval;
      return this.next();
    }

    // 打つ手がないときは、天井まで余裕があればせり上げて材料を増やす
    this.pending = [];
    this.raising = maxHeight(b) < ROWS - 4;
    this.wait = Math.max(4, Math.floor(this.p.thinkDelay / 2));
    return { ...NO_INPUT, raise: this.raising };
  }

  private shiftUp(): void {
    if (this.target) {
      this.target = { x: this.target.x, y: this.target.y + 1 };
      if (this.target.y >= ROWS) {
        this.target = null;
        this.pending = [];
      }
    }
    this.pending = this.pending.map((s) => ({ x: s.x, y: s.y + 1 }));
    if (this.pending.some((s) => s.y >= ROWS)) this.pending = [];
  }

  /** 候補を集めて最も良い手順を返す。depth は多手の読みに使う入れ替え回数の上限。 */
  private pickMove(danger: boolean, depth: number): Plan | null {
    const b = this.board;
    const g = snapshot(b);
    const clearing = hasClearing(g);
    if (!clearing) this.plan = null;
    const garbage = hasGarbage(g);
    let best: Plan | null = null;
    let bestPlan: Cell[] | null = null;

    const consider = (swaps: Swap[], score: number, activePlan: Cell[] | null): void => {
      const first = swaps[0];
      // 直前に入れ替えた場所をすぐ戻さない
      if (this.lastSwap && this.lastSwap.x === first.x && this.lastSwap.y === first.y && b.frame - this.lastSwap.frame < NO_UNDO_FRAMES) return;
      // 近い手を少し優先
      score -= (Math.abs(first.x - b.cursor.x) + Math.abs(first.y - b.cursor.y)) * 0.5;
      if (!best || score > best.score) {
        best = { swaps, score };
        bestPlan = activePlan;
      }
    };

    /** 揃った盤面の価値。 */
    const value = (sim: Grid, matched: Cell[]): number => {
      let v = 100 * matched.length + (matched.length >= 4 ? 120 : 0);
      if (garbage && touchesGarbage(sim, matched)) v += 150;
      let top = 0;
      for (const m of matched) top = Math.max(top, m.y);
      if (danger) {
        // 危険なときは連鎖より、高い位置を早く崩すことを優先する
        v += top * 15;
      } else if (this.p.lookahead) {
        const after = clone(sim);
        for (const m of matched) after[m.y][m.x] = EMPTY;
        settle(after, [...new Set(matched.map((m) => m.x))]);
        const chain = findMatches(after);
        if (chain.length > 0) v += 60 * chain.length + 100;
        // 低い位置から片付けるほうが上に積める
        v += (ROWS - top) * 0.3;
      }
      return v;
    };
    const costWeight = danger ? 45 : 30;

    // 1. 1回の入れ替えで揃う手・アクティブ連鎖
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS - 1; x++) {
        const a = g[y][x];
        const c = g[y][x + 1];
        if (a < EMPTY || c < EMPTY) continue;
        if (a === EMPTY && c === EMPTY) continue;
        if (a === c) continue;
        const sim = clone(g);
        sim[y][x] = c;
        sim[y][x + 1] = a;
        settle(sim, [x, x + 1]);
        const matched = findMatches(sim);
        let activeChain = 0;
        let futMatched: Cell[] = [];
        if (this.p.lookahead && clearing) {
          const fut = futureAfterClear(sim);
          futMatched = findMatches(fut.grid);
          // 仕込み済みの連鎖を壊す手は打たない
          if (!this.keepsPlan(futMatched)) continue;
          if (matched.length === 0 && futMatched.some((m) => fut.flags[m.y][m.x])) activeChain = futMatched.length;
        }
        if (activeChain > 0) {
          // 連鎖を伸ばす手は、同程度の同時消しより優先する。連鎖が伸びているほど価値が高い
          consider([{ x, y }], 180 * activeChain + 120 + 40 * Math.min(6, b.chain) - costWeight, futMatched);
        } else if (matched.length > 0) {
          consider([{ x, y }], value(sim, matched) - costWeight, null);
        }
      }
    }

    // 2. 実行中の手順の続き。まだ成立するなら少し優先する
    const candidates: Candidate[] = [];
    if (this.pending.length > 0) candidates.push({ swaps: this.pending, cost: this.pending.length - 0.5 });
    // 3. 多手の手順
    if (depth >= 2) candidates.push(...enumerateGoals(g, depth));
    candidates.sort((a, b2) => a.cost - b2.cost);
    let simulated = 0;
    for (const cand of candidates) {
      if (simulated++ >= SIMULATE_LIMIT) break;
      const result = simulate(g, cand.swaps);
      if (!result) continue;
      const swaps = cand.swaps.slice(0, result.used);
      if (this.p.lookahead && clearing && this.plan) {
        // 仕込み済みの連鎖を最初の1手で壊さない
        const first = clone(g);
        applySwap(first, swaps[0]);
        if (!this.keepsPlan(findMatches(futureAfterClear(first).grid))) continue;
      }
      consider(swaps, value(result.grid, result.matched) - costWeight * swaps.length, null);
    }

    // 4. 消去中なら、消えたあとの盤面を目標にした多手のアクティブ連鎖。消え終わるまでに打ち切れる手数に限る
    if (this.p.lookahead && clearing && this.p.activeDepth >= 2) {
      const perSwap = this.p.thinkDelay + this.p.moveInterval * 3;
      const budget = Math.min(this.p.activeDepth, Math.floor(framesUntilCleared(b) / perSwap));
      if (budget >= 2) {
        const goals = enumerateGoals(futureAfterClear(g).grid, budget).sort((a, b2) => a.cost - b2.cost);
        let n = 0;
        for (const cand of goals) {
          if (n++ >= SIMULATE_LIMIT) break;
          // 今の盤面で打てて途中で揃わず、消えたあとに落ちたパネルを含んで揃う手順だけ
          const now = simulateAll(g, cand.swaps);
          if (!now) continue;
          const fut = futureAfterClear(now);
          const futMatched = findMatches(fut.grid);
          if (!futMatched.some((m) => fut.flags[m.y][m.x])) continue;
          if (!this.keepsPlan(futMatched)) continue;
          consider(cand.swaps, 180 * futMatched.length + 120 + 40 * Math.min(6, b.chain) - costWeight * cand.swaps.length, futMatched);
        }
      }
    }

    // 5. それでも無いとき: パネルを1枚穴へ動かして足場や落とし先を作ってから、改めて読む
    if (!best && depth >= FALLBACK_DEPTH) {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS - 1; x++) {
          const a = g[y][x];
          const c = g[y][x + 1];
          if ((a === EMPTY) === (c === EMPTY) || a < EMPTY || c < EMPTY) continue;
          const after = clone(g);
          applySwap(after, { x, y });
          if (findMatches(after).length > 0) continue;
          const goals = enumerateGoals(after, depth - 1).sort((p1, p2) => p1.cost - p2.cost);
          for (const cand of goals.slice(0, 4)) {
            const swaps = [{ x, y }, ...cand.swaps];
            const result = simulate(g, swaps);
            if (!result) continue;
            consider(swaps.slice(0, result.used), value(result.grid, result.matched) - costWeight * result.used, null);
          }
        }
      }
    }

    if (bestPlan) this.plan = bestPlan;
    return best;
  }

  private keepsPlan(futMatched: Cell[]): boolean {
    if (!this.plan) return true;
    return this.plan.every((q) => futMatched.some((m) => m.x === q.x && m.y === q.y));
  }
}
