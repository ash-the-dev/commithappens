-- Scheduled uptime monitoring (global actor).
-- Safe/additive migration for existing uptime tables.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- uptime_checks: evolve legacy shape to scheduler-driven shape.
-- ---------------------------------------------------------------------------
ALTER TABLE uptime_checks
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS frequency_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_check_at timestamptz;

-- Backfill from legacy columns when present.
UPDATE uptime_checks
SET enabled = is_enabled
WHERE enabled IS DISTINCT FROM is_enabled
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'uptime_checks'
      AND column_name = 'is_enabled'
  );

UPDATE uptime_checks
SET frequency_minutes = GREATEST(1, COALESCE(interval_seconds, 300) / 60)
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'uptime_checks'
    AND column_name = 'interval_seconds'
);

-- Ensure user_id is hydrated from website owner when missing.
UPDATE uptime_checks uc
SET user_id = w.owner_user_id
FROM websites w
WHERE uc.website_id = w.id
  AND uc.user_id IS NULL;

ALTER TABLE uptime_checks
  ALTER COLUMN frequency_minutes SET DEFAULT 30;

CREATE UNIQUE INDEX IF NOT EXISTS uptime_checks_website_uidx ON uptime_checks (website_id);
CREATE INDEX IF NOT EXISTS uptime_checks_enabled_idx ON uptime_checks (enabled);
CREATE INDEX IF NOT EXISTS uptime_checks_next_check_at_idx ON uptime_checks (next_check_at);
CREATE INDEX IF NOT EXISTS uptime_checks_website_id_idx ON uptime_checks (website_id);
CREATE INDEX IF NOT EXISTS uptime_checks_user_id_idx ON uptime_checks (user_id);

-- ---------------------------------------------------------------------------
-- uptime_logs: keep legacy columns for compatibility, add new scheduler fields.
-- ---------------------------------------------------------------------------
ALTER TABLE uptime_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS status_code integer,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

UPDATE uptime_logs
SET status = COALESCE(
  status,
  CASE
    WHEN is_up = true THEN 'up'
    WHEN is_up = false THEN 'down'
    ELSE 'error'
  END
);

UPDATE uptime_logs
SET status_code = COALESCE(status_code, http_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uptime_logs_status_chk'
  ) THEN
    ALTER TABLE uptime_logs
      ADD CONSTRAINT uptime_logs_status_chk
      CHECK (status IN ('up', 'down', 'degraded', 'error'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS uptime_logs_website_id_idx ON uptime_logs (website_id);
CREATE INDEX IF NOT EXISTS uptime_logs_user_id_idx ON uptime_logs (user_id);
CREATE INDEX IF NOT EXISTS uptime_logs_checked_at_desc_idx ON uptime_logs (checked_at DESC);
CREATE INDEX IF NOT EXISTS uptime_logs_status_idx ON uptime_logs (status);

COMMIT;

-- ---------------------------------------------------------------------------
-- Scheduler setup (run once per minute).
-- Uses Supabase Vault + pg_cron + pg_net pattern.
-- ---------------------------------------------------------------------------
-- 1) Store secrets (run once, values are examples):
-- select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/run-uptime-checks', 'UPTIME_FUNCTION_URL');
-- select vault.create_secret('<uptime-runner-secret-token>', 'UPTIME_FUNCTION_TOKEN');
--
-- 2) (Optional) remove old schedule if re-running:
-- select cron.unschedule('run-uptime-checks-every-minute');
--
-- 3) Create schedule:
-- select cron.schedule(
--   'run-uptime-checks-every-minute',
--   '* * * * *',
--   $$
--   select
--     net.http_post(
--       url := (select decrypted_secret from vault.decrypted_secrets where name = 'UPTIME_FUNCTION_URL' limit 1),
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'UPTIME_FUNCTION_TOKEN' limit 1)
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );

