import { createContext, useContext } from "react";

// Tokens copiados de apps/web/src/app/globals.css (:root). Una sola fuente: IBM Plex Sans.
export const c = {
  bg: "#ffffff",
  surface: "#fafafa",
  ink: "#171717",
  muted: "#5f5f5f",
  edge: "#d8d8d8",
  // Grafito del logo (#3d3b3a): el acento de la app ya no es verde.
  accent: "#3d3b3a",
  accentTint: "#f1f0ef",
  danger: "#dc2626",
  warning: "#856400",
};

export const font = {
  regular: "IBMPlexSans_400Regular",
  medium: "IBMPlexSans_500Medium",
  semibold: "IBMPlexSans_600SemiBold",
};

export function fmtCurrency(value: number | null | undefined, currency: string | null | undefined, decimals = 0) {
  if (value == null || !currency) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: "always",
    }).format(value);
  } catch {
    return `${value.toFixed(decimals)} ${currency}`;
  }
}

export const fmtNum = (v: number) => v.toLocaleString("es-ES", { useGrouping: true });

// Temas por canal, copiados de #portal-content[data-channel] en apps/web/src/app/globals.css.
// "todo" es el tema de siempre; Shopify, Meta y Klaviyo cambian color, fondo y forma de las tarjetas.
export type Theme = {
  paper: string;
  accent: string;
  soft: string;
  ink: string;
  secondary: string;
  radius: number;
  card: { borderWidth: number; borderColor: string; shadowOpacity: number; shadowRadius: number; elevation: number };
};

export const themes = {
  todo: { paper: c.bg, accent: c.accent, soft: c.accentTint, ink: c.ink, secondary: c.ink, radius: 16, card: { borderWidth: 1, borderColor: c.edge, shadowOpacity: 0, shadowRadius: 0, elevation: 0 } },
  shopify: { paper: "#e9f3ee", accent: "#008060", soft: "#e0f2ea", ink: "#004c3f", secondary: "#95bf47", radius: 12, card: { borderWidth: 0, borderColor: "transparent", shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 } },
  meta: { paper: "#e6effc", accent: "#0866ff", soft: "#e5eefe", ink: "#0a4fc4", secondary: "#7fb0ff", radius: 8, card: { borderWidth: 0, borderColor: "transparent", shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 } },
  klaviyo: { paper: "#efefef", accent: "#232426", soft: "#ececed", ink: "#232426", secondary: "#9a9a9f", radius: 4, card: { borderWidth: 1, borderColor: "#dcdcde", shadowOpacity: 0, shadowRadius: 0, elevation: 0 } },
} satisfies Record<string, Theme>;
export type ThemeKey = keyof typeof themes;

export const ThemeContext = createContext<Theme>(themes.todo);
export const useTheme = () => useContext(ThemeContext);

/** Estilo de una tarjeta blanca según el tema (forma, borde y sombra del canal). */
export const cardStyle = (th: Theme, background = c.bg) => ({
  backgroundColor: background,
  borderRadius: th.radius,
  borderWidth: th.card.borderWidth,
  borderColor: th.card.borderColor,
  shadowColor: "#1c2b33",
  shadowOpacity: th.card.shadowOpacity,
  shadowRadius: th.card.shadowRadius,
  shadowOffset: { width: 0, height: 1 },
  elevation: th.card.elevation,
});
