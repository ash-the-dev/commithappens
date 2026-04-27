-- Mark old SEO crawls that never imported as failed.
-- This keeps the dashboard from waiting forever on zombie running scans.

with stale_scans as (
  select
    id,
    row_number() over (order by started_at, id) as rn
  from scans
  where scan_type = 'seo'
    and status = 'running'
    and completed_at is null
    and started_at < now() - interval '30 minutes'
)
update scans
set
  status = 'failed',
  started_at = least(started_at, now()),
  completed_at = now() + (stale_scans.rn || ' milliseconds')::interval,
  error_message = 'SEO crawl timed out before import completed.',
  updated_at = now()
from stale_scans
where scans.id = stale_scans.id;

create index if not exists scans_seo_crawl_run_idx
  on scans ((raw_result->>'crawlRunId'))
  where scan_type = 'seo';
