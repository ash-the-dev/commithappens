"use client";

import { useState } from "react";

export function CustomerPortalButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch("/api/billing/portal", { method: "POST" });
            const payload = (await res.json()) as { ok?: boolean; url?: string; error?: string };
            if (!res.ok || !payload.ok || !payload.url) {
              setError(payload.error ?? "Could not open billing portal.");
              setPending(false);
              return;
            }
            window.location.href = payload.url;
          } catch {
            setError("Could not open billing portal.");
            setPending(false);
          }
        }}
        className="rounded-full border border-white/35 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
      >
        {pending ? "Opening portal..." : "Manage billing"}
      </button>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
