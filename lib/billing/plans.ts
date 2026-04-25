export type PlanKey = "situationship" | "committed" | "unlimited";

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
    maxSites: 5,
  },
  unlimited: {
    planKey: "unlimited",
    label: "All In",
    seoEnabled: true,
    maxSites: 25,
  },
};

export function resolvePlanKeyFromPriceId(priceId: string): PlanKey | null {
  const situationshipMonthly = process.env.STRIPE_PRICE_ID_SITUATIONSHIP_MONTHLY?.trim();
  const committedMonthly = process.env.STRIPE_PRICE_ID_COMMITTED_MONTHLY?.trim();
  const allInMonthly = process.env.STRIPE_PRICE_ID_ALL_IN_MONTHLY?.trim();

  if (priceId && situationshipMonthly && priceId === situationshipMonthly) return "situationship";
  if (priceId && committedMonthly && priceId === committedMonthly) return "committed";
  if (priceId && allInMonthly && priceId === allInMonthly) return "unlimited";
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
  if (key === "unlimited" || key === "all-in" || key === "all in") {
    return process.env.STRIPE_PRICE_ID_ALL_IN_MONTHLY?.trim() ?? null;
  }
  return null;
}

export function isPlanKey(value: string): value is PlanKey {
  return value === "situationship" || value === "committed" || value === "unlimited";
}
