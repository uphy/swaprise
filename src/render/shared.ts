import { GameAudio } from "./audio";

/** シーン間で共有する音声。?bgm=0 で BGM を止められる（e2e 用）。 */
export const audio = new GameAudio();
// e2e 用。曲の状態（鳴っている曲・危険テンポ）を外から調べられるようにする
(window as unknown as { __swapriseAudio: GameAudio }).__swapriseAudio = audio;
const params = new URLSearchParams(location.search);
audio.bgmEnabled = params.get("bgm") !== "0";
// 音量の手触りの調整用。数値でなければ既定のまま
const level = (key: string): number | null => { const v = Number(params.get(key)); return params.has(key) && Number.isFinite(v) && v >= 0 ? v : null; };
audio.gameBgmLevel = level("bgmlevel") ?? audio.gameBgmLevel;
audio.sfxLevel = level("sfxlevel") ?? audio.sfxLevel;

// ブラウザは AudioContext の開始をユーザー操作の中でしか許さない。
// Phaser はキー入力をキューに溜めて次のフレームで処理するので、Phaser のハンドラから start() を呼んでも
// 操作の外になり、Safari では止まったままになる。ここで DOM のイベントを直接受けて操作の中で start() する。
for (const type of ["keydown", "pointerdown", "touchend", "mousedown"] as const) {
  window.addEventListener(type, () => audio.start(), { capture: true, passive: true });
}
