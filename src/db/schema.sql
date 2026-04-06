PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS extractions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  document_type TEXT,
  document_name TEXT,
  category TEXT,
  applicable_role TEXT,
  confidence TEXT,
  holder_name TEXT,
  date_of_birth TEXT,
  sirb_number TEXT,
  passport_number TEXT,
  fields_json TEXT NOT NULL DEFAULT '[]',
  validity_json TEXT NOT NULL DEFAULT '{}',
  compliance_json TEXT NOT NULL DEFAULT '{}',
  medical_data_json TEXT NOT NULL DEFAULT '{}',
  flags_json TEXT NOT NULL DEFAULT '[]',
  is_expired INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  raw_llm_response TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  processing_time_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'COMPLETE',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_extractions_session_file_hash
  ON extractions(session_id, file_hash);
CREATE INDEX IF NOT EXISTS idx_extractions_session_id
  ON extractions(session_id);
CREATE INDEX IF NOT EXISTS idx_extractions_document_type
  ON extractions(document_type);
CREATE INDEX IF NOT EXISTS idx_extractions_is_expired
  ON extractions(is_expired);
CREATE INDEX IF NOT EXISTS idx_extractions_created_at
  ON extractions(created_at DESC);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  extraction_id TEXT REFERENCES extractions(id),
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_data_base64 TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'QUEUED',
  error_code TEXT,
  error_message TEXT,
  retryable INTEGER NOT NULL DEFAULT 0,
  queued_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status
  ON jobs(status, queued_at);
CREATE INDEX IF NOT EXISTS idx_jobs_session_id
  ON jobs(session_id);

CREATE TABLE IF NOT EXISTS validations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_validations_session_created
  ON validations(session_id, created_at DESC);
