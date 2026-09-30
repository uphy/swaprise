/** 描画で共有する寸法と色。 */
export const CELL = 32;
export const BOARD_W = 6 * CELL;
export const BOARD_H = 12 * CELL;

/**
 * 柄ごとの色と記号。色だけでなく形でも見分けられるよう、輪郭の違う図形を割り当てる。
 * kind 5 は高難度で混ざる6種目（ばつ印）。
 */
export { KIND_COLORS } from "./palette";
export const KIND_NAMES = ["square", "circle", "triangle", "plus", "hexagon", "cross"];
/** おじゃまの板。パネルのどの柄とも紛れない、灰色がかった藤色 */
export const GARBAGE_COLOR = 0x8c86b0;
export const BG_COLOR = 0x14141c;
/** 盤面の中。空（青〜桃）になじむよう、黒ではなくわずかに紫寄りの濃紺。パネルの色はこの上で読む */
export const BOARD_BG = 0x1c1730;
/** メニューのカードと盤面の枠の縁の色。1 PLAYER は金、CPU は水色、2 PLAYERS は橙、ONLINE は緑。下位の項目は柄の色を順に使う */
export const CARD = { gold: 0xffe066, cyan: 0x6fd6ff, orange: 0xffa14a, green: 0x8de76a, violet: 0xc9a2ff, red: 0xff6f7a, pink: 0xff8ad4 } as const;
export const TEXT_COLOR = "#f4f4f8";
/** 副題・説明・記録などの控えめな文字。背景が明るい紫系なので、灰色ではなく薄い藤色にする */
export const TEXT_DIM = "#d9d4f2";
export const TEXT_MUTE = "#b9b2dc";
/** 選択中・見出しの強調色 */
export const ACCENT = "#ffe066";
/** 数字（得点・時間）用の等幅。桁が揃う */
export const FONT = '"Menlo", "Consolas", monospace';
/** 見出し・ボタン・案内用の丸い書体。Fredoka（OFL）を public/fonts に同梱し、日本語は端末の丸ゴシックに任せる */
export const FONT_UI = '"Fredoka", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Arial Rounded MT Bold", "Nunito", sans-serif';

/**
 * 画面ごとの背景の空。実際の色は index.html の CSS（body[data-sky]）にあり、Background が data-sky を切り替える。
 * 曲の明るさに合わせ、黒ではなく色のある空にする。盤面の中は暗いままなので、パネルは背景に埋もれない
 */
export type SkyName = "menu" | "endless" | "timeattack" | "puzzle" | "versus" | "cpu";

/** 連鎖数ごとの吹き出しの色。数が増えるほど熱い色へ。10 連鎖からは白く燃える青 */
export function chainColor(chain: number): string {
  if (chain >= 10) return "#7ff0ff";
  if (chain >= 8) return "#ff5cf0";
  if (chain >= 6) return "#ff5c6c";
  if (chain >= 4) return "#ff9a3c";
  if (chain >= 3) return "#ffd23c";
  return "#7cf57a";
}

/**
 * 盤面の揺れの型。揺らすのはカメラではなく連鎖した盤面だけ。
 * dip: 盤面が一瞬沈んで戻る、vertical: 短い縦の揺れ、both: 縦横の揺れ、long: 縦横に長めに揺れて減衰する
 */
export type ChainShakeType = "dip" | "vertical" | "both" | "long";

/**
 * 連鎖数ごとの演出の強さ。連鎖が伸びるほど、揺れの型・吹き出し・閃光・締めの表示が段階で変わる。
 * 段階の境目は 3・5・6・8・10 連鎖。5 と 8、8 と 10 が色だけでなく揺れと閃光と大きさで見分けられるようにする
 */
