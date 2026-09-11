import type { Env } from "./types";
import { SCORE_RULES, scoreMode, validSubmission, type Submission } from "../src/scores/model";

const json = (data: unknown, status = 200): Response => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function scores(request: Request, env: Env, session?: string): Promise<Response> {
  if (!env.SCORES_DB) return json({ error: "Rankings are currently unavailable." }, 503);
  const url = new URL(request.url);
  if (request.method === "GET") {
    const mode = url.searchParams.get("mode");
    if (!scoreMode(mode) || (url.searchParams.has("rules") && url.searchParams.get("rules") !== SCORE_RULES))
      return json({ error: "Unsupported ranking." }, 400);
    const rows = await env.SCORES_DB.prepare(`SELECT id, name, score, max_chain AS maxChain, created_at AS createdAt
      FROM scores WHERE rules = ? AND mode = ? ORDER BY score DESC, max_chain DESC, created_at, id LIMIT 50`)
      .bind(SCORE_RULES, mode).all();
    return json({ rules: SCORE_RULES, mode, scores: rows.results });
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
