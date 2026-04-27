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
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'uptime_checks'
      AND column_name = 'is_enabled'
  ) THEN
    EXECUTE 'UPDATE uptime_checks
      SET enabled = is_enabled
      WHERE enabled IS DISTINCT FROM is_enabled';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'uptime_checks'
      AND column_name = 'interval_seconds'
  ) THEN
    EXECUTE 'UPDATE uptime_checks
      SET frequency_minutes = GREATEST(1, COALESCE(interval_seconds, 300) / 60)';
  END IF;
END
$$;

-- Ensure user_id is hydrated from website owner when missing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'uptime_checks'
      AND column_name = 'site_id'
  ) THEN
    EXECUTE 'UPDATE uptime_checks uc
      SET user_id = w.owner_user_id
      FROM websites w
      WHERE uc.site_id = w.id
        AND uc.user_id IS NULL';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'uptime_checks'
      AND column_name = 'website_id'
  ) THEN
    EXECUTE 'UPDATE uptime_checks uc
      SET user_id = w.owner_user_id
      FROM websites w
      WHERE uc.website_id = w.id
        AND uc.user_id IS NULL';
  END IF;
END
$$;

ALTER TABLE uptime_checks
  ALTER COLUMN frequency_minutes SET DEFAULT 30;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY site_id
      ORDER BY checked_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM uptime_checks
  WHERE site_id IS NOT NULL
)
DELETE FROM uptime_checks u
USING ranked r
WHERE u.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uptime_checks_site_uidx
  ON uptime_checks (site_id)
  WHERE site_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS uptime_checks_enabled_idx ON uptime_checks (enabled);
CREATE INDEX IF NOT EXISTS uptime_checks_next_check_at_idx ON uptime_checks (next_check_at);
CREATE INDEX IF NOT EXISTS uptime_checks_site_id_idx ON uptime_checks (site_id);
CREATE INDEX IF NOT EXISTS uptime_checks_user_id_idx ON uptime_checks (user_id);

-- ---------------------------------------------------------------------------
-- uptime_logs: keep legacy columns for compatibility, add new scheduler fields.
-- ---------------------------------------------------------------------------
ALTER TABLE uptime_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS status_code integer,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'uptime_logs'
      AND column_name = 'is_up'
  ) THEN
    EXECUTE 'UPDATE uptime_logs
      SET status = COALESCE(
        status,
        CASE
          WHEN is_up = true THEN ''up''
          WHEN is_up = false THEN ''down''
          ELSE ''error''
        END
      )';
  ELSE
    UPDATE uptime_logs
    SET status = COALESCE(status, 'error');
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'uptime_logs'
      AND column_name = 'http_status'
  ) THEN
    EXECUTE 'UPDATE uptime_logs
      SET status_code = COALESCE(status_code, http_status)';
  END IF;
END
$$;

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

CREATE INDEX IF NOT EXISTS uptime_logs_site_id_idx ON uptime_logs (site_id);
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

