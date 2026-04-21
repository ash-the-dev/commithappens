import Image from "next/image";
import Link from "next/link";

const SRC = "/brand/commit-happens.png";

type Props = {
  /** `null` = not a link (e.g. centered auth header). */
  href?: string | null;
  className?: string;
  variant?: "header" | "hero" | "dashboard";
  priority?: boolean;
  /** Extra emphasis in the signed-in shell (height + max width). */
  scale?: "default" | "dashboardXL";
};

export function CommitHappensMark({
  href = "/",
  className = "",
  variant = "header",
  /** Above-the-fold brand mark: eager-load for LCP (Next `priority`). */
  priority = true,
  scale = "default",
}: Props) {
  const heightClass =
    variant === "hero"
      ? "h-16 w-auto sm:h-20 md:h-24"
      : variant === "dashboard"
        ? scale === "dashboardXL"
          ? "h-[4.5rem] w-auto min-[480px]:h-[6rem] md:h-[7.25rem] lg:h-[8rem]"
          : "h-14 w-auto sm:h-20 md:h-24"
        : "h-7 w-auto sm:h-8";

  const maxW =
    variant === "dashboard"
      ? scale === "dashboardXL"
        ? "max-w-[min(100vw-3rem,56rem)]"
        : "max-w-[min(100%,36rem)]"
      : "max-w-[min(100%,22rem)]";

  const inner = (
    <span
      className={`brand-logo-fx relative inline-flex max-w-full items-center rounded-sm ${className}`}
    >
      <Image
        src={SRC}
        alt="Commit Happens"
        width={1536}
        height={1024}
        priority={priority}
        className={`relative z-1 ${heightClass} ${maxW} object-contain object-left`}
      />
    </span>
  );

  if (href != null) {
    return (
      <Link
        href={href}
        className="shrink-0 outline-offset-4 focus-visible:outline focus-visible:outline-brand"
      >
        {inner}
      </Link>
    );
  }

  return <span className="inline-flex shrink-0 justify-center">{inner}</span>;
}
