import type Phaser from "phaser";
import { playerName, savePlayerName, publication, setPublication, pendingScores, ranking, flushScores } from "../scores/client";
import type { ScoreMode } from "../scores/model";
import { t } from "./i18n";
import { loadHighScores } from "./highscore";
import { PUZZLES, type CpuLevel } from "../core";
import "./score-dialog.css";

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = ""): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag); node.textContent = text; return node;
};
function dialog(scene: Phaser.Scene, title: string, onClose: () => void = () => {}) {
  const root = element("dialog");
  root.className = "score-dialog"; root.setAttribute("aria-label", title);
  const shell = element("div"); shell.className = "score-screen";
  const header = element("header"); header.append(element("small", "SWAPRISE"), element("h2", title));
  const tools = element("div"); tools.className = "score-tools";
  const body = element("div"); body.className = "score-content";
  const footer = element("footer"); footer.className = "score-footer";
  shell.append(header, tools, body, footer); root.append(shell);
  // Follow the visible viewport when the software keyboard is open.
  const viewport = window.visualViewport;
  const fit = (): void => {
    root.style.height = `${viewport?.height ?? window.innerHeight}px`;
    root.style.top = `${viewport?.offsetTop ?? 0}px`;
  };
  viewport?.addEventListener("resize", fit); viewport?.addEventListener("scroll", fit);
  window.addEventListener("resize", fit); fit();
  // Phaser's global keyboard listener must not navigate/restart while typing.
  const keyboard = scene.input.keyboard;
  const inputEnabled = scene.input.enabled;
  scene.input.enabled = false;
  const enabled = keyboard?.enabled ?? false;
  const preventDefault = keyboard?.manager.preventDefault ?? false;
  if (keyboard) { keyboard.enabled = false; keyboard.disableGlobalCapture(); }
  const close = (): void => root.close();
  let cleaned = false;
  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    viewport?.removeEventListener("resize", fit); viewport?.removeEventListener("scroll", fit);
    window.removeEventListener("resize", fit);
    root.remove(); scene.events.off("shutdown", shutdown);
    scene.input.enabled = inputEnabled;
    if (keyboard) { keyboard.enabled = enabled; keyboard.manager.preventDefault = preventDefault; keyboard.resetKeys(); }
  };
  const shutdown = (): void => { root.close("shutdown"); cleanup(); };
  scene.events.once("shutdown", shutdown);
  root.addEventListener("close", () => {
    cleanup();
    if (root.returnValue !== "shutdown") { onClose(); window.dispatchEvent(new Event("resize")); }
  }, { once: true });
  document.body.append(root); root.showModal();
  return { root, body, tools, footer, close };
}
function button(parent: HTMLElement, text: string, action: () => void): HTMLButtonElement {
  const b = element("button", t(text)); b.type = "button"; b.onclick = action; parent.append(b); return b;
}
export function showPlayerSettings(scene: Phaser.Scene, first = false, done: () => void = () => {}): void {
  const { root, body, footer, close } = dialog(scene, t("PLAYER SETTINGS"), () => {
    if (first && publication() === null) setPublication(false);
    done();
  });
  root.classList.add("player-screen");
  body.append(element("p", t("Your name is shared with online play.")));
  const label = element("label", t("Name (optional)"));
  const input = element("input"); input.type = "text"; input.maxLength = 40;
  input.value = playerName(); input.placeholder = t("Guest"); label.append(input); body.append(label);
  const consent = element("label");
  const checkbox = element("input"); checkbox.type = "checkbox"; checkbox.checked = publication() === true;
  consent.className = "score-consent";
  consent.append(checkbox, document.createTextNode(t("Publish scores automatically")));
  body.append(consent, element("p", t("Endless / time attack. Your name and records will be visible to everyone.")));
  const details = element("details");
  details.append(element("summary", t("About publishing scores")), element("p", t("Your name, score, chain and date will be public. Each play is a separate record. Past names and published records remain when you change this setting.")),
    element("p", t("Custom games stay on this device. Failed uploads retry later (up to 50). Turning this off discards pending uploads; an upload already received cannot be recalled.")));
  body.append(details);
  button(footer, first ? "SAVE AND PLAY" : "SAVE", () => { savePlayerName(input.value); setPublication(checkbox.checked); close(); }).className = "primary";
  button(footer, first ? "LATER" : "CANCEL", close);
}
/**
 * 記録。上の切り替え（この端末 / オンライン）で中身を替える。
 * この端末はモードごとの札（エンドレス・タイムアタックの上位 5 件、CPU 戦の勝敗、パズルの進み）。
 * 行は 順位・得点・最大連鎖・日付 を列で揃え、得点を大きく出す。一覧は ol / li のまま（読み上げと e2e が listitem を見る）
 */
