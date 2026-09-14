/**
 * 結果の共有カード（OGP 画像、1200×630）を画像ライブラリなしで描く。
 * Node（tools/）と Cloudflare Worker の両方で動くよう、DOM にも zlib にも依存しない。
 * 題字はオープニングと同じパネルのドット文字、主役の数字や単語は大きなドット文字、下端にせり上がる盤面の頭。
 */
import { KIND_COLORS } from "../render/palette";
import { CARD_FONT, CARD_GLYPH_H, CARD_GLYPH_W, CARD_LETTER_GAP, cardText, cardTextCols } from "./font";

export const CARD_W = 1200;
export const CARD_H = 630;

export type RGB = [number, number, number];
export const rgb = (hex: number): RGB => [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
const COLORS = KIND_COLORS.map(rgb);
/** index.html の body の空（メニュー）。tools/make-ogp.ts と同じ */
const SKY: [number, RGB][] = [[0, rgb(0x2a2690)], [0.55, rgb(0x7c3fbd)], [1, rgb(0xff7ea6)]];
const TITLE = "SWAPRISE";
const WHITE: RGB = [0xf4, 0xf4, 0xf8];
const DIM: RGB = [0xd9, 0xd4, 0xf2];

export interface CardLine {
  text: string;
  /** 省くと薄い藤色 */
  color?: number;
}

export interface CardSpec {
  /** 右上のモード名（ENDLESS など） */
  mode: string;
  /** 主役の数字か単語。1 つだけ、画面の 4 割の高さで */
  main: string;
  mainColor?: number;
  /** 主役の下の小さな語（POINTS など） */
  caption?: string;
  /** 副情報。2 つまで。左右に並べる */
  subs: CardLine[];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, f: number): RGB => [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)];

function sky(y: number): RGB {
  const t = y / (CARD_H - 1);
  for (let i = 1; i < SKY.length; i++) {
    if (t <= SKY[i][0]) return mix(SKY[i - 1][1], SKY[i][1], (t - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]));
  }
  return SKY[SKY.length - 1][1];
}

function inRoundedSquare(x: number, y: number, cx: number, cy: number, h: number, r: number): boolean {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx > h || dy > h) return false;
  if (dx <= h - r || dy <= h - r) return true;
  const ex = dx - (h - r);
  const ey = dy - (h - r);
  return ex * ex + ey * ey <= r * r;
}

/** ゲーム内と同じ立体感のパネル。上端のハイライトと外周の影 */
function panel(px: number, py: number, cx: number, cy: number, half: number, c: RGB): RGB | null {
  const radius = half * 0.28;
  if (!inRoundedSquare(px, py, cx, cy, half, radius)) return null;
  if (inRoundedSquare(px, py, cx, cy - half * 0.62, half * 0.78, radius * 0.6) && py < cy - half * 0.35) return shade(c, 1.25);
  if (!inRoundedSquare(px, py, cx, cy - half * 0.04, half * 0.94, radius * 0.9)) return shade(c, 0.7);
  return c;
}

/** 平らなドット。文字用。下に影を落として空から浮かせる */
function dot(px: number, py: number, cx: number, cy: number, half: number, c: RGB): RGB | null {
  if (inRoundedSquare(px, py, cx, cy, half, half * 0.3)) return c;
  if (inRoundedSquare(px, py, cx + half * 0.3, cy + half * 0.4, half, half * 0.3)) return [0x1a, 0x10, 0x38];
  return null;
}

class Canvas {
  readonly raw: Uint8Array;
  constructor() {
    this.raw = new Uint8Array(CARD_W * CARD_H * 3);
    for (let y = 0; y < CARD_H; y++) {
      const [r, g, b] = sky(y);
      for (let x = 0; x < CARD_W; x++) {
        const o = (y * CARD_W + x) * 3;
        this.raw[o] = r; this.raw[o + 1] = g; this.raw[o + 2] = b;
      }
    }
  }

