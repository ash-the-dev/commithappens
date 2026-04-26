import type { Metadata } from "next";
import Link from "next/link";
import { InteractiveGridBackdrop } from "@/components/background/InteractiveGridBackdrop";
import { WaveWordmark } from "@/components/brand/WaveWordmark";
import { HowItWorksDemo } from "@/components/marketing/HowItWorksDemo";
import { pricingPlans } from "@/lib/pricingPlans";
import { SITE_NAME_DISPLAY } from "@/lib/seo/site-metadata";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "See how Commit Happens explains traffic, tracking, uptime, SEO issues, and AI recommendations in plain English.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    type: "website",
    url: "/how-it-works",
    title: `How it works · ${SITE_NAME_DISPLAY}`,
    description:
      "A quick look at the Commit Happens dashboard and what each plan unlocks.",
  },
  twitter: {
    title: `How it works · ${SITE_NAME_DISPLAY}`,
    description:
      "A quick look at the Commit Happens dashboard and what each plan unlocks.",
  },
};

const committedPlan = pricingPlans.find((plan) => plan.key === "committed");

export default function HowItWorksPage() {
  return (
    <main className="relative isolate flex-1 overflow-hidden px-6 py-12 sm:py-16">
      <InteractiveGridBackdrop />
      <div className="relative z-10 mx-auto max-w-6xl space-y-12">
        <nav className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand transition hover:text-brand-muted"
          >
            <span aria-hidden>←</span>
            <span>Back</span>
          </Link>
          <Link
            href="/pricing"
            className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black transition hover:bg-brand-muted"
          >
            See plans
          </Link>
        </nav>

        <section className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
          <div className="space-y-6">
            <WaveWordmark size="compact" />
            <div className="space-y-4">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-brand">
                How it works
              </p>
              <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-[-0.04em] text-white sm:text-5xl">
                We watch your site so you can stop refreshing tabs like it owes you money.
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-white/72">
                Add a site, turn on tracking, and we connect traffic, uptime, performance, SEO issues, and
                recommendations into one plain-English readout. Fewer mystery charts. More “fix this next.”
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["1", "Add your site"],
                ["2", "We track traffic + health"],
                ["3", "You get fixes, not homework"],
              ].map(([step, label]) => (
                <div key={step} className="rounded-2xl border border-white/18 bg-white/8 p-4 backdrop-blur-md">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">
                    Step {step}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <HowItWorksDemo badge={committedPlan?.badge ?? "Most popular"} />
        </section>

        <section className="space-y-5">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-brand">
              Plan boundaries
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">
              No guesswork. No rabbit holes.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Each plan shows what it actually gets. Paid tiers unlock only what belongs there.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {pricingPlans.map((plan) => (
              <section
                key={plan.key}
                className={`rounded-3xl border p-5 backdrop-blur-xl ${
                  plan.featured
                    ? "border-brand/65 bg-white/12 shadow-[0_26px_80px_-50px_rgba(246,121,208,0.85)]"
                    : "border-white/18 bg-white/8"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
                    {plan.name}
                  </p>
                  {plan.icon ? <span className="text-2xl" aria-hidden>{plan.icon}</span> : null}
                </div>
                <p className="mt-3 text-3xl font-black text-white">
                  {plan.price}
                  {plan.interval ? (
                    <span className="text-sm font-semibold text-white/50"> {plan.interval}</span>
                  ) : null}
                </p>
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
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
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
                      Usage
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-white/72">
                      {plan.usage.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="text-brand" aria-hidden>•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
