# TODO: スマホをメインにする

スマホ（縦持ち・タッチ・PWA）で遊ぶことを前提にした変更の一覧。上から順に対応する。
終わった項目は `[x]` にして、どう対応したかを1行添える。

## 1. 最優先（遊び心地を直接損なっている）

- [x] 起動時の通信量を削減する（低速回線・スマホ向け）
  - 対応: 配信ファイルの約 88MB を占めていたキャラクター素材を、2026-09-12 にキャラクターごと外した（明るく楽しい雰囲気に合わず、盤面・演出・音だけの純粋なパズルにする）。残るのは本体と曲の mp3 で 8MB 未満
- [x] 描画解像度をスマホに合わせる
  - 対応: `src/render/hidpi.ts`。canvas を論理サイズ × DPR で作り、カメラ zoom を DPR にして論理座標を保つ。テクスチャは DPR 倍で生成して Image を 1/DPR に縮め、`scene.add.text` の resolution を既定で DPR にした。入力は Pointer の worldX / worldY を使う
- [x] 回転・リサイズに追従する
  - 対応: BoardView を原点付きの Container にして `place(ox, oy, scale)` で動かせるようにし、GameScene の `place()` が全 UI を置く。window の resize を 150ms 待ってから `layoutFor` を再評価し、変わっていれば置き直す。メニューは作り直す
  - 残り: 横持ちのスマホは 800×520 のデスクトップ用レイアウトを縮小して出すので小さい。横持ち専用のレイアウトは未対応
- [x] 画面上の操作ボタンを置く
  - 対応: `src/render/ui.ts` の Button（背景つき・pointerdown を止める）。盤面右上に ❚❚、ポーズ画面に RESUME / RESTART / SOUND / VIBRATION / MENU、終了後の盤面に RETRY / MENU。ミュートは localStorage に保存
- [x] タップ対象を指の大きさにする
  - 対応: 「tap here: menu」は廃止（ポーズ画面の MENU へ）。縦持ちの CPU 対戦は自分の盤面が等倍、CPU の盤面が 0.5 倍の非対称レイアウト（幅 340）。メニュー項目の padding を増やし、SOUND / VIBRATION を Button にした
- [x] セーフエリアを避ける
  - 対応: `#app` に `env(safe-area-inset-*)` の padding、内側の `#game` を Phaser の親にした。中央寄せは Phaser の autoCenter だけに任せる（CSS でも寄せると二重にずれる）。Playwright は safe-area を再現できないので実機で確認が必要

## 2. 次点（スマホ運用として欲しい）

- [x] PWA としてインストールできる形にする
  - 対応: vite-plugin-pwa（generateSW, prompt）で manifest と Service Worker を生成。新版への切り替えは `src/render/update.ts` がメニューを出す前に行う（`e2e/update.spec.ts`）。アイコンは `tools/make-icons.mjs` が zlib だけで PNG を書く（192 / 512 / maskable 512 / apple-touch-icon 180）。`e2e/pwa.spec.ts` でオフライン再読込を確認
- [x] せり上げの操作をもう1つ用意する
  - 対応: 盤面を2本の指で押している間もせり上げ（`TouchInput.onBoard`）。2本目が触れた時点で進行中のドラッグは捨てる。メニューの案内文に追記
- [x] 結果画面と案内文をタッチ向けの言葉にする
  - 対応: 結果画面の「R / tap: restart   Esc: menu」を RETRY / MENU ボタンに、「tap / P to resume」をポーズ画面のボタンに置き換えた。キー操作の案内はタッチ端末では出さない
- [x] 音の ON/OFF を画面に出す
  - 対応: メニューとポーズ画面に SOUND ボタン。iOS のサイレントスイッチの件は README に書く（次の項目でまとめて）
- [x] iOS の長押し対策
  - 対応: `-webkit-touch-callout: none` を body に追加
- [x] 画面のスリープ防止
  - 対応: `src/render/wakelock.ts`。GameScene の間だけ取り、画面が戻ったら取り直す。メニューへ戻ると外す

## 3. あれば良い（機能追加）

- [x] 記録の共有と一覧
  - 対応: 結果画面に SHARE（`src/render/share.ts`。Web Share API がなければクリップボードへコピーして COPIED と出す）。メニューの記録をタップすると上位5件と CPU 戦の勝敗の一覧
- [x] スマホの e2e を増やす
  - 対応: `e2e/mobile.spec.ts`（CPU 対戦の非対称レイアウト、ポーズボタン、回転、2本指せり上げ、iPhone 14）、`e2e/records.spec.ts`、`e2e/pwa.spec.ts`。iPhone 14 の Safari は 390×664 で背が低いので、縦持ちの高さを画面の縦横比から決めるようにした（幅固定、高さは下限 500〜上限 640）
- [x] タイムアタック（2分で何点）
  - 対応: `GameMode` に `timeattack`。`Game.timeLimit` / `framesLeft` / `timeUp`。残り時間はフレームで数えるのでポーズ中は減らない。記録は `highscores.timeattack` に別で保存。`?time=秒` で制限時間を変えられる（e2e 用）
