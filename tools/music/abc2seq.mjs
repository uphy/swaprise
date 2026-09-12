// ABC 記譜を試聴ページ・bgm.ts の音符列（seq 形式）にする。
//
//   node tools/music/abc2seq.mjs melody.abc
//
// 声部ごとに、小節ごとの文字列を JS の配列で出す。tools/bgm-candidates.html の tracks にそのまま貼れる。
import { readFile } from "node:fs/promises";
import { abcToSeq } from "./notation.mjs";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("ABC ファイルを指定する");
  const tune = abcToSeq(await readFile(file, "utf8"));
  for (const v of tune.voices) {
    console.log(`// V:${v.name}  ${v.bars.length} 小節, beat ${tune.beat}`);
    console.log("[");
    for (const bar of v.bars) console.log(`  '${bar}',`);
    console.log("]");
    if (v.chords.some(Boolean)) console.log(`// chords: ${JSON.stringify(v.chords)}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
