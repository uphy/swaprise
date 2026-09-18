import Phaser from "phaser";
import { showRecordsDialog, showPlayerSettings } from "./score-dialog";
import { ACCENT, FONT, FONT_UI, TEXT_COLOR, TEXT_MUTE, layoutFor, menuTitle, sameLayout } from "./theme";
import { MenuCard, paintGlass } from "./menuCard";
import { TITLE_ICON_KINDS, TitleArt } from "./title";
import { createMenuIcons, type MenuIcon } from "./menuIcons";
import { Background } from "./Background";
import { createTextures } from "./textures";
import { LESSONS, PUZZLES, PUZZLES_PER_STAGE, PUZZLE_STAGES, puzzleName, type CpuLevel, type GameMode } from "../core";
import { audio } from "./shared";
import { loadHighScores, onlineRecordLine, type HighScores } from "./highscore";
import { haptics } from "./haptics";
import { DPR, applyLayout } from "./hidpi";
import { Button } from "./ui";
import { fullscreen } from "./fullscreen";
import { loadLastMode, saveLastMode } from "./lastmode";
import { applyPendingUpdate } from "./update";
import type { GameStart } from "./GameScene";
import { t } from "./i18n";

/** メニューの1項目。start があれば選ぶとゲームが始まる。group があれば下位メニューを開く。 */
interface MenuItem {
  label: string;
  /** ラベルの下に添える小文字（中身の説明や記録）。 */
  caption: string;
  group?: Level;
  start?: { mode: GameMode; cpuLevel?: CpuLevel };
  back?: boolean;
  online?: boolean;
  name: string;
  /** カードの縁の色。 */
  color: number;
  /** ラベルの右のアイコン。 */
  icon?: MenuIcon;
}

/** 半幅のカード（2 PLAYERS・ONLINE）は説明が 2 行になるので、この分だけ高くする */
const HALF_EXTRA = 12;

/** カードの縁の色。1 PLAYER は金、CPU は水色、2 PLAYERS は橙、ONLINE は緑。下位の項目は柄の色を順に使う */
const CARD = { gold: 0xffe066, cyan: 0x6fd6ff, orange: 0xffa14a, green: 0x8de76a, violet: 0xc9a2ff, red: 0xff6f7a } as const;

/** メニューの階層。top は 1 PLAYER / VS CPU / 2 PLAYERS、1p と cpu はその下位。 */
type Level = "top" | "1p" | "cpu";

const GROUP_LABEL: Record<Level, string> = { top: "", "1p": t("1 PLAYER"), cpu: t("VS CPU") };

/** `?stage=2-3` または 1 始まりの通し番号を 0 始まりの番号にする。なければ 0。 */
function parseStageParam(raw: string | null): number {
  if (!raw) return 0;
  const m = /^(\d+)-(\d+)$/.exec(raw);
  const index = m ? (Number(m[1]) - 1) * PUZZLES_PER_STAGE + (Number(m[2]) - 1) : Number(raw) - 1;
  if (!Number.isInteger(index)) return 0;
  return Math.max(0, Math.min(PUZZLES.length - 1, index));
}


function bestLine(list: HighScores["endless"]): string {
  const best = list[0];
  return best ? t("BEST {score}   MAX CHAIN x{chain}", { score: String(best.score).padStart(6, "0"), chain: best.maxChain }) : t("no record yet");
}

/** 階層ごとの項目。記録は開くたびに読み直すので、ここで組み立てる。 */
function itemsFor(level: Level, hs: HighScores): MenuItem[] {
  if (level === "1p") {
    return [
      { label: t("ENDLESS"), caption: bestLine(hs.endless), start: { mode: "endless" }, name: "item-endless", color: CARD.gold },
      { label: t("TIME ATTACK"), caption: bestLine(hs.timeattack), start: { mode: "timeattack" }, name: "item-timeattack", color: CARD.cyan },
      { label: t("PUZZLE"), caption: t("{count} / {total} CLEARED", { count: hs.puzzle.length, total: PUZZLES.length }), start: { mode: "puzzle" }, name: "item-puzzle", color: CARD.green },
      {
        label: t("LEARN"),
        caption: hs.lessons.length >= LESSONS.length ? t("all {total} lessons done", { total: LESSONS.length }) : t("{count} / {total} LESSONS", { count: hs.lessons.length, total: LESSONS.length }),
        start: { mode: "lesson" },
        name: "item-learn",
        color: CARD.violet,
      },
      { label: t("◂ BACK"), caption: "", back: true, name: "item-back", color: CARD.gold },
    ];
  }
  if (level === "cpu") {
    const rec = (l: CpuLevel): string => t("{wins}W {losses}L", { wins: hs.cpu[l].wins, losses: hs.cpu[l].losses });
    return [
      { label: t("EASY"), caption: rec("easy"), start: { mode: "cpu", cpuLevel: "easy" }, name: "item-easy", color: CARD.green },
      { label: t("NORMAL"), caption: rec("normal"), start: { mode: "cpu", cpuLevel: "normal" }, name: "item-normal", color: CARD.gold },
      { label: t("HARD"), caption: rec("hard"), start: { mode: "cpu", cpuLevel: "hard" }, name: "item-hard", color: CARD.red },
      { label: t("◂ BACK"), caption: "", back: true, name: "item-back", color: CARD.gold },
    ];
  }
  return [
    { label: t("1 PLAYER"), caption: t("endless · time attack · puzzle · learn"), group: "1p", name: "group-1p", color: CARD.gold, icon: "gem" },
    { label: t("VS CPU"), caption: t("easy · normal · hard"), group: "cpu", name: "group-cpu", color: CARD.cyan, icon: "robot" },
    { label: t("2 PLAYERS"), caption: t("one screen, two players"), start: { mode: "versus" }, name: "group-2p", color: CARD.orange, icon: "people" },
    {
      label: t("ONLINE"),
      // 一度でも対戦したら通算の勝敗を出す。それまでは何ができるかの説明
      caption: hs.online.wins + hs.online.losses + hs.online.draws > 0 ? onlineRecordLine(hs.online) : t("invite a friend · find an opponent"),
      online: true,
      name: "group-online",
      color: CARD.green,
      icon: "globe",
    },
  ];
}

