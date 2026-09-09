# セナ sprite-gen v2

ユーザーのサイズ・コマ数の指摘に対応し、Codex CLIで待機・勝利を各6コマとして新規生成。1コマ512×512px、人物の高さ488px。pixel_unfake=falseで128px格子への縮小とパレット制限を外した。v1の完成画像を拡大したものではない。

参照はv1の基準画像と新しい6コマ配置ガイド。生成プロンプトはprompts/、今回の生成記録はreports/gen-set/。source-prompts/とsource-reports/は、コマ数変更前に検討したv1原画再処理案の出典であり、今回の生成記録ではない。

extractとcompose-atlasはok=true、警告なし。各6コマ・6fps。待機はループ、勝利はワンショット。透明画素2497481。マゼンタ判定に該当する15画素はすべてalpha=1/255で、alpha>=2の該当画素は0。連続コマ画像とブラウザの再生表示で輪郭を確認した。

- idle: best-effort。瞬きを確認。全身の位置はおおむね安定しているが、輪郭に微小な揺れが残る。
- victory: best-effort。視線を上げ、肘を曲げて拳を持ち上げる中間姿勢を確認。手足の増殖や欠けは見られない。コマ間の微小な描画差は残る。

galleryにはsprite-gen v2として登録。未採用。矩形はmanifest.jsonのframe_layoutから取得。
