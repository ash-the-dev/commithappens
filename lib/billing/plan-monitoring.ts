import { getPlanLimit } from "@/lib/entitlements";

export type MonitoringPlan = "free" | "situationship" | "committed" | "unlimited" | "agency";

/**
 * Default monitoring cadence (minutes) by plan.
 * Unknown values intentionally fall back to free-tier behavior.
 */
export function getPlanMonitoringFrequency(plan: string | null | undefined): number {
  return Math.max(1, Math.round((getPlanLimit(plan, "minUptimeIntervalSeconds") ?? 30 * 60) / 60));
}

