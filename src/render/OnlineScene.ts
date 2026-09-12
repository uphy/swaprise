import Phaser from "phaser";
import { playerName, savePlayerName } from "../scores/client";
import { BoardView } from "./BoardView";
import { PlayerInput, P1_KEYS } from "./input";
import { TouchInput } from "./touch";
import { applyLayout } from "./hidpi";
import { BOARD_H, BOARD_W, layoutFor, sameLayout, type Layout } from "./theme";
import { haptics } from "./haptics";
import { FONT_UI, MENU_TYPE } from "./theme";
import { Background } from "./Background";
import { audio } from "./shared";
import { musicDanger } from "./musicDanger";
import { wakeLock } from "./wakelock";
import { shareText } from "./share";
import {
  OnlineSession,
  ApiError,
  api,
  savedConnection,
  leaveParticipation,
  retryPendingLeave,
  type Participation,
  type Connection,
} from "../net/session";
import { GAME_VERSION, displayName, type ServerMessage } from "../net/protocol";
import { Prediction } from "../net/prediction";
import { NO_INPUT } from "../core/types";
import "./online.css";
import { t } from "./i18n";
import { RaiseBar } from "./RaiseBar";
import { applyPendingUpdate } from "./update";
import { backHintDuration } from "./backHint";
/** ロビーとオンライン盤面。ローカル対戦のポーズ・再開始処理は呼ばない。 */
export class OnlineScene extends Phaser.Scene {
  session: OnlineSession | null = null;
  prediction: Prediction | null = null;
  views: BoardView[] = [];
  touch: TouchInput | null = null;
  playerInput: PlayerInput | null = null;
  private root!: HTMLDivElement;
  private panel!: HTMLDivElement;
  private status!: HTMLParagraphElement;
  private actions!: HTMLDivElement;
  private layout!: Layout;
  private bg: Background | null = null;
  private gameId = "";
  private accumulator = 0;
  private queue: WebSocket | null = null;
  private queueAttempt = 0;
  private queueId: string | null = null;
  private queueTimer: ReturnType<typeof setInterval> | null = null;
  private waitingSince = 0;
  private settings = false;
  private actionKey = "";
  private visibleHandler = (): void => {};
  private resizeHandler = (): void => {};
  private closing = false;
  private epoch = 0;
  private phase = "";
  private stalledMs = 0;
  private raise = false;
  private raiseHint: RaiseBar | null = null;
  /** 直近の tick で送ったせり上げ入力。バーの点灯に使う。 */
  private lastRaise = false;
  /** 戻る操作を受け止めるために自分で積んだ履歴があるか。 */
  private historyPushed = false;
  /** 対戦中に戻る操作をした人への案内を出している期限（Date.now()）。0 なら出していない。 */
  private backHintUntil = 0;
  private backHintTimer: ReturnType<typeof setTimeout> | null = null;
  /** 退出の要求を送って結果を待っている間。戻る操作を重ねて送らないための印。 */
  private leaving = false;
  constructor() {
    super("online");
  }
  create(): void {
    this.epoch++;
    this.session = null;
    this.prediction = null;
    this.views = [];
    this.gameId = "";
    this.accumulator = 0;
    this.settings = false;
    this.actionKey = "";
    this.closing = false;
    this.leaving = false;
    this.phase = "";
    this.raise = false;
    this.layout = layoutFor("cpu");
    applyLayout(this, this.layout);
    this.bg?.destroy();
    this.bg = new Background(this, this.layout.width, this.layout.height, "cpu");
    this.root = document.createElement("div");
    this.root.className = "online-ui";
    this.root.style.fontFamily = FONT_UI;
    this.syncTypography();
    this.panel = document.createElement("div");
    this.panel.className = "online-panel";
    const title = document.createElement("h1");
    title.textContent = t("ONLINE");
    this.status = document.createElement("p");
    this.status.setAttribute("role", "status");
    this.status.textContent = t("Connecting…");
    this.actions = document.createElement("div");
    this.actions.className = "online-actions";
    this.panel.append(title, this.status, this.actions);
    this.root.append(this.panel);
    document.body.append(this.root);
    audio.stopBgm();
    this.visibleHandler = () => {
      this.touch?.clear();
      this.playerInput?.reset();
      this.accumulator = 0;
      this.session?.send({ type: "visibility", visible: !document.hidden });
      if (this.queue?.readyState === WebSocket.OPEN)
        this.queue.send(
          JSON.stringify({ type: "visibility", visible: !document.hidden }),
        );
      if (document.hidden) audio.suspend();
      else audio.resume();
    };
    document.addEventListener("visibilitychange", this.visibleHandler);
    this.resizeHandler = () => {
      this.syncTypography();
      const next = layoutFor("cpu");
      if (!sameLayout(this.layout, next)) {
        this.layout = next;
        applyLayout(this, next);
        this.bg?.destroy();
        this.bg = new Background(this, next.width, next.height, "cpu");
        this.place();
      }
    };
    window.addEventListener("resize", this.resizeHandler);
    const openSettings = () => {
      this.settings = true;
      this.actionKey = "";
      this.refresh();
    };
    this.input.keyboard!.on("keydown-ESC", openSettings);
    // Android の戻るジェスチャ（画面端からの横スワイプ）は盤面のドラッグと重なりやすく、履歴を積んでいないと
    // ページを離れて（PWA なら終了して）切断負けになる。履歴を1つ積んで popstate で受け止める。
    // 対戦が始まってからは何もせず、対戦中は案内だけ出す（相手がいるので止められず、設定を開くと自分の盤面が放置される）。
    // 部屋に入る前・待機中はメニューへ戻る。元の履歴は ?room= を消しておき、戻った先で再入室しないようにする。
    const entered = location.href;
    history.replaceState(null, "", location.pathname);
    history.pushState({ swaprise: "online" }, "", entered);
    this.historyPushed = true;
    const onPop = () => {
      if (!this.historyPushed) return;
      history.pushState({ swaprise: "online" }, "", location.href);
      const phase = this.session?.state?.phase;
      if (phase === "playing" || phase === "suspended" || phase === "countdown") {
        this.showBackHint();
        return;
      }
      if (phase === "result" || phase === "closed") return;
      if (!this.leaving) this.menu();
    };
    window.addEventListener("popstate", onPop);
    this.events.once("shutdown", () => {
      this.closing = true;
      this.epoch++;
      this.session?.dispose();
      this.cancelQueue();
      this.root.remove();
      this.touch?.destroy();
      this.playerInput?.destroy();
      document.removeEventListener("visibilitychange", this.visibleHandler);
      window.removeEventListener("resize", this.resizeHandler);
      window.removeEventListener("popstate", onPop);
      if (this.backHintTimer !== null) clearTimeout(this.backHintTimer);
      this.backHintTimer = null;
      this.backHintUntil = 0;
      wakeLock.release();
      audio.stopBgm();
      if (this.historyPushed) {
        // 自分で積んだ履歴を消す。popstate は外したリスナーには届かない。
        this.historyPushed = false;
        history.back();
      }
    });
    (window as any).__swapriseOnline = this;
    void this.initialize();
  }
  private syncTypography(): void {
    const layout = layoutFor("menu");
    const host = document.getElementById("game")!.getBoundingClientRect();
    const scale = Math.min(host.width / layout.width, host.height / layout.height);
    const item = layout.height < 560 ? MENU_TYPE.itemCompact : MENU_TYPE.item;
    this.root.style.setProperty("--online-title", `${(layout.portrait ? MENU_TYPE.titlePortrait : MENU_TYPE.titleLandscape) * scale}px`);
    this.root.style.setProperty("--online-item", `${item * scale}px`);
    this.root.style.setProperty("--online-caption", `${MENU_TYPE.caption * scale}px`);
  }
  private button(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = label;
    if (label === t("BACK TO MENU")) button.className = "online-back";
    button.onclick = () => {
      audio.start();
      action();
    };
    this.actions.append(button);
    return button;
  }
  private async initialize(): Promise<void> {
    const epoch = this.epoch;
    try {
      await api("session");
      if (this.closing || this.epoch !== epoch) return;
      await retryPendingLeave();
      const participation: Participation = await api("online/recovery");
      if (this.closing || this.epoch !== epoch) return;
      const saved = savedConnection();
      const params = new URLSearchParams(location.search);
      const roomId = params.get("room");
      if (participation.connection || participation.queueId) {
        if (participation.connection && saved?.token === participation.connection.token &&
          saved.roomId === participation.connection.roomId && (!roomId || roomId === saved.roomId)) {
          this.connect({ ...saved, ...participation.connection });
        } else this.showRecovery(participation);
        return;
      }
      sessionStorage.removeItem("swaprise.connection.v1");
      const status = roomId ? await api(`rooms/${roomId}/status`) : null;
      if (this.closing || this.epoch !== epoch) return;
      if (roomId && status?.expired) {
        history.replaceState(null, "", location.pathname);
        this.choose(null, null);
        this.status.textContent = t("This invite link has expired. Create a new room or find a match.");
        return;
      }
      this.choose(
        roomId,
        new URLSearchParams(location.hash.slice(1)).get("invite"),
      );
    } catch (e) {
      if (this.closing || this.epoch !== epoch) return;
      this.status.textContent = (e as Error).message;
      this.actions.replaceChildren();
      this.button(t("RETRY"), () => void this.initialize());
      this.button(t("BACK TO MENU"), () => this.menu());
    }
  }
  private showRecovery(participation: Participation): void {
    const epoch = this.epoch;
    this.root.classList.remove("playing");
    this.actions.replaceChildren();
    this.status.textContent = participation.connection
      ? t("You have an existing room. Resume here, or leave it to continue.")
      : t("You have an existing search. Cancel it to continue here.");
    const run = async (resume: boolean): Promise<void> => {
      this.actions.querySelectorAll("button").forEach((b) => b.disabled = true);
      this.status.textContent = resume ? t("Reconnecting…") : t("Leaving…");
      try {
        if (resume && participation.connection) {
          const connection: Connection = await api("online/resume", participation.connection);
          if (this.closing || this.epoch !== epoch) return;
          history.replaceState(null, "", location.pathname);
          this.connect(connection);
        } else {
          await leaveParticipation(participation.connection ?? { queueId: participation.queueId });
          if (!this.closing && this.epoch === epoch) await this.initialize();
        }
      } catch {
        if (this.closing || this.epoch !== epoch) return;
        this.actions.replaceChildren();
        this.status.textContent = t("Could not complete the request. Check your connection and retry.");
        this.button(t("RETRY"), () => void this.initialize());
        this.button(t("BACK TO MENU"), () => this.menu());
      }
    };
    if (participation.connection) this.button(t("RESUME HERE"), () => void run(true));
    this.button(participation.connection ? t("LEAVE AND CONTINUE") : t("CANCEL SEARCH"), () => void run(false));
    this.button(t("BACK TO MENU"), () => this.menu());
  }
  private async checkParticipation(message: string): Promise<void> {
    const epoch = this.epoch;
    try {
      const participation: Participation = await api("online/recovery");
      if (this.closing || this.epoch !== epoch) return;
      if (participation.connection || participation.queueId) this.showRecovery(participation);
      else {
        this.choose(new URLSearchParams(location.search).get("room"), new URLSearchParams(location.hash.slice(1)).get("invite"));
        this.status.textContent = message;
      }
    } catch {
      if (this.closing || this.epoch !== epoch) return;
      this.actions.replaceChildren();
        this.status.textContent = t("Could not check participation. Check your connection and retry.");
      this.button(t("RETRY"), () => void this.initialize());
      this.button(t("BACK TO MENU"), () => this.menu());
    }
  }
  private choose(roomId: string | null, invite: string | null): void {
    const epoch = this.epoch;
    this.actions.replaceChildren();
    this.root.classList.remove("playing");
    this.status.textContent = roomId
      ? t("Join your friend’s room.")
      : t("Choose how to play.");
    const label = document.createElement("label");
    label.textContent = t("Name (optional)");
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 40;
    input.placeholder = t("Guest");
    input.value = playerName();
    label.append(input);
    this.actions.append(label);
    const run = (kind: string): void => {
      const name = savePlayerName(input.value);
      this.status.textContent = t("Connecting…");
      this.actions
        .querySelectorAll("button")
        .forEach((b) => (b.disabled = true));
      const data = { name, version: GAME_VERSION, invite };
      if (kind === "random") {
        this.startQueue(name);
        return;
      }
      void api(kind === "join" ? `rooms/${roomId}/join` : "rooms", data)
        .then((c) => {
          if (this.closing || this.epoch !== epoch) return;
          const url = new URL(location.href);
          url.search = `?room=${c.roomId}`;
          url.hash = c.invite
            ? `invite=${c.invite}`
            : invite
              ? `invite=${invite}`
              : "";
          history.replaceState(null, "", url);
          this.connect(c);
        })
        .catch((e) => {
          if (!this.closing && this.epoch === epoch) void this.checkParticipation(e.message);
        });
    };
    if (roomId && invite) this.button(t("JOIN ROOM"), () => run("join"));
    else {
      this.button(t("INVITE FRIEND"), () => run("invite"));
      this.button(t("FIND MATCH"), () => run("random"));
    }
    this.button(t("BACK TO MENU"), () => this.menu());
  }
  private startQueue(name: string): void {
    const attempt = ++this.queueAttempt;
    this.status.textContent = t("Checking matchmaking…");
    this.actions.replaceChildren();
    this.button(t("CANCEL"), () => { this.cancelQueue(); this.choose(null, null); });
    void api("queue/status", { version: GAME_VERSION }).then(() => {
      if (!this.closing && this.queueAttempt === attempt) this.openQueue(name);
    }).catch((error) => {
      if (!this.closing && this.queueAttempt === attempt) this.queueFailure(error);
    });
  }
  private queueFailure(error: unknown): void {
    if (error instanceof ApiError && error.code === "UPDATE_REQUIRED") {
      // 新版の Service Worker が待機済みなら、押させずにそのまま切り替える（まもなく reload される）
      if (applyPendingUpdate()) return;
      this.status.textContent = error.message;
      this.actions.replaceChildren();
      this.button(t("RELOAD"), () => location.reload());
      this.button(t("BACK TO MENU"), () => this.menu());
      return;
    }
    void this.checkParticipation(error instanceof Error ? error.message : "Could not connect. Please retry.");
  }
  private async explainQueueClose(message: string): Promise<void> {
    const epoch = this.epoch;
    const attempt = this.queueAttempt;
    try {
      // Upgradeのエラー本文はブラウザから読めないのでHTTPで同じ条件を確認する。
      await api("queue/status", { version: GAME_VERSION });
      if (!this.closing && this.epoch === epoch && this.queueAttempt === attempt)
        void this.checkParticipation(message);
    } catch (error) {
      if (!this.closing && this.epoch === epoch && this.queueAttempt === attempt) this.queueFailure(error);
    }
  }
  private openQueue(name: string): void {
    this.actions.replaceChildren();
    this.button(t("CANCEL"), () => {
      const queueId = this.queueId;
      this.cancelQueue();
      this.actions.replaceChildren();
      this.status.textContent = t("Cancelling search…");
      void (queueId ? leaveParticipation({ queueId }) : Promise.resolve())
        .then(() => this.checkParticipation(t("Search cancelled. You can start again.")))
        .catch(() => this.checkParticipation(t("Could not cancel yet. Please retry.")));
    });
    const url = new URL("/api/queue/ws", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    url.search = new URLSearchParams({
      name,
      version: GAME_VERSION,
      visible: String(!document.hidden),
    }).toString();
    const queue = this.queue = new WebSocket(url);
    this.waitingSince = Date.now();
    let queueError = "Search ended. Check your connection and retry.";
    this.queue.onmessage = (e) => {
      if (this.closing || this.queue !== queue) return;
      const m = JSON.parse(e.data) as ServerMessage;
      if (m.type === "matched") {
        this.cancelQueue();
        this.connect(m);
      } else if (m.type === "queued") {
        this.waitingSince = m.since;
        this.queueId = m.queueId ?? null;
      }
      else if (m.type === "error") this.status.textContent = queueError = m.message;
    };
    this.queue.onopen = () => {
      this.queue?.send(
        JSON.stringify({ type: "visibility", visible: !document.hidden }),
      );
    };
    this.queue.onclose = () => {
      // キャンセルした古い接続で次の待機を閉じない。
      if (!this.closing && this.queue === queue) {
        this.cancelQueue();
        void this.explainQueueClose(queueError);
      }
    };
    let lastPing = 0;
    this.queueTimer = setInterval(() => {
      this.status.textContent = `${t("Finding an opponent…")} ${Math.floor((Date.now() - this.waitingSince) / 1000)}s`;
      if (
        Date.now() - lastPing >= 15000 &&
        this.queue?.readyState === WebSocket.OPEN
      ) {
        lastPing = Date.now();
        this.queue.send(JSON.stringify({ type: "ping", at: Date.now() }));
      }
    }, 1000);
  }
  private cancelQueue(): void {
    this.queueAttempt++;
    const q = this.queue;
    this.queue = null;
    this.queueId = null;
    if (q?.readyState === WebSocket.OPEN)
      q.send(JSON.stringify({ type: "cancel" }));
    q?.close();
    if (this.queueTimer) clearInterval(this.queueTimer);
    this.queueTimer = null;
  }
  private connect(c: Connection): void {
    this.session?.dispose();
    this.session = new OnlineSession(c);
    this.session.addEventListener("change", () => this.refresh());
    this.session.addEventListener("requeue", () => {
      this.session?.dispose();
      this.session = null;
      this.clearBoard();
      this.startQueue(displayName(playerName()));
    });
    this.actionKey = "";
    this.refresh();
  }
  private recoverSession(): void {
    this.session?.dispose();
    this.session = null;
    this.clearBoard();
    audio.stopBgm();
    this.root.classList.remove("playing");
    this.actions.replaceChildren();
    this.status.textContent = t("Checking participation…");
    void this.checkParticipation(t("Choose how to play."));
  }
  private refresh(): void {
    const s = this.session;
    const state = s?.state;
    if (!s) return;
    if (!state) {
      this.root.classList.remove("playing");
      this.touch?.setEnabled(false);
      if (this.gameId) this.clearBoard();
      audio.stopBgm();
      this.status.textContent = s.error || t("Joining room…");
      this.actions.replaceChildren();
      this.button(t("CHECK PARTICIPATION"), () => this.recoverSession());
      this.button(t("BACK TO MENU"), () => this.menu());
      return;
    }
    if (state.phase !== this.phase) {
      this.phase = state.phase;
      this.playerInput?.reset();
      this.raise = false;
      if (state.phase === "playing") {
        this.prediction?.reset();
        audio.gameStart();
        audio.startBgm("game");
      } else if (state.phase === "suspended") audio.stopBgm();
      else if (state.phase === "result" && state.result) {
        audio.stopBgm();
        this.showResult();
        if (state.result.winner === s.player) {
          audio.win();
          haptics.win();
        } else if (state.result.winner >= 0) audio.lose();
      }
    }
    if (!state.match && this.gameId) {
      this.clearBoard();
      audio.stopBgm();
    }
    if (s.lockstep && this.gameId !== s.lockstep.match.id) {
      this.buildBoard();
      this.showResult();
    }
    const playing = state.phase === "playing" && !this.settings;
    this.root.classList.toggle("playing", playing);
    this.touch?.setEnabled(playing);
    const me = state.seats[s.player];
    const other = state.seats[1 - s.player];
    if (s.error) this.status.textContent = s.error;
    else if (state.phase === "waiting")
      this.status.textContent = other
        ? t("{name} joined. Starting…", { name: other.name })
        : t("Waiting for your friend…");
    else if (state.phase === "countdown")
      this.status.textContent = `${Math.max(1, Math.ceil((state.startAt - Date.now()) / 1000))}…`;
    else if (state.phase === "suspended")
      this.status.textContent = `${t("Reconnecting…")} ${t("You")} ${Math.ceil((me?.grace ?? 0) / 1000)}s / ${t("Opponent")} ${Math.ceil((other?.grace ?? 0) / 1000)}s`;
    else if (state.phase === "playing")
      this.status.textContent = this.settings
        ? t("The match continues while settings are open.")
        : Date.now() < this.backHintUntil
          ? t("Back does not leave the game. Use SETTINGS to leave.")
          : `${other?.name ?? t("Opponent")} · ${t("playing")}${state.remaining <= 60000 ? ` · ${Math.ceil(state.remaining / 1000)}s` : ""}`;
    else if (state.phase === "closed")
      this.status.textContent = t("The opponent left or the room closed.");
    else if (state.result) {
      const r = state.result;
      const invalid = r.reason === "desync" || r.reason === "server";
      const reasons = {
        normal: "",
        surrender: " (surrender)",
        disconnect: " (disconnected)",
        timeout: " (time limit)",
        desync: " (out of sync)",
        server: " (connection error)",
      };
      this.status.textContent = `${invalid ? t("NO CONTEST") : r.winner < 0 ? t("DRAW") : r.winner === s.player ? t("YOU WIN!") : t("YOU LOSE")}${t(reasons[r.reason])}${me?.rematch ? t(" · Waiting for a rematch…") : other?.rematch ? t(" · Opponent wants a rematch") : ""}`;
      audio.stopBgm();
    }
    const key = [
      state.phase,
      this.settings,
      me?.rematch,
      other?.connected,
      !!s.error,
    ].join(":");
    if (key === this.actionKey) return;
    this.actionKey = key;
    this.actions.replaceChildren();
    if (s.error) {
      this.button(t("CHECK PARTICIPATION"), () => this.recoverSession());
      this.button(t("LEAVE ROOM"), () => this.menu());
      return;
    }
    if (state.phase === "waiting") {
      if (s.connection.invite)
        this.button(t("SHARE INVITE"), () => {
          void shareText(
            `${t("Play SWAPRISE with me!")}\n${location.origin}/?room=${s.connection.roomId}#invite=${s.connection.invite}`,
          ).then((result) => {
            this.status.textContent =
              result === "copied"
                ? t("Invite link copied.")
                : result === "failed"
                  ? t("Could not share the invite.")
                  : t("Invite shared.");
          });
        });
      this.button(t("LEAVE ROOM"), () => this.menu());
    } else if (state.phase === "playing" || state.phase === "suspended") {
      if (!this.settings && playing)
        this.button(t("SETTINGS"), () => {
          this.settings = true;
          this.playerInput?.reset();
          this.actionKey = "";
          this.refresh();
        });
      else {
        this.button(t("SOUND: {state}", { state: t(audio.muted ? "OFF" : "ON") }), () => {
          audio.setMuted(!audio.muted);
          this.actionKey = "";
          this.refresh();
        });
        if (haptics.supported)
          this.button(t("VIBRATION: {state}", { state: t(haptics.enabled ? "ON" : "OFF") }), () => {
            haptics.toggle();
            this.actionKey = "";
            this.refresh();
          });
        this.button(t("RESUME"), () => {
          this.settings = false;
          this.actionKey = "";
          this.refresh();
        });
        this.button(t("SURRENDER"), () => {
          this.actions.replaceChildren();
          this.status.textContent = t("Surrender this match?");
          this.button(t("YES, SURRENDER"), () => s.send({ type: "surrender" }));
          this.button(t("BACK"), () => {
            this.actionKey = "";
            this.refresh();
          });
        });
      }
    } else if (state.phase === "result") {
      if (other?.connected && !me?.rematch)
        this.button(t("REMATCH"), () => s.send({ type: "rematch" }));
      if (state.kind === "random")
        this.button(t("NEXT MATCH"), () => {
          this.actions.replaceChildren();
          this.status.textContent = t("Leaving room…");
          void s.leaveAndWait().then((released) => {
            if (this.closing) return;
            if (!released) {
              this.status.textContent =
                t("Could not leave the room. Return to the menu and try again.");
              this.actions.replaceChildren();
              this.button(t("BACK TO MENU"), () => this.menu());
              return;
            }
            this.session = null;
            this.clearBoard();
            this.startQueue(
              displayName(playerName()),
            );
          });
        });
      this.button(t("BACK TO MENU"), () => this.menu());
    } else if (state.phase === "closed")
      this.button(t("BACK TO MENU"), () => this.menu());
  }
  private clearBoard(): void {
    this.playerInput?.destroy();
    this.raiseHint?.destroy();
    this.raiseHint = null;
    this.views.forEach((v) => v.destroy());
    this.views = [];
    this.touch?.destroy();
    this.touch = null;
    this.gameId = "";
    this.prediction = null;
  }
  private buildBoard(): void {
    this.clearBoard();
    const s = this.session!;
    const l = s.lockstep!;
    this.gameId = l.match.id;
    this.prediction = new Prediction(l, s.player);
    this.views = this.prediction.game.boards.map(
      (b, i) =>
        new BoardView(
          this,
          b,
          i === s.player
            ? t("YOU")
            : this.boardName(s.state?.seats[i]?.name ?? "Guest"),
          i === s.player,
        ),
    );
    this.playerInput = new PlayerInput(this, P1_KEYS, 0);
    this.touch = new TouchInput(this, this.prediction.game.boards[s.player]);
    this.views[s.player].touch = this.touch;
    this.playerInput.touch = this.touch;
    this.raiseHint = new RaiseBar(this, () => {
      if (this.session?.state?.phase === "playing" && !this.settings)
        this.raise = true;
    });
    this.input.on("pointerup", () => {
      this.raise = false;
    });
    this.input.on("pointerupoutside", () => {
      this.raise = false;
    });
    this.accumulator = 0;
    this.settings = false;
    this.place();
    void wakeLock.request();
    (window as any).__swaprise = {
      game: l.game,
      scene: this,
      layout: this.layout,
    };
  }
  /** 決着したら CPU 対戦と同じように盤面の上に WIN / LOSE を出す。盤面が止まっただけでは決着が分かりにくい。 */
  private showResult(): void {
    const r = this.session?.state?.result;
    if (!r || this.session?.state?.phase !== "result") return;
    const invalid = r.reason === "desync" || r.reason === "server";
    this.views.forEach((view, i) => {
      const b = view.board;
      const title = invalid ? t("NO CONTEST") : r.winner < 0 ? t("DRAW") : r.winner === i ? t("WIN") : t("LOSE");
      if (!invalid && r.winner >= 0) view.playResult(r.winner === i ? "win" : "lose");
      view.showOverlay(title, `${t("MAX CHAIN")} x${b.maxChain}\n${t("COMBOS")} ${b.stats.combos}  ${t("CHAINS")} ${b.stats.chains}`);
    });
  }
  private boardName(name: string): string {
    const chars = [...name];
    return chars.length > 5 ? chars.slice(0, 5).join("") + "…" : name;
  }

  private place(): void {
    if (!this.views.length || !this.session) return;
    const L = this.layout;
    const me = this.session.player;
    const other = 1 - me;
    if (L.portrait) {
      const ox = Math.floor((L.width - BOARD_W * 1.5 - 12) / 2);
      this.views[me].place(ox, 66, 1);
      this.views[other].place(ox + BOARD_W + 12, 66, 0.5);
      this.touch?.place(ox, 66, 1);
    } else {
      const ox = L.phoneLandscape ? 40 : (L.width - BOARD_W * 2 - 120) / 2;
      const y = L.phoneLandscape ? 14 : 66;
      this.views[me].place(ox, y, 1, L.phoneLandscape ? "right" : "top");
      this.views[other].place(
        L.width - ox - BOARD_W,
        y,
        1,
        L.phoneLandscape ? "left" : "top",
      );
      this.touch?.place(ox, y, 1);
    }
    const view = this.views[me];
    // せり上げバー。GameScene と同じく、盤面の直下に盤面と同じ幅で置き、時間の行をその下へ下げる（横持ちは HUD の列）
    if (L.phoneLandscape) this.raiseHint?.resize(100, 44, 48).setPosition(view.ox + BOARD_W + 55, view.oy + 180);
    else {
      const barH = L.touch ? 30 : 26;
      this.raiseHint?.resize(BOARD_W, barH, 48).setPosition(view.ox + BOARD_W / 2, view.oy + BOARD_H + 12 + barH / 2);
      view.place(view.ox, view.oy, view.scale, view.hud, BOARD_H + 12 + barH + 8);
    }
  }
  /** 対戦中に戻る操作をした人へ、離れないことと退出の手順を数秒だけ知らせる。 */
  private showBackHint(): void {
    const DURATION = backHintDuration();
    this.backHintUntil = Date.now() + DURATION;
    if (this.backHintTimer !== null) clearTimeout(this.backHintTimer);
    this.backHintTimer = setTimeout(() => {
      this.backHintTimer = null;
      this.backHintUntil = 0;
      if (!this.closing) this.refresh();
    }, DURATION);
    this.refresh();
  }
  private menu(): void {
    const epoch = this.epoch;
    const finish = () => {
      this.cancelQueue();
      history.replaceState(null, "", location.pathname);
      this.scene.start("menu");
    };
    if (!this.session) { finish(); return; }
    this.actions.replaceChildren();
    this.status.textContent = t("Leaving room…");
    this.leaving = true;
    void this.session.leaveAndWait().then((left) => {
      if (this.closing || this.epoch !== epoch) return;
      this.leaving = false;
      if (left) finish();
      else {
        this.status.textContent = t("Could not leave yet. Check your connection and retry.");
        this.button(t("RETRY"), () => this.menu());
        this.button(t("BACK TO MENU"), finish);
      }
    });
  }
  override update(_time: number, delta: number): void {
    this.bg?.update(this.session?.state?.phase === "suspended" ? 0 : delta);
    this.raiseHint?.setRaising(this.session?.state?.phase === "playing" && this.lastRaise, delta);
    const s = this.session;
    const l = s?.lockstep;
    if (!s || !l) return;
    if (s.syncTarget !== null) {
      s.replay();
      this.prediction?.reset();
      this.touch?.clear();
    } else if (
      s.state?.phase === "playing" &&
      s.socket?.readyState === WebSocket.OPEN &&
      !document.hidden
    ) {
      this.accumulator += Math.min(delta, 100);
      for (let steps = 0; this.accumulator >= 1000 / 60 && steps < 6; steps++) {
        const input = l.capture(() => {
          const polled = this.settings
            ? { ...NO_INPUT }
            : this.playerInput!.poll();
          const local = {
            ...polled,
            raise: !this.settings && (this.raise || polled.raise),
          };
          this.lastRaise = local.raise;
          this.prediction!.advance(l.nextInput, local);
          const board = this.prediction!.game.boards[s.player];
          this.views[s.player].handleEvents(board.events, true, true);
          return local;
        });
        if (input)
          s.send({
            type: "input",
            matchId: l.match.id,
            ...input,
            ack: l.frame,
          });
        if (l.step()) {
          this.stalledMs = 0;
          const remote = 1 - s.player;
          // 相手は別の場所にいる。相手の盤面の危険・天井の警告音はこの端末で鳴らさない
          this.views[remote].handleEvents(
            l.game.boards[remote].events,
            true,
            false,
            false,
          );
          s.checkHash();
        } else {
          this.stalledMs += 1000 / 60;
          if (this.stalledMs > 250) this.playerInput?.reset();
        }
        this.accumulator -= 1000 / 60;
      }
      this.prediction?.reconcile();
      // ピンチの曲は自分の盤面だけで決める。相手の盤面が危険でも曲は変えない
      const board = this.prediction!.game.boards[s.player];
      audio.setDanger(musicDanger(board));
    } else {
      this.accumulator = 0;
      this.touch?.clear();
    }
    const phase = s.state?.phase;
    this.views.forEach((v) => v.draw(phase === "suspended" || phase === "countdown" ? 0 : delta, phase === "playing" || phase === "suspended"));
  }
}
