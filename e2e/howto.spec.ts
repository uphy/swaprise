import { expect, test } from "@playwright/test";

test("遊び方の図は 3 枚揃いに「x3」を添えず、ゲーム中の連鎖数の表記と紛れない", async ({ page }) => {
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  const texts = await page.evaluate(() => {
    const s = (window as any).__swapriseScenes.menu;
    s.showHowTo();
    const out: string[] = [];
    const walk = (o: any): void => {
      if (typeof o.text === "string") out.push(o.text);
      (o.list ?? []).forEach(walk);
    };
    walk(s.overlay.panel);
    return out;
  });
  expect(texts.some((t) => t.includes("HOW TO PLAY"))).toBe(true);
  expect(texts.filter((t) => /^x\d/.test(t.trim()))).toEqual([]);
});
