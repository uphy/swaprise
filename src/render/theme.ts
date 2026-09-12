/** 描画で共有する寸法と色。 */
export const CELL = 32;
export const BOARD_W = 6 * CELL;
export const BOARD_H = 12 * CELL;

/**
 * 柄ごとの色と記号。色だけでなく形でも見分けられるよう、輪郭の違う図形を割り当てる。
 * kind 5 は高難度で混ざる6種目（ばつ印）。
 */
export const KIND_COLORS = [0xe0405a, 0x7ad33a, 0x4cc3e8, 0xf2d13b, 0xa25ad6, 0x3b62e0];
export const KIND_NAMES = ["square", "circle", "triangle", "plus", "hexagon", "cross"];
export const GARBAGE_COLOR = 0x8a8a96;
export const GARBAGE_DARK = 0x5c5c68;
export const BG_COLOR = 0x14141c;
export const BOARD_BG = 0x1e1e2a;
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

/** 連鎖数ごとの吹き出しの色。数が増えるほど熱い色へ */
export function chainColor(chain: number): string {
  if (chain >= 8) return "#ff5cf0";
  if (chain >= 6) return "#ff5c6c";
  if (chain >= 4) return "#ff9a3c";
  if (chain >= 3) return "#ffd23c";
  return "#7cf57a";
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
export function layoutFor(mode: "menu" | "endless" | "timeattack" | "versus" | "cpu" | "puzzle"): Layout {
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
export function menuTitle(layout: Layout): { compact: boolean; y: number; size: number; subtitleY: number; subtitleSize: number; iconsY: number } {
  const compact = layout.height < 560;
  const y = compact ? 36 : layout.portrait ? 72 : 60;
  return {
    compact,
    y,
    size: layout.portrait ? MENU_TYPE.titlePortrait : MENU_TYPE.titleLandscape,
    subtitleY: y + (compact ? 36 : 44),
    subtitleSize: compact ? 12 : 14,
    iconsY: y + 82,
  };
}
