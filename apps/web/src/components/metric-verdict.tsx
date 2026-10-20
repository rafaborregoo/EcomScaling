"use client";

import { useEffect, useState } from "react";
import { EYEBROW, Popover, Spinner } from "@/components/ui";
import { apiFetch } from "@/lib/bootstrap";
import type { MetricAnalysis, MetricId, MetricVerdict as Verdict } from "@e-nora/contracts";
import { useCachedQuery } from "@/lib/use-cached-query";

// Analista de métricas (ADR-0027). El veredicto lo calcula el API con reglas con
// fuente (rentabilidad, objetivo, tendencia, historial); aquí solo se pinta.
// Mismo endpoint y mismas etiquetas que la app móvil (apps/mobile/components/analista.tsx).

const VERDICT: Record<Verdict, { label: string; color: string }> = {
  good: { label: "Va bien", color: "var(--good, #3d3b3a)" },
  watch: { label: "Vigilar", color: "var(--warn, #b45309)" },
  bad: { label: "Mal", color: "var(--bad, #dc2626)" },
  insufficient: { label: "Sin datos suficientes", color: "var(--ink-3, #8a8a8a)" },
};

const SOURCE: Record<MetricAnalysis["reasons"][number]["source"], string> = {
  economic: "Rentabilidad",
  target: "Objetivo",
  trend: "Tendencia",
  history: "Historial",
  benchmark: "Sector",
  sample: "Muestra",
  coverage: "Datos",
};

const CONFIDENCE = { high: "confianza alta", medium: "confianza media", low: "confianza baja" } as const;

/** Análisis de todas las métricas de la ficha. `get(id)` devuelve null mientras carga o si falla. */
export function useMetricAnalysis(organizationId: string, days: number | "all", connectionId?: string | null) {
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const query = useCachedQuery<{ analyses: MetricAnalysis[] }>(
    // "Todo" no tiene periodo anterior con que comparar: sin veredicto.
    days === "all" ? null : `/v1/organizations/${encodeURIComponent(organizationId)}/metric-analysis?days=${days}${scope}`,
  );
  return (id: MetricId): AnalysisWithPath | null => {
    const a = query.data?.analyses.find((item) => item.metric === id);
    return a && days !== "all"
      ? { ...a, explain_path: `/v1/organizations/${encodeURIComponent(organizationId)}/metric-analysis/${id}/explanation?days=${days}${scope}` }
      : null;
  };
}

type AnalysisWithPath = MetricAnalysis & { explain_path: string };

/** Punto de color junto a la etiqueta de la cifra; al pulsarlo, el porqué. */
export function MetricVerdict({ analysis: a }: { analysis: AnalysisWithPath | null }) {
  if (!a) return null;
  const v = VERDICT[a.verdict];
  const moved = a.drivers.filter((d) => d.change_pct != null);
  return (
    <Popover>
      <Popover.Trigger>
        <button
          type="button"
          aria-label={`${a.label}: ${v.label}`}
          title={v.label}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-transparent"
        >
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: v.color }} />
        </button>
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="max-w-[22rem]">
        <Popover.Dialog aria-label={`Análisis de ${a.label}`} className="max-h-[28rem] overflow-y-auto p-4">
          <p className={EYEBROW}>{a.label}</p>
          <p className="mt-1 text-sm font-semibold" style={{ color: v.color }}>
            {v.label} <span className="font-normal text-muted">· {CONFIDENCE[a.confidence]}</span>
          </p>
          {a.verdict !== "insufficient" ? <AiExplanation path={a.explain_path} /> : null}
          <ul className="mt-3 space-y-2">
            {a.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug text-foreground">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: VERDICT[r.verdict].color }} />
                <span>
                  <strong className="font-semibold">{SOURCE[r.source]}:</strong> {r.text}
                </span>
              </li>
            ))}
          </ul>
          {moved.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">Qué la está moviendo</p>
              <ul className="mt-1 space-y-1">
                {moved.map((d) => (
                  <li key={d.id} className="flex justify-between gap-3 text-sm">
                    <span className={d.id === a.main_driver ? "font-semibold" : undefined}>
                      {d.label}
                      {d.id === a.main_driver ? " · empieza por aquí" : ""}
                    </span>
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: d.effect === "hurts" ? "var(--bad, #dc2626)" : d.effect === "helps" ? "var(--good, #3d3b3a)" : "var(--ink-3, #8a8a8a)" }}
                    >
                      {d.change_pct! >= 0 ? "▲" : "▼"} {Math.abs(d.change_pct!).toFixed(0)} %
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {a.suggested_target ? (
            <div className="mt-4 rounded-lg border border-separator p-3">
              <p className="text-sm font-semibold text-foreground">
                {a.suggested_target.value ? `Objetivo sugerido: ${a.suggested_target.value.toLocaleString("es-ES")}` : "Sin objetivo alcanzable"}
              </p>
              <p className="mt-1 text-sm leading-snug text-foreground">{a.suggested_target.text}</p>
            </div>
          ) : null}
          {(a.methodology ?? []).length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-foreground">Qué dice la metodología</p>
              {a.methodology!.map((m, i) => (
                <div key={i} className="mt-2">
                  <p className="text-xs font-medium text-muted">{m.title}</p>
                  <p className="text-sm leading-snug text-foreground">{m.excerpt}</p>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            {a.definition} <span className="block font-medium">{a.formula}</span>
          </p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

type Explained = { output: { answer: string; recommendations: Array<{ action: string; owner: string }> }; renews_at: string };

/**
 * A29 al abrir el popover (el contenido solo se monta abierto). El POST devuelve la
 * explicación guardada si tiene menos de una hora; si no, la genera con el modelo.
 */
export function AiExplanation({ path }: { path: string }) {
  const [state, setState] = useState<{ data?: Explained; error?: string }>({});
  useEffect(() => {
    let stale = false;
    setState({});
    apiFetch(path, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) throw new Error(((await response.json().catch(() => null)) as { message?: string } | null)?.message ?? "No disponible ahora.");
        return (await response.json()) as Explained;
      })
      .then(
        (data) => !stale && setState({ data }),
        (error: Error) => !stale && setState({ error: error.message }),
      );
    return () => {
      stale = true;
    };
  }, [path]);

  if (state.error) return <p className="mt-3 text-[13px] text-muted">La IA no ha podido explicarla ahora: {state.error}</p>;
  if (!state.data) {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-lg bg-accent-soft p-3 text-sm text-foreground">
        <Spinner size="sm" /> La IA está analizando esta cifra…
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-accent-soft p-3 text-sm leading-snug text-foreground">
      <p>{state.data.output.answer}</p>
      {state.data.output.recommendations.map((r, i) => (
        <p key={i}>
          <strong className="font-semibold">{r.owner === "consultor" ? "Consultor" : "Cliente"}:</strong> {r.action}
        </p>
      ))}
      <p className="text-xs text-muted">Análisis de la IA · se renueva a las {new Date(state.data.renews_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
    </div>
  );
}
