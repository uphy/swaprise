import { expect, it } from "vitest";
import { Board } from "../../src/core/board";
import { TouchInput } from "../../src/render/touch";
import { BOARD_H, CELL } from "../../src/render/theme";
it("通信で未適用の交換がある間は、次のドラッグ交換を先送りする", () => {
  const board = new Board({ seed: 1, noRise: true });
  board.setColumns([
    [0, 1],
    [2, 3],
    [4, 0],
    [1, 2],
    [3, 4],
    [0, 1],
  ]);
  const touch = new TouchInput({ input: { on() {}, off() {} } } as any, board);
  (touch as any).onDown({
    id: 1,
    worldX: CELL / 2,
    worldY: BOARD_H - CELL / 2,
  });
  (touch as any).onMove({
    id: 1,
    worldX: CELL * 1.5,
    worldY: BOARD_H - CELL / 2,
  });
  expect(touch.poll().action?.swap).toBe(true);
  // 交換入力をframe 6に予約した状態。
  touch.deferUntil(7);
  (touch as any).onMove({
    id: 1,
    worldX: CELL * 2.5,
    worldY: BOARD_H - CELL / 2,
  });
  expect(touch.poll().action).toBeNull();
});
