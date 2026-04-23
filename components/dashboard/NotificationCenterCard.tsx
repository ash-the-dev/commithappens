"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardNotification } from "@/lib/db/notifications";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  websiteId: string;
  notifications: DashboardNotification[];
};

type Filter = "all" | "unread" | "acknowledged" | "high_plus";

function severityClass(severity: "critical" | "high" | "medium" | "low"): string {
  if (severity === "critical") return "border-rose-500/55 bg-rose-600/15 text-rose-950";
  if (severity === "high") return "border-rose-400/45 bg-rose-500/10 text-rose-900";
  if (severity === "medium") return "border-amber-400/45 bg-amber-500/10 text-amber-950";
  return "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-950";
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function NotificationCenterCard({ websiteId, notifications }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter((n) => n.status === "unread");
    if (filter === "acknowledged") {
      return notifications.filter((n) => n.status === "acknowledged");
    }
    return notifications.filter((n) => n.severity === "critical" || n.severity === "high");
  }, [filter, notifications]);

  async function updateStatus(
    action: "read" | "unread" | "acknowledge" | "read_all",
    notificationId?: string,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/notifications/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            website_id: websiteId,
            notification_id: notificationId,
            action,
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setError(json.error ?? "update_failed");
          return;
        }
        router.refresh();
      } catch {
        setError("request_failed");
      }
    });
  }

  const unreadCount = notifications.filter((n) => n.status === "unread").length;
  return (
    <DashboardSection
      kicker="Inbox"
      title="Heads up"
      subtitle="Stuff worth your attention — without turning your dashboard into a slot machine."
      eyebrowRight={
        <button
          type="button"
          disabled={pending || unreadCount === 0}
          onClick={() => updateStatus("read_all")}
          className="rounded-full border border-slate-200/90 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Mark all read
        </button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "All" },
          { id: "unread", label: "Unread" },
          { id: "acknowledged", label: "Acknowledged" },
          { id: "high_plus", label: "Critical/High" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as Filter)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              filter === tab.id
                ? "border-fuchsia-400/45 bg-fuchsia-500/10 text-fuchsia-950"
                : "border-slate-200/90 bg-white/70 text-slate-800 hover:border-fuchsia-400/35"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 text-xs text-rose-800">Action failed ({error}).</p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-700">Nothing important right now. Enjoy the peace.</p>
      ) : (
        <ul className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {filtered.map((n) => (
            <li key={n.id} className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
                    n.severity,
                  )}`}
                >
                  {n.severity}
                </span>
                <span className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  {n.category.replace(/_/g, " ")}
                </span>
                <span className="rounded-full border border-slate-200/90 bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                  {n.status}
                </span>
                <span className="text-xs text-slate-500">{timeAgo(n.detected_at)}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-950">{n.title}</p>
              {n.summary ? <p className="mt-1 text-sm text-slate-800">{n.summary}</p> : null}

              {n.evidence_points.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {n.evidence_points.slice(0, 2).map((point) => (
                    <li key={point} className="text-xs text-slate-600">
                      - {point}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => updateStatus("read", n.id)}
                  className="rounded-full border border-slate-200/90 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark read
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => updateStatus("unread", n.id)}
                  className="rounded-full border border-slate-200/90 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark unread
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => updateStatus("acknowledge", n.id)}
                  className="rounded-full border border-slate-200/90 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Acknowledge
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

