import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../src/characters/catalog", () => ({ CHARACTERS: [{ assets: {
  idle: { image: "/characters/a/111.png", bytes: 3 },
  portrait: { image: "/characters/a/111.png", bytes: 3 },
  success: { image: "/characters/a/222.png", bytes: 4 },
} }] }));
import { characterFiles, characterImage, savedCharacterCount, saveAllCharacters } from "../../src/characters/offline";

let stored: Map<string, Response>;
let cache: { match: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn>; keys: ReturnType<typeof vi.fn> };
beforeEach(() => {
  stored = new Map();
  cache = {
    match: vi.fn(async (url: string) => stored.get(url)?.clone()),
    put: vi.fn(async (url: string, response: Response) => { stored.set(url, response); }),
    keys: vi.fn(async () => [...stored.keys()].map((url) => new Request(url))),
  };
  vi.stubGlobal("location", { href: "https://game.test/" });
  vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("png")));
});
afterEach(() => vi.unstubAllGlobals());

it("deduplicates shared images and resumes after cancellation without fetching saved files", async () => {
  expect(characterFiles()).toHaveLength(2);
  const controller = new AbortController();
  await expect(saveAllCharacters(controller.signal, () => controller.abort())).rejects.toThrow();
  expect(await savedCharacterCount()).toBe(1);
  await saveAllCharacters(new AbortController().signal, () => {});
  expect(await savedCharacterCount()).toBe(2);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("allows display when storage is full, but never reports a successful offline save", async () => {
  cache.put.mockRejectedValue(new Error("quota"));
  expect((await characterImage(characterFiles()[0].url, new AbortController().signal)).ok).toBe(true);
  await expect(saveAllCharacters(new AbortController().signal, () => {})).rejects.toThrow("quota");
  expect(await savedCharacterCount()).toBe(0);
});

it("does not cache failed HTTP responses", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("missing", { status: 404 }));
  await expect(saveAllCharacters(new AbortController().signal, () => {})).rejects.toThrow("download failed");
  expect(cache.put).not.toHaveBeenCalled();
});
