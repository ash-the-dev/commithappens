import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type Props<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function ElevatedCard<T extends ElementType = "div">({
  as,
  children,
  className = "",
  ...props
}: Props<T>) {
  const Component = as ?? "div";
  return (
    <Component
      className={`rounded-3xl border border-black/8 bg-(--card-solid-bg) text-slate-950 shadow-[0_18px_55px_-38px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-0.5 ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
