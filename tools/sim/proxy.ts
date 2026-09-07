import { CPU_PARAMS, CpuPlayer, type Board } from "../../src/core";

/**
 * 人の代わりに使う遅い CPU。思考 1.5 秒・カーソル 1 マス 0.23 秒・1 手読み・手動せり上げなし。
 * 実際の初心者はこれより消す量が少ないので、これで出た生存時間や勝率は「上限寄り」と読む。
 */
export const CASUAL = { thinkDelay: 90, moveInterval: 14, depth: 1, lookahead: false, raiseBelow: 0, activeDepth: 0, dangerWait: 6 };

/** CASUAL のパラメータで動く CpuPlayer を作る。easy の設定を一時的に差し替えて生成し、すぐ戻す。 */
export function casualPlayer(board: Board): CpuPlayer {
  const saved = { ...CPU_PARAMS.easy };
  Object.assign(CPU_PARAMS.easy, CASUAL);
  try {
    return new CpuPlayer(board, "easy");
  } finally {
    Object.assign(CPU_PARAMS.easy, saved);
  }
}

export const avg = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
export const fmt = (x: number, digits = 1): string => x.toFixed(digits);
