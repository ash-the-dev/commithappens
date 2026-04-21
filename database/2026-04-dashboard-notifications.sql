BEGIN;

CREATE TABLE IF NOT EXISTS dashboard_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  category text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  summary text,
  evidence_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_type text NOT NULL,
  source_ref text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'unread',
  priority_score integer NOT NULL DEFAULT 0,
  fingerprint text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_notifications_status_chk
    CHECK (status IN ('unread', 'read', 'acknowledged')),
  CONSTRAINT dashboard_notifications_severity_chk
    CHECK (severity IN ('critical', 'high', 'medium', 'low'))
);

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_notifications_source_uidx
  ON dashboard_notifications (website_id, source_type, source_ref);

CREATE INDEX IF NOT EXISTS dashboard_notifications_website_status_idx
  ON dashboard_notifications (website_id, status, detected_at DESC);

CREATE INDEX IF NOT EXISTS dashboard_notifications_website_priority_idx
  ON dashboard_notifications (website_id, severity, priority_score DESC, detected_at DESC);

COMMIT;

