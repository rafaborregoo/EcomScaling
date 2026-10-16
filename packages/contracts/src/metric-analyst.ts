/**
 * Analista de métricas, capa determinista (ADR-0027).
 *
 * Decide si una cifra va bien o mal SIN modelo de lenguaje: el veredicto sale de
 * reglas con fuente (umbral económico de la tienda, objetivo fijado, tendencia
 * frente al periodo anterior, historial de 12 meses) y de un guardarraíl de
 * muestra mínima. La IA, cuando llegue, explica y propone sobre este veredicto;
 * nunca lo inventa.
 *
 * Cada métrica es una ficha (`METRIC_SPECS`): definición, fórmula, dirección,
 * qué la mueve (drivers) y qué agente de área sabe más de ella. Añadir una
 * métrica = añadir una ficha y cómo se observa en la API; el motor es el mismo.
 */

export type MetricId = "mer" | "cac_new" | "conversion" | "meta_roas" | "email_open_rate";
export type MetricVerdict = "good" | "watch" | "bad" | "insufficient";
export type MetricUnit = "ratio" | "money" | "rate";
export type ReasonSource = "economic" | "target" | "trend" | "history" | "benchmark" | "sample" | "coverage";

export type MetricSpec = {
  id: MetricId;
  label: string;
  definition: string;
  formula: string;
  unit: MetricUnit;
  higherIsBetter: boolean;
  /** Plataforma que se atribuye la cifra (ADR-0021). null = dato propio de la tienda. */
  attributedBy: "meta" | "klaviyo" | null;
  /** Agentes de área cuyo diagnóstico cubre esta métrica (contexto para la capa IA). */
  ownerAgents: string[];
  /** Qué mueve la métrica. `higherIsBetter` es el efecto sobre ESTA métrica, no en general. */
  drivers: Array<{ id: string; label: string; unit: MetricUnit; higherIsBetter: boolean }>;
  /** Por debajo de esta muestra no se juzga: el ruido manda. */
  minSample: { label: string; min: number };
  /** Si el umbral económico se cruza, cuánto pesa: algunas cifras se recuperan después (CAC vs LTV). */
  economicBreach: "bad" | "watch";
  /** Clave en `organization_metric_targets` y factor para pasar el objetivo a la unidad del valor. */
  target?: { key: string; scale: number };
  /** Consulta al RAG de metodología (conocimiento global) para contextualizar la métrica. */
  ragQuery: string;
};

