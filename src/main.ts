// 旧名称のキーに残った記録・設定を新キーへ写す。音声などが import 時に localStorage を読むので、どの import よりも先に置く
import "./render/storage";
import Phaser from "phaser";
import { OnlineScene } from "./render/OnlineScene";
import { GameScene } from "./render/GameScene";
import { MenuScene } from "./render/MenuScene";
import { OpeningScene } from "./render/OpeningScene";
import { BG_COLOR, layoutFor } from "./render/theme";
import { DPR, installHiDpiText } from "./render/hidpi";
import { waitForUpdate } from "./render/update";
import { setDocumentLanguage } from "./render/i18n";
import { startScoreSync } from "./scores/client";
import { fullscreen } from "./render/fullscreen";

// Service Worker。ビルド成果物を precache し、次回以降はオフラインでも開ける。
// 新しい版があれば、メニューを触れるようになる前に切り替えを済ませる（遊んでいる最中に reload しない）
/** 同梱の丸い書体を読んでから Phaser を立ち上げる。読めないときも 1.5 秒で諦めて始める（Canvas の文字は後から差し替わらない） */
function loadFonts(): Promise<unknown> {
  if (typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  const wanted = ["400 16px Fredoka", "600 16px Fredoka", "700 16px Fredoka"].map((f) => document.fonts.load(f));
  return Promise.race([Promise.all(wanted), new Promise((r) => setTimeout(r, 1500))]).catch(() => undefined);
}

Promise.all([waitForUpdate(), loadFonts()]).then(() => {
  setDocumentLanguage();
  startScoreSync();
  installHiDpiText();
  const layout = layoutFor("menu");

  // タッチ端末の既定は全画面。最初のタップで入り、戻る操作などで抜けても次のタップで取り直す
  fullscreen.watchGestures();
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: layout.width * DPR,
    height: layout.height * DPR,
    // 背景の空は body の CSS。canvas は透明にして、毎フレーム全画面の絵を描かない
    transparent: true,
    backgroundColor: BG_COLOR,
    pixelArt: false,
    antialias: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { gamepad: true, activePointers: 4 },
    // 最初のシーンがオープニング。直接開始や ?opening=0 のときはすぐメニューへ渡す
    scene: [OpeningScene, MenuScene, GameScene, OnlineScene],
  });
});