/** 下段の小さなボタン。 */
const TOOLS = ["records", "settings", "howto"] as const;
type Tool = (typeof TOOLS)[number];
const TOOL_LABEL: Record<Tool, string> = { records: t("RECORDS"), settings: t("SETTINGS"), howto: t("HOW TO PLAY") };

/** キー操作で開いているオーバーレイ。↑↓ でボタンを選び、Enter で押し、Esc で閉じる。 */
interface Overlay {
  panel: Phaser.GameObjects.Container;
  buttons: Button[];
  index: number;
}

interface OverlayButton {
  label: string;
  name?: string;
  onPress: (b: Button) => void;
}

export class MenuScene extends Phaser.Scene {
  private level: Level = "top";
  /** 現在の階層の項目と、カーソルの位置。 */
  private items: MenuItem[] = [];
  index = 0;
  /** カーソルが下段の小ボタンの行にあるとき、その番号。行にないときは -1。 */
  private toolIndex = -1;
  private cards: MenuCard[] = [];
  /** 下位メニューの「◂ BACK」。カードではなく、現在地の左の小さなボタン */
  private backBtn: Button | null = null;
  /** e2e 用。項目の順にラベルの Text（BACK はボタンの Text）と説明の Text を並べる */
  get texts(): Phaser.GameObjects.Text[] {
    return this.items.map((item) => (item.back ? this.backBtn!.label : this.cards[this.cards.findIndex((c) => c.label.name === item.name)].label));
  }
  get captions(): Phaser.GameObjects.Text[] {
    return this.cards.map((c) => c.caption);
  }
  /** キー操作か指が乗って、カーソルの位置を見せるべきか。最初は見せない（指で押すだけの端末では要らない） */
  private focusVisible = false;
  private tools: Button[] = [];
  private crumb!: Phaser.GameObjects.Text;
  /** カードの列の上辺・幅・1 枚の高さ・間隔（論理 px） */
  private listTop = 0;
  /** 現在地・BACK の行の中心 y */
  private headerY = 0;
  private cardW = 0;
  private cardH = 0;
  private cardGap = 0;
  /** 論理座標での画面中央。scale.width は DPR 倍なので使わない。 */
  private cx = 0;
  private compact = false;
  private overlay: Overlay | null = null;
  private bgView: Background | null = null;
  private title: TitleArt | null = null;
  private icons: Phaser.GameObjects.Image[] = [];
  /** 下端のビルド識別子と GitHub。記録・設定・遊び方を開いている間は隠す */
  private footer: Phaser.GameObjects.Text[] = [];
  /** 記録・設定・遊び方を開いている間は false。メニューの表示物を隠し、板だけが空の上に浮かぶ */
  private menuShown = true;
  /** パズルの面選び。開いている間はメニューのキー操作をこちらへ回す。 */
  private picker: { panel: Phaser.GameObjects.Container; state: { stage: number; face: number }; refresh: () => void } | null = null;

  constructor() {
    super("menu");
  }

  private checkedOnlineResume = false;

