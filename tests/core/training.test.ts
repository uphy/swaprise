import { expect, it } from "vitest";
import { LESSONS, lessonBoard, chainHint } from "../../src/core/training";
import { Board, NO_INPUT } from "../../src/core";

it.each(LESSONS.map((_, i) => i))("lesson %i has a real one-move chain and search leaves the board unchanged", async (index) => {
  const board = lessonBoard(index), before = JSON.stringify(board.syncState());
  const hint = await chainHint(board, LESSONS[index].target, new AbortController().signal);
  expect(hint).not.toBeNull(); expect(JSON.stringify(board.syncState())).toBe(before);
  board.cursor.x = hint!.x; board.cursor.y = hint!.y;
  board.tick({ ...NO_INPUT, swap: true });
  for (let i = 0; i < 600 && !board.isSettled(); i++) board.tick();
  expect(board.maxChain).toBe(hint!.chain);
  expect(board.maxChain).toBeGreaterThanOrEqual(LESSONS[index].target);
});
it("does not invent a move on an empty board and can cancel", async () => {
  const empty = new Board({ seed: 1, initialHeight: 0, noRise: true });
  expect(await chainHint(empty, 2, new AbortController().signal)).toBeNull();
  const controller = new AbortController(); controller.abort();
  await expect(chainHint(lessonBoard(0), 2, controller.signal)).rejects.toThrow();
});
