import { getPool } from "@/lib/db/pool";

export type DbWebsite = {
  id: string;
  name: string;
  primary_domain: string;
  tracking_public_key: string;
  is_active: boolean;
  created_at: Date;
};

export async function listWebsitesForUser(userId: string): Promise<DbWebsite[]> {
  const pool = getPool();
  const result = await pool.query<DbWebsite>(
    `SELECT id, name, primary_domain, tracking_public_key, is_active, created_at
     FROM websites
     WHERE owner_user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function createWebsite(
  userId: string,
  name: string,
  primaryDomain: string,
): Promise<DbWebsite> {
  const pool = getPool();
  const result = await pool.query<DbWebsite>(
    `INSERT INTO websites (owner_user_id, name, primary_domain)
     VALUES ($1, $2, $3)
     RETURNING id, name, primary_domain, tracking_public_key, is_active, created_at`,
    [userId, name.trim(), primaryDomain],
  );
  return result.rows[0];
}

export async function getWebsiteForUser(
  websiteId: string,
  userId: string,
): Promise<DbWebsite | null> {
  const pool = getPool();
  const result = await pool.query<DbWebsite>(
    `SELECT id, name, primary_domain, tracking_public_key, is_active, created_at
     FROM websites
     WHERE id = $1::uuid AND owner_user_id = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [websiteId, userId],
  );
  return result.rows[0] ?? null;
}

/** Soft-delete: hides the site and cascades analytics rows on future hard-delete; ingest stops matching active site. */
export async function softDeleteWebsiteForUser(
  userId: string,
  websiteId: string,
): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE websites
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1::uuid AND owner_user_id = $2::uuid AND deleted_at IS NULL`,
    [websiteId, userId],
  );
  return result.rowCount === 1;
}
