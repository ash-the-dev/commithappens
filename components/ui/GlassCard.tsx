import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type Props<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function GlassCard<T extends ElementType = "div">({
  as,
  children,
  className = "",
  ...props
}: Props<T>) {
  const Component = as ?? "div";
  return (
    <Component
      className={`rounded-3xl border border-white/16 bg-(--card-glass-bg) shadow-[0_24px_80px_-58px_color-mix(in_srgb,var(--accent-primary)_65%,black)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-white/24 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
