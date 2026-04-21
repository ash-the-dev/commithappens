import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CommitHappensMark } from "@/components/brand/CommitHappensMark";
import { authOptions } from "@/lib/auth/options";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ThemePicker } from "@/components/theme/ThemePicker";

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
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-black/40 px-6 py-5 backdrop-blur md:py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 md:gap-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-5 md:gap-8 lg:gap-10">
            <CommitHappensMark
              href="/dashboard"
              variant="dashboard"
              scale="dashboardXL"
            />
            <nav className="flex gap-4 text-sm text-white/70">
              <Link className="transition hover:text-brand" href="/dashboard">
                Sites
              </Link>
              <Link
                className="transition hover:text-brand"
                href="/dashboard/sites/new"
              >
                Add site
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
      <div className="flex-1">{children}</div>
    </div>
  );
}
