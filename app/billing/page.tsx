import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { CustomerPortalButton } from "@/components/billing/CustomerPortalButton";
import { getBillingAccess } from "@/lib/billing/access";
import { getUserSubscription } from "@/lib/db/subscriptions";

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [subscription, billing] = await Promise.all([
    getUserSubscription(session.user.id),
    getBillingAccess(session.user.id, session.user.email),
  ]);

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
          <span className="font-semibold">Max sites:</span>{" "}
          {billing.maxSites >= 999_999 ? "Unlimited" : billing.maxSites}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {subscription?.stripeCustomerId ? (
            <CustomerPortalButton />
          ) : (
            <Link
              href="/pricing"
              className="rounded-full bg-brand px-4 py-2 text-xs font-semibold text-black transition hover:bg-brand-muted"
            >
              View pricing
            </Link>
          )}
        </div>
        {!subscription?.stripeCustomerId ? (
          <p className="mt-3 text-xs text-white/60">
            No billing profile yet. Pick a plan first, then billing management will unlock here.
          </p>
        ) : null}
      </div>
    </main>
  );
}
