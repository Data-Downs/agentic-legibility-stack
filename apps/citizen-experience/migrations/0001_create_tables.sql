-- Trace events — append-only evidence store
CREATE TABLE IF NOT EXISTS trace_events (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trace_events_trace_id ON trace_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_trace_events_type ON trace_events(type);
CREATE INDEX IF NOT EXISTS idx_trace_events_timestamp ON trace_events(timestamp);

-- Receipts — citizen-facing audit trail
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  citizen_id TEXT NOT NULL,
  citizen_name TEXT,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  details TEXT NOT NULL,
  data_shared TEXT,
  state_from TEXT,
  state_to TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_receipts_trace_id ON receipts(trace_id);
CREATE INDEX IF NOT EXISTS idx_receipts_capability_id ON receipts(capability_id);
CREATE INDEX IF NOT EXISTS idx_receipts_citizen_id ON receipts(citizen_id);

-- Cases — materialised view of trace events as operational ledger
CREATE TABLE IF NOT EXISTS cases (
  case_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  current_state TEXT NOT NULL DEFAULT 'not-started',
  status TEXT NOT NULL DEFAULT 'in-progress',
  started_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  states_completed TEXT NOT NULL DEFAULT '[]',
  progress_percent REAL NOT NULL DEFAULT 0,
  identity_verified INTEGER NOT NULL DEFAULT 0,
  eligibility_checked INTEGER NOT NULL DEFAULT 0,
  eligibility_result INTEGER,
  consent_granted INTEGER NOT NULL DEFAULT 0,
  handed_off INTEGER NOT NULL DEFAULT 0,
  handoff_reason TEXT,
  agent_actions INTEGER NOT NULL DEFAULT 0,
  human_actions INTEGER NOT NULL DEFAULT 0,
  review_status TEXT,
  review_requested_at TEXT,
  review_reason TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cases_service_id ON cases(service_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_last_activity ON cases(last_activity_at);

-- Case events — timeline entries linked to cases
CREATE TABLE IF NOT EXISTS case_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL,
  trace_event_id TEXT NOT NULL,
  trace_id TEXT,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (case_id) REFERENCES cases(case_id)
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
