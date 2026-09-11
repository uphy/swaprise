import { expect, test } from "@playwright/test";

test("旧名称のキー（panepon.*）に残った記録と設定は起動時に新キーへ写され、メニューに反映される", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "panepon.highscores.v1",
      JSON.stringify({ endless: [{ score: 4321, maxChain: 4, date: "2026-09-01" }] }),
    );
    localStorage.setItem("panepon.mute.v1", "on");
  });
  await page.goto("/?bgm=0&opening=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  const stored = await page.evaluate(() => ({
    oldScores: localStorage.getItem("panepon.highscores.v1"),
    oldMute: localStorage.getItem("panepon.mute.v1"),
    newScores: JSON.parse(localStorage.getItem("swaprise.highscores.v1") ?? "{}"),
    newMute: localStorage.getItem("swaprise.mute.v1"),
    muted: (window as any).__swapriseAudio.muted,
  }));
  expect(stored.oldScores).toBeNull();
  expect(stored.oldMute).toBeNull();
  expect(stored.newScores.endless[0].score).toBe(4321);
  expect(stored.newMute).toBe("on");
  expect(stored.muted).toBe(true);
});