export const METRIC_SPECS: Record<MetricId, MetricSpec> = {
  mer: {
    id: "mer",
    label: "MER",
    definition: "Cuánto vende la tienda por cada euro invertido en publicidad, en todas las plataformas juntas.",
    formula: "Ventas sin IVA ÷ inversión total en anuncios",
    unit: "ratio",
    higherIsBetter: true,
    attributedBy: null,
    ownerAgents: ["a21_adquisicion_shopify", "a14_operativa_meta"],
    drivers: [
      { id: "revenue", label: "Ventas sin IVA", unit: "money", higherIsBetter: true },
      { id: "spend", label: "Inversión en anuncios", unit: "money", higherIsBetter: false },
    ],
    minSample: { label: "pedidos", min: 20 },
    ragQuery: "MER ratio de eficiencia de marketing ventas totales entre inversión publicitaria break-even",
    economicBreach: "bad",
  },
  cac_new: {
    id: "cac_new",
    label: "CAC de cliente nuevo",
    definition: "Lo que cuesta en publicidad conseguir un cliente que compra por primera vez.",
    formula: "Inversión total en anuncios ÷ clientes nuevos",
    unit: "money",
    higherIsBetter: false,
    attributedBy: null,
    ownerAgents: ["a21_adquisicion_shopify", "a20_retencion_clientes"],
    drivers: [
      { id: "spend", label: "Inversión en anuncios", unit: "money", higherIsBetter: false },
      { id: "new_customers", label: "Clientes nuevos", unit: "ratio", higherIsBetter: true },
    ],
    minSample: { label: "clientes nuevos", min: 10 },
    ragQuery: "CAC coste de adquisición de cliente nuevo frente a margen del primer pedido y LTV payback",
    // Pasarse en el primer pedido puede compensarlo la recompra: avisa, no condena.
    economicBreach: "watch",
    target: { key: "cac_blended", scale: 1 },
  },
  conversion: {
    id: "conversion",
    label: "Conversión",
    definition: "De cada 100 visitas a la tienda online, cuántas acaban en pedido.",
    formula: "Pedidos ÷ sesiones",
    unit: "rate",
    higherIsBetter: true,
    attributedBy: null,
    ownerAgents: ["a13_operativa_shopify"],
    drivers: [
      { id: "cart_rate", label: "Añaden al carrito", unit: "rate", higherIsBetter: true },
      { id: "checkout_rate", label: "Llegan al pago", unit: "rate", higherIsBetter: true },
      { id: "checkout_to_purchase_rate", label: "Pagan tras el checkout", unit: "rate", higherIsBetter: true },
    ],
    minSample: { label: "sesiones", min: 1000 },
    ragQuery: "tasa de conversión ecommerce embudo carrito checkout causas de caída",
    economicBreach: "bad",
    target: { key: "conversion_rate", scale: 0.01 },
  },
  meta_roas: {
    id: "meta_roas",
    label: "ROAS atribuido por Meta",
    definition: "Ventas que Meta se atribuye por cada euro invertido en Meta. Es la cuenta de Meta, no la de la tienda.",
    formula: "Valor de compras atribuido por Meta ÷ inversión en Meta = ticket × conversión × CTR ÷ CPM × 1000",
    unit: "ratio",
    higherIsBetter: true,
    attributedBy: "meta",
    ownerAgents: ["a14_operativa_meta", "a24_medicion_meta", "a23_creatividad_meta"],
    drivers: [
      { id: "cpm", label: "CPM", unit: "money", higherIsBetter: false },
      { id: "ctr", label: "CTR", unit: "rate", higherIsBetter: true },
      { id: "click_to_purchase", label: "Compras por clic", unit: "rate", higherIsBetter: true },
      { id: "aov", label: "Ticket atribuido", unit: "money", higherIsBetter: true },
    ],
    minSample: { label: "compras atribuidas", min: 10 },
    ragQuery: "ROAS objetivo break-even ROAS Meta CPM CTR atribución",
    economicBreach: "bad",
    target: { key: "roas", scale: 1 },
  },
  email_open_rate: {
    id: "email_open_rate",
    label: "Aperturas de email",
    definition: "De cada 100 emails entregados, cuántos se abren. Apple Mail infla esta cifra: compárala contigo misma, no con otras tiendas.",
    formula: "Aperturas únicas ÷ emails entregados",
    unit: "rate",
    higherIsBetter: true,
    attributedBy: "klaviyo",
    ownerAgents: ["a12_analista_email"],
    drivers: [
      { id: "bounce_rate", label: "Rebotes", unit: "rate", higherIsBetter: false },
      { id: "spam_rate", label: "Quejas de spam", unit: "rate", higherIsBetter: false },
      { id: "unsub_rate", label: "Bajas", unit: "rate", higherIsBetter: false },
    ],
    minSample: { label: "emails entregados", min: 500 },
    ragQuery: "tasa de apertura email entregabilidad rebotes spam Apple Mail Privacy",
    economicBreach: "bad",
  },
};

/** Lo que la API observa de una métrica. Todo opcional salvo valor y muestra: cada regla se aplica si su dato existe. */
export type MetricObservation = {
  value: number | null;
  previous?: number | null;
  sample: number;
  /** Umbral económico de la tienda (equilibrio): cruzarlo significa perder dinero. */
  threshold?: { value: number; label: string } | null;
  /** Objetivo ya en la unidad del valor. */
  target?: number | null;
  /** Solo cuando el objetivo NO lo fijó nadie (p. ej. "objetivo sugerido"): incumplirlo avisa, nunca condena. */
  targetLabel?: string;
  /** Serie histórica comparable (p. ej. 12 meses), sin el periodo actual. */
  history?: number[];
  /**
   * Referencia externa (tabla metric_benchmarks): niveles 5-6 del corpus 6.00. Solo cuenta si no hay
   * umbral económico, objetivo ni historial, y nunca condena: como mucho "vigilar".
   */
  benchmark?: { p25: number; p50: number; p75: number; label: string } | null;
  drivers?: Array<{ id: string; value: number | null; previous: number | null }>;
  /** Motivo por el que falta el dato (p. ej. plataforma sin conectar). Manda sobre todo lo demás. */
  unavailable?: string | null;
};

