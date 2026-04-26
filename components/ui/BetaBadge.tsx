type Props = {
  compact?: boolean;
  className?: string;
};

export function BetaBadge({ compact = false, className = "" }: Props) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-(--accent-primary)/35 bg-(--card-glass-bg) px-3 py-1.5 text-xs font-semibold text-white/80 shadow-[0_12px_35px_-26px_color-mix(in_srgb,var(--accent-primary)_80%,black)] backdrop-blur-xl ${className}`}
    >
      <span className="rounded-full bg-accent-primary px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-black">
        Beta
      </span>
      {!compact ? (
        <span>Features may evolve as we refine the platform.</span>
      ) : null}
    </div>
  );
}
