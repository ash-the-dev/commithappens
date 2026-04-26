import type { Metadata } from "next";
import Link from "next/link";
import { InteractiveGridBackdrop } from "@/components/background/InteractiveGridBackdrop";
import { WaveWordmark } from "@/components/brand/WaveWordmark";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { BetaBadge } from "@/components/ui/BetaBadge";
import { DEFAULT_DESCRIPTION, HOME_TITLE, SITE_NAME_DISPLAY } from "@/lib/seo/site-metadata";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: `${HOME_TITLE} · ${SITE_NAME_DISPLAY}`,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    title: `${HOME_TITLE} · ${SITE_NAME_DISPLAY}`,
    description: DEFAULT_DESCRIPTION,
  },
};

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex w-full items-center justify-between gap-4">
          <Link
            href="/"
            className="-translate-x-4 inline-flex h-10 shrink-0 items-center justify-center outline-offset-4 transition-transform focus-visible:outline focus-visible:outline-brand sm:h-11"
          >
            <span
              className="theme-c-mark inline-block translate-y-px bg-clip-text text-[2.18rem] font-black leading-[0.82] tracking-[-0.02em] text-transparent sm:text-[2.4rem]"
              aria-label="Commit Happens"
            >
              C
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <ThemePicker />
            <Link
              className="text-foreground/80 transition hover:text-brand"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="rounded-full bg-brand px-4 py-2 font-medium text-black transition hover:bg-brand-muted"
              href="/register"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>
      <main className="relative flex flex-1 flex-col">
        <InteractiveGridBackdrop />
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-10 sm:px-6 md:gap-10 md:py-20">
          <div className="space-y-5 md:space-y-7">
            <div className="animate-float-soft">
              <WaveWordmark size="hero" />
            </div>
            <BetaBadge />
            <div className="max-w-3xl space-y-4 md:space-y-5">
              <p className="text-base font-semibold leading-snug tracking-tight text-white sm:text-lg md:text-2xl">
                Analytics, uptime, SEO issues, and brand mentions—prioritized and explained in plain English.
              </p>
              <div className="space-y-2.5 md:space-y-3">
                <h1 className="text-[2rem] font-black leading-[1.08] tracking-[-0.04em] text-white sm:text-[2.35rem] md:text-6xl md:leading-[0.95]">
                  Most tools give you data. Commit Happens gives you decisions.
                </h1>
                <p className="max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base md:text-xl">
                  Know what&rsquo;s broken, what matters, and what to fix first—without digging through dashboards.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="u-shadow-brand-card inline-flex justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-muted sm:px-6 sm:py-3"
                >
                  Start catching issues
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex justify-center rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-white/90 transition hover:border-brand hover:text-brand sm:px-6 sm:py-3"
                >
                  Show me the demo
                </Link>
              </div>
              <p className="text-sm font-semibold text-white/65">
                Setup takes about a minute. We&rsquo;ll walk you through it.
              </p>
            </div>
            <div className="ui-surface-contrast hero-result-card max-w-3xl animate-float-soft p-4 sm:p-5 md:p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-700">
                Your site&apos;s warning lights, translated
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-700">Here&rsquo;s what we&rsquo;d fix first:</p>
              <div className="mt-3 space-y-2.5 text-sm font-semibold text-slate-900 sm:mt-4 sm:space-y-3 sm:text-base">
                <p className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white/75 p-2.5 sm:gap-3 sm:p-3">
                  <span aria-hidden>📉</span>
                  <span>Analytics spotted a conversion dip <span className="text-rose-600">on /pricing</span></span>
                </p>
                <p className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white/75 p-2.5 sm:gap-3 sm:p-3">
                  <span aria-hidden>🗣️</span>
                  <span>Reputation Pulse found a mention that needs a calm response</span>
                </p>
                <p className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white/75 p-2.5 sm:gap-3 sm:p-3">
                  <span aria-hidden>🚨</span>
                  <span>12 pages are broken <span className="text-slate-500">(404 errors)</span></span>
                </p>
              </div>
              <Link
                href="/how-it-works"
                className="mt-4 inline-flex text-sm font-black text-fuchsia-700 transition hover:text-fuchsia-900"
              >
                Fix this in 3 quick steps
              </Link>
            </div>

            <div
              id="how-it-works"
              className="rounded-2xl border border-white/20 bg-white/8 p-3.5 backdrop-blur-md sm:p-4"
            >
              <h2 className="text-lg font-black tracking-tight text-white">How Commit Happens Works</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [
                    "1",
                    "Add your site",
                    "Paste your URL and install a tiny script — we’ll guide you in under a minute. No coding experience needed.",
                  ],
                  [
                    "2",
                    "We scan everything",
                    "Analytics, uptime, SEO issues, broken pages, performance, and brand mentions.",
                  ],
                  [
                    "3",
                    "We rank what matters",
                    "We don’t dump data on you. We show what actually needs attention first.",
                  ],
                  [
                    "4",
                    "You fix with confidence",
                    "Plain-English explanations tell you what happened, why it matters, and what to do next.",
                  ],
                ].map(([step, title, copy]) => (
                  <div key={step} className="rounded-xl border border-white/20 bg-white/8 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Step {step}</p>
                    <p className="mt-2 text-sm font-semibold text-white">{title}</p>
                    <p className="mt-2 text-xs leading-relaxed text-white/62">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
