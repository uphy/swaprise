import { Board } from "./board";
import { gridColumns, parseRows } from "./puzzle";
import type { BoardEvent } from "./types";

/**
 * レッスン（初心者向けの練習）。せり上がりのない固定の盤面で、消す・落とす・連鎖・同時消し・アクティブ連鎖を
 * 1 課 1 技法で身につける。最後の課だけせり上がる盤面で実戦に近づける。
 * 手は縛らず、達成は「起きたこと」（消えた・連鎖数・同時消しの枚数・消去中の入れ替え）で判定する。
 * 説明の文章は描画側（i18n）が id で引く。
 */
export type LessonGoal =
  /** 1 回消えた。 */
  | { kind: "clear" }
  /** 一度に panels 枚以上消えた（同時消し）。 */
  | { kind: "combo"; panels: number }
  /** count 連鎖以上。active なら、消えている間に入れ替えていること（アクティブ連鎖）も要る。 */
  | { kind: "chain"; count: number; active?: boolean };

export interface Lesson {
  id: string;
  /** 固定の盤面（上から下へ）。省略すると通常の乱数盤面で、せり上がる。 */
  rows?: string[];
  goal: LessonGoal;
  /** 迷っているときに光らせる入れ替えの位置（カーソルの左のマス）。 */
  hint?: { x: number; y: number };
  /** 最初の消去が始まった瞬間に光らせる入れ替え（アクティブ連鎖の課。時間が要なのですぐ出す）。 */
  hintAfterMatch?: { x: number; y: number };
  /** 消去の点滅・猶予の倍率。アクティブ連鎖の課だけ 2 にして、初心者でも間に合うようにする。 */
  timingScale?: number;
}

export const LESSONS: Lesson[] = [
  // 横に 1 枚動かして 3 枚揃える
  { id: "clear", rows: [".00.0.", "121212"], goal: { kind: "clear" }, hint: { x: 3, y: 1 } },
  // 動かしたパネルは穴に落ちる。縦でも揃う
  { id: "drop", rows: ["...3..", "...2..", "..32..", "123121"], goal: { kind: "clear" }, hint: { x: 2, y: 3 } },
  // 消えた上のパネルが落ちて揃うと連鎖
  { id: "chain", rows: ["...2..", "1.1122", "303030"], goal: { kind: "chain", count: 2 }, hint: { x: 0, y: 1 } },
  // 4 枚以上を一度に消す
  { id: "combo", rows: ["...0..", "00.00.", "121212"], goal: { kind: "combo", panels: 4 }, hint: { x: 2, y: 2 } },
  // 消えている間に入れ替えて、落ちてくるパネルに合わせる
  { id: "active", rows: ["..22..", "1.1132"], goal: { kind: "chain", count: 2, active: true }, hint: { x: 0, y: 0 }, hintAfterMatch: { x: 4, y: 0 }, timingScale: 2 },
  // せり上がる盤面で自分で 2 連鎖を組む
  { id: "rise", goal: { kind: "chain", count: 2 } },
];

/** 課の盤面を作る。固定の面ならその形で、なければ低めの乱数盤面でゆっくりせり上がる。 */
export function boardForLesson(lesson: Lesson, seed: number): Board {
  if (!lesson.rows) {
    return new Board({ seed, initialHeight: 4, speedLevel: 1, speedUp: false });
  }
  const board = new Board({ seed, kinds: 5, initialHeight: 0, frozen: true, timingScale: lesson.timingScale });
  board.setColumns(gridColumns(parseRows(lesson.rows)));
  board.cursor.x = lesson.hint?.x ?? 2;
  board.cursor.y = lesson.hint?.y ?? 0;
  return board;
}

/** このフレームの出来事で課の目標に届いたか。 */
export function lessonGoalMet(goal: LessonGoal, events: BoardEvent[], board: Board): boolean {
  for (const e of events) {
    if (e.type !== "match") continue;
    if (goal.kind === "clear") return true;
    if (goal.kind === "combo" && e.panels >= goal.panels) return true;
    if (goal.kind === "chain" && e.chain >= goal.count && (!goal.active || board.stats.activeSwaps > 0)) return true;
  }
  return false;
}
