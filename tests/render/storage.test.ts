import { describe, expect, it } from "vitest";
import { migrateLegacyStorage } from "../../src/render/storage";

function fakeStorage(init: Record<string, string>) {
  const m = new Map(Object.entries(init));
  return {
    m,
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("migrateLegacyStorage", () => {
  it("旧キーの値を新キーへ写し、旧キーを消す", () => {
    const s = fakeStorage({ "panepon.highscores.v1": '{"endless":[1]}', "panepon.mute.v1": "on", other: "x" });
    migrateLegacyStorage(s);
    expect([...s.m.entries()]).toEqual([
      ["other", "x"],
      ["swaprise.highscores.v1", '{"endless":[1]}'],
      ["swaprise.mute.v1", "on"],
    ]);
  });

  it("新キーに値があれば上書きせず、旧キーだけ消す", () => {
    const s = fakeStorage({ "panepon.mute.v1": "on", "swaprise.mute.v1": "off" });
    migrateLegacyStorage(s);
    expect([...s.m.entries()]).toEqual([["swaprise.mute.v1", "off"]]);
  });

  it("旧キーがなければ何もしない", () => {
    const s = fakeStorage({ "swaprise.mute.v1": "off" });
    migrateLegacyStorage(s);
    expect([...s.m.entries()]).toEqual([["swaprise.mute.v1", "off"]]);
  });

  it("外した機能（人物選択）のキーを消す", () => {
    const s = fakeStorage({ "swaprise.characters.v1": '{"p1":"a","p2":"b"}', "swaprise.mute.v1": "on" });
    migrateLegacyStorage(s);
    expect([...s.m.keys()]).toEqual(["swaprise.mute.v1"]);
  });
});
