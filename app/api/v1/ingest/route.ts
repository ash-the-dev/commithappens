import { getPool } from "@/lib/db/pool";
import { hasDatabaseUrl } from "@/lib/env";
import {
  parseIngestBody,
  persistIngestBatch,
} from "@/lib/ingestion/process-ingest";

/** `pg` requires the Node.js runtime (not Edge). */
export const runtime = "nodejs";

const DEFAULT_ALLOWED_ORIGINS = ["https://www.ashthedev.com"]
  .map((origin) => normalizeOrigin(origin))
  .filter((origin): origin is string => Boolean(origin));
const ORIGIN_CACHE_TTL_MS = 5 * 60 * 1000;

type OriginCache = {
  expiresAt: number;
  origins: Set<string>;
};

let cachedOrigins: OriginCache | null = null;

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function getAllowedOrigins(): Set<string> {
  const configured = process.env.INGEST_ALLOWED_ORIGINS?.trim();
  const origins = configured
    ? configured
        .split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter((origin): origin is string => Boolean(origin))
    : DEFAULT_ALLOWED_ORIGINS;
  return new Set(origins);
}

function normalizeHostLike(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function originsFromDomain(domain: string): string[] {
  const host = normalizeHostLike(domain);
  if (!host) return [];
  const hosts = new Set<string>([host]);
  if (host.startsWith("www.")) {
    hosts.add(host.slice(4));
  } else {
    hosts.add(`www.${host}`);
  }
  const origins: string[] = [];
  for (const h of hosts) {
    origins.push(`https://${h}`);
    origins.push(`http://${h}`);
  }
  return origins
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));
}

async function getAutoAllowedOriginsFromWebsites(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedOrigins && cachedOrigins.expiresAt > now) {
    return cachedOrigins.origins;
  }
  const pool = getPool();
  const result = await pool.query<{ primary_domain: string }>(
    `SELECT primary_domain
     FROM websites
     WHERE is_active = true
       AND deleted_at IS NULL`,
  );
  const origins = new Set<string>();
  for (const row of result.rows) {
    for (const origin of originsFromDomain(row.primary_domain)) {
      origins.add(origin);
    }
  }
  cachedOrigins = {
    expiresAt: now + ORIGIN_CACHE_TTL_MS,
    origins,
  };
  return origins;
}

function requestOrigin(request: Request): string | null {
  const raw = request.headers.get("origin");
  return raw ? normalizeOrigin(raw) : null;
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, origin: string): Response {
  return Response.json(data, { status, headers: corsHeaders(origin) });
}

async function isAllowedOrigin(origin: string | null): Promise<boolean> {
  if (!origin) return false;
  if (getAllowedOrigins().has(origin)) {
    return true;
  }
  if (!hasDatabaseUrl()) {
    return false;
  }
  try {
    const websiteOrigins = await getAutoAllowedOriginsFromWebsites();
    return websiteOrigins.has(origin);
  } catch (err) {
    console.error("[ingest] failed to load automatic origin allowlist", err);
    return false;
  }
}

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = requestOrigin(request);
  if (!origin || !(await isAllowedOrigin(origin))) {
    return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/**
 * Analytics ingestion: accepts batched pageviews, custom events, and web vitals.
 * Intended to be called from the first-party tracker script on customer sites.
 */
export async function POST(request: Request): Promise<Response> {
  const origin = requestOrigin(request);
  if (!origin || !(await isAllowedOrigin(origin))) {
    return Response.json(
      { ok: false, error: "origin_not_allowed" },
      { status: 403, headers: { Vary: "Origin" } },
    );
  }

  if (!hasDatabaseUrl()) {
    return json({ ok: false, error: "database_not_configured" }, 503, origin);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, origin);
  }

  const parsed = parseIngestBody(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.error }, parsed.status, origin);
  }

  try {
    const pool = getPool();
    const result = await persistIngestBatch(pool, parsed.payload);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.status, origin);
    }
    return json({ ok: true }, 202, origin);
  } catch (err) {
    console.error("[ingest] fatal", err);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Missing required environment variable")) {
      return json({ ok: false, error: "database_not_configured" }, 503, origin);
    }
    return json({ ok: false, error: "server_error" }, 500, origin);
  }
}
