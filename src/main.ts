// 旧名称のキーに残った記録・設定を新キーへ写す。音声などが import 時に localStorage を読むので、どの import よりも先に置く
import "./render/storage";
import Phaser from "phaser";
import { registerSW } from "virtual:pwa-register";
import { OnlineScene } from "./render/OnlineScene";
import { GameScene } from "./render/GameScene";
import { MenuScene } from "./render/MenuScene";
import { BG_COLOR, layoutFor } from "./render/theme";
import { DPR, installHiDpiText } from "./render/hidpi";

// Service Worker。ビルド成果物を precache し、次回以降はオフラインでも開ける。新しい版は次に開いたときに切り替わる
registerSW({ immediate: true });

installHiDpiText();
const layout = layoutFor("menu");

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: layout.width * DPR,
  height: layout.height * DPR,
  backgroundColor: BG_COLOR,
  pixelArt: false,
  antialias: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { gamepad: true, activePointers: 4 },
  scene: [MenuScene, GameScene, OnlineScene],
});
