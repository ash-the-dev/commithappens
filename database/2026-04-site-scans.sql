-- Canonical completed scan ledger for dashboard site intelligence.
-- Raw feature tables still keep details; this table is the stable summary contract.

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references websites (id) on delete cascade,
  scan_type text not null,
  status text not null default 'complete',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result_summary jsonb,
  raw_result jsonb,
  error_message text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scans_type_chk check (scan_type in ('seo', 'uptime', 'analytics', 'reputation')),
  constraint scans_status_chk check (status in ('running', 'complete', 'failed')),
  constraint scans_complete_payload_chk check (
    (
      status = 'running'
      and started_at is not null
      and completed_at is null
    )
    or (
      status = 'complete'
      and completed_at is not null
      and result_summary is not null
      and jsonb_typeof(result_summary) = 'object'
    )
    or (
      status = 'failed'
      and completed_at is not null
      and error_message is not null
      and trim(error_message) <> ''
    )
  ),
  constraint scans_summary_shape_chk check (
    status <> 'complete'
    or (
      (
        scan_type = 'seo'
        and result_summary ? 'broken_pages'
        and result_summary ? 'missing_meta'
        and result_summary ? 'performance_issues'
      )
      or (
        scan_type = 'uptime'
        and result_summary->>'status' in ('online', 'offline')
        and result_summary ? 'downtime_events'
      )
      or (
        scan_type = 'analytics'
        and result_summary ? 'traffic_24h'
        and result_summary->>'trend' in ('up', 'down', 'flat')
      )
      or (
        scan_type = 'reputation'
        and result_summary ? 'mentions'
        and result_summary ? 'flagged_mentions'
      )
    )
  )
);

create index if not exists scans_site_type_completed_idx
  on scans (site_id, scan_type, completed_at desc);

create index if not exists scans_status_completed_idx
  on scans (status, completed_at desc);

create unique index if not exists scans_site_type_completed_uidx
  on scans (site_id, scan_type, completed_at);

create index if not exists scans_site_type_source_status_idx
  on scans (site_id, scan_type, source, status, started_at desc);

create index if not exists scans_seo_crawl_run_idx
  on scans ((raw_result->>'crawlRunId'))
  where scan_type = 'seo';

alter table scans
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists raw_result jsonb,
  add column if not exists error_message text,
  alter column completed_at drop not null,
  alter column result_summary drop not null;

alter table scans
  drop constraint if exists scans_status_chk,
  add constraint scans_status_chk check (status in ('running', 'complete', 'failed'));

alter table scans
  drop constraint if exists scans_complete_payload_chk,
  add constraint scans_complete_payload_chk check (
    (
      status = 'running'
      and started_at is not null
      and completed_at is null
    )
    or (
      status = 'complete'
      and completed_at is not null
      and result_summary is not null
      and jsonb_typeof(result_summary) = 'object'
    )
    or (
      status = 'failed'
      and completed_at is not null
      and error_message is not null
      and trim(error_message) <> ''
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scans_summary_shape_chk'
      and conrelid = 'public.scans'::regclass
  ) then
    alter table scans
      add constraint scans_summary_shape_chk check (
        status <> 'complete'
        or (
          (
            scan_type = 'seo'
            and result_summary ? 'broken_pages'
            and result_summary ? 'missing_meta'
            and result_summary ? 'performance_issues'
          )
          or (
            scan_type = 'uptime'
            and result_summary->>'status' in ('online', 'offline')
            and result_summary ? 'downtime_events'
          )
          or (
            scan_type = 'analytics'
            and result_summary ? 'traffic_24h'
            and result_summary->>'trend' in ('up', 'down', 'flat')
          )
          or (
            scan_type = 'reputation'
            and result_summary ? 'mentions'
            and result_summary ? 'flagged_mentions'
          )
        )
      );
  end if;
end $$;
