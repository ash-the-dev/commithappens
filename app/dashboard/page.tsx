import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { DeleteSiteButton } from "@/components/dashboard/DeleteSiteButton";
import { listWebsitesForUser } from "@/lib/db/websites";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const sites = await listWebsitesForUser(userId);

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Your sites</h1>
          <p className="mt-2 max-w-xl text-sm text-white/60">
            Add a site, drop in the snippet, then see whether your deploys changed
            anything that matters.
          </p>
        </div>
        <Link
          href="/dashboard/sites/new"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-muted"
        >
          Add website
        </Link>
      </div>

      {sites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-8 py-16 text-center">
          <p className="text-lg font-medium text-white">No sites yet</p>
          <p className="mt-2 text-sm text-white/55">
            Add your first site so CommitHappens can tell you what your code is
            actually doing.
          </p>
          <Link
            href="/dashboard/sites/new"
            className="mt-6 inline-flex rounded-full border border-brand px-5 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-black"
          >
            Add website
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {sites.map((site) => (
            <li
              key={site.id}
              className="rounded-2xl border border-border bg-card transition hover:border-brand/60 u-hover-site-card"
            >
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <Link
                  href={`/dashboard/sites/${site.id}`}
                  className="min-w-0 flex-1 rounded-xl outline-offset-2 focus-visible:outline focus-visible:outline-brand"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{site.name}</p>
                      <p className="mt-1 text-sm text-brand-muted">
                        {site.primary_domain}
                      </p>
                    </div>
                    <span
                      className={
                        site.is_active
                          ? "shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
                          : "shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/60"
                      }
                    >
                      {site.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-4 font-mono text-xs text-white/45">
                    {site.tracking_public_key}
                  </p>
                </Link>
                <div className="flex shrink-0 justify-end border-t border-border pt-3 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0">
                  <DeleteSiteButton
                    siteId={site.id}
                    siteName={site.name}
                    compact
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