  /** fromOpening はオープニングから続けて開いたとき。題字は動かさず、項目だけを短く浮かび上がらせる。 */
  create(data: { fromOpening?: boolean } = {}): void {
    // Scene のインスタンスは使い回されるので、前回の表示物への参照を捨てる。
    // 残したままだと refresh() が破棄済みの Text を触って描画が止まる。
    this.cards = [];
    this.backBtn = null;
    this.focusVisible = false;
    this.tools = [];
    this.picker = null;
    this.overlay = null;
    this.toolIndex = -1;
    // 遊んでいる間に新版が見つかっていたら、メニューへ戻ったこのタイミングで切り替える（まもなく reload される）
    if (applyPendingUpdate()) return;
    createTextures(this);
    createMenuIcons(this);
    // URL の ?mode= は最初の1回だけ効かせる。Esc でメニューに戻ったときに再び飛ばされないよう、ここで消す。
    const params = new URLSearchParams(location.search);
    const restoreOnline = !this.checkedOnlineResume;
    this.checkedOnlineResume = true;
    if (restoreOnline && (params.has("room") || sessionStorage.getItem("swaprise.connection.v1"))) { this.scene.start("online"); return; }
    const mode = params.get("mode");
    if (mode === "endless" || mode === "timeattack" || mode === "versus" || mode === "cpu" || mode === "puzzle" || mode === "lesson") {
      const cpu = params.get("cpu");
      const cpuLevel: CpuLevel = cpu === "easy" || cpu === "hard" ? cpu : "normal";
      // パズルの面は ?stage=2-3 か通し番号（1 始まり）。レッスンの課は ?lesson=3（1 始まり）
      const stage = parseStageParam(params.get("stage"));
      const lesson = Math.max(0, (Number(params.get("lesson")) || 1) - 1);
      for (const key of ["mode", "cpu", "stage", "lesson"]) params.delete(key);
      const rest = params.toString();
      history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : ""));
      this.scene.start("game", { mode, cpuLevel, stage, lesson } satisfies GameStart);
      return;
    }

    const layout = layoutFor("menu");
    applyLayout(this, layout);
    // e2e 用。ゲームを始める前でもメニューの表示物を調べられるようにする
    const g = window as unknown as { __swapriseScenes?: Record<string, Phaser.Scene> };
    g.__swapriseScenes = { ...g.__swapriseScenes, menu: this };
    const W = layout.width;
    const H = layout.height;
    const cx = W / 2;
    this.cx = cx;
    this.bgView?.destroy();
    this.bgView = new Background(this, W, H, "menu");
    this.icons = [];

    // 背の低い画面（Safari のツールバーがある iPhone、横持ちのスマホ）では、縦の間隔を詰める。
    // 題字の位置はオープニングの最後の位置と同じ（menuTitle）
    const title = menuTitle(layout);
    const compact = title.compact;
    this.compact = compact;
    const titleY = title.y;
    this.title = new TitleArt(this, cx, titleY, title.size);
    // 柄の飾り。背の低い画面では省いて項目の場所を空ける。曲の拍で順に弾む
    if (!compact) {
      TITLE_ICON_KINDS.forEach((kind, i) => {
        this.icons.push(this.add.image(cx - 100 + i * 40, title.iconsY, `panel-${kind}`).setScale(1 / DPR));
      });
    }

    // カードの列。最上位は 1 PLAYER・VS CPU の全幅 2 枚と、2 PLAYERS・ONLINE の半幅 2 枚。下位は全幅で縦に並ぶ
    this.cardW = Math.min(W - 24, 360);
    this.cardH = compact ? 50 : layout.portrait ? 62 : 56;
    this.cardGap = compact ? 8 : layout.portrait ? 10 : 8;
    // 柄の飾り（iconsY ± 16）の下から
    // 背の低い画面では題字の下端（titleY + 約 40）と BACK（高さ 26）が重ならない高さまで下げる
    this.listTop = titleY + (compact ? 72 : layout.portrait ? 124 : 116);
    // 現在地（下位メニューのとき「1 PLAYER ▸」）と BACK の行。下位メニューでは柄の飾りを消し、その場所に置く
    this.headerY = compact ? this.listTop - 18 : title.iconsY;
    this.crumb = this.add.text(cx, this.headerY, "", { fontFamily: FONT_UI, fontSize: "14px", fontStyle: "700", color: ACCENT }).setOrigin(0.5).setName("crumb");

    // 下段の小ボタン。いちばん背の高い階層（1 PLAYER は 4 枚。最上位は 3 段で最後の段が少し高い）の下端から隙間を空けて置く。
    // 階層ごとに動かすと画面が跳ねるので、どの階層でも同じ位置にする
    const maxRows = 4;
    const listBottom = this.listTop + Math.max(maxRows * this.cardH + (maxRows - 1) * this.cardGap, 3 * this.cardH + 2 * this.cardGap + HALF_EXTRA);
    const toolH = compact ? 34 : 40;
    const toolY = listBottom + (compact ? 12 : 18) + toolH / 2;
    // 3 つを同じ幅で並べる。文字が入らない（英語の HOW TO PLAY）ときは文字ごとの幅にし、それでも列に収まらなければ文字を小さくする
    const toolGap = 8;
    const toolPad = 20;
    const equalW = (this.cardW - toolGap * 2) / 3;
    let toolFont = layout.portrait ? 12 : 13;
    const measure = (size: number): number[] =>
      TOOLS.map((tool) => {
        const t = this.add.text(0, 0, TOOL_LABEL[tool], { fontFamily: FONT_UI, fontSize: `${size}px`, fontStyle: "600" });
        const w = t.width + toolPad;
        t.destroy();
        return w;
      });
    let widths = measure(toolFont);
    if (widths.reduce((a, b) => a + b, 0) + toolGap * 2 > this.cardW) {
      toolFont -= 1;
      widths = measure(toolFont);
    }
    if (Math.max(...widths) <= equalW) widths = widths.map(() => equalW);
    const toolsW = widths.reduce((a, b) => a + b, 0) + toolGap * 2;
    let toolX = cx - toolsW / 2;
    TOOLS.forEach((tool, i) => {
      const b = new Button(this, toolX + widths[i] / 2, toolY, TOOL_LABEL[tool], () => this.openTool(tool), { fontSize: toolFont, minWidth: widths[i], minHeight: toolH, radius: toolH / 2, bgAlpha: 0.2, padX: toolPad }).setName(tool);
      toolX += widths[i] + toolGap;
      this.tools.push(b);
    });

    // ビルド識別子（日付と commit）。スマホで今どの版が動いているかを確かめるため、下端の中央に小さく出す
    const buildText = this.add.text(0, H - 4, __BUILD_ID__, { fontFamily: FONT, fontSize: "9px", color: "rgba(255,255,255,0.4)" }).setOrigin(0, 1).setName("build");
    const githubLink = this.add
      .text(0, H - 4, "GitHub", { fontFamily: FONT, fontSize: "9px", color: "rgba(255,255,255,0.7)" })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true })
      .setName("github-link")
      .on("pointerdown", () => window.open("https://github.com/uphy/swaprise", "_blank", "noopener"));
    this.footer = [buildText, githubLink];
    const footerW = buildText.width + 8 + githubLink.width;
    buildText.setX(cx - footerW / 2);
    githubLink.setX(cx - footerW / 2 + buildText.width + 8);

    // 前回遊んだモードにカーソルを置く
    const last = loadLastMode();
    this.level = "top";
    this.index = last ? (last.mode === "versus" ? 2 : last.mode === "cpu" ? 1 : 0) : 0;
    this.buildList();
    // オープニングから続くときは、題字はそのままに、項目・小ボタン・隅の文字を上から順に浮かび上がらせる
    if (data.fromOpening) {
      const targets = [...this.cards.flatMap((c) => c.objects), ...this.tools, buildText, githubLink];
      targets.forEach((o) => o.setAlpha(0));
      this.tweens.add({ targets, alpha: 1, duration: 260, ease: "Quad.Out", delay: this.tweens.stagger(28) });
    }

    // 回転・ウィンドウサイズの変更でレイアウトが変わったら、メニューは作り直す
    let resizeTimer: number | null = null;
    const onResize = (): void => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        // ソフトキーボードや回転で、名前の入力中にダイアログを消さない。
        // ダイアログが閉じたときの resize 通知でキャンバスを追従させる。
        if (document.querySelector(".score-dialog[open]")) return;
        if (!sameLayout(layoutFor("menu"), layout)) this.scene.restart();
      }, 150);
    };
    window.addEventListener("resize", onResize);
    this.events.once("shutdown", () => {
      window.removeEventListener("resize", onResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    });

    const kb = this.input.keyboard!;
    // AudioContext は最初の操作のあとにしか動かないので、どの入力でも start() を呼ぶ。BGM は start() 時に鳴り始める
    kb.on("keydown", () => audio.start());
    this.input.on("pointerdown", () => audio.start());
    audio.start();
    audio.setDanger(false);
    audio.startBgm("menu");
    // 画面が隠れたら（画面オフ・別アプリ）曲を止め、戻ったら鳴らし直す。ゲーム中は GameScene がポーズと一緒に扱う
    const onHidden = (): void => audio.suspend();
    const onVisible = (): void => audio.resume();
    this.game.events.on("hidden", onHidden);
    this.game.events.on("blur", onHidden);
    this.game.events.on("visible", onVisible);
    this.game.events.on("focus", onVisible);
    this.events.once("shutdown", () => {
      this.game.events.off("hidden", onHidden);
      this.game.events.off("blur", onHidden);
      this.game.events.off("visible", onVisible);
      this.game.events.off("focus", onVisible);
    });
    for (const key of ["UP", "W"]) kb.on(`keydown-${key}`, () => this.onKey("up"));
    for (const key of ["DOWN", "S"]) kb.on(`keydown-${key}`, () => this.onKey("down"));
    for (const key of ["LEFT", "A"]) kb.on(`keydown-${key}`, () => this.onKey("left"));
    for (const key of ["RIGHT", "D"]) kb.on(`keydown-${key}`, () => this.onKey("right"));
    for (const key of ["ENTER", "Z", "SPACE", "F"]) kb.on(`keydown-${key}`, () => this.onKey("enter"));
    for (const key of ["ESC", "BACKSPACE", "X"]) kb.on(`keydown-${key}`, () => this.onKey("back"));
  }

  override update(_time: number, delta: number): void {
    this.bgView?.update(delta);
    const beat = audio.beat;
    if (!beat) return;
    // 題字は拍の頭でわずかに膨らみ、柄の飾りは小節の中で順に弾む
    const swell = Math.pow(1 - beat.phase, 3);
    if (this.title) this.title.scale = 1 + swell * 0.03;
    this.icons.forEach((icon, i) => {
      const local = (beat.bar * 6 - i + 6) % 6;
      const hop = local < 1 ? Math.sin(local * Math.PI) : 0;
      icon.setScale((1 + hop * 0.2) / DPR);
    });
  }

  /** 現在の階層の項目をカードで並べ直す。 */
  private buildList(): void {
    // 浮かび上がりの途中で階層が変わることがある。破棄した表示物を tween が触り続けないよう先に止める
    this.tweens.killTweensOf(this.cards.flatMap((c) => c.objects));
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
    this.backBtn?.destroy();
    this.backBtn = null;
    const hs = loadHighScores();
    this.items = itemsFor(this.level, hs);
    const cx = this.cx;
    const { cardW, cardH, cardGap, compact } = this;
    // 最上位の 2 PLAYERS・ONLINE は 1 行に 2 枚。それ以外は 1 行に 1 枚
    const halfW = (cardW - cardGap) / 2;
    let row = 0;
    this.items.forEach((item, i) => {
      const focus = (): void => {
        this.index = i;
        this.toolIndex = -1;
      };
      if (item.back) {
        // 現在地の左に置く
        const b = new Button(this, cx - cardW / 2 + 42, this.headerY, item.label, () => { focus(); this.select(); }, { fontSize: compact ? 12 : 13, minWidth: 84, minHeight: compact ? 26 : 32, radius: 16 }).setName(item.name);
        b.on("pointerover", () => { focus(); this.focusVisible = true; this.refresh(); });
        this.backBtn = b;
        return;
      }
      const half = this.level === "top" && (item.name === "group-2p" || item.name === "group-online");
      const x = half ? cx + (item.name === "group-2p" ? -1 : 1) * (halfW + cardGap) / 2 : cx;
      const y = this.listTop + row * (cardH + cardGap) + cardH / 2;
      if (!half || item.name === "group-online") row++;
      const card = new MenuCard(this, {
        x, y: half ? y + HALF_EXTRA / 2 : y, w: half ? halfW : cardW, h: half ? cardH + HALF_EXTRA : cardH, compact,
        label: item.label, caption: item.caption, icon: item.icon, narrow: half, color: item.color, name: item.name,
        onPress: () => { focus(); this.select(); },
        onHover: (over) => {
          if (over) focus();
          this.focusVisible = over;
          this.refresh();
        },
      });
      this.cards.push(card);
    });
    this.crumb.setText(this.level === "top" ? "" : `${GROUP_LABEL[this.level]} ▸`);
    // 柄の飾りは最上位だけ。下位ではその場所を現在地と BACK に使う
    this.icons.forEach((icon) => icon.setVisible(this.level === "top"));
    this.refresh();
    this.setMenuShown(this.menuShown);
  }

  /** メニューの表示物（題字・柄の飾り・カード・下段・下端）をまとめて出し入れする。記録・設定・遊び方の板を開く間は隠す */
  private setMenuShown(on: boolean): void {
    this.menuShown = on;
    const all = [...this.title?.layers ?? [], ...this.cards.flatMap((c) => c.objects), ...this.tools, ...this.footer, this.crumb];
    if (this.backBtn) all.push(this.backBtn);
    all.forEach((o) => o.setVisible(on));
    this.icons.forEach((icon) => icon.setVisible(on && this.level === "top"));
  }

  /** カーソルの位置のカードを明るくする。キー操作か指が乗ったときだけ見せる */
  private refresh(): void {
    let c = 0;
    this.items.forEach((item, i) => {
      const on = this.focusVisible && this.toolIndex < 0 && i === this.index;
      if (item.back) this.backBtn?.setSelected(on);
      else this.cards[c++]?.setHot(on);
    });
    this.tools.forEach((b, i) => b.setSelected(i === this.toolIndex));
  }

  /** 下位メニューを開く。前回遊んだモードがその中にあればカーソルをそこへ置く。 */
  private enterGroup(level: Level): void {
    this.level = level;
    const last = loadLastMode();
    this.index = 0;
    if (last && level === "1p") this.index = last.mode === "timeattack" ? 1 : last.mode === "puzzle" ? 2 : last.mode === "lesson" ? 3 : 0;
    if (last && level === "cpu") this.index = last.cpuLevel === "easy" ? 0 : last.cpuLevel === "hard" ? 2 : 1;
    this.toolIndex = -1;
    this.buildList();
  }

  /** 最上位へ戻る。戻った先のカーソルは、いま開いていた下位メニューの項目。 */
  private leaveGroup(): void {
    const from = this.level;
    this.level = "top";
    this.index = from === "cpu" ? 1 : 0;
    this.toolIndex = -1;
    this.buildList();
  }

  private onKey(key: "up" | "down" | "left" | "right" | "enter" | "back"): void {
    audio.start();
    if (key !== "enter" && key !== "back") this.focusVisible = true;
    if (this.overlay) {
      const o = this.overlay;
      if (key === "back") this.closeOverlay();
      else if (key === "up" || key === "down") {
        o.index = (o.index + (key === "up" ? -1 : 1) + o.buttons.length) % o.buttons.length;
        o.buttons.forEach((b, i) => b.setSelected(i === o.index));
        audio.move();
      } else if (key === "enter") o.buttons[o.index]?.emit("pointerdown");
      return;
    }
    if (this.picker) {
      const st = this.picker.state;
      if (key === "back") this.closePicker();
      else if (key === "up" || key === "down") {
        st.stage = (st.stage + (key === "up" ? -1 : 1) + PUZZLE_STAGES) % PUZZLE_STAGES;
        audio.move();
        this.picker.refresh();
      } else if (key === "left" || key === "right") {
        st.face = (st.face + (key === "left" ? -1 : 1) + PUZZLES_PER_STAGE) % PUZZLES_PER_STAGE;
        audio.move();
        this.picker.refresh();
      } else if (key === "enter") this.startPuzzle(st.stage * PUZZLES_PER_STAGE + st.face);
      return;
    }
    switch (key) {
      case "up":
      case "down": {
        // 項目の列の下に小ボタンの行がある。↓ で行へ降り、↑ で戻る
        const n = this.items.length;
        if (this.toolIndex >= 0) {
          this.toolIndex = -1;
          this.index = key === "up" ? n - 1 : 0;
        } else if (key === "down" && this.index === n - 1) this.toolIndex = 0;
        else if (key === "up" && this.index === 0) this.toolIndex = TOOLS.length - 1;
        else this.index += key === "up" ? -1 : 1;
        audio.move();
        this.refresh();
        break;
      }
      case "left":
      case "right":
        if (this.toolIndex < 0) return;
        this.toolIndex = (this.toolIndex + (key === "left" ? -1 : 1) + TOOLS.length) % TOOLS.length;
        audio.move();
        this.refresh();
        break;
      case "enter":
        this.select();
        break;
      case "back":
        if (this.level !== "top") {
          audio.move();
          this.leaveGroup();
        }
        break;
      default:
        break;
    }
  }

  private select(): void {
    audio.start();
    if (this.toolIndex >= 0) {
      this.openTool(TOOLS[this.toolIndex]);
      return;
    }
    const item = this.items[this.index];
    if (!item) return;
    if (item.back) {
      audio.move();
      this.leaveGroup();
      return;
    }
    if (item.group) {
      audio.select();
      this.enterGroup(item.group);
      return;
    }
    if (item.online) { this.scene.start("online"); return; }
    if (!item.start) return;
    audio.select();
    if (item.start.mode === "puzzle") {
      this.showPuzzlePicker();
      return;
    }
    if (item.start.mode === "lesson") {
      // まだ終えていない最初の課から。全部終えていれば最初から
      const done = new Set(loadHighScores().lessons);
      const next = LESSONS.findIndex((_, i) => !done.has(i));
      this.startGame("lesson", undefined, undefined, next < 0 ? 0 : next);
      return;
    }
    this.startGame(item.start.mode, item.start.cpuLevel);
  }

  private startGame(mode: GameMode, cpuLevel?: CpuLevel, stage?: number, lesson?: number): void {
    saveLastMode({ mode, cpuLevel });
    // 全画面を望んでいれば、ゲーム開始の操作の中で取り直す（戻る操作や回転で解除されていることがある）
    fullscreen.sync();
    this.scene.start("game", { mode, cpuLevel, stage, lesson } satisfies GameStart);
  }

  private openTool(tool: Tool): void {
    audio.select();
    if (tool === "records") this.showRecords();
    else if (tool === "settings") this.showSettings();
    else this.showHowTo();
  }

  /**
   * 暗幕・見出し・本文・縦に並ぶボタン・CLOSE からなるオーバーレイ。記録・設定・遊び方で共通。
   * 暗幕のタップと Esc で閉じる。↑↓ でボタンを選び、Enter で押す。
   */
  private openOverlay(name: string, title: string, body: string, buttons: OverlayButton[], color: number, decorate?: (panel: Phaser.GameObjects.Container, cx: number, y: number) => number): Overlay {
    const layout = layoutFor("menu");
    const W = layout.width;
    const H = layout.height;
    const cx = W / 2;
    // 暗幕は薄く、後ろのメニューと空が透ける。中身は色の縁が光るガラスの板に入れる
    this.setMenuShown(false);
    const dim = this.add.rectangle(0, 0, W, H, 0x1a1030, 0.5).setOrigin(0).setInteractive();
    const panel = this.add.container(0, 0, [dim]).setDepth(50).setName(name);
    const cardW = Math.min(W - 24, 360);
    const pad = 16;
    const btnH = 40;
    const btnGap = 8;
    const bodyText = body
      ? this.add.text(cx, 0, body, { fontFamily: FONT_UI, fontSize: "14px", color: TEXT_COLOR, align: "left", lineSpacing: 4, wordWrap: { width: cardW - pad * 2, useAdvancedWrap: true } }).setOrigin(0.5, 0)
      : null;
    // 見出しと本文の間に絵（遊び方の図）を入れるときは、その高さぶん本文を下げる
    const deco = this.add.container(0, 0);
    const decoH = decorate ? decorate(deco, cx, 0) : 0;
    const bodyH = (bodyText ? bodyText.height + 12 : 0) + decoH;
    const all: OverlayButton[] = [...buttons, { label: t("CLOSE"), onPress: () => this.closeOverlay() }];
    const titleH = 44;
    const cardH = pad + titleH + bodyH + all.length * (btnH + btnGap) - btnGap + pad;
    const cy = Math.max(cardH / 2 + (this.compact ? 6 : 20), H / 2);
    const top = cy - cardH / 2;
    const glass = this.add.graphics({ x: cx, y: cy });
    paintGlass(glass, 0, 0, cardW, cardH, color);
    panel.add(glass);
    panel.add(this.add.text(cx, top + pad + 16, title, { fontFamily: FONT_UI, fontSize: "26px", color: TEXT_COLOR, fontStyle: "700" }).setOrigin(0.5).setShadow(0, 2, "#2a1a5a", 6, false, true));
    deco.setY(top + pad + titleH);
    panel.add(deco);
    if (bodyText) {
      bodyText.setY(top + pad + titleH + decoH);
      panel.add(bodyText);
    }
    const list: Button[] = [];
    all.forEach((spec, i) => {
      const b = new Button(this, cx, top + pad + titleH + bodyH + i * (btnH + btnGap) + btnH / 2, spec.label, () => spec.onPress(b), { minWidth: cardW - pad * 2, minHeight: btnH, radius: btnH / 2, bgAlpha: 0.2 });
      if (spec.name) b.setName(spec.name);
      panel.add(b);
      list.push(b);
    });
    list[0]?.setSelected(true);
    dim.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.closeOverlay();
    });
    this.overlay = { panel, buttons: list, index: 0 };
    return this.overlay;
  }

  private closeOverlay(): void {
    this.overlay?.panel.destroy();
    this.overlay = null;
    this.setMenuShown(true);
  }

  /** 上位5件と CPU 戦の勝敗、パズルのクリア数。 */
  private showRecords(): void {
    this.setMenuShown(false);
    showRecordsDialog(this, () => this.setMenuShown(true));
  }

  /** 音・振動（対応端末のみ）・全画面（対応端末のみ）。 */
  private showSettings(): void {
    const layout = layoutFor("menu");
    const soundLabel = (): string => t("SOUND: {state}", { state: t(audio.muted ? "OFF" : "ON") });
    const buttons: OverlayButton[] = [
      {
        label: t("PLAYER SETTINGS"),
        name: "player-settings",
        // DOM のダイアログが重なる間は設定の板を隠し、閉じたら戻す
        onPress: () => {
          this.overlay?.panel.setVisible(false);
          showPlayerSettings(this, false, () => this.overlay?.panel.setVisible(true));
        },
      },
      {
        label: soundLabel(),
        name: "sound",
        onPress: (b) => {
          audio.setMuted(!audio.muted);
          b.setText(soundLabel());
        },
      },
    ];
    if (haptics.supported) {
      const label = (): string => t("VIBRATION: {state}", { state: t(haptics.enabled ? "ON" : "OFF") });
      buttons.push({
        label: label(),
        name: "vibration",
        onPress: (b) => {
          haptics.toggle();
          b.setText(label());
        },
      });
    }
    // 全画面（Android Chrome など）。standalone の PWA では不要なので出さない。要求はボタンの押下（ユーザー操作）の中で通る。
    // 表示は「望んでいるか」。ブラウザの戻る操作で一時的に解除されても希望は変わらず次のタップで入り直すので、
    // 今全画面かどうかを出すと表示と挙動が食い違う
    const withFullscreen = fullscreen.supported && layout.touch;
    const fsLabel = (): string => t("FULL SCREEN: {state}", { state: t(fullscreen.wanted ? "ON" : "OFF") });
    if (withFullscreen) buttons.push({ label: fsLabel(), name: "fullscreen", onPress: () => fullscreen.toggle() });
    const overlay = this.openOverlay("settings-panel", t("SETTINGS"), "", buttons, CARD.cyan);
    const fsBtn = overlay.buttons.find((b) => b.name === "fullscreen");
    fsBtn?.on("pointerdown", () => fsBtn.setText(fsLabel()));
  }

  /** 操作の説明。端末に合わせてタッチかキーボードの説明を出す。 */
  private showHowTo(): void {
    const layout = layoutFor("menu");
    const lines = [t("Line up 3 or more of the same panel to clear them."), t("Chains and combos send garbage to the opponent."), ""];
    if (layout.touch) {
      lines.push(t("Swap: drag a panel sideways. Tapping alone does not swap."));
      lines.push(t("Raise: hold the bar under the board, or press the board with 2 fingers"));
      lines.push(t("Pause: the ❚❚ button"));
      // iPhone の Safari は Fullscreen API を使えない。ホーム画面に追加すれば URL バーが消えることを案内する
      if (!fullscreen.supported && !fullscreen.standalone && fullscreen.isIOS) {
        lines.push("");
        lines.push(t("Full screen: Share ▸ Add to Home Screen"));
      }
    } else {
      lines.push(t("P1: ←↑↓→ move   Z swap   X raise"));
      lines.push(t("P2: WASD move   F swap   H raise"));
      lines.push(t("Gamepad: D-pad / stick move   A,B swap   L,R raise"));
      lines.push(t("Mouse: click between two panels, or drag a panel sideways."));
      lines.push(t("       Hold the bar under the board to raise"));
      lines.push("");
      lines.push(t("P pause   R restart   Esc menu   M mute   V vibration"));
    }
    this.openOverlay("howto-panel", t("HOW TO PLAY"), lines.join("\n"), [], CARD.green, (panel, cx, y) => this.drawHowToDiagram(panel, cx, y));
  }

  /**
   * 遊び方の図。左は 赤・赤・緑・赤 で、緑と右端の赤を入れ替えると、右のように赤が 3 つ揃って光る。
   * 戻り値は使った高さ
   */
  private drawHowToDiagram(panel: Phaser.GameObjects.Container, cx: number, y: number): number {
    // 全体は 4 枚 + 矢印 + 4 枚で幅 304（パネルは 32 角、中心で置く）。縦持ちの幅 300 でも切れないよう、横幅に合わせて縮める
    const fit = Math.min(1, (Math.min(layoutFor("menu").width - 24, 360) - 40) / 304);
    const s = fit / DPR;
    const step = 34 * fit;
    const row = y + 22;
    const left = cx - 136 * fit;
    [0, 0, 1, 0].forEach((k, i) => panel.add(this.add.image(left + i * step, row, `panel-${k}`).setScale(s)));
    panel.add(this.add.image(left + step * 2.5, row, "cursor").setScale(s).setOrigin(0.5).setAlpha(0.9));
    panel.add(this.add.text(cx, row, "▶", { fontFamily: FONT_UI, fontSize: `${Math.round(20 * fit)}px`, color: ACCENT }).setOrigin(0.5));
    const right = cx + 34 * fit;
    [0, 0, 0].forEach((k, i) => panel.add(this.add.image(right + i * step, row, `panel-${k}-bright`).setScale(s)));
    panel.add(this.add.image(right + step * 3, row, "panel-1").setScale(s));
    panel.add(this.add.text(right + step, row + 26, "x3!", { fontFamily: FONT_UI, fontSize: "14px", fontStyle: "700", color: "#7cf57a" }).setOrigin(0.5));
    return 66;
  }

  /**
   * パズルの面選び。6 つのステージを札（STAGE 1〜6、クリア数と 10 個の点）で並べ、
   * 選んだステージの 10 面を枠で囲って下に出す。クリア済みの面は緑、選んでいる面は黄色。
   * 最初は「まだクリアしていない最初の面」を選んでおく。
   */
  private showPuzzlePicker(): void {
    const layout = layoutFor("menu");
    const W = layout.width;
    const H = layout.height;
    const cleared = new Set(loadHighScores().puzzle);
    let first = 0;
    while (first < PUZZLES.length - 1 && cleared.has(first)) first++;
    const state = { stage: Math.floor(first / PUZZLES_PER_STAGE), face: first % PUZZLES_PER_STAGE };
    const dim = this.add.rectangle(0, 0, W, H, 0x1a1030, 0.9).setOrigin(0).setInteractive();
    const panel = this.add.container(0, 0, [dim]).setDepth(50).setName("puzzle-picker");
    const compact = H < 560;
    const cx = W / 2;
    const top = compact ? 22 : layout.portrait ? 64 : 52;
    panel.add(this.add.text(cx, top, t("PUZZLE"), { fontFamily: FONT_UI, fontSize: "30px", color: TEXT_COLOR, fontStyle: "700" }).setOrigin(0.5));
    panel.add(
      this.add
        .text(cx, top + 24, t("{stages} STAGES  x  {puzzles} PUZZLES", { stages: PUZZLE_STAGES, puzzles: PUZZLES_PER_STAGE }), { fontFamily: FONT_UI, fontSize: "12px", color: TEXT_MUTE })
        .setOrigin(0.5),
    );

    // ステージの札。横長の画面では 1 行に 6 つ、縦持ちでは 3 つずつ 2 行
    const stageCols = W >= 640 ? PUZZLE_STAGES : 3;
    const stageRows = Math.ceil(PUZZLE_STAGES / stageCols);
    const gap = 6;
    const stageW = Math.min(112, Math.floor((W - 24) / stageCols) - gap);
    const stageH = compact ? 46 : 52;
    const stageTop = top + 46 + stageH / 2;
    const stageBtns: Button[] = [];
    const dotsGfx = this.add.graphics();
    for (let s = 0; s < PUZZLE_STAGES; s++) {
      const col = s % stageCols;
      const row = Math.floor(s / stageCols);
      const x = cx + (col - (stageCols - 1) / 2) * (stageW + gap);
      const y = stageTop + row * (stageH + gap);
      const done = PUZZLES.slice(s * PUZZLES_PER_STAGE, (s + 1) * PUZZLES_PER_STAGE).filter((_, f) => cleared.has(s * PUZZLES_PER_STAGE + f)).length;
      const b = new Button(this, x, y - 6, `${t("STAGE {stage}", { stage: s + 1 })}\n${done}/${PUZZLES_PER_STAGE}`, () => {
        state.stage = s;
        refresh();
      }, { minWidth: stageW, minHeight: stageH, fontSize: 12 }).setName(`stage-${s + 1}`);
      panel.add(b);
      stageBtns.push(b);
    }
    panel.add(dotsGfx);

    // 選んだステージの 10 面。枠で囲い、枠の上辺にステージ名を載せる
    const faceCols = 5;
    const faceW = Math.min(56, Math.floor((W - 40) / faceCols) - gap);
    const faceH = 40;
    const boxTop = stageTop + stageRows * (stageH + gap) - stageH / 2 + 22;
    const boxW = faceCols * (faceW + gap) + 16;
    const boxH = 2 * (faceH + gap) + 22;
    const box = this.add.rectangle(cx, boxTop + boxH / 2, boxW, boxH, 0xffffff, 0.08).setStrokeStyle(2, 0xffe066);
    panel.add(box);
    const heading = this.add
      .text(cx, boxTop, "", { fontFamily: FONT_UI, fontSize: "13px", color: "#ffe066", fontStyle: "700", backgroundColor: "#2a2050", padding: { x: 8, y: 2 } })
      .setOrigin(0.5);
    panel.add(heading);
    const faceBtns: Button[] = [];
    for (let f = 0; f < PUZZLES_PER_STAGE; f++) {
      const col = f % faceCols;
      const row = Math.floor(f / faceCols);
      const b = new Button(this, cx + (col - (faceCols - 1) / 2) * (faceW + gap), boxTop + 22 + faceH / 2 + row * (faceH + gap), "", () => {
        state.face = f;
        refresh();
        this.startPuzzle(state.stage * PUZZLES_PER_STAGE + state.face);
      }, { minWidth: faceW, minHeight: faceH, fontSize: 14 }).setName(`face-${f + 1}`);
      panel.add(b);
      faceBtns.push(b);
    }
    const infoY = boxTop + boxH + 18;
    const info = this.add.text(cx, infoY, "", { fontFamily: FONT, fontSize: "13px", color: "#9a9ab0", align: "center" }).setOrigin(0.5);
    panel.add(info);
    const btnY = infoY + 38;
    const play = new Button(this, cx - 60, btnY, t("PLAY"), () => this.startPuzzle(state.stage * PUZZLES_PER_STAGE + state.face), { minWidth: 100, minHeight: 40, primary: true }).setName("play");
    const close = new Button(this, cx + 60, btnY, t("CLOSE"), () => this.closePicker(), { minWidth: 100, minHeight: 40 });
    panel.add([play, close]);

    const refresh = (): void => {
      // 札の下に 10 個の点。クリア済みは緑、残りは灰色。選んだステージの点は少し明るい
      dotsGfx.clear();
      stageBtns.forEach((b, s) => {
        b.setSelected(s === state.stage);
        const dotW = 6;
        const dotGap = 2;
        const x0 = b.x - (PUZZLES_PER_STAGE * (dotW + dotGap) - dotGap) / 2;
        const y0 = b.y + stageH / 2 - 10;
        for (let f = 0; f < PUZZLES_PER_STAGE; f++) {
          const done = cleared.has(s * PUZZLES_PER_STAGE + f);
          dotsGfx.fillStyle(done ? 0x6cff7a : s === state.stage ? 0x6a6a86 : 0x44445a, 1);
          dotsGfx.fillRect(x0 + f * (dotW + dotGap), y0, dotW, 4);
        }
      });
      heading.setText(` ${t("STAGE {stage}", { stage: state.stage + 1 })} `);
      faceBtns.forEach((b, f) => {
        const index = state.stage * PUZZLES_PER_STAGE + f;
        const done = cleared.has(index);
        b.setText(`${done ? "✓" : ""}${f + 1}`);
        b.setSelected(f === state.face);
        if (!done || f === state.face) return;
        // クリア済みは緑の文字
        b.setTextColor("#6cff7a");
      });
      const index = state.stage * PUZZLES_PER_STAGE + state.face;
      const st = PUZZLES[index];
      info.setText(`${t("PUZZLE")} ${puzzleName(index)}   ${st.moves} ${st.moves === 1 ? "MOVE" : "MOVES"}${cleared.has(index) ? t("   CLEARED") : ""}`);
    };
    refresh();
    dim.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.closePicker();
    });
    this.picker = { panel, state, refresh };
  }

  private closePicker(): void {
    this.picker?.panel.destroy();
    this.picker = null;
  }

  private startPuzzle(stage: number): void {
    audio.select();
    this.startGame("puzzle", undefined, stage);
  }
}
