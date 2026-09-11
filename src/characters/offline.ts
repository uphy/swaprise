import { CHARACTERS } from "./catalog";

/** Shared with the Service Worker's image route in vite.config.ts. */
export const CHARACTER_CACHE = "swaprise-character-images-v1";
export const characterFiles = (): { url: string; bytes: number }[] => [...new Map(CHARACTERS.flatMap((c) =>
  Object.values(c.assets).map((a) => [new URL(a.image, location.href).href, { url: new URL(a.image, location.href).href, bytes: a.bytes ?? 0 }] as const))).values()];

/** Cache even on the first visit, before the Service Worker takes control.
 * Failure to persist must not prevent a character from being rendered. */
export async function characterImage(url: string, signal: AbortSignal, requireStorage = false): Promise<Response> {
  const absolute = new URL(url, location.href).href;
  let cache: Cache | undefined;
  try {
    cache = await caches.open(CHARACTER_CACHE);
    const cached = await cache.match(absolute);
    if (cached?.ok) return cached;
  } catch (error) { if (requireStorage) throw error; }
  const response = await fetch(absolute, { signal, cache: "force-cache" });
  if (!response.ok) throw new Error("Character download failed");
  try {
    if (!cache) throw new Error("Storage unavailable");
    await cache.put(absolute, response.clone());
  } catch (error) { if (requireStorage) throw error; }
  return response;
}
export async function savedCharacterCount(): Promise<number> {
  const cache = await caches.open(CHARACTER_CACHE);
  const keys = new Set((await cache.keys()).map((r) => r.url));
  return characterFiles().filter((f) => keys.has(f.url)).length;
}
/** Explicit action only. Sequential downloads keep memory/connection use bounded.
 * Completed files remain cached after cancellation/failure, so retry resumes. */
export async function saveAllCharacters(signal: AbortSignal, progress: (count: number, total: number) => void): Promise<void> {
  const files = characterFiles();
  let count = 0;
  for (const file of files) {
    signal.throwIfAborted();
    await characterImage(file.url, AbortSignal.any([signal, AbortSignal.timeout(30000)]), true);
    progress(++count, files.length);
  }
}
