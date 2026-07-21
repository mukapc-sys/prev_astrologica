-- ============================================================
-- Previsão Astrológica Completa · D1 (Cloudflare)
-- O banco "previsao-astrologica" já foi criado e este schema já
-- foi aplicado. Este arquivo serve de referência / recriação.
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
  id            TEXT PRIMARY KEY,
  device_id     TEXT,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  telefone      TEXT,
  whatsapp      TEXT,
  password_hash TEXT,
  salt          TEXT,
  birth_date    TEXT NOT NULL,
  birth_time    TEXT,
  has_time      INTEGER DEFAULT 0,
  birth_city    TEXT,
  lat           REAL,
  lon           REAL,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS charts (
  id          TEXT PRIMARY KEY,
  lead_id     TEXT NOT NULL,
  chart_json  TEXT NOT NULL,
  computed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_charts_lead ON charts(lead_id);

CREATE TABLE IF NOT EXISTS unlocks (
  id            TEXT PRIMARY KEY,
  lead_id       TEXT NOT NULL,
  payment_id    TEXT,
  status        TEXT DEFAULT 'pending',   -- pending | paid | failed
  provider      TEXT DEFAULT 'mercadopago',
  amount        REAL,
  pix_qr        TEXT,
  pix_copia_cola TEXT,
  external_ref  TEXT,
  paid_at       TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_unlocks_lead ON unlocks(lead_id);
CREATE INDEX IF NOT EXISTS idx_unlocks_payment ON unlocks(payment_id);

CREATE TABLE IF NOT EXISTS readings (
  id         TEXT PRIMARY KEY,
  lead_id    TEXT NOT NULL,
  area       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_readings_lead ON readings(lead_id);
