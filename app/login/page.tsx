import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
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
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CommitHappensMark href="/" />
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
            <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
