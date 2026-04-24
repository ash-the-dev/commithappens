-- CommitHappens PostgreSQL schema (MVP+)
-- Target: PostgreSQL 14+ (uses gen_random_uuid(); on PG12–13 enable: CREATE EXTENSION IF NOT EXISTS pgcrypto;)

-- ---------------------------------------------------------------------------
-- Extensions (uncomment if gen_random_uuid() is unavailable)
-- ---------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ---------------------------------------------------------------------------
-- Users & sites
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL,
  password_hash   text, -- nullable if you add OAuth-only accounts later
  display_name    text,
  plan            text NOT NULL DEFAULT 'free',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_nonempty_chk CHECK (email <> '')
);

CREATE UNIQUE INDEX users_email_lower_uidx ON users ((lower(email)));
CREATE INDEX users_created_at_idx ON users (created_at);

-- ---------------------------------------------------------------------------
-- Password resets
-- ---------------------------------------------------------------------------
CREATE TABLE password_reset_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_reset_tokens_user_idx
  ON password_reset_tokens (user_id, created_at DESC);
CREATE INDEX password_reset_tokens_expiry_idx
  ON password_reset_tokens (expires_at)
  WHERE used_at IS NULL;

CREATE TABLE websites (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id        uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name                 text NOT NULL,
  primary_domain       text NOT NULL, -- canonical hostname, lowercase
  timezone             text NOT NULL DEFAULT 'UTC',
  -- Public id embedded in the tracking script; opaque to third parties.
  tracking_public_key  uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- Optional: store a hash (e.g. argon2/bcrypt) of a secret used to sign ingest payloads.
  tracking_secret_hash text,
  -- Default URL used for uptime probes (often https://primary_domain/)
  monitoring_url       text,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX websites_owner_user_id_idx ON websites (owner_user_id);
CREATE INDEX websites_primary_domain_idx ON websites (lower(primary_domain));
CREATE INDEX websites_active_idx ON websites (owner_user_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Traffic source dimension (first-touch / session-level attribution)
-- One row per unique attribution fingerprint per website (deduped).
-- ---------------------------------------------------------------------------
CREATE TABLE traffic_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id      uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  -- high-level bucket: direct | organic_search | paid_search | social | referral | email | other
  channel         text NOT NULL,
  referrer_host   text, -- registrable domain or host when available
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_term        text,
  utm_content     text,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT traffic_sources_channel_chk CHECK (channel <> '')
);

-- Expression unique index allows NULL utm/referrer fields to dedupe consistently.
CREATE UNIQUE INDEX traffic_sources_fingerprint_uidx ON traffic_sources (
  website_id,
  channel,
  coalesce(referrer_host, ''),
  coalesce(utm_source, ''),
  coalesce(utm_medium, ''),
  coalesce(utm_campaign, ''),
  coalesce(utm_term, ''),
  coalesce(utm_content, '')
);

CREATE INDEX traffic_sources_website_channel_idx ON traffic_sources (website_id, channel);

-- ---------------------------------------------------------------------------
-- Sessions (analytics)
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id         uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  traffic_source_id  uuid REFERENCES traffic_sources (id) ON DELETE SET NULL,
  -- Anonymous visitor id from first-party cookie (rotates per privacy policy).
  visitor_key        text NOT NULL,
  -- Client-generated session id (UUID) stored in sessionStorage / cookie.
  session_key        text NOT NULL,
  started_at         timestamptz NOT NULL DEFAULT now(),
  last_activity_at   timestamptz NOT NULL DEFAULT now(),
  entry_path         text,
  entry_query        text,
  referrer_url       text,
  user_agent         text,
  device_type        text, -- mobile | tablet | desktop | unknown
  browser_family     text,
  os_family          text,
  country_code       char(2), -- optional, from future geoip job
  CONSTRAINT sessions_unique_per_site UNIQUE (website_id, session_key)
);

CREATE INDEX sessions_website_started_at_idx ON sessions (website_id, started_at DESC);
CREATE INDEX sessions_website_last_activity_idx ON sessions (website_id, last_activity_at DESC);
CREATE INDEX sessions_visitor_key_idx ON sessions (website_id, visitor_key);
CREATE INDEX sessions_traffic_source_idx ON sessions (traffic_source_id) WHERE traffic_source_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Pageviews
-- ---------------------------------------------------------------------------
CREATE TABLE pageviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id   uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  path         text NOT NULL,
  query_string text,
  title        text,
  referrer_url text
);

