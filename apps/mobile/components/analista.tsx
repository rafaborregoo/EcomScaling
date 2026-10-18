import { createContext, useContext, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Check, ChevronDown, ChevronRight, CircleAlert, MessageCircle, MessageSquare, Plus, Sparkles, Target } from "lucide-react-native";
import { METRIC_SPECS, type MetricAnalysis, type MetricId, type MetricVerdict } from "@e-nora/contracts";
import { apiSend } from "../lib/api";
import { useApi } from "../lib/use-api";
import { CAUTION, c, font, GOOD } from "../lib/theme";
import { Sheet } from "./sheet";
import { Delta, SummaryRow } from "./ui";
import { WriteToClient } from "./mensajes";

// Analista de métricas (ADR-0027). El veredicto lo calculan reglas en el API (gratis): punto de color junto a la
// cifra. El ✨ dice que A29 puede explicarla: solo corre al abrir la hoja. Sus recomendaciones se convierten en
// tarea con un toque (el toque es la aprobación) o se llevan al Copiloto para seguir preguntando.

export const VERDICT: Record<MetricVerdict, { label: string; color: string }> = {
  good: { label: "Va bien", color: GOOD },
  watch: { label: "Vigilar", color: CAUTION },
  bad: { label: "Mal", color: c.danger },
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

/** Lo pone app-shell: lleva al Copiloto con la pregunta ya escrita (no la envía; la persona decide). */
export const AskCopilot = createContext<(question: string) => void>(() => {});

type Scope = { id: string; connectionId?: string };
const query = (org: Scope, days: number) => `days=${days}${org.connectionId ? `&connectionId=${encodeURIComponent(org.connectionId)}` : ""}`;

const fmtValue = (v: number | null, metric: MetricId) => {
  if (v == null) return "—";
  const unit = METRIC_SPECS[metric].unit;
  return unit === "rate" ? `${(v * 100).toFixed(2).replace(".", ",")} %` : v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Análisis de todas las métricas de la ficha y la hoja abierta. */
export function useAnalyst(org: Scope, days: number) {
  const { data, reload } = useApi<{ analyses: MetricAnalysis[] }>(`/v1/organizations/${org.id}/metric-analysis?${query(org, days)}`);
  const [open, setOpen] = useState<MetricId | null>(null);
  const get = (id: MetricId) => data?.analyses.find((a) => a.metric === id) ?? null;
  /** Props para una fila de cifra: punto del veredicto, ✨ y abrir la hoja al tocar. */
  const kpi = (id: MetricId) => {
    const a = get(id);
    return a ? { dot: VERDICT[a.verdict].color, ai: true, onPress: () => setOpen(id) } : {};
  };
  const sheet = <AnalysisSheet analysis={open ? get(open) : null} org={org} days={days} onClose={() => setOpen(null)} />;
  return { kpi, sheet, reload, analyses: data?.analyses ?? null, open: setOpen };
}

/** Fila de «Para hoy»: métricas en rojo según las reglas (sin IA). Tocar abre la lista y cada una su análisis. */
export const badMetrics = (analyst: ReturnType<typeof useAnalyst>) => (analyst.analyses ?? []).filter((a) => a.verdict === "bad");

export function MetricsAlert({ analyst }: { analyst: ReturnType<typeof useAnalyst> }) {
  const [list, setList] = useState(false);
  const bad = badMetrics(analyst);
  if (bad.length === 0) return null;
  return (
    <>
      <SummaryRow title="Métricas en rojo" summary={String(bad.length)} color={c.danger} dot={c.danger} onPress={() => (bad.length === 1 ? analyst.open(bad[0]!.metric) : setList(true))} />
      <Sheet visible={list} onClose={() => setList(false)} title="Métricas en rojo" count={bad.length}>
        {bad.map((a, i) => (
          <Pressable
            key={a.metric}
            onPress={() => {
              setList(false);
              analyst.open(a.metric);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger }} />
            <Text style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: c.ink }}>{a.label}</Text>
            <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{fmtValue(a.value, a.metric)}</Text>
            <Sparkles size={16} color={c.accent} />
          </Pressable>
        ))}
      </Sheet>
      {analyst.sheet}
    </>
  );
}

