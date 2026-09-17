-- ランキングを 1 人 1 件（自己ベスト）にするため、端末が作った匿名 id を記録する。
-- 古い記録は player を持たないので、その 1 プレイだけの人として id を入れておく。
ALTER TABLE scores ADD COLUMN player TEXT NOT NULL DEFAULT '';
UPDATE scores SET player = id WHERE player = '';
CREATE INDEX scores_player ON scores(rules, mode, player, score DESC, max_chain DESC, created_at, id);
