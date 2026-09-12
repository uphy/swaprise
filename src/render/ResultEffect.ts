import Phaser from "phaser";
import { BOARD_H, BOARD_W, CELL } from "./theme";
import { DPR } from "./hidpi";

export type ResultOutcome = "win" | "lose";

/** 論理px/秒²。上向きの初速から、頂点を経て自然に落下させる。 */
const WIN_GRAVITY = 760;

/** 確定した盤面の見た目だけを動かす。勝敗や同期に使う Board は変更しない。 */
export class ResultEffect {
  readonly root: Phaser.GameObjects.Container;
  private readonly light: Phaser.GameObjects.Graphics;
  private readonly panels: {
    image: Phaser.GameObjects.Image;
    x: number;
    y: number;
    delay: number;
    drift: number;
    velocityX: number;
    velocityY: number;
  }[] = [];
  private elapsed = 0;
  private complete = false;

  constructor(scene: Phaser.Scene, sources: Phaser.GameObjects.Image[], readonly outcome: ResultOutcome) {
    this.root = scene.add.container(-BOARD_W / 2, -BOARD_H / 2);
    this.light = scene.add.graphics();
    this.root.add(this.light);
    for (const source of sources) {
      if (!source.visible) continue;
      const x = source.x + CELL / 2;
      const y = source.y + CELL / 2;
      const image = scene.add.image(x, y, source.texture.key).setScale(1 / DPR).setAlpha(source.alpha);
      // せり上がり中の上下端も、元の表示範囲を保って飛ばす。
      const top = Math.max(0, -source.y);
      const bottom = Math.max(0, source.y + CELL - BOARD_H);
      if (top > 0 || bottom > 0) image.setCrop(0, top * DPR, CELL * DPR, (CELL - top - bottom) * DPR);
      if (outcome === "lose") image.setTint(0xc6a6cc);
      this.root.add(image);
      // 位置ごとに初速を変え、列や段が一斉に同じ高さへ飛ぶのを避ける。
      const variation = (Math.floor(x / CELL) * 7 + Math.floor(y / CELL) * 11) % 5;
      const drift = (x - BOARD_W / 2) / BOARD_W;
      this.panels.push({ image, x, y,
        delay: outcome === "win" ? (BOARD_H - y) * 0.45 : (BOARD_H - y) * 0.7 + (x / CELL % 3) * 28,
        drift,
        velocityX: drift * (140 + variation * 10),
        velocityY: -(360 + variation * 22),
      });
    }
    this.update(0);
  }

  update(delta: number): void {
    if (this.complete) return;
    this.elapsed += Math.max(0, delta);
    if (this.elapsed >= 1700) {
      this.root.removeAll(true);
      this.panels.length = 0;
      this.complete = true;
      return;
    }
    const t = this.elapsed / 1000;
    this.light.clear();
    if (this.outcome === "win") {
      // 下から開く光の扇と、上へ抜ける輪。短い閃光のあと穏やかに消える。
      const strength = Math.sin(Math.min(1, t / 1.4) * Math.PI) * 0.18;
      for (let i = 0; i < 7; i++) {
        const cx = BOARD_W / 2;
        const spread = (i - 3) * (34 + t * 50);
        this.light.fillStyle(i % 2 ? 0xfff6cc : 0xffd46b, strength);
        this.light.fillTriangle(cx, BOARD_H, cx + spread - 12 - t * 12, -30, cx + spread + 12 + t * 12, -30);
      }
      this.light.lineStyle(3, 0xffebaa, Math.max(0, 0.8 - t * 0.6));
      this.light.strokeEllipse(BOARD_W / 2, BOARD_H * 0.7 - t * 200, 30 + t * 280, 12 + t * 75);
    } else {
      // 崩れ始めの赤い線と、下へ沈む淡い残光。
      this.light.fillStyle(0xdb497a, Math.max(0, 0.3 - t * 0.3));
      this.light.fillRect(0, BOARD_H - 4, BOARD_W, 4);
    }
    for (const panel of this.panels) {
      const seconds = Math.max(0, this.elapsed - panel.delay) / 1000;
      const { image, x, y, drift } = panel;
      if (this.outcome === "win") {
        image.setPosition(
          x + panel.velocityX * seconds,
          y + panel.velocityY * seconds + 0.5 * WIN_GRAVITY * seconds * seconds,
        );
        image.setScale((1 - Math.min(0.25, seconds * 0.16)) / DPR);
        // 頂点を過ぎたあとの落下も見せてから消す。
        image.setAlpha(Math.max(0, 1 - Math.max(0, seconds - 0.85) / 0.65));
      } else {
        image.setPosition(x + drift * 45 * seconds, y + 620 * seconds * seconds);
        image.setScale((1 - Math.min(0.3, seconds * 0.15)) / DPR);
        image.setAlpha(Math.max(0, 1 - seconds / 0.9));
      }
    }
  }

  destroy(): void { this.root.destroy(true); }
}