function AnalysisSheet({ analysis: a, org, days, onClose }: { analysis: MetricAnalysis | null; org: Scope; days: number; onClose: () => void }) {
  const [more, setMore] = useState(false);
  if (!a) return null;
  const v = VERDICT[a.verdict];
  const spec = METRIC_SPECS[a.metric];
  const moved = a.drivers.filter((d) => d.change_pct != null);
  const small = { fontSize: 13, fontFamily: font.regular, color: c.muted } as const;
  return (
    <Sheet visible onClose={onClose} title={a.label}>
      {/* Cifra y veredicto */}
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          <Text style={{ fontSize: 34, fontFamily: font.semibold, color: c.ink }}>{fmtValue(a.value, a.metric)}</Text>
          <Delta value={a.change_pct} lowerIsBetter={!spec.higherIsBetter} size={14} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: v.color }} />
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: v.color }}>{v.label}</Text>
        </View>
      </View>

      {a.verdict !== "insufficient" && <Explanation org={org} days={days} metric={a.metric} label={a.label} />}

      {/* Qué la mueve */}
      {moved.length > 0 && (
        <View style={{ gap: 8 }}>
          {moved.map((d) => {
            const color = d.effect === "hurts" ? c.danger : d.effect === "helps" ? GOOD : c.muted;
            const main = d.id === a.main_driver;
            return (
              <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {main ? <Target size={14} color={color} /> : <View style={{ width: 14 }} />}
                <Text style={{ flex: 1, fontSize: 14, fontFamily: main ? font.semibold : font.regular, color: c.ink }}>{d.label}</Text>
                <Text style={{ fontSize: 14, fontFamily: font.semibold, color }}>
                  {d.change_pct! >= 0 ? "▲" : "▼"} {Math.abs(d.change_pct!).toFixed(0)} %
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {a.suggested_target?.value ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Target size={16} color={c.muted} />
          <Text style={{ fontSize: 14, fontFamily: font.medium, color: c.ink }}>Objetivo sugerido {a.suggested_target.value.toLocaleString("es-ES")}</Text>
        </View>
      ) : null}

      {/* Detalle plegado: reglas, metodología y definición */}
      <Pressable onPress={() => setMore((m) => !m)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
        {more ? <ChevronDown size={16} color={c.muted} /> : <ChevronRight size={16} color={c.muted} />}
        <Text style={{ fontSize: 14, fontFamily: font.medium, color: c.muted }}>Cómo se calcula</Text>
      </Pressable>
      {more && (
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.ink }}>{a.definition}</Text>
          <Text style={small}>{a.formula}</Text>
          {a.reasons.map((r, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: VERDICT[r.verdict].color }} />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, fontFamily: font.regular, color: c.ink }}>
                <Text style={{ fontFamily: font.semibold }}>{SOURCE[r.source]}: </Text>
                {r.text}
              </Text>
            </View>
          ))}
          {(a.methodology ?? []).map((m, i) => (
            <View key={`m${i}`} style={{ gap: 2 }}>
              <Text style={{ fontSize: 12, fontFamily: font.medium, color: c.muted }}>{m.title}</Text>
              <Text style={{ fontSize: 13, lineHeight: 19, fontFamily: font.regular, color: c.ink }}>{m.excerpt}</Text>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

type Explained = { output: { answer: string; recommendations: Array<{ action: string; owner: string }>; warnings: string[] }; generated_at: string; renews_at: string };

/**
 * Lo que explica A29 al abrir la hoja. El POST devuelve la explicación guardada si tiene
 * menos de una hora; si no, la genera (tarda unos segundos: corre un modelo).
 */
function Explanation({ org, days, metric, label }: { org: Scope; days: number; metric: MetricId; label: string }) {
  const [state, setState] = useState<{ data?: Explained; error?: string }>({});
  const askCopilot = useContext(AskCopilot);
  const write = useContext(WriteToClient);
  useEffect(() => {
    let stale = false;
    setState({});
    apiSend<Explained>("POST", `/v1/organizations/${org.id}/metric-analysis/${metric}/explanation?${query(org, days)}`, undefined, 120_000).then(
      (data) => !stale && setState({ data }),
      (e: Error) => !stale && setState({ error: e.message }),
    );
    return () => {
      stale = true;
    };
  }, [org.id, org.connectionId, days, metric]);

  if (state.error) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CircleAlert size={16} color={c.muted} />
        <Text style={{ flex: 1, fontSize: 13, fontFamily: font.regular, color: c.muted }}>La IA no ha podido explicarla ahora.</Text>
      </View>
    );
  }
  if (!state.data) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
        <ActivityIndicator color={c.accent} />
        <Sparkles size={16} color={c.accent} />
      </View>
    );
  }
  const o = state.data.output;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Sparkles size={16} color={c.accent} style={{ marginTop: 3 }} />
        <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, fontFamily: font.regular, color: c.ink }}>{o.answer}</Text>
      </View>
      {o.recommendations.map((r, i) => (
        <ActionRow key={i} org={org} days={days} metric={metric} index={i} rec={r} />
      ))}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={() => askCopilot(`Sobre ${label}: ${o.answer}\n\n¿Qué más debería mirar?`)}
          accessibilityRole="button"
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.edge }}
        >
          <MessageCircle size={18} color={c.ink} />
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{write ? "Copiloto" : "Preguntar al Copiloto"}</Text>
        </Pressable>
        {/* Solo el consultor: el borrador lleva la métrica y lo termina él antes de enviarlo. */}
        {write && (
          <Pressable
            onPress={() => write(org.id, `Sobre ${label.toLowerCase()}: `)}
            accessibilityRole="button"
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: c.edge }}
          >
            <MessageSquare size={18} color={c.ink} />
            <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>Al cliente</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Una recomendación de A29 y su botón: crea la tarea (el toque es la aprobación) y queda marcada como hecha. */
function ActionRow({ org, days, metric, index, rec }: { org: Scope; days: number; metric: MetricId; index: number; rec: { action: string; owner: string } }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function create() {
    setState("busy");
    try {
      await apiSend("POST", `/v1/organizations/${org.id}/metric-analysis/${metric}/actions?${query(org, days)}`, { index });
      setState("done");
    } catch {
      setState("error");
    }
  }
  const done = state === "done";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.edge }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: font.medium, color: c.ink }}>{rec.action}</Text>
        <Text style={{ fontSize: 12, fontFamily: font.regular, color: state === "error" ? c.danger : c.muted }}>
          {state === "error" ? "No se pudo crear" : rec.owner === "consultor" ? "Consultor" : "Tienda"}
        </Text>
      </View>
      <Pressable
        onPress={create}
        disabled={state === "busy" || done}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={done ? "Tarea creada" : "Crear tarea"}
        style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: done ? GOOD : c.edge, backgroundColor: done ? GOOD : c.bg }}
      >
        {state === "busy" ? <ActivityIndicator size="small" color={c.accent} /> : done ? <Check size={20} color="#fff" strokeWidth={2.6} /> : <Plus size={20} color={c.ink} strokeWidth={2.4} />}
      </Pressable>
    </View>
  );
}
