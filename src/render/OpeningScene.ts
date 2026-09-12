import Phaser from "phaser";
import { CELL, FONT_UI, KIND_COLORS, TEXT_COLOR, TEXT_DIM, layoutFor, menuTitle, sameLayout } from "./theme";
import { Background } from "./Background";
import { createTextures } from "./textures";
import { DPR, applyLayout } from "./hidpi";
import { audio } from "./shared";
import { fullscreen } from "./fullscreen";
import { t } from "./i18n";
import { buildLogo, logoCellSize, logoLines, type LogoCell, type LogoLetter } from "./logo";
import { SWITCH_GAP } from "./bgm";

/**
 * 起動時のオープニング。ゲームの仕組みそのものを題字で見せる。
 *
 * 1. rise   パネルを 5×7 のドット文字に並べた "SWAPRISE" が、盤面のように画面の下からせり上がる（次の行と同じく暗いまま）
 * 2. wait   音を鳴らせない環境（iOS、初見のブラウザ）では、ここで「TAP TO START」を出して最初の操作を待つ。
 *           鳴らせる環境（Android の PWA、よく音を鳴らしているサイトの Chrome）では待たずに続ける
 * 3. swap   止まった列から順に柄が灯る。最初の S は角のパネルがひとつずれていて、カーソルが入れ替えると S が完成する
 * 4. chain  S が揃って消え、W・A・P…と 8 文字が順に連鎖して消えていく
 * 5. reveal 白い閃光のあと、文字の題字が中央に現れてメニューの位置へ上がり、柄の飾りが降りてくる
 *
 * 音は、灯る間のライザー → 入れ替え → 文字ごとの揃いの音（連鎖数で上がる）と間引いた pop → 最後の消去で連鎖の終わりの音階、
 * と効果音だけで運び、閃光の瞬間にメニューの曲の 1 拍目と題字の一撃（キック・ハープ・和音）を重ねる。
 * 曲はそのままメニューへ続く（同じ曲なら BgmPlayer は鳴らし直さない）。
 *
 * 続きが始まってからは 3 秒ほどで自動的にメニューへ進む。キー・タップ・ゲームパッドのどれかで途中でも飛ばせる
 * （待っている間の最初の操作は「始める」で、その次から「飛ばす」）。
 * `?mode=` などの直接開始、招待 URL、`?opening=0` ではオープニングを出さずにメニューへ渡す（判定はメニューが行う）。
 */

/** オープニングの進み具合。e2e で確かめる。 */
export type OpeningPhase = "rise" | "wait" | "swap" | "chain" | "reveal" | "done";

/** せり上がりが収まり、続きを始めてよいか決める時刻（ms）。 */
const RISE_MS = 700;
/** 続きを始めてから、柄が左から右へ灯り終わるまで（ms）。ライザーの長さでもある。 */
const IGNITE_MS = 400;
/** 続きを始めてからの各段階の時刻（ms）。 */
const T = {
  cursor: 480,
  swap: 700,
  chain: 820,
  reveal: 2320,
  subtitle: 2560,
  settle: 2700,
  icons: 2960,
  menu: 3200,
} as const;
/** 文字ごとの連鎖の間隔（ms）。 */
const CHAIN_STEP = 150;
/** 揃った文字の点滅の長さ（ms）と、1 枚ずつ消える間隔（ms）。ゲーム中の最速の消去より少し速い。 */
const FLASH_MS = 200;
const POP_STEP = 13;
/** pop の音は何枚に 1 回か。13 ms 間隔で全部鳴らすと 1.5 秒に 136 発の連射になる。 */
const POP_SOUND_EVERY = 3;

/** "#rrggbb" の 2 色を k（0〜1）で混ぜる。 */
function mixColor(from: string, to: string, k: number): string {
  const hex = (s: string, i: number): number => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const mix = (i: number): string =>
    Math.round(hex(from, i) + (hex(to, i) - hex(from, i)) * Math.max(0, Math.min(1, k)))
      .toString(16)
      .padStart(2, "0");
  return `#${mix(0)}${mix(1)}${mix(2)}`;
}

export class OpeningScene extends Phaser.Scene {
  phase: OpeningPhase = "rise";
  private finished = false;
  /** 続き（柄が灯る → 入れ替え → 連鎖 → 題字）を始めたか。 */
  private started = false;
  private begin: (() => void) | null = null;
  private bg: Background | null = null;

  constructor() {
    super("opening");
  }

