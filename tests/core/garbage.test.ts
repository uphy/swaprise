import { describe, expect, it } from "vitest";
import { Board, NO_INPUT, TIMING, garbageFromChain, garbageFromCombo } from "../../src/core";
import { run } from "./helpers";

describe("おじゃまパネルの送り方", () => {
  it("同時消し n個 は厚さ1段・幅 n-1 の板", () => {
    expect(garbageFromCombo(3)).toEqual([]);
    expect(garbageFromCombo(4)).toEqual([{ width: 3, height: 1, type: "normal" }]);
    expect(garbageFromCombo(7)).toEqual([{ width: 6, height: 1, type: "normal" }]);
  });

  it("8個以上は複数の板に分離する（8=3+5、9=4+4、10=5+5、12=6+6）", () => {
    expect(garbageFromCombo(8).map((g) => g.width)).toEqual([3, 5]);
    expect(garbageFromCombo(9).map((g) => g.width)).toEqual([4, 4]);
    expect(garbageFromCombo(10).map((g) => g.width)).toEqual([5, 5]);
    expect(garbageFromCombo(12).map((g) => g.width)).toEqual([6, 6]);
  });

  it("n連鎖は幅6・厚さ n-1 の板。13連鎖の12段が上限", () => {
    expect(garbageFromChain(1)).toEqual([]);
    expect(garbageFromChain(2)).toEqual([{ width: 6, height: 1, type: "normal" }]);
    expect(garbageFromChain(5)[0].height).toBe(4);
    expect(garbageFromChain(13)[0].height).toBe(12);
    expect(garbageFromChain(20)[0].height).toBe(12);
  });

  it("連鎖の板は連鎖が終わったときに1枚だけ送る。途中の段階では送らない（原作どおり）", () => {
    // 縦→縦→横の3連鎖ができる盤面（board.test の CHAIN3）。(0,4) の 4 を右の空白へ抜く
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    b.setColumns([
      [2, 1, 0, 0, 4, 0, 1, 1, 3],
      [4, 3],
      [4, 3],
    ]);
    b.cursor.x = 0;
    b.cursor.y = 4;
    const attacks: { frame: number; garbage: { width: number; height: number }[] }[] = [];
    let chainEndFrame = -1;
    b.tick({ ...NO_INPUT, swap: true });
    for (let f = 0; f < 400; f++) {
      b.tick(NO_INPUT);
      for (const e of b.events) {
        if (e.type === "attack") attacks.push({ frame: b.frame, garbage: e.garbage });
        if (e.type === "chainEnd") chainEndFrame = b.frame;
      }
    }
    expect(b.maxChain).toBe(3);
    expect(chainEndFrame).toBeGreaterThan(0);
    // 3枚消しの連鎖なので同時消しの板はなく、連鎖の板（幅6・厚さ2）が連鎖終了のフレームに1枚だけ
    expect(attacks).toEqual([{ frame: chainEndFrame, garbage: [{ width: 6, height: 2, type: "normal" }] }]);
  });
});

/**
 * 送るタイミングと降るタイミング（原作の規則）。
 * 同時消しの板は100フレーム待ってから送り、待っている間の同時消しは合流する。自分の連鎖中に待ちが明けた板は連鎖の終わりに一緒に送る。
 * 届いた板は52フレーム後に降れるようになり、相手の盤面が静止するまで降らない。
 */
