import type { Metadata } from "next";
import Link from "next/link";
import { InteractiveGridBackdrop } from "@/components/background/InteractiveGridBackdrop";
import { CommitHappensMark } from "@/components/brand/CommitHappensMark";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { SITE_NAME_DISPLAY } from "@/lib/seo/site-metadata";

export const metadata: Metadata = {
  title: "Create account",
  description: `Create a ${SITE_NAME_DISPLAY} account during beta.`,
  robots: { index: false, follow: true },
  alternates: { canonical: "/register" },
};

type Props = {
  searchParams?: Promise<{ plan?: string }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const selectedPlan = params.plan?.trim().toLowerCase() === "free" ? "free" : null;

  return (
    <div className="relative isolate flex min-h-full flex-1 flex-col justify-center overflow-hidden px-6 py-16">
      <InteractiveGridBackdrop />
      <div className="relative z-10 mx-auto w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CommitHappensMark href="/" variant="dashboard" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Create your account</h1>
          <p className="text-sm text-white/60">
            Start with the tier that matches your current chaos level.{" "}
            <Link className="text-brand hover:underline" href="/pricing">
              See pricing
            </Link>
          </p>
          {selectedPlan === "free" ? (
            <p className="mx-auto inline-flex rounded-full border border-brand/35 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              Free plan selected. No card. No awkward commitment issues.
            </p>
          ) : null}
          <p className="text-sm text-white/60">
            Already have an account?{" "}
            <Link className="text-brand hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
