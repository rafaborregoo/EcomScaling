/**
 * Resume que datos recibio A19 al disenar una propuesta, fuente por fuente.
 * Se calcula al leer, a partir del snapshot que ya guarda el runtime
 * (agent_context_snapshots), asi que no hay esquema nuevo ni se puede
 * desincronizar de lo que el agente realmente vio.
 */

export type CaminoContextStatus = "ok" | "empty" | "unavailable" | "not_provided";

export type CaminoContextSource = {
  key: string;
  label: string;
  status: CaminoContextStatus;
  /** Sin esta fuente el camino se apoya en suposiciones: la ficha lo avisa. */
  critical: boolean;
};

type Block = { label?: unknown; data?: unknown };

// El orden es el de la ficha. `match` se compara contra el inicio de la etiqueta del bloque.
const SOURCES: Array<{ key: string; label: string; match: string; critical: boolean }> = [
  { key: "calendar", label: "Calendario comercial", match: "Calendario comercial", critical: false },
  { key: "methodology", label: "Metodología E-NORA", match: "Metodología E-NORA", critical: true },
  { key: "scaling", label: "Economía para escalar (ROAS, MER)", match: "Economía para ESCALAR", critical: false },
  { key: "seasonality", label: "Ritmo y estacionalidad", match: "Línea base y estacionalidad", critical: false },
  { key: "key_events", label: "Fechas clave", match: "FECHAS CLAVE OBLIGATORIAS", critical: false },
  { key: "marketing", label: "Campañas y mailing (A05/A27)", match: "Campañas YA planificadas", critical: false },
  { key: "shipping", label: "Fechas límite de envío", match: "Fechas límite de pedido", critical: false },
  { key: "sales", label: "Ventas", match: "Ventas Shopify (", critical: true },
  { key: "sales_prev", label: "Periodo anterior", match: "Ventas Shopify del periodo anterior", critical: false },
  { key: "monthly", label: "Histórico mensual", match: "Histórico mensual", critical: false },
  { key: "financial", label: "Resumen financiero", match: "Resumen financiero", critical: true },
  { key: "stock", label: "Stock", match: "Situacion de stock", critical: false },
  { key: "products", label: "Productos", match: "Productos que mas facturan", critical: false },
  { key: "margin", label: "Margen", match: "Margen bruto", critical: false },
  { key: "returns", label: "Devoluciones", match: "Devoluciones por producto", critical: false },
  { key: "meta", label: "Meta Ads", match: "Meta Ads:", critical: false },
  { key: "klaviyo", label: "Klaviyo", match: "Klaviyo:", critical: false },
  { key: "intake", label: "Cuestionario del equipo", match: "Contexto permanente de Mi Camino", critical: false },
  { key: "learnings", label: "Aprendizajes aprobados", match: "Aprendizajes aprobados", critical: false },
  { key: "seasonal", label: "Estacionalidad", match: "Investigación estacional", critical: false },
  { key: "open_tasks", label: "Tareas abiertas", match: "Tareas abiertas", critical: false },
  { key: "closed_tasks", label: "Tareas cerradas (90 días)", match: "Tareas completadas, ignoradas", critical: false },
  { key: "previous_plans", label: "Caminos anteriores", match: "Caminos anteriores", critical: false },
  { key: "alerts", label: "Alertas", match: "Alertas activas", critical: false },
  { key: "integrations", label: "Estado de integraciones", match: "Estado de integraciones", critical: false },
];

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function contextBlockStatus(data: unknown): CaminoContextStatus {
  if (isEmptyValue(data)) return "empty";
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    if (record.status === "unavailable") return "unavailable";
    if (record.status === "not_provided") return "not_provided";
    if (record.status === "available") {
      // Some computed blocks expose named fields (fragmentos, MER, limits)
      // instead of a generic `data` property. Their absence from `data` does
      // not mean the agent lacked that evidence.
      const payload = "data" in record
        ? record.data
        : Object.entries(record).filter(([key]) => key !== "status" && key !== "reason").map(([, value]) => value);
      return isEmptyValue(payload) || (Array.isArray(payload) && payload.every(isEmptyValue)) ? "empty" : "ok";
    }
    // Bloques con forma propia (tareas abiertas): miran su lista interior.
    if ("tareas" in record) return contextBlockStatus(record.tareas);
  }
  return "ok";
}

export function summarizeCaminoContext(blocks: unknown): CaminoContextSource[] {
  const list = Array.isArray(blocks) ? (blocks as Block[]) : [];
  return SOURCES.map((source) => {
    const block = list.find((item) => typeof item?.label === "string" && item.label.startsWith(source.match));
    return {
      key: source.key,
      label: source.label,
      critical: source.critical,
      status: block ? contextBlockStatus(block.data) : "unavailable",
    };
  });
}
