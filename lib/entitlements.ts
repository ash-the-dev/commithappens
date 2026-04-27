export type PlanTier = "free" | "situationship" | "committed" | "all_in";
export type PlanInput = PlanTier | "unlimited" | "all-in" | "all in" | "pro" | string | null | undefined;

export type FeatureKey =
  | "uptimeMonitoring"
  | "analytics"
  | "seoCrawl"
  | "reputationPulse"
  | "reputationPulseTeaser"
  | "aiInsights"
  | "dashboardIntelligence"
  | "competitorTracking"
  | "whiteLabelReports";

export type LimitKey =
  | "maxSites"
  | "seoCrawlsPerMonth"
  | "seoCrawlCooldownHours"
  | "recommendationRunsPerMonth"
  | "reputationWatchTerms"
  | "reputationMentionsPerRun"
  | "minUptimeIntervalSeconds";

type FeaturePolicy = {
  enabled: boolean;
  visible: boolean;
  upgradeMessage?: string;
};

export type PlanEntitlements = {
  key: PlanTier;
  legacyKey: "free" | "situationship" | "committed" | "unlimited";
  label: string;
  limits: Record<LimitKey, number | null>;
  features: Record<FeatureKey, FeaturePolicy>;
  reputationAiEnrichmentEnabled: boolean;
  monitoringLevel: "basic" | "advanced";
};

const FREE_UPTIME_SEC = 30 * 60;
const PAID_UPTIME_SEC = 5 * 60;

const upgradeMessages: Record<FeatureKey, string> = {
  uptimeMonitoring: "Uptime monitoring is available on every plan.",
  analytics: "Analytics unlocks on Situationship and above. The tracker is ready when you are.",
  seoCrawl: "SEO Crawl unlocks on Situationship and above. The robots need a paid seat.",
  reputationPulse: "Upgrade to Committed to monitor your brand mentions.",
  reputationPulseTeaser: "Upgrade to Committed to monitor your brand mentions.",
  aiInsights: "AI insights unlock on Situationship and above.",
  dashboardIntelligence: "Dashboard intelligence unlocks on Situationship and above.",
  competitorTracking: "Competitor tracking is included on All In.",
  whiteLabelReports: "White-label reports are included on All In.",
};

function feature(enabled: boolean, visible = enabled, featureKey?: FeatureKey): FeaturePolicy {
  return {
    enabled,
    visible,
    upgradeMessage: featureKey ? upgradeMessages[featureKey] : undefined,
  };
}

