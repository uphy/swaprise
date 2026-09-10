import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";
import { displayName, GAME_VERSION, type MatchKind } from "../src/net/protocol";
import { dayKey, emptyBudget, reserve, type Budget } from "./budget";
import { json } from "./index";
interface Assignment {
  roomId: string;
  token?: string;
  queueId?: string;
  expires: number;
}
interface Waiting {
  queueId?: string;
  session: string;
  name: string;
  visible: boolean;
  since: number;
  last: number;
  version: string;
}
export class Coordinator extends DurableObject<Env> {
  private serial: Promise<unknown> = Promise.resolve();
  private run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.serial.then(fn);
    this.serial = result.catch(() => {});
    return result;
  }
  private async active(session: string): Promise<string | null> {
    const a = await this.ctx.storage.get<{ roomId: string; expires: number }>(
      "active:" + session,
    );
    if (!a) return null;
    const response = await this.env.ROOMS.get(
      this.env.ROOMS.idFromName(a.roomId),
    ).fetch(new Request("https://internal/membership", {
      headers: { "X-Session": session },
    }));
    if (!response.ok) throw new Error("Could not check room membership.");
    const { active } = await response.json() as { active: boolean };
    if (active) return a.roomId;
    await this.ctx.storage.delete("active:" + session);
    return null;
  }
  private async assign(session: string, roomId: string, token?: string, kind: MatchKind = "random", queueId?: string): Promise<void> {
    const previous = await this.ctx.storage.get<Assignment>("active:" + session);
    const expires = Date.now() + (kind === "invite" ? 86_400_000 + 660_000 : 660_000);
    const alarm = await this.ctx.storage.getAlarm();
    if (!alarm || alarm > expires) await this.ctx.storage.setAlarm(expires);
    await this.ctx.storage.put("active:" + session, {
      roomId,
      token: token ?? (previous?.roomId === roomId ? previous.token : undefined),
      expires,
      queueId: queueId ?? (previous?.roomId === roomId && (!token || previous.token === token) ? previous.queueId : undefined),
    });
  }
  private async queueRejection(session: string, version: unknown, budget: Budget): Promise<Response | null> {
    if (version !== GAME_VERSION)
      return json({ code: "UPDATE_REQUIRED", error: "Please reload to update the game." }, 409);
    if ((await this.active(session)) || this.ctx.getWebSockets().some((ws) =>
      ws.readyState === WebSocket.OPEN && ws.deserializeAttachment()?.session === session))
      return json({ code: "PARTICIPATION_EXISTS", error: "You have an existing room or search. Check your participation to continue." }, 409);
    if (!reserve(structuredClone(budget), "check", "random"))
      return json({ code: "DAILY_LIMIT", error: "Daily matchmaking limit reached. Try again after 00:00 UTC, or invite a friend if available." }, 429);
    if (this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN).length >= 20)
      return json({ code: "SERVER_BUSY", error: "Server busy. Try again later." }, 429);
    return null;
  }
  async fetch(req: Request): Promise<Response> {
    return this.run(() => this.handle(req));
  }
  private async handle(req: Request): Promise<Response> {
    const u = new URL(req.url);
    const session = req.headers.get("X-Session") ?? "";
    if (u.pathname === "/reserve") {
      const { id, kind, roomId, sessions } = (await req.json()) as {
        id: string;
        kind: MatchKind;
        roomId: string;
        sessions: string[];
      };
      for (const session of sessions) {
        const active = await this.active(session);
        if (active && active !== roomId) return json({ ok: false });
      }
      const now = Date.now();
      const keys = [...new Set([dayKey(now), dayKey(now + 660_000)])];
      const budgets = await Promise.all(
        keys.map(
          async (key) =>
            (await this.ctx.storage.get<Budget>("budget:" + key)) ??
            emptyBudget(),
        ),
      );
      if (!budgets.every((b) => reserve(b, id, kind)))
        return json({ ok: false });
      await this.ctx.storage.put(
        Object.fromEntries(keys.map((k, i) => ["budget:" + k, budgets[i]])),
      );
      for (const session of sessions) await this.assign(session, roomId, undefined, kind);
      return json({ ok: true });
    }
    if (u.pathname === "/return") {
      const { session: returning, since, roomId, token } = (await req.json()) as {
        session: string;
        since: number;
        roomId: string;
        token: string;
      };
      const assigned = await this.ctx.storage.get<Assignment>("active:" + returning);
      if (assigned?.roomId !== roomId || assigned?.token !== token) return json({ ok: true });
      await this.ctx.storage.delete("active:" + returning);
      await this.ctx.storage.put("return:" + returning, {
        since,
        expires: Date.now() + 30000,
      });
      return json({ ok: true });
    }
    if (u.pathname === "/release") {
      const { roomId, token } = (await req.json()) as { roomId: string; token?: string };
      const assigned = await this.ctx.storage.get<Assignment>("active:" + session);
      if (assigned?.roomId === roomId && (!assigned.token || assigned.token === token))
        await this.ctx.storage.delete("active:" + session);
      return json({ ok: true });
    }
    // 復旧・退出はゲーム版や対戦用の日次上限に阻まれない。
    if (req.method === "POST" && ["/api/online/recovery", "/api/online/leave", "/api/online/resume"].includes(u.pathname)) {
      const body = await req.text();
      if (body.length > 4096) return json({ error: "Request too large." }, 413);
      const data = JSON.parse(body || "{}");
      const assigned = await this.ctx.storage.get<Assignment>("active:" + session);
      if (u.pathname === "/api/online/recovery") {
        const roomId = await this.active(session);
        if (roomId) {
          const response = await this.room(roomId, "/recovery", { session });
          if (!response.ok) return response;
          const result = await response.json() as { connection: { token: string } | null; kind?: MatchKind };
          if (result.connection) await this.assign(session, roomId, result.connection.token, result.kind);
          else await this.ctx.storage.delete("active:" + session);
          return json(result);
        }
        const queued = this.ctx.getWebSockets().find((ws) =>
          ws.readyState === WebSocket.OPEN && ws.deserializeAttachment()?.session === session);
        if (queued) {
          const a: Waiting = queued.deserializeAttachment();
          a.queueId ??= crypto.randomUUID();
          queued.serializeAttachment(a);
          return json({ connection: null, queueId: a.queueId });
        }
        return json({ connection: null });
      }
      if (u.pathname === "/api/online/resume") {
        if (!assigned || assigned.roomId !== data.roomId || assigned.token !== data.token)
          return json({ error: "Room participation changed. Please check again." }, 409);
        const response = await this.room(assigned.roomId, "/takeover", { session, token: data.token });
        if (!response.ok) return response;
        const result = await response.json() as { connection: { roomId: string; token: string }; kind: MatchKind };
        await this.assign(session, assigned.roomId, result.connection.token, result.kind);
        return json(result.connection);
      }
      // 待機から割り当て直後の部屋も、同じ待機IDなら退出できる。
      if (typeof data.queueId === "string") {
        for (const ws of this.ctx.getWebSockets()) {
          const a: Waiting = ws.deserializeAttachment();
          if (a.session === session && a.queueId === data.queueId) ws.close(1000, "cancelled");
        }
      }
      const matches = assigned && ((typeof data.token === "string" && assigned.roomId === data.roomId && assigned.token === data.token) ||
        (typeof data.queueId === "string" && assigned.queueId === data.queueId));
      if (matches) {
        const response = await this.room(assigned.roomId, "/leave", { session, token: assigned.token });
        if (!response.ok) return response;
        const result = await response.json() as { stale?: boolean };
        if (!result.stale) await this.ctx.storage.delete("active:" + session);
        console.log(JSON.stringify({ event: "online_leave", via: data.queueId ? "queue" : "room" }));
      }
      return json({ ok: true });
    }
    const key = "budget:" + dayKey(Date.now());
    const budget = (await this.ctx.storage.get<Budget>(key)) ?? emptyBudget();
    budget.requests += 2;
    budget.writes++;
    await this.ctx.storage.put(key, budget);
    if (u.pathname === "/api/online/status") {
      return json({
        invite: reserve(structuredClone(budget), "check", "invite"),
        random: reserve(structuredClone(budget), "check", "random"),
        resetAt: Date.parse(dayKey(Date.now() + 86400000) + "T00:00:00Z"),
      });
    }
    if (u.pathname === "/api/queue/status" && req.method === "POST") {
      const body = await req.text();
      if (body.length > 4096) return json({ error: "Request too large." }, 413);
      const data = JSON.parse(body || "{}");
      return await this.queueRejection(session, data.version, budget) ?? json({ ok: true });
    }
    if (budget.requests >= 60000 || budget.writes >= 60000)
      return json(
        { code: "DAILY_LIMIT", error: "Daily limit reached. Resets at 00:00 UTC." },
        429,
      );
    if (
      u.pathname === "/api/queue/ws" &&
      req.headers.get("Upgrade") === "websocket"
    ) {
      const rejection = await this.queueRejection(session, u.searchParams.get("version"), budget);
      if (rejection) return rejection;
      const pair = new WebSocketPair();
      const ws = pair[1];
      this.ctx.acceptWebSocket(ws);
      const returned = await this.ctx.storage.get<{
        since: number;
        expires: number;
      }>("return:" + session);
      await this.ctx.storage.delete("return:" + session);
      ws.serializeAttachment({
        queueId: crypto.randomUUID(),
        session,
        name: displayName(u.searchParams.get("name")),
        visible: u.searchParams.get("visible") !== "false",
        since:
          returned && returned.expires > Date.now()
            ? returned.since
            : Date.now(),
        last: Date.now(),
        version: u.searchParams.get("version") ?? "",
      } satisfies Waiting);
      ws.send(
        JSON.stringify({
          type: "queued",
          queueId: ws.deserializeAttachment().queueId,
          since: ws.deserializeAttachment().since,
        }),
      );
      await this.match();
      await this.ctx.storage.setAlarm(Date.now() + 30000);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (req.method !== "POST") return json({ error: "Not found." }, 404);
    const body = await req.text();
    if (body.length > 4096) return json({ error: "Request too large." }, 413);
    const data = JSON.parse(body || "{}");
    if (data.version !== GAME_VERSION)
      return json({ error: "Please reload to update the game." }, 409);
    const join = /^\/api\/rooms\/([a-f0-9-]{36})\/join$/.exec(u.pathname);
    const activeRoom = await this.active(session);
    if (
      (activeRoom && activeRoom !== join?.[1]) ||
      this.ctx
        .getWebSockets()
        .some(
          (ws) =>
            ws.readyState === WebSocket.OPEN &&
            ws.deserializeAttachment()?.session === session,
        )
    )
      return json(
        { error: "You have an existing room or search. Check your participation to continue." },
        409,
      );
    if (u.pathname === "/api/rooms") {
      if (
        budget.rooms >= 200 ||
        !reserve(structuredClone(budget), "check", "invite")
      )
        return json({ error: "Daily room limit reached. Try again after 00:00 UTC." }, 429);
      budget.rooms++;
      await this.ctx.storage.put(key, budget);
      const id = crypto.randomUUID();
      const token = crypto.randomUUID();
      const invite = crypto.randomUUID();
      await this.room(id, "/init", {
        id,
        kind: "invite",
        invite,
        members: [{ session, token, name: displayName(data.name) }],
      });
      await this.assign(session, id, token, "invite");
      return json({ roomId: id, token, invite });
    }
    if (join) {
      const token = crypto.randomUUID();
      const response = await this.room(join[1], "/join", {
        invite: data.invite,
        member: { session, token, name: displayName(data.name) },
      });
      if (!response.ok) return response;
      await this.assign(session, join[1], token, "invite");
      return json({ roomId: join[1], token });
    }
    return json({ error: "Not found." }, 404);
  }
  private room(id: string, path: string, data: unknown): Promise<Response> {
    return this.env.ROOMS.get(this.env.ROOMS.idFromName(id)).fetch(
      new Request("https://internal" + path, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    );
  }
  private async match(): Promise<void> {
    const list = this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === WebSocket.OPEN)
      .filter((ws) => {
        const a: Waiting = ws.deserializeAttachment();
        return a.visible && a.version === GAME_VERSION;
      })
      .sort(
        (a, b) =>
          a.deserializeAttachment().since - b.deserializeAttachment().since,
      );
    while (list.length >= 2) {
      const sockets = list.splice(0, 2);
      const members = sockets.map((ws) => ({
        ...(ws.deserializeAttachment() as Waiting),
        token: crypto.randomUUID(),
      }));
      const id = crypto.randomUUID();
      await this.room(id, "/init", { id, kind: "random", members });
      for (let i = 0; i < 2; i++) {
        await this.assign(members[i].session, id, members[i].token, "random", members[i].queueId);
        sockets[i].send(
          JSON.stringify({
            type: "matched",
            roomId: id,
            token: members[i].token,
          }),
        );
        sockets[i].close(1000, "matched");
      }
    }
  }
  override async webSocketMessage(
    ws: WebSocket,
    raw: string | ArrayBuffer,
  ): Promise<void> {
    await this.run(async () => {
      if (typeof raw !== "string" || raw.length > 256) {
        ws.close(1008);
        return;
      }
      try {
        const m = JSON.parse(raw);
        const a: Waiting = ws.deserializeAttachment();
        if (m.type === "cancel") {
          ws.close(1000);
          return;
        }
        if (m.type !== "visibility" && m.type !== "ping") return;
        if (Date.now() - a.last < 500 && m.type === "ping") {
          ws.close(1008);
          return;
        }
        a.last = Date.now();
        if (m.type === "visibility") a.visible = m.visible === true;
        ws.serializeAttachment(a);
        if (m.type === "ping")
          ws.send(JSON.stringify({ type: "pong", at: m.at }));
        await this.match();
      } catch {
        ws.close(1008);
      }
    });
  }
  override webSocketClose(ws: WebSocket): void {
    ws.close();
  }
  override webSocketError(ws: WebSocket): void {
    ws.close();
  }
  override async alarm(): Promise<void> {
    await this.run(async () => {
      const today = dayKey(Date.now());
      const b =
        (await this.ctx.storage.get<Budget>("budget:" + today)) ??
        emptyBudget();
      b.requests += this.ctx.getWebSockets().length * 2;
      b.writes += 2;
      await this.ctx.storage.put("budget:" + today, b);
      for (const ws of this.ctx.getWebSockets()) {
        const a: Waiting = ws.deserializeAttachment();
        if (
          Date.now() - a.last > 45000 ||
          !reserve(structuredClone(b), "check", "random")
        ) {
          ws.send(
            JSON.stringify({
              type: "error",
              message:
                "Search ended. Check your connection or try again later.",
            }),
          );
          ws.close(1000);
        }
      }
      const all = await this.ctx.storage.list<{ expires?: number }>();
      for (const [key, value] of all) {
        if (key.startsWith("active:") && (value.expires ?? 0) < Date.now()) {
          if (await this.active(key.slice(7))) {
            value.expires = Date.now() + 660000;
            await this.ctx.storage.put(key, value);
          }
          continue;
        }
        if (
          ((key.startsWith("active:") || key.startsWith("return:")) &&
            (value.expires ?? 0) < Date.now()) ||
          (key.startsWith("budget:") &&
            key.slice(7) < dayKey(Date.now() - 86400000))
        )
          await this.ctx.storage.delete(key);
      }
      if (this.ctx.getWebSockets().length)
        await this.ctx.storage.setAlarm(Date.now() + 30000);
      else {
        const expirations = [...all.entries()]
          .filter(([key, value]) => (key.startsWith("active:") || key.startsWith("return:")) && (value.expires ?? 0) > Date.now())
          .map(([, value]) => value.expires!);
        if (expirations.length) await this.ctx.storage.setAlarm(Math.min(...expirations));
      }
    });
  }
}
