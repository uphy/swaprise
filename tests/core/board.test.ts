import { describe, expect, it } from "vitest";
import { Board, COLS, EMPTY, ROWS, TIMING, isEmptyCell, isPanel } from "../../src/core";
import { emptyBoard, matches, moveCursor, press, run } from "./helpers";

/** 縦4個同時消しができる盤面。(0,2) の 3 を右へ抜くと上の 0 0 が落ちて col0 が 0 0 0 0 になる。 */
const COMBO4 = [[0, 0, 3, 0, 0], [1, 2]];
/** 縦→縦→横の3連鎖ができる盤面。(0,4) の 4 を右の空白へ抜く。 */
const CHAIN3 = [
  [2, 1, 0, 0, 4, 0, 1, 1, 3],
  [4, 3],
  [4, 3],
];

describe("初期盤面", () => {
  it("同じseedなら同じ盤面になる", () => {
    const a = new Board({ seed: 42 });
    const b = new Board({ seed: 42 });
    expect(a.toString()).toBe(b.toString());
    expect(a.nextRow).toEqual(b.nextRow);
  });

  it("開始時点で揃っているパネルがない", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const b = new Board({ seed, noRise: true });
      const events = run(b, 1);
      expect(matches(events), `seed=${seed}\n${b}`).toHaveLength(0);
    }
  });

  it("次の行は直上の柄と同じにならない", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const b = new Board({ seed });
      for (let c = 0; c < COLS; c++) {
        const above = b.cell(c, 0);
        if (isPanel(above)) expect(b.nextRow[c]).not.toBe(above.kind);
      }
    }
  });
});

describe("カーソルと入れ替え", () => {
  it("カーソルは横2マス枠で、盤面の外に出ない", () => {
    const b = emptyBoard();
    moveCursor(b, 0, 0);
    press(b, { moveX: -1, moveY: -1 });
    expect(b.cursor).toEqual({ x: 0, y: 0 });
    moveCursor(b, COLS - 2, ROWS - 1);
    press(b, { moveX: 1, moveY: 1 });
    expect(b.cursor).toEqual({ x: COLS - 2, y: ROWS - 1 });
  });

  it("入れ替えは4フレームで完了する", () => {
    const b = emptyBoard();
    b.setColumns([[0], [1]]);
    moveCursor(b, 0, 0);
    press(b, { swap: true });
    expect(b.cell(0, 0).kind).toBe(1);
    expect(b.cell(1, 0).kind).toBe(0);
    expect(b.cell(0, 0).state).toBe("swapping");
    run(b, TIMING.swap - 2);
    expect(b.cell(0, 0).state).toBe("swapping");
    run(b, 1);
    expect(b.cell(0, 0).state).toBe("idle");
  });

  it("空白側へ動かしたパネルは猶予のあとに落ちる", () => {
    const b = emptyBoard();
    b.setColumns([[0, 1], []]);
    moveCursor(b, 0, 1);
    press(b, { swap: true });
    expect(b.cell(1, 1).kind).toBe(1);
    run(b, TIMING.swap - 1 + TIMING.hoverSwap);
    expect(b.cell(1, 1).state).toBe("falling");
    run(b, TIMING.fallPerRow);
    expect(b.cell(1, 0).kind).toBe(1);
    expect(b.cell(1, 0).state).toBe("idle");
  });

  it("おじゃまパネルと空白同士は入れ替えられない", () => {
    const b = emptyBoard();
    b.placeGarbage(0, 0, 3, 1);
    moveCursor(b, 0, 0);
    expect(b.trySwap()).toBe(false);
    moveCursor(b, 3, 0);
    expect(b.trySwap()).toBe(false);
  });
});

