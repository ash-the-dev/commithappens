import { headers } from "next/headers";

const PRODUCTION_ORIGIN = "https://commithappens.com";

function isLocalOrigin(value: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(value.trim());
}

/**
 * Public origin for script URLs.
 */
export async function getRequestOrigin(): Promise<string> {
  const explicit = process.env.NEXTAUTH_URL?.trim();
  if (explicit && !isLocalOrigin(explicit)) {
    return explicit.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host || /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    return PRODUCTION_ORIGIN;
  }
  const forwardedProto = h.get("x-forwarded-proto");
  const proto =
    forwardedProto ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
