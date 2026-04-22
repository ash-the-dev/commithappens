-- Stores latest crawl-derived response code reports as JSON blobs.
CREATE TABLE IF NOT EXISTS response_code_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  site_id text NOT NULL DEFAULT 'default',
  report_json jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS response_code_reports_site_created_idx
  ON response_code_reports (site_id, created_at DESC);
