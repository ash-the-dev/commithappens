import type { ReactNode } from "react";

type Emphasis = "none" | "pink" | "green" | "red";

type Props = {
  kicker?: string;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  eyebrowRight?: ReactNode;
  emphasis?: Emphasis;
  children: ReactNode;
};

function cardClass(emphasis: Emphasis): string {
  if (emphasis === "pink") return "ui-dash-card ui-dash-card--pink p-6";
  if (emphasis === "green") return "ui-dash-card ui-dash-card--green p-6";
  if (emphasis === "red") return "ui-dash-card ui-dash-card--red p-6";
  return "ui-dash-card p-6";
}

export function DashboardSection({
  kicker,
  title,
  subtitle,
  meta,
  eyebrowRight,
  emphasis = "none",
  children,
}: Props) {
  return (
    <section className="ui-dash-shell p-5 sm:p-6">
      <div className={cardClass(emphasis)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {kicker ? <p className="ui-dash-kicker">{kicker}</p> : null}
            <h2 className="ui-dash-title">{title}</h2>
            {subtitle ? <p className="ui-dash-subtitle">{subtitle}</p> : null}
            {meta ? <div className="ui-dash-meta">{meta}</div> : null}
          </div>
          {eyebrowRight ? <div className="shrink-0">{eyebrowRight}</div> : null}
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}
