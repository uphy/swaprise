# yuno sprite-gen v1 確認記録

基準画像をCodex CLI経由のgpt-imageで新規生成し、同じ基準画像と各行の配置ガイドを参照して7動作を生成。モデル版の指定なし。512×512px・各6コマ。pixel_unfake=falseで128pxへの縮小・減色を行わない。

extractとcompose-atlasはいずれもok=true、警告なし。各コマの透過と背景色残りをqa/alpha-check.jsonで検査（alpha>=16、キー色距離80未満は全行0画素）。全コマの連続画像を確認。完成アトラスの矩形に沿って行ごとに分割し、配信用の動作シートを保存。原本・全体アトラス・manifestは保持。立ち絵はbase-run/curatedから書き出し、アイコンはそこから切り出した（オルドは全体）。

|動作|判定|確認した動き|
|---|---|---|
|idle|best-effort|Breathe softly and blink, holding half-open map steady. Seamless cycle.|
|danger|best-effort|Glance down at map then forward, brows concerned, hold map close. Seamless subtle cycle.|
|success|best-effort|Brighten and point to a place on the map with one finger then settle.|
|garbage-land|best-effort|Startle briefly, grip map securely and regain balance.|
|victory|best-effort|Smile and hug the partly unfolded map to chest, finishing with map held happily.|
|defeat|best-effort|Look down sadly and carefully straighten the map edges, end looking down without recovery.|
|finish|best-effort|Fold map neatly and breathe out with a gentle satisfied expression.|

生成による輪郭・細部の小さな差は残る。体格の揺れを隠すコマ別倍率は追加していない。待機・ピンチのみループし、結果は末尾で止まる。