export interface ChainFx {
  /** 揺れ。amp はパネル 1 枚の大きさに対する割合（画面の大きさや DPR で変わらない）、ms は長さ */
  shake: { type: ChainShakeType; amp: number; ms: number };
  /** 連鎖の吹き出しの大きさ（x2 を 1 倍） */
  popupScale: number;
  /** 盤面に重ねる閃光の不透明度（0 は無し）と回数。2 回目は少し遅れて弱く */
  flash: number;
  flashCount: number;
  /** 盤面の中央から広がる大きな光の輪（8 連鎖から） */
  ring: boolean;
  /** 締めの表示の見出しの大きさ（2 連鎖を 1 倍）・とどまる長さ（ms）・縁の太さ・外側の光 */
  summaryScale: number;
  summaryHold: number;
  summaryEdge: number;
  summaryGlow: boolean;
}

/**
 * 揺れの上限（パネル 1 枚の割合）。これより大きいと、揺れている間に盤面の列が読めなくなる。
 * 設定に揺れを切る項目はないので、端末の「視差効果を減らす」（prefers-reduced-motion）が有効なら揺らさない
 */
export const CHAIN_SHAKE_MAX = 0.15;

export function chainFx(chain: number): ChainFx {
  const shake = (type: ChainShakeType, amp: number, ms: number) => ({ type, amp: Math.min(CHAIN_SHAKE_MAX, amp), ms });
  if (chain >= 10) return { shake: shake("long", 0.14, 640), popupScale: 2.05, flash: 0.45, flashCount: 2, ring: true, summaryScale: 1.6, summaryHold: 1200, summaryEdge: 3, summaryGlow: true };
  if (chain >= 8) return { shake: shake("long", chain >= 9 ? 0.13 : 0.12, chain >= 9 ? 540 : 480), popupScale: 1.85, flash: 0.36, flashCount: 1, ring: true, summaryScale: 1.5, summaryHold: 1000, summaryEdge: 3, summaryGlow: true };
  if (chain >= 6) return { shake: shake("both", chain >= 7 ? 0.11 : 0.1, chain >= 7 ? 300 : 270), popupScale: 1.65, flash: 0.28, flashCount: 1, ring: false, summaryScale: 1.4, summaryHold: 850, summaryEdge: 2.5, summaryGlow: false };
  if (chain === 5) return { shake: shake("both", 0.08, 240), popupScale: 1.5, flash: 0.2, flashCount: 1, ring: false, summaryScale: 1.3, summaryHold: 850, summaryEdge: 2.5, summaryGlow: false };
  if (chain === 4) return { shake: shake("vertical", 0.055, 190), popupScale: 1.4, flash: 0, flashCount: 0, ring: false, summaryScale: 1.25, summaryHold: 730, summaryEdge: 2, summaryGlow: false };
  if (chain === 3) return { shake: shake("vertical", 0.04, 160), popupScale: 1.25, flash: 0, flashCount: 0, ring: false, summaryScale: 1.15, summaryHold: 730, summaryEdge: 2, summaryGlow: false };
  return { shake: shake("dip", 0.03, 120), popupScale: 1, flash: 0, flashCount: 0, ring: false, summaryScale: 1, summaryHold: 730, summaryEdge: 2, summaryGlow: false };
}

/** 端末で「視差効果を減らす」が有効か。有効なら盤面を揺らさない */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * 停止時間（せり上がりが止まっている間）の色。ふだんは水色、危険な状態で消して 2 倍になったときは赤。
 * fill はゲージの地、light はゲージの光と縁、text は数字の色
 */
export const STOP_COLORS = {
  normal: { fill: 0x3fb4f0, light: 0xbfeeff, text: "#8fdcff" },
  pinch: { fill: 0xff5c6c, light: 0xffc2c8, text: "#ff8a94" },
} as const;

/** 停止の秒数の文字。整数の秒はそのまま（10s）、端数は小数 1 桁（1.3s） */
export function stopSeconds(frames: number): string {
  const s = frames / 60;
  return Number.isInteger(s) ? `${s}s` : `${s.toFixed(1)}s`;
}

export interface Layout {
  width: number;
  height: number;
  portrait: boolean;
  /** タッチ主体の端末か。案内文とボタンの出し分けに使う。 */
  touch: boolean;
  /** 横持ちのスマホ。高さを盤面いっぱいに使い、得点などは盤面の横に置く。 */
  phoneLandscape: boolean;
}

