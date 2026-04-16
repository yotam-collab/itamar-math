CREATE TABLE associations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_id INTEGER NOT NULL,
  english TEXT NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  author_id TEXT,
  author_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  avg_rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(word_id, text)
);

CREATE TABLE ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  association_id INTEGER NOT NULL REFERENCES associations(id),
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(association_id, user_id)
);

CREATE TABLE moderation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  association_id INTEGER REFERENCES associations(id),
  action TEXT NOT NULL,
  reason TEXT,
  matched_pattern TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_assoc_word ON associations(word_id, status);
CREATE INDEX idx_assoc_status ON associations(status, avg_rating DESC);
CREATE INDEX idx_ratings_assoc ON ratings(association_id);
