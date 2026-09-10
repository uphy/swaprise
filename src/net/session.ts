import {
  GAME_VERSION,
  PROTOCOL,
  type ClientMessage,
  type RoomState,
  type ServerMessage,
} from "./protocol";
import { Lockstep } from "./lockstep";
import { stateHash } from "./hash";
export interface Connection {
  roomId: string;
  token: string;
  invite?: string;
}
export class ApiError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}
export async function api(path: string, data: unknown = {}): Promise<any> {
  const response = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json();
  if (!response.ok) throw new ApiError(body.error ?? "Could not connect.", body.code);
  return body;
}
export const savedConnection = (): Connection | null => {
  try {
    return JSON.parse(
      sessionStorage.getItem("swaprise.connection.v1") ?? "null",
    );
  } catch {
    return null;
  }
};
export interface Participation {
  connection: Connection | null;
  queueId?: string;
}
export interface LeaveTarget { roomId?: string; token?: string; queueId?: string }
const PENDING_LEAVE = "swaprise.pending-leave.v1";
export function clearConnection(connection: Connection): void {
  const saved = savedConnection();
  if (saved?.roomId === connection.roomId && saved.token === connection.token)
    sessionStorage.removeItem("swaprise.connection.v1");
}
export async function leaveParticipation(target: LeaveTarget): Promise<void> {
  sessionStorage.setItem(PENDING_LEAVE, JSON.stringify(target));
  await api("online/leave", target);
  if (target.roomId && target.token) clearConnection(target as Connection);
  if (sessionStorage.getItem(PENDING_LEAVE) === JSON.stringify(target))
    sessionStorage.removeItem(PENDING_LEAVE);
}
export async function retryPendingLeave(): Promise<void> {
  const saved = sessionStorage.getItem(PENDING_LEAVE);
  if (saved) await leaveParticipation(JSON.parse(saved));
}
export class OnlineSession extends EventTarget {
  socket: WebSocket | null = null;
  state: RoomState | null = null;
  player = 0;
  lockstep: Lockstep | null = null;
  error = "";
  syncTarget: number | null = null;
  private disposed = false;
  private leaving = false;
  private attempts = 0;
  private reconnect: ReturnType<typeof setTimeout> | null = null;
  private pinger: ReturnType<typeof setInterval>;
  private lastHash = -1;
  private lastFinish = "";
  rtt = 0;
  private samples: number[] = [];
  constructor(readonly connection: Connection) {
    super();
    sessionStorage.setItem(
      "swaprise.connection.v1",
      JSON.stringify(connection),
    );
    this.open();
    this.pinger = setInterval(
      () => this.send({ type: "ping", at: Date.now() }),
      10000,
    );
  }
  private notify(): void {
    this.dispatchEvent(new Event("change"));
  }
  private open(): void {
    if (this.disposed) return;
    const url = new URL(
      `/api/rooms/${this.connection.roomId}/ws`,
      location.href,
    );
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = (this.socket = new WebSocket(url));
    ws.onopen = () => {
      if (this.disposed || this.leaving) return;
      this.error = "";
      this.send({
        type: "hello",
        protocol: PROTOCOL,
        version: GAME_VERSION,
        token: this.connection.token,
        visible: !document.hidden,
      });
      this.samples = [];
      this.send({ type: "ping", at: Date.now() });
      this.notify();
    };
    ws.onmessage = (e) => {
      if (this.disposed || this.leaving) return;
      const m = JSON.parse(e.data) as ServerMessage;
      if (m.type === "state") {
        this.attempts = 0;
        this.state = m.state;
        this.player = m.player;
        if (!m.state.match) {
          this.lockstep = null;
          this.syncTarget = null;
        }
        if (m.state.match && this.lockstep?.match.id !== m.state.match.id) {
          this.lockstep = new Lockstep(m.state.match);
          this.lastHash = -1;
          this.lastFinish = "";
          this.syncTarget = null;
        }
        if (m.state.phase === "closed") {
          clearConnection(this.connection);
          this.dispose();
        }
      } else if (m.type === "left") {
        this.dispatchEvent(new Event("left"));
      } else if (m.type === "frames" && m.matchId === this.lockstep?.match.id)
        this.lockstep.receive(m.startFrame, m.frames);
      else if (m.type === "sync" && m.matchId === this.lockstep?.match.id)
        this.syncTarget = m.frame;
      else if (m.type === "requeue") {
        clearConnection(this.connection);
        this.dispatchEvent(new Event("requeue"));
      } else if (m.type === "error") {
        this.error = m.message;
        if (m.fatal) {
          clearConnection(this.connection);
          this.state = null;
          this.dispose();
        }
      }
      else if (m.type === "pong") {
        this.rtt = Date.now() - m.at;
        this.samples.push(this.rtt);
        if (this.samples.length < 3)
          this.send({ type: "ping", at: Date.now() });
        else if (this.samples.length === 3)
          this.send({ type: "latency", rtt: Math.max(...this.samples) });
      }
      this.notify();
    };
    ws.onclose = (event) => {
      if (this.disposed || this.leaving) return;
      if (event.code === 4001) {
        this.error = "This room was opened in another tab.";
        this.state = null;
        clearConnection(this.connection);
        this.dispose();
        this.notify();
        return;
      }
      if (++this.attempts > 15) {
        this.error =
          "Could not connect. Return to the menu and try again.";
        this.dispose();
        this.notify();
        return;
      }
      this.error = "Reconnecting…";
      this.notify();
      this.reconnect = setTimeout(() => this.open(), 1000);
    };
    ws.onerror = () => {
      if (this.disposed || this.leaving) return;
      this.error = "Checking connection…";
      this.notify();
    };
  }
  send(m: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(m));
  }
  checkHash(): void {
    const l = this.lockstep;
    if (!l || !l.frame) return;
    if (l.game.finished && this.lastFinish !== l.match.id) {
      this.lastFinish = l.match.id;
      this.send({
        type: "hash",
        matchId: l.match.id,
        frame: l.frame,
        hash: stateHash(l.game),
        winner: l.game.winner,
      });
    } else if (l.frame % 120 === 0 && this.lastHash !== l.frame) {
      this.lastHash = l.frame;
      this.send({
        type: "hash",
        matchId: l.match.id,
        frame: l.frame,
        hash: stateHash(l.game),
      });
    }
  }
  replay(): boolean {
    const l = this.lockstep;
    if (!l || this.syncTarget === null) return false;
    for (let i = 0; i < 240 && l.frame < this.syncTarget; i++)
      if (!l.step()) break;
    if (l.frame === this.syncTarget) {
      l.resume(l.frame + l.match.delay);
      this.send({
        type: "resume",
        matchId: l.match.id,
        frame: l.frame,
        hash: stateHash(l.game),
      });
      this.syncTarget = null;
    }
    return true;
  }
  async leaveAndWait(): Promise<boolean> {
    // ソケットの状態に関係なくHTTPで退出し、応答を失ったら次回も再試行する。
    this.leaving = true;
    try {
      await leaveParticipation(this.connection);
      this.dispose();
      return true;
    } catch {
      this.leaving = false;
      return false;
    }
  }
  dispose(): void {
    this.disposed = true;
    clearInterval(this.pinger);
    if (this.reconnect) clearTimeout(this.reconnect);
    this.socket?.close();
  }
}
