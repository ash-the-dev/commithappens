"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registerAction, type RegisterState } from "@/app/register/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-brand py-3 text-sm font-semibold text-black transition hover:bg-brand-muted disabled:opacity-60"
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, null as RegisterState);

  return (
    <form
      action={formAction}
      className="auth-card space-y-4 p-6"
    >
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-white/50">
          Display name{" "}
          <span className="font-normal normal-case text-white/35">(optional)</span>
        </label>
        <input
          name="displayName"
          type="text"
          autoComplete="name"
          className="auth-input w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-brand/40 transition focus:ring-2"
        />
      </div>
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
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-white/50">
          Password
        </label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="auth-input w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-brand/40 transition focus:ring-2"
        />
        <p className="text-xs text-white/45">At least 8 characters.</p>
      </div>
      {state?.error ? (
        <p className="text-sm text-brand-muted" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
      <p className="text-center text-xs text-white/45">
        By continuing you agree to use this product responsibly and comply with
        applicable privacy laws on sites you track.
      </p>
      <p className="text-center text-sm text-white/55">
        <Link className="text-brand hover:underline" href="/login">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
