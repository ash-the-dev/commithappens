const PRODUCTION_ORIGIN = "https://www.commithappens.com";

function isLocalOrigin(value: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(value.trim());
}

function normalizeOrigin(value: string): string {
  const origin = value.replace(/\/$/, "");
  return origin === "https://commithappens.com" ? PRODUCTION_ORIGIN : origin;
}

/**
 * Absolute public origin for metadata, robots, and sitemap routes.
 *
 * Keep this helper free of request APIs like `next/headers`; metadata routes
 * should be safe at build time and runtime.
 */
export function getPublicOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (explicit && !isLocalOrigin(explicit)) {
    return normalizeOrigin(explicit);
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return host === "commithappens.com" ? PRODUCTION_ORIGIN : `https://${host}`;
  }

  return PRODUCTION_ORIGIN;
}
