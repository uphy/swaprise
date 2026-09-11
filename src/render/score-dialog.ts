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
export function showRecordsDialog(scene: Phaser.Scene): void {
  const { root, body, tools, footer, close } = dialog(scene, t("RECORDS"));
  const sources = element("nav"); tools.append(sources);
  const local = element("section"); body.append(local);
  const hs = loadHighScores();
  for (const [title, entries] of [["ENDLESS  TOP 5", hs.endless], ["TIME ATTACK 2:00  TOP 5", hs.timeattack]] as const) {
    local.append(element("h3", t(title)));
    if (!entries.length) local.append(element("p", t("no records yet")));
    const list = element("ol");
    for (const entry of entries) list.append(element("li", `${entry.score} · x${entry.maxChain} · ${entry.date}`));
    local.append(list);
  }
  local.append(element("h3", t("VS CPU")));
  for (const level of ["easy", "normal", "hard"] as CpuLevel[]) {
    const r = hs.cpu[level];
    local.append(element("p", `${level.toUpperCase()}  ${t("{wins}W {losses}L", { wins: r.wins, losses: r.losses })}`));
  }
  local.append(element("p", t("PUZZLE  {count} / {total} cleared", { count: hs.puzzle.length, total: PUZZLES.length })));
  const online = element("section"); body.append(online); online.hidden = true;
  online.append(element("p", t("Standard rules · top 50 per mode · unverified scores")));
  const pending = element("p"); online.append(pending);
  const tabs = element("nav"); tools.append(tabs); tabs.hidden = true;
  const status = element("p"); status.setAttribute("role", "status"); online.append(status);
  const list = element("ol"); online.append(list);
  let request: AbortController | undefined;
  let current: ScoreMode = "endless";
  const load = async (mode: ScoreMode): Promise<void> => {
    current = mode; request?.abort(); request = new AbortController();
    const signal = request.signal;
    pending.textContent = t("PENDING UPLOADS: {count}", { count: pendingScores().length });
    for (const b of tabs.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    status.textContent = t("Loading…"); list.replaceChildren();
    try {
      const scores = await ranking(mode, signal);
      if (signal.aborted) return;
      status.textContent = scores.length ? "" : t("no records yet");
      for (const entry of scores) {
        const li = element("li");
        li.append(element("strong", entry.name), element("span", `${t("SCORE")} ${entry.score} · ${t("MAX CHAIN")} x${entry.maxChain} · ${new Date(entry.createdAt).toISOString().slice(0, 10)}`));
        list.append(li);
      }
    } catch { if (!signal.aborted) status.textContent = t("Could not load rankings. Local records are still available."); }
  };
  for (const [mode, title] of [["endless", "ENDLESS"], ["timeattack", "TIME ATTACK"]] as const) {
    button(tabs, title, () => void load(mode)).dataset.mode = mode;
  }
  button(online, "RETRY", () => { void flushScores(); void load(current); });
  const localButton = button(sources, "THIS DEVICE", () => {
    request?.abort(); online.hidden = true; tabs.hidden = true; local.hidden = false; body.scrollTop = 0;
    localButton.setAttribute("aria-pressed", "true"); onlineButton.setAttribute("aria-pressed", "false");
  });
  const onlineButton = button(sources, "ONLINE", () => {
    local.hidden = true; online.hidden = false; tabs.hidden = false; body.scrollTop = 0;
    onlineButton.setAttribute("aria-pressed", "true"); localButton.setAttribute("aria-pressed", "false");
    void load(current);
  });
  localButton.setAttribute("aria-pressed", "true"); onlineButton.setAttribute("aria-pressed", "false");
  button(footer, "CLOSE", close);
  root.addEventListener("close", () => request?.abort(), { once: true });
}
