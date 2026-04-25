import type { Metadata } from "next";
import Link from "next/link";
import { InteractiveGridBackdrop } from "@/components/background/InteractiveGridBackdrop";
import { WaveWordmark } from "@/components/brand/WaveWordmark";
import { ThemePicker } from "@/components/theme/ThemePicker";
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
            <div className="max-w-3xl space-y-5">
              <p className="text-xl font-semibold leading-snug tracking-tight text-white md:text-2xl">
                Track website performance, not red flags.
              </p>
              <div className="space-y-3">
                <h1 className="text-4xl font-black leading-[0.95] tracking-[-0.04em] text-white sm:text-5xl md:text-6xl">
                  You pushed code. Did it actually do anything?
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-white/80 md:text-xl">
                  See what changed, what broke, and exactly what to fix — in plain English.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                <Link
                  href="/register"
                  className="u-shadow-brand-card inline-flex justify-center rounded-full bg-brand px-6 py-3 text-sm font-semibold text-black transition hover:bg-brand-muted"
                >
                  Run a Free Scan
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-brand hover:text-brand"
                >
                  See how it works
                </Link>
              </div>
              <p className="text-sm font-semibold text-white/65">
                No technical knowledge required.
              </p>
            </div>
            <div className="ui-surface-contrast hero-result-card max-w-3xl animate-float-soft p-5 sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-700">
                Here&apos;s what we found in seconds:
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
              className="grid gap-3 rounded-2xl border border-white/20 bg-white/8 p-4 backdrop-blur-md sm:grid-cols-3"
            >
              <div className="rounded-xl border border-white/20 bg-white/8 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Step 1</p>
                <p className="mt-2 text-sm font-semibold text-white">Add your site</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/8 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Step 2</p>
                <p className="mt-2 text-sm font-semibold text-white">We crawl + analyze</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/8 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Step 3</p>
                <p className="mt-2 text-sm font-semibold text-white">You fix what actually matters</p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
