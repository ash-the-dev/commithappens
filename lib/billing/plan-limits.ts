/**
 * Central entitlements for plan gating. Use with `getBillingAccess` (effective tier from Stripe + defaults).
 * Aliases: `pro` → same limits as `committed` (this codebase uses `committed` in Stripe / DB).
 */
export type UserPlanLimits = {
  maxWebsites: number;
  canUseSEO: boolean;
  canUseIntelligence: boolean;
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

export function getUserPlanLimits(plan: string): UserPlanLimits {
  const p = plan.trim().toLowerCase();
  if (p === "free") {
    return {
      maxWebsites: 1,
      canUseSEO: false,
      canUseIntelligence: false,
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
      canUseSEO: false,
      canUseIntelligence: true,
      monitoringLevel: "advanced",
      monitoringEnabled: true,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
      maxSeoCrawlsPerSitePerWeek: 0,
      maxRecommendationRunsPerSitePerWeek: 0,
    };
  }
  if (p === "committed" || p === "pro") {
    return {
      maxWebsites: 5,
      canUseSEO: true,
      canUseIntelligence: true,
      monitoringLevel: "advanced",
      monitoringEnabled: true,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
      maxSeoCrawlsPerSitePerWeek: 1,
      maxRecommendationRunsPerSitePerWeek: 1,
    };
  }
  if (p === "unlimited" || p === "all-in" || p === "all in") {
    return {
      maxWebsites: 25,
      canUseSEO: true,
      canUseIntelligence: true,
      monitoringLevel: "advanced",
      monitoringEnabled: true,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
      maxSeoCrawlsPerSitePerWeek: null,
      maxRecommendationRunsPerSitePerWeek: null,
    };
  }
  return getUserPlanLimits("free");
}
