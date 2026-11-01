"use client";

import { useMemo } from "react";
import { BubbleChart, type BubblePoint, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

/**
 * Cartera del consultor, a la vista: quién pide atención y cuánto pesa.
 *
 * Es la lectura gráfica de la misma lista por urgencia que hay debajo (Shopify,
 * Meta y Klaviyo la calculan en el servidor, de forma determinista). Aquí no se
 * decide nada: cada burbuja es una fila de esa lista. Más arriba = más urgente;
 * más a la derecha = más peso en la cartera. Clic = abrir al cliente.
 */
export type AttentionLevel = "critica" | "alta" | "media" | "estable";

export type AttentionItem = {
  id: string;
  name: string;
  /** Segunda línea del recuadro: cliente, tienda, última lectura… */
  sub?: string;
  level: AttentionLevel;
  score: number;
  reasons: string[];
  /** Peso en la cartera (facturación, gasto…). null = no se conoce. */
  weight: number | null;
  /** La urgencia viene de no poder leer la cuenta, no de que vaya mal. */
  blind?: boolean;
};

const LEVELS: Array<{ level: AttentionLevel; label: string; color: string }> = [
  { level: "critica", label: "Críticas", color: "var(--danger)" },
  { level: "alta", label: "Altas", color: "var(--warning)" },
  { level: "media", label: "Medias", color: "var(--chart-series-2)" },
  { level: "estable", label: "Estables", color: "var(--color-success)" },
];

const COLOR = Object.fromEntries(LEVELS.map((entry) => [entry.level, entry.color])) as Record<AttentionLevel, string>;
const LABEL: Record<AttentionLevel, string> = { critica: "Crítica", alta: "Alta", media: "Media", estable: "Estable" };

export function PortfolioAttention({
  items,
  noun,
  weightLabel,
  formatWeight,
  onOpen,
}: {
  items: AttentionItem[];
  /** «tiendas», «cuentas»… para el titular. */
  noun: string;
  weightLabel: string;
  formatWeight: (value: number) => string;
  onOpen: (id: string) => void;
}) {
  const known = items.filter((item) => item.weight !== null).length;
  const weighted = known > 0;
  const points = useMemo<BubblePoint[]>(() => {
    const maxScore = Math.max(100, ...items.map((item) => item.score));
    return items.map((item, index) => ({
      id: item.id,
      label: item.name,
      x: item.weight ?? (weighted ? 0 : index + 1),
      y: Math.round((item.score / maxScore) * 100),
      size: Math.max(item.weight ?? 1, 1),
      color: COLOR[item.level],
      detail: (
        <>
          {item.sub ? <p>{item.sub}</p> : null}
          <p className="font-medium" style={{ color: COLOR[item.level] }}>
            {LABEL[item.level]}
            {item.blind ? " · sin datos fiables" : ""}
          </p>
          {item.reasons.slice(0, 3).map((reason) => (
            <p key={reason}>· {reason}</p>
          ))}
        </>
      ),
    }));
  }, [items, weighted]);

  if (items.length === 0) return null;
  const counts = LEVELS.map((entry) => ({ ...entry, n: items.filter((item) => item.level === entry.level).length }));
  const first = [...items].sort((a, b) => b.score - a.score)[0];
  const urgent = items.filter((item) => item.level === "critica" || item.level === "alta").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quién pide atención</CardTitle>
        <CardDescription>{urgent > 0
          ? `${urgent} de ${items.length} ${noun} piden revisión, empezando por ${first?.name}.`
          : `Ninguna de las ${items.length} ${noun} pide revisión ahora mismo.`}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Reparto por urgencia">
          {counts.map((entry) => (
            <span
              key={entry.level}
              className="inline-flex items-center gap-2 rounded-full border border-separator px-3 py-1 text-xs"
            >
              <i className="inline-block size-2.5 rounded-full" style={{ background: entry.color }} aria-hidden />
              {entry.label} <strong className="tabular-nums">{entry.n}</strong>
            </span>
          ))}
        </div>
        <BubbleChart
          points={points}
          xFormatter={weighted ? formatWeight : undefined}
          xLabel={weighted ? weightLabel : undefined}
          yLabel="Urgencia"
          onPointClick={(point) => onOpen(point.id)}
        />
        <p className="mt-1 text-xs text-muted">
          Cada burbuja es una cuenta. Arriba, lo más urgente{weighted ? "; a la derecha, lo que más pesa en la cartera" : ""}. Pasa el ratón para ver por qué y haz clic para abrirla.
          {weighted && known < items.length ? ` Sin ${weightLabel.toLowerCase()} conocido en ${items.length - known}: quedan en el eje izquierdo.` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
