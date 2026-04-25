/**
 * Plain-English explanations for SEO crawl terms and related dashboard metrics.
 * Rule-based only — no AI. Safe fallbacks for unknown or missing issue_type.
 */

export type HelpPanelContent = {
  term: string;
  definition: string;
  whyItMatters: string;
  improvementTip: string;
};

const FALLBACK_ISSUE: HelpPanelContent = {
  term: "Crawl finding",
  definition:
    "This item was detected during the crawl, but it does not have a detailed explanation in our library yet.",
  whyItMatters: "It can still be worth a quick look, especially if it affects a page customers use.",
  improvementTip: "Review the page and check whether visitors can access and understand it clearly.",
};

const FALLBACK_METRIC: HelpPanelContent = {
  term: "Metric",
  definition: "A number we show on your dashboard. This one does not have a custom explanation yet.",
  whyItMatters: "Metrics help you spot changes over time, even when a label feels a bit technical.",
  improvementTip: "If something looks off, open the related section and compare a few time ranges.",
};

/** Rule-based first steps per issue type (no ranking guarantees). */
const ISSUE_SUGGESTION_BULLETS: Record<string, string[]> = {
  missing_title: [
    "Add a unique page title that says what this page is about in plain language.",
    "Keep it specific and useful, not just your business name on every page.",
  ],
  missing_meta_description: [
    "Add a short description explaining what someone can do or learn on this page.",
    "Aim for one or two clear sentences. Skip keyword stuffing; write for a real person.",
  ],
  missing_h1: [
    "Add one clear main heading near the top of the page that names the main topic.",
    "Avoid more than one “main” heading unless your template truly needs that structure.",
  ],
  broken_page: [
    "Update links that still point to this address, or fix the page if it was moved on purpose.",
    "If the content lives elsewhere, use a single redirect to the best replacement page.",
  ],
  server_error: [
    "Check hosting, recent deployments, and any plugins or themes that just shipped.",
    "If it keeps happening, your host or server error logs are the fastest place to look.",
  ],
  redirect: [
    "Confirm this redirect is meant to be there (for example after a page move).",
    "Try to keep chains short: too many hops in a row can slow visitors down for no good reason.",
  ],
  healthy: [
    "No rule-based fix is required for this check right now—still spot-check the page in a real browser from time to time.",
  ],
  unknown: [
    "Review the URL in a normal browser, including on mobile, and see if the experience matches what you expect.",
  ],
};

const ISSUE_EXPLANATIONS: Record<string, HelpPanelContent> = {
  healthy: {
    term: "Healthy (this check)",
    definition:
      "The crawl did not flag a high-priority problem for this page with the rules we use today. It is still worth opening the page yourself once in a while.",
    whyItMatters: "Even “healthy” pages can have user-experience or content issues that rules do not see.",
    improvementTip: "Keep an eye on real visitors: forms, key paths, and mobile layout matter as much as checklists.",
  },
  server_error: {
    term: "Server error (5xx)",
    definition: "The site returned a server-side error when this URL was requested (often 500–599).",
    whyItMatters: "People may see an error page instead of your content, and the page may be temporarily unavailable to tools as well as humans.",
    improvementTip: "Check hosting, recent code or plugin changes, and server logs. Fix the underlying error before fine-tuning SEO details.",
  },
  broken_page: {
    term: "Broken page (404)",
    definition: "A page visitors (or the crawler) tried to open, but the server said it was not found.",
    whyItMatters: "Dead links are frustrating, and they can make your site look neglected even when the rest of the site is solid.",
    improvementTip: "Update internal links, restore the page if it was removed by mistake, or redirect to the closest useful page.",
  },
  redirect: {
    term: "Redirect (3xx)",
    definition: "The server did not return the final page content directly. It sent the browser to another URL first.",
    whyItMatters: "A few clean redirects are normal. Long or messy chains can slow people down and hide real content.",
    improvementTip: "Use one intentional redirect to the new URL, and point internal links to the final address when you can.",
  },
  missing_title: {
    term: "Missing page title",
    definition: "The page does not have a clear title in the <title> field for this crawl, or it was empty.",
    whyItMatters: "The title is often the first line people see in search results, tabs, and bookmarks. An empty or generic one makes the page look unfinished.",
    improvementTip: "Add a specific title for each important page, not the same name on every page.",
  },
  missing_h1: {
    term: "Missing main heading (H1)",
    definition: "The page is missing a clear main heading in the crawl, or the heading was empty.",
    whyItMatters: "A single clear heading helps people scan the page and tells them they are in the right place.",
    improvementTip: "Add one main heading that describes the page in simple words, near the top of the main content.",
  },
  missing_meta_description: {
    term: "Missing meta description",
    definition: "The short text snippet some search systems may show under your title was missing or empty for this page.",
    whyItMatters: "A good line or two can help people decide to click, though not every result will show it.",
    improvementTip: "Write a 1–2 sentence summary in plain language. Describe what the reader gets, not a list of keyword phrases.",
  },
};