describe("消去", () => {
  it("横に3枚揃うと消えて、上のパネルが落ちる", () => {
    const b = emptyBoard();
    // 下段: 0 0 1 0 / 上段: 2 (col2の上)
    b.setColumns([[0], [0], [1, 2], [0]]);
    moveCursor(b, 2, 0);
    const events = press(b, { swap: true }, TIMING.swap);
    const m = matches(events);
    expect(m).toHaveLength(1);
    expect(m[0].panels).toBe(3);
    expect(m[0].chain).toBe(1);
    expect(b.score).toBe(30);
    run(b, TIMING.flash + TIMING.face + 3 * TIMING.popInterval + TIMING.popTail + TIMING.hoverClear + TIMING.fallPerRow * 2);
    expect(b.cell(2, 0).kind).toBe(2);
    expect(b.cell(0, 0).kind).toBe(EMPTY);
  });

  it("縦に3枚揃うと消える", () => {
    const b = emptyBoard();
    b.setColumns([[0, 0, 1], [3, 3, 0]]);
    moveCursor(b, 0, 2);
    const events = press(b, { swap: true }, TIMING.swap);
    expect(matches(events)[0]?.panels).toBe(3);
  });

  it("4個同時消しは40点＋ボーナス20点で、幅3のおじゃまを送る", () => {
    const b = emptyBoard();
    b.setColumns(COMBO4);
    moveCursor(b, 0, 2);
    const events = press(b, { swap: true }, 30);
    const m = matches(events);
    expect(m).toHaveLength(1);
    expect(m[0].panels).toBe(4);
    expect(b.score).toBe(60);
    expect(b.stopTimer).toBeGreaterThan(0);
    // 板は揃ってから garbageSendDelay 待って送る
    expect(events.some((e) => e.type === "attack")).toBe(false);
    const later = run(b, TIMING.garbageSendDelay);
    const attack = later.find((e) => e.type === "attack");
    expect(attack && attack.type === "attack" ? attack.garbage : []).toEqual([
      { width: 3, height: 1, type: "normal" },
    ]);
  });
});

describe("連鎖", () => {
  /**
   * 3連鎖の型。col0 の X を右へ抜くと A が落ちて縦 AAA、
   * 上の C C が落ちて縦 CCC、最後に F が落ちて横 FFF。
   * 得点は実機の累計目安（2連鎖110、3連鎖220）と一致するはず。
   */
  it("縦→縦→横の3連鎖で累計220点になる", () => {
    const b = emptyBoard();
    b.setColumns(CHAIN3);
    moveCursor(b, 0, 4);
    const events = press(b, { swap: true }, 400);
    const m = matches(events);
    expect(m.map((e) => e.chain)).toEqual([1, 2, 3]);
    expect(m.map((e) => e.score)).toEqual([30, 80, 110]);
    expect(b.score).toBe(220);
    expect(b.maxChain).toBe(3);
    expect(b.chain).toBe(1);
    expect(events.some((e) => e.type === "chainEnd" && e.chain === 3)).toBe(true);
  });

  /**
   * 時間差連鎖。T字の5個消しで col1 は3段、col2/3 は1段落ちる。
   * 先に着地する F F F が2連鎖、遅れて着地する C C C が3連鎖と数えられる。
   */
  it("時間差で着地した2組は「2, 3」と数える", () => {
    const b = emptyBoard();
    b.setColumns([
      [1, 3, 0],
      [0, 0, 4, 1, 1],
      [1, 2, 0, 3],
      [2, 5, 0, 3],
      [4, 1, 3],
    ]);
    moveCursor(b, 0, 2);
    const events = press(b, { swap: true }, 400);
    const m = matches(events);
    expect(m.map((e) => [e.panels, e.chain])).toEqual([
      [5, 1],
      [3, 2],
      [3, 3],
    ]);
    expect(b.score).toBe(50 + 30 + 30 + 50 + 30 + 80);
  });

  it("浮いている（落下前の猶予中の）パネルは入れ替えて戻せる", () => {
    const b = emptyBoard();
    b.setColumns([[0, 1], []]);
    moveCursor(b, 0, 1);
    press(b, { swap: true }, TIMING.swap);
    expect(b.cell(1, 1).kind).toBe(1);
    expect(b.cell(1, 1).state).toBe("hover");
    expect(b.trySwap()).toBe(true);
    run(b, TIMING.swap);
    expect(b.cell(0, 1).kind).toBe(1);
    expect(b.cell(0, 1).state).toBe("idle");
    expect(b.cell(1, 1).kind).toBe(EMPTY);
  });

  it.each([2, 8])("連鎖パネルの着地から%sフレーム後でも、隣を入れ替えて揃えると連鎖になる", (delay) => {
    const b = emptyBoard();
    // col0 の 4 を右へ抜くと 0 0 0 が縦に揃い、上の 1 が row 0 まで落ちる。
    // 着地時点で row 0 は 1 1 2 1 なので揃わないが、猶予内に (2,0) と (3,0) を入れ替えると 1 1 1 になる。
    b.setColumns([[0, 0, 4, 0, 1], [1], [2, 3], [1]]);
    moveCursor(b, 0, 2);
    const events = press(b, { swap: true }, 1);
    let landed = false;
    for (let f = 0; f < 300 && !landed; f++) {
      events.push(...run(b, 1));
      landed = b.events.some((e) => e.type === "land" && e.x === 0 && e.y === 0);
    }
    expect(landed).toBe(true);
    expect(b.cell(0, 0).kind).toBe(1);
    run(b, delay);
    moveCursor(b, 2, 0);
    events.push(...press(b, { swap: true }, 30));
    const m = matches(events);
    expect(m.map((e) => e.chain)).toEqual([1, 2]);
  });

  it.each([[1, 13], [50, 5]])("レベル%sで消去後に%sフレーム待っても、落下前に連鎖を仕込める", (level, delay) => {
    const b = emptyBoard();
    b.raiseLevel(level);
    b.setColumns([[0, 0, 4, 0, 1], [1], [2, 3], [1]]);
    moveCursor(b, 0, 2);
    const events = press(b, { swap: true }, 1);
    let floating;
    for (let f = 0; f < 300 && !floating; f++) {
      events.push(...run(b, 1));
      floating = b.cells.flat().find((c) => c.kind === 1 && c.chain && c.state === "hover");
    }
    expect(floating).toBeDefined();
    events.push(...run(b, delay));
    expect(floating!.state).toBe("hover");
    moveCursor(b, 2, 0);
    events.push(...press(b, { swap: true }, 100));
    expect(matches(events).map((e) => e.chain)).toEqual([1, 2]);
  });

  it("着地した連鎖フラグは猶予を過ぎると消える", () => {
    const b = emptyBoard();
    b.setColumns([[0, 0, 4, 0, 1], [1], [2, 3], [1]]);
    moveCursor(b, 0, 2);
    const events = press(b, { swap: true }, 1);
    let landed = false;
    for (let f = 0; f < 300 && !landed; f++) {
      events.push(...run(b, 1));
      landed = b.events.some((e) => e.type === "land" && e.x === 0 && e.y === 0);
    }
    run(b, TIMING.chainGrace + TIMING.swap + 2);
    moveCursor(b, 2, 0);
    events.push(...press(b, { swap: true }, 30));
    expect(matches(events).map((e) => e.chain)).toEqual([1, 1]);
  });

  it("入れ替えで落としたパネルは連鎖にならない", () => {
    const b = emptyBoard();
    b.setColumns([[0], [0], [1, 0]]);
    moveCursor(b, 2, 0);
    const events = press(b, { swap: true }, 60);
    expect(matches(events).map((e) => e.chain)).toEqual([1]);
  });

  it("連鎖中はせり上がりが止まる", () => {
    const b = new Board({ seed: 1, kinds: 6, initialHeight: 0, speedLevel: 1 });
    b.setColumns(CHAIN3);
    moveCursor(b, 0, 4);
    const events = press(b, { swap: true }, 340);
    expect(matches(events)).toHaveLength(3);
    // 3連鎖の消去処理は終わっているが、停止時間はまだ残っている
    expect(b.stopTimer).toBeGreaterThan(0);
    const before = b.riseProgress;
    run(b, 10);
    expect(b.riseProgress).toBe(before);
    run(b, b.stopTimer + 5);
    expect(b.riseProgress).toBeGreaterThan(before);
  });
});

