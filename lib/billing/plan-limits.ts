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
};

const FREE_UPTIME_SEC = 15 * 60;
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
    };
  }
  if (p === "committed" || p === "pro") {
    return {
      maxWebsites: 3,
      canUseSEO: true,
      canUseIntelligence: true,
      monitoringLevel: "advanced",
      monitoringEnabled: true,
      minUptimeIntervalSeconds: PAID_UPTIME_SEC,
    };
  }
  return getUserPlanLimits("free");
}
