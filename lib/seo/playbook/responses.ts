export type SeoPlaybookSeverity = "critical" | "warning" | "info" | "healthy";

export type SeoPlaybookIssueKey =
  | "404"
  | "5xx"
  | "redirects"
  | "missing_titles"
  | "missing_meta"
  | "missing_h1"
  | "thin_content"
  | "duplicate_content"
  | "unknown_crawl_issues"
  | "healthy_pages"
  | "regression"
  | "improvement";

export type SeoPlaybookResponse = {
  title: string;
  playfulMessage: string;
  whyItMatters: string;
  actionableFixSteps: string[];
  severity: SeoPlaybookSeverity;
};

export const SEO_RESPONSE_PLAYBOOK: Record<SeoPlaybookIssueKey, SeoPlaybookResponse> = {
  "404": {
    title: "Broken pages (404/4xx)",
    playfulMessage: "This page is sending search engines into a dead end.",
    whyItMatters:
      "Broken pages waste crawl budget, frustrate visitors, and weaken the value of internal links pointing to them.",
    actionableFixSteps: [
      "Redirect old URLs to the closest relevant live page using 301 redirects.",
      "Update internal links and nav items that still point to broken URLs.",
      "For intentionally removed pages, return 410 only when there is no replacement.",
    ],
    severity: "warning",
  },
  "5xx": {
    title: "Server errors (5xx)",
    playfulMessage: "The server tripped over its own shoelaces.",
    whyItMatters:
      "Persistent 5xx responses can stop indexing and signal reliability problems to search engines and users.",
    actionableFixSteps: [
      "Inspect application and hosting logs for the exact failing URLs.",
      "Fix route/controller/runtime failures and dependency timeouts.",
      "Re-crawl the affected URLs until they consistently return 200 or intentional 3xx.",
    ],
    severity: "critical",
  },
  redirects: {
    title: "Redirect load (3xx)",
    playfulMessage: "This redirect chain is doing cardio for no reason.",
    whyItMatters:
      "Extra redirects create latency and reduce crawl efficiency, especially when chains or loops are involved.",
    actionableFixSteps: [
      "Update internal links to point directly at final canonical URLs.",
      "Collapse multi-hop redirect chains into a single hop.",
      "Keep canonical, sitemap, and internal-link targets aligned.",
    ],
    severity: "info",
  },
  missing_titles: {
    title: "Missing title tags",
    playfulMessage: "Search engines are squinting at pages with no headline tag.",
    whyItMatters:
      "Title tags are a primary relevance and click-through signal in search results.",
    actionableFixSteps: [
      "Add a unique title tag for every indexable page.",
      "Keep titles specific to the page intent and avoid duplication.",
      "Aim for concise, descriptive titles that match on-page content.",
    ],
    severity: "warning",
  },
  missing_meta: {
    title: "Missing meta descriptions",
    playfulMessage: "You left the movie trailer blank.",
    whyItMatters:
      "Meta descriptions can influence click-through rate even when they are not a direct ranking factor.",
    actionableFixSteps: [
      "Write unique meta descriptions for important indexable pages.",
      "Summarize the page value clearly in one short sentence.",
      "Avoid duplicate descriptions across templates.",
    ],
    severity: "info",
  },
  missing_h1: {
    title: "Missing H1 headings",
    playfulMessage: "The page forgot to introduce itself.",
    whyItMatters:
      "An H1 helps clarify the primary topic for both users and crawlers.",
    actionableFixSteps: [
      "Ensure each key page has one clear, visible H1.",
      "Align H1 wording with the page intent and title tag.",
      "Avoid multiple competing H1s that dilute the page focus.",
    ],
    severity: "info",
  },
  thin_content: {
    title: "Thin content",
    playfulMessage: "This page showed up to the interview with one sentence.",
    whyItMatters:
      "Thin pages often underperform because they provide weak topical depth and user value.",
    actionableFixSteps: [
      "Expand content to answer the main user intent comprehensively.",
      "Add supporting sections, examples, or FAQs where relevant.",
      "Consolidate very similar thin pages when appropriate.",
    ],
    severity: "warning",
  },
  duplicate_content: {
    title: "Duplicate content",
    playfulMessage: "Search engines found twins and are not sure who leads.",
    whyItMatters:
      "Duplicate pages dilute ranking signals and can create index selection ambiguity.",
    actionableFixSteps: [
      "Choose canonical URLs for similar pages and enforce canonical tags.",
      "Merge or redirect near-duplicate pages when possible.",
      "Standardize URL parameters and indexing rules for repeated variants.",
    ],
    severity: "warning",
  },
  unknown_crawl_issues: {
    title: "Unknown crawl issues",
    playfulMessage: "A few pages picked up SEO lint we cannot classify yet.",
    whyItMatters:
      "Unknown responses hide root causes and make prioritization less reliable.",
    actionableFixSteps: [
      "Review crawler logs for blocked, timed-out, or malformed responses.",
      "Verify robots rules, auth/session behavior, and network constraints.",
      "Re-run crawl with consistent settings to confirm reproducibility.",
    ],
    severity: "info",
  },
  healthy_pages: {
    title: "Healthy pages",
    playfulMessage: "No drama here. These pages are behaving.",
    whyItMatters:
      "Stable 200 responses give search engines clear, trustworthy signals.",
    actionableFixSteps: [
      "Keep monitoring for regressions after deploys and content releases.",
      "Maintain direct internal linking to canonical 200 URLs.",
      "Use this set as a baseline when debugging future crawl changes.",
    ],
    severity: "healthy",
  },
  regression: {
    title: "Regression detected",
    playfulMessage: "A few pages wandered off the happy path.",
    whyItMatters:
      "Regressions indicate quality drift and can quickly impact visibility if left unresolved.",
    actionableFixSteps: [
      "Prioritize newly introduced 5xx and 4xx issues first.",
      "Compare changed templates, routing, and content deploys since last crawl.",
      "Validate fixes with a targeted re-crawl before closing the incident.",
    ],
    severity: "critical",
  },
  improvement: {
    title: "Improvement detected",
    playfulMessage: "Signals are cleaner than last run. Nice work.",
    whyItMatters:
      "Sustained improvements increase crawl efficiency and reduce indexation risk.",
    actionableFixSteps: [
      "Preserve the changes that improved response quality.",
      "Document what moved the metric so the win is repeatable.",
      "Shift effort to the next highest-impact issue bucket.",
    ],
    severity: "healthy",
  },
};

export function getSeoPlaybookResponse(key: SeoPlaybookIssueKey): SeoPlaybookResponse {
  return SEO_RESPONSE_PLAYBOOK[key];
}
