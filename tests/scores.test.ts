import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCORE_RULES, scoreRules, eligibleRun, plausibleScore, validSubmission, type Submission } from "../src/scores/model";
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
    expect(validSubmission({ ...entry(), mode: "timeattack", rules: scoreRules("timeattack"), frames: 1 })).toBe(true);
    expect(validSubmission({ ...entry(), mode: "timeattack", rules: scoreRules("timeattack"), frames: 7201 })).toBe(false);
    expect(validSubmission({ ...entry(), mode: "timeattack", frames: 7200 })).toBe(false);
  });
  it("rejects malformed, out-of-range and old rules records", () => {
    for (const patch of [{ score: 100000 }, { score: -1 }, { score: 1.5 }, { seed: NaN }, { name: "a\nb" }, { name: "😀".repeat(21) }, { id: "bad" }, { rules: "old" }, { frames: 0 }, { mode: "cpu" }, { player: "me" }, { player: 1 }])
      expect(validSubmission({ ...entry(), ...patch })).toBe(false);
    expect(validSubmission(null)).toBe(false);
  });
  it("accepts a device player id but does not require one from old clients", () => {
    expect(validSubmission({ ...entry(), player: crypto.randomUUID() })).toBe(true);
    expect(validSubmission(entry())).toBe(true);
  });
  it("入れ替えの回数（swaps）は省略でき、あれば 0 以上の整数だけ受ける", () => {
    expect(validSubmission({ ...entry(), swaps: 446 })).toBe(true);
    expect(validSubmission({ ...entry(), swaps: 0 })).toBe(true);
    for (const swaps of [-1, 1.5, "446", 1_000_001]) expect(validSubmission({ ...entry(), swaps })).toBe(false);
  });
  it("rejects scores the game could not have produced in the frames or with the chain", () => {
    expect(plausibleScore({ score: 0, maxChain: 1, frames: 1 })).toBe(true);
    expect(plausibleScore({ score: 19062, maxChain: 6, frames: 472 * 60 })).toBe(true); // hard CPU, seed 4
    expect(plausibleScore({ score: 36500, maxChain: 13, frames: 7200 })).toBe(true);
    expect(plausibleScore({ score: 99999, maxChain: 5, frames: 600 })).toBe(false);
    expect(plausibleScore({ score: 99999, maxChain: 5, frames: 19900 })).toBe(true);
    expect(plausibleScore({ score: 100, maxChain: 5, frames: 6000 })).toBe(false); // a 5-chain alone scores 730
    expect(plausibleScore({ score: 730, maxChain: 5, frames: 6000 })).toBe(true);
    expect(plausibleScore({ score: 5000, maxChain: 20, frames: 1000 })).toBe(false); // 19 more chain steps need 1140 frames
  });
  it("excludes custom runs but permits presentation options", () => {
    expect(eligibleRun("endless", new URLSearchParams("bgm=0&countdown=0"))).toBe(true);
    expect(eligibleRun("timeattack", new URLSearchParams())).toBe(true);
    for (const key of ["seed", "time", "speed", "shock"]) expect(eligibleRun("endless", new URLSearchParams(`${key}=1`))).toBe(false);
    expect(eligibleRun("cpu", new URLSearchParams())).toBe(false);
  });
});
describe("shared profile and retry queue", () => {
  it("retains and sends old queued records under their original rules", async () => {
    const old = { ...entry(), mode: "timeattack", rules: "scores-ta-v2" };
    localStorage.setItem("swaprise.scores.pending.v1", JSON.stringify([old]));
    expect(pendingScores()).toEqual([old]);
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 200 }));
    setPublication(true); await vi.advanceTimersByTimeAsync(0);
    const posted = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/scores");
    expect(JSON.parse(posted![1]!.body as string)).toEqual(old);
    expect(pendingScores()).toEqual([]);
  });
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
    expect(pendingScores()[0]).toMatchObject({ id: s.id, name: "Before", player: localStorage.getItem("swaprise.player.v1") });
    setPublication(false); expect(pendingScores()).toEqual([]);
    enqueueScore(entry()); expect(pendingScores()).toEqual([]);
  });
  it("retries successfully and removes only acknowledged entries", async () => {
    setPublication(true); enqueueScore(entry()); await vi.advanceTimersByTimeAsync(0);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await flushScores(); expect(pendingScores()).toEqual([]);
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toBe("/api/scores");
  });
  it("keeps the player secret from the first session and sends it with every score", async () => {
    setPublication(true); enqueueScore(entry()); await vi.advanceTimersByTimeAsync(0);
    const player = localStorage.getItem("swaprise.player.v1");
    const secret = "ab".repeat(32);
    vi.mocked(fetch).mockImplementation(async (url) => new Response(JSON.stringify(url === "/api/session" ? { ok: true, player, secret } : { ok: true }), { status: 200 }));
    await flushScores();
    expect(localStorage.getItem("swaprise.player.secret.v1")).toBe(secret);
    const posted = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/scores").map(([, init]) => JSON.parse(init!.body as string));
    expect(posted).toHaveLength(1); expect(posted[0]).toMatchObject({ player, secret });
    // The second session proves ownership with the secret and gets no new one.
    enqueueScore(entry()); await vi.advanceTimersByTimeAsync(0);
    const sessions = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/session").map(([, init]) => JSON.parse(init!.body as string));
    expect(sessions.at(-1)).toEqual({ player, secret });
  });
  it("adopts a replacement player id from the server and relabels pending scores", async () => {
    setPublication(true); enqueueScore(entry()); await vi.advanceTimersByTimeAsync(0);
    const replacement = crypto.randomUUID();
    vi.mocked(fetch).mockImplementation(async (url) => new Response(JSON.stringify(url === "/api/session" ? { ok: true, player: replacement, secret: "cd".repeat(32) } : { ok: false }), { status: url === "/api/session" ? 200 : 503 }));
    await flushScores();
    expect(localStorage.getItem("swaprise.player.v1")).toBe(replacement);
    expect(pendingScores()[0].player).toBe(replacement);
    const posted = vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/scores").map(([, init]) => JSON.parse(init!.body as string));
    expect(posted[0]).toMatchObject({ player: replacement, secret: "cd".repeat(32) });
  });
  it("tolerates corrupt queue data and caps saved pending plays", async () => {
    localStorage.setItem("swaprise.scores.pending.v1", "bad"); expect(pendingScores()).toEqual([]);
    setPublication(true);
    for (let i = 0; i < 55; i++) enqueueScore(entry());
    expect(pendingScores()).toHaveLength(50);
  });
});