describe("おじゃまの送出と投下のタイミング", () => {
  /** 縦→縦→横の3連鎖ができる盤面（board.test の CHAIN3）。(0,4) の 4 を右の空白へ抜くと始まる。 */
  const CHAIN3 = [[2, 1, 0, 0, 4, 0, 1, 1, 3], [4, 3], [4, 3]];
  /** 列 x の (x,2) の 1 を右の空白へ抜くと、上の2枚が落ちて縦4の同時消しになる。 */
  function combo4Columns(kind: number, other: number): number[][] {
    return [[kind, kind, other, kind, kind], [other]];
  }
  type Attack = { frame: number; garbage: { width: number; height: number }[] };
  function collect(b: Board, frames: number, attacks: Attack[], chainEnds: number[]): void {
    for (let f = 0; f < frames; f++) {
      b.tick(NO_INPUT);
      for (const e of b.events) {
        if (e.type === "attack") attacks.push({ frame: b.frame, garbage: e.garbage });
        if (e.type === "chainEnd") chainEnds.push(b.frame);
      }
    }
  }
  function swapAt(b: Board, x: number, y: number): void {
    b.cursor.x = x;
    b.cursor.y = y;
    b.tick({ ...NO_INPUT, swap: true });
  }

  it("同時消しの板は揃ってから100フレーム待って送り、待っている間の同時消しは合流して1度に送る", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    b.setColumns([...combo4Columns(0, 1), [], [], ...combo4Columns(2, 3)]);
    const attacks: Attack[] = [];
    swapAt(b, 0, 2);
    let firstMatch = -1;
    for (let f = 0; f < 40; f++) {
      b.tick(NO_INPUT);
      if (firstMatch < 0 && b.events.some((e) => e.type === "match")) firstMatch = b.frame;
      for (const e of b.events) if (e.type === "attack") attacks.push({ frame: b.frame, garbage: e.garbage });
    }
    expect(firstMatch).toBeGreaterThan(0);
    // 2つ目の同時消し。1つ目の待ちの途中なので合流する
    swapAt(b, 4, 2);
    let secondMatch = -1;
    for (let f = 0; f < 300; f++) {
      b.tick(NO_INPUT);
      if (secondMatch < 0 && b.events.some((e) => e.type === "match")) secondMatch = b.frame;
      for (const e of b.events) if (e.type === "attack") attacks.push({ frame: b.frame, garbage: e.garbage });
    }
    expect(secondMatch).toBeGreaterThan(firstMatch);
    expect(secondMatch - firstMatch).toBeLessThan(TIMING.garbageSendDelay);
    expect(attacks).toEqual([
      {
        frame: secondMatch + TIMING.garbageSendDelay,
        garbage: [
          { width: 3, height: 1, type: "normal" },
          { width: 3, height: 1, type: "normal" },
        ],
      },
    ]);
  });

  it("自分の連鎖中に待ちが明けた同時消しの板は、連鎖が終わったときに連鎖の板と一緒に送る", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    b.setColumns([...CHAIN3, [], ...combo4Columns(2, 3)]);
    const attacks: Attack[] = [];
    const chainEnds: number[] = [];
    swapAt(b, 0, 4);
    // 2連鎖目が揃ってから同時消しを起こす。板の待ち（100F）は2連鎖目の消去（44+20+27F）と3連鎖目の落下より長い
    for (let f = 0; f < 600 && b.chain < 2; f++) collect(b, 1, attacks, chainEnds);
    expect(b.chain).toBe(2);
    swapAt(b, 4, 2);
    collect(b, 600, attacks, chainEnds);
    expect(b.maxChain).toBe(3);
    expect(chainEnds).toHaveLength(1);
    expect(attacks).toEqual([
      {
        frame: chainEnds[0],
        garbage: [
          { width: 3, height: 1, type: "normal" },
          { width: 6, height: 2, type: "normal" },
        ],
      },
    ]);
  });

  it("届いた板は相手の盤面が静止するまで降らない。連鎖の途中には降らず、連鎖が終わってから降る", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    b.setColumns(CHAIN3);
    swapAt(b, 0, 4);
    run(b, 5);
    b.pendingGarbage.push({ width: 6, height: 1, type: "normal" });
    let chainEnd = -1;
    for (let f = 0; f < 600 && chainEnd < 0; f++) {
      b.tick(NO_INPUT);
      if (b.events.some((e) => e.type === "chainEnd")) chainEnd = b.frame;
      // 消えている間も、上のパネルが浮いて落ちている間も、板は予告に留まる
      expect(b.garbage.size).toBe(0);
      expect(b.pendingGarbage).toHaveLength(1);
    }
    expect(b.maxChain).toBe(3);
    expect(chainEnd).toBeGreaterThan(0);
    run(b, TIMING.garbageQuietFrames);
    expect(b.pendingGarbage).toHaveLength(0);
    expect(b.garbage.size).toBe(1);
  });

  it("送られた板は52フレーム後に降れるようになる。それまでは静止した盤面でも予告に留まる", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, noRise: true });
    b.setColumns([[0], [1], [0], [1], [0], [1]]);
    run(b, 10);
    b.receiveGarbage([{ width: 6, height: 1, type: "normal" }]);
    run(b, TIMING.garbageTransit - 1);
    expect(b.garbage.size).toBe(0);
    expect(b.pendingGarbage).toHaveLength(1);
    run(b, 1);
    expect(b.garbage.size).toBe(1);
    expect(b.pendingGarbage).toHaveLength(0);
  });
});

/**
 * おじゃまの変身（原作の規則）。
 * 厚さ1段の板（同時消し・2連鎖）は、いくつ積み重なっていても1度の消去で全部が通常パネルになる。
 * 3連鎖以上の厚い板は1度の消去で最下段の1段だけが通常パネルになり、残りはおじゃまのまま。
 * 隣で消すたびに1段ずつ減る。変身の途中で全段が柄を見せてから上の段がおじゃまに戻るのも原作どおり。
 */
