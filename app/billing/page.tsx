import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { CustomerPortalButton } from "@/components/billing/CustomerPortalButton";
import { getUserSubscription } from "@/lib/db/subscriptions";

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const subscription = await getUserSubscription(session.user.id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <h1 className="text-3xl font-semibold text-white">Billing</h1>
      <div className="rounded-3xl border border-white/20 bg-white/10 p-6 text-sm text-white/85 backdrop-blur-xl">
        <p>
          <span className="font-semibold">Plan:</span> {subscription?.planKey ?? "none"}
        </p>
        <p className="mt-2">
          <span className="font-semibold">Status:</span> {subscription?.status ?? "none"}
        </p>
        <p className="mt-2">
          <span className="font-semibold">Trial ends:</span> {subscription?.trialEndsAt ?? "n/a"}
        </p>
        <p className="mt-2">
          <span className="font-semibold">Current period end:</span> {subscription?.currentPeriodEnd ?? "n/a"}
        </p>
        <p className="mt-2">
          <span className="font-semibold">SEO enabled:</span> {subscription?.seoEnabled ? "yes" : "no"}
        </p>
        <p className="mt-2">
          <span className="font-semibold">Max sites:</span> {subscription?.maxSites ?? 0}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <CustomerPortalButton />
          <Link
            href="/pricing"
            className="rounded-full border border-white/35 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Change plan
          </Link>
        </div>
      </div>
    </main>
  );
}
