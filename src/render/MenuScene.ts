import Phaser from "phaser";
import { FONT, MENU_TYPE, KIND_COLORS, TEXT_COLOR, layoutFor, sameLayout } from "./theme";
import { createTextures } from "./textures";
import { PUZZLES, PUZZLES_PER_STAGE, PUZZLE_STAGES, puzzleName, type CpuLevel, type GameMode } from "../core";
import { audio } from "./shared";
import { loadHighScores, type HighScores } from "./highscore";
import { haptics } from "./haptics";
import { DPR, applyLayout } from "./hidpi";
import { Button } from "./ui";
import { fullscreen } from "./fullscreen";
import { loadLastMode, saveLastMode } from "./lastmode";
import { CharacterView } from "./CharacterView";
import { CHARACTERS, type CharacterSelection, hasGameAssets, isCharacterId, loadSelection, saveSelection } from "../characters/catalog";
import type { GameStart } from "./GameScene";

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
}

/** メニューの階層。top は 1 PLAYER / VS CPU / 2 PLAYERS、1p と cpu はその下位。 */
type Level = "top" | "1p" | "cpu";

const GROUP_LABEL: Record<Level, string> = { top: "", "1p": "1 PLAYER", cpu: "VS CPU" };

/** `?stage=2-3` または 1 始まりの通し番号を 0 始まりの番号にする。なければ 0。 */
function parseStageParam(raw: string | null): number {
  if (!raw) return 0;
  const m = /^(\d+)-(\d+)$/.exec(raw);
  const index = m ? (Number(m[1]) - 1) * PUZZLES_PER_STAGE + (Number(m[2]) - 1) : Number(raw) - 1;
  if (!Number.isInteger(index)) return 0;
  return Math.max(0, Math.min(PUZZLES.length - 1, index));
}

const clampNumber = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function bestLine(list: HighScores["endless"]): string {
  const best = list[0];
  return best ? `BEST ${String(best.score).padStart(6, "0")}   MAX CHAIN x${best.maxChain}` : "no record yet";
}

/** 階層ごとの項目。記録は開くたびに読み直すので、ここで組み立てる。 */
function itemsFor(level: Level, hs: HighScores): MenuItem[] {
  if (level === "1p") {
    return [
      { label: "ENDLESS", caption: bestLine(hs.endless), start: { mode: "endless" }, name: "item-endless" },
      { label: "TIME ATTACK", caption: bestLine(hs.timeattack), start: { mode: "timeattack" }, name: "item-timeattack" },
      { label: "PUZZLE", caption: `${hs.puzzle.length} / ${PUZZLES.length} CLEARED`, start: { mode: "puzzle" }, name: "item-puzzle" },
      { label: "◂ BACK", caption: "", back: true, name: "item-back" },
    ];
  }
  if (level === "cpu") {
    const rec = (l: CpuLevel): string => `${hs.cpu[l].wins}W ${hs.cpu[l].losses}L`;
    return [
      { label: "EASY", caption: rec("easy"), start: { mode: "cpu", cpuLevel: "easy" }, name: "item-easy" },
      { label: "NORMAL", caption: rec("normal"), start: { mode: "cpu", cpuLevel: "normal" }, name: "item-normal" },
      { label: "HARD", caption: rec("hard"), start: { mode: "cpu", cpuLevel: "hard" }, name: "item-hard" },
      { label: "◂ BACK", caption: "", back: true, name: "item-back" },
    ];
  }
  return [
    { label: "1 PLAYER", caption: "endless · time attack · puzzle", group: "1p", name: "group-1p" },
    { label: "VS CPU", caption: "easy · normal · hard", group: "cpu", name: "group-cpu" },
    { label: "2 PLAYERS", caption: "one screen, two players", start: { mode: "versus" }, name: "group-2p" },
    { label: "ONLINE", caption: "invite a friend · find an opponent", online: true, name: "group-online" },
  ];
}

