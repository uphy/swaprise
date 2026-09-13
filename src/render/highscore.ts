import type { CpuLevel } from "../core";
import { t } from "./i18n";

export interface ScoreEntry {
  score: number;
  maxChain: number;
  /** ISO 8601 の日付。 */
  date: string;
}

export interface CpuRecord {
  wins: number;
  losses: number;
}

/** オンライン対戦の通算。ログインがないので端末（ブラウザ）単位の記録になる。 */
export interface OnlineRecord {
  wins: number;
  losses: number;
  draws: number;
  /** 最後に数えた試合の id。結果画面へ再接続したときに同じ試合を二度数えない。 */
  lastMatch: string;
}

export type OnlineOutcome = "win" | "lose" | "draw";

/** 得点を競う1人用モード。上位5件を別々に持つ。 */
export type ScoreMode = "endless" | "timeattack";

export interface HighScores {
  endless: ScoreEntry[];
  timeattack: ScoreEntry[];
  cpu: Record<CpuLevel, CpuRecord>;
  online: OnlineRecord;
  /** クリアしたパズルの面（0 始まりの通し番号）。 */
  puzzle: number[];
  /** 終えたレッスンの課（0 始まり）。 */
  lessons: number[];
}

const KEY = "swaprise.highscores.v1";
const MAX_ENTRIES = 5;

function empty(): HighScores {
  return {
    endless: [],
    timeattack: [],
    cpu: {
      easy: { wins: 0, losses: 0 },
      normal: { wins: 0, losses: 0 },
      hard: { wins: 0, losses: 0 },
    },
    online: { wins: 0, losses: 0, draws: 0, lastMatch: "" },
    puzzle: [],
    lessons: [],
  };
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** localStorage に保存したハイスコア。壊れていたら空として扱う。 */
export function loadHighScores(): HighScores {
  const s = storage();
  if (!s) return empty();
  try {
    const raw = s.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<HighScores>;
    const base = empty();
    for (const mode of ["endless", "timeattack"] as ScoreMode[]) {
      const list = parsed[mode];
      if (!Array.isArray(list)) continue;
      base[mode] = list
        .filter((e) => typeof e?.score === "number")
        .map((e) => ({ score: e.score, maxChain: e.maxChain ?? 1, date: e.date ?? "" }));
    }
    if (parsed.cpu) {
      for (const level of ["easy", "normal", "hard"] as CpuLevel[]) {
        const r = parsed.cpu[level];
        if (r) base.cpu[level] = { wins: r.wins ?? 0, losses: r.losses ?? 0 };
      }
    }
    const o = parsed.online;
    if (o) base.online = { wins: o.wins ?? 0, losses: o.losses ?? 0, draws: o.draws ?? 0, lastMatch: typeof o.lastMatch === "string" ? o.lastMatch : "" };
    if (Array.isArray(parsed.puzzle)) {
      base.puzzle = [...new Set(parsed.puzzle.filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b);
    }
    if (Array.isArray(parsed.lessons)) {
      base.lessons = [...new Set(parsed.lessons.filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b);
    }
    return base;
  } catch {
    return empty();
  }
}

function save(h: HighScores): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(h));
  } catch {
    // 容量不足やプライベートモードでは保存できないが、ゲームは続けられる
  }
}

/**
 * エンドレス・タイムアタックの結果を記録する。上位5件だけ残す。
 * 戻り値は順位（1始まり）。5位以内に入らなければ 0。
 */
export function recordScore(mode: ScoreMode, score: number, maxChain: number, now = new Date()): number {
  const h = loadHighScores();
  const entry: ScoreEntry = { score, maxChain, date: now.toISOString().slice(0, 10) };
  const list = [...h[mode], entry].sort((a, b) => b.score - a.score || b.maxChain - a.maxChain);
  const rank = list.indexOf(entry) + 1;
  h[mode] = list.slice(0, MAX_ENTRIES);
  save(h);
  return rank <= MAX_ENTRIES ? rank : 0;
}

export function recordEndless(score: number, maxChain: number, now = new Date()): number {
  return recordScore("endless", score, maxChain, now);
}

/** CPU 対戦の勝敗を記録する。 */
export function recordCpuResult(level: CpuLevel, won: boolean): CpuRecord {
  const h = loadHighScores();
  const r = h.cpu[level];
  if (won) r.wins++;
  else r.losses++;
  save(h);
  return { ...r };
}

/**
 * オンライン対戦の勝敗を記録する。同じ試合を二度は数えない（結果画面へ再接続したときも一度だけ）。
 * 無効試合（同期ずれ・サーバー障害）は呼ばない。
 */
export function recordOnlineResult(matchId: string, outcome: OnlineOutcome): OnlineRecord {
  const h = loadHighScores();
  const r = h.online;
  if (r.lastMatch !== matchId) {
    if (outcome === "win") r.wins++;
    else if (outcome === "lose") r.losses++;
    else r.draws++;
    r.lastMatch = matchId;
    save(h);
  }
  return { ...r };
}

/** 「12W 8L」の形。引き分けがあれば「12W 8L 1D」。 */
export function onlineRecordLine(r: OnlineRecord): string {
  const base = t("{wins}W {losses}L", { wins: r.wins, losses: r.losses });
  return r.draws > 0 ? `${base} ${t("{draws}D", { draws: r.draws })}` : base;
}

/** パズルの面をクリアしたと記録する。 */
export function recordPuzzleClear(stage: number): void {
  const h = loadHighScores();
  if (h.puzzle.includes(stage)) return;
  h.puzzle = [...h.puzzle, stage].sort((a, b) => a - b);
  save(h);
}

/** レッスンの課を終えたと記録する。 */
export function recordLessonDone(index: number): void {
  const h = loadHighScores();
  if (h.lessons.includes(index)) return;
  h.lessons = [...h.lessons, index].sort((a, b) => a - b);
  save(h);
}

export function bestEndless(): ScoreEntry | null {
  return loadHighScores().endless[0] ?? null;
}
