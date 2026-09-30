import Phaser from "phaser";
import type { Board } from "../core";
import type { BoardView } from "./BoardView";
import type { HighScores } from "./highscore";
import { t } from "./i18n";
import { BOARD_W, FONT_UI, TEXT_COLOR } from "./theme";

/**
 * 初めて遊ぶ人への案内。記録のない人には 1 PLAYER で LEARN を勧め、初めての ENDLESS では操作を一文だけ盤面に出す。
 * どちらも記録を持つ利用者には出さない（見え方を変えない）。
 */

/** 初めての ENDLESS の操作の一文を消した印。最初の入れ替えで立てる */
const ENDLESS_HINT_KEY = "swaprise.endlesshint.v1";

/**
 * まだ何も遊んでいない人か。レッスンを 1 つも終えておらず、どのモードにも記録がない。
 * 記録を持つ人は、レッスンを終えていなくても従来どおりの見え方にする
 */
export function isNewPlayer(hs: HighScores): boolean {
  const cpu = Object.values(hs.cpu).some((r) => r.wins + r.losses > 0);
  const online = hs.online.wins + hs.online.losses + hs.online.draws > 0;
  return hs.lessons.length === 0 && hs.endless.length === 0 && hs.timeattack.length === 0 && hs.puzzle.length === 0 && !cpu && !online;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** 初めての ENDLESS の一文を出すか。ENDLESS の記録がある人と、一度入れ替えて一文を消した人には出さない */
export function endlessHintPending(hs: HighScores): boolean {
  if (hs.endless.length > 0) return false;
  try {
    return storage()?.getItem(ENDLESS_HINT_KEY) !== "1";
  } catch {
    return false;
  }
}

function markEndlessHintDone(): void {
  try {
    storage()?.setItem(ENDLESS_HINT_KEY, "1");
  } catch {
    // プライベートモードなどで保存できなくても続ける。次の ENDLESS でもう一度出るだけ
  }
}

/**
 * 初めての ENDLESS で、盤面の中の上（始めは空いている段）に操作の一文を出す。最初の入れ替えで消し、以後は出さない。
 * 置き場所は盤面の位置と大きさに毎フレーム合わせる（回転で盤面が動いても付いていく）
 */
export function showEndlessHint(scene: Phaser.Scene, view: BoardView, board: Board, touch: boolean): void {
  const text = scene.add
    .text(0, 0, touch ? t("Drag a panel left or right to swap it.") : t("Arrow keys move.\nZ swaps."), {
      fontFamily: FONT_UI, fontSize: "16px", fontStyle: "700", color: TEXT_COLOR, align: "center", lineSpacing: 2, wordWrap: { width: BOARD_W - 24, useAdvancedWrap: true },
    })
    .setShadow(0, 2, "#1c1238", 4, false, true)
    .setOrigin(0.5, 0)
    .setDepth(1)
    .setName("endless-hint");
  const follow = (): void => {
    if (board.stats.swaps > 0) {
      markEndlessHintDone();
      done();
      return;
    }
    text.setScale(view.scale).setPosition(view.ox + (BOARD_W * view.scale) / 2, view.oy + 28 * view.scale).setVisible(!board.gameOver);
  };
  const done = (): void => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, follow);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, done);
    text.destroy();
  };
  follow();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, done);
}
