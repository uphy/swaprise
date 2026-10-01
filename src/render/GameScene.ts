import Phaser from "phaser";
import { Game, LESSONS, PUZZLES, PUZZLES_PER_STAGE, puzzleName, type CpuLevel, type GameMode, type Input, NO_INPUT } from "../core";
import { lessonText } from "./lessonText";
import { endlessHintPending, showEndlessHint } from "./firstTime";
import { hintSentence, noHintSentence } from "./puzzleHint";
import { loadHighScores, recordCpuResult, recordLessonDone, recordPuzzleClear, recordScore } from "./highscore";
import { recordProgress } from "../scores/progress";
import { showScoreResult } from "./score-result";
import { BoardView, announceOpponentChains, type HudSide } from "./BoardView";
import { P1_KEYS, P2_KEYS, PlayerInput } from "./input";
import { audio } from "./shared";
import { musicDanger } from "./musicDanger";
import { haptics } from "./haptics";
import { TouchInput } from "./touch";
import { DPR, applyLayout } from "./hidpi";
import { Button, gradientFill } from "./ui";
import { paintGlass } from "./menuCard";
import { RaiseBar } from "./RaiseBar";
import { wakeLock } from "./wakelock";
import { fullscreen } from "./fullscreen";
import { canShare, shareText } from "./share";
import type { ShareVerdict, ShareResult } from "../ogp/spec";
import { BOARD_H, BOARD_W, CARD, FONT, FONT_UI, TEXT_COLOR, TEXT_DIM, KIND_COLORS, type Layout, type SkyName, layoutFor, sameLayout } from "./theme";
import { Background } from "./Background";
import { t } from "./i18n";
import { backHintDuration } from "./backHint";
import { eligibleRun } from "../scores/model";

/** せり上げバーの高さ（タッチ端末・マウス）と、盤面の下端からの間隔。残り時間の行（BOARD_H + 14 から 13px）の下に入れる。 */
const RAISE_BAR_H = 30;
const RAISE_BAR_H_MOUSE = 22;
/** 盤面の下端からせり上げバーまでの隙間。停止時間の青い線（盤面の下 6〜10px）を避ける */
const RAISE_BAR_GAP = 12;
/**
 * マウスの画面での隙間。盤面の縁（下端の 7px 外）からバーまでが 5px（パネルの 16%）しかなく、
 * いちばん大きな連鎖の揺れ（パネルの 17%）で盤面の縁がバーに届いていた。タッチ端末は縁からバーまで 10px あるので変えない
 */
const RAISE_BAR_GAP_MOUSE = 14;
/** せり上げバーの下端から時間などの行までの隙間 */
const INFO_GAP = 8;
/** 縦持ちのレッスンで、盤面（せり上がる課はその下の時間の行）から説明までの隙間と、説明の下端から画面の下端までに残す余白 */
const LESSON_TEXT_GAP = 18;
const LESSON_BOTTOM_MARGIN = 8;
import { enqueueScore } from "../scores/client";
import { playFields, track } from "./analytics";

const STEP_MS = 1000 / 60;
/**
 * エンドレス・タイムアタックが終わってから HTML の結果画面を出すまでの時間。この間は盤面の GAME OVER / TIME UP と
 * 閃光（新記録なら紙吹雪）を見せる。タップ・決定キーで飛ばせ、R のやり直しは待たせない
 */
const RESULT_DELAY_MS = 1000;
/** 縦持ちの CPU 対戦で、CPU の盤面を描く大きさ。 */
const CPU_BOARD_SCALE = 0.5;

export interface GameStart {
  mode: GameMode;
  cpuLevel?: CpuLevel;
  stage?: number;
  /** オンラインの待機中に相手がいなくて始めた CPU 戦。勝敗は記録せず、終わったら待機列へ戻る。 */
  fromOnline?: boolean;
  /** 前の画面が戻る操作用に積んだ履歴をそのまま引き継ぐ（積み直さない）。 */
  historyPushed?: boolean;
  /** レッスンの課（0 始まり）。 */
  lesson?: number;
}

/** 目標（「1 手で全部消す」）を盤面に出す面の数。最初の段の 1〜3 面 */
const PUZZLE_GOAL_STAGES = 3;

export class GameScene extends Phaser.Scene {
  private game_!: Game;
  views: BoardView[] = [];
  private inputs: PlayerInput[] = [];
  touches: TouchInput[] = [];
  private raiseHints: RaiseBar[] = [];
  private accumulator = 0;
  /** 一時停止中か。P キー、または画面が隠れたときに true になる。 */
  paused = false;
  private mode: GameMode = "endless";
  private cpuLevel: CpuLevel = "normal";
  private fromOnline = false;
  /** 計測用。始めた時刻（ms）で、終わったときに試合時間を出す。 */
  private startedAt = 0;
  /** パズルの面（0 始まり）。 */
  private stage = 0;
  /** レッスンの課（0 始まり）。 */
  private lesson = 0;
  /** レッスンの説明文と RESET。課の目印は、この時刻（scene.time.now）から動きがなければ出す */
  private lessonText: Phaser.GameObjects.Text | null = null;
  private lessonReset: Button | null = null;
  private lessonMatched = false;
  /** 目標に届かない入れ替えをして盤面が静止した。RESET の案内を出している */
  private lessonStuck = false;
  private lessonSwapped = false;
  private lessonSettledFrames = 0;
  private lessonStuckText: Phaser.GameObjects.Text | null = null;
  /** パズルの 戻す・進める・ヒント。盤面の下（横長の画面は HUD の列）に置く */
  private puzzleButtons: { undo: Button; redo: Button; hint: Button } | null = null;
  /** パズルのヒント文。1 段目は技法の文、2 段目はそのまま残して盤面に目印を足す */
  private puzzleHintText: Phaser.GameObjects.Text | null = null;
  /** ヒントの段。0 は出していない。手を打つ・戻す・進めるで 0 に戻る */
  private puzzleHintLevel = 0;
  /** 最初の数面だけ盤面の上のほうに出す目標（「1 手で全部消す」）。ほかの面とモードは null */
  private puzzleGoal: Phaser.GameObjects.Text | null = null;
  /** 結果画面の部品。パズルで失敗から戻すときに片付ける */
  private resultButtons: Phaser.GameObjects.GameObject[] = [];
  private resultTimer: Phaser.Time.TimerEvent | null = null;
  private resultPointer: ((p: Phaser.Input.Pointer) => void) | null = null;
  layout!: Layout;
  private vsText: Phaser.GameObjects.Text | null = null;
  private pauseButton!: Button;
  /** ポーズ画面。暗幕・見出し・ボタンをまとめた Container。 */
  pauseMenu!: Phaser.GameObjects.Container;
  private pauseDim!: Phaser.GameObjects.Rectangle;
  private pauseCard!: Phaser.GameObjects.Graphics;
  private pauseGlass!: Phaser.GameObjects.Graphics;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseButtons: Button[] = [];
  private hintText!: Phaser.GameObjects.Text;
  /** 戻る操作を受けたときに数秒出す案内。 */
  private backHintText!: Phaser.GameObjects.Text;
  private backHintTimer: number | null = null;
  private ended = false;
  /** 開始のカウントダウン中か。この間はゲームを進めない。 */
  starting = false;
  private wasDanger = false;
  /** ゲーム用に履歴を積んでいるか。メニューへ戻るときに1つ戻して消す。 */
  private historyPushed = false;
  /** 背景の空と光の玉。レイアウトが変わったら作り直す */
  private bg: Background | null = null;
  private scoreRun: { id: string; seed: number } | null = null;

  constructor() {
    super("game");
  }

