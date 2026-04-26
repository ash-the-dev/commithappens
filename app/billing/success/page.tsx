import Link from "next/link";

export default function BillingSuccessPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-white">Plan activated</h1>
      <p className="text-sm text-white/70">
        Your billing access is syncing from Stripe. The robots are filing paperwork.
      </p>
      <div className="flex justify-center gap-2">
        <Link
          href="/dashboard"
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-muted"
        >
          Go to dashboard
        </Link>
        <Link
          href="/dashboard/billing"
          className="rounded-full border border-white/35 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Billing details
        </Link>
      </div>
    </main>
  );
}
