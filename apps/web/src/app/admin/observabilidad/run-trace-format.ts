/**
 * AI-30: presentacion de una traza de ejecucion.
 *
 * Aparte del componente y sin JSX porque es donde vive la unica regla con
 * consecuencias de esta pantalla: **`null` no es cero**.
 *
 * La fase 1 quito de la base de datos la mentira de que un modelo sin tarifa
 * costaba 0. Si la pantalla lo vuelve a pintar como "$0.00", la mentira vuelve
 * exactamente igual de lejos -- delante del consultor que decide. Estas
 * funciones existen para que esa regla tenga un test.
 */

export type Tone = "neutral" | "success" | "warn" | "danger";

/**
 * Coste de una ejecucion. `null` = no se pudo calcular; `cost_basis` dice por
 * que. Nunca devuelve una cifra para un coste desconocido.
 */
export function formatCostWithBasis(
  usd: number | null,
  basis: string | null,
): string {
  if (usd == null) {
    return basis === "unknown_model" ? "No calculable" : "Desconocido";
  }
  return `$${usd.toFixed(usd > 0 && usd < 1 ? 4 : 2)}`;
}

/**
 * Tokens que el proveedor puede o no haber reportado. `null` = no informo;
 * `0` = informo, y fue cero. Son dos hechos distintos y se leen distinto.
 */
export function formatReportedTokens(value: number | null): string {
  return value == null ? "No reportado" : value.toLocaleString("es-ES");
}

export function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
}

export const SEVERITY_TONE: Record<string, Tone> = {
  info: "neutral",
  low: "neutral",
  medium: "warn",
  high: "danger",
  critical: "danger",
};

export function severityTone(severity: string): Tone {
  return SEVERITY_TONE[severity] ?? "neutral";
}

export const SECURITY_EVENT_ES: Record<string, string> = {
  prompt_injection_detected: "Inyección neutralizada",
  tool_poisoning_suspected: "Resultado de herramienta con instrucciones",
  unauthorized_tool_attempt: "Herramienta fuera del catálogo",
  permission_denied: "Permiso denegado",
  sensitive_data_access_attempt: "Acceso a datos sensibles",
  policy_violation: "Política del runtime",
};

export const STEP_ES: Record<string, string> = {
  context_build: "Construcción de contexto",
  model_call: "Llamada al modelo",
  tool_call: "Herramienta",
};

/**
 * Anchura de cada barra de la cascada, en porcentaje del total medido.
 *
 * El minimo del 2% es deliberado: una fase de 1 ms sobre un turno de 30 s daria
 * una barra invisible, y una fase que no se ve es una fase que no se audita.
 */
export function waterfallWidths(
  steps: ReadonlyArray<{ duration_ms: number | null }>,
): number[] {
  const total = steps.reduce((sum, step) => sum + (step.duration_ms ?? 0), 0);
  if (total <= 0) return steps.map(() => 0);
  return steps.map((step) =>
    Math.max(2, ((step.duration_ms ?? 0) / total) * 100),
  );
}
