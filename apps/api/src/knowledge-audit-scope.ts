/** A08 audits shared methodology and this tenant's client-facing documents. */
export const KNOWLEDGE_AUDIT_SCOPE_GUIDANCE = "ALCANCE INTERNO A08: la metodología global autorizada incluye client_visible y consultant_only. Estas etiquetas de material GLOBAL no significan documentos privados de esta organización. El catálogo de la organización se limita a client_visible; se excluyen sus notas privadas, system_only y cualquier documento privado de otros tenants. No mezcles los recuentos. Los contadores agregados son completos solo si coverage_status lo confirma; document_sample es una muestra separada y su tamaño real manda sobre ejemplos antiguos. La evidencia semántica recupera como máximo el primer fragmento de 700 caracteres por documento: permite revisar candidatos y procedencia, no certificar igualdad de documentos completos. Las recomendaciones son editoriales internas y proposed_writes debe quedar vacío. Una búsqueda vacía puede indicar cobertura, permisos, consulta o recuperación deficiente; no prueba por sí sola que falte un documento. No reconstruyas consultas ni motivos de rechazo omitidos.";

export function knowledgeAuditScopeFilter(organizationId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)) throw new Error("invalid_organization_id");
  return `and(visibility.eq.global,audience.in.(client_visible,consultant_only)),and(visibility.eq.organization,organization_id.eq.${organizationId},audience.eq.client_visible)`;
}

export function isKnowledgeAuditDocumentInScope(document: { visibility: string; audience: string; organization_id?: string | null }, organizationId: string) {
  return document.visibility === "global"
    ? ["client_visible", "consultant_only"].includes(document.audience)
    : document.visibility === "organization" && document.organization_id === organizationId && document.audience === "client_visible";
}
