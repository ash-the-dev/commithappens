"use client";

import { useState } from "react";

type Props = {
  planKey: "situationship" | "committed";
  label: string;
  className?: string;
};

export function CheckoutButton({ planKey, label, className }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch("/api/billing/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ planKey }),
            });
            const payload = (await res.json()) as { ok?: boolean; url?: string; error?: string };
            if (!res.ok || !payload.ok || !payload.url) {
              setError(payload.error ?? "Could not start checkout.");
              setPending(false);
              return;
            }
            window.location.href = payload.url;
          } catch {
            setError("Could not start checkout.");
            setPending(false);
          }
        }}
      >
        {pending ? "Starting..." : label}
      </button>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
