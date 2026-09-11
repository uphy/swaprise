import { CHARACTER_ASSETS } from "../generated/characters";

/** ゲームで使う動作。`assets/characters/actions.json` の基本画像・プレイ中・結果の識別子。 */
export type CharacterAction = "portrait" | "icon" | "idle" | "danger" | "success" | "garbage-land" | "victory" | "defeat" | "finish";

/** 不均等なシートの1コマ。座標は画像のピクセル。 */
export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX?: number;
  baselineY?: number;
  scale?: number;
}

/** 採用素材の再生設定。`tools/character-assets.mjs` の gameFiles が書き出す形。 */
export interface CharacterAsset {
  id: string;
  action: string;
  kind: "image" | "animation";
  image: string;
  bytes?: number;
  pixelArt?: boolean;
  columns?: number;
  rows?: number;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
  fps?: number;
  loop?: boolean;
  lastHoldMs?: number;
  pivotX?: readonly number[];
  baselineY?: number;
  scale?: number;
  frames?: readonly FrameRect[];
}

export interface Character {
  id: string;
  name: string;
  role: string;
  /** 代替表示と選択画面の縁取りに使う色。 */
  color: string;
  /** 採用済みの素材。ない動作は代替表示にする。 */
  assets: Partial<Record<CharacterAction, CharacterAsset>>;
}

/** `assets/characters/index.json` の順。素材のない人物も含む（代替表示で選べる）。 */
export const CHARACTERS: readonly Character[] = CHARACTER_ASSETS.map((c) => ({
  id: c.id,
  name: c.name,
  role: c.role,
  color: c.color,
  assets: c.assets as Partial<Record<CharacterAction, CharacterAsset>>,
}));

export const CHARACTER_IDS: readonly string[] = CHARACTERS.map((c) => c.id);

export function isCharacterId(value: unknown): value is string {
  return typeof value === "string" && CHARACTER_IDS.includes(value);
}

export function characterById(id: string): Character {
  const c = CHARACTERS.find((c) => c.id === id);
  if (!c) throw new Error(`unknown character: ${id}`);
  return c;
}

/** ゲーム中に使う素材が1つでもあるか。ない人物は全動作が代替表示になる。 */
export function hasGameAssets(c: Character): boolean {
  return Boolean(c.assets.idle);
}

/**
 * 素材のない動作の代わりに使う動作。待機もなければ null（代替表示）。
 * 短い反応・結果は待機で代替し、代替中であることを表示側で示す。
 */
export function resolveAction(c: Character, action: CharacterAction): CharacterAction | null {
  if (c.assets[action]) return action;
  if (action === "icon" && c.assets.portrait) return "portrait";
  if (action !== "portrait" && action !== "icon" && c.assets.idle) return "idle";
  return null;
}

/** 前回選んだ人物。1P と 2P（CPU 対戦では相手）で別々に覚える。 */
export interface CharacterSelection {
  p1: string;
  p2: string;
}

export const SELECTION_KEY = "swaprise.characters.v1";

/** 素材のある最初の人物を既定にする。2P は 1P と別の人物にして、初回に同じ絵が並ばないようにする。 */
export function defaultSelection(): CharacterSelection {
  const withAssets = CHARACTERS.filter(hasGameAssets);
  const p1 = (withAssets[0] ?? CHARACTERS[0]).id;
  const p2 = (withAssets.find((c) => c.id !== p1) ?? CHARACTERS.find((c) => c.id !== p1) ?? CHARACTERS[0]).id;
  return { p1, p2 };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** 保存した選択を読む。壊れた値・知らない人物は既定に戻す。 */
export function loadSelection(storage: StorageLike | null = defaultStorage()): CharacterSelection {
  const base = defaultSelection();
  if (!storage) return base;
  try {
    const raw = storage.getItem(SELECTION_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<CharacterSelection>;
    return { p1: isCharacterId(parsed.p1) ? parsed.p1 : base.p1, p2: isCharacterId(parsed.p2) ? parsed.p2 : base.p2 };
  } catch {
    return base;
  }
}

export function saveSelection(sel: CharacterSelection, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SELECTION_KEY, JSON.stringify({ p1: sel.p1, p2: sel.p2 }));
  } catch {
    // プライベートモードなどで保存できなくても続ける
  }
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
