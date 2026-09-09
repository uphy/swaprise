# rocca sprite-gen v1 確認記録

基準画像をCodex CLI経由のgpt-imageで新規生成し、同じ基準画像と各行の配置ガイドを参照して7動作を生成。モデル版の指定なし。512×512px・各6コマ。pixel_unfake=falseで128pxへの縮小・減色を行わない。

extractとcompose-atlasはいずれもok=true、警告なし。各コマの透過と背景色残りをqa/alpha-check.jsonで検査（alpha>=16、キー色距離80未満は全行0画素）。全コマの連続画像を確認。完成アトラスの矩形に沿って行ごとに分割し、配信用の動作シートを保存。原本・全体アトラス・manifestは保持。立ち絵はbase-run/curatedから書き出し、アイコンはそこから切り出した（オルドは全体）。

|動作|判定|確認した動き|
|---|---|---|
|idle|best-effort|Gentle breathing and one blink, hand on hip, feet fixed. Seamless relaxed cycle.|
|danger|best-effort|Focused concerned expression, lean forward slightly and brace shoulders. Small looping tension, feet fixed.|
|success|best-effort|A quick confident small fist pump then lower hand.|
|garbage-land|best-effort|Briefly brace knees and shoulders in surprise then steady herself.|
|victory|best-effort|Bring arms together to cross them, smile proudly and nod once, finish arms crossed.|
|defeat|best-effort|Lower into a squat and look down thoughtfully at the board, finish crouched without standing back up.|
|finish|best-effort|Relax shoulders and wipe forehead with one hand, settle contentedly.|

生成による輪郭・細部の小さな差は残る。体格の揺れを隠すコマ別倍率は追加していない。待機・ピンチのみループし、結果は末尾で止まる。
