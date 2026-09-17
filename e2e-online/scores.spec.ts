import { expect, test, type APIRequestContext } from "@playwright/test";
import { scoreRules, type ScoreMode } from "../src/scores/model";
import { randomUUID } from "node:crypto";

// frames は得点の上限（frames × 5 + 500）に収まる長さ。タイムアタックは 7200 が上限なので得点も抑える
const score = (mode: ScoreMode = "endless") => mode === "timeattack"
  ? { id: randomUUID(), rules: scoreRules(mode), mode, name: "D1 player", score: 30000, maxChain: 7, seed: 123, frames: 7200 }
  : { id: randomUUID(), rules: scoreRules(mode), mode, name: "D1 player", score: 90000, maxChain: 7, seed: 123, frames: 20000 };
async function connect(request: APIRequestContext, baseURL: string): Promise<Record<string, string>> {
  const headers = { Origin: baseURL, "CF-Connecting-IP": `test-${randomUUID()}` };
  expect((await request.post("/api/session", { headers })).ok()).toBe(true);
  return headers;
}
/** 端末の player id の持ち主として登録し、秘密を受け取る */
async function register(request: APIRequestContext, headers: Record<string, string>, player: string, secret?: string): Promise<{ player: string; secret?: string }> {
  const response = await request.post("/api/session", { headers, data: { player, secret } });
  expect(response.ok()).toBe(true);
  return await response.json();
}
test("D1: a player id belongs to the first device that claims it; scores under it need the secret", async ({ request, baseURL }) => {
  const headers = await connect(request, baseURL!);
  const me = randomUUID();
  const first = await register(request, headers, me);
  expect(first.player).toBe(me); expect(first.secret).toMatch(/^[0-9a-f]{64}$/);
  // Proving ownership returns no new secret; a stranger claiming the id gets a fresh id instead.
  expect(await register(request, headers, me, first.secret)).toEqual({ ok: true, player: me });
  const stranger = await register(request, headers, me);
  expect(stranger.player).not.toBe(me); expect(stranger.secret).toMatch(/^[0-9a-f]{64}$/);
  expect((await register(request, headers, me, "00".repeat(32))).player).not.toBe(me);
  for (const patch of [{}, { secret: "00".repeat(32) }, { secret: 1 }])
    expect((await request.post("/api/scores", { headers, data: { ...score(), player: me, ...patch } })).status()).toBe(400);
  expect((await request.post("/api/scores", { headers, data: { ...score(), score: 5000, player: me, secret: first.secret } })).status()).toBe(201);
  // An unclaimed id cannot be used for scores either.
  expect((await request.post("/api/scores", { headers, data: { ...score(), player: randomUUID(), secret: first.secret } })).status()).toBe(400);
  // A body without a player still just opens the session.
  expect(await (await request.post("/api/session", { headers, data: {} })).json()).toEqual({ ok: true });
});
test("D1: rejects scores the game could not have produced", async ({ request, baseURL }) => {
  const headers = await connect(request, baseURL!);
  for (const patch of [{ score: 99999, frames: 600 }, { score: 100, maxChain: 5 }, { maxChain: 200, frames: 6000 }])
    expect((await request.post("/api/scores", { headers, data: { ...score(), ...patch } })).status()).toBe(400);
  expect((await request.post("/api/scores", { headers, data: { ...score(), score: 3500, frames: 600 } })).status()).toBe(201);
});
test("D1: one row per player (their best), ranks against other players' bests, own row marked only for the viewer", async ({ request, baseURL }) => {
  const headers = await connect(request, baseURL!);
  const me = randomUUID(), rival = randomUUID();
  const mine = await register(request, headers, me);
  const rivals = await register(request, headers, rival);
  // Scores above every other test's rows, so the ordering here is deterministic.
  const best = { ...score(), score: 95001, player: me, secret: mine.secret };
  const lesser = { ...score(), score: 94999, player: me, secret: mine.secret };
  const rivalBest = { ...score(), score: 95000, player: rival, secret: rivals.secret };
  const oldClient = { ...score(), score: 94998 };
  for (const data of [lesser, best, rivalBest, oldClient]) expect((await request.post("/api/scores", { headers, data })).status()).toBe(201);
  expect((await request.post("/api/scores", { headers, data: { ...score(), player: "me" } })).status()).toBe(400);
  const rows = (await (await request.get("/api/scores?mode=endless")).json()).scores as { id: string; mine?: boolean }[];
  expect(rows.slice(0, 3).map((r) => r.id)).toEqual([best.id, rivalBest.id, oldClient.id]);
  expect(rows.some((r) => r.id === lesser.id)).toBe(false);
  expect(rows.some((r) => "mine" in r)).toBe(false);
  const viewed = (await (await request.get(`/api/scores?mode=endless&player=${me}`)).json()).scores as { id: string; mine?: boolean }[];
  expect(viewed.filter((r) => r.mine).map((r) => r.id)).toEqual([best.id]);
  expect((await request.get("/api/scores?mode=endless&player=me")).status()).toBe(400);
  // A play below the player's own best is ranked as if it stood alone: only the rival is ahead.
  const around = await (await request.get(`/api/scores?mode=endless&around=${lesser.id}`)).json();
  expect(around.rank).toBe(2);
  expect(around.scores.map((r: { id: string }) => r.id)).toEqual([rivalBest.id, lesser.id, oldClient.id]);
  expect(around.total).toBeGreaterThanOrEqual(rows.length);
  // The player counts once in the total whichever of their plays is looked up.
  const aroundBest = await (await request.get(`/api/scores?mode=endless&around=${best.id}`)).json();
  expect(aroundBest.rank).toBe(1);
  expect(aroundBest.total).toBe(around.total);
});
test("D1: old clients can still publish and read their own rule-specific rankings", async ({ request, baseURL }) => {
  const headers = await connect(request, baseURL!);
  for (const [mode, rules] of [["endless", "scores-v1"], ["timeattack", "scores-v1"], ["timeattack", "scores-ta-v2"]] as const) {
    const old = { ...score(mode), rules };
    expect((await request.post("/api/scores", { headers, data: old })).status()).toBe(201);
    const query = `mode=${mode}&rules=${rules}`;
    const rows = await (await request.get(`/api/scores?${query}`)).json();
    expect(rows.scores.some((row: { id: string }) => row.id === old.id)).toBe(true);
    expect((await request.get(`/api/scores?${query}&around=${old.id}`)).status()).toBe(200);
    expect((await request.get(`/api/scores?mode=${mode}&around=${old.id}`)).status()).toBe(404);
  }
});
test("D1: public top 50, mode separation, chain/date ordering and idempotent uploads", async ({ request, baseURL }) => {
  const headers = await connect(request, baseURL!);
  const first = score();
  expect((await request.post("/api/scores", { headers, data: first })).status()).toBe(201);
  expect((await request.post("/api/scores", { headers, data: first })).status()).toBe(200);
  expect((await request.post("/api/scores", { headers, data: { ...first, score: 89999 } })).status()).toBe(409);
  const higherChain = { ...score(), maxChain: 8 };
  const later = score();
  const time = score("timeattack");
  for (const data of [higherChain, later, time]) expect((await request.post("/api/scores", { headers, data })).status()).toBe(201);
  const rows = (await (await request.get("/api/scores?mode=endless")).json()).scores;
  const ids = rows.map((r: { id: string }) => r.id);
  expect(ids.indexOf(higherChain.id)).toBeLessThan(ids.indexOf(first.id));
  expect(ids.indexOf(first.id)).toBeLessThan(ids.indexOf(later.id));
  expect(ids).not.toContain(time.id);
  expect(Object.keys(rows[0]).sort()).toEqual(["createdAt", "id", "maxChain", "name", "score"]);
  expect((await (await request.get("/api/scores?mode=timeattack")).json()).scores.some((r: { id: string }) => r.id === time.id)).toBe(true);
  const around = await (await request.get(`/api/scores?mode=endless&around=${first.id}`)).json();
  expect(around.rank).toBe(ids.indexOf(first.id) + 1);
  expect(around.scores.map((r: { id: string }) => r.id)).toEqual([higherChain.id, first.id, later.id]);
  expect(around.scores.map((r: { rank: number }) => r.rank)).toEqual([around.rank - 1, around.rank, around.rank + 1]);
  expect((await request.get(`/api/scores?mode=timeattack&around=${first.id}`)).status()).toBe(404);
  expect((await request.get("/api/scores?mode=endless&around=bad")).status()).toBe(400);
});
test("D1: invalid payloads, origins, versions, no session and rate limits", async ({ request, baseURL }) => {
  expect((await request.get("/api/scores?mode=endless")).status()).toBe(200);
  expect((await request.post("/api/scores", { headers: { Origin: baseURL! }, data: score() })).status()).toBe(401);
  const headers = await connect(request, baseURL!);
  expect((await request.post("/api/scores", { headers: { ...headers, Origin: "https://evil.example" }, data: score() })).status()).toBe(403);
  for (const patch of [{ rules: "old" }, { score: 100000 }, { frames: 0 }, { name: "<x>\n" }, { mode: "cpu" }])
    expect((await request.post("/api/scores", { headers, data: { ...score(), ...patch } })).status()).toBe(400);
  expect((await request.post("/api/scores", { headers, data: { name: "a".repeat(5000) } })).status()).toBe(413);
  expect((await request.get("/api/scores?mode=cpu")).status()).toBe(400);
  expect((await request.get("/api/scores?mode=endless&rules=old")).status()).toBe(400);
  const outcomes = await Promise.all(Array.from({ length: 65 }, () => request.post("/api/scores", { headers, data: { ...score(), score: 10, maxChain: 1 } })));
  expect(outcomes.filter((r) => r.status() === 201)).toHaveLength(60);
  expect(outcomes.filter((r) => r.status() === 429)).toHaveLength(5);
  expect((await (await request.get("/api/scores?mode=endless")).json()).scores).toHaveLength(50);
  const bottom = { ...score(), score: 0, maxChain: 1 };
  expect((await request.post("/api/scores", { headers: await connect(request, baseURL!), data: bottom })).status()).toBe(201);
  const around = await (await request.get(`/api/scores?mode=endless&around=${bottom.id}`)).json();
  expect(around.rank).toBeGreaterThan(50);
  expect(around.rank).toBe(around.total);
  expect(around.scores.at(-1).id).toBe(bottom.id);
  expect(around.scores).toHaveLength(2);
});