/** 横持ちのスマホ用の論理高さ。上 14 + 盤面 384 + 停止ゲージ。マスが実画面の高さ ÷ 12.9 になる。 */
export const PHONE_LANDSCAPE_H = 412;

export function sameLayout(a: Layout, b: Layout): boolean {
  return a.width === b.width && a.height === b.height && a.portrait === b.portrait && a.touch === b.touch && a.phoneLandscape === b.phoneLandscape;
}

/** タッチ主体の端末か。マウスがあっても touch イベントがあれば true。 */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
}

/**
 * 画面の向きとモードから論理サイズを決める。Phaser の Scale.FIT がこれを実画面に収める。
 * 縦持ちのスマホでは盤面が画面幅いっぱいになるよう、論理幅を小さくする。
 */
export function layoutFor(mode: "menu" | "endless" | "timeattack" | "versus" | "cpu" | "puzzle" | "lesson"): Layout {
  const portrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
  const touch = isTouchDevice();
  const phoneLandscape = false;
  if (portrait) {
    // 幅を固定し、高さは画面の縦横比に合わせる。高さも固定すると、Safari のツールバーぶん背が低い iPhone で
    // 縦に合わせて縮み、盤面が幅いっぱいにならない。下限は盤面とその下の表示が収まる高さ、上限は間延びしない高さ。
    const fit = (width: number, minH: number, maxH: number): Layout => {
      const byAspect = Math.round((width * window.innerHeight) / window.innerWidth);
      return { width, height: Math.max(minH, Math.min(maxH, byAspect)), portrait, touch, phoneLandscape };
    };
    // Android の戻るジェスチャ（画面端からの横スワイプ）を盤面のドラッグが踏まないよう、
    // 盤面の左右には実画面で 24dp 以上の余白を取る（論理 px は幅 412dp の端末で換算）。
    // 2P 対戦は同じ大きさの2盤面を並べる（左右 33 論理px = 約 29dp）。
    if (mode === "versus") return fit(470, 560, 700);
    // CPU 対戦は自分の盤面を 1P エンドレスと同じ大きさで描き、CPU の盤面は半分の大きさで右に添える（左右 20 論理px = 約 24dp）。
    if (mode === "cpu") return fit(340, 500, 640);
    return fit(300, 500, 640);
  }
  // 横持ちのスマホ（タッチ端末で実画面の高さが 560 CSS px 未満。タブレットは含まない）。
  // 高さを固定して盤面を画面いっぱいにし、幅は縦横比から決める。2P 対戦は盤面を左右の端に寄せ、片方ずつ持って遊べる。
  if (touch && typeof window !== "undefined" && window.innerHeight < 560) {
    const byAspect = Math.round((PHONE_LANDSCAPE_H * window.innerWidth) / window.innerHeight);
    return { width: Math.max(640, Math.min(1000, byAspect)), height: PHONE_LANDSCAPE_H, portrait, touch, phoneLandscape: true };
  }
  return { width: 800, height: 520, portrait, touch, phoneLandscape };
}

export const MENU_TYPE = { titlePortrait: 48, titleLandscape: 56, item: 22, itemCompact: 20, caption: 14 } as const;

/**
 * メニューの題字まわりの位置と大きさ。オープニングは最後に題字をここへ寄せてからメニューへ切り替えるので、
 * 両方がこの値を使うことで、切り替わっても題字が動かない。
 * 背の低い画面（Safari のツールバーがある iPhone、横持ちのスマホ）は compact で、縦の間隔を詰めて柄の飾りを省く。
 */
export function menuTitle(layout: Layout): { compact: boolean; y: number; size: number; iconsY: number } {
  const compact = layout.height < 560;
  const y = compact ? 36 : layout.portrait ? 72 : 60;
  return {
    compact,
    y,
    size: layout.portrait ? MENU_TYPE.titlePortrait : MENU_TYPE.titleLandscape,
    iconsY: y + 76,
  };
}
