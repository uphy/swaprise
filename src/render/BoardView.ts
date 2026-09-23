import Phaser from "phaser";
import { t } from "./i18n";
import { Board, COLS, EMPTY, ROWS, TIMING, TOTAL_ROWS, isPanel, type BoardEvent } from "../core";
import { BOARD_BG, BOARD_H, BOARD_W, CARD, CELL, FONT_UI, GARBAGE_COLOR, KIND_COLORS, TEXT_COLOR, TEXT_DIM, chainColor, isTouchDevice } from "./theme";
import { CURSOR_PAD, css, garbageFrame, roundRect, tint } from "./textures";
import { gradientFill } from "./ui";
import { audio } from "./shared";
import { haptics } from "./haptics";
import { DPR } from "./hidpi";
import type { TouchInput } from "./touch";
import { DangerGlow } from "./DangerGlow";
import { ResultEffect, type ResultOutcome } from "./ResultEffect";

export type HudSide = "top" | "left" | "right";
/** この連鎖数から、相手の連鎖を自分の盤面に知らせる。 */
export const OPPONENT_CHAIN_ALERT = 4;

/**
 * 相手の盤面のイベントから大きな連鎖を拾い、自分の盤面に知らせる。
 * 相手の盤面は小さく描かれることがあり（縦持ちの CPU 戦・オンライン）、吹き出しだけでは相手が連鎖を組んだと分からない
 */
export function announceOpponentChains(events: BoardEvent[], mine: BoardView): void {
  for (const e of events) {
    if (e.type !== "match" || e.chain < OPPONENT_CHAIN_ALERT) continue;
    mine.announce(t("OPPONENT x{chain}!", { chain: e.chain }), chainColor(e.chain));
    audio.opponentChain();
  }
}
/** 盤面と横置きの HUD の間隔。 */
const HUD_GAP = 12;
/**
 * 盤面の枠。パネルの外側に FRAME_PAD の縁（ベゼル）を回し、その外に色の光と影を落とす。
 * 縁は上が明るく下が濃いグラデーションで、盤面が空から一段浮いた板に見える
 */
const FRAME_PAD = 7;
const FRAME_RADIUS = 15;
const BOARD_RADIUS = 9;
/** 枠の絵が盤面の外へ広がる幅。縁と、外の光・影の裾 */
const FRAME_EXTENT = FRAME_PAD + 24;
/** HUD の文字の影と、札の地の色（夜空の紺） */
const HUD_INK = "#1c1238";
const PLATE = 0x120c2c;
/** 時間・速度・最大連鎖の札の高さ */
const CHIP_H = 20;

/** 描画する行の範囲。可視12段の上に、降ってくるおじゃまが見えるぶんだけ余裕を持たせる。 */
const DRAW_ROWS = Math.min(TOTAL_ROWS, ROWS + 6);

/**
 * 1つの Board を描く。Board の状態を毎フレーム読んで Image の位置・テクスチャを更新するだけで、
 * 自前の状態はエフェクト（吹き出し・揺れ）しか持たない。
 *
 * 表示物はすべて root の Container に入れ、盤面の左上を (0, 0) とする局所座標で置く。
 * 画面上の位置と大きさは place() で root を動かして決める。回転や非対称レイアウト（CPU の盤面を小さく描く）はこれで賄う。
 */
export class BoardView {
  private readonly root: Phaser.GameObjects.Container;
  private readonly cells: Phaser.GameObjects.Image[][] = [];
  private readonly nextCells: Phaser.GameObjects.Image[] = [];
  private readonly cursor: Phaser.GameObjects.Image;
  private readonly showSwapCursor = !isTouchDevice();
  private readonly touchGfx: Phaser.GameObjects.Graphics;
  /** レッスンの目印。動かす 2 マスを黄色の枠で点滅させる */
  private readonly hintGfx: Phaser.GameObjects.Graphics;
  private hintCells: { x: number; y: number }[] = [];
  touch: TouchInput | null = null;
  private readonly frame: Phaser.GameObjects.Image;
  /** 四隅の蓋。角のパネルの隅が盤面の丸角の外に出るぶんを、枠の帯と同じ色で覆う（パネルの上に置く） */
  private readonly corners: Phaser.GameObjects.Image[];
  /** 盤面の中の色。e2e が警告の演出で変わっていないことを確かめる */
  readonly bgColor = BOARD_BG;
  private readonly dangerGlow: DangerGlow;
  /** 1P・VS CPU などの名前。枠の色の札に濃い文字で載せる */
  private readonly labelText: Phaser.GameObjects.Text;
  /** 得点の見出し（SCORE）と数字 */
  private readonly scoreCaption: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  /** 名前の札と得点の板 */
  private readonly hudGfx: Phaser.GameObjects.Graphics;
  /** 得点の板を描いたときの数字の幅。桁が増えたら描き直す */
  private hudScoreW = -1;
  /** 時間・速度・最大連鎖の札。見出しと値の組を横（HUD が横なら縦）に並べる */
  private readonly statsGfx: Phaser.GameObjects.Graphics;
  private readonly chips: { caption: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text }[] = [];
  /** 札の並びの上端（HUD が上のとき）。place() の infoY */
  private infoY = BOARD_H + 14;
  /** 札の中身を 1 行にした文字列（例: 00:12   SPEED 1   MAX x1）。描き直しの判定と e2e に使う */
  infoLine = "";
  /** 枠の縁の色 */
  private readonly color: number;
  private readonly pendingGfx: Phaser.GameObjects.Graphics;
  /** 予告おじゃまの段数。バーの脇に数字で出す */
  private readonly pendingText: Phaser.GameObjects.Text;
  /** 予告の板が降りられる状態（transit を過ぎて静止待ち）だったか。false→true の瞬間に警告音を鳴らす */
  private pendingReady = false;
  /** 危険・天井・着地前の警告音を鳴らすか。handleEvents で受けた値を draw でも使う */
  private warnOn = true;
  private readonly overlay: Phaser.GameObjects.Container;
  private resultEffect: ResultEffect | null = null;
  private readonly overlayTitle: Phaser.GameObjects.Text;
  private readonly overlayBody: Phaser.GameObjects.Text;
  /** 結果の本文の下敷き */
  private readonly overlayPlate: Phaser.GameObjects.Graphics;
  /** 停止時間のゲージ。盤面の下の縁に沿って光る */
  private readonly stopBar: Phaser.GameObjects.Graphics;
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  /** 消えたパネルの破片。柄ごとに 1 つ */
  private readonly emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  /** 揃った瞬間の白い閃き。使い回す */
  private readonly flashes: Phaser.GameObjects.Image[] = [];
  /** 表示中の得点。実際の得点へ数字が回って追いつく */
  private shownScore = 0;
  /** 得点の文字を弾ませる残り時間 */
  private scoreBump = 0;
  /** 盤面の左上の画面座標（論理 px）と拡大率。place() で更新する。 */
  ox = 0;
  oy = 0;
  scale = 1;
  /** 得点・時間・予告おじゃまを置く場所。top は盤面の上下、left / right は盤面の横（横持ちのスマホ用）。 */
  hud: HudSide = "top";

