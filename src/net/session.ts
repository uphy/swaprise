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
export async function api(path: string, data: unknown = {}): Promise<any> {
  const response = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "接続できませんでした");
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
export class OnlineSession extends EventTarget {
  socket: WebSocket | null = null;
  state: RoomState | null = null;
  player = 0;
  lockstep: Lockstep | null = null;
  error = "";
  syncTarget: number | null = null;
  private disposed = false;
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
      const m = JSON.parse(e.data) as ServerMessage;
      if (m.type === "state") {
        this.attempts = 0;
        this.state = m.state;
        this.player = m.player;
        if (m.state.match && this.lockstep?.match.id !== m.state.match.id) {
          this.lockstep = new Lockstep(m.state.match);
          this.lastHash = -1;
          this.lastFinish = "";
          this.syncTarget = null;
        }
        if (m.state.phase === "closed") {
          sessionStorage.removeItem("swaprise.connection.v1");
          this.dispose();
        }
      } else if (m.type === "frames" && m.matchId === this.lockstep?.match.id)
        this.lockstep.receive(m.startFrame, m.frames);
      else if (m.type === "sync" && m.matchId === this.lockstep?.match.id)
        this.syncTarget = m.frame;
      else if (m.type === "requeue") {
        sessionStorage.removeItem("swaprise.connection.v1");
        this.dispatchEvent(new Event("requeue"));
      } else if (m.type === "error") this.error = m.message;
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
    ws.onclose = () => {
      if (this.disposed) return;
      if (++this.attempts > 15) {
        this.error =
          "接続できませんでした。メニューへ戻ってやり直してください。";
        this.dispose();
        this.notify();
        return;
      }
      this.error = "再接続しています…";
      this.notify();
      this.reconnect = setTimeout(() => this.open(), 1000);
    };
    ws.onerror = () => {
      this.error = "通信を確認しています…";
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
  leave(): void {
    this.send({ type: "leave" });
    sessionStorage.removeItem("swaprise.connection.v1");
    this.dispose();
  }
  dispose(): void {
    this.disposed = true;
    clearInterval(this.pinger);
    if (this.reconnect) clearTimeout(this.reconnect);
    this.socket?.close();
  }
}
