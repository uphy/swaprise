import { expect, test } from "@playwright/test";

test("メニュー左下の GitHub リンクをクリックするとリポジトリを新しいタブで開く", async ({ page }) => {
  await page.goto("/?bgm=0&opening=0");
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    (window as any).__openCalls = [];
    window.open = (...args: unknown[]) => {
      (window as any).__openCalls.push(args);
      return null;
    };
  });
  const pos = await page.evaluate(() => {
    const scene = (window as any).__swapriseScenes.menu;
    const t = scene.children.getByName("github-link");
    const rect = document.querySelector("canvas")!.getBoundingClientRect();
    const s = (rect.width / scene.scale.width) * scene.cameras.main.zoom;
    return { x: rect.left + (t.x + t.width / 2) * s, y: rect.top + (t.y - t.height / 2) * s };
  });
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(100);
  const calls = await page.evaluate(() => (window as any).__openCalls);
  expect(calls).toEqual([["https://github.com/uphy/swaprise", "_blank", "noopener"]]);
});
