import type { CpuLevel, GameMode } from "../core";

/** 前回遊んだモード。メニューを開いたときのカーソルの初期位置に使う。 */
export interface LastMode {
  mode: GameMode;
  cpuLevel?: CpuLevel;
}

const KEY = "swaprise.lastmode.v1";

export function loadLastMode(): LastMode | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastMode>;
    const mode = parsed.mode;
    if (mode !== "endless" && mode !== "timeattack" && mode !== "puzzle" && mode !== "lesson" && mode !== "versus" && mode !== "cpu") return null;
    const cpu = parsed.cpuLevel;
    return { mode, cpuLevel: cpu === "easy" || cpu === "normal" || cpu === "hard" ? cpu : undefined };
  } catch {
    return null;
  }
}

export function saveLastMode(last: LastMode): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(last));
  } catch {
    // プライベートモードなどで保存できなくても続ける
  }
}
