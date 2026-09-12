import { Board } from "./board";
import { NO_INPUT, type BoardEvent } from "./types";
import { chainHint, type CoachMove } from "./training";

/** Playback state only. Rendering and controls belong to the existing game scene. */
export class ChainCoach {
  readonly board: Board;
  searching = true;
  running = false;
  failed = false;
  private controller = new AbortController();
  private actions: { move?: CoachMove; frames: number }[] = [];
  private snapshots: Board[] = [];
  private index = 0;
  private remaining = 0;
  private accumulator = 0;
  constructor(source: Board) {
    this.board = source.practiceCopy();
    this.snapshots.push(this.board.practiceCopy());
    void this.search();
  }
  private async search(): Promise<void> {
    try {
      const hint = await chainHint(this.board, this.controller.signal);
      if (this.controller.signal.aborted) return;
      if (hint?.waitFrames) this.actions.push({ frames: hint.waitFrames });
      if (hint) this.actions.push(...hint.moves.map(move => ({ move, frames: move.frames })));
      this.failed = !hint;
    } catch { this.failed = true; }
    finally { this.searching = false; }
  }
  get pair(): CoachMove | undefined {
    return this.actions[Math.min(this.index, this.actions.length - 1)]?.move;
  }
  get canNext(): boolean { return !this.searching && !this.running && this.index < this.actions.length; }
  get canPrevious(): boolean { return this.running || this.index > 0; }
  next(emit: (events: BoardEvent[]) => void): void {
    if (!this.canNext) return;
    const action = this.actions[this.index];
    if (action.move) {
      this.board.cursor.x = action.move.x; this.board.cursor.y = action.move.y;
      this.board.maxChain = 1; this.board.chain = 1;
      this.board.tick({ ...NO_INPUT, swap: true }); emit(this.board.events);
    }
    this.remaining = action.frames; this.accumulator = 0; this.running = true;
  }
  previous(): void {
    if (!this.canPrevious) return;
    if (!this.running) this.index--;
    this.running = false; this.accumulator = 0;
    this.board.copyFrom(this.snapshots[this.index]);
  }
  update(delta: number, emit: (events: BoardEvent[]) => void): void {
    if (!this.running) return;
    this.accumulator += Math.min(delta, 100);
    while (this.accumulator >= 1000 / 60 && this.running) {
      this.accumulator -= 1000 / 60;
      if (this.remaining > 0) { this.board.tick(); emit(this.board.events); this.remaining--; }
      else {
        this.running = false; this.index++;
        this.snapshots[this.index] = this.board.practiceCopy();
      }
    }
  }
  destroy(): void { this.controller.abort(); }
}
