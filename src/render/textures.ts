import Phaser from "phaser";
import { CELL, GARBAGE_COLOR, KIND_COLORS, KIND_NAMES } from "./theme";
import { DPR } from "./hidpi";

/** カーソルの絵が 2 マスの外へ広がる幅（光の裾）。BoardView はこの分だけ左上へずらして置く */
export const CURSOR_PAD = 6;

/** 色を白（t>0）か黒（t<0）へ |t| だけ寄せる。 */
export function tint(color: number, t: number): number {
  const target = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  const ch = (shift: number): number => Math.round(((color >> shift) & 0xff) * (1 - k) + target * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export const css = (c: number, a = 1): string => `rgba(${(c >> 16) & 0xff}, ${(c >> 8) & 0xff}, ${c & 0xff}, ${a})`;

/**
 * 丸角の矩形のパスを足す。角ごとに丸みを変えられる（おじゃまの板の外周だけ丸める）。ctx.roundRect は古い Safari にない。
 * begin を false にすると今のパスに足す（十字・ばつ印を 1 回の塗りで描く）
 */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | [number, number, number, number], begin = true): void {
  const [tl, tr, br, bl] = typeof r === "number" ? [r, r, r, r] : r;
  if (begin) ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

/**
 * 柄の図形のパスを作る（塗りは呼ぶ側）。重なる部分を持つ図形（十字・ばつ印）も 1 本のパスにまとめ、
 * 1 回の fill で塗る。半透明の影を塗っても重なりが濃くならない
 */
function symbolPath(ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  switch (name) {
    case "square": {
      const s = r * 0.74;
      roundRect(ctx, cx - s, cy - s, s * 2, s * 2, r * 0.22, false);
      break;
    }
    case "circle":
      ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
      break;
    case "triangle": {
      // 角を少し丸めた三角
      const pts = [
        [cx, cy - r * 0.92],
        [cx + r * 0.95, cy + r * 0.72],
        [cx - r * 0.95, cy + r * 0.72],
      ];
      const k = r * 0.16;
      ctx.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
      for (let i = 1; i <= 3; i++) {
        const p = pts[i % 3];
        const q = pts[(i + 1) % 3];
        ctx.arcTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, k);
      }
      ctx.closePath();
      break;
    }
    case "plus":
    case "cross": {
      const t = r * (name === "plus" ? 0.3 : 0.27);
      const l = r * 0.92;
      ctx.save();
      ctx.translate(cx, cy);
      if (name === "cross") ctx.rotate(Math.PI / 4);
      roundRect(ctx, -t, -l, t * 2, l * 2, t * 0.55, false);
      roundRect(ctx, -l, -t, l * 2, t * 2, t * 0.55, false);
      ctx.restore();
      break;
    }
    case "hexagon":
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const x = cx + Math.cos(a) * r * 0.92;
        const y = cy + Math.sin(a) * r * 0.92;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
  }
}

type Variant = "" | "-dark" | "-bright";

/**
 * 1 枚のパネル。宝石のような立体の角丸で、
 * 下端の濃い縁（厚み）、上から下へのグラデーション、縁の内側の光、上半分の光沢、図形の浮き彫りの順に重ねる。
 * -dark はせり上がってくる次の行（暗く沈め、図形は薄く残す）、-bright は揃った瞬間の明るい姿
 */
function paintPanel(ctx: CanvasRenderingContext2D, color: number, variant: Variant, glyph: (cx: number, cy: number, r: number) => void): void {
  const pad = 1;
  const s = CELL - pad * 2;
  const r = 7;
  const dark = variant === "-dark";
  const base = dark ? tint(color, -0.55) : variant === "-bright" ? tint(color, 0.45) : color;

  // 厚み。本体の下からのぞく濃い色の板
  roundRect(ctx, pad, pad + 1, s, s - 1, r);
  ctx.fillStyle = css(tint(base, -0.45));
  ctx.fill();

  // 本体。上が明るく下が濃い
  roundRect(ctx, pad, pad, s, s - 2.5, r);
  const body = ctx.createLinearGradient(0, pad, 0, pad + s);
  body.addColorStop(0, css(tint(base, 0.28)));
  body.addColorStop(0.45, css(base));
  body.addColorStop(1, css(tint(base, -0.18)));
  ctx.fillStyle = body;
  ctx.fill();

  // 縁の内側の細い光。上辺で明るく、下へ消える
  roundRect(ctx, pad + 0.75, pad + 0.75, s - 1.5, s - 4, r - 0.75);
  const rim = ctx.createLinearGradient(0, pad, 0, pad + s * 0.7);
  rim.addColorStop(0, `rgba(255, 255, 255, ${dark ? 0.2 : 0.6})`);
  rim.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 上半分の光沢。角の丸みに沿った帯
  roundRect(ctx, pad + 2.5, pad + 2, s - 5, s * 0.42, [r - 2, r - 2, 4, 4]);
  const gloss = ctx.createLinearGradient(0, pad + 2, 0, pad + 2 + s * 0.42);
  gloss.addColorStop(0, `rgba(255, 255, 255, ${dark ? 0.08 : 0.34})`);
  gloss.addColorStop(1, "rgba(255, 255, 255, 0.02)");
  ctx.fillStyle = gloss;
  ctx.fill();

  const cx = CELL / 2;
  const cy = CELL / 2 - 0.5;
  const gr = CELL * 0.27;
  // 図形の影（浮き彫り）。下へずらした濃い色
  ctx.save();
  ctx.translate(0, 1.4);
  glyph(cx, cy, gr);
  ctx.fillStyle = css(tint(base, -0.5), dark ? 0.5 : 0.55);
  ctx.fill();
  ctx.restore();
  // 図形。白から淡い柄の色へのグラデーション
  glyph(cx, cy, gr);
  const face = ctx.createLinearGradient(0, cy - gr, 0, cy + gr);
  if (dark) {
    face.addColorStop(0, css(tint(color, 0.2), 0.32));
    face.addColorStop(1, css(tint(color, 0.05), 0.32));
  } else {
    face.addColorStop(0, "#ffffff");
    face.addColorStop(1, css(tint(base, 0.78)));
  }
  ctx.fillStyle = face;
  ctx.fill();
}

/** おじゃまの板の縁のフレーム名。ブロックの外周に当たる辺を、ビット 1=上, 2=右, 4=下, 8=左 で表す */
export function garbageFrame(top: boolean, right: boolean, bottom: boolean, left: boolean): string {
  return String((top ? 1 : 0) | (right ? 2 : 0) | (bottom ? 4 : 0) | (left ? 8 : 0));
}

/**
 * おじゃまの 1 マス。ブロック全体が 1 枚の板に見えるよう、外周に当たる辺だけに縁と丸みを付ける。
 * 斜めの筋は 8px 周期で引くので、隣のマスと柄がつながる
 */
function paintGarbage(ctx: CanvasRenderingContext2D, edges: number, base: number, shock: boolean): void {
  const top = (edges & 1) !== 0;
  const right = (edges & 2) !== 0;
  const bottom = (edges & 4) !== 0;
  const left = (edges & 8) !== 0;
  const inset = 1;
  const x0 = left ? inset : 0;
  const y0 = top ? inset : 0;
  const x1 = right ? CELL - inset : CELL;
  const y1 = bottom ? CELL - inset : CELL;
  const R = 7;
  const radii: [number, number, number, number] = [top && left ? R : 0, top && right ? R : 0, bottom && right ? R : 0, bottom && left ? R : 0];

  roundRect(ctx, x0, y0, x1 - x0, y1 - y0, radii);
  // 平塗り。マスごとにグラデーションを掛けると、2 段以上の板で段の境目に筋が出る
  ctx.fillStyle = css(tint(base, -0.04));
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (shock) {
    // 石の板。明暗のまだらと、ひびの線
    ctx.fillStyle = css(tint(base, 0.14), 0.6);
    for (const [x, y, rr] of [[7, 8, 6], [23, 22, 7], [26, 6, 4], [9, 25, 4]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = css(tint(base, -0.45), 0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 17);
    ctx.lineTo(10, 14);
    ctx.lineTo(16, 19);
    ctx.lineTo(24, 15);
    ctx.lineTo(32, 17);
    ctx.moveTo(16, 19);
    ctx.lineTo(15, 32);
    ctx.moveTo(10, 14);
    ctx.lineTo(12, 0);
    ctx.stroke();
  } else {
    ctx.strokeStyle = css(tint(base, 0.16), 0.5);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let k = -CELL; k < CELL * 2; k += 8) {
      ctx.moveTo(k, CELL);
      ctx.lineTo(k + CELL, 0);
    }
    ctx.stroke();
  }
  ctx.restore();

  // 外周の縁。上と左は明るく、下と右は暗く（立体に見せる）
  const hi = "rgba(255, 255, 255, 0.55)";
  const lo = css(tint(base, -0.55), 0.95);
  const line = (on: boolean, color: string, width: number, ax: number, ay: number, bx: number, by: number): void => {
    if (!on) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  };
  line(top, hi, 1.5, x0 + radii[0], y0 + 0.75, x1 - radii[1], y0 + 0.75);
  line(left, hi, 1.5, x0 + 0.75, y0 + radii[0], x0 + 0.75, y1 - radii[3]);
  line(bottom, lo, 2.5, x0 + radii[3], y1 - 1.25, x1 - radii[2], y1 - 1.25);
  line(right, lo, 2, x1 - 1, y0 + radii[1], x1 - 1, y1 - radii[2]);
  // 丸めた角の弧も同じ明暗で縁取る
  const arc = (on: boolean, cx: number, cy: number, a0: number, a1: number, color: string, width: number): void => {
    if (!on) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, R - width / 2, a0, a1);
    ctx.stroke();
  };
  arc(radii[0] > 0, x0 + R, y0 + R, Math.PI, Math.PI * 1.5, hi, 1.5);
  arc(radii[1] > 0, x1 - R, y0 + R, Math.PI * 1.5, Math.PI * 2, "rgba(255, 255, 255, 0.3)", 1.5);
  arc(radii[2] > 0, x1 - R, y1 - R, 0, Math.PI / 2, lo, 2.5);
  arc(radii[3] > 0, x0 + R, y1 - R, Math.PI / 2, Math.PI, lo, 2.5);
}

/**
 * パネル・おじゃま・カーソル・光の粒のテクスチャを canvas 2D で生成する。画像ファイルは使わない。
 * Phaser の Graphics は WebGL でアンチエイリアスがなくグラデーションも描けないので、canvas に DPR 倍で描いて使う。
 * 使う側は Image を 1/DPR に縮める。絵は変わらないので、2 回目以降の呼び出しでは作り直さない
 */
export function createTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists("cursor")) return;
  const make = (key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): void => {
    const texture = scene.textures.createCanvas(key, Math.ceil(w * DPR), Math.ceil(h * DPR));
    if (!texture) return;
    const ctx = texture.context;
    ctx.save();
    ctx.scale(DPR, DPR);
    paint(ctx);
    ctx.restore();
    texture.refresh();
  };

  KIND_COLORS.forEach((color, kind) => {
    for (const variant of ["", "-dark", "-bright"] as const) {
      make(`panel-${kind}${variant}`, CELL, CELL, (ctx) => paintPanel(ctx, color, variant, (cx, cy, r) => symbolPath(ctx, KIND_NAMES[kind], cx, cy, r)));
    }
  });

  // ビックリパネル。銀の地に「！」。通常の柄とは揃わない対戦専用のパネル。
  for (const variant of ["", "-dark", "-bright"] as const) {
    make(`panel-6${variant}`, CELL, CELL, (ctx) =>
      paintPanel(ctx, 0x9a9ab4, variant, (cx, cy, r) => {
        roundRect(ctx, cx - r * 0.24, cy - r * 0.98, r * 0.48, r * 1.22, r * 0.2);
        ctx.moveTo(cx + r * 0.27, cy + r * 0.66);
        ctx.arc(cx, cy + r * 0.66, r * 0.27, 0, Math.PI * 2);
      }),
    );
  }

  // おじゃま。縁の組み合わせ 16 通りをフレームとして 1 枚に並べる（キーは garbage のまま、フレームで縁を選ぶ）
  for (const [key, base, shock] of [["garbage", GARBAGE_COLOR, false], ["garbage-shock", 0x7a7a88, true]] as const) {
    const texture = scene.textures.createCanvas(key, Math.ceil(CELL * 16 * DPR), Math.ceil(CELL * DPR));
    if (!texture) continue;
    const ctx = texture.context;
    for (let edges = 0; edges < 16; edges++) {
      ctx.save();
      ctx.scale(DPR, DPR);
      ctx.translate(edges * CELL, 0);
      ctx.beginPath();
      ctx.rect(0, 0, CELL, CELL);
      ctx.clip();
      paintGarbage(ctx, edges, base, shock);
      ctx.restore();
      texture.add(String(edges), 0, Math.round(edges * CELL * DPR), 0, Math.round(CELL * DPR), Math.round(CELL * DPR));
    }
    texture.refresh();
  }

  make("white", CELL, CELL, (ctx) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CELL, CELL);
  });

  // 揃ったときの輪。白い円環を ADD で重ねて広げる
  make("ring", 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 16, 32, 32, 31);
    g.addColorStop(0, "rgba(255, 255, 255, 0)");
    g.addColorStop(0.6, "rgba(255, 255, 255, 0.85)");
    g.addColorStop(0.8, "rgba(255, 255, 255, 0.3)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });

  // 小さな光の粒。消えたパネルの火花に使う
  make("spark", 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(255, 255, 255, 1)");
    g.addColorStop(0.35, "rgba(255, 255, 255, 0.6)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });

  // カーソル（横 2 マス）。白い太枠に淡い光をまとわせ、中央に仕切りの刻みを入れる。内外の暗い縁で明るいパネルの上でも見える
  const P = CURSOR_PAD;
  make("cursor", CELL * 2 + P * 2, CELL + P * 2, (ctx) => {
    const x = P - 1;
    const y = P - 1;
    const w = CELL * 2 + 2;
    const h = CELL + 2;
    roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 10);
    ctx.strokeStyle = "rgba(20, 10, 50, 0.5)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = "rgba(170, 235, 255, 1)";
    ctx.shadowBlur = 5;
    roundRect(ctx, x, y, w, h, 8);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
    ctx.strokeStyle = "rgba(20, 10, 50, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // 仕切り。上下の縁から内へ短い刻み
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, x + w / 2 - 1.5, y, 3, 6, 1.5);
    ctx.fill();
    roundRect(ctx, x + w / 2 - 1.5, y + h - 6, 3, 6, 1.5);
    ctx.fill();
  });
}
