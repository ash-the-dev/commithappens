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
  info?: string[];
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
    description: "A tiny watchdog for getting started. It checks the basics without pretending to be the whole command center.",
    bullets: [
      "Basic uptime monitoring",
      "Core health checks",
      "No SEO crawl",
      "No AI recommendations",
    ],
    tools: ["Analytics install support", "Basic uptime checks", "Core health snapshot"],
    usage: ["1 site", "Slower monitoring cadence", "SEO crawls and Reputation Pulse stay locked"],
    info: ["Good for making sure the tracker is alive. Not the full detective board."],
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
      "For the site you’re still figuring out. Analytics, uptime, and one monthly SEO crawl without the commitment ceremony.",
    tools: [
      "Analytics + uptime monitoring",
      "1 SEO crawl per month",
      "AI recommendations",
      "Reputation Pulse teaser",
    ],
    usage: ["1 site", "1 SEO crawl per month", "Brand mention cards are preview-only"],
    info: ["Reputation Pulse is a teaser here: you can see what it does, not monitor real mentions yet."],
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
      "Now we’re paying attention. Weekly SEO, real Reputation Pulse, and enough coverage to stop guessing what matters.",
    tools: [
      "Analytics + uptime monitoring",
      "1 SEO crawl per site per week",
      "AI recommendations",
      "Reputation Pulse included",
    ],
    usage: ["Up to 3 sites", "1 SEO crawl per site per week", "Up to 3 brand watch terms"],
    info: ["Reputation Pulse watches real brand terms and uses AI to rank what needs attention first."],
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
      "For more sites, more watch terms, and fewer surprises. Still readable. Still bossy in a helpful way.",
    tools: [
      "Analytics + uptime across the stack",
      "1 SEO crawl per site per week",
      "AI recommendations",
      "Expanded Reputation Pulse",
    ],
    usage: ["Up to 10 sites", "1 SEO crawl per site per week", "Up to 25 brand watch terms"],
    info: ["Built for more properties and more brand surface area, without turning the dashboard into a junk drawer."],
    cta: "Go All In",
    href: "https://buy.stripe.com/14AfZh1jvgvZcBUgNMgfu00",
    isExternal: true,
  },
];

export const freePricingPlan = pricingPlans[0];
export const paidPricingPlans = pricingPlans.slice(1);