  put(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= CARD_W || y >= CARD_H) return;
    const o = (y * CARD_W + x) * 3;
    this.raw[o] = Math.round(c[0]); this.raw[o + 1] = Math.round(c[1]); this.raw[o + 2] = Math.round(c[2]);
  }

  get(x: number, y: number): RGB {
    const o = (y * CARD_W + x) * 3;
    return [this.raw[o], this.raw[o + 1], this.raw[o + 2]];
  }

  /** 中心 (cx, cy)、半辺 half の範囲を shape で塗る。null の画素は残す */
  fill(cx: number, cy: number, half: number, shape: (px: number, py: number) => RGB | null): void {
    const x0 = Math.max(0, Math.floor(cx - half - 1));
    const x1 = Math.min(CARD_W - 1, Math.ceil(cx + half + 1));
    const y0 = Math.max(0, Math.floor(cy - half - 1));
    const y1 = Math.min(CARD_H - 1, Math.ceil(cy + half + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = shape(x + 0.5, y + 0.5);
      if (c) this.put(x, y, c);
    }
  }

  /** 光の玉。空にだけ重ねる前提なので、盤面や文字より先に描く */
  orb(ox: number, oy: number, r: number): void {
    for (let y = Math.max(0, oy - r); y < Math.min(CARD_H, oy + r); y++) for (let x = Math.max(0, ox - r); x < Math.min(CARD_W, ox + r); x++) {
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy) / r;
      if (d < 1) this.put(x, y, mix(this.get(x, y), [255, 255, 255], 0.35 * (1 - d) * (1 - d)));
    }
  }

  /** 下端の影。せり上がりの奥行き */
  shadow(top: number, depth: number): void {
    for (let y = Math.max(0, Math.floor(top)); y < CARD_H; y++) {
      const f = 1 - 0.35 * Math.min(1, (y + 0.5 - top) / depth);
      for (let x = 0; x < CARD_W; x++) this.put(x, y, shade(this.get(x, y), f));
    }
  }
}

/** ドット文字を描く。x は左端、y は上端。cell はマスの大きさ（px）。panelStyle なら立体のパネル、そうでなければ平らなドット */
function text(cv: Canvas, s: string, x: number, y: number, cell: number, color: RGB, panelStyle: boolean): void {
  const half = cell / 2 - (panelStyle ? cell * 0.07 : cell * 0.1);
  for (let i = 0; i < s.length; i++) {
    const glyph = CARD_FONT[s[i]] ?? CARD_FONT["?"];
    const col0 = i * (CARD_GLYPH_W + CARD_LETTER_GAP);
    glyph.forEach((row, r) => {
      for (let c = 0; c < CARD_GLYPH_W; c++) {
        if (row[c] !== "#") continue;
        const cx = x + (col0 + c) * cell + cell / 2;
        const cy = y + r * cell + cell / 2;
        cv.fill(cx, cy, half + cell * 0.4, panelStyle ? (px, py) => panel(px, py, cx, cy, half, color) : (px, py) => dot(px, py, cx, cy, half, color));
      }
    });
  }
}

const textWidth = (s: string, cell: number): number => cardTextCols(s) * cell;

