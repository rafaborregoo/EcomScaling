/**
 * Frase legible de cada acción de `audit_logs` ("area.verbo"). Lo que no está
 * aquí se enseña con el nombre técnico, sin inventar una frase.
 */
const LABELS: Record<string, string> = {
  "financial_config.upsert_settings": "Cambió las comisiones o el envío medio",
  "financial_config.create_fixed_expense": "Añadió un gasto fijo",
  "financial_config.deactivate_fixed_expense": "Quitó un gasto fijo",
  "financial_config.create_shipping_rule": "Añadió una regla de envío",
  "financial_config.deactivate_shipping_rule": "Quitó una regla de envío",
  "financial_config.upsert_metric_target": "Fijó un objetivo",
  "financial_config.retire_metric_target": "Quitó un objetivo",
  "shopify_product_costs.create_manual_cost": "Puso el coste de un producto",
  "shopify_product_costs.import": "Importó costes de producto",
  "consultant.invite_client_member": "Invitó a una persona",
  "consultant.update_client_member": "Cambió el rol o el acceso de una persona",
  "organization.ownership_transferred": "Traspasó la propiedad",
  "organization.consultant_permissions_updated": "Cambió lo que puede hacer el consultor",
  "organization.require_mfa_updated": "Cambió la verificación en dos pasos del equipo",
  "operations.create_task": "Creó una tarea",
  "operations.add_task_comment": "Comentó una tarea",
  "operations.update_task_assignment": "Reasignó una tarea",
  "operations.update_alert_status": "Cambió el estado de una alerta",
  "calls.create_task": "Creó una tarea desde una llamada",
  "calls.create_summary": "Resumió una llamada",
  "marketing_draft.scheduled": "Programó una campaña",
  "marketing.studio_create": "Creó una pieza de email",
  "marketing.brand_profile.updated": "Cambió la guía de marca",
  "campaign_review.set": "Revisó una campaña",
  "klaviyo.api_key_connected": "Conectó Klaviyo",
  "klaviyo.flow_created": "Creó un flow en Klaviyo",
  "meta.oauth_connected": "Conectó Meta Ads",
  "shopify.oauth_connected": "Conectó una tienda Shopify",
  "store_scope_updated": "Cambió a qué tienda va una cuenta",
  "knowledge.create_document": "Subió un documento al conocimiento",
  "knowledge.create_constraint": "Añadió una regla al conocimiento",
  "campaign_ai_edit.proposed": "Propuso un cambio en una campaña con IA",
  "campaign_ai_edit.applied": "Aplicó un cambio en una campaña con IA",
  "campaign_note.added": "Dejó una nota en una campaña",
  "marketing_draft_note.added": "Dejó una nota en un borrador",
  "marketing.studio_edit_after_review": "Editó una pieza tras revisarla",
  "ai.edit_marketing_draft": "Editó un borrador de marketing con IA",
  "ai.submit_marketing_draft": "Envió un borrador de marketing a revisión",
  "ai.start_mailing_campaign_graph": "Empezó una campaña de mailing con IA",
  "ai.resume_mailing_campaign_graph": "Retomó una campaña de mailing con IA",
  "ai.mailing_email_redraft": "Rehízo un email con IA",
  "klaviyo.template_imported": "Importó una plantilla de Klaviyo",
  "alerts.configure_rule": "Configuró una regla de alerta",
  "calls.create": "Registró una llamada",
  "calls.update": "Actualizó una llamada",
  "calls.add_internal_note": "Dejó una nota interna en una llamada",
  "calls.save_transcript": "Guardó la transcripción de una llamada",
  "knowledge.update_constraint": "Cambió una regla del conocimiento",
  "knowledge.update_document": "Cambió un documento del conocimiento",
  "organization.ai_settings_updated": "Cambió los ajustes de la IA",
  "consultant_client_message.sent": "Te escribió un mensaje",
};

export function activityLabel(action: string): string {
  if (LABELS[action]) return LABELS[action];
  // Sin frase escrita: legible, nunca el identificador crudo.
  const text = action.replace(/[._]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ACTIVITY_FILTERS = [
  { value: "todo", label: "Todo" },
  { value: "config", label: "Costes y objetivos" },
  { value: "team", label: "Equipo" },
  { value: "integrations", label: "Integraciones" },
  { value: "work", label: "Trabajo" },
  { value: "marketing", label: "Marketing" },
] as const;

export type ActivityItem = {
  id: string;
  action: string;
  category: string;
  created_at: string;
  actor: { id: string; name: string | null; kind: "consultant" | "member" } | null;
};
