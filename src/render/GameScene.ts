import Phaser from "phaser";
import { Game, PUZZLES, puzzleName, type CpuLevel, type GameMode, type Input, NO_INPUT } from "../core";
import { loadHighScores, recordCpuResult, recordPuzzleClear, recordScore } from "./highscore";
import { recordProgress } from "../scores/progress";
import { showScoreResult } from "./score-result";
import { BoardView, type HudSide } from "./BoardView";
import { P1_KEYS, P2_KEYS, PlayerInput } from "./input";
import { audio } from "./shared";
import { musicDanger } from "./musicDanger";
import { haptics } from "./haptics";
import { TouchInput } from "./touch";
import { DPR, applyLayout } from "./hidpi";
import { Button } from "./ui";
import { RaiseBar } from "./RaiseBar";
import { wakeLock } from "./wakelock";
import { fullscreen } from "./fullscreen";
import { canShare, shareText } from "./share";
import { BOARD_H, BOARD_W, FONT, FONT_UI, TEXT_COLOR, TEXT_DIM, KIND_COLORS, type Layout, layoutFor, sameLayout } from "./theme";
import { Background } from "./Background";
import { t } from "./i18n";
import { backHintDuration } from "./backHint";
import { eligibleRun } from "../scores/model";

/** せり上げバーの高さ（タッチ端末・マウス）と、盤面の下端からの間隔。残り時間の行（BOARD_H + 14 から 13px）の下に入れる。 */
const RAISE_BAR_H = 30;
const RAISE_BAR_H_MOUSE = 22;
/** 盤面の下端からせり上げバーまでの隙間。停止時間の青い線（盤面の下 6〜10px）を避ける */
const RAISE_BAR_GAP = 12;
/** せり上げバーの下端から時間などの行までの隙間 */
const INFO_GAP = 8;
import { enqueueScore, publication } from "../scores/client";
import { showPlayerSettings } from "./score-dialog";

const STEP_MS = 1000 / 60;
/** 縦持ちの CPU 対戦で、CPU の盤面を描く大きさ。 */
const CPU_BOARD_SCALE = 0.5;

