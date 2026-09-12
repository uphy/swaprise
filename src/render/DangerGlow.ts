import Phaser from "phaser";
import type { Board } from "../core";
import { BOARD_H, BOARD_W } from "./theme";
import { musicDanger } from "./musicDanger";

/** 盤面の外側だけに出す警告。Container に入れるので、拡縮・回転・2人対戦にも追従する。 */
export class DangerGlow {
  readonly root: Phaser.GameObjects.Container;
  private readonly sides: Phaser.GameObjects.Image[];
  private readonly top: Phaser.GameObjects.Image;
  private readonly ceiling: Phaser.GameObjects.Rectangle;
  private level = 0;
  private ceilingLevel = 0;

  constructor(scene: Phaser.Scene) {
    // 外側は透明、盤面に近い側ほど赤い、小さなグラデーションを全盤面で共有する。
    for (const vertical of [false, true]) {
      const key = vertical ? "danger-edge-y" : "danger-edge-x";
      if (scene.textures.exists(key)) continue;
      const width = vertical ? 8 : 64;
      const height = vertical ? 64 : 8;
      const texture = scene.textures.createCanvas(key, width, height);
      if (!texture) continue;
      const ctx = texture.context;
      const gradient = ctx.createLinearGradient(0, 0, vertical ? 0 : width, vertical ? height : 0);
      gradient.addColorStop(0, "rgba(255, 64, 99, 0)");
      gradient.addColorStop(0.5, "rgba(255, 64, 99, 0.15)");
      gradient.addColorStop(1, "rgba(255, 64, 99, 1)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      texture.refresh();
    }
    this.root = scene.add.container(0, 0).setVisible(false);
    this.sides = [
      scene.add.image(-32, -4, "danger-edge-x").setOrigin(0).setDisplaySize(28, BOARD_H + 8),
      scene.add.image(BOARD_W + 4, -4, "danger-edge-x").setOrigin(0).setDisplaySize(28, BOARD_H + 8).setFlipX(true),
    ];
    this.top = scene.add.image(-4, -32, "danger-edge-y").setOrigin(0).setDisplaySize(BOARD_W + 8, 28);
    this.ceiling = scene.add.rectangle(-4, -5, BOARD_W + 8, 3, 0xff8c9e).setOrigin(0).setAlpha(0);
    this.root.add([...this.sides, this.top, this.ceiling]);
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
    this.sides.forEach((side) => side.setAlpha(this.level * 0.65));
    this.top.setAlpha(this.level * 0.5 + this.ceilingLevel * (0.2 + breath * 0.25));
    this.ceiling.setAlpha(this.ceilingLevel * (0.55 + breath * 0.4));
    this.root.setVisible(this.level > 0.005 || this.ceilingLevel > 0.005);
  }
}
