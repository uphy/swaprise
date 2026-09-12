/**
 * 戻る操作（Android の戻るジェスチャ・戻るボタン）をゲーム中に受けたときの案内。
 *
 * Chrome は戻る操作の予告として画面を横にずらすアニメーションを出し、Web 側からは止められない。
 * ゲームは履歴を積み直して離れないが、動きだけ見た人は「終わったのか」と驚くので、
 * 離れないこと・やめる手順を短く知らせる。初めての1回は読めるよう長めに出す。
 */
const KEY = "swaprise.back-hint.v1";
const FIRST_MS = 5000;
const LATER_MS = 3000;

/** 案内を出す長さ（ms）。呼ぶたびに「1回は見た」と記録する。 */
export function backHintDuration(): number {
  let seen = false;
  try {
    seen = localStorage.getItem(KEY) === "1";
    if (!seen) localStorage.setItem(KEY, "1");
  } catch {
    seen = false;
  }
  return seen ? LATER_MS : FIRST_MS;
}
