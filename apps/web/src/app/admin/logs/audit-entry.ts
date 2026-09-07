/**
 * Traducción de los códigos de auditoría a algo legible.
 *
 * Las acciones se nombran `area.verbo` (`knowledge.create_document`,
 * `consultant.update_organization`). Enseñar el código crudo obliga a
 * descifrarlo; enseñar solo lo mapeado deja filas en blanco cada vez que
 * alguien añade una acción nueva y se olvida de tocar este fichero -- que es
 * exactamente lo que va a pasar.
 *
 * Por eso el fallback nunca está vacío: convierte `area.verbo_compuesto` en
 * "verbo compuesto" y sigue diciendo algo cierto.
 */

/** Áreas para el filtro. El valor es el prefijo que el backend usa con `like`. */
export const AUDIT_AREAS = [
  { value: "", label: "Todas las áreas" },
  { value: "consultant", label: "Clientes y consultores" },
  { value: "admin", label: "Administración" },
  { value: "knowledge", label: "Conocimiento" },
  { value: "financial_config", label: "Configuración financiera" },
  { value: "alerts", label: "Alertas" },
  { value: "operations", label: "Tareas y alertas" },
  { value: "calls", label: "Llamadas" },
  { value: "marketing_draft", label: "Marketing" },
  { value: "ai", label: "IA" },
];

const AREA_LABEL: Record<string, string> = {
  admin: "Administración",
  ai: "IA",
  alerts: "Alertas",
  calls: "Llamadas",
  consultant: "Clientes",
  consultant_client_message: "Mensajes",
  financial_config: "Economía",
  klaviyo: "Klaviyo",
  knowledge: "Conocimiento",
  marketing_draft: "Marketing",
  marketing_draft_note: "Marketing",
  meta: "Meta",
  operations: "Operativa",
  shopify: "Shopify",
  shopify_product_costs: "Costes",
};

/** Los verbos que no se leen solos al descomponer el código. */
const VERB_LABEL: Record<string, string> = {
  "consultant.create_client": "dio de alta un cliente",
  "consultant.invite_client_member": "invitó a una persona",
  "consultant.update_client_member": "cambió el acceso de alguien",
  "consultant.update_organization": "editó los datos del cliente",
  "consultant.pause_client": "pausó el cliente",
  "consultant.resume_client": "reanudó el cliente",
  "consultant.unlink_client": "se desvinculó del cliente",
  "consultant.request_organization_deletion": "pidió borrar el cliente",
  "consultant.restore_organization": "restauró el cliente",
  "consultant.purge_organization": "borró el cliente definitivamente",
  "consultant.export_organization_data": "exportó los datos del cliente",
  "admin.create_client_organization": "creó una organización",
  "admin.hard_delete_organization": "borró una organización sin vuelta atrás",
  "admin.invite_consultant": "invitó a un consultor",
  "admin.update_consultant": "editó un consultor",
  "knowledge.create_document": "añadió un documento",
  "knowledge.create_constraint": "creó una regla del copiloto",
  "knowledge.update_constraint": "cambió una regla del copiloto",
  "alerts.configure_rule": "configuró un aviso",
  "financial_config.upsert_settings": "cambió los costes",
  "financial_config.create_fixed_expense": "añadió un gasto fijo",
  "financial_config.deactivate_fixed_expense": "quitó un gasto fijo",
  "financial_config.create_shipping_rule": "añadió una regla de envío",
  "financial_config.deactivate_shipping_rule": "quitó una regla de envío",
  "operations.create_task": "creó una tarea",
  "operations.update_task_status": "cambió el estado de una tarea",
  "operations.update_alert_status": "cambió el estado de una alerta",
  "klaviyo.oauth_connected": "conectó Klaviyo",
  "klaviyo.api_key_connected": "conectó Klaviyo con clave privada",
  "meta.oauth_connected": "conectó Meta",
  "shopify.oauth_connected": "conectó Shopify",
};

export type AuditSummary = { area: string; verb: string };

export function auditSummary(action: string): AuditSummary {
  const [rawArea = "", ...rest] = action.split(".");
  const rawVerb = rest.join(".");

  return {
    area: AREA_LABEL[rawArea] ?? rawArea.replaceAll("_", " ") ?? "otros",
    // Una acción nueva sin mapear sigue diciendo algo: "create_own_store" ->
    // "create own store". Feo, pero nunca en blanco.
    verb: VERB_LABEL[action] ?? rawVerb.replaceAll("_", " ") ?? action,
  };
}

/**
 * Un sync caído es un fallo de infraestructura y deja al cliente sin datos;
 * un agente con error afecta a una respuesta. No pesan igual.
 */
export function errorTone(kind: "sync" | "agent"): "danger" | "warn" {
  return kind === "sync" ? "danger" : "warn";
}
