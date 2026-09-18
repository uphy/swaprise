import Phaser from "phaser";
import { FONT_UI, MENU_TYPE, TEXT_COLOR, TEXT_DIM } from "./theme";
import { DPR } from "./hidpi";
import { MENU_ICON_SIZE, type MenuIcon } from "./menuIcons";

export interface MenuCardSpec {
  /** 中心の論理座標と大きさ。 */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** ラベルの下の小さな説明・記録。 */
  caption: string;
  /** ラベルの左に添えるアイコン（menuIcons.ts のテクスチャ）。 */
  icon?: MenuIcon;
  /** 半幅のカード。文字を一回り小さくし、アイコンとラベルを合わせて中央に寄せる */
  narrow?: boolean;
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

/**
 * 色の縁が光る半透明のガラスの板を (x, y) を中心に描く。メニューのカードと、設定・遊び方の板で共通。
 * 縁の外側の光は太さの違う半透明の線の重ねで作る（ぼかしは薄い alpha の裾が明るく描かれて四角く見えた）
 */
export function paintGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, hot = false): void {
  g.clear();
  const r = RADIUS;
  GLOW_STEPS.forEach(([width, alpha]) => {
    g.lineStyle(width, color, alpha * (hot ? 1.6 : 1));
    g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
  });
  // 半透明の白い地。背景の空が透ける
  g.fillStyle(0xffffff, hot ? 0.24 : 0.12);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
  // ガラスの反射。上半分を少し白くする。上の 2 角だけカードと同じ丸み
  g.fillStyle(0xffffff, hot ? 0.14 : 0.1);
  g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, Math.min(h * 0.45, 40), { tl: r - 3, tr: r - 3, bl: 0, br: 0 });
  // 縁。色の線の内側に細い白で、光る枠に見せる
  g.lineStyle(2.5, color, hot ? 1 : 0.9);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
  g.lineStyle(1, 0xffffff, hot ? 0.7 : 0.45);
  g.strokeRoundedRect(x - w / 2 + 2.5, y - h / 2 + 2.5, w - 5, h - 5, r - 2.5);
}

export class MenuCard {
  /** 浮かび上がりの tween に使う、このカードの表示物すべて。 */
  readonly objects: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image)[] = [];
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
    // ラベルと説明はカードの中央に 1 つの塊として置き、アイコンはラベルの左に隙間を空けて添える。
    // 全幅のカードではラベルの位置を動かさず、アイコンだけ左にぶら下げる（文字の中心がカードの中心のまま）。
    // 半幅のカードは左に余裕がないので、アイコンとラベルを合わせて中央に寄せ、文字も一回り小さくする
    const narrow = spec.narrow ?? false;
    const fontSize = compact || narrow ? MENU_TYPE.itemCompact : MENU_TYPE.item;
    const iconW = spec.icon ? (narrow ? 16 : 20) * (compact ? 0.85 : 1) : 0;
    const iconGap = narrow ? 6 : 8;
    const maxW = w - 16;
    this.label = scene.add
      .text(x, y, spec.label, { fontFamily: FONT_UI, fontSize: `${fontSize}px`, fontStyle: "700", color: spec.labelColor ?? TEXT_COLOR })
      .setShadow(0, 2, "#2a1a5a", 6, false, true)
      .setOrigin(0.5)
      .setName(spec.name);
    this.caption = scene.add
      .text(x, y, spec.caption, { fontFamily: FONT_UI, fontSize: "12px", color: TEXT_DIM, align: "center" })
      .setOrigin(0.5, 0)
      .setName(`${spec.name}-caption`);
    // 説明がカードの幅に入らなければ、少し小さくし、それでも入らなければ折り返す（半幅のカードの英語）
    if (!shrinkToFit(this.caption, maxW, 10)) this.caption.setWordWrapWidth(maxW, true);
    this.objects.push(this.bg, this.label, this.caption);
    let icon: Phaser.GameObjects.Image | null = null;
    if (spec.icon) {
      icon = scene.add.image(0, y, `icon-${spec.icon}`).setScale(iconW / MENU_ICON_SIZE / DPR);
      this.objects.push(icon);
    }
    if (icon && narrow) {
      shrinkToFit(this.label, maxW - iconGap - iconW, 16);
      const total = iconW + iconGap + this.label.width;
      icon.setX(x - total / 2 + iconW / 2);
      this.label.setX(x + total / 2 - this.label.width / 2);
    } else if (icon) {
      // ラベルは中央のまま。アイコンがカードからはみ出す幅なら、その分だけラベルを縮める
      shrinkToFit(this.label, maxW - 2 * (iconGap + iconW), 16);
      icon.setX(x - this.label.width / 2 - iconGap - iconW / 2);
    } else shrinkToFit(this.label, maxW, 16);
    // 上下の位置。ラベルと説明の間は空けない（日本語の文字は箱いっぱいに描かれ、詰めると触れる）
    const labelH = this.label.height;
    const captionH = spec.caption ? this.caption.height : 0;
    const blockH = labelH + captionH;
    const labelY = y - blockH / 2 + labelH / 2;
    this.label.setY(labelY);
    icon?.setY(labelY);
    this.caption.setY(labelY + labelH / 2);
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
    paintGlass(this.bg, 0, 0, this.spec.w, this.spec.h, this.spec.color, this.hot);
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
