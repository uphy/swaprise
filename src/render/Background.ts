import Phaser from "phaser";
import { type SkyName } from "./theme";
import { audio } from "./shared";

/** 漂う光の玉の数。多いと盤面の邪魔になる */
const ORB_COUNT = 10;

/** 残り秒数の節目。赤は盤面の危険に使い、時間の終盤は桃色から琥珀色へ寄せる。 */
const TIME_SKIES = [
  { seconds: 120, colors: [0x252b78, 0x5552b8, 0x9192df] },
  { seconds: 60, colors: [0x38256f, 0x8550b2, 0xc681cb] },
  { seconds: 30, colors: [0x51265e, 0xa95b94, 0xe99cad] },
  { seconds: 10, colors: [0x593656, 0xb47868, 0xf4bc71] },
] as const;
const TIME_PROPERTIES = ["--time-sky-top", "--time-sky-middle", "--time-sky-bottom", "--time-pulse"] as const;

/**
 * 画面の背景。縦のグラデーションの空に、ゆっくり昇る光の玉を浮かべる。
 * 玉は曲の拍に合わせてわずかに膨らみ、タイムアタックでは残り時間で空色が変わる。
 * どのシーンも最初に作り、他の表示物より下（depth -10）に置く。
 *
 * 空そのものは canvas に描かず、body の CSS グラデーション（index.html の data-sky）に任せる。
 * canvas は透明にしてあり（main.ts の transparent）、全画面の絵を毎フレーム描く負担がなく、
 * 画面の比率が合わないときの余白にも同じ空が続く
 */
export class Background {
  private readonly orbs: { img: Phaser.GameObjects.Image; speed: number; size: number; phase: number }[] = [];
  private readonly width: number;
  private readonly height: number;
  /** 同じ色のままなら CSS を書き直さず、背景の再描画を抑える。 */
  private timeValues: string[] = [];
  /** 拍で膨らむ強さ（0 で止める） */
  pulse = 1;

  constructor(private readonly scene: Phaser.Scene, width: number, height: number, private readonly name: SkyName) {
    this.width = width;
    this.height = height;
    if (typeof document !== "undefined") {
      TIME_PROPERTIES.forEach((property) => document.body.style.removeProperty(property));
      document.body.dataset.sky = name;
    }
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
  }

  /** ゲームの残りフレームを使うので、ポーズ中も無音でも時計とずれない。 */
  setTimeRemaining(frames: number | null, active: boolean): void {
    if (this.name !== "timeattack" || frames === null || typeof document === "undefined") return;
    const seconds = Math.max(0, frames / 60);
    let from: (typeof TIME_SKIES)[number] = TIME_SKIES[0];
    let to: (typeof TIME_SKIES)[number] = from;
    for (let i = 1; i < TIME_SKIES.length; i++) {
      to = TIME_SKIES[i];
      if (seconds >= to.seconds) break;
      from = to;
    }
    const mix = from === to ? 0 : Phaser.Math.Clamp((from.seconds - seconds) / (from.seconds - to.seconds), 0, 1);
    const values = from.colors.map((color, i) => {
      const next = to.colors[i];
      const channels = [16, 8, 0].map((shift) => Math.round(((color >> shift) & 255) * (1 - mix) + ((next >> shift) & 255) * mix));
      return `rgb(${channels.join(", ")})`;
    });
    // 残り秒の切り替わりで明るく、半秒後に暗くなる。画面全体は点滅させない。
    const pulse = active && frames > 0 && frames <= 600 ? 0.22 * Math.pow((1 + Math.cos(seconds * Math.PI * 2)) / 2, 2) : 0;
    values.push(pulse.toFixed(3));
    values.forEach((value, i) => {
      if (value !== this.timeValues[i]) document.body.style.setProperty(TIME_PROPERTIES[i], value);
    });
    this.timeValues = values;
  }

  /** 毎フレーム呼ぶ。delta は ms */
  update(delta: number): void {
    if (delta <= 0) return;
    const beat = audio.beat;
    // 拍の頭で膨らみ、拍の間に戻る
    const swell = beat ? Math.pow(1 - beat.phase, 3) : 0;
    const t = this.scene.time.now / 1000;
    for (const o of this.orbs) {
      o.img.y -= (o.speed * delta) / 1000;
      o.img.x += Math.sin(t * 0.6 + o.phase) * 0.009 * delta;
      if (o.img.y < -o.size) {
        o.img.y = this.height + o.size;
        o.img.x = Math.random() * this.width;
      }
      const s = o.size * (1 + swell * 0.18 * this.pulse);
      o.img.setDisplaySize(s, s);
    }
  }

  destroy(): void {
    if (this.name === "timeattack" && typeof document !== "undefined") {
      TIME_PROPERTIES.forEach((property) => document.body.style.removeProperty(property));
    }
    this.orbs.forEach((o) => o.img.destroy());
  }
}
