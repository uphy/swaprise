/**
 * 結果の共有。Web Share API（Android Chrome・iOS Safari）があれば OS の共有シートを出し、
 * なければクリップボードへコピーする。戻り値は何をしたか。
 */
import { SHARE_PATH, shareParams, type ShareResult } from "../ogp/spec";

export type ShareOutcome = "shared" | "copied" | "failed";

export function canShare(): boolean {
  return typeof navigator !== "undefined" && (typeof navigator.share === "function" || Boolean(navigator.clipboard));
}

/**
 * text と一緒に送る URL。result があれば結果の共有 URL（/r?…）で、貼った先にその結果のカードが出る。
 * なければ今開いているページ
 */
export async function shareText(text: string, result?: ShareResult): Promise<ShareOutcome> {
  const url = typeof location === "undefined" ? ""
    : result ? `${location.origin}${SHARE_PATH}?${shareParams(result).toString()}` : location.origin + location.pathname;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "SWAPRISE", text, url });
      return "shared";
    } catch {
      // 共有シートを閉じた（AbortError）か、対応していない。クリップボードへ
    }
  }
  try {
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return "copied";
  } catch {
    return "failed";
  }
}
