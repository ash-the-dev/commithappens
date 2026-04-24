-- Optional external correlation id (e.g. primary Apify run id). site_id remains websites.id::text only.
alter table seo_crawl_runs
  add column if not exists external_source_id text;

comment on column seo_crawl_runs.site_id is 'Always websites.id cast to text. Never Apify actor run, dataset, or store ids.';
comment on column seo_crawl_runs.external_source_id is 'Optional: duplicate or primary external key (e.g. same as actor_run_id for convenience).';
comment on column seo_crawl_runs.actor_run_id is 'Apify (or other) run id — not a website id.';
comment on column seo_crawl_runs.dataset_id is 'Apify (or other) dataset id — not a website id.';
comment on column seo_crawl_pages.status is 'HTTP response status code. Not named status_code.';
