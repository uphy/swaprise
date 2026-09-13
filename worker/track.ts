/// <reference types="@cloudflare/workers-types" />
import type { Env } from "./types";
import { parseTrack, toTrackRow } from "../src/net/track";

/**
 * 利用の計測。クライアントが送る出来事を Workers Analytics Engine に 1 行ずつ書く。
 * 個人を特定する情報は持たない。IP は保存せず、端末の匿名 id（swaprise.player.v1）だけを index にして
 * 「1 週間後に戻ってきた端末の数」を数えられるようにする。バインディングが無い環境（ローカル・テスト）では何もしない。
 */
export async function track(request: Request, env: Env): Promise<Response> {
  const reply = (error: string, status: number): Response => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return reply("Not found.", 404);
  if (Number(request.headers.get("Content-Length") ?? 0) > 2048) return reply("Request too large.", 413);
  let body: unknown;
  try { body = await request.json(); } catch { return reply("Bad request.", 400); }
  const payload = parseTrack(body);
  if (!payload) return reply("Bad request.", 400);
  const country = typeof request.cf?.country === "string" ? request.cf.country : "";
  try { env.EVENTS?.writeDataPoint(toTrackRow(payload, country)); } catch { /* 計測の失敗で遊びを止めない */ }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
