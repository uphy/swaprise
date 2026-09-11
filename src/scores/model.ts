/** Bump independently of the multiplayer protocol when scoring/gameplay changes. */
export const SCORE_RULES = "scores-v2";
export type ScoreMode = "endless" | "timeattack";
/** Deadline settlement changes scoring for time attack only. */
export const scoreRules = (mode: ScoreMode): string => mode === "timeattack" ? "scores-ta-v3" : SCORE_RULES;
/** Keep old clients and queued plays working without relabeling their rules. */
export const supportedScoreRules = (mode: ScoreMode, rules: unknown): rules is string =>
  typeof rules === "string" && (rules === scoreRules(mode) || rules === "scores-v1" || (mode === "timeattack" && rules === "scores-ta-v2"));
export interface Submission {
  id: string;
  rules: string;
  mode: ScoreMode;
  name: string;
  score: number;
  maxChain: number;
  seed: number;
  frames: number;
}
export interface RankedScore {
  id: string;
  name: string;
  score: number;
  maxChain: number;
  createdAt: number;
}
export interface ScoreStanding {
  rank: number;
  total: number;
  scores: (RankedScore & { rank: number })[];
}
export const scoreMode = (value: unknown): value is ScoreMode => value === "endless" || value === "timeattack";
const integer = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
export function validSubmission(v: unknown): v is Submission {
  if (!v || typeof v !== "object") return false;
  const s = v as Submission;
  return typeof s.id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s.id)
    && scoreMode(s.mode) && supportedScoreRules(s.mode, s.rules)
    && typeof s.name === "string" && Array.from(s.name).length >= 1 && Array.from(s.name).length <= 20
    && s.name === s.name.trim() && !/[\p{C}\p{Zl}\p{Zp}]/u.test(s.name)
    && integer(s.score, 0, 99999) && integer(s.maxChain, 0, 9999)
    && integer(s.seed, 0, 0xffffffff) && integer(s.frames, 1, s.mode === "timeattack" ? 7200 : 5184000);
}
/** Seed/debug overrides are not the standard ranking rules, even if the score looks normal. */
export function eligibleRun(mode: string, params: URLSearchParams): mode is ScoreMode {
  return scoreMode(mode) && !["seed", "speed", "time", "shock"].some((key) => params.has(key));
}
