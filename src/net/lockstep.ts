import { Game } from "../core/game";
import { NO_INPUT, type Input } from "../core/types";
import { BATCH, type Match, type Pair } from "./protocol";
/** 確定入力だけで進む。未着の入力や二重配信ではtickしない。 */
export class Lockstep {
  readonly game: Game;
  frame = 0;
  nextInput: number;
  private frames = new Map<number, Pair>();
  private pending: Input[] = [];
  constructor(readonly match: Match) {
    this.game = new Game({ mode: "versus", seed: match.seed });
    this.nextInput = match.delay;
  }
  receive(start: number, pairs: Pair[]): void {
    pairs.forEach((pair, i) => {
      if (start + i >= this.frame) this.frames.set(start + i, pair);
    });
  }
  step(): boolean {
    const pair = this.frames.get(this.frame);
    if (!pair || this.game.finished) return false;
    this.game.tick(pair);
    this.frames.delete(this.frame++);
    return true;
  }
  capture(poll: () => Input): { startFrame: number; inputs: Input[] } | null {
    if (
      this.nextInput > this.frame + this.match.delay + BATCH - 1 ||
      this.game.finished
    )
      return null;
    this.pending.push(structuredClone(poll()));
    this.nextInput++;
    if (this.pending.length < BATCH) return null;
    const inputs = this.pending.splice(0);
    return { startFrame: this.nextInput - inputs.length, inputs };
  }
  resume(next: number): void {
    this.pending = [];
    this.nextInput = next;
  }
}
export function initialFrames(delay: number): Pair[] {
  return Array.from({ length: delay }, () => [
    { ...NO_INPUT },
    { ...NO_INPUT },
  ]);
}
