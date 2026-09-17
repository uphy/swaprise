-- 端末の匿名 id（player）の持ち主を確かめるための表。最初に名乗った端末に秘密を渡し、その SHA-256 だけを持つ。
-- 投稿は秘密が合うときだけ受けるので、他人の id を知っても、その名義で得点を置けない。
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
