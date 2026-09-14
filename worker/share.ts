/// <reference types="@cloudflare/workers-types" />
/**
 * 結果の共有 URL。
 * - GET /r?m=…       index.html の og:* をその結果の内容に書き換えて返す。人が開けばそのままメニューが出る
 * - GET /api/ogp.png?m=… その結果のカード（1200×630 PNG）を描いて返す
 * どちらも公開の GET で、対戦のセッション cookie や Origin の確認は要らない。同じ URL の画像は edge cache に残す。
 */
import type { Env } from "./types";
import { CARD_H, CARD_W, encodePng, renderCard } from "../src/ogp/card";
import { cardMeta, cardSpec, parseShare, type ShareResult, type ShareStanding } from "../src/ogp/spec";
import { scoreMode } from "../src/scores/model";

const RANK_BEFORE = `(s.score > t.score OR (s.score = t.score AND (s.max_chain > t.max_chain OR
  (s.max_chain = t.max_chain AND (s.created_at < t.created_at OR (s.created_at = t.created_at AND s.id < t.id))))))`;

/** 公開済みの記録なら順位と、D1 に入っている得点・連鎖（URL の自己申告より優先）を返す */
async function standingOf(env: Env, r: ShareResult): Promise<{ standing: ShareStanding; score: number; chain: number } | null> {
  if (!env.SCORES_DB || (r.mode !== "endless" && r.mode !== "timeattack") || !r.id) return null;
  try {
    const row = await env.SCORES_DB.prepare(`WITH t AS (SELECT * FROM scores WHERE id = ?)
      SELECT t.mode, t.score, t.max_chain AS chain,
        (SELECT COUNT(*) FROM scores s, t WHERE s.rules = t.rules AND s.mode = t.mode AND ${RANK_BEFORE}) + 1 AS rank,
        (SELECT COUNT(*) FROM scores s, t WHERE s.rules = t.rules AND s.mode = t.mode) AS total
      FROM t`).bind(r.id).first<{ mode: string; score: number; chain: number; rank: number; total: number }>();
    if (!row || !scoreMode(row.mode) || row.mode !== r.mode) return null;
    return { standing: { rank: row.rank, total: row.total }, score: row.score, chain: row.chain };
  } catch {
    return null;
  }
}

async function resolve(env: Env, r: ShareResult): Promise<{ result: ShareResult; standing: ShareStanding | null }> {
  const found = await standingOf(env, r);
  if (!found || r.mode !== "endless" && r.mode !== "timeattack") return { result: r, standing: null };
  return { result: { ...r, score: found.score, chain: found.chain }, standing: found.standing };
}

/** /r。結果が読めなければ書き換えずに index.html をそのまま返す */
export async function sharePage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new Request(new URL("/", url), { headers: request.headers }));
  const r = parseShare(url.searchParams);
  if (!r) return page;
  const { result, standing } = await resolve(env, r);
  const meta = cardMeta(result, standing);
  // 開かれたホストで絶対 URL にする。プレビュー環境ならプレビューの画像を指し、クローラがそのまま取りに来られる
  // （wrangler dev だけは routes の custom_domain のホストになる）
  const image = `${url.origin}/api/ogp.png?${url.searchParams.toString()}`;
  const content: Record<string, string> = {
    "og:title": meta.title,
    "og:description": meta.description,
    "og:url": url.toString(),
    "og:image": image,
    "og:image:alt": meta.title,
    "og:image:width": String(CARD_W),
    "og:image:height": String(CARD_H),
  };
  const rewritten = new HTMLRewriter()
    .on("meta[property]", {
      element(el) {
        const value = content[el.getAttribute("property") ?? ""];
        if (value !== undefined) el.setAttribute("content", value);
      },
    })
    .on("meta[name=\"description\"]", { element(el) { el.setAttribute("content", meta.description); } })
    .on("title", { element(el) { el.setInnerContent(meta.title); } })
    .transform(page);
  const headers = new Headers(rewritten.headers);
  headers.set("Cache-Control", "public, max-age=600");
  return new Response(rewritten.body, { status: rewritten.status, headers });
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** /api/ogp.png */
export async function shareImage(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const r = parseShare(url.searchParams);
  if (!r) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;
  const { result, standing } = await resolve(env, r);
  const png = await encodePng(CARD_W, CARD_H, renderCard(cardSpec(result, standing)), deflate);
  const response = new Response(png, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
  ctx.waitUntil(cache.put(request, response.clone()));
  return response;
}
