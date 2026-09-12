/// <reference types="vitest/config" />
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/** ビルド識別子。メニューの隅に出して、スマホで「今どの版を触っているか」を確かめられるようにする。 */
function buildId(): string {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const hash = process.env.BUILD_COMMIT?.slice(0, 7) || execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return `${day} ${hash}`;
  } catch {
    return `${day} dev`;
  }
}

// worktree を並べて開いてもポートがぶつからないよう、環境変数で変えられるようにする（既定は 5173 / 4173）
const DEV_PORT = Number(process.env.DEV_PORT) || 5173;
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT) || 4173;

export default defineConfig({
  base: "./",
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: PREVIEW_PORT, strictPort: true },
  plugins: [
    // ビルド成果物を precache する（曲の mp3 を含む）。
    // autoUpdate だと新版の precache が終わった瞬間に reload され、試合の途中でメニューへ戻される。
    // prompt にして、切り替えのタイミングは src/render/update.ts が決める
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icons/*.png", "vibrate-test.html"],
      manifest: {
        name: "Swaprise",
        short_name: "Swaprise",
        description: "Swap & match action puzzle",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "any",
        background_color: "#14141c",
        theme_color: "#14141c",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,webmanifest,mp3}"],
        // SKIP_WAITING のあと、開いているページをすぐ新版の管理下に置く。これで workbox-window の controlling が発火して reload できる
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
