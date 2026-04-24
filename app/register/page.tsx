import type { Metadata } from "next";
import Link from "next/link";
import { CommitHappensMark } from "@/components/brand/CommitHappensMark";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { SITE_NAME_DISPLAY } from "@/lib/seo/site-metadata";

export const metadata: Metadata = {
  title: "Create account",
  description: `Create a ${SITE_NAME_DISPLAY} account. 7 days free, cancel before renewal anytime.`,
  robots: { index: false, follow: true },
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-16">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CommitHappensMark href="/" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Create your account</h1>
          <p className="text-sm text-white/60">
            Paid plans include a 7-day free trial.{" "}
            <Link className="text-brand hover:underline" href="/pricing">
              See pricing
            </Link>
          </p>
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
