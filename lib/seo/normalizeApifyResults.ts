import {
  enrichResults,
  type EnrichedIssueSeverity,
  type EnrichedResults,
} from "@/lib/seo/enrichResults";
import type { SeoRecommendationsOutput } from "@/lib/ai/seoRecommendations";

export type SeoIssueSeverity = "critical" | "high" | "medium" | "low" | "info";
export type SeoImpactArea = string;

export type NormalizedSeoIssue = {
  type: string;
  severity: SeoIssueSeverity;
  title: string;
  description: string;
  recommendation: string;
  plainMeaning: string;
  whyItMatters: string;
  recommendedFix: string;
  priorityLabel: string;
  effort: string;
  url: string | null;
  impactArea: SeoImpactArea;
  ownerHint: string;
};

export type NormalizedSeoPage = {
  url: string;
  statusCode: number | null;
  title: string | null;
  titleLength: number | null;
  metaDescription: string | null;
  metaDescriptionLength: number | null;
  h1s: string[];
  h1Count: number;
  canonicalUrl: string | null;
  isIndexable: boolean | null;
  internalLinks: string[];
  externalLinks: string[];
  brokenLinks: string[];
  issues: NormalizedSeoIssue[];
  warnings: NormalizedSeoIssue[];
  opportunities: NormalizedSeoIssue[];
  aiRecommendations: SeoRecommendationsOutput | null;
  score: number;
  raw: unknown;
};

export type NormalizedApifySeoResults = {
  summary: {
    totalPages: number;
    scannedPages: number;
    successfulPages: number;
    errorPages: number;
    redirectPages: number;
    averageTitleLength: number;
    averageDescriptionLength: number;
    missingTitleCount: number;
    missingDescriptionCount: number;
    duplicateTitleCount: number;
    duplicateDescriptionCount: number;
    missingH1Count: number;
    multipleH1Count: number;
    brokenInternalLinksCount: number;
    externalLinksCount: number;
    internalLinksCount: number;
    canonicalIssuesCount: number;
    noindexPagesCount: number;
    largePageCount: number;
    score: number;
    healthyPages: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    duplicateMetaCount: number;
  };
  pages: NormalizedSeoPage[];
  issues: NormalizedSeoIssue[];
  topIssues: Array<NormalizedSeoIssue & { frequency: number }>;
};

function issueSeverity(severity: EnrichedIssueSeverity): SeoIssueSeverity {
  return severity;
}

export function normalizeEnrichedResults(enriched: EnrichedResults): NormalizedApifySeoResults {
  const pages: NormalizedSeoPage[] = enriched.pages.map((page) => {
    const issues = page.issues.map((item) => ({
      ...item,
      severity: issueSeverity(item.severity),
    }));

    return {
      url: page.url,
      statusCode: page.status,
      title: page.title,
      titleLength: page.titleLength,
      metaDescription: page.metaDescription,
      metaDescriptionLength: page.metaDescriptionLength,
      h1s: page.h1,
      h1Count: page.h1Count,
      canonicalUrl: null,
      isIndexable: null,
      internalLinks: Array.from({ length: page.linksCount }, (_, index) => `link-${index + 1}`),
      externalLinks: [],
      brokenLinks: [],
      issues: issues.filter((item) => item.severity === "critical" || item.severity === "high"),
      warnings: issues.filter((item) => item.severity === "medium"),
      opportunities: issues.filter((item) => item.severity === "low" || item.severity === "info"),
      aiRecommendations: page.aiRecommendations,
      score: page.score,
      raw: page.raw,
    };
  });
  const issues = pages.flatMap((page) => [...page.issues, ...page.warnings, ...page.opportunities]);

  return {
    pages,
    issues,
    topIssues: enriched.topIssues.map((item) => ({
      ...item,
      severity: issueSeverity(item.severity),
    })),
    summary: {
      totalPages: enriched.summary.totalPages,
      scannedPages: enriched.summary.totalPages,
      successfulPages: pages.filter((page) => page.statusCode != null && page.statusCode >= 200 && page.statusCode < 300).length,
      errorPages: pages.filter((page) => page.statusCode != null && page.statusCode >= 400).length,
      redirectPages: pages.filter((page) => page.statusCode != null && page.statusCode >= 300 && page.statusCode < 400).length,
      averageTitleLength: enriched.summary.averageTitleLength,
      averageDescriptionLength: enriched.summary.averageDescriptionLength,
      missingTitleCount: issues.filter((item) => item.type === "missing_title").length,
      missingDescriptionCount: issues.filter((item) => item.type === "missing_meta_description").length,
      duplicateTitleCount: enriched.summary.duplicateTitleCount,
      duplicateDescriptionCount: enriched.summary.duplicateMetaCount,
      missingH1Count: enriched.summary.missingH1Count,
      multipleH1Count: issues.filter((item) => item.type === "multiple_h1").length,
      brokenInternalLinksCount: 0,
      externalLinksCount: 0,
      internalLinksCount: enriched.pages.reduce((sum, page) => sum + page.linksCount, 0),
      canonicalIssuesCount: 0,
      noindexPagesCount: 0,
      largePageCount: 0,
      score: enriched.summary.score,
      healthyPages: enriched.summary.healthyPages,
      criticalIssues: enriched.summary.criticalIssues,
      highIssues: enriched.summary.highIssues,
      mediumIssues: enriched.summary.mediumIssues,
      lowIssues: enriched.summary.lowIssues,
      duplicateMetaCount: enriched.summary.duplicateMetaCount,
    },
  };
}

export function normalizeApifyResults(items: unknown[]): NormalizedApifySeoResults {
  const enriched = enrichResults(items);
  return normalizeEnrichedResults(enriched);
}
