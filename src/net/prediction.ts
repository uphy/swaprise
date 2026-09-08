import { Game } from "../core/game";
import { NO_INPUT, type Input } from "../core/types";
import type { Lockstep } from "./lockstep";

/** 表示用の予測。確定側を変更せず、自分の未確定入力を直ちに適用する。 */
export class Prediction {
  readonly game: Game;
  frame = 0;
  private confirmed = -1;
  private inputs = new Map<number, Input>();
  constructor(
    private readonly lockstep: Lockstep,
    private readonly player: number,
  ) {
    this.game = new Game({ mode: "versus", seed: lockstep.match.seed });
    this.frame = lockstep.nextInput;
    this.reconcile();
  }
  advance(frame: number, input: Input): void {
    this.inputs.set(frame, structuredClone(input));
    // 再開時などの初期NO_INPUTも同じ順序で進める。
    while (this.frame < frame) this.tick(NO_INPUT);
    this.tick(input);
  }
  private tick(input: Input): void {
    const pair = [{ ...NO_INPUT }, { ...NO_INPUT }];
    pair[this.player] = input;
    this.game.boards.forEach((board) => {
      board.events = [];
    });
    this.game.tick(pair);
    this.frame++;
  }
  reconcile(): void {
    const l = this.lockstep;
    if (this.confirmed === l.frame) return;
    this.confirmed = l.frame;
    const target = Math.max(this.frame, l.frame);
    this.game.copyVersusFrom(l.game);
    this.frame = l.frame;
    for (const frame of this.inputs.keys())
      if (frame < l.frame) this.inputs.delete(frame);
    while (this.frame < target)
      this.tick(this.inputs.get(this.frame) ?? NO_INPUT);
    // 再計算した過去の音・振動・吹き出しを再発火させない。
    this.game.boards.forEach((board) => {
      board.events = [];
    });
  }
  reset(): void {
    this.inputs.clear();
    this.frame = this.lockstep.nextInput;
    this.confirmed = -1;
    this.reconcile();
  }
}