  /** 盤面の中心の画面座標。カウントダウンの数字を出す位置に使う。 */
  get center(): { x: number; y: number } {
    return { x: this.ox + (BOARD_W / 2) * this.scale, y: this.oy + (BOARD_H / 2) * this.scale };
  }

  /** 画面上の位置と大きさを決める。生成直後とレイアウト変更時に呼ぶ。 */
  place(ox: number, oy: number, scale = 1, hud: HudSide = "top", infoY = BOARD_H + 14): void {
    this.ox = ox;
    this.oy = oy;
    this.scale = scale;
    this.hud = hud;
    this.root.setPosition(ox, oy).setScale(scale);
    this.infoY = infoY;
    this.layoutHud();
    this.layoutStats();
  }

  /**
   * 名前の札と得点の板を置き直す。HUD が上なら盤面の上に 1 行で [1P] SCORE 012345、
   * 横なら盤面の脇に縦に積む。得点の数字の幅が変わったら draw からも呼ぶ
   */
  private layoutHud(): void {
    const g = this.hudGfx;
    g.clear();
    const label = this.labelText;
    const hasScore = !this.style;
    const pillPadX = 9;
    const pillH = 22;
    const pillW = label.width + pillPadX * 2;
    this.hudScoreW = this.scoreText.width;
    const plate = (x: number, y: number, w: number, h: number): void => {
      g.fillStyle(PLATE, 0.62);
      g.fillRoundedRect(x, y, w, h, Math.min(15, h / 2));
      g.lineStyle(1, 0xffffff, 0.2);
      g.strokeRoundedRect(x, y, w, h, Math.min(15, h / 2));
    };
    const pill = (x: number, cy: number): void => {
      // 名前の札。枠と同じ色で、下に濃い厚み、上に細い光
      g.fillStyle(tint(this.color, -0.35), 1);
      g.fillRoundedRect(x, cy - pillH / 2 + 1.5, pillW, pillH, pillH / 2);
      g.fillStyle(this.color, 1);
      g.fillRoundedRect(x, cy - pillH / 2, pillW, pillH, pillH / 2);
      g.fillStyle(0xffffff, 0.35);
      g.fillRoundedRect(x + 4, cy - pillH / 2 + 2, pillW - 8, pillH * 0.38, { tl: pillH * 0.3, tr: pillH * 0.3, bl: 2, br: 2 });
    };
    if (this.hud === "top" && this.scale < 1) {
      // 小さく描く相手の盤面は幅が足りないので、名前の札と得点を 2 段に積む（画面では盤面の上 12〜60px）
      pill(0, -52);
      label.setOrigin(0.5, 0.5).setPosition(pillW / 2, -52);
      if (hasScore) {
        plate(-4, -38, 4 + 10 + this.scoreText.width + 14, 30);
        this.scoreText.setOrigin(0, 0.5).setPosition(10, -23);
      }
    } else if (this.hud === "top") {
      const cy = -24;
      const plateH = 30;
      // 幅が足りないとき（小さく描く相手の盤面、盤面の右上にポーズボタンが入るとき）は SCORE の見出しを省く
      const fits = 4 + pillW + 10 + this.scoreCaption.width + 6 + this.scoreText.width + 14 <= this.hudMaxW + 4;
      const captionW = fits ? this.scoreCaption.width : -6;
      if (hasScore) {
        const w = 4 + pillW + 10 + captionW + 6 + this.scoreText.width + 14;
        plate(-4, cy - plateH / 2, w, plateH);
      }
      pill(0, cy);
      label.setOrigin(0.5, 0.5).setPosition(pillW / 2, cy);
      this.scoreCaption.setOrigin(0, 0.5).setPosition(pillW + 10, cy + 1);
      this.scoreText.setOrigin(0, 0.5).setPosition(pillW + 10 + captionW + 6, cy);
    } else {
      // 横置きは幅が狭いので、名前・得点・札を縦に積む。右の HUD は左揃え、左の HUD は右揃え
      const right = this.hud === "right";
      const edge = right ? BOARD_W + HUD_GAP : -HUD_GAP;
      const colW = 100;
      const x0 = right ? edge : edge - colW;
      const pillX = right ? edge : edge - pillW;
      pill(pillX, pillH / 2);
      label.setOrigin(0.5, 0.5).setPosition(pillX + pillW / 2, pillH / 2);
      if (hasScore) {
        plate(x0, pillH + 6, colW, 42);
        this.scoreCaption.setOrigin(0, 0).setPosition(x0 + 11, pillH + 10);
        this.scoreText.setOrigin(0, 0.5).setPosition(x0 + 10, pillH + 6 + 28);
      }
    }
    this.scoreCaption.setVisible(hasScore && !(this.hud === "top" && (this.scale < 1 || this.scoreText.x < this.scoreCaption.x + this.scoreCaption.width)));
  }

  /** 盤面の上の名前と得点の板に使える幅。盤面の右上にポーズボタンを置くときに狭める */
  private hudMaxW = Infinity;

  setHudMaxWidth(w: number): void {
    if (w === this.hudMaxW) return;
    this.hudMaxW = w;
    this.layoutHud();
  }

  /** 札の並びを置き直す。中身（見出し・値）が変わったときにも呼ぶ */
  private layoutStats(): void {
    const g = this.statsGfx;
    g.clear();
    const gap = 4;
    const padX = 7;
    const inner = 4;
    const widths = this.chips.map(({ caption, value }) => padX * 2 + (caption.text ? caption.width + inner : 0) + value.width);
    this.chipRects = [];
    const drawChip = (i: number, x: number, y: number, w: number): void => {
      const { caption, value } = this.chips[i];
      this.chipRects.push({ x, y, w });
      g.fillStyle(PLATE, 0.62);
      g.fillRoundedRect(x, y, w, CHIP_H, CHIP_H / 2);
      g.lineStyle(1, 0xffffff, 0.2);
      g.strokeRoundedRect(x, y, w, CHIP_H, CHIP_H / 2);
      caption.setOrigin(0, 0.5).setPosition(x + padX, y + CHIP_H / 2 + 0.5);
      value.setOrigin(0, 0.5).setPosition(x + padX + (caption.text ? caption.width + inner : 0), y + CHIP_H / 2);
    };
    if (this.hud === "top") {
      // 盤面の右端に揃えて右から並べる
      let x = BOARD_W;
      for (let i = this.chips.length - 1; i >= 0; i--) {
        x -= widths[i];
        drawChip(i, x, this.infoY, widths[i]);
        x -= gap;
      }
    } else {
      const right = this.hud === "right";
      const edge = right ? BOARD_W + HUD_GAP : -HUD_GAP;
      const top = this.style ? 30 : 78;
      this.chips.forEach((_, i) => drawChip(i, right ? edge : edge - widths[i], top + i * (CHIP_H + gap), widths[i]));
    }
  }

