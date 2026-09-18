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
  /** 端末の匿名 id（swaprise.player.v1）。ランキングは player ごとに自己ベスト 1 件。古い投稿にはなく、その場合はプレイ id を使う */
  player?: string;
  /** 成功した入れ替えの回数。1 手あたりの得点（score / swaps）を出すのに使う。古い投稿・送信待ちにはない */
  swaps?: number;
}
export interface RankedScore {
  id: string;
  name: string;
  score: number;
  maxChain: number;
  createdAt: number;
  /** 成功した入れ替えの回数。1 手あたりの得点（score / swaps）を出すのに使う。古い記録にはない */
  swaps?: number;
  /** 一覧を取った端末の記録なら true。GET に player を付けたときだけ付く */
  mine?: boolean;
}
export interface ScoreStanding {
  rank: number;
  total: number;
  scores: (RankedScore & { rank: number })[];
}
export const scoreMode = (value: unknown): value is ScoreMode => value === "endless" || value === "timeattack";
export const PLAYER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const integer = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
export function validSubmission(v: unknown): v is Submission {
  if (!v || typeof v !== "object") return false;
  const s = v as Submission;
  return typeof s.id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s.id)
    && scoreMode(s.mode) && supportedScoreRules(s.mode, s.rules)
    && typeof s.name === "string" && Array.from(s.name).length >= 1 && Array.from(s.name).length <= 20
    && s.name === s.name.trim() && !/[\p{C}\p{Zl}\p{Zp}]/u.test(s.name)
    && integer(s.score, 0, 99999) && integer(s.maxChain, 0, 9999)
    && integer(s.seed, 0, 0xffffffff) && integer(s.frames, 1, s.mode === "timeattack" ? 7200 : 5184000)
    && (s.player === undefined || (typeof s.player === "string" && PLAYER_ID.test(s.player)))
    && (s.swaps === undefined || integer(s.swaps, 0, 1_000_000));
}
/**
 * 得点・最大連鎖・frames の間で、ゲームの仕組み上あり得ない組み合わせを弾く（Worker が投稿時に使う）。
 * 上限は hard CPU の最速（60 秒窓で 73 点/秒、10 秒窓で 141 点/秒。pnpm sim で計測）の 2 倍以上の 300 点/秒（frames × 5）に、
 * 序盤の 1 回の消去ぶんとして 500 点を足す。連鎖は 1 段ごとに点滅・消去・落下で最速でも 60 フレーム余りかかる。
 * n 連鎖は各段で 3 枚以上消えるので、その合計より少ない得点で n 連鎖にはならない。
 * リプレイ検証の代わりではなく、素朴な偽装（600 フレームで 99999 点）を落とすだけ。
 */
export function plausibleScore(s: Pick<Submission, "score" | "maxChain" | "frames">): boolean {
  const CHAIN_BONUS = [0, 0, 50, 80, 150, 300, 400, 500, 700, 900, 1100, 1300, 1500, 1800];
  let least = 0;
  for (let k = 1; k <= s.maxChain && s.maxChain >= 2; k++) least += 30 + (CHAIN_BONUS[k] ?? 0);
  return s.score <= s.frames * 5 + 500 && s.score >= least && (s.maxChain - 1) * 60 <= s.frames;
}
/** Seed/debug overrides are not the standard ranking rules, even if the score looks normal. */
export function eligibleRun(mode: string, params: URLSearchParams): mode is ScoreMode {
  return scoreMode(mode) && !["seed", "speed", "time", "shock"].some((key) => params.has(key));
}
