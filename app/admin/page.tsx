import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { isAdminEmail } from "@/lib/admin";
import { getAdminDashboardData } from "@/lib/db/admin-dashboard";

export const dynamic = "force-dynamic";

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }
  if (!isAdminEmail(session.user.email)) {
    redirect("/dashboard");
  }

  const data = await getAdminDashboardData();

  return (
    <main className="min-h-screen bg-[#05040b] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-4xl border border-white/10 bg-white/4 p-6 shadow-2xl shadow-fuchsia-950/20 sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-fuchsia-300">
              Founder Admin
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              The cockpit for beautiful nonsense.
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
              Server-side numbers only. No service role keys in the browser, no client-side data
              confetti, no vibes pretending to be observability.
            </p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.cards.map((card) => (
            <article
              key={card.label}
              className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-lg shadow-black/20"
            >
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/80">
                {card.label}
              </p>
              <p className="mt-4 text-4xl font-black tracking-tight text-white">{card.value}</p>
              <p className="mt-3 text-sm leading-5 text-slate-400">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-4xl border border-white/10 bg-slate-950/80 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-200">
                  Latest Uptime Failures
                </p>
                <h2 className="mt-2 text-2xl font-black">Things That Bonked</h2>
              </div>
            </div>

            {data.latestUptimeFailures.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">
                No recent uptime failures. Suspiciously peaceful. We accept the gift.
              </div>
            ) : (
              <ul className="mt-6 space-y-3">
                {data.latestUptimeFailures.map((item) => (
                  <li
                    key={`${item.siteId ?? "unknown"}-${item.url}-${item.checkedAt}`}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="max-w-full truncate text-sm font-semibold text-white">{item.url}</p>
                      <span className="rounded-full bg-red-400/15 px-3 py-1 text-xs font-bold text-red-200">
                        {item.statusCode ?? "no status"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {timeLabel(item.checkedAt)}
                      {item.errorMessage ? ` · ${item.errorMessage}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-4xl border border-white/10 bg-slate-950/80 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-200">
              Recent Alerts
            </p>
            <h2 className="mt-2 text-2xl font-black">Dashboard Nags</h2>

            {data.recentAlerts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-100">
                No alerts yet. Either everything is fine, or the gremlins are being polite.
              </div>
            ) : (
              <ul className="mt-6 space-y-3">
                {data.recentAlerts.map((alert) => (
                  <li key={alert.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{alert.title}</p>
                      <span className="rounded-full bg-fuchsia-300/15 px-3 py-1 text-xs font-bold uppercase text-fuchsia-100">
                        {alert.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {alert.status ?? "open"} · {timeLabel(alert.detectedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
