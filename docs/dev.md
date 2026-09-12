# 開発

## コマンド

```sh
pnpm install
pnpm dev              # http://localhost:5173（DEV_PORT で変更）
pnpm typecheck        # tsc --noEmit
pnpm test             # コアの単体テスト（vitest、数秒）
pnpm e2e              # Playwright。ビルドして preview を立てて回す（PREVIEW_PORT で変更）
pnpm e2e:online       # 実通信のオンライン対戦テスト（ONLINE_PORT で変更）
pnpm test:balance     # CPU に何分も遊ばせるバランスの回帰テスト（分単位）
pnpm sim duel|endless|levels   # バランス調整用のシミュレーション（tools/sim/）
pnpm puzzles          # パズル面の生成
pnpm build            # dist/ に静的ファイルを出力
pnpm build && pnpm dev:online   # オンライン対戦のローカル確認（ポート8788）
```

初回の e2e には `pnpm exec playwright install chromium` が必要。worktree を並べるときは `DEV_PORT` / `PREVIEW_PORT` / `ONLINE_PORT` でポートを変える。

スマホで遊ぶときは、同じ Wi-Fi にいる状態で Mac 側を `pnpm dev --host` で起動し、表示される `Network:` の URL をスマホのブラウザで開く。

## 構成

```
src/core/       ゲームロジック（Board, Game, CPU プレイヤー, 得点表, おじゃま仕様）。DOM・Phaser に依存しない
src/net/        オンラインの入力同期・接続・状態ハッシュ
src/render/     Phaser のシーン・描画・入力・音
worker/         Cloudflare Worker と Durable Objects の部屋・待機列、記録の API
migrations/     D1 のスキーマ
tests/core/     vitest によるロジックのテスト（ランダム入力の長時間実行も含む）
tests/render/   描画側のうち Node で動く部分のテスト
e2e/            Playwright によるブラウザ動作確認とスクリーンショット
e2e-online/     実通信での招待・ランダム対戦・再接続のテスト
tools/          シミュレーション、パズル生成、アイコン生成
redirect/       旧 URL の転送用 Worker
```

`e2e` からは `window.__swaprise`（game / scene / tick）と `window.__swapriseAudio` で内部を触れる。

## URL パラメータ

メニューを飛ばして直接ゲームを始められる。

| パラメータ | 意味 |
|---|---|
| `?mode=endless` / `?mode=timeattack` / `?mode=puzzle` / `?mode=versus` / `?mode=cpu` | メニューを飛ばして開始 |
| `&time=30` | タイムアタックの制限時間（秒）。省略時は120 |
| `&stage=2-3` | パズルの面（`mode=puzzle` のとき）。通し番号（1 始まり）でもよい |
| `&cpu=easy` / `normal` / `hard` | CPU の強さ（`mode=cpu` のとき） |
| `&shock=0` | 対戦でビックリパネルを出さない。数値で1試合の上限枚数を指定 |
| `&seed=123` | 盤面の乱数 seed |
| `&speed=10` | 開始スピードレベル（1〜99） |
| `&bgm=0` | BGM を鳴らさない |
| `&countdown=0` | 開始時の 3・2・1 カウントダウンを飛ばす |
| `&opening=0` | 起動時のオープニングを飛ばしてすぐメニューを出す |

## CI

型チェック・単体テスト、通常 E2E、オンライン E2E を別ジョブで実行する。オンライン E2E は3つの独立したサーバーに分割し、各サーバー内では1件ずつ実行してランダム待機列の混線を防ぐ。`check` はこれらすべての成功を確認する。オンライン E2E の trace は CI の再試行時だけ記録する。手元で記録が必要な場合は `pnpm e2e:online --trace on` を使う。

E2E ジョブは [Playwright 公式 Docker イメージ](https://playwright.dev/docs/docker) 上で実行し、ブラウザとOS依存ライブラリを毎回インストールしない。イメージの取得と pnpm の依存関係復元は必要。`@playwright/test` の更新時は `.github/workflows/ci.yml` の2つのイメージタグもロック済みバージョンに揃える。準備ステップはバージョン一致と Chromium の起動だけを検証し、不一致時にブラウザを再ダウンロードして隠さない。E2E はジョブ全体15分、起動確認2分でタイムアウトする。

PR には CI がプレビュー URL をコメントする（Cloudflare の versions upload）。メニュー左下のビルド識別子（日付と commit）で、開いている版を確認できる。

## PWA

- ビルドすると manifest と Service Worker（vite-plugin-pwa）が付く
- ビルド成果物（本体と曲の mp3、合わせて 8MB 未満）を precache するので、次回からはオフラインでも遊べる。別のプレビューURLとはキャッシュを共有しない
- 新しい版は次に開いたときに、メニューを出す前に「UPDATING…」と表示して切り替える（遊んでいる最中に reload しない）。回線が遅くて確認が終わらないときはそのまま始め、次にメニューへ戻ったときに切り替える
- アイコンは `node tools/make-icons.mjs` がコードから PNG を生成する（`public/icons/`）。画像ファイルを手で描くことはしない

## 配信

main への push で GitHub Actions が Cloudflare Workers の `swaprise` にデプロイする（`wrangler.jsonc`）。旧名称の URL（`panepon.*.workers.dev`）には `redirect/` の転送用 Worker を置いていて、新 URL へ 301 で飛ばす。転送用 Worker は自動デプロイの対象外なので、変えたら `pnpm deploy:redirect` で手動で上げる。

オンライン記録は D1 を使う。CI は本番 `swaprise-scores` / PRごと `swaprise-pr-N-scores` を作成・解決して migration を適用する。Cloudflare の既存 API token に **D1 Read/Write** が必要。追跡中の `wrangler.jsonc` の DB ID はローカル用のダミーで、直接本番に deploy せず生成済み設定を使う。開発・手動デプロイ・公開設定の詳細は [online-scores.md](online-scores.md)、オンライン対戦の構成と無料枠の予算は [online-multiplayer.md](online-multiplayer.md)。

localStorage のキーは `swaprise.*.v1`。旧キー `panepon.*` からの移行は `src/render/storage.ts` が起動時に行う。
