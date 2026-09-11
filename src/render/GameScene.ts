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
import { applyLayout } from "./hidpi";
import { Button } from "./ui";
import { wakeLock } from "./wakelock";
import { fullscreen } from "./fullscreen";
import { canShare, shareText } from "./share";
import { BOARD_H, BOARD_W, FONT, TEXT_COLOR, type Layout, layoutFor, sameLayout } from "./theme";
import { CharacterView } from "./CharacterView";
import { characterById, isCharacterId, loadSelection } from "../characters/catalog";
import { t } from "./i18n";
import { eligibleRun } from "../scores/model";
import { enqueueScore, publication } from "../scores/client";
import { showPlayerSettings } from "./score-dialog";

const STEP_MS = 1000 / 60;
/** 縦持ちの CPU 対戦で、CPU の盤面を描く大きさ。 */
const CPU_BOARD_SCALE = 0.5;

export interface GameStart {
  mode: GameMode;
  cpuLevel?: CpuLevel;
  stage?: number;
  /** 対戦（CPU・2 PLAYERS）で表示する人物。1P と 2P（CPU）の順。 */
  characters?: [string, string];
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export class GameScene extends Phaser.Scene {
  private game_!: Game;
  views: BoardView[] = [];
  private inputs: PlayerInput[] = [];
  touches: TouchInput[] = [];
  private raiseHints: Phaser.GameObjects.Text[] = [];
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
  private ended = false;
  /** 開始のカウントダウン中か。この間はゲームを進めない。 */
  starting = false;
  private wasDanger = false;
  /** ゲーム用に履歴を積んでいるか。メニューへ戻るときに1つ戻して消す。 */
  private historyPushed = false;
  /** 対戦で表示する人物。盤面と同じ順。1人用のモードでは空。 */
  characters: CharacterView[] = [];
  private characterIds: [string, string] | null = null;
  private scoreRun: { id: string; seed: number } | null = null;

  constructor() {
    super("game");
  }

  create(data: GameStart): void {
    this.mode = data.mode ?? "endless";
    this.cpuLevel = data.cpuLevel ?? "normal";
    this.stage = Math.max(0, Math.min(PUZZLES.length - 1, data.stage ?? 0));
    this.characters.forEach((c) => c.destroy());
    this.characters = [];
    // 人物は対戦（CPU・2 PLAYERS）だけ。指定がなければ前回の選択
    if (this.mode === "cpu" || this.mode === "versus") {
      const saved = loadSelection();
      const ids = data.characters ?? [saved.p1, saved.p2];
      this.characterIds = [isCharacterId(ids[0]) ? ids[0] : saved.p1, isCharacterId(ids[1]) ? ids[1] : saved.p2];
      // 相手側（2P・CPU）は左右を反転して、自分側と向かい合わせる
      this.characters = this.characterIds.map((id, i) => new CharacterView(this, characterById(id), { flip: i === 1 }));
    } else this.characterIds = null;
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
      this.vsText = this.add.text(0, 0, "VS", { fontFamily: FONT, fontSize: "28px", color: "#9a9ab0" }).setOrigin(0.5);
    }

    // タッチは横ドラッグ、マウスはクリック・横ドラッグで入れ替え。CPU の盤面は触れない。
    boards.forEach((b, i) => {
      if (!this.inputs[i]) return;
      const t = new TouchInput(this, b);
      this.touches.push(t);
      this.inputs[i].touch = t;
      this.views[i].touch = t;
    });
    // 盤面の下の「▲ ▲ ▲」。押している間は手動せり上げで、せり上げ中（ボタン・2本指・キー・ゲームパッド）は明るくなる。
    // 当たり判定は余白（padding）で指の大きさ（44dp 以上）まで広げる。盤面の外の余白ならどこでもせり上がる操作は
    // 誤タップが多かったので外してあり、押せるのはこのボタンの範囲だけ
    this.raiseHints = boards.map((_, i) => {
      const hint = this.add
        .text(0, 0, "▲ ▲ ▲", { fontFamily: FONT, fontSize: "16px", color: "#3a3a4c" })
        .setPadding(30, 14)
        .setOrigin(0.5)
        .setVisible(Boolean(this.inputs[i]) && this.mode !== "puzzle");
      hint.setInteractive({ useHandCursor: true });
      hint.on("pointerdown", (p: Phaser.Input.Pointer) => {
        if (this.ended || this.paused) return;
        this.touches[i]?.holdRaise(p.id);
      });
      return hint;
    });

    // 画面上のポーズボタン
    this.pauseButton = new Button(this, 0, 0, "❚❚", () => this.togglePause(), { minWidth: 44, minHeight: 30, fontSize: 13 }).setDepth(5);

    // ポーズ画面。暗幕をタップしても再開する。ボタンで やり直し・音・振動・メニュー
    this.pauseDim = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.7).setOrigin(0);
    this.pauseTitle = this.add.text(0, 0, t("PAUSE"), { fontFamily: FONT, fontSize: "32px", color: TEXT_COLOR, fontStyle: "bold" }).setOrigin(0.5);
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
    });
    // キーボード向けの案内。タッチ端末では出さない（ボタンがある）
    this.hintText = this.add
      .text(0, 0, t("P: pause   R: restart   Esc: menu   M: mute"), { fontFamily: FONT, fontSize: "12px", color: "#6a6a80" })
      .setOrigin(0.5);

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
    this.place();
    (window as unknown as { __swaprise: { layout: Layout } }).__swaprise.layout = next;
  }

  /** 現在のレイアウトに合わせて、盤面と UI の位置を決める。 */
  private place(): void {
    const L = this.layout;
    const W = L.width;
    const H = L.height;
    const boards = this.game_.boards;
    const top = L.phoneLandscape ? 14 : L.portrait ? 52 : 70;
    const placeBoard = (i: number, ox: number, oy: number, scale: number, hud: HudSide = "top"): void => {
      this.views[i].place(ox, oy, scale, hud);
      this.touches[i]?.place(ox, oy, scale);
      // せり上げの矢印。HUD が上なら盤面の下、横なら HUD の下
      if (hud === "top") this.raiseHints[i].setPosition(ox + (BOARD_W / 2) * scale, oy + BOARD_H * scale + (L.portrait ? 44 : 34));
      else if (hud === "right") this.raiseHints[i].setPosition(ox + BOARD_W + 12 + 50, oy + 150);
      else this.raiseHints[i].setPosition(ox - 12 - 50, oy + 150);
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
        // 人物は中央の下段、ポーズボタンの上に2人並べる。左右の HUD（得点・予告）は上段なので重ならない
        const h = clamp((W - 2 * (edge + BOARD_W) - 20) / 2, 70, 120);
        this.characters[0]?.place(W / 2 - h * 0.45, H - 50, h);
        this.characters[1]?.place(W / 2 + h * 0.45, H - 50, h);
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
      // 人物は CPU の盤面の下の列に、上が CPU・下が自分。盤面と ▲ ▲ ▲ を狭めない
      const colX = ox1 + BOARD_W + gap + cpuW / 2;
      const colTop = top + BOARD_H * CPU_BOARD_SCALE + 26;
      const avail = H - 8 - colTop;
      const cpuH = clamp(avail * 0.36, 56, 110);
      const meH = clamp(avail * 0.5, 64, 150);
      this.characters[1]?.place(colX, colTop + cpuH, cpuH, cpuW);
      this.characters[0]?.place(colX, Math.min(H - 14, colTop + cpuH + 16 + meH), meH, cpuW);
    } else {
      const gap = L.portrait ? 20 : 120;
      const ox1 = Math.floor(W / 2 - gap / 2 - BOARD_W);
      const ox2 = Math.floor(W / 2 + gap / 2);
      placeBoard(0, ox1, top, 1);
      placeBoard(1, ox2, top, 1);
      this.vsText?.setPosition(W / 2, top + BOARD_H / 2).setFontSize(L.portrait ? 18 : 28).setVisible(true);
      if (L.portrait) {
        // 縦持ちの 2P 対戦。盤面の横に余白がないので、▲ ▲ ▲ の下の段に2人を小さく並べる
        const h = clamp(H - top - BOARD_H - 76 - 10, 44, 150);
        this.characters[0]?.place(W / 2 - 60, H - 10, h);
        this.characters[1]?.place(W / 2 + 60, H - 10, h);
      } else {
        // PC。盤面の左右の余白に、床を盤面の下端に揃えて置く
        const h = clamp(ox1 - 8, 100, 220);
        this.characters[0]?.place(ox1 / 2, top + BOARD_H, h);
        this.characters[1]?.place(ox2 + BOARD_W + (W - ox2 - BOARD_W) / 2, top + BOARD_H, h);
      }
    }
    // ポーズボタンは自分の盤面の右上（得点表示の右）。横持ちのスマホは上で決めた
    if (!L.phoneLandscape) this.pauseButton.setPosition(this.views[0].ox + BOARD_W - 22, top - 24);

    this.pauseDim.setSize(W, H);
    this.pauseTitle.setPosition(W / 2, H / 2 - 40 - this.pauseButtons.length * 23 - 20);
    this.pauseButtons.forEach((b, i) => b.setPosition(W / 2, H / 2 - (this.pauseButtons.length - 1) * 23 + i * 46));

    this.hintText.setPosition(W / 2, H - 14).setVisible(!L.touch);
  }

  /** 3・2・1・START のカウントダウン。各盤面の中央に出す。START でゲームが動き出し、BGM が始まる。 */
  private runCountdown(): void {
    this.starting = true;
    const texts = this.views.map((v) =>
      this.add
        .text(v.center.x, v.center.y, "", { fontFamily: FONT, fontSize: "64px", color: "#ffe066", fontStyle: "bold", stroke: "#1a1a2a", strokeThickness: 8 })
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

  /** やり直し。対戦の人物はそのまま引き継ぐ。 */
  private restart(): void {
    fullscreen.sync();
    this.scene.restart({ mode: this.mode, cpuLevel: this.cpuLevel, stage: this.stage, characters: this.characterIds ?? undefined } satisfies GameStart);
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
      // 人物の反応。連鎖・大きな同時消しで成功、自分の盤面へのおじゃま着地で着地。相手の連鎖には反応しない
      const c = this.characters[i];
      if (!c) return;
      for (const e of b.events) {
        if (e.type === "match" && (e.chain >= 2 || e.panels >= 4)) c.react("success");
        else if (e.type === "garbageLand") c.react("garbage-land");
      }
    });
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
      // 人物のピンチは盤面ごと。曲の判定（自分だけ・どちらか）とは別に、それぞれの盤面を見る
      this.characters.forEach((c, i) => c.setDanger(musicDanger(this.game_.boards[i])));
      if (this.game_.finished) this.finish();
    }
    if (!this.paused) this.characters.forEach((c) => c.update(delta));
    this.views.forEach((v) => v.draw());
    this.raiseHints.forEach((h, i) => {
      const on = this.inputs[i]?.lastRaise ?? false;
      h.setColor(on ? "#dcdcea" : "#3a3a4c");
    });
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
      this.views[0].showOverlay(g.timeUp ? t("TIME UP") : t("GAME OVER"), `${t("SCORE")} ${b.score}\n${t("MAX CHAIN")} x${b.maxChain}\n${t("COMBOS")} ${b.stats.combos}  ${t("CHAINS")} ${b.stats.chains}\n${rankLine}`);
      if (this.scoreRun && progress) showScoreResult(this, {
        mode: this.mode, title: g.timeUp ? t("TIME UP") : t("GAME OVER"), score: b.score, chain: b.maxChain,
        progress, id: this.scoreRun.id, retry: () => this.restart(), menu: () => this.toMenu(),
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
        this.views[i].showOverlay(draw ? t("DRAW") : won ? t("WIN") : t("LOSE"), `${t("MAX CHAIN")} x${b.maxChain}\n${t("COMBOS")} ${b.stats.combos}  ${t("CHAINS")} ${b.stats.chains}${i === 0 ? recordLine : ""}`);
        // 結果の動作は途中の反応より優先し、最後の姿勢を保つ。再戦の操作は待たない
        this.characters[i]?.setResult(draw ? "finish" : won ? "victory" : "defeat");
      });
    }
  }
}
