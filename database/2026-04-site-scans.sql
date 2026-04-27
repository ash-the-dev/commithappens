-- Canonical completed scan ledger for dashboard site intelligence.
-- Raw feature tables still keep details; this table is the stable summary contract.

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references websites (id) on delete cascade,
  scan_type text not null,
  status text not null default 'complete',
  completed_at timestamptz not null,
  result_summary jsonb not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scans_type_chk check (scan_type in ('seo', 'uptime', 'analytics', 'reputation')),
  constraint scans_status_chk check (status in ('complete', 'failed')),
  constraint scans_complete_payload_chk check (
    status <> 'complete'
    or (completed_at is not null and result_summary is not null and jsonb_typeof(result_summary) = 'object')
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
