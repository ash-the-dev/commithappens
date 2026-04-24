export type MonitoringPlan = "free" | "situationship" | "committed" | "agency";

/**
 * Default monitoring cadence (minutes) by plan.
 * Unknown values intentionally fall back to free-tier behavior.
 */
export function getPlanMonitoringFrequency(plan: string | null | undefined): number {
  const normalized = (plan ?? "free").trim().toLowerCase();
  switch (normalized) {
    case "agency":
      return 1;
    case "committed":
    case "pro":
      return 5;
    case "situationship":
      return 15;
    case "free":
    default:
      return 30;
  }
}

