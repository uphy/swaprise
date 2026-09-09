import { describe, expect, it } from "vitest";
import { CHARACTERS, SELECTION_KEY, characterById, defaultSelection, hasGameAssets, loadSelection, resolveAction, saveSelection } from "../../src/characters/catalog";

function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, "getItem" | "setItem"> & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("キャラクターの一覧", () => {
  it("10人が index.json の順で並び、全員に基本画像と全動作の採用素材がある", () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(["nika", "mito", "sena", "rocca", "yuno", "baro", "pirika", "nui", "ordo", "izel"]);
    expect(CHARACTERS.every(hasGameAssets)).toBe(true);
    for (const c of CHARACTERS) {
      for (const action of ["portrait", "icon", "idle", "danger", "success", "garbage-land", "victory", "defeat", "finish"] as const) {
        expect(c.assets[action], `${c.id}/${action}`).toBeDefined();
        expect(resolveAction(c, action)).toBe(action);
      }
    }
  });

  it("素材のない動作は待機で代替し、待機もなければ代替表示にする", () => {
    const pirika = characterById("pirika");
    expect(resolveAction(pirika, "danger")).toBe("danger");
    const nika = characterById("nika");
    expect(nika.assets.danger).toBeDefined();
    expect(resolveAction({ ...nika, assets: { idle: nika.assets.idle } }, "danger")).toBe("idle");
    const withoutAssets = { ...nika, assets: {} };
    expect(resolveAction(withoutAssets, "idle")).toBeNull();
    expect(resolveAction(withoutAssets, "portrait")).toBeNull();
  });
});

describe("前回の選択", () => {
  it("保存がなければ素材のある人物を 1P と 2P に別々に割り当てる", () => {
    const d = defaultSelection();
    expect(d.p1).not.toBe(d.p2);
    expect(hasGameAssets(characterById(d.p1))).toBe(true);
    expect(loadSelection(memoryStorage())).toEqual(d);
  });

  it("保存した選択を復元し、壊れた値や知らない人物は既定に戻す", () => {
    const s = memoryStorage();
    saveSelection({ p1: "mito", p2: "nika" }, s);
    expect(JSON.parse(s.data[SELECTION_KEY])).toEqual({ p1: "mito", p2: "nika" });
    expect(loadSelection(s)).toEqual({ p1: "mito", p2: "nika" });
    expect(loadSelection(memoryStorage({ [SELECTION_KEY]: '{"p1":"nobody","p2":"nika"}' }))).toEqual({ p1: defaultSelection().p1, p2: "nika" });
    expect(loadSelection(memoryStorage({ [SELECTION_KEY]: "{broken" }))).toEqual(defaultSelection());
    expect(loadSelection(null)).toEqual(defaultSelection());
  });
});
