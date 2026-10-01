import Phaser from "phaser";
import type { Board } from "../core";
import { COLS, deathGrace } from "../core";
import { BOARD_H, BOARD_W, CELL, FONT_UI, STOP_COLORS } from "./theme";
import { dangerColumns, musicDanger } from "./musicDanger";
import { DPR } from "./hidpi";
import { roundRect } from "./textures";

/** 外側の赤い光が、枠の外形から外へ届く距離（px） */
const OUTLINE_REACH = 28;
/** 光の穴を枠の外形より内側へ寄せる幅（px）。枠の縁の下に隠し、境目に隙間を出さない */
const OUTLINE_INSET = 3;
/** 下辺の光の強さ（上辺を 1 とした割合）。下の角まで回り込ませつつ、目は上の危険に向ける */
const OUTLINE_BOTTOM = 0.25;

/** 猶予の輪の半径と太さ（px）。上の縁の真ん中に、縁と上端の行に半分ずつ重ねて置く */
const RING_R = 12;
const RING_W = 4.5;
/** 猶予を数えている間の枠の明滅の周期（フレーム）。危険（高さ 9 以上）だけのときは 60 フレームでゆっくり息をする */
const FAST_BLINK = 16;

/** 天井に触れている間の猶予の見え方。counting は数えている（減っていく）、stop は停止中で守られている、busy は消去・落下の途中で止まっている */
export type GraceState = "counting" | "stop" | "busy";

/** 盤面の枠の形。BoardView の縁の幅と丸み（枠の赤みを縁にぴったり重ねる） */
export interface FrameShape {
  pad: number;
  radius: number;
  inner: number;
}

/**
 * 危険の警告。盤面の外側の赤い光（root、枠の後ろ）と、枠そのものの赤み・危険な列の上端の赤い帯（front、パネルの上）。
 * Container に入れるので、拡縮・回転・2人対戦にも追従する。
 * 外側の光だけでは弱く、スマホでは盤面の外に余白がほとんどなくて見えなかったので、枠と列にも出す
 */
export class DangerGlow {
  readonly root: Phaser.GameObjects.Container;
  /** 枠の赤みと列の帯。BoardView が枠の四隅の蓋より上に置く */
  readonly front: Phaser.GameObjects.Container;
  private readonly bezel: Phaser.GameObjects.Image;
  private readonly columnGfx: Phaser.GameObjects.Graphics;
  /** 危険な列（下から DANGER_ROW 段を超えて積もった列）。e2e が確かめる */
  columns: boolean[] = new Array(COLS).fill(false);
  /** いま塗っている危険な列と、その角の丸み。e2e が確かめる */
  tints: { column: number; radius: { tl: number; tr: number; bl: number; br: number } }[] = [];
  private readonly outline: Phaser.GameObjects.Image;
  private readonly top: Phaser.GameObjects.Image;
  private readonly ceiling: Phaser.GameObjects.Rectangle;
  private readonly ringGfx: Phaser.GameObjects.Graphics;
  private readonly ringText: Phaser.GameObjects.Text;
  private level = 0;
  private ceilingLevel = 0;
  /** 天井に触れている間の猶予の輪。e2e が確かめる。left は残りの割合（0〜1）、icon は輪の中に描いた印（停止中の盾） */
  grace: { visible: boolean; state: GraceState; left: number; text: string; icon: "shield" | null } = { visible: false, state: "counting", left: 1, text: "", icon: null };

  /** 枠の形。e2e が光の形と枠の形の対応を確かめる */
  readonly frame: FrameShape;

