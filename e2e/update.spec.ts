import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/** 登録と precache が終わるのを待つ。 */
async function waitForPrecache(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const k of keys) {
      const c = await caches.open(k);
      if ((await c.keys()).length > 0) return true;
    }
    return false;
  });
}

test("新しい版があると、メニューを出す前に切り替えて reload する", async ({ page, context }) => {
  // 何回目の読み込みか、その読み込みで canvas（Phaser）が出たかを sessionStorage に残す
  await context.addInitScript(() => {
    const n = Number(sessionStorage.getItem("loads") ?? "0") + 1;
    sessionStorage.setItem("loads", String(n));
    new MutationObserver(() => {
      if (document.querySelector("canvas")) {
        const seen = sessionStorage.getItem("canvasAt") ?? "";
        if (!seen.split(",").includes(String(n))) sessionStorage.setItem("canvasAt", seen ? `${seen},${n}` : String(n));
      }
    }).observe(document, { childList: true, subtree: true }); // この時点では documentElement がまだ無い
  });

  await page.goto("/?bgm=0&opening=0");
  await waitForPrecache(page);
  await expect(page.locator("canvas")).toBeVisible();

  // 配信中の sw.js の中身を変えて、新しい版が出た状態を作る。SW スクリプトの取得は page.route では差し替えられないので、
  // preview が配っている dist のファイルを直接いじり、終わったら戻す
  const swPath = path.resolve("dist/sw.js");
  const original = fs.readFileSync(swPath, "utf8");
  fs.writeFileSync(swPath, `${original}\n// next version`);
  try {
    await page.reload();
    // 2回目の読み込みは更新を見つけて reload し、3回目の読み込みでメニューが出る
    await page.waitForFunction(() => sessionStorage.getItem("loads") === "3", null, { timeout: 30_000 });
    await expect(page.locator("canvas")).toBeVisible();
    await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
    // 2回目の読み込みでは Phaser を立ち上げていない（メニューを触れる前に切り替えた）
    expect(await page.evaluate(() => sessionStorage.getItem("canvasAt"))).toBe("1,3");
    // 切り替え済みで、待機中の SW は残っていない。更新中の表示も消えている
    expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);
    await expect(page.locator("#update")).toHaveCount(0);
  } finally {
    fs.writeFileSync(swPath, original);
  }
});

test("新しい版がなければ、確認のあとそのままメニューが出る", async ({ page }) => {
  await page.goto("/?bgm=0&opening=0");
  await waitForPrecache(page);
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await expect(page.locator("#update")).toHaveCount(0);
});
