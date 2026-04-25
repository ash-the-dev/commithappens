import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { InteractiveGridBackdrop } from "@/components/background/InteractiveGridBackdrop";
import { CommitHappensMark } from "@/components/brand/CommitHappensMark";
import { authOptions } from "@/lib/auth/options";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ThemePicker } from "@/components/theme/ThemePicker";

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
  return (
    <div className="relative isolate flex min-h-full flex-1 flex-col overflow-hidden">
      <InteractiveGridBackdrop />
      <header className="relative z-10 border-b border-border/80 bg-linear-to-b from-black/55 to-black/35 px-6 py-5 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset] backdrop-blur-xl md:py-6">
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
                href="/pricing"
              >
                Pricing
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
            <div className="hidden md:block">
              <ThemePicker />
            </div>
            <span className="hidden sm:inline">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="relative z-10 flex-1">{children}</div>
    </div>
  );
}
