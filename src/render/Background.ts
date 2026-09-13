import Phaser from "phaser";
import { type SkyName } from "./theme";
import { audio } from "./shared";
import type { Board } from "../core";
import { stackHeight } from "./musicDanger";
import { orbField } from "./orbs";

/** 残り秒数の節目。赤は盤面の危険に使い、時間の終盤は桃色から琥珀色へ寄せる。 */
const TIME_SKIES = [
  { seconds: 120, colors: [0x252b78, 0x5552b8, 0x9192df] },
  { seconds: 60, colors: [0x38256f, 0x8550b2, 0xc681cb] },
  { seconds: 30, colors: [0x51265e, 0xa95b94, 0xe99cad] },
  { seconds: 10, colors: [0x593656, 0xb47868, 0xf4bc71] },
] as const;
const TIME_PROPERTIES = ["--time-sky-top", "--time-sky-middle", "--time-sky-bottom", "--time-pulse"] as const;
const STACK_PROPERTIES = ["--stack-sky-top", "--stack-sky-middle", "--stack-sky-bottom"] as const;
const CPU_CALM = [0x3a1c7c, 0x8b30a4, 0xff6f66];
const CPU_DANGER = [0x68132e, 0xbc2945, 0xf16a50];

function blendColors(from: readonly number[], to: readonly number[], mix: number): string[] {
  return from.map((color, i) => {
    const channels = [16, 8, 0].map((shift) => Math.round(((color >> shift) & 255) * (1 - mix) + ((to[i] >> shift) & 255) * mix));
    return `rgb(${channels.join(", ")})`;
  });
}

/**
 * 画面の背景。縦のグラデーションの空に、ゆっくり昇る光の玉を浮かべる。
 * 玉は曲の拍に合わせてわずかに膨らみ、タイムアタックでは残り時間で空色が変わる。
 * どのシーンも最初に作り、update を毎フレーム呼ぶ。
 *
 * 空も玉も canvas に描かず、body の CSS グラデーション（index.html の data-sky）と DOM の玉（orbs.ts）に任せる。
 * canvas は透明にしてあり（main.ts の transparent）、全画面の絵を毎フレーム描く負担がなく、
 * 画面の比率が合わないときの余白にも同じ空と玉が続く
 */
export class Background {
  /** 同じ色のままなら CSS を書き直さず、背景の再描画を抑える。 */
  private timeValues: string[] = [];
  private stackValues: string[] = [];
  private stackLevel: number | null = null;
  /** 拍で膨らむ強さ（0 で止める） */
  pulse = 1;

  constructor(_scene: Phaser.Scene, _width: number, _height: number, private readonly name: SkyName) {
    if (typeof document !== "undefined") {
      [...TIME_PROPERTIES, ...STACK_PROPERTIES].forEach((property) => document.body.style.removeProperty(property));
      document.body.dataset.sky = name;
    }
  }

  /** e2e 用。玉の位置と大きさ */
  get orbs(): readonly { x: number; y: number; scale: number }[] {
    return orbField.list;
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
    const values = blendColors(from.colors, to.colors, mix);
    // 残り秒の切り替わりで明るく、半秒後に暗くなる。画面全体は点滅させない。
    const pulse = active && frames > 0 && frames <= 600 ? 0.22 * Math.pow((1 + Math.cos(seconds * Math.PI * 2)) / 2, 2) : 0;
    values.push(pulse.toFixed(3));
    values.forEach((value, i) => {
      if (value !== this.timeValues[i]) document.body.style.setProperty(TIME_PROPERTIES[i], value);
    });
    this.timeValues = values;
  }

  /** CPU戦は自分の6〜12段の積み上がりで紫から赤へ。初回と回転時は現在の高さをすぐ反映する。 */
  setStack(board: Board, delta: number, active: boolean): void {
    if (this.name !== "cpu" || typeof document === "undefined") return;
    const height = stackHeight(board);
    const target = active ? Phaser.Math.Clamp((height + (height > 0 ? board.riseProgress : 0) - 6) / 6, 0, 1) : 0;
    this.stackLevel = this.stackLevel === null ? target : target + (this.stackLevel - target) * Math.exp(-Math.max(0, delta) / 400);
    const values = blendColors(CPU_CALM, CPU_DANGER, this.stackLevel);
    values.forEach((value, i) => {
      if (value !== this.stackValues[i]) document.body.style.setProperty(STACK_PROPERTIES[i], value);
    });
    this.stackValues = values;
  }

  /** 毎フレーム呼ぶ。delta は ms */
  update(delta: number): void {
    if (delta <= 0) return;
    const beat = audio.beat;
    // 拍の頭で膨らみ、拍の間に戻る
    const swell = beat ? Math.pow(1 - beat.phase, 3) : 0;
    orbField.update(delta, swell * this.pulse);
  }

  destroy(): void {
    if (this.name === "timeattack" && typeof document !== "undefined") {
      TIME_PROPERTIES.forEach((property) => document.body.style.removeProperty(property));
    }
    if (this.name === "cpu" && typeof document !== "undefined") {
      STACK_PROPERTIES.forEach((property) => document.body.style.removeProperty(property));
    }
  }
}
