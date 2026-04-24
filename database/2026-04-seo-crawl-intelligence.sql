-- Rule-based page classification and crawl-run aggregates (websites.id as text in site_id; unchanged)
alter table seo_crawl_pages
  add column if not exists issue_type text,
  add column if not exists issue_severity text,
  add column if not exists crawl_notes text;

alter table seo_crawl_runs
  add column if not exists healthy_count integer not null default 0,
  add column if not exists notice_count integer not null default 0,
  add column if not exists warning_count integer not null default 0,
  add column if not exists critical_count integer not null default 0,
  add column if not exists health_score integer not null default 100;

comment on column seo_crawl_pages.issue_type is 'Rule-based: server_error, broken_page, redirect, missing_title, missing_h1, missing_meta_description, healthy';
comment on column seo_crawl_pages.issue_severity is 'critical | warning | notice | healthy';
comment on column seo_crawl_runs.health_score is '100 - 15*critical - 7*warning - 2*notice, clamped 0..100';
