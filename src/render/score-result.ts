import type Phaser from "phaser";
import type { ScoreMode } from "../scores/model";
import type { Progress } from "../scores/progress";
import { enqueueScore, flushScores, pendingScores, playerName, publication, ranking, savePlayerName, setPublication, standing } from "../scores/client";
import type { Submission } from "../scores/model";
import { t } from "./i18n";
import { KIND_COLORS } from "./palette";
import "./score-dialog.css";

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "") => {
  const el = document.createElement(tag); el.textContent = text; return el;
};
/** 1 手あたりの得点（得点 ÷ 成功した入れ替え）。小数 1 桁。少ない入れ替えで大きく消すほど上がる */
export const perSwap = (score: number, swaps: number): string => (score / swaps).toFixed(1);
/** A result screen, not a modal. Keyboard retry/menu remain available. */
/** 本文の下端をぼかす高さ（score-dialog.css の .score-content.cut と合わせる） */
const PEEK_FADE = 24;

export function showScoreResult(scene: Phaser.Scene, options: {
  mode: ScoreMode; title: string | null; score: number; chain: number; progress: Progress | null;
  id: string | null; combos: number; chains: number; retry: () => void; menu: () => void; share?: (button: HTMLButtonElement) => void;
  /** 成功した入れ替えの回数。あれば 1 手あたりの得点を出す */
  swaps?: number;
  /** 公開の可否が未決なら、この記録を公開するかを結果画面で聞く。決めるまで記録は端末に留まる */
  submission?: Omit<Submission, "name" | "rules"> | null;
  /** 新記録。結果画面の上に紙吹雪を降らせる（canvas の紙吹雪は結果画面の下に隠れる） */
  celebrate?: boolean;
}): void {
  const root = node("section"); root.className = "score-dialog score-result"; root.setAttribute("aria-label", t("RESULT"));
  const shell = node("div"); shell.className = "score-screen";
  const header = node("header"); header.append(node("small", t(options.mode === "endless" ? "ENDLESS" : "TIME ATTACK")));
  if (options.title) header.append(node("h2", options.title));
  const summary = node("div"); summary.className = "result-summary";
  // 得点と POINTS は 1 行に保つ。5 桁以上で狭い画面に収まらなければ、表示してから幅に合わせて文字を縮める（fitScore）
  const scoreLine = node("strong", `${options.score.toLocaleString()} ${t("POINTS")}`); summary.append(scoreLine);
  if (options.progress) {
    const { best, average, count } = options.progress;
    const bestLine = best === null ? t("First record!") : options.score > best ? t("New best! +{points}", { points: options.score - best })
      : options.score === best ? t("Matched your best!") : t("{points} to your best", { points: best - options.score });
    summary.append(node("p", bestLine));
    if (average !== null) {
      const difference = average === 0 ? `${options.score} ${t("POINTS")}` : `${Math.round((options.score - average) / average * 100)}%`;
      summary.append(node("p", t("vs previous {count} average: {difference}", { count, difference: `${options.score >= average ? "+" : ""}${difference}` })));
    }
    // 比べる記録がない初めての結果では「次回から比較できる」の注記を出さない。狭い画面で 2 行を取り、札と公開の問いを帯の下へ押し出していた
  }
  const body = node("div"); body.className = "score-content";
  /**
   * 本文の中の el を、下の RETRY / MENU の帯より上の見える範囲に入るまでスクロールする。高すぎるときは上端を合わせる。
   * keepScore では得点の行が本文の上端から外れるところまではスクロールしない。収まらなければ el の下が帯に隠れるほうを選ぶ
   * （横持ちの背の低い画面で、公開の問いを見せるために得点が上へ押し出されていた）
   */
  const reveal = (el: HTMLElement, keepScore = false): void => {
    if (keepScore) {
      const over = body.getBoundingClientRect().top - scoreLine.getBoundingClientRect().top;
      if (over > 0) body.scrollTop -= over;
    }
    const view = body.getBoundingClientRect(), box = el.getBoundingClientRect();
    const room = keepScore ? Math.max(0, scoreLine.getBoundingClientRect().top - view.top) : Infinity;
    if (box.bottom > view.bottom) body.scrollTop += Math.min(box.bottom - view.bottom, box.top - view.top, room);
    else if (box.top < view.top) body.scrollTop -= view.top - box.top;
  };
  /** 「公開する」を押して名前の欄を開いたか。開いたあとは得点より名前の欄を見せる */
  let formOpen = false;
  /** 名前の欄を開いたあとに見せる範囲。欄の全体が入らなければ、欄の上端より 2 回目の「公開する」の行を帯より上に見せる */
  let revealForm = (): void => { reveal(consent); };
  // 得点も本文と一緒にスクロールさせ、大きな文字でも再開ボタンを画面内に保つ。
  body.append(summary);
  const stats = node("dl"); stats.className = "result-stats";
  const cells: [string, string | number][] = [["MAX CHAIN", `×${options.chain}`], ["COMBOS", options.combos], ["CHAINS", options.chains]];
  // 1 手あたりの得点。入れ替えが 0 回なら出さない
  if (options.swaps) { cells.push(["PTS / SWAP", perSwap(options.score, options.swaps)]); stats.classList.add("four"); }
  for (const [label, value] of cells) {
    const stat = node("div"); stat.append(node("dt", t(label)), node("dd", String(value))); stats.append(stat);
  }
  body.append(stats);
  // 初めての記録では、遊ぶ前ではなくここで公開の可否を聞く。決めるまで順位の欄は出さず、決めたら同じ場所が順位に変わる。
  // 得点と 4 つの札（最大連鎖など）を先に見せたいので、札の下に 1 行（問い・公開する・公開しない）だけ置き、
  // 名前の欄と公開される内容の説明は「公開する」を押してから開く
  const consent = node("section"); consent.className = "result-consent"; consent.hidden = true; stats.after(consent);
  if (options.submission && publication() === null) {
    const submission = options.submission;
    consent.hidden = false;
    const ask = node("div"); ask.className = "result-consent-ask";
    ask.append(node("h3", t("Publish this score?")));
    const buttons = node("nav"); ask.append(buttons);
    consent.append(ask);
    const form = node("div"); form.className = "result-consent-form"; form.hidden = true;
    form.append(node("p", t("Your name, score, chain and date will be public. You can change this in settings.")));
    const label = node("label", t("Name (optional)"));
    const input = node("input"); input.type = "text"; input.maxLength = 40; input.value = playerName(); input.placeholder = t("Guest");
    label.append(input); form.append(label);
    const confirmNav = node("nav"); form.append(confirmNav);
    consent.append(form);
    // 名前を打つ間は Phaser のキー（R で再挑戦、ESC でメニュー）を止める
    const keyboard = scene.input.keyboard;
    input.addEventListener("focus", () => { if (keyboard) { keyboard.enabled = false; keyboard.disableGlobalCapture(); } });
    input.addEventListener("blur", () => { if (keyboard) { keyboard.enabled = true; keyboard.enableGlobalCapture(); } });
    const decide = (publish: boolean): void => {
      if (publish) { savePlayerName(input.value); setPublication(true); enqueueScore(submission); } else setPublication(false);
      consent.hidden = true; void load();
    };
    const publish = node("button", t("PUBLISH")); publish.type = "button"; publish.className = "primary";
    // 名前の欄と 2 回目の「公開する」は札の下に開くので、帯の下に隠れないよう本文をスクロールして見せる
    // 背の低い横持ち（568×320 など）では欄の全体が入らないので、2 回目の「公開する」の行を優先して帯より上に合わせる
    // 送るボタンまで見せた結果、得点の行が本文の上端で途中まで切れて残るなら（568×320 では下の 14px だけ残って壊れて見えた）、
    // 欄の全体が入る限り枠の上端を本文の上端に合わせ、得点を上へ送り切る（回転のあとと同じ見え方）
    revealForm = () => {
      reveal(consent); reveal(confirmNav);
      const view = body.getBoundingClientRect(), score = scoreLine.getBoundingClientRect(), box = consent.getBoundingClientRect();
      const halfCut = score.top < view.top - 0.5 && score.bottom > view.top + 0.5;
      if (halfCut && box.height <= view.height) body.scrollTop += box.top - view.top;
    };
    publish.onclick = () => { ask.hidden = true; form.hidden = false; formOpen = true; revealForm(); };
    const keep = node("button", t("KEEP PRIVATE")); keep.type = "button"; keep.onclick = () => decide(false);
    buttons.append(publish, keep);
    const confirm = node("button", t("PUBLISH")); confirm.type = "button"; confirm.className = "primary"; confirm.onclick = () => decide(true);
    const cancel = node("button", t("KEEP PRIVATE")); cancel.type = "button"; cancel.onclick = () => decide(false);
    confirmNav.append(confirm, cancel);
  }
  const heading = node("h3", t("YOUR RANKING")); body.append(heading);
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
  shell.append(header, body, footer); root.append(shell);
  if (options.celebrate) root.append(confetti());
  document.body.append(root);
  // 得点の行が本文の幅を超えたら、まず字間（score-dialog.css の 0.08em）を収まるところまで詰め、字間を外しても超えるなら
  // はみ出さない大きさまで縮める。字間をそのまま残して縮めると、568×320 の左の列で 40px の得点が 34px になったので、字間より文字の大きさを残す。
  // 書体の読み込みと画面の回転のあとも合わせ直す
  const fitScore = (): void => {
    scoreLine.style.fontSize = "";
    scoreLine.style.letterSpacing = "";
    const room = summary.clientWidth;
    if (room <= 0 || scoreLine.getBoundingClientRect().width <= room) return;
    scoreLine.style.letterSpacing = "normal";
    const width = scoreLine.getBoundingClientRect().width;
    if (width > room) scoreLine.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(scoreLine).fontSize) * room / width)}px`;
    else scoreLine.style.letterSpacing = `${Math.floor(((room - width) / [...scoreLine.textContent!].length) * 10) / 10}px`;
  };
  // 公開の問いが本文の見える範囲に収まっていなければ、得点を上端に残せる範囲で帯より上へスクロールする。
  // 書体の読み込みのあとと画面の回転のあとも、同じ決まりで合わせ直す（回転で問いが帯の下に回ることがあった）
  const layout = (): void => {
    fitScore();
    if (!consent.hidden) { if (formOpen) revealForm(); else reveal(consent, true); }
    peek();
  };
  /**
   * 本文の下端でボタンや文字が途中で切れているときだけ、下端を薄くぼかして「下に続きがある」と見せる
   * （横持ちの背の低い画面で、SHARE の上半分が帯の上にのぞいて壊れて見えた）。
   * 切れているものがなければぼかさないので、縦持ちで下端まで収まったボタンには掛からない
   */
  const peek = (): void => {
    const edge = body.getBoundingClientRect().bottom;
    const boxes = [...body.querySelectorAll<HTMLElement>("button, input, h3, p, li, dd")].map((el) => ({ el, box: el.getBoundingClientRect() })).filter(({ box }) => box.height > 0);
    const cut = boxes.some(({ box }) => box.top < edge - 1 && box.bottom > edge + 1);
    // 帯の下にまるごと隠れたものがあり、まだ下へスクロールできるときもぼかす（844×390 では SHARE が帯の下に隠れ、続きの手がかりがなかった）。
    // ただし見えているボタン・入力欄の下端がぼかしの範囲（下端 24px）に入るならぼかさない（320×568 の縦持ちの公開のボタンなど）
    const below = body.scrollTop + body.clientHeight < body.scrollHeight - 1 && boxes.some(({ box }) => box.top >= edge - 1)
      && !boxes.some(({ el, box }) => (el.tagName === "BUTTON" || el.tagName === "INPUT") && box.top < edge - 1 && box.bottom > edge - PEEK_FADE);
    body.classList.toggle("cut", cut || below);
  };
  let peekFrame = 0;
  const schedulePeek = (): void => { cancelAnimationFrame(peekFrame); peekFrame = requestAnimationFrame(peek); };
  body.addEventListener("scroll", schedulePeek, { passive: true });
  // 順位の読み込みや公開の問いの開閉で中身が変わったら測り直す
  const changes = new MutationObserver(schedulePeek);
  changes.observe(body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
  layout();
  void document.fonts?.ready.then(() => { if (root.isConnected) layout(); });
  window.addEventListener("resize", layout);
  // DOM input never leaks through to the board's tap-to-retry handler.
  root.addEventListener("pointerdown", (event) => event.stopPropagation());
  let controller: AbortController | undefined;
  let all = false;
  const load = async (): Promise<void> => {
    controller?.abort(); const current = controller = new AbortController();
    list.replaceChildren();
    // 制限時間やseedを変えたプレイも同じ結果画面を使うが、標準ルールのランキングへは接続しない。
    if (options.id === null) {
      heading.hidden = status.hidden = actions.hidden = true;
      return;
    }
    if (!consent.hidden) { heading.hidden = status.hidden = actions.hidden = true; return; }
    heading.hidden = status.hidden = false;
    if (publication() !== true) {
      status.textContent = t("Private record · only your progress is shown."); actions.hidden = true; return;
    }
    actions.hidden = false; status.textContent = t("Loading…");
    try {
      const result = all ? { scores: (await ranking(options.mode, current.signal)).map((row, i) => ({ ...row, rank: i + 1 })), rank: 0, total: 0 }
        : await standing(options.mode, options.id, current.signal);
      if (current.signal.aborted || !root.isConnected) return;
      if (!result) { status.textContent = t(pendingScores().some((s) => s.id === options.id) ? "Upload pending. Your rank will appear after publishing." : "This score is not available in the ranking yet."); return; }
      status.textContent = all ? t("TOP 50") : t("#{rank} / {total} players", { rank: result.rank, total: result.total });
      for (const row of result.scores) {
        // 上位 50 件に載るのは自己ベストなので、今回のプレイでなくても自分の行は分かるようにする
        const mine = row.id === options.id || row.mine === true;
        const li = node("li", `${row.name}${row.id === options.id ? ` · ${t("THIS RUN")}` : mine ? ` · ${t("YOUR BEST")}` : ""}`); li.value = row.rank;
        li.append(node("span", `${row.score.toLocaleString()} ${t("POINTS")} · ×${row.maxChain}${row.swaps ? ` · ${t("PTS / SWAP")} ${perSwap(row.score, row.swaps)}` : ""}`));
        if (mine) { li.className = "result-you"; li.setAttribute("aria-current", "true"); }
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
    controller?.abort(); changes.disconnect(); cancelAnimationFrame(peekFrame); root.remove();
    window.removeEventListener("swaprise:scores-updated", refresh); window.removeEventListener("online", refresh); window.removeEventListener("storage", privacy);
    window.removeEventListener("resize", layout);
  });
  void load();
}

/** 新記録の紙吹雪。パネルの柄の色の小片を結果画面の上から降らせる。操作は下へ通す */
function confetti(): HTMLElement {
  const layer = node("div"); layer.className = "result-confetti"; layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 48; i++) {
    const piece = node("i");
    const color = KIND_COLORS[i % KIND_COLORS.length];
    piece.style.setProperty("--x", `${Math.round(Math.random() * 100)}vw`);
    piece.style.setProperty("--drift", `${Math.round((Math.random() - 0.5) * 30)}vw`);
    piece.style.setProperty("--spin", `${Math.round((Math.random() - 0.5) * 1440)}deg`);
    piece.style.animationDelay = `${Math.round(Math.random() * 500)}ms`;
    piece.style.animationDuration = `${1600 + Math.round(Math.random() * 1200)}ms`;
    piece.style.background = `#${color.toString(16).padStart(6, "0")}`;
    layer.append(piece);
  }
  // 降り終わったら片付ける
  window.setTimeout(() => layer.remove(), 3500);
  return layer;
}
