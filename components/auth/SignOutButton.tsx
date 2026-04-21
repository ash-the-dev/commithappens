"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-brand hover:text-brand"
    >
      Sign out
    </button>
  );
}
