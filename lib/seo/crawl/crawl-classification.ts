import type { NormalizedCrawlRow } from "@/lib/seo/apify/normalize";

export type SeoCrawlIssueSeverity = "critical" | "warning" | "notice" | "healthy";

export type SeoCrawlPageClassification = {
  issue_type: string;
  issue_severity: SeoCrawlIssueSeverity;
  crawl_notes: string;
};

type Candidate = {
  issue_type: string;
  issue_severity: SeoCrawlIssueSeverity;
  note: string;
  /** Higher wins when severities equal */
  typeRank: number;
};

const SEVERITY_RANK: Record<SeoCrawlIssueSeverity, number> = {
  critical: 4,
  warning: 3,
  notice: 2,
  healthy: 1,
};

const hasText = (v: string | null | undefined) => Boolean(v && String(v).trim().length > 0);

/**
 * Classify a single crawled page from status + on-page fields (uses `status`, not `status_code`).
 * When multiple issues apply, keeps the highest severity; ties use issue-type priority.
 */
export function classifySeoCrawlPage(page: {
  status: number | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
}): SeoCrawlPageClassification {
  const c: Candidate[] = [];
  const st = page.status;

  if (st != null && st >= 500) {
    c.push({
      issue_type: "server_error",
      issue_severity: "critical",
      note: `HTTP ${st} (server error)`,
      typeRank: 100,
    });
  }
  if (st === 404) {
    c.push({
      issue_type: "broken_page",
      issue_severity: "warning",
      note: "HTTP 404 (not found)",
      typeRank: 80,
    });
  }
  if (st != null && st >= 300 && st <= 399) {
    c.push({
      issue_type: "redirect",
      issue_severity: "notice",
      note: `HTTP ${st} (redirect)`,
      typeRank: 50,
    });
  }
  if (!hasText(page.title)) {
    c.push({
      issue_type: "missing_title",
      issue_severity: "warning",
      note: "Missing or empty <title>",
      typeRank: 60,
    });
  }
  if (!hasText(page.h1)) {
    c.push({
      issue_type: "missing_h1",
      issue_severity: "warning",
      note: "Missing or empty H1",
      typeRank: 55,
    });
  }
  if (!hasText(page.meta_description)) {
    c.push({
      issue_type: "missing_meta_description",
      issue_severity: "notice",
      note: "Missing or empty meta description",
      typeRank: 40,
    });
  }

  if (c.length === 0) {
    return {
      issue_type: "healthy",
      issue_severity: "healthy",
      crawl_notes: "No issues detected for this page.",
    };
  }

  let best = c[0]!;
  for (const x of c.slice(1)) {
    const sr = SEVERITY_RANK[x.issue_severity];
    const br = SEVERITY_RANK[best.issue_severity];
    if (sr > br || (sr === br && x.typeRank > best.typeRank)) {
      best = x;
    }
  }

  const allNotes = c.map((x) => x.note).filter((n, i, a) => a.indexOf(n) === i);
  return {
    issue_type: best.issue_type,
    issue_severity: best.issue_severity,
    crawl_notes: allNotes.join("; "),
  };
}

export function classifySeoCrawlPageFromNormalizedRow(row: NormalizedCrawlRow): SeoCrawlPageClassification {
  return classifySeoCrawlPage({
    status: row.status,
    title: row.title,
    meta_description: row.metaDescription,
    h1: row.h1,
  });
}

export type SeoCrawlRunSummary = {
  healthy_count: number;
  notice_count: number;
  warning_count: number;
  critical_count: number;
  health_score: number;
};

export function summarizeSeoCrawlRun(
  pages: Array<Pick<SeoCrawlPageClassification, "issue_severity">>,
): Pick<SeoCrawlRunSummary, "healthy_count" | "notice_count" | "warning_count" | "critical_count"> {
  let healthy_count = 0;
  let notice_count = 0;
  let warning_count = 0;
  let critical_count = 0;
  for (const p of pages) {
    const s = p.issue_severity;
    if (s === "critical") critical_count += 1;
    else if (s === "warning") warning_count += 1;
    else if (s === "notice") notice_count += 1;
    else healthy_count += 1;
  }
  return { healthy_count, notice_count, warning_count, critical_count };
}

export function calculateSeoHealthScore(
  summary: Pick<SeoCrawlRunSummary, "critical_count" | "warning_count" | "notice_count">,
): number {
  const raw =
    100 -
    summary.critical_count * 15 -
    summary.warning_count * 7 -
    summary.notice_count * 2;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function buildSeoCrawlRunSummary(
  pages: SeoCrawlPageClassification[],
): SeoCrawlRunSummary {
  const counts = summarizeSeoCrawlRun(pages);
  return {
    ...counts,
    health_score: calculateSeoHealthScore(counts),
  };
}
