# swaprise

パネルを入れ替えて揃え、せり上がる盤面で連鎖を狙うアクションパズル。ブラウザで動く。

https://swaprise.uphy.dev

## 遊び方

- **ENDLESS**: 天井に届くまで何点取れるか。上位5件を端末に記録
- **TIME ATTACK**: 2分間で何点取れるか
- **PUZZLE**: 決められた手数で全部消す。6 ステージ × 10 面。連鎖の練習
- **VS CPU**: EASY / NORMAL / HARD の CPU と対戦
- **2 PLAYERS**: 1台のキーボードかゲームパッド2台で対戦
- **ONLINE**: ログイン不要。友達に招待URLを送るか、ランダムに相手を探す

| | 1P | 2P |
|---|---|---|
| カーソル移動 | ←↑↓→ | W A S D |
| 入れ替え | Z / Space / Enter | F / G |
| 手動せり上げ | X / Shift | H / R |

ゲームパッドは1台目が1P、2台目が2P。十字キー・左スティックで移動、A/B で入れ替え、L/R で手動せり上げ。P で一時停止、R でやり直し、Esc でメニュー、M でミュート。

スマホは、パネルを横にドラッグして入れ替え、2本指で押すか盤面の下のバーを押してせり上げる。Android Chrome は「ホーム画面に追加」でインストールでき、iOS は Safari の共有メニューから「ホーム画面に追加」で全画面になる。一度開けばオフラインでも遊べる。

## 開発

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # コアの単体テスト（vitest）
pnpm e2e          # ブラウザでの動作確認（Playwright）
pnpm build        # dist/ に静的ファイルを出力
```

`src/core/` がゲームロジック（DOM に依存しない決定論的シミュレーション）、`src/render/` が Phaser 4 の描画・入力・音、`worker/` が Cloudflare Workers のオンライン対戦と記録。main への push で Cloudflare Workers にデプロイされる。

- [このゲームが目指すもの](docs/vision.md)
- [ゲームのルール](docs/rules.md)
- [見た目と音](docs/audio-visual.md)
- [パズル面の生成](docs/puzzles.md)
- [開発（コマンド、構成、URL パラメータ、CI、配信）](docs/dev.md)
- [オンライン対戦の設計](docs/online-multiplayer.md)
- [オンラインスコア](docs/online-scores.md)
