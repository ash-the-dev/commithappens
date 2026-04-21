"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { DEFAULT_THEME, isThemeId, THEME_STORAGE_KEY } from "@/lib/theme/palettes";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY) ?? "";
    if (isThemeId(saved)) {
      document.documentElement.dataset.theme = saved;
      return;
    }
    document.documentElement.dataset.theme = DEFAULT_THEME;
  }, []);

  return <SessionProvider>{children}</SessionProvider>;
}
