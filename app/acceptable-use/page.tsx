import type { Metadata } from "next";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | Commit Happens",
  description:
    "Rules for authorized, safe, and responsible use of Commit Happens monitoring, crawl, and AI tools.",
  alternates: { canonical: "/acceptable-use" },
};

const sections: LegalSection[] = [
  {
    title: "Allowed Use",
    body: [
      "You may use Commit Happens to:",
      [
        "Monitor websites you own",
        "Monitor client websites you are authorized to manage",
        "Run crawl analysis on authorized websites",
        "Review uptime and site health",
        "Generate recommendations for authorized websites",
        "Track issues, improvements, and site signals",
      ],
    ],
  },
  {
    title: "Prohibited Use",
    body: [
      "You may not use Commit Happens to:",
      [
        "Crawl, scan, or monitor websites without permission",
        "Attack, overload, disrupt, or abuse websites or systems",
        "Attempt unauthorized access to accounts, data, servers, or networks",
        "Use the service for spam, phishing, fraud, malware, or illegal activity",
        "Circumvent rate limits or security controls",
        "Interfere with other users",
        "Upload malicious code or content",
        "Reverse engineer or scrape Commit Happens",
        "Resell access without permission",
        "Misrepresent results or use the service deceptively",
      ],
    ],
  },
  {
    title: "Crawling Rules",
    body: [
      "You are responsible for ensuring you have permission to crawl or monitor submitted websites.",
      "Commit Happens may limit, throttle, block, or reject crawls to protect infrastructure, users, or third-party websites.",
    ],
  },
  {
    title: "Uptime Monitoring Rules",
    body: [
      "Uptime checks must only be used for websites you own, operate, or are authorized to monitor.",
      "Do not use uptime checks to harass, overload, or repeatedly probe third-party systems.",
    ],
  },
  {
    title: "AI Use Rules",
    body: [
      "Do not submit sensitive, private, regulated, or confidential information unless you are authorized to do so.",
      "Do not use AI output for illegal, deceptive, harmful, or abusive purposes.",
    ],
  },
  {
    title: "Enforcement",
    body: [
      "We may suspend, limit, or terminate access if we believe your use creates risk, violates this policy, harms others, or threatens service stability.",
    ],
  },
  {
    title: "Reporting Abuse",
    body: ["To report misuse or ask questions: commithappens@gmail.com"],
  },
];

export default function AcceptableUsePage() {
  return (
    <LegalPageLayout
      title="Acceptable Use Policy"
      subtitle="Commit Happens is built to monitor and analyze websites you own or are authorized to manage. Please do not use it like a raccoon with a keyboard."
      sections={sections}
    />
  );
}
