"use client";
import { AiDiagnosticSection } from "./ai-diagnostic-section";

/** Lo fijo de la revisión A26: lo comparten esta tarjeta y su fila en los especialistas de /klaviyo. */
export const A26_EMAIL_AUDIT = {
  title: "Revisión del contenido de email",
  description: "A26 revisa asuntos, textos, enlaces y estructura de una muestra de esta tienda. Se actualiza automáticamente cuando corresponde; abrir esta sección consulta la revisión guardada. Los cambios aprobados se preparan con A11 en Marketing.",
  getPath: "/ai/contenido-email",
  runPath: "/ai/contenido-email-run",
  loadingLabel: "Consultando la revisión editorial guardada…",
  tasksLabelSingular: "mejora editorial",
  renderPreview: true,
};

export function A26EmailAudit({ organizationId, connectionId }: { organizationId: string; connectionId?: string }) {
  return <AiDiagnosticSection key={`${organizationId}:${connectionId ?? "auto"}`} organizationId={organizationId} connectionIdOverride={connectionId} {...A26_EMAIL_AUDIT} />;
}