  create(data: GameStart): void {
    this.mode = data.mode ?? "endless";
    this.cpuLevel = data.cpuLevel ?? "normal";
    this.fromOnline = !!data.fromOnline;
    this.stage = Math.max(0, Math.min(PUZZLES.length - 1, data.stage ?? 0));
    this.lesson = Math.max(0, Math.min(LESSONS.length - 1, data.lesson ?? 0));
    this.startedAt = Date.now();
    track("start", { mode: this.mode, detail: this.trackDetail() });
    const params = new URLSearchParams(location.search);
    const seed = Number(params.get("seed")) || (Date.now() & 0xffffff);
    this.scoreRun = eligibleRun(this.mode, params) ? { id: crypto.randomUUID(), seed } : null;
    const speedLevel = Number(params.get("speed")) || 1;
    const shockMax = params.has("shock") ? Number(params.get("shock")) || 0 : undefined;
    // ?time=秒 でタイムアタックの制限時間を変える（e2e 用）
    const timeLimitFrames = Number(params.get("time")) > 0 ? Math.round(Number(params.get("time")) * 60) : undefined;
    this.game_ = new Game({ mode: this.mode, seed, speedLevel, cpuLevel: this.cpuLevel, shockMax, timeLimitFrames, stage: this.stage, lesson: this.lesson });
    this.lessonMatched = false;
    this.lessonStuck = false;
    this.lessonSwapped = false;
    this.lessonSettledFrames = 0;
    this.accumulator = 0;
    this.paused = false;
    this.ended = false;
    this.wasDanger = false;
    this.views = [];
    this.inputs = [];
    this.touches.forEach((t) => t.destroy());
    this.touches = [];
    this.pauseButtons = [];

    this.layout = layoutFor(this.mode);
    applyLayout(this, this.layout);
    this.bg?.destroy();
    this.bg = new Background(this, this.layout.width, this.layout.height, this.sky());
    this.bg.setTimeRemaining(this.game_.framesLeft, false);

    const boards = this.game_.boards;
    if (this.mode === "puzzle") {
      this.views.push(new BoardView(this, boards[0], `${t("PUZZLE")} ${puzzleName(this.stage)}`, false, null, "puzzle", CARD.green));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      this.vsText = null;
    } else if (this.mode === "lesson") {
      this.views.push(new BoardView(this, boards[0], t("LESSON {n} / {total}", { n: this.lesson + 1, total: LESSONS.length }), false, null, "lesson", CARD.violet));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      this.vsText = null;
    } else if (boards.length === 1) {
      // 枠の色。金・橙のような暖色は盤面を囲むと注意の色に見えたので、寒色だけを使う。エンドレスは水色、タイムアタックは藤
      this.views.push(new BoardView(this, boards[0], "1P", true, this.game_.timeLimit, "", this.mode === "timeattack" ? CARD.violet : CARD.cyan));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      this.vsText = null;
    } else {
      const isCpu = this.mode === "cpu";
      // 枠の色。自分の盤面は水色、相手は CPU なら難易度の色（EASY 緑・NORMAL 藤・HARD 桃）、2P なら藤色。
      // 金・橙・赤のような暖色は盤面を囲むと注意の色に見えたので使わない
      const cpuColor = { easy: CARD.green, normal: CARD.violet, hard: CARD.pink }[this.cpuLevel];
      this.views.push(new BoardView(this, boards[0], "1P", true, null, "", CARD.cyan));
      this.views.push(new BoardView(this, boards[1], isCpu ? `${t("VS CPU")} ${this.cpuLevel.toUpperCase()}` : "2P", false, null, "", isCpu ? cpuColor : CARD.violet));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      if (!isCpu) this.inputs.push(new PlayerInput(this, P2_KEYS, 1));
      this.vsText = this.add
        .text(0, 0, "VS", { fontFamily: FONT_UI, fontSize: "28px", fontStyle: "700", color: "#ffe066", stroke: "#3a1a5a", strokeThickness: 6 })
        .setOrigin(0.5);
    }

    // タッチは横ドラッグ、マウスはクリック・横ドラッグで入れ替え。CPU の盤面は触れない。
    boards.forEach((b, i) => {
      if (!this.inputs[i]) return;
      const t = new TouchInput(this, b);
      this.touches.push(t);
      this.inputs[i].touch = t;
      this.views[i].touch = t;
    });
    // 盤面の下のせり上げバー。押している間は手動せり上げで、せり上げ中（バー・2本指・キー・ゲームパッド）は黄色に点灯する。
    // 大きさと当たり判定は place() で決める。盤面の外の余白ならどこでもせり上がる操作は誤タップが多かったので外してあり、
    // 押せるのはこのバーの範囲だけ
    this.raiseHints = boards.map((_, i) =>
      new RaiseBar(this, (p) => {
        if (this.ended || this.paused) return;
        this.touches[i]?.holdRaise(p.id);
      }).setVisible(Boolean(this.inputs[i]) && this.mode !== "puzzle" && !this.game_.lesson?.rows),
    );
    // 停止時間はせり上げバーを STOP のゲージに切り替えて見せ、連鎖の終わりの締めは遊ぶ人の盤面にだけ出す
    this.views.forEach((v, i) => {
      v.stopOnBar = this.raiseHints[i].visible;
      v.chainSummary = Boolean(this.inputs[i]);
      // 対戦（VS CPU・2 PLAYERS）の締めは得点の代わりに相手に送った板を言う
      v.summaryAttack = this.mode === "cpu" || this.mode === "versus";
      v.opponentLeft = this.mode === "versus" && i === 1;
      // 連鎖した瞬間の盤面の揺れと閃光も遊ぶ人の盤面だけ。パズルとレッスンでも連鎖の手応えは出す
      v.chainFeel = Boolean(this.inputs[i]);
    });

    // レッスンの説明。盤面の下に短く出し、迷っていれば盤面の目印を光らせる。固定の面は RESET で最初の形に戻せる
    this.lessonText?.destroy();
    this.lessonText = null;
    this.lessonReset?.destroy();
    this.lessonReset = null;
    if (this.game_.lesson) {
      const text = lessonText(this.game_.lesson.id, this.layout.touch);
      this.lessonText = this.add
        .text(0, 0, `${text.title}\n${text.body}`, { fontFamily: FONT_UI, fontSize: "14px", color: TEXT_COLOR, align: "center", lineSpacing: 3, wordWrap: { width: BOARD_W + 60, useAdvancedWrap: true } })
        .setOrigin(0.5, 0)
        .setDepth(5)
        .setName("lesson-text");
      // 縦持ちでは盤面の上の行（ポーズボタンの左）に置くので、名前の札とぶつからないよう小さめにする
      if (this.game_.lesson.rows) this.lessonReset = new Button(this, 0, 0, t("RESET"), () => this.restart(), { minWidth: 64, minHeight: 30, fontSize: 13, padX: 20 }).setDepth(5).setName("lesson-reset");
      this.lessonStuckText?.destroy();
      this.lessonStuckText = this.add
        .text(0, 0, t("The board changed. RESET puts it back."), { fontFamily: FONT_UI, fontSize: "13px", color: "#ffe066", align: "center", wordWrap: { width: BOARD_W + 60, useAdvancedWrap: true } })
        .setOrigin(0.5, 0)
        .setDepth(5)
        .setVisible(false)
        .setName("lesson-stuck");
      // 目印は最初から出す。手を自分で見つけるのは PUZZLE の役目で、ここは仕組みを体で覚える場。
      // 1 手目を間違えると解けなくなる面が多く、隠すと初心者が止まる
      const h = this.game_.lesson.hint;
      if (h) this.views[0].setHint([h, { x: h.x + 1, y: h.y }]);
    }
    // 初めての ENDLESS だけ、盤面の上の空いた段に操作の一文を出し、最初の入れ替えで消す（src/render/firstTime.ts）
    if (this.mode === "endless" && endlessHintPending(loadHighScores())) showEndlessHint(this, this.views[0], boards[0], this.layout.touch);

    // パズルの 戻す・進める・ヒント。手を打ち直すたびに最初からやり直さなくて済むようにする。
    // ヒントは 1 回目で次の手の技法を文で、2 回目で入れ替えるマスを盤面に光らせる
    this.puzzleButtons = null;
    this.puzzleHintText = null;
    this.puzzleHintLevel = 0;
    this.puzzleGoal = null;
    this.resultButtons = [];
    this.resultTimer = null;
    this.resultPointer = null;
    if (this.mode === "puzzle") {
      const opts = { minWidth: 76, minHeight: 32, fontSize: 13 };
      this.puzzleButtons = {
        undo: new Button(this, 0, 0, t("UNDO"), () => this.puzzleUndo(), opts).setDepth(5).setName("undo"),
        redo: new Button(this, 0, 0, t("REDO"), () => this.puzzleRedo(), opts).setDepth(5).setName("redo"),
        hint: new Button(this, 0, 0, t("HINT"), () => this.puzzleHint(), opts).setDepth(5).setName("hint"),
      };
      this.puzzleHintText = this.add
        .text(0, 0, "", { fontFamily: FONT_UI, fontSize: "14px", color: "#ffe066", align: "center", lineSpacing: 3, wordWrap: { width: BOARD_W + 60, useAdvancedWrap: true } })
        .setOrigin(0.5, 0)
        .setDepth(5)
        .setVisible(false)
        .setName("puzzle-hint");
      // 初めて遊ぶ人は何をすればクリアか分からないので、最初の数面だけ目標と手数を盤面の中の上（空いている段）に出す。
      // 手数は面ごとの値から作る
      if (this.stage < PUZZLE_GOAL_STAGES) {
        const moves = PUZZLES[this.stage].moves;
        const goal = moves === 1 ? t("CLEAR ALL PANELS IN 1 MOVE") : t("CLEAR ALL PANELS IN {moves} MOVES", { moves });
        this.puzzleGoal = this.add
          .text(0, 0, goal, { fontFamily: FONT_UI, fontSize: "16px", fontStyle: "700", color: TEXT_COLOR, align: "center", lineSpacing: 2, wordWrap: { width: BOARD_W - 24, useAdvancedWrap: true } })
          .setShadow(0, 2, "#1c1238", 4, false, true)
          .setOrigin(0.5, 0)
          .setDepth(1)
          .setName("puzzle-goal");
      }
    }

    // 画面上のポーズボタン
    this.pauseButton = new Button(this, 0, 0, "❚❚", () => this.togglePause(), { minWidth: 44, minHeight: 30, fontSize: 13, bg: 0x120c2c, bgAlpha: 0.62, radius: 15 }).setDepth(5);

    // ポーズ画面。暗幕をタップしても再開する。ボタンで やり直し・音・振動・メニュー
    this.pauseDim = this.add.rectangle(0, 0, 10, 10, 0x0c0820, 0.72).setOrigin(0);
    // 見出しとボタンを載せる板。盤面が透けないよう濃紺で塗ってから、メニューと同じ光る縁のガラスを重ねる
    this.pauseCard = this.add.graphics();
    this.pauseGlass = this.add.graphics();
    this.pauseTitle = this.add
      .text(0, 0, t("PAUSE"), { fontFamily: FONT_UI, fontSize: "34px", color: TEXT_COLOR, fontStyle: "700", stroke: "#1c1238", strokeThickness: 6 })
      .setShadow(0, 3, "rgba(0, 0, 0, 0.4)", 4, true, false)
      .setOrigin(0.5);
    gradientFill(this.pauseTitle, "#ffffff", "#c9b8ff");
    const soundLabel = (): string => t("SOUND: {state}", { state: t(audio.muted ? "OFF" : "ON") });
    const vibLabel = (): string => t("VIBRATION: {state}", { state: t(haptics.enabled ? "ON" : "OFF") });
    this.pauseButtons.push(new Button(this, 0, 0, t("RESUME"), () => this.setPaused(false), { minWidth: 180, minHeight: 40, primary: true }));
    this.pauseButtons.push(new Button(this, 0, 0, t("RESTART"), () => this.restart(), { minWidth: 180, minHeight: 40 }));
    const toggleSound = (): void => {
      audio.setMuted(!audio.muted);
      soundBtn.setText(soundLabel());
    };
    const soundBtn = new Button(this, 0, 0, soundLabel(), toggleSound, { minWidth: 180, minHeight: 40 });
    this.pauseButtons.push(soundBtn);
    if (haptics.supported) {
      const vibBtn = new Button(
        this,
        0,
        0,
        vibLabel(),
        () => {
          haptics.toggle();
          vibBtn.setText(vibLabel());
        },
        { minWidth: 180, minHeight: 40 },
      );
      this.pauseButtons.push(vibBtn);
    }
    this.pauseButtons.push(new Button(this, 0, 0, t("MENU"), () => this.toMenu(), { minWidth: 180, minHeight: 40 }));
    this.pauseMenu = this.add.container(0, 0, [this.pauseDim, this.pauseCard, this.pauseGlass, this.pauseTitle, ...this.pauseButtons]).setDepth(30).setVisible(false);
    // ポーズ中の暗幕タップは再開だけに使う（入れ替えにはしない）
    this.input.on("pointerdown", () => {
      if (this.paused && !this.ended) this.setPaused(false);
    });
    // 画面が隠れたら（別アプリへ切り替え、タブ移動、画面オフ）止めて、BGM も止める
    const onHidden = (): void => this.onHidden();
    this.game.events.on("hidden", onHidden);
    this.game.events.on("blur", onHidden);
    // Android の戻るジェスチャ・戻るボタンでアプリが閉じないよう、履歴を1つ積んで popstate を受ける。
    // 戻るジェスチャ（画面端からの横スワイプ）は盤面のドラッグと重なりやすいので、ゲーム中の戻る操作には
    // 何もさせない。ポーズもメニューも画面のボタンから行う。
    if (!data.historyPushed) history.pushState({ swaprise: "game" }, "");
    this.historyPushed = true;
    const onPop = (): void => {
      if (!this.historyPushed) return;
      history.pushState({ swaprise: "game" }, "");
      this.showBackHint();
    };
    window.addEventListener("popstate", onPop);
    // 回転・ウィンドウサイズの変更。連続して来るので少し待ってからレイアウトし直す
    let resizeTimer: number | null = null;
    const onResize = (): void => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        this.relayout();
      }, 150);
    };
    window.addEventListener("resize", onResize);
    // ゲーム中は画面をスリープさせない。メニューへ戻るときに外す
    void wakeLock.request();
    this.events.once("shutdown", () => {
      wakeLock.release();
      this.game.events.off("hidden", onHidden);
      this.game.events.off("blur", onHidden);
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("resize", onResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (this.backHintTimer !== null) window.clearTimeout(this.backHintTimer);
      this.backHintTimer = null;
    });
    // キーボード向けの案内。タッチ端末では出さない（ボタンがある）
    this.hintText = this.add
      .text(0, 0, this.mode === "versus" ? t("P: pause   R: restart   Esc: menu   M: mute") : t("←↑↓→: move   Z: swap   X: raise   P: pause   R: restart   Esc: menu   M: mute"), { fontFamily: FONT_UI, fontSize: "12px", color: "rgba(255,255,255,0.55)" })
      .setOrigin(0.5);
    // 戻る操作の案内。盤面の外（画面の下端、横持ちのスマホは上端）に数秒だけ出す
    this.backHintText = this.add
      .text(0, 0, t("Back does not leave the game. To quit, pause and choose MENU."), {
        fontFamily: FONT_UI, fontSize: "12px", color: TEXT_COLOR, backgroundColor: "#2a2050dd", padding: { x: 8, y: 4 }, align: "center",
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setVisible(false);

    const kb = this.input.keyboard!;
    kb.on("keydown-P", () => this.togglePause());
    kb.on("keydown-R", () => this.restart());
    kb.on("keydown-ESC", () => this.toMenu());
    kb.on("keydown-M", toggleSound);
    kb.on("keydown-V", () => haptics.toggle());
    if (this.mode === "puzzle") {
      kb.on("keydown-U", () => this.puzzleUndo());
      kb.on("keydown-Y", () => this.puzzleRedo());
      kb.on("keydown-H", () => this.puzzleHint());
    }
    // 結果のボタン（NEXT / NEXT LESSON / RETRY など）は、入れ替えと同じ決定キー（Z / Space / Enter、ゲームパッドの A）で
    // 主ボタンを押せる。マウスやタップでしか押せず、キーボードで遊ぶと次へ進めなかった。押しっぱなしの繰り返しは拾わない
    kb.on("keydown", (e: KeyboardEvent) => {
      if (!e.repeat && (e.code === "KeyZ" || e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter")) this.pressResultPrimary();
    });
    this.input.gamepad?.on("down", (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (button.index === 0) this.pressResultPrimary();
    });
    this.resultKeycap = false;
    kb.on("keydown", () => audio.start());
    this.input.on("pointerdown", () => audio.start());

    this.place();

    audio.start();
    audio.setDanger(false);
    // メニューの曲はここで止め、カウントダウン中は無音にする。ゲームの曲は START で始める
    audio.stopBgm();

    // e2e とデバッグ用。
    (window as unknown as { __swaprise: unknown }).__swaprise = {
      game: this.game_,
      scene: this,
      /** 論理サイズ。canvas は DPR 倍なので、テストは scale.width ではなくこちらで座標を換算する */
      layout: this.layout,
      tick: (inputs: Input[]) => this.stepOnce(inputs),
    };

    // パズルは時間と関係がなく、盤面を眺めてから始めるものなので、カウントダウンを置かない。
    // レッスンの固定の面（せり上がらない課）も同じ。RESET や R のたびに 3 秒待たされていた。せり上がる課には残す
    const start = (): void => {
      if (params.get("countdown") === "0" || this.mode === "puzzle" || this.game_.lesson?.rows) this.beginPlay();
      else this.runCountdown();
    };
    start();
  }

  /** 画面の向きやサイズが変わったとき。レイアウトが変わるなら置き直す。ゲームの進行はそのまま。 */
  private relayout(): void {
    const next = layoutFor(this.mode);
    if (sameLayout(next, this.layout)) return;
    this.layout = next;
    applyLayout(this, next);
    this.bg?.destroy();
    this.bg = new Background(this, next.width, next.height, this.sky());
    this.bg.setTimeRemaining(this.game_.framesLeft, !this.ended && !this.starting);
    this.bg.setStack(this.game_.boards[0], 0, !this.ended && !this.starting);
    this.place();
    (window as unknown as { __swaprise: { layout: Layout } }).__swaprise.layout = next;
  }

  /** 背景の空。レッスンはパズルと同じ空を使う */
  private sky(): SkyName {
    return this.mode === "lesson" ? "puzzle" : this.mode;
  }

  /** 縦持ちのレッスンの説明の折り返し幅 */
  private lessonWrapWidth(): number {
    return Math.min(this.layout.width - 16, BOARD_W + 60);
  }

  /** 盤面の下端からレッスンの説明までにある、せり上げバーと時間の行の高さ（せり上がる課だけ） */
  private lessonBarSpace(): number {
    return this.raiseHints[0]?.visible ? (this.layout.touch ? RAISE_BAR_GAP + RAISE_BAR_H : RAISE_BAR_GAP_MOUSE + RAISE_BAR_H_MOUSE) + INFO_GAP : 0;
  }

  /**
   * 縦持ちのレッスンで盤面を描く大きさ。説明（見出しと本文、または見出しと届かない手のあとの案内の高いほう）の行数から要る高さを測り、
   * 盤面の下に収まらなければ盤面を小さくする。背の低い縦持ち（320×568 などで論理の高さ約 533px）では説明の最後の行が画面の下に切れていた。
   * 案内が出ても盤面の大きさが変わらないよう、両方の高さを測って大きいほうに合わせる
   */
  private lessonBoardScale(top: number): number {
    const lesson = this.game_.lesson;
    if (!lesson || !this.lessonText || !this.layout.portrait) return 1;
    const wrap = this.lessonWrapWidth();
    const text = lessonText(lesson.id, this.layout.touch);
    const shown = this.lessonText.text;
    this.lessonText.setWordWrapWidth(wrap, true).setText(`${text.title}\n${text.body}`);
    const full = this.lessonText.height;
    this.lessonText.setText(text.title);
    const stuck = this.lessonText.height + 6 + (this.lessonStuckText?.setWordWrapWidth(wrap, true).height ?? 0);
    this.lessonText.setText(shown);
    const room = this.layout.height - LESSON_BOTTOM_MARGIN - Math.max(full, stuck) - LESSON_TEXT_GAP - this.lessonBarSpace() - top;
    return Math.min(1, room / BOARD_H);
  }

  /** 現在のレイアウトに合わせて、盤面と UI の位置を決める。 */
  private place(): void {
    const L = this.layout;
    const W = L.width;
    const H = L.height;
    const boards = this.game_.boards;
    // デスクトップは盤面の下にせり上げバーと操作の案内文が並ぶので、上端を詰めて高さ 520 に収める
    const top = L.phoneLandscape ? 14 : L.portrait ? 52 : 56;
    const barH = L.touch ? RAISE_BAR_H : RAISE_BAR_H_MOUSE;
    const barGap = L.touch ? RAISE_BAR_GAP : RAISE_BAR_GAP_MOUSE;
    const placeBoard = (i: number, ox: number, oy: number, scale: number, hud: HudSide = "top"): void => {
      // せり上げバーは操作の要なので盤面の直下に置き、時間・速度・最大連鎖の行はその下。バーのない盤面（CPU・パズル）は行を盤面の直下に戻す
      const hasBar = this.raiseHints[i].visible;
      this.views[i].place(ox, oy, scale, hud, hasBar ? BOARD_H + (barGap + barH + INFO_GAP) / scale : undefined);
      this.touches[i]?.place(ox, oy, scale);
      // せり上げバー。HUD が上なら盤面の直下に盤面と同じ幅で、横なら HUD の列に置く。
      // 当たり判定は指の大きさ（44dp）まで上下に広げる
      if (hud === "top") {
        this.raiseHints[i].resize(BOARD_W * scale, barH, 48).setPosition(ox + (BOARD_W / 2) * scale, oy + BOARD_H * scale + barGap + barH / 2);
      } else {
        this.raiseHints[i].resize(100, 44, 48);
        // HUD の列の得点・時間・速度・最大連鎖の札（下端 oy + 166）の下
        if (hud === "right") this.raiseHints[i].setPosition(ox + BOARD_W + 12 + 50, oy + 198);
        else this.raiseHints[i].setPosition(ox - 12 - 50, oy + 198);
      }
    };
    if (L.phoneLandscape) {
      // 横持ちのスマホ。盤面を高さいっぱいに描き、得点などは盤面の横に置く。
      // 2P 対戦は盤面を左右の端に寄せ、2人が片方ずつ持って遊べるようにする。CPU 対戦も同じ並び
      const edge = 40; // Android の戻るジェスチャ領域（約 24dp）を避ける
      if (boards.length === 1) {
        const ox = Math.floor((W - BOARD_W) / 2);
        placeBoard(0, ox, top, 1, "right");
        // ポーズボタンは HUD の列の下のほう。パズルはせり上げバーがなく、下に 戻す・進める・ヒント が並ぶので上に詰める
        this.pauseButton.setPosition(ox + BOARD_W + 12 + 50, top + (this.mode === "puzzle" ? 220 : 256));
      } else {
        placeBoard(0, edge, top, 1, "right");
        placeBoard(1, W - edge - BOARD_W, top, 1, "left");
        this.vsText?.setPosition(W / 2, H / 2 - 40).setFontSize(22).setVisible(true);
        // ポーズボタンは画面の中央下。2P でもどちらからも届く
        this.pauseButton.setPosition(W / 2, H - 26);
      }
    } else if (boards.length === 1) {
      const scale = this.lessonBoardScale(top);
      placeBoard(0, Math.floor((W - BOARD_W * scale) / 2), top, scale);
    } else if (this.mode === "cpu" && L.portrait) {
      // 自分の盤面はエンドレスと同じ大きさ。CPU の盤面は右に小さく
      const cpuW = BOARD_W * CPU_BOARD_SCALE;
      const gap = 12;
      const ox1 = Math.floor((W - BOARD_W - gap - cpuW) / 2);
      placeBoard(0, ox1, top, 1);
      placeBoard(1, ox1 + BOARD_W + gap, top, CPU_BOARD_SCALE);
      this.vsText?.setVisible(false);
    } else {
      const gap = L.portrait ? 20 : 120;
      const ox1 = Math.floor(W / 2 - gap / 2 - BOARD_W);
      const ox2 = Math.floor(W / 2 + gap / 2);
      placeBoard(0, ox1, top, 1);
      placeBoard(1, ox2, top, 1);
      // 縦持ちでは盤面の隙間が狭いので、盤面の下（せり上げバーと時間の行の下）に置く
      if (L.portrait) this.vsText?.setPosition(W / 2, top + BOARD_H + barGap + barH + INFO_GAP + 40).setFontSize(18).setVisible(true);
      else this.vsText?.setPosition(W / 2, top + BOARD_H / 2).setFontSize(28).setVisible(true);
    }
    // ポーズボタンは自分の盤面の右上の外。隣の盤面や画面の端までに余白がなければ盤面の右上の内側に置き、
    // 得点の板をその分だけ詰める。横持ちのスマホは上で決めた
    if (!L.phoneLandscape) {
      const right = this.views[0].ox + BOARD_W * this.views[0].scale;
      const room = (this.views[1] ? this.views[1].ox : W) - right;
      const outside = room >= 52;
      this.pauseButton.setPosition(outside ? right + 6 + 22 : right - 22, top - 24);
      this.views[0].setHudMaxWidth(outside ? Infinity : BOARD_W - 52);
    }
    // レッスンの説明は盤面の下（横持ちのスマホは盤面の右）。RESET は縦持ちなら盤面の上の行のポーズボタンの左、横長なら説明の下
    if (this.lessonText) {
      const v = this.views[0];
      if (L.portrait) {
        // 縦持ちは盤面の下。盤面は lessonBoardScale() で、説明の最後の行まで画面に収まる大きさにしてある
        const cx = v.ox + (BOARD_W * v.scale) / 2;
        this.lessonText.setOrigin(0.5, 0).setAlign("center").setWordWrapWidth(this.lessonWrapWidth(), true).setPosition(cx, top + BOARD_H * v.scale + this.lessonBarSpace() + LESSON_TEXT_GAP);
        this.lessonStuckText?.setOrigin(0.5, 0).setAlign("center").setWordWrapWidth(this.lessonWrapWidth(), true).setPosition(cx, this.lessonText.y + this.lessonText.height + 6);
        // 説明の下に置くと、背の低い縦持ち（論理の高さ約 533px）では画面の下にはみ出していた
        if (this.lessonReset) this.lessonReset.setPosition(this.pauseButton.x - 22 - 6 - this.lessonReset.width / 2, this.pauseButton.y);
      } else {
        // 横長（PC・横持ちのスマホ）は盤面の右。横持ちのスマホは HUD の列（幅 100）の右に置く
        const left = v.ox + BOARD_W + (L.phoneLandscape ? 124 : 28);
        const sideW = Math.min(300, Math.max(160, W - left - 16));
        this.lessonText.setOrigin(0, 0).setAlign("left").setWordWrapWidth(sideW, true).setPosition(left, top + (L.phoneLandscape ? 4 : 0));
        this.lessonStuckText?.setOrigin(0, 0).setAlign("left").setWordWrapWidth(sideW, true).setPosition(left, this.lessonText.y + this.lessonText.height + 8);
        const below = this.lessonStuck && this.lessonStuckText ? this.lessonStuckText.y + this.lessonStuckText.height : this.lessonText.y + this.lessonText.height;
        if (this.lessonReset) this.lessonReset.setPosition(left + this.lessonReset.width / 2 + 4, below + 26);
      }
    }

    // パズルの 戻す・進める・ヒント は盤面の下の残り手数の行の下。横長の画面はヒント文を盤面の右に出す。
    // 横持ちのスマホはボタンも HUD の列（ポーズボタンの下）に縦に並べる
    if (this.puzzleGoal) {
      const v = this.views[0];
      this.puzzleGoal.setScale(v.scale).setPosition(v.ox + (BOARD_W * v.scale) / 2, v.oy + 28 * v.scale);
    }
    if (this.puzzleButtons && this.puzzleHintText) {
      const v = this.views[0];
      const { undo, redo, hint } = this.puzzleButtons;
      const cx = v.ox + BOARD_W / 2;
      if (L.phoneLandscape) {
        const x = v.ox + BOARD_W + 12 + 50;
        undo.setPosition(x, top + 262);
        redo.setPosition(x, top + 298);
        hint.setPosition(x, top + 334);
        const left = x + 60;
        this.puzzleHintText.setOrigin(0, 0).setAlign("left").setWordWrapWidth(Math.min(300, Math.max(160, W - left - 16)), true).setPosition(left, top + 4);
      } else {
        // ボタンは盤面の下の残り手数の行の下。ヒント文は縦持ちならその下、PC は下に余白がないので盤面の右
        const y = top + BOARD_H + 52;
        undo.setPosition(cx - 84, y);
        redo.setPosition(cx, y);
        hint.setPosition(cx + 84, y);
        if (L.portrait) {
          this.puzzleHintText.setOrigin(0.5, 0).setAlign("center").setWordWrapWidth(Math.min(W - 16, BOARD_W + 60), true).setPosition(cx, y + 26);
        } else {
          const left = v.ox + BOARD_W + 28;
          this.puzzleHintText.setOrigin(0, 0).setAlign("left").setWordWrapWidth(Math.min(300, Math.max(160, W - left - 16)), true).setPosition(left, top);
        }
      }
    }

    this.pauseDim.setSize(W, H);
    const titleY = H / 2 - 40 - this.pauseButtons.length * 23 - 20 + 16;
    this.pauseTitle.setPosition(W / 2, titleY);
    this.pauseButtons.forEach((b, i) => b.setPosition(W / 2, H / 2 - (this.pauseButtons.length - 1) * 23 + i * 46 + 16));
    const cardTop = titleY - 38;
    const cardBottom = H / 2 + (this.pauseButtons.length - 1) * 23 + 16 + 20 + 22;
    const cardW = Math.min(W - 24, 236);
    // paintGlass は描く前に消すので、濃紺の地は別の Graphics に塗る
    this.pauseCard.clear();
    this.pauseCard.fillStyle(0x1c1238, 0.94);
    this.pauseCard.fillRoundedRect(W / 2 - cardW / 2, cardTop, cardW, cardBottom - cardTop, 16);
    paintGlass(this.pauseGlass, W / 2, (cardTop + cardBottom) / 2, cardW, cardBottom - cardTop, CARD.violet);

    // キー操作の案内。パズルは画面にボタンがあり、盤面の下に置くと重なるので出さない
    this.hintText.setPosition(W / 2, H - 10).setVisible(!L.touch && this.mode !== "puzzle");
    this.backHintText.setWordWrapWidth(W - 16).setPosition(W / 2, L.phoneLandscape ? 6 + this.backHintText.height / 2 : H - 8 - this.backHintText.height / 2);
  }

  /** 戻る操作を受けたとき、離れないこととやめる手順を数秒だけ出す。 */
  private showBackHint(): void {
    this.backHintText.setVisible(true);
    if (this.backHintTimer !== null) window.clearTimeout(this.backHintTimer);
    this.backHintTimer = window.setTimeout(() => {
      this.backHintTimer = null;
      this.backHintText.setVisible(false);
    }, backHintDuration());
  }

  /** 3・2・1・START のカウントダウン。各盤面の中央に出す。START でゲームが動き出し、BGM が始まる。 */
  private runCountdown(): void {
    this.starting = true;
    const texts = this.views.map((v) =>
      this.add
        .text(v.center.x, v.center.y, "", { fontFamily: FONT_UI, fontSize: "64px", color: "#ffe066", fontStyle: "700", stroke: "#1c1238", strokeThickness: 9 })
        .setShadow(0, 5, "rgba(0, 0, 0, 0.4)", 6, true, false)
        .setOrigin(0.5)
        .setScale(v.scale)
        .setDepth(40),
    );
    const show = (label: string, big: boolean): void => {
      texts.forEach((text, i) => {
        text.setText(label).setScale((big ? 1.8 : 1.5) * this.views[i].scale).setAlpha(1);
        // 数字は金、START は水色から白へのグラデーション。数字ごとに盤面の中央から光の輪が広がる
        gradientFill(text, big ? "#ffffff" : "#fff6c8", big ? "#7fe3ff" : "#ffc23c");
        const v = this.views[i];
        const ring = this.add.image(v.center.x, v.center.y, "ring").setBlendMode(Phaser.BlendModes.ADD).setTint(big ? 0x7fe3ff : 0xffd24a).setScale((0.6 * v.scale) / DPR).setDepth(39);
        this.tweens.add({ targets: ring, scale: ((big ? 5 : 3.2) * v.scale) / DPR, alpha: 0, duration: big ? 620 : 480, ease: "Cubic.Out", onComplete: () => ring.destroy() });
      });
      texts.forEach((text, i) => this.tweens.add({ targets: text, scale: this.views[i].scale, duration: 180, ease: "Back.Out" }));
    };
    const STEP = 700;
    ["3", "2", "1"].forEach((label, i) => {
      this.time.delayedCall(i * STEP, () => {
        show(label, false);
        audio.count();
      });
    });
    this.time.delayedCall(3 * STEP, () => {
      show("START", true);
      this.beginPlay();
      this.tweens.add({ targets: texts, alpha: 0, delay: 400, duration: 250, onComplete: () => texts.forEach((t) => t.destroy()) });
    });
  }

  private beginPlay(): void {
    this.starting = false;
    this.touches.forEach((t) => t.clear());
    this.accumulator = 0;
    audio.gameStart();
    audio.startBgm("game");
  }

  /** パズルで最後の手を戻す。失敗の結果画面からも戻せるので、結果の表示を片付けて続きを遊べるようにする。 */
  private puzzleUndo(): void {
    if (this.paused || !this.game_.puzzleUndo()) return;
    this.clearPuzzleHint();
    this.touches.forEach((t) => t.clear());
    if (this.ended) this.resumeAfterUndo();
  }

  private puzzleRedo(): void {
    if (this.paused || this.ended || !this.game_.puzzleRedoMove()) return;
    this.clearPuzzleHint();
    this.touches.forEach((t) => t.clear());
  }

  /** ヒント。1 回目は次の手の技法を文で出し、2 回目は入れ替えるマスを盤面に光らせる。盤面が動いている間は効かない */
  private puzzleHint(): void {
    if (this.paused || this.ended || !this.puzzleHintText) return;
    if (!this.game_.boards[0].isSettled()) return;
    const h = this.game_.puzzleHint();
    if (!h) {
      this.puzzleHintLevel = 1;
      this.puzzleHintText.setText(noHintSentence()).setVisible(true);
      this.views[0].setHint(null);
      return;
    }
    if (this.puzzleHintLevel === 0) {
      this.puzzleHintLevel = 1;
      this.puzzleHintText.setText(hintSentence(h.techniques)).setVisible(true);
    } else {
      this.puzzleHintLevel = 2;
      this.views[0].setHint([h.move, { x: h.move.x + 1, y: h.move.y }]);
    }
  }

  private clearPuzzleHint(): void {
    if (!this.puzzleHintText) return;
    this.puzzleHintLevel = 0;
    this.puzzleHintText.setVisible(false);
    this.views[0].setHint(null);
  }

  /** 失敗の結果画面から手を戻したとき、結果の表示を消してゲームに戻る。 */
  private resumeAfterUndo(): void {
    this.ended = false;
    this.pauseButton.setVisible(true);
    this.puzzleButtons?.undo.setPrimary(false);
    this.resultTimer?.remove(false);
    this.resultTimer = null;
    if (this.resultPointer) this.input.off("pointerdown", this.resultPointer);
    this.resultPointer = null;
    this.resultButtons.forEach((b) => b.destroy());
    this.resultButtons = [];
    this.views[0].hideOverlay();
    this.accumulator = 0;
    audio.startBgm("game");
  }

  /** やり直し。 */
  private restart(): void {
    fullscreen.sync();
    this.scene.restart({ mode: this.mode, cpuLevel: this.cpuLevel, stage: this.stage, fromOnline: this.fromOnline, lesson: this.lesson } satisfies GameStart);
  }

  /** オンラインの待機列へ戻る。待機中に始めた CPU 戦の結果画面から。 */
  private toFindMatch(): void {
    audio.stopBgm();
    audio.setDanger(false);
    this.touches.forEach((t) => t.destroy());
    this.touches = [];
    // 積んだ履歴は ONLINE 画面に引き継ぐ（消して積み直すと、戻る操作の受け止めに隙間ができる）
    const historyPushed = this.historyPushed;
    this.historyPushed = false;
    this.scene.start("online", { findMatch: true, historyPushed });
  }

  /** パズルの次の面へ。 */
  private nextStage(): void {
    fullscreen.sync();
    this.scene.restart({ mode: this.mode, cpuLevel: this.cpuLevel, stage: this.stage + 1 });
  }

  private toMenu(): void {
    audio.stopBgm();
    audio.setDanger(false);
    this.touches.forEach((t) => t.destroy());
    this.touches = [];
    if (this.historyPushed) {
      // 自分で積んだ履歴を消す。popstate は shutdown で外したリスナーには届かない。
      this.historyPushed = false;
      this.scene.start("menu");
      history.back();
      return;
    }
    this.scene.start("menu");
  }

  private togglePause(): void {
    if (this.ended || this.starting) return;
    this.setPaused(!this.paused);
  }

  private setPaused(on: boolean): void {
    if (this.paused === on) return;
    this.paused = on;
    this.pauseMenu.setVisible(on);
    this.pauseButton.setVisible(!on);
    audio.pause(on);
    if (on) {
      audio.suspend();
    } else {
      this.touches.forEach((t) => t.clear());
      this.accumulator = 0;
      audio.resume();
      // 画面オフや戻る操作で全画面が解除されていたら、再開の操作の中で取り直す
      fullscreen.sync();
    }
  }

  private onHidden(): void {
    if (this.ended) {
      audio.suspend();
      return;
    }
    this.setPaused(true);
  }

  private stepOnce(inputs: Input[]): void {
    const timeWasUp = this.game_.timeUp;
    this.game_.tick(inputs);
    if (!timeWasUp && this.game_.timeUp) {
      this.touches.forEach((touch) => touch.destroy());
      this.raiseHints.forEach((hint) => hint.setVisible(false));
    }
    // CPU 戦は相手の盤面が小さいので、相手の大きな連鎖を自分の盤面に知らせる。2 人対戦は同じ画面で両方見えている
    if (this.mode === "cpu") announceOpponentChains(this.game_.boards[1].events, this.views[0]);
    if (this.game_.lesson) this.updateLessonHint(this.game_.boards[0].events);
    if (this.puzzleHintLevel > 0 && this.game_.boards[0].events.some((e) => e.type === "swap")) this.clearPuzzleHint();
    this.game_.boards.forEach((b, i) => {
      // 連鎖の揺れと閃光は BoardView が連鎖した盤面だけに出す（chainFeel）
      this.views[i].handleEvents(b.events, true, Boolean(this.inputs[i]));
    });
  }

  /**
   * レッスンの目印は最初から出し、入れ替えたら消す（動かしたあとの盤面では元の目印が正しい手とは限らない）。
   * アクティブ連鎖の課は、最初の消去が始まった瞬間に次の目印を出す（時間が要）。
   * 目標に届かない入れ替えをして盤面が静止したら、RESET で戻す案内を出す。
   */
  private updateLessonHint(events: readonly { type: string }[]): void {
    const lesson = this.game_.lesson!;
    const view = this.views[0];
    const g = this.game_;
    if (events.some((e) => e.type === "swap")) view.setHint(null);
    if (!this.lessonMatched && events.some((e) => e.type === "match")) {
      this.lessonMatched = true;
      if (lesson.hintAfterMatch) {
        const h = lesson.hintAfterMatch;
        view.setHint([h, { x: h.x + 1, y: h.y }]);
      }
    }
    if (events.some((e) => e.type === "swap")) this.lessonSwapped = true;
    // 入れ替えたあと静止が 20 フレーム続いたら（着地後の連鎖フラグの 12 フレームも過ぎている）、この手では届かなかった
    this.lessonSettledFrames = g.boards[0].isSettled() ? this.lessonSettledFrames + 1 : 0;
    if (lesson.rows && !this.lessonStuck && !g.lessonDone && this.lessonSwapped && this.lessonSettledFrames >= 20) {
      this.lessonStuck = true;
      // 説明の本文は消して見出しだけ残す。壊れた盤面では本文の手順は使えず、縦の場所も要る（日本語は案内が 2 行になる）
      this.lessonText?.setText(lessonText(lesson.id, this.layout.touch).title);
      this.lessonStuckText?.setVisible(true);
      this.lessonReset?.setPrimary(true);
      this.place();
    }
  }

  /** 結果の主ボタン。盤面の上の黄色のボタン、パズルの失敗なら盤面の下の UNDO。まだ出ていなければ null */
  private resultPrimary(): Button | null {
    if (!this.ended || this.paused) return null;
    const onBoard = this.views[0]?.overlayButtons().find((b) => b.primary);
    if (onBoard) return onBoard;
    const undo = this.puzzleButtons?.undo;
    return undo && undo.primary ? undo : null;
  }

  private pressResultPrimary(): void {
    this.resultPrimary()?.emit("pointerdown");
  }

  /**
   * キーボードの端末では、結果の主ボタンの右上に Enter の印を付けて、決定キーで押せることを見せる。
   * ボタンを作る行には手を入れず、出てきたボタンを見つけて足す
   */
  private placeResultKeycap(): void {
    if (this.resultKeycap || this.layout.touch) return;
    const button = this.resultPrimary();
    if (!button) return;
    this.resultKeycap = true;
    const cap = this.add
      .text(button.width / 2 - 4, -button.height / 2, "Enter", { fontFamily: FONT_UI, fontSize: "10px", fontStyle: "700", color: "#2a2050", backgroundColor: "#ffffff", padding: { x: 5, y: 2 } })
      .setOrigin(1, 0.5)
      .setName("enter-keycap");
    button.add(cap);
  }
  private resultKeycap = false;

  /** 画面全体の白い閃き。勝利・クリア・新記録で使う（連鎖の閃光は BoardView が盤面の中だけに出す） */
  private flash(alpha: number): void {
    const L = this.layout;
    const rect = this.add.rectangle(0, 0, L.width, L.height, 0xffffff, alpha).setOrigin(0).setDepth(25);
    this.tweens.add({ targets: rect, alpha: 0, duration: 320, ease: "Quad.Out", onComplete: () => rect.destroy() });
  }

  /** 勝利・クリア・新記録の紙吹雪。盤面の上端から柄の破片を撒く */
  private celebrate(view: BoardView): void {
    const cx = view.center.x;
    const topY = view.oy;
    KIND_COLORS.forEach((_, kind) => {
      const e = this.add
        .particles(0, 0, `panel-${kind}`, {
          speed: { min: 120, max: 320 },
          angle: { min: 230, max: 310 },
          gravityY: 500,
          lifespan: { min: 900, max: 1500 },
          scale: { start: 0.5 / DPR, end: 0.1 / DPR },
          alpha: { start: 1, end: 0 },
          rotate: { min: -360, max: 360 },
          emitting: false,
        })
        .setDepth(35);
      this.time.delayedCall(kind * 60, () => {
        e.explode(10, cx + (kind - 2.5) * 12, topY + BOARD_H * view.scale * 0.35);
        this.time.delayedCall(1800, () => e.destroy());
      });
    });
    this.flash(0.3);
  }

  override update(_time: number, delta: number): void {
    if (!this.paused && !this.ended && !this.starting) {
      this.accumulator += Math.min(delta, 250);
      let steps = 0;
      while (this.accumulator >= STEP_MS && steps < 6) {
        const inputs = this.inputs.map((p) => p.poll());
        this.stepOnce(inputs.length ? inputs : [NO_INPUT]);
        this.accumulator -= STEP_MS;
        steps++;
      }
      const danger = this.mode === "versus"
        ? this.game_.boards.some(musicDanger)
        : musicDanger(this.game_.boards[0]);
      if (danger !== this.wasDanger) {
        this.wasDanger = danger;
        audio.setDanger(danger);
      }
      if (this.game_.finished) this.finish();
    }
    // タイムアタックは残り時間、CPU戦は自分の高さで空色を変える。外周の警告は各盤面に出す。
    if (this.bg) {
      this.bg.setTimeRemaining(this.game_.framesLeft, !this.ended && !this.starting);
      this.bg.setStack(this.game_.boards[0], this.paused || this.starting ? 0 : delta, !this.ended && !this.starting);
      this.bg.update(this.paused || this.starting ? 0 : delta);
    }
    this.views.forEach((v) => v.draw(this.paused || this.starting ? 0 : delta, !this.ended));
    if (this.puzzleButtons) {
      const settled = this.game_.boards[0].isSettled();
      this.puzzleButtons.undo.setAlpha(settled && this.game_.puzzleMoves.length > 0 && this.game_.puzzleResult !== "clear" ? 1 : 0.4);
      this.puzzleButtons.redo.setAlpha(settled && !this.ended && this.game_.puzzleCanRedo ? 1 : 0.4);
      this.puzzleButtons.hint.setAlpha(settled && !this.ended ? 1 : 0.4);
      // 結果を出している間は目標を隠す（失敗から手を戻したらまた出す）
      this.puzzleGoal?.setVisible(!this.ended);
    }
    this.raiseHints.forEach((h, i) => {
      const b = this.game_.boards[i];
      h.setRaising(this.inputs[i]?.lastRaise ?? false, this.paused ? 0 : delta);
      h.setStop(b.gameOver ? 0 : b.stopTimer, b.stopTotal, b.stopPinch, this.paused ? 0 : delta);
    });
    if (this.ended) this.placeResultKeycap();
  }

  /** 結果を共有する。共有シートがなければクリップボードへコピーし、ボタンの文字で伝える。 */
  /** 計測に付ける細目。CPU の強さ（待機中の CPU 戦は /online 付き）、パズルの面、課の番号。 */
  private trackDetail(): string {
    if (this.mode === "cpu") return this.fromOnline ? `${this.cpuLevel}/online` : this.cpuLevel;
    if (this.mode === "puzzle") return String(this.stage + 1);
    if (this.mode === "lesson") return String(this.lesson + 1);
    return "";
  }

  /** 計測に付ける結果。 */
  private trackOutcome(): string {
    const g = this.game_;
    if (this.mode === "cpu") return g.winner < 0 ? "draw" : g.winner === 0 ? "win" : "lose";
    if (this.mode === "versus") return g.winner < 0 ? "draw" : `p${g.winner + 1}`;
    if (this.mode === "puzzle") return g.puzzleResult === "clear" ? "clear" : "failed";
    if (this.mode === "lesson") return g.lessonDone ? "clear" : "quit";
    if (this.mode === "timeattack") return g.timeUp ? "timeup" : "over";
    return "over";
  }

  private async share(button: { setText: (text: string) => unknown }): Promise<void> {
    track("share", { mode: this.mode, detail: "result" });
    const g = this.game_;
    const b = g.boards[0];
    let text: string;
    // URL は /r?… で、貼った先にこの結果のカードが出る（src/ogp/spec.ts）
    let result: ShareResult;
    if (this.mode === "endless" || this.mode === "timeattack") {
      text = `SWAPRISE  ${this.mode === "timeattack" ? "TIME ATTACK 2:00  " : ""}SCORE ${b.score}  MAX CHAIN x${b.maxChain}`;
      // 公開した記録なら Worker が順位を引いてカードに載せる。非公開・未送信なら id は D1 になく、URL の値だけで描かれる
      result = this.scoreRun ? { mode: this.mode, score: b.score, chain: b.maxChain, id: this.scoreRun.id } : { mode: this.mode, score: b.score, chain: b.maxChain };
    } else if (this.mode === "puzzle") {
      const clear = g.puzzleResult === "clear";
      text = `SWAPRISE  ${t("PUZZLE")} ${puzzleName(this.stage)}  ${clear ? t("CLEAR") : t("FAILED")}`;
      result = clear ? { mode: "puzzle", stage: puzzleName(this.stage), clear, left: b.movesLeft ?? 0 } : { mode: "puzzle", stage: puzzleName(this.stage), clear };
    } else if (this.mode === "lesson") {
      text = `SWAPRISE  ${t("LESSON {n} / {total}", { n: this.lesson + 1, total: LESSONS.length })}  ${t("CLEAR")}`;
      result = { mode: "lesson", n: this.lesson + 1, total: LESSONS.length };
    } else {
      const verdict: ShareVerdict = g.winner < 0 ? "draw" : g.winner === 0 ? "win" : "lose";
      const foe = this.mode === "cpu" ? `CPU ${this.cpuLevel.toUpperCase()}` : "2P";
      text = `SWAPRISE  ${{ draw: t("DRAW"), win: t("WIN"), lose: t("LOSE") }[verdict]} vs ${foe}  MAX CHAIN x${b.maxChain}`;
      result = this.mode === "cpu" ? { mode: "cpu", level: this.cpuLevel, result: verdict, chain: b.maxChain } : { mode: "versus", result: verdict, chain: b.maxChain };
    }
    const outcome = await shareText(text, result);
    button.setText(outcome === "copied" ? t("COPIED") : outcome === "failed" ? t("SHARE FAILED") : t("SHARE"));
  }

  private finish(): void {
    this.ended = true;
    this.pauseButton.setVisible(false);
    const g = this.game_;
    // 曲を止めて勝敗の音だけにする。危険状態のテンポはここで戻す（残すとメニューの曲まで速くなる）
    audio.stopBgm();
    audio.setDanger(false);
    this.wasDanger = false;
    // エンドレスと CPU に負けたときは負けの音、対戦は誰かが勝つので勝ちの音。タイムアタックは時間切れなら完走の音
    const humanWon =
      this.mode === "versus" ? g.winner >= 0 : this.mode === "cpu" ? g.winner === 0 : this.mode === "puzzle" ? g.puzzleResult === "clear" : this.mode === "lesson" ? g.lessonDone : g.timeUp;
    track("end", {
      mode: this.mode, detail: this.trackDetail(), outcome: this.trackOutcome(), seconds: Math.round((Date.now() - this.startedAt) / 1000),
      play: playFields({ board: g.boards[0], touch: this.touches[0], keys: this.inputs[0], touchDevice: this.layout.touch, portrait: this.layout.portrait }),
    });
    if (humanWon) {
      audio.win();
      haptics.win();
      if (this.mode !== "cpu" && this.mode !== "versus") this.celebrate(this.views[0]);
    } else {
      audio.lose();
      haptics.gameOver();
    }
    // エンドレス・タイムアタックの結果は HTML の結果画面に出す（seed などを指定したカスタムのエンドレスは盤面の結果だけ）
    const htmlResult = this.mode === "timeattack" || (this.mode === "endless" && this.scoreRun !== null);
    // 結果表示のあと、盤面の中をタップ（クリック）するとやり直す。自分の盤面には RETRY / MENU のボタンも出す
    this.resultTimer = this.time.delayedCall(800, () => {
      this.resultTimer = null;
      // HTML の結果画面にも RETRY / MENU があり、盤面のボタンはその下から透けて紛らわしいので置かない
      if (htmlResult) return;
      this.resultPointer = (p: Phaser.Input.Pointer): void => {
        if (this.touches.some((t) => t.cellAt(p.worldX, p.worldY))) this.restart();
      };
      this.input.on("pointerdown", this.resultPointer);
      // 主ボタンは 1 つ。次へ進む NEXT があればそれ、待機中の CPU 戦なら FIND MATCH、どちらもなければ RETRY
      const hasNext = (this.mode === "puzzle" && g.puzzleResult === "clear" && this.stage + 1 < PUZZLES.length) || (this.mode === "lesson" && g.lessonDone);
      // パズルの失敗は UNDO（盤面の下）を主ボタンにする。1 手戻して続けるほうが最初からより近い
      const puzzleFail = this.mode === "puzzle" && g.puzzleResult === "fail";
      if (puzzleFail) this.puzzleButtons?.undo.setPrimary(true);
      const retry = new Button(this, -46, BOARD_H / 2 - 40, t("RETRY"), () => this.restart(), { minWidth: 84, minHeight: 36, primary: !hasNext && !this.fromOnline && !puzzleFail }).setName("retry");
      const menu = this.fromOnline
        ? new Button(this, 46, BOARD_H / 2 - 40, t("FIND MATCH"), () => this.toFindMatch(), { minWidth: 84, minHeight: 36, primary: !hasNext }).setName("find-match")
        : new Button(this, 46, BOARD_H / 2 - 40, t("MENU"), () => this.toMenu(), { minWidth: 84, minHeight: 36 }).setName("menu");
      this.views[0].addToOverlay(retry);
      this.views[0].addToOverlay(menu);
      this.resultButtons.push(retry, menu);
      // レッスンの結果は共有しない（練習なので）。空いた場所に達成の一言と NEXT を置く
      if (canShare() && this.mode !== "lesson") {
        const share = new Button(this, 0, BOARD_H / 2 - 84, t("SHARE"), () => void this.share(share), { minWidth: 176, minHeight: 36 });
        this.views[0].addToOverlay(share);
        this.resultButtons.push(share);
      }
      // パズルをクリアしたら次の面へのボタン
      if (this.mode === "puzzle" && g.puzzleResult === "clear" && this.stage + 1 < PUZZLES.length) {
        const next = new Button(this, 0, BOARD_H / 2 - 128, t("NEXT  {name}", { name: puzzleName(this.stage + 1) }), () => this.nextStage(), { minWidth: 176, minHeight: 36, primary: true }).setName("next");
        this.views[0].addToOverlay(next);
      }
      // レッスンを終えたら次の課へ。最後の課ならエンドレスへ誘う
      if (this.mode === "lesson" && g.lessonDone) {
        const last = this.lesson + 1 >= LESSONS.length;
        // 達成の一言は最大 4 行（見出しの下 -8 から約 70px）なので、NEXT はその下の 100 に置く
        const next = new Button(this, 0, BOARD_H / 2 - 92, last ? t("PLAY ENDLESS") : t("NEXT LESSON"), () => {
          fullscreen.sync();
          if (last) this.scene.restart({ mode: "endless" } satisfies GameStart);
          else this.scene.restart({ mode: "lesson", lesson: this.lesson + 1 } satisfies GameStart);
        }, { minWidth: 176, minHeight: 36, primary: true }).setName("next");
        this.views[0].addToOverlay(next);
      }
    });
    if (this.mode === "lesson") {
      this.views[0].setHint(null);
      if (g.lessonDone) {
        recordLessonDone(this.lesson);
        this.views[0].showOverlay(t("NICE!"), lessonText(g.lesson!.id, this.layout.touch).done);
      } else {
        // せり上がる課で天井に届いた。達成ではないので記録せず、RETRY でやり直す
        this.views[0].showOverlay(t("GAME OVER"), t("The board reached the top. Try again and make a 2-chain."));
      }
    } else if (this.mode === "puzzle") {
      const b = g.boards[0];
      if (g.puzzleResult === "clear") {
        recordPuzzleClear(this.stage);
        // 残り手数は全部消した時点でいつも 0 なので出さず、どの面を解いたかと段の中の進み（1-1 なら 1/10）を出す。
        // クリアのあとは手を戻せない（Game.puzzleUndo が断る）ので、UNDO は押せない見た目にして当たり判定も外す
        this.views[0].showOverlay(t("CLEAR"), t("{name} CLEAR  {face}/{total}", { name: puzzleName(this.stage), face: (this.stage % PUZZLES_PER_STAGE) + 1, total: PUZZLES_PER_STAGE }));
        this.puzzleButtons?.undo.disableInteractive();
      } else {
        this.views[0].showOverlay(t("FAILED"), t("{count} PANELS LEFT", { count: b.panelCount() }));
      }
    } else if (this.mode === "endless" || this.mode === "timeattack") {
      const b = g.boards[0];
      // 0 点のプレイ（何も消さずに終わった回）は端末の記録にも公開の対象にもしない。
      // 残すと「初めての記録！」と出て公開を聞かれ、RECORDS の上位にも 0 点の行が並んでいた。結果画面はふつうに出す
      const counted = b.score > 0;
      const run = counted ? this.scoreRun : null;
      const progress = run ? recordProgress(this.mode, b.score, loadHighScores()[this.mode][0]?.score ?? null) : null;
      const rank = counted ? recordScore(this.mode, b.score, b.maxChain, new Date(), b.stats.swaps) : 0;
      // 公開の可否をまだ決めていなければ結果画面で聞く。enqueueScore は公開オンのときだけ積む
      const submission = run ? { ...run, mode: this.mode, score: b.score, maxChain: b.maxChain, frames: Math.min(b.frame, g.timeLimit ?? b.frame), swaps: b.stats.swaps } : null;
      if (submission) enqueueScore(submission);
      const rankLine = rank === 1 ? t("NEW RECORD!") : rank > 0 ? t("RANK {rank}", { rank }) : "";
      const newRecord = rank === 1 && b.score > 0;
      // 終わった瞬間は盤面に見出しと閃光を出し、新記録なら紙吹雪も撒く。結果画面はそのあと
      this.flash(0.35);
      if (newRecord) this.time.delayedCall(300, () => this.celebrate(this.views[0]));
      // タイムアタックの完走は通常の終わり方なので、結果画面には終了理由の見出しを出さず得点を主役にする。
      // 盤面には短く TIME UP を出して、時間で終わったことだけ伝える
      const title = g.timeUp ? null : t("GAME OVER");
      const boardTitle = g.timeUp ? t("TIME UP") : t("GAME OVER");
      if (!htmlResult) {
        this.views[0].showOverlay(boardTitle, `${t("SCORE")} ${b.score}\n${t("MAX CHAIN")} x${b.maxChain}\n${t("COMBOS")} ${b.stats.combos}  ${t("CHAINS")} ${b.stats.chains}\n${rankLine}`);
      } else {
        // 結果画面は同じ数字を大きく出すので、盤面には見出しだけを出す
        this.views[0].showOverlay(boardTitle, "");
        let shown = false;
        const showResult = (): void => {
          if (shown || !this.scene.isActive()) return;
          shown = true;
          window.clearTimeout(timer);
          this.events.off("shutdown", cancel);
          this.input.off("pointerdown", showResult);
          kb?.off("keydown", onKey);
          this.input.gamepad?.off("down", onPad);
          // 結果画面は半透明で、最後の盤面を暗幕なしで透かす
          this.views[0].hideOverlay();
          showScoreResult(this, {
            mode: this.mode as "endless" | "timeattack", title, score: b.score, chain: b.maxChain, combos: b.stats.combos, chains: b.stats.chains, swaps: b.stats.swaps,
            progress, id: run?.id ?? null, submission, retry: () => this.restart(), menu: () => this.toMenu(), celebrate: newRecord,
            share: canShare() ? (button) => { void this.share({ setText: (text) => { button.textContent = text; } }); } : undefined,
          });
        };
        // 待つ間にタップ・クリック・決定キー（Z / Space / Enter）を押したら、すぐ結果画面へ進める
        const kb = this.input.keyboard;
        const onKey = (e: KeyboardEvent): void => {
          if (e.code === "KeyZ" || e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") showResult();
        };
        kb?.on("keydown", onKey);
        // ゲームパッドは A（入れ替えと同じボタン）
        const onPad = (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button): void => {
          if (button.index === 0) showResult();
        };
        this.input.gamepad?.on("down", onPad);
        this.input.on("pointerdown", showResult);
        // 待ちは実時間で数える。Phaser の時計は重い端末でフレームが落ちると遅れ、結果画面が何秒も出なかった
        const timer = window.setTimeout(showResult, RESULT_DELAY_MS);
        const cancel = (): void => { shown = true; window.clearTimeout(timer); };
        this.events.once("shutdown", cancel);
      }
    } else {
      let recordLine = "";
      // 待機中の CPU 戦は VS CPU の記録に混ぜない
      if (this.mode === "cpu" && g.winner >= 0 && !this.fromOnline) {
        const r = recordCpuResult(this.cpuLevel, g.winner === 0);
        recordLine = `\n${t("VS CPU")} ${this.cpuLevel.toUpperCase()}  ${r.wins}W ${r.losses}L`;
      }
      // 同じフレームで両方が天井に届いたら引き分け
      const draw = g.winner < 0;
      g.boards.forEach((b, i) => {
        const won = g.winner === i;
        if (!draw) this.views[i].playResult(won ? "win" : "lose");
        this.views[i].showOverlay(draw ? t("DRAW") : won ? t("WIN") : t("LOSE"), `${t("MAX CHAIN")} x${b.maxChain}\n${t("COMBOS")} ${b.stats.combos}  ${t("CHAINS")} ${b.stats.chains}${i === 0 ? recordLine : ""}`);
      });
    }
  }
}
