---
name: character-art
description: swapriseのキャラクター画像や動作別アニメーションを生成・修正し、リポジトリのキャラクター画廊に登録する。立ち絵、顔アイコン、待機、ピンチ、成功、おじゃま着地、結果の素材作成や、透過・コマ位置の確認に使う。
---

# キャラクター画像とアニメーションの制作

作業先の `AGENTS.md` に従う。制作前に次を読む。

- `docs/characters/generation-policy.md`：生成・確認・採用の正本。
- `docs/characters/profiles/<人物ID>.md` と `visual-guide.md`：人物と外見。
- `docs/characters/art-plan.md`：必要な種類と用途。
- `docs/characters/asset-management.md`：保存先、素材定義、登録・配信用データの生成。
- `docs/characters/gallery/README.md`：画廊の操作。

既定は、同じドット絵の基準画像と短い動作説明を渡し、均一なマゼンタ背景で生成する方式。ユーザーの個別指定を優先する。画像生成スキルを読み、参照画像を確認してから生成ツールに渡す。モデル名を推測しない。

コマ数と動作の細部を一律に固定しない。生成後のコマ数と境界を実測し、同じ倍率で描画する。色抜きは元画像を残し、アルファ値・輪郭・身体の欠落を確認する。横位置の補正は、補正前後を再生して判断する。

素材は `assets/characters/<人物ID>/<動作>/<版>/` に保存し、実際のプロンプト、参照元、処理条件、元画像を残す。生成直後の `output/imagegen/` は一時出力先で、Gitには入らない。過去の版を削除せず、切り出しだけ異なる版では同じ画像を相対パスで参照できる。

再生設定の正本は版ごとの `asset.json`。人物の `character.json` の `assets` に登録し、`pnpm assets` で画廊を更新する。生成済みの `catalog.js` を直接編集しない。新しい素材は試作とし、ユーザーが採用したときだけ `character.json` の `adoptedAssets` を更新する。

`pnpm assets:check` で参照先・コマ範囲・採用IDを検証する。配信用の `public/characters/` と `src/generated/characters.ts` は自動生成なので編集しない。

画廊で種類とバージョンの切り替え、自動再生、コマ送り、素材に設定したリピート・速度、位置、明暗背景を確認する。全コマと終端の動きを見る。未確認の範囲は確認済みと報告しない。
