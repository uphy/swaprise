import type { Env } from "./types";
import { PLAYER_ID } from "../src/scores/model";

const hex = (bytes: ArrayBuffer | Uint8Array): string => Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("");
const digest = async (secret: string): Promise<string> => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)));

/** 秘密が合うか。表にない id は誰のものでもないので false */
export async function verifyPlayer(env: Env, player: string, secret: unknown): Promise<boolean> {
  if (typeof secret !== "string" || !/^[0-9a-f]{64}$/.test(secret)) return false;
  const row = await env.SCORES_DB.prepare("SELECT secret_hash FROM players WHERE id = ?").bind(player).first<{ secret_hash: string }>();
  return row !== null && row.secret_hash === await digest(secret);
}

/**
 * 端末の匿名 id の持ち主を決める。最初に名乗った端末が持ち主で、秘密を 1 度だけ渡す。
 * 持ち主でない端末（秘密がない・合わない）が名乗ったら、新しい id と秘密を発行して返す。
 * 端末は返ってきた id を自分の id として使うので、保存領域の一部を失った端末も投稿を続けられる。
 */
export async function registerPlayer(env: Env, body: unknown): Promise<{ player: string; secret?: string } | null> {
  const requested = body && typeof body === "object" ? (body as { player?: unknown; secret?: unknown }) : {};
  if (typeof requested.player !== "string" || !PLAYER_ID.test(requested.player)) return null;
  if (await verifyPlayer(env, requested.player, requested.secret)) return { player: requested.player };
  const claim = async (player: string): Promise<{ player: string; secret: string } | null> => {
    const secret = hex(crypto.getRandomValues(new Uint8Array(32)));
    const result = await env.SCORES_DB.prepare("INSERT INTO players (id, secret_hash, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING")
      .bind(player, await digest(secret), Date.now()).run();
    return result.meta.changes ? { player, secret } : null;
  };
  // 名乗った id が空いていればその端末のもの。取られていれば新しい id にする（衝突は事実上ないが、念のため数回試す）
  for (const player of [requested.player, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]) {
    const claimed = await claim(player);
    if (claimed) return claimed;
  }
  return null;
}