CREATE INDEX pageviews_website_time_idx ON pageviews (website_id, occurred_at DESC);
CREATE INDEX pageviews_session_time_idx ON pageviews (session_id, occurred_at DESC);
CREATE INDEX pageviews_website_path_idx ON pageviews (website_id, path);

-- ---------------------------------------------------------------------------
-- Custom / conversion events
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id   uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  name         text NOT NULL,
  properties   jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_website_time_idx ON events (website_id, occurred_at DESC);
CREATE INDEX events_website_name_time_idx ON events (website_id, name, occurred_at DESC);
CREATE INDEX events_session_time_idx ON events (session_id, occurred_at DESC);
CREATE INDEX events_properties_gin_idx ON events USING gin (properties jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- Core Web Vitals & performance beacons (ingestion separate from pageviews)
-- ---------------------------------------------------------------------------
CREATE TABLE web_vitals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id   uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  session_id   uuid REFERENCES sessions (id) ON DELETE SET NULL,
  pageview_id  uuid REFERENCES pageviews (id) ON DELETE SET NULL,
  metric_name  text NOT NULL, -- LCP | INP | CLS | FCP | TTFB
  value        double precision NOT NULL,
  rating       text, -- good | needs-improvement | poor (optional, from browser API)
  path         text,
  occurred_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX web_vitals_website_time_idx ON web_vitals (website_id, occurred_at DESC);
CREATE INDEX web_vitals_website_metric_time_idx ON web_vitals (website_id, metric_name, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Uptime monitoring
-- ---------------------------------------------------------------------------
CREATE TABLE uptime_checks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id      uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  url             text NOT NULL,
  interval_seconds integer NOT NULL DEFAULT 300,
  is_enabled      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uptime_checks_interval_chk CHECK (interval_seconds >= 60)
);

CREATE INDEX uptime_checks_website_idx ON uptime_checks (website_id) WHERE is_enabled = true;

CREATE TABLE uptime_logs (
  id             bigserial PRIMARY KEY,
  website_id     uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  uptime_check_id uuid REFERENCES uptime_checks (id) ON DELETE SET NULL,
  checked_at     timestamptz NOT NULL DEFAULT now(),
  http_status    integer,
  response_time_ms integer,
  is_up          boolean NOT NULL,
  error_message  text
);

CREATE INDEX uptime_logs_website_time_idx ON uptime_logs (website_id, checked_at DESC);
CREATE INDEX uptime_logs_check_time_idx ON uptime_logs (uptime_check_id, checked_at DESC);

-- ---------------------------------------------------------------------------
-- Alerts (downtime, traffic anomalies, future rule types)
-- ---------------------------------------------------------------------------
CREATE TABLE alerts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id     uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  alert_type     text NOT NULL, -- downtime | traffic_drop | ...
  severity       text NOT NULL DEFAULT 'warning', -- info | warning | critical
  title          text NOT NULL,
  body           text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_at   timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at    timestamptz
);

CREATE INDEX alerts_website_triggered_idx ON alerts (website_id, triggered_at DESC);
CREATE INDEX alerts_open_idx ON alerts (website_id) WHERE resolved_at IS NULL;

-- ---------------------------------------------------------------------------
-- Optional: rolling aggregates for fast dashboards (populate via cron/job)
-- ---------------------------------------------------------------------------
CREATE TABLE analytics_daily_rollups (
  website_id    uuid NOT NULL REFERENCES websites (id) ON DELETE CASCADE,
  bucket_date   date NOT NULL,
  sessions      integer NOT NULL DEFAULT 0,
  pageviews     integer NOT NULL DEFAULT 0,
  visitors      integer NOT NULL DEFAULT 0, -- distinct visitor_key count
  events        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (website_id, bucket_date)
);

CREATE INDEX analytics_daily_rollups_date_idx ON analytics_daily_rollups (bucket_date);

-- ---------------------------------------------------------------------------
-- Notes
-- - Ingestion API resolves website by tracking_public_key, then upserts
--   traffic_sources + sessions + pageviews/events in one transaction.
-- - If you use Supabase with Row Level Security (RLS), read database/supabase-rls.sql.
-- ---------------------------------------------------------------------------
