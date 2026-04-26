import Link from "next/link";
import { InteractiveGridBackdrop } from "@/components/background/InteractiveGridBackdrop";

export type LegalSection = {
  title: string;
  body: Array<string | string[]>;
};

type Props = {
  title: string;
  subtitle: string;
  sections: LegalSection[];
  children?: React.ReactNode;
};

const SUPPORT_EMAIL = "commithappens@gmail.com";

function LegalBody({ item }: { item: string | string[] }) {
  if (Array.isArray(item)) {
    return (
      <ul className="mt-4 grid gap-2 text-sm leading-6 text-white/72 sm:grid-cols-2">
        {item.map((line) => (
          <li key={line} className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <p className="mt-4 text-sm leading-7 text-white/72">{item}</p>;
}

export function LegalPageLayout({ title, subtitle, sections, children }: Props) {
  return (
    <main className="relative isolate flex-1 overflow-hidden px-6 py-12 sm:py-16">
      <InteractiveGridBackdrop />
      <div className="relative z-10 mx-auto max-w-5xl space-y-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand transition hover:text-brand-muted"
        >
          <span aria-hidden>←</span>
          <span>Back to the chaos</span>
        </Link>

        <section className="rounded-4xl border border-white/18 bg-white/8 p-6 shadow-[0_30px_100px_-70px_rgba(246,121,208,0.85)] backdrop-blur-xl sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">
            Last updated: April 25, 2026
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-[-0.04em] text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-white/74 sm:text-lg">
            {subtitle}
          </p>
          {children}
        </section>

        <div className="grid gap-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl border border-white/14 bg-black/28 p-6 backdrop-blur-xl"
            >
              <h2 className="text-2xl font-black tracking-tight text-white">{section.title}</h2>
              {section.body.map((item, index) => (
                <LegalBody key={`${section.title}-${index}`} item={item} />
              ))}
            </section>
          ))}
        </div>

        <section className="rounded-3xl border border-brand/25 bg-brand/10 p-6 backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
            Need a human?
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">Support without the haunted phone tree.</h2>
          <p className="mt-3 text-sm leading-6 text-white/72">
            Email{" "}
            <a className="font-semibold text-brand hover:text-brand-muted" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{" "}
            and tell us what got weird.
          </p>
        </section>
      </div>
    </main>
  );
}

export { SUPPORT_EMAIL };
