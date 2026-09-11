import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCORE_RULES, eligibleRun, validSubmission, type Submission } from "../src/scores/model";
import { enqueueScore, flushScores, pendingScores, playerName, publication, savePlayerName, setPublication } from "../src/scores/client";

const entry = (): Submission => ({ id: crypto.randomUUID(), rules: SCORE_RULES, mode: "endless", name: "Player", score: 1200, maxChain: 4, seed: 7, frames: 600 });
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  vi.useFakeTimers();
});
afterEach(async () => { setPublication(false); await vi.advanceTimersByTimeAsync(0); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("standard score rules", () => {
  it("accepts both modes, including an early time-attack loss", () => {
    expect(validSubmission(entry())).toBe(true);
    expect(validSubmission({ ...entry(), mode: "timeattack", frames: 1 })).toBe(true);
    expect(validSubmission({ ...entry(), mode: "timeattack", frames: 7201 })).toBe(false);
  });
  it("rejects malformed, out-of-range and old rules records", () => {
    for (const patch of [{ score: 100000 }, { score: -1 }, { score: 1.5 }, { seed: NaN }, { name: "a\nb" }, { name: "😀".repeat(21) }, { id: "bad" }, { rules: "old" }, { frames: 0 }, { mode: "cpu" }])
      expect(validSubmission({ ...entry(), ...patch })).toBe(false);
    expect(validSubmission(null)).toBe(false);
  });
  it("excludes custom runs but permits presentation options", () => {
    expect(eligibleRun("endless", new URLSearchParams("bgm=0&countdown=0"))).toBe(true);
    expect(eligibleRun("timeattack", new URLSearchParams())).toBe(true);
    for (const key of ["seed", "time", "speed", "shock"]) expect(eligibleRun("endless", new URLSearchParams(`${key}=1`))).toBe(false);
    expect(eligibleRun("cpu", new URLSearchParams())).toBe(false);
  });
});
describe("shared profile and retry queue", () => {
  it("does not infer consent from an existing online name", () => {
    localStorage.setItem("swaprise.name.v1", "Existing");
    expect(playerName()).toBe("Existing"); expect(publication()).toBe(null);
    enqueueScore(entry()); expect(pendingScores()).toEqual([]); expect(fetch).not.toHaveBeenCalled();
    expect(savePlayerName("  名\n前  ")).toBe("名前");
    expect(localStorage.getItem("swaprise.name.v1")).toBe("名前");
  });
  it("retains IDs and names across failures, deduplicates, and discards on opt-out", async () => {
    setPublication(true); savePlayerName("Before"); const s = entry();
    enqueueScore(s); enqueueScore(s); await vi.advanceTimersByTimeAsync(0);
    savePlayerName("After"); expect(pendingScores()).toHaveLength(1);
    expect(pendingScores()[0]).toMatchObject({ id: s.id, name: "Before" });
    setPublication(false); expect(pendingScores()).toEqual([]);
    enqueueScore(entry()); expect(pendingScores()).toEqual([]);
  });
  it("retries successfully and removes only acknowledged entries", async () => {
    setPublication(true); enqueueScore(entry()); await vi.advanceTimersByTimeAsync(0);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await flushScores(); expect(pendingScores()).toEqual([]);
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toBe("/api/scores");
  });
  it("tolerates corrupt queue data and caps saved pending plays", async () => {
    localStorage.setItem("swaprise.scores.pending.v1", "bad"); expect(pendingScores()).toEqual([]);
    setPublication(true);
    for (let i = 0; i < 55; i++) enqueueScore(entry());
    expect(pendingScores()).toHaveLength(50);
  });
});
