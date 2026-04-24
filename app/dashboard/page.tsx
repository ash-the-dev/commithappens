import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getBillingAccess } from "@/lib/billing/access";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PremiumTeaserCard } from "@/components/dashboard/PremiumTeaserCard";
import { SiteCard } from "@/components/dashboard/SiteCard";
import { getDashboardSiteSnapshots } from "@/lib/db/dashboard";
import { countWebsitesForUser } from "@/lib/db/websites";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const [billing, { sites, summary }, siteCount] = await Promise.all([
    getBillingAccess(userId, session.user.email),
    getDashboardSiteSnapshots(userId),
    countWebsitesForUser(userId),
  ]);
  const atSiteLimit = siteCount >= billing.maxSites;

  return (
    <main className="relative isolate mx-auto max-w-6xl space-y-10 overflow-hidden rounded-b-[1.5rem] px-6 py-12 sm:px-7">
      <div className="ui-dashboard-ambient" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[min(100vh,28rem)] bg-[radial-gradient(circle_at_50%_-10%,color-mix(in_srgb,var(--brand)_20%,transparent),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 top-20 z-[1] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--wave-purple)_14%,transparent),transparent_68%)] blur-2xl"
        aria-hidden
      />
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="ui-section-title text-brand/85">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Your sites</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/65">
            Real metrics only. We surface what changed, what regressed, and what needs
            cleanup next.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          {atSiteLimit && (
            <p className="max-w-sm text-right text-xs text-amber-200/90">
              {billing.accountKind === "free" ? "Free plan" : "Your plan"} allows up to {billing.maxSites} site
              {billing.maxSites === 1 ? "" : "s"}.{" "}
              <Link className="font-semibold text-brand underline-offset-2 hover:underline" href="/pricing">
                Upgrade to track more sites
              </Link>
            </p>
          )}
          {atSiteLimit ? (
            <Link
              href="/pricing"
              className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              {billing.accountKind === "free" ? "Unlock full intelligence" : "View plans"}
            </Link>
          ) : (
            <Link
              href="/dashboard/sites/new"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-muted"
            >
              Add website
            </Link>
          )}
        </div>
      </div>

      <div className="relative z-10 space-y-10">
      <DashboardSummary summary={summary} />

      {billing.accountKind === "free" && (
        <PremiumTeaserCard
          href="/pricing"
          headline="Level up to view more"
          subtext="Unlock deeper monitoring, trend analysis, and smarter site insights."
          ctaLabel="Level up"
        />
      )}

      {sites.length === 0 ? (
        <EmptyState
          title="No sites yet"
          description="Add your first site so CommitHappens can tell you what your code is actually doing."
          ctaHref="/dashboard/sites/new"
          ctaLabel="Add website"
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </ul>
      )}
      </div>
    </main>
  );
}
