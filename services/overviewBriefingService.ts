import type { SiteIntelligenceState } from "@/services/siteStateService";

export type OverviewBriefing = {
  monitoringStatus: {
    status: "online" | "offline" | "unknown";
    title: string;
    description: string;
    lastUptimeCheck: string | null;
    lastSeoCrawl: string | null;
    frequencyMinutes: number | null;
    cta: string;
    href?: string;
  };
  priorityIssue: {
    severity: "low" | "medium" | "high" | "none";
    title: string;
    description: string;
    cta: string;
    href?: string;
  };
  siteMomentum: {
    trend: "better" | "stable" | "worse" | "unknown";
    title: string;
    description: string;
    cta: string;
    href?: string;
  };
  nextBestAction: {
    status: "low" | "medium" | "high" | "none";
    title: string;
    description: string;
    cta: string;
    href?: string;
  };
};

type BuildOverviewBriefingInput = {
  siteState: SiteIntelligenceState;
  seoEnabled: boolean;
  canUseReputationPulse: boolean;
  showReputationPulseTeaser: boolean;
};

function seoIssueTotal(input: BuildOverviewBriefingInput): number {
  const seo = input.siteState.seo.summary;
  if (!seo) return 0;
  return seo.broken_pages + seo.missing_meta + seo.performance_issues;
}

function buildMonitoringStatus(input: BuildOverviewBriefingInput): OverviewBriefing["monitoringStatus"] {
  const uptime = input.siteState.uptime;
  const seo = input.siteState.seo;
  const status = uptime.summary?.status ?? "unknown";
  if (status === "online") {
    return {
      status: "online",
      title: "Your site is alive and being watched.",
      description: seo.status === "ready"
        ? "Uptime checks are running, and the robots have a recent SEO opinion."
        : "Uptime checks are running. Run an SEO crawl to start building the search history.",
      lastUptimeCheck: uptime.completedAt,
      lastSeoCrawl: seo.completedAt,
      frequencyMinutes: null,
      cta: seo.status === "ready" ? "View monitoring" : "Run SEO crawl",
      href: seo.status === "ready" ? "#performance" : "#seo-crawl",
    };
  }

  if (status === "offline") {
    return {
      status: "offline",
      title: "Your site may be offline.",
      description: "The latest uptime check failed. Start here before polishing titles or arguing with meta descriptions.",
      lastUptimeCheck: uptime.completedAt,
      lastSeoCrawl: seo.completedAt,
      frequencyMinutes: null,
      cta: "Check uptime",
      href: "#performance",
    };
  }

  return {
    status: "unknown",
    title: "Monitoring starting.",
    description: seo.status === "ready"
      ? "SEO has checked in. Uptime is still collecting its first receipt."
      : "Run your first crawl and let uptime checks collect a few receipts.",
    lastUptimeCheck: uptime.completedAt,
    lastSeoCrawl: seo.completedAt,
    frequencyMinutes: null,
    cta: input.seoEnabled ? "Run first crawl" : "View setup",
    href: input.seoEnabled ? "#seo-crawl" : "#tracker-setup",
  };
}

function buildPriorityIssue(input: BuildOverviewBriefingInput): OverviewBriefing["priorityIssue"] {
  const uptime = input.siteState.uptime.summary;
  const seo = input.siteState.seo.summary;
  const reputation = input.siteState.reputation.summary;
  if (uptime?.status === "offline") {
    return {
      severity: "high",
      title: "Uptime check failed",
      description: "The site may be unreachable right now. Fix availability before everything else.",
      cta: "Check uptime",
      href: "#performance",
    };
  }

  if (seo && seo.broken_pages > 0) {
    return {
      severity: "high",
      title: "Broken pages need attention",
      description: `${seo.broken_pages} crawled page${seo.broken_pages === 1 ? "" : "s"} may be returning errors. Dead ends first, polish later.`,
      cta: "View fix plan",
      href: "#seo-crawl",
    };
  }

  if (reputation && reputation.flagged_mentions > 0) {
    return {
      severity: "medium",
      title: "Brand mention needs attention",
      description: `${reputation.flagged_mentions} reputation signal${reputation.flagged_mentions === 1 ? "" : "s"} look worth reviewing before they get stale.`,
      cta: "Open Reputation Pulse",
      href: "#reputation",
    };
  }

  if (seo && seo.missing_meta > 0) {
    return {
      severity: "medium",
      title: "Search previews need cleanup",
      description: `${seo.missing_meta} metadata issue${seo.missing_meta === 1 ? "" : "s"} can make good pages look forgettable in search.`,
      cta: "View SEO crawl",
      href: "#seo-crawl",
    };
  }

  if (!seo && input.seoEnabled) {
    return {
      severity: "none",
      title: "The robots have not formed an opinion yet.",
      description: "Run a crawl first. Then we can tell you what is actually worth fixing.",
      cta: "Run SEO crawl",
      href: "#seo-crawl",
    };
  }

  return {
    severity: "none",
    title: "No smoke yet.",
    description: "Nothing is screaming at the moment. Suspiciously peaceful, but we’ll keep sniffing.",
    cta: "Review dashboard",
    href: "#details",
  };
}

