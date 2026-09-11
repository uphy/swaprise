import Phaser from "phaser";
import { LESSONS, lessonBoard, chainHint, type ChainHint } from "../core/training";
import { NO_INPUT, EMPTY } from "../core/types";
import { COLS, ROWS, TIMING } from "../core/constants";
import { KIND_COLORS } from "./theme";
import { t } from "./i18n";
import { audio } from "./shared";
import "./training.css";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "") => {
  const n = document.createElement(tag); n.textContent = text; return n;
};
/** DOM controls stay at physical-pixel sizes independently of the game canvas. */
export class TrainingScene extends Phaser.Scene {
  private lesson = 0;
  private board = lessonBoard(0);
  private running = false;
  private paused = false;
  private demo = false;
  private slow = false;
  private accumulator = 0;
  private hint: ChainHint | null = null;
  private hintLevel = 0;
  private search?: AbortController;
  private root!: HTMLElement;
  private grid!: HTMLElement;
  private status!: HTMLElement;
  private title!: HTMLElement;
  private metric!: HTMLElement;
  private pauseButton!: HTMLButtonElement;
  private speedButton!: HTMLButtonElement;
  private select!: HTMLSelectElement;
  private selected: { x: number; y: number } | null = null;
  private down: { x: number; y: number; px: number; py: number; id: number } | null = null;
  constructor() { super("training"); }
  create(): void {
    audio.stopBgm();
    this.slow = false;
    this.root = el("section"); this.root.className = "training"; this.root.setAttribute("aria-label", t("CHAIN PRACTICE"));
    const head = el("header"); this.title = el("h1", t("CHAIN PRACTICE")); head.append(this.title);
    const label = el("label", t("LESSON")); this.select = el("select");
    LESSONS.forEach((lesson, i) => { const option = el("option", `${i + 1} · ${t("{count} CHAIN", { count: lesson.target })}`); option.value = String(i); this.select.append(option); });
    label.append(this.select); head.append(label);
    this.select.onchange = () => { this.lesson = Number(this.select.value); this.reset(); };
    const main = el("main"); this.grid = el("div"); this.grid.className = "training-board";
    this.grid.setAttribute("role", "group"); this.grid.setAttribute("aria-label", t("PRACTICE BOARD"));
    // One accessible button per cell; position/style are updated from core state.
    for (let y = ROWS - 1; y >= 0; y--) for (let x = 0; x < COLS; x++) {
      const tile = el("button"); tile.type = "button"; tile.dataset.x = String(x); tile.dataset.y = String(y);
      tile.onclick = (event) => {
        // Pointer input is handled on pointerup. Keyboard/assistive activation selects a pair.
        if (event.detail === 0) this.choose(x, y);
      };
      this.grid.append(tile);
    }
    this.grid.onpointerdown = (event) => {
      const cell = (event.target as HTMLElement).closest<HTMLButtonElement>("button"); if (!cell) return;
      this.down = { x: Number(cell.dataset.x), y: Number(cell.dataset.y), px: event.clientX, py: event.clientY, id: event.pointerId };
      this.grid.setPointerCapture(event.pointerId);
    };
    this.grid.onpointerup = (event) => {
      const d = this.down; this.down = null; if (!d || d.id !== event.pointerId) return;
      const dx = event.clientX - d.px, dy = event.clientY - d.py;
      if (Math.abs(dx) >= 12 && Math.abs(dx) > Math.abs(dy)) this.swap(d.x + (dx < 0 ? -1 : 0), d.y);
      else if (Math.hypot(dx, dy) < 12) this.choose(d.x, d.y);
    };
    this.grid.onpointercancel = () => { this.down = null; };
    const panel = el("aside"); this.metric = el("p"); this.metric.className = "training-metric";
    this.status = el("p"); this.status.className = "training-status"; this.status.setAttribute("role", "status");
    const controls = el("div"); controls.className = "training-controls";
    const button = (text: string, action: () => void) => { const b = el("button", t(text)); b.type = "button"; b.onclick = action; controls.append(b); return b; };
    button("HINT", () => { void this.showHint(); });
    button("DEMONSTRATION", () => { void this.demonstrate(); });
    this.pauseButton = button("PAUSE", () => {
      this.paused = !this.paused; this.pauseButton.textContent = t(this.paused ? "RESUME" : "PAUSE");
    });
    this.speedButton = button("SLOW: OFF", () => {
      this.slow = !this.slow; this.speedButton.textContent = t(this.slow ? "SLOW: ON" : "SLOW: OFF");
      this.speedButton.setAttribute("aria-pressed", String(this.slow));
    });
    button("TRY AGAIN", () => this.reset());
    button("NEXT LESSON", () => { this.lesson = (this.lesson + 1) % LESSONS.length; this.reset(); });
    button("MENU", () => this.scene.start("menu"));
    const help = el("details"); help.append(el("summary", t("HOW TO PLAY")), el("p", t("Drag sideways, or select two neighboring panels. Hints pause time. Practice scores are not published.")));
    panel.append(this.metric, this.status, controls, help);
    main.append(this.grid, panel); this.root.append(head, main); document.body.append(this.root);
    const hidden = () => { if (document.hidden) { this.paused = true; this.pauseButton.textContent = t("RESUME"); } };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape" && event.target !== this.select) this.scene.start("menu"); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("keydown", key);
    this.events.once("shutdown", () => { this.search?.abort(); this.root.remove(); document.removeEventListener("visibilitychange", hidden); window.removeEventListener("keydown", key); });
    this.reset();
    (window as any).__swapriseTraining = this;
    this.events.once("shutdown", () => { delete (window as any).__swapriseTraining; });
  }
  private reset(): void {
    this.search?.abort(); this.search = undefined; this.board = lessonBoard(this.lesson);
    this.running = false; this.paused = false; this.demo = false; this.hint = null; this.hintLevel = 0;
    this.accumulator = 0; this.selected = null; this.down = null;
    this.select.value = String(this.lesson); this.pauseButton.textContent = t("PAUSE");
    const rows = Math.max(...LESSONS[this.lesson].columns.map((col) => col.length));
    this.grid.style.gridTemplateRows = `repeat(${rows},1fr)`;
    this.grid.style.aspectRatio = `6 / ${rows}`;
    for (const tile of this.grid.children) (tile as HTMLElement).hidden = Number((tile as HTMLElement).dataset.y) >= rows;
    this.status.textContent = t("Build a {count}-chain. Think first, then ask the CPU coach.", { count: LESSONS[this.lesson].target }); this.draw();
  }
  private choose(x: number, y: number): void {
    if (this.running || this.search || this.demo) return;
    if (this.selected?.y === y && Math.abs(this.selected.x - x) === 1) this.swap(Math.min(x, this.selected.x), y);
    else { this.selected = { x, y }; this.draw(); }
  }
  private swap(x: number, y: number): void {
    if (x < 0 || x >= COLS - 1 || this.running || this.search || this.demo) return;
    this.board.cursor.x = x; this.board.cursor.y = y;
    this.board.tick({ ...NO_INPUT, swap: true });
    if (!this.board.events.some((e) => e.type === "swap")) return;
    this.hint = null; this.hintLevel = 0; this.selected = null; this.paused = false;
    this.pauseButton.textContent = t("PAUSE"); this.running = true; this.accumulator = 0;
    this.status.textContent = t("Watch how the panels fall."); this.draw();
  }
  private async findHint(): Promise<ChainHint | null> {
    this.search?.abort(); const search = this.search = new AbortController();
    this.status.textContent = t("CPU coach is thinking…");
    try { return await chainHint(this.board, LESSONS[this.lesson].target, search.signal); }
    finally { if (this.search === search) this.search = undefined; }
  }
  private async showHint(): Promise<void> {
    if (this.search || this.demo) return;
    this.paused = true; this.pauseButton.textContent = t("RESUME");
    if (this.running) { this.status.textContent = t("Let this move settle, then ask for a hint. Press RESUME to continue."); return; }
    try {
      if (!this.hint) this.hint = await this.findHint();
      if (!this.hint) { this.status.textContent = t("No one-swap chain found here. Try again or watch the demonstration."); return; }
      this.hintLevel = Math.min(2, this.hintLevel + 1);
      this.status.textContent = this.hintLevel === 1 ? t("Aim to clear the highlighted area first. Press HINT again for the move.")
        : t("Swap the two highlighted panels. Falling panels will match again: {count}-chain.", { count: this.hint.chain });
      this.draw();
    } catch { /* A reset/menu/lesson change cancels without touching the new screen. */ }
  }
  private async demonstrate(): Promise<void> {
    this.reset(); this.demo = true;
    try {
      const hint = await this.findHint(); if (!hint) { this.demo = false; return; }
      this.hint = hint; this.hintLevel = 2; this.selected = null; this.paused = true;
      this.status.textContent = t("Demonstration ready. The highlighted pair is the first move. Press RESUME.");
      this.pauseButton.textContent = t("RESUME"); this.draw();
    } catch { /* Cancelled. */ }
  }
  override update(_time: number, delta: number): void {
    if (this.paused || this.search) return;
    if (this.demo && !this.running && this.hint) {
      const hint = this.hint; this.demo = false; this.swap(hint.x, hint.y); this.demo = true;
    }
    if (!this.running) return;
    this.accumulator += Math.min(delta, 100) * (this.slow ? 0.25 : 1);
    while (this.accumulator >= 1000 / 60 && this.running) {
      this.accumulator -= 1000 / 60; this.board.tick();
      if (this.board.isSettled() && this.board.cells.every((row) => row.every((cell) => cell.kind === EMPTY || !cell.chain))) {
        this.running = false;
        const success = this.board.maxChain >= LESSONS[this.lesson].target;
        this.status.textContent = t(this.demo ? "Demonstration complete. TRY AGAIN to do it yourself." : success ? "Success! Try the next lesson, or repeat without hints." : "Not a chain yet. Try another move or ask for a hint.");
        this.demo = false;
      }
    }
    this.draw();
  }
  private draw(): void {
    const symbols = ["■", "●", "▲", "✚", "⬢", "✕"];
    this.metric.textContent = t("GOAL ×{target} · BEST ×{chain}", { target: LESSONS[this.lesson].target, chain: this.board.maxChain });
    for (const child of this.grid.children) {
      const tile = child as HTMLButtonElement, x = Number(tile.dataset.x), y = Number(tile.dataset.y), cell = this.board.cell(x, y);
      const empty = cell.kind === EMPTY || cell.state === "popped";
      tile.textContent = empty ? "" : symbols[cell.kind] ?? "!";
      tile.style.background = empty ? "#1b1b28" : `#${KIND_COLORS[cell.kind].toString(16).padStart(6, "0")}`;
      const dx = cell.state === "swapping" ? cell.swapFrom * cell.timer / TIMING.swap : 0;
      const dy = cell.state === "falling" ? -cell.fallTimer / TIMING.fallPerRow : 0;
      tile.style.transform = `translate(${dx * 100}%, ${dy * 100}%)`;
      tile.style.opacity = cell.state === "matched" && Math.floor(this.board.frame / 6) % 2 ? "0.45" : "1";
      tile.setAttribute("aria-label", t("Column {x}, row {y}: {panel}", { x: x + 1, y: y + 1, panel: empty ? t("EMPTY") : symbols[cell.kind] }));
      const highlighted = this.hint && (this.hintLevel === 1 ? Math.abs(x - this.hint.goal.x) <= 1 && Math.abs(y - this.hint.goal.y) <= 1 : y === this.hint.y && (x === this.hint.x || x === this.hint.x + 1));
      tile.classList.toggle("training-hint", Boolean(highlighted));
      tile.classList.toggle("training-selected", this.selected?.x === x && this.selected.y === y);
    }
  }
}
