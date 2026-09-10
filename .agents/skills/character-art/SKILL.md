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

今後のキャラクター画像生成には `sprite-gen` スキルを使う。利用可能なスキル一覧からその `SKILL.md` を読み、参照画像を確認してから実行する。現在の導入先は `/Users/yuhi/.codex/skills/sprite-gen/SKILL.md`。生成は原則として `--provider codex`（gpt-image）を明示し、sprite-genの専用venvを使う。ユーザーの個別指定を優先し、モデルの版は推測しない。

立ち絵・顔アイコンには `gen`、動作アニメーションには `prepare → gen-set → extract → compose-atlas → preview` を使う。背景色は人物の配色と重ならないクロマキー色を選ぶ。sprite-genの比較画面に加えて、このリポジトリの画廊にも登録する。

動作アニメーションは従来素材に合わせて1コマ512×512px程度を出発点とし、人物本体の画素数も確認する。小さい画像の拡大だけで解像度を満たしたことにしない。通常は `fit.pixel_unfake=false` とし、128px格子への縮小や強い減色を自動適用しない。低解像度のドット表現を求められた場合にだけ、その用途に合わせて設定する。

コマ数と動作の細部を一律に固定しない。待機は6コマ程度から始め、長い動作には必要な中間姿勢を増やす。枚数だけでなく再生時のつながりを確認する。コマ数・速度・サイズは `sprite-request.json` にまとめ、生成結果との一致を検証する。切り出し座標は完成した `manifest.json` の `frame_layout` から `asset.json` に登録し、同じ倍率で描画する。色抜きは元画像を残し、アルファ値・輪郭・身体の欠落を確認する。横位置の補正は、補正前後を再生して判断する。

素材は `assets/characters/<人物ID>/<動作>/<版>/` に保存し、実際のプロンプト、参照元、処理条件、元画像を残す。生成直後の `output/imagegen/` は一時出力先で、Gitには入らない。過去の版を削除せず、切り出しだけ異なる版では同じ画像を相対パスで参照できる。

複数動作で共有するsprite-genの実行フォルダは `assets/characters/<人物ID>/notes/<版>/run/` に保存できる。各動作の `asset.json` から完成アトラスを相対参照し、元画像・生成記録・QA記録を同じ人物の配下に保持する。

再生設定の正本は版ごとの `asset.json`。人物の `character.json` の `assets` に登録し、`pnpm assets` で画廊を更新する。生成済みの `catalog.js` を直接編集しない。新しい素材は試作とし、ユーザーが採用したときだけ `character.json` の `adoptedAssets` を更新する。

`pnpm assets:check` で参照先・コマ範囲・採用IDを検証する。配信用の `public/characters/` と `src/generated/characters.ts` は自動生成なので編集しない。

画廊で種類とバージョンの切り替え、自動再生、コマ送り、素材に設定したリピート・速度、位置、明暗背景を確認する。全コマと終端の動きを見る。未確認の範囲は確認済みと報告しない。
