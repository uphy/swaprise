import { KIND_COLORS } from "./theme";

/**
 * オープニングで組み立てる題字。ゲームのパネルを 5×7 のドット文字に並べて "SWAPRISE" を作る。
 * DOM・Phaser に依存しない。座標はマス単位で、OpeningScene が画面上の大きさに換算する。
 */

export const TITLE = "SWAPRISE";

/** 5 列 × 7 行のドット文字。# が埋まっているマス。 */
export const PIXEL_FONT: Record<string, readonly string[]> = {
  S: [".###.", "#...#", "#....", ".###.", "....#", "#...#", ".###."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
};
export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** 文字と文字の間（マス）。 */
export const LETTER_GAP = 1;
/** 行と行の間（マス）。縦持ちで SWAP / RISE の 2 行にするとき。 */
export const LINE_GAP = 2;

export interface LogoCell {
  /** 何文字目か（0 始まり、行をまたいで通し）。 */
  letter: number;
  /** 題字全体のマス座標。左上が (0, 0)。 */
  col: number;
  row: number;
  /** 柄。文字ごとに 1 色。 */
  kind: number;
}

export interface LogoLetter {
  char: string;
  /** 文字の左上のマス座標。 */
  col: number;
  row: number;
  kind: number;
  /** この文字のマス。読む順（上の行から左から右へ）。 */
  cells: LogoCell[];
}

export interface LogoGrid {
  lines: readonly string[];
  /** 題字全体の大きさ（マス）。 */
  cols: number;
  rows: number;
  cells: LogoCell[];
  letters: LogoLetter[];
  /**
   * 入れ替えの演出。cell をひとつ左の空きマス（fromCol）にずらして置いておき、カーソルで元の位置へ戻すと
   * 最初の文字が完成して連鎖が始まる。
   */
  swap: { cell: LogoCell; fromCol: number };
}

/** 縦持ちは 2 行（SWAP / RISE）、横長は 1 行。 */
export function logoLines(portrait: boolean): readonly string[] {
  return portrait ? [TITLE.slice(0, 4), TITLE.slice(4)] : [TITLE];
}

/** 横幅 width（論理 px）に cols マスを収めるマスの大きさ。max を上限にし、左右に margin ずつ余白を残す。 */
export function logoCellSize(width: number, cols: number, max: number, margin = 12): number {
  return Math.max(1, Math.min(max, Math.floor((width - margin * 2) / cols)));
}

/** 行ごとの文字列から題字のマスを組み立てる。文字の色は KIND_COLORS を順に使う。 */
export function buildLogo(lines: readonly string[]): LogoGrid {
  const cells: LogoCell[] = [];
  const letters: LogoLetter[] = [];
  let cols = 0;
  let letter = 0;
  lines.forEach((line, li) => {
    const row0 = li * (GLYPH_H + LINE_GAP);
    const lineCols = line.length * (GLYPH_W + LETTER_GAP) - LETTER_GAP;
    cols = Math.max(cols, lineCols);
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const glyph = PIXEL_FONT[char];
      if (!glyph) throw new Error(`ドット文字がない: ${char}`);
      const col0 = i * (GLYPH_W + LETTER_GAP);
      const kind = letter % KIND_COLORS.length;
      const mine: LogoCell[] = [];
      glyph.forEach((rowText, r) => {
        for (let c = 0; c < GLYPH_W; c++) {
          if (rowText[c] !== "#") continue;
          const cell: LogoCell = { letter, col: col0 + c, row: row0 + r, kind };
          mine.push(cell);
          cells.push(cell);
        }
      });
      letters.push({ char, col: col0, row: row0, kind, cells: mine });
      letter++;
    }
  });
  const rows = lines.length * (GLYPH_H + LINE_GAP) - LINE_GAP;
  // 最初の文字の上辺の左端のマスを、ひとつ左（文字の角の空きマス）にずらしておく
  const first = letters[0].cells[0];
  return { lines, cols, rows, cells, letters, swap: { cell: first, fromCol: first.col - 1 } };
}
