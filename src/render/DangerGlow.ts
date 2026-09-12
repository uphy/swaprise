import Phaser from "phaser";
import type { Board } from "../core";
import { BOARD_H, BOARD_W } from "./theme";
import { musicDanger } from "./musicDanger";

/** 盤面の外側だけに出す警告。Container に入れるので、拡縮・回転・2人対戦にも追従する。 */
export class DangerGlow {
  readonly root: Phaser.GameObjects.Container;
  private readonly outline: Phaser.GameObjects.Image;
  private readonly top: Phaser.GameObjects.Image;
  private readonly ceiling: Phaser.GameObjects.Rectangle;
  private level = 0;
  private ceilingLevel = 0;

  constructor(scene: Phaser.Scene) {
    // 上辺・左右・上隅を一枚で描く。矩形からの距離を使い、角でも辺と同じ赤みにする。
    if (!scene.textures.exists("danger-outline")) {
      const width = BOARD_W + 64;
      const height = BOARD_H + 36;
      const texture = scene.textures.createCanvas("danger-outline", width, height);
      if (texture) {
        const pixels = texture.context.createImageData(width, height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const distance = Math.max(28 - (x + 0.5), x + 0.5 - (width - 28), 28 - (y + 0.5));
            if (distance <= 0 || distance >= 28) continue;
            const offset = (y * width + x) * 4;
            pixels.data.set([255, 64, 99, Math.round(255 * Math.pow(1 - distance / 28, 2.5))], offset);
          }
        }
        texture.context.putImageData(pixels, 0, 0);
        texture.refresh();
      }
    }
    // 天井接触時の強調は、つながった外周の光へ上から重ねる。
    if (!scene.textures.exists("danger-edge-y")) {
      const texture = scene.textures.createCanvas("danger-edge-y", 8, 64);
      if (texture) {
        const ctx = texture.context;
        const gradient = ctx.createLinearGradient(0, 0, 0, 64);
        gradient.addColorStop(0, "rgba(255, 64, 99, 0)");
        gradient.addColorStop(0.5, "rgba(255, 64, 99, 0.15)");
        gradient.addColorStop(1, "rgba(255, 64, 99, 1)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 8, 64);
        texture.refresh();
      }
    }
    this.root = scene.add.container(0, 0).setVisible(false);
    this.outline = scene.add.image(-32, -32, "danger-outline").setOrigin(0);
    this.top = scene.add.image(-4, -32, "danger-edge-y").setOrigin(0).setDisplaySize(BOARD_W + 8, 28);
    this.ceiling = scene.add.rectangle(-4, -5, BOARD_W + 8, 3, 0xff8c9e).setOrigin(0).setAlpha(0);
    this.root.add([this.outline, this.top, this.ceiling]);
  }

  update(board: Board, delta: number, active: boolean): void {
    // 終了では警告を消す。停止中は delta=0 として復帰の途中でも表示を保持する。
    const danger = active && !board.gameOver && musicDanger(board);
    const panic = danger && board.panic;
    const approach = (value: number, target: number, ms: number): number => target + (value - target) * Math.exp(-Math.max(0, delta) / ms);
    this.level = approach(this.level, danger ? 1 : 0, danger ? 220 : 320);
    this.ceilingLevel = approach(this.ceilingLevel, panic ? 1 : 0, panic ? 140 : 240);
    // 無音でも天井接触を知らせる。高速点滅にはせず、ゲーム時間に同期した緩い明滅にする。
    const breath = (1 + Math.cos(board.frame * Math.PI * 2 / 60)) / 2;
    this.outline.setAlpha(this.level * 0.65);
    this.top.setAlpha(this.ceilingLevel * (0.2 + breath * 0.25));
    this.ceiling.setAlpha(this.ceilingLevel * (0.55 + breath * 0.4));
    this.root.setVisible(this.level > 0.005 || this.ceilingLevel > 0.005);
  }
}
