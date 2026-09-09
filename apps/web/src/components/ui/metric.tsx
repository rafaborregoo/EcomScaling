"use client";

import type { ReactNode } from "react";
import { Card as HeroCard } from "@heroui/react";
import { cn } from "./cn";
import { EYEBROW } from "./typography";
import { Sparkline } from "./chart";

// Cifra destacada (KPI) unica para todo el dashboard. La cifra va en la fuente
// del cuerpo con `tabular-nums` para que las columnas sigan alineadas, y un
// solo tamano por jerarquia (md / sm). Con `card`, se envuelve en el Card
// nativo de HeroUI (superficie + shadow-surface).
const VALUE_TONE = {
  default: "text-foreground",
  success: "text-success",
  warn: "text-warning",
  danger: "text-danger",
} as const;

// El tono solo teñia la cifra, y una tira de cinco KPIs quedaba en cinco cajas
// blancas identicas: habia que leerlas todas para ver cual pedia algo. La regla
// de color a la izquierda se lee de un vistazo, y el fondo suave solo aparece
// cuando hay estado (los tokens `*-soft` ya venian con HeroUI, sin usar).
const CARD_TONE = {
  default: "border-l-accent",
  success: "border-l-success bg-success-soft",
  warn: "border-l-warning bg-warning-soft",
  danger: "border-l-danger bg-danger-soft",
} as const;

export function Metric({
  label,
  value,
  hint,
  delta,
  trend,
  trendTone = "brand",
  tone = "default",
  size = "md",
  card = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  delta?: ReactNode;
  // Serie para el sparkline de la derecha (estilo tarjeta KPI). Necesita 2+
  // puntos; si no hay serie, la tarjeta se queda solo con cifra + delta.
  trend?: number[];
  trendTone?: "brand" | "success" | "danger";
  tone?: keyof typeof VALUE_TONE;
  size?: "md" | "sm";
  card?: boolean;
  className?: string;
}) {
  const hasTrend = Array.isArray(trend) && trend.length > 1;

  const body = (
    <div
      className={cn(
        // @container: el sparkline se esconde por el ancho REAL de la tarjeta, no
        // del viewport -- la misma Metric vive a ancho completo y tambien dentro
        // de una celda de ~150px de una rejilla de dos columnas en movil.
        "@container flex items-start justify-between gap-4",
        card ? "" : "py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <p className={EYEBROW}>{label}</p>
        <p
          className={cn(
            "mt-1 font-semibold tracking-tight tabular-nums",
            // A dos por fila en movil la tarjeta mide ~156px: text-2xl parte
            // "12.345,67 €" en dos lineas. Baja por ancho de tarjeta.
            // break-words: no todo valor es una cifra -- /camino mete aqui
            // "Fase activa" y "Hito en curso", que son nombres largos.
            "break-words",
            size === "sm" ? "text-lg" : "text-xl @2xs:text-2xl",
            VALUE_TONE[tone],
          )}
        >
          {value}
        </p>
        {delta ? <div className="mt-1">{delta}</div> : null}
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
      {hasTrend ? (
        <div className="hidden w-24 shrink-0 self-center @2xs:block @sm:w-32">
          <Sparkline data={trend} tone={trendTone} />
        </div>
      ) : null}
    </div>
  );

  if (!card) return body;
  return (
    <HeroCard className={cn("w-full border-l-4", CARD_TONE[tone])}>
      <HeroCard.Content>{body}</HeroCard.Content>
    </HeroCard>
  );
}