- [x] ステージクリア・パズルモード
  - 対応: `GameMode` に `puzzle`。`BoardOptions.moveLimit` でせり上がり（自動・手動）と次の行をなくし、静止した盤面でだけ入れ替えを受け付けて `movesLeft` を減らす。`Game` が静止後に全消し（clear）か手数切れ（fail）を判定する
  - 面は自作。`src/core/puzzle.ts` のソルバー（静止盤面の幅優先探索、揃わない柄が残った盤面は捨てる）で「ちょうど N 手で解ける」面を `tools/make-puzzles.ts` が乱数から選び、解を本物の Board で再生して確かめてから `src/core/puzzles.ts` に書く。6 ステージ × 10 面、1〜5 手、5 種、消去中の入れ替えは受け付けない（解が1通りに定まる）
  - メニューの 1P PUZZLE で面選び。ステージの札（STAGE 1〜6、クリア数と 10 個の点）を並べ、選んだステージの 10 面を黄色の枠で囲って下に出す。クリア済みは緑の ✓、選んでいる札・面は黄色。結果画面に NEXT。`?mode=puzzle&stage=2-3` で直接開ける。記録は `highscores.puzzle`（クリアした面の番号）
- [x] 横持ちのスマホ専用レイアウト
  - 対応: `Layout.phoneLandscape`（タッチ端末で実画面の高さ 560px 未満）。高さ 412 固定で盤面を画面いっぱいに描き、HUD（得点・時間・予告おじゃま・せり上げ矢印）を盤面の横に置く `BoardView.hud`。2P と CPU 対戦は盤面を左右の端（40 論理px）に寄せ、ポーズは中央下。メニューは下段を3列にする
  - 直した不具合: 回転後に canvas が細長いまま中央に残っていた。Phaser の Scale.FIT は最初の縦横比を `resize()` でも保持するので、`applyLayout` で `displaySize.setAspectRatio` を入れ直す。e2e に回転後の canvas 実寸の検証を足した
  - マスの大きさは Pixel 7 横持ちで実画面 32px（縦持ちは 44px）。盤面が 12 段ある以上これが上限
- [x] メニューの整理
  - 対応: 最上位を 1 PLAYER / VS CPU / 2 PLAYERS の3つにし、1 PLAYER と VS CPU はその場で下位メニュー（ENDLESS / TIME ATTACK / PUZZLE、EASY / NORMAL / HARD、◂ BACK）に入れ替わる。項目の下に記録（ベスト・勝敗・パズルのクリア数）を小文字で添え、記録の行と案内文はメニューから消した。SOUND / VIBRATION / FULL SCREEN は SETTINGS、操作の説明は HOW TO PLAY、記録の一覧は RECORDS の小ボタン（下段に3つ）へ。前回遊んだモードを `swaprise.lastmode.v1` に保存してカーソルの初期位置にする
- [ ] オンライン機能（Cloudflare の無料枠で足りる。順に 1 → 2 → 3）
  - 今の構成は `wrangler deploy` で静的ファイルを配るだけ。同じ Worker に API を足し、`wrangler.jsonc` に `main`・`d1_databases`・`durable_objects` を追加する。CI の secret はそのまま使える
  - 無料枠（2026-09 時点の公開値）: Workers リクエスト 10万/日・CPU 10ms/回。D1 読み 500万行/日・書き 10万行/日・5GB。Durable Objects は SQLite 版のみ、リクエスト 10万/日・13,000 GB秒/日、WebSocket の受信は 20通で1リクエスト換算
  - [x] 1. スコアのオンライン共有
    - 標準エンドレス・2分タイムアタックを初回の公開設定後に自動投稿。名前はオンライン対戦と共通。記録画面からモード別上位50件へ。D1・再送・重複防止・公開オフを実装。仕様と運用は `docs/online-scores.md`
    - 不正対策は別件。決定論的シミュレーションなので入力列を送れば検証できるが、2分ぶん（7,200 tick）の再生は Worker の CPU 10ms に収まらないので、検証は保存とは別の Worker に分けるか後回し
  - [ ] 2. 「今日の seed」でスコア勝負
    - 日付から seed を決めて同じ盤面を配り、seed 付きで D1 に保存する。サーバーにゲームのロジックは要らない
  - [ ] 3. リアルタイム対戦
    - 実装・検証中: 招待URLとランダムマッチを追加。仕様・実装箇所・無料枠の予算は `docs/online-multiplayer.md`。公開前のスマホ確認が残る
    - Durable Objects を部屋1つにつき1つ作り、2人が WebSocket でつなぐ。送るのは seed と各フレームの入力だけ（ロックステップ）。サーバーは中継するだけ
    - 上限は WebSocket の受信メッセージ数で決まる。毎フレーム送る（60通/秒×2人＝6リクエスト/秒）と1日 約4.6時間、3フレームごとにまとめる（2リクエスト/秒）と 約14時間の対戦ぶん。CPU 時間の枠は約29時間ぶんあるので先に効くのはリクエスト数
    - 相手の入力が届くまで進められないので、入力に 3〜4 フレームの遅延を入れる。Durable Objects は最初に接続した人の近くに作られ、日本同士なら往復 20〜40ms。核心はゲーム側の入力遅延と再同期で、サーバー側は薄い
    - もっと遊ばせるなら、Durable Objects は部屋作りとシグナリングだけにして、入力は WebRTC DataChannel で直接送る。Cloudflare を通るのは最初の数往復だけになる。NAT 越えに失敗する端末（キャリア回線同士）の救済に使う TURN は Cloudflare Realtime の無料枠（月 1TB）で賄える
