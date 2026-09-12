import { expect, it } from "vitest";
import { Board } from "../../src/core/board";
import { ChainCoach } from "../../src/core/coach";

it("animates only one move, holds, and rewinds without touching the live board", async () => {
  const source = new Board({ seed: 1, initialHeight: 0 });
  source.setColumns([[2, 1, 0, 0, 4, 0, 1, 1, 3], [4, 3], [4, 3]]);
  const original = JSON.stringify(source.syncState());
  const coach = new ChainCoach(source);
  await expect.poll(() => coach.searching).toBe(false);
  expect(coach.canNext).toBe(true);
  const before = JSON.stringify(coach.board.syncState());
  coach.update(100, () => {}); expect(JSON.stringify(coach.board.syncState())).toBe(before);
  const events: string[] = [];
  coach.next(es => events.push(...es.map(e => e.type)));
  expect(coach.running).toBe(true); expect(coach.canNext).toBe(false);
  expect(coach.board.cells.flat().some(c => c.state === "swapping")).toBe(true);
  coach.previous(); expect(JSON.stringify(coach.board.syncState())).toBe(before);
  coach.next(es => events.push(...es.map(e => e.type)));
  for (let i = 0; i < 600 && coach.running; i++) coach.update(1000 / 60, es => events.push(...es.map(e => e.type)));
  expect(coach.running).toBe(false); expect(coach.board.maxChain).toBe(3);
  expect(events).toContain("match"); expect(events).toContain("pop");
  const after = JSON.stringify(coach.board.syncState());
  coach.update(100, () => {}); expect(JSON.stringify(coach.board.syncState())).toBe(after);
  coach.previous(); expect(JSON.stringify(coach.board.syncState())).toBe(before);
  expect(JSON.stringify(source.syncState())).toBe(original); coach.destroy();
});
