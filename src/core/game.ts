import { CpuPlayer, type CpuLevel } from "./ai";
import { Board } from "./board";
import { DEFAULT_SHOCK_MAX, TIME_ATTACK_FRAMES } from "./constants";
import { boardForStage, type PuzzleStage } from "./puzzle";
import { PUZZLES } from "./puzzles";
import type { BoardOptions, Input } from "./types";
import { NO_INPUT } from "./types";

/**
 * endless: 1人用。timeattack: 1人用で制限時間内の得点を競う。
 * versus: 2人対戦。cpu: 2P側を CpuPlayer が操作する対戦。
 * puzzle: 1人用。せり上がりのない面を決められた手数で全部消す。
 */
export type GameMode = "endless" | "timeattack" | "versus" | "cpu" | "puzzle";

export interface GameOptions {
  mode: GameMode;
  seed: number;
  kinds?: number;
  speedLevel?: number;
  cpuLevel?: CpuLevel;
  /** 対戦でのビックリパネルの上限枚数。省略時は DEFAULT_SHOCK_MAX、0 で出さない。 */
  shockMax?: number;
  /** タイムアタックの制限時間（フレーム）。省略時は TIME_ATTACK_FRAMES。 */
  timeLimitFrames?: number;
  /** パズルの面（0 始まりの通し番号）。省略時は 0。 */
  stage?: number;
  /** パズルの面データを直接渡す（テスト用）。stage より優先。 */
  puzzle?: PuzzleStage;
}

/**
 * 1人用・2人対戦をまとめる。対戦では攻撃を相手の盤面へ回す。
 */
export class Game {
  readonly mode: GameMode;
  readonly boards: Board[];
  readonly cpu: CpuPlayer | null = null;
  /** 対戦の勝者（0 or 1）。未決着は -1。 */
  winner = -1;
  finished = false;
  /** タイムアタックの制限時間（フレーム）。他のモードは null。 */
  readonly timeLimit: number | null;
  /** タイムアタックで時間切れになったか。天井に届いて終わったときは false。 */
  timeUp = false;
  /** パズルの面（0 始まり）。他のモードは -1。 */
  readonly stage: number;
  /** パズルの面データ。他のモードは null。 */
  readonly puzzle: PuzzleStage | null;
  /** パズルの結果。clear は全消し、fail は手数を使い切ってパネルが残った。 */
  puzzleResult: "clear" | "fail" | null = null;

  constructor(opts: GameOptions) {
    this.mode = opts.mode;
    this.timeLimit = opts.mode === "timeattack" ? (opts.timeLimitFrames ?? TIME_ATTACK_FRAMES) : null;
    this.stage = opts.mode === "puzzle" ? Math.max(0, Math.min(PUZZLES.length - 1, opts.stage ?? 0)) : -1;
    this.puzzle = opts.mode === "puzzle" ? (opts.puzzle ?? PUZZLES[this.stage]) : null;
    if (this.puzzle) {
      this.boards = [boardForStage(this.puzzle, opts.seed)];
      return;
    }
    // パズル以外はどのモードもスピードレベルが上がる（消した枚数と経過時間の高い方）
    const common: Omit<BoardOptions, "seed"> = {
      kinds: opts.kinds,
      speedLevel: opts.speedLevel,
      speedUp: true,
    };
    if (opts.mode === "endless" || opts.mode === "timeattack") {
      this.boards = [new Board({ ...common, seed: opts.seed })];
    } else {
      const shockMax = opts.shockMax ?? DEFAULT_SHOCK_MAX;
      // 対戦は原作どおり2人が同じ初期盤面から始める。seed を揃えると初期配置と次の行が一致し、
      // その後は互いの盤面の違いに応じて乱数の消費がずれていく
      this.boards = [
        new Board({ ...common, seed: opts.seed, shockMax }),
        new Board({ ...common, seed: opts.seed, shockMax }),
      ];
      if (opts.mode === "cpu") this.cpu = new CpuPlayer(this.boards[1], opts.cpuLevel ?? "normal");
    }
  }

  /** オンラインの表示予測だけで使用する。確定側から表示側へ複製する。 */
  copyVersusFrom(source: Game): void {
    if (this.mode !== "versus" || source.mode !== "versus") throw new Error("対戦専用です");
    this.boards.forEach((board, i) => board.copyFrom(source.boards[i]));
    this.winner = source.winner;
    this.finished = source.finished;
  }

  tick(inputs: Input[]): void {
    if (this.finished) return;
    const resolved = this.boards.map((_, i) => inputs[i] ?? NO_INPUT);
    if (this.cpu) resolved[1] = this.cpu.next();
    this.boards.forEach((b, i) => b.tick(resolved[i]));
    if (this.boards.length === 2) {
      const [a, b] = this.boards;
      // 対戦では2つの盤面のスピードを同じにする。多く消した側に合わせて両方が速くなる
      const lv = Math.max(a.level, b.level);
      a.raiseLevel(lv);
      b.raiseLevel(lv);
      if (a.attacksOut.length) b.receiveGarbage(a.attacksOut);
      if (b.attacksOut.length) a.receiveGarbage(b.attacksOut);
      if (a.gameOver || b.gameOver) {
        this.finished = true;
        this.winner = a.gameOver && b.gameOver ? -1 : a.gameOver ? 1 : 0;
      }
    } else if (this.boards[0].gameOver) {
      this.finished = true;
    } else if (this.puzzle) {
      const b = this.boards[0];
      if (!b.isSettled()) return;
      if (b.panelCount() === 0) {
        this.finished = true;
        this.puzzleResult = "clear";
      } else if (b.movesLeft === 0) {
        this.finished = true;
        this.puzzleResult = "fail";
      }
    } else if (this.timeLimit !== null && this.boards[0].frame >= this.timeLimit) {
      this.finished = true;
      this.timeUp = true;
    }
  }

  /** タイムアタックの残りフレーム。他のモードは null。 */
  get framesLeft(): number | null {
    if (this.timeLimit === null) return null;
    return Math.max(0, this.timeLimit - this.boards[0].frame);
  }
}
