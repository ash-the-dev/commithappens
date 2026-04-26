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
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-6 py-14 md:py-20">
          <div className="space-y-7">
            <div className="animate-float-soft">
              <WaveWordmark size="hero" />
            </div>
            <BetaBadge />
            <div className="max-w-3xl space-y-5">
              <p className="text-xl font-semibold leading-snug tracking-tight text-white md:text-2xl">
                Uptime, SEO issues, and brand mentions—prioritized and explained in plain English.
              </p>
              <div className="space-y-3">
                <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
                  Most tools give you data. Commit Happens gives you decisions.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-white/80 md:text-xl">
                  Know what&apos;s broken, what matters, and what to fix first.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="u-shadow-brand-card inline-flex justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-black transition hover:bg-brand-muted"
                >
                  Show me what broke
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-brand hover:text-brand"
                >
                  Show me what broke
                </Link>
              </div>
              <p className="text-sm font-semibold text-white/65">
                Quick, guided setup. No technical knowledge required.
              </p>
            </div>
            <div className="ui-surface-contrast hero-result-card max-w-3xl animate-float-soft p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-700">
                Your site&apos;s warning lights, translated
              </p>
              <div className="mt-4 space-y-3 text-base font-semibold text-slate-900">
                <p className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/75 p-3">
                  <span aria-hidden>🚨</span>
                  <span>12 pages are broken <span className="text-slate-500">(404 errors)</span></span>
                </p>
                <p className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/75 p-3">
                  <span aria-hidden>📉</span>
                  <span>Your health score dropped <span className="text-rose-600">18%</span></span>
                </p>
                <p className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/75 p-3">
                  <span aria-hidden>🧵</span>
                  <span>Redirect chain slowing down <span className="font-mono text-sm text-cyan-700">/pricing</span></span>
                </p>
              </div>
              <Link
                href="/how-it-works"
                className="mt-4 inline-flex text-sm font-black text-fuchsia-700 transition hover:text-fuchsia-900"
              >
                Fix this in 3 steps
              </Link>
            </div>

            <div
              id="how-it-works"
              className="rounded-2xl border border-white/20 bg-white/8 p-4 backdrop-blur-md"
            >
              <h2 className="text-lg font-black tracking-tight text-white">How Commit Happens Works</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [
                    "1",
                    "Add your site",
                    "Paste your URL and install a tiny script — we'll guide you in under a minute. No coding experience needed.",
                  ],
                  [
                    "2",
                    "We scan everything",
                    "Uptime, SEO issues, broken pages, performance, and brand mentions.",
                  ],
                  [
                    "3",
                    "We rank what matters",
                    "We don't dump data. We show what needs attention first.",
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
