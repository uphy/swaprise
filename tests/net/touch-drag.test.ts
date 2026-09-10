import { expect, it } from "vitest";
import { Board } from "../../src/core/board";
import { TouchInput } from "../../src/render/touch";
import { BOARD_H, CELL } from "../../src/render/theme";

function setup(scale = 1) {
  const board = new Board({ seed: 1, noRise: true });
  board.setColumns([[0], [1], [2], [3], [4], [0]]);
  const listeners = new Map<string, (p: unknown) => void>();
  const touch = new TouchInput({ input: {
    on(event: string, fn: Function, context: unknown) { listeners.set(event, fn.bind(context)); },
    off() {},
  } } as any, board);
  touch.place(0, 0, scale);
  const send = (event: string, x: number) => listeners.get(event)!({
    id: 1, worldX: (x + 0.5) * CELL * scale, worldY: (BOARD_H - CELL / 2) * scale,
  });
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) board.tick(touch.poll().action ?? undefined);
  };
  return { board, touch, send, tick };
}

it.each([0.75, 1, 1.5])("交換直後の微振動で逆戻りせず、明確に戻すと交換できる (scale=%s)", (scale) => {
  const { board, touch, send, tick } = setup(scale);
  send("pointerdown", 1);
  expect(touch.feedback).toEqual({ x: 1, y: 0, targetX: 1 });
  send("pointermove", 1.7);
  tick(10);
  for (const x of [1.69, 1.71, 1.68, 1.7]) { send("pointermove", x); tick(10); }
  expect(board.cell(2, 0).kind).toBe(1);
  expect(touch.feedback?.targetX).toBe(2);
  send("pointermove", 1.3);
  tick(10);
  expect(board.cell(1, 0).kind).toBe(1);
});

it.each([1, 20])("イベント数%sでも同じ移動先に届き、離した後に予約が失われない", (steps) => {
  const { board, touch, send, tick } = setup();
  send("pointerdown", 0);
  for (let i = 1; i <= steps; i++) send("pointermove", 4 * i / steps);
  expect(touch.feedback?.targetX).toBe(4);
  send("pointerup", 4);
  tick(50);
  expect(board.cell(4, 0).kind).toBe(0);
  expect(touch.feedback).toBeNull();
});

it("離した位置の最終座標も認識する", () => {
  const { board, send, tick } = setup();
  send("pointerdown", 0);
  send("pointerup", 3);
  tick(50);
  expect(board.cell(3, 0).kind).toBe(0);
});

it("離した後の移動中でも、途中で揃ったらそこで消える", () => {
  const { board, touch, send, tick } = setup();
  board.setColumns([[1], [0], [1], [1], [2], [3]]);
  send("pointerdown", 0);
  send("pointerup", 4);
  tick(100);
  expect(board.panelsCleared).toBe(3);
  expect(board.cell(4, 0).kind).toBe(2);
  expect(touch.feedback).toBeNull();
});

it("新たに触れたら、前の操作の残りを取り消す", () => {
  const { board, touch, send, tick } = setup();
  send("pointerdown", 0);
  send("pointerup", 4);
  send("pointerdown", 5);
  tick(20);
  expect(board.cell(0, 0).kind).toBe(0);
  expect(touch.feedback).toEqual({ x: 5, y: 0, targetX: 5 });
  touch.clear();
  expect(touch.feedback).toBeNull();
});