  /** 札の並びの画面上の範囲（論理 px）。e2e がせり上げバーとの間隔を確かめる */
  statsBounds(): { x: number; y: number; width: number; height: number } {
    const rects = this.chipRects;
    if (!rects.length) return { x: this.ox, y: this.oy, width: 0, height: 0 };
    const x0 = Math.min(...rects.map((r) => r.x));
    const y0 = Math.min(...rects.map((r) => r.y));
    const x1 = Math.max(...rects.map((r) => r.x + r.w));
    const y1 = Math.max(...rects.map((r) => r.y + CHIP_H));
    return { x: this.ox + x0 * this.scale, y: this.oy + y0 * this.scale, width: (x1 - x0) * this.scale, height: (y1 - y0) * this.scale };
  }

  /**
   * 札の中身を入れ替える。見出しと値の組を渡し、変わっていれば文字を差し替えて並べ直す。
   * color は値の色（残りわずかの時間や手数を赤く）
   */
  private setStats(items: { caption: string; value: string; color?: string }[]): void {
    const line = items.map((it) => (it.caption === "SPEED" || it.caption === "MOVES" ? `${it.caption} ${it.value}` : it.caption === "MAX" ? `MAX ${it.value}` : it.value)).join("   ");
    const colors = items.map((it) => it.color ?? "").join();
    if (line === this.infoLine && colors === this.chipColors) return;
    this.infoLine = line;
    this.chipColors = colors;
    while (this.chips.length < items.length) {
      const caption = this.scene.add.text(0, 0, "", { fontFamily: FONT_UI, fontSize: "9px", fontStyle: "700", color: TEXT_DIM });
      const value = this.scene.add.text(0, 0, "", { fontFamily: FONT_UI, fontSize: "14px", fontStyle: "700", color: TEXT_COLOR }).setShadow(0, 1, HUD_INK, 2, false, true);
      this.root.add([caption, value]);
      this.chips.push({ caption, value });
    }
    while (this.chips.length > items.length) {
      const c = this.chips.pop()!;
      c.caption.destroy();
      c.value.destroy();
    }
    items.forEach((it, i) => {
      this.chips[i].caption.setText(it.caption);
      this.chips[i].value.setText(it.value).setColor(it.color ?? TEXT_COLOR);
    });
    this.layoutStats();
  }
  private chipColors = "";
  /** 札の位置（局所座標）。statsBounds が使う */
  private chipRects: { x: number; y: number; w: number }[] = [];

  destroy(): void { this.root.destroy(true); }

