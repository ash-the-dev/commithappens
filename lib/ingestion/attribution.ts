import type { IngestAttribution } from "@/lib/ingestion/types";

function safeHostnameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t.length ? t : null;
}

function hostLooksOrganic(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.includes("google.")) return true;
  if (h === "bing.com" || h.endsWith(".bing.com")) return true;
  if (h.includes("duckduckgo.com")) return true;
  if (h.includes("search.yahoo.com")) return true;
  if (h === "yahoo.com" || h.endsWith(".yahoo.com")) return true;
  return false;
}

/**
 * Maps referrer + UTM hints to a coarse channel for `traffic_sources.channel`.
 */
export function classifyTrafficChannel(
  primaryDomain: string,
  attribution: IngestAttribution | undefined,
  pageReferrerUrl?: string | null,
): { channel: string; referrerHost: string | null } {
  const primary = primaryDomain.toLowerCase();
  const utmMedium = normalizeText(attribution?.utmMedium)?.toLowerCase() ?? null;
  const utmSource = normalizeText(attribution?.utmSource)?.toLowerCase() ?? null;

  if (utmMedium === "email") {
    return { channel: "email", referrerHost: null };
  }

  if (
    utmMedium &&
    ["cpc", "ppc", "paidsearch", "paid", "display", "banner"].includes(utmMedium)
  ) {
    return { channel: "paid_search", referrerHost: null };
  }

  if (utmMedium && ["social", "social_network", "social-network"].includes(utmMedium)) {
    return { channel: "social", referrerHost: utmSource };
  }

  const socialSources = new Set([
    "facebook",
    "fb",
    "instagram",
    "twitter",
    "t.co",
    "linkedin",
    "tiktok",
    "reddit",
    "pinterest",
  ]);
  if (utmSource && socialSources.has(utmSource)) {
    return { channel: "social", referrerHost: utmSource };
  }

  const refUrl = attribution?.referrerUrl ?? pageReferrerUrl;
  const refHost = safeHostnameFromUrl(refUrl);

  const hasUtm =
    normalizeText(attribution?.utmSource) ||
    normalizeText(attribution?.utmMedium) ||
    normalizeText(attribution?.utmCampaign);

  if (!refHost && !hasUtm) {
    return { channel: "direct", referrerHost: null };
  }

  if (refHost === primary || refHost === `www.${primary}` || primary === `www.${refHost}`) {
    return { channel: "direct", referrerHost: refHost };
  }

  if (refHost && hostLooksOrganic(refHost)) {
    return { channel: "organic_search", referrerHost: refHost };
  }

  if (refHost) {
    return { channel: "referral", referrerHost: refHost };
  }

  return { channel: "other", referrerHost: null };
}

export function fingerprintFields(attribution: IngestAttribution | undefined) {
  return {
    utmSource: normalizeText(attribution?.utmSource),
    utmMedium: normalizeText(attribution?.utmMedium),
    utmCampaign: normalizeText(attribution?.utmCampaign),
    utmTerm: normalizeText(attribution?.utmTerm),
    utmContent: normalizeText(attribution?.utmContent),
  };
}
