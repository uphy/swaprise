import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";
import { displayName, GAME_VERSION, type MatchKind } from "../src/net/protocol";
import { dayKey, emptyBudget, reserve, type Budget } from "./budget";
import { json } from "./index";
interface Waiting {
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
    return a && a.expires > Date.now() ? a.roomId : null;
  }
  private async assign(session: string, roomId: string): Promise<void> {
    if (!(await this.ctx.storage.getAlarm()))
      await this.ctx.storage.setAlarm(Date.now() + 60000);
    await this.ctx.storage.put("active:" + session, {
      roomId,
      expires: Date.now() + 660_000,
    });
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
      for (const session of sessions) await this.assign(session, roomId);
      return json({ ok: true });
    }
    if (u.pathname === "/return") {
      const { session: returning, since } = (await req.json()) as {
        session: string;
        since: number;
      };
      await this.ctx.storage.delete("active:" + returning);
      await this.ctx.storage.put("return:" + returning, {
        since,
        expires: Date.now() + 30000,
      });
      return json({ ok: true });
    }
    if (u.pathname === "/release") {
      const { roomId } = (await req.json()) as { roomId: string };
      if ((await this.active(session)) === roomId)
        await this.ctx.storage.delete("active:" + session);
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
    if (budget.requests >= 60000 || budget.writes >= 60000)
      return json(
        { error: "Daily limit reached. Resets at 00:00 UTC." },
        429,
      );
    if (
      u.pathname === "/api/queue/ws" &&
      req.headers.get("Upgrade") === "websocket"
    ) {
      if (u.searchParams.get("version") !== GAME_VERSION)
        return json({ error: "Please reload to update the game." }, 409);
      if (!reserve(structuredClone(budget), "check", "random"))
        return json({ error: "Daily matchmaking limit reached. Try again after 00:00 UTC." }, 429);
      if (
        (await this.active(session)) ||
        this.ctx
          .getWebSockets()
          .some((ws) => ws.deserializeAttachment()?.session === session)
      )
        return json({ error: "You are already in a match or queue." }, 409);
      if (this.ctx.getWebSockets().length >= 20)
        return json({ error: "Server busy. Try again later." }, 429);
      const pair = new WebSocketPair();
      const ws = pair[1];
      this.ctx.acceptWebSocket(ws);
      const returned = await this.ctx.storage.get<{
        since: number;
        expires: number;
      }>("return:" + session);
      await this.ctx.storage.delete("return:" + session);
      ws.serializeAttachment({
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
    if (
      (await this.active(session)) ||
      this.ctx
        .getWebSockets()
        .some(
          (ws) =>
            ws.readyState === WebSocket.OPEN &&
            ws.deserializeAttachment()?.session === session,
        )
    )
      return json(
        { error: "You are in another room. Leave it from the original tab." },
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
      await this.assign(session, id);
      return json({ roomId: id, token, invite });
    }
    const join = /^\/api\/rooms\/([a-f0-9-]{36})\/join$/.exec(u.pathname);
    if (join) {
      const token = crypto.randomUUID();
      const response = await this.room(join[1], "/join", {
        invite: data.invite,
        member: { session, token, name: displayName(data.name) },
      });
      if (!response.ok) return response;
      await this.assign(session, join[1]);
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
        await this.assign(members[i].session, id);
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
      for (const [key, value] of all)
        if (
          ((key.startsWith("active:") || key.startsWith("return:")) &&
            (value.expires ?? 0) < Date.now()) ||
          (key.startsWith("budget:") &&
            key.slice(7) < dayKey(Date.now() - 86400000))
        )
          await this.ctx.storage.delete(key);
      if (this.ctx.getWebSockets().length)
        await this.ctx.storage.setAlarm(Date.now() + 30000);
      else if (
        [...all.entries()].some(
          ([key, value]) =>
            (key.startsWith("active:") || key.startsWith("return:")) &&
            (value.expires ?? 0) > Date.now(),
        )
      )
        await this.ctx.storage.setAlarm(Date.now() + 60000);
    });
  }
}
