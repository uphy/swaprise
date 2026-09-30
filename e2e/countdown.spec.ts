import { expect, test } from "@playwright/test";

test("開始時に 3・2・1 のカウントダウンがあり、その間はゲームが進まない", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?mode=endless&seed=7&bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForTimeout(800);
  const during = await page.evaluate(() => {
    const p = (window as any).__swaprise;
    return { starting: p.scene.starting, frame: p.game.boards[0].frame };
  });
  expect(during.starting).toBe(true);
  expect(during.frame).toBe(0);

  await page.waitForFunction(() => !(window as any).__swaprise.scene.starting, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => (window as any).__swaprise.game.boards[0].frame);
  expect(after).toBeGreaterThan(0);
  expect(errors.filter((e) => !e.includes("drawImage"))).toEqual([]);
});

test("レッスンの固定の面はカウントダウンを置かずすぐ動き、せり上がる課には残す", async ({ page }) => {
  // カウントダウンがあれば、ゲームを作った時点で starting が立つ
  await page.goto("/?mode=lesson&lesson=1&bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect(await page.evaluate(() => (window as any).__swaprise.scene.starting)).toBe(false);
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].frame > 0);
  // R のやり直しでも待たせない
  await page.evaluate(() => { (window as any).__oldGame = (window as any).__swaprise.game; });
  await page.keyboard.press("r");
  await page.waitForFunction(() => (window as any).__swaprise.game !== (window as any).__oldGame);
  expect(await page.evaluate(() => (window as any).__swaprise.scene.starting)).toBe(false);
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].frame > 0);
  await page.goto("/?mode=lesson&lesson=6&bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect(await page.evaluate(() => (window as any).__swaprise.scene.starting)).toBe(true);
});
