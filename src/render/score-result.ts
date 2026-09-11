import type Phaser from "phaser";
import type { ScoreMode } from "../scores/model";
import type { Progress } from "../scores/progress";
import { flushScores, pendingScores, publication, ranking, standing } from "../scores/client";
import { t } from "./i18n";
import "./score-dialog.css";

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "") => {
  const el = document.createElement(tag); el.textContent = text; return el;
};
/** A result screen, not a modal. Keyboard retry/menu remain available. */
export function showScoreResult(scene: Phaser.Scene, options: {
  mode: ScoreMode; title: string; score: number; chain: number; progress: Progress;
  id: string; retry: () => void; menu: () => void; share?: (button: HTMLButtonElement) => void;
}): void {
  const root = node("section"); root.className = "score-dialog score-result"; root.setAttribute("aria-label", t("RESULT"));
  const shell = node("div"); shell.className = "score-screen";
  const header = node("header"); header.append(node("small", t(options.mode === "endless" ? "ENDLESS" : "TIME ATTACK")), node("h2", options.title));
  const summary = node("div"); summary.className = "score-tools result-summary";
  summary.append(node("strong", `${options.score.toLocaleString()} ${t("POINTS")}`));
  const { best, average, count } = options.progress;
  const bestLine = best === null ? t("First record!") : options.score > best ? t("New best! +{points}", { points: options.score - best })
    : options.score === best ? t("Matched your best!") : t("{points} to your best", { points: best - options.score });
  summary.append(node("p", bestLine));
  if (average !== null) {
    const difference = average === 0 ? `${options.score} ${t("POINTS")}` : `${Math.round((options.score - average) / average * 100)}%`;
    summary.append(node("p", t("vs previous {count} average: {difference}", { count, difference: `${options.score >= average ? "+" : ""}${difference}` })));
  } else summary.append(node("p", t("Recent trend appears from your next game.")));
  const body = node("div"); body.className = "score-content";
  body.append(node("p", `${t("MAX CHAIN")} ×${options.chain}`));
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
  shell.append(header, summary, body, footer); root.append(shell); document.body.append(root);
  // DOM input never leaks through to the board's tap-to-retry handler.
  root.addEventListener("pointerdown", (event) => event.stopPropagation());
  let controller: AbortController | undefined;
  let all = false;
  const load = async (): Promise<void> => {
    controller?.abort(); const current = controller = new AbortController();
    list.replaceChildren();
    if (publication() !== true) {
      status.textContent = t("Private record · only your progress is shown."); actions.hidden = true; note.hidden = true; return;
    }
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
