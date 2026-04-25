"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  forgotPasswordAction,
  type ForgotPasswordState,
} from "@/app/forgot-password/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-brand py-3 text-sm font-semibold text-black transition hover:bg-brand-muted disabled:opacity-60"
    >
      {pending ? "Generating link..." : "Continue"}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    forgotPasswordAction,
    null as ForgotPasswordState,
  );

  return (
    <form
      action={formAction}
      className="auth-card space-y-4 p-6"
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
          className="auth-input w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-brand/40 transition focus:ring-2"
        />
      </div>

      {state && "error" in state ? (
        <p className="text-sm text-brand-muted" role="alert">
          {state.error}
        </p>
      ) : null}
      {state && "success" in state ? (
        <p className="text-sm text-emerald-300" role="status">
          {state.success}
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
