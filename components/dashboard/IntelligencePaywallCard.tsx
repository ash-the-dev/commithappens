import Link from "next/link";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  title?: string;
  subtitle?: string;
};

/**
 * Replaces Pro-only / intelligence features on the Free plan.
 */
export function IntelligencePaywallCard({
  title = "Upgrade for full intelligence",
  subtitle = "Threat triage, AI summaries, case workflows, and advanced comparisons are on paid plans. Your traffic and uptime stay available on Free.",
}: Props) {
  return (
    <DashboardSection kicker="Free plan" title={title} subtitle={subtitle}>
      <p className="text-sm text-slate-800">
        Track one site, basic uptime, and pageview counts on Free. Unlock deeper analysis when you are ready to scale.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/pricing"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-muted"
        >
          Unlock full intelligence
        </Link>
        <Link
          href="/billing"
          className="text-sm font-semibold text-slate-700 underline-offset-2 hover:underline"
        >
          Billing
        </Link>
      </div>
    </DashboardSection>
  );
}
