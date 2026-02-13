PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS hanja_entries (
  hangul TEXT NOT NULL,
  hanja TEXT NOT NULL,
  meaning TEXT NOT NULL DEFAULT '',
  hoeksu INTEGER NOT NULL,
  hoeksu_ohaeng TEXT NOT NULL,
  jawon_ohaeng TEXT NOT NULL,
  pronunciation_ohaeng TEXT NOT NULL,
  pronunciation_eumyang INTEGER NOT NULL CHECK (pronunciation_eumyang IN (0, 1)),
  hoeksu_eumyang INTEGER NOT NULL CHECK (hoeksu_eumyang IN (0, 1)),
  boosoo TEXT NOT NULL DEFAULT '',
  is_surname INTEGER NOT NULL CHECK (is_surname IN (0, 1)),
  PRIMARY KEY (hangul, hanja, is_surname)
);

CREATE INDEX IF NOT EXISTS idx_hanja_entries_hanja_surname
  ON hanja_entries (hanja, is_surname);

CREATE TABLE IF NOT EXISTS surname_pairs (
  korean TEXT NOT NULL,
  hanja TEXT NOT NULL,
  PRIMARY KEY (korean, hanja)
);

CREATE TABLE IF NOT EXISTS stats_index (
  chosung_key TEXT NOT NULL,
  file_id TEXT NOT NULL,
  ord INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chosung_key, file_id)
);

CREATE INDEX IF NOT EXISTS idx_stats_index_order
  ON stats_index (chosung_key, ord, file_id);

CREATE TABLE IF NOT EXISTS stats_name (
  file_id TEXT NOT NULL,
  name_hangul TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (file_id, name_hangul)
);

CREATE TABLE IF NOT EXISTS stats_combinations (
  file_id TEXT NOT NULL,
  name_hangul TEXT NOT NULL,
  name_hanja TEXT NOT NULL,
  name_length INTEGER NOT NULL,
  PRIMARY KEY (file_id, name_hangul, name_hanja)
);

CREATE INDEX IF NOT EXISTS idx_stats_combinations_file_length
  ON stats_combinations (file_id, name_length);

