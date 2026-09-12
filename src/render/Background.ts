import Phaser from "phaser";
import { type SkyName } from "./theme";
import { audio } from "./shared";

/** 漂う光の玉の数。多いと盤面の邪魔になる */
const ORB_COUNT = 10;

/**
 * 画面の背景。縦のグラデーションの空に、ゆっくり昇る光の玉を浮かべる。
 * 玉は曲の拍に合わせてわずかに膨らみ、ピンチでは空が赤く染まる。
 * どのシーンも最初に作り、他の表示物より下（depth -10）に置く。
 *
 * 空そのものは canvas に描かず、body の CSS グラデーション（index.html の data-sky）に任せる。
 * canvas は透明にしてあり（main.ts の transparent）、全画面の絵を毎フレーム描く負担がなく、
 * 画面の比率が合わないときの余白にも同じ空が続く
 */
export class Background {
  private readonly tint: Phaser.GameObjects.Rectangle;
  private readonly orbs: { img: Phaser.GameObjects.Image; speed: number; size: number; phase: number }[] = [];
  private readonly width: number;
  private readonly height: number;
  /** 0 で平常、1 でピンチ。GameScene が危険状態に応じて動かす */
  danger = 0;
  /** 拍で膨らむ強さ（0 で止める） */
  pulse = 1;

  constructor(private readonly scene: Phaser.Scene, width: number, height: number, name: SkyName) {
    this.width = width;
    this.height = height;
    if (typeof document !== "undefined") document.body.dataset.sky = name;
    if (!scene.textures.exists("orb")) {
      const size = 128;
      const tex = scene.textures.createCanvas("orb", size, size);
      if (tex) {
        const ctx = tex.context;
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.55)");
        grad.addColorStop(0.5, "rgba(255, 255, 255, 0.18)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        tex.refresh();
      }
    }
    // 玉の初期位置は決め打ちの擬似乱数で散らす（毎回同じ配置なら、e2e のスクリーンショットが揺れない）
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < ORB_COUNT; i++) {
      const size = 24 + rnd() * 70;
      const img = scene.add
        .image(rnd() * width, rnd() * height, "orb")
        .setDisplaySize(size, size)
        .setAlpha(0.25 + rnd() * 0.3)
        .setDepth(-9);
      this.orbs.push({ img, speed: 4 + rnd() * 10, size, phase: rnd() * Math.PI * 2 });
    }
    this.tint = scene.add.rectangle(0, 0, width, height, 0xd0102a, 0).setOrigin(0).setDepth(-8).setVisible(false);
  }

  /** 毎フレーム呼ぶ。delta は ms */
  update(delta: number): void {
    const beat = audio.beat;
    // 拍の頭で膨らみ、拍の間に戻る
    const swell = beat ? Math.pow(1 - beat.phase, 3) : 0;
    const t = this.scene.time.now / 1000;
    for (const o of this.orbs) {
      o.img.y -= (o.speed * delta) / 1000;
      o.img.x += Math.sin(t * 0.6 + o.phase) * 0.15;
      if (o.img.y < -o.size) {
        o.img.y = this.height + o.size;
        o.img.x = Math.random() * this.width;
      }
      const s = o.size * (1 + swell * 0.18 * this.pulse);
      o.img.setDisplaySize(s, s);
    }
    // ピンチは赤みを乗せ、拍で脈打たせる。平常時は描かない（全画面の矩形は描画の負担が大きい）
    const tint = this.danger * (0.3 + swell * 0.16);
    this.tint.setAlpha(tint).setVisible(tint > 0.005);
  }

  destroy(): void {
    this.tint.destroy();
    this.orbs.forEach((o) => o.img.destroy());
  }
}
