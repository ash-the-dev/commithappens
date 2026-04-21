"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createWebsiteAction,
  type NewSiteState,
} from "@/app/dashboard/sites/new/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-brand py-3 text-sm font-semibold text-black transition hover:bg-brand-muted disabled:opacity-60"
    >
      {pending ? "Saving…" : "Create website"}
    </button>
  );
}

export function NewSiteForm() {
  const [state, formAction] = useActionState(createWebsiteAction, null as NewSiteState);

  return (
    <form
      action={formAction}
      className="u-shadow-brand-card space-y-4 rounded-2xl border border-border bg-card p-6"
    >
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-white/50">
          Display name
        </label>
        <input
          name="name"
          required
          placeholder="Marketing site"
          className="w-full rounded-xl border border-border bg-black px-3 py-2.5 text-sm text-white outline-none ring-brand/40 transition placeholder:text-white/30 focus:border-brand focus:ring-2"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-white/50">
          Primary domain
        </label>
        <input
          name="primaryDomain"
          required
          placeholder="example.com"
          className="w-full rounded-xl border border-border bg-black px-3 py-2.5 text-sm text-white outline-none ring-brand/40 transition placeholder:text-white/30 focus:border-brand focus:ring-2"
        />
        <p className="text-xs text-white/45">
          Example: <span className="text-white/70">example.com</span> or paste a full
          URL — we strip paths automatically.
        </p>
      </div>
      {state?.error ? (
        <p className="text-sm text-brand-muted" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
