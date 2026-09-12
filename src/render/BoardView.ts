import Phaser from "phaser";
import { t } from "./i18n";
import { Board, COLS, EMPTY, ROWS, TIMING, TOTAL_ROWS, isPanel, type BoardEvent } from "../core";
import { BOARD_BG, BOARD_H, BOARD_W, CELL, FONT, FONT_UI, KIND_COLORS, TEXT_COLOR, TEXT_DIM, chainColor, isTouchDevice } from "./theme";
import { audio } from "./shared";
import { haptics } from "./haptics";
import { DPR } from "./hidpi";
import type { TouchInput } from "./touch";
import { DangerGlow } from "./DangerGlow";

export type HudSide = "top" | "left" | "right";
/** 盤面と横置きの HUD の間隔。 */
const HUD_GAP = 12;

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
  touch: TouchInput | null = null;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly dangerGlow: DangerGlow;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly infoText: Phaser.GameObjects.Text;
  private readonly pendingGfx: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Container;
  private readonly overlayTitle: Phaser.GameObjects.Text;
  private readonly overlayBody: Phaser.GameObjects.Text;
  private stopBar: Phaser.GameObjects.Rectangle;
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
  place(ox: number, oy: number, scale = 1, hud: HudSide = "top"): void {
    this.ox = ox;
    this.oy = oy;
    this.scale = scale;
    this.hud = hud;
    this.root.setPosition(ox, oy).setScale(scale);
    if (hud === "top") {
      this.scoreText.setPosition(0, -30).setOrigin(0, 0);
      this.infoText.setPosition(BOARD_W, BOARD_H + 14).setOrigin(1, 0).setAlign("right");
    } else if (hud === "right") {
      this.scoreText.setPosition(BOARD_W + HUD_GAP, 0).setOrigin(0, 0);
      this.infoText.setPosition(BOARD_W + HUD_GAP, 28).setOrigin(0, 0).setAlign("left");
    } else {
      this.scoreText.setPosition(-HUD_GAP, 0).setOrigin(1, 0);
      this.infoText.setPosition(-HUD_GAP, 28).setOrigin(1, 0).setAlign("right");
    }
  }

  destroy(): void { this.root.destroy(true); }

  constructor(
    private readonly scene: Phaser.Scene,
    readonly board: Board,
    private readonly label: string,
    private readonly showLevel: boolean,
    /** タイムアタックの制限時間（フレーム）。指定すると経過時間の代わりに残り時間を出す。 */
    private readonly timeLimit: number | null = null,
    /** パズル。得点・時間の代わりに面の名前と残り手数を出す。 */
    private readonly puzzle = false,
  ) {
    this.root = scene.add.container(0, 0);
    this.dangerGlow = new DangerGlow(scene);
    this.frame = scene.add.rectangle(-4, -4, BOARD_W + 8, BOARD_H + 8, 0xffffff, 0.45).setOrigin(0);
    this.bg = scene.add.rectangle(0, 0, BOARD_W, BOARD_H, BOARD_BG).setOrigin(0);
    this.root.add([this.dangerGlow.root, this.frame, this.bg]);

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
    this.cursor = scene.add.image(0, 0, "cursor").setOrigin(0).setScale(1 / DPR);
    this.root.add(this.cursor);
    this.touchGfx = scene.add.graphics();
    this.root.add(this.touchGfx);
    // 消えたパネルの破片。柄の絵を小さく回しながら飛ばす（オープニングと同じ）
    KIND_COLORS.forEach((_, kind) => {
      const e = scene.add.particles(0, 0, `panel-${kind}`, {
        speed: { min: 60, max: 200 },
        angle: { min: 0, max: 360 },
        gravityY: 600,
        lifespan: { min: 280, max: 560 },
        scale: { start: 0.45 / DPR, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -180, max: 180 },
        emitting: false,
      });
      this.root.add(e);
      this.emitters.push(e);
    });

    this.scoreText = scene.add.text(0, -30, "", { fontFamily: FONT, fontSize: "18px", color: TEXT_COLOR, fontStyle: "bold" }).setOrigin(0, 0);
    this.infoText = scene.add
      .text(BOARD_W, BOARD_H + 14, "", { fontFamily: FONT, fontSize: "13px", color: TEXT_DIM, align: "right" })
      .setOrigin(1, 0);
    // 空が暖色に変わっても、残り時間の赤い数字を読み取れるようにする。
    if (timeLimit !== null) this.infoText.setBackgroundColor("#211d35dd").setPadding(3, 2);
    this.pendingGfx = scene.add.graphics();
    this.stopBar = scene.add.rectangle(0, BOARD_H + 6, 0, 4, 0x66ccff).setOrigin(0);
    this.root.add([this.scoreText, this.infoText, this.pendingGfx, this.stopBar]);

    this.overlay = scene.add.container(BOARD_W / 2, BOARD_H / 2).setVisible(false);
    const dim = scene.add.rectangle(0, 0, BOARD_W, BOARD_H, 0x1a1030, 0.72);
    this.overlayTitle = scene.add
      .text(0, -34, "", { fontFamily: FONT_UI, fontSize: "34px", color: "#ffe066", fontStyle: "700", stroke: "#3a1a5a", strokeThickness: 6 })
      .setOrigin(0.5);
    this.overlayBody = scene.add
      .text(0, 24, "", { fontFamily: FONT_UI, fontSize: "14px", color: TEXT_COLOR, align: "center", lineSpacing: 2 })
      .setOrigin(0.5);
    this.overlay.add([dim, this.overlayTitle, this.overlayBody]);
    this.root.add(this.overlay);
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
    e.explode(6, x * CELL + CELL / 2, (ROWS - 1 - y) * CELL - rise + CELL / 2);
  }

  /**
   * 「4」「x2」の吹き出し。同時消しは赤、連鎖は連鎖数で色が上がり、数が増えるほど大きく出る。
   * 出た瞬間に大きく弾んでから、少し浮いて消える
   */
  private popup(x: number, y: number, panels: number, chain: number): void {
    const px = Math.min(BOARD_W - 24, Math.max(24, x * CELL + CELL / 2));
    const py = (ROWS - 1 - y) * CELL;
    const items: { text: string; color: string; size: number }[] = [];
    if (panels >= 4) items.push({ text: String(panels), color: "#ff5c6c", size: 20 + Math.min(12, (panels - 4) * 2) });
    if (chain >= 2) items.push({ text: chain >= 14 ? "x?" : `x${chain}`, color: chainColor(chain), size: 22 + Math.min(20, (chain - 2) * 3) });
    items.forEach((it, i) => {
      const t = this.scene.add
        .text(px, py + i * 26, it.text, {
          fontFamily: FONT_UI,
          fontSize: `${it.size}px`,
          fontStyle: "700",
          color: it.color,
          stroke: "#2a1040",
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setScale(1.8)
        .setAlpha(0);
      this.root.add(t);
      this.scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 160, ease: "Back.Out", easeParams: [2] });
      this.scene.tweens.add({
        targets: t,
        y: t.y - 34,
        alpha: 0,
        delay: 420 + Math.min(400, chain * 40),
        duration: 420,
        ease: "Quad.In",
        onComplete: () => t.destroy(),
      });
    });
    // 連鎖が伸びたら得点の文字も弾む
    if (chain >= 2) this.scoreBump = 1;
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
          if (g?.state === "falling") dy = (g.fallTimer / TIMING.fallPerRow) * CELL;
          if (g?.state === "transforming") {
            // 色が見えるのは通常パネルになる最下段だけ。
            // 上段はめくり順が来るまで点滅し、その後もおじゃまの姿を保つ。
            if (cell.revealAt <= 0) {
              if (r === g.y && cell.revealKind !== EMPTY) key = `panel-${cell.revealKind}`;
            } else if (blink) key = "white";
          }
        }
        img.setTexture(key);
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
    this.cursor.setPosition(b.cursor.x * CELL - 3, (ROWS - 1 - b.cursor.y) * CELL - rise - 3 + shake);
    // タッチ端末は直接触れたパネルと移動先の枠を使う。
    this.cursor.setVisible(!b.gameOver && this.showSwapCursor);
    this.touchGfx.clear();
    const selection = this.touch?.feedback;
    if (selection && !b.gameOver) {
      const py = (ROWS - 1 - selection.y) * CELL - rise + shake;
      const top = Math.max(1, py + 2);
      const bottom = Math.min(BOARD_H - 1, py + CELL - 2);
      if (bottom > top) {
        // 白枠が掴んだパネル、青枠が予約している停止位置。
        this.touchGfx.lineStyle(2, 0x66ccff, 1);
        this.touchGfx.strokeRect(selection.targetX * CELL + 2, top, CELL - 4, bottom - top);
        const selected = b.cell(selection.x, selection.y);
        const dx = selected.state === "swapping" ? selected.swapFrom * (selected.timer / TIMING.swap) * CELL : 0;
        this.touchGfx.lineStyle(2, 0xffffff, 1);
        this.touchGfx.strokeRect(selection.x * CELL + dx + 4, top + 2, CELL - 8, Math.max(0, bottom - top - 4));
      }
    }

    this.dangerGlow.update(b, delta, active);

    if (this.puzzle) {
      this.scoreText.setText(this.label);
      const left = b.movesLeft ?? 0;
      this.infoText.setColor(left <= 1 ? "#ff8a94" : TEXT_DIM);
      this.infoText.setText(`MOVES ${left}`);
      this.stopBar.setVisible(false);
      this.pendingGfx.clear();
      return;
    }
    // 得点は数字が回って追いつく。差の 15% ずつ（最低 1）詰め、連鎖の直後は文字を弾ませる
    if (this.shownScore < b.score) this.shownScore = Math.min(b.score, this.shownScore + Math.max(1, Math.ceil((b.score - this.shownScore) * 0.15)));
    else if (this.shownScore > b.score) this.shownScore = b.score;
    if (this.scoreBump > 0) {
      this.scoreBump = Math.max(0, this.scoreBump - 0.08);
      this.scoreText.setScale(1 + this.scoreBump * 0.25);
    } else this.scoreText.setScale(1);
    this.scoreText.setText(`${this.label}  ${String(this.shownScore).padStart(6, "0")}`);
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
    const parts = [`${mm}:${ss}`];
    if (this.timeLimit !== null && b.frame >= this.timeLimit && !b.isSettled()) parts.push(t("SETTLING"));
    // 残り10秒を切ったら赤く
    this.infoText.setColor(this.timeLimit !== null && seconds <= 10 ? "#ff8a94" : TEXT_DIM);
    if (this.showLevel) parts.push(`SPEED ${b.level}`);
    parts.push(`MAX x${b.maxChain}`);
    // 横置きの HUD は幅が狭いので1行ずつ
    this.infoText.setText(parts.join(this.hud === "top" ? "   " : "\n"));

    const stopW = Math.min(1, b.stopTimer / TIMING.stopMax) * BOARD_W;
    this.stopBar.setSize(stopW, 4);
    this.stopBar.setVisible(stopW > 0);

    // 予告おじゃま。HUD が上なら盤面の上に、横なら HUD の下に並べる
    this.pendingGfx.clear();
    let px = 0;
    for (const spec of b.pendingGarbage) {
      const w = spec.width * 5;
      const h = Math.max(4, spec.height * 4);
      this.pendingGfx.fillStyle(spec.type === "shock" ? 0x5c5c66 : 0x8a8a96, 1);
      if (this.hud === "top") this.pendingGfx.fillRect(px, -12 - h, w, h);
      else if (this.hud === "right") this.pendingGfx.fillRect(BOARD_W + HUD_GAP + px, 96, w, h);
      else this.pendingGfx.fillRect(-HUD_GAP - px - w, 96, w, h);
      px += w + 4;
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

  /** 結果を出す。見出しは大きく出て弾みながら収まり、本文は少し遅れて浮かぶ */
  showOverlay(title: string, body: string): void {
    this.overlay.setVisible(true);
    this.overlayTitle.setText(title).setScale(2.2).setAlpha(0);
    this.overlayBody.setText(body).setAlpha(0);
    this.scene.tweens.add({ targets: this.overlayTitle, scale: 1, alpha: 1, duration: 360, ease: "Back.Out", easeParams: [1.6] });
    this.scene.tweens.add({ targets: this.overlayBody, alpha: 1, delay: 220, duration: 260 });
  }

  hideOverlay(): void {
    this.overlay.setVisible(false);
  }
}
