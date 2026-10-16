import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { MetricAnalysis, MetricId, MetricVerdict } from "@e-nora/contracts";
import { apiSend } from "../lib/api";
import { useApi } from "../lib/use-api";
import { c, font } from "../lib/theme";
import { Sheet } from "./sheet";

// Analista de métricas (ADR-0027). El veredicto lo calcula el API con reglas, no la IA:
// aquí solo se pinta un punto de color en la tarjeta y, al tocarla, el porqué.

export const VERDICT: Record<MetricVerdict, { label: string; color: string }> = {
  good: { label: "Va bien", color: "#3d3b3a" },
  watch: { label: "Vigilar", color: "#d97706" },
  bad: { label: "Mal", color: "#dc2626" },
  insufficient: { label: "Sin datos suficientes", color: "#9a9a9f" },
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

const CONFIDENCE = { high: "Confianza alta", medium: "Confianza media", low: "Confianza baja" } as const;

/** Análisis de todas las métricas de la ficha y el estado de la hoja abierta. */
export function useAnalyst(orgId: string, days: number) {
  const { data, reload } = useApi<{ analyses: MetricAnalysis[] }>(`/v1/organizations/${orgId}/metric-analysis?days=${days}`);
  const [open, setOpen] = useState<MetricId | null>(null);
  const get = (id: MetricId) => data?.analyses.find((a) => a.metric === id) ?? null;
  /** Props para `Kpi`: punto de color y abrir la hoja al tocar. */
  const kpi = (id: MetricId) => {
    const a = get(id);
    return a ? { dot: VERDICT[a.verdict].color, onPress: () => setOpen(id) } : {};
  };
  const sheet = <AnalysisSheet analysis={open ? get(open) : null} orgId={orgId} days={days} onClose={() => setOpen(null)} />;
  return { kpi, sheet, reload };
}

function AnalysisSheet({ analysis: a, orgId, days, onClose }: { analysis: MetricAnalysis | null; orgId: string; days: number; onClose: () => void }) {
  if (!a) return null;
  const v = VERDICT[a.verdict];
  const moved = a.drivers.filter((d) => d.change_pct != null);
  return (
    <Sheet visible onClose={onClose} title={a.label}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: v.color }} />
        <Text style={{ fontSize: 16, fontFamily: font.semibold, color: v.color }}>{v.label}</Text>
        <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>· {CONFIDENCE[a.confidence]}</Text>
      </View>

      {a.verdict !== "insufficient" && <Explanation orgId={orgId} days={days} metric={a.metric} />}

      {a.reasons.map((r, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: VERDICT[r.verdict].color }} />
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, fontFamily: font.regular, color: c.ink }}>
            <Text style={{ fontFamily: font.semibold }}>{SOURCE[r.source]}: </Text>
            {r.text}
          </Text>
        </View>
      ))}

      {moved.length > 0 && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>Qué la está moviendo</Text>
          {moved.map((d) => {
            const color = d.effect === "hurts" ? c.danger : d.effect === "helps" ? c.accent : c.muted;
            return (
              <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 14, fontFamily: d.id === a.main_driver ? font.semibold : font.regular, color: c.ink }}>
                  {d.label}
                  {d.id === a.main_driver ? " · empieza por aquí" : ""}
                </Text>
                <Text style={{ fontSize: 14, fontFamily: font.semibold, color }}>
                  {d.change_pct! >= 0 ? "▲" : "▼"} {Math.abs(d.change_pct!).toFixed(0)} %
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {a.suggested_target && (
        <View style={{ marginTop: 4, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.edge, gap: 4 }}>
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>
            {a.suggested_target.value ? `Objetivo sugerido: ${a.suggested_target.value.toLocaleString("es-ES")}` : "Sin objetivo alcanzable"}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.ink }}>{a.suggested_target.text}</Text>
        </View>
      )}

      {(a.methodology ?? []).length > 0 && (
        <View style={{ gap: 8, marginTop: 4 }}>
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>Qué dice la metodología</Text>
          {a.methodology!.map((m, i) => (
            <View key={i} style={{ gap: 2 }}>
              <Text style={{ fontSize: 12, fontFamily: font.medium, color: c.muted }}>{m.title}</Text>
              <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.ink }}>{m.excerpt}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ marginTop: 4, padding: 12, borderRadius: 10, backgroundColor: c.surface, gap: 4 }}>
        <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.ink }}>{a.definition}</Text>
        <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted }}>{a.formula}</Text>
      </View>
    </Sheet>
  );
}

type Explained = { output: { answer: string; recommendations: Array<{ action: string; owner: string }>; warnings: string[] }; generated_at: string; renews_at: string };

/**
 * Lo que explica A29 al abrir la hoja. El POST devuelve la explicación guardada si tiene
 * menos de una hora; si no, la genera (tarda unos segundos: corre un modelo).
 */
function Explanation({ orgId, days, metric }: { orgId: string; days: number; metric: MetricId }) {
  const [state, setState] = useState<{ data?: Explained; error?: string }>({});
  useEffect(() => {
    let stale = false;
    setState({});
    apiSend<Explained>("POST", `/v1/organizations/${orgId}/metric-analysis/${metric}/explanation?days=${days}`, undefined, 120_000).then(
      (data) => !stale && setState({ data }),
      (e: Error) => !stale && setState({ error: e.message }),
    );
    return () => {
      stale = true;
    };
  }, [orgId, days, metric]);

  const box = { padding: 12, borderRadius: 10, backgroundColor: c.accentTint, gap: 6 } as const;
  if (state.error) return <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>La IA no ha podido explicarla ahora: {state.error}</Text>;
  if (!state.data) {
    return (
      <View style={{ ...box, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ActivityIndicator color={c.accent} />
        <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.ink }}>La IA está analizando esta cifra…</Text>
      </View>
    );
  }
  const o = state.data.output;
  return (
    <View style={box}>
      <Text style={{ fontSize: 15, lineHeight: 22, fontFamily: font.regular, color: c.ink }}>{o.answer}</Text>
      {o.recommendations.map((r, i) => (
        <Text key={i} style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.ink }}>
          <Text style={{ fontFamily: font.semibold }}>{r.owner === "consultor" ? "Consultor" : "Tú"}: </Text>
          {r.action}
        </Text>
      ))}
      <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>Análisis de la IA · se renueva a las {new Date(state.data.renews_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</Text>
    </View>
  );
}
