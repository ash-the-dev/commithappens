import type { Metadata } from "next";
import Link from "next/link";
import { InteractiveGridBackdrop } from "@/components/background/InteractiveGridBackdrop";
import { BetaBadge } from "@/components/ui/BetaBadge";
import { PRICING_TITLE, SITE_NAME_DISPLAY } from "@/lib/seo/site-metadata";
import { freePricingPlan, paidPricingPlans } from "@/lib/pricingPlans";

const pricingDescription =
  "Beta pricing for Commit Happens. See what changed, what broke, and what actually matters after deploys.";

export const metadata: Metadata = {
  title: PRICING_TITLE,
  description: pricingDescription,
  alternates: { canonical: "/pricing" },
  openGraph: {
    type: "website",
    url: "/pricing",
    title: `Beta pricing · ${SITE_NAME_DISPLAY}`,
    description: pricingDescription,
  },
  twitter: {
    title: `Beta pricing · ${SITE_NAME_DISPLAY}`,
    description: pricingDescription,
  },
  keywords: [
    "pricing",
    "beta pricing",
    "Commit Happens",
    "website monitoring plans",
    "seo monitoring",
  ],
};

export default function PricingPage() {
  return (
    <main className="relative isolate flex-1 overflow-hidden px-6 py-14">
      <InteractiveGridBackdrop />
      <div className="relative z-10 mx-auto max-w-6xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand transition hover:text-brand-muted"
        >
          <span aria-hidden>←</span>
          <span>Back</span>
        </Link>

        <div className="space-y-3 text-center">
          <BetaBadge className="mx-auto" />
          <h1 className="text-4xl font-semibold text-white">Beta pricing that knows what it is</h1>
          <p className="mx-auto max-w-2xl text-sm text-white/70">
            Commit Happens is currently in beta. Features may evolve as we refine the platform, but the goal stays simple: show what changed, what broke, and what matters.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.72fr)_minmax(0,1.85fr)] lg:items-start">
          <section className="rounded-3xl border border-white/18 bg-white/7 p-6 text-white shadow-[0_24px_70px_-58px_rgba(246,121,208,0.55)] backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">{freePricingPlan.name}</p>
            <div className="mt-4">
              <p className="text-4xl font-black tracking-tight">{freePricingPlan.price}</p>
              <p className="mt-1 text-sm text-white/55">{freePricingPlan.description}</p>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-white/75">
              {freePricingPlan.bullets?.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span className="text-brand" aria-hidden>✓</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <Link
              href={freePricingPlan.href}
              className="mt-7 inline-flex w-full justify-center rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:border-brand hover:text-brand"
            >
              {freePricingPlan.cta}
            </Link>
          </section>

          <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
            {paidPricingPlans.map((plan) => (
              <section
                key={plan.key}
                className={`relative flex flex-col rounded-3xl border p-6 text-white backdrop-blur-xl ${
                  plan.featured
                    ? "border-brand/70 bg-white/12 shadow-[0_0_0_1px_rgba(246,121,208,0.24),0_28px_90px_-42px_rgba(246,121,208,0.85)] md:-mt-3 md:min-h-[calc(100%+1.5rem)]"
                    : "border-white/18 bg-white/8 shadow-[0_24px_70px_-58px_rgba(59,130,246,0.5)]"
                }`}
              >
                {plan.badge ? (
                  <p className="absolute right-5 top-5 rounded-full border border-brand/45 bg-brand/15 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-brand">
                    {plan.badge}
                  </p>
                ) : null}
                <div className="text-3xl" aria-hidden>{plan.icon}</div>
                <h2 className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-white">
                  {plan.name}
                </h2>
                <p className="mt-4 text-4xl font-black tracking-tight">
                  {plan.price}{" "}
                  {plan.interval ? (
                    <span className="text-sm font-semibold tracking-normal text-white/55">
                      {plan.interval}
                    </span>
                  ) : null}
                </p>
                <p className="mt-5 flex-1 text-sm leading-relaxed text-white/68">
                  {plan.description}
                </p>
                <div className="mt-6 space-y-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
                      Tools
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-white/72">
                      {plan.tools.map((tool) => (
                        <li key={tool} className="flex gap-2">
                          <span className="text-brand" aria-hidden>✓</span>
                          <span>{tool}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
                      Usage
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-white/72">
                      {plan.usage.map((limit) => (
                        <li key={limit} className="flex gap-2">
                          <span className="text-brand" aria-hidden>•</span>
                          <span>{limit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <a
                  href={plan.href}
                  className="mt-7 inline-flex w-full justify-center rounded-full bg-brand px-5 py-3 text-sm font-semibold text-black transition hover:bg-brand-muted"
                  rel="noopener noreferrer"
                >
                  {plan.cta}
                </a>
                {plan.helperText ? (
                  <p className="mt-3 text-center text-xs font-semibold text-white/55">
                    {plan.helperText}
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
