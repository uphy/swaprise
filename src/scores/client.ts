import { displayName } from "../net/protocol";
import { scoreRules, validSubmission, type Submission, type ScoreMode, type RankedScore, type ScoreStanding } from "./model";

const NAME = "swaprise.name.v1";
const PLAYER = "swaprise.player.v1";
/** player の持ち主である証。初回の投稿時にサーバーから 1 度だけ受け取る。他の端末や人には見せない */
const SECRET = "swaprise.player.secret.v1";
const CONSENT = "swaprise.scores.publish.v1";
const QUEUE = "swaprise.scores.pending.v1";
const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string): void => { try { localStorage.setItem(key, value); } catch { /* Full/private storage must not interrupt play. */ } };
export const playerName = (): string => read(NAME) ?? "";
/** 端末の匿名 id。初回に作って持ち続け、相手の端末が相手別の戦績を数える鍵にする。名前と違って変えられない */
export function playerId(): string {
  const saved = read(PLAYER);
  if (saved && /^[0-9a-f-]{36}$/.test(saved)) return saved;
  const id = crypto.randomUUID();
  write(PLAYER, id);
  return id;
}
export const savePlayerName = (name: string): string => { const value = displayName(name); write(NAME, value); return value; };
export const publication = (): boolean | null => read(CONSENT) === null ? null : read(CONSENT) === "true";
let controller: AbortController | null = null;
export function setPublication(enabled: boolean): void {
  write(CONSENT, String(enabled));
  if (!enabled) { controller?.abort(); write(QUEUE, "[]"); }
  else void flushScores();
}
export function pendingScores(): Submission[] {
  try {
    const list: unknown = JSON.parse(read(QUEUE) ?? "[]");
    return Array.isArray(list) ? list.filter(validSubmission).slice(-50) : [];
  } catch { return []; }
}
export function enqueueScore(score: Omit<Submission, "name" | "rules" | "player">): void {
  if (publication() !== true) return;
  const value = { ...score, name: displayName(playerName()), rules: scoreRules(score.mode), player: playerId() };
  if (!validSubmission(value)) return;
  const pending = pendingScores();
  if (!pending.some((entry) => entry.id === value.id)) write(QUEUE, JSON.stringify([...pending, value].slice(-50)));
  void flushScores();
}
let flushing = false;
let retry: ReturnType<typeof setTimeout> | undefined;
/** At-least-once delivery; per-play UUIDs make retries idempotent on the server. */
export async function flushScores(): Promise<void> {
  if (flushing || publication() !== true || !pendingScores().length) return;
  flushing = true;
  controller = new AbortController();
  const signal = controller.signal;
  const post = (path: string, data: unknown): Promise<Response> => fetch(`/api/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
  });
  try {
    // セッションと一緒に player の持ち主を登録する。初回は秘密が返る。id が他の端末のものだったら新しい id が返るので、
    // 端末の id と送信待ちの記録をその id に付け替える（worker/players.ts）
    const session = await post("session", { player: playerId(), secret: read(SECRET) ?? undefined });
    if (!session.ok) return;
    const issued = await session.json().catch(() => ({})) as { player?: string; secret?: string };
    if (typeof issued.secret === "string") write(SECRET, issued.secret);
    if (typeof issued.player === "string" && issued.player !== playerId()) {
      write(PLAYER, issued.player);
      write(QUEUE, JSON.stringify(pendingScores().map((entry) => ({ ...entry, player: issued.player }))));
    }
    for (const score of pendingScores()) {
      if (publication() !== true || signal.aborted) break;
      const response = await post("scores", { ...score, secret: read(SECRET) ?? undefined });
      if (response.ok || [400, 409, 413].includes(response.status)) {
        write(QUEUE, JSON.stringify(pendingScores().filter((entry) => entry.id !== score.id)));
      } else break;
    }
  } catch { /* Retry after reconnection, without blocking play. */ }
  finally {
    flushing = false;
    controller = null;
    if (typeof window !== "undefined") window.dispatchEvent(new Event("swaprise:scores-updated"));
    clearTimeout(retry);
    if (publication() === true && pendingScores().length) retry = setTimeout(() => void flushScores(), 60000);
  }
}
/** 上位 50 件（1 人 1 件）。自分の端末の行には mine が付く */
export async function ranking(mode: ScoreMode, signal: AbortSignal): Promise<RankedScore[]> {
  const response = await fetch(`/api/scores?mode=${mode}&rules=${scoreRules(mode)}&player=${playerId()}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  if (!response.ok) throw new Error("Ranking unavailable");
  const result = await response.json() as { scores: RankedScore[] };
  if (!Array.isArray(result.scores)) throw new Error("Invalid ranking");
  return result.scores;
}
export async function standing(mode: ScoreMode, id: string, signal: AbortSignal): Promise<ScoreStanding | null> {
  const response = await fetch(`/api/scores?mode=${mode}&rules=${scoreRules(mode)}&around=${encodeURIComponent(id)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Ranking unavailable");
  return await response.json() as ScoreStanding;
}
export function startScoreSync(): void {
  window.addEventListener("online", () => void flushScores());
  window.addEventListener("storage", (event) => {
    if ((event.key === CONSENT || event.key === null) && publication() !== true) setPublication(false);
    else void flushScores();
  });
  void flushScores();
}
