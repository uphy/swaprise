import { displayName } from "../net/protocol";
import { scoreRules, validSubmission, type Submission, type ScoreMode, type RankedScore, type ScoreStanding } from "./model";

const NAME = "swaprise.name.v1";
const CONSENT = "swaprise.scores.publish.v1";
const QUEUE = "swaprise.scores.pending.v1";
const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string): void => { try { localStorage.setItem(key, value); } catch { /* Full/private storage must not interrupt play. */ } };
export const playerName = (): string => read(NAME) ?? "";
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
export function enqueueScore(score: Omit<Submission, "name" | "rules">): void {
  if (publication() !== true) return;
  const value = { ...score, name: displayName(playerName()), rules: scoreRules(score.mode) };
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
    if (!(await post("session", {})).ok) return;
    for (const score of pendingScores()) {
      if (publication() !== true || signal.aborted) break;
      const response = await post("scores", score);
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
export async function ranking(mode: ScoreMode, signal: AbortSignal): Promise<RankedScore[]> {
  const response = await fetch(`/api/scores?mode=${mode}&rules=${scoreRules(mode)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
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
