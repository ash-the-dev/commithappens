"use client";

import { useMemo, useState } from "react";

export type JumpSection = {
  id: string;
  label: string;
};

type Props = {
  sections: JumpSection[];
};

function openAndScroll(sectionId: string) {
  const panel = document.getElementById(sectionId);
  if (!panel) return;
  const details = panel.closest("details");
  if (details && !details.hasAttribute("open")) {
    details.setAttribute("open", "true");
  }
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function DashboardJumpNav({ sections }: Props) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const activeLabel = useMemo(
    () => sections.find((section) => section.id === active)?.label ?? "Overview",
    [active, sections],
  );

  return (
    <div className="sticky top-20 z-30 rounded-2xl border border-white/25 bg-slate-950/65 p-3 backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/65">Jump to section</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => {
              setActive(section.id);
              openAndScroll(section.id);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active === section.id
                ? "border-brand bg-brand/20 text-brand-muted"
                : "border-white/25 bg-white/10 text-white/80 hover:bg-white/20"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-white/60">Active: {activeLabel}</p>
    </div>
  );
}
