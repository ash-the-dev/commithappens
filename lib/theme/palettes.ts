export const THEMES = [
  {
    id: "midnight-pop",
    label: "Pink / Purple / Blue",
    shortLabel: "PPB",
    vars: {
      brand: "#f679d0",
      brandMuted: "#ffa8e6",
      wavePink: "#f679d0",
      wavePurple: "#a855f7",
      waveBlue: "#3b82f6",
      waveCyan: "#22d3ee",
    },
  },
  {
    id: "sunset-signal",
    label: "Orange / Yellow / Red",
    shortLabel: "OYR",
    vars: {
      brand: "#fb923c",
      brandMuted: "#fcd34d",
      wavePink: "#fb923c",
      wavePurple: "#f59e0b",
      waveBlue: "#ef4444",
      waveCyan: "#fbbf24",
    },
  },
  {
    id: "neon-frost",
    label: "Neon Green / Blue / White",
    shortLabel: "NGBW",
    vars: {
      brand: "#22c55e",
      brandMuted: "#93c5fd",
      wavePink: "#22c55e",
      wavePurple: "#3b82f6",
      waveBlue: "#e5f4ff",
      waveCyan: "#22d3ee",
    },
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "midnight-pop";
export const THEME_STORAGE_KEY = "wip-theme";

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}
