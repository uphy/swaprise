/**
 * 結果の共有 URL（/r?…）とカードの中身の対応。
 * クライアントが結果から URL を作り、Worker が URL を読み戻してカードの絵と og:title / og:description を組む。
 * どちらも同じ関数を使うので、載せる情報の増減はここだけで済む。
 */
import type { CardSpec } from "./card";

export type ShareVerdict = "win" | "lose" | "draw";
export type ShareResult =
  | { mode: "endless" | "timeattack"; score: number; chain: number; /** 公開した記録の id。Worker が順位を引く */ id?: string }
  | { mode: "puzzle"; stage: string; clear: boolean; /** クリア時の残り手数 */ left?: number }
  | { mode: "lesson"; n: number; total: number }
  | { mode: "cpu"; level: "easy" | "normal" | "hard"; result: ShareVerdict; chain: number }
  | { mode: "versus"; result: ShareVerdict; chain: number }
  | { mode: "online"; result: ShareVerdict; chain: number; vs?: string; wins?: number; losses?: number }
  /** 対戦の招待。招待トークンは URL の hash に残し、ここには載せない（クローラも Worker も hash を見ない） */
  | { mode: "invite"; room: string; from?: string };

/** Worker が D1 から引いた順位。記録が公開されていなければ null */
export interface ShareStanding { rank: number; total: number }

export const SHARE_PATH = "/r";
const OUTCOMES: ShareVerdict[] = ["win", "lose", "draw"];
const LEVELS = ["easy", "normal", "hard"] as const;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TAGLINE = "パネルを入れ替えて連鎖を狙う、ブラウザで遊べる対戦パズル。Free browser action puzzle.";

export function shareParams(r: ShareResult): URLSearchParams {
  const p = new URLSearchParams();
  p.set("m", r.mode);
  switch (r.mode) {
    case "endless": case "timeattack":
      p.set("s", String(r.score)); p.set("c", String(r.chain));
      if (r.id) p.set("id", r.id);
      break;
    case "puzzle":
      p.set("st", r.stage); p.set("r", r.clear ? "clear" : "fail");
      if (r.left !== undefined) p.set("left", String(r.left));
      break;
    case "lesson":
      p.set("n", String(r.n)); p.set("total", String(r.total));
      break;
    case "cpu":
      p.set("lv", r.level); p.set("r", r.result); p.set("c", String(r.chain));
      break;
    case "versus":
      p.set("r", r.result); p.set("c", String(r.chain));
      break;
    case "online":
      p.set("r", r.result); p.set("c", String(r.chain));
      if (r.vs) p.set("vs", r.vs);
      if (r.wins !== undefined && r.losses !== undefined) { p.set("w", String(r.wins)); p.set("l", String(r.losses)); }
      break;
    case "invite":
      p.set("room", r.room);
      if (r.from) p.set("from", r.from);
      break;
  }
  return p;
}