  constructor(scene: Phaser.Scene, frame: FrameShape) {
    this.frame = frame;
    // 枠の外周を一周する光を一枚で描く。枠と同じ角丸の形からの距離で濃さを決め、角でも辺と同じ赤みにする。
    // 以前は角の四角い矩形からの距離にしていたので、丸い枠の角と光の四角い穴の間に隙間ができ、背景の青が透けていた。
    // 光の穴は枠の外形より少し内側（OUTLINE_INSET）にして、枠の縁の下に隠す。
    // 危険は上から来るので、上辺を最も強くし、下へいくほど弱めて下辺は淡く回す（以前は下辺に光がなく、左右の光が下端で水平に途切れていた）
    const margin = frame.pad - OUTLINE_INSET + OUTLINE_REACH;
    if (!scene.textures.exists("danger-outline")) {
      const width = BOARD_W + margin * 2;
      const height = BOARD_H + margin * 2;
      const texture = scene.textures.createCanvas("danger-outline", width, height);
      if (texture) {
        const edge = frame.pad - OUTLINE_INSET;
        const r = Math.max(0, frame.radius - OUTLINE_INSET);
        // 角の丸みの中心（盤面の座標）
        const cx0 = -edge + r;
        const cx1 = BOARD_W + edge - r;
        const cy0 = -edge + r;
        const cy1 = BOARD_H + edge - r;
        const pixels = texture.context.createImageData(width, height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const bx = x + 0.5 - margin;
            const by = y + 0.5 - margin;
            const qx = Math.max(cx0 - bx, bx - cx1);
            const qy = Math.max(cy0 - by, by - cy1);
            const distance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
            if (distance <= 0 || distance >= OUTLINE_REACH) continue;
            // 上端で 1、下端で OUTLINE_BOTTOM の重み。途中はなめらかに下げる
            const t = Math.min(1, Math.max(0, by / BOARD_H));
            const weight = 1 - (1 - OUTLINE_BOTTOM) * t * t * (3 - 2 * t);
            const offset = (y * width + x) * 4;
            pixels.data.set([255, 64, 99, Math.round(255 * weight * Math.pow(1 - distance / OUTLINE_REACH, 2.5))], offset);
          }
        }
        texture.context.putImageData(pixels, 0, 0);
        texture.refresh();
      }
    }
    // 天井接触時の強調は、つながった外周の光へ上から重ねる。
    if (!scene.textures.exists("danger-edge-y")) {
      const texture = scene.textures.createCanvas("danger-edge-y", 8, 64);
      if (texture) {
        const ctx = texture.context;
        const gradient = ctx.createLinearGradient(0, 0, 0, 64);
        gradient.addColorStop(0, "rgba(255, 64, 99, 0)");
        gradient.addColorStop(0.5, "rgba(255, 64, 99, 0.15)");
        gradient.addColorStop(1, "rgba(255, 64, 99, 1)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 8, 64);
        texture.refresh();
      }
    }
    this.root = scene.add.container(0, 0).setVisible(false);
    this.outline = scene.add.image(-margin, -margin, "danger-outline").setOrigin(0);
    this.top = scene.add.image(-4, -32, "danger-edge-y").setOrigin(0).setDisplaySize(BOARD_W + 8, 28);
    this.ceiling = scene.add.rectangle(-4, -5, BOARD_W + 8, 3, 0xff8c9e).setOrigin(0).setAlpha(0);
    this.root.add([this.outline, this.top, this.ceiling]);
    // 枠の縁と同じ形の赤い帯。内側は盤面の丸角でくり抜き、四隅の蓋も覆う
    const key = `danger-bezel-${frame.pad}-${frame.radius}-${frame.inner}`;
    if (!scene.textures.exists(key)) {
      const w = BOARD_W + frame.pad * 2;
      const h = BOARD_H + frame.pad * 2;
      const texture = scene.textures.createCanvas(key, Math.ceil(w * DPR), Math.ceil(h * DPR));
      if (texture) {
        const ctx = texture.context;
        ctx.scale(DPR, DPR);
        ctx.translate(frame.pad, frame.pad);
        roundRect(ctx, -frame.pad, -frame.pad, w, h, frame.radius);
        const band = ctx.createLinearGradient(0, -frame.pad, 0, BOARD_H + frame.pad);
        band.addColorStop(0, "#ff7088");
        band.addColorStop(0.06, "#f0304f");
        band.addColorStop(1, "#b0182f");
        ctx.fillStyle = band;
        ctx.fill();
        ctx.globalCompositeOperation = "destination-out";
        roundRect(ctx, 0, 0, BOARD_W, BOARD_H, frame.inner);
        ctx.fill();
        texture.refresh();
      }
    }
    this.bezel = scene.add.image(-frame.pad, -frame.pad, key).setOrigin(0).setScale(1 / DPR).setAlpha(0);
    this.columnGfx = scene.add.graphics();
    this.ringGfx = scene.add.graphics();
    this.ringText = scene.add
      .text(BOARD_W / 2, -frame.pad / 2, "", { fontFamily: FONT_UI, fontSize: "10px", fontStyle: "700", color: "#ffffff" })
      .setOrigin(0.5)
      .setVisible(false);
    this.front = scene.add.container(0, 0, [this.bezel, this.columnGfx, this.ringGfx, this.ringText]).setVisible(false);
  }