/** 1200×630 の RGB 生データ（行フィルタなし）を返す */
export function renderCard(spec: CardSpec): Uint8Array {
  const cv = new Canvas();
  for (const [ox, oy, r] of [[120, 110, 120], [1040, 90, 90], [980, 420, 140], [260, 470, 100], [620, 60, 60]]) cv.orb(ox, oy, r);

  // 下端にせり上がってくる盤面の上 2 段。同じ柄が横に 3 つ並ばないよう決め打ち（tools/make-ogp.ts と同じ）
  const BOARD_CELL = 64;
  const rows = [
    [0, 1, 0, 2, 3, 1, 4, 0, 2, 5, 1, 3, 0, 4, 2, 1, 5, 0, 3],
    [2, 3, 1, 4, 0, 5, 1, 2, 0, 3, 4, 2, 5, 1, 0, 3, 2, 4, 1],
  ];
  const boardTop = CARD_H - BOARD_CELL * 0.35 - BOARD_CELL / 2;
  cv.shadow(boardTop - 40, 40);
  const boardX = (CARD_W - rows[0].length * BOARD_CELL) / 2;
  rows.forEach((row, r) => row.forEach((kind, c) => {
    const cx = boardX + c * BOARD_CELL + BOARD_CELL / 2;
    const cy = CARD_H - BOARD_CELL * 0.35 + r * BOARD_CELL;
    cv.fill(cx, cy, BOARD_CELL / 2, (px, py) => panel(px, py, cx, cy, BOARD_CELL / 2 - 3, COLORS[kind]));
  }));

  // 左上の題字。オープニング（src/render/logo.ts）と同じく文字ごとに柄の色を順に使う。1 行 47 マス
  const LOGO_CELL = 9;
  const logoX = 56;
  const logoY = 48;
  const logoRows = CARD_GLYPH_H;
  for (let i = 0; i < TITLE.length; i++) text(cv, TITLE[i], logoX + i * (CARD_GLYPH_W + CARD_LETTER_GAP) * LOGO_CELL, logoY, LOGO_CELL, COLORS[i % COLORS.length], true);

  // 右上のモード名
  const SMALL = 5;
  const mode = cardText(spec.mode);
  text(cv, mode, CARD_W - 56 - textWidth(mode, SMALL), logoY + (logoRows * LOGO_CELL - CARD_GLYPH_H * SMALL) / 2, SMALL, DIM, false);

  // 主役。横幅に収まる範囲で最大 34px のマス
  const main = cardText(spec.main);
  const MAIN = Math.min(32, Math.floor(1000 / cardTextCols(main)));
  const mainY = 160;
  text(cv, main, (CARD_W - textWidth(main, MAIN)) / 2, mainY, MAIN, spec.mainColor === undefined ? WHITE : rgb(spec.mainColor), true);

  // 主役の下の語
  const CAPTION = 5;
  let y = mainY + CARD_GLYPH_H * MAIN + 26;
  if (spec.caption) {
    const caption = cardText(spec.caption);
    text(cv, caption, (CARD_W - textWidth(caption, CAPTION)) / 2, y, CAPTION, DIM, false);
    y += CARD_GLYPH_H * CAPTION;
  }

  // 副情報。1 つなら中央、2 つなら左右
  const SUB = 5;
  const subY = y + 36;
  const subs = spec.subs.slice(0, 2).map((s) => ({ text: cardText(s.text), color: s.color === undefined ? WHITE : rgb(s.color) }));
  if (subs.length === 1) {
    text(cv, subs[0].text, (CARD_W - textWidth(subs[0].text, SUB)) / 2, subY, SUB, subs[0].color, false);
  } else if (subs.length === 2) {
    const gap = 96;
    const total = textWidth(subs[0].text, SUB) + gap + textWidth(subs[1].text, SUB);
    const x0 = (CARD_W - total) / 2;
    text(cv, subs[0].text, x0, subY, SUB, subs[0].color, false);
    text(cv, subs[1].text, x0 + textWidth(subs[0].text, SUB) + gap, subY, SUB, subs[1].color, false);
  }
  return cv.raw;
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of buf) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** RGB 生データを PNG にする。deflate は zlib 形式（RFC 1950）を返すもの。Node は zlib.deflateSync、Worker は CompressionStream("deflate") */
export async function encodePng(width: number, height: number, raw: Uint8Array, deflate: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>): Promise<Uint8Array> {
  const stride = width * 3 + 1;
  const filtered = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    filtered[y * stride] = 0;
    filtered.set(raw.subarray(y * width * 3, (y + 1) * width * 3), y * stride + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", await deflate(filtered)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
