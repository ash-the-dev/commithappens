import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getPool } from "@/lib/db/pool";

export type DbUser = {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string | null;
};

const RESET_TTL_MINUTES = 30;

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

let ensuredResetTable = false;

async function ensurePasswordResetTable() {
  if (ensuredResetTable) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      token_hash    text NOT NULL UNIQUE,
      expires_at    timestamptz NOT NULL,
      used_at       timestamptz,
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
    ON password_reset_tokens (user_id, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry_idx
    ON password_reset_tokens (expires_at)
    WHERE used_at IS NULL;
  `);
  ensuredResetTable = true;
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const pool = getPool();
  const result = await pool.query<DbUser>(
    `SELECT id, email, display_name, password_hash
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email.trim()],
  );
  return result.rows[0] ?? null;
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export type CreateUserErrorCode =
  | "email_taken"
  | "schema_missing"
  | "db_auth_failed"
  | "connection"
  | "ssl_cert"
  | "db_error";

function classifyUserInsertError(err: unknown): CreateUserErrorCode {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = String((err as { code: string }).code);
    if (code === "23505") return "email_taken";
    if (code === "42P01") return "schema_missing";
    if (code === "28P01") return "db_auth_failed";
    if (code === "ENOTFOUND" || code === "ECONNREFUSED" || code === "ETIMEDOUT") {
      return "connection";
    }
    if (
      code === "SELF_SIGNED_CERT_IN_CHAIN" ||
      code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      code === "DEPTH_ZERO_SELF_SIGNED_CERT"
    ) {
      return "ssl_cert";
    }
  }
  return "db_error";
}

export async function createUser(
  email: string,
  password: string,
  displayName: string | null,
): Promise<
  { ok: true; id: string } | { ok: false; code: CreateUserErrorCode }
> {
  const pool = getPool();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email.trim().toLowerCase(), passwordHash, displayName],
    );
    return { ok: true, id: inserted.rows[0].id };
  } catch (err: unknown) {
    const code = classifyUserInsertError(err);
    if (code !== "email_taken") {
      console.error("[users] createUser failed", err);
    }
    return { ok: false, code };
  }
}

export async function createPasswordResetToken(
  email: string,
): Promise<{ ok: true; token: string } | { ok: false; reason: "user_not_found" | "db_error" }> {
  await ensurePasswordResetTable();
  const user = await findUserByEmail(email);
  if (!user) {
    return { ok: false, reason: "user_not_found" };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(token);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE user_id = $1
         AND used_at IS NULL`,
      [user.id],
    );
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3 * interval '1 minute'))`,
      [user.id, tokenHash, RESET_TTL_MINUTES],
    );
    await client.query("COMMIT");
    return { ok: true, token };
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("[users] createPasswordResetToken failed", err);
    return { ok: false, reason: "db_error" };
  } finally {
    client.release();
  }
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<
  { ok: true } | { ok: false; reason: "invalid_token" | "expired" | "db_error" | "weak_password" }
> {
  await ensurePasswordResetTable();
  if (newPassword.length < 8) {
    return { ok: false, reason: "weak_password" };
  }

  const tokenHash = sha256Hex(token);
  const pool = getPool();

  try {
    const claimed = await pool.query<{ user_id: string; expired: boolean }>(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE token_hash = $1
         AND used_at IS NULL
       RETURNING user_id, expires_at <= now() AS expired`,
      [tokenHash],
    );

    const row = claimed.rows[0];
    if (!row) {
      return { ok: false, reason: "invalid_token" };
    }
    if (row.expired) {
      return { ok: false, reason: "expired" };
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      `UPDATE users
       SET password_hash = $2, updated_at = now()
       WHERE id = $1`,
      [row.user_id, passwordHash],
    );

    return { ok: true };
  } catch (err) {
    console.error("[users] resetPasswordWithToken failed", err);
    return { ok: false, reason: "db_error" };
  }
}
