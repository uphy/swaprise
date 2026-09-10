import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";
import { RoomEngine, type Member } from "./room-engine";
import {
  GAME_VERSION,
  PROTOCOL,
  type ClientMessage,
  type RoomState,
  type ServerMessage,
} from "../src/net/protocol";
import { json } from "./index";
interface SocketInfo {
  session: string;
  player: number;
  token?: string;
  visible: boolean;
  connectedAt: number;
  window: number;
  count: number;
}
interface Saved {
  id: string;
  invite: string;
  members: (Member | null)[];
  state: RoomState;
  touched: number;
}
export class Room extends DurableObject<Env> {
  private engine: RoomEngine;
  private id = "";
  private invite = "";
  private touched = Date.now();
  private interval: ReturnType<typeof setInterval> | null = null;
  private savedFrame = 0;
  private savedAt = 0;
  private metrics = { messages: 0, connections: 0, writes: 0, chunks: 0 };
  private reserving = false;
  private get expiresAt(): number {
    return this.touched + (this.engine.state.kind === "invite" ? 86_400_000 : 600_000);
  }
  private get nextAlarm(): number {
    if (this.engine.state.kind !== "invite" || !["waiting", "result"].includes(this.engine.state.phase)) return this.expiresAt;
    return Math.min(this.expiresAt, ...this.engine.members.flatMap((m, i) =>
      m && !this.engine.state.seats[i]?.connected ? [(m.disconnectedAt ?? this.touched) + 60000] : []));
  }
  private async pruneDisconnected(): Promise<void> {
    if (this.engine.state.kind !== "invite" || !["waiting", "result"].includes(this.engine.state.phase)) return;
    const removed: Member[] = [];
    for (let i = 0; i < this.engine.members.length; i++) {
      const m = this.engine.members[i];
      if (m && !this.engine.state.seats[i]?.connected && Date.now() - (m.disconnectedAt ?? this.touched) >= 60000) {
        removed.push({ ...m });
        this.engine.message(i, { type: "leave" }, Date.now());
        this.savedFrame = 0;
      }
    }
    if (removed.length) {
      await this.persist();
      this.ctx.waitUntil(this.release(removed));
      console.log(JSON.stringify({ event: "online_abandoned_seats", count: removed.length }));
    }
  }
  private get expired(): boolean {
    return !["playing", "suspended", "countdown"].includes(this.engine.state.phase) && Date.now() >= this.expiresAt;
  }
  private serial: Promise<unknown> = Promise.resolve();
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.serial.then(fn);
    this.serial = p.catch(() => {});
    return p;
  }
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.engine = new RoomEngine("invite", (i, m) => this.send(i, m));
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Saved>("room");
      if (!saved) return;
      this.id = saved.id;
      this.invite = saved.invite;
      this.touched = saved.touched;
      this.engine.state = saved.state;
      this.engine.members = saved.members;
      // 未保存の配信があり得る再起動では、古い状態で勝敗を決めない。
      const interrupted = ["playing", "suspended", "countdown"].includes(
        saved.state.phase,
      );
      if (interrupted) this.engine.finish(-1, "server");
      this.engine.state.seats.forEach((s) => {
        if (s) {
          s.connected = false;
          s.visible = false;
        }
      });
      for (const ws of ctx.getWebSockets()) {
        if (interrupted) ws.close(1012, "reconnect");
        else {
          const a: SocketInfo = ws.deserializeAttachment();
          const seat = this.engine.state.seats[a.player];
          if (seat) {
            seat.connected = true;
            seat.visible = a.visible;
          }
        }
      }
    });
  }
  private send(i: number, m: ServerMessage): void {
    for (const ws of this.ctx.getWebSockets())
      if ((ws.deserializeAttachment() as SocketInfo)?.player === i) {
        try {
          ws.send(JSON.stringify(m));
        } catch {
          /* closeイベントで回収 */
        }
      }
  }
  private replaceConnection(player: number, except?: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      const info: SocketInfo = ws.deserializeAttachment();
      if (ws === except || info.player !== player) continue;
      info.player = -1;
      ws.serializeAttachment(info);
      ws.close(4001, "opened in another tab");
    }
    if (this.engine.state.seats[player]?.connected)
      this.engine.disconnect(player, Date.now());
  }
  private async persist(): Promise<void> {
    const frame = this.engine.history.length;
    if (frame > this.savedFrame) {
      // 1秒分を1行にまとめ、毎フレームの書き込みを避ける。
      await this.ctx.storage.put(
        `frames:${this.engine.state.match?.id}:${this.savedFrame}`,
        this.engine.history.slice(this.savedFrame),
      );
      this.metrics.writes++;
      this.metrics.chunks++;
      this.savedFrame = frame;
    }
    this.metrics.writes++;
    await this.ctx.storage.put("room", {
      id: this.id,
      invite: this.invite,
      members: this.engine.members,
      state: this.engine.state,
      touched: this.touched,
    } satisfies Saved);
    this.savedAt = Date.now();
  }
  private wake(): void {
    if (
      this.interval ||
      (this.engine.state.phase === "waiting" &&
        this.engine.state.kind === "invite")
    )
      return;
    this.interval = setInterval(() => {
      void this.run(async () => {
        this.engine.clock(Date.now());
        const phase = this.engine.state.phase;
        if (["playing", "suspended", "countdown"].includes(phase))
          this.touched = Date.now();
        if (Date.now() - this.savedAt >= 1000) {
          this.engine.publish();
          await this.persist();
        }
        if (
          phase === "waiting" &&
          this.engine.state.kind === "random" &&
          Date.now() - this.touched > 10000
        ) {
          this.engine.state.phase = "closed";
          this.ctx.waitUntil(
            (async () => {
              for (let i = 0; i < 2; i++) {
                const m = this.engine.members[i];
                if (!m) continue;
                await this.env.COORDINATOR.get(
                  this.env.COORDINATOR.idFromName("global"),
                ).fetch(
                  new Request("https://internal/return", {
                    method: "POST",
                    body: JSON.stringify({
                      session: m.session,
                      roomId: this.id,
                      token: m.token,
                      since:
                        (m as Member & { since?: number }).since ??
                        this.touched,
                    }),
                  }),
                );
                if (this.engine.state.seats[i]?.connected)
                  this.send(i, { type: "requeue" });
              }
              this.engine.publish();
            })(),
          );
          this.ctx.waitUntil(this.release());
        }
        if (
          ["result", "closed"].includes(this.engine.state.phase) ||
          (this.engine.state.phase === "waiting" &&
            this.engine.state.kind === "invite")
        ) {
          clearInterval(this.interval!);
          this.interval = null;
          await this.persist();
          await this.ctx.storage.setAlarm(this.nextAlarm);
        }
      }).catch(() => {
        this.engine.finish(-1, "server");
      });
    }, 250);
  }
  async fetch(req: Request): Promise<Response> {
    return this.run(() => this.handle(req));
  }
  private async handle(req: Request): Promise<Response> {
    const path = new URL(req.url).pathname;
    await this.pruneDisconnected();
    if (["/recovery", "/takeover", "/leave"].includes(path)) {
      const { session, token } = await req.json() as { session: string; token?: string };
      const i = this.engine.members.findIndex((m) => m?.session === session);
      const member = this.engine.members[i];
      if (path === "/leave") {
        if (member && member.token !== token) return json({ ok: true, stale: true });
        if (member && member.token === token) {
          this.replaceConnection(i);
          if (["playing", "suspended", "countdown"].includes(this.engine.state.phase))
            this.engine.finish(1 - i, "surrender");
          this.engine.message(i, { type: "leave" }, Date.now());
          // ランダム対戦の result でも、退出した席を残さない。
          this.engine.members[i] = null;
          this.engine.state.seats[i] = null;
          this.engine.publish();
          if (this.engine.state.kind === "invite") this.savedFrame = 0;
          await this.persist();
        }
        return json({ ok: true });
      }
      if (!member || this.expired || this.engine.state.phase === "closed")
        return path === "/recovery" ? json({ connection: null }) : json({ error: "This room has closed." }, 410);
      if (path === "/takeover") {
        if (member.token !== token) return json({ error: "Room participation changed. Please check again." }, 409);
        this.replaceConnection(i);
        member.token = crypto.randomUUID();
        member.disconnectedAt = Date.now();
        this.metrics.connections = 0;
        await this.persist();
        await this.ctx.storage.setAlarm(this.nextAlarm);
        console.log(JSON.stringify({ event: "online_resume", kind: this.engine.state.kind }));
      }
      return json({ connection: { roomId: this.id, token: member.token, ...(this.invite ? { invite: this.invite } : {}) }, kind: this.engine.state.kind });
    }
    if (path === "/membership" || path.endsWith("/status")) {
      await req.arrayBuffer();
      return json({ expired: !this.id || this.expired, active: !!this.id && !this.expired && this.engine.state.phase !== "closed" &&
        this.engine.members.some((m) => m?.session === req.headers.get("X-Session")) });
    }
    if (path === "/init") {
      if (this.id) return json({ error: "Room already exists." }, 409);
      const data = (await req.json()) as {
        id: string;
        invite?: string;
        kind: "invite" | "random";
        members: Member[];
      };
      this.id = data.id;
      this.invite = data.invite ?? "";
      this.engine = new RoomEngine(data.kind, (i, m) => this.send(i, m));
      data.members.forEach((m) => this.engine.join(m));
      await this.persist();
      await this.ctx.storage.setAlarm(this.nextAlarm);
      if (data.kind === "random") this.wake();
      return json({ ok: true });
    }
    if (path === "/join") {
      const { invite, member } = (await req.json()) as {
        invite: string;
        member: Member;
      };
      if (!this.id || this.expired) return json({ error: "This invite link has expired. Ask for a new link." }, 410);
      if (!this.invite || invite !== this.invite)
        return json({ error: "Invalid invite link." }, 403);
      if (this.engine.state.phase === "closed") {
        // 更新前に LEAVE で閉じた部屋も、有効な招待があれば再利用できる。
        for (const ws of this.ctx.getWebSockets()) {
          const info: SocketInfo = ws.deserializeAttachment();
          info.player = -1;
          ws.serializeAttachment(info);
          ws.close(1000, "room reopened");
        }
        this.engine = new RoomEngine("invite", (i, m) => this.send(i, m));
        this.savedFrame = 0;
      }
      try {
        const returning = this.engine.members.findIndex((m) => m?.session === member.session);
        if (returning >= 0) this.replaceConnection(returning);
        this.engine.join(member);
        // URLからの明示的な参加では、自動再接続の試行上限をリセットする。
        this.metrics.connections = 0;
        this.touched = Date.now();
        await this.persist();
        await this.ctx.storage.setAlarm(this.nextAlarm);
        return json({ ok: true });
      } catch (e) {
        return json({ error: (e as Error).message }, 409);
      }
    }
    if (!this.id || this.expired || this.engine.state.phase === "closed")
      return json({ error: "This room has closed." }, 410);
    if (
      path.endsWith("/metrics") &&
      this.env.TEST_MODE === "true" &&
      this.engine.members.some(
        (m) => m?.session === req.headers.get("X-Session"),
      )
    )
      return json({
        ...this.metrics,
        frame: this.engine.history.length,
        result: this.engine.state.result,
      });
    if (req.headers.get("Upgrade") !== "websocket")
      return json({ error: "WebSocket connection required." }, 400);
    const session = req.headers.get("X-Session") ?? "";
    if (!this.engine.members.some((m) => m?.session === session))
      return json({ error: "You have not joined this room." }, 403);
    if (this.ctx.getWebSockets().length >= 4)
      return json({ error: "Too many connections." }, 429);
    if (++this.metrics.connections > 20)
      return json({ error: "Reconnect limit reached." }, 429);
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({
      session,
      player: -1,
      visible: false,
      connectedAt: Date.now(),
      window: Date.now(),
      count: 0,
    } satisfies SocketInfo);
    this.wake();
    await this.ctx.storage.setAlarm(Date.now() + 5000);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  override async webSocketMessage(
    ws: WebSocket,
    raw: string | ArrayBuffer,
  ): Promise<void> {
    await this.run(async () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const a: SocketInfo = ws.deserializeAttachment();
      this.metrics.messages++;
      if (this.metrics.messages > 29000) {
        ws.close(1008, "message limit");
        this.engine.finish(a.player >= 0 ? 1 - a.player : -1, "disconnect");
        return;
      }
      try {
        if (typeof raw !== "string" || raw.length > 4096)
          throw new Error("Request too large.");
        if (Date.now() - a.window > 1000) {
          a.window = Date.now();
          a.count = 0;
        }
        if (++a.count > 50) throw new Error("Too many messages.");
        ws.serializeAttachment(a);
        const m = JSON.parse(raw) as ClientMessage;
        if (a.player < 0) {
          if (
            m.type !== "hello" ||
            m.protocol !== PROTOCOL ||
            m.version !== GAME_VERSION
          )
            throw new Error("Please reload to update the game.");
          const i = this.engine.members.findIndex(
            (member) =>
              member?.session === a.session && member?.token === m.token,
          );
          if (i < 0) throw new Error("Reconnect details do not match.");
          if (this.engine.state.seats[i]?.connected) this.replaceConnection(i, ws);
          a.visible = m.visible === true;
          a.player = i;
          a.token = m.token;
          ws.serializeAttachment(a);
          this.engine.connect(i, m.visible === true, Date.now());
          this.touched = Date.now();
          await this.persist();
        } else {
          this.engine.message(a.player, m, Date.now());
          if (m.type === "visibility") {
            a.visible = m.visible === true;
            ws.serializeAttachment(a);
          }
          if (this.engine.state.phase === "waiting" && m.type !== "ping" && m.type !== "leave")
            await this.persist();
          if (m.type === "leave") {
            a.player = -1;
            ws.serializeAttachment(a);
            if (this.engine.state.kind === "invite") this.savedFrame = 0;
            this.touched = Date.now();
            await this.persist();
            this.ctx.waitUntil(
              this.release(this.engine.state.kind === "invite" ? [{ session: a.session, token: a.token }] : undefined).then(() => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: "left" }));
                  ws.close(1000, "left");
                }
              }),
            );
          }
        }
        if (this.engine.canStart() && !this.reserving) {
          this.reserving = true;
          this.ctx.waitUntil(
            this.reserveStart()
              .catch(() => {
                for (let i = 0; i < 2; i++)
                  this.send(i, {
                    type: "error",
                    message: "Could not prepare the match. Please reconnect.",
                  });
              })
              .finally(() => {
                this.reserving = false;
              }),
          );
        }
      } catch (e) {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(
          JSON.stringify({ type: "error", message: (e as Error).message, fatal: a.player < 0 }),
        );
        if (a.player < 0 || a.count > 50) ws.close(1008);
      }
    });
  }
  private async reserveStart(): Promise<void> {
    const id = crypto.randomUUID();
    const response = await this.env.COORDINATOR.get(
      this.env.COORDINATOR.idFromName("global"),
    ).fetch(
      new Request("https://internal/reserve", {
        method: "POST",
        body: JSON.stringify({
          id,
          kind: this.engine.state.kind,
          roomId: this.id,
          sessions: this.engine.members.filter(Boolean).map((m) => m!.session),
        }),
      }),
    );
    const ok = (await response.json()) as { ok: boolean };
    await this.run(async () => {
      if (!this.engine.canStart()) return;
      if (!ok.ok) {
        this.engine.state.seats.forEach((s) => {
          if (s) {
            s.rematch = false;
          }
        });
        this.engine.publish();
        for (let i = 0; i < 2; i++)
          this.send(i, {
            type: "error",
            message: "Daily match limit reached. Resets at 00:00 UTC.",
          });
        return;
      }
      this.savedFrame = 0;
      this.metrics = { messages: 0, connections: 0, writes: 0, chunks: 0 };
      this.engine.start(
        id,
        crypto.getRandomValues(new Uint32Array(1))[0],
        Date.now(),
      );
      this.wake();
      await this.persist();
    });
  }
  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.run(async () => {
      const a: SocketInfo = ws.deserializeAttachment();
      ws.close();
      if (a.player >= 0 && this.engine.members[a.player]?.token === a.token) {
        this.engine.disconnect(a.player, Date.now());
        await this.persist();
        await this.ctx.storage.setAlarm(this.nextAlarm);
        this.wake();
      }
    });
  }
  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }
  private async release(members: { session: string; token?: string }[] = this.engine.members.flatMap((m) => m ? [m] : [])): Promise<void> {
    for (const member of members)
        await this.env.COORDINATOR.get(
          this.env.COORDINATOR.idFromName("global"),
        ).fetch(
          new Request("https://internal/release", {
            method: "POST",
            headers: { "X-Session": member.session },
            body: JSON.stringify({ roomId: this.id, token: member.token }),
          }),
        );
  }
  override async alarm(): Promise<void> {
    await this.run(async () => {
      await this.pruneDisconnected();
      for (const ws of this.ctx.getWebSockets()) {
        const a: SocketInfo = ws.deserializeAttachment();
        if (a.player < 0 && Date.now() - a.connectedAt >= 5000)
          ws.close(1008, "authentication timeout");
      }
      if (
        ["playing", "suspended", "countdown"].includes(this.engine.state.phase)
      ) {
        await this.ctx.storage.setAlarm(this.nextAlarm);
        return;
      }
      if (!this.expired) {
        await this.ctx.storage.setAlarm(this.nextAlarm);
        return;
      }
      this.engine.state.phase = "closed";
      this.engine.publish();
      this.ctx.waitUntil(this.release());
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, "expired");
      await this.ctx.storage.deleteAll();
    });
  }
}
