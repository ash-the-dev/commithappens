import Link from "next/link";

type PremiumTeaserCardProps = {
  /** e.g. `/pricing` or `/billing` */
  href?: string;
  headline?: string;
  subtext?: string;
  ctaLabel?: string;
  badgeLabel?: string;
  className?: string;
};

/**
 * Teaser for gated analytics: blurred chart shell + copy + CTA. Feels like preview, not a dead state.
 */
export function PremiumTeaserCard({
  href = "/pricing",
  headline = "Level up to view more",
  subtext = "Unlock deeper monitoring, trend analysis, and smarter site insights.",
  ctaLabel = "Unlock full insights",
  badgeLabel = "Premium preview",
  className = "",
}: PremiumTeaserCardProps) {
  return (
    <div className={className}>
      <Link
        href={href}
        className="group relative block overflow-hidden rounded-3xl border border-white/15 bg-linear-to-br from-white/7 via-white/3 to-transparent shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85)] outline-none transition-[transform,box-shadow] focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_24px_60px_-24px_rgba(246,121,208,0.12)]"
        aria-label={`${headline} — ${ctaLabel}`}
      >
        <TeaserChartBackdrop />

        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-[#050505] via-[#050505]/75 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-brand/8 via-transparent to-violet-500/6"
          aria-hidden
        />

        <div className="relative flex min-h-[200px] flex-col justify-end gap-4 p-6 sm:min-h-[220px] sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
              <LockSparkleIcon className="h-3.5 w-3.5 text-brand" aria-hidden />
              {badgeLabel}
            </span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{headline}</h2>
            <p className="max-w-md text-sm leading-relaxed text-white/65">{subtext}</p>
          </div>

          <div>
            <span className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black shadow-sm transition group-hover:bg-brand-muted group-hover:shadow-md group-active:scale-[0.99]">
              <SparklineIcon className="h-4 w-4 opacity-80" aria-hidden />
              {ctaLabel}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

/** Blurred, decorative trend — mock data for preview only. */
function TeaserChartBackdrop() {
  const w = 480;
  const h = 120;
  const values = [18, 24, 20, 32, 28, 40, 36, 48, 44, 56, 50, 62, 58, 70, 66, 78, 74, 82];
  const step = w / (values.length - 1);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const padY = 8;
  const points = values.map((v, i) => {
    const x = i * step;
    const y = h - padY - ((v - min) / range) * (h - padY * 2);
    return [x, y] as const;
  });
  const lineD = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${w} ${h} L 0 ${h} Z`;

  return (
    <div
      className="pointer-events-none absolute inset-0 -translate-y-2 select-none sm:-translate-y-4"
      aria-hidden
    >
      <svg
        className="h-full w-full scale-[1.02] opacity-[0.5] blur-[3px] saturate-150"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMax slice"
      >
        <path d={areaD} fill="rgb(246 121 208 / 0.18)" />
        <path
          d={lineD}
          fill="none"
          stroke="rgb(255 168 230 / 0.9)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Soft grid lines — hint at "real" dashboard without real data */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1="0"
            y1={h * t}
            x2={w}
            y2={h * t}
            stroke="white"
            strokeWidth="0.4"
            opacity="0.08"
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-linear-to-b from-[#050505]/20 via-transparent to-[#050505]/30 backdrop-blur-[1px]" />
    </div>
  );
}

function LockSparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M6 9V6.5C6 4.01 7.79 2 10 2s4 2.01 4 4.5V9M5 9h10v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 4.5l.35.35M3 12.5h1.5M16.5 12.5H18M4.2 4.2l.9.9"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

function SparklineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M1 12l3.5-4L7 8l3.5 3L15 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}
