"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  resetPasswordAction,
  type ResetPasswordState,
} from "@/app/reset-password/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-brand py-3 text-sm font-semibold text-black transition hover:bg-brand-muted disabled:opacity-60"
    >
      {pending ? "Saving..." : "Reset password"}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(
    resetPasswordAction,
    null as ResetPasswordState,
  );

  return (
    <form
      action={formAction}
      className="u-shadow-brand-card-strong space-y-4 rounded-2xl border border-border bg-card p-6"
    >
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-white/50">
          New password
        </label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-xl border border-border bg-black px-3 py-2.5 text-sm text-white outline-none ring-brand/40 transition focus:border-brand focus:ring-2"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-white/50">
          Confirm password
        </label>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-xl border border-border bg-black px-3 py-2.5 text-sm text-white outline-none ring-brand/40 transition focus:border-brand focus:ring-2"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-brand-muted" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />

      <p className="text-center text-sm text-white/55">
        <Link className="text-brand hover:underline" href="/login">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
