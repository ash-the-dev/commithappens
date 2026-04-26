import {
  getSeoRecommendation,
  type SeoEffort,
  type SeoPriorityLabel,
} from "@/lib/seo/recommendationCopy";
import {
  generateSeoRecommendations,
  type SeoRecommendationsOutput,
} from "@/lib/ai/seoRecommendations";

export type EnrichedIssueSeverity = "critical" | "high" | "medium" | "low";
export type EnrichedImpactArea = string;

export type EnrichedIssue = {
  type: string;
  severity: EnrichedIssueSeverity;
  title: string;
  description: string;
  recommendation: string;
  plainMeaning: string;
  whyItMatters: string;
  recommendedFix: string;
  priorityLabel: SeoPriorityLabel;
  effort: SeoEffort;
  url: string;
  impactArea: EnrichedImpactArea;
  ownerHint: string;
};

export type EnrichedTopIssue = EnrichedIssue & {
  frequency: number;
};

export type EnrichedPage = {
  url: string;
  status: number | null;
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaDescriptionLength: number | null;
  h1: string[];
  h1Count: number;
  linksCount: number;
  issues: EnrichedIssue[];
  aiRecommendations: SeoRecommendationsOutput | null;
  score: number;
  raw: unknown;
};

export type EnrichedResults = {
  summary: {
    totalPages: number;
    healthyPages: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    missingH1Count: number;
    duplicateTitleCount: number;
    duplicateMetaCount: number;
    averageTitleLength: number;
    averageDescriptionLength: number;
    score: number;
  };
  pages: EnrichedPage[];
  issues: EnrichedIssue[];
  topIssues: EnrichedTopIssue[];
};

type PageSeed = {
  url: string;
  status: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  linksCount: number;
  raw: unknown;
};

const severityRank: Record<EnrichedIssueSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const AI_RECOMMENDATION_PAGE_LIMIT = 5;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function textArray(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      const row = record(item);
      return text(row.text) ?? text(row.value) ?? text(row.heading);
    })
    .filter((item): item is string => Boolean(item));
}

function linksCount(value: unknown): number {
  const numeric = numberValue(value);
  if (numeric != null) return Math.max(0, numeric);
  if (Array.isArray(value)) return value.length;
  const row = record(value);
  const length = numberValue(row.length) ?? numberValue(row.count);
  return length != null ? Math.max(0, length) : 0;
}

function countByNormalizedValue(values: Array<string | null>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value?.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function addIssue(
  issues: EnrichedIssue[],
  input: Pick<EnrichedIssue, "type" | "severity" | "url">,
): void {
  const copy = getSeoRecommendation(input.type, input);
  issues.push({
    type: input.type,
    severity: input.severity,
    title: copy.title,
    description: copy.plainMeaning,
    recommendation: copy.recommendedFix,
    plainMeaning: copy.plainMeaning,
    whyItMatters: copy.whyItMatters,
    recommendedFix: copy.recommendedFix,
    priorityLabel: copy.priorityLabel,
    effort: copy.effort,
    url: input.url,
    impactArea: copy.impactArea,
    ownerHint: copy.ownerHint,
  });
}

function scorePage(issues: EnrichedIssue[]): number {
  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === "critical") return sum + 20;
    if (issue.severity === "high") return sum + 15;
    if (issue.severity === "medium") return sum + 8;
    return sum + 3;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeSeed(item: unknown): PageSeed | null {
  const row = record(item);
  const url = text(row.url);
  if (!url) return null;
  const h1 = textArray(row.h1);
  return {
    url,
    status: numberValue(row.status),
    title: text(row.title),
    metaDescription: text(row.metaDescription),
    h1,
    linksCount: linksCount(row.links),
    raw: item,
  };
}

function buildTopIssues(issues: EnrichedIssue[]): EnrichedTopIssue[] {
  const grouped = new Map<string, EnrichedTopIssue>();
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.type}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.frequency += 1;
    } else {
      grouped.set(key, { ...issue, frequency: 1 });
    }
  }

  return [...grouped.values()]
    .sort((a, b) => {
      const severityDiff = severityRank[b.severity] - severityRank[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.frequency - a.frequency;
    })
    .slice(0, 5);
}

function aiCandidateScore(page: EnrichedPage): number {
  const issueWeight = page.issues.reduce((sum, issue) => sum + severityRank[issue.severity], 0);
  const statusWeight = page.status != null && page.status >= 400 ? 10 : 0;
  return issueWeight + statusWeight + (100 - page.score) / 20;
}

function topPagesForAi(pages: EnrichedPage[]): EnrichedPage[] {
  return [...pages]
    .filter((page) => page.issues.length > 0 || (page.status != null && page.status >= 400))
    .sort((a, b) => aiCandidateScore(b) - aiCandidateScore(a))
    .slice(0, AI_RECOMMENDATION_PAGE_LIMIT);
}