const int = (v: string | null, max: number): number | null => {
  if (v === null || !/^\d{1,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= max ? n : null;
};
/** 人の名前。空なら undefined、長ければ 12 文字で切る */
const name = (v: string | null): string | undefined => {
  const trimmed = v?.trim();
  return trimmed ? [...trimmed].slice(0, 12).join("") : undefined;
};
const outcome = (v: string | null): ShareVerdict | null => (OUTCOMES as string[]).includes(v ?? "") ? (v as ShareVerdict) : null;

/** URL のパラメータを読み戻す。範囲外や欠けがあれば null。値は自己申告なので、カードに使える範囲に収める */
export function parseShare(p: URLSearchParams): ShareResult | null {
  const m = p.get("m");
  if (m === "endless" || m === "timeattack") {
    const score = int(p.get("s"), 99_999_999);
    const chain = int(p.get("c"), 99);
    if (score === null || chain === null) return null;
    const id = p.get("id");
    if (id !== null && !UUID.test(id)) return null;
    return id ? { mode: m, score, chain, id } : { mode: m, score, chain };
  }
  if (m === "puzzle") {
    const stage = p.get("st");
    const r = p.get("r");
    if (!stage || !/^\d{1,2}-\d{1,2}$/.test(stage) || (r !== "clear" && r !== "fail")) return null;
    const left = p.has("left") ? int(p.get("left"), 99) : undefined;
    if (left === null) return null;
    return left === undefined ? { mode: m, stage, clear: r === "clear" } : { mode: m, stage, clear: r === "clear", left };
  }
  if (m === "lesson") {
    const n = int(p.get("n"), 99);
    const total = int(p.get("total"), 99);
    if (n === null || total === null || n < 1 || n > total) return null;
    return { mode: m, n, total };
  }
  if (m === "cpu") {
    const lv = p.get("lv");
    const result = outcome(p.get("r"));
    const chain = int(p.get("c"), 99);
    if (!(LEVELS as readonly string[]).includes(lv ?? "") || !result || chain === null) return null;
    return { mode: m, level: lv as (typeof LEVELS)[number], result, chain };
  }
  if (m === "versus") {
    const result = outcome(p.get("r"));
    const chain = int(p.get("c"), 99);
    if (!result || chain === null) return null;
    return { mode: m, result, chain };
  }
  if (m === "online") {
    const result = outcome(p.get("r"));
    const chain = int(p.get("c"), 99);
    if (!result || chain === null) return null;
    const vs = name(p.get("vs"));
    const out: ShareResult = { mode: m, result, chain };
    if (vs) out.vs = vs;
    const wins = int(p.get("w"), 9999);
    const losses = int(p.get("l"), 9999);
    if (wins !== null && losses !== null) { out.wins = wins; out.losses = losses; }
    return out;
  }
  if (m === "invite") {
    const room = p.get("room");
    if (!room || !UUID.test(room)) return null;
    const from = name(p.get("from"));
    return from ? { mode: m, room, from } : { mode: m, room };
  }
  return null;
}

const points = (n: number): string => n.toLocaleString("en-US");
const chainLine = (chain: number): string => `MAX CHAIN ×${chain}`;
const modeLabel = (mode: ShareResult["mode"]): string =>
  ({ endless: "ENDLESS", timeattack: "TIME ATTACK 2:00", puzzle: "PUZZLE", lesson: "LESSON", cpu: "VS CPU", versus: "VS 2P", online: "ONLINE", invite: "ONLINE" })[mode];
const RESULT_WORD: Record<ShareVerdict, string> = { win: "WIN", lose: "LOSE", draw: "DRAW" };
/** WIN は強調の黄、LOSE は薄い藤色、DRAW と CLEAR は連鎖の緑 */
const RESULT_COLOR: Record<ShareVerdict, number> = { win: 0xffe066, lose: 0xd9d4f2, draw: 0x7cf57a };

/** カードの絵の中身。順位は公開済みの記録だけに付く */
export function cardSpec(r: ShareResult, standing: ShareStanding | null = null): CardSpec {
  switch (r.mode) {
    case "endless": case "timeattack": {
      const subs = [{ text: chainLine(r.chain) }];
      if (standing) subs.push({ text: `RANK #${standing.rank} / ${standing.total}` });
      return { mode: modeLabel(r.mode), main: points(r.score), caption: "POINTS", subs };
    }
    case "puzzle": {
      const subs = [{ text: `STAGE ${r.stage}` }];
      if (r.clear && r.left !== undefined) subs.push({ text: `${r.left} MOVES LEFT` });
      return { mode: modeLabel(r.mode), main: r.clear ? "CLEAR" : "FAILED", mainColor: r.clear ? 0x7cf57a : 0xd9d4f2, subs };
    }
    case "lesson":
      return { mode: modeLabel(r.mode), main: "CLEAR", mainColor: 0x7cf57a, subs: [{ text: `LESSON ${r.n} / ${r.total}` }] };
    case "cpu":
      return { mode: modeLabel(r.mode), main: RESULT_WORD[r.result], mainColor: RESULT_COLOR[r.result], subs: [{ text: `CPU ${r.level.toUpperCase()}` }, { text: chainLine(r.chain) }] };
    case "versus":
      return { mode: modeLabel(r.mode), main: RESULT_WORD[r.result], mainColor: RESULT_COLOR[r.result], subs: [{ text: chainLine(r.chain) }] };
    case "online": {
      const subs = [];
      if (r.vs) subs.push({ text: `VS ${r.vs}${r.wins !== undefined ? `  ${r.wins}W ${r.losses}L` : ""}` });
      subs.push({ text: chainLine(r.chain) });
      return { mode: modeLabel(r.mode), main: RESULT_WORD[r.result], mainColor: RESULT_COLOR[r.result], subs };
    }
    case "invite":
      return { mode: modeLabel(r.mode), main: "JOIN ME", mainColor: 0xffe066, caption: "ONLINE VS", subs: r.from ? [{ text: `FROM ${r.from}` }] : [] };
  }
}

/** og:title と og:description。画像の下に出る文で、共有先によっては画像より先に読まれる */
export function cardMeta(r: ShareResult, standing: ShareStanding | null = null): { title: string; description: string } {
  const suffix = " – SWAPRISE";
  const rankLine = standing ? `ランキング ${standing.rank} 位 / ${standing.total} 人。` : "";
  const won: Record<ShareVerdict, string> = { win: "Won", lose: "Lost", draw: "Drew" };
  switch (r.mode) {
    case "endless":
      return { title: `${points(r.score)} points · max chain x${r.chain}${suffix}`, description: `${rankLine}${TAGLINE}` };
    case "timeattack":
      return { title: `2:00 Time Attack ${points(r.score)} points · max chain x${r.chain}${suffix}`, description: `${rankLine}${TAGLINE}` };
    case "puzzle":
      return {
        title: `Puzzle Stage ${r.stage} ${r.clear ? "clear" : "failed"}${suffix}`,
        description: `${r.clear && r.left !== undefined ? `残り ${r.left} 手でクリア。` : ""}連鎖の練習になるパズルも遊べる。${TAGLINE}`,
      };
    case "lesson":
      return { title: `Lesson ${r.n} / ${r.total} clear${suffix}`, description: `連鎖の組み方を順に学べるレッスン。${TAGLINE}` };
    case "cpu":
      return { title: `${won[r.result]} vs CPU ${r.level.toUpperCase()} · max chain x${r.chain}${suffix}`, description: TAGLINE };
    case "versus":
      return { title: `${won[r.result]} vs 2P · max chain x${r.chain}${suffix}`, description: TAGLINE };
    case "online":
      return {
        title: `${won[r.result]}${r.vs ? ` vs ${r.vs}` : " online"}${r.wins !== undefined ? ` (${r.wins}W ${r.losses}L)` : ""} · max chain x${r.chain}${suffix}`,
        description: TAGLINE,
      };
    case "invite":
      return {
        title: `${r.from ?? "A friend"} invited you to play${suffix}`,
        description: `リンクを開くとそのまま対戦が始まる。Open the link to join the match. ${TAGLINE}`,
      };
  }
}
