import Phaser from "phaser";
import { FONT_UI, MENU_TYPE, TEXT_COLOR, TEXT_DIM } from "./theme";

export interface MenuCardSpec {
  /** 中心の論理座標と大きさ。 */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** ラベルの下の小さな説明・記録。 */
  caption: string;
  /** ラベルの右に添える絵文字。 */
  icon?: string;
  /** 縁と光の色。 */
  color: number;
  /** ラベルの色。省略で白 */
  labelColor?: string;
  /** e2e が children.getByName で探す名前。ラベルが name、説明が name-caption、当たり判定が name-card */
  name: string;
  compact: boolean;
  onPress: () => void;
  onHover: (over: boolean) => void;
}

/**
 * メニューの 1 項目を表す、色の縁を光らせた半透明のカード。
 * Container にまとめず Scene 直下に置く。e2e が scene.children.getByName でラベルと説明を探すため。
 */
const RADIUS = 16;
/** 縁の外の光。[線の太さ, alpha] を太い順に重ねる */
const GLOW_STEPS: readonly (readonly [number, number])[] = [
  [18, 0.04],
  [13, 0.06],
  [9, 0.09],
  [5, 0.14],
];

export class MenuCard {
  /** 浮かび上がりの tween に使う、このカードの表示物すべて。 */
  readonly objects: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle)[] = [];
  private readonly bg: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  readonly caption: Phaser.GameObjects.Text;
  private readonly spec: MenuCardSpec;
  private hot = false;

  constructor(scene: Phaser.Scene, spec: MenuCardSpec) {
    this.spec = spec;
    const { x, y, w, h, compact } = spec;
    // 中心に置いて相対座標で描く。押したときの縮みが中心を軸に回るように
    this.bg = scene.add.graphics({ x, y });
    this.paint();
    // ラベルは上寄せ、説明はその下に上端を揃えて置く（半幅のカードでは説明が 2 行になる）
    const top = y - h / 2;
    const labelY = spec.caption ? top + (compact ? 16 : 20) : y;
    this.label = scene.add
      .text(x, labelY, spec.label, { fontFamily: FONT_UI, fontSize: `${compact ? MENU_TYPE.itemCompact : MENU_TYPE.item}px`, fontStyle: "700", color: spec.labelColor ?? TEXT_COLOR })
      .setShadow(0, 2, "#2a1a5a", 6, false, true)
      .setOrigin(0.5)
      .setName(spec.name);
    this.caption = scene.add
      .text(x, top + (compact ? 27 : 33), spec.caption, { fontFamily: FONT_UI, fontSize: "12px", color: TEXT_DIM, align: "center" })
      .setOrigin(0.5, 0)
      .setName(`${spec.name}-caption`);
    // 説明がカードの幅に入らなければ、少し小さくし、それでも入らなければ折り返す（半幅のカードの英語）
    const maxW = w - 16;
    if (!shrinkToFit(this.caption, maxW, 11)) this.caption.setWordWrapWidth(maxW, true);
    this.objects.push(this.bg, this.label, this.caption);
    if (spec.icon) {
      // ラベルと絵文字を合わせて中央に寄せる。日本語のラベルは半幅のカードに入らないことがあるので、ラベルを縮める
      const icon = scene.add.text(0, labelY, spec.icon, { fontFamily: FONT_UI, fontSize: `${compact ? 16 : 18}px` }).setOrigin(0.5);
      const gap = 6;
      shrinkToFit(this.label, maxW - gap - icon.width, 16);
      const total = this.label.width + gap + icon.width;
      this.label.setX(x - total / 2 + this.label.width / 2);
      icon.setX(x + total / 2 - icon.width / 2);
      this.objects.push(icon);
    } else shrinkToFit(this.label, maxW, 16);
    // 当たり判定。カード全体を指で押せるよう、透明の矩形を一番上に置く
    const hit = scene.add.rectangle(x, y, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true }).setName(`${spec.name}-card`);
    hit.on("pointerover", () => spec.onHover(true));
    hit.on("pointerout", () => spec.onHover(false));
    hit.on("pointerdown", () => {
      // 押した手応え。少し縮んで戻る
      scene.tweens.add({ targets: this.objects, scale: { from: 0.97, to: 1 }, duration: 140, ease: "Back.Out" });
      spec.onPress();
    });
    this.objects.push(hit);
  }

  private paint(): void {
    const { w, h, color } = this.spec;
    const x = 0;
    const y = 0;
    const g = this.bg;
    g.clear();
    const r = RADIUS;
    // 縁の外側に滲む光。太さの違う半透明の線を重ねる。
    // ぼかしたテクスチャや Text の影は使わない。薄い alpha の裾が明るく描かれ、四角い板に見えた
    GLOW_STEPS.forEach(([width, alpha]) => {
      g.lineStyle(width, color, alpha * (this.hot ? 1.6 : 1));
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
    });
    // 半透明の白い地。背景の空が透ける
    g.fillStyle(0xffffff, this.hot ? 0.24 : 0.12);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
    // ガラスの反射。上半分を少し白くする。上の 2 角だけカードと同じ丸み
    g.fillStyle(0xffffff, this.hot ? 0.14 : 0.1);
    g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h * 0.45, { tl: r - 3, tr: r - 3, bl: 0, br: 0 });
    // 縁。色の線の内側に細い白で、光る枠に見せる
    g.lineStyle(2.5, color, this.hot ? 1 : 0.9);
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
    g.lineStyle(1, 0xffffff, this.hot ? 0.7 : 0.45);
    g.strokeRoundedRect(x - w / 2 + 2.5, y - h / 2 + 2.5, w - 5, h - 5, r - 2.5);
  }

  /** 指が乗っている・キー操作の対象。地を明るくし縁を強める */
  setHot(on: boolean): this {
    if (this.hot === on) return this;
    this.hot = on;
    this.paint();
    return this;
  }

  destroy(): void {
    this.objects.forEach((o) => o.destroy());
  }
}

/** 文字が幅 maxW に入るまで minSize を下限に文字を小さくする。入ったら true */
function shrinkToFit(text: Phaser.GameObjects.Text, maxW: number, minSize: number): boolean {
  if (text.width <= maxW) return true;
  const size = Math.max(minSize, Math.floor((parseFloat(text.style.fontSize as string) * maxW) / text.width));
  text.setFontSize(size);
  return text.width <= maxW;
}
