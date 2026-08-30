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
        "flex items-start justify-between gap-4",
        card ? "" : "py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <p className={EYEBROW}>{label}</p>
        <p
          className={cn(
            "mt-1 font-semibold tracking-tight tabular-nums",
            size === "sm" ? "text-lg" : "text-2xl",
            VALUE_TONE[tone],
          )}
        >
          {value}
        </p>
        {delta ? <div className="mt-1">{delta}</div> : null}
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
      {hasTrend ? (
        <div className="w-24 shrink-0 self-center sm:w-32">
          <Sparkline data={trend} tone={trendTone} />
        </div>
      ) : null}
    </div>
  );

  if (!card) return body;
  return (
    <HeroCard className="w-full">
      <HeroCard.Content>{body}</HeroCard.Content>
    </HeroCard>
  );
}
