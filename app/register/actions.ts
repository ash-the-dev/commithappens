"use server";

import { createUser } from "@/lib/db/users";
import { redirect } from "next/navigation";

export type RegisterState = { error: string } | null;

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayNameRaw = String(formData.get("displayName") ?? "").trim();
  const displayName = displayNameRaw.length ? displayNameRaw : null;

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    const result = await createUser(email, password, displayName);
    if (!result.ok) {
      switch (result.code) {
        case "email_taken":
          return { error: "An account with that email already exists." };
        case "schema_missing":
          return {
            error:
              "Database tables are missing. Run database/schema.sql on your Postgres database, then try again.",
          };
        case "db_auth_failed":
          return {
            error:
              "Database rejected the login (wrong user or password in DATABASE_URL). Check your connection string in .env.local.",
          };
        case "connection":
          return {
            error:
              "Cannot reach the database (network or host). Confirm DATABASE_URL and that Postgres allows your IP (e.g. Supabase: enable access / use correct host).",
          };
        case "ssl_cert":
          return {
            error:
              "TLS certificate verification failed for Postgres. Add DATABASE_SSL_REJECT_UNAUTHORIZED=false to .env.local, or use a host-specific pool config.",
          };
        default:
          return { error: "Could not create your account. Try again later." };
      }
    }
  } catch (err) {
    console.error("[register]", err);
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Missing required environment variable")) {
      return { error: "Server is missing database configuration." };
    }
    return { error: "Could not create your account. Try again later." };
  }

  redirect("/login?registered=1");
}
