export type SeoPriorityLabel = "Fix first" | "Fix soon" | "Worth cleaning up" | "Nice to improve";
export type SeoEffort = "Quick fix" | "Moderate fix" | "Bigger fix";

export type SeoRecommendationCopy = {
  title: string;
  plainMeaning: string;
  whyItMatters: string;
  recommendedFix: string;
  priorityLabel: SeoPriorityLabel;
  effort: SeoEffort;
  impactArea: string;
  ownerHint: string;
};

const COPY: Record<string, SeoRecommendationCopy> = {
  missing_h1: {
    title: "Missing main heading",
    plainMeaning: "This page does not have a clear main heading.",
    whyItMatters: "Visitors and search engines use the main heading to understand what the page is about.",
    recommendedFix: "Add one clear H1 that describes the main purpose of this page.",
    priorityLabel: "Fix soon",
    effort: "Quick fix",
    impactArea: "SEO + clarity",
    ownerHint: "This is usually a content or page-template fix.",
  },
  duplicate_title: {
    title: "Duplicate page title",
    plainMeaning: "Multiple pages are using the same title.",
    whyItMatters: "When titles are duplicated, search engines may struggle to understand which page should rank for which topic.",
    recommendedFix: "Give each page a unique title that describes what makes that page different.",
    priorityLabel: "Fix soon",
    effort: "Moderate fix",
    impactArea: "SEO",
    ownerHint: "Start with important pages like your homepage, pricing page, service pages, and landing pages.",
  },
  duplicate_meta_description: {
    title: "Duplicate meta description",
    plainMeaning: "Multiple pages are using the same search preview text.",
    whyItMatters: "Duplicate descriptions can make your pages look repetitive in search results and may reduce clicks.",
    recommendedFix: "Write a unique 120-155 character summary for each important page.",
    priorityLabel: "Worth cleaning up",
    effort: "Moderate fix",
    impactArea: "SEO + click-through",
    ownerHint: "Focus on pages that bring in leads, signups, or sales first.",
  },
  missing_meta_description: {
    title: "Missing meta description",
    plainMeaning: "This page does not have a search result summary.",
    whyItMatters: "Meta descriptions do not directly guarantee rankings, but they can influence whether someone clicks your page.",
    recommendedFix: "Add a short, clear summary of the page around 120-155 characters.",
    priorityLabel: "Fix soon",
    effort: "Quick fix",
    impactArea: "SEO + click-through",
    ownerHint: "Think of it like ad copy for your page in Google.",
  },
  short_title: {
    title: "Page title may be too short",
    plainMeaning: "The title may not give enough context.",
    whyItMatters: "Short titles can miss important keywords or make the page feel vague in search results.",
    recommendedFix: "Expand the title so it clearly explains the page in roughly 50-60 characters.",
    priorityLabel: "Worth cleaning up",
    effort: "Quick fix",
    impactArea: "SEO",
    ownerHint: "Add the page topic, service, location, or brand where it makes sense.",
  },
  long_title: {
    title: "Page title may be too long",
    plainMeaning: "The title is long enough that it may get cut off in search results.",
    whyItMatters: "If the important words appear too late, visitors may not see the reason to click.",
    recommendedFix: "Shorten the title and put the most important phrase near the front.",
    priorityLabel: "Worth cleaning up",
    effort: "Quick fix",
    impactArea: "SEO + click-through",
    ownerHint: "Keep the strongest words early.",
  },
  broken_page: {
    title: "Page is returning an error",
    plainMeaning: "This page is not loading successfully.",
    whyItMatters: "Broken pages hurt user trust and can waste search engine crawl attention.",
    recommendedFix: "Fix the page, redirect it to a working URL, or remove internal links pointing to it.",
    priorityLabel: "Fix first",
    effort: "Moderate fix",
    impactArea: "Technical SEO",
    ownerHint: "This is one of the first things to clean up.",
  },
  weak_internal_linking: {
    title: "Weak internal linking",
    plainMeaning: "This page has very few links connecting it to the rest of your site.",
    whyItMatters: "Internal links help visitors and search engines discover related pages.",
    recommendedFix: "Add relevant links to and from this page where they naturally help the reader.",
    priorityLabel: "Worth cleaning up",
    effort: "Moderate fix",
    impactArea: "SEO + navigation",
    ownerHint: "Link from high-value pages to pages you want people to find.",
  },
  excessive_links: {
    title: "Too many links on the page",
    plainMeaning: "This page may have more links than visitors can reasonably use.",
    whyItMatters: "Too many links can dilute focus and make the page harder to navigate.",
    recommendedFix: "Group, simplify, or remove links that do not support the page's main goal.",
    priorityLabel: "Nice to improve",
    effort: "Moderate fix",
    impactArea: "User experience",
    ownerHint: "Keep links that help people take the next useful step.",
  },
};

const FALLBACK: SeoRecommendationCopy = {
  title: "SEO issue found",
  plainMeaning: "This page has something worth reviewing.",
  whyItMatters: "Small technical and content issues can add up over time.",
  recommendedFix: "Review this issue and decide whether it affects an important page.",
  priorityLabel: "Worth cleaning up",
  effort: "Moderate fix",
  impactArea: "SEO",
  ownerHint: "Start with pages that matter most to your business.",
};

export function getSeoRecommendation(issueType: string, _context?: unknown): SeoRecommendationCopy {
  return COPY[issueType] ?? FALLBACK;
}
