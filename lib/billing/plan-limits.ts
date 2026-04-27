import {
  canUseFeature,
  getPlanEntitlements,
  getPlanLimit,
  normalizePlanTier,
  shouldShowFeature,
  type PlanInput,
} from "@/lib/entitlements";

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

export type ReputationPulseLimits = Pick<
  UserPlanLimits,
  | "canUseReputationPulse"
  | "showReputationPulseTeaser"
  | "reputationWatchTermLimit"
  | "reputationMentionsPerRun"
  | "reputationAiEnrichmentEnabled"
>;

export function getReputationPulseLimits(plan: PlanInput): ReputationPulseLimits {
  const entitlements = getPlanEntitlements(plan);
  return {
    canUseReputationPulse: canUseFeature(plan, "reputationPulse"),
    showReputationPulseTeaser: shouldShowFeature(plan, "reputationPulseTeaser"),
    reputationWatchTermLimit: getPlanLimit(plan, "reputationWatchTerms") ?? 0,
    reputationMentionsPerRun: getPlanLimit(plan, "reputationMentionsPerRun") ?? 0,
    reputationAiEnrichmentEnabled: entitlements.reputationAiEnrichmentEnabled,
  };
}

export function canUseReputationPulse(plan: PlanInput): boolean {
  return getReputationPulseLimits(plan).canUseReputationPulse;
}

function monthlyLimitAsWeeklyCompatibility(limit: number | null): number | null {
  return limit == null ? null : limit;
}

export function getUserPlanLimits(plan: PlanInput): UserPlanLimits {
  const tier = normalizePlanTier(plan);
  const entitlements = getPlanEntitlements(tier);
  return {
    maxWebsites: getPlanLimit(tier, "maxSites") ?? 0,
    canUseSEO: canUseFeature(tier, "seoCrawl"),
    canUseIntelligence: canUseFeature(tier, "dashboardIntelligence"),
    ...getReputationPulseLimits(tier),
    monitoringLevel: entitlements.monitoringLevel,
    monitoringEnabled: canUseFeature(tier, "uptimeMonitoring"),
    minUptimeIntervalSeconds: getPlanLimit(tier, "minUptimeIntervalSeconds") ?? 30 * 60,
    maxSeoCrawlsPerSitePerWeek: monthlyLimitAsWeeklyCompatibility(getPlanLimit(tier, "seoCrawlsPerMonth")),
    maxRecommendationRunsPerSitePerWeek: monthlyLimitAsWeeklyCompatibility(getPlanLimit(tier, "recommendationRunsPerMonth")),
  };
}