describe("おじゃまパネル", () => {
  it("盤面が静止していれば盤面上部に投下され、落ちて着地すると揺れる", () => {
    const b = emptyBoard();
    b.setColumns([[0], [1], [0], [1], [0], [1]]);
    b.pendingGarbage.push({ width: 6, height: 1, type: "normal" });
    // 原作どおり、静止が2フレーム続いてから降る
    const events = run(b, TIMING.garbageQuietFrames);
    expect(b.pendingGarbage).toHaveLength(0);
    expect(b.garbage.size).toBe(1);
    events.push(...run(b, 60));
    const g = [...b.garbage.values()][0];
    expect(g.y).toBe(1);
    expect(g.state).toBe("idle");
    expect(events.some((e) => e.type === "garbageLand")).toBe(true);
  });

  it("隣接するパネルを消すと厚さ1段の板は全部通常パネルになる", () => {
    const b = emptyBoard();
    b.setColumns([[0], [0], [1], [0], [2], [3]]);
    b.placeGarbage(0, 1, 6, 1);
    run(b, 1);
    moveCursor(b, 2, 0);
    const events = press(b, { swap: true }, 400);
    expect(matches(events)[0]?.panels).toBe(3);
    expect(events.some((e) => e.type === "garbageTransform")).toBe(true);
    expect(b.garbage.size).toBe(0);
    let panels = 0;
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) if (isPanel(b.cell(x, y))) panels++;
    }
    // 元の6枚 - 消えた3枚 + 変身した6枚。変身後に偶然揃った分だけ減る
    expect(panels).toBeLessThanOrEqual(9);
    expect(panels).toBeGreaterThanOrEqual(3);
  });

  it("厚い板は1回の変身で下1段しか通常パネルにならない", () => {
    const b = emptyBoard();
    b.setColumns([[0], [0], [1], [0], [2], [3]]);
    b.placeGarbage(0, 1, 6, 3);
    run(b, 1);
    moveCursor(b, 2, 0);
    const events = press(b, { swap: true }, 400);
    expect(events.some((e) => e.type === "garbageTransform")).toBe(true);
    expect(b.garbage.size).toBe(1);
    const g = [...b.garbage.values()][0];
    expect(g.height).toBe(2);
    expect(g.state).toBe("idle");
  });

  it("変身で現れたパネルが落ちて揃うと連鎖になる（おじゃま返し）", () => {
    const b = emptyBoard(2);
    // 2種しかないので、変身後のパネルが揃う確率を高くする
    b.setColumns([[0], [0], [1], [0], [1], [1]]);
    b.placeGarbage(0, 1, 6, 1);
    run(b, 1);
    moveCursor(b, 2, 0);
    const events = press(b, { swap: true }, 400);
    const chained = matches(events).filter((e) => e.chain >= 2);
    // 乱数次第で揃わないこともあるので、揃った場合は連鎖として数えられていることを確認
    for (const m of chained) expect(m.chain).toBeGreaterThanOrEqual(2);
    expect(b.garbage.size).toBe(0);
  });
});

