CREATE TABLE scores (
  id TEXT PRIMARY KEY,
  rules TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('endless', 'timeattack')),
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_chain INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  frames INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  submitter TEXT NOT NULL
);
CREATE INDEX scores_ranking ON scores(rules, mode, score DESC, max_chain DESC, created_at, id);
CREATE INDEX scores_rate ON scores(submitter, created_at);
