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
  measurement_period?: "equivalent_monthly" | "calendar_month_to_date" | "rolling_7_days" | "point_in_time";
  measurement_window_days?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CURRENT_WINDOW_DAYS = 7;
const FRESH_SYNC_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const META_MIN_COVERED_DAYS = 5;
const FLOW_METRICS = new Set(["net_sales", "net_profit", "orders_count"]);
const CALENDAR_MONTH_METRICS = new Set(["net_sales", "net_profit", "net_margin_pct", "orders_count", "aov"]);
const DOWN_IS_BETTER = new Set(["cac", "out_of_stock_items"]);

export function calculateCaminoGoalProgress(input: Parameters<typeof calculateCaminoGoalProgressInternal>[0]) {
  const result = calculateCaminoGoalProgressInternal(input);
  const now = input.now ?? new Date();
  const point = result.measurement_period === "point_in_time";
  const start = result.measurement_period === "calendar_month_to_date" && input.calendarMonth
    ? input.calendarMonth.periodStart
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
  const provider = ["roas", "cac"].includes(String(record(input.goal)?.metric_key)) ? "meta_ads" : "shopify";
  const syncs = (input.coverage.connections ?? []).filter((c) => c.provider === provider).map((c) => c.last_sync_at).filter((s): s is string => Boolean(s)).sort();
  return { ...result, source: provider === "meta_ads" ? "Meta Ads" : "Shopify", period_start: (point ? now : start).toISOString(),
    period_end: now.toISOString(), measured_at: now.toISOString(), last_sync_at: syncs[0] ?? null,
    period_label: point ? "Inventario actual" : result.measurement_period === "calendar_month_to_date" ? "Mes natural hasta la fecha" : result.measurement_period === "equivalent_monthly" ? "Equivalente mensual desde siete días" : "Últimos siete días" };
}

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
  measurementPeriod: "equivalent_monthly" | "calendar_month_to_date" | "rolling_7_days" | "point_in_time",
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
function calculateCaminoGoalProgressInternal(input: {
  goal: unknown;
  planStartedAt: string | null;
  planCreatedAt?: string | null;
  now?: Date;
  coverage: CaminoConnectionCoverage;
  sales: { current: CaminoMetricRead; previous: CaminoMetricRead };
  financial: { current: CaminoMetricRead; previous: CaminoMetricRead };
  calendarMonth?: {
    currentSales: CaminoMetricRead;
    previousSales: CaminoMetricRead;
    currentFinancial: CaminoMetricRead;
    previousFinancial: CaminoMetricRead;
    periodStart: Date;
    previousPeriodStart: Date;
  };
  stock: CaminoMetricRead;
  meta: { current: CaminoMetricRead; previous: CaminoMetricRead };
}): CaminoDeterministicGoalProgress {
  const goal = record(input.goal);
  const metric = typeof goal?.metric_key === "string" ? goal.metric_key : "";
  const metricLabel = typeof goal?.metric_label === "string" ? goal.metric_label : metric || "el objetivo";
  const unit = goal?.unit === "money" || goal?.unit === "pct" || goal?.unit === "count" || goal?.unit === "ratio"
    ? goal.unit
    : "count";
  const measurementPeriod = CALENDAR_MONTH_METRICS.has(metric) && input.calendarMonth
    ? "calendar_month_to_date"
    : FLOW_METRICS.has(metric)
    ? "equivalent_monthly"
    : metric === "out_of_stock_items" ? "point_in_time" : "rolling_7_days";
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const target = finite(goal?.target);
  const baseline = finite(goal?.baseline);
  const baselineWindowDays = finite(goal?.baseline_window_days);
  const measurementWindowDays = measurementPeriod === "point_in_time"
    ? 0
    : measurementPeriod === "calendar_month_to_date"
      ? Math.max(1, Math.floor((nowMs - input.calendarMonth!.periodStart.getTime()) / DAY_MS) + 1)
      : CURRENT_WINDOW_DAYS;

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
    sourceRead = measurementPeriod === "calendar_month_to_date" ? input.calendarMonth!.currentSales : input.sales.current;
    previousRead = measurementPeriod === "calendar_month_to_date" ? input.calendarMonth!.previousSales : input.sales.previous;
    const salesRow = sourceRead.row;
    const orders = finite(salesRow?.orders_count);
    if (sourceRead.error) return insufficient(metricLabel, unit, measurementPeriod, "la lectura de ventas devolvió un error.", measurementWindowDays);
    if (!salesRow) return insufficient(metricLabel, unit, measurementPeriod, "no hay filas de ventas para el periodo.", measurementWindowDays);
    if (orders === null || orders <= 0) return insufficient(metricLabel, unit, measurementPeriod, "no hay pedidos recientes suficientes para distinguir un cero real de una ventana sin cobertura.", measurementWindowDays);
    current = finite(salesRow[metric]);
    previous = finite(previousRead.row?.[metric]);
    if (previousRead.error || !previousRead.row) comparisonUnavailableReason = "el periodo anterior comparable no está disponible";
  } else if (metric === "net_profit" || metric === "net_margin_pct") {
    sourceRead = measurementPeriod === "calendar_month_to_date" ? input.calendarMonth!.currentFinancial : input.financial.current;
    previousRead = measurementPeriod === "calendar_month_to_date" ? input.calendarMonth!.previousFinancial : input.financial.previous;
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
  const monthly = FLOW_METRICS.has(metric);
  if (monthly && (baselineWindowDays === null || baselineWindowDays <= 0)) {
    return insufficient(metricLabel, unit, measurementPeriod, "el plan antiguo no conserva la ventana temporal exacta de su baseline.", measurementWindowDays);
  }

  const baselineComparable = baseline === null
    ? null
    : monthly ? monthEquivalent(baseline, baselineWindowDays!) : baseline;
  const observedComparable = measurementPeriod === "equivalent_monthly"
    ? monthEquivalent(current, CURRENT_WINDOW_DAYS)
    : current;
  const comparisonComparable = previous === null
    ? null
    : measurementPeriod === "equivalent_monthly"
      ? monthEquivalent(previous, CURRENT_WINDOW_DAYS)
      : previous;
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
      explanation: `Medición determinista: ${metricLabel} alcanza el objetivo en ${measurementPeriod === "equivalent_monthly" ? "equivalente mensual calculado desde una ventana móvil de 7 días" : measurementPeriod === "calendar_month_to_date" ? "el mes natural en curso hasta la fecha" : measurementPeriod === "point_in_time" ? "la fotografía actual" : "la ventana móvil de 7 días"}. No atribuye causalidad a tareas ni garantiza que el resultado se mantenga.`,
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

  const elapsedDays = Math.max(0, (nowMs - startMs) / DAY_MS);
  const monthlyTargets = Array.isArray(goal.monthly_targets) ? goal.monthly_targets : [];
  // Con mes real guardado manda ese mes, no la fecha de inicio: replanificar puede empezar a mitad.
  const firstPeriodValue = record(monthlyTargets[0])?.period;
  const firstPeriod = typeof firstPeriodValue === "string" ? firstPeriodValue : null;
  const startDate = firstPeriod ? new Date(`${firstPeriod}-01T00:00:00.000Z`) : new Date(startMs);
  const monthOffset = (now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + now.getUTCMonth() - startDate.getUTCMonth();
  const checkpointMonth = Math.min(monthlyTargets.length, Math.max(1,
    measurementPeriod === "calendar_month_to_date" ? monthOffset + 1 : Math.floor(elapsedDays / 30) + 1,
  ));
  const checkpoint = monthlyTargets.find((item) => {
    const row = record(item);
    return finite(row?.month) === checkpointMonth;
  });
  const checkpointTarget = finite(record(checkpoint)?.target_value);
  const fraction = Math.max(0, Math.min(1, (nowMs - startMs) / (effectiveTargetMs - startMs)));
  const calendarMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const horizonEndText = typeof goal.horizon_end_date === "string" ? goal.horizon_end_date : null;
  const horizonEnd = horizonEndText ? new Date(`${horizonEndText}T00:00:00.000Z`) : null;
  const currentMonthEnd = horizonEnd && Number.isFinite(horizonEnd.getTime()) && horizonEnd < calendarMonthEnd
    ? horizonEnd
    : calendarMonthEnd;
  const currentPeriodStart = input.calendarMonth?.periodStart ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const daysInCurrentMonth = Math.max(1, Math.floor((currentMonthEnd.getTime() - currentPeriodStart.getTime()) / DAY_MS) + 1);
  const elapsedDaysInCurrentPeriod = Math.min(daysInCurrentMonth, Math.max(1, Math.floor((nowMs - currentPeriodStart.getTime()) / DAY_MS) + 1));
  const expected = monthlyTargets.length
    ? measurementPeriod === "calendar_month_to_date"
      ? checkpointTarget === null ? null : checkpointTarget * (elapsedDaysInCurrentPeriod / daysInCurrentMonth)
      : checkpointTarget
    : baselineComparable + (target - baselineComparable) * fraction;
  if (expected === null) {
    return insufficient(
      metricLabel,
      unit,
      measurementPeriod,
      `el objetivo del mes ${checkpointMonth} está pendiente de cuantificar con datos comparables.`,
      measurementWindowDays,
    );
  }
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
    explanation: monthlyTargets.length
      ? `Medición determinista de ${metricLabel}: ${rounded(observedComparable, metric)} en ${measurementPeriod === "calendar_month_to_date" ? "el mes natural hasta la fecha" : "la ventana de seguimiento"}, frente al ritmo esperado de ${rounded(expected, metric)} para el hito del mes ${checkpointMonth}; objetivo de cierre de ese mes ${checkpointTarget === null ? "pendiente" : rounded(checkpointTarget, metric)} y meta final ${target}. Baseline: ${rounded(baselineComparable, metric)} (${baselineWindowLabel}); ${comparisonText}. Desviación frente al ritmo del hito: ${rounded(delta, metric)}. Es una comprobación del plan, no una previsión ni una atribución causal.`
      : `Medición determinista de ${metricLabel}: ${rounded(observedComparable, metric)} frente al ritmo de referencia ${rounded(expected, metric)} hacia ${target}. Baseline: ${rounded(baselineComparable, metric)} (${baselineWindowLabel}); ${comparisonText}. Desviación al ritmo: ${rounded(delta, metric)}. El ritmo es una interpolación lineal explicativa, no una previsión ni una atribución causal.`,
  };
}
