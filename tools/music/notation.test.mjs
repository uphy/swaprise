import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { abcToSeq, chordTones, formatSeq, keyAccidentals, loadCandidates, melodyMetrics, melodyTracks, noteToMidi, parseAbc, parseSeq, pianoRollSvg, seqToAbc } from "./notation.mjs";

const HTML = path.resolve("tools/bgm-candidates.html");

test("音名と MIDI 番号", () => {
  assert.equal(noteToMidi("c4"), 60);
  assert.equal(noteToMidi("a4"), 69);
  assert.equal(noteToMidi("c#5"), 73);
  assert.equal(formatSeq(parseSeq("c5:2 e5+g5:4 r:2 a4")), "c5:2 e5+g5:4 r:2 a4:1");
});

test("和音記号と調号", () => {
  assert.deepEqual(chordTones("C"), [0, 4, 7]);
  assert.deepEqual(chordTones("Am7"), [9, 0, 4, 7]);
  assert.deepEqual(chordTones("Bb"), [10, 2, 5]);
  assert.deepEqual(keyAccidentals("C"), {});
  assert.deepEqual(keyAccidentals("D"), { f: 1, c: 1 });
  assert.deepEqual(keyAccidentals("F"), { b: -1 });
  assert.deepEqual(keyAccidentals("Am"), {});
  assert.deepEqual(keyAccidentals("Bm"), { f: 1, c: 1 });
});

test("ABC の旋律を seq 形式にする（1. ポップ・フェアリーの前半）", () => {
  const abc = `X:1
T:test
M:4/4
L:1/16
K:C
"C"e2 g2 e2 c2 d4 e4 | "G"d2 g2 d2 B2 c4 d4 |
"Am"e2 a2 e2 c2 B2 c2 d4 | "F"c4 A2 F2 G8 |]`;
  const r = abcToSeq(abc);
  assert.equal(r.beat, 16);
  assert.deepEqual(r.voices[0].bars, ["e5:2 g5:2 e5:2 c5:2 d5:4 e5:4", "d5:2 g5:2 d5:2 b4:2 c5:4 d5:4", "e5:2 a5:2 e5:2 c5:2 b4:2 c5:2 d5:4", "c5:4 a4:2 f4:2 g4:8"]);
  assert.deepEqual(r.voices[0].chords, ["C", "G", "Am", "F"]);
});

test("ABC の単位・タイ・付点の省略記法・和音・臨時記号・調号", () => {
  const abc = `X:1
M:4/4
L:1/8
K:D
F2 A2- A2 d2 | c>d e/f/ g z2 d2 | [F2A2] ^c c =c c G2 | G4 z4 |]`;
  const tune = parseAbc(abc);
  const bars = tune.voices[0].bars.map((b) => formatSeq(b.events));
  // L:1/8 なので 2 は 4 分音符。K:D で F と C はシャープ。タイで A を 8 に伸ばす
  assert.equal(bars[0], "f#4:4 a4:8 d5:4");
  // c>d は付点 8 分と 16 分。e/f/ は 16 分。g は 8 分。z2 は 4 分休符
  assert.equal(bars[1], "c#5:3 d5:1 e5:1 f#5:1 g5:2 r:4 d5:4");
  // 和音、明示のシャープ、小節内で効き続ける臨時記号、ナチュラルで戻す
  assert.equal(bars[2], "f#4+a4:4 c#5:2 c#5:2 c5:2 c5:2 g4:4");
  assert.equal(bars[3], "g4:8 r:8");
});

test("小節の長さが合わない ABC は小節番号つきで失敗する", () => {
  assert.throws(() => parseAbc("X:1\nM:4/4\nL:1/16\nK:C\nc4 d4 e4 |"), /小節 1 の長さが 12/);
  assert.throws(() => parseAbc("X:1\nM:4/4\nL:1/8\nK:C\n(3cde c2 d2 e2 |"), /連符/);
});

test("seq 形式 → ABC → seq 形式 で元に戻る（候補 1 の旋律）", async () => {
  const songs = await loadCandidates(HTML);
  const one = songs[0];
  const lead = melodyTracks(one)[0];
  const abc = seqToAbc([{ name: "lead", events: lead.events }], { beat: one.beat, chords: one.chords, title: one.name });
  const back = abcToSeq(abc);
  assert.equal(back.voices[0].bars.join(" "), formatSeq(lead.events));
  assert.deepEqual(back.voices[0].chords, one.chords);
});

test("小節をまたぐ音はタイで分けて往復できる", () => {
  const events = parseSeq("c5:12 e5:8 g5:12");
  const abc = seqToAbc([{ name: "v", events }], { beat: 16 });
  // e5:8 は 1 小節目に 4、2 小節目に 4 と分かれ、前の小節の最後にタイが付く。読み戻すと小節ごとの 2 音になる
  assert.match(abc, /c12 e4- \| e4 g12/);
  assert.equal(abcToSeq(abc).voices[0].bars.join(" "), "c5:12 e5:4 e5:4 g5:12");
});

test("旋律の指標（候補 1 が基準）", async () => {
  const songs = await loadCandidates(HTML);
  const one = songs[0];
  const m = melodyMetrics(melodyTracks(one)[0].events, { beat: one.beat, chords: one.chords });
  assert.equal(m.bars, 8);
  assert.equal(m.holdRatio, 1);
  assert.equal(m.rhythmMaxRepeat, 2);
  assert.ok(Math.abs(m.strongNonChordRatio - 5 / 16) < 1e-9);
  assert.ok(m.chordToneRatio > 0.7 && m.chordToneRatio < 0.8);
  // 同じリズムの型を繰り返し、強拍を全部構成音にした旋律は、印の付く値になる
  const dull = parseSeq(Array(8).fill("c5:2 e5:2 g5:2 c6:4 g5:2 e5:4").join(" "));
  const d = melodyMetrics(dull, { beat: 16, chords: Array(8).fill("C") });
  assert.equal(d.rhythmDistinct, 1 / 8);
  assert.equal(d.rhythmMaxRepeat, 8);
  assert.equal(d.strongNonChordRatio, 0);
  // 小節の中の跳躍は全部が構成音どうし。小節をまたぐ跳躍（e5 → 次の c5）は数えない
  assert.ok(d.arpeggioRatio > 0.8);
});

test("ピアノロールの SVG", async () => {
  const songs = await loadCandidates(HTML);
  const one = songs[0];
  const svg = pianoRollSvg(
    one.tracks.map((t) => ({ name: t.inst, events: t.events, melody: t.inst === "leadSq" })),
    { beat: one.beat, chords: one.chords, title: one.name },
  );
  assert.match(svg, /^<svg /);
  assert.ok((svg.match(/<rect /g) ?? []).length > 100);
  assert.match(svg, /1  C</);
});
