"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  isThemeId,
  THEMES,
  THEME_STORAGE_KEY,
} from "@/lib/theme/palettes";

const THEME_EVENT = "commithappens-theme-change";

function subscribeToTheme(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
}

function getClientThemeSnapshot() {
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY) ?? "";
  return isThemeId(raw) ? raw : DEFAULT_THEME;
}

function getServerThemeSnapshot() {
  return DEFAULT_THEME;
}

export function ThemePicker() {
  const themeId = useSyncExternalStore(
    subscribeToTheme,
    getClientThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }, [themeId]);

  const index = THEMES.findIndex((theme) => theme.id === themeId);
  const activeTheme = THEMES[index >= 0 ? index : 0];
  const nextTheme = THEMES[(index + 1) % THEMES.length];
  const swatch = `conic-gradient(${activeTheme.vars.wavePink}, ${activeTheme.vars.wavePurple}, ${activeTheme.vars.waveBlue}, ${activeTheme.vars.waveCyan}, ${activeTheme.vars.wavePink})`;

  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/65">
        Theme
      </span>
      <button
        type="button"
        onClick={() => {
          document.documentElement.dataset.theme = nextTheme.id;
          window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme.id);
          window.dispatchEvent(new Event(THEME_EVENT));
        }}
        className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-black/40 transition hover:border-brand/70"
        title={`Theme: ${activeTheme.label} (click to switch)`}
        aria-label={`Theme: ${activeTheme.label}. Click to switch palette.`}
      >
        <span
          className="h-6 w-6 rounded-full ring-1 ring-white/25 transition group-hover:scale-105"
          style={{ background: swatch }}
        />
      </button>
    </div>
  );
}
