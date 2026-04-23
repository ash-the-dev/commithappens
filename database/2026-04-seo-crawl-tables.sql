-- Raw crawl storage for Apify (and other sources). Does not modify response_code_reports shape required by the app.
create extension if not exists pgcrypto;

create table if not exists seo_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  source text not null default 'apify',
  actor_id text,
  actor_run_id text,
  dataset_id text,
  status text not null default 'completed',
  pages_crawled integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists seo_crawl_pages (
  id uuid primary key default gen_random_uuid(),
  crawl_run_id uuid not null references seo_crawl_runs (id) on delete cascade,
  site_id text not null,
  url text not null,
  status integer,
  title text,
  meta_description text,
  h1 text,
  links jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_crawl_runs_site_id_created_at
  on seo_crawl_runs (site_id, created_at desc);

create index if not exists idx_seo_crawl_pages_crawl_run_id
  on seo_crawl_pages (crawl_run_id);

create index if not exists idx_seo_crawl_pages_site_id
  on seo_crawl_pages (site_id);

-- Optional metadata on final reports; existing readers use report_json only.
alter table response_code_reports
  add column if not exists source text,
  add column if not exists crawl_run_id uuid references seo_crawl_runs (id) on delete set null,
  add column if not exists source_dataset_id text;

create index if not exists response_code_reports_site_crawl_run_created_idx
  on response_code_reports (site_id, crawl_run_id, created_at desc);
