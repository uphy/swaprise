import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { recordProgress } from "../src/scores/progress";
beforeEach(() => {
  const values = new Map();
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());
it("compares against preceding five attempts, not top five or current score", () => {
  expect(recordProgress("endless", 100)).toEqual({ best: null, average: null, count: 0 });
  for (const score of [1, 2, 3, 4, 5]) recordProgress("endless", score);
  expect(recordProgress("endless", 200)).toEqual({ best: 100, average: 3, count: 5 });
  expect(recordProgress("timeattack", 10)).toEqual({ best: null, average: null, count: 0 });
});
it("preserves existing best and tolerates missing, corrupted and full storage", () => {
  expect(recordProgress("endless", 200, 500).best).toBe(500);
  localStorage.setItem("swaprise.progress.scores-v1.endless", "null");
  expect(recordProgress("endless", 1).average).toBeNull();
  vi.stubGlobal("localStorage", { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
  expect(() => recordProgress("endless", 5)).not.toThrow();
});
