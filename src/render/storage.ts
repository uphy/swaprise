/**
 * localStorage のキーの移行。旧名称のキー（panepon.*）に残っている記録・設定を新名称のキー（swaprise.*）へ写す。
 * 新キーに値があるときは触らず、写し終えた旧キーは消す。localStorage が使えない環境では何もしない。
 */
const OLD_PREFIX = "panepon.";
const NEW_PREFIX = "swaprise.";

/** 使わなくなった機能のキー。見つけたら消す（人物選択は 2026-09 に機能ごと外した）。 */
const RETIRED_KEYS = ["swaprise.characters.v1"];

export function migrateLegacyStorage(storage: Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">): void {
  const oldKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(OLD_PREFIX)) oldKeys.push(k);
  }
  for (const oldKey of oldKeys) {
    const newKey = NEW_PREFIX + oldKey.slice(OLD_PREFIX.length);
    const value = storage.getItem(oldKey);
    if (value !== null && storage.getItem(newKey) === null) storage.setItem(newKey, value);
    storage.removeItem(oldKey);
  }
  for (const key of RETIRED_KEYS) storage.removeItem(key);
}

/** 旧版が人物の画像を溜めていた Cache Storage（最大で数十 MB）。機能を外したので消す。 */
export const RETIRED_CACHES = ["swaprise-character-images-v1"];

export async function deleteRetiredCaches(storage: Pick<CacheStorage, "delete">): Promise<void> {
  await Promise.all(RETIRED_CACHES.map((name) => storage.delete(name)));
}

try {
  migrateLegacyStorage(localStorage);
} catch {
  // プライベートモードなどで localStorage が使えない。記録は残らないが動作には影響しない
}
try {
  if (typeof caches !== "undefined") void deleteRetiredCaches(caches).catch(() => {});
} catch {
  // Cache Storage が使えない環境（非 https など）
}
