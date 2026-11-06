/**
 * Cuentas del panel del cliente (vista "Pulso"): cómo se convierte la
 * respuesta de /shopify/metrics en las piezas que se pintan.
 *
 * Todo lo que suma o reparte dinero vive aquí y no en el componente, para que
 * el test pueda comprobar lo único que no se puede permitir: que las barras de
 * "De las ventas al beneficio" no cuadren con el beneficio que se enseña.
 */

import { connectionNeedsReconnect } from "@e-nora/contracts";

export function fmtNum(value: number, decimals = 0) {
  const negative = value < 0;
  const [int, frac] = Math.abs(value).toFixed(decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "−" : ""}${grouped}${frac ? `,${frac}` : ""}`;
}

/** Evidencia de un agente: texto antiguo o el objeto estructurado actual. */
export type Evidence = string | { label: string; value: string; period?: string | null; source?: string | null };

export function evidenceText(item: Evidence | null | undefined): string {
  if (!item) return "";
  if (typeof item === "string") return item;
  return `${item.label}: ${item.value}${item.period ? ` (${item.period})` : ""}`;
}

export function fmtEur(value: number, decimals = 0) {
  return `${fmtNum(value, decimals)} €`;
}

export function niceStep(raw: number) {
  const power = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const m = raw / power;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * power;
}

/** El cero y la comparación permanecen dentro del gráfico, también con devoluciones. */
export function chartScale(values: readonly number[], comparison: number | null, minStep = 0) {
  const low = Math.min(0, ...values, comparison ?? 0);
  const high = Math.max(0, ...values, comparison ?? 0);
  const step = Math.max(niceStep((high - low || 1) / 3), minStep);
  const bottom = Math.floor(low / step) * step;
  const top = Math.max(Math.ceil(high / step) * step, bottom + step);
  const ticks = Array.from({ length: Math.round((top - bottom) / step) + 1 }, (_, i) => Number((bottom + i * step).toPrecision(12)));
  return { bottom, top, ticks };
}

export function fmtCurrency(value: number | null | undefined, currencyCode: string | null | undefined, decimals = 0) {
  if (value == null || !currencyCode) return "—";
  try {
    // `useGrouping: "always"`: en es-ES Intl no agrupa los números de cuatro
    // cifras ("7463 €") y en la misma columna salía "19.561 €". El signo es el
    // menos tipográfico, igual que en `fmtNum`.
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: "always",
    })
      .format(value)
      .replace(/^-/, "−");
  } catch {
    return `${fmtNum(value, decimals)} ${currencyCode}`;
  }
}

export type PulseFinancial = {
  net_sales: number;
  net_revenue_ex_tax: number;
  cogs: number;
  shipping_costs: number;
  payment_fees: number;
  ads_spend: number;
  fixed_costs: number;
  net_profit: number;
  orders_count: number;
  aov_ex_tax: number;
  cogs_per_order: number;
  shipping_per_order: number;
  payment_fee_per_order: number;
  cac_per_order: number;
  fixed_per_order: number;
};

export type FlowRow = {
  label: string;
  value: number;
  kind: "total" | "cost" | "profit";
  hint?: string;
};

/** Menos de un euro de diferencia es redondeo, no una partida que explicar. */
const RESIDUAL_EUR = 1;

/**
 * De las ventas netas al beneficio, en escalones que cuadran.
 *
 * Si el motor financiero trata algo distinto de lo que aquí se resta (envíos
 * cobrados, reembolsos...), el hueco sale como "Otros ajustes" en vez de
 * esconderse: una cascada que no llega a su propio total es peor que una fila
 * de más.
 */
export function moneyFlow(f: PulseFinancial, adsHint?: string): FlowRow[] {
  const rows: FlowRow[] = [];
  const taxGap = f.net_revenue_ex_tax - f.net_sales;
  // Sin diferencia entre ventas e ingreso sin IVA, dos filas iguales no dicen
  // nada: se enseña una sola, que además es la base de los porcentajes.
  if (Math.abs(taxGap) >= RESIDUAL_EUR) {
    rows.push(
      { label: "Ventas netas", value: f.net_sales, kind: "total", hint: "Con IVA y envío cobrado" },
      { label: "IVA", value: taxGap, kind: "cost" },
    );
  }
  rows.push({ label: "Ingreso sin IVA", value: f.net_revenue_ex_tax, kind: "total", hint: "Base de los porcentajes" });

  const costs: FlowRow[] = [
    { label: "Producto", value: -f.cogs, kind: "cost", hint: "Coste de lo vendido" },
    { label: "Envíos", value: -f.shipping_costs, kind: "cost" },
    { label: "Comisiones", value: -f.payment_fees, kind: "cost", hint: "Pasarela de pago" },
    { label: "Publicidad", value: -f.ads_spend, kind: "cost", hint: adsHint },
    { label: "Gastos fijos", value: -f.fixed_costs, kind: "cost", hint: "Parte de este periodo" },
  ];
  rows.push(...costs.filter((row) => Math.abs(row.value) >= RESIDUAL_EUR));

  const afterCosts = costs.reduce((acc, row) => acc + row.value, f.net_revenue_ex_tax);
  const residual = f.net_profit - afterCosts;
  if (Math.abs(residual) >= RESIDUAL_EUR) {
    rows.push({ label: "Otros ajustes", value: residual, kind: "cost" });
  }
  rows.push({ label: "Beneficio neto", value: f.net_profit, kind: "profit" });
  return rows;
}

export type UnitSlice = { key: string; label: string; value: number };

/** Qué se lleva cada partida de un pedido medio sin IVA, y qué queda. */
export function unitEconomics(f: PulseFinancial): UnitSlice[] {
  const profit = f.orders_count > 0 ? f.net_profit / f.orders_count : 0;
  const slices: UnitSlice[] = [
    { key: "prod", label: "Producto", value: f.cogs_per_order },
    { key: "ship", label: "Envío", value: f.shipping_per_order },
    { key: "fee", label: "Comisión", value: f.payment_fee_per_order },
    { key: "ads", label: "Publicidad", value: f.cac_per_order },
    { key: "fix", label: "Gastos fijos", value: f.fixed_per_order },
  ];
  const other = f.aov_ex_tax - slices.reduce((acc, s) => acc + s.value, 0) - profit;
  if (Math.abs(other) >= 0.01) slices.push({ key: "other", label: "Otros", value: other });
  slices.push({ key: "profit", label: "Te queda", value: profit });
  return slices;
}

export type GoalObjective = {
  id: string;
  metric_key: string;
  label: string;
  unit: "money" | "pct" | "ratio" | string;
  direction: "up" | "down";
  target_value: number;
  actual_value: number | null;
  progress_pct: number | null;
  period: string;
  measurement?: { period_label?: string | null };
};

const REVENUE_GOALS = ["net_revenue_ex_tax", "net_sales"];

/**
 * El anillo necesita una meta que se suba y con cifra real: la de ventas si la
 * hay, y si no la primera sin cumplir. Las demás, sin repetir métrica, van
 * debajo: primero las que tienen cifra.
 */
export function pickGoals<T extends GoalObjective>(objectives: T[]): { main: T | null; others: T[] } {
  const measured = (objective: T) => objective.actual_value !== null && objective.progress_pct !== null;
  const seen = new Set<string>();
  const unique = objectives
    .slice()
    .sort((a, b) => Number(measured(b)) - Number(measured(a)))
    .filter((objective) => {
      if (seen.has(objective.metric_key)) return false;
      seen.add(objective.metric_key);
      return true;
    });
  const rising = unique.filter((objective) => measured(objective) && objective.direction === "up");
  const main = rising.find((objective) => REVENUE_GOALS.includes(objective.metric_key))
    ?? rising.find((objective) => (objective.progress_pct ?? 0) < 100)
    ?? rising[0]
    ?? null;
  return { main, others: unique.filter((objective) => objective !== main).slice(0, 3) };
}

export type MonthPoint = { month: string; value: number; kind: "real" | "current" | "projection" };

/**
 * Meses reales + proyección hasta diciembre al ritmo reciente.
 *
 * El mes en curso está a medias, así que la proyección arranca desde el último
 * mes cerrado.
 */
// ponytail: crecimiento medio geométrico de los últimos 6 meses cerrados; sin
// estacionalidad. Si hace falta, pasar a mismo-mes-año-anterior (previous_year).
export function monthlyWithProjection(
  monthly: Array<{ month: string; value: number }>,
  today: Date,
): MonthPoint[] {
  const currentKey = today.toISOString().slice(0, 7);
  const points: MonthPoint[] = monthly
    .filter((m) => m.month.slice(0, 4) === currentKey.slice(0, 4))
    .map((m) => ({
      month: m.month.slice(0, 7),
      value: m.value,
      kind: m.month.slice(0, 7) === currentKey ? "current" : "real",
    }));
  const closed = points.filter((p) => p.kind === "real" && p.value > 0).slice(-7);
  if (closed.length < 3) return points;

  const growth = Math.pow(closed[closed.length - 1].value / closed[0].value, 1 / (closed.length - 1));
  let value = closed[closed.length - 1].value;
  const year = today.getUTCFullYear();
  for (let month = today.getUTCMonth() + 1; month < 12; month += 1) {
    value *= growth;
    points.push({ month: `${year}-${String(month + 1).padStart(2, "0")}`, value, kind: "projection" });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Lo que la IA dice en el panel del cliente
// ---------------------------------------------------------------------------

export type PulseFinding = { title: string; severity: string; evidence: Evidence; area?: string };

/**
 * El hallazgo que acompaña a una sección.
 *
 * Primero uno cuyo propio texto hable del tema; solo si no hay, el primero de
 * una sección del diagnóstico con ese nombre. Con `taken`, un hallazgo ya
 * usado por otra sección no se repite: antes Canales y Meta enseñaban la misma
 * frase sobre ventas de la tienda porque las dos encajaban con "adquisición".
 */
export function pickFinding<F extends PulseFinding>(
  diagnostic: { output: { sections?: Array<{ key: string; label: string; findings: F[] }>; findings: F[] } } | null | undefined,
  pattern: RegExp,
  taken?: Set<F>,
): F | null {
  if (!diagnostic) return null;
  const free = (finding: F) => !taken?.has(finding);
  const inSections = (diagnostic.output.sections ?? []).flatMap((section) =>
    (section.findings ?? []).map((finding) => ({ finding, where: `${section.key} ${section.label}` })),
  );
  const all = [...inSections, ...(diagnostic.output.findings ?? []).map((finding) => ({ finding, where: "" }))];
  const hit =
    all.find(({ finding }) => free(finding) && pattern.test(`${finding.area ?? ""} ${finding.title}`)) ??
    all.find(({ finding, where }) => free(finding) && where !== "" && pattern.test(where));
  if (hit) taken?.add(hit.finding);
  return hit?.finding ?? null;
}


// Señales de texto escrito para una máquina: nombres de campo en snake_case,
// asignaciones, marcas de tiempo UTC y etiquetas de calidad en inglés.
const TECHNICAL = /\b[a-z]+(?:_[a-z0-9]+)+\b|\b\w+=\w+|\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?(?:\s?UTC)?|\b(?:null|true|false|strong|weak|tracked_current)\b|[a-z]+[A-Z][a-zA-Z]+\b/;

export function isClientReadable(text: string) {
  return !TECHNICAL.test(text);
}

/**
 * Texto de la IA apto para el cliente: se quitan las frases con jerga de
 * sistema y se conserva el resto. Si no queda nada legible, null (mejor no
 * enseñar nada que enseñar `inventory_sync_is_stale=true`).
 */
export function clientReadable(text: string | null | undefined): string | null {
  if (!text) return null;
  const sentences = text.split(/(?<=[.;])\s+/).filter((sentence) => isClientReadable(sentence));
  const kept = sentences.join(" ").trim();
  return kept.length >= 12 ? kept : null;
}

/** "▲ 319 %" no se lee; por encima del doble se dice "×4,2". */
export function changeText(changePct: number) {
  const magnitude = Math.abs(changePct);
  if (changePct >= 100) return `×${fmtNum(1 + changePct / 100, 1)}`;
  return `${magnitude < 10 ? fmtNum(magnitude, 1) : fmtNum(magnitude)} %`;
}

/** Cifras de eje en español: "23 mil €" y no "23,1k". */
export function shortMoney(value: number, currencySymbol = "€") {
  if (Math.abs(value) >= 1_000_000) return `${fmtNum(value / 1_000_000, 1).replace(",0", "")} M ${currencySymbol}`;
  if (Math.abs(value) >= 1_000) return `${fmtNum(value / 1_000)} mil ${currencySymbol}`;
  return `${fmtNum(value)} ${currencySymbol}`;
}

/**
 * Por debajo de este número de clientes nuevos el CAC no es una media, es una
 * anécdota: con un solo cliente nuevo el CAC es toda la inversión publicitaria.
 */
export const MIN_NEW_CUSTOMERS_FOR_CAC = 10;

const CHANNEL_STALE_MS = 86_400_000;

export type ChannelConnection = { status: string; last_sync_at: string | null; last_error_message?: string | null };
/** Conexión y sincronización de un canal: dice si sus cifras se pueden creer, no cuáles son. */
export type ChannelSync = "ok" | "stale" | "failed" | "reconnect" | "off" | "unknown";

export const CHANNEL_SYNC_LABEL: Record<ChannelSync, string> = {
  ok: "Al día",
  stale: "Con retraso",
  failed: "Fallo al sincronizar",
  reconnect: "Reconectar",
  off: "Sin conectar",
  unknown: "Sin comprobar",
};

export function channelSync(connection: ChannelConnection | null | undefined, now: number): ChannelSync {
  if (!connection) return "off";
  if (connectionNeedsReconnect(connection)) return "reconnect";
  if (connection.status === "error") return "failed";
  const synced = connection.last_sync_at ? Date.parse(connection.last_sync_at) : Number.NaN;
  const fresh = ["connected", "syncing"].includes(connection.status) && now - synced <= CHANNEL_STALE_MS;
  return fresh ? "ok" : "stale";
}

/**
 * Qué cifra enseña la tarjeta de un canal. Un cero solo se enseña si el canal
 * está sano y tiene actividad: sin datos, un «0 €» parecería un mal resultado.
 */
export function channelReading({ name, sync, hasData, metric, detail, emptyDetail, connectDetail }: {
  name: string;
  sync: ChannelSync;
  hasData: boolean;
  metric: string;
  detail: string;
  emptyDetail: string;
  connectDetail: string;
}) {
  if (sync === "off") return { value: "Sin conectar", detail: connectDetail };
  // La conexión no se ha podido leer: de ahí no se deduce que no exista.
  if (sync === "unknown") return hasData ? { value: metric, detail } : { value: "Sin datos", detail: `No se ha podido comprobar ${name}` };
  if (sync === "reconnect") {
    return hasData
      ? { value: metric, detail: `${detail} · puede estar incompleto: reconecta ${name}` }
      : { value: "Sin datos", detail: `Reconecta ${name} para recuperar sus datos` };
  }
  if (!hasData) {
    const reason = { stale: `${name} no ha sincronizado datos recientes`, failed: `La última sincronización de ${name} falló` };
    return { value: "Sin datos", detail: sync === "ok" ? emptyDetail : reason[sync] };
  }
  return { value: metric, detail };
}
