import { expect, test } from "@playwright/test";

test("manifest にアイコンがあり、Service Worker が登録されてオフラインでも開ける", async ({ page, context }) => {
  await page.goto("/?bgm=0&opening=0");
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!;
    const res = await fetch(link.href);
    return res.json();
  });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  expect(manifest.display).toBe("standalone");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png$/);

  // 登録と precache が終わるのを待つ
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const k of keys) {
      const c = await caches.open(k);
      if ((await c.keys()).length > 0) return true;
    }
    return false;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(300);
  // 1 PLAYER → ENDLESS
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game), null, { timeout: 15_000 });
  await context.setOffline(false);
});
