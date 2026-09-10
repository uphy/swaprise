import { defineConfig } from "@playwright/test";
const CI = Boolean(process.env.CI);
const port = Number(process.env.ONLINE_PORT) || 8789;
export default defineConfig({
  testDir: "./e2e-online",
  outputDir: "./test-results-online",
  timeout: 60000,
  // 同じ待機列を使うテストは直列のまま、CI ではサーバーごと shard に分ける。
  workers: 1,
  fullyParallel: true,
  retries: CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.ONLINE_URL || `http://127.0.0.1:${port}`,
    headless: true,
    trace: CI ? "on-first-retry" : "off",
  },
  webServer: process.env.ONLINE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm exec wrangler dev --port ${port} --inspector-port 9230 --var ONLINE_ENABLED:true --var TEST_MODE:true --persist-to .wrangler/online-tests/${Date.now()} --local`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: false,
        timeout: 120000,
      },
});
