import Phaser from "phaser";
import { type Character, type CharacterAction, type CharacterAsset, type FrameRect, resolveAction } from "../characters/catalog";
import { Reaction, type ReactionAction, type ResultAction, type ShortReaction } from "../characters/reaction";
import { FONT, TEXT_COLOR } from "./theme";

/**
 * 画廊の表示と同じ寸法の基準。画廊は 432px の canvas の下 24px を床にして素材を等倍で描くので、
 * 素材の座標（コマの高さ × scale）はこの高さを 1 とした比率で画面に収める。
 */
const REF_HEIGHT = 408;
/** 素材のない短い反応を待機で代替するときの長さ。 */
const FALLBACK_SHORT_MS = 700;

const ACTION_LABEL: Record<ReactionAction, string> = {
  idle: "IDLE",
  danger: "DANGER",
  success: "NICE",
  "garbage-land": "OUCH",
  victory: "WIN",
  defeat: "LOSE",
  finish: "END",
};

interface Playing {
  /** 反応として選んだ動作。 */
  action: ReactionAction | "portrait";
  /** 実際に描く素材。ない場合は代替表示。 */
  asset: CharacterAsset | null;
  /** 別の動作で代替しているか（待機で成功を代替、など）。 */
  fallback: boolean;
  frame: number;
  /** いまのコマに入ってからの経過（ms）。 */
  elapsed: number;
  /** この動作を始めてからの経過（ms）。代替の待機で短い反応を表すときの長さに使う。 */
  age: number;
  /** 一度だけ再生する動作が最後のコマまで進んだか。 */
  done: boolean;
}

/** 読み込み中・読み込み済みの素材。同じ画像を複数の画面が同時に要求しても一度しか読まない。 */
const loading = new Map<string, Promise<void>>();

function textureKey(asset: CharacterAsset): string {
  return `char:${asset.id}`;
}

/** コマの矩形と基準点。等分シートは columns/frameWidth から、不均等なシートは frames から求める。 */
function frameRect(asset: CharacterAsset, i: number): Required<Pick<FrameRect, "x" | "y" | "width" | "height" | "pivotX" | "baselineY" | "scale">> {
  const f = asset.frames?.[i];
  const width = f?.width ?? asset.frameWidth ?? 0;
  const height = f?.height ?? asset.frameHeight ?? 0;
  const columns = asset.columns ?? 1;
  return {
    x: f?.x ?? (i % columns) * width,
    y: f?.y ?? Math.floor(i / columns) * height,
    width,
    height,
    pivotX: f?.pivotX ?? asset.pivotX?.[i] ?? width / 2,
    baselineY: f?.baselineY ?? asset.baselineY ?? height,
    scale: (asset.scale ?? 1) * (f?.scale ?? 1),
  };
}

/**
 * 素材の画像を読み、アニメーションならコマを登録する。読み込み済みなら何もしない。
 * ゲーム中に呼べるよう、Scene の preload ではなく実行時にローダーを動かす。
 */
export function loadCharacterAsset(scene: Phaser.Scene, asset: CharacterAsset): Promise<void> {
  const key = textureKey(asset);
  if (scene.textures.exists(key)) return Promise.resolve();
  const pending = loading.get(key);
  if (pending) return pending;
  const promise = new Promise<void>((resolve, reject) => {
    scene.load.once(`filecomplete-image-${key}`, () => {
      const tex = scene.textures.get(key);
      if (asset.kind === "animation") {
        for (let i = 0; i < (asset.frameCount ?? 0); i++) {
          const r = frameRect(asset, i);
          tex.add(String(i), 0, r.x, r.y, r.width, r.height);
        }
      }
      resolve();
    });
    scene.load.once(`loaderror`, (file: { key: string }) => {
      if (file.key === key) reject(new Error(`character image failed: ${asset.image}`));
    });
    scene.load.image(key, asset.image);
    scene.load.start();
  }).finally(() => loading.delete(key));
  loading.set(key, promise);
  return promise;
}

