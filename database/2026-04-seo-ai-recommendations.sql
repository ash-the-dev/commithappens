-- Stores enrichment-time AI recommendations for the highest-priority crawled pages.
alter table seo_page_reports
  add column if not exists ai_recommendations jsonb;

comment on column seo_page_reports.ai_recommendations is
  'Structured AI SEO recommendations generated during crawl enrichment for selected top-priority pages only.';
