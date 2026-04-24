import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type DueCheck = {
  id: string;
  website_id: string;
  user_id: string | null;
  frequency_minutes: number | null;
};

type RunSummary = {
  processed: number;
  up: number;
  degraded: number;
  down: number;
  error: number;
};

const BATCH_SIZE = 25;
const REQUEST_TIMEOUT_MS = 10_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function classifyStatus(statusCode: number | null, responseTimeMs: number): "up" | "degraded" | "down" {
  if (statusCode === null) return "down";
  if (statusCode >= 500) return "down";
  if ((statusCode >= 400 && statusCode < 500) || responseTimeMs > 3000) return "degraded";
  return "up";
}

async function runProbe(url: string): Promise<{
  status: "up" | "degraded" | "down" | "error";
  statusCode: number | null;
  responseTimeMs: number;
  errorMessage: string | null;
}> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - startedAt;
    return {
      status: classifyStatus(response.status, elapsed),
      statusCode: response.status,
      responseTimeMs: elapsed,
      errorMessage: null,
    };
  } catch (error) {
    clearTimeout(timeout);
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "request_timeout"
          : error.message
        : "request_failed";
    return {
      status: "error",
      statusCode: null,
      responseTimeMs: Date.now() - startedAt,
      errorMessage: message.slice(0, 1000),
    };
  }
}

async function loadDueChecks(supabase: ReturnType<typeof createClient>): Promise<DueCheck[]> {
  const nowIso = new Date().toISOString();
  const withUrlDue = await supabase
    .from("uptime_checks")
    .select("id,website_id,user_id,frequency_minutes")
    .eq("enabled", true)
    .lte("next_check_at", nowIso)
    .order("next_check_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  const withUrlNull = await supabase
    .from("uptime_checks")
    .select("id,website_id,user_id,frequency_minutes")
    .eq("enabled", true)
    .is("next_check_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (!withUrlDue.error && !withUrlNull.error) {
    const merged = [...(withUrlNull.data ?? []), ...(withUrlDue.data ?? [])];
    const deduped = new Map<string, DueCheck>();
    for (const row of merged) deduped.set(row.id, row);
    return [...deduped.values()].slice(0, BATCH_SIZE);
  }

  const fallbackDue = await supabase
    .from("uptime_checks")
    .select("id,website_id,user_id,frequency_minutes")
    .eq("enabled", true)
    .lte("next_check_at", nowIso)
    .order("next_check_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  const fallbackNull = await supabase
    .from("uptime_checks")
    .select("id,website_id,user_id,frequency_minutes")
    .eq("enabled", true)
    .is("next_check_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fallbackDue.error || fallbackNull.error) {
    throw new Error(
      `load_due_checks_failed: ${fallbackDue.error?.message ?? fallbackNull.error?.message ?? "unknown"}`,
    );
  }
  const merged = [...(fallbackNull.data ?? []), ...(fallbackDue.data ?? [])];
  const deduped = new Map<string, DueCheck>();
  for (const row of merged) deduped.set(row.id, row);
  return [...deduped.values()].slice(0, BATCH_SIZE);
}

type WebsiteShape = {
  id: string;
  [key: string]: unknown;
};

async function loadWebsitesByIds(
  supabase: ReturnType<typeof createClient>,
  websiteIds: string[],
): Promise<Map<string, WebsiteShape>> {
  if (websiteIds.length === 0) return new Map();
  // Intentionally select * so we inspect the *actual* schema in this project.
  const result = await supabase.from("websites").select("*").in("id", websiteIds);
  if (result.error) {
    throw new Error(`load_websites_failed: ${result.error.message}`);
  }
  const byId = new Map<string, WebsiteShape>();
  for (const row of result.data ?? []) {
    byId.set(row.id as string, row as WebsiteShape);
  }
  return byId;
}

function pickWebsiteTarget(website: WebsiteShape | undefined): string | null {
  if (!website) return null;
  const candidates = [
    website.monitoring_url,
    website.primary_domain,
    website.domain,
    website.url,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

Deno.serve(async (request) => {
  const expectedToken = Deno.env.get("UPTIME_RUNNER_SECRET")?.trim();
  if (expectedToken) {
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const cronSecret = request.headers.get("x-cron-secret")?.trim() ?? "";
    if (token !== expectedToken && cronSecret !== expectedToken) {
      return json({ success: false, error: "unauthorized" }, 401);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "missing_supabase_env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary: RunSummary = {
    processed: 0,
    up: 0,
    degraded: 0,
    down: 0,
    error: 0,
  };

  try {
    const dueChecks = await loadDueChecks(supabase);
    const websitesById = await loadWebsitesByIds(
      supabase,
      Array.from(new Set(dueChecks.map((check) => check.website_id))),
    );
    console.log(JSON.stringify({ actor: "run-uptime-checks", due: dueChecks.length }));

    for (const check of dueChecks) {
      const target = pickWebsiteTarget(websitesById.get(check.website_id));
      const normalized = normalizeUrl(target);
      if (!normalized) {
        const nowIso = new Date().toISOString();
        await supabase.from("uptime_logs").insert({
          uptime_check_id: check.id,
          website_id: check.website_id,
          user_id: check.user_id,
          status: "error",
          status_code: null,
          response_time_ms: null,
          checked_at: nowIso,
          error_message: "invalid_monitoring_url",
        });
        await supabase
          .from("uptime_checks")
          .update({
            last_checked_at: nowIso,
            next_check_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", check.id);
        summary.processed += 1;
        summary.error += 1;
        continue;
      }

      const probe = await runProbe(normalized);
      const nowIso = new Date().toISOString();
      const frequency = Math.max(1, Number(check.frequency_minutes ?? 30));
      const nextCheckIso = new Date(Date.now() + frequency * 60_000).toISOString();

      const logInsert = await supabase.from("uptime_logs").insert({
        uptime_check_id: check.id,
        website_id: check.website_id,
        user_id: check.user_id,
        status: probe.status,
        status_code: probe.statusCode,
        http_status: probe.statusCode,
        response_time_ms: probe.responseTimeMs,
        is_up: probe.status === "up",
        checked_at: nowIso,
        error_message: probe.errorMessage,
      });
      if (logInsert.error) {
        console.error(
          JSON.stringify({
            actor: "run-uptime-checks",
            step: "insert_log_failed",
            checkId: check.id,
            message: logInsert.error.message,
          }),
        );
        summary.error += 1;
      } else {
        summary[probe.status] += 1;
      }

      const updateCheck = await supabase
        .from("uptime_checks")
        .update({
          last_checked_at: nowIso,
          next_check_at: nextCheckIso,
          updated_at: nowIso,
        })
        .eq("id", check.id);
      if (updateCheck.error) {
        console.error(
          JSON.stringify({
            actor: "run-uptime-checks",
            step: "update_check_failed",
            checkId: check.id,
            message: updateCheck.error.message,
          }),
        );
      }

      summary.processed += 1;
    }

    console.log(JSON.stringify({ actor: "run-uptime-checks", summary }));
    return json({ success: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ actor: "run-uptime-checks", error: message }));
    return json({ success: false, error: "uptime_actor_failed", details: message }, 500);
  }
});