  update(board: Board, delta: number, active: boolean): void {
    // 終了では警告を消す。停止中は delta=0 として復帰の途中でも表示を保持する。
    const danger = active && !board.gameOver && musicDanger(board);
    const panic = danger && board.panic;
    const approach = (value: number, target: number, ms: number): number => target + (value - target) * Math.exp(-Math.max(0, delta) / ms);
    this.level = approach(this.level, danger ? 1 : 0, danger ? 220 : 320);
    this.ceilingLevel = approach(this.ceilingLevel, panic ? 1 : 0, panic ? 140 : 240);
    // 危険（高さ 9 以上）は 1 秒周期の緩い明滅。天井に触れて猶予を数えている間だけ、枠と天井の線を速く明滅させて見分ける。
    // 停止中や消去・落下の途中で猶予が止まっている間は速めない（ゲーム時間に同期するのでポーズ中は止まる）
    const graceState: GraceState = !board.deathHeld ? "counting" : board.stopTimer > 0 ? "stop" : "busy";
    const counting = panic && graceState === "counting";
    const breath = (1 + Math.cos(board.frame * Math.PI * 2 / (counting ? FAST_BLINK : 60))) / 2;
    this.outline.setAlpha(this.level * 0.65);
    this.top.setAlpha(this.ceilingLevel * (0.2 + breath * 0.25));
    this.ceiling.setAlpha(this.ceilingLevel * (0.55 + breath * 0.4));
    this.root.setVisible(this.level > 0.005 || this.ceilingLevel > 0.005);
    // 枠を赤く染め、危険な列の上端のマスに赤い帯を明滅させる（0.67 秒周期。ゲーム時間に同期するのでポーズ中は止まる）
    this.bezel.setAlpha(this.level * (counting ? 0.45 + breath * 0.55 : 0.8 + breath * 0.2));
    this.drawGrace(board, panic, graceState);
    this.columns = danger ? dangerColumns(board) : this.columns.map(() => false);
    const g = this.columnGfx;
    g.clear();
    this.tints = [];
    if (this.level > 0.005) {
      const blink = (1 + Math.cos(board.frame * Math.PI * 2 / 40)) / 2;
      this.columns.forEach((on, c) => {
        if (!on) return;
        // 上端のマスを薄い赤で塗るだけにする。以前は上端に明るい線も引いていたが、赤く染めた枠の縁と重なって見え、
        // 盤面の丸い内角にもまっすぐな線が食い込んでいた。左右の端の列は、外側の上の角を盤面の内角と同じ丸みにする
        const radius = { tl: c === 0 ? this.frame.inner : 0, tr: c === COLS - 1 ? this.frame.inner : 0, bl: 0, br: 0 };
        g.fillStyle(0xff4063, this.level * (0.18 + blink * 0.3));
        g.fillRoundedRect(c * CELL, 0, CELL, CELL, radius);
        this.tints.push({ column: c, radius });
      });
    }
    this.front.setVisible(this.level > 0.005);
  }

  /**
   * 天井に触れている間、上の縁の真ん中に猶予の残りの輪を出す。数えている間は白い輪が時計回りに減り、中に残りの秒数を出す。
   * 停止中は輪を停止のゲージと同じ水色にし、数字の代わりに盾の印を出して、守られていて減らないことを示す。
   * 停止中に猶予の秒数（例「2.0」）を出すと、下のゲージの停止の残り（例「STOP 11.5s」）と読み違えやすかった。消去・落下の途中は白のまま止める
   */
  private drawGrace(board: Board, panic: boolean, state: GraceState): void {
    const g = this.ringGfx;
    g.clear();
    const total = deathGrace(board.level);
    const left = Math.max(0, Math.min(1, 1 - board.deathTimer / total));
    const alpha = this.ceilingLevel;
    const visible = panic && alpha > 0.005;
    const seconds = Math.max(0, (total - board.deathTimer) / 60);
    // 縦持ちの CPU 戦の相手の盤面（半分の大きさ）では数字が読めないので、輪だけにする
    const small = (this.front.parentContainer?.scaleX ?? 1) < 0.75;
    const stop = state === "stop";
    const showText = visible && !small && !stop;
    this.grace = { visible, state, left, text: showText ? seconds.toFixed(1) : "", icon: visible && stop ? "shield" : null };
    this.ringText.setVisible(showText);
    if (!visible) return;
    const cx = BOARD_W / 2;
    const cy = -this.frame.pad / 2;
    const color = stop ? STOP_COLORS.normal.fill : 0xffffff;
    // 地の円（夜空の紺）と、減った分の暗い赤の溝
    g.fillStyle(0x1c1238, 0.9 * alpha);
    g.fillCircle(cx, cy, RING_R + RING_W / 2 + 1.5);
    g.lineStyle(RING_W, stop ? 0x1d4f73 : 0x7a1830, alpha);
    g.strokeCircle(cx, cy, RING_R);
    if (left > 0) {
      g.lineStyle(RING_W, color, alpha);
      g.beginPath();
      g.arc(cx, cy, RING_R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left, false);
      g.strokePath();
    }
    if (stop) {
      // 盾の印。上辺が平らで、下へすぼまって尖る形を水色で塗り、中に明るい縦の筋を 1 本入れる
      const w = 5.5;
      const top = cy - 6;
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(cx - w, top);
      g.lineTo(cx + w, top);
      g.lineTo(cx + w, cy + 0.5);
      g.lineTo(cx, cy + 7);
      g.lineTo(cx - w, cy + 0.5);
      g.closePath();
      g.fillPath();
      g.lineStyle(1.5, STOP_COLORS.normal.light, alpha);
      g.lineBetween(cx, top + 2, cx, cy + 4);
    }
    this.ringText
      .setText(this.grace.text)
      .setColor(stop ? STOP_COLORS.normal.text : "#ffffff")
      .setAlpha(alpha);
  }
}
