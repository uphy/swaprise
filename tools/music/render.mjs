// 曲を楽譜（abcjs）とピアノロールの PNG にする。音を聞けなくても、旋律の輪郭・リズムの型・織りを目で確かめるため。
//
//   node tools/music/render.mjs --candidate 10            # 試聴ページの候補 10
//   node tools/music/render.mjs --abc melody.abc          # ABC ファイル
//   --out dir で出力先（既定 test-results/music）
//
// 楽譜は旋律トラック（leadSq, flute, clav …）を声部にして描く。ピアノロールは全トラック。
// 描画は Playwright の Chromium で行う（画像ファイルは書かない方針の repo なので、出力先は git 管理外）。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { abcToSeq, loadCandidates, melodyTracks, MELODY_INSTRUMENTS, parseSeq, pianoRollSvg, seqToAbc } from "./notation.mjs";

const HTML = path.resolve("tools/bgm-candidates.html");
const ABCJS = path.resolve("node_modules/abcjs/dist/abcjs-basic-min.js");

function parseArgs(argv) {
  const out = { candidates: [], abc: [], outDir: "test-results/music" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--candidate") out.candidates.push(Number(argv[++i]));
    else if (argv[i] === "--abc") out.abc.push(argv[++i]);
    else if (argv[i] === "--out") out.outDir = argv[++i];
    else throw new Error(`知らない引数: ${argv[i]}`);
  }
  if (!out.candidates.length && !out.abc.length) throw new Error("--candidate 番号 か --abc ファイル を指定する");
  return out;
}

/** 描く対象。voices は楽譜（旋律）、tracks はピアノロール（全部）。 */
function subjectFromSong(song, n) {
  const melody = melodyTracks(song);
  const meter = song.beat === 12 ? "6/8" : song.beat === 16 ? "4/4" : `${song.beat}/16`;
  return {
    slug: `candidate-${n}`,
    title: song.name,
    abc: seqToAbc(melody.map((t) => ({ name: t.inst, events: t.events })), { beat: song.beat, meter, chords: song.chords, title: song.name }),
    tracks: song.tracks.map((t) => ({ name: t.inst, events: t.events, melody: MELODY_INSTRUMENTS.includes(t.inst) })),
    beat: song.beat,
    chords: song.chords,
  };
}

async function subjectFromAbc(file) {
  const text = await readFile(file, "utf8");
  const tune = abcToSeq(text);
  const tracks = tune.voices.map((v, i) => ({ name: `V:${v.name}`, events: parseSeq(v.bars.join(" ")), melody: i === 0 }));
  return {
    slug: path.basename(file).replace(/\.abc$/, ""),
    title: path.basename(file),
    abc: text,
    tracks,
    beat: tune.beat,
    chords: tune.voices[0]?.chords.some(Boolean) ? tune.voices[0].chords : null,
  };
}

async function render(page, subject, outDir) {
  const notation = path.join(outDir, `${subject.slug}-notation.png`);
  const roll = path.join(outDir, `${subject.slug}-roll.png`);
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff"><div id="paper" style="display:inline-block;padding:8px"></div></body></html>`);
  await page.addScriptTag({ path: ABCJS });
  const warnings = await page.evaluate((abc) => {
    const tune = window.ABCJS.renderAbc("paper", abc, { staffwidth: 1100, scale: 1.3, wrap: { minSpacing: 1.6, maxSpacing: 2.6, preferredMeasuresPerLine: 4 } });
    return tune[0]?.warnings ?? [];
  }, subject.abc);
  if (warnings.length) console.warn(`${subject.slug}: abcjs の警告\n${warnings.join("\n")}`);
  await page.locator("#paper").screenshot({ path: notation });
  const svg = pianoRollSvg(subject.tracks, { beat: subject.beat, chords: subject.chords, title: subject.title });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#14141c">${svg}</body></html>`);
  await page.locator("svg").screenshot({ path: roll });
  await writeFile(path.join(outDir, `${subject.slug}.abc`), subject.abc);
  return [notation, roll];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.outDir, { recursive: true });
  const subjects = [];
  if (args.candidates.length) {
    const songs = await loadCandidates(HTML);
    for (const n of args.candidates) {
      if (!songs[n - 1]) throw new Error(`候補 ${n} がない（1〜${songs.length}）`);
      subjects.push(subjectFromSong(songs[n - 1], n));
    }
  }
  for (const file of args.abc) subjects.push(await subjectFromAbc(file));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    for (const s of subjects) {
      const files = await render(page, s, args.outDir);
      console.log(files.join("\n"));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
