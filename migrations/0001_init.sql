CREATE TABLE IF NOT EXISTS games (
  id            TEXT PRIMARY KEY,
  steam_app_id  INTEGER,
  name          TEXT NOT NULL,
  image_url     TEXT,
  price         TEXT,
  rating        REAL,
  status        TEXT NOT NULL DEFAULT 'none',
  queue_position INTEGER NOT NULL,
  tags          TEXT,
  notes         TEXT,
  hours_played  REAL DEFAULT 0,
  date_added    TEXT NOT NULL,
  date_completed TEXT,
  is_custom     INTEGER NOT NULL DEFAULT 0,
  steam_url     TEXT,
  player_count  INTEGER,
  player_count_recent INTEGER,
  key_price     TEXT,
  key_price_url TEXT,
  key_price_updated TEXT
);

CREATE INDEX IF NOT EXISTS idx_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_queue_position ON games(queue_position);

CREATE TABLE IF NOT EXISTS scrape_cache (
  source      TEXT NOT NULL,
  app_id      TEXT NOT NULL,
  data        TEXT NOT NULL,
  fetched_at  TEXT NOT NULL,
  PRIMARY KEY (source, app_id)
);
