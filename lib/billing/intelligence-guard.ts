import { getBillingAccess } from "@/lib/billing/access";
import { getUpgradeMessage, requireFeature } from "@/lib/entitlements";

export async function getIntelligenceUpgradeResponse(): Promise<Response> {
  return Response.json(
    {
      ok: false,
      error: "upgrade_required",
      message: getUpgradeMessage("dashboardIntelligence"),
    },
    { status: 403 },
  );
}

export async function requireIntelligenceForUser(
  userId: string,
  userEmail: string | null | undefined,
): Promise<Response | null> {
  const billing = await getBillingAccess(userId, userEmail);
  if (!requireFeature(billing.accountKind, "dashboardIntelligence").ok) {
    return getIntelligenceUpgradeResponse();
  }
  return null;
}
