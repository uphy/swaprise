// Run only in the deployment workflow. Resolve/create an isolated database, then
// generate a config with the real ID; never commit credentials or production IDs.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("Usage: prepare-score-database.mjs input-config output-config");
const config = JSON.parse(readFileSync(input, "utf8"));
if (!/^swaprise(?:-pr-\d+)?$/.test(config.name)) throw new Error("Unexpected Worker name");
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error("Cloudflare account and token (D1 Read/Write) are required");
const name = `${config.name}-scores`;
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database`;
async function api(path, method = "GET", body) {
  const response = await fetch(endpoint + path, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000),
  });
  const value = await response.json();
  if (!response.ok || !value.success) throw new Error(`D1 ${method} failed (${response.status}): ${JSON.stringify(value.errors)}`);
  return value;
}
let database;
for (let page = 1; ; page++) {
  const result = await api(`?per_page=100&page=${page}`);
  database = result.result.find((db) => db.name === name);
  if (database || result.result.length < 100) break;
}
database ??= (await api("", "POST", { name })).result;
config.d1_databases = [{ binding: "SCORES_DB", database_name: name, database_id: database.uuid, migrations_dir: "migrations" }];
writeFileSync(output, JSON.stringify(config, null, 2) + "\n");
execFileSync("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "SCORES_DB", "--remote", "--config", output], { stdio: "inherit" });
console.log(`Score database ready: ${name}`);
