"use server";

import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth/options";
import { softDeleteWebsiteForUser } from "@/lib/db/websites";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export type DeleteSiteState = { error: string } | null;

export async function deleteWebsiteAction(
  _prev: DeleteSiteState,
  formData: FormData,
): Promise<DeleteSiteState> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const websiteId = String(formData.get("websiteId") ?? "").trim();
  if (!websiteId) {
    return { error: "Missing website." };
  }

  let ok: boolean;
  try {
    ok = await softDeleteWebsiteForUser(session.user.id, websiteId);
  } catch (err) {
    console.error("[deleteWebsiteAction]", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Missing required environment variable")) {
      return { error: "Server is missing database configuration." };
    }
    return { error: "Could not remove this site. Try again." };
  }

  if (!ok) {
    return { error: "Site not found or already removed." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/sites/${websiteId}`);

  redirect("/dashboard");
}
