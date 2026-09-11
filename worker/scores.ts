import type { Env } from "./types";
import { scoreRules, supportedScoreRules, scoreMode, validSubmission, type Submission } from "../src/scores/model";

const json = (data: unknown, status = 200): Response => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function scores(request: Request, env: Env, session?: string): Promise<Response> {
  if (!env.SCORES_DB) return json({ error: "Rankings are currently unavailable." }, 503);
  const url = new URL(request.url);
  if (request.method === "GET") {
    const mode = url.searchParams.get("mode");
    if (!scoreMode(mode)) return json({ error: "Unsupported ranking." }, 400);
    const rules = url.searchParams.get("rules") ?? scoreRules(mode);
    if (!supportedScoreRules(mode, rules))
      return json({ error: "Unsupported ranking." }, 400);
    if (url.searchParams.has("around")) {
      const id = url.searchParams.get("around")!;
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) return json({ error: "Invalid score ID." }, 400);
      // Match the top-50 ordering exactly, including tie breakers. All results
      // come from one SQLite snapshot; no names/session identifiers identify a player.
      const before = `(s.score > t.score OR (s.score = t.score AND (s.max_chain > t.max_chain OR
        (s.max_chain = t.max_chain AND (s.created_at < t.created_at OR (s.created_at = t.created_at AND s.id < t.id))))))`;
      const after = `(s.score < t.score OR (s.score = t.score AND (s.max_chain < t.max_chain OR
        (s.max_chain = t.max_chain AND (s.created_at > t.created_at OR (s.created_at = t.created_at AND s.id > t.id))))))`;
      const result = await env.SCORES_DB.prepare(`WITH target AS (
        SELECT * FROM scores WHERE rules = ? AND mode = ? AND id = ?
      ), previous AS (
        SELECT s.*, -1 AS delta FROM scores s, target t WHERE s.rules = t.rules AND s.mode = t.mode AND ${before}
        ORDER BY s.score, s.max_chain, s.created_at DESC, s.id DESC LIMIT 1
      ), following AS (
        SELECT s.*, 1 AS delta FROM scores s, target t WHERE s.rules = t.rules AND s.mode = t.mode AND ${after}
        ORDER BY s.score DESC, s.max_chain DESC, s.created_at, s.id LIMIT 1
      ), neighbors AS (
        SELECT * FROM previous UNION ALL SELECT *, 0 AS delta FROM target UNION ALL SELECT * FROM following
      ), stats AS (
        SELECT COUNT(*) AS total, 1 + SUM(CASE WHEN ${before} THEN 1 ELSE 0 END) AS targetRank
        FROM scores s, target t WHERE s.rules = t.rules AND s.mode = t.mode
      ) SELECT n.id, n.name, n.score, n.max_chain AS maxChain, n.created_at AS createdAt,
        targetRank + delta AS rank, total, targetRank FROM neighbors n, stats ORDER BY rank`)
        .bind(rules, mode, id).all<{ id: string; name: string; score: number; maxChain: number; createdAt: number; rank: number; total: number; targetRank: number }>();
      if (!result.results.length) return json({ error: "Score not published yet." }, 404);
      const first = result.results[0];
      return json({ rank: first.targetRank, total: first.total, scores: result.results.map(({ total, targetRank, ...row }) => row) });
    }
    const rows = await env.SCORES_DB.prepare(`SELECT id, name, score, max_chain AS maxChain, created_at AS createdAt
      FROM scores WHERE rules = ? AND mode = ? ORDER BY score DESC, max_chain DESC, created_at, id LIMIT 50`)
      .bind(rules, mode).all();
    return json({ rules, mode, scores: rows.results });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!session) return json({ error: "Please reconnect." }, 401);
  // Enforce the actual body length as well as Content-Length (which clients can omit).
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Invalid score." }, 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 4096) { await reader.cancel(); return json({ error: "Request too large." }, 413); }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  let s: unknown;
  try { s = JSON.parse(new TextDecoder().decode(body)); } catch { return json({ error: "Invalid score." }, 400); }
  if (!validSubmission(s)) return json({ error: "Invalid score or rules version." }, 400);
  const payload = s;
  // Do not store raw IPs or session cookies. A daily hash limits cheap session resets;
  // the date also avoids retaining a stable IP-derived identity across days.
  const now = Date.now();
  const identity = `${Math.floor(now / 86400000)}:${request.headers.get("CF-Connecting-IP") ?? session}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const submitter = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
  const existing = async (): Promise<Response | null> => {
    const row = await env.SCORES_DB.prepare("SELECT id, rules, mode, name, score, max_chain AS maxChain, seed, frames FROM scores WHERE id = ?")
      .bind(payload.id).first<Submission>();
    if (!row) return null;
    return Object.keys(row).every((key) => row[key as keyof Submission] === payload[key as keyof Submission])
      ? json({ ok: true, id: row.id }) : json({ error: "Score ID already used." }, 409);
  };
  const duplicate = await existing();
  if (duplicate) return duplicate;
  // Rate check and insert in one SQLite statement: concurrent requests cannot exceed it.
  const result = await env.SCORES_DB.prepare(`INSERT INTO scores
    (id, rules, mode, name, score, max_chain, seed, frames, created_at, submitter)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE
    (SELECT COUNT(*) FROM scores WHERE submitter = ? AND created_at >= ?) < 60
    ON CONFLICT(id) DO NOTHING`)
    .bind(payload.id, payload.rules, payload.mode, payload.name, payload.score, payload.maxChain, payload.seed, payload.frames,
      now, submitter, submitter, now - 3600000).run();
  if (result.meta.changes) return json({ ok: true, id: payload.id }, 201);
  return await existing() ?? json({ error: "Too many scores. Try again later." }, 429);
}
