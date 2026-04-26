export type PricingPlan = {
  key: "free" | "situationship" | "committed" | "all-in";
  name: string;
  price: string;
  interval?: string;
  icon?: string;
  badge?: string;
  description: string;
  bullets?: string[];
  tools: string[];
  usage: string[];
  cta: string;
  href: string;
  isExternal: boolean;
  featured?: boolean;
  helperText?: string;
};

export const pricingPlans: PricingPlan[] = [
  {
    key: "free",
    name: "FREE",
    price: "$0",
    description: "A tiny watchdog for getting started. It checks the basics without pretending to be a full command center.",
    bullets: [
      "Basic uptime monitoring",
      "Core health checks",
      "No SEO crawl",
      "No AI recommendations",
    ],
    tools: ["Basic uptime monitoring", "Core health checks", "No SEO crawl"],
    usage: ["1 site", "Basic monitoring cadence", "No AI recommendations"],
    cta: "Start free",
    href: "/register?plan=free",
    isExternal: false,
  },
  {
    key: "situationship",
    name: "SITUATIONSHIP",
    price: "$19",
    interval: "per month",
    icon: "💔",
    description:
      "We keep an eye on things. You get one monthly deep scan with AI-powered recommendations so nothing quietly breaks behind your back.",
    tools: [
      "1 monitored site",
      "1 crawl per month",
      "AI recommendations included",
      "Analytics included",
    ],
    usage: ["1 monitored site", "1 crawl per month", "AI recommendations included", "Analytics included"],
    cta: "Choose Situationship",
    href: "https://buy.stripe.com/7sY5kDaU56VpbxQ8hggfu02",
    isExternal: true,
  },
  {
    key: "committed",
    name: "COMMITTED",
    price: "$49",
    interval: "per month",
    icon: "💍",
    badge: "Most popular",
    description:
      "Now we’re paying attention. Weekly scans, AI insights, and enough coverage to actually stay ahead of problems.",
    tools: [
      "Up to 3 sites",
      "1 crawl per week per site",
      "AI recommendations included",
      "Full monitoring",
    ],
    usage: ["Up to 3 sites", "1 crawl per week per site", "AI recommendations included", "Full monitoring"],
    helperText: "Most people start here.",
    cta: "Choose Committed",
    href: "https://buy.stripe.com/28EeVd8LX7ZteK2cxwgfu01",
    isExternal: true,
    featured: true,
  },
  {
    key: "all-in",
    name: "ALL IN",
    price: "$99",
    interval: "per month",
    icon: "🚀",
    description:
      "Full control. Full visibility. If something breaks, you’ll know before your clients do.",
    tools: [
      "Up to 25 sites",
      "Weekly crawls per site",
      "AI recommendations included",
      "Full monitoring + scale",
    ],
    usage: ["Up to 25 sites", "Weekly crawls per site", "AI recommendations included", "Full monitoring + scale"],
    cta: "Go All In",
    href: "https://buy.stripe.com/14AfZh1jvgvZcBUgNMgfu00",
    isExternal: true,
  },
];

export const freePricingPlan = pricingPlans[0];
export const paidPricingPlans = pricingPlans.slice(1);