export function showRecordsDialog(scene: Phaser.Scene): void {
  const { root, body, tools, footer, close } = dialog(scene, t("RECORDS"));
  root.classList.add("records-screen");
  const sources = element("nav"); sources.className = "rec-tabs"; tools.append(sources);
  const local = element("section"); body.append(local);
  const hs = loadHighScores();
  const card = (parent: HTMLElement, title: string, note = ""): HTMLElement => {
    const c = element("section"); c.className = "rec-card";
    const h = element("h3", title); c.append(h);
    if (note) h.append(" ", element("small", note));
    parent.append(c); return c;
  };
  const scoreRow = (parent: HTMLElement, rank: string, name: string | null, score: number, chain: number, date: string): void => {
    const row = element("li"); row.className = "rec-row";
    row.append(element("b", rank));
    const main = element("div"); main.className = "rec-main";
    if (name) main.append(element("strong", name));
    const num = element("span", score.toLocaleString()); num.className = "rec-score"; main.append(num);
    row.append(main);
    const meta = element("div"); meta.className = "rec-meta";
    meta.append(element("span", `${t("MAX CHAIN")} ×${chain}`), element("span", date));
    row.append(meta);
    parent.append(row);
  };
  for (const [title, entries] of [[t("ENDLESS"), hs.endless], [t("TIME ATTACK"), hs.timeattack]] as const) {
    const c = card(local, title, t("TOP 5"));
    if (!entries.length) c.append(element("p", t("no records yet")));
    const ol = element("ol"); ol.className = "rec-table"; c.append(ol);
    entries.forEach((entry, i) => scoreRow(ol, String(i + 1), null, entry.score, entry.maxChain, entry.date));
  }
  const cpu = card(local, t("VS CPU"));
  const table = element("ol"); table.className = "rec-table"; cpu.append(table);
  for (const level of ["easy", "normal", "hard"] as CpuLevel[]) {
    const r = hs.cpu[level];
    const row = element("li"); row.className = "rec-row";
    row.append(element("b", t(level.toUpperCase())));
    const main = element("div"); main.className = "rec-main";
    const num = element("span", t("{wins}W {losses}L", { wins: r.wins, losses: r.losses })); num.className = "rec-score"; main.append(num);
    row.append(main);
    const meta = element("div"); meta.className = "rec-meta";
    const total = r.wins + r.losses;
    meta.append(element("span", total ? `${Math.round((r.wins / total) * 100)}%` : "–"));
    row.append(meta);
    table.append(row);
  }
  const puzzle = card(local, t("PUZZLE"));
  const prow = element("div"); prow.className = "rec-row";
  prow.append(element("b", "✓"));
  const pmain = element("div"); pmain.className = "rec-main";
  const pnum = element("span", `${hs.puzzle.length} / ${PUZZLES.length}`); pnum.className = "rec-score"; pmain.append(pnum);
  prow.append(pmain);
  const bar = element("div"); bar.className = "rec-bar";
  const fill = element("div"); fill.style.width = `${(hs.puzzle.length / PUZZLES.length) * 100}%`; bar.append(fill);
  prow.append(bar);
  puzzle.append(prow);

  // 切り替えは一段。この端末 / オンライン エンドレス / オンライン タイムアタック の 3 つで、スクロールしても上に残る
  const online = element("section"); body.append(online); online.hidden = true;
  const onlineCard = card(online, "");
  const onlineTitle = onlineCard.querySelector("h3")!;
  onlineCard.append(element("p", t("Standard rules · top 50 per mode · unverified scores")));
  const pending = element("p"); onlineCard.append(pending);
  const status = element("p"); status.setAttribute("role", "status"); onlineCard.append(status);
  const list = element("ol"); list.className = "rec-table"; onlineCard.append(list);
  let request: AbortController | undefined;
  let current: ScoreMode = "endless";
  const modeName = (mode: ScoreMode): string => (mode === "endless" ? t("ENDLESS") : t("TIME ATTACK"));
  const select = (which: "local" | ScoreMode): void => {
    for (const b of sources.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.tab === which));
    body.scrollTop = 0;
  };
  const load = async (mode: ScoreMode): Promise<void> => {
    current = mode; request?.abort(); request = new AbortController();
    const signal = request.signal;
    select(mode);
    local.hidden = true; online.hidden = false;
    onlineTitle.textContent = modeName(mode);
    onlineTitle.append(" ", element("small", t("TOP 50")));
    const count = pendingScores().length;
    pending.textContent = count ? t("PENDING UPLOADS: {count}", { count }) : "";
    status.textContent = t("Loading…"); list.replaceChildren();
    try {
      const scores = await ranking(mode, signal);
      if (signal.aborted) return;
      status.textContent = scores.length ? "" : t("no records yet");
      scores.forEach((entry, i) => scoreRow(list, String(i + 1), entry.name, entry.score, entry.maxChain, new Date(entry.createdAt).toISOString().slice(0, 10)));
    } catch { if (!signal.aborted) status.textContent = t("Could not load rankings. Local records are still available."); }
  };
  button(onlineCard, "RETRY", () => { void flushScores(); void load(current); });
  const localButton = button(sources, "THIS DEVICE", () => {
    request?.abort(); online.hidden = true; local.hidden = false; select("local");
  });
  localButton.dataset.tab = "local";
  for (const mode of ["endless", "timeattack"] as const) {
    const b = element("button"); b.type = "button"; b.dataset.tab = mode;
    b.append(element("small", t("ONLINE")), modeName(mode));
    b.onclick = () => void load(mode);
    sources.append(b);
  }
  select("local");
  button(footer, "CLOSE", close);
  root.addEventListener("close", () => request?.abort(), { once: true });
}
