/** Tokens alineados a apps/web/src/theme.css (viewport mobile). */
export const colors = {
  canvas: "#0a0a0b",
  panel: "#121214",
  elevated: "#18181b",
  border: "rgba(242,240,235,0.1)",
  text: "#f2f0eb",
  textMuted: "rgba(242,240,235,0.65)",
  textFaint: "rgba(242,240,235,0.45)",
  primary: "#d6ff4b",
  primaryHover: "#e4ff7a",
  primaryDim: "rgba(214,255,75,0.16)",
  primaryGlow: "rgba(214,255,75,0.45)",
  onPrimary: "#111",
  danger: "#ff6b6b",
  warning: "#f0c040",
  success: "#7ddea0",
  linkHover: "#e8ff8a",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const fonts = {
  display: "Syne_800ExtraBold",
  body: "Outfit_400Regular",
  bodyMedium: "Outfit_500Medium",
  bodySemiBold: "Outfit_600SemiBold",
  bodyBold: "Outfit_700Bold",
} as const;

export const tabBar = {
  height: 64,
} as const;
