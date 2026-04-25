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
    description: "For kicking the tires before things get serious.",
    bullets: [
      "Basic uptime monitoring",
      "Add sites and see core health signals",
      "Upgrade when you want SEO and AI recommendations",
    ],
    tools: ["Basic uptime monitoring", "Starter traffic snapshot", "Core health signals"],
    usage: ["1 site", "Basic monitoring cadence", "SEO and AI recommendations preview only"],
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
      "You know something’s off… you’re just not ready to go all in yet. We’ll scan your site, surface what’s wrong, and point you in the right direction. No overwhelm. Just clarity.",
    tools: [
      "Advanced uptime monitoring",
      "Traffic and top-page trends",
      "Performance trend signals",
      "Plain-English health summaries",
    ],
    usage: ["1 site", "Traffic + uptime monitoring included", "No SEO crawl runs", "No AI SEO recommendations"],
    cta: "Start trial",
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
      "This is where your site actually starts improving. We don’t just show problems, we rank them, track them, and tell you what to fix first. No more guessing. Just progress.",
    tools: [
      "Full dashboard access",
      "Traffic, events, and top pages",
      "Core Web Vitals and response trends",
      "SEO crawl health",
      "AI recommendations",
      "Response-code intelligence",
      "Performance monitoring",
    ],
    usage: ["Up to 5 sites", "1 SEO crawl per site per week", "1 recommendation refresh per site per week"],
    helperText: "Most people start here.",
    cta: "Start trial",
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
      "You’re not checking your sites… you’re running them. Full visibility across everything you manage, with the data to make real decisions. Built for scale.",
    tools: [
      "Everything in Committed",
      "Multi-site traffic and performance visibility",
      "Unlimited SEO crawls",
      "Unlimited recommendations",
      "Scale-ready performance monitoring",
    ],
    usage: ["Up to 25 sites", "Unlimited SEO crawls", "Unlimited recommendation refreshes", "No trial on this tier"],
    cta: "Go All In",
    href: "https://buy.stripe.com/14AfZh1jvgvZcBUgNMgfu00",
    isExternal: true,
  },
];

export const freePricingPlan = pricingPlans[0];
export const paidPricingPlans = pricingPlans.slice(1);
