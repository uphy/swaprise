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
 * text と一緒に送る URL は 1 つだけ。result があれば結果の共有 URL（/r?…）、hash 付きの招待リンクなど
 * 出来合いの URL は link で渡す。どちらもなければ今開いているページ。
 * text に URL を入れてはいけない。共有先が text の URL と url の両方を展開して、カードが 2 枚出る
 */
export async function shareText(text: string, result?: ShareResult, link?: string): Promise<ShareOutcome> {
  const url = link ?? (typeof location === "undefined" ? ""
    : result ? `${location.origin}${SHARE_PATH}?${shareParams(result).toString()}` : location.origin + location.pathname);
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
