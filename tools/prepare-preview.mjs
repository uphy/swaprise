import { readFileSync, writeFileSync } from "node:fs";
const pr = process.env.PR_NUMBER;
if (!/^\d+$/.test(pr ?? "")) throw new Error("PR_NUMBER is required");
const config = JSON.parse(readFileSync("wrangler.jsonc", "utf8"));
config.name = `swaprise-pr-${pr}`;
config.routes = [];
// Worker名ごとにDO名前空間が作られるため、本番の部屋へ接続しない。
writeFileSync(".wrangler-preview.json", JSON.stringify(config, null, 2) + "\n");
