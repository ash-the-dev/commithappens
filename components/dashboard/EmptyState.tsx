import Link from "next/link";

type Props = {
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
};

export function EmptyState({ title, description, ctaHref, ctaLabel }: Props) {
  return (
    <div className="rounded-3xl border border-dashed border-white/25 bg-white/5 px-8 py-14 text-center backdrop-blur-sm">
      <p className="text-xl font-semibold text-white">{title}</p>
      <p className="mx-auto mt-3 max-w-xl text-sm text-white/70">{description}</p>
      <Link
        href={ctaHref}
        className="mt-7 inline-flex rounded-full border border-brand px-5 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-black"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
