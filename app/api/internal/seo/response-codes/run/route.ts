import { getServerSession } from "next-auth";
import { spawn } from "node:child_process";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { getPool } from "@/lib/db/pool";

export const runtime = "nodejs";

const RUN_TIMEOUT_MS = 15 * 60 * 1000;

/** Vercel / Lambda bundles don’t support `npm run` the way local dev does. */
function isHostedServerless(): boolean {
  return Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Never expose low-level process output in JSON — client surfaces `message` to users. */
function userVisibleCrawlFailureMessage(stderr: string, exitCode: number | null): string {
  const s = stderr.slice(0, 4000);
  if (
    /npm error|enoent|\/var\/task|sbx_user|no such file|package\.json|spawn /i.test(s)
  ) {
    return "The crawl job couldn’t be started. From the project folder, run npm run seo:run, or check that Node and dependencies are available.";
  }
  if (exitCode != null && exitCode !== 0) {
    return "The crawl didn’t finish successfully. Check server logs or run the import script locally.";
  }
  return "The crawl didn’t finish successfully. Try again later.";
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

async function getLatestStoredReportSummary(siteId: string): Promise<{
  reportCount: number;
  latestReportAt: string | null;
  latestPagesCrawled: number | null;
}> {
  const pool = getPool();
  const result = await pool.query<{
    report_count: string;
    latest_report_at: string | null;
    latest_pages_crawled: string | null;
  }>(
    `SELECT
       (SELECT count(*)::text FROM response_code_reports WHERE site_id = $1::text) AS report_count,
       (SELECT created_at::text FROM response_code_reports WHERE site_id = $1::text ORDER BY created_at DESC LIMIT 1) AS latest_report_at,
       (SELECT pages_crawled::text FROM seo_crawl_runs WHERE site_id = $1::text ORDER BY created_at DESC LIMIT 1) AS latest_pages_crawled`,
    [siteId],
  );
  const row = result.rows[0];
  return {
    reportCount: Number(row?.report_count ?? 0),
    latestReportAt: row?.latest_report_at ?? null,
    latestPagesCrawled: row?.latest_pages_crawled == null ? null : Number(row.latest_pages_crawled),
  };
}

async function runUploadScript(siteIdOverride?: string): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}> {
  const isWin = process.platform === "win32";
  const command = isWin ? "cmd.exe" : "npm";
  const args = isWin
    ? ["/d", "/s", "/c", "npm run seo:run"]
    : ["run", "seo:run"];
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...(siteIdOverride ? { SEO_SITE_ID: siteIdOverride } : {}),
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, RUN_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      if (timedOut) {
        stderr += "\nTimed out while running upload script.";
      }
      resolve({
        ok: !timedOut && exitCode === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        signal,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        stdout: stdout.trim(),
        stderr: `${stderr}\n${err.message}`.trim(),
        exitCode: null,
        signal: null,
      });
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const billing = await getBillingAccess(session.user.id, session.user.email);
  if (!billing.seoEnabled) {
    return json(
      {
        ok: false,
        error: "upgrade_required",
        message: "SEO crawling is available on the Committed plan.",
      },
      403,
    );
  }

  let siteIdOverride: string | undefined;
  try {
    const body = (await request.json()) as {
      site_id?: string;
    };
    siteIdOverride = body.site_id?.trim() || undefined;
  } catch {
    siteIdOverride = undefined;
  }

  if (isHostedServerless()) {
    return json(
      {
        ok: false,
        error: "crawl_unavailable",
        message:
          "This hosted dashboard can refresh stored report data, but it cannot start the local crawler process yet. Run npm run seo:run from the project checkout or connect a crawl worker to update the report.",
      },
      501,
    );
  }

  const siteId = siteIdOverride;
  if (!siteId) {
    return json(
      {
        ok: false,
        error: "missing_site_id",
        message: "The crawl action did not receive a site ID. Reload the dashboard and try again.",
      },
      400,
    );
  }

  const before = await getLatestStoredReportSummary(siteId).catch(() => null);
  const result = await runUploadScript(siteId);
  if (!result.ok) {
    return json(
      {
        ok: false,
        error: "crawl_run_failed",
        message: userVisibleCrawlFailureMessage(result.stderr, result.exitCode),
      },
      500,
    );
  }

  const after = await getLatestStoredReportSummary(siteId).catch(() => null);
  if (!after || after.reportCount === 0) {
    return json(
      {
        ok: false,
        error: "crawl_completed_without_report",
        message:
          "The crawl process finished, but no report was stored for this site. Check the crawler start URL and APIFY_ACTOR_INPUT_JSON, then run it again.",
      },
      500,
    );
  }

  const reportChanged =
    !before?.latestReportAt ||
    (after.latestReportAt != null && new Date(after.latestReportAt).getTime() > new Date(before.latestReportAt).getTime());
  const pageText =
    after.latestPagesCrawled != null && Number.isFinite(after.latestPagesCrawled)
      ? `${after.latestPagesCrawled.toLocaleString("en-US")} pages`
      : "stored pages";

  return json({
    ok: true,
    message: reportChanged
      ? `Crawl completed and report updated (${pageText}).`
      : `Crawl completed, but the latest stored report timestamp did not change. Showing the most recent report (${pageText}).`,
    exitCode: result.exitCode,
    stdout: result.stdout,
  });
}
