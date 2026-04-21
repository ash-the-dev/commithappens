import { getPool } from "@/lib/db/pool";

export type DbChangeLog = {
  id: string;
  website_id: string;
  title: string;
  description: string | null;
  change_type: string | null;
  metadata: Record<string, unknown>;
  source: string | null;
  created_by: string | null;
  created_at: Date;
};

export type CreateChangeLogInput = {
  websiteId: string;
  title: string;
  description?: string | null;
  changeType?: string | null;
  metadata?: Record<string, unknown> | null;
  source?: string | null;
  createdBy?: string | null;
};

function isUndefinedTable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "42P01"
  );
}

export async function createChangeLog(input: CreateChangeLogInput): Promise<DbChangeLog> {
  const pool = getPool();
  const result = await pool.query<DbChangeLog>(
    `INSERT INTO change_logs (
      website_id, title, description, change_type, metadata, source, created_by
    ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::uuid)
    RETURNING id, website_id, title, description, change_type, metadata, source, created_by, created_at`,
    [
      input.websiteId,
      input.title.trim(),
      input.description ?? null,
      input.changeType ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.source ?? "manual",
      input.createdBy ?? null,
    ],
  );
  return result.rows[0];
}

export async function getChangeLogById(changeLogId: string): Promise<DbChangeLog | null> {
  const pool = getPool();
  try {
    const result = await pool.query<DbChangeLog>(
      `SELECT id, website_id, title, description, change_type, metadata, source, created_by, created_at
       FROM change_logs
       WHERE id = $1::uuid
       LIMIT 1`,
      [changeLogId],
    );
    return result.rows[0] ?? null;
  } catch (err) {
    if (isUndefinedTable(err)) return null;
    throw err;
  }
}

export async function listChangeLogsForWebsite(
  websiteId: string,
  limit = 12,
): Promise<DbChangeLog[]> {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(limit, 50));
  try {
    const result = await pool.query<DbChangeLog>(
      `SELECT id, website_id, title, description, change_type, metadata, source, created_by, created_at
       FROM change_logs
       WHERE website_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT $2`,
      [websiteId, safeLimit],
    );
    return result.rows;
  } catch (err) {
    if (isUndefinedTable(err)) return [];
    throw err;
  }
}
