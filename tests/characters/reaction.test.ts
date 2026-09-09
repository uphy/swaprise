import { describe, expect, it } from "vitest";
import { Reaction } from "../../src/characters/reaction";

describe("Reaction", () => {
  it("通常は待機、危険なら ピンチ", () => {
    const r = new Reaction();
    expect(r.action).toBe("idle");
    r.setDanger(true);
    expect(r.action).toBe("danger");
    r.setDanger(false);
    expect(r.action).toBe("idle");
  });

  it("成功の再生中に連鎖が伸びても先頭から再生し直さない", () => {
    const r = new Reaction();
    expect(r.react("success")).toBe(true);
    expect(r.react("success")).toBe(false);
    expect(r.action).toBe("success");
  });

  it("着地は成功に割り込み、成功は着地に割り込まない", () => {
    const r = new Reaction();
    r.react("success");
    expect(r.react("garbage-land")).toBe(true);
    expect(r.action).toBe("garbage-land");
    expect(r.react("success")).toBe(false);
    expect(r.action).toBe("garbage-land");
  });

  it("短い反応のあとは、その時点の危険状態に戻る", () => {
    const r = new Reaction();
    r.react("success");
    r.setDanger(true);
    expect(r.action).toBe("success");
    r.shortDone();
    expect(r.action).toBe("danger");
  });

  it("結果は途中の反応より優先し、以後の反応を受け付けない", () => {
    const r = new Reaction();
    r.react("success");
    r.setResult("defeat");
    expect(r.action).toBe("defeat");
    expect(r.react("garbage-land")).toBe(false);
    r.setDanger(true);
    expect(r.action).toBe("defeat");
    expect(r.finished).toBe(true);
  });
});