export type MetricReason = { source: ReasonSource; verdict: MetricVerdict; text: string };
export type MetricDriverChange = { id: string; label: string; value: number | null; previous: number | null; change_pct: number | null; effect: "helps" | "hurts" | "flat" | "unknown" };

export type MetricAnalysis = {
  metric: MetricId;
  label: string;
  definition: string;
  formula: string;
  attributed_by: MetricSpec["attributedBy"];
  owner_agents: string[];
  verdict: MetricVerdict;
  confidence: "high" | "medium" | "low";
  value: number | null;
  previous: number | null;
  change_pct: number | null;
  reasons: MetricReason[];
  drivers: MetricDriverChange[];
  /** El driver que más empuja en contra; es por donde empezar a mirar. */
  main_driver: string | null;
  /** Objetivo calculado con la economía de la tienda cuando nadie ha fijado uno (lo rellena la API). */
  suggested_target?: { value: number; text: string } | null;
  /** Fragmentos de la metodología (RAG global) sobre esta métrica; solo para consultores (lo rellena la API). */
  methodology?: Array<{ title: string; excerpt: string }>;
};

/** Cambios por debajo de esto se consideran ruido; por encima del segundo, graves. */
export const TREND_WATCH_PCT = 15;
export const TREND_BAD_PCT = 30;
/** Margen sobre el umbral económico por debajo del cual se avisa aunque aún no se pierda dinero. */
export const ECONOMIC_CUSHION = 0.15;

const RANK: Record<MetricVerdict, number> = { good: 0, insufficient: 0, watch: 1, bad: 2 };

const changePct = (now: number | null | undefined, before: number | null | undefined) =>
  now == null || before == null || before === 0 ? null : ((now - before) / Math.abs(before)) * 100;

const fmt = (v: number, unit: MetricUnit) =>
  unit === "rate" ? `${(v * 100).toFixed(2).replace(".", ",")} %` : unit === "money" ? v.toFixed(2).replace(".", ",") : v.toFixed(2).replace(".", ",");

const pctText = (p: number) => `${Math.abs(p).toFixed(0)} %`;

function percentileRank(value: number, history: number[]) {
  const below = history.filter((h) => h < value).length;
  return below / history.length;
}

