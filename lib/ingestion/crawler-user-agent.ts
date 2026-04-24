/**
 * Detects well-known search / social / SEO monitoring crawlers only.
 * Missing or short user agents are treated as human (inclusive counting).
 * Not a general "bot" filter — avoids stripping real browsers and dev tools.
 */
const CRAWLER_ALIASES = [
  "googlebot",
  "google-inspectiontool",
  "adsbot-google",
  "mediapartners-google",
  "storebot-google",
  "google-read-aloud",
  "duplexweb-google",
  "bingbot",
  "bingpreview",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "yandex\\.com/bots",
  "bytespider",
  "petalbot",
  "applebot",
  "amazonbot",
  "facebot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "embedly",
  "pinterest",
  "ahrefsbot",
  "semrushbot",
  "dotbot",
  "mj12bot",
  "rogerbot",
  "gptbot",
  "oai-searchbot",
  "chatgpt-user",
  "claudebot",
  "anthropic-ai",
  "ccbot",
  "perplexitybot",
  "serpstatbot",
  "dataforseo",
  "ia_archiver",
  "screaming\\s+frog",
] as const;

/** Single alternation for Postgres `~*` / JS `RegExp` (case-insensitive). */
export const CRAWLER_USER_AGENT_POSTGRES_REGEX = CRAWLER_ALIASES.join("|");

const crawlerRe = new RegExp(CRAWLER_USER_AGENT_POSTGRES_REGEX, "i");

export function isKnownSearchOrMonitoringCrawlerUserAgent(
  ua: string | null | undefined,
): boolean {
  if (ua == null || ua.length < 8) return false;
  return crawlerRe.test(ua);
}
