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
  hangul_chosung TEXT NOT NULL DEFAULT '',
  hangul_jungsung TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (hangul, hanja, is_surname)
);

CREATE INDEX IF NOT EXISTS idx_hanja_entries_hanja_surname
  ON hanja_entries (hanja, is_surname);

CREATE INDEX IF NOT EXISTS idx_hanja_entries_hangul_key
  ON hanja_entries (is_surname, hangul, hangul_chosung, hangul_jungsung);

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
  k1 TEXT NOT NULL DEFAULT '',
  k2 TEXT NOT NULL DEFAULT '',
  k3 TEXT NOT NULL DEFAULT '',
  h1 TEXT NOT NULL DEFAULT '',
  h2 TEXT NOT NULL DEFAULT '',
  h3 TEXT NOT NULL DEFAULT '',
  c1 TEXT NOT NULL DEFAULT '',
  c2 TEXT NOT NULL DEFAULT '',
  c3 TEXT NOT NULL DEFAULT '',
  j1 TEXT NOT NULL DEFAULT '',
  j2 TEXT NOT NULL DEFAULT '',
  j3 TEXT NOT NULL DEFAULT '',
  stroke_key TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (file_id, name_hangul, name_hanja)
);

CREATE INDEX IF NOT EXISTS idx_stats_combinations_file_length
  ON stats_combinations (file_id, name_length);

CREATE INDEX IF NOT EXISTS idx_stats_combinations_lookup1
  ON stats_combinations (file_id, name_length, k1, h1, c1, j1);

CREATE INDEX IF NOT EXISTS idx_stats_combinations_lookup2
  ON stats_combinations (file_id, name_length, k1, k2, h1, h2, c1, c2, j1, j2);

CREATE INDEX IF NOT EXISTS idx_stats_combinations_lookup3
  ON stats_combinations (file_id, name_length, k1, k2, k3, h1, h2, h3, c1, c2, c3, j1, j2, j3);

CREATE INDEX IF NOT EXISTS idx_stats_combinations_stroke_key
  ON stats_combinations (file_id, name_length, stroke_key);

CREATE TABLE IF NOT EXISTS sagyeok_data (
  number INTEGER NOT NULL PRIMARY KEY,
  lucky_level TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sagyeok_data_lucky_level
  ON sagyeok_data (lucky_level);

