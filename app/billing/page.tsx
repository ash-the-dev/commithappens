import type { Metadata } from "next";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Billing & Refund Policy | Commit Happens",
  description:
    "Subscription, cancellation, billing, trial, and refund policies for Commit Happens.",
  alternates: { canonical: "/billing" },
};

const sections: LegalSection[] = [
  {
    title: "Subscriptions",
    body: [
      "Commit Happens may offer free and paid plans.",
      "Paid plans may include access to additional features such as more monitored sites, more crawl capacity, AI recommendations, uptime monitoring, and advanced insights.",
    ],
  },
  {
    title: "Billing",
    body: [
      "Paid subscriptions are billed according to the pricing and billing cycle shown at checkout.",
      "Payments may be processed by third-party providers such as Stripe.",
      "By subscribing, you authorize recurring charges unless you cancel before renewal.",
    ],
  },
  {
    title: "Trials",
    body: [
      "Commit Happens may offer free trials or introductory access.",
      "If a trial requires payment information, billing may begin automatically when the trial ends unless you cancel before the renewal date.",
    ],
  },
  {
    title: "Cancellations",
    body: [
      "You may cancel your subscription according to the account or billing management options provided.",
      "Cancellation stops future billing but does not automatically refund past payments.",
    ],
  },
  {
    title: "Refunds",
    body: [
      "Refunds are not guaranteed.",
      "We may consider refund requests on a case-by-case basis, especially for billing errors or accidental renewals reported quickly.",
      "We generally do not provide refunds for:",
      [
        "Forgetting to cancel",
        "Not using the service",
        "Dissatisfaction after significant usage",
        "Downtime caused by third-party services",
        "Results not matching expectations",
        "Search rankings, traffic, or business outcomes",
      ],
    ],
  },
  {
    title: "Plan Changes",
    body: [
      "If you upgrade or downgrade, feature access and billing may change based on the selected plan.",
      "Some changes may take effect immediately, while others may apply at the next billing cycle depending on payment processor behavior.",
    ],
  },
  {
    title: "Failed Payments",
    body: ["If payment fails, access to paid features may be limited, paused, or canceled."],
  },
  {
    title: "Price Changes",
    body: [
      "We may update pricing or plan features over time. We will make reasonable efforts to communicate material changes.",
    ],
  },
  {
    title: "Contact",
    body: ["Billing questions? Email: commithappens@gmail.com"],
  },
];

export default function BillingPolicyPage() {
  return (
    <LegalPageLayout
      title="Billing & Refund Policy"
      subtitle="This Billing & Refund Policy explains how subscriptions, payments, renewals, cancellations, and refunds work for Commit Happens. We like clean billing. Surprise charges are gross."
      sections={sections}
    />
  );
}
