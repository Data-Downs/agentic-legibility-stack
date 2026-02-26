-- Service store tables for Legibility Studio
-- Used by @als/service-store with D1Adapter (Cloudflare) or SqliteAdapter (local)

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  department_key TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'graph',
  service_type TEXT,
  govuk_url TEXT,
  eligibility_summary TEXT,
  promoted INTEGER NOT NULL DEFAULT 0,
  proactive INTEGER NOT NULL DEFAULT 0,
  gated INTEGER NOT NULL DEFAULT 0,
  manifest_json TEXT NOT NULL,
  policy_json TEXT,
  state_model_json TEXT,
  consent_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_services_department_key ON services(department_key);
CREATE INDEX IF NOT EXISTS idx_services_source ON services(source);
CREATE INDEX IF NOT EXISTS idx_services_promoted ON services(promoted);

CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_service_id TEXT NOT NULL,
  to_service_id TEXT NOT NULL,
  edge_type TEXT NOT NULL CHECK(edge_type IN ('REQUIRES', 'ENABLES')),
  UNIQUE(from_service_id, to_service_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_service_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_service_id);

CREATE TABLE IF NOT EXISTS life_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS life_event_services (
  life_event_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  PRIMARY KEY (life_event_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_les_life_event ON life_event_services(life_event_id);