export function assessMetric(spec: MetricSpec, obs: MetricObservation): MetricAnalysis {
  const base = {
    metric: spec.id,
    label: spec.label,
    definition: spec.definition,
    formula: spec.formula,
    attributed_by: spec.attributedBy,
    owner_agents: spec.ownerAgents,
    value: obs.value,
    previous: obs.previous ?? null,
    change_pct: changePct(obs.value, obs.previous),
  };

  const drivers: MetricDriverChange[] = spec.drivers.map((d) => {
    const seen = obs.drivers?.find((x) => x.id === d.id);
    const change = changePct(seen?.value, seen?.previous);
    const effect: MetricDriverChange["effect"] =
      change == null ? "unknown" : Math.abs(change) < 5 ? "flat" : (change > 0) === d.higherIsBetter ? "helps" : "hurts";
    return { id: d.id, label: d.label, value: seen?.value ?? null, previous: seen?.previous ?? null, change_pct: change, effect };
  });
  const hurting = drivers.filter((d) => d.effect === "hurts").sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0));
  const main_driver = hurting[0]?.id ?? null;

  if (obs.unavailable) {
    return { ...base, verdict: "insufficient", confidence: "low", reasons: [{ source: "coverage", verdict: "insufficient", text: obs.unavailable }], drivers, main_driver: null };
  }
  if (obs.value == null || obs.sample < spec.minSample.min) {
    return {
      ...base,
      verdict: "insufficient",
      confidence: "low",
      reasons: [{ source: "sample", verdict: "insufficient", text: `Solo ${obs.sample} ${spec.minSample.label} en el periodo; hacen falta ${spec.minSample.min} para juzgarla sin que mande el azar.` }],
      drivers,
      main_driver: null,
    };
  }

  const v = obs.value;
  const up = spec.higherIsBetter;
  const reasons: MetricReason[] = [];

  if (obs.threshold && obs.threshold.value > 0) {
    const t = obs.threshold.value;
    const breached = up ? v < t : v > t;
    const close = up ? v < t * (1 + ECONOMIC_CUSHION) : v > t * (1 - ECONOMIC_CUSHION);
    reasons.push(
      breached
        ? { source: "economic", verdict: spec.economicBreach, text: `${fmt(v, spec.unit)} ${up ? "por debajo" : "por encima"} del ${obs.threshold.label} (${fmt(t, spec.unit)}): con esta cifra se pierde dinero.` }
        : close
          ? { source: "economic", verdict: "watch", text: `A menos de un ${ECONOMIC_CUSHION * 100} % del ${obs.threshold.label} (${fmt(t, spec.unit)}): poco margen.` }
          : { source: "economic", verdict: "good", text: `Con holgura frente al ${obs.threshold.label} (${fmt(t, spec.unit)}).` },
    );
  }

  if (obs.target != null && obs.target > 0) {
    const ratio = v / obs.target;
    const miss = up ? ratio < 1 : ratio > 1;
    const far = up ? ratio < 0.8 : ratio > 1.2;
    reasons.push(
      miss
        ? { source: "target", verdict: far && !obs.targetLabel ? "bad" : "watch", text: `${up ? "Por debajo" : "Por encima"} del ${obs.targetLabel ?? "objetivo"} de ${fmt(obs.target, spec.unit)}.` }
        : { source: "target", verdict: "good", text: `Cumple el ${obs.targetLabel ?? "objetivo"} de ${fmt(obs.target, spec.unit)}.` },
    );
  }

  const change = base.change_pct;
  if (change != null) {
    const adverse = up ? change < 0 : change > 0;
    const size = Math.abs(change);
    if (adverse && size >= TREND_WATCH_PCT) {
      reasons.push({ source: "trend", verdict: size >= TREND_BAD_PCT ? "bad" : "watch", text: `${change > 0 ? "Sube" : "Baja"} un ${pctText(change)} frente al periodo anterior.` });
    } else if (!adverse && size >= TREND_WATCH_PCT) {
      reasons.push({ source: "trend", verdict: "good", text: `${change > 0 ? "Sube" : "Baja"} un ${pctText(change)} frente al periodo anterior.` });
    }
  }

  const history = (obs.history ?? []).filter((h) => Number.isFinite(h));
  if (history.length >= 6) {
    const rank = percentileRank(v, history);
    const worse = up ? rank <= 0.25 : rank >= 0.75;
    const better = up ? rank >= 0.75 : rank <= 0.25;
    if (worse) reasons.push({ source: "history", verdict: "watch", text: `Entre los peores registros de los últimos ${history.length} meses.` });
    else if (better) reasons.push({ source: "history", verdict: "good", text: `Entre los mejores registros de los últimos ${history.length} meses.` });
  }

  const b = obs.benchmark;
  if (b && !reasons.some((r) => r.source === "economic" || r.source === "target" || r.source === "history")) {
    const low = up ? v < b.p25 : v > b.p75;
    const aboveMedian = up ? v >= b.p50 : v <= b.p50;
    reasons.push(
      low
        ? { source: "benchmark", verdict: "watch", text: `Entre el 25 % de tiendas con peor cifra de ${b.label} (mediana ${fmt(b.p50, spec.unit)}).` }
        : { source: "benchmark", verdict: "good", text: `${aboveMedian ? "Mejor" : "Algo peor"} que la mediana de ${b.label} (${fmt(b.p50, spec.unit)}).` },
    );
  }

  if (reasons.length === 0) {
    if (change == null) {
      return { ...base, verdict: "insufficient", confidence: "low", reasons: [{ source: "coverage", verdict: "insufficient", text: "No hay umbral, objetivo ni periodo anterior con que compararla." }], drivers, main_driver };
    }
    reasons.push({ source: "trend", verdict: "good", text: `Estable frente al periodo anterior (${change >= 0 ? "+" : "−"}${pctText(change)}).` });
  }

  const verdict = reasons.reduce<MetricVerdict>((worst, r) => (RANK[r.verdict] > RANK[worst] ? r.verdict : worst), "good");
  const confidence = reasons.some((r) => r.source === "economic") ? "high" : reasons.some((r) => r.source === "target" || r.source === "history") ? "medium" : "low";
  return { ...base, verdict, confidence, reasons, drivers, main_driver };
}
