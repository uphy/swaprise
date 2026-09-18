import type { Env } from "./types";
import { PLAYER_ID, plausibleScore, scoreRules, supportedScoreRules, scoreMode, validSubmission, type Submission } from "../src/scores/model";
import { verifyPlayer } from "./players";

const json = (data: unknown, status = 200): Response => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
/** swaps 列は migration 0005 より前の記録では NULL。JSON には数値のときだけ載せ、クライアントは無ければ 1 手あたりを出さない */
const withSwaps = <T extends { swaps: number | null }>({ swaps, ...row }: T): Omit<T, "swaps"> & { swaps?: number } =>
  swaps === null ? row : { ...row, swaps };
export async function scores(request: Request, env: Env, session?: string): Promise<Response> {
  if (!env.SCORES_DB) return json({ error: "Rankings are currently unavailable." }, 503);
  const url = new URL(request.url);
  if (request.method === "GET") {
    const mode = url.searchParams.get("mode");
    if (!scoreMode(mode)) return json({ error: "Unsupported ranking." }, 400);
    const rules = url.searchParams.get("rules") ?? scoreRules(mode);
    if (!supportedScoreRules(mode, rules))
      return json({ error: "Unsupported ranking." }, 400);
    const viewer = url.searchParams.get("player");
    if (viewer !== null && !PLAYER_ID.test(viewer)) return json({ error: "Invalid player ID." }, 400);
    // Ranking order, including tie breakers: `a` sorts before `b`.
    const before = (a: string, b: string): string => `(${a}.score > ${b}.score OR (${a}.score = ${b}.score AND (${a}.max_chain > ${b}.max_chain OR
        (${a}.max_chain = ${b}.max_chain AND (${a}.created_at < ${b}.created_at OR (${a}.created_at = ${b}.created_at AND ${a}.id < ${b}.id))))))`;
    // One row per player: a play is that player's best when none of their other plays sorts before it.
    // The (rules, mode, player, ...) index answers each lookup without scanning.
    const best = `NOT EXISTS (SELECT 1 FROM scores b WHERE b.rules = s.rules AND b.mode = s.mode AND b.player = s.player AND ${before("b", "s")})`;
    if (url.searchParams.has("around")) {
      const id = url.searchParams.get("around")!;
      if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) return json({ error: "Invalid score ID." }, 400);
      // Rank this play against the other players' bests. The player's own other plays are left out, so a play
      // below their best still gets the rank it would hold on its own. All results come from one SQLite
      // snapshot; no names/session identifiers identify a player.
      const result = await env.SCORES_DB.prepare(`WITH target AS (
        SELECT * FROM scores WHERE rules = ? AND mode = ? AND id = ?
      ), others AS (
        SELECT s.* FROM scores s, target t WHERE s.rules = t.rules AND s.mode = t.mode AND s.player <> t.player AND ${best}
      ), previous AS (
        SELECT s.*, -1 AS delta FROM others s, target t WHERE ${before("s", "t")}
        ORDER BY s.score, s.max_chain, s.created_at DESC, s.id DESC LIMIT 1
      ), following AS (
        SELECT s.*, 1 AS delta FROM others s, target t WHERE ${before("t", "s")}
        ORDER BY s.score DESC, s.max_chain DESC, s.created_at, s.id LIMIT 1
      ), neighbors AS (
        SELECT * FROM previous UNION ALL SELECT *, 0 AS delta FROM target UNION ALL SELECT * FROM following
      ), stats AS (
        SELECT 1 + COUNT(*) AS total, 1 + COALESCE(SUM(CASE WHEN ${before("s", "t")} THEN 1 ELSE 0 END), 0) AS targetRank
        FROM others s, target t
      ) SELECT n.id, n.name, n.score, n.max_chain AS maxChain, n.created_at AS createdAt, n.swaps,
        targetRank + delta AS rank, total, targetRank FROM neighbors n, stats ORDER BY rank`)
        .bind(rules, mode, id).all<{ id: string; name: string; score: number; maxChain: number; createdAt: number; swaps: number | null; rank: number; total: number; targetRank: number }>();
      if (!result.results.length) return json({ error: "Score not published yet." }, 404);
      const first = result.results[0];
      return json({ rank: first.targetRank, total: first.total, scores: result.results.map(({ total, targetRank, ...row }) => withSwaps(row)) });
    }
    // Walks the ranking index in order and stops after 50 bests; a play below its player's best costs one lookup.
    const rows = await env.SCORES_DB.prepare(`SELECT id, name, score, max_chain AS maxChain, created_at AS createdAt, swaps, player = ? AS mine
      FROM scores s WHERE rules = ? AND mode = ? AND ${best} ORDER BY score DESC, max_chain DESC, created_at, id LIMIT 50`)
      .bind(viewer ?? "", rules, mode).all<{ id: string; name: string; score: number; maxChain: number; createdAt: number; swaps: number | null; mine: number }>();
    // Player ids stay private: only the viewer's own rows are marked, and only when they asked.
    return json({ rules, mode, scores: rows.results.map(({ mine, ...row }) => mine ? { ...withSwaps(row), mine: true } : withSwaps(row)) });
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
  if (!plausibleScore(s)) return json({ error: "Implausible score." }, 400);
  // A play under a player id must come with that id's secret (worker/players.ts); otherwise anyone could
  // publish under someone else's name. Old clients send no player id and are not checked.
  const { secret, ...submitted } = s as Submission & { secret?: unknown };
  if (submitted.player !== undefined && !(await verifyPlayer(env, submitted.player, secret))) return json({ error: "Player not verified." }, 400);
  // Old clients send no player id; group their plays by name, as migration 0004 did for old rows.
  const payload: Submission & { player: string } = { ...submitted, player: submitted.player ?? `name:${submitted.name}` };
  // Do not store raw IPs or session cookies. A daily hash limits cheap session resets;
  // the date also avoids retaining a stable IP-derived identity across days.
  const now = Date.now();
  const identity = `${Math.floor(now / 86400000)}:${request.headers.get("CF-Connecting-IP") ?? session}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  const submitter = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
  const existing = async (): Promise<Response | null> => {
    const row = await env.SCORES_DB.prepare("SELECT id, rules, mode, name, score, max_chain AS maxChain, seed, frames, player, swaps FROM scores WHERE id = ?")
      .bind(payload.id).first<Submission & { player: string; swaps: number | null }>();
    if (!row) return null;
    // 古い投稿は swaps を持たない（列は NULL）。再送で undefined と NULL を別物にしない
    return Object.keys(row).every((key) => (row[key as keyof Submission] ?? undefined) === payload[key as keyof Submission])
      ? json({ ok: true, id: row.id }) : json({ error: "Score ID already used." }, 409);
  };
  const duplicate = await existing();
  if (duplicate) return duplicate;
  // Rate check and insert in one SQLite statement: concurrent requests cannot exceed it.
  const result = await env.SCORES_DB.prepare(`INSERT INTO scores
    (id, rules, mode, name, score, max_chain, seed, frames, created_at, submitter, player, swaps)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE
    (SELECT COUNT(*) FROM scores WHERE submitter = ? AND created_at >= ?) < 60
    ON CONFLICT(id) DO NOTHING`)
    .bind(payload.id, payload.rules, payload.mode, payload.name, payload.score, payload.maxChain, payload.seed, payload.frames,
      now, submitter, payload.player, payload.swaps ?? null, submitter, now - 3600000).run();
  if (result.meta.changes) return json({ ok: true, id: payload.id }, 201);
  return await existing() ?? json({ error: "Too many scores. Try again later." }, 429);
}
