import { expect, test, type APIRequestContext } from "@playwright/test";
import { scoreRules, type ScoreMode } from "../src/scores/model";
import { randomUUID } from "node:crypto";

const score = (mode: ScoreMode = "endless") => ({ id: randomUUID(), rules: scoreRules(mode), mode, name: "D1 player", score: 90000, maxChain: 7, seed: 123, frames: 600 });
async function connect(request: APIRequestContext, baseURL: string): Promise<Record<string, string>> {
  const headers = { Origin: baseURL, "CF-Connecting-IP": `test-${randomUUID()}` };
  expect((await request.post("/api/session", { headers })).ok()).toBe(true);
  return headers;
}
test("D1: public top 50, mode separation, chain/date ordering and idempotent uploads", async ({ request, baseURL }) => {
  const headers = await connect(request, baseURL!);
  const first = score();
  expect((await request.post("/api/scores", { headers, data: first })).status()).toBe(201);
  expect((await request.post("/api/scores", { headers, data: first })).status()).toBe(200);
  expect((await request.post("/api/scores", { headers, data: { ...first, score: 99 } })).status()).toBe(409);
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
  const outcomes = await Promise.all(Array.from({ length: 65 }, () => request.post("/api/scores", { headers, data: { ...score(), score: 10 } })));
  expect(outcomes.filter((r) => r.status() === 201)).toHaveLength(60);
  expect(outcomes.filter((r) => r.status() === 429)).toHaveLength(5);
  expect((await (await request.get("/api/scores?mode=endless")).json()).scores).toHaveLength(50);
  const bottom = { ...score(), score: 0 };
  expect((await request.post("/api/scores", { headers: await connect(request, baseURL!), data: bottom })).status()).toBe(201);
  const around = await (await request.get(`/api/scores?mode=endless&around=${bottom.id}`)).json();
  expect(around.rank).toBeGreaterThan(50);
  expect(around.rank).toBe(around.total);
  expect(around.scores.at(-1).id).toBe(bottom.id);
  expect(around.scores).toHaveLength(2);
});
