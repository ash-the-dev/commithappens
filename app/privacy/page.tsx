import type { Metadata } from "next";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | Commit Happens",
  description:
    "How Commit Happens collects, uses, and protects account, website, monitoring, crawl, and recommendation data.",
  alternates: { canonical: "/privacy" },
};

const sections: LegalSection[] = [
  {
    title: "1. Information We Collect",
    body: [
      "We may collect:",
      [
        "Account information, such as name and email address",
        "Login/authentication information",
        "Websites or URLs you submit for monitoring or crawling",
        "Crawl results and site health data",
        "Uptime check results",
        "AI recommendation inputs and outputs",
        "Billing and subscription information handled through payment processors",
        "Technical data such as IP address, browser type, logs, and usage events",
      ],
    ],
  },
  {
    title: "2. How We Use Information",
    body: [
      "We use information to:",
      [
        "Provide and operate Commit Happens",
        "Monitor websites you submit",
        "Generate crawl insights and recommendations",
        "Display dashboard results",
        "Process subscriptions and payments",
        "Improve product performance and reliability",
        "Prevent abuse, fraud, and unauthorized activity",
        "Provide support",
      ],
    ],
  },
  {
    title: "3. Website Data",
    body: [
      "When you submit a website, Commit Happens may collect publicly available data from that site, including page titles, descriptions, headings, status codes, links, and other crawl-related signals.",
      "You are responsible for ensuring you have permission to submit websites for monitoring or analysis.",
    ],
  },
  {
    title: "4. AI Processing",
    body: [
      "Commit Happens may send relevant website data, crawl findings, or page content signals to AI providers to generate recommendations.",
      "We aim to limit AI processing to what is necessary for the product feature.",
      "Do not submit sensitive, confidential, regulated, or private information unless you are authorized to do so.",
    ],
  },
  {
    title: "5. Billing Data",
    body: [
      "Payments may be processed by third-party providers such as Stripe.",
      "Commit Happens does not store full payment card numbers on its own servers.",
    ],
  },
  {
    title: "6. Cookies and Similar Technologies",
    body: [
      "Commit Happens may use cookies or similar technologies for login sessions, preferences, analytics, and security.",
    ],
  },
  {
    title: "7. Third-Party Services",
    body: [
      "We may use third-party services for:",
      [
        "Hosting",
        "Database storage",
        "Authentication",
        "Payments",
        "AI processing",
        "Crawling",
        "Analytics",
        "Email or notifications",
      ],
      "These services may process data according to their own privacy policies.",
    ],
  },
  {
    title: "8. Data Security",
    body: [
      "We use reasonable technical and organizational measures to protect user data.",
      "No system is perfectly secure, because the internet was apparently assembled during a thunderstorm. You are responsible for using strong passwords and protecting your account.",
    ],
  },
  {
    title: "9. Data Retention",
    body: [
      "We retain information as long as needed to provide the service, comply with legal obligations, resolve disputes, prevent abuse, and maintain business records.",
    ],
  },
  {
    title: "10. Your Choices",
    body: [
      "You may request help with account information, support issues, or data-related questions by contacting: commithappens@gmail.com",
    ],
  },
  {
    title: "11. Children’s Privacy",
    body: ["Commit Happens is not intended for children under 13."],
  },
  {
    title: "12. Changes to This Policy",
    body: [
      "We may update this Privacy Policy from time to time. Continued use of the service after changes means you accept the updated policy.",
    ],
  },
  {
    title: "13. Contact",
    body: ["Questions? Email: commithappens@gmail.com"],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="Commit Happens collects only the information needed to provide website monitoring, crawl analysis, AI recommendations, account access, and billing-related services. We are not in the business of being creepy. We prefer useful over invasive."
      sections={sections}
    />
  );
}