/** 下段の小さなボタン。 */
const TOOLS = ["records", "settings", "howto"] as const;
type Tool = (typeof TOOLS)[number];
const TOOL_LABEL: Record<Tool, string> = { records: "RECORDS", settings: "SETTINGS", howto: "HOW TO PLAY" };

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
  private texts: Phaser.GameObjects.Text[] = [];
  private captions: Phaser.GameObjects.Text[] = [];
  private tools: Button[] = [];
  private crumb!: Phaser.GameObjects.Text;
  private itemTop = 0;
  private itemGap = 0;
  /** 論理座標での画面中央。scale.width は DPR 倍なので使わない。 */
  private cx = 0;
  private compact = false;
  private overlay: Overlay | null = null;
  /** パズルの面選び。開いている間はメニューのキー操作をこちらへ回す。 */
  private picker: { panel: Phaser.GameObjects.Container; state: { stage: number; face: number }; refresh: () => void } | null = null;
  /** 対戦の人物選び。↑↓ で 1P / 2P を切り替え、←→ で人物を替え、Enter で始める。 */
  private charPicker: { panel: Phaser.GameObjects.Container; views: CharacterView[]; state: { slot: 0 | 1; sel: CharacterSelection }; refresh: () => void; start: () => void } | null = null;

  constructor() {
    super("menu");
  }

  create(): void {
    // Scene のインスタンスは使い回されるので、前回の表示物への参照を捨てる。
    // 残したままだと refresh() が破棄済みの Text を触って描画が止まる。
    this.texts = [];
    this.captions = [];
    this.tools = [];
    this.picker = null;
    this.charPicker = null;
    this.overlay = null;
    this.toolIndex = -1;
    createTextures(this);
    // URL の ?mode= は最初の1回だけ効かせる。Esc でメニューに戻ったときに再び飛ばされないよう、ここで消す。
    const params = new URLSearchParams(location.search);
    if (params.has("room") || sessionStorage.getItem("swaprise.connection.v1")) { this.scene.start("online"); return; }
    const mode = params.get("mode");
    if (mode === "endless" || mode === "timeattack" || mode === "versus" || mode === "cpu" || mode === "puzzle") {
      const cpu = params.get("cpu");
      const cpuLevel: CpuLevel = cpu === "easy" || cpu === "hard" ? cpu : "normal";
      // パズルの面は ?stage=2-3 か通し番号（1 始まり）
      const stage = parseStageParam(params.get("stage"));
      // 対戦の人物は ?p1=nika&p2=pirika（e2e 用）。なければ前回の選択
      const saved = loadSelection();
      const p1 = params.get("p1");
      const p2 = params.get("p2");
      const characters: [string, string] = [isCharacterId(p1) ? p1 : saved.p1, isCharacterId(p2) ? p2 : saved.p2];
      for (const key of ["mode", "cpu", "stage", "p1", "p2"]) params.delete(key);
      const rest = params.toString();
      history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : ""));
      this.scene.start("game", { mode, cpuLevel, stage, characters } satisfies GameStart);
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

    // 背の低い画面（Safari のツールバーがある iPhone、横持ちのスマホ）では、縦の間隔を詰める
    const compact = H < 560;
    this.compact = compact;
    const titleY = compact ? 36 : layout.portrait ? 72 : 60;
    this.add
      .text(cx, titleY, "SWAPRISE", { fontFamily: FONT, fontSize: `${layout.portrait ? MENU_TYPE.titlePortrait : MENU_TYPE.titleLandscape}px`, color: TEXT_COLOR, fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(cx, titleY + (compact ? 36 : 44), "Swap & match action puzzle", { fontFamily: FONT, fontSize: compact ? "12px" : "14px", color: "#7a7a90" })
      .setOrigin(0.5);
    // 柄の飾り。背の低い画面では省いて項目の場所を空ける
    if (!compact) {
      KIND_COLORS.forEach((_, k) => {
        this.add.image(cx - 100 + k * 40, titleY + 82, `panel-${k}`).setScale(1 / DPR);
      });
    }

    // 現在地（下位メニューのとき「1 PLAYER ▸」）
    this.itemTop = titleY + (compact ? 92 : layout.portrait ? 150 : 140);
    this.itemGap = compact ? 46 : layout.portrait ? 60 : 52;
    this.crumb = this.add.text(cx, this.itemTop - (compact ? 26 : 34), "", { fontFamily: FONT, fontSize: "12px", color: "#ffe066" }).setOrigin(0.5).setName("crumb");

    // 下段の小ボタン。項目は最大 4 つなので、その下に置く
    const toolY = this.itemTop + 4 * this.itemGap - (compact ? 6 : 4);
    const toolW = layout.portrait ? 92 : 112;
    TOOLS.forEach((tool, i) => {
      const b = new Button(this, cx + (i - 1) * (toolW + 8), toolY, TOOL_LABEL[tool], () => this.openTool(tool), { fontSize: 11, minWidth: toolW, minHeight: 34 }).setName(tool);
      this.tools.push(b);
    });

    // ビルド識別子（日付と commit）。スマホで今どの版が動いているかを確かめるため、左下に小さく出す
    const buildText = this.add.text(6, H - 4, __BUILD_ID__, { fontFamily: FONT, fontSize: "9px", color: "#4a4a60" }).setOrigin(0, 1).setName("build");
    this.add
      .text(6 + buildText.width + 8, H - 4, "GitHub", { fontFamily: FONT, fontSize: "9px", color: "#6a6a90" })
      .setOrigin(0, 1)
      .setInteractive({ useHandCursor: true })
      .setName("github-link")
      .on("pointerdown", () => window.open("https://github.com/uphy/swaprise", "_blank", "noopener"));

    // 前回遊んだモードにカーソルを置く
    const last = loadLastMode();
    this.level = "top";
    this.index = last ? (last.mode === "versus" ? 2 : last.mode === "cpu" ? 1 : 0) : 0;
    this.buildList();

    // 回転・ウィンドウサイズの変更でレイアウトが変わったら、メニューは作り直す
    let resizeTimer: number | null = null;
    const onResize = (): void => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
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

  /** 現在の階層の項目を並べ直す。ラベルの下に小文字の説明・記録を添える。 */
  private buildList(): void {
    this.texts.forEach((t) => t.destroy());
    this.captions.forEach((t) => t.destroy());
    this.texts = [];
    this.captions = [];
    const hs = loadHighScores();
    this.items = itemsFor(this.level, hs);
    const cx = this.cx;
    const pad = this.compact ? 3 : 6;
    this.items.forEach((item, i) => {
      const y = this.itemTop + i * this.itemGap;
      // 指で押す前提で、文字の上下に余白を取って当たり判定を高さ 32 論理px 以上にする
      const t = this.add
        .text(cx, y, item.label, { fontFamily: FONT, fontSize: `${this.compact ? MENU_TYPE.itemCompact : MENU_TYPE.item}px`, color: TEXT_COLOR })
        .setOrigin(0.5)
        .setPadding(16, pad, 16, pad)
        .setInteractive({ useHandCursor: true })
        .setName(item.name);
      t.on("pointerover", () => {
        this.index = i;
        this.toolIndex = -1;
        this.refresh();
      });
      t.on("pointerdown", () => {
        this.index = i;
        this.toolIndex = -1;
        this.select();
      });
      this.texts.push(t);
      const c = this.add
        .text(cx, y + (this.compact ? 16 : 19), item.caption, { fontFamily: FONT, fontSize: "11px", color: "#7a7a90" })
        .setOrigin(0.5)
        .setName(`${item.name}-caption`);
      this.captions.push(c);
    });
    this.crumb.setText(this.level === "top" ? "" : `${GROUP_LABEL[this.level]} ▸`);
    this.refresh();
  }

  private refresh(): void {
    this.texts.forEach((t, i) => {
      const on = this.toolIndex < 0 && i === this.index;
      t.setColor(on ? "#ffe066" : TEXT_COLOR);
      t.setText((on ? "> " : "  ") + this.items[i].label + (on ? " <" : "  "));
    });
    this.tools.forEach((b, i) => b.setSelected(i === this.toolIndex));
  }

  /** 下位メニューを開く。前回遊んだモードがその中にあればカーソルをそこへ置く。 */
  private enterGroup(level: Level): void {
    this.level = level;
    const last = loadLastMode();
    this.index = 0;
    if (last && level === "1p") this.index = last.mode === "timeattack" ? 1 : last.mode === "puzzle" ? 2 : 0;
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
    if (this.charPicker) {
      const cp = this.charPicker;
      const st = cp.state;
      if (key === "back") this.closeCharPicker();
      else if (key === "up" || key === "down") {
        st.slot = st.slot === 0 ? 1 : 0;
        audio.move();
        cp.refresh();
      } else if (key === "left" || key === "right") {
        this.cycleCharacter(st.slot, key === "left" ? -1 : 1);
      } else if (key === "enter") cp.start();
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
    // 対戦は人物を選んでから始める
    if (item.start.mode === "cpu" || item.start.mode === "versus") {
      this.showCharacterPicker(item.start.mode, item.start.cpuLevel);
      return;
    }
    this.startGame(item.start.mode, item.start.cpuLevel);
  }

  private startGame(mode: GameMode, cpuLevel?: CpuLevel, stage?: number, characters?: [string, string]): void {
    saveLastMode({ mode, cpuLevel });
    // 全画面を望んでいれば、ゲーム開始の操作の中で取り直す（戻る操作や回転で解除されていることがある）
    fullscreen.sync();
    this.scene.start("game", { mode, cpuLevel, stage, characters } satisfies GameStart);
  }

  /**
   * 対戦の人物選び。1P と 2P（CPU 対戦では相手）を左右に並べ、◂ ▸ で人物を替える。同じ人物も選べる。
   * 素材のない人物は代替表示のまま選べる（試作）。選択は保存し、次回はそこから始める。
   */
  private showCharacterPicker(mode: "cpu" | "versus", cpuLevel?: CpuLevel): void {
    const layout = layoutFor("menu");
    const W = layout.width;
    const H = layout.height;
    const compact = H < 560;
    const cx = W / 2;
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.94).setOrigin(0).setInteractive();
    const panel = this.add.container(0, 0, [dim]).setDepth(50).setName("character-picker");
    const state = { slot: 0 as 0 | 1, sel: loadSelection() };
    const top = compact ? 16 : layout.portrait ? 44 : 36;
    panel.add(this.add.text(cx, top, "CHOOSE CHARACTERS", { fontFamily: FONT, fontSize: compact ? "20px" : "24px", color: TEXT_COLOR, fontStyle: "bold" }).setOrigin(0.5));
    const sub = mode === "cpu" ? `VS CPU ${cpuLevel?.toUpperCase() ?? ""}` : "2 PLAYERS";
    panel.add(this.add.text(cx, top + (compact ? 20 : 26), sub, { fontFamily: FONT, fontSize: "11px", color: "#7a7a90" }).setOrigin(0.5));

    // 2つの枠。立ち絵、◂ 名前 ▸、役どころ。立ち絵は縦 2:3 なので、枠の幅からも高さを抑える
    const colW = Math.min(220, Math.floor(W / 2) - 16);
    const btnY = H - (compact ? 26 : 40);
    const frameTop = top + (compact ? 40 : 56);
    const artH = clampNumber(Math.min(btnY - 32 - frameTop - 92, (colW - 8) * 1.5), 70, 260);
    const frameH = 30 + artH + 72;
    const slotX = (slot: 0 | 1): number => cx + (slot === 0 ? -1 : 1) * (colW / 2 + 6);
    const frames: Phaser.GameObjects.Rectangle[] = [];
    const names: Phaser.GameObjects.Text[] = [];
    const roles: Phaser.GameObjects.Text[] = [];
    const notes: Phaser.GameObjects.Text[] = [];
    const views: CharacterView[] = [];
    const slotLabel = (slot: 0 | 1): string => (slot === 0 ? "1P" : mode === "cpu" ? "CPU" : "2P");
    ([0, 1] as const).forEach((slot) => {
      const x = slotX(slot);
      const frame = this.add.rectangle(x, frameTop + frameH / 2, colW, frameH, 0x1a1a26).setStrokeStyle(2, 0x5a5a72);
      frames.push(frame);
      panel.add(frame);
      panel.add(this.add.text(x, frameTop + 14, slotLabel(slot), { fontFamily: FONT, fontSize: "13px", color: "#ffe066", fontStyle: "bold" }).setOrigin(0.5));
      const name = this.add.text(x, frameTop + 30 + artH + 22, "", { fontFamily: FONT, fontSize: "16px", color: TEXT_COLOR, fontStyle: "bold" }).setOrigin(0.5).setName(`char-name-${slot + 1}`);
      const role = this.add.text(x, frameTop + 30 + artH + 44, "", { fontFamily: FONT, fontSize: "10px", color: "#9a9ab0" }).setOrigin(0.5);
      const note = this.add.text(x, frameTop + 30 + artH + 57, "", { fontFamily: FONT, fontSize: "9px", color: "#7a7a90" }).setOrigin(0.5);
      names.push(name);
      roles.push(role);
      notes.push(note);
      panel.add([name, role, note]);
      const arrowY = frameTop + 30 + artH + 22;
      const prev = new Button(this, x - colW / 2 + 24, arrowY, "◂", () => this.cycleCharacter(slot, -1), { minWidth: 40, minHeight: 40, fontSize: 18 }).setName(`char-prev-${slot + 1}`);
      const next = new Button(this, x + colW / 2 - 24, arrowY, "▸", () => this.cycleCharacter(slot, 1), { minWidth: 40, minHeight: 40, fontSize: 18 }).setName(`char-next-${slot + 1}`);
      panel.add([prev, next]);
      // 枠のタップでその側を選ぶ（キー操作の対象）
      frame.setInteractive().on("pointerdown", () => {
        state.slot = slot;
        refresh();
      });
    });
    const play = new Button(this, cx - 60, btnY, "PLAY", () => start(), { minWidth: 100, minHeight: 40 }).setName("char-play");
    const back = new Button(this, cx + 60, btnY, "BACK", () => this.closeCharPicker(), { minWidth: 100, minHeight: 40 });
    panel.add([play, back]);

    const refresh = (): void => {
      ([0, 1] as const).forEach((slot) => {
        const id = slot === 0 ? state.sel.p1 : state.sel.p2;
        const c = CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
        // 立ち絵は人物ごとに作り直す（画像の読み込みは CharacterView が持つ）
        const current = views[slot];
        if (!current || current.character.id !== c.id) {
          current?.destroy();
          const v = new CharacterView(this, c, { portrait: true });
          v.place(slotX(slot), frameTop + 30 + artH, artH);
          v.setDepth(51);
          views[slot] = v;
        }
        names[slot].setText(c.name);
        roles[slot].setText(c.role);
        notes[slot].setText(hasGameAssets(c) ? (Object.keys(c.assets).length < 9 ? "some motions pending" : "") : "artwork pending");
        frames[slot].setStrokeStyle(2, state.slot === slot ? 0xffe066 : 0x5a5a72);
      });
    };
    const start = (): void => {
      audio.select();
      saveSelection(state.sel);
      this.closeCharPicker();
      this.startGame(mode, cpuLevel, undefined, [state.sel.p1, state.sel.p2]);
    };
    dim.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.closeCharPicker();
    });
    this.charPicker = { panel, views, state, refresh, start };
    refresh();
  }

  /** 人物選びで、slot 側の人物を一覧の前後へ替える。 */
  private cycleCharacter(slot: 0 | 1, dir: -1 | 1): void {
    const cp = this.charPicker;
    if (!cp) return;
    const key = slot === 0 ? "p1" : "p2";
    const i = CHARACTERS.findIndex((c) => c.id === cp.state.sel[key]);
    cp.state.sel[key] = CHARACTERS[(i + dir + CHARACTERS.length) % CHARACTERS.length].id;
    cp.state.slot = slot;
    audio.move();
    cp.refresh();
  }

  private closeCharPicker(): void {
    const cp = this.charPicker;
    if (!cp) return;
    cp.views.forEach((v) => v.destroy());
    cp.panel.destroy();
    this.charPicker = null;
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
  private openOverlay(name: string, title: string, body: string, buttons: OverlayButton[]): Overlay {
    const layout = layoutFor("menu");
    const W = layout.width;
    const H = layout.height;
    const cx = W / 2;
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.94).setOrigin(0).setInteractive();
    const panel = this.add.container(0, 0, [dim]).setDepth(50).setName(name);
    const btnH = 46;
    const bodyText = body
      ? this.add.text(cx, 0, body, { fontFamily: FONT, fontSize: "12px", color: TEXT_COLOR, align: "left", lineSpacing: 3, wordWrap: { width: W - 40 } }).setOrigin(0.5, 0)
      : null;
    const bodyH = bodyText ? bodyText.height + 16 : 0;
    const all: OverlayButton[] = [...buttons, { label: "CLOSE", onPress: () => this.closeOverlay() }];
    const total = 44 + bodyH + all.length * btnH;
    const top = Math.max(this.compact ? 10 : 30, (H - total) / 2);
    panel.add(this.add.text(cx, top + 14, title, { fontFamily: FONT, fontSize: "24px", color: TEXT_COLOR, fontStyle: "bold" }).setOrigin(0.5));
    if (bodyText) {
      bodyText.setY(top + 44);
      panel.add(bodyText);
    }
    const list: Button[] = [];
    all.forEach((spec, i) => {
      const b = new Button(this, cx, top + 44 + bodyH + i * btnH + btnH / 2, spec.label, () => spec.onPress(b), { minWidth: 220, minHeight: 40 });
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
  }

  /** 上位5件と CPU 戦の勝敗、パズルのクリア数。 */
  private showRecords(): void {
    const hs = loadHighScores();
    const lines: string[] = [];
    for (const [title, list] of [
      ["ENDLESS  TOP 5", hs.endless],
      ["TIME ATTACK 2:00  TOP 5", hs.timeattack],
    ] as const) {
      lines.push(title);
      if (list.length === 0) lines.push("no records yet");
      list.forEach((e, i) => {
        lines.push(`${i + 1}.  ${String(e.score).padStart(6, "0")}   x${String(e.maxChain).padEnd(2)}  ${e.date || "----------"}`);
      });
      lines.push("");
    }
    lines.push("VS CPU");
    for (const l of ["easy", "normal", "hard"] as CpuLevel[]) {
      const r = hs.cpu[l];
      lines.push(`${l.toUpperCase().padEnd(7)} ${r.wins}W ${r.losses}L`);
    }
    lines.push("");
    lines.push(`PUZZLE  ${hs.puzzle.length} / ${PUZZLES.length} cleared`);
    this.openOverlay("records-list", "RECORDS", lines.join("\n"), []);
  }

  /** 音・振動（対応端末のみ）・全画面（対応端末のみ）。 */
  private showSettings(): void {
    const layout = layoutFor("menu");
    const soundLabel = (): string => `SOUND: ${audio.muted ? "OFF" : "ON"}`;
    const buttons: OverlayButton[] = [
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
      const label = (): string => `VIBRATION: ${haptics.enabled ? "ON" : "OFF"}`;
      buttons.push({
        label: label(),
        name: "vibration",
        onPress: (b) => {
          haptics.toggle();
          b.setText(label());
        },
      });
    }
    // 全画面（Android Chrome など）。standalone の PWA では不要なので出さない。要求はボタンの押下（ユーザー操作）の中で通る
    const withFullscreen = fullscreen.supported && layout.touch;
    const fsLabel = (): string => `FULL SCREEN: ${fullscreen.active ? "ON" : "OFF"}`;
    if (withFullscreen) buttons.push({ label: fsLabel(), name: "fullscreen", onPress: () => fullscreen.toggle() });
    const overlay = this.openOverlay("settings-panel", "SETTINGS", "", buttons);
    if (!withFullscreen) return;
    const fsBtn = overlay.buttons.find((b) => b.name === "fullscreen");
    const onChange = (): void => {
      fsBtn?.setText(fsLabel());
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    const off = (): void => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
    overlay.panel.once("destroy", off);
    this.events.once("shutdown", off);
  }

  /** 操作の説明。端末に合わせてタッチかキーボードの説明を出す。 */
  private showHowTo(): void {
    const layout = layoutFor("menu");
    const lines = ["Line up 3 or more of the same panel to clear them.", "Chains and combos send garbage to the opponent.", ""];
    if (layout.touch) {
      lines.push("Swap: tap between two panels, or drag a panel sideways");
      lines.push("Raise: hold ▲ ▲ ▲ under the board, or press the board with 2 fingers");
      lines.push("Pause: the ❚❚ button");
      // iPhone の Safari は Fullscreen API を使えない。ホーム画面に追加すれば URL バーが消えることを案内する
      if (!fullscreen.supported && !fullscreen.standalone && fullscreen.isIOS) {
        lines.push("");
        lines.push("Full screen: Share ▸ Add to Home Screen");
      }
    } else {
      lines.push("P1: ←↑↓→ move   Z swap   X raise");
      lines.push("P2: WASD move   F swap   H raise");
      lines.push("Gamepad: D-pad / stick move   A,B swap   L,R raise");
      lines.push("Mouse: click between two panels, or drag a panel sideways.");
      lines.push("       Hold ▲ ▲ ▲ under the board to raise");
      lines.push("");
      lines.push("P pause   R restart   Esc menu   M mute   V vibration");
    }
    this.openOverlay("howto-panel", "HOW TO PLAY", lines.join("\n"), []);
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
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.94).setOrigin(0).setInteractive();
    const panel = this.add.container(0, 0, [dim]).setDepth(50).setName("puzzle-picker");
    const compact = H < 560;
    const cx = W / 2;
    const top = compact ? 22 : layout.portrait ? 64 : 52;
    panel.add(this.add.text(cx, top, "PUZZLE", { fontFamily: FONT, fontSize: "28px", color: TEXT_COLOR, fontStyle: "bold" }).setOrigin(0.5));
    panel.add(
      this.add
        .text(cx, top + 24, `${PUZZLE_STAGES} STAGES  x  ${PUZZLES_PER_STAGE} PUZZLES`, { fontFamily: FONT, fontSize: "11px", color: "#7a7a90" })
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
      const b = new Button(this, x, y - 6, `STAGE ${s + 1}\n${done}/${PUZZLES_PER_STAGE}`, () => {
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
    const box = this.add.rectangle(cx, boxTop + boxH / 2, boxW, boxH, 0x1a1a26).setStrokeStyle(2, 0xffe066);
    panel.add(box);
    const heading = this.add
      .text(cx, boxTop, "", { fontFamily: FONT, fontSize: "13px", color: "#ffe066", fontStyle: "bold", backgroundColor: "#000000", padding: { x: 8, y: 2 } })
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
    const play = new Button(this, cx - 60, btnY, "PLAY", () => this.startPuzzle(state.stage * PUZZLES_PER_STAGE + state.face), { minWidth: 100, minHeight: 40 }).setName("play");
    const close = new Button(this, cx + 60, btnY, "CLOSE", () => this.closePicker(), { minWidth: 100, minHeight: 40 });
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
      heading.setText(` STAGE ${state.stage + 1} `);
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
      info.setText(`PUZZLE ${puzzleName(index)}   ${st.moves} MOVE${st.moves === 1 ? "" : "S"}${cleared.has(index) ? "   CLEARED" : ""}`);
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
