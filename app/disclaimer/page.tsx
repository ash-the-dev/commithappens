import type { Metadata } from "next";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Disclaimer | Commit Happens",
  description:
    "Important limitations for Commit Happens monitoring, SEO insights, uptime checks, and AI-assisted recommendations.",
  alternates: { canonical: "/disclaimer" },
};

const sections: LegalSection[] = [
  {
    title: "No Guaranteed Results",
    body: [
      "Commit Happens does not guarantee:",
      [
        "Search rankings",
        "Traffic increases",
        "Revenue increases",
        "Conversion improvements",
        "Website performance improvements",
        "Zero downtime",
        "Complete issue detection",
        "Legal, compliance, or security outcomes",
      ],
      "Recommendations are informational and should be reviewed before implementation.",
    ],
  },
  {
    title: "SEO Disclaimer",
    body: [
      "SEO recommendations are based on available crawl data, page signals, and general best practices.",
      "Search engines use many factors outside our control. We do not guarantee placement, indexing, rankings, traffic, or visibility.",
    ],
  },
  {
    title: "AI Disclaimer",
    body: [
      "AI-generated recommendations may be incomplete, incorrect, outdated, or unsuitable for your specific situation.",
      "You are responsible for reviewing AI output before using it.",
    ],
  },
  {
    title: "Uptime Disclaimer",
    body: [
      "Uptime checks are based on scheduled probes and available network conditions.",
      "A successful check does not guarantee that every visitor, device, region, or provider can access your site at all times.",
      "A failed check may reflect downtime, network issues, provider issues, rate limiting, DNS problems, or other external causes.",
    ],
  },
  {
    title: "Third-Party Services",
    body: [
      "Commit Happens may rely on third-party services for hosting, payments, AI, crawling, analytics, database infrastructure, and other functionality.",
      "We are not responsible for third-party outages, API changes, pricing changes, limits, errors, or interruptions.",
    ],
  },
  {
    title: "Use at Your Own Risk",
    body: [
      "You are responsible for decisions made using Commit Happens data.",
      "Do not treat the product as a substitute for professional technical, legal, financial, cybersecurity, or marketing advice.",
    ],
  },
  {
    title: "Contact",
    body: ["Questions? Email: commithappens@gmail.com"],
  },
];

export default function DisclaimerPage() {
  return (
    <LegalPageLayout
      title="Disclaimer"
      subtitle="Commit Happens provides website monitoring, crawl insights, uptime checks, and AI-assisted recommendations. It is a helpful tool, not a crystal ball wearing a blazer."
      sections={sections}
    />
  );
}
