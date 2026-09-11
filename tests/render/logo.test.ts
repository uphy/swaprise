import { describe, expect, it } from "vitest";
import { GLYPH_H, GLYPH_W, LETTER_GAP, LINE_GAP, PIXEL_FONT, TITLE, buildLogo, logoCellSize, logoLines } from "../../src/render/logo";
import { KIND_COLORS } from "../../src/render/theme";

describe("ドット文字", () => {
  it("題字の全文字に 5×7 の字形がある", () => {
    for (const ch of TITLE) {
      const glyph = PIXEL_FONT[ch];
      expect(glyph, ch).toBeDefined();
      expect(glyph.length).toBe(GLYPH_H);
      for (const row of glyph) {
        expect(row.length).toBe(GLYPH_W);
        expect(row).toMatch(/^[.#]+$/);
      }
    }
  });

  it("横長は 1 行、縦持ちは SWAP / RISE の 2 行", () => {
    expect(logoLines(false)).toEqual(["SWAPRISE"]);
    expect(logoLines(true)).toEqual(["SWAP", "RISE"]);
  });
});

describe("buildLogo", () => {
  it("1 行の題字は 47 列 × 7 行で、文字ごとに柄が順に変わる", () => {
    const logo = buildLogo(["SWAPRISE"]);
    expect(logo.cols).toBe(8 * GLYPH_W + 7 * LETTER_GAP);
    expect(logo.rows).toBe(GLYPH_H);
    expect(logo.letters.map((l) => l.char).join("")).toBe("SWAPRISE");
    expect(logo.letters.map((l) => l.kind)).toEqual([0, 1, 2, 3, 4, 5, 0, 1]);
    // 隣り合う文字は違う色
    for (let i = 1; i < logo.letters.length; i++) expect(logo.letters[i].kind).not.toBe(logo.letters[i - 1].kind);
    expect(logo.letters.every((l) => l.kind < KIND_COLORS.length)).toBe(true);
    // マスの数は字形の # の数と一致し、文字ごとのマスは読む順
    const count = [...TITLE].reduce((n, ch) => n + PIXEL_FONT[ch].join("").split("#").length - 1, 0);
    expect(logo.cells.length).toBe(count);
    expect(logo.letters.reduce((n, l) => n + l.cells.length, 0)).toBe(count);
    for (const l of logo.letters) {
      for (let i = 1; i < l.cells.length; i++) {
        const a = l.cells[i - 1];
        const b = l.cells[i];
        expect(b.row > a.row || (b.row === a.row && b.col > a.col)).toBe(true);
      }
    }
  });

  it("2 行の題字は行の間を空けて積み、文字の通し番号と柄は行をまたいで続く", () => {
    const logo = buildLogo(["SWAP", "RISE"]);
    expect(logo.cols).toBe(4 * GLYPH_W + 3 * LETTER_GAP);
    expect(logo.rows).toBe(GLYPH_H * 2 + LINE_GAP);
    expect(logo.letters[4].char).toBe("R");
    expect(logo.letters[4].row).toBe(GLYPH_H + LINE_GAP);
    expect(logo.letters[4].col).toBe(0);
    expect(logo.letters.map((l) => l.kind)).toEqual([0, 1, 2, 3, 4, 5, 0, 1]);
    expect(logo.cells.every((c) => c.col >= 0 && c.col < logo.cols && c.row >= 0 && c.row < logo.rows)).toBe(true);
  });

  it("入れ替えの演出は最初の文字の上辺のマスを、左隣の空きマスへずらす", () => {
    const logo = buildLogo(["SWAPRISE"]);
    const { cell, fromCol } = logo.swap;
    expect(cell.letter).toBe(0);
    expect(cell.row).toBe(0);
    expect(fromCol).toBe(cell.col - 1);
    // ずらした先には別のマスがない（空きマスとの入れ替え）
    expect(logo.cells.some((c) => c.col === fromCol && c.row === cell.row)).toBe(false);
  });

  it("知らない文字は組み立てられない", () => {
    expect(() => buildLogo(["SWAP?"])).toThrow();
  });
});

describe("logoCellSize", () => {
  it("横幅に収まる最大のマスにし、上限を超えない", () => {
    expect(logoCellSize(800, 47, 14)).toBe(14);
    expect(logoCellSize(640, 47, 14)).toBe(13);
    expect(logoCellSize(300, 23, 14)).toBe(12);
    expect(23 * logoCellSize(300, 23, 14)).toBeLessThanOrEqual(300 - 24);
  });
});
