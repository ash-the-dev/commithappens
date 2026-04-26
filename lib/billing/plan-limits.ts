/**
 * Central entitlements for plan gating. Use with `getBillingAccess` (effective tier from Stripe + defaults).
 * Aliases: `pro` → same limits as `committed` (this codebase uses `committed` in Stripe / DB).
 */
export type UserPlanLimits = {
  maxWebsites: number;
  canUseSEO: boolean;
  canUseIntelligence: boolean;
  canUseReputationPulse: boolean;
  showReputationPulseTeaser: boolean;
  reputationWatchTermLimit: number;
  reputationMentionsPerRun: number;
  reputationAiEnrichmentEnabled: boolean;
  monitoringLevel: "basic" | "advanced";
  /** Uptime and ingest monitoring allowed */
  monitoringEnabled: boolean;
  /** Minimum seconds between automated uptime runs for this tier */
  minUptimeIntervalSeconds: number;
  /** Null means unlimited SEO crawls for plans that include SEO. */
  maxSeoCrawlsPerSitePerWeek: number | null;
  /** Null means unlimited AI recommendation refreshes for plans that include recommendations. */
  maxRecommendationRunsPerSitePerWeek: number | null;
};

const FREE_UPTIME_SEC = 30 * 60;
const PAID_UPTIME_SEC = 5 * 60;

export type ReputationPulseLimits = Pick<
  UserPlanLimits,
  | "canUseReputationPulse"
  | "showReputationPulseTeaser"
  | "reputationWatchTermLimit"
  | "reputationMentionsPerRun"
  | "reputationAiEnrichmentEnabled"
>;

const REPUTATION_PULSE_LIMITS: Record<"free" | "situationship" | "committed" | "unlimited", ReputationPulseLimits> = {
  free: {
    canUseReputationPulse: false,
    showReputationPulseTeaser: false,
    reputationWatchTermLimit: 0,
    reputationMentionsPerRun: 0,
    reputationAiEnrichmentEnabled: false,
  },
  situationship: {
    canUseReputationPulse: false,
    showReputationPulseTeaser: true,
    reputationWatchTermLimit: 0,
    reputationMentionsPerRun: 0,
    reputationAiEnrichmentEnabled: false,
  },
  committed: {
    canUseReputationPulse: true,
    showReputationPulseTeaser: false,
    reputationWatchTermLimit: 3,
    reputationMentionsPerRun: 10,
    reputationAiEnrichmentEnabled: true,
  },
  unlimited: {
    canUseReputationPulse: true,
    showReputationPulseTeaser: false,
    reputationWatchTermLimit: 25,
    reputationMentionsPerRun: 50,
    reputationAiEnrichmentEnabled: true,
  },
};

function normalizePlan(plan: string): "free" | "situationship" | "committed" | "unlimited" {
  const p = plan.trim().toLowerCase();
  if (p === "situationship") return "situationship";
  if (p === "committed" || p === "pro") return "committed";
  if (p === "unlimited" || p === "all-in" || p === "all in") return "unlimited";
  return "free";
}

export function getReputationPulseLimits(plan: string): ReputationPulseLimits {
  return REPUTATION_PULSE_LIMITS[normalizePlan(plan)];
}

export function canUseReputationPulse(plan: string): boolean {
  return getReputationPulseLimits(plan).canUseReputationPulse;
}

export function getUserPlanLimits(plan: string): UserPlanLimits {
  const p = normalizePlan(plan);
  if (p === "free") {
    return {
      maxWebsites: 1,
      canUseSEO: false,
      canUseIntelligence: false,
      ...getReputationPulseLimits("free"),
      monitoringLevel: "basic",
      monitoringEnabled: true,
      minUptimeIntervalSeconds: FREE_UPTIME_SEC,
      maxSeoCrawlsPerSitePerWeek: 0,
      maxRecommendationRunsPerSitePerWeek: 0,
    };
  }
  if (p === "situationship") {
    return {
      maxWebsites: 1,
      canUseSEO: true,
      canUseIntelligence: true,
      ...getReputationPulseLimits("situationship"),
      monitoringLevel: "advanced",
      monitoringEnabled: true,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
      maxSeoCrawlsPerSitePerWeek: 1,
      maxRecommendationRunsPerSitePerWeek: 1,
    };
  }
  if (p === "committed") {
    return {
      maxWebsites: 3,
      canUseSEO: true,
      canUseIntelligence: true,
      ...getReputationPulseLimits("committed"),
      monitoringLevel: "advanced",
      monitoringEnabled: true,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
      maxSeoCrawlsPerSitePerWeek: 1,
      maxRecommendationRunsPerSitePerWeek: 1,
    };
  }
  if (p === "unlimited") {
    return {
      maxWebsites: 10,
      canUseSEO: true,
      canUseIntelligence: true,
      ...getReputationPulseLimits("unlimited"),
      monitoringLevel: "advanced",
      monitoringEnabled: true,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
      maxSeoCrawlsPerSitePerWeek: null,
      maxRecommendationRunsPerSitePerWeek: null,
    };
  }
  return getUserPlanLimits("free");
}
