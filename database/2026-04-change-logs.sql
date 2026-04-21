-- Change logs foundation for commit/deploy impact correlation
-- Additive migration only

BEGIN;

CREATE TABLE IF NOT EXISTS change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  change_type text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,
  created_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS change_logs_website_created_idx
  ON change_logs (website_id, created_at DESC);

CREATE INDEX IF NOT EXISTS change_logs_type_created_idx
  ON change_logs (change_type, created_at DESC);

COMMIT;
