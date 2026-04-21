/**
 * Centralized environment reads so misconfiguration fails fast with clear errors.
 */

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export type ServerEnv = {
  /** PostgreSQL connection string (e.g. from Neon, RDS, or local Postgres). */
  databaseUrl: string;
  /** Max connections per pool instance; keep low on serverless (1–5). */
  pgPoolMax: number;
};

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  cached = {
    databaseUrl: requireEnv("DATABASE_URL"),
    pgPoolMax: Math.max(1, Number(process.env.PG_POOL_MAX ?? "5") || 5),
  };
  return cached;
}

/**
 * Returns true when DATABASE_URL is set (without throwing). Useful for health checks.
 */
export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