export interface CharacterViewOptions {
  /** 立ち絵だけを出す（選択画面）。反応は使わない。 */
  portrait?: boolean;
  /** 代替表示の中に出す名前。既定は人物名。 */
  caption?: string;
}

/**
 * 1人ぶんの人物表示。床の中央を基準点にして、指定した高さに収めて描く。
 * 素材のない動作は待機で代替し、待機もない人物は色の札に名前を出す代替表示にする。
 * 代替しているときは足元に動作名を出し、試作中の表示だと分かるようにする。
 */
export class CharacterView {
  readonly root: Phaser.GameObjects.Container;
  private readonly image: Phaser.GameObjects.Image;
  private readonly card: Phaser.GameObjects.Container;
  private readonly cardBg: Phaser.GameObjects.Rectangle;
  private readonly cardName: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
  private readonly reaction = new Reaction();
  private playing: Playing | null = null;
  private height = 100;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly character: Character,
    private readonly opts: CharacterViewOptions = {},
  ) {
    this.root = scene.add.container(0, 0);
    this.image = scene.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.cardBg = scene.add.rectangle(0, 0, 10, 10, Phaser.Display.Color.HexStringToColor(character.color).color, 0.35).setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(character.color).color);
    this.cardName = scene.add.text(0, 0, opts.caption ?? character.name, { fontFamily: FONT, fontSize: "14px", color: TEXT_COLOR, fontStyle: "bold", align: "center" }).setOrigin(0.5);
    this.card = scene.add.container(0, 0, [this.cardBg, this.cardName]).setVisible(false);
    this.caption = scene.add.text(0, 4, "", { fontFamily: FONT, fontSize: "10px", color: "#ffe066" }).setOrigin(0.5, 0);
    this.root.add([this.image, this.card, this.caption]);
    const wanted: CharacterAction[] = opts.portrait ? ["portrait"] : ["idle", "danger", "success", "garbage-land", "victory", "defeat", "finish"];
    for (const action of wanted) {
      const asset = character.assets[action];
      if (!asset) continue;
      loadCharacterAsset(scene, asset).then(
        () => {
          // 読み込み中に代替表示していた動作を、素材で描き直す
          if (!this.destroyed && this.playing?.action === action) this.restart(action);
        },
        () => undefined,
      );
    }
    this.restart(opts.portrait ? "portrait" : "idle");
  }

  /** 床の中央の画面座標と、収める高さ（論理 px）。 */
  place(x: number, floorY: number, height: number): void {
    this.height = height;
    this.root.setPosition(x, floorY);
    this.layout();
  }

  /** いま選んでいる動作（代替前）。e2e とデバッグ用。 */
  get action(): string {
    return this.playing?.action ?? "idle";
  }

  /** 代替表示か（素材がない、または別の動作で代替している）。 */
  get fallback(): boolean {
    return this.playing?.fallback ?? true;
  }

  setDanger(on: boolean): void {
    this.reaction.setDanger(on);
    this.sync();
  }

  react(kind: ShortReaction): void {
    if (this.reaction.react(kind)) this.sync();
  }

  setResult(result: ResultAction): void {
    this.reaction.setResult(result);
    this.sync();
  }

  /** 毎描画フレーム呼ぶ。コマを進め、一度だけの動作が終わったら待機かピンチへ戻す。 */
  update(delta: number): void {
    const p = this.playing;
    if (!p || p.done) return;
    const dt = Math.min(delta, 200);
    p.elapsed += dt;
    p.age += dt;
    const asset = p.asset;
    const oneShot = p.action === "success" || p.action === "garbage-land";
    if (!asset || asset.kind !== "animation" || p.fallback) {
      // 代替の待機で短い反応を表す。一定時間で元へ戻す
      if (oneShot && p.age >= FALLBACK_SHORT_MS) {
        p.done = true;
        this.reaction.shortDone();
        this.sync();
      } else if (asset?.kind === "animation") this.advance(p, asset);
      return;
    }
    this.advance(p, asset);
    if (p.done && oneShot) {
      this.reaction.shortDone();
      this.sync();
    }
  }

  private advance(p: Playing, asset: CharacterAsset): void {
    const count = asset.frameCount ?? 1;
    const fps = asset.fps ?? 6;
    const duration = (): number => 1000 / fps + (p.frame === count - 1 ? asset.lastHoldMs ?? 0 : 0);
    let changed = false;
    while (p.elapsed >= duration()) {
      p.elapsed -= duration();
      if (p.frame === count - 1 && !asset.loop) {
        p.done = true;
        p.elapsed = 0;
        break;
      }
      p.frame = (p.frame + 1) % count;
      changed = true;
    }
    if (changed) this.layout();
  }

  /** 反応の状態と再生中の動作を合わせる。同じ素材を繰り返している最中なら先頭へ戻さない。 */
  private sync(): void {
    if (this.opts.portrait) return;
    const want = this.reaction.action;
    const p = this.playing;
    if (p && p.action === want) return;
    const resolved = resolveAction(this.character, want);
    const asset = resolved ? this.character.assets[resolved] ?? null : null;
    if (p && asset && p.asset === asset && asset.loop && !p.fallback && p.action !== "success" && p.action !== "garbage-land") {
      // 待機↔ピンチが同じ素材（代替）で、繰り返し中。動作名だけ差し替える
      p.action = want;
      p.fallback = resolved !== want;
      this.layout();
      return;
    }
    this.restart(want);
  }

  private restart(action: ReactionAction | "portrait"): void {
    const resolved = action === "portrait" ? (this.character.assets.portrait ? "portrait" : null) : resolveAction(this.character, action);
    const asset = resolved ? this.character.assets[resolved] ?? null : null;
    const loaded = asset ? this.scene.textures.exists(textureKey(asset)) : false;
    this.playing = { action, asset: loaded ? asset : null, fallback: resolved !== action || !loaded, frame: 0, elapsed: 0, age: 0, done: false };
    this.layout();
  }

  /** いまのコマを、床の中央を基準に指定の高さへ収めて置く。 */
  private layout(): void {
    const p = this.playing;
    if (!p) return;
    const factor = this.height / REF_HEIGHT;
    const asset = p.asset;
    const labelAction = p.action === "portrait" ? "" : ACTION_LABEL[p.action];
    if (asset && this.scene.textures.exists(textureKey(asset))) {
      this.card.setVisible(false);
      this.image.setVisible(true);
      if (asset.kind === "animation") {
        const r = frameRect(asset, p.frame);
        this.image.setTexture(textureKey(asset), String(p.frame));
        this.image.setOrigin(r.pivotX / r.width, r.baselineY / r.height);
        this.image.setScale(r.scale * factor);
      } else {
        // 立ち絵・アイコン。下端の中央を床に置き、高さいっぱいに収める
        this.image.setTexture(textureKey(asset));
        this.image.setOrigin(0.5, 1);
        const h = this.image.frame.height || 1;
        this.image.setScale(this.height / h);
      }
      this.caption.setText(p.fallback ? labelAction : "");
    } else {
      // 代替表示。色の札に名前。読み込み中も同じ札を出す
      this.image.setVisible(false);
      this.card.setVisible(true);
      const w = Math.max(40, this.height * 0.5);
      this.cardBg.setSize(w, this.height).setPosition(0, -this.height / 2);
      this.cardName.setPosition(0, -this.height / 2).setFontSize(Math.max(9, Math.min(16, Math.round(w / 3.2))));
      this.caption.setText(labelAction);
    }
    this.caption.setFontSize(Math.max(8, Math.min(11, Math.round(this.height / 10))));
  }

  setVisible(on: boolean): this {
    this.root.setVisible(on);
    return this;
  }

  setDepth(depth: number): this {
    this.root.setDepth(depth);
    return this;
  }

  destroy(): void {
    this.destroyed = true;
    this.root.destroy(true);
  }
}
