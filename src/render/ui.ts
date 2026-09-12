import Phaser from "phaser";
import { ACCENT, FONT_UI, TEXT_COLOR } from "./theme";

export interface ButtonOptions {
  /** 文字の大きさ（論理 px）。 */
  fontSize?: number;
  /** 最小の幅・高さ（論理 px）。指で押す前提で 36 以上にする。 */
  minWidth?: number;
  minHeight?: number;
  color?: string;
  /** 塗りの色。省略で半透明の白（背景の空が透ける） */
  bg?: number;
  /** 塗りの不透明度 */
  bgAlpha?: number;
}

/** ボタンの塗りと縁の状態 */
type Look = "normal" | "hover" | "pressed" | "selected";

/**
 * タッチでもキーボードでも押せる丸いボタン。
 * Text だけの当たり判定は指には小さすぎるので、背景の角丸ごと Container にして当たり判定にする。
 * 塗りは半透明の白で、背景の空の色が透ける。選ばれている（キー操作の対象）ときは黄色に塗って文字を濃くする。
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly txt: Phaser.GameObjects.Text;
  private readonly baseColor: number;
  private readonly baseAlpha: number;
  private readonly baseTextColor: string;
  private readonly boxW: number;
  private readonly boxH: number;
  private selected = false;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onPress: () => void, opts: ButtonOptions = {}) {
    super(scene, x, y);
    const fontSize = opts.fontSize ?? 15;
    const minW = opts.minWidth ?? 96;
    const minH = opts.minHeight ?? 36;
    this.baseColor = opts.bg ?? 0xffffff;
    this.baseAlpha = opts.bgAlpha ?? (opts.bg === undefined ? 0.16 : 1);
    this.baseTextColor = opts.color ?? TEXT_COLOR;
    this.txt = scene.add
      .text(0, 0, text, { fontFamily: FONT_UI, fontSize: `${fontSize}px`, fontStyle: "600", color: this.baseTextColor, align: "center" })
      .setOrigin(0.5);
    this.boxW = Math.max(minW, this.txt.width + 28);
    this.boxH = Math.max(minH, this.txt.height + 12);
    this.bg = scene.add.graphics();
    this.paint("normal");
    this.add([this.bg, this.txt]);
    this.setSize(this.boxW, this.boxH);
    this.setInteractive({ useHandCursor: true });
    this.on("pointerover", () => this.paint(this.selected ? "selected" : "hover"));
    this.on("pointerout", () => this.paint(this.selected ? "selected" : "normal"));
    this.on("pointerdown", (_p?: Phaser.Input.Pointer, _x?: number, _y?: number, event?: Phaser.Types.Input.EventData) => {
      // 下にある「タップで再開」に伝えない
      event?.stopPropagation();
      this.paint("pressed");
      // 押した手応え。少し縮んで戻る
      this.scene.tweens.add({ targets: this, scale: { from: 0.94, to: 1 }, duration: 140, ease: "Back.Out" });
      onPress();
      this.scene.time.delayedCall(120, () => {
        if (this.scene) this.paint(this.selected ? "selected" : "normal");
      });
    });
    scene.add.existing(this);
  }

  private paint(look: Look): void {
    const g = this.bg;
    g.clear();
    const r = Math.min(12, this.boxH / 2);
    if (look === "selected") {
      g.fillStyle(0xffe066, 1);
      g.fillRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, r);
      g.lineStyle(2, 0xfff4bf, 1);
      g.strokeRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, r);
      this.txt.setColor("#2a2050");
      return;
    }
    const alpha = look === "pressed" ? this.baseAlpha + 0.3 : look === "hover" ? this.baseAlpha + 0.14 : this.baseAlpha;
    g.fillStyle(this.baseColor, Math.min(1, alpha));
    g.fillRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, r);
    g.lineStyle(2, 0xffffff, look === "hover" ? 0.8 : 0.5);
    g.strokeRoundedRect(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, r);
    this.txt.setColor(this.baseTextColor);
  }

  /** 選ばれている状態。黄色に塗り、文字を濃い紫にする（面選びの現在のステージ・面、キー操作の対象）。 */
  setSelected(on: boolean): this {
    this.selected = on;
    this.paint(on ? "selected" : "normal");
    return this;
  }

  /** 文字の色を変える。選ばれている間は濃い紫が優先される。 */
  setTextColor(color: string): this {
    if (!this.selected) this.txt.setColor(color);
    return this;
  }

  setText(text: string): this {
    this.txt.setText(text);
    return this;
  }

  get text(): string {
    return this.txt.text;
  }

  /** 論理座標がボタンの上か。せり上げ判定などで、ボタンの上のタッチを除くために使う。 */
  contains(x: number, y: number): boolean {
    if (!this.visible) return false;
    const m = this.getWorldTransformMatrix();
    const local = m.applyInverse(x, y);
    return Math.abs(local.x) <= this.width / 2 && Math.abs(local.y) <= this.height / 2;
  }
}

/** 強調色。選ばれた項目・見出しに使う */
export const HIGHLIGHT = ACCENT;