const METRIC_EXPLANATIONS: Record<string, HelpPanelContent> = {
  site_health_score: {
    term: "Site health score (crawl)",
    definition: "A quick score from 0–100 that sums up this crawl. It is based on simple rules, not a promise about rankings.",
    whyItMatters: "A lower score usually means the crawl found more problems for visitors and tools to trip over, not a judgment on you personally.",
    improvementTip: "Start with critical items, then warnings, then notices. Re-run a crawl after fixes to see the score move.",
  },
  top_fixes: {
    term: "Top fixes",
    definition: "A short list of the most important URLs from the latest stored crawl, ordered by how serious the issue looks under our rules.",
    whyItMatters: "It helps you see where to look first if you have limited time.",
    improvementTip: "Work the list from top to bottom, then re-import a crawl to confirm things improved.",
  },
  severity_critical: {
    term: "Critical issues",
    definition: "Issues we treat as the most urgent in this crawl, such as many server errors that block access.",
    whyItMatters: "These are often the ones that can stop people (and checks) from seeing the page at all.",
    improvementTip: "Fix availability and hard errors first; small tuning comes after the site is reachable.",
  },
  severity_warning: {
    term: "Warnings",
    definition: "Problems that are serious but not always site-wide emergencies—like missing titles or 404s on important pages.",
    whyItMatters: "They can hurt experience and trust even when the site is basically online.",
    improvementTip: "Tackle the warnings that line up with high-traffic or money pages first.",
  },
  severity_notice: {
    term: "Notices",
    definition: "Smaller issues to know about, such as missing meta descriptions or redirects, depending on the rule.",
    whyItMatters: "They are lower urgency but still add up in large numbers.",
    improvementTip: "Batch-fix templates when you can, so every new page benefits.",
  },
  count_healthy: {
    term: "Healthy (count)",
    definition: "How many pages in this run passed our high-priority rules without a serious flag.",
    whyItMatters: "A high count is a good sign the crawl did not see major red flags for those URLs.",
    improvementTip: "Randomly test a few of those pages on mobile anyway—automation is not a substitute for a real visit.",
  },
  pages_crawled: {
    term: "Pages crawled",
    definition: "How many URLs this crawl stored for your site. It depends on what the import saw in your data source.",
    whyItMatters: "A much smaller number than you expect can mean a filter, a site map, or a crawl source limit is involved.",
    improvementTip: "If coverage looks wrong, re-check the crawl setup and the domain you are importing for.",
  },
  uptime: {
    term: "Uptime",
    definition: "Whether our checks could reach your site on a simple schedule, shown as a simple status and history where available.",
    whyItMatters: "If the site is down, marketing and support work harder, and visitors leave before you know why.",
    improvementTip: "If you see flapping or downtime, look at hosting health, SSL, DNS, and any recent deploys first.",
  },
  response_time: {
    term: "Response time",
    definition: "How long the site took to respond in our check (usually for one request from our monitor).",
    whyItMatters: "A slow or jumpy response can mean visitors wait longer even when the page “eventually” loads.",
    improvementTip: "Check hosting, database load, and heavy images or scripts. Our number is a signal, not a full performance audit.",
  },
  http_status: {
    term: "HTTP status",
    definition: "A three-digit code the server sent back, like 200 (OK), 404 (not found), 301 (moved), or 500 (server error).",
    whyItMatters: "It tells you at a glance whether the URL answered normally, sent people elsewhere, or failed.",
    improvementTip: "Match the code to a fix: missing page vs redirect vs real server bug.",
  },
  pageviews: {
    term: "Pageviews",
    definition: "How many times a page on your site was loaded and counted, based on the tracker you installed.",
    whyItMatters: "It shows how much people are moving around, not just how many visits started.",
    improvementTip: "Compare to sessions: if pageviews are low compared to demand, you may have navigation or single-page issues.",
  },
  sessions: {
    term: "Sessions",
    definition: "A group of page loads we tie together as one visit, using our best-effort session rules in the browser.",
    whyItMatters: "It is a simple way to see if demand to your site is growing or shrinking over time.",
    improvementTip: "If sessions are flat but you expect more traffic, check that the script is on every key template.",
  },
  web_vitals: {
    term: "Web vitals (Core Web Vitals)",
    definition: "Real-user speed and stability numbers from people using your site, not a single lab test. Common ones include load time, layout shift, and how snappy interactions feel.",
    whyItMatters: "Sluggish or jumpy pages feel bad first; search and conversion effects can follow.",
    improvementTip: "Fix the worst pages in your data first, then re-check after a week or so of real traffic.",
  },
  events: {
    term: "Events",
    definition: "Actions you have chosen to track, like a button click, form submit, or purchase step, beyond a plain pageview.",
    whyItMatters: "They connect traffic to real outcomes, not just “people showed up.”",
    improvementTip: "Pick a small set of key events, keep names consistent, and review them alongside sessions and pageviews.",
  },
  internal_links: {
    term: "Internal links",
    definition: "Links from this page to other URLs. We may show how many the crawl saw, depending on your import.",
    whyItMatters: "Good internal links help people discover related pages. Zero or very few on a long article can be a sign something is off.",
    improvementTip: "Add helpful links to related products, help articles, and next steps where it feels natural, not a giant wall of them.",
  },
  seo_crawl_section: {
    term: "SEO crawl snapshot",
    definition: "A readout from your most recent import: a simple health score, counts, and a few of the most important URLs to fix, using rule-based checks.",
    whyItMatters: "It is a low-drama way to see whether recent changes left obvious holes before you go deeper in advanced reports.",
    improvementTip: "Re-import after meaningful site changes, then work the top fixes first.",
  },
  traffic_overview: {
    term: "Traffic (overview card)",
    definition: "A quick read on visits and engagement for this site. The card links to the traffic section for more detail.",
    whyItMatters: "It helps you see if people are actually reaching your pages, not just that the dashboard exists.",
    improvementTip: "If numbers look off, check that the script is on every page that matters, including your checkout and thank-you pages.",
  },
  performance_overview: {
    term: "Performance (overview card)",
    definition: "A high-level look at how often your site is reachable and how it is behaving in monitoring or analytics.",
    whyItMatters: "A fast, stable site is part of a good first impression, especially on mobile and repeat visits.",
    improvementTip: "Dive into the performance section to see response times, uptime, and any SEO health notes we show for this plan.",
  },
  issues_overview: {
    term: "Issues (overview card)",
    definition: "A count of open issue-style signals we have for this site in your intelligence data (not a legal guarantee, just a dashboard signal).",
    whyItMatters: "It helps you see when something in your data changed enough to deserve attention.",
    improvementTip: "Open the issues section, read the top items, and fix the ones tied to product or support impact first.",
  },
  health_overview: {
    term: "Health (overview card)",
    definition: "A summary tied to how much quality telemetry we are seeing, such as real-user performance measures where available.",
    whyItMatters: "It flags when you are flying blind (no or little data) versus when the tracker is really working.",
    improvementTip: "If health looks empty, get the snippet live on a few real user flows and check back after a day.",
  },
  changes_overview: {
    term: "Changes (overview card)",
    definition: "A simple count of recent change records we know about, such as deploys, so you can connect traffic shifts to work that shipped.",
    whyItMatters: "It reduces guesswork: “we launched something, did anything move?”",
    improvementTip: "When numbers move, look at the change detail that lines up in time, then test the affected user paths.",
  },
  anomalies_overview: {
    term: "Anomalies (overview card)",
    definition: "Unusual movement in a metric we track compared to a recent baseline, when we have enough data to show it.",
    whyItMatters: "A spike or drop is the start of a question, not the answer.",
    improvementTip: "Check campaigns, site outages, and tracking mistakes before you assume it is a long-term trend.",
  },
  trend_seo_health: {
    term: "SEO health over time (line)",
    definition:
      "A simple line of stored crawl health scores, newest runs on the right. It is a rule-based 0–100, not a Google ranking score.",
    whyItMatters: "A steady or climbing line usually means your last fixes are sticking. A sharp drop means something on the site (or the crawl) changed.",
    improvementTip: "Re-run a crawl after major launches, then compare this line to the week before. Fix criticals first, then warnings.",
  },
  trend_seo_issues: {
    term: "Issue count over time (crawl line)",
    definition:
      "The total notices, warnings, and critical flags we saw on each import. Think of it as “how many raised hands” from the crawl, not a moral judgment.",
    whyItMatters: "A falling line (fewer open signals) is a quiet brag. A rising one means you shipped risk, a crawl widened, or a rule found more detail.",
    improvementTip: "Tackle the top fixes in the report, re-import, and watch this bend downward.",
  },
  trend_uptime_probe: {
    term: "Uptime checks over time",
    definition:
      "How our scheduled probes read each check: we plot a simple 100% when the check looked “up” and 0% when it was clearly not. (Degraded sits in the middle for visibility.)",
    whyItMatters: "Downtime is a silent tax on ad spend, support, and trust — even a short blip can lose people who will never complain out loud.",
    improvementTip: "If you see frequent dips, look at hosting, SSL renewals, DNS, and any deploys that line up in time.",
  },
  trend_response_probe: {
    term: "Response time from monitors",
    definition:
      "Time until our probe got a first useful answer back from your server, shown over recent checks. Empty gaps can mean the monitor did not record timing yet.",
    whyItMatters: "A creeping line can be an early nudge on hosting load, big images, or database pain — before you hear about it in reviews.",
    improvementTip: "If response climbs but uptime stays 100%, profile slow templates and your host. This is a hint, not a full page-speed audit.",
  },
  onpage_titles: {
    term: "Page titles in the crawl",
    definition:
      "The <title> text people see in browser tabs, bookmarks, and sometimes search. We count pages where a title was present vs missing in the latest import.",
    whyItMatters: "A blank or repeated title is like sending someone to a door with no sign — it feels untrustworthy fast.",
    improvementTip: "Write a unique title for each key page, plain language, what the page is for in ~50–60 characters of honesty.",
  },
  onpage_meta: {
    term: "Meta descriptions",
    definition:
      "A short blurb in the page head that some search results may use under your title, when they choose to show it.",
    whyItMatters: "A strong one helps humans decide to click, even if search engines do not show it every time.",
    improvementTip: "One or two clear sentences, benefit-led, with no fake excitement or keyword walls.",
  },
  onpage_h1: {
    term: "H1 headings",
    definition:
      "The main visible heading for the page. It should usually match the topic people expect from the link they clicked.",
    whyItMatters: "A missing or vague H1 is a bounce risk — people decide in seconds if they are in the right place.",
    improvementTip: "Add one clear H1 near the top. Match it to the job the page is supposed to do.",
  },
  onpage_internal_links: {
    term: "Internal links in the crawl",
    definition: "Out-links the crawler could see from your pages to other URLs, when we stored a link list in the import.",
    whyItMatters: "Good internal links help people find the next thing to read, product to buy, or help article to open.",
    improvementTip: "Add useful next steps. Avoid orphan pages: if something matters, at least one other page should point to it.",
  },
  onpage_indexability: {
    term: "Indexability snapshot",
    definition:
      "A rough look at which crawled pages returned a normal 200-range response vs redirects/errors in this import. It is a plumbing view, not a full Google Search Console view.",
    whyItMatters: "If the basics are off (lots of 404/500), the fanciest copy will not save you.",
    improvementTip: "Fix server errors and accidental 404s first, then work metadata.",
  },
  onpage_broken_links: {
    term: "Broken or error pages in this crawl",
    definition:
      "Pages that looked like a client or server error to our rules, like a 404 or 5xx, based on the crawl’s HTTP view.",
    whyItMatters: "If customers hit these, you pay twice: the lost visit and the quiet doubt that your site is maintained.",
    improvementTip: "Point links to a real destination, or restore the page. Use one clean redirect, not a chain of maybes.",
  },
  onpage_missing_duplicate: {
    term: "Missing or thin content signals",
    definition:
      "A bundle of on-page issues where titles, H1, or meta were missing, or a future duplicate rule fired in the crawl. Some advanced duplicate detection may show “not flagged yet” until configured.",
    whyItMatters: "Empty basics make every channel work harder, from ads to search to word-of-mouth.",
    improvementTip: "Start with the pages that earn you money, leads, or support deflection, then work outward.",
  },
  seo_top_pages_bars: {
    term: "Top pages (bar chart)",
    definition:
      "The paths that got the most verified pageviews in the last 14 days of tracker data, after we filter out obvious search bots by user agent.",
    whyItMatters: "These are the doors people are actually using — if the top few are clunky, you are leaving revenue in the hall.",
    improvementTip: "Open the top 3 on your phone and be picky about the first screen: speed, message match, and one obvious next action.",
  },
  seo_response_health_score: {
    term: "Health score in this report",
    definition: "A composite 0–100 from how many pages fell into healthy, redirect, error, and “other” buckets in your status-code import.",
    whyItMatters: "A higher score means fewer scary outcomes in the raw crawl, not a promise of rankings or fame.",
    improvementTip: "Chase 404/5xx first, then messy redirects, then the smaller polish work.",
  },
  seo_response_issues: {
    term: "Issues found in this report",
    definition:
      "Count of structured issue rows in the import — pages where status codes, redirects, or server behavior looked off under our rules.",
    whyItMatters: "It is a quick pressure gauge, not a complete legal audit of every line of HTML.",
    improvementTip: "Start with the items marked high priority in the list below, then re-run a crawl to confirm the delta.",
  },
  issue_movement: {
    term: "New vs resolved issues",
    definition: "A simple ledger of issues that first appeared in this run versus issues that no longer show up, compared to the run before.",
    whyItMatters: "A healthy site usually trends toward more resolutions than new surprises over time (even if the absolute count is not zero).",
    improvementTip: "If the “new” side keeps winning, make time for a focused fix pass before piling on new marketing spend.",
  },
};

