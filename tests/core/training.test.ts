import { expect, it } from "vitest";
import { Board, NO_INPUT } from "../../src/core";
import { chainHint, quiet } from "../../src/core/training";

function board(): Board {
  const b = new Board({ seed: 1, initialHeight: 0 });
  b.setColumns([[2, 1, 0, 0, 4, 0, 1, 1, 3], [4, 3], [4, 3]]); return b;
}
it("searches the current board without changing it and replays the verified route", async () => {
  const source = board(), before = JSON.stringify(source.syncState());
  const hint = await chainHint(source, new AbortController().signal);
  expect(hint).not.toBeNull(); expect(hint!.chain).toBeGreaterThanOrEqual(3);
  expect(JSON.stringify(source.syncState())).toBe(before);
  const preview = source.practiceCopy();
  for (let i = 0; i < hint!.waitFrames; i++) preview.tick();
  for (const move of hint!.moves) {
    preview.maxChain = 1; preview.chain = 1; preview.cursor.x = move.x; preview.cursor.y = move.y;
    preview.tick({ ...NO_INPUT, swap: true });
    for (let i = 0; i < move.frames; i++) preview.tick();
  }
  expect(quiet(preview)).toBe(true); expect(preview.maxChain).toBe(hint!.chain);
  expect(preview.risenRows).toBe(source.risenRows);
});
it("can include a setup swap before making a chain", async () => {
  const source = board(); source.cursor.x = 0; source.cursor.y = 1;
  source.tick({ ...NO_INPUT, swap: true });
  for (let i = 0; i < 30; i++) source.tick();
  const hint = await chainHint(source, new AbortController().signal);
  expect(hint).not.toBeNull(); expect(hint!.moves.length).toBeGreaterThan(1);
});
it("can inspect a moving board, reports bounded failure and cancels", async () => {
  const source = board(); source.cursor.x = 0; source.cursor.y = 1;
  source.tick({ ...NO_INPUT, swap: true });
  const hint = await chainHint(source, new AbortController().signal);
  expect(hint?.waitFrames).toBeGreaterThan(0);
  expect(await chainHint(new Board({ seed: 1, initialHeight: 0 }), new AbortController().signal)).toBeNull();
  const controller = new AbortController(); controller.abort();
  await expect(chainHint(source, controller.signal)).rejects.toThrow();
});
