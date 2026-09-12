# swaprise

パネルを入れ替えて揃え、せり上がる盤面で連鎖を狙うアクションパズル。ブラウザで動く。仕様の全体は README.md にある。

## コマンド

```sh
pnpm typecheck        # tsc --noEmit
pnpm test             # コアの単体テスト（vitest、数秒）
pnpm e2e              # Playwright。ビルドして preview を立てて回す（40秒ほど）
pnpm test:balance     # CPU に何分も遊ばせるバランスの回帰テスト（分単位）
pnpm sim duel|endless|levels   # バランス調整用のシミュレーション（tools/sim/）
pnpm puzzles          # パズル面の生成
```

初回の e2e には `pnpm exec playwright install chromium` が必要。worktree を並べるときは `DEV_PORT` / `PREVIEW_PORT` でポートを変える。

## 構造

- `src/core/` はゲームロジック。DOM・Phaser に依存しない純粋な TypeScript で、60fps の固定 tick の決定論的シミュレーション。同じ seed と入力列なら同じ結果になる。ここは Node だけで動くので、単体テストもシミュレーションもブラウザなしで回せる
- `src/render/` は Phaser 4 の描画・入力・音。盤面と効果音はコードで生成し、曲は `public/audio/` の mp3 を区間ループする
- 見た目の決まりは `src/render/theme.ts`（色・書体・連鎖の色）。背景の空は `index.html` の CSS（`body[data-sky]`）で、canvas は透明。全画面の絵を canvas に毎フレーム描くと headless の e2e が遅くなって落ちるので、背景は CSS に任せる。曲の拍は `audio.beat` で取れる
- `tests/core/` が単体テスト、`e2e/` が Playwright。`e2e` からは `window.__swaprise`（game / scene / tick）と `window.__swapriseAudio` で内部を触れる
- タイミングは `src/core/constants.ts` の `TIMING` にフレーム数でまとまっている

## 判断の基準

- **機能の採否は README の「このゲームが目指すもの」で決める**。連鎖の気持ちよさと、自分の記録・友達との対戦を磨くものは採る。キャラクター、ストーリー、収集要素、独自ルールは提案もしない。パズルモードは連鎖の練習として置く
- **仕様に迷ったら原作（SFC 版）の挙動に合わせる**。おじゃまの変身、連鎖の板の送り方、入れ替え中の揃い判定は原作どおりにして解決した
- **バランスは数値で示す**。「速い・遅い」「強い・弱い」を変えるときは `pnpm sim` で前後を計測し、コミットメッセージに数字を書く（例: 最短の試合が10秒から32秒）。人の代わりは `tools/sim/proxy.ts` の CASUAL（遅い CPU）を使う。実際の初心者はこれより消す量が少ない
- **原作の商品名を出さない**。正式名・略称・英語名・ローマ字表記のどれも、コード・コメント・文言・README・この文書に書かない（旧 localStorage キーの接頭辞は移行に要るので例外）。原作に言及するときは「原作」と書き、README では「原作」も避けて「このジャンルの定番の挙動」と書く。理由: ルールの模倣は法的に問題にならないが、名称は商標・不正競争防止法の対象で、公開リポジトリに書いてあると削除申請の根拠にされやすい
- **パネルの柄は原作と同じ組み合わせにしない**。色と図形の対応は `src/render/theme.ts` で決める。ルールと違って見た目は表現として保護されうる（米国の Tetris 判例）
- **localStorage のキーは `swaprise.*.v1`**。旧キー `panepon.*` からの移行は `src/render/storage.ts` が起動時に行う

## テストの書き方

- e2e の待ちは `waitForTimeout` より `waitForFunction` を使う。表示待ちの固定時間は flaky の元
- メニューを開く e2e は `?opening=0` を付けて、起動時のオープニングを飛ばす。オープニング自体は `e2e/opening.spec.ts`（音を鳴らせない環境）と `e2e/opening-autoplay.spec.ts`（鳴らせる環境）で確かめる
- 盤面は `board.setColumns([[列0の下から], [列1], ...])` で組む。揃いのない静かな盤面が要るときは `[[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]]`
- 挙動を直したときは、修正前のコードで新しいテストが落ちることを確認してからコミットする

## git と PR

- main は保護されていて直接 push できない。ブランチを切り、PR を作り、CI（`.github/workflows/ci.yml`）が通ったら `gh pr merge --squash --delete-branch` で merge する。merge で main に入ると Cloudflare Workers にデプロイされる（`deploy.yml`）
- squash merge なので、main のコミットは1 PR につき1つになる。PR のコミットが1つならそのコミットメッセージがそのまま main に入り、2つ以上なら1行目が PR タイトル、本文が各コミットメッセージの箇条書きになる（リポジトリ設定の「コミットまたは PR のタイトル」）。だから PR タイトルにも「何をなぜ変えたか」を書く（例: 「おじゃまの送出と投下のタイミングを原作に合わせ、連鎖の途中に降らないようにする」）。PR 内の手直しは小さいコミットで積んでよく、force push で畳まなくてよい
- **作業の依頼を受けたら、コードを変える前に必ず worktree を作り、その中で作業する**。`EnterWorktree` があればそれを使う。なければ `git worktree add ../swaprise-<topic> -b <topic> main` のあと `pnpm install`。main の checkout（このディレクトリ）では編集も commit もしない。理由: 複数のセッションが同時に走ることがあり、同じツリーで編集がぶつかった
- 1 worktree に 1 セッション。e2e は `PREVIEW_PORT=4174 pnpm e2e` のようにポートをずらす（dev は `DEV_PORT`）。merge したら `git worktree remove ../swaprise-<topic>` で片付ける
- 調べるだけ・答えるだけの依頼（コードを変えない）は worktree を作らなくてよい
- PR には CI がプレビュー URL をコメントする（Cloudflare の versions upload）。タッチの手触りやレイアウトを変えたときは、merge 前にその URL をスマホで開いて確かめる。メニュー左下のビルド識別子（日付と commit）で、開いている版を確認できる
- コミットメッセージは日本語で、何をなぜ変えたかを1つの文にまとめる（既存のログに合わせる）。squash で main に入ったときに本文になるので、手直しのコミットにも理由を書く。PR の本文は、何をなぜ変えたか・確認したことを書く
- 同じ作業ツリーを別のエージェントや人が触っていることがある。コミットは `git add -A` ではなく、自分が変えたファイルを名指しで add する。`git status` に自分の知らない変更があれば、それは含めずにユーザーへ伝える
- 旧 URL の転送用 Worker（`redirect/`）は `pnpm deploy:redirect` で手動デプロイ。Worker の削除とリポジトリ名の変更はしない
