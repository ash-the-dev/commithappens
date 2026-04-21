import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { createChangeLog } from "@/lib/db/change-logs";
import { getWebsiteForUser } from "@/lib/db/websites";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

type Body = {
  website_id?: string;
  title?: string;
  description?: string | null;
  change_type?: string | null;
  metadata?: Record<string, unknown> | null;
  source?: string | null;
};

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const websiteId =
    typeof body.website_id === "string" ? body.website_id.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!websiteId) {
    return json({ ok: false, error: "website_id_required" }, 400);
  }
  if (!title) {
    return json({ ok: false, error: "title_required" }, 400);
  }
  if (title.length > 200) {
    return json({ ok: false, error: "title_too_long" }, 400);
  }

  const site = await getWebsiteForUser(websiteId, userId);
  if (!site) {
    return json({ ok: false, error: "website_not_found" }, 404);
  }

  try {
    const created = await createChangeLog({
      websiteId,
      title,
      description: body.description ?? null,
      changeType: body.change_type ?? null,
      metadata: body.metadata ?? {},
      source: body.source ?? "manual",
      createdBy: userId,
    });
    return json({ ok: true, change_log: created }, 201);
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "42P01"
    ) {
      return json({ ok: false, error: "change_logs_table_missing" }, 503);
    }
    console.error("[change-logs.create] failed", err);
    return json({ ok: false, error: "create_failed" }, 500);
  }
}
