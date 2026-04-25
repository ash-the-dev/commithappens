import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InteractiveGridBackdrop } from "@/components/background/InteractiveGridBackdrop";
import { CommitHappensMark } from "@/components/brand/CommitHappensMark";
import { LoginForm } from "@/components/auth/LoginForm";
import { SITE_NAME_DISPLAY } from "@/lib/seo/site-metadata";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to your ${SITE_NAME_DISPLAY} account.`,
  robots: { index: false, follow: true },
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <div className="relative isolate flex min-h-full flex-1 flex-col justify-center overflow-hidden px-6 py-16">
      <InteractiveGridBackdrop />
      <div className="relative z-10 mx-auto w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CommitHappensMark href="/" variant="dashboard" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Sign in</h1>
          <p className="text-sm text-white/60">
            New here?{" "}
            <Link className="text-brand hover:underline" href="/register">
              Create an account
            </Link>
          </p>
        </div>
        <Suspense
          fallback={
            <div className="auth-card h-48 animate-pulse" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
