# キャラクター素材の保存と配信

画像の元データ、加工結果、プロンプト、過去の試作を`assets/characters/`で管理します。採用状態を変えてもファイルは移動しません。画廊には全登録版、ゲームには採用版だけを書き出します。

## 保存先

```text
assets/characters/
  index.json                     # 人物の表示順
  actions.json                   # 動作の区分と識別子
  import-manifest.json            # 初回取り込みの対応先とハッシュ
  nika/
    character.json               # 人物情報、素材の順序、採用ID
    portrait/
      pixel-v2/
        asset.json               # この版の表示・再生設定
        nika-portrait-pixel-v2.png
        nika-portrait-pixel-v2-magenta.png
        nika-portrait-pixel-v2.prompt.txt
    defeat/
      pixel-v4/                  # 元画像と生成時の処理記録
        ...
      pixel-v4-short/
        asset.json               # ../pixel-v4/の画像を9コマだけ使う版
    notes/                       # 制作時の確認メモ
```

版は`v1`、`pixel-v1`、`pixel-v4-short`など、既存の識別子に合わせています。元のファイル名を維持して取り込んでいるため、過去の記録と照合できます。PNGは加工せず保存しました。旧HTMLプレビューでは版間の相対リンクだけを更新しています。

`import-manifest.json`は、初回の232ファイルについて元パス、取り込み先、変更前後のSHA-256を記録した履歴です。新規素材のたびに追記する一覧ではありません。初回に取り込んだ元データを変更する代わりに、新しい版を追加します。画廊に未登録だった原本や処理途中の画像も残しています。

## 人物と素材の定義

`character.json`は`id`、`name`、`role`、`color`、`assets`、`adoptedAssets`を持ちます。`assets`は、その人物のディレクトリから各`asset.json`への相対パスの配列で、画廊での版の順番を表します。新しい版を同じ動作の旧版より前へ追加します。

`adoptedAssets`は動作から素材IDへの対応です。ユーザーが採用した場合にだけ更新します。未採用の動作はゲームへ書き出しません。人物の解放条件はゲームの仕様であり、この採用指定とは別です。

`asset.json`は次の項目を持ちます。

| 項目 | 内容 |
|---|---|
| `id`, `label`, `action`, `kind` | 素材ID、表示名、動作、`image`か`animation` |
| `image`, `prompt` | この定義ファイルから画像・指示文への相対パス |
| `status`, `notes`, `model` | 試作などの状態、補足、確認できた生成モデル |
| `history` | 過去のプレビューへの`label`と`url` |
| `pixelArt` | ドット絵として補間せず表示するか |

新規版には実際のプロンプトと、参照素材・処理条件を残します。採用の有無は`adoptedAssets`で判断し、`status`の自由文だけでは採用しません。ボツ案は`status`と`notes`に理由を残します。取り込み時点で理由がないものを推測してボツ扱いにはしていません。

画像の共有参照も可能です。同じ画像の途中まで再生する版は、兄弟ディレクトリのPNGを参照します。参照先は同じ人物のディレクトリ内に限定します。画像と加工記録を保持し、表示用の補正は`asset.json`で調整します。

### アニメーションの設定

`frameCount`、`fps`、`loop`は必須です。待機・ピンチは繰り返し、他の動作は一度再生するのが基本です。`lastHoldMs`は最終コマの追加待ちで、省略時は0です。

等分シートには`columns`、`rows`、`frameWidth`、`frameHeight`を指定します。不均等なシートには`frames`を指定し、各コマに`x`、`y`、`width`、`height`を持たせます。

位置と倍率は画廊の再生規則を引き継ぎます。

- 横の基準点は、コマの`pivotX`、素材の`pivotX[コマ番号]`、コマ中央の順で選びます。
- 床位置は、コマの`baselineY`、素材の`baselineY`、コマの高さの順で選びます。
- 倍率は素材の`scale`とコマの`scale`の積で、省略値は1です。

既存のコマ別設定も保持しています。新規制作では原則として全コマに共通の倍率を使い、体格の揺れをコマごとの拡大縮小で隠しません。生成時の`*.frames.json`は加工の履歴で、現在の再生設定の正本は`asset.json`です。

## 登録と確認

1. 生成直後の一時出力は`output/imagegen/`に置けます。この場所はGit管理しません。
2. 登録する版のディレクトリへ、元画像・加工画像・指示文・処理記録を保存します。
3. `asset.json`を作成し、`character.json`の`assets`へ相対パスを追加します。
4. `pnpm assets`を実行し、[画廊](gallery/index.html)で再生と版の切り替えを確認します。
5. 採用が決まったら`adoptedAssets`を更新し、再び生成します。

```sh
pnpm assets          # 全素材を検証し、画廊のcatalog.js/actions.jsを生成
pnpm assets:check    # 検証と、画廊の生成データが最新かの確認
pnpm assets:game     # 画廊に加えて、採用素材をゲーム向けに生成
pnpm test:assets     # 取り込みの保持、配信対象、設定検証のテスト
```

画像の存在、コマの範囲、再生速度、採用ID、定義の登録漏れを検証します。画廊用の`catalog.js`と`actions.js`はGitに含めるため、checkout後は生成処理を実行せずローカルファイルとして開けます。この2ファイルを手で編集せず、正本を直して再生成してください。

## ゲーム用の出力

`pnpm dev`と`pnpm build`は、起動前に`pnpm assets:game`を実行します。次の出力はGit管理しません。

| 出力 | 内容 |
|---|---|
| `public/characters/<人物ID>/<ハッシュ>.png` | 採用された使用画像。元画像・試作は除く |
| `public/characters/manifest.json` | 採用素材の人物情報と再生設定 |
| `src/generated/characters.ts` | 同じ定義を`CHARACTER_ASSETS`として参照するTypeScript |

再生成時は`public/characters/`を作り直すため、手作業のファイルを置きません。画像名には内容のハッシュを使い、同じ人物の複数の版が共有する画像は一度だけ書き出します。参照一覧にはプロンプト・制作コメント・過去のプレビューを含めません。

ゲーム用の画像URLは`characters/...`という相対表記です。画面へ組み込む際にアプリのbase URLに合わせて解決します。対戦画面では`src/render/CharacterView.ts`がこの一覧を読み、採用素材だけを表示します。

PWAの既存設定でPNGをキャッシュし、参照一覧のJSONもキャッシュ対象に追加しています。大きな素材を追加した場合はビルドのキャッシュ警告を確認し、オフラインで必要な画像が取得できるか検証します。
