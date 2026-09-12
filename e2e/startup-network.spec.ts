import { test, expect } from "@playwright/test";

test("cold startup precaches only the app shell", async ({ page }) => {
  await page.goto("/?bgm=0&opening=0");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const bytes = await page.evaluate(async () => {
    let bytes = 0;
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) bytes += (await (await cache.match(req))!.arrayBuffer()).byteLength;
    }
    return bytes;
  });
  // Uncompressed app shell, including Phaser and the three music files (1.3MB each). Guard against restoring 88MB precache.
  expect(bytes).toBeLessThan(8_000_000);
});

test("startup deletes the character image cache left by older versions", async ({ page }) => {
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.evaluate(async () => {
    const cache = await caches.open("swaprise-character-images-v1");
    await cache.put(new Request(`${location.origin}/characters/old/00.png`), new Response("x"));
    localStorage.setItem("swaprise.characters.v1", JSON.stringify({ p1: "a", p2: "b" }));
  });
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.waitForFunction(async () => !(await caches.has("swaprise-character-images-v1")));
  expect(await page.evaluate(() => localStorage.getItem("swaprise.characters.v1"))).toBeNull();
});
