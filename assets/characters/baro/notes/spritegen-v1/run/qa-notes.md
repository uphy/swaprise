# baro sprite-gen v1 確認記録

基準画像をCodex CLI経由のgpt-imageで新規生成し、同じ基準画像と各行の配置ガイドを参照して7動作を生成。モデル版の指定なし。512×512px・各6コマ。pixel_unfake=falseで128pxへの縮小・減色を行わない。

extractとcompose-atlasはいずれもok=true、警告なし。各コマの透過と背景色残りをqa/alpha-check.jsonで検査（alpha>=16、キー色距離80未満は全行0画素）。全コマの連続画像を確認。完成アトラスの矩形に沿って行ごとに分割し、配信用の動作シートを保存。原本・全体アトラス・manifestは保持。立ち絵はbase-run/curatedから書き出し、アイコンはそこから切り出した（オルドは全体）。

|動作|判定|確認した動き|
|---|---|---|
|idle|best-effort|Gentle belly breathing and blink, standing on short hind paws. Seamless cycle.|
|danger|best-effort|Lean forward with concerned look and hold apron edges. Subtle seamless cycle.|
|success|best-effort|Open one forepaw in a pleased presenting gesture, then settle.|
|garbage-land|best-effort|Brief startle and bracing with both forepaws, then steady himself.|
|victory|best-effort|Rub the two forepaws together with a pleased smile, finish with paws together.|
|defeat|best-effort|Remove spectacles and gently wipe them with apron, finish subdued holding glasses. Keep glasses connected to paws, no detached items.|
|finish|best-effort|Adjust spectacles and relax into a friendly satisfied pose.|

生成による輪郭・細部の小さな差は残る。体格の揺れを隠すコマ別倍率は追加していない。待機・ピンチのみループし、結果は末尾で止まる。
