-- Uptime monitoring split:
-- - uptime_monitors: monitor configuration / schedule
-- - uptime_checks: result history / every probe
-- - uptime_logs: legacy backup only

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS uptime_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  site_id uuid REFERENCES websites (id) ON DELETE CASCADE,
  url text,
  enabled boolean NOT NULL DEFAULT true,
  frequency_minutes integer NOT NULL DEFAULT 30,
  last_checked_at timestamptz,
  next_check_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uptime_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  site_id uuid REFERENCES websites (id) ON DELETE SET NULL,
  url text NOT NULL,
  status_code integer,
  response_time_ms integer,
  is_up boolean NOT NULL,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE uptime_monitors
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES websites (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS frequency_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_check_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE uptime_checks
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES websites (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS status_code integer,
  ADD COLUMN IF NOT EXISTS response_time_ms integer,
  ADD COLUMN IF NOT EXISTS is_up boolean,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS checked_at timestamptz NOT NULL DEFAULT now();

INSERT INTO uptime_monitors (
  user_id,
  site_id,
  url,
  enabled,
  frequency_minutes,
  next_check_at,
  created_at,
  updated_at
)
SELECT
  w.owner_user_id,
  w.id,
  coalesce(nullif(trim(w.monitoring_url), ''), 'https://' || w.primary_domain),
  true,
  30,
  now(),
  now(),
  now()
FROM websites w
LEFT JOIN uptime_monitors m ON m.site_id = w.id
WHERE w.deleted_at IS NULL
  AND w.is_active = true
  AND m.id IS NULL;

CREATE INDEX IF NOT EXISTS uptime_monitors_enabled_next_idx
  ON uptime_monitors (enabled, next_check_at);
CREATE INDEX IF NOT EXISTS uptime_monitors_site_idx
  ON uptime_monitors (site_id);
CREATE INDEX IF NOT EXISTS uptime_checks_site_checked_idx
  ON uptime_checks (site_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS uptime_checks_user_checked_idx
  ON uptime_checks (user_id, checked_at DESC);

COMMIT;
