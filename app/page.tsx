import Link from "next/link";
import { WaveWordmark } from "@/components/brand/WaveWordmark";
import { ThemePicker } from "@/components/theme/ThemePicker";

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
        <div className="pointer-events-none absolute inset-0 hero-grid-bg" aria-hidden />
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-6 py-14 md:py-20">
          <div className="space-y-7">
            <WaveWordmark size="hero" />
            <p className="max-w-2xl text-xl font-semibold leading-snug tracking-tight text-white md:text-2xl">
              At least your code commits...unlike your ex.
            </p>
            <div className="max-w-3xl space-y-4 text-white/80">
              <div className="ui-surface-contrast p-5 sm:p-6">
                <p className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-700">
                  CommitHappens.com
                </p>
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                  You pushed code. Did it actually do anything?
                </h1>
                <p className="mt-2 text-lg text-slate-700">
                  Your site is doing stuff. We&apos;ll tell you what actually matters,
                  in plain English.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/register"
                className="u-shadow-brand-card rounded-full bg-brand px-6 py-3 text-sm font-semibold text-black transition hover:bg-brand-muted"
              >
                Get started
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-brand hover:text-brand"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
