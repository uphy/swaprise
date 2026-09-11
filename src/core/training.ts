import { Board } from "./board";
import { COLS, ROWS } from "./constants";
import { EMPTY, NO_INPUT } from "./types";

export interface Lesson { columns: number[][]; target: number }
const two = [[2, 1, 0, 0, 4, 0, 1, 1], [4, 3], [4, 3]];
const three = [[2, 1, 0, 0, 4, 0, 1, 1, 3], [4, 3], [4, 3]];
export const LESSONS: Lesson[] = [two, three].flatMap((columns, i) => [
  { columns, target: i + 2 },
  { columns: Array.from({ length: COLS }, (_, x) => columns[COLS - x - 1] ?? []), target: i + 2 },
  { columns: columns.map((col) => col.map((kind) => (kind + 2) % 5)), target: i + 2 },
]);
export function lessonBoard(index: number): Board {
  const b = new Board({ seed: 1, initialHeight: 0, noRise: true });
  b.setColumns(LESSONS[index].columns); return b;
}
export interface ChainHint { x: number; y: number; chain: number; goal: { x: number; y: number } }
/** Exact one-swap search, intentionally separate from the CPU's survival policy.
 * Yield between candidates so mobile controls can cancel a search. Never mutate
 * the live board and never promise a chain beyond the bounded simulation. */
export async function chainHint(board: Board, target: number, signal: AbortSignal): Promise<ChainHint | null> {
  if (!board.isSettled()) return null;
  let best: ChainHint | null = null;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      signal.throwIfAborted();
      if (board.cell(x, y).kind === EMPTY && board.cell(x + 1, y).kind === EMPTY) continue;
      const trial = new Board({ seed: 1, initialHeight: 0, noRise: true }); trial.copyFrom(board);
      trial.maxChain = 1; trial.chain = 1; trial.cursor.x = x; trial.cursor.y = y;
      trial.tick({ ...NO_INPUT, swap: true });
      if (!trial.events.some((e) => e.type === "swap")) continue;
      let goal: ChainHint["goal"] | undefined;
      for (let frame = 0; frame < 600; frame++) {
        const match = trial.events.find((e) => e.type === "match");
        if (match?.type === "match" && !goal) goal = { x: match.x, y: match.y };
        if (trial.isSettled()) break;
        trial.tick();
      }
      if (trial.isSettled() && goal && trial.maxChain >= target && (!best || trial.maxChain > best.chain))
        best = { x, y, chain: trial.maxChain, goal };
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
  signal.throwIfAborted(); return best;
}
