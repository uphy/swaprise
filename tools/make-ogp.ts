// SNS に URL を貼ったときに出る画像（OGP、1200×630）を画像ファイルなしで生成する。
// メニューの空のグラデーションに、オープニングと同じパネルのドット文字で SWAPRISE を置き、下端にせり上がる盤面の頭を見せる。
// 実行: pnpm ogp  → public/ogp.png
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { buildLogo, logoLines } from "../src/render/logo";
import { KIND_COLORS } from "../src/render/theme";

const W = 1200;
const H = 630;

type RGB = [number, number, number];
const rgb = (hex: number): RGB => [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
const COLORS = KIND_COLORS.map(rgb);
// index.html の body の空（メニュー）
const SKY: [number, RGB][] = [[0, rgb(0x2a2690)], [0.55, rgb(0x7c3fbd)], [1, rgb(0xff7ea6)]];

function crc32(buf: Uint8Array): number {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(width: number, height: number, pixel: (x: number, y: number) => RGB): Buffer {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, f: number): RGB => [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)];

function sky(y: number): RGB {
  const t = y / (H - 1);
  for (let i = 1; i < SKY.length; i++) {
    if (t <= SKY[i][0]) return mix(SKY[i - 1][1], SKY[i][1], (t - SKY[i - 1][0]) / (SKY[i][0] - SKY[i - 1][0]));
  }
  return SKY[SKY.length - 1][1];
}

/** 角丸の正方形の内側か。(cx, cy) 中心、半辺 h、角の半径 r。かつて tools/make-icons.mjs にあったものと同じ。 */
function inRoundedSquare(x: number, y: number, cx: number, cy: number, h: number, r: number): boolean {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  if (dx > h || dy > h) return false;
  if (dx <= h - r || dy <= h - r) return true;
  const ex = dx - (h - r);
  const ey = dy - (h - r);
  return ex * ex + ey * ey <= r * r;
}

/** ゲーム内と同じ立体感のパネル。上端のハイライトと外周の影。 */
function panel(px: number, py: number, cx: number, cy: number, half: number, c: RGB): RGB | null {
  const radius = half * 0.28;
  if (!inRoundedSquare(px, py, cx, cy, half, radius)) return null;
  if (inRoundedSquare(px, py, cx, cy - half * 0.62, half * 0.78, radius * 0.6) && py < cy - half * 0.35) return shade(c, 1.25);
  if (!inRoundedSquare(px, py, cx, cy - half * 0.04, half * 0.94, radius * 0.9)) return shade(c, 0.7);
  return c;
}

interface Tile { cx: number; cy: number; half: number; color: RGB }

const tiles: Tile[] = [];

// 題字。1 行 47 マス。マスの間に少し隙間を空け、オープニングの並びと同じ見え方にする
const logo = buildLogo(logoLines(false));
const CELL = 22;
const logoW = logo.cols * CELL;
const logoX = (W - logoW) / 2;
const logoY = 200;
for (const cell of logo.cells) {
  tiles.push({ cx: logoX + cell.col * CELL + CELL / 2, cy: logoY + cell.row * CELL + CELL / 2, half: CELL / 2 - 1.5, color: COLORS[cell.kind] });
}

// 下端にせり上がってくる盤面の上 2 段。同じ柄が横に 3 つ並ばないよう決め打ち
const BOARD_CELL = 64;
const rows = [
  [0, 1, 0, 2, 3, 1, 4, 0, 2, 5, 1, 3, 0, 4, 2, 1, 5, 0, 3],
  [2, 3, 1, 4, 0, 5, 1, 2, 0, 3, 4, 2, 5, 1, 0, 3, 2, 4, 1],
];
const boardX = (W - rows[0].length * BOARD_CELL) / 2;
rows.forEach((row, r) => {
  row.forEach((kind, c) => {
    tiles.push({ cx: boardX + c * BOARD_CELL + BOARD_CELL / 2, cy: H - BOARD_CELL * 0.35 + r * BOARD_CELL, half: BOARD_CELL / 2 - 3, color: COLORS[kind] });
  });
});

// 空に浮かぶ光の玉（src/render/orbs.ts の雰囲気）
const orbs = [
  [120, 110, 120], [1040, 90, 90], [980, 420, 140], [260, 470, 100], [620, 60, 60],
];

function pixel(x: number, y: number): RGB {
  const px = x + 0.5;
  const py = y + 0.5;
  for (const t of tiles) {
    if (Math.abs(px - t.cx) > t.half || Math.abs(py - t.cy) > t.half) continue;
    const c = panel(px, py, t.cx, t.cy, t.half, t.color);
    if (c) return c;
  }
  let c = sky(y);
  for (const [ox, oy, r] of orbs) {
    const d = Math.hypot(px - ox, py - oy) / r;
    if (d < 1) c = mix(c, [255, 255, 255], 0.35 * (1 - d) * (1 - d));
  }
  // 盤面の影。下端が暗くなって、せり上がりの奥行きが出る
  const shadowTop = H - BOARD_CELL * 0.35 - BOARD_CELL / 2 - 40;
  if (py > shadowTop) c = shade(c, 1 - 0.35 * Math.min(1, (py - shadowTop) / 40));
  return [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])];
}

writeFileSync("public/ogp.png", png(W, H, pixel));
console.log("public/ogp.png");
