BEGIN;

CREATE TABLE IF NOT EXISTS dashboard_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  title text NOT NULL,
  summary text,
  source_type text NOT NULL,
  source_ref text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CONSTRAINT dashboard_cases_status_chk
    CHECK (status IN ('open', 'investigating', 'monitoring', 'resolved', 'dismissed')),
  CONSTRAINT dashboard_cases_severity_chk
    CHECK (severity IN ('critical', 'high', 'medium', 'low'))
);

CREATE INDEX IF NOT EXISTS dashboard_cases_website_status_idx
  ON dashboard_cases (website_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS dashboard_cases_website_created_idx
  ON dashboard_cases (website_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_cases_open_source_uidx
  ON dashboard_cases (website_id, source_type, source_ref)
  WHERE status IN ('open', 'investigating', 'monitoring');

CREATE TABLE IF NOT EXISTS dashboard_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES dashboard_cases (id) ON DELETE CASCADE,
  note_text text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dashboard_case_notes_case_idx
  ON dashboard_case_notes (case_id, created_at DESC);

COMMIT;