export interface GameStart {
  mode: GameMode;
  cpuLevel?: CpuLevel;
  stage?: number;
}

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
  /** パズルの面（0 始まり）。 */
  private stage = 0;
  layout!: Layout;
  private vsText: Phaser.GameObjects.Text | null = null;
  private pauseButton!: Button;
  /** ポーズ画面。暗幕・見出し・ボタンをまとめた Container。 */
  pauseMenu!: Phaser.GameObjects.Container;
  private pauseDim!: Phaser.GameObjects.Rectangle;
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
    this.stage = Math.max(0, Math.min(PUZZLES.length - 1, data.stage ?? 0));
    const params = new URLSearchParams(location.search);
    const seed = Number(params.get("seed")) || (Date.now() & 0xffffff);
    this.scoreRun = eligibleRun(this.mode, params) ? { id: crypto.randomUUID(), seed } : null;
    const speedLevel = Number(params.get("speed")) || 1;
    const shockMax = params.has("shock") ? Number(params.get("shock")) || 0 : undefined;
    // ?time=秒 でタイムアタックの制限時間を変える（e2e 用）
    const timeLimitFrames = Number(params.get("time")) > 0 ? Math.round(Number(params.get("time")) * 60) : undefined;
    this.game_ = new Game({ mode: this.mode, seed, speedLevel, cpuLevel: this.cpuLevel, shockMax, timeLimitFrames, stage: this.stage });
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
    this.bg = new Background(this, this.layout.width, this.layout.height, this.mode);
    this.bg.setTimeRemaining(this.game_.framesLeft, false);

    const boards = this.game_.boards;
    if (this.mode === "puzzle") {
      this.views.push(new BoardView(this, boards[0], `${t("PUZZLE")} ${puzzleName(this.stage)}`, false, null, true));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      this.vsText = null;
    } else if (boards.length === 1) {
      this.views.push(new BoardView(this, boards[0], "1P", true, this.game_.timeLimit));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      this.vsText = null;
    } else {
      const isCpu = this.mode === "cpu";
      this.views.push(new BoardView(this, boards[0], "1P", true));
      this.views.push(new BoardView(this, boards[1], isCpu ? `${t("VS CPU")} ${this.cpuLevel.toUpperCase()}` : "2P", false));
      this.inputs.push(new PlayerInput(this, P1_KEYS, 0));
      if (!isCpu) this.inputs.push(new PlayerInput(this, P2_KEYS, 1));
      this.vsText = this.add.text(0, 0, "VS", { fontFamily: FONT_UI, fontSize: "28px", fontStyle: "700", color: TEXT_DIM }).setOrigin(0.5);
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
      }).setVisible(Boolean(this.inputs[i]) && this.mode !== "puzzle"),
    );

    // 画面上のポーズボタン
    this.pauseButton = new Button(this, 0, 0, "❚❚", () => this.togglePause(), { minWidth: 44, minHeight: 30, fontSize: 13 }).setDepth(5);

    // ポーズ画面。暗幕をタップしても再開する。ボタンで やり直し・音・振動・メニュー
    this.pauseDim = this.add.rectangle(0, 0, 10, 10, 0x1a1030, 0.78).setOrigin(0);
    this.pauseTitle = this.add.text(0, 0, t("PAUSE"), { fontFamily: FONT_UI, fontSize: "36px", color: TEXT_COLOR, fontStyle: "700" }).setOrigin(0.5);
    const soundLabel = (): string => t("SOUND: {state}", { state: t(audio.muted ? "OFF" : "ON") });
    const vibLabel = (): string => t("VIBRATION: {state}", { state: t(haptics.enabled ? "ON" : "OFF") });
    this.pauseButtons.push(new Button(this, 0, 0, t("RESUME"), () => this.setPaused(false), { minWidth: 180, minHeight: 40 }));
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
    this.pauseMenu = this.add.container(0, 0, [this.pauseDim, this.pauseTitle, ...this.pauseButtons]).setDepth(30).setVisible(false);
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
    history.pushState({ swaprise: "game" }, "");
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
      .text(0, 0, t("P: pause   R: restart   Esc: menu   M: mute"), { fontFamily: FONT_UI, fontSize: "12px", color: "rgba(255,255,255,0.55)" })
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

    const start = (): void => {
      if (params.get("countdown") === "0") this.beginPlay();
      else this.runCountdown();
    };
    if (this.scoreRun && publication() === null) {
      this.starting = true;
      showPlayerSettings(this, true, start);
    } else start();
  }

  /** 画面の向きやサイズが変わったとき。レイアウトが変わるなら置き直す。ゲームの進行はそのまま。 */
  private relayout(): void {
    const next = layoutFor(this.mode);
    if (sameLayout(next, this.layout)) return;
    this.layout = next;
    applyLayout(this, next);
    this.bg?.destroy();
    this.bg = new Background(this, next.width, next.height, this.mode);
    this.bg.setTimeRemaining(this.game_.framesLeft, !this.ended && !this.starting);
    this.bg.setStack(this.game_.boards[0], 0, !this.ended && !this.starting);
    this.place();
    (window as unknown as { __swaprise: { layout: Layout } }).__swaprise.layout = next;
  }

  /** 現在のレイアウトに合わせて、盤面と UI の位置を決める。 */
  private place(): void {
    const L = this.layout;
    const W = L.width;
    const H = L.height;
    const boards = this.game_.boards;
    // デスクトップは盤面の下にせり上げバーと操作の案内文が並ぶので、上端を詰めて高さ 520 に収める
    const top = L.phoneLandscape ? 14 : L.portrait ? 52 : 62;
    const barH = L.touch ? RAISE_BAR_H : RAISE_BAR_H_MOUSE;
    const placeBoard = (i: number, ox: number, oy: number, scale: number, hud: HudSide = "top"): void => {
      // せり上げバーは操作の要なので盤面の直下に置き、時間・速度・最大連鎖の行はその下。バーのない盤面（CPU・パズル）は行を盤面の直下に戻す
      const hasBar = this.raiseHints[i].visible;
      this.views[i].place(ox, oy, scale, hud, hasBar ? BOARD_H + (RAISE_BAR_GAP + barH + INFO_GAP) / scale : undefined);
      this.touches[i]?.place(ox, oy, scale);
      // せり上げバー。HUD が上なら盤面の直下に盤面と同じ幅で、横なら HUD の列に置く。
      // 当たり判定は指の大きさ（44dp）まで上下に広げる
      if (hud === "top") {
        this.raiseHints[i].resize(BOARD_W * scale, barH, 48).setPosition(ox + (BOARD_W / 2) * scale, oy + BOARD_H * scale + RAISE_BAR_GAP + barH / 2);
      } else {
        this.raiseHints[i].resize(100, 44, 48);
        if (hud === "right") this.raiseHints[i].setPosition(ox + BOARD_W + 12 + 50, oy + 150);
        else this.raiseHints[i].setPosition(ox - 12 - 50, oy + 150);
      }
    };
    if (L.phoneLandscape) {
      // 横持ちのスマホ。盤面を高さいっぱいに描き、得点などは盤面の横に置く。
      // 2P 対戦は盤面を左右の端に寄せ、2人が片方ずつ持って遊べるようにする。CPU 対戦も同じ並び
      const edge = 40; // Android の戻るジェスチャ領域（約 24dp）を避ける
      if (boards.length === 1) {
        const ox = Math.floor((W - BOARD_W) / 2);
        placeBoard(0, ox, top, 1, "right");
        // ポーズボタンは HUD の列の下のほう
        this.pauseButton.setPosition(ox + BOARD_W + 12 + 50, top + 220);
      } else {
        placeBoard(0, edge, top, 1, "right");
        placeBoard(1, W - edge - BOARD_W, top, 1, "left");
        this.vsText?.setPosition(W / 2, H / 2 - 40).setFontSize(22).setVisible(true);
        // ポーズボタンは画面の中央下。2P でもどちらからも届く
        this.pauseButton.setPosition(W / 2, H - 26);
      }
    } else if (boards.length === 1) {
      placeBoard(0, Math.floor((W - BOARD_W) / 2), top, 1);
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
      if (L.portrait) this.vsText?.setPosition(W / 2, top + BOARD_H + RAISE_BAR_GAP + barH + INFO_GAP + 40).setFontSize(18).setVisible(true);
      else this.vsText?.setPosition(W / 2, top + BOARD_H / 2).setFontSize(28).setVisible(true);
    }
    // ポーズボタンは自分の盤面の右上（得点表示の右）。横持ちのスマホは上で決めた
    if (!L.phoneLandscape) this.pauseButton.setPosition(this.views[0].ox + BOARD_W - 22, top - 24);

    this.pauseDim.setSize(W, H);
    this.pauseTitle.setPosition(W / 2, H / 2 - 40 - this.pauseButtons.length * 23 - 20);
    this.pauseButtons.forEach((b, i) => b.setPosition(W / 2, H / 2 - (this.pauseButtons.length - 1) * 23 + i * 46));

    this.hintText.setPosition(W / 2, H - 10).setVisible(!L.touch);
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
        .text(v.center.x, v.center.y, "", { fontFamily: FONT_UI, fontSize: "64px", color: "#ffe066", fontStyle: "700", stroke: "#3a1a5a", strokeThickness: 8 })
        .setOrigin(0.5)
        .setScale(v.scale)
        .setDepth(40),
    );
    const show = (label: string, big: boolean): void => {
      texts.forEach((text, i) => text.setText(label).setScale((big ? 1.8 : 1.5) * this.views[i].scale).setAlpha(1));
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

  /** やり直し。 */
  private restart(): void {
    fullscreen.sync();
    this.scene.restart({ mode: this.mode, cpuLevel: this.cpuLevel, stage: this.stage } satisfies GameStart);
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
    this.game_.boards.forEach((b, i) => {
      this.views[i].handleEvents(b.events, true, Boolean(this.inputs[i]));
      // 自分の盤面の大きな連鎖は画面ごと揺らし、5 連鎖からは閃光も足す
      if (!this.inputs[i]) return;
      for (const e of b.events) {
        if (e.type !== "match" || e.chain < 3) continue;
        this.cameras.main.shake(120 + e.chain * 15, 0.0015 + Math.min(0.006, e.chain * 0.0006));
        if (e.chain >= 5) this.flash(Math.min(0.5, 0.15 + e.chain * 0.04));
      }
    });
  }

  /** 画面全体の白い閃き。大きな連鎖と勝利で使う */
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
    this.raiseHints.forEach((h, i) => h.setRaising(this.inputs[i]?.lastRaise ?? false, this.paused ? 0 : delta));
  }

  /** 結果を共有する。共有シートがなければクリップボードへコピーし、ボタンの文字で伝える。 */
  private async share(button: { setText: (text: string) => unknown }): Promise<void> {
    const g = this.game_;
    const b = g.boards[0];
    let text: string;
    if (this.mode === "endless") {
      text = `SWAPRISE  SCORE ${b.score}  MAX CHAIN x${b.maxChain}`;
    } else if (this.mode === "timeattack") {
      text = `SWAPRISE  TIME ATTACK 2:00  SCORE ${b.score}  MAX CHAIN x${b.maxChain}`;
    } else if (this.mode === "puzzle") {
      text = `SWAPRISE  ${t("PUZZLE")} ${puzzleName(this.stage)}  ${g.puzzleResult === "clear" ? t("CLEAR") : t("FAILED")}`;
    } else {
      const result = g.winner < 0 ? t("DRAW") : g.winner === 0 ? t("WIN") : t("LOSE");
      const foe = this.mode === "cpu" ? `CPU ${this.cpuLevel.toUpperCase()}` : "2P";
      text = `SWAPRISE  ${result} vs ${foe}  MAX CHAIN x${b.maxChain}`;
    }
    const outcome = await shareText(text);
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
      this.mode === "versus" ? g.winner >= 0 : this.mode === "cpu" ? g.winner === 0 : this.mode === "puzzle" ? g.puzzleResult === "clear" : g.timeUp;
    if (humanWon) {
      audio.win();
      haptics.win();
      if (this.mode !== "cpu" && this.mode !== "versus") this.celebrate(this.views[0]);
    } else {
      audio.lose();
      haptics.gameOver();
    }
    // 結果表示のあと、盤面の中をタップ（クリック）するとやり直す。自分の盤面には RETRY / MENU のボタンも出す
    this.time.delayedCall(800, () => {
      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (this.touches.some((t) => t.cellAt(p.worldX, p.worldY))) this.restart();
      });
      const retry = new Button(this, -46, BOARD_H / 2 - 40, t("RETRY"), () => this.restart(), { minWidth: 84, minHeight: 36 });
      const menu = new Button(this, 46, BOARD_H / 2 - 40, t("MENU"), () => this.toMenu(), { minWidth: 84, minHeight: 36 });
      this.views[0].addToOverlay(retry);
      this.views[0].addToOverlay(menu);
      if (canShare()) {
        const share = new Button(this, 0, BOARD_H / 2 - 84, t("SHARE"), () => void this.share(share), { minWidth: 176, minHeight: 36 });
        this.views[0].addToOverlay(share);
      }
      // パズルをクリアしたら次の面へのボタン
      if (this.mode === "puzzle" && g.puzzleResult === "clear" && this.stage + 1 < PUZZLES.length) {
        const next = new Button(this, 0, BOARD_H / 2 - 128, t("NEXT  {name}", { name: puzzleName(this.stage + 1) }), () => this.nextStage(), { minWidth: 176, minHeight: 36 }).setName("next");
        this.views[0].addToOverlay(next);
      }
    });
    if (this.mode === "puzzle") {
      const b = g.boards[0];
      if (g.puzzleResult === "clear") {
        recordPuzzleClear(this.stage);
        this.views[0].showOverlay(t("CLEAR"), t("MOVES LEFT {count}", { count: b.movesLeft ?? 0 }));
      } else {
        this.views[0].showOverlay(t("FAILED"), t("{count} PANELS LEFT", { count: b.panelCount() }));
      }
    } else if (this.mode === "endless" || this.mode === "timeattack") {
      const b = g.boards[0];
      const progress = this.scoreRun ? recordProgress(this.mode, b.score, loadHighScores()[this.mode][0]?.score ?? null) : null;
      const rank = recordScore(this.mode, b.score, b.maxChain);
      if (this.scoreRun) enqueueScore({ ...this.scoreRun, mode: this.mode, score: b.score, maxChain: b.maxChain, frames: Math.min(b.frame, g.timeLimit ?? b.frame) });
      const rankLine = rank === 1 ? t("NEW RECORD!") : rank > 0 ? t("RANK {rank}", { rank }) : "";
      if (rank === 1 && b.score > 0) this.time.delayedCall(300, () => this.celebrate(this.views[0]));
      // タイムアタックの完走は通常の終わり方なので、終了理由の見出しを出さず得点を主役にする。
      const title = g.timeUp ? null : t("GAME OVER");
      this.views[0].showOverlay(title ?? "", `${t("SCORE")} ${b.score}\n${t("MAX CHAIN")} x${b.maxChain}\n${t("COMBOS")} ${b.stats.combos}  ${t("CHAINS")} ${b.stats.chains}\n${rankLine}`);
      if (this.mode === "timeattack" || this.scoreRun) showScoreResult(this, {
        mode: this.mode, title, score: b.score, chain: b.maxChain, combos: b.stats.combos, chains: b.stats.chains,
        progress, id: this.scoreRun?.id ?? null, retry: () => this.restart(), menu: () => this.toMenu(),
        share: canShare() ? (button) => { void this.share({ setText: (text) => { button.textContent = text; } }); } : undefined,
      });
    } else {
      let recordLine = "";
      if (this.mode === "cpu" && g.winner >= 0) {
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
