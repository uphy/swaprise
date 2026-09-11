import { EventEmitter } from "node:events";
import { expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: {} }));
vi.mock("../../src/characters/offline", () => ({ characterImage: async () => new Response(new Blob(["image"])) }));
import { loadCharacterAsset } from "../../src/render/CharacterView";
import type { CharacterAsset } from "../../src/characters/catalog";

const asset = (id: string): CharacterAsset => ({ id, action: "idle", kind: "image", image: `${id}.png` });
function scene() {
  const load = Object.assign(new EventEmitter(), { image: vi.fn(), start: vi.fn() });
  return { load, events: new EventEmitter(), textures: { exists: () => false, get: () => ({}) } };
}

it("別画像の失敗後も、自分の画像の失敗を検知して再試行できる", async () => {
  const s = scene();
  const a = loadCharacterAsset(s as any, asset("a"));
  const b = loadCharacterAsset(s as any, asset("b"));
  const results = Promise.allSettled([a, b]);
  await vi.waitFor(() => expect(s.load.image).toHaveBeenCalledTimes(2));
  s.load.emit("loaderror", { key: "char:a" });
  s.load.emit("loaderror", { key: "char:b" });
  expect((await results).map((r) => r.status)).toEqual(["rejected", "rejected"]);
  const retry = loadCharacterAsset(s as any, asset("b"));
  await vi.waitFor(() => expect(s.load.image).toHaveBeenCalledTimes(3));
  s.load.emit("filecomplete-image-char:b");
  await retry;
  expect(s.load.image).toHaveBeenCalledTimes(3);
  expect(s.load.listenerCount("loaderror")).toBe(0);
  expect(s.events.listenerCount("shutdown")).toBe(0);
});

it("画面終了で中断した画像が、次の画面で永遠に読み込み待ちにならない", async () => {
  const first = scene();
  const next = scene();
  next.textures = first.textures;
  const pending = loadCharacterAsset(first as any, asset("a"));
  const stopped = expect(pending).rejects.toThrow("cancelled");
  first.events.emit("shutdown");
  const retry = loadCharacterAsset(next as any, asset("a"));
  await stopped;
  // 古いpromiseの後処理が、新画面の読み込み情報を消していないことも確認。
  const duplicate = loadCharacterAsset(next as any, asset("a"));
  await vi.waitFor(() => expect(next.load.image).toHaveBeenCalledTimes(1));
  next.load.emit("filecomplete-image-char:a");
  await Promise.all([retry, duplicate]);
  expect(next.load.image).toHaveBeenCalledTimes(1);
});
