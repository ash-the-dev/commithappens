-- Reputation Pulse provider-based mention crawler.
create extension if not exists pgcrypto;

create table if not exists social_watch_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  site_id uuid references websites (id) on delete set null,
  term text not null,
  term_type text not null default 'brand',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_watch_terms_term_nonempty_chk check (trim(term) <> ''),
  constraint social_watch_terms_term_type_chk check (
    term_type in ('brand', 'domain', 'product', 'handle', 'keyword')
  )
);

create table if not exists social_mentions (
  id uuid primary key default gen_random_uuid(),
  watch_term_id uuid references social_watch_terms (id) on delete set null,
  site_id uuid references websites (id) on delete set null,
  source text not null,
  external_id text,
  url text,
  author text,
  content text not null,
  content_hash text not null,
  matched_term text,
  published_at timestamptz,
  discovered_at timestamptz not null default now(),
  sentiment text not null default 'neutral',
  urgency text not null default 'low',
  impact_score integer not null default 0,
  summary text,
  suggested_response text,
  ai_enriched boolean not null default false,
  ai_enriched_at timestamptz,
  constraint social_mentions_content_hash_uidx unique (content_hash)
);

create index if not exists social_watch_terms_active_idx
  on social_watch_terms (is_active, term_type, created_at desc);

create index if not exists social_watch_terms_site_idx
  on social_watch_terms (site_id);

create index if not exists social_mentions_source_idx
  on social_mentions (source);

create index if not exists social_mentions_discovered_at_idx
  on social_mentions (discovered_at desc);

create index if not exists social_mentions_watch_term_idx
  on social_mentions (watch_term_id);

create index if not exists social_mentions_urgency_idx
  on social_mentions (urgency);

create index if not exists social_mentions_impact_score_idx
  on social_mentions (impact_score desc);

alter table social_watch_terms enable row level security;
alter table social_mentions enable row level security;

revoke all privileges on social_watch_terms from anon, authenticated;
revoke all privileges on social_mentions from anon, authenticated;

-- Temporary seed for beta/local testing. Safe to rerun; production checks still read the table.
insert into social_watch_terms (term, term_type)
select seed.term, seed.term_type
from (
  values
    ('Commit Happens', 'brand'),
    ('commithappens.com', 'domain')
) as seed(term, term_type)
where not exists (
  select 1
  from social_watch_terms existing
  where lower(existing.term) = lower(seed.term)
);
