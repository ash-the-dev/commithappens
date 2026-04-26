import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout, type LegalSection, SUPPORT_EMAIL } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "About | Commit Happens",
  description:
    "Learn how Commit Happens helps website owners understand uptime, SEO crawl signals, AI recommendations, and what changed after deployment.",
  alternates: { canonical: "/about" },
};

const sections: LegalSection[] = [
  {
    title: "What Commit Happens Does",
    body: [
      "Commit Happens helps website owners, builders, freelancers, and small businesses understand what changed after updates go live.",
      [
        "Whether your site is up",
        "Whether pages are responding properly",
        "Basic SEO crawl signals",
        "Page titles, meta descriptions, headings, and structure",
        "Internal link signals",
        "AI-assisted recommendations",
        "Priority fixes so you know what to tackle first",
      ],
      "We are not here to drown you in charts. We are here to tell you what needs attention before your site starts quietly embarrassing you in public.",
    ],
  },
  {
    title: "Why It Exists",
    body: [
      "Most website tools assume you already speak fluent developer, SEO, analytics, and panic.",
      [
        "Is my site working?",
        "What broke?",
        "What changed?",
        "What should I fix first?",
        "Is this important or just dashboard confetti?",
        "How do I explain this to a client, boss, or future version of myself?",
      ],
      "The goal is simple: less guessing, more fixing.",
    ],
  },
  {
    title: "Who It’s For",
    body: [
      [
        "Small business owners",
        "Web designers",
        "Freelancers",
        "Agencies",
        "Indie hackers",
        "Developers who want cleaner post-deploy visibility",
        "Anyone responsible for a website who does not want to manually inspect everything like it’s 2009",
      ],
    ],
  },
  {
    title: "What Makes It Different",
    body: [
      "Commit Happens is not trying to be a giant enterprise dashboard with 900 knobs and a haunted sidebar.",
      [
        "Clear site health signals",
        "Uptime visibility",
        "Crawl-based issue detection",
        "Practical recommendations",
        "Prioritized fixes",
        "Plain-English explanations",
      ],
      "The product should always answer: “What should I look at first, and why?”",
    ],
  },
  {
    title: "Important Note",
    body: [
      "Commit Happens provides monitoring, crawl insights, and recommendations based on available data. It does not guarantee search rankings, traffic increases, revenue increases, or magical internet applause.",
      "We help you spot issues and make smarter decisions. The fixing still requires action, strategy, and occasionally coffee.",
    ],
  },
];

export default function AboutPage() {
  return (
    <LegalPageLayout
      title="About Commit Happens"
      subtitle="Deploys are exciting. Broken pages, mystery traffic drops, missing metadata, slow responses, and “why is this page weird now?” are less exciting. Commit Happens turns site health, uptime, crawl results, and plain-English recommendations into something normal people can actually use."
      sections={sections}
    >
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`mailto:${SUPPORT_EMAIL}`}
          className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black transition hover:bg-brand-muted"
        >
          Contact Support
        </Link>
      </div>
      <p className="mt-4 text-sm font-semibold text-white/70">
        Your site changes. Commit Happens tells you what actually happened.
      </p>
    </LegalPageLayout>
  );
}
