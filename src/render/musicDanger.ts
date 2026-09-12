import { COLS, DANGER_ROW, ROWS, isPanel, type Board } from "../core";

/** BGM用の危険判定。降ってくるおじゃまが天井を通過しただけでは曲を変えない。 */
export function musicDanger(board: Board): boolean {
  return stackHeight(board) > DANGER_ROW;
}

/** 落下・浮遊中のおじゃまを除く高さ。曲と空色で同じ積み上がりを見る。 */
export function stackHeight(board: Board): number {
  for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      const cell = board.cell(x, y);
      if (isPanel(cell)) return y + 1;
      const garbage = board.garbage.get(cell.garbage);
      if (garbage && (garbage.state === "idle" || garbage.state === "transforming")) return y + 1;
    }
  }
  return 0;
}
