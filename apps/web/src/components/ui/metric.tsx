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
// blancas identicas: habia que leerlas todas para ver cual pedia algo. El fondo
// suave y el borde semantico solo aparecen cuando existe un estado que importa.
const CARD_TONE = {
  default: "border-edge",
  success: "border-success bg-success-soft",
  warn: "border-warning bg-warning-soft",
  danger: "border-danger bg-danger-soft",
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
  insight,
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
  // Marca de la IA, pegada a la etiqueta (no a la esquina de la tarjeta: ahi
  // choca con el sparkline y se pierde en la version `size="sm"`, que no es
  // una tarjeta sino una celda de rejilla). Ver MetricInsights.
  insight?: ReactNode;
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
      <div className="min-w-0 flex-1">
        {insight ? (
          <div className="flex items-center gap-1">
            <p className={EYEBROW}>{label}</p>
            {insight}
          </div>
        ) : (
          <p className={EYEBROW}>{label}</p>
        )}
        <p
          className={cn(
            "mt-1 text-center font-semibold tracking-tight tabular-nums",
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
    <HeroCard className={cn("w-full border", CARD_TONE[tone])}>
      <HeroCard.Content>{body}</HeroCard.Content>
    </HeroCard>
  );
}
