import type { SiteAnalytics } from "@/lib/db/analytics";
import type { AnalyticsScanSummary } from "@/lib/db/scans";

export type AnalyticsInsightReport = {
  trafficSummary: string;
  engagementSummary: string;
  audienceSummary: string;
  eventSummary: string;
  confidenceLevel: "early signal" | "confirmed trend" | "needs more data";
  recommendedActions: string[];
};

function plural(value: number, singular: string, pluralLabel = `${singular}s`): string {
  return `${value.toLocaleString("en-US")} ${value === 1 ? singular : pluralLabel}`;
}

export function buildAnalyticsInsightReport(input: {
  analytics?: SiteAnalytics | null;
  summary?: AnalyticsScanSummary | null;
}): AnalyticsInsightReport {
  const analytics = input.analytics;
  const traffic24h = input.summary?.traffic_24h ?? analytics?.overview.sessions24h ?? 0;
  const trend = input.summary?.trend ?? "flat";
  const sessions30d = analytics?.overview.sessions30d ?? 0;
  const events24h = analytics?.overview.events24h ?? 0;
  const pageviews24h = analytics?.overview.pageviews24h ?? 0;
  const topPage = analytics?.topPages[0] ?? null;
  const vitalCount = analytics?.vitalAverages.reduce((sum, vital) => sum + vital.samples, 0) ?? 0;

  const confidenceLevel =
    sessions30d >= 100 || traffic24h >= 25
      ? "confirmed trend"
      : sessions30d > 0 || traffic24h > 0
        ? "early signal"
        : "needs more data";

  const trafficSummary =
    traffic24h <= 0
      ? "Traffic is just getting started. That is normal for a young site, not a disaster siren."
      : trend === "up"
        ? `${plural(traffic24h, "visit")} in the last 24 hours, and the short trend is up. Tiny parade, still a parade.`
        : trend === "down"
          ? `${plural(traffic24h, "visit")} in the last 24 hours, but traffic dipped. Check the obvious stuff before blaming the moon.`
          : `${plural(traffic24h, "visit")} in the last 24 hours. Steady is useful when you know what changed.`;

  const engagementSummary =
    pageviews24h > traffic24h && traffic24h > 0
      ? "Visitors are looking at more than one thing. Good sign. Now make sure the next click is obvious."
      : vitalCount > 0
        ? "Real browser signals are coming in, so performance advice can use receipts instead of vibes."
        : "Engagement data is thin. The tracker may be new, or the internet is simply being dramatic elsewhere.";

  const audienceSummary = topPage
    ? `Attention is pooling on ${topPage.path}. Protect that page like it pays rent.`
    : "No clear top page yet. Once traffic lands, we will tell you where people are actually showing up.";

  const eventSummary =
    events24h > 0
      ? `${plural(events24h, "event")} fired in the last 24 hours. That gives us behavior to interpret, not just page-load confetti.`
      : "No custom events fired recently. If forms or calls-to-action matter, make sure they are tracked.";

  const recommendedActions = [
    topPage ? `Open ${topPage.path} on mobile and make the next action painfully obvious.` : "Generate a little real traffic so the tracker can stop guessing.",
    events24h > 0 ? "Review the events that matter most and ignore vanity clicks." : "Track the main conversion action before chasing prettier charts.",
    traffic24h <= 0 ? "Confirm the script is installed on the live pages you care about." : "Compare this after your next SEO crawl or campaign push.",
  ];

  return {
    trafficSummary,
    engagementSummary,
    audienceSummary,
    eventSummary,
    confidenceLevel,
    recommendedActions,
  };
}
