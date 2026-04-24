import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CommitHappensMark } from "@/components/brand/CommitHappensMark";
import { authOptions } from "@/lib/auth/options";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { getBillingAccess } from "@/lib/billing/access";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  const billing = await getBillingAccess(session.user.id, session.user.email);
  const planLabel =
    billing.accountKind === "free"
      ? "Free plan"
      : billing.planKey === "committed"
        ? "Committed"
        : billing.planKey === "situationship"
          ? "Situationship"
          : "Paid plan";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border/80 bg-linear-to-b from-black/55 to-black/35 px-6 py-5 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] backdrop-blur-xl md:py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 md:gap-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-5 md:gap-8 lg:gap-10">
            <CommitHappensMark
              href="/"
              variant="dashboard"
              scale="dashboardXL"
            />
            <nav className="flex items-center gap-1 text-sm text-white/72">
              <Link
                className="rounded-lg px-2.5 py-1.5 transition hover:bg-white/6 hover:text-brand"
                href="/dashboard"
              >
                Sites
              </Link>
              <Link
                className="rounded-lg px-2.5 py-1.5 transition hover:bg-white/6 hover:text-brand"
                href="/dashboard/sites/new"
              >
                Add site
              </Link>
              <Link
                className="rounded-lg px-2.5 py-1.5 transition hover:bg-white/6 hover:text-brand"
                href="/billing"
              >
                Billing
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85">
                {planLabel}
              </span>
              {billing.accountKind === "free" && (
                <Link
                  href="/pricing"
                  className="rounded-full border border-brand/40 bg-brand/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand transition hover:border-brand/60"
                >
                  Unlock full intelligence
                </Link>
              )}
            </div>
            <div className="hidden md:block">
              <ThemePicker />
            </div>
            <span className="hidden sm:inline">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
