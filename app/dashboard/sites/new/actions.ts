"use server";

import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { normalizePrimaryDomain } from "@/lib/domain";
import { countWebsitesForUser, createWebsite } from "@/lib/db/websites";
import { ensureUptimeCheckForWebsite } from "@/lib/db/uptime";
import { getPlanMonitoringFrequency } from "@/lib/billing/plan-monitoring";
import { getPlanLimit } from "@/lib/entitlements";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export type NewSiteState = { error: string } | null;

export async function createWebsiteAction(
  _prev: NewSiteState,
  formData: FormData,
): Promise<NewSiteState> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }
  const billing = await getBillingAccess(session.user.id, session.user.email);
  const existingSites = await countWebsitesForUser(session.user.id);
  const maxSites = getPlanLimit(billing.accountKind, "maxSites") ?? billing.maxWebsites;
  if (existingSites >= maxSites) {
    return {
      error: `Your current plan supports ${maxSites} ${
        maxSites === 1 ? "site" : "sites"
      }. Upgrade when you are ready to track more chaos.`,
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const primaryRaw = String(formData.get("primaryDomain") ?? "").trim();

  if (!name) {
    return { error: "Site name is required." };
  }
  if (!primaryRaw) {
    return { error: "Primary domain is required." };
  }

  let primaryDomain: string;
  try {
    primaryDomain = normalizePrimaryDomain(primaryRaw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid domain." };
  }

  // Do not wrap `redirect()` in try/catch — it throws NEXT_REDIRECT on purpose.
  let site;
  try {
    site = await createWebsite(session.user.id, name, primaryDomain);
    await ensureUptimeCheckForWebsite({
      websiteId: site.id,
      userId: session.user.id,
      frequencyMinutes: getPlanMonitoringFrequency(billing.accountKind),
    });
  } catch (err) {
    console.error("[createWebsiteAction]", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Missing required environment variable")) {
      return { error: "Server is missing database configuration." };
    }
    return { error: "Could not add this website. Try again." };
  }

  redirect(`/dashboard/sites/${site.id}`);
}
