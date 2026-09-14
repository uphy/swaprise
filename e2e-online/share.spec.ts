import { expect, test, type APIRequestContext } from "@playwright/test";
import { scoreRules } from "../src/scores/model";
import { randomUUID } from "node:crypto";

async function connect(request: APIRequestContext, baseURL: string): Promise<Record<string, string>> {
  const headers = { Origin: baseURL, "CF-Connecting-IP": `test-${randomUUID()}` };
  expect((await request.post("/api/session", { headers })).ok()).toBe(true);
  return headers;
}
const meta = (html: string, property: string): string | undefined =>
  new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(html)?.[1];

test("共有 URL /r は og:* をその結果に書き換え、画像は /api/ogp.png が描く", async ({ request, baseURL }) => {
  const query = "m=cpu&lv=hard&r=win&c=9";
  const page = await request.get(`/r?${query}`);
  expect(page.status()).toBe(200);
  const html = await page.text();
  expect(meta(html, "og:title")).toBe("Won vs CPU HARD · max chain x9 – SWAPRISE");
  // wrangler dev は request.url のホストを wrangler.jsonc の custom_domain にするので、ホストは見ずに経路だけ確かめる
  expect(meta(html, "og:image")).toMatch(new RegExp(`^https?://[^/]+/api/ogp\\.png\\?${query}$`));
  expect(meta(html, "og:url")).toMatch(new RegExp(`^https?://[^/]+/r\\?${query}$`));
  expect(html).toContain("<title>Won vs CPU HARD · max chain x9 – SWAPRISE</title>");
  // 人が開いたときにゲームが動くよう、本体の script はそのまま
  expect(html).toContain("<script");

  const image = await request.get(`/api/ogp.png?${query}`);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  const body = await image.body();
  expect(Array.from(body.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(body.readUInt32BE(16)).toBe(1200);
  expect(body.readUInt32BE(20)).toBe(630);
});

test("読めない共有 URL は素の index.html を返し、画像は 404", async ({ request }) => {
  const html = await (await request.get("/r?m=endless&s=abc")).text();
  expect(meta(html, "og:title")).toBe("SWAPRISE – swap, chain, rise");
  expect((await request.get("/api/ogp.png?m=endless&s=abc")).status()).toBe(404);
  expect((await request.get("/api/ogp.png")).status()).toBe(404);
});

test("公開済みの記録は D1 の順位が og:description に入り、得点は D1 の値を使う", async ({ request, baseURL }) => {
  const headers = await connect(request, baseURL!);
  const id = randomUUID();
  const mine = { id, rules: scoreRules("endless"), mode: "endless", name: "Sharer", score: 4321, maxChain: 5, seed: 9, frames: 600 };
  const better = { ...mine, id: randomUUID(), score: 99999, maxChain: 9 };
  for (const data of [mine, better]) expect((await request.post("/api/scores", { headers, data })).status()).toBe(201);
  // URL の自己申告（s=1）ではなく D1 の得点で書く
  const html = await (await request.get(`/r?m=endless&s=1&c=1&id=${id}`)).text();
  expect(meta(html, "og:title")).toBe("4,321 points · max chain x5 – SWAPRISE");
  const description = meta(html, "og:description")!;
  expect(description).toMatch(/^ランキング \d+ 位 \/ \d+ 件。/);
  const rank = Number(/ランキング (\d+) 位/.exec(description)![1]);
  const total = Number(/\/ (\d+) 件/.exec(description)![1]);
  expect(rank).toBeGreaterThanOrEqual(2);
  expect(total).toBeGreaterThanOrEqual(rank);
  // 未公開の id は順位なしで、URL の値のまま
  const unknown = await (await request.get(`/r?m=endless&s=777&c=3&id=${randomUUID()}`)).text();
  expect(meta(unknown, "og:title")).toBe("777 points · max chain x3 – SWAPRISE");
  expect(meta(unknown, "og:description")).not.toContain("ランキング");
});
