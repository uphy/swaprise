import type Phaser from "phaser";
import type { ScoreMode } from "../scores/model";
import type { Progress } from "../scores/progress";
import { enqueueScore, flushScores, pendingScores, playerName, publication, ranking, savePlayerName, setPublication, standing } from "../scores/client";
import type { Submission } from "../scores/model";
import { t } from "./i18n";
import "./score-dialog.css";

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "") => {
  const el = document.createElement(tag); el.textContent = text; return el;
};
/** A result screen, not a modal. Keyboard retry/menu remain available. */
export function showScoreResult(scene: Phaser.Scene, options: {
  mode: ScoreMode; title: string | null; score: number; chain: number; progress: Progress | null;
  id: string | null; combos: number; chains: number; retry: () => void; menu: () => void; share?: (button: HTMLButtonElement) => void;
  /** 公開の可否が未決なら、この記録を公開するかを結果画面で聞く。決めるまで記録は端末に留まる */
  submission?: Omit<Submission, "name" | "rules"> | null;
}): void {
  const root = node("section"); root.className = "score-dialog score-result"; root.setAttribute("aria-label", t("RESULT"));
  const shell = node("div"); shell.className = "score-screen";
  const header = node("header"); header.append(node("small", t(options.mode === "endless" ? "ENDLESS" : "TIME ATTACK")));
  if (options.title) header.append(node("h2", options.title));
  const summary = node("div"); summary.className = "result-summary";
  summary.append(node("strong", `${options.score.toLocaleString()} ${t("POINTS")}`));
  if (options.progress) {
    const { best, average, count } = options.progress;
    const bestLine = best === null ? t("First record!") : options.score > best ? t("New best! +{points}", { points: options.score - best })
      : options.score === best ? t("Matched your best!") : t("{points} to your best", { points: best - options.score });
    summary.append(node("p", bestLine));
    if (average !== null) {
      const difference = average === 0 ? `${options.score} ${t("POINTS")}` : `${Math.round((options.score - average) / average * 100)}%`;
      summary.append(node("p", t("vs previous {count} average: {difference}", { count, difference: `${options.score >= average ? "+" : ""}${difference}` })));
    } else summary.append(node("p", t("Recent trend appears from your next game.")));
  }
  const body = node("div"); body.className = "score-content";
  // 得点も本文と一緒にスクロールさせ、大きな文字でも再開ボタンを画面内に保つ。
  body.append(summary);
  const stats = node("dl"); stats.className = "result-stats";
  for (const [label, value] of [["MAX CHAIN", `×${options.chain}`], ["COMBOS", options.combos], ["CHAINS", options.chains]] as const) {
    const stat = node("div"); stat.append(node("dt", t(label)), node("dd", String(value))); stats.append(stat);
  }
  body.append(stats);
  // 初めての記録では、遊ぶ前ではなくここで公開の可否を聞く。決めるまで順位の欄は出さず、決めたら同じ場所が順位に変わる
  const consent = node("section"); consent.className = "result-consent"; consent.hidden = true; body.append(consent);
  if (options.submission && publication() === null) {
    const submission = options.submission;
    consent.hidden = false;
    consent.append(node("h3", t("Publish this score?")));
    consent.append(node("p", t("Your name, score, chain and date will be public. Endless / time attack only. You can change this in settings.")));
    const label = node("label", t("Name (optional)"));
    const input = node("input"); input.type = "text"; input.maxLength = 40; input.value = playerName(); input.placeholder = t("Guest");
    label.append(input); consent.append(label);
    // 名前を打つ間は Phaser のキー（R で再挑戦、ESC でメニュー）を止める
    const keyboard = scene.input.keyboard;
    input.addEventListener("focus", () => { if (keyboard) { keyboard.enabled = false; keyboard.disableGlobalCapture(); } });
    input.addEventListener("blur", () => { if (keyboard) { keyboard.enabled = true; keyboard.enableGlobalCapture(); } });
    const buttons = node("nav"); consent.append(buttons);
    const decide = (publish: boolean): void => {
      if (publish) { savePlayerName(input.value); setPublication(true); enqueueScore(submission); } else setPublication(false);
      consent.hidden = true; void load();
    };
    const publish = node("button", t("PUBLISH")); publish.type = "button"; publish.className = "primary"; publish.onclick = () => decide(true);
    const keep = node("button", t("KEEP PRIVATE")); keep.type = "button"; keep.onclick = () => decide(false);
    buttons.append(publish, keep);
  }
  const heading = node("h3", t("YOUR RANKING")); body.append(heading);
  const note = node("p", t("Ranked per play · unverified scores")); body.append(note);
  const status = node("p"); status.setAttribute("role", "status"); body.append(status);
  const list = node("ol"); body.append(list);
  const actions = node("nav"); body.append(actions);
  const addButton = (parent: HTMLElement, text: string, action: () => void) => {
    const b = node("button", t(text)); b.type = "button"; b.onclick = action; parent.append(b); return b;
  };
  const footer = node("footer"); footer.className = "score-footer";
  addButton(footer, "RETRY", options.retry).className = "primary";
  addButton(footer, "MENU", options.menu);
  if (options.share) { const share = addButton(body, "SHARE", () => options.share!(share)); }
  shell.append(header, body, footer); root.append(shell); document.body.append(root);
  // DOM input never leaks through to the board's tap-to-retry handler.
  root.addEventListener("pointerdown", (event) => event.stopPropagation());
  let controller: AbortController | undefined;
  let all = false;
  const load = async (): Promise<void> => {
    controller?.abort(); const current = controller = new AbortController();
    list.replaceChildren();
    // 制限時間やseedを変えたプレイも同じ結果画面を使うが、標準ルールのランキングへは接続しない。
    if (options.id === null) {
      heading.hidden = note.hidden = status.hidden = actions.hidden = true;
      return;
    }
    if (!consent.hidden) { heading.hidden = note.hidden = status.hidden = actions.hidden = true; return; }
    heading.hidden = status.hidden = false;
    if (publication() !== true) {
      status.textContent = t("Private record · only your progress is shown."); actions.hidden = true; note.hidden = true; return;
    }
    note.hidden = false;
    actions.hidden = false; status.textContent = t("Loading…");
    try {
      const result = all ? { scores: (await ranking(options.mode, current.signal)).map((row, i) => ({ ...row, rank: i + 1 })), rank: 0, total: 0 }
        : await standing(options.mode, options.id, current.signal);
      if (current.signal.aborted || !root.isConnected) return;
      if (!result) { status.textContent = t(pendingScores().some((s) => s.id === options.id) ? "Upload pending. Your rank will appear after publishing." : "This score is not available in the ranking yet."); return; }
      status.textContent = all ? t("TOP 50 · each play is a separate record") : t("#{rank} / {total} records", { rank: result.rank, total: result.total });
      for (const row of result.scores) {
        const li = node("li", `${row.name}${row.id === options.id ? ` · ${t("THIS RUN")}` : ""}`); li.value = row.rank;
        li.append(node("span", `${row.score.toLocaleString()} ${t("POINTS")} · ×${row.maxChain}`));
        if (row.id === options.id) { li.className = "result-you"; li.setAttribute("aria-current", "true"); }
        list.append(li);
      }
    } catch { if (!current.signal.aborted && root.isConnected) status.textContent = t("Could not load rankings. Your record is saved on this device."); }
  };
  const toggle = addButton(actions, "VIEW RANKING", () => { all = !all; heading.textContent = t(all ? "ONLINE RECORDS" : "YOUR RANKING"); toggle.textContent = t(all ? "YOUR RANKING" : "VIEW RANKING"); void load(); });
  addButton(actions, "REFRESH", () => { void flushScores(); void load(); });
  const refresh = () => { void load(); };
  window.addEventListener("swaprise:scores-updated", refresh);
  window.addEventListener("online", refresh);
  const privacy = () => { if (publication() !== true) void load(); };
  window.addEventListener("storage", privacy);
  scene.events.once("shutdown", () => {
    controller?.abort(); root.remove();
    window.removeEventListener("swaprise:scores-updated", refresh); window.removeEventListener("online", refresh); window.removeEventListener("storage", privacy);
  });
  void load();
}
