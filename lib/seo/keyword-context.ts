export type SeoKeywordContext = {
  primaryKeywords: string[];
  supportingKeywords: string[];
  avoidKeywords?: string[];
};

export const DEFAULT_SEO_KEYWORD_CONTEXT: SeoKeywordContext = {
  primaryKeywords: [
    "website monitoring",
    "website performance monitoring",
    "SEO monitoring",
    "uptime monitoring",
  ],
  supportingKeywords: [
    "traffic analytics",
    "SEO recommendations",
    "website health dashboard",
    "deploy monitoring",
    "response code monitoring",
  ],
  avoidKeywords: ["cheap hack", "guaranteed rankings"],
};

function wordsFromDomain(domain: string): string[] {
  const host = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? domain;
  const root = host.split(".")[0] ?? host;
  return root
    .split(/[-_]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

export function buildSiteKeywordContext(input: {
  name?: string | null;
  primaryDomain: string;
}): SeoKeywordContext {
  const domain = input.primaryDomain.trim().toLowerCase();
  const name = input.name?.trim();
  const domainWords = wordsFromDomain(domain);
  const readableDomainTopic = domainWords.join(" ");

  return {
    primaryKeywords: normalizeKeywordList([
      ...(name ? [name] : []),
      domain,
      ...(readableDomainTopic ? [readableDomainTopic] : []),
    ]),
    supportingKeywords: normalizeKeywordList([
      `${name || readableDomainTopic || domain} website`,
      `${name || readableDomainTopic || domain} services`,
      `${name || readableDomainTopic || domain} contact`,
      `${name || readableDomainTopic || domain} about`,
    ]),
    avoidKeywords: DEFAULT_SEO_KEYWORD_CONTEXT.avoidKeywords,
  };
}

export function normalizeKeywordList(keywords: string[]): string[] {
  return [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))]
    .slice(0, 20);
}

export function normalizeKeywordContext(
  context: SeoKeywordContext | null | undefined,
): SeoKeywordContext | null {
  if (!context) return null;
  const primaryKeywords = normalizeKeywordList(context.primaryKeywords);
  const supportingKeywords = normalizeKeywordList(context.supportingKeywords);
  const avoidKeywords = normalizeKeywordList(context.avoidKeywords ?? []);

  if (primaryKeywords.length === 0 && supportingKeywords.length === 0) {
    return null;
  }

  return {
    primaryKeywords,
    supportingKeywords,
    avoidKeywords,
  };
}
