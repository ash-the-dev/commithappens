const ADMIN_EMAILS = new Set(["ashthedev0@gmail.com"]);

export function isAdminEmail(email?: string | null): boolean {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && ADMIN_EMAILS.has(normalized));
}
