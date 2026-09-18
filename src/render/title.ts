import Phaser from "phaser";
import { FONT_UI } from "./theme";

/** 題字の虹色。左から桃・黄・緑・水・藤 */
const TITLE_STOPS: readonly (readonly [number, string])[] = [
  [0, "#ff7fae"],
  [0.28, "#ffcf3d"],
  [0.52, "#7dea55"],
  [0.76, "#45cbff"],
  [1, "#c07dff"],
];

/**
 * 題字の下に並べる柄の飾りの順。題字の虹（桃→黄→緑→水→藤）に合わせて色相の順に並べる。
 * 柄の番号順（赤・緑・水・黄・紫・青）だと題字の色の流れと食い違って見えた
 */
export const TITLE_ICON_KINDS: readonly number[] = [0, 3, 1, 2, 5, 4];

/** 押し出し（文字の下辺の厚み）の色とずれ */
const EXTRUDE_COLOR = "#3a1a72";
const EXTRUDE_DY = 5;

/**
 * 題字 SWAPRISE。後ろの白い光・押し出しの濃い紫・虹色の文字の 3 層で、オープニングとメニューが同じ絵を出す。
 * y と scale と alpha を持ち、tween の対象にできる（オープニングで中央からメニューの位置へ上がる）。
 * 光は Graphics の楕円の重ね描き。Text の影や canvas のぼかしで作ると、薄い alpha の裾が明るく描かれて四角い板に見えた
 */
export class TitleArt {
  readonly halo: Phaser.GameObjects.Graphics;
  readonly base: Phaser.GameObjects.Text;
  /** 一番上の虹色の文字。e2e は name "title" でこれを探す */
  readonly text: Phaser.GameObjects.Text;
  private y_: number;
  private scale_ = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, size: number) {
    this.y_ = y;
    const style = { fontFamily: FONT_UI, fontSize: `${size}px`, fontStyle: "700" };
    // 楕円を細かく重ねる。段数が少ないと同心の縞に見える。alpha の合計は中心で 0.3 ほど
    this.halo = scene.add.graphics({ x, y });
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      // 外側ほど薄く、内側ほど詰める（ガウス風）
      const k = 1 - t * t;
      this.halo.fillStyle(0xffffff, 0.0075);
      this.halo.fillEllipse(0, 0, size * 4.9 + 30 + k * 150, size + 12 + k * 90);
    }
    // 押し出しは白い縁と同じ太さの縁を持ち、文字の下辺で厚みに見える。濃い影で背景から浮かせる
    this.base = scene.add
      .text(x, y + EXTRUDE_DY, "SWAPRISE", { ...style, color: EXTRUDE_COLOR })
      .setOrigin(0.5)
      .setStroke(EXTRUDE_COLOR, 5)
      .setShadow(0, 4, "rgba(20, 8, 50, 0.6)", 10, true, true);
    // 白い縁で背景（青〜紫）から切り離す。中は鮮やかな虹色
    this.text = scene.add.text(x, y, "SWAPRISE", { ...style, color: "#ffffff" }).setOrigin(0.5).setStroke("#ffffff", 5).setName("title");
    // 虹色。座標は論理 px（canvas の幅は resolution 倍なので使わない）
    const grad = this.text.context.createLinearGradient(0, 0, this.text.width, 0);
    TITLE_STOPS.forEach(([at, c]) => grad.addColorStop(at, c));
    this.text.setFill(grad);
  }

  get layers(): (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] {
    return [this.halo, this.base, this.text];
  }

  get y(): number {
    return this.y_;
  }

  set y(v: number) {
    this.y_ = v;
    this.halo.setY(v);
    this.base.setY(v + EXTRUDE_DY * this.scale_);
    this.text.setY(v);
  }

  get scale(): number {
    return this.scale_;
  }

  set scale(s: number) {
    this.scale_ = s;
    this.layers.forEach((o) => o.setScale(s));
    this.base.setY(this.y_ + EXTRUDE_DY * s);
  }

  get alpha(): number {
    return this.text.alpha;
  }

  set alpha(a: number) {
    this.layers.forEach((o) => o.setAlpha(a));
  }

  setDepth(d: number): this {
    this.layers.forEach((o) => o.setDepth(d));
    return this;
  }
}