describe("おじゃまの変身", () => {
  function boardWithMatchReady(): Board {
    const b = new Board({ seed: 3, kinds: 5, initialHeight: 0, noRise: true });
    // 下段 0 0 1 0 2 3。(2,0) と (3,0) を入れ替えると 0 0 0 が揃い、その真上のおじゃまが変身する
    b.setColumns([[0], [0], [1], [0], [2], [3]]);
    return b;
  }
  function place(b: Board, x: number, y: number, w: number, h: number): void {
    (b as unknown as { placeGarbage: (x: number, y: number, w: number, h: number, t: "normal") => void }).placeGarbage(x, y, w, h, "normal");
  }
  function swapAndSettle(b: Board, x: number, y: number): void {
    b.cursor.x = x;
    b.cursor.y = y;
    b.tick({ ...NO_INPUT, swap: true });
    run(b, 900);
  }
  function garbageRows(b: Board): number {
    let n = 0;
    for (const g of b.garbage.values()) n += g.height;
    return n;
  }

  it("厚さ1段の板は、積み重なっていても1度の消去で全部が通常パネルになる", () => {
    const b = boardWithMatchReady();
    place(b, 0, 1, 3, 1);
    place(b, 2, 2, 4, 1);
    place(b, 0, 3, 5, 1);
    swapAndSettle(b, 2, 0);
    expect(b.garbage.size).toBe(0);
    expect(b.panelCount()).toBe(3 + 3 + 4 + 5);
  });

  it("厚い板は1度の消去で最下段の1段だけが通常パネルになり、残りはおじゃまのまま", () => {
    const b = boardWithMatchReady();
    place(b, 0, 1, 6, 3);
    swapAndSettle(b, 2, 0);
    expect(garbageRows(b)).toBe(2);
    expect(b.garbage.size).toBe(1);
    const g = [...b.garbage.values()][0];
    expect(g.state).toBe("idle");
  });

  it("残った厚い板は、隣でもう一度消すと次の1段が通常パネルになる", () => {
    const b = boardWithMatchReady();
    place(b, 0, 1, 6, 3);
    swapAndSettle(b, 2, 0);
    expect(garbageRows(b)).toBe(2);
    // 板の真下の行を 1 1 4 1 2 0 に置き換え、(2, y) を入れ替えて 1 1 1 を揃える
    const g = [...b.garbage.values()][0];
    const y = g.y - 1;
    [1, 1, 4, 1, 2, 0].forEach((k, x) => {
      b.cells[y][x].kind = k;
    });
    swapAndSettle(b, 2, y);
    expect(garbageRows(b)).toBe(1);
  });

  it("同時に変身する板のパネルは、それだけで縦横に3つ揃う柄にならない（既存のパネルと合わさるのはよい）", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const b = new Board({ seed, kinds: 5, initialHeight: 0, noRise: true });
      b.setColumns([[0], [0], [1], [0], [2], [3]]);
      // 幅6の板を4枚重ねる。全部が一緒に変身し、各板の最下段（ここでは全段）がパネルになる
      for (let y = 1; y <= 4; y++) place(b, 0, y, 6, 1);
      b.cursor.x = 2;
      b.cursor.y = 0;
      b.tick({ ...NO_INPUT, swap: true });
      const events = run(b, 30);
      expect(events.some((e) => e.type === "garbageTransform"), `seed=${seed}`).toBe(true);
      const kinds = [1, 2, 3, 4].map((y) => [0, 1, 2, 3, 4, 5].map((x) => b.cells[y][x].revealKind));
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 6; x++) {
          const k = kinds[y][x];
          expect(k, `seed=${seed} (${x},${y + 1}) 未決定`).not.toBe(-1);
          if (x >= 2) expect(k === kinds[y][x - 1] && k === kinds[y][x - 2], `seed=${seed} 横に3つ (${x},${y + 1})\n${b}`).toBe(false);
          if (y >= 2) expect(k === kinds[y - 1][x] && k === kinds[y - 2][x], `seed=${seed} 縦に3つ (${x},${y + 1})\n${b}`).toBe(false);
        }
    }
  });

  it("厚い板の上に乗った厚さ1段の板は、下の板と一緒に全部が通常パネルになる", () => {
    const b = boardWithMatchReady();
    place(b, 0, 1, 6, 2);
    place(b, 0, 3, 6, 1);
    swapAndSettle(b, 2, 0);
    // 厚い板は1段残り、上の薄い板は消える
    expect(garbageRows(b)).toBe(1);
    expect(b.garbage.size).toBe(1);
  });
});
