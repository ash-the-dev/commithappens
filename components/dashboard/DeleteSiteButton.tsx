"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { deleteWebsiteAction } from "@/app/dashboard/sites/actions";

function SubmitButton({
  compact,
  label,
  tone,
}: {
  compact: boolean;
  label: string;
  tone: "dark" | "light";
}) {
  const { pending } = useFormStatus();
  const text = pending ? "Removing…" : label;
  if (compact) {
    return (
      <button
        type="submit"
        disabled={pending}
        className={
          tone === "light"
            ? "rounded-lg border border-slate-200/90 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:border-rose-400/60 hover:bg-rose-50 disabled:opacity-50"
            : "rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-red-400/45 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
        }
      >
        {text}
      </button>
    );
  }
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        tone === "light"
          ? "w-full rounded-full border border-rose-400/45 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-900 transition hover:border-rose-500/60 hover:bg-rose-500/15 disabled:opacity-50 sm:w-auto"
          : "w-full rounded-full border border-red-500/35 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-200 transition hover:border-red-400/60 hover:bg-red-500/15 disabled:opacity-50 sm:w-auto"
      }
    >
      {text}
    </button>
  );
}

type Props = {
  siteId: string;
  siteName: string;
  /** Compact row action on the sites list. */
  compact?: boolean;
  className?: string;
  /** Dashboard list is dark-on-dark; site detail uses light story cards. */
  tone?: "dark" | "light";
};

export function DeleteSiteButton({
  siteId,
  siteName,
  compact = false,
  className = "",
  tone = "dark",
}: Props) {
  const [state, formAction] = useActionState(deleteWebsiteAction, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Remove “${siteName}” from your account? Analytics for this site will no longer be available in the dashboard.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="websiteId" value={siteId} />
      {state?.error ? (
        <p
          className={tone === "light" ? "mb-2 text-xs text-rose-700" : "mb-2 text-xs text-red-300"}
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <SubmitButton compact={compact} label="Remove" tone={tone} />
    </form>
  );
}
