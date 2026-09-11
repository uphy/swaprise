import { scoreRules, type ScoreMode } from "./model";

export interface Progress { best: number | null; average: number | null; count: number }
/** Separate from the top-five table: it cannot represent recent attempts.
 * Only standard runs are included, and comparisons exclude the current run. */
export function recordProgress(mode: ScoreMode, score: number, previousBest: number | null = null): Progress {
  const key = `swaprise.progress.${scoreRules(mode)}.${mode}`;
  let recent: number[] = [], best: number | null = null;
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (Array.isArray(data.recent)) recent = data.recent.filter((v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 99999).slice(-5);
    if (Number.isInteger(data.best) && data.best >= 0 && data.best <= 99999) best = data.best;
  } catch { /* Invalid or unavailable storage starts a new history. */ }
  if (previousBest !== null && Number.isFinite(previousBest)) best = Math.max(best ?? 0, previousBest);
  const result = { best, average: recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null, count: recent.length };
  try { localStorage.setItem(key, JSON.stringify({ best: Math.max(best ?? 0, score), recent: [...recent, score].slice(-5) })); } catch { /* Keep playing. */ }
  return result;
}
