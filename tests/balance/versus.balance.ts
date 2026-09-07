import { describe, expect, it } from "vitest";
import { CpuPlayer, Game, NO_INPUT, type CpuLevel } from "../../src/core";
import { casualPlayer } from "../../tools/sim/proxy";

function duel(left: "idle" | "casual" | CpuLevel, right: CpuLevel, seed: number): { sec: number; winner: number } {
  const game = new Game({ mode: "versus", seed, speedLevel: 1 });
  const a = left === "idle" ? null : left === "casual" ? casualPlayer(game.boards[0]) : new CpuPlayer(game.boards[0], left);
  const b = new CpuPlayer(game.boards[1], right);
  for (let f = 0; f < 60 * 60 * 5 && !game.finished; f++) game.tick([a ? a.next() : NO_INPUT, b.next()]);
  return { sec: game.boards[0].frame / 60, winner: game.winner };
}

/**
 * 対戦が一瞬で終わらないこと。連鎖の板を段階ごとに送っていたころは normal 同士で 10 秒の試合があった。
 * 計測時: normal 同士 最短 65 秒、hard 同士 最短 25 秒（seed 1〜6）。
 * おじゃまの送出と投下を原作のタイミング（同時消しは100F待って送る・相手が静止するまで降らない）にしてからは、normal 同士 最短 84 秒、hard 同士 最短 30 秒（seed 1〜12）。
 * easy を弱くして以前の easy を normal に、以前の normal を hard に繰り下げてからは、normal 同士 最短 84 秒、hard 同士 最短 17 秒（seed 1〜6）。
 * hard は思考・移動間隔が緩んだ分、アクティブ連鎖の仕込み（lookahead・activeDepth）がよく決まって短い試合も出るようになった。
 */
describe("バランス: 対戦の長さ", () => {
  it("normal 同士の試合が 30 秒未満で終わらない", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const r = duel("normal", "normal", seed);
      expect(r.sec, `seed=${seed} ${r.sec.toFixed(1)}s`).toBeGreaterThanOrEqual(30);
    }
  });

  it("hard 同士の試合が 15 秒未満で終わらない", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const r = duel("hard", "hard", seed);
      expect(r.sec, `seed=${seed} ${r.sec.toFixed(1)}s`).toBeGreaterThanOrEqual(15);
    }
  });
});

/**
 * 難易度の並び。EASY は遅い人でも勝てる相手、HARD は遅い人ではほとんど勝てない相手。
 * 計測時（8試合）: casual vs easy は 3 勝 2 引き分け、casual vs hard は 0 勝。
 * おじゃまの送出と投下を原作のタイミングにしてからは casual vs easy 3 勝 1 引き分け、casual vs hard 2 勝（seed 1 と 5。どちらも変身したパネルで 3〜5 連鎖を返して勝つ）。
 * 板が相手の静止を待つぶん守りが強くなり、遅い側にも逆転の目が出るのは原作の対戦と同じ。
 */
describe("バランス: CPU の強さ", () => {
  it("遅い CPU（人の代わり）が easy に 6 試合中 2 回以上は負けない（勝ちか5分で決着なし）", () => {
    let notLost = 0;
    for (let seed = 1; seed <= 6; seed++) if (duel("casual", "easy", seed).winner !== 1) notLost++;
    expect(notLost).toBeGreaterThanOrEqual(2);
  });

  it("遅い CPU（人の代わり）は hard に 6 試合中 2 回までしか勝てない", () => {
    let wins = 0;
    for (let seed = 1; seed <= 6; seed++) if (duel("casual", "hard", seed).winner === 0) wins++;
    expect(wins).toBeLessThanOrEqual(2);
  });

  it("無操作の相手を easy は 20 秒以内に倒さない（開幕で押し切らない）", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const r = duel("idle", "easy", seed);
      expect(r.sec, `seed=${seed} ${r.sec.toFixed(1)}s`).toBeGreaterThanOrEqual(20);
    }
  });
});
