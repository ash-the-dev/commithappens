export type PlanKey = "situationship" | "committed";

export type PlanEntitlements = {
  planKey: PlanKey;
  label: string;
  seoEnabled: boolean;
  maxSites: number;
};

export const BILLING_PLANS: Record<PlanKey, PlanEntitlements> = {
  situationship: {
    planKey: "situationship",
    label: "Situationship",
    seoEnabled: false,
    maxSites: 1,
  },
  committed: {
    planKey: "committed",
    label: "Committed",
    seoEnabled: true,
    maxSites: 3,
  },
};

export function resolvePlanKeyFromPriceId(priceId: string): PlanKey | null {
  const situationshipMonthly = process.env.STRIPE_PRICE_ID_SITUATIONSHIP_MONTHLY?.trim();
  const committedMonthly = process.env.STRIPE_PRICE_ID_COMMITTED_MONTHLY?.trim();

  if (priceId && situationshipMonthly && priceId === situationshipMonthly) return "situationship";
  if (priceId && committedMonthly && priceId === committedMonthly) return "committed";
  return null;
}

export function resolvePriceIdFromPlanKey(planKey: string): string | null {
  const key = planKey.trim().toLowerCase();
  if (key === "situationship") {
    return process.env.STRIPE_PRICE_ID_SITUATIONSHIP_MONTHLY?.trim() ?? null;
  }
  if (key === "committed") {
    return process.env.STRIPE_PRICE_ID_COMMITTED_MONTHLY?.trim() ?? null;
  }
  return null;
}

export function isPlanKey(value: string): value is PlanKey {
  return value === "situationship" || value === "committed";
}
