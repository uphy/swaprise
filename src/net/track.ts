/**
 * 利用の計測の取り決め。クライアント（src/render/analytics.ts）が送り、Worker（worker/track.ts）が
 * Workers Analytics Engine に書く。DOM にも Workers にも依存しない。
 */

export const TRACK_EVENTS = ["visit", "start", "end", "share"] as const;
export type TrackEvent = (typeof TRACK_EVENTS)[number];

/**
 * end に付ける 1 プレイの集計。並びは Analytics Engine の double2 以降の列の順（docs/dev.md「計測」）。
 * 盤面の値は Board.stats（src/core/board.ts）、操作の値は TouchInput.stats / PlayerInput.stats（src/render/）から取る。
 * 何も考えずに動かし続ける遊び方（swaps に対して swapMatches が少ない、dragSteps が多い）を見分け、操作と速度の調整の手がかりにする。
 */
export const PLAY_STATS = [
  /** 得点 */ "score",
  /** 最大連鎖 */ "maxChain",
  /** 成功した入れ替えの回数 */ "swaps",
  /** 消去が起きた回数 */ "matches",
  /** 消去のうち連鎖でないもの（入れ替えで揃えた） */ "swapMatches",
  /** 2 連鎖目以降の消去の回数 */ "chains",
  /** 4 枚以上の同時消しの回数 */ "combos",
  /** 消した枚数 */ "panels",
  /** せり上がった段数（自動と手動の合計） */ "risenRows",
  /** 手動でせり上げた段数 */ "manualRows",
  /** 終了時のスピードレベル */ "level",
  /** 横に引いたドラッグの本数（1 マス以上動かしたもの） */ "drags",
  /** ドラッグで出した入れ替えの回数 */ "dragSteps",
  /** ドラッグの途中（指がまだ先へ進んでいる）で揃って止まった回数 */ "dragMidStops",
  /** マウスのクリックで出した入れ替えの回数 */ "taps",
  /** キーボード・ゲームパッドで出した入れ替えの回数 */ "keySwaps",
] as const;
export type PlayStatKey = (typeof PLAY_STATS)[number];
export type PlayStats = Record<PlayStatKey, number>;
export const emptyPlayStats = (): PlayStats => Object.fromEntries(PLAY_STATS.map((k) => [k, 0])) as PlayStats;

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
  /** end の主な操作（touch / mouse / keys）。他の出来事は空。 */
  input: string;
  /** end の画面の向き（portrait / landscape）。他の出来事は空。 */
  orientation: string;
  /** end の 1 プレイの集計。他の出来事は全部 0。 */
  stats: PlayStats;
}

/** Analytics Engine の 1 行。列の並びは docs/dev.md「計測」の表と合わせる。 */
export interface TrackRow {
  indexes: [string];
  blobs: string[];
  doubles: number[];
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
  const count = (value: unknown, max: number): number => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(max, Math.round(value)) : 0;
  const seconds = count(b.seconds, 86400);
  const stats = emptyPlayStats();
  const given = b.stats && typeof b.stats === "object" ? (b.stats as Record<string, unknown>) : {};
  for (const k of PLAY_STATS) stats[k] = count(given[k], 1_000_000);
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
    input: ["touch", "mouse", "keys"].includes(b.input as string) ? (b.input as string) : "",
    orientation: ["portrait", "landscape"].includes(b.orientation as string) ? (b.orientation as string) : "",
    stats,
  };
}

export function toTrackRow(p: TrackPayload, country: string): TrackRow {
  return {
    indexes: [p.player],
    blobs: [p.event, p.mode, p.detail, p.outcome, p.referrer, p.source, country, p.locale, p.first, p.display, p.version, p.input, p.orientation],
    doubles: [p.seconds, ...PLAY_STATS.map((k) => p.stats[k])],
  };
}
