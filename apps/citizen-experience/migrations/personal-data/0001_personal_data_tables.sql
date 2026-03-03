-- Personal Data Tables (Three-Tier Model)
-- Tier 1: Verified data is read from wallet credentials (no table needed)
-- Tier 2: Submitted data from service claims
-- Tier 3: Inferred data from LLM extraction

CREATE TABLE IF NOT EXISTS submitted_data (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_value TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'persona',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_submitted_user ON submitted_data(user_id);
CREATE INDEX IF NOT EXISTS idx_submitted_category ON submitted_data(user_id, category);

CREATE TABLE IF NOT EXISTS inferred_data (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_value TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'inferred',
  source TEXT NOT NULL DEFAULT 'conversation',
  session_id TEXT,
  extracted_from TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inferred_user ON inferred_data(user_id);

CREATE TABLE IF NOT EXISTS service_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  data_tier TEXT NOT NULL DEFAULT 'tier2',
  purpose TEXT,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  consent_record_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_user ON service_access(user_id);
CREATE INDEX IF NOT EXISTS idx_access_service ON service_access(user_id, service_id);

CREATE TABLE IF NOT EXISTS data_updates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  update_type TEXT NOT NULL DEFAULT 'edit',
  services_notified TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_updates_user ON data_updates(user_id);
