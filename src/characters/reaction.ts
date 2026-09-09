/**
 * 人物の反応の選び方。表示（Phaser）に依存しない。
 *
 * 優先順位は 結果 > おじゃま着地 > 成功 > 危険/待機。
 * - 結果が出たら以後の反応は受け付けず、結果の動作を一度再生して最後の姿勢を保つ
 * - 着地は成功の再生中でも割り込む。成功は着地の再生中には割り込まない
 * - 成功の再生中に連鎖が伸びても先頭から再生し直さない
 * - 短い反応が終わったら、その時点の危険状態に応じて待機かピンチへ戻る
 */
export type ReactionAction = "idle" | "danger" | "success" | "garbage-land" | "victory" | "defeat" | "finish";
export type ShortReaction = "success" | "garbage-land";
export type ResultAction = "victory" | "defeat" | "finish";

const SHORT_PRIORITY: Record<ShortReaction, number> = { success: 1, "garbage-land": 2 };

export class Reaction {
  private danger = false;
  private short: ShortReaction | null = null;
  private result: ResultAction | null = null;

  /** いま再生すべき動作。 */
  get action(): ReactionAction {
    if (this.result) return this.result;
    if (this.short) return this.short;
    return this.danger ? "danger" : "idle";
  }

  get finished(): boolean {
    return this.result !== null;
  }

  /** 危険状態を更新する。短い反応・結果の途中では表示に出ず、終わったときの戻り先に効く。 */
  setDanger(on: boolean): void {
    this.danger = on;
  }

  /**
   * 短い反応を要求する。再生を始めるべきなら true を返す（同じ反応の再生中や、優先度の低い反応は false）。
   */
  react(kind: ShortReaction): boolean {
    if (this.result) return false;
    if (this.short && SHORT_PRIORITY[this.short] >= SHORT_PRIORITY[kind]) return false;
    this.short = kind;
    return true;
  }

  /** 短い反応の再生が終わった。待機かピンチへ戻る。 */
  shortDone(): void {
    this.short = null;
  }

  /** 結果が出た。以後の反応は無視する。 */
  setResult(result: ResultAction): void {
    this.result = result;
    this.short = null;
  }
}