export const PLAN_ENTITLEMENTS: Record<PlanTier, PlanEntitlements> = {
  free: {
    key: "free",
    legacyKey: "free",
    label: "Free",
    limits: {
      maxSites: 1,
      seoCrawlsPerMonth: 0,
      seoCrawlCooldownHours: null,
      recommendationRunsPerMonth: 0,
      reputationWatchTerms: 0,
      reputationMentionsPerRun: 0,
      minUptimeIntervalSeconds: FREE_UPTIME_SEC,
    },
    features: {
      uptimeMonitoring: feature(true, true, "uptimeMonitoring"),
      analytics: feature(false, false, "analytics"),
      seoCrawl: feature(false, false, "seoCrawl"),
      reputationPulse: feature(false, false, "reputationPulse"),
      reputationPulseTeaser: feature(false, false, "reputationPulseTeaser"),
      aiInsights: feature(false, false, "aiInsights"),
      dashboardIntelligence: feature(false, false, "dashboardIntelligence"),
      competitorTracking: feature(false, false, "competitorTracking"),
      whiteLabelReports: feature(false, false, "whiteLabelReports"),
    },
    reputationAiEnrichmentEnabled: false,
    monitoringLevel: "basic",
  },
  situationship: {
    key: "situationship",
    legacyKey: "situationship",
    label: "Situationship",
    limits: {
      maxSites: 1,
      seoCrawlsPerMonth: 1,
      seoCrawlCooldownHours: 24 * 30,
      recommendationRunsPerMonth: 1,
      reputationWatchTerms: 0,
      reputationMentionsPerRun: 0,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
    },
    features: {
      uptimeMonitoring: feature(true, true, "uptimeMonitoring"),
      analytics: feature(true, true, "analytics"),
      seoCrawl: feature(true, true, "seoCrawl"),
      reputationPulse: feature(false, false, "reputationPulse"),
      reputationPulseTeaser: feature(false, true, "reputationPulseTeaser"),
      aiInsights: feature(true, true, "aiInsights"),
      dashboardIntelligence: feature(true, true, "dashboardIntelligence"),
      competitorTracking: feature(false, false, "competitorTracking"),
      whiteLabelReports: feature(false, false, "whiteLabelReports"),
    },
    reputationAiEnrichmentEnabled: false,
    monitoringLevel: "advanced",
  },
  committed: {
    key: "committed",
    legacyKey: "committed",
    label: "Committed",
    limits: {
      maxSites: 3,
      seoCrawlsPerMonth: 4,
      seoCrawlCooldownHours: 24 * 7,
      recommendationRunsPerMonth: 10,
      reputationWatchTerms: 3,
      reputationMentionsPerRun: 10,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
    },
    features: {
      uptimeMonitoring: feature(true, true, "uptimeMonitoring"),
      analytics: feature(true, true, "analytics"),
      seoCrawl: feature(true, true, "seoCrawl"),
      reputationPulse: feature(true, true, "reputationPulse"),
      reputationPulseTeaser: feature(false, false, "reputationPulseTeaser"),
      aiInsights: feature(true, true, "aiInsights"),
      dashboardIntelligence: feature(true, true, "dashboardIntelligence"),
      competitorTracking: feature(false, false, "competitorTracking"),
      whiteLabelReports: feature(false, false, "whiteLabelReports"),
    },
    reputationAiEnrichmentEnabled: true,
    monitoringLevel: "advanced",
  },
  all_in: {
    key: "all_in",
    legacyKey: "unlimited",
    label: "All In",
    limits: {
      maxSites: 10,
      seoCrawlsPerMonth: 30,
      seoCrawlCooldownHours: 24,
      recommendationRunsPerMonth: 50,
      reputationWatchTerms: 10,
      reputationMentionsPerRun: 50,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
    },
    features: {
      uptimeMonitoring: feature(true, true, "uptimeMonitoring"),
      analytics: feature(true, true, "analytics"),
      seoCrawl: feature(true, true, "seoCrawl"),
      reputationPulse: feature(true, true, "reputationPulse"),
      reputationPulseTeaser: feature(false, false, "reputationPulseTeaser"),
      aiInsights: feature(true, true, "aiInsights"),
      dashboardIntelligence: feature(true, true, "dashboardIntelligence"),
      competitorTracking: feature(true, true, "competitorTracking"),
      whiteLabelReports: feature(true, true, "whiteLabelReports"),
    },
    reputationAiEnrichmentEnabled: true,
    monitoringLevel: "advanced",
  },
};

export function normalizePlanTier(plan: PlanInput): PlanTier {
  const value = (plan ?? "free").trim().toLowerCase();
  if (value === "situationship") return "situationship";
  if (value === "committed" || value === "pro") return "committed";
  if (value === "all_in" || value === "all-in" || value === "all in" || value === "unlimited") return "all_in";
  return "free";
}

export function getPlanEntitlements(plan: PlanInput): PlanEntitlements {
  return PLAN_ENTITLEMENTS[normalizePlanTier(plan)];
}

export function canUseFeature(plan: PlanInput, featureKey: FeatureKey): boolean {
  return getPlanEntitlements(plan).features[featureKey].enabled;
}

export function shouldShowFeature(plan: PlanInput, featureKey: FeatureKey): boolean {
  return getPlanEntitlements(plan).features[featureKey].visible;
}

export function getPlanLimit(plan: PlanInput, limitKey: LimitKey): number | null {
  return getPlanEntitlements(plan).limits[limitKey];
}

export function getUpgradeMessage(featureKey: FeatureKey): string {
  return upgradeMessages[featureKey];
}

export function requireFeature(
  plan: PlanInput,
  featureKey: FeatureKey,
): { ok: true } | { ok: false; status: 403; code: "UPGRADE_REQUIRED"; message: string } {
  if (canUseFeature(plan, featureKey)) return { ok: true };
  return {
    ok: false,
    status: 403,
    code: "UPGRADE_REQUIRED",
    message: getUpgradeMessage(featureKey),
  };
}