  create(): void {
    this.finished = false;
    this.started = false;
    this.begin = null;
    this.phase = "rise";
    const params = new URLSearchParams(location.search);
    // 直接開始・招待 URL・オンラインの復帰・?opening=0 はオープニングを飛ばす。どこへ進むかはメニューが決める
    if (params.get("opening") === "0" || params.has("mode") || params.has("room") || sessionStorage.getItem("swaprise.connection.v1")) {
      this.scene.start("menu");
      return;
    }
    // 鳴らせる環境ならここで AudioContext が動き始める。鳴らせない環境では suspended のままで、最初の操作で動く（shared.ts）
    audio.start();
    createTextures(this);
    this.makeGlow();
    const layout = layoutFor("menu");
    applyLayout(this, layout);
    this.bg?.destroy();
    this.bg = new Background(this, layout.width, layout.height, "menu");
    const g = window as unknown as { __swapriseScenes?: Record<string, Phaser.Scene> };
    g.__swapriseScenes = { ...g.__swapriseScenes, opening: this };
    const W = layout.width;
    const H = layout.height;
    const cx = W / 2;
    const title = menuTitle(layout);

    // 題字のマス目。縦持ちは SWAP / RISE の 2 行
    const logo = buildLogo(logoLines(layout.portrait));
    const c = logoCellSize(W, logo.cols, 14);
    const s = c / CELL;
    const imgScale = s / DPR;
    const bx = Math.round((W - logo.cols * c) / 2);
    const by = Math.round(H * 0.45 - (logo.rows * c) / 2);
    const cellX = (col: number): number => bx + col * c;
    const cellY = (row: number): number => by + row * c;
    const centerY = by + (logo.rows * c) / 2;

    // 消えたパネルの破片。柄ごとに 1 つの emitter を持ち、パネルの絵を小さく回しながら飛ばす
    const emitters = KIND_COLORS.map((_, kind) =>
      this.add
        .particles(0, 0, `panel-${kind}`, {
          speed: { min: 40, max: 170 },
          angle: { min: 0, max: 360 },
          gravityY: 520,
          lifespan: { min: 260, max: 520 },
          scale: { start: imgScale * 0.5, end: 0 },
          alpha: { start: 1, end: 0 },
          rotate: { min: -180, max: 180 },
          emitting: false,
        })
        .setDepth(6),
    );

    // パネル。最初の S の角のパネルはひとつ左にずらして置く（swap で戻す）。盤面の次の行と同じく暗い柄で始める
    const sprites = new Map<LogoCell, Phaser.GameObjects.Image>();
    const byCol = new Map<number, LogoCell[]>();
    for (const cell of logo.cells) {
      const col = cell === logo.swap.cell ? logo.swap.fromCol : cell.col;
      sprites.set(cell, this.add.image(cellX(col), cellY(cell.row), `panel-${cell.kind}-dark`).setOrigin(0).setScale(imgScale));
      byCol.set(cell.col, [...(byCol.get(cell.col) ?? []), cell]);
    }

    // 1. rise。列ごとに少しずつ遅らせて、画面の下端の外から持ち上げる
    const riseStagger = Math.min(9, 330 / logo.cols);
    const startDy = H - by + c;
    for (const cell of logo.cells) {
      const img = sprites.get(cell)!;
      img.y += startDy;
      this.tweens.add({ targets: img, y: cellY(cell.row), delay: cell.col * riseStagger, duration: 460, ease: "Back.Out", easeParams: [1.0] });
    }

    // 2. wait。音を鳴らせない環境では、暗い題字の下で最初の操作を待つ
    const prompt = this.add
      .text(cx, by + logo.rows * c + (title.compact ? 30 : 40), t(layout.touch ? "TAP TO START" : "PRESS ANY KEY"), { fontFamily: FONT_UI, fontSize: "16px", color: "#ffe066", fontStyle: "700" })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(10)
      .setName("prompt");

    const swapCell = logo.swap.cell;
    const cursor = this.add
      .image(cellX(logo.swap.fromCol) + c, cellY(swapCell.row) + c / 2, "cursor")
      .setScale(imgScale * 1.6)
      .setAlpha(0)
      .setDepth(4);
    const titleText = this.add
      .text(cx, centerY, "SWAPRISE", { fontFamily: FONT_UI, fontSize: `${title.size}px`, color: "#ffe066", fontStyle: "700" })
      .setOrigin(0.5)
      .setShadow(0, 4, "#2a1a5a", 10, false, true)
      .setAlpha(0)
      .setDepth(10)
      .setName("title");
    const subtitle = this.add
      .text(cx, centerY + (title.subtitleY - title.y), t("Swap. Match. Chain!"), { fontFamily: FONT_UI, fontSize: `${title.subtitleSize + 2}px`, fontStyle: "600", color: TEXT_DIM })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(10);
    const glow = this.add.image(cx, centerY, "glow").setScale(0.2).setAlpha(0).setDepth(8).setBlendMode(Phaser.BlendModes.ADD);

    /** 続きを始める。ここからの時刻は T で数える。 */
    const begin = (): void => {
      if (this.started || this.finished) return;
      this.started = true;
      this.phase = "swap";
      this.tweens.killTweensOf(prompt);
      prompt.setVisible(false);

      // 3. swap。ライザーとともに柄が左から右へ灯り、カーソルが現れて、ずれたパネルを元の位置へ入れ替える
      audio.riser(IGNITE_MS / 1000);
      const igniteStagger = IGNITE_MS / logo.cols;
      byCol.forEach((cells, col) => this.at(col * igniteStagger, () => cells.forEach((cell) => sprites.get(cell)!.setTexture(`panel-${cell.kind}`))));
      this.at(T.cursor, () => {
        audio.move();
        this.tweens.add({ targets: cursor, scale: imgScale, alpha: 1, duration: 150, ease: "Back.Out" });
      });
      this.at(T.swap, () => {
        audio.swap();
        this.tweens.add({ targets: sprites.get(swapCell)!, x: cellX(swapCell.col), duration: 70 });
      });
      this.at(T.swap + 110, () => cursor.setVisible(false));

      // 4. chain。文字ごとに 点滅 → 1 枚ずつ消える。次の文字は消え始めてすぐに点滅を始めるので、連鎖が走って見える。
      // 最後の文字が消え終わったところで連鎖の終わりの音階
      this.at(T.chain, () => {
        this.phase = "chain";
      });
      logo.letters.forEach((letter, i) => {
        const last = i === logo.letters.length - 1;
        this.at(T.chain + i * CHAIN_STEP, () => this.clearLetter(letter, i + 1, sprites, emitters, c, cellX, cellY, last ? () => audio.chainEnd(logo.letters.length) : undefined));
      });

      // 5. reveal。閃光と揺れのあと、文字の題字が中央に現れ、メニューの位置へ上がる。
      // メニューの曲は閃光の瞬間に 1 拍目が鳴るよう、鳴り始めまでの間（SWITCH_GAP）だけ先に始める。曲はそのままメニューへ続く
      this.at(T.reveal - Math.round(SWITCH_GAP * 1000), () => {
        audio.setDanger(false);
        audio.startBgm("menu");
      });
      this.at(T.reveal, () => {
        this.phase = "reveal";
        audio.titleSting();
        this.cameras.main.shake(140, 0.004);
        const flash = this.add.rectangle(0, 0, W, H, 0xffffff, 0.5).setOrigin(0).setDepth(20);
        this.tweens.add({ targets: flash, alpha: 0, duration: 260, ease: "Quad.Out", onComplete: () => flash.destroy() });
        this.tweens.add({ targets: glow, scale: 1.9, alpha: { from: 0.85, to: 0 }, duration: 750, ease: "Cubic.Out" });
        titleText.setScale(2.2);
        this.tweens.add({ targets: titleText, alpha: 1, duration: 90 });
        this.tweens.add({ targets: titleText, scale: 1, duration: 300, ease: "Back.Out", easeParams: [1.4] });
        // 熱を帯びた黄色から、メニューと同じ白へ
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 520,
          delay: 120,
          onUpdate: (tw) => titleText.setColor(mixColor("#ffe066", TEXT_COLOR, tw.getValue() ?? 0)),
          onComplete: () => titleText.setColor(TEXT_COLOR),
        });
      });
      this.at(T.subtitle, () => this.tweens.add({ targets: subtitle, alpha: 1, duration: 260, ease: "Quad.Out" }));
      this.at(T.settle, () => {
        this.tweens.add({ targets: titleText, y: title.y, duration: 440, ease: "Cubic.InOut" });
        this.tweens.add({ targets: subtitle, y: title.subtitleY, duration: 440, ease: "Cubic.InOut" });
      });
      // 柄の飾り（メニューと同じ 6 枚）が上から降りてくる。背の低い画面ではメニューにも無いので出さない
      if (!title.compact) {
        this.at(T.icons, () => {
          KIND_COLORS.forEach((_, k) => {
            const icon = this.add.image(cx - 100 + k * 40, title.iconsY - 26, `panel-${k}`).setScale(0).setAlpha(0).setDepth(10);
            this.tweens.add({ targets: icon, y: title.iconsY, scale: 1 / DPR, alpha: 1, delay: k * 40, duration: 260, ease: "Back.Out" });
          });
        });
      }
      this.at(T.menu, () => this.finish());
    };
    this.begin = begin;

    // せり上がりが収まったら、鳴らせる環境ではそのまま続け、鳴らせない環境では最初の操作を待つ。
    // 全画面を望んでいてまだ入っていないとき（タッチ端末の既定）も待つ。全画面はタップの中でしか入れず、
    // ゲームが始まってから入ると画面の大きさが変わって表示が組み直るので、始まる前のここで入る
    this.at(RISE_MS, () => {
      if (this.started) return;
      if (audio.unlocked && !fullscreen.pending) {
        begin();
        return;
      }
      this.phase = "wait";
      prompt.setVisible(true);
      this.tweens.add({ targets: prompt, alpha: { from: 0.25, to: 1 }, duration: 650, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    });

    // 操作。続きが始まる前なら始め（この操作の中で AudioContext が動き出す）、始まっていれば飛ばす。キー・タップ・ゲームパッドのどれでも。
    // 全画面を待っているタップは、指を離したときに全画面に入り（fullscreen.watchGestures）、入って画面の大きさが決まってから始める。
    // 大きさが変わればオープニングを出し直し、変わらなければそのまま続ける。拒否されたときも少し待って続ける
    this.input.keyboard?.on("keydown", () => this.onInput());
    this.input.on("pointerdown", () => {
      if (!this.started && fullscreen.pending) return;
      this.onInput();
    });
    this.input.on("pointerup", () => {
      if (this.started || !fullscreen.pending) return;
      const go = (): void => { if (!this.started && !this.finished) this.onInput(); };
      const onChange = (): void => { this.time.delayedCall(250, go); };
      document.addEventListener("fullscreenchange", onChange, { once: true });
      this.time.delayedCall(800, () => { document.removeEventListener("fullscreenchange", onChange); go(); });
    });
    this.input.gamepad?.on("down", () => this.onInput());

    // 回転・ウィンドウサイズの変更でレイアウトが変わったら、オープニングは切り上げてメニューに任せる。
    // ただし最初の操作を待っている間（全画面に入った直後）はまだ何も始まっていないので、新しい大きさで出し直す
    let resizeTimer: number | null = null;
    const onResize = (): void => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        if (sameLayout(layoutFor("menu"), layout)) return;
        if (this.started || this.finished) this.finish();
        else this.scene.restart();
      }, 150);
    };
    window.addEventListener("resize", onResize);
    this.events.once("shutdown", () => {
      window.removeEventListener("resize", onResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    });
  }

  override update(_time: number, delta: number): void {
    this.bg?.update(delta);
  }

  private onInput(): void {
    if (!this.started) this.begin?.();
    else this.finish();
  }

  /** 題字のうしろで広がる光。放射状のグラデーションを canvas に描いてテクスチャにする（画像ファイルは使わない）。 */
  private makeGlow(): void {
    if (this.textures.exists("glow")) return;
    const size = 256;
    const tex = this.textures.createCanvas("glow", size, size);
    if (!tex) return;
    const ctx = tex.context;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255, 224, 102, 0.9)");
    grad.addColorStop(0.35, "rgba(255, 190, 80, 0.35)");
    grad.addColorStop(1, "rgba(255, 160, 60, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  /** ms 後に fn を呼ぶ。飛ばしたあとは呼ばない。 */
  private at(ms: number, fn: () => void): void {
    this.time.delayedCall(ms, () => {
      if (!this.finished) fn();
    });
  }

  /**
   * 1 文字ぶんの消去。ゲーム中と同じく、点滅 → 明るい柄を見せる → 1 枚ずつ消える、の順。
   * 盤面の吹き出し（枚数・連鎖数）は出さない。文字が読めればよく、数字は題字の邪魔になる。
   * pop の音は POP_SOUND_EVERY 枚に 1 回。onDone は最後の 1 枚が消えたときに呼ぶ。
   */
  private clearLetter(
    letter: LogoLetter,
    chain: number,
    sprites: Map<LogoCell, Phaser.GameObjects.Image>,
    emitters: Phaser.GameObjects.Particles.ParticleEmitter[],
    c: number,
    cellX: (col: number) => number,
    cellY: (row: number) => number,
    onDone?: () => void,
  ): void {
    const cells = letter.cells;
    audio.match(cells.length, chain);
    const setTex = (variant: "" | "-bright"): void => cells.forEach((cell) => sprites.get(cell)!.setTexture(`panel-${cell.kind}${variant}`));
    let bright = false;
    this.time.addEvent({
      delay: 33,
      repeat: Math.floor(FLASH_MS / 33) - 1,
      callback: () => {
        if (this.finished) return;
        bright = !bright;
        setTex(bright ? "-bright" : "");
      },
    });
    this.at(FLASH_MS, () => {
      setTex("-bright");
      cells.forEach((cell, j) => {
        this.at(j * POP_STEP, () => {
          const img = sprites.get(cell)!;
          img.setVisible(false);
          if (j % POP_SOUND_EVERY === 0) audio.pop(j / POP_SOUND_EVERY);
          emitters[cell.kind].explode(4, cellX(cell.col) + c / 2, cellY(cell.row) + c / 2);
          if (j === cells.length - 1) onDone?.();
        });
      });
    });
  }

  /** メニューへ。自然に終わったときも飛ばしたときも同じ。 */
  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = "done";
    this.scene.start("menu", { fromOpening: true });
  }
}
