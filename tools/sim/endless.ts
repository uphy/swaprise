/**
 * エンドレスのシミュレーション。遅い CPU（人の代わり）と easy / normal、何も考えずになぞり続ける swiper にエンドレスを遊ばせ、
 * 生存時間と各レベルへの到達時刻、プレイの集計（得点・入れ替えあたりの揃い）を出す。1回のプレイの長さや操作の調整のときに見る。
 * 集計の項目は計測（src/net/track.ts の PLAY_STATS）と同じ意味なので、実プレイの記録と並べて比べられる。
 *
 *   pnpm sim endless         seed 1〜6
 *   pnpm sim endless 3       seed 1〜3
 */
import { Board, CpuPlayer, riseFramesPerRow, type CpuLevel } from "../../src/core";
import { avg, casualPlayer, fmt } from "./proxy";
import { SwipePlayer } from "./swiper";

const MAX = 60 * 60 * 15;

type Kind = "casual" | "swiper" | CpuLevel;

function play(kind: Kind, seed: number) {
  const b = new Board({ seed, speedLevel: 1, speedUp: true });
  const player = kind === "casual" ? casualPlayer(b) : kind === "swiper" ? new SwipePlayer(b, seed) : new CpuPlayer(b, kind);
  const lvAt: Record<number, number> = {};
  for (let f = 0; f < MAX && !b.gameOver; f++) {
    b.tick(player.next());
    for (const e of b.events) if (e.type === "levelUp") lvAt[e.level] = f;
  }
  const drag = player instanceof SwipePlayer ? player.stats : null;
  return { sec: b.frame / 60, level: b.level, manualRows: b.stats.manualRows, lvAt, dead: b.gameOver, score: b.score, maxChain: b.maxChain, stats: b.stats, panels: b.panelsCleared, drag };
}

const seeds = Number(process.argv[2]) || 6;
console.log("せり上がり 1段の秒数: " + [1, 5, 10, 15, 20, 30, 40, 50, 70, 99].map((l) => `Lv${l}=${fmt(riseFramesPerRow(l) / 60)}s`).join(" "));
for (const kind of ["casual", "swiper", "easy", "normal"] as const) {
  const rs = Array.from({ length: seeds }, (_, i) => play(kind, i + 1));
  const secs = rs.map((r) => r.sec);
  const at = (l: number): string => {
    const hit = rs.filter((r) => r.lvAt[l] !== undefined);
    return hit.length ? `${fmt(avg(hit.map((r) => r.lvAt[l] / 60)), 0)}s(${hit.length})` : "-";
  };
  console.log(
    `${kind}: 生存 平均${fmt(avg(secs), 0)}s 最短${fmt(Math.min(...secs), 0)} 最長${fmt(Math.max(...secs), 0)} 打ち切り${rs.filter((r) => !r.dead).length} | 到達Lv 平均${fmt(avg(rs.map((r) => r.level)), 0)} | Lv10到達 ${at(10)} Lv20 ${at(20)} Lv30 ${at(30)} Lv40 ${at(40)} | 手動せり上げ 平均${fmt(avg(rs.map((r) => r.manualRows)), 0)}段`,
  );
  const swaps = avg(rs.map((r) => r.stats.swaps));
  const swapMatches = avg(rs.map((r) => r.stats.swapMatches));
  const perMin = avg(rs.map((r) => (r.score / r.sec) * 60));
  const drag = rs[0].drag ? ` | ドラッグ 平均${fmt(avg(rs.map((r) => r.drag!.drags)), 0)}本 ${fmt(avg(rs.map((r) => r.drag!.dragSteps)), 0)}マス 途中で揃った${fmt(avg(rs.map((r) => r.drag!.dragMidStops)), 0)}回` : "";
  console.log(
    `  得点 平均${fmt(avg(rs.map((r) => r.score)), 0)}（${fmt(perMin, 0)}/分） 最大連鎖 平均${fmt(avg(rs.map((r) => r.maxChain)), 1)} | 入れ替え ${fmt(swaps, 0)}回 揃い ${fmt(swapMatches, 0)}回（${fmt((swapMatches / Math.max(1, swaps)) * 100, 0)}%） 連鎖の消去 ${fmt(avg(rs.map((r) => r.stats.chains)), 0)}回 消した枚数 ${fmt(avg(rs.map((r) => r.panels)), 0)}${drag}`,
  );
}
