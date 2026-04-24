import Link from "next/link";
import Script from "next/script";

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-14">
      <Script
        src="https://js.stripe.com/v3/pricing-table.js"
        strategy="afterInteractive"
      />
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand transition hover:text-brand-muted"
      >
        <span aria-hidden>←</span>
        <span>Back</span>
      </Link>

      <div className="space-y-3 text-center">
        <h1 className="text-4xl font-semibold text-white">Start your 7-day free trial</h1>
        <p className="mx-auto max-w-2xl text-sm text-white/70">
          See what changed, what broke, and what actually matters. Cancel before renewal anytime.
        </p>
      </div>

      <div className="rounded-3xl border border-white/20 bg-white/8 p-4 backdrop-blur-xl sm:p-6">
        <stripe-pricing-table
          pricing-table-id="prctbl_1TPIenEnC5R6kTbef1sJrvn6"
          publishable-key="pk_live_51TOq97EnC5R6kTbeU7VGSXqvcwoirEQO2ThzYPPc2XeRN19WWSFbZyjSPA2wZhuow6LMhYeNV2tkYIwzRy2XOOat00qq03hIEa"
        />
      </div>
    </main>
  );
}
