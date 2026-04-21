-- Dashboard backend upgrades (additive only, no destructive changes)
-- Reuses existing tables: websites, sessions, pageviews, events, web_vitals, uptime_logs

BEGIN;

-- ---------------------------------------------------------------------------
-- websites: per-site settings bag + explicit active toggle usage
-- ---------------------------------------------------------------------------
ALTER TABLE websites
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- sessions: enrich session intelligence
-- ---------------------------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS is_bounce boolean,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS pageview_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS event_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_score numeric,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS sessions_website_first_seen_idx
  ON sessions (website_id, first_seen_at DESC);

-- ---------------------------------------------------------------------------
-- pageviews: optional URL/timing details
-- ---------------------------------------------------------------------------
ALTER TABLE pageviews
  ADD COLUMN IF NOT EXISTS full_url text,
  ADD COLUMN IF NOT EXISTS load_time_ms integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- events: conversion-centric fields while retaining existing properties jsonb
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS path text,
  ADD COLUMN IF NOT EXISTS event_value numeric,
  ADD COLUMN IF NOT EXISTS is_conversion boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS events_website_conversion_time_idx
  ON events (website_id, is_conversion, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- web_vitals: metadata bag for flexible diagnostics
-- ---------------------------------------------------------------------------
ALTER TABLE web_vitals
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- uptime_logs: richer status semantics and source metadata
-- ---------------------------------------------------------------------------
ALTER TABLE uptime_logs
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS check_region text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill status from legacy boolean where available.
UPDATE uptime_logs
SET status = CASE WHEN is_up THEN 'up' ELSE 'down' END
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS uptime_logs_website_status_time_idx
  ON uptime_logs (website_id, status, checked_at DESC);

-- ---------------------------------------------------------------------------
-- Dashboard RPC helpers (Supabase-friendly read endpoints)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_site_dashboard_summary(p_site_id uuid)
RETURNS TABLE (
  sessions_24h bigint,
  pageviews_24h bigint,
  events_24h bigint,
  unique_visitors_24h bigint,
  uptime_checks_24h bigint,
  uptime_up_24h bigint,
  uptime_pct_24h numeric,
  avg_response_ms_24h numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (SELECT count(*) FROM sessions s
      WHERE s.website_id = p_site_id
        AND s.started_at >= now() - interval '24 hours') AS sessions_24h,
    (SELECT count(*) FROM pageviews p
      WHERE p.website_id = p_site_id
        AND p.occurred_at >= now() - interval '24 hours') AS pageviews_24h,
    (SELECT count(*) FROM events e
      WHERE e.website_id = p_site_id
        AND e.occurred_at >= now() - interval '24 hours') AS events_24h,
    (SELECT count(DISTINCT s.visitor_key) FROM sessions s
      WHERE s.website_id = p_site_id
        AND s.started_at >= now() - interval '24 hours') AS unique_visitors_24h,
    (SELECT count(*) FROM uptime_logs u
      WHERE u.website_id = p_site_id
        AND u.checked_at >= now() - interval '24 hours') AS uptime_checks_24h,
    (SELECT count(*) FROM uptime_logs u
      WHERE u.website_id = p_site_id
        AND u.checked_at >= now() - interval '24 hours'
        AND coalesce(u.status, CASE WHEN u.is_up THEN 'up' ELSE 'down' END) = 'up') AS uptime_up_24h,
    COALESCE((
      SELECT
        CASE WHEN count(*) = 0 THEN 100::numeric
             ELSE (count(*) FILTER (
                    WHERE coalesce(u.status, CASE WHEN u.is_up THEN 'up' ELSE 'down' END) = 'up'
                  )::numeric / count(*)::numeric) * 100
        END
      FROM uptime_logs u
      WHERE u.website_id = p_site_id
        AND u.checked_at >= now() - interval '24 hours'
    ), 100::numeric) AS uptime_pct_24h,
    COALESCE((
      SELECT avg(u.response_time_ms)::numeric
      FROM uptime_logs u
      WHERE u.website_id = p_site_id
        AND u.checked_at >= now() - interval '24 hours'
    ), 0::numeric) AS avg_response_ms_24h;
$$;

CREATE OR REPLACE FUNCTION public.get_site_activity_14d(p_site_id uuid)
RETURNS TABLE (
  day date,
  sessions_count bigint,
  pageviews_count bigint,
  events_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH days AS (
    SELECT generate_series(
      (current_date - interval '13 days')::date,
      current_date::date,
      interval '1 day'
    )::date AS day
  ),
  s AS (
    SELECT date_trunc('day', started_at)::date AS day, count(*) AS c
    FROM sessions
    WHERE website_id = p_site_id
      AND started_at >= now() - interval '14 days'
    GROUP BY 1
  ),
  p AS (
    SELECT date_trunc('day', occurred_at)::date AS day, count(*) AS c
    FROM pageviews
    WHERE website_id = p_site_id
      AND occurred_at >= now() - interval '14 days'
    GROUP BY 1
  ),
  e AS (
    SELECT date_trunc('day', occurred_at)::date AS day, count(*) AS c
    FROM events
    WHERE website_id = p_site_id
      AND occurred_at >= now() - interval '14 days'
    GROUP BY 1
  )
  SELECT
    d.day,
    coalesce(s.c, 0) AS sessions_count,
    coalesce(p.c, 0) AS pageviews_count,
    coalesce(e.c, 0) AS events_count
  FROM days d
  LEFT JOIN s ON s.day = d.day
  LEFT JOIN p ON p.day = d.day
  LEFT JOIN e ON e.day = d.day
  ORDER BY d.day;
$$;

CREATE OR REPLACE FUNCTION public.get_site_top_pages_14d(p_site_id uuid)
RETURNS TABLE (
  path text,
  views bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT pv.path, count(*)::bigint AS views
  FROM pageviews pv
  WHERE pv.website_id = p_site_id
    AND pv.occurred_at >= now() - interval '14 days'
  GROUP BY pv.path
  ORDER BY views DESC
  LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.get_site_vitals_7d(p_site_id uuid)
RETURNS TABLE (
  metric_name text,
  avg_value double precision,
  samples bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    w.metric_name,
    avg(w.value) AS avg_value,
    count(*)::bigint AS samples
  FROM web_vitals w
  WHERE w.website_id = p_site_id
    AND w.occurred_at >= now() - interval '7 days'
  GROUP BY w.metric_name
  ORDER BY w.metric_name;
$$;

COMMIT;

