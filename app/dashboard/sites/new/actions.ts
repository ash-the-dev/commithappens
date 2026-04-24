"use server";

import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { normalizePrimaryDomain } from "@/lib/domain";
import { countWebsitesForUser, createWebsite } from "@/lib/db/websites";
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
    const existingSites = await countWebsitesForUser(session.user.id);
    if (existingSites >= billing.maxSites) {
      return {
        error: `Your current plan allows up to ${billing.maxSites} site${billing.maxSites === 1 ? "" : "s"}. Upgrade to add more.`,
      };
    }
    site = await createWebsite(session.user.id, name, primaryDomain);
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
