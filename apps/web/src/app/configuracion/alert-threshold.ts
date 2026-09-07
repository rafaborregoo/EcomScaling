/**
 * Umbral de cada aviso: cómo se enseña y cómo se guarda.
 *
 * No todas las reglas miden lo mismo, y una en concreto guarda el umbral en
 * NEGATIVO: `shopify_revenue_drop` compara `cambio% < umbral`, con -30 por
 * defecto. Si se guardara 30, la condición sería "cambio menor que +30%", que
 * es casi siempre cierta -- el aviso saltaría todos los días con las ventas
 * subiendo, y nadie lo leería como un fallo de configuración.
 *
 * Por eso el consultor escribe "30" (una caída del 30%) y aquí se traduce.
 */

export type AlertRuleCode = string;

export const THRESHOLD_LABEL: Record<AlertRuleCode, string> = {
  shopify_revenue_drop: "Avisar si las ventas caen más de (%)",
  shopify_stock_out: "Avisar a partir de (productos sin stock)",
  integration_sync_failed: "Avisar a partir de (conexiones con error)",
};

/** Etiqueta genérica para una plantilla que aún no tenga texto propio. */
export function thresholdLabel(code: AlertRuleCode): string {
  return THRESHOLD_LABEL[code] ?? "Umbral";
}

/**
 * Lo que se enseña en el campo a partir de lo guardado. Para la caída de
 * ventas se muestra en positivo: "cae un 30%", no "-30".
 */
export function toDisplayThreshold(
  code: AlertRuleCode,
  stored: number | null,
): string {
  if (stored === null || !Number.isFinite(stored)) return "";
  return code === "shopify_revenue_drop"
    ? String(Math.abs(stored))
    : String(stored);
}

/**
 * Lo que se guarda a partir de lo tecleado. `null` = sin personalizar, se
 * queda el valor de la plantilla.
 *
 * Para la caída de ventas se normaliza con `-Math.abs`: da igual que escriban
 * 30 o -30, las dos cosas significan lo mismo y solo una de ellas funciona.
 */
export function toStoredThreshold(
  code: AlertRuleCode,
  input: string,
): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return code === "shopify_revenue_drop" ? -Math.abs(parsed) : parsed;
}

export const SEVERITY_OPTIONS = [
  { value: "info", label: "Informativa" },
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

export const SEVERITY_TONE: Record<string, "neutral" | "warn" | "danger"> = {
  info: "neutral",
  low: "neutral",
  medium: "warn",
  high: "warn",
  critical: "danger",
};