  constructor(
    private readonly scene: Phaser.Scene,
    readonly board: Board,
    label: string,
    private readonly showLevel: boolean,
    /** タイムアタックの制限時間（フレーム）。指定すると経過時間の代わりに残り時間を出す。 */
    private readonly timeLimit: number | null = null,
    /** パズルは得点・時間の代わりに面の名前と残り手数、レッスンは課の名前だけを出す。 */
    private readonly style: "" | "puzzle" | "lesson" = "",
    /** 枠の縁の色。メニューでこのモードを選んだカードと同じ色にする */
    color: number = CARD.gold,
  ) {
    this.root = scene.add.container(0, 0);
    this.color = color;
    this.dangerGlow = new DangerGlow(scene);
    this.frame = scene.add.image(-FRAME_EXTENT, -FRAME_EXTENT, makeFrameTexture(scene, color)).setOrigin(0).setScale(1 / DPR);
    this.corners = makeCorners(scene, color);
    this.root.add([this.dangerGlow.root, this.frame]);

    for (let r = 0; r < DRAW_ROWS; r++) {
      const row: Phaser.GameObjects.Image[] = [];
      for (let c = 0; c < COLS; c++) {
        const img = scene.add.image(0, 0, "panel-0").setOrigin(0).setScale(1 / DPR).setVisible(false);
        this.root.add(img);
        row.push(img);
      }
      this.cells.push(row);
    }
    for (let c = 0; c < COLS; c++) {
      const img = scene.add.image(0, 0, "panel-0-dark").setOrigin(0).setScale(1 / DPR);
      this.root.add(img);
      this.nextCells.push(img);
    }
    this.root.add(this.corners);
    this.cursor = scene.add.image(0, 0, "cursor").setOrigin(0).setScale(1 / DPR);
    this.root.add(this.cursor);
    this.touchGfx = scene.add.graphics();
    this.root.add(this.touchGfx);
    this.hintGfx = scene.add.graphics();
    this.root.add(this.hintGfx);
    // 消えたパネルの破片。柄の絵を小さく回しながら飛ばす（オープニングと同じ）
    KIND_COLORS.forEach((_, kind) => {
      const e = scene.add.particles(0, 0, `panel-${kind}`, {
        speed: { min: 60, max: 200 },
        angle: { min: 0, max: 360 },
        gravityY: 600,
        lifespan: { min: 280, max: 560 },
        scale: { start: 0.42 / DPR, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -180, max: 180 },
        emitting: false,
      });
      this.root.add(e);
      this.emitters.push(e);
    });
    // 光の粒。消えたパネルの色に染めて、破片と一緒に散らす
    this.sparks = scene.add.particles(0, 0, "spark", {
      speed: { min: 40, max: 170 },
      angle: { min: 0, max: 360 },
      lifespan: { min: 240, max: 520 },
      scale: { start: 0.9 / DPR, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    this.root.add(this.sparks);

    // HUD。名前は枠の色の札に濃い文字、得点は見出し付きの大きな数字
    this.hudGfx = scene.add.graphics();
    this.labelText = scene.add.text(0, 0, label, { fontFamily: FONT_UI, fontSize: "14px", color: HUD_INK, fontStyle: "700" }).setOrigin(0.5);
    this.scoreCaption = scene.add.text(0, 0, "SCORE", { fontFamily: FONT_UI, fontSize: "9px", color: TEXT_DIM, fontStyle: "700" });
    this.scoreText = scene.add
      .text(0, 0, "000000", { fontFamily: FONT_UI, fontSize: "20px", color: TEXT_COLOR, fontStyle: "700" })
      .setShadow(0, 2, HUD_INK, 3, false, true);
    this.statsGfx = scene.add.graphics();
    this.pendingGfx = scene.add.graphics();
    this.pendingText = scene.add
      .text(0, 0, "", { fontFamily: FONT_UI, fontSize: "14px", color: TEXT_COLOR, fontStyle: "700", stroke: HUD_INK, strokeThickness: 3 })
      .setVisible(false);
    this.stopBar = scene.add.graphics();
    this.root.add([this.hudGfx, this.labelText, this.scoreCaption, this.scoreText, this.statsGfx, this.pendingGfx, this.pendingText, this.stopBar]);

    this.overlay = scene.add.container(BOARD_W / 2, BOARD_H / 2).setVisible(false);
    // 暗幕は盤面の角に合わせて丸める（矩形だと角が枠の縁にはみ出す）。上下を濃く、中央を少し明るく
    const dim = scene.add.graphics();
    dim.fillGradientStyle(0x0c0820, 0x0c0820, 0x1a1040, 0x1a1040, 0.84, 0.84, 0.7, 0.7);
    dim.fillRect(-BOARD_W / 2, -BOARD_H / 2 + BOARD_RADIUS, BOARD_W, BOARD_H - BOARD_RADIUS * 2);
    dim.fillStyle(0x0c0820, 0.84);
    dim.fillRoundedRect(-BOARD_W / 2, -BOARD_H / 2, BOARD_W, BOARD_RADIUS * 2, { tl: BOARD_RADIUS, tr: BOARD_RADIUS, bl: 0, br: 0 });
    dim.fillStyle(0x1a1040, 0.7);
    dim.fillRoundedRect(-BOARD_W / 2, BOARD_H / 2 - BOARD_RADIUS * 2, BOARD_W, BOARD_RADIUS * 2, { tl: 0, tr: 0, bl: BOARD_RADIUS, br: BOARD_RADIUS });
    this.overlayTitle = scene.add
      .text(0, -34, "", { fontFamily: FONT_UI, fontSize: "36px", color: "#ffe066", fontStyle: "700", stroke: HUD_INK, strokeThickness: 7 })
      .setShadow(0, 4, "rgba(0, 0, 0, 0.45)", 6, true, true)
      .setOrigin(0.5);
    this.overlayBody = scene.add
      // レッスンの達成の一言は文なので、盤面の幅で文字単位に折り返す（日本語は空白で折り返せない）
      .text(0, 24, "", { fontFamily: FONT_UI, fontSize: style === "puzzle" ? "20px" : "14px", color: TEXT_COLOR, align: "center", lineSpacing: 3, wordWrap: { width: BOARD_W - 12, useAdvancedWrap: true } })
      .setShadow(0, 1, HUD_INK, 2, false, true)
      .setOrigin(0.5);
    // レッスンの達成の一言は行数が変わるので、上端を固定して下へ伸ばす（中央揃えだと 3 行以上でボタンに重なる）
    if (style === "lesson") this.overlayBody.setOrigin(0.5, 0).setY(-8);
    this.overlayPlate = scene.add.graphics();
    this.overlay.add([dim, this.overlayPlate, this.overlayTitle, this.overlayBody]);
    this.root.add(this.overlay);
  }

  /** レッスンの目印を出す（null で消す）。マスは盤面の座標（y は下から）。 */
  setHint(cells: { x: number; y: number }[] | null): void {
    this.hintCells = cells ?? [];
    if (!this.hintCells.length) this.hintGfx.clear();
  }

  private drawHint(): void {
    if (!this.hintCells.length) return;
    const g = this.hintGfx;
    g.clear();
    const pulse = 0.55 + 0.45 * Math.sin(this.scene.time.now / 160);
    g.lineStyle(3, 0xffe066, pulse);
    const rise = this.board.riseProgress * CELL;
    for (const { x, y } of this.hintCells) g.strokeRect(x * CELL + 2, (ROWS - 1 - y) * CELL - rise + 2, CELL - 4, CELL - 4);
  }

  /** 結果画面などのボタンを盤面の上に置く。局所座標（盤面の左上が原点）で渡す。 */
  addToOverlay(obj: Phaser.GameObjects.GameObject): void {
    this.overlay.add(obj);
  }

  /** 1枚ずつ消える音の通し番号。揃うたびに 0 に戻し、tick をまたいでも音程が上がり続けるようにする。 */
  private popIndex = 0;

  /**
   * Board のイベントを音と演出に変える。tick 直後に呼ぶ。負け・勝ちの音は GameScene が鳴らす。
   * hapticOn は自分が触っている盤面だけ true にする（CPU の盤面で震わせない）。
   * warnOn を false にすると、危険・天井の警告音を鳴らさない（オンラインの相手の盤面。相手のピンチはこの端末で知らせない）。
   */
  handleEvents(events: BoardEvent[], soundOn: boolean, hapticOn = false, warnOn = soundOn): void {
    this.warnOn = warnOn;
    if (hapticOn && this.board.panic && !this.board.gameOver) haptics.panic(this.scene.time.now);
    for (const e of events) {
      switch (e.type) {
        case "swap":
          if (soundOn) audio.swap();
          break;
        case "move":
          if (soundOn) audio.move();
          break;
        case "match":
          this.popIndex = 0;
          if (soundOn) audio.match(e.panels, e.chain);
          if (hapticOn) haptics.match(e.panels, e.chain);
          this.flashMatched();
          this.popup(e.x, e.y, e.panels, e.chain);
          break;
        case "pop":
          if (soundOn) audio.pop(this.popIndex++);
          this.burst(e.x, e.y);
          break;
        case "chainEnd":
          if (soundOn && e.chain >= 2) audio.chainEnd(e.chain);
          break;
        case "land":
          if (soundOn) audio.land();
          break;
        case "garbageLand":
          if (soundOn) audio.garbageLand(e.height);
          if (hapticOn) haptics.garbageLand(e.height);
          break;
        case "garbageTransform":
          if (soundOn) audio.garbageTransform();
          break;
        case "attack":
          if (soundOn) audio.attack();
          break;
        case "garbageIncoming":
          this.incomingPopup(e.rows);
          break;
        case "levelUp":
          if (soundOn) audio.levelUp();
          break;
        case "danger":
          if (warnOn && e.on) audio.dangerWarn();
          break;
        case "panic":
          if (warnOn && e.on) audio.panicWarn();
          break;
        default:
          break;
      }
    }
  }

  /** 揃った瞬間、揃ったパネルの上で白が閃いて広がる。 */
  private flashMatched(): void {
    const b = this.board;
    for (let r = 0; r < DRAW_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = b.cells[r][c];
        if (!isPanel(cell) || cell.state !== "matched" || cell.flashTimer <= 0) continue;
        // 今回揃った分だけ（点滅の残りが最大に近いもの）
        const img = this.cells[r][c];
        if (!img.visible) continue;
        const f = this.flashes.pop() ?? this.scene.add.image(0, 0, "white").setOrigin(0.5).setScale(1 / DPR).setBlendMode(Phaser.BlendModes.ADD);
        this.root.add(f);
        f.setPosition(img.x + CELL / 2, img.y + CELL / 2).setAlpha(0.9).setScale(1 / DPR).setVisible(true);
        this.scene.tweens.add({
          targets: f,
          alpha: 0,
          scale: 1.5 / DPR,
          duration: 220,
          ease: "Quad.Out",
          onComplete: () => {
            f.setVisible(false);
            this.flashes.push(f);
          },
        });
      }
    }
  }

  /** 1 枚消えるごとに、その柄の破片を飛ばす。 */
  private burst(x: number, y: number): void {
    const cell = this.board.cell(x, y);
    const kind = isPanel(cell) ? cell.kind : -1;
    const e = this.emitters[kind >= 0 && kind < this.emitters.length ? kind : 0];
    const rise = this.board.riseProgress * CELL;
    const px = x * CELL + CELL / 2;
    const py = (ROWS - 1 - y) * CELL - rise + CELL / 2;
    e.explode(5, px, py);
    this.sparks.setParticleTint(tint(KIND_COLORS[kind >= 0 && kind < KIND_COLORS.length ? kind : 0], 0.35));
    this.sparks.explode(4, px, py);
  }

  /** 揃った場所から広がる光の輪。連鎖が伸びるほど大きく、連鎖の色に染める */
  private ring(x: number, y: number, color: number, size: number): void {
    const ring = this.scene.add.image(x, y, "ring").setBlendMode(Phaser.BlendModes.ADD).setTint(color).setScale(0.3 / DPR).setAlpha(0.95);
    this.root.add(ring);
    this.scene.tweens.add({ targets: ring, scale: size / DPR, alpha: 0, duration: 420, ease: "Cubic.Out", onComplete: () => ring.destroy() });
  }

  /**
   * 「4」「x2」の吹き出し。同時消しは赤、連鎖は連鎖数で色が上がり、数が増えるほど大きく出る。
   * 出た瞬間に大きく弾んでから、少し浮いて消える
   */
  private popup(x: number, y: number, panels: number, chain: number): void {
    const px = Math.min(BOARD_W - 30, Math.max(30, x * CELL + CELL / 2));
    const py = (ROWS - 1 - y) * CELL;
    const items: { text: string; caption: string; color: string; size: number }[] = [];
    if (panels >= 4) items.push({ text: String(panels), caption: "COMBO", color: "#ff5c6c", size: 22 + Math.min(12, (panels - 4) * 2) });
    if (chain >= 2) items.push({ text: `x${chain}`, caption: "CHAIN", color: chainColor(chain), size: 26 + Math.min(22, (chain - 2) * 3) });
    if (items.length) this.ring(px, py + CELL / 2, Phaser.Display.Color.HexStringToColor(items[items.length - 1].color).color, 1.2 + Math.min(2, chain * 0.25));
    // 見出し（COMBO / CHAIN）の下に数字。2 つあれば縦に積む。1 つ目の数字の中心が揃った行の上端に来る
    let top = py - 26;
    items.forEach((it) => {
      const caption = this.scene.add
        .text(px, top, it.caption, { fontFamily: FONT_UI, fontSize: "10px", fontStyle: "700", color: "#ffffff", stroke: HUD_INK, strokeThickness: 4 })
        .setOrigin(0.5, 0)
        .setAlpha(0);
      const main = this.scene.add
        .text(px, top + 9, it.text, { fontFamily: FONT_UI, fontSize: `${it.size}px`, fontStyle: "700", color: it.color, stroke: HUD_INK, strokeThickness: 6 })
        .setShadow(0, 3, "rgba(0, 0, 0, 0.4)", 4, true, false)
        .setOrigin(0.5, 0)
        .setScale(1.9)
        .setAlpha(0);
      gradientFill(main, "#ffffff", it.color);
      top += 9 + main.height - 8;
      this.root.add([caption, main]);
      this.scene.tweens.add({ targets: main, scale: 1, alpha: 1, duration: 180, ease: "Back.Out", easeParams: [2.2] });
      this.scene.tweens.add({ targets: caption, alpha: 1, duration: 140, delay: 60 });
      this.scene.tweens.add({
        targets: [main, caption],
        y: "-=34",
        alpha: 0,
        delay: 440 + Math.min(400, chain * 40),
        duration: 420,
        ease: "Quad.In",
        onComplete: () => {
          main.destroy();
          caption.destroy();
        },
      });
    });
    // 連鎖が伸びたら得点の文字も弾む
    if (chain >= 2) this.scoreBump = 1;
  }

  /** 予告おじゃまのバーの左端と上端（局所座標）。盤面の中の上端に置く。HUD やポーズのボタンと重ならず、どの向きでも同じ場所に出る */
  private static readonly PENDING_X = 4;
  private static readonly PENDING_Y = 6;
  /** 直近の draw でバーが占めた幅。「+N」を出す位置に使う */
  private pendingWidth = 0;

  /**
   * 「+N」の吹き出し。相手の板がこの盤面の予告に入った段数。
   * 自分の盤面なら「これから降る量」、相手の盤面なら「自分が送った量」として見える
   */
  private incomingPopup(rows: number): void {
    const text = this.scene.add
      .text(BoardView.PENDING_X + this.pendingWidth + 40, BoardView.PENDING_Y + 12, `+${rows}`, { fontFamily: FONT_UI, fontSize: "24px", fontStyle: "700", color: "#ff8a94", stroke: HUD_INK, strokeThickness: 6 })
      .setOrigin(0.5)
      .setScale(1.8)
      .setAlpha(0);
    gradientFill(text, "#ffe0e4", "#ff5c6c");
    this.root.add(text);
    this.scene.tweens.add({ targets: text, scale: 1, alpha: 1, duration: 160, ease: "Back.Out", easeParams: [2] });
    this.scene.tweens.add({ targets: text, y: text.y - 26, alpha: 0, delay: 600, duration: 420, ease: "Quad.In", onComplete: () => text.destroy() });
  }

  /** 盤面の上のほうに短い知らせを出す。相手の大きな連鎖など、自分の盤面から目を離せない場面向け */
  announce(message: string, color: string): void {
    const text = this.scene.add
      .text(BOARD_W / 2, CELL * 2, message, { fontFamily: FONT_UI, fontSize: "20px", fontStyle: "700", color, stroke: HUD_INK, strokeThickness: 6, align: "center" })
      .setOrigin(0.5)
      .setScale(1.6)
      .setAlpha(0);
    this.root.add(text);
    this.scene.tweens.add({ targets: text, scale: 1, alpha: 1, duration: 180, ease: "Back.Out", easeParams: [2] });
    this.scene.tweens.add({ targets: text, alpha: 0, delay: 1100, duration: 400, ease: "Quad.In", onComplete: () => text.destroy() });
  }

  /** 毎描画フレーム呼ぶ。Board の現在状態をそのまま画面に反映する。 */
  draw(delta = 0, active = true): void {
    const b = this.board;
    const rise = b.riseProgress * CELL;
    let shake = 0;
    if (b.shakeTimer > 0) shake = Math.sin(b.frame * 1.7) * Math.min(6, b.shakeTimer * 0.5);
    const blink = (b.frame >> 1) & 1;

    for (let r = 0; r < DRAW_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const img = this.cells[r][c];
        const cell = b.cells[r][c];
        if (cell.kind === EMPTY && cell.garbage < 0) {
          img.setVisible(false);
          continue;
        }
        let dx = 0;
        let dy = 0;
        let key: string;
        let frame: string | undefined;
        let visible = true;
        if (isPanel(cell)) {
          key = `panel-${cell.kind}`;
          if (cell.state === "swapping") dx = cell.swapFrom * (cell.timer / TIMING.swap) * CELL;
          if (cell.state === "falling") dy = (cell.fallTimer / TIMING.fallPerRow) * CELL;
          // 点滅（flash）→ 揃った柄を明るく見せる（face）→ 1枚ずつ消える
          if (cell.state === "matched") key = cell.flashTimer > 0 && blink ? `panel-${cell.kind}-bright` : cell.flashTimer > 0 ? `panel-${cell.kind}` : `panel-${cell.kind}-bright`;
          if (cell.state === "popped") visible = false;
        } else {
          const g = b.garbage.get(cell.garbage);
          key = g?.type === "shock" ? "garbage-shock" : "garbage";
          // 板の外周に当たる辺だけ縁取る。ブロック全体が 1 枚の板に見える
          frame = g ? garbageFrame(r === g.y + g.height - 1, c === g.x + g.width - 1, r === g.y, c === g.x) : garbageFrame(true, true, true, true);
          if (g?.state === "falling") dy = (g.fallTimer / TIMING.fallPerRow) * CELL;
          if (g?.state === "transforming") {
            // 色が見えるのは通常パネルになる最下段だけ。
            // 上段はめくり順が来るまで点滅し、その後もおじゃまの姿を保つ。
            if (cell.revealAt <= 0) {
              if (r === g.y && cell.revealKind !== EMPTY) {
                key = `panel-${cell.revealKind}`;
                frame = undefined;
              }
            } else if (blink) {
              key = "white";
              frame = undefined;
            }
          }
        }
        img.setTexture(key, frame);
        img.setAlpha(key === "white" ? 0.5 : 1);
        const py = (ROWS - 1 - r) * CELL - rise + dy + shake;
        img.setPosition(c * CELL + dx, py);
        img.setVisible(visible && this.clip(img, py));
      }
    }
    for (let c = 0; c < COLS; c++) {
      const img = this.nextCells[c];
      // パズルにはせり上がりがなく、次の行もない
      if (b.nextRow.length === 0) {
        img.setVisible(false);
        continue;
      }
      img.setTexture(`panel-${b.nextRow[c]}-dark`);
      const py = ROWS * CELL - rise + shake;
      img.setPosition(c * CELL, py);
      img.setVisible(this.clip(img, py));
    }
    this.cursor.setPosition(b.cursor.x * CELL - CURSOR_PAD, (ROWS - 1 - b.cursor.y) * CELL - rise - CURSOR_PAD + shake);
    // カーソルはゆっくり息をするように明滅させる
    this.cursor.setAlpha(0.82 + 0.18 * Math.cos(this.scene.time.now / 260));
    // タッチ端末は直接触れたパネルと移動先の枠を使う。
    this.cursor.setVisible(!b.gameOver && this.showSwapCursor);
    this.touchGfx.clear();
    const selection = this.touch?.feedback;
    if (selection && !b.gameOver) {
      const py = (ROWS - 1 - selection.y) * CELL - rise + shake;
      const top = Math.max(1, py + 2);
      const bottom = Math.min(BOARD_H - 1, py + CELL - 2);
      if (bottom > top) {
        // 白枠が掴んだパネル、水色の枠が予約している停止位置。角を丸めてパネルの形に合わせる
        const g = this.touchGfx;
        g.fillStyle(0x66ccff, 0.18);
        g.fillRoundedRect(selection.targetX * CELL + 2, top, CELL - 4, bottom - top, 6);
        g.lineStyle(2, 0x8fdcff, 1);
        g.strokeRoundedRect(selection.targetX * CELL + 2, top, CELL - 4, bottom - top, 6);
        const selected = b.cell(selection.x, selection.y);
        const dx = selected.state === "swapping" ? selected.swapFrom * (selected.timer / TIMING.swap) * CELL : 0;
        g.lineStyle(4, 0x1c1238, 0.5);
        g.strokeRoundedRect(selection.x * CELL + dx + 1, top - 1, CELL - 2, Math.max(0, bottom - top + 2), 7);
        g.lineStyle(2.5, 0xffffff, 1);
        g.strokeRoundedRect(selection.x * CELL + dx + 1, top - 1, CELL - 2, Math.max(0, bottom - top + 2), 7);
      }
    }

    this.dangerGlow.update(b, delta, active);
    if (this.resultEffect) {
      for (const image of [...this.cells.flat(), ...this.nextCells]) image.setVisible(false);
      this.cursor.setVisible(false);
      this.touchGfx.clear();
      this.resultEffect.update(delta);
    }

    this.drawHint();
    if (this.style) {
      this.setStats(this.style === "puzzle" ? [{ caption: "MOVES", value: String(b.movesLeft ?? 0), color: (b.movesLeft ?? 0) <= 1 ? "#ff8a94" : undefined }] : []);
      this.stopBar.clear();
      this.pendingGfx.clear();
      this.pendingText.setVisible(false);
      return;
    }
    // 得点は数字が回って追いつく。差の 15% ずつ（最低 1）詰め、連鎖の直後は文字を弾ませる
    if (this.shownScore < b.score) this.shownScore = Math.min(b.score, this.shownScore + Math.max(1, Math.ceil((b.score - this.shownScore) * 0.15)));
    else if (this.shownScore > b.score) this.shownScore = b.score;
    if (this.scoreBump > 0) {
      this.scoreBump = Math.max(0, this.scoreBump - 0.08);
      this.scoreText.setScale(1 + this.scoreBump * 0.25);
    } else this.scoreText.setScale(1);
    const score = String(this.shownScore).padStart(6, "0");
    if (score !== this.scoreText.text) {
      this.scoreText.setText(score);
      // 数字の幅は字ごとに違うので、板からはみ出しそう・余りそうなら描き直す
      if (Math.abs(this.scoreText.width - this.hudScoreW) > 3) this.layoutHud();
    }
    let seconds: number;
    if (this.timeLimit !== null) {
      // 残り時間。ゲームのフレームで数えるので、ポーズ中は減らない
      seconds = Math.ceil(Math.max(0, this.timeLimit - b.frame) / 60);
    } else {
      // 経過時間。ゲームのフレームで数えるので、決着後は frame が止まって表示も止まる
      seconds = Math.floor(b.frame / 60);
    }
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    // 残り10秒を切ったら赤く
    const stats: { caption: string; value: string; color?: string }[] = [
      { caption: "TIME", value: `${mm}:${ss}`, color: this.timeLimit !== null && seconds <= 10 ? "#ff8a94" : undefined },
    ];
    if (this.timeLimit !== null && b.frame >= this.timeLimit && !b.isSettled()) stats.push({ caption: "", value: t("SETTLING"), color: "#ffe066" });
    if (this.showLevel) stats.push({ caption: "SPEED", value: String(b.level) });
    stats.push({ caption: "MAX", value: `x${b.maxChain}` });
    this.setStats(stats);

    // 停止時間のゲージ。盤面の下の縁の上に、水色の光る線で残りを示す
    const stopW = Math.min(1, b.stopTimer / TIMING.stopMax) * (BOARD_W - 8);
    this.stopBar.clear();
    if (stopW > 0) {
      this.stopBar.fillStyle(0x66ccff, 0.35);
      this.stopBar.fillRoundedRect(4, BOARD_H + 2, stopW, 6, 3);
      this.stopBar.fillStyle(0xbfeeff, 1);
      this.stopBar.fillRoundedRect(4, BOARD_H + 3.5, stopW, 3, 1.5);
    }

    // 予告おじゃま。盤面の中の上端に、板を小さなおじゃまの板で並べ、右に段数の合計を出す。
    // transit を過ぎて降りられる板があれば、橙に点滅させて「盤面が静止した瞬間に降る」ことを知らせ、その瞬間に一度だけ警告音を鳴らす
    this.pendingGfx.clear();
    const rows = b.pendingGarbage.reduce((sum, g) => sum + g.height, 0);
    const ready = !b.gameOver && b.pendingGarbage.some((g) => g.readyAt === undefined || g.readyAt <= b.frame);
    if (ready && !this.pendingReady && this.warnOn && active) audio.garbageWarn();
    this.pendingReady = ready;
    const pulse = ready ? 0.55 + 0.45 * Math.abs(Math.sin(b.frame * 0.25)) : 1;
    let px = 0;
    for (const spec of b.pendingGarbage) {
      const w = spec.width * 6;
      const h = Math.max(6, spec.height * 5);
      const armed = spec.readyAt === undefined || spec.readyAt <= b.frame;
      const color = armed ? 0xff9a3c : spec.type === "shock" ? 0x9a9aa8 : tint(GARBAGE_COLOR, 0.25);
      const alpha = armed ? pulse : 0.95;
      const x = BoardView.PENDING_X + px;
      const y = BoardView.PENDING_Y;
      this.pendingGfx.fillStyle(0x0c0820, 0.6 * alpha);
      this.pendingGfx.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 3);
      this.pendingGfx.fillStyle(color, alpha);
      this.pendingGfx.fillRoundedRect(x, y, w, h, 2.5);
      this.pendingGfx.fillStyle(0xffffff, 0.35 * alpha);
      this.pendingGfx.fillRect(x + 2, y + 1, w - 4, 1.5);
      px += w + 4;
    }
    this.pendingWidth = px;
    this.pendingText.setVisible(rows > 0);
    if (rows > 0) {
      this.pendingText.setText(String(rows)).setColor(ready ? "#ffb060" : TEXT_COLOR).setAlpha(ready ? pulse : 1);
      this.pendingText.setPosition(BoardView.PENDING_X + px + 2, BoardView.PENDING_Y - 4).setOrigin(0, 0);
    }
  }