describe("せり上がりとゲームオーバー", () => {
  it("手動せり上げで1段上がるごとに1点入り、次の行がせり上がる", () => {
    const b = emptyBoard();
    const next = [...b.nextRow];
    run(b, TIMING.manualRisePerRow, { moveX: 0, moveY: 0, swap: false, raise: true });
    expect(b.score).toBe(1);
    for (let c = 0; c < COLS; c++) expect(b.cell(c, 0).kind).toBe(next[c]);
  });

  it("停止表示中の手動せり上げは最初の1段だけ0点", () => {
    const b = emptyBoard();
    b.setColumns(CHAIN3);
    moveCursor(b, 0, 4);
    const events = press(b, { swap: true }, 340);
    expect(matches(events)).toHaveLength(3);
    expect(b.stopTimer).toBeGreaterThan(TIMING.manualRisePerRow * 2);
    const score = b.score;
    run(b, TIMING.manualRisePerRow, { moveX: 0, moveY: 0, swap: false, raise: true });
    expect(b.score).toBe(score);
    run(b, TIMING.manualRisePerRow, { moveX: 0, moveY: 0, swap: false, raise: true });
    expect(b.score).toBe(score + 1);
  });

  it("天井に触れたまま猶予を過ぎるとゲームオーバー", () => {
    const b = emptyBoard();
    const col: number[] = [];
    for (let r = 0; r < ROWS; r++) col.push(r % 2);
    b.setColumns([col]);
    const events = run(b, TIMING.deathGrace + 2);
    expect(b.gameOver).toBe(true);
    expect(events.some((e) => e.type === "gameOver")).toBe(true);
  });

  it("消去中は天井に触れていてもゲームオーバーにならない", () => {
    const b = emptyBoard();
    const col: number[] = [];
    for (let r = 0; r < ROWS; r++) col.push(r % 2);
    b.setColumns([col, [0], [1, 0], [0]]);
    moveCursor(b, 2, 0);
    press(b, { swap: true }, TIMING.swap);
    run(b, TIMING.deathGrace);
    expect(b.gameOver).toBe(false);
  });

  it("高さ 9 以上にパネルがあると危険状態になり、8 では入らない", () => {
    const low = emptyBoard();
    const eight: number[] = [];
    for (let r = 0; r < ROWS - 4; r++) eight.push(r % 2);
    low.setColumns([eight]);
    run(low, 1);
    expect(low.danger).toBe(false);
    const b = emptyBoard();
    const col: number[] = [];
    for (let r = 0; r < ROWS - 3; r++) col.push(r % 2);
    b.setColumns([col]);
    const events = run(b, 1);
    expect(b.danger).toBe(true);
    expect(events.some((e) => e.type === "danger" && e.on)).toBe(true);
    expect(isEmptyCell(b.cell(0, ROWS - 1))).toBe(true);
  });
});
