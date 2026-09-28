export type CaminoGoalProgressStatus = "on_track" | "at_risk" | "insufficient_data" | "achieved";
type Row = Record<string, unknown>;

export type CaminoMetricRead = {
  row: Row | null;
  error: string | null;
};

export type CaminoConnectionCoverage = {
  availability?: string;
  connections?: Array<{
    provider?: string;
    status?: string | null;
    last_sync_at?: string | null;
    last_error_at?: string | null;
  }>;
};

export type CaminoDeterministicGoalProgress = {
  status: CaminoGoalProgressStatus;
  observed_value: number | null;
  comparison_value: number | null;
  explanation: string;
  metric_label?: string;
  unit?: "money" | "pct" | "count" | "ratio";
  baseline_value?: number | null;
  expected_value?: number | null;
  target_value?: number | null;
  measurement_period?: "equivalent_monthly" | "rolling_7_days" | "point_in_time";
  measurement_window_days?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CURRENT_WINDOW_DAYS = 7;
const FRESH_SYNC_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const META_MIN_COVERED_DAYS = 5;
const FLOW_METRICS = new Set(["net_sales", "net_profit", "orders_count"]);
const DOWN_IS_BETTER = new Set(["cac", "out_of_stock_items"]);

function record(value: unknown): Row | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Row
    : null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readFreshConnection(
  coverage: CaminoConnectionCoverage,
  provider: "shopify" | "meta_ads",
  nowMs: number,
): boolean {
  if (coverage.availability !== "available") return false;
  const relevant = (coverage.connections ?? []).filter((connection) => connection.provider === provider);
  if (!relevant.length) return false;
  return relevant.every((connection) => {
    if (connection.status !== "connected" && connection.status !== "syncing") return false;
    const lastSync = connection.last_sync_at ? Date.parse(connection.last_sync_at) : NaN;
    if (!Number.isFinite(lastSync) || lastSync > nowMs || nowMs - lastSync > FRESH_SYNC_MAX_AGE_MS) return false;
    const lastError = connection.last_error_at ? Date.parse(connection.last_error_at) : NaN;
    return !Number.isFinite(lastError) || lastError <= lastSync;
  });
}

function monthEquivalent(value: number, windowDays: number): number {
  return value * (30.44 / windowDays);
}

function rounded(value: number, metric: string): number {
  const precision = metric === "roas" ? 4 : metric === "orders_count" || metric === "out_of_stock_items" ? 0 : 2;
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function insufficient(
  metricLabel: string,
  unit: "money" | "pct" | "count" | "ratio",
  measurementPeriod: "equivalent_monthly" | "rolling_7_days" | "point_in_time",
  reason: string,
  measurementWindowDays = CURRENT_WINDOW_DAYS,
): CaminoDeterministicGoalProgress {
  return {
    status: "insufficient_data",
    observed_value: null,
    comparison_value: null,
    metric_label: metricLabel,
    unit,
    baseline_value: null,
    expected_value: null,
    target_value: null,
    measurement_period: measurementPeriod,
    measurement_window_days: measurementWindowDays,
    explanation: `No se puede calcular de forma fiable ${metricLabel}: ${reason} La falta de dato o un error de lectura no se interpreta como cero.`,
  };
}

/**
 * Computes Camino goal status exclusively from server-read, store-scoped
 * metrics. The target pace is a transparent linear reference, not a forecast.
 */
export function calculateCaminoGoalProgress(input: {
  goal: unknown;
  planStartedAt: string | null;
  planCreatedAt?: string | null;
  now?: Date;
  coverage: CaminoConnectionCoverage;
  sales: { current: CaminoMetricRead; previous: CaminoMetricRead };
  financial: { current: CaminoMetricRead; previous: CaminoMetricRead };
  stock: CaminoMetricRead;
  meta: { current: CaminoMetricRead; previous: CaminoMetricRead };
}): CaminoDeterministicGoalProgress {
  const goal = record(input.goal);
  const metric = typeof goal?.metric_key === "string" ? goal.metric_key : "";
  const metricLabel = typeof goal?.metric_label === "string" ? goal.metric_label : metric || "el objetivo";
  const unit = goal?.unit === "money" || goal?.unit === "pct" || goal?.unit === "count" || goal?.unit === "ratio"
    ? goal.unit
    : "count";
  const measurementPeriod = FLOW_METRICS.has(metric)
    ? "equivalent_monthly"
    : metric === "out_of_stock_items" ? "point_in_time" : "rolling_7_days";
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const target = finite(goal?.target);
  const baseline = finite(goal?.baseline);
  const baselineWindowDays = finite(goal?.baseline_window_days);
  const measurementWindowDays = measurementPeriod === "point_in_time" ? 0 : CURRENT_WINDOW_DAYS;

  if (!goal || !metric) return insufficient(metricLabel, unit, measurementPeriod, "el plan no tiene una métrica estructurada.", measurementWindowDays);
  if (target === null) return insufficient(metricLabel, unit, measurementPeriod, "el objetivo cuantificado está pendiente de definir.", measurementWindowDays);

  const source = metric === "roas" || metric === "cac" ? "meta_ads" : "shopify";
  if (!readFreshConnection(input.coverage, source, nowMs)) {
    return insufficient(metricLabel, unit, measurementPeriod, `la conexión ${source === "shopify" ? "Shopify" : "Meta Ads"} no tiene una sincronización reciente y correcta para este alcance.`, measurementWindowDays);
  }

  let current: number | null = null;
  let previous: number | null = null;
  let comparisonUnavailableReason: string | null = null;
  let sourceRead: CaminoMetricRead;
  let previousRead: CaminoMetricRead | null = null;

  if (metric === "net_sales" || metric === "orders_count" || metric === "aov") {
    sourceRead = input.sales.current;
    previousRead = input.sales.previous;
    const salesRow = sourceRead.row;
    const orders = finite(salesRow?.orders_count);
    if (sourceRead.error) return insufficient(metricLabel, unit, measurementPeriod, "la lectura de ventas devolvió un error.", measurementWindowDays);
    if (!salesRow) return insufficient(metricLabel, unit, measurementPeriod, "no hay filas de ventas para el periodo.", measurementWindowDays);
    if (orders === null || orders <= 0) return insufficient(metricLabel, unit, measurementPeriod, "no hay pedidos recientes suficientes para distinguir un cero real de una ventana sin cobertura.", measurementWindowDays);
    current = finite(salesRow[metric]);
    previous = finite(previousRead.row?.[metric]);
    if (previousRead.error || !previousRead.row) comparisonUnavailableReason = "el periodo anterior comparable no está disponible";
  } else if (metric === "net_profit" || metric === "net_margin_pct") {
    sourceRead = input.financial.current;
    previousRead = input.financial.previous;
    const financialRow = sourceRead.row;
    if (sourceRead.error) return insufficient(metricLabel, unit, measurementPeriod, "la lectura financiera devolvió un error.", measurementWindowDays);
    if (!financialRow) return insufficient(metricLabel, unit, measurementPeriod, "no hay resumen financiero para el periodo.", measurementWindowDays);
    if (financialRow.has_settings !== true) return insufficient(metricLabel, unit, measurementPeriod, "faltan ajustes financieros configurados.", measurementWindowDays);
    if (finite(financialRow.items_without_cost) !== 0) return insufficient(metricLabel, unit, measurementPeriod, "hay productos vendidos sin coste de producto conocido.", measurementWindowDays);
    if ((finite(financialRow.orders_count) ?? 0) <= 0 || (finite(financialRow.net_sales) ?? 0) <= 0) return insufficient(metricLabel, unit, measurementPeriod, "no hay ventas comparables para calcular beneficio/margen.", measurementWindowDays);
    current = finite(financialRow[metric]);
    const prior = previousRead.row;
    previous = prior && prior.has_settings === true && finite(prior.items_without_cost) === 0 && (finite(prior.orders_count) ?? 0) > 0
      ? finite(prior[metric])
      : null;
    if (previous === null) comparisonUnavailableReason = "el resumen financiero comparable anterior no está completo";
  } else if (metric === "roas" || metric === "cac") {
    sourceRead = input.meta.current;
    previousRead = input.meta.previous;
    const metaRow = sourceRead.row;
    if (sourceRead.error) return insufficient(metricLabel, unit, measurementPeriod, "la lectura de Meta devolvió un error.", measurementWindowDays);
    if (!metaRow) return insufficient(metricLabel, unit, measurementPeriod, "no hay filas de inversión de Meta para el periodo.", measurementWindowDays);
    if ((finite(metaRow.days_with_data) ?? 0) < META_MIN_COVERED_DAYS) return insufficient(metricLabel, unit, measurementPeriod, `Meta solo cubre ${finite(metaRow.days_with_data) ?? 0} de los 7 días; se exigen ${META_MIN_COVERED_DAYS} para comparar.`, measurementWindowDays);
    if (metric === "cac" && (finite(metaRow.purchases) ?? 0) <= 0) return insufficient(metricLabel, unit, measurementPeriod, "no hay compras atribuidas con las que calcular el CAC de Meta.", measurementWindowDays);
    current = finite(metaRow[metric]);
    const prior = previousRead.row;
    previous = prior && (finite(prior.days_with_data) ?? 0) >= META_MIN_COVERED_DAYS
      ? finite(prior[metric])
      : null;
    if (previous === null) comparisonUnavailableReason = "el periodo anterior de Meta no alcanza la cobertura mínima";
  } else if (metric === "out_of_stock_items") {
    sourceRead = input.stock;
    const stockRow = sourceRead.row;
    if (sourceRead.error) return insufficient(metricLabel, unit, measurementPeriod, "la lectura de inventario devolvió un error.", measurementWindowDays);
    if (!stockRow || (finite(stockRow.tracked_items) ?? 0) <= 0) return insufficient(metricLabel, unit, measurementPeriod, "no hay inventario monitorizado para evaluar.", measurementWindowDays);
    current = finite(stockRow.out_of_stock_items);
    previous = baseline;
  } else {
    return insufficient(metricLabel, unit, measurementPeriod, "el tipo de métrica aún no tiene una regla de cálculo determinista.", measurementWindowDays);
  }

  if (current === null) return insufficient(metricLabel, unit, measurementPeriod, "la fuente no devolvió un valor numérico válido.", measurementWindowDays);
  const monthly = measurementPeriod === "equivalent_monthly";
  if (monthly && (baselineWindowDays === null || baselineWindowDays <= 0)) {
    return insufficient(metricLabel, unit, measurementPeriod, "el plan antiguo no conserva la ventana temporal exacta de su baseline.", measurementWindowDays);
  }

  const baselineComparable = baseline === null
    ? null
    : monthly ? monthEquivalent(baseline, baselineWindowDays!) : baseline;
  const observedComparable = monthly ? monthEquivalent(current, CURRENT_WINDOW_DAYS) : current;
  const comparisonComparable = previous === null
    ? null
    : monthly ? monthEquivalent(previous, CURRENT_WINDOW_DAYS) : previous;
  const direction = DOWN_IS_BETTER.has(metric) ? "down" : "up";
  const meetsTarget = direction === "up" ? observedComparable >= target : observedComparable <= target;

  if (meetsTarget) {
    return {
      status: "achieved",
      observed_value: rounded(observedComparable, metric),
      comparison_value: comparisonComparable === null ? null : rounded(comparisonComparable, metric),
      metric_label: metricLabel,
      unit,
      baseline_value: baselineComparable === null ? null : rounded(baselineComparable, metric),
      expected_value: target,
      target_value: target,
      measurement_period: measurementPeriod,
      measurement_window_days: measurementWindowDays,
      explanation: `Medición determinista: ${metricLabel} alcanza el objetivo en ${measurementPeriod === "equivalent_monthly" ? "equivalente mensual" : measurementPeriod === "point_in_time" ? "la fotografía actual" : "la ventana móvil de 7 días"}. No atribuye causalidad a tareas ni garantiza que el resultado se mantenga.`,
    };
  }

  if (baselineComparable === null) {
    return insufficient(metricLabel, unit, measurementPeriod, "no hay baseline observado para calcular el ritmo hacia el objetivo.", measurementWindowDays);
  }
  const createdAt = input.planStartedAt ?? input.planCreatedAt ?? null;
  const targetAtText = typeof goal.target_date === "string" ? goal.target_date : null;
  const targetAtMs = targetAtText ? Date.parse(`${targetAtText}T23:59:59.999Z`) : NaN;
  const startMs = createdAt ? Date.parse(createdAt) : NaN;
  const targetOffsetDays = finite(goal.target_offset_days);
  const effectiveTargetMs = Number.isFinite(targetAtMs)
    ? targetAtMs
    : Number.isFinite(startMs) && targetOffsetDays !== null
      ? startMs + targetOffsetDays * DAY_MS
      : NaN;
  if (!Number.isFinite(startMs) || !Number.isFinite(effectiveTargetMs) || effectiveTargetMs <= startMs) {
    return insufficient(metricLabel, unit, measurementPeriod, "el plan no conserva fechas verificables para calcular el ritmo temporal.", measurementWindowDays);
  }

  const fraction = Math.max(0, Math.min(1, (nowMs - startMs) / (effectiveTargetMs - startMs)));
  const expected = baselineComparable + (target - baselineComparable) * fraction;
  const onTrack = direction === "up" ? observedComparable >= expected : observedComparable <= expected;
  const delta = direction === "up" ? observedComparable - expected : expected - observedComparable;
  const status: CaminoGoalProgressStatus = onTrack ? "on_track" : "at_risk";
  const comparisonText = comparisonComparable === null
    ? comparisonUnavailableReason ?? "sin periodo anterior comparable"
    : `periodo anterior comparable ${rounded(comparisonComparable, metric)}`;
  const baselineWindowLabel = monthly ? `${baselineWindowDays} días normalizados a mes` : "baseline observado al crear el Camino";
  return {
    status,
    observed_value: rounded(observedComparable, metric),
    comparison_value: comparisonComparable === null ? null : rounded(comparisonComparable, metric),
    metric_label: metricLabel,
    unit,
    baseline_value: rounded(baselineComparable, metric),
    expected_value: rounded(expected, metric),
    target_value: target,
    measurement_period: measurementPeriod,
    measurement_window_days: measurementWindowDays,
    explanation: `Medición determinista de ${metricLabel}: ${rounded(observedComparable, metric)} frente al ritmo de referencia ${rounded(expected, metric)} hacia ${target}. Baseline: ${rounded(baselineComparable, metric)} (${baselineWindowLabel}); ${comparisonText}. Desviación al ritmo: ${rounded(delta, metric)}. El ritmo es una interpolación lineal explicativa, no una previsión ni una atribución causal.`,
  };
}