function buildSiteMomentum(input: BuildOverviewBriefingInput): OverviewBriefing["siteMomentum"] {
  const analytics = input.siteState.analytics.summary;
  if (analytics?.trend === "up") {
    return {
      trend: "better",
      title: "Traffic is climbing",
      description: `${analytics.traffic_24h} visit${analytics.traffic_24h === 1 ? "" : "s"} in the last 24 hours, and the short trend is up.`,
      cta: "View traffic",
      href: "#traffic",
    };
  }
  if (analytics?.trend === "down") {
    return {
      trend: "worse",
      title: "Traffic dipped",
      description: `${analytics.traffic_24h} visit${analytics.traffic_24h === 1 ? "" : "s"} in the last 24 hours, and the short trend is down.`,
      cta: "View traffic",
      href: "#traffic",
    };
  }
  if (analytics) {
    return {
      trend: "stable",
      title: "Traffic is steady",
      description: `${analytics.traffic_24h} visit${analytics.traffic_24h === 1 ? "" : "s"} in the last 24 hours. Boring can be beautiful.`,
      cta: "View traffic",
      href: "#traffic",
    };
  }

  return {
    trend: "unknown",
    title: "No history yet",
    description: "We’ll compare results after your next scan. One data point is a hunch, not a trend.",
    cta: input.seoEnabled ? "Run another check" : "View setup",
    href: input.seoEnabled ? "#seo-crawl" : "#tracker-setup",
  };
}

function buildNextBestAction(
  input: BuildOverviewBriefingInput,
  priorityIssue: OverviewBriefing["priorityIssue"],
): OverviewBriefing["nextBestAction"] {
  if (input.siteState.uptime.status === "missing") {
    return {
      status: "medium",
      title: "Let uptime collect receipts.",
      description: "The monitor exists, but we need a real check before calling the site healthy.",
      cta: "View uptime",
      href: "#performance",
    };
  }

  if (input.siteState.seo.status === "missing" && input.seoEnabled) {
    return {
      status: "medium",
      title: "Run your first SEO crawl.",
      description: "That unlocks broken pages, missing metadata, and the first real fix plan.",
      cta: "Run SEO crawl",
      href: "#seo-crawl",
    };
  }

  if (priorityIssue.severity === "high" || priorityIssue.severity === "medium") {
    return {
      status: priorityIssue.severity,
      title: "Fix the top issue first.",
      description: "Start with the item most likely to hurt visitors, search engines, or trust.",
      cta: priorityIssue.cta,
      href: priorityIssue.href,
    };
  }

  if (input.canUseReputationPulse && input.siteState.reputation.status === "missing") {
    return {
      status: "medium",
      title: "Set up Reputation Pulse.",
      description: "Add your brand or domain so we can watch what people say when you’re not in the room.",
      cta: "Add watch term",
      href: "#reputation",
    };
  }

  if (input.showReputationPulseTeaser) {
    return {
      status: "low",
      title: "Preview Reputation Pulse.",
      description: "Brand mentions are locked on this plan, but the teaser shows what gets monitored.",
      cta: "View teaser",
      href: "#reputation",
    };
  }

  if (input.siteState.analytics.summary?.traffic_24h === 0) {
    return {
      status: "medium",
      title: "Verify the tracker install.",
      description: "No traffic is showing yet. Either it’s quiet, or the script is still sitting in the parking lot.",
      cta: "View tracker setup",
      href: "#tracker-setup",
    };
  }

  return {
    status: "none",
    title: "Keep monitoring.",
    description: "No obvious fire right now. Refresh stats after meaningful traffic or your next crawl.",
    cta: "Review activity",
    href: "#traffic",
  };
}

export function buildOverviewBriefing(input: BuildOverviewBriefingInput): OverviewBriefing {
  const monitoringStatus = buildMonitoringStatus(input);
  const priorityIssue = buildPriorityIssue(input);
  const siteMomentum = buildSiteMomentum(input);
  const nextBestAction = buildNextBestAction(input, priorityIssue);

  return {
    monitoringStatus,
    priorityIssue,
    siteMomentum,
    nextBestAction,
  };
}
