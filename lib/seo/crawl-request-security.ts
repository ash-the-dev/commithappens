import { isIP } from "node:net";

const privateIpv4Ranges = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
];

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h.endsWith(".internal") || h.endsWith(".home.arpa")) return true;

  const ipKind = isIP(h);
  if (ipKind === 4) return privateIpv4Ranges.some((range) => range.test(h));
  if (ipKind === 6) {
    return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:");
  }

  return false;
}

export function normalizePublicCrawlUrl(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Domain is required.");
  }

  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be crawled.");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("Internal, localhost, and private network URLs cannot be crawled.");
  }
  url.hash = "";
  return url;
}

export function urlsBelongToSameSite(a: URL, siteDomain: string): boolean {
  const siteHost = siteDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  const requestHost = a.hostname.toLowerCase().replace(/^www\./, "");
  return requestHost === siteHost;
}
