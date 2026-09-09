import { registerSW } from "virtual:pwa-register";

/**
 * Service Worker の更新を、遊んでいる最中に割り込ませないための仕組み。
 *
 * autoUpdate だと、新しい SW が precache を終えて activate した瞬間にページが reload される。
 * 更新の確認は起動時に走るが、ダウンロードが終わるのは数秒後なので、試合が始まった頃に
 * reload されてメニューへ戻されていた。
 *
 * そこで prompt 方式にして reload のタイミングを自分で握る。
 * - 起動時（Phaser を立ち上げる前）に更新の有無を確かめ、あれば「UPDATING…」を出したまま
 *   precache の完了を待って reload する（`waitForUpdate`）
 * - 確認に時間がかかる（回線が不安定・オフライン）ときは諦めて起動し、あとで見つかった更新は
 *   次にメニューへ戻ったときに適用する（`applyPendingUpdate`）
 */

/** 更新の有無を確かめる待ち時間の上限。これを過ぎたら起動を優先する。 */
const CHECK_TIMEOUT_MS = 4000;
/** 新版の precache を待つ上限。回線が遅くて終わらないときは起動を優先し、次のメニューで適用する。 */
const INSTALL_TIMEOUT_MS = 30_000;
/** SKIP_WAITING を送ってから controlling が来ないときに自分で reload するまでの猶予。 */
const RELOAD_FALLBACK_MS = 3000;

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | null = null;
/** 新版が waiting になっていて、いつでも切り替えられる。 */
let pending = false;
let onPending: (() => void) | null = null;
let applying = false;

function overlay(): HTMLElement {
  let el = document.getElementById("update");
  if (!el) {
    el = document.createElement("div");
    el.id = "update";
    el.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#14141c;color:#7a7a90;" +
      "font:14px monospace;letter-spacing:0.1em;z-index:100;pointer-events:auto";
    document.body.appendChild(el);
  }
  return el;
}

function showOverlay(text: string): void {
  const el = overlay();
  el.textContent = text;
  el.hidden = false;
}

function hideOverlay(): void {
  const el = document.getElementById("update");
  if (el) el.remove();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** waiting の SW に切り替えて reload する。controlling が来なければ自分で reload する。 */
async function apply(): Promise<void> {
  if (applying) return;
  applying = true;
  showOverlay("UPDATING…");
  await updateSW?.(true);
  await delay(RELOAD_FALLBACK_MS);
  window.location.reload();
}

/**
 * 起動時の更新確認。Phaser を立ち上げる前に呼び、resolve してから始める。
 * 新版があるときは reload するので resolve しない（画面は UPDATING… のまま）。
 */
export async function waitForUpdate(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  // すでに新版を適用しているところなら、resolve せず reload を待つ
  const registered = new Promise<ServiceWorkerRegistration | undefined>((resolve) => {
    updateSW = registerSW({
      immediate: true,
      onRegisteredSW: (_url, r) => resolve(r),
      onRegisterError: () => resolve(undefined),
      onNeedRefresh: () => {
        pending = true;
        onPending?.();
      },
    });
  });
  // まだ SW に制御されていない（初回の読み込み）なら、配信された内容そのものが最新なので待たない。
  // 登録は裏で進み、precache が終わっても reload はしない（prompt 方式）
  if (!navigator.serviceWorker.controller) {
    void registered.then((r) => { registration = r ?? null; });
    return;
  }
  showOverlay("CHECKING FOR UPDATES…");
  // 更新の確認。update() は sw.js の取得が終わると resolve し、新版があれば installing に入っている
  const checked = registered.then(async (r) => {
    registration = r ?? null;
    if (!r) return false;
    try {
      await r.update();
    } catch {
      // オフラインなど。手元の版で起動する
      return false;
    }
    return Boolean(r.installing || r.waiting);
  });
  const found = await Promise.race([checked, delay(CHECK_TIMEOUT_MS).then(() => false)]);
  if (!found) {
    hideOverlay();
    return;
  }
  // 新版の precache が終わって waiting になるのを待ち、切り替える
  showOverlay("UPDATING…");
  const installed = new Promise<boolean>((resolve) => {
    if (pending) { resolve(true); return; }
    onPending = () => resolve(true);
    // install に失敗した（redundant）ときは諦める
    registration?.installing?.addEventListener("statechange", function onChange(this: ServiceWorker) {
      if (this.state === "redundant") resolve(false);
    });
  });
  const ok = await Promise.race([installed, delay(INSTALL_TIMEOUT_MS).then(() => false)]);
  onPending = null;
  if (!ok) {
    hideOverlay();
    return;
  }
  await apply();
  // reload するまで resolve しない
  await new Promise<never>(() => {});
}

/**
 * 遊んでいる間に見つかった更新を、メニューへ戻ったときに適用する。
 * 適用に入ったら true を返す（画面は UPDATING… に覆われ、まもなく reload する）。
 */
export function applyPendingUpdate(): boolean {
  if (!pending) return false;
  void apply();
  return true;
}
