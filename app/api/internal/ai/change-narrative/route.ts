import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { canUseFeature } from "@/lib/entitlements";
import { getPool } from "@/lib/db/pool";
import { generateChangeImpactNarrative } from "@/lib/ai/generate-change-impact-narrative";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const billing = await getBillingAccess(session.user.id, session.user.email);
  if (!canUseFeature(billing.accountKind, "dashboardIntelligence")) {
    return json({ ok: false, error: "upgrade_required" }, 403);
  }

  const url = new URL(request.url);
  const changeLogId = url.searchParams.get("change_log_id")?.trim();
  if (!changeLogId) {
    return json({ ok: false, error: "missing_change_log_id" }, 400);
  }

  const pool = getPool();
  const ownership = await pool.query<{ id: string }>(
    `SELECT cl.id
     FROM change_logs cl
     JOIN websites w ON w.id = cl.website_id
     WHERE cl.id = $1::uuid
       AND w.user_id = $2::uuid
     LIMIT 1`,
    [changeLogId, session.user.id],
  );
  if (ownership.rowCount === 0) {
    return json({ ok: false, error: "change_log_not_found" }, 404);
  }

  const narrative = await generateChangeImpactNarrative(changeLogId);
  return json({ ok: true, narrative });
}
