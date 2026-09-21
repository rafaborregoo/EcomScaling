import type { ChatOutput } from "@ecomscaling/ai";
import {
  COPILOT_INSIGHT_TARGET_SLUGS,
  isCopilotInsightTarget,
} from "@ecomscaling/contracts";

export type ChatUiAction = NonNullable<ChatOutput["ui_actions"]>[number];

export const COPILOT_UI_ACTION_INSTRUCTIONS = [
  "[ACCIONES DE UI DEL COPILOTO]",
  "Puedes devolver ui_actions solo cuando una card concreta sea el siguiente destino humano.",
  "Cada accion debe ser kind=open_insight, usar exactamente uno de los insight_slug permitidos y no incluir href ni rutas.",
  `Destinos permitidos: ${COPILOT_INSIGHT_TARGET_SLUGS.join(", ")}.`,
  "Usa Ver evidencia para revisar soporte, Abrir card para inspeccionar el resultado y Revisar datos faltantes cuando el gate este bloqueado.",
  "No uses una accion de UI para ejecutar, aprobar, escribir o cambiar datos.",
].join("\n");

const UI_ACTION_LABELS = new Set<ChatUiAction["label"]>([
  "Ver evidencia",
  "Abrir card",
  "Revisar datos faltantes",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * El modelo puede sugerir un destino semantico, pero el backend decide si el
 * destino existe. Nunca aceptamos hrefs del modelo y nunca devolvemos mas de
 * tres destinos distintos para una respuesta.
 */
export function sanitizeChatUiActions(value: unknown): ChatUiAction[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const actions: ChatUiAction[] = [];

  for (const raw of value) {
    const item = record(raw);
    const slug = item?.insight_slug;
    const label = item?.label;
    const reason = item?.reason;
    if (
      item?.kind !== "open_insight" ||
      !isCopilotInsightTarget(slug) ||
      typeof label !== "string" ||
      !UI_ACTION_LABELS.has(label as ChatUiAction["label"]) ||
      typeof reason !== "string" ||
      reason.trim().length === 0
    ) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    actions.push({
      kind: "open_insight",
      insight_slug: slug,
      label: label as ChatUiAction["label"],
      reason: reason.trim().slice(0, 240),
    });
    if (actions.length === 3) break;
  }

  return actions;
}
