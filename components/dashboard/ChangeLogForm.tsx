"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Props = {
  siteId: string;
};

const CHANGE_TYPES = [
  { value: "deploy", label: "Deploy" },
  { value: "content", label: "Content update" },
  { value: "seo", label: "SEO change" },
  { value: "marketing", label: "Campaign / ad" },
  { value: "config", label: "DNS / hosting / config" },
  { value: "other", label: "Other" },
] as const;

type SaveState = "idle" | "saving" | "saved" | "error";

export function ChangeLogForm({ siteId }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [changeType, setChangeType] = useState<(typeof CHANGE_TYPES)[number]["value"]>("deploy");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setSaveState("error");
      setMessage("Add a short note like “Updated homepage hero” or “Deployed checkout fix.”");
      return;
    }

    setSaveState("saving");
    setMessage(null);
    try {
      const response = await fetch("/api/internal/change-logs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: siteId,
          title: cleanTitle,
          description: description.trim() || null,
          change_type: changeType,
          source: "manual",
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || data.ok === false) {
        throw new Error(data.error ?? "save_failed");
      }
      setTitle("");
      setDescription("");
      setChangeType("deploy");
      setSaveState("saved");
      setMessage("Change logged. Refreshing the impact readout...");
      router.refresh();
    } catch {
      setSaveState("error");
      setMessage("Could not log that change. Try again in a moment.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-blue-200 bg-blue-50/65 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Log something that changed</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            This is not a to-do list. Add things after they ship so the dashboard can compare traffic, uptime, and risk
            before vs. after.
          </p>
        </div>
        <span className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
          Manual receipt
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">What changed?</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Example: Published new pricing page"
            maxLength={200}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
          <select
            value={changeType}
            onChange={(event) => setChangeType(event.target.value as typeof changeType)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {CHANGE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Optional context</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What should future-you know? Link to PR, campaign, plugin update, DNS change, etc."
          rows={3}
          className="mt-1 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className={`text-xs ${saveState === "error" ? "text-amber-700" : "text-slate-500"}`}>
          {message ?? "Tip: log deploys, content edits, SEO updates, ads, outages, or DNS/hosting changes."}
        </p>
        <button
          type="submit"
          disabled={saveState === "saving"}
          className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saveState === "saving" ? "Logging..." : "Log Change"}
        </button>
      </div>
    </form>
  );
}
