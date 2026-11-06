import type { EmailCampaignDossier } from "@e-nora/contracts";

/** A verdict about reuse, not an estimate of design-caused sales or an instruction to stop sending. */
export function assessEmailCampaign(input: {
  metrics: EmailCampaignDossier["metrics"]; metricStatus: EmailCampaignDossier["metric_status"];
  messages: EmailCampaignDossier["messages"]; reviews: EmailCampaignDossier["reviews"];
  noChangeVerified: boolean;
}): EmailCampaignDossier["conclusion"] {
  const base = { basis: "rules_and_saved_a26" as const, mature_attribution_verified: false as const };
  const issues = input.messages.flatMap((message) => message.issues);
  if (issues.length) return { ...base, status: "fix_before_reuse", summary: "Corregir antes de reutilizar", reasons: issues };
  const currentReviews = input.reviews.filter((review) => review.current_version && !["rejected", "superseded"].includes(review.status));
  if (currentReviews.some((review) => review.change.trim())) return { ...base, status: "improve_and_test", summary: "Mejorar y probar", reasons: ["A26 propone cambios sobre la versión actual. Son propuestas editoriales; su efecto en ventas debe comprobarse."] };
  if (!input.messages.length || input.messages.some((message) => !message.html && !message.text)) return { ...base, status: "insufficient_evidence", summary: "Falta contenido para valorar su reutilización", reasons: ["No está disponible el cuerpo de todos los mensajes de esta campaña."] };
  if (!input.noChangeVerified) return { ...base, status: "insufficient_evidence", summary: "Pendiente de revisión editorial de esta versión", reasons: ["Las cifras por sí solas no demuestran que el contenido sea bueno o malo. Falta una revisión A26 vigente de todos los mensajes."] };
  if (input.metricStatus !== "available" || input.metrics.delivered === null || input.metrics.delivered <= 0) return { ...base, status: "insufficient_evidence", summary: "Faltan resultados comparables", reasons: ["Hay revisión editorial, pero no entregas medidas suficientes para contrastarla con resultados."] };
  return { ...base, status: "reuse", summary: "Reutilizable como base editorial", reasons: ["A26 revisó esta versión sin proponer cambios. Revalidar producto, oferta, fechas y destinatarios antes de un nuevo envío.", "Esta valoración no declara una campaña ganadora: no se ha verificado la madurez de atribución ni un experimento causal."] };
}

export function campaignMetricTotals(rows: ReadonlyArray<Record<string, unknown>>): EmailCampaignDossier["metrics"] {
  const keys = ["revenue", "conversions", "recipients", "delivered", "opens_unique", "clicks_unique", "unsubscribes", "bounced", "spam_complaints"] as const;
  const total = (key: typeof keys[number]) => rows.length && rows.every((row) => row[key] !== null && row[key] !== undefined && Number.isFinite(Number(row[key]))) ? rows.reduce((sum, row) => sum + Number(row[key]), 0) : null;
  const metrics = Object.fromEntries(keys.map((key) => [key, total(key)])) as Pick<EmailCampaignDossier["metrics"], typeof keys[number]>;
  const rate = (a: number | null, b: number | null) => a !== null && b !== null && b > 0 ? a / b : null;
  return { ...metrics, open_rate: rate(metrics.opens_unique, metrics.delivered), click_rate: rate(metrics.clicks_unique, metrics.delivered), unsub_rate: rate(metrics.unsubscribes, metrics.delivered), bounce_rate: rate(metrics.bounced, metrics.recipients) };
}
