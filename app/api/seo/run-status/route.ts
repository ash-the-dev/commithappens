import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getWebsiteForUser } from "@/lib/db/websites";
import { getSeoCrawlRunStatusById } from "@/lib/db/seo-apify-pipeline";

export const runtime = "nodejs";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const { searchParams } = new URL(request.url);
  const crawlRunId = searchParams.get("crawlRunId")?.trim();
  if (!crawlRunId) {
    return json({ ok: false, code: "MISSING_CRAWL_RUN_ID", message: "Missing crawl run ID." }, 400);
  }

  const run = await getSeoCrawlRunStatusById(crawlRunId).catch(() => null);
  if (!run) {
    return json({ ok: false, code: "CRAWL_RUN_NOT_FOUND", message: "Crawl run not found." }, 404);
  }

  if (run.user_id && run.user_id !== session.user.id) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  if (!run.user_id) {
    const site = await getWebsiteForUser(run.site_id, session.user.id);
    if (!site) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
  }

  return json({
    ok: true,
    crawlRunId: run.id,
    siteId: run.site_id,
    status: run.status,
    pagesCrawled: run.pages_crawled,
    errorMessage: run.error_message,
    finishedAt: run.finished_at,
    updatedAt: run.updated_at,
  });
}
