# ordo sprite-gen v1 確認記録

基準画像をCodex CLI経由のgpt-imageで新規生成し、同じ基準画像と各行の配置ガイドを参照して7動作を生成。モデル版の指定なし。512×512px・各6コマ。pixel_unfake=falseで128pxへの縮小・減色を行わない。

extractとcompose-atlasはいずれもok=true、警告なし。各コマの透過と背景色残りをqa/alpha-check.jsonで検査（alpha>=16、キー色距離80未満は全行0画素）。全コマの連続画像を確認。完成アトラスの矩形に沿って行ごとに分割し、配信用の動作シートを保存。原本・全体アトラス・manifestは保持。立ち絵はbase-run/curatedから書き出し、アイコンはそこから切り出した（オルドは全体）。

|動作|判定|確認した動き|
|---|---|---|
|idle|best-effort|Stationary gate, tiny brass plate angle changes and subtle amber window brightness cycle. Pillars remain fixed. Barrier horizontal.|
|danger|best-effort|Stationary pillars, brass plates tilt inward with tension and amber inset dims slightly then returns, seamless loop. Barrier horizontal.|
|success|best-effort|Brass plates briefly tip upward together and return. No movement of pillars. Barrier horizontal.|
|garbage-land|best-effort|Brass plates jolt slightly and settle, amber inset briefly darkens then returns. Gate stays planted.|
|victory|best-effort|Brass plates rotate into perfectly horizontal aligned positions, amber window steady. Hold final alignment, barrier remains closed horizontal.|
|defeat|best-effort|Open the wooden barrier arm by rotating around its visible hinge on screen-right inner pillar from horizontal through intermediate diagonal poses to vertical alongside same pillar. Never remove or shorten arm. Final gate open, pillars fixed.|
|finish|best-effort|Set brass plates to relaxed neutral angles and amber window to warm steady brightness. Gate remains closed and stationary.|

生成による輪郭・細部の小さな差は残る。体格の揺れを隠すコマ別倍率は追加していない。待機・ピンチのみループし、結果は末尾で止まる。
