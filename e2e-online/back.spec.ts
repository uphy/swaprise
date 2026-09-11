import { expect, test, type Page } from "@playwright/test";

async function enter(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => !!(window as any).__swapriseScenes?.menu);
  await page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    m.index = 3;
    m.select();
  });
  await expect(page.getByRole("button", { name: "INVITE FRIEND", exact: true })).toBeVisible();
}

const menuActive = (page: Page) =>
  page.waitForFunction(() => (window as any).__swapriseScenes?.menu?.scene?.isActive());

// 対戦中の戻る操作は online.spec.ts の招待対戦のテストで確かめる（試合を1つ増やすと1日の予約予算に届く）
test("友達を待っている間と招待URLを開いた直後の戻る操作はメニューへ戻り、?room= を残さない", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const p = await a.newPage();
  const q = await b.newPage();
  await enter(p);
  await p.getByRole("button", { name: "INVITE FRIEND", exact: true }).click();
  await expect(p.getByRole("button", { name: "SHARE INVITE" })).toBeVisible();
  const invite = p.url();
  // 招待URLで開いた側。参加する前の戻る操作はメニューへ。履歴を積んでいなければ前のページ（about:blank）へ離脱していた
  await q.goto(invite);
  await expect(q.getByRole("button", { name: "JOIN ROOM", exact: true })).toBeVisible();
  await q.goBack();
  await menuActive(q);
  await expect(q.locator(".online-ui")).toHaveCount(0);
  expect(new URL(q.url()).search).toBe("");
  expect(new URL(q.url()).origin).toBe(new URL(invite).origin);
  // 招待した側。待機中の戻る操作は部屋を退出してメニューへ
  await p.goBack();
  await menuActive(p);
  await expect(p.locator(".online-ui")).toHaveCount(0);
  expect(new URL(p.url()).search).toBe("");
  // 退出は済んでいる（復帰の案内が出ない）
  await enter(p);
  await a.close();
  await b.close();
});