  /** 盤面の枠からはみ出す部分を切り取る。完全に外なら false。py は局所座標。 */
  private clip(img: Phaser.GameObjects.Image, py: number): boolean {
    const top = Math.max(0, -py);
    const bottom = Math.max(0, py + CELL - BOARD_H);
    if (top >= CELL || bottom >= CELL) return false;
    // setCrop はテクスチャのピクセル単位なので DPR 倍で指定する
    img.setCrop(0, top * DPR, CELL * DPR, (CELL - top - bottom) * DPR);
    return true;
  }

  /** 結果の再通知では繰り返さない。演出は見出し・ボタンの後ろに置く。 */
  playResult(outcome: ResultOutcome): void {
    if (this.resultEffect) return;
    this.draw(0, false);
    this.resultEffect = new ResultEffect(this.scene, [...this.cells.flat(), ...this.nextCells], outcome);
    this.overlay.addAt(this.resultEffect.root, 1);
  }

  /** 結果を出す。見出しは大きく出て弾みながら収まり、本文は少し遅れて浮かぶ */
  showOverlay(title: string, body: string): void {
    this.overlay.setVisible(true);
    this.overlayTitle.setText(title);
    // 見出しは金色（負けは藤色）のグラデーション。盤面の幅に入らない長さ（GAME OVER）は縮めて収める
    if (this.resultEffect?.outcome === "lose") gradientFill(this.overlayTitle, "#ffffff", "#b9a8e0");
    else gradientFill(this.overlayTitle, "#fff6c8", "#ffc23c");
    const fit = Math.min(1, (BOARD_W - 12) / Math.max(1, this.overlayTitle.width));
    this.overlayTitle.setScale(2.2 * fit).setAlpha(0);
    this.overlayBody.setText(body).setAlpha(0);
    // 本文の下敷き。盤面の絵や結果の演出の上でも読めるよう、HUD と同じ濃紺の板を敷く
    const plate = this.overlayPlate;
    plate.clear();
    if (body) {
      const w = Math.min(BOARD_W - 8, this.overlayBody.width + 24);
      const h = this.overlayBody.height + 14;
      const x = this.overlayBody.x - w / 2;
      const y = this.overlayBody.y - this.overlayBody.originY * this.overlayBody.height - 7;
      plate.fillStyle(PLATE, 0.72);
      plate.fillRoundedRect(x, y, w, h, 12);
      plate.lineStyle(1, 0xffffff, 0.18);
      plate.strokeRoundedRect(x, y, w, h, 12);
    }
    plate.setAlpha(0);
    this.scene.tweens.add({ targets: this.overlayTitle, scale: fit, alpha: 1, duration: 360, ease: "Back.Out", easeParams: [1.6] });
    this.scene.tweens.add({ targets: [this.overlayBody, plate], alpha: 1, delay: 220, duration: 260 });
  }

