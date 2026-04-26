import type { Metadata } from "next";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service | Commit Happens",
  description:
    "Terms governing use of Commit Happens website monitoring, crawl analysis, AI recommendations, and related services.",
  alternates: { canonical: "/terms" },
};

const sections: LegalSection[] = [
  {
    title: "1. What Commit Happens Provides",
    body: [
      "Commit Happens provides website monitoring and analysis tools, including but not limited to:",
      [
        "Uptime checks",
        "Website crawl insights",
        "SEO-related page signals",
        "AI-assisted recommendations",
        "Dashboard summaries",
        "Alerts and reports",
        "Site health information",
      ],
      "Commit Happens is designed to help users understand website issues and opportunities. It is not a replacement for professional legal, financial, cybersecurity, or SEO advice.",
    ],
  },
  {
    title: "2. Accounts",
    body: [
      "You are responsible for maintaining the security of your account credentials.",
      "You agree to provide accurate account information and to keep your login information secure. You are responsible for activity that occurs under your account.",
    ],
  },
  {
    title: "3. Website Authorization",
    body: [
      "You may only monitor, crawl, scan, or analyze websites that you own, manage, or are authorized to test.",
      "Do not use Commit Happens to crawl, probe, monitor, or analyze websites without permission.",
    ],
  },
  {
    title: "4. Acceptable Use",
    body: [
      "You agree not to:",
      [
        "Abuse, overload, or disrupt our systems",
        "Use Commit Happens to attack or harass third-party websites",
        "Attempt unauthorized access to accounts, systems, or data",
        "Reverse engineer, scrape, or misuse the service",
        "Upload malicious content",
        "Use the service for illegal activity",
      ],
      "We may suspend or terminate accounts that violate these rules.",
    ],
  },
  {
    title: "5. AI Recommendations",
    body: [
      "Commit Happens may use AI to generate recommendations, summaries, suggested wording, and prioritization guidance.",
      "AI-generated output may be incomplete, inaccurate, or unsuitable for your specific circumstances. You are responsible for reviewing recommendations before relying on them.",
      "We do not guarantee rankings, traffic, revenue, or business outcomes.",
    ],
  },
  {
    title: "6. Payments and Subscriptions",
    body: [
      "Paid plans may be billed through third-party payment processors such as Stripe.",
      "By purchasing a paid plan, you agree to the listed pricing, billing schedule, and plan limits at the time of purchase.",
      "You are responsible for managing cancellations before renewal.",
    ],
  },
  {
    title: "7. Plan Limits",
    body: [
      "Commit Happens may apply limits based on your selected plan, including:",
      [
        "Number of monitored sites",
        "Crawl frequency",
        "Uptime check frequency",
        "AI recommendation usage",
        "Feature access",
      ],
      "We may update plan features or limits over time.",
    ],
  },
  {
    title: "8. Availability",
    body: [
      "We work to keep Commit Happens available and useful, but we do not guarantee uninterrupted access.",
      "Services may be affected by maintenance, outages, third-party provider issues, API limitations, or other gremlins in the machinery.",
    ],
  },
  {
    title: "9. Third-Party Services",
    body: [
      "Commit Happens may integrate with third-party services such as hosting providers, analytics platforms, payment processors, crawling tools, AI providers, and database infrastructure.",
      "We are not responsible for outages, errors, policy changes, or limitations caused by third-party services.",
    ],
  },
  {
    title: "10. Termination",
    body: [
      "We may suspend or terminate access if you violate these terms, misuse the service, fail to pay, or create risk for Commit Happens or other users.",
      "You may stop using the service at any time.",
    ],
  },
  {
    title: "11. Limitation of Liability",
    body: [
      "Commit Happens is provided “as is” and “as available.”",
      "To the maximum extent permitted by law, Commit Happens is not liable for indirect, incidental, special, consequential, or punitive damages, including lost profits, lost data, lost rankings, business interruption, or website issues.",
    ],
  },
  {
    title: "12. Changes to These Terms",
    body: [
      "We may update these Terms of Service from time to time. Continued use of Commit Happens after changes means you accept the updated terms.",
    ],
  },
  {
    title: "13. Contact",
    body: ["Questions about these terms? Email: commithappens@gmail.com"],
  },
];

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="Welcome to Commit Happens. By using this website, dashboard, monitoring tools, crawl features, AI recommendations, or related services, you agree to these Terms of Service. If you do not agree with these terms, do not use Commit Happens. No hard feelings. The internet is large and mildly chaotic."
      sections={sections}
    />
  );
}
