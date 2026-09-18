import { COLS, ROWS, Rng, isEmptyCell, NO_INPUT, type Board, type Input } from "../../src/core";

/**
 * 何も考えずにパネルを左右へなぞり続ける人の代わり。タッチ操作（src/render/touch.ts）と同じ手順で、
 * 掴んだパネルを 1 マスずつ入れ替え、前の入れ替えが終わって静止してから次を出す。途中で揃えばそこで止まる。
 * 「適当にスワイプするだけで高得点が取れる」を再現し、実プレイの計測（swaps に対する swapMatches、dragSteps）と並べて比べる。
 */
export interface SwiperOptions {
  /** ドラッグとドラッグの間に置く時間（フレーム）。 */
  pause: number;
  /** 1 回のドラッグで越えるマスの最大数。 */
  maxSteps: number;
}

export const SWIPER: SwiperOptions = { pause: 12, maxSteps: 5 };

export class SwipePlayer {
  private readonly rng: Rng;
  private drag: { x: number; y: number; pending: number } | null = null;
  private wait = 0;
  private lastRisen = 0;
  /** touch.ts の stats と同じ意味の集計。 */
  readonly stats = { drags: 0, dragSteps: 0, dragMidStops: 0 };

  constructor(
    private readonly board: Board,
    seed: number,
    private readonly opts: SwiperOptions = SWIPER,
  ) {
    this.rng = new Rng(seed);
  }

  next(): Input {
    const b = this.board;
    if (b.gameOver) return NO_INPUT;
    if (b.risenRows !== this.lastRisen) {
      if (this.drag) this.drag.y = Math.min(ROWS - 1, this.drag.y + b.risenRows - this.lastRisen);
      this.lastRisen = b.risenRows;
    }
    if (!this.drag) {
      if (this.wait-- > 0) return NO_INPUT;
      this.drag = this.pick();
      if (!this.drag) return NO_INPUT;
      this.stats.drags++;
    }
    const d = this.drag;
    const here = b.cell(d.x, d.y);
    if (isEmptyCell(here) || here.state === "matched" || here.state === "popped" || here.state === "falling") {
      if (d.pending !== 0 && (here.state === "matched" || here.state === "popped")) this.stats.dragMidStops++;
      return this.end();
    }
    if (here.state === "swapping") return NO_INPUT;
    if (d.pending === 0) return this.end();
    const dir = d.pending > 0 ? 1 : -1;
    const target = d.x + dir;
    const left = dir > 0 ? d.x : target;
    const input: Input = { ...NO_INPUT, swap: true, cursorTo: { x: left, y: d.y } };
    this.stats.dragSteps++;
    d.x = target;
    d.pending -= dir;
    if (d.y > 0 && isEmptyCell(b.cell(target, d.y - 1))) this.end();
    return input;
  }

  /** 積まれているパネルをランダムに 1 枚掴み、左右どちらかへ何マスか引く。空マスを掴んだら掴み直す。 */
  private pick(): { x: number; y: number; pending: number } | null {
    for (let i = 0; i < 8; i++) {
      const x = this.rng.int(COLS);
      const y = this.rng.int(ROWS);
      const c = this.board.cell(x, y);
      if (isEmptyCell(c) || c.garbage >= 0) continue;
      const dir = this.rng.next() < 0.5 ? -1 : 1;
      const room = dir > 0 ? COLS - 1 - x : x;
      const steps = Math.min(room, 1 + this.rng.int(this.opts.maxSteps));
      if (steps === 0) continue;
      return { x, y, pending: dir * steps };
    }
    return null;
  }

  private end(): Input {
    this.drag = null;
    this.wait = this.opts.pause;
    return NO_INPUT;
  }
}