  hideOverlay(): void {
    this.overlay.setVisible(false);
    this.resultEffect?.destroy();
    this.resultEffect = null;
  }
}


/**
 * 盤面の枠の絵。パネルの外側に縁（ベゼル）を回し、その外に色の光と影を落とす。中は奥へ沈む濃紺の井戸。
 * 縁は不透明。角のパネルの隅を隠す蓋（makeCorners）を同じ絵で塗るためで、半透明だと蓋の下のパネルが透ける。
 * 中も不透明で空を透かさない。パネルの色はこの上で読む。
 * Phaser の Graphics ではなく canvas 2D で DPR 倍の大きさに描く。Graphics は WebGL でアンチエイリアスがなく、
 * グラデーションや影も描けない。静止した絵なので 1 度描けばよい。色ごとに 1 枚を使い回す
 */
function makeFrameTexture(scene: Phaser.Scene, color: number): string {
  const key = `board-frame-${color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const w = BOARD_W + FRAME_EXTENT * 2;
  const h = BOARD_H + FRAME_EXTENT * 2;
  const texture = scene.textures.createCanvas(key, Math.ceil(w * DPR), Math.ceil(h * DPR));
  if (!texture) return key;
  const ctx = texture.context;
  ctx.scale(DPR, DPR);
  ctx.translate(FRAME_EXTENT, FRAME_EXTENT);
  const bezel = (): void => roundRect(ctx, -FRAME_PAD, -FRAME_PAD, BOARD_W + FRAME_PAD * 2, BOARD_H + FRAME_PAD * 2, FRAME_RADIUS);
  // 空に落ちる影と、縁の色の光。影は下へずらして盤面が浮いて見えるように
  ctx.save();
  ctx.shadowColor = "rgba(10, 0, 40, 0.5)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  bezel();
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.shadowColor = css(color, 0.6);
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 0;
  ctx.fill();
  ctx.restore();
  paintFrameBody(ctx, color, true);
  texture.refresh();
  return key;
}

/**
 * 枠の本体。縁を塗り、中を井戸の色で角のまま塗る。枠の絵と四隅の蓋の両方で使う。
 * 蓋は盤面の角の四角にこれと同じ絵を描いて丸角の弧の内側をくり抜くので、縁のグラデーションや
 * 内側の暗い線が蓋の上でも途切れない
 */
function paintFrameBody(ctx: CanvasRenderingContext2D, color: number, interior: boolean): void {
  const x = -FRAME_PAD;
  const y = -FRAME_PAD;
  const bw = BOARD_W + FRAME_PAD * 2;
  const bh = BOARD_H + FRAME_PAD * 2;
  // 縁。上が明るく下が濃い、枠の色の金属のような帯
  roundRect(ctx, x, y, bw, bh, FRAME_RADIUS);
  const band = ctx.createLinearGradient(0, y, 0, y + bh);
  band.addColorStop(0, css(tint(color, 0.6)));
  band.addColorStop(0.04, css(tint(color, 0.2)));
  band.addColorStop(0.5, css(tint(color, -0.05)));
  band.addColorStop(1, css(tint(color, -0.3)));
  ctx.fillStyle = band;
  ctx.fill();
  // 縁の外側の細い光。上ほど強い
  roundRect(ctx, x + 0.75, y + 0.75, bw - 1.5, bh - 1.5, FRAME_RADIUS - 0.75);
  const rim = ctx.createLinearGradient(0, y, 0, y + bh);
  rim.addColorStop(0, "rgba(255, 255, 255, 0.85)");
  rim.addColorStop(0.3, "rgba(255, 255, 255, 0.3)");
  rim.addColorStop(1, "rgba(255, 255, 255, 0.12)");
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 中は角を丸めずに塗る。丸みは蓋（makeCorners）が作る。蓋には中を塗らない（弧の内側は透明でパネルが見える）
  if (interior) {
    const well = ctx.createLinearGradient(0, 0, 0, BOARD_H);
    well.addColorStop(0, css(tint(BOARD_BG, -0.3)));
    well.addColorStop(0.6, css(BOARD_BG));
    well.addColorStop(1, css(tint(BOARD_BG, 0.06)));
    ctx.fillStyle = well;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    // 列の筋。1 列おきにわずかに明るくし、境目に細い線。パネルの行き先の列を目で追いやすくする
    for (let c = 0; c < COLS; c++) {
      if (c % 2 === 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
        ctx.fillRect(c * CELL, 0, CELL, BOARD_H);
      }
      if (c > 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
        ctx.fillRect(c * CELL - 0.5, 0, 1, BOARD_H);
      }
    }
    // 下からせり上がってくる光。枠の色をごく薄く
    const glow = ctx.createLinearGradient(0, BOARD_H - CELL * 3, 0, BOARD_H);
    glow.addColorStop(0, css(color, 0));
    glow.addColorStop(1, css(color, 0.14));
    ctx.fillStyle = glow;
    ctx.fillRect(0, BOARD_H - CELL * 3, BOARD_W, CELL * 3);
    // 上端の影。井戸の奥へ沈んで見える
    const shadow = ctx.createLinearGradient(0, 0, 0, 26);
    shadow.addColorStop(0, "rgba(0, 0, 0, 0.45)");
    shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, BOARD_W, 26);
  }
  // 縁と井戸の境の暗い線。縁の厚みを見せる
  roundRect(ctx, -1, -1, BOARD_W + 2, BOARD_H + 2, BOARD_RADIUS + 1);
  ctx.strokeStyle = "rgba(8, 4, 28, 0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * 盤面の四隅の蓋。丸角の弧の外側（角の四角から弧を除いた三日月形）を縁と同じ絵で塗り、パネルの上に置いて隅を隠す。
 * 縁は上下でグラデーションが違うので、4 隅それぞれに絵を作る
 */
function makeCorners(scene: Phaser.Scene, color: number): Phaser.GameObjects.Image[] {
  const r = BOARD_RADIUS;
  const spots: [number, number][] = [
    [0, 0],
    [BOARD_W - r, 0],
    [0, BOARD_H - r],
    [BOARD_W - r, BOARD_H - r],
  ];
  return spots.map(([cx, cy], i) => {
    const key = `board-corner-${color.toString(16)}-${i}`;
    if (!scene.textures.exists(key)) {
      const size = Math.ceil(r * DPR);
      const texture = scene.textures.createCanvas(key, size, size);
      if (texture) {
        const ctx = texture.context;
        ctx.scale(DPR, DPR);
        ctx.translate(-cx, -cy);
        paintFrameBody(ctx, color, false);
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(cx < BOARD_W / 2 ? r : BOARD_W - r, cy < BOARD_H / 2 ? r : BOARD_H - r, r, 0, Math.PI * 2);
        ctx.fill();
        texture.refresh();
      }
    }
    return scene.add.image(cx, cy, key).setOrigin(0).setScale(1 / DPR);
  });
}
