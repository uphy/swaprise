import { test, expect } from "@playwright/test";

test("cold startup caches only the app shell, not character images", async ({ page, context }) => {
  const images: string[] = [];
  context.on("request", (r) => { if (/\/characters\/.*\.(png|webp)$/.test(r.url())) images.push(r.url()); });
  await page.goto("/?bgm=0&opening=0");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  const cached = await page.evaluate(async () => {
    let bytes = 0;
    const urls: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) {
        urls.push(req.url);
        bytes += (await (await cache.match(req))!.arrayBuffer()).byteLength;
      }
    }
    return { bytes, urls };
  });
  expect(images).toEqual([]);
  expect(cached.urls.some((url) => /\/characters\/.*\.png/.test(url))).toBe(false);
  // Uncompressed app shell, including Phaser and the three music files (1.3MB each). Guard against restoring 88MB precache.
  expect(cached.bytes).toBeLessThan(8_000_000);
  await page.reload();
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  expect(images).toEqual([]);
});

test("first-visit character downloads are saved even without a Service Worker", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  try {
    await page.goto(`${baseURL}/?mode=versus&p1=nika&p2=pirika&bgm=0&countdown=0`);
    await page.waitForFunction(() => (window as any).__swaprise?.scene.characters.every((c: any) => c.image.visible));
    const urls = await page.evaluate(() => (window as any).__swaprise.scene.characters.map((c: any) => new URL(c.character.assets.idle.image, location.href).href));
    const saved = await page.evaluate(async (urls: string[]) => {
      const cache = await caches.open("swaprise-character-images-v1");
      return Promise.all(urls.map(async (url) => (await cache.match(url))?.ok ?? false));
    }, urls);
    expect(saved).toEqual([true, true]);
    await context.setOffline(true);
    // Restart within the already-loaded app. It must obtain images from storage.
    await page.evaluate(() => {
      const scene = (window as any).__swaprise.scene;
      scene.scene.start("menu");
    });
    await page.waitForFunction(() => (window as any).__swapriseScenes?.menu.scene.isActive());
    await page.evaluate(() => {
      const scene = (window as any).__swapriseScenes.menu;
      for (const key of scene.textures.getTextureKeys()) if (key.startsWith("char:")) scene.textures.remove(key);
      scene.scene.start("game", { mode: "versus", characters: ["nika", "pirika"] });
    });
    await page.waitForFunction(() => (window as any).__swaprise?.scene.characters.every((c: any) => c.image.visible));
  } finally { await context.close(); }
});

test.describe("download failures", () => {
test.use({ serviceWorkers: "block", viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });
test("bulk saving failures allow retry", async ({ page }) => {
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.evaluate(() => {
    const s = (window as any).__swapriseScenes.menu;
    s.showSettings(); s.overlay.buttons.find((b: any) => b.name === "offline-data").emit("pointerdown");
  });
  // Fail the first uncached request deterministically; the UI must allow retry.
  await page.route(/\/characters\/.*\.png$/, (route) => route.abort());
  await page.getByRole("button", { name: "SAVE ALL CHARACTERS", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Download stopped");
  await expect(page.getByRole("button", { name: "SAVE ALL CHARACTERS", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "CLOSE", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
});
