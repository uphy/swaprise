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

## URL を貼ったときの見え方（OGP）

`index.html` の `og:*` / `twitter:card` で、SNS・チャットに URL を貼ると題字の画像と一言が出る。画像 `public/ogp.png`（1200×630）は `pnpm ogp` が `tools/make-ogp.ts` で生成する（オープニングと同じパネルのドット文字）。画像ファイルを手で描くことはしない。`og:image` はプレビュー環境からも本番の絶対 URL を指す（相対だとクローラが拾えない）。

## 計測

何が効いたかを知るため、利用の出来事を [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/) に書く。cookie は使わず、名前も IP も保存しない。`worker/track.ts` が `/api/track` で受け、`src/render/analytics.ts` が送る。取り決めは `src/net/track.ts`。

送る出来事は 4 つ。

| event | いつ | mode / detail / outcome |
|---|---|---|
| `visit` | 起動時に 1 度 | 空。流入元（referrer のホスト名、`utm_source`）と、初めての端末かどうか（`first`）を付ける |
| `start` | 試合が始まった | mode は遊び方、detail は CPU の強さ・パズルの面・課の番号・オンラインの入り方（`random` / `invite`）。待機中の CPU 戦は `normal/online` |
| `end` | 決着した | outcome は `win` / `lose` / `draw` / `clear` / `failed` / `timeup` / `over` / `nocontest`、`seconds` は試合時間 |
| `share` | 共有ボタンを押した | detail は `result`（結果）か `invite`（招待リンク） |

Analytics Engine の列。dataset は本番 `swaprise_events`、PR プレビュー `swaprise_preview_events`（`tools/prepare-preview.mjs` が付け替える）。

| 列 | 中身 |
|---|---|
| `index1` | 端末の匿名 id（`swaprise.player.v1`）。戻ってきた端末を数える鍵 |
| `blob1` 〜 `blob11` | event, mode, detail, outcome, referrer, utm_source, 国（Cloudflare の `cf.country`）, 言語, first, display（`standalone` はホーム画面から）, ビルド識別子 |
| `double1` | `end` の試合時間（秒） |

読むのは Cloudflare の [SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/)。API token に **Account Analytics Read** が要る。保持は 90 日。

```sh
# 日ごとの訪問数・初めての端末・1 試合以上した端末（直近 30 日）
curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d "SELECT toDate(timestamp) AS day,
        count(DISTINCT if(blob1 = 'visit', index1, null)) AS visitors,
        count(DISTINCT if(blob1 = 'visit' AND blob9 = '1', index1, null)) AS new_devices,
        count(DISTINCT if(blob1 = 'start', index1, null)) AS players
      FROM swaprise_events WHERE timestamp > NOW() - INTERVAL '30' DAY GROUP BY day ORDER BY day"

# 流入元ごとの訪問数（referrer と utm_source）
# SELECT blob5 AS referrer, blob6 AS source, count() FROM swaprise_events WHERE blob1 = 'visit' GROUP BY referrer, source ORDER BY count() DESC

# 先週に始めて今週も遊んだ端末（1 週間後の定着）
# SELECT count(DISTINCT index1) FROM swaprise_events
#   WHERE blob1 = 'start' AND timestamp > NOW() - INTERVAL '7' DAY
#   AND index1 IN (SELECT index1 FROM swaprise_events WHERE blob1 = 'visit' AND blob9 = '1' AND timestamp BETWEEN NOW() - INTERVAL '14' DAY AND NOW() - INTERVAL '7' DAY)
```

無料枠は書き込み 1 日 10 万行、読み取り 1 日 1 万問い合わせ。1 試合で 2 行なので、1 日 3 万試合まで無料に収まる。

送るのは本番（`swaprise.uphy.dev`）と PR プレビュー（`*.workers.dev`）で開いたときだけ。手元の `pnpm dev` / `pnpm preview` / `wrangler dev`（e2e を含む）からは送らない（`/api/track` が無い環境で 404 が console に残り、e2e の「エラーなし」「API を呼ばない」の確認が落ちる）。ブラウザが Do Not Track か Global Privacy Control を出しているとき、URL に `?track=0` があるときも送らない。

Analytics Engine は Cloudflare のダッシュボード（Workers & Pages → Analytics Engine）で一度有効にしておく。有効でないと `wrangler deploy` がバインディングを拒み、本番とプレビューのデプロイが落ちる。

## 配信

main への push で GitHub Actions が Cloudflare Workers の `swaprise` にデプロイする（`wrangler.jsonc`）。旧名称の URL（`panepon.*.workers.dev`）には `redirect/` の転送用 Worker を置いていて、新 URL へ 301 で飛ばす。転送用 Worker は自動デプロイの対象外なので、変えたら `pnpm deploy:redirect` で手動で上げる。

オンライン記録は D1 を使う。CI は本番 `swaprise-scores` / PRごと `swaprise-pr-N-scores` を作成・解決して migration を適用する。Cloudflare の既存 API token に **D1 Read/Write** が必要。追跡中の `wrangler.jsonc` の DB ID はローカル用のダミーで、直接本番に deploy せず生成済み設定を使う。開発・手動デプロイ・公開設定の詳細は [online-scores.md](online-scores.md)、オンライン対戦の構成と無料枠の予算は [online-multiplayer.md](online-multiplayer.md)。

localStorage のキーは `swaprise.*.v1`。旧キー `panepon.*` からの移行は `src/render/storage.ts` が起動時に行う。
