import Link from "next/link";

export default function BillingCancelPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold text-white">Checkout canceled</h1>
      <p className="text-sm text-white/70">
        No charge was made. You can restart your 7-day trial any time.
      </p>
      <Link
        href="/pricing"
        className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-brand-muted"
      >
        Back to pricing
      </Link>
    </main>
  );
}
