BEGIN;

-- One connection executes this whole migration. The transaction-scoped lock
-- serializes cold starts before PostgreSQL's system catalog is changed.
SELECT pg_advisory_xact_lock(186950, 1);
CREATE SCHEMA IF NOT EXISTS investo_intake;
CREATE TABLE IF NOT EXISTS investo_intake.schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS investo_intake.inquiries (
  id UUID PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  payload_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  email_hash CHAR(64) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'review', 'accepted')),
  phase TEXT NOT NULL DEFAULT 'reserved' CHECK (phase IN (
    'reserved', 'contact_create_started', 'contact_resolved',
    'inquiry_create_started', 'inquiry_stored'
  )),
  contact_id BIGINT,
  owner_id BIGINT,
  inquiry_id BIGINT,
  review_reason TEXT,
  lease_token UUID,
  lease_until BIGINT NOT NULL DEFAULT 0,
  next_attempt BIGINT NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS inquiries_pending
  ON investo_intake.inquiries (next_attempt, received_at)
  WHERE status = 'pending';

-- Deliberately no TTL: an uncertain contact POST must retain its email lock.
CREATE TABLE IF NOT EXISTS investo_intake.contact_locks (
  email_hash CHAR(64) PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES investo_intake.inquiries(id)
);
CREATE INDEX IF NOT EXISTS contact_locks_submission
  ON investo_intake.contact_locks (submission_id);
CREATE TABLE IF NOT EXISTS investo_intake.request_limits (
  key CHAR(64) PRIMARY KEY,
  count INTEGER NOT NULL,
  reset BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS request_limits_reset
  ON investo_intake.request_limits (reset);

INSERT INTO investo_intake.schema_migrations (version) VALUES (1)
  ON CONFLICT (version) DO NOTHING;
COMMIT;
