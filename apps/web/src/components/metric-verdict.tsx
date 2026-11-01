"use client";

import { useEffect, useState } from "react";
import { EYEBROW, Popover, PopoverContent, PopoverTrigger, Spinner, Card, CardContent } from "@/components/ui";
import { AiInsight } from "@/components/ai-insight";
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
      <PopoverTrigger
        render={<button
          type="button"
          aria-label={`${a.label}: ${v.label}`}
          title={v.label}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-transparent"
        >
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: v.color }} />
        </button>}
      />
      <PopoverContent side="bottom" align="start" className="w-[22rem] max-h-[28rem] gap-0" aria-label={`Análisis de ${a.label}`}>
        <div>
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
            <Card size="sm" className="mt-4"><CardContent>
              <p className="text-sm font-semibold text-foreground">
                {a.suggested_target.value ? `Objetivo sugerido: ${a.suggested_target.value.toLocaleString("es-ES")}` : "Sin objetivo alcanzable"}
              </p>
              <p className="mt-1 text-sm leading-snug text-foreground">{a.suggested_target.text}</p>
            </CardContent></Card>
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type Explained = {
  output: {
    answer: string;
    findings?: Array<{ title: string; severity: string; evidence: string; figures?: Array<{ label: string; value: string; previous: string | null; change_pct: number | null }> }>;
    recommendations: Array<{ action: string; owner: string; priority?: string; expected_impact?: string }>;
    warnings?: string[];
  };
  renews_at: string;
};

const renewsAt = (iso: string) => `Puedes volver a generarla desde las ${new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`;

/** La explicación de A29 tal cual la devuelve, con la estructura común de la IA. */
export function A29Insight({ data, tag, audience }: { data: Explained; tag?: string; audience?: "cliente" | "consultor" }) {
  return (
    <AiInsight
      tag={tag}
      summary={data.output.answer}
      findings={data.output.findings}
      steps={data.output.recommendations}
      audience={audience}
      warnings={data.output.warnings}
      footer={renewsAt(data.renews_at)}
    />
  );
}

/**
 * A29 al abrir el popover (el contenido solo se monta abierto). El POST devuelve la
 * explicación guardada si tiene menos de una hora; si no, la genera con el modelo.
 */
export function useAiExplanation(path: string) {
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
  return state;
}

export function AiExplanation({ path }: { path: string }) {
  const state = useAiExplanation(path);
  if (state.error) return <p className="mt-3 text-[13px] text-muted">La IA no ha podido explicarla ahora: {state.error}</p>;
  if (!state.data) {
    return (
      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <Spinner size="sm" /> La IA está analizando esta cifra…
      </p>
    );
  }
  return (
    <div className="mt-3 border-t border-separator pt-3">
      <A29Insight data={state.data} />
    </div>
  );
}
