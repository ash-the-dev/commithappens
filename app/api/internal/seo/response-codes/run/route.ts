import { getServerSession } from "next-auth";
import { spawn } from "node:child_process";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";

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
          "Starting a full crawl from the dashboard isn’t available in the hosted app yet. You’ll still see your last imported SEO report here—run fresh imports from your project checkout with npm run seo:run when you need new data.",
      },
      501,
    );
  }

  const result = await runUploadScript(siteIdOverride);
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

  return json({
    ok: true,
    message: "Crawl run completed.",
    exitCode: result.exitCode,
    stdout: result.stdout,
  });
}
