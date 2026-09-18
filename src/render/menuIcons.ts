import Phaser from "phaser";
import { DPR } from "./hidpi";

/** アイコンの一辺（論理 px）。 */
export const MENU_ICON_SIZE = 22;

export type MenuIcon = "gem" | "robot" | "people" | "globe";

/**
 * メニューのカードに添えるアイコン。絵文字は端末のフォントで見た目が変わるので、Graphics で描いてテクスチャにする。
 * テクスチャの名前は icon-<名前>。高解像度端末でぼやけないよう DPR 倍で生成し、使う側は Image を 1/DPR に縮める
 */
export function createMenuIcons(scene: Phaser.Scene): void {
  if (scene.textures.exists("icon-gem")) return;
  const S = MENU_ICON_SIZE;
  const g = scene.make.graphics({ x: 0, y: 0 }, false).setScale(DPR);
  const done = (name: MenuIcon): void => {
    g.generateTexture(`icon-${name}`, Math.ceil(S * DPR), Math.ceil(S * DPR));
    g.clear();
  };
  const c = S / 2;

  // 宝石。上が平らな五角形の輪郭に、上の台と左右の面で明暗を付ける
  g.fillStyle(0x7fe0ff, 1);
  g.fillPoints([new Phaser.Math.Vector2(4, 8), new Phaser.Math.Vector2(18, 8), new Phaser.Math.Vector2(21, 12), new Phaser.Math.Vector2(11, 21), new Phaser.Math.Vector2(1, 12)], true);
  g.fillStyle(0xd6f6ff, 1);
  g.fillPoints([new Phaser.Math.Vector2(4, 8), new Phaser.Math.Vector2(18, 8), new Phaser.Math.Vector2(15, 12), new Phaser.Math.Vector2(7, 12)], true);
  g.fillStyle(0x3fb8e8, 1);
  g.fillPoints([new Phaser.Math.Vector2(15, 12), new Phaser.Math.Vector2(21, 12), new Phaser.Math.Vector2(11, 21)], true);
  g.fillStyle(0xffffff, 0.9);
  g.fillCircle(7, 6, 1.4);
  done("gem");

  // ロボット。丸い頭に目 2 つと口、頭の上のアンテナ
  g.fillStyle(0xd8dcf0, 1);
  g.fillRoundedRect(3, 7, 16, 13, 4);
  g.fillStyle(0xb8bdd8, 1);
  g.fillRect(1, 11, 2, 5);
  g.fillRect(19, 11, 2, 5);
  g.fillStyle(0x2a2050, 1);
  g.fillCircle(8, 12.5, 2.2);
  g.fillCircle(14, 12.5, 2.2);
  g.fillStyle(0x6fd6ff, 1);
  g.fillCircle(8, 12.5, 1.2);
  g.fillCircle(14, 12.5, 1.2);
  g.fillStyle(0x2a2050, 1);
  g.fillRoundedRect(7.5, 16, 7, 1.6, 0.8);
  g.fillStyle(0xd8dcf0, 1);
  g.fillRect(c - 0.8, 3, 1.6, 4);
  g.fillStyle(0xff6f7a, 1);
  g.fillCircle(c, 2.6, 1.8);
  done("robot");

  // 2 人。頭の丸と肩の山を、手前と奥で色を変えて重ねる
  g.fillStyle(0xffd9a8, 1);
  g.fillCircle(14.5, 7, 3.6);
  g.fillRoundedRect(9, 12, 11, 9, { tl: 5.5, tr: 5.5, bl: 2, br: 2 });
  g.fillStyle(0xffa14a, 1);
  g.fillCircle(7.5, 8, 3.8);
  g.fillRoundedRect(1.5, 13, 12, 8, { tl: 6, tr: 6, bl: 2, br: 2 });
  done("people");

  // 地球。緑がかった青の丸に、白い経線と緯線
  g.fillStyle(0x5fc8f0, 1);
  g.fillCircle(c, c, 9.5);
  g.fillStyle(0x8de76a, 1);
  g.fillCircle(7, 8, 3);
  g.fillCircle(14, 14, 3.4);
  g.fillCircle(15, 6, 1.6);
  g.lineStyle(1.2, 0xffffff, 0.9);
  g.strokeCircle(c, c, 9.5);
  g.strokeEllipse(c, c, 8, 19);
  g.lineBetween(1.5, c, 20.5, c);
  done("globe");

  g.destroy();
}
