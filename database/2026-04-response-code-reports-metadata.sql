-- Optional metadata columns for response_code_reports.
-- Backward-compatible: keeps existing reads/writes working.
ALTER TABLE response_code_reports
  ADD COLUMN IF NOT EXISTS source_file_path text,
  ADD COLUMN IF NOT EXISTS source_bucket text,
  ADD COLUMN IF NOT EXISTS processing_status text,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Helpful for debugging and latest-failure views per site.
CREATE INDEX IF NOT EXISTS response_code_reports_site_status_created_idx
  ON response_code_reports (site_id, processing_status, created_at DESC);
