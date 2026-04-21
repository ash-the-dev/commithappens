import Link from "next/link";
import { NewSiteForm } from "@/components/dashboard/NewSiteForm";

export default function NewSitePage() {
  return (
    <main className="mx-auto max-w-xl space-y-8 px-6 py-12">
      <div>
        <Link
          href="/dashboard"
          className="text-xs font-semibold uppercase tracking-wide text-brand hover:underline"
        >
          ← Back to sites
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-white">Add a website</h1>
        <p className="mt-2 text-sm text-white/60">
          Use the canonical hostname you want to track (no path). You can change
          the display name anytime later.
        </p>
      </div>
      <NewSiteForm />
    </main>
  );
}
