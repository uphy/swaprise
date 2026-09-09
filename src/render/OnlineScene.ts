import Phaser from "phaser";
import { BoardView } from "./BoardView";
import { PlayerInput, P1_KEYS } from "./input";
import { TouchInput } from "./touch";
import { applyLayout } from "./hidpi";
import { BOARD_H, BOARD_W, layoutFor, sameLayout, type Layout } from "./theme";
import { haptics } from "./haptics";
import { FONT, MENU_TYPE } from "./theme";
import { audio } from "./shared";
import { musicDanger } from "./musicDanger";
import { wakeLock } from "./wakelock";
import { shareText } from "./share";
import {
  OnlineSession,
  api,
  savedConnection,
  type Connection,
} from "../net/session";
import { GAME_VERSION, displayName, type ServerMessage } from "../net/protocol";
import { Prediction } from "../net/prediction";
import { NO_INPUT } from "../core/types";
import "./online.css";
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
  private gameId = "";
  private accumulator = 0;
  private queue: WebSocket | null = null;
  private queueTimer: ReturnType<typeof setInterval> | null = null;
  private waitingSince = 0;
  private settings = false;
  private actionKey = "";
  private visibleHandler = (): void => {};
  private resizeHandler = (): void => {};
  private closing = false;
  private phase = "";
  private stalledMs = 0;
  private raise = false;
  private raiseHint: Phaser.GameObjects.Text | null = null;
  constructor() {
    super("online");
  }
  create(): void {
    this.session = null;
    this.prediction = null;
    this.views = [];
    this.gameId = "";
    this.accumulator = 0;
    this.settings = false;
    this.actionKey = "";
    this.closing = false;
    this.phase = "";
    this.raise = false;
    this.layout = layoutFor("cpu");
    applyLayout(this, this.layout);
    this.root = document.createElement("div");
    this.root.className = "online-ui";
    this.root.style.fontFamily = FONT;
    this.syncTypography();
    this.panel = document.createElement("div");
    this.panel.className = "online-panel";
    const title = document.createElement("h1");
    title.textContent = "ONLINE";
    this.status = document.createElement("p");
    this.status.setAttribute("role", "status");
    this.status.textContent = "Connecting…";
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
        this.place();
      }
    };
    window.addEventListener("resize", this.resizeHandler);
    const back = () => {
      this.settings = true;
      this.actionKey = "";
      this.refresh();
    };
    window.addEventListener("popstate", back);
    this.input.keyboard!.on("keydown-ESC", back);
    this.events.once("shutdown", () => {
      this.closing = true;
      this.session?.dispose();
      this.cancelQueue();
      this.root.remove();
      this.touch?.destroy();
      this.playerInput?.destroy();
      document.removeEventListener("visibilitychange", this.visibleHandler);
      window.removeEventListener("resize", this.resizeHandler);
      window.removeEventListener("popstate", back);
      wakeLock.release();
      audio.stopBgm();
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
    if (label === "BACK TO MENU") button.className = "online-back";
    button.onclick = () => {
      audio.start();
      action();
    };
    this.actions.append(button);
    return button;
  }
  private async initialize(): Promise<void> {
    try {
      await api("session");
      if (this.closing) return;
      const saved = savedConnection();
      const params = new URLSearchParams(location.search);
      const roomId = params.get("room");
      const resume = saved && (!roomId || saved.roomId === roomId) ? saved : null;
      const target = resume?.roomId ?? roomId;
      const status = target ? await api(`rooms/${target}/status`) : null;
      if (this.closing) return;
      if (resume) {
        if (status?.active) {
          this.connect(resume);
          return;
        }
        sessionStorage.removeItem("swaprise.connection.v1");
      }
      if (roomId && status?.expired) {
        history.replaceState(null, "", location.pathname);
        this.choose(null, null);
        this.status.textContent = "This invite link has expired. Create a new room or find a match.";
        return;
      }
      this.choose(
        roomId,
        new URLSearchParams(location.hash.slice(1)).get("invite"),
      );
    } catch (e) {
      this.status.textContent = (e as Error).message;
      this.actions.replaceChildren();
      this.button("RETRY", () => void this.initialize());
      this.button("BACK TO MENU", () => this.menu());
    }
  }
  private choose(roomId: string | null, invite: string | null): void {
    this.actions.replaceChildren();
    this.root.classList.remove("playing");
    this.status.textContent = roomId
      ? "Join your friend’s room."
      : "Choose how to play.";
    const label = document.createElement("label");
    label.textContent = "Name (optional)";
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 40;
    input.placeholder = "Guest";
    input.value = localStorage.getItem("swaprise.name.v1") ?? "";
    label.append(input);
    this.actions.append(label);
    const run = (kind: string): void => {
      const name = displayName(input.value);
      localStorage.setItem("swaprise.name.v1", name);
      this.status.textContent = "Connecting…";
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
          if (this.closing) return;
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
          this.status.textContent = e.message;
          this.actions
            .querySelectorAll("button")
            .forEach((b) => (b.disabled = false));
        });
    };
    if (roomId && invite) this.button("JOIN ROOM", () => run("join"));
    else {
      this.button("INVITE FRIEND", () => run("invite"));
      this.button("FIND MATCH", () => run("random"));
    }
    this.button("BACK TO MENU", () => this.menu());
  }
  private startQueue(name: string): void {
    this.actions.replaceChildren();
    this.button("CANCEL", () => {
      this.cancelQueue();
      this.choose(null, null);
    });
    const url = new URL("/api/queue/ws", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    url.search = new URLSearchParams({
      name,
      version: GAME_VERSION,
      visible: String(!document.hidden),
    }).toString();
    this.queue = new WebSocket(url);
    this.waitingSince = Date.now();
    this.queue.onmessage = (e) => {
      const m = JSON.parse(e.data) as ServerMessage;
      if (m.type === "matched") {
        this.cancelQueue();
        this.connect(m);
      } else if (m.type === "queued") this.waitingSince = m.since;
      else if (m.type === "error") this.status.textContent = m.message;
    };
    this.queue.onopen = () => {
      this.queue?.send(
        JSON.stringify({ type: "visibility", visible: !document.hidden }),
      );
    };
    this.queue.onclose = () => {
      if (this.queue) {
        this.cancelQueue();
        this.status.textContent =
          "Search ended. Check your connection or try again later.";
        this.actions.replaceChildren();
        this.button("BACK", () => this.choose(null, null));
      }
    };
    let lastPing = 0;
    this.queueTimer = setInterval(() => {
      this.status.textContent = `Finding an opponent… ${Math.floor((Date.now() - this.waitingSince) / 1000)}s`;
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
    const q = this.queue;
    this.queue = null;
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
      this.startQueue(localStorage.getItem("swaprise.name.v1") ?? "Guest");
    });
    this.actionKey = "";
    this.refresh();
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
      this.status.textContent = s.error || "Joining room…";
      this.actions.replaceChildren();
      this.button("BACK TO MENU", () => this.menu());
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
        ? `${other.name} joined.${other.ready ? " Ready to play." : ""}`
        : "Waiting for your friend…";
    else if (state.phase === "countdown")
      this.status.textContent = `${Math.max(1, Math.ceil((state.startAt - Date.now()) / 1000))}…`;
    else if (state.phase === "suspended")
      this.status.textContent = `Reconnecting… You ${Math.ceil((me?.grace ?? 0) / 1000)}s / Opponent ${Math.ceil((other?.grace ?? 0) / 1000)}s`;
    else if (state.phase === "playing")
      this.status.textContent = this.settings
        ? "The match continues while settings are open."
        : `${other?.name ?? "Opponent"} · playing${state.remaining <= 60000 ? ` · ${Math.ceil(state.remaining / 1000)}s` : ""}`;
    else if (state.phase === "closed")
      this.status.textContent = "The opponent left or the room closed.";
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
      this.status.textContent = `${invalid ? "NO CONTEST" : r.winner < 0 ? "DRAW" : r.winner === s.player ? "YOU WIN!" : "YOU LOSE"}${reasons[r.reason]}${me?.rematch ? " · Waiting for a rematch…" : other?.rematch ? " · Opponent wants a rematch" : ""}`;
      audio.stopBgm();
    }
    const key = [
      state.phase,
      this.settings,
      me?.ready,
      me?.rematch,
      other?.connected,
    ].join(":");
    if (key === this.actionKey) return;
    this.actionKey = key;
    this.actions.replaceChildren();
    if (state.phase === "waiting") {
      if (s.connection.invite)
        this.button("SHARE INVITE", () => {
          void shareText(
            `Play SWAPRISE with me!\n${location.origin}/?room=${s.connection.roomId}#invite=${s.connection.invite}`,
          ).then((result) => {
            this.status.textContent =
              result === "copied"
                ? "Invite link copied."
                : result === "failed"
                  ? "Could not share the invite."
                  : "Invite shared.";
          });
        });
      if (other && !me?.ready)
        this.button("READY", () => s.send({ type: "ready" }));
      this.button("LEAVE ROOM", () => this.menu());
    } else if (state.phase === "playing" || state.phase === "suspended") {
      if (!this.settings && playing)
        this.button("SETTINGS", () => {
          this.settings = true;
          this.playerInput?.reset();
          this.actionKey = "";
          this.refresh();
        });
      else {
        this.button(`SOUND: ${audio.muted ? "OFF" : "ON"}`, () => {
          audio.setMuted(!audio.muted);
          this.actionKey = "";
          this.refresh();
        });
        if (haptics.supported)
          this.button(`VIBRATION: ${haptics.enabled ? "ON" : "OFF"}`, () => {
            haptics.toggle();
            this.actionKey = "";
            this.refresh();
          });
        this.button("RESUME", () => {
          this.settings = false;
          this.actionKey = "";
          this.refresh();
        });
        this.button("SURRENDER", () => {
          this.actions.replaceChildren();
          this.status.textContent = "Surrender this match?";
          this.button("YES, SURRENDER", () => s.send({ type: "surrender" }));
          this.button("BACK", () => {
            this.actionKey = "";
            this.refresh();
          });
        });
      }
    } else if (state.phase === "result") {
      if (other?.connected && !me?.rematch)
        this.button("REMATCH", () => s.send({ type: "rematch" }));
      if (state.kind === "random")
        this.button("NEXT MATCH", () => {
          this.actions.replaceChildren();
          this.status.textContent = "Leaving room…";
          void s.leaveAndWait().then((released) => {
            if (this.closing) return;
            if (!released) {
              this.status.textContent =
                "Could not leave the room. Return to the menu and try again.";
              this.actions.replaceChildren();
              this.button("BACK TO MENU", () => this.menu());
              return;
            }
            this.session = null;
            this.clearBoard();
            this.startQueue(
              localStorage.getItem("swaprise.name.v1") ?? "Guest",
            );
          });
        });
      this.button("BACK TO MENU", () => this.menu());
    } else if (state.phase === "closed")
      this.button("BACK TO MENU", () => this.menu());
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
            ? "YOU"
            : this.boardName(s.state?.seats[i]?.name ?? "Guest"),
          i === s.player,
        ),
    );
    this.playerInput = new PlayerInput(this, P1_KEYS, 0);
    this.touch = new TouchInput(this, this.prediction.game.boards[s.player]);
    this.playerInput.touch = this.touch;
    this.raiseHint = this.add
      .text(0, 0, "▲ ▲ ▲", {
        fontFamily: FONT,
        fontSize: "16px",
        color: "#6a6a80",
      })
      .setPadding(30, 14)
      .setOrigin(0.5)
      .setInteractive();
    this.raiseHint.on("pointerdown", () => {
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
      const title = invalid ? "NO CONTEST" : r.winner < 0 ? "DRAW" : r.winner === i ? "WIN" : "LOSE";
      view.showOverlay(title, `MAX CHAIN x${b.maxChain}\nCOMBOS ${b.stats.combos}  CHAINS ${b.stats.chains}`);
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
    this.raiseHint?.setPosition(
      L.phoneLandscape ? view.ox + BOARD_W + 55 : view.ox + BOARD_W / 2,
      L.phoneLandscape ? view.oy + 180 : view.oy + BOARD_H + 44,
    );
  }
  private menu(): void {
    this.session?.leave();
    this.cancelQueue();
    history.replaceState(null, "", location.pathname);
    this.scene.start("menu");
  }
  override update(_time: number, delta: number): void {
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
          this.views[remote].handleEvents(
            l.game.boards[remote].events,
            true,
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
      const board = this.prediction!.game.boards[s.player];
      audio.setDanger(musicDanger(board));
    } else {
      this.accumulator = 0;
      this.touch?.clear();
    }
    this.views.forEach((v) => v.draw());
  }
}
