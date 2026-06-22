-- Polish Food Fight poll — D1 schema + seed.
-- Run once against the D1 database bound as DB in the Pages project.

CREATE TABLE IF NOT EXISTS dishes (
  slug  TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO dishes (slug, label, emoji, count) VALUES
  ('kaszanka', 'kaszanka', '🩸', 0),
  ('czernina', 'czernina', '🦆', 0),
  ('flaki',    'flaki',    '🫃', 0),
  ('watrobka', 'wątróbka', '🫀', 0);
