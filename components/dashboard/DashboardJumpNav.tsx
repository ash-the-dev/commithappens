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
    <div className="ui-surface sticky top-20 z-30 overflow-hidden p-1">
      <div className="rounded-[0.9rem] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-3 backdrop-blur-md">
        <p className="ui-section-title text-white/55">Jump to section</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                setActive(section.id);
                openAndScroll(section.id);
              }}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                active === section.id
                  ? "border-brand/60 bg-gradient-to-b from-brand/25 to-brand/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                  : "border-white/20 bg-white/8 text-white/82 hover:border-white/32 hover:bg-white/14"
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/55">
          <span className="text-white/40">Now viewing · </span>
          {activeLabel}
        </p>
      </div>
    </div>
  );
}
