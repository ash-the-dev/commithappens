import type { PoolConfig } from "pg";
import { Pool } from "pg";
import { getServerEnv } from "@/lib/env";

/**
 * One pool per Node process (including production) to avoid opening a new pool
 * on every request. Tune PG_POOL_MAX for serverless (often 1–2).
 */
declare global {
  var __wipPgPool: Pool | undefined;
}

/**
 * Node + `pg` often fail TLS verification against Supabase / other managed hosts
 * with `SELF_SIGNED_CERT_IN_CHAIN`. Relaxing verification matches common server-side setups.
 *
 * - Default: strict verification.
 * - Hosts `*.supabase.co` / `*.pooler.supabase.com`: `rejectUnauthorized: false` unless overridden.
 * - `DATABASE_SSL_REJECT_UNAUTHORIZED=false` | `0`: always relax (any host).
 * - `DATABASE_SSL_REJECT_UNAUTHORIZED=true` | `1`: always strict (any host).
 */
function sslForDatabaseUrl(databaseUrl: string): PoolConfig["ssl"] {
  const flag = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.toLowerCase();
  if (flag === "true" || flag === "1") {
    return undefined;
  }
  if (flag === "false" || flag === "0") {
    return { rejectUnauthorized: false };
  }

  try {
    const parsed = new URL(databaseUrl.replace(/^postgresql:/i, "https:"));
    const host = parsed.hostname;
    if (
      host.endsWith(".supabase.co") ||
      host.endsWith(".pooler.supabase.com")
    ) {
      return { rejectUnauthorized: false };
    }
  } catch {
    /* ignore */
  }

  return undefined;
}

/**
 * `pg` does `Object.assign({}, poolConfig, parse(connectionString))`, so any
 * `?sslmode=require` in the URL becomes `ssl: {}` and **overwrites** a Pool-level
 * `ssl: { rejectUnauthorized: false }`. Strip ssl-related query params when we
 * apply relaxed TLS so the Pool `ssl` option wins.
 */
function stripSslQueryParams(connectionString: string): string {
  const q = connectionString.indexOf("?");
  if (q < 0) return connectionString;
  const base = connectionString.slice(0, q);
  const qs = connectionString.slice(q + 1);
  const parts = qs
    .split("&")
    .filter((p) => p.length > 0 && !/^sslmode=/i.test(p) && !/^ssl($|=)/i.test(p));
  if (parts.length === 0) return base;
  return `${base}?${parts.join("&")}`;
}

export function getPool(): Pool {
  if (globalThis.__wipPgPool) {
    return globalThis.__wipPgPool;
  }

  const { databaseUrl, pgPoolMax } = getServerEnv();
  const ssl = sslForDatabaseUrl(databaseUrl);
  const connectionString =
    ssl && typeof ssl === "object" && ssl.rejectUnauthorized === false
      ? stripSslQueryParams(databaseUrl)
      : databaseUrl;

  const pool = new Pool({
    connectionString,
    ssl,
    max: pgPoolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  globalThis.__wipPgPool = pool;
  return pool;
}
