import { Board } from "../core/board";
import { chainHint, type ChainHint } from "../core/training";
import { EMPTY, NO_INPUT } from "../core/types";
import { COLS, ROWS } from "../core/constants";
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
  private phase = el("p");
  private board: Board;
  private hint: ChainHint | null = null;
  private controller = new AbortController();
  private pages: { board: Board; move: number; after: boolean; changed: Set<string> }[] = [];
  private page = 0;
  private destroyed = false;
  private previousButton: HTMLButtonElement;
  private nextButton: HTMLButtonElement;
  private key = (event: KeyboardEvent) => {
    event.stopImmediatePropagation();
    if (event.key === "Escape") { event.preventDefault(); this.close(); }
  };
  constructor(private source: Board, private close: () => void) {
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
    this.status.textContent = t("This run is unranked because you opened a hint. Find a chain from this board.");
    const controls = el("div"); controls.className = "training-controls";
    const button = (label: string, action: () => void) => {
      const b = el("button", t(label)); b.onclick = action; controls.append(b); return b;
    };
    const search = button("FIND CHAIN", () => { search.disabled = true; void this.find(); });
    this.previousButton = button("PREVIOUS STEP", () => this.showPage(this.page - 1));
    this.nextButton = button("NEXT STEP", () => this.showPage(this.page + 1));
    this.previousButton.disabled = this.nextButton.disabled = true;
    button("REPLAY", () => this.showPage(0));
    button("BACK TO GAME", close);
    const note = el("p", t("Up to 3 swaps. Rising is frozen in the preview; wait between moves. This is a found route, not the maximum. Active-chain moves are not searched."));
    note.className = "coach-note";
    this.phase.className = "coach-phase"; this.phase.setAttribute("aria-live", "polite");
    aside.append(this.status, this.phase, controls, this.steps, note); main.append(this.grid, aside); this.root.append(header, main);
    document.body.append(this.root); search.focus();
    window.addEventListener("keydown", this.key, true);
    this.draw();
  }
  private async find(): Promise<void> {
    this.status.textContent = t("CPU coach is thinking…");
    try {
      this.hint = await chainHint(this.source, this.controller.signal);
      if (this.destroyed) return;
      if (!this.hint) { this.status.textContent = t("No route found within the search limit. This does not mean a chain is impossible."); return; }
      this.status.textContent = t("Found {chain}-chain in {moves} swaps. Use NEXT and PREVIOUS to compare each move.", { chain: this.hint.chain, moves: this.hint.moves.length });
      this.steps.replaceChildren();
      this.hint.moves.forEach(move => this.steps.append(el("li", t("Row {y} from bottom: swap columns {x} and {next}, then wait.", { y: move.y + 1, x: move.x + 1, next: move.x + 2 }))));
      this.buildPages(); this.showPage(0);
    } catch (error) {
      if (!this.destroyed) this.status.textContent = t("Could not search. Return to the game and try again.");
    }
  }
  private buildPages(): void {
    if (!this.hint) return;
    const board = this.source.practiceCopy(); this.pages = [];
    if (this.hint.waitFrames) this.pages.push({ board: board.practiceCopy(), move: -1, after: false, changed: new Set() });
    for (let i = 0; i < this.hint.waitFrames; i++) board.tick();
    this.hint.moves.forEach((move, index) => {
      const before = board.practiceCopy();
      this.pages.push({ board: before, move: index, after: false, changed: new Set() });
      board.cursor.x = move.x; board.cursor.y = move.y; board.maxChain = 1; board.chain = 1;
      board.tick({ ...NO_INPUT, swap: true });
      for (let i = 0; i < move.frames; i++) board.tick();
      const changed = new Set<string>();
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (before.cell(x, y).kind !== board.cell(x, y).kind) changed.add(`${x},${y}`);
      }
      this.pages.push({ board: board.practiceCopy(), move: index, after: true, changed });
    });
  }
  private showPage(index: number): void {
    if (index < 0 || index >= this.pages.length) return;
    this.page = index; const page = this.pages[index]; this.board = page.board;
    this.previousButton.disabled = index === 0; this.nextButton.disabled = index === this.pages.length - 1;
    this.phase.textContent = page.move < 0 ? t("First wait for the current movement to settle.") : t(page.after
      ? "Move {step}/{total}: AFTER. Cyan marks changed cells; yellow marks the swapped pair."
      : "Move {step}/{total}: BEFORE. Swap the yellow pair ↔. NEXT shows the result.",
      { step: page.move + 1, total: this.hint!.moves.length });
    if (index === this.pages.length - 1) this.phase.textContent += " " + t("Preview complete: {chain}-chain. Your original board is unchanged.", { chain: this.board.maxChain });
    Array.from(this.steps.children).forEach((item, i) => {
      item.classList.toggle("coach-current", i === page.move);
      if (i === page.move) item.setAttribute("aria-current", "step"); else item.removeAttribute("aria-current");
    });
    this.draw();
  }
  private draw(): void {
    const symbols = ["■", "●", "▲", "✚", "⬢", "✕"];
    const page = this.pages[this.page];
    const move = this.hint?.moves[page?.move ?? -1];
    for (const child of this.grid.children) {
      const tile = child as HTMLElement, x = Number(tile.dataset.x), y = Number(tile.dataset.y), cell = this.board.cell(x, y);
      const empty = cell.kind === EMPTY || cell.state === "popped";
      tile.textContent = empty ? "" : symbols[cell.kind];
      tile.style.background = empty ? "#1b1b28" : `#${KIND_COLORS[cell.kind].toString(16).padStart(6, "0")}`;
      const highlighted = Boolean(move && move.y === y && (move.x === x || move.x + 1 === x));
      tile.classList.toggle("training-hint", highlighted);
      tile.classList.toggle("coach-changed", Boolean(page?.changed.has(`${x},${y}`)));
      if (highlighted) { const arrow = el("span", x === move!.x ? "→" : "←"); arrow.className = "coach-arrow"; tile.append(arrow); }
    }
  }
  destroy(): void {
    this.destroyed = true; this.controller.abort(); this.root.remove();
    window.removeEventListener("keydown", this.key, true);
  }
}
