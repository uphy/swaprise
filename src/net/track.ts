/**
 * 利用の計測の取り決め。クライアント（src/render/analytics.ts）が送り、Worker（worker/track.ts）が
 * Workers Analytics Engine に書く。DOM にも Workers にも依存しない。
 */

export const TRACK_EVENTS = ["visit", "start", "end", "share"] as const;
export type TrackEvent = (typeof TRACK_EVENTS)[number];

export interface TrackPayload {
  event: TrackEvent;
  /** 端末の匿名 id（swaprise.player.v1）。 */
  player: string;
  /** 遊び方（endless / timeattack / puzzle / lesson / cpu / versus / online）。visit では空。 */
  mode: string;
  /** 細目。CPU の強さ、パズルの面、課の番号、オンラインの入り方（random / invite）、共有の種類。 */
  detail: string;
  /** end の結果（win / lose / draw / clear / failed / timeup / over / nocontest …）。 */
  outcome: string;
  /** 流入元のホスト名（document.referrer）。 */
  referrer: string;
  /** URL の utm_source。 */
  source: string;
  /** 端末の言語（ja / en）。 */
  locale: string;
  /** 初めて開いた端末なら "1"。 */
  first: string;
  /** ホーム画面から開いたなら standalone、ブラウザなら browser。 */
  display: string;
  /** ビルド識別子。 */
  version: string;
  /** end の試合時間（秒）。他の出来事は 0。 */
  seconds: number;
}

/** Analytics Engine の 1 行。列の並びは docs/dev.md「計測」の表と合わせる。 */
export interface TrackRow {
  indexes: [string];
  blobs: string[];
  doubles: [number];
}

const text = (value: unknown, max: number): string => (typeof value === "string" ? value.slice(0, max) : "");

/** 受け取った JSON を検証して整える。出来事名が未知、id の形が違う、のどちらかで null。長い文字列は切る。 */
export function parseTrack(body: unknown): TrackPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const event = b.event;
  if (typeof event !== "string" || !(TRACK_EVENTS as readonly string[]).includes(event)) return null;
  const player = text(b.player, 64);
  if (!/^[0-9a-f-]{36}$/.test(player)) return null;
  const seconds = typeof b.seconds === "number" && Number.isFinite(b.seconds) && b.seconds >= 0 ? Math.min(86400, Math.round(b.seconds)) : 0;
  return {
    event: event as TrackEvent,
    player,
    mode: text(b.mode, 16),
    detail: text(b.detail, 32),
    outcome: text(b.outcome, 16),
    referrer: text(b.referrer, 128),
    source: text(b.source, 64),
    locale: text(b.locale, 8),
    first: b.first === "1" ? "1" : "0",
    display: b.display === "standalone" ? "standalone" : "browser",
    version: text(b.version, 32),
    seconds,
  };
}

export function toTrackRow(p: TrackPayload, country: string): TrackRow {
  return {
    indexes: [p.player],
    blobs: [p.event, p.mode, p.detail, p.outcome, p.referrer, p.source, country, p.locale, p.first, p.display, p.version],
    doubles: [p.seconds],
  };
}
