"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardCase, DashboardCaseNote } from "@/lib/db/cases";
import type { DashboardNotification } from "@/lib/db/notifications";
import { DashboardSection } from "@/components/dashboard/DashboardSection";

type Props = {
  websiteId: string;
  cases: DashboardCase[];
  notesByCaseId: Record<string, DashboardCaseNote[]>;
  notifications: DashboardNotification[];
};

type CaseStatus = DashboardCase["status"];
type Filter = "all" | "open" | "investigating" | "monitoring" | "resolved";

function severityClass(severity: DashboardCase["severity"]): string {
  if (severity === "critical") return "border-rose-500/55 bg-rose-600/15 text-rose-950";
  if (severity === "high") return "border-rose-400/45 bg-rose-500/10 text-rose-900";
  if (severity === "medium") return "border-amber-400/45 bg-amber-500/10 text-amber-950";
  return "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-950";
}

function statusClass(status: DashboardCase["status"]): string {
  if (status === "open") return "border-rose-400/35 bg-rose-500/10 text-rose-950";
  if (status === "investigating") return "border-amber-400/35 bg-amber-500/10 text-amber-950";
  if (status === "monitoring") return "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-950";
  if (status === "resolved") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-950";
  return "border-slate-200/90 bg-white/70 text-slate-800";
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

export function CaseWorkbenchCard({
  websiteId,
  cases,
  notesByCaseId,
  notifications,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(cases[0]?.id ?? null);
  const [noteText, setNoteText] = useState("");
  const [nextActionText, setNextActionText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filteredCases = useMemo(() => {
    if (filter === "all") return cases;
    return cases.filter((c) => c.status === filter);
  }, [cases, filter]);

  const selectedCase =
    (selectedCaseId ? cases.find((c) => c.id === selectedCaseId) : null) ?? null;
  const selectedNotes = selectedCase ? notesByCaseId[selectedCase.id] ?? [] : [];

  const candidateNotifications = useMemo(() => {
    const activeRefs = new Set(
      cases
        .filter((c) => c.status === "open" || c.status === "investigating" || c.status === "monitoring")
        .map((c) => `${c.source_type}:${c.source_ref}`),
    );
    return notifications
      .filter((n) => !activeRefs.has(`${n.source_type}:${n.source_ref}`))
      .slice(0, 4);
  }, [cases, notifications]);

  function runAction(payload: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/internal/cases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ website_id: websiteId, ...payload }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setError(json.error ?? "case_action_failed");
          return;
        }
        setNoteText("");
        if (
          typeof payload.action === "string" &&
          (payload.action === "set_next_action" || payload.action === "clear_next_action")
        ) {
          setNextActionText("");
        }
        router.refresh();
      } catch {
        setError("request_failed");
      }
    });
  }

  return (
    <DashboardSection
      kicker="Cases"
      title="Investigations (organized chaos)"
      subtitle="Turn weird signals into a paper trail: owner, next action, notes — so you’re not debugging from memory."
    >
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "All" },
          { id: "open", label: "Open" },
          { id: "investigating", label: "Investigating" },
          { id: "monitoring", label: "Monitoring" },
          { id: "resolved", label: "Resolved" },
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

      {error ? <p className="mt-3 text-xs text-rose-800">Action failed ({error}).</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {filteredCases.length === 0 ? (
            <p className="text-sm text-slate-700">No mysteries yet. Give it time.</p>
          ) : (
            <ul className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {filteredCases.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedCase?.id === c.id
                        ? "border-fuchsia-400/45 bg-fuchsia-500/10"
                        : "border-slate-200/80 bg-white/70 hover:border-fuchsia-400/35"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
                          c.severity,
                        )}`}
                      >
                        {c.severity}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(
                          c.status,
                        )}`}
                      >
                        {c.status}
                      </span>
                      <span className="text-[11px] text-slate-500">{timeAgo(c.updated_at)}</span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-slate-950">{c.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-700">
                      {c.summary ?? "No summary provided."}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3">
          {selectedCase ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityClass(
                    selectedCase.severity,
                  )}`}
                >
                  {selectedCase.severity}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(
                    selectedCase.status,
                  )}`}
                >
                  {selectedCase.status}
                </span>
                <span className="text-xs text-slate-600">
                  source: {selectedCase.source_type} / {selectedCase.source_ref}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-950">{selectedCase.title}</p>
              <p className="mt-1 text-sm text-slate-800">
                {selectedCase.summary ?? "No summary provided."}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-600">
                  Owner: {selectedCase.assigned_to_label ?? "Unassigned"}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    runAction({
                      action: "claim_case",
                      case_id: selectedCase.id,
                    })
                  }
                  className="rounded-full border border-slate-200/90 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Claim
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    runAction({
                      action: "unassign_case",
                      case_id: selectedCase.id,
                    })
                  }
                  className="rounded-full border border-slate-200/90 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Unassign
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Next action
                </p>
                <p className="mt-1 text-sm text-slate-900">
                  {selectedCase.next_action ?? "No next action set."}
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={nextActionText}
                    onChange={(e) => setNextActionText(e.target.value)}
                    placeholder="Set next action..."
                    className="w-full rounded-lg border border-slate-200/90 bg-white/80 px-2 py-1.5 text-xs text-slate-950 outline-none focus:border-fuchsia-400/60"
                    maxLength={240}
                  />
                  <button
                    type="button"
                    disabled={pending || nextActionText.trim().length === 0}
                    onClick={() =>
                      runAction({
                        action: "set_next_action",
                        case_id: selectedCase.id,
                        next_action: nextActionText.trim(),
                      })
                    }
                    className="rounded-lg border border-slate-200/90 bg-white/70 px-2 py-1.5 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    disabled={pending || !selectedCase.next_action}
                    onClick={() =>
                      runAction({
                        action: "clear_next_action",
                        case_id: selectedCase.id,
                      })
                    }
                    className="rounded-lg border border-slate-200/90 bg-white/70 px-2 py-1.5 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(["open", "investigating", "monitoring", "resolved", "dismissed"] as CaseStatus[]).map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        runAction({
                          action: "update_status",
                          case_id: selectedCase.id,
                          status,
                        })
                      }
                    className="rounded-full border border-slate-200/90 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Set {status}
                    </button>
                  ),
                )}
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Notes</p>
                {selectedNotes.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-600">No notes yet.</p>
                ) : (
                  <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {selectedNotes.map((note) => (
                      <li key={note.id} className="rounded-lg border border-slate-200/80 bg-white/70 px-2 py-1.5">
                        <p className="text-xs text-slate-900">{note.note_text}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{timeAgo(note.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add investigation note..."
                    className="w-full rounded-lg border border-slate-200/90 bg-white/80 px-2 py-1.5 text-xs text-slate-950 outline-none focus:border-fuchsia-400/60"
                    maxLength={400}
                  />
                  <button
                    type="button"
                    disabled={pending || noteText.trim().length === 0}
                    onClick={() =>
                      runAction({
                        action: "add_note",
                        case_id: selectedCase.id,
                        note_text: noteText.trim(),
                      })
                    }
                    className="rounded-lg border border-slate-200/90 bg-white/70 px-2 py-1.5 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-700">Select a case to view details.</p>
          )}

          {candidateNotifications.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                Create case from notifications
              </p>
              <ul className="mt-2 space-y-2">
                {candidateNotifications.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-950">{n.title}</p>
                      <p className="truncate text-[11px] text-slate-600">
                        {n.category.replace(/_/g, " ")} · {n.severity}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        runAction({
                          action: "create_from_notification",
                          notification_id: n.id,
                        })
                      }
                      className="rounded-full border border-slate-200/90 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-800 transition hover:border-fuchsia-400/45 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Create case
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </DashboardSection>
  );
}