export type CrawlPageHint = {
  url?: string;
  status?: number | null;
  title?: string | null;
  meta_description?: string | null;
  h1?: string | null;
  /** From crawl storage when available. */
  internalLinksCount?: number | null;
};

/**
 * Explanations for a known issue_type from the crawl (e.g. missing_h1) or a fallback.
 */
export function getIssueExplanation(issueType: string | null | undefined): HelpPanelContent {
  if (issueType == null || !String(issueType).trim()) {
    return { ...FALLBACK_ISSUE };
  }
  const key = issueType.toLowerCase().trim();
  if (key === "unknown" || key === "null") {
    return { ...FALLBACK_ISSUE, term: "Unknown crawl item" };
  }
  const hit = ISSUE_EXPLANATIONS[key];
  if (hit) {
    return { ...hit };
  }
  return { ...FALLBACK_ISSUE, term: "Crawl item" };
}

function cleanMetricGet(key: string, originalKey: string): HelpPanelContent {
  return METRIC_EXPLANATIONS[key] ? { ...METRIC_EXPLANATIONS[key]! } : { ...FALLBACK_METRIC, term: originalKey || "Metric" };
}

/**
 * Explanations for labels like the site health card, uptime, and analytics KPIs.
 */
export function getMetricExplanation(metricKey: string): HelpPanelContent {
  const k = metricKey.toLowerCase().trim();
  return cleanMetricGet(k, metricKey);
}

const UNKNOWN_SUGGESTIONS = ISSUE_SUGGESTION_BULLETS.unknown!;

/**
 * A few short, rule-based follow-ups, optionally nudged by this page’s crawl fields.
 */
export function getImprovementSuggestion(issueType: string | null | undefined, page?: CrawlPageHint): string[] {
  const key = (issueType ?? "unknown").toLowerCase().trim();
  const base = (ISSUE_SUGGESTION_BULLETS[key] ?? [...UNKNOWN_SUGGESTIONS]).map((b) => b);
  const extra: string[] = [];

  if (page) {
    const st = page.status;
    if (st != null && st >= 500) {
      extra.push("If the error is intermittent, note the time and try again; your host can match that to server logs.");
    }
    if (st === 404) {
      extra.push("If this URL should not exist, consider a helpful 404 page with search or main navigation.");
    }
    if (page.internalLinksCount != null && page.internalLinksCount < 1 && (key === "missing_h1" || key === "missing_title")) {
      extra.push("This page has few or no out-links in the crawl; consider linking to a logical next step for readers.");
    }
  }

  // Cap list length; keep it readable for small business owners
  return [...base, ...extra].slice(0, 4);
}
