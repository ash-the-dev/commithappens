"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";
  const reset = searchParams.get("reset") === "1";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      {registered ? (
        <p className="rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-center text-sm text-white">
          Account created. Sign in with your email and password.
        </p>
      ) : null}
      {reset ? (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-center text-sm text-emerald-200">
          Password reset complete. Sign in with your new password.
        </p>
      ) : null}
      <form
        className="u-shadow-brand-card-strong space-y-4 rounded-2xl border border-border bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const form = e.currentTarget;
          const email = String(new FormData(form).get("email") ?? "");
          const password = String(new FormData(form).get("password") ?? "");
          startTransition(async () => {
            const res = await signIn("credentials", {
              email,
              password,
              redirect: false,
            });
            if (res?.error) {
              setError("Invalid email or password.");
              return;
            }
            router.push("/dashboard");
            router.refresh();
          });
        }}
      >
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-white/50">
            Email
          </label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-xl border border-border bg-black px-3 py-2.5 text-sm text-white outline-none ring-brand/40 transition focus:border-brand focus:ring-2"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-medium uppercase tracking-wide text-white/50">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-border bg-black px-3 py-2.5 text-sm text-white outline-none ring-brand/40 transition focus:border-brand focus:ring-2"
          />
        </div>
        {error ? (
          <p className="text-sm text-brand-muted" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-brand py-3 text-sm font-semibold text-black transition hover:bg-brand-muted disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
