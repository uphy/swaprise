/// <reference types="@cloudflare/workers-types" />
import type { Env } from "./types";
export { Room } from "./room";
export { Coordinator } from "./coordinator";
export const json = (data: unknown, status = 200): Response =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (env.ONLINE_ENABLED !== "true")
      return json({ error: "Online play is currently unavailable." }, 503);
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin)
      return json({ error: "Connection origin mismatch." }, 403);
    if (request.headers.get("Sec-Fetch-Site") === "cross-site")
      return json({ error: "Connection origin mismatch." }, 403);
    if (request.method === "POST" && !origin)
      return json({ error: "Could not verify connection origin." }, 403);
    const session = /(?:^|;\s*)swaprise_session=([a-f0-9-]{73})/.exec(
      request.headers.get("Cookie") ?? "",
    )?.[1];
    if (url.pathname === "/api/session" && request.method === "POST") {
      const token = session ?? `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "Set-Cookie": `swaprise_session=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=2592000${url.protocol === "https:" ? "; Secure" : ""}`,
        },
      });
    }
    if (!session) return json({ error: "Please reconnect." }, 401);
    if (Number(request.headers.get("Content-Length") ?? 0) > 4096)
      return json({ error: "Request too large." }, 413);
    if (url.pathname.endsWith("/metrics") && env.TEST_MODE !== "true")
      return json({ error: "Not found." }, 404);
    const headers = new Headers(request.headers);
    headers.set("X-Session", session);
    try {
      const room = /^\/api\/rooms\/([a-f0-9-]{36})\/(?:ws|metrics)$/.exec(
        url.pathname,
      );
      const target = room
        ? env.ROOMS.get(env.ROOMS.idFromName(room[1]))
        : env.COORDINATOR.get(env.COORDINATOR.idFromName("global"));
      return await target.fetch(new Request(request, { headers }));
    } catch {
      return json(
        { error: "Could not connect. Try again later." },
        503,
      );
    }
  },
};
