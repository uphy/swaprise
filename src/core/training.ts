import { Board } from "./board";
import { COLS, ROWS } from "./constants";
import { EMPTY, NO_INPUT } from "./types";

export interface CoachMove { x: number; y: number; frames: number }
export interface ChainHint { moves: CoachMove[]; chain: number; waitFrames: number }
export function quiet(board: Board): boolean {
  return board.isSettled() && board.cells.every(row => row.every(c => c.kind === EMPTY || !c.chain));
}
function settle(board: Board): number {
  let frames = 0;
  while (!quiet(board) && !board.gameOver && frames < 600) { board.tick(); frames++; }
  return frames;
}
function promiseScore(board: Board): number {
  let score = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const k = board.cell(x, y).kind;
    if (k === EMPTY) continue;
    if (x + 1 < COLS && board.cell(x + 1, y).kind === k) score += 2;
    if (y + 1 < ROWS && board.cell(x, y + 1).kind === k) score += 2;
    if (x + 2 < COLS && board.cell(x + 2, y).kind === k) score++;
    if (y + 2 < ROWS && board.cell(x, y + 2).kind === k) score++;
  }
  return score;
}
/** Bounded beam search: up to three swaps, waiting for each to settle.
 * Results are verified by the actual core, not a claim of optimality. */
export async function chainHint(source: Board, signal: AbortSignal, budgetMs = 3000): Promise<ChainHint | null> {
  signal.throwIfAborted();
  const start = source.practiceCopy();
  const waitFrames = settle(start);
  if (!quiet(start) || start.gameOver) return null;
  const deadline = performance.now() + budgetMs;
  let yieldAt = performance.now() + 8;
  let best: ChainHint | null = null;
  let frontier = [{ board: start, moves: [] as CoachMove[], value: 0 }];
  const seen = new Set<string>();
  for (let depth = 0; depth < 3; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS - 1; x++) {
      signal.throwIfAborted();
      if (performance.now() > deadline) return best;
      if (node.board.cell(x, y).kind === node.board.cell(x + 1, y).kind) continue;
      const trial = node.board.practiceCopy();
      trial.maxChain = 1; trial.chain = 1; trial.cursor.x = x; trial.cursor.y = y;
      trial.tick({ ...NO_INPUT, swap: true });
      if (!trial.events.some(e => e.type === "swap")) continue;
      const frames = settle(trial);
      if (quiet(trial) && !trial.gameOver) {
        const moves = [...node.moves, { x, y, frames }];
        if (trial.maxChain >= 2 && (!best || trial.maxChain > best.chain)) best = { moves, chain: trial.maxChain, waitFrames };
        const key = trial.toString();
        if (!seen.has(key)) {
          seen.add(key); next.push({ board: trial, moves, value: promiseScore(trial) });
          next.sort((a, b) => b.value - a.value);
          if (next.length > 12) next.pop();
        }
      }
      if (performance.now() >= yieldAt) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        signal.throwIfAborted(); yieldAt = performance.now() + 8;
      }
    }
    frontier = next;
  }
  signal.throwIfAborted(); return best;
}