- [ ] iOS の振動（未着手。実機がないと確かめられない）
  - `navigator.vibrate` は使えない。iOS 18 以降の Safari で `<input type="checkbox" switch>` の切り替えが触覚を鳴らす仕様を使った回避策があるが、鳴らせるのは短い1種類で動作保証もない。試すなら `vibrate-test.html` に足して端末で確かめてから

## 4. 実機で遊んで見つかったこと（2026-09-06）

- [x] 横持ちの 2P 対戦で盤面を左右の端に寄せる
  - 対応済み（`1bd5b4e`、未デプロイ時点の報告）。横持ちのスマホ用レイアウトで、盤面は左右 40 論理px（実画面 約39px）の位置。手がぶつからないよう、これ以上は Android の戻るジェスチャ領域（24dp）を踏まない範囲で寄せてある。実機で試して足りなければ `GameScene.place()` の `edge` を詰める
- [x] 上下のブラウザ UI（URL バー・メニューバー）を除いて使う
  - 対応: `src/render/fullscreen.ts`。メニューの SETTINGS にある FULL SCREEN ボタン（タッチ端末で Fullscreen API が使えるときだけ出す）で切り替え、希望を localStorage に保存する。戻る操作や画面オフで解除されるので、ゲーム開始・再開・やり直しの操作の中で `sync()` が取り直す。standalone の PWA では出さない
  - iPhone の Safari は Fullscreen API を使えないので、案内文に「Share ▸ Add to Home Screen」を出す（実機で未確認）
- [x] 危険状態で曲を変える
  - 対応: `src/render/bgm.ts` に候補ページの「2. スピード・テクノ」（A minor 150 BPM）をピンチの曲として移植し、`setDanger` でテンポではなく曲を切り替える。ゲーム曲へ戻るときは切り替えた小節の頭から続ける。ポーズ・画面オフからの復帰も危険状態なら同じ曲を鳴らし直す。e2e（`e2e/bgm.spec.ts`）で切り替えと復帰を確認
- [x] CPU を強くする
  - 止まる原因: 1回の入れ替えで揃う手しか探さず、それが尽きると「盤面が低ければせり上げ、そうでなければ待つ」だけだった。おじゃまが乗って高さが 9 段以上（危険）になるとせり上げもできず、自動せり上がり（レベル1で 12.5 秒に1段）で新しい行が来るまで完全に止まっていた。再現は `tests/core/ai.test.ts` の `stuckBoard`（hard seed=5 を hard 同士で戦わせて出た盤面）
  - 対応: `src/core/ai.ts` を作り直した。横3つ・縦3つを目標に、パネルを横に運ぶ・穴に落とす手順を読みの深さまで列挙し（`enumerateGoals`）、実際に盤面で試して揃うものだけ採用する。消去中は消えたあとの盤面を目標に同じ読みをしてアクティブ連鎖を仕込む。どの難易度でも手が無ければ 8 手まで読み直し、それでも無ければ「パネルを1枚穴へ動かして足場を作ってから読む」。旧 hard との対戦は 18-2、hard と easy は 20-0
  - 難易度は読みの深さ（2・4・8 手）、待ち時間、カーソル速度（hard は 4 フレームに1マス）、連鎖読み・アクティブ連鎖の有無で分けた。1手あたりの計算は最悪 2ms 弱
- [x] スワイプで動かしたパネルは、下が空なら落ちる
  - 対応: `TouchInput.onMove` で、入れ替え先の真下が空（row 0 以外）ならその入れ替えを最後にドラッグを終える。掴んだのが空マス（隣を引き寄せる操作）のときは対象外。落下は core のまま。e2e に「谷を越えて運べない」を追加
- [x] おじゃまが変身しないケースがある
  - 原因: おじゃまは「真下が空になってから」猶予 6 フレーム → 落下、と下のパネルより遅れて落ちていた。下のパネルが着地して揃った瞬間、おじゃまはまだ空中（falling）で、変身の判定は着地済み（idle）のおじゃましか見ないので漏れていた
  - 対応: `applyGarbageGravity` を作り直し、おじゃまは真下のパネルの猶予・落下カウントに合わせて動き、同じフレームに着地する（`belowGarbage`）。支えの判定は「着地済みのものがあるか」（`garbageResting`）と「何かがいて動けないか」（`garbageBlocked`）に分けた。おじゃまの上のパネルもおじゃまに合わせて落ちる
  - テスト: `tests/core/garbage-fall.test.ts`（報告の場面の再現と、落ち始め・着地のフレーム一致）。fuzz に「揃ったパネルの真上のおじゃまは変身している」を追加
