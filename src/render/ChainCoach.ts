import { Board } from "../core/board";
import { chainHint, type ChainHint } from "../core/training";
import { EMPTY, NO_INPUT } from "../core/types";
import { COLS, ROWS, TIMING } from "../core/constants";
import { KIND_COLORS } from "./theme";
import { t } from "./i18n";
import "./training.css";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "") => {
  const node = document.createElement(tag); node.textContent = text; return node;
};
/** A disposable preview. Never ticks or writes to the live game board. */
export class ChainCoach {
  private root = el("section");
  private grid = el("div");
  private status = el("p");
  private steps = el("ol");
  private board: Board;
  private hint: ChainHint | null = null;
  private controller = new AbortController();
  private frame = 0;
  private lastTime = 0;
  private accumulator = 0;
  private remaining = 0;
  private step = 0;
  private playing = false;
  private slow = false;
  private destroyed = false;
  private highlight = -1;
  private playButton: HTMLButtonElement;
  private key = (event: KeyboardEvent) => {
    event.stopImmediatePropagation();
    if (event.key === "Escape") { event.preventDefault(); this.close(); }
  };
  private hidden = () => { if (document.hidden) this.playing = false; };
  constructor(private source: Board, private close: () => void, private assisted: () => void) {
    this.source = source.practiceCopy();
    this.board = source.practiceCopy();
    this.root.className = "training"; this.root.setAttribute("role", "dialog"); this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-label", t("CHAIN COACH"));
    const header = el("header"); header.append(el("h1", t("CHAIN COACH")));
    const main = el("main"); this.grid.className = "training-board";
    for (let y = ROWS - 1; y >= 0; y--) for (let x = 0; x < COLS; x++) {
      const cell = el("button"); cell.tabIndex = -1; cell.dataset.x = String(x); cell.dataset.y = String(y); this.grid.append(cell);
    }
    const aside = el("aside"); this.status.className = "training-status"; this.status.setAttribute("role", "status");
    this.status.textContent = t("Find a chain from this board. Using hints makes this run unranked.");
    const controls = el("div"); controls.className = "training-controls";
    const button = (label: string, action: () => void) => {
      const b = el("button", t(label)); b.onclick = action; controls.append(b); return b;
    };
    const search = button("FIND CHAIN", () => { search.disabled = true; this.assisted(); void this.find(); });
    this.playButton = button("PLAY / PAUSE", () => { if (this.hint) this.playing = !this.playing; });
    this.playButton.disabled = true;
    const slow = button("SLOW: OFF", () => { this.slow = !this.slow; slow.textContent = t(this.slow ? "SLOW: ON" : "SLOW: OFF"); });
    button("REPLAY", () => this.rewind());
    button("BACK TO GAME", close);
    const note = el("p", t("Up to 3 swaps. Rising is frozen in the preview; wait between moves. This is a found route, not the maximum. Active-chain moves are not searched."));
    note.className = "coach-note";
    aside.append(this.status, controls, this.steps, note); main.append(this.grid, aside); this.root.append(header, main);
    document.body.append(this.root); search.focus();
    window.addEventListener("keydown", this.key, true);
    document.addEventListener("visibilitychange", this.hidden);
    this.draw(); this.frame = requestAnimationFrame(time => this.update(time));
  }
  private async find(): Promise<void> {
    this.status.textContent = t("CPU coach is thinking…");
    try {
      this.hint = await chainHint(this.source, this.controller.signal);
      if (this.destroyed) return;
      if (!this.hint) { this.status.textContent = t("No route found within the search limit. This does not mean a chain is impossible."); return; }
      this.status.textContent = t("Found {chain}-chain in {moves} swaps. Play the preview, then return to try it.", { chain: this.hint.chain, moves: this.hint.moves.length });
      this.steps.replaceChildren();
      if (this.hint.waitFrames) this.steps.append(el("li", t("First wait for the current movement to settle.")));
      this.hint.moves.forEach(move => this.steps.append(el("li", t("Row {y} from bottom: swap columns {x} and {next}, then wait.", { y: move.y + 1, x: move.x + 1, next: move.x + 2 }))));
      this.playButton.disabled = false; this.rewind();
    } catch (error) {
      if (!this.destroyed) this.status.textContent = t("Could not search. Return to the game and try again.");
    }
  }
  private rewind(): void {
    this.board = this.source.practiceCopy(); this.step = 0; this.remaining = this.hint?.waitFrames ?? 0;
    this.playing = false; this.accumulator = 0; this.highlight = this.remaining ? -1 : 0; this.draw();
  }
  private update(time: number): void {
    if (this.destroyed) return;
    const delta = this.lastTime ? Math.min(100, time - this.lastTime) : 0; this.lastTime = time;
    this.playButton.textContent = t(this.playing ? "PAUSE" : "PLAY / PAUSE");
    if (this.playing && this.hint) {
      this.accumulator += delta * (this.slow ? 0.25 : 1);
      while (this.accumulator >= 1000 / 60 && this.playing) {
        this.accumulator -= 1000 / 60;
        if (this.remaining > 0) { this.board.tick(); this.remaining--; }
        else if (this.step < this.hint.moves.length) {
          const move = this.hint.moves[this.step]; this.highlight = this.step++;
          this.board.cursor.x = move.x; this.board.cursor.y = move.y;
          this.board.maxChain = 1; this.board.chain = 1;
          this.board.tick({ ...NO_INPUT, swap: true }); this.remaining = move.frames;
        } else {
          this.playing = false; this.status.textContent = t("Preview complete: {chain}-chain. Your original board is unchanged.", { chain: this.board.maxChain });
        }
      }
      this.draw();
    }
    this.frame = requestAnimationFrame(next => this.update(next));
  }
  private draw(): void {
    const symbols = ["■", "●", "▲", "✚", "⬢", "✕"];
    const move = this.hint?.moves[this.highlight];
    for (const child of this.grid.children) {
      const tile = child as HTMLElement, x = Number(tile.dataset.x), y = Number(tile.dataset.y), cell = this.board.cell(x, y);
      const empty = cell.kind === EMPTY || cell.state === "popped";
      tile.textContent = empty ? "" : symbols[cell.kind];
      tile.style.background = empty ? "#1b1b28" : `#${KIND_COLORS[cell.kind].toString(16).padStart(6, "0")}`;
      const dx = cell.state === "swapping" ? cell.swapFrom * cell.timer / TIMING.swap : 0;
      const dy = cell.state === "falling" ? -cell.fallTimer / TIMING.fallPerRow : 0;
      tile.style.transform = `translate(${dx * 100}%,${dy * 100}%)`;
      tile.style.opacity = cell.state === "matched" && Math.floor(this.board.frame / 6) % 2 ? "0.45" : "1";
      tile.classList.toggle("training-hint", Boolean(move && move.y === y && (move.x === x || move.x + 1 === x)));
    }
  }
  destroy(): void {
    this.destroyed = true; this.controller.abort(); cancelAnimationFrame(this.frame); this.root.remove();
    window.removeEventListener("keydown", this.key, true); document.removeEventListener("visibilitychange", this.hidden);
  }
}
