"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardCase, DashboardCaseNote } from "@/lib/db/cases";
import type { DashboardNotification } from "@/lib/db/notifications";

type Props = {
  websiteId: string;
  cases: DashboardCase[];
  notesByCaseId: Record<string, DashboardCaseNote[]>;
  notifications: DashboardNotification[];
};

type CaseStatus = DashboardCase["status"];
type Filter = "all" | "open" | "investigating" | "monitoring" | "resolved";

function severityClass(severity: DashboardCase["severity"]): string {
  if (severity === "critical") return "border-red-500/55 bg-red-600/15 text-red-100";
  if (severity === "high") return "border-red-400/40 bg-red-500/10 text-red-100";
  if (severity === "medium") return "border-amber-400/40 bg-amber-500/10 text-amber-100";
  return "border-brand/40 bg-brand/10 text-brand";
}

function statusClass(status: DashboardCase["status"]): string {
  if (status === "open") return "border-red-400/35 bg-red-500/10 text-red-100";
  if (status === "investigating") return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  if (status === "monitoring") return "border-brand/45 bg-brand/10 text-brand";
  if (status === "resolved") return "border-emerald-400/35 bg-emerald-500/10 text-emerald-100";
  return "border-white/25 bg-white/5 text-white/75";
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
    <section className="ui-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/65">
            Investigations
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Keep weird stuff organized while you figure out what changed.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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
            className={`ui-chip px-3 py-1 transition ${
              filter === tab.id
                ? "border-brand/70 bg-brand/15 text-brand"
                : "text-white/70 hover:border-brand/55"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-3 text-xs text-red-200/85">Action failed ({error}).</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {filteredCases.length === 0 ? (
            <p className="text-sm text-white/55">No mysteries yet. Give it time.</p>
          ) : (
            <ul className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {filteredCases.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCaseId(c.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selectedCase?.id === c.id
                        ? "ui-surface-soft border-brand/60 bg-brand/10"
                        : "ui-surface-soft hover:border-brand/40"
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
                      <span className="text-[11px] text-white/45">{timeAgo(c.updated_at)}</span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-white">{c.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-white/65">
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
            <div className="ui-surface-soft p-4">
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
                <span className="text-xs text-white/50">
                  source: {selectedCase.source_type} / {selectedCase.source_ref}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{selectedCase.title}</p>
              <p className="mt-1 text-sm text-white/75">
                {selectedCase.summary ?? "No summary provided."}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-white/55">
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
                  className="ui-chip px-2.5 py-1 text-white/75 transition hover:border-brand/55 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="ui-chip px-2.5 py-1 text-white/75 transition hover:border-brand/55 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Unassign
                </button>
              </div>

              <div className="ui-surface-soft mt-3 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  Next action
                </p>
                <p className="mt-1 text-sm text-white/80">
                  {selectedCase.next_action ?? "No next action set."}
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={nextActionText}
                    onChange={(e) => setNextActionText(e.target.value)}
                    placeholder="Set next action..."
                    className="w-full rounded-lg border border-border/70 bg-black/25 px-2 py-1.5 text-xs text-white outline-none focus:border-brand/55"
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
                    className="ui-chip rounded-lg px-2 py-1.5 text-white/75 transition hover:border-brand/55 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="ui-chip rounded-lg px-2 py-1.5 text-white/75 transition hover:border-brand/55 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="ui-chip px-2.5 py-1 text-white/75 transition hover:border-brand/55 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Set {status}
                    </button>
                  ),
                )}
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Notes</p>
                {selectedNotes.length === 0 ? (
                  <p className="mt-2 text-xs text-white/55">No notes yet.</p>
                ) : (
                  <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {selectedNotes.map((note) => (
                      <li key={note.id} className="rounded-lg border border-border/70 bg-black/20 px-2 py-1.5">
                        <p className="text-xs text-white/80">{note.note_text}</p>
                        <p className="mt-1 text-[10px] text-white/50">{timeAgo(note.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add investigation note..."
                    className="w-full rounded-lg border border-border/70 bg-black/25 px-2 py-1.5 text-xs text-white outline-none focus:border-brand/55"
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
                    className="ui-chip rounded-lg px-2 py-1.5 text-white/75 transition hover:border-brand/55 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/55">Select a case to view details.</p>
          )}

          {candidateNotifications.length > 0 ? (
            <div className="ui-surface-soft mt-4 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Create case from notifications
              </p>
              <ul className="mt-2 space-y-2">
                {candidateNotifications.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">{n.title}</p>
                      <p className="truncate text-[11px] text-white/55">
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
                      className="ui-chip px-2.5 py-1 text-white/75 transition hover:border-brand/55 disabled:cursor-not-allowed disabled:opacity-50"
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
    </section>
  );
}

