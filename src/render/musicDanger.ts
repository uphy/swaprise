import { COLS, DANGER_ROW, ROWS, isPanel, type Board } from "../core";

/** BGM用の危険判定。降ってくるおじゃまが天井を通過しただけでは曲を変えない。 */
export function musicDanger(board: Board): boolean {
  for (let y = DANGER_ROW; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board.cell(x, y);
      if (isPanel(cell)) return true;
      const garbage = board.garbage.get(cell.garbage);
      if (garbage && (garbage.state === "idle" || garbage.state === "transforming")) return true;
    }
  }
  return false;
}
