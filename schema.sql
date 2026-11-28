-- Cloudflare D1 Schema for VJ EMMA - TRUE LIGHT PRODUCTION (vjemmadb)

CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  client_name TEXT,
  client_phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  plan TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  days INTEGER NOT NULL DEFAULT 1,
  method TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'pending',
  expiry INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at
  ON payment_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS movies (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
