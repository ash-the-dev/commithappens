import { Archivo_Black } from "next/font/google";

const display = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
});

type Props = {
  size?: "hero" | "compact";
  /** When true, render as a single line (compact header). */
  singleLine?: boolean;
};

export function WaveWordmark({ size = "hero", singleLine = false }: Props) {
  const isHero = size === "hero";

  const commHero =
    "text-[clamp(2.12rem,7.35vw,3.95rem)] leading-[0.82] tracking-[-0.035em]";
  const commCompact =
    "text-[1.06rem] leading-none tracking-[-0.03em] sm:text-[1.24rem]";

  const itHero =
    "text-[clamp(2.28rem,7.85vw,4.2rem)] leading-[0.82] tracking-[-0.02em]";
  const itCompact =
    "text-[1.12rem] leading-none tracking-[-0.02em] sm:text-[1.3rem]";

  /** Slightly under “COMMIT” cap height — tracking tightened in `.wave-happens-fill`. */
  const happensHero =
    "text-[clamp(1.95rem,6.5vw,3.65rem)] leading-[0.9]";
  const happensCompact = "text-[1.02rem] leading-none sm:text-[1.18rem]";

  /** Navbar lockup: one-line, same visual language as hero. */
  const commNav = "text-[0.84rem] leading-none tracking-[-0.03em] sm:text-[0.98rem]";
  const itNav = "text-[0.9rem] leading-none tracking-[-0.02em] sm:text-[1.04rem]";
  const happensNav = "text-[0.82rem] leading-none sm:text-[0.94rem]";

  const commClass = `wave-comm-outline font-black uppercase ${isHero ? commHero : `wave-comm-outline--compact ${commCompact}`}`;

  if (singleLine) {
    const commNavClass = `wave-comm-outline wave-comm-outline--compact font-black uppercase ${commNav}`;
    return (
      <span
        className={`${display.className} wave-wordmark-wrap inline-flex max-w-full items-end gap-[0.1em] whitespace-nowrap select-none`}
      >
        <span className={commNavClass}>COMM</span>
        <span className={`wave-it-gradient-vert font-black uppercase ${itNav}`}>
          IT
        </span>
        <span
          className={`wave-happens-fill font-black uppercase ${happensNav}`}
        >
          HAPPENS
        </span>
      </span>
    );
  }

  return (
    <div
      className={`${display.className} inline-block max-w-full select-none overflow-visible ${isHero ? "pb-[clamp(1.85rem,6.2vw,3.55rem)]" : "pb-6"}`}
      aria-label="Commit Happens"
    >
      <div className="relative inline-block max-w-full">
        <div className="wave-wordmark-wrap flex min-w-0 flex-nowrap items-end justify-start gap-[0.03em]">
          <span className={commClass}>C</span>
          <span className={commClass}>O</span>
          <span className={commClass}>M</span>
          <span className={commClass}>M</span>
          <span
            className={`wave-it-gradient-vert font-black uppercase ${isHero ? itHero : itCompact}`}
          >
            IT
          </span>
        </div>
        <div className="absolute right-0 top-full z-2 mt-[0.1em] w-full text-right">
          <span
            className={`wave-happens-fill inline-block whitespace-nowrap font-black uppercase ${isHero ? happensHero : happensCompact}`}
          >
            HAPPENS
          </span>
        </div>
      </div>
    </div>
  );
}
