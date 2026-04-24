import { getBillingAccess } from "@/lib/billing/access";

export async function getIntelligenceUpgradeResponse(): Promise<Response> {
  return Response.json(
    {
      ok: false,
      error: "upgrade_required",
      message: "This feature is not included on the Free plan. Upgrade to unlock full intelligence, workflows, and case tools.",
    },
    { status: 403 },
  );
}

export async function requireIntelligenceForUser(
  userId: string,
  userEmail: string | null | undefined,
): Promise<Response | null> {
  const billing = await getBillingAccess(userId, userEmail);
  if (!billing.canUseIntelligence) {
    return getIntelligenceUpgradeResponse();
  }
  return null;
}