export function enrichResults(items: unknown[]): EnrichedResults {
  const seeds = items.map(normalizeSeed).filter((item): item is PageSeed => item != null);
  const titleCounts = countByNormalizedValue(seeds.map((page) => page.title));
  const metaCounts = countByNormalizedValue(seeds.map((page) => page.metaDescription));

  const pages = seeds.map<EnrichedPage>((page) => {
    const issues: EnrichedIssue[] = [];
    const titleLength = page.title?.length ?? null;
    const metaDescriptionLength = page.metaDescription?.length ?? null;

    if (page.status != null && page.status >= 400) {
      addIssue(issues, {
        type: "broken_page",
        severity: "critical",
        url: page.url,
      });
    }

    if (!page.title) {
      addIssue(issues, {
        type: "missing_title",
        severity: "high",
        url: page.url,
      });
    } else {
      if (titleLength != null && titleLength < 30) {
        addIssue(issues, {
          type: "short_title",
          severity: "medium",
          url: page.url,
        });
      }
      if (titleLength != null && titleLength > 60) {
        addIssue(issues, {
          type: "long_title",
          severity: "medium",
          url: page.url,
        });
      }
      if ((titleCounts.get(page.title.trim().toLowerCase()) ?? 0) > 1) {
        addIssue(issues, {
          type: "duplicate_title",
          severity: "medium",
          url: page.url,
        });
      }
    }

    if (!page.metaDescription) {
      addIssue(issues, {
        type: "missing_meta_description",
        severity: "high",
        url: page.url,
      });
    } else {
      if (metaDescriptionLength != null && metaDescriptionLength < 70) {
        addIssue(issues, {
          type: "short_meta_description",
          severity: "medium",
          url: page.url,
        });
      }
      if (metaDescriptionLength != null && metaDescriptionLength > 160) {
        addIssue(issues, {
          type: "long_meta_description",
          severity: "medium",
          url: page.url,
        });
      }
      if ((metaCounts.get(page.metaDescription.trim().toLowerCase()) ?? 0) > 1) {
        addIssue(issues, {
          type: "duplicate_meta_description",
          severity: "medium",
          url: page.url,
        });
      }
    }

    if (page.h1.length === 0) {
      addIssue(issues, {
        type: "missing_h1",
        severity: "high",
        url: page.url,
      });
    }
    if (page.h1.length > 1) {
      addIssue(issues, {
        type: "multiple_h1",
        severity: "medium",
        url: page.url,
      });
    }

    if (page.linksCount < 5) {
      addIssue(issues, {
        type: "weak_internal_linking",
        severity: "medium",
        url: page.url,
      });
    }
    if (page.linksCount > 100) {
      addIssue(issues, {
        type: "excessive_links",
        severity: "low",
        url: page.url,
      });
    }

    return {
      url: page.url,
      status: page.status,
      title: page.title,
      titleLength,
      metaDescription: page.metaDescription,
      metaDescriptionLength,
      h1: page.h1,
      h1Count: page.h1.length,
      linksCount: page.linksCount,
      issues,
      aiRecommendations: null,
      score: scorePage(issues),
      raw: page.raw,
    };
  });

  const issues = pages.flatMap((page) => page.issues);
  const criticalIssues = issues.filter((issue) => issue.severity === "critical").length;
  const highIssues = issues.filter((issue) => issue.severity === "high").length;
  const mediumIssues = issues.filter((issue) => issue.severity === "medium").length;
  const lowIssues = issues.filter((issue) => issue.severity === "low").length;
  const score = average(pages.map((page) => page.score));

  return {
    summary: {
      totalPages: pages.length,
      healthyPages: pages.filter((page) => page.issues.length === 0).length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      missingH1Count: issues.filter((issue) => issue.type === "missing_h1").length,
      duplicateTitleCount: issues.filter((issue) => issue.type === "duplicate_title").length,
      duplicateMetaCount: issues.filter((issue) => issue.type === "duplicate_meta_description").length,
      averageTitleLength: average(pages.map((page) => page.titleLength ?? 0).filter((value) => value > 0)),
      averageDescriptionLength: average(
        pages.map((page) => page.metaDescriptionLength ?? 0).filter((value) => value > 0),
      ),
      score,
    },
    pages,
    issues,
    topIssues: buildTopIssues(issues),
  };
}

export async function enrichResultsWithAi(items: unknown[]): Promise<EnrichedResults> {
  const enriched = enrichResults(items);
  const candidates = topPagesForAi(enriched.pages);
  if (candidates.length === 0) {
    return enriched;
  }

  await Promise.all(
    candidates.map(async (page) => {
      const aiRecommendations = await generateSeoRecommendations({
        pageUrl: page.url,
        title: page.title,
        metaDescription: page.metaDescription,
        h1: page.h1[0] ?? null,
        statusCode: page.status,
        internalLinksCount: page.linksCount,
        detectedIssues: page.issues.map((issue) => `${issue.severity}: ${issue.title}`),
      });
      page.aiRecommendations = aiRecommendations;
    }),
  );

  return enriched;
}
