import Link from "next/link";

type Props = {
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
};

export function EmptyState({ title, description, ctaHref, ctaLabel }: Props) {
  return (
    <div className="ui-surface relative overflow-hidden border border-dashed border-white/22 px-8 py-14 text-center">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_520px_220px_at_50%_0%,color-mix(in_srgb,var(--brand)_14%,transparent),transparent_60%)] opacity-90"
        aria-hidden
      />
      <p className="relative text-xl font-semibold tracking-tight text-white">{title}</p>
      <p className="relative mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/68">{description}</p>
      <Link
        href={ctaHref}
        className="relative mt-7 inline-flex rounded-full border border-brand bg-brand/10 px-5 py-2.5 text-sm font-semibold text-brand shadow-sm transition hover:bg-brand hover:text-black"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
