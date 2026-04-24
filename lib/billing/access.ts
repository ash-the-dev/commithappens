import { getUserSubscription, type UserSubscription } from "@/lib/db/subscriptions";
import { getUserPlanLimits, type UserPlanLimits } from "@/lib/billing/plan-limits";
import type { PlanKey } from "@/lib/billing/plans";

const ENABLED_STATUSES = new Set(["trialing", "active", "past_due"]);
const ADMIN_BYPASS_EMAILS = new Set(["ashthedev0@gmail.com"]);

export type AccountKind = "free" | "situationship" | "committed";

export type BillingEntitlements = UserPlanLimits & {
  planKey: PlanKey | null;
  accountKind: AccountKind;
  /** @deprecated Use maxWebsites — kept for call sites that expect `maxSites` */
  maxSites: number;
  /** Mirror of canUseSEO for existing API checks */
  seoEnabled: boolean;
};

function isPaidActiveSubscription(sub: UserSubscription | null): boolean {
  if (!sub?.status) return false;
  if (!ENABLED_STATUSES.has(sub.status)) return false;
  return Boolean(sub.planKey);
}

function resolveAccountKind(
  sub: UserSubscription | null,
  isAdmin: boolean,
): { accountKind: AccountKind; planKey: PlanKey | null; limits: UserPlanLimits } {
  if (isAdmin) {
    return {
      accountKind: "committed",
      planKey: "committed",
      limits: getUserPlanLimits("committed"),
    };
  }
  if (isPaidActiveSubscription(sub) && sub?.planKey) {
    return {
      accountKind: sub.planKey,
      planKey: sub.planKey,
      limits: getUserPlanLimits(sub.planKey),
    };
  }
  return { accountKind: "free", planKey: null, limits: getUserPlanLimits("free") };
}

/**
 * Resolves entitlements: paid Stripe subscription wins; otherwise the Free tier
 * (dashboard + one site, basic uptime, no SEO/intelligence).
 */
export async function getBillingAccess(
  userId: string,
  userEmail?: string | null,
): Promise<BillingEntitlements> {
  const normalizedEmail = userEmail?.trim().toLowerCase();
  const isAdmin = Boolean(normalizedEmail && ADMIN_BYPASS_EMAILS.has(normalizedEmail));
  const sub = await getUserSubscription(userId);
  const { accountKind, planKey, limits } = resolveAccountKind(sub, isAdmin);

  return {
    ...limits,
    planKey,
    accountKind,
    maxSites: limits.maxWebsites,
    seoEnabled: limits.canUseSEO,
  };
}
