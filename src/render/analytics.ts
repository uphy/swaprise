import { playerId } from "../scores/client";
import { language } from "./i18n";

/**
 * 利用の計測。開いた・始めた・終えた・共有した、の 4 つの出来事を /api/track へ送る（worker/track.ts）。
 * 何が効いたかを知るためのもので、送るのは端末の匿名 id・遊び方・結果・流入元だけ。名前は送らない。
 * 送信は投げっぱなしで、失敗しても遊びに影響しない。送るのは本番と PR プレビューの Worker で開いたときだけで、
 * ブラウザが「追跡しない」（Do Not Track / Global Privacy Control）を出しているときと、URL に ?track=0 があるときは送らない。
 */

export type TrackEvent = "visit" | "start" | "end" | "share";

export interface TrackFields {
  mode?: string;
  detail?: string;
  outcome?: string;
  seconds?: number;
}

/** 起動時に 1 度だけ集める、流入元とその端末の情報。 */
export interface VisitFields {
  referrer: string;
  source: string;
  first: "0" | "1";
  display: "standalone" | "browser";
}

const PLAYER_KEY = "swaprise.player.v1";

/** referrer の URL からホスト名だけを取り出す。自分のサイト内の遷移は流入ではないので空にする。 */
export function referrerHost(referrer: string, ownHost: string): string {
  if (!referrer) return "";
  try {
    const host = new URL(referrer).hostname;
    return host === ownHost ? "" : host;
  } catch {
    return "";
  }
}

export function visitFields(input: { referrer: string; search: string; ownHost: string; hasPlayer: boolean; standalone: boolean }): VisitFields {
  return {
    referrer: referrerHost(input.referrer, input.ownHost),
    source: new URLSearchParams(input.search).get("utm_source")?.slice(0, 64) ?? "",
    first: input.hasPlayer ? "0" : "1",
    display: input.standalone ? "standalone" : "browser",
  };
}

/** 送る先。本番と PR プレビューの Worker だけ。手元の dev / preview（e2e を含む）には /api/track が無く、404 が console に残る */
export function trackingHost(hostname: string): boolean {
  return hostname === "swaprise.uphy.dev" || hostname.endsWith(".workers.dev");
}

function optedOut(): boolean {
  if (typeof navigator === "undefined" || typeof location === "undefined") return true;
  if (location.protocol !== "https:" || !trackingHost(location.hostname)) return true;
  if (new URLSearchParams(location.search).get("track") === "0") return true;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigator.doNotTrack === "1" || n.globalPrivacyControl === true;
}

let visit: VisitFields | null = null;

function send(event: TrackEvent, fields: TrackFields): void {
  if (optedOut()) return;
  const body = JSON.stringify({
    event,
    player: playerId(),
    mode: fields.mode ?? "",
    detail: fields.detail ?? "",
    outcome: fields.outcome ?? "",
    seconds: fields.seconds ?? 0,
    referrer: visit?.referrer ?? "",
    source: visit?.source ?? "",
    first: visit?.first ?? "0",
    display: visit?.display ?? "browser",
    locale: language,
    version: __BUILD_ID__,
  });
  try {
    // keepalive で、画面を閉じる直前（end）でも送り切る。sendBeacon と違って Origin ヘッダが必ず付く
    void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => undefined);
  } catch {
    // fetch が無い環境
  }
}

/** 起動時に 1 度呼ぶ。流入元と「初めての端末か」をここで確定し、以後の出来事にも同じ値を付ける。 */
export function trackVisit(): void {
  if (typeof document === "undefined") return;
  let hasPlayer = false;
  try { hasPlayer = localStorage.getItem(PLAYER_KEY) !== null; } catch { /* 読めなければ初回扱い */ }
  visit = visitFields({
    referrer: document.referrer,
    search: location.search,
    ownHost: location.hostname,
    hasPlayer,
    standalone: matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
  });
  send("visit", {});
}

export function track(event: Exclude<TrackEvent, "visit">, fields: TrackFields = {}): void {
  send(event, fields);
}
