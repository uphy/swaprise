// 結果カードの見本を各モードぶん書き出す。実行: pnpm ogp:samples → /tmp/swaprise-cards/*.png
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { CARD_H, CARD_W, encodePng, renderCard, type CardSpec } from "../src/ogp/card";

const OUT = "/tmp/swaprise-cards";
mkdirSync(OUT, { recursive: true });

const samples: Record<string, CardSpec> = {
  endless: { mode: "ENDLESS", main: "12,340", caption: "POINTS", subs: [{ text: "MAX CHAIN ×7" }, { text: "RANK #38 / 512" }] },
  timeattack: { mode: "TIME ATTACK 2:00", main: "9,870", caption: "POINTS", subs: [{ text: "MAX CHAIN ×4" }] },
  puzzle: { mode: "PUZZLE", main: "CLEAR", mainColor: 0x7cf57a, subs: [{ text: "STAGE 12" }, { text: "0 MOVES LEFT" }] },
  cpu: { mode: "VS CPU", main: "WIN", mainColor: 0xffe066, subs: [{ text: "CPU HARD" }, { text: "MAX CHAIN ×9" }] },
  online: { mode: "ONLINE", main: "LOSE", mainColor: 0xd9d4f2, subs: [{ text: "VS TARO  3W 1L" }, { text: "MAX CHAIN ×3" }] },
};

for (const [name, spec] of Object.entries(samples)) {
  const t0 = performance.now();
  const raw = renderCard(spec);
  const png = await encodePng(CARD_W, CARD_H, raw, (d) => deflateSync(d, { level: 6 }));
  writeFileSync(`${OUT}/${name}.png`, png);
  console.log(`${OUT}/${name}.png  ${Math.round(performance.now() - t0)} ms  ${png.length} bytes`);
}
