export const THEMES = [
  {
    id: "midnight-pop",
    label: "Pink / Purple / Blue",
    shortLabel: "PPB",
    vars: {
      brand: "#f679d0",
      brandMuted: "#ffa8e6",
      cardGlassBg: "rgba(246, 121, 208, 0.1)",
      cardSolidBg: "#ffffff",
      accentPrimary: "#f679d0",
      accentSecondary: "#22d3ee",
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
      cardGlassBg: "rgba(251, 146, 60, 0.1)",
      cardSolidBg: "#fffaf0",
      accentPrimary: "#fb923c",
      accentSecondary: "#fbbf24",
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
      cardGlassBg: "rgba(34, 197, 94, 0.1)",
      cardSolidBg: "#f8fffb",
      accentPrimary: "#22c55e",
      accentSecondary: "#3b82f6",
      wavePink: "#22c55e",
      wavePurple: "#3b82f6",
      waveBlue: "#e5f4ff",
      waveCyan: "#22d3ee",
    },
  },
  {
    id: "minimal",
    label: "Minimal Black / White",
    shortLabel: "MIN",
    vars: {
      brand: "#f8fafc",
      brandMuted: "#d4d4d8",
      cardGlassBg: "rgba(255, 255, 255, 0.07)",
      cardSolidBg: "#ffffff",
      accentPrimary: "#ffffff",
      accentSecondary: "#94a3b8",
      wavePink: "#ffffff",
      wavePurple: "#a3a3a3",
      waveBlue: "#60a5fa",
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
