// 旋律の検査。試聴ページの候補、または ABC ファイルの旋律を、基準（1. ポップ・フェアリー）と並べて指標を出し、
// 耳で嫌われた特徴（同じリズムの型の繰り返し、強拍が全部構成音、句末に伸ばしがない、など）に印を付ける。
//
//   node tools/music/check.mjs            # 旋律のある候補すべて
//   node tools/music/check.mjs 1 10       # 番号を選ぶ
//   node tools/music/check.mjs --abc melody.abc   # ABC の旋律（和音記号 "C" があれば和声の指標も出す）
//   --json で機械向けに出す
import { readFile } from "node:fs/promises";
import path from "node:path";
import { abcToSeq, loadCandidates, melodyMetrics, melodyTracks, parseSeq } from "./notation.mjs";

const HTML = path.resolve("tools/bgm-candidates.html");
/** 基準にする候補（1 始まり）。 */
const REFERENCE = 1;

/** 指標の見出しと、基準に対してどう外れたら印を付けるか。 */
const AXES = [
  { key: "bars", label: "小節", fmt: (v) => String(v) },
  { key: "notesPerBar", label: "音符/小節", fmt: (v) => v.toFixed(1) },
  { key: "rhythmDistinct", label: "リズムの型の種類/小節", fmt: (v) => v.toFixed(2), flag: (v, r) => v < r - 0.2 && "同じ型の繰り返しが多い" },
  { key: "rhythmMaxRepeat", label: "同じ型の最長連続", fmt: (v) => String(v), flag: (v) => v >= 4 && "同じ型が 4 小節以上続く" },
  { key: "barNovelty", label: "新しい小節の割合", fmt: (v) => v.toFixed(2), flag: (v) => v < 0.5 && "同じ小節の使い回しが半分以上" },
  { key: "holdRatio", label: "句末の伸ばし（4 分以上）", fmt: (v) => v.toFixed(2), flag: (v) => v < 0.5 && "小節の終わりで伸ばさない" },
  { key: "restRatio", label: "休符の割合", fmt: (v) => v.toFixed(2) },
  { key: "stepRatio", label: "順次進行の割合", fmt: (v) => v.toFixed(2) },
  { key: "leapRatio", label: "跳躍の割合", fmt: (v) => v.toFixed(2), flag: (v, r) => v > r + 0.2 && "跳躍が多い" },
  { key: "intervalEntropy", label: "音程の散らばり (bit)", fmt: (v) => v.toFixed(2), flag: (v, r) => v < r - 0.5 && "同じ音程の動きばかり" },
  { key: "ascendingRatio", label: "上行の割合", fmt: (v) => v.toFixed(2) },
  { key: "range", label: "音域（半音）", fmt: (v) => String(v) },
  { key: "chordToneRatio", label: "構成音の割合", fmt: (v) => v.toFixed(2) },
  { key: "arpeggioRatio", label: "跳躍のうち構成音→構成音", fmt: (v) => v.toFixed(2), flag: (v, r) => v > r + 0.1 && "跳躍が分散和音そのもの" },
  { key: "strongNonChordRatio", label: "強拍の経過音の割合", fmt: (v) => v.toFixed(2), flag: (v, r) => v === 0 && r > 0.1 && "強拍が全部構成音（歌に聞こえにくい）" },
];

function parseArgs(argv) {
  const out = { numbers: [], abc: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--abc") out.abc.push(argv[++i]);
    else if (argv[i] === "--json") out.json = true;
    else if (/^\d+$/.test(argv[i])) out.numbers.push(Number(argv[i]));
    else throw new Error(`知らない引数: ${argv[i]}`);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const songs = await loadCandidates(HTML);
  const subjects = [];
  const ref = songs[REFERENCE - 1];
  const refTrack = melodyTracks(ref)[0];
  const refMetrics = melodyMetrics(refTrack.events, { beat: ref.beat, chords: ref.chords });
  const wanted = args.numbers.length ? args.numbers : songs.map((_, i) => i + 1);
  for (const n of wanted) {
    const song = songs[n - 1];
    if (!song) throw new Error(`候補 ${n} がない（1〜${songs.length}）`);
    for (const t of melodyTracks(song)) {
      subjects.push({ name: `${n} ${t.inst}`, metrics: melodyMetrics(t.events, { beat: song.beat, chords: song.chords }) });
    }
  }
  for (const file of args.abc) {
    const tune = abcToSeq(await readFile(file, "utf8"));
    for (const v of tune.voices) {
      const events = parseSeq(v.bars.join(" "));
      subjects.push({ name: `${path.basename(file)} V:${v.name}`, metrics: melodyMetrics(events, { beat: tune.beat, chords: v.chords.some(Boolean) ? v.chords : null }) });
    }
  }
  if (args.json) {
    console.log(JSON.stringify({ reference: { name: `${REFERENCE} ${refTrack.inst}`, metrics: refMetrics }, subjects }, null, 2));
    return;
  }
  const cols = [{ name: `基準 ${REFERENCE}`, metrics: refMetrics }, ...subjects.filter((s) => !(s.name === `${REFERENCE} ${refTrack.inst}`))];
  // 端末での表示幅。全角は 2 列
  const dw = (s) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) > 255 ? 2 : 1), 0);
  const width = Math.max(...cols.map((c) => dw(c.name))) + 2;
  const labelW = Math.max(...AXES.map((a) => dw(a.label))) + 2;
  const pad = (s, w) => s + " ".repeat(Math.max(0, w - dw(s)));
  console.log(pad("", labelW) + cols.map((c) => pad(c.name, width)).join(""));
  const flags = new Map();
  for (const axis of AXES) {
    const cells = cols.map((c) => {
      const v = c.metrics[axis.key];
      if (v === null || v === undefined) return "-";
      const r = refMetrics[axis.key];
      const f = axis.flag && c.name !== cols[0].name && r !== null ? axis.flag(v, r) : false;
      if (f) flags.set(c.name, [...(flags.get(c.name) ?? []), `${axis.label}: ${f}`]);
      return axis.fmt(v) + (f ? " !" : "");
    });
    console.log(pad(axis.label, labelW) + cells.map((s) => pad(s, width)).join(""));
  }
  console.log("");
  if (flags.size === 0) console.log("印なし");
  for (const [name, list] of flags) console.log(`${name}\n${list.map((l) => `  ! ${l}`).join("\n")}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
