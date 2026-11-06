import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { LoadedApiEnv } from "@e-nora/config";
import type { EmailCampaignDossier } from "@e-nora/contracts";
import type { AuthContext } from "./auth-context.js";
import { requireOperationalStore } from "./auth-context.js";
import { isIntegrationFeatureEnabled } from "@e-nora/integrations";
import { a26ContentIdentity } from "./a26-content-evidence.js";
import { selectKlaviyoTemplateBody } from "./klaviyo-template-history.js";
import { emailHtmlToText } from "./email-body-text.js";
import { analyzeEmailHtml } from "./email-html-analysis.js";
import { sanitizeMarketingEmailHtml } from "./marketing-email-safety.js";
import { assessEmailCampaign, campaignMetricTotals } from "./email-campaign-assessment.js";

export async function getEmailCampaignDossier(env: LoadedApiEnv, context: AuthContext, organizationId: string, campaignId: string, input: { connectionId?: string; days?: string }) {
  const fail = (statusCode: number, error: string) => ({ ok: false as const, statusCode, error });
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS)) return fail(404, "integration_disabled");
  if (!z.string().regex(/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i).safeParse(campaignId).success) return fail(400, "invalid_campaign_id");
  if (![...context.memberships, ...(context.storeMemberships ?? [])].some((member) => member.organization_id === organizationId)) return fail(403, "organization_access_denied");
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const campaign = await db.from("klaviyo_campaigns").select("id,name,status,send_time,account_id,external_campaign_id").eq("organization_id", organizationId).eq("id", campaignId).maybeSingle();
  if (campaign.error) return fail(503, "campaign_lookup_unavailable");
  if (!campaign.data) return fail(404, "campaign_not_found");
  const account = await db.from("klaviyo_accounts").select("id,store_id,currency_code").eq("organization_id", organizationId).eq("id", campaign.data.account_id).maybeSingle();
  if (account.error) return fail(503, "campaign_account_unavailable");
  if (!account.data?.store_id) return fail(409, "campaign_store_link_required");
  const accountId = account.data.id;
  const store = await db.from("shopify_stores").select("id,connection_id,is_active").eq("organization_id", organizationId).eq("id", account.data.store_id).maybeSingle();
  if (store.error) return fail(503, "campaign_store_unavailable");
  if (!store.data?.is_active || (input.connectionId && input.connectionId !== store.data.connection_id)) return fail(404, "campaign_not_in_selected_store");
  const access = requireOperationalStore(context, organizationId, store.data.id); if (!access.ok) return access;
  const days = [30, 90, 180, 365].includes(Number(input.days)) ? Number(input.days) : 90;
  const end = new Date(), start = new Date(end.getTime() - days * 86400000);
  const [report, inventory, reviews] = await Promise.all([
    db.rpc("klaviyo_email_report", { target_organization_id: organizationId, period_start: start.toISOString().slice(0,10), period_end: end.toISOString().slice(0,10), target_store_id: store.data.id }),
    db.rpc("klaviyo_email_inventory", { target_organization_id: organizationId, target_store_id: store.data.id }),
    db.from("a26_content_reviews").select("id,message_id,content_hash,source_revision,review,status,created_at,draft_id,task_id").eq("organization_id", organizationId).eq("store_id", store.data.id).eq("account_id", account.data.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const rows = !report.error && Array.isArray(report.data) ? report.data.filter((row: any) => row.entity_type === "campaign" && row.entity_id === campaignId) : [];
  const metricStatus = report.error ? "unavailable" : rows.length ? "available" : "missing";
  const messages: EmailCampaignDossier["messages"] = [];
  const limitations = ["Las métricas son atribuciones de Klaviyo, no ventas incrementales causadas por el diseño.", "El informe disponible contiene agregados mensuales; no se ha verificado la ventana de atribución configurada ni su madurez.", "Las conclusiones reutilizan reglas verificables y revisiones A26 guardadas. Abrir esta ficha no llama a ningún modelo ni modifica envíos."];
  const inventoryRows: Record<string, any>[] = !inventory.error && Array.isArray(inventory.data) ? inventory.data.filter((row: any) => row.parent_id === campaignId && row.account_id === accountId) : [];
  if (inventory.error) limitations.push("No se pudo consultar el inventario de contenido; su ausencia no significa que la campaña esté vacía.");
  if (inventoryRows.length > 6) limitations.push(`Se muestran 6 de ${inventoryRows.length} mensajes. No se valora toda la campaña como reutilizable.`);
  for (const row of inventoryRows.slice(0,6)) {
    try {
      const template = row.external_template_id ? await db.from("klaviyo_templates").select("html_content,text_content").eq("organization_id", organizationId).eq("account_id", account.data.id).eq("external_template_id", row.external_template_id).maybeSingle() : { data: null, error: null };
      if (template.error) throw new Error("template_unavailable");
      const historical = row.send_time && row.external_template_id ? await db.rpc("klaviyo_template_body_at_send", { target_organization_id: organizationId, target_store_id: store.data.id, template_requests: [{ account_id: account.data.id, external_template_id: row.external_template_id, send_time: row.send_time }] }) : { data: [], error: null };
      if (historical.error) throw new Error("history_unavailable");
      const body = selectKlaviyoTemplateBody(template.data?.html_content ?? null, historical.data?.[0], row.send_time ?? null, template.data?.text_content);
      const identity = a26ContentIdentity(row, body.html ?? body.text ?? null, body.provenance);
      const profile = body.html ? analyzeEmailHtml(body.html) : null;
      const issues = profile?.links.filter((link) => link.buttonLike && (!link.href.trim() || link.href.trim() === "#" || /^javascript:/i.test(link.href.trim()))).map((link) => `El CTA «${link.text || "sin texto"}» tiene un destino vacío o no utilizable en la plantilla observada.`) ?? [];
      messages.push({ id: String(row.message_id), subject: row.subject ?? null, preheader: row.preview_text ?? null, html: body.html ? sanitizeMarketingEmailHtml(body.html.slice(0,150000)) : null, text: body.html ? emailHtmlToText(body.html.slice(0,150000), 12000).text : body.text?.slice(0,12000) ?? null, content_hash: identity.content_hash, source_revision: row.source_revision == null ? null : String(row.source_revision), provenance: typeof body.provenance === "string" ? body.provenance : JSON.stringify(body.provenance), historical_observation: typeof body.provenance === "object", issues });
      if (body.html && body.html.length > 150000) limitations.push("Hay contenido truncado por tamaño; la vista previa no representa el email completo.");
    } catch {
      messages.push({ id: String(row.message_id), subject: row.subject ?? null, preheader: row.preview_text ?? null, html: null, text: null, content_hash: null, source_revision: null, provenance: "No se pudo consultar el contenido o su versión histórica.", historical_observation: false, issues: [] });
    }
  }
  const ids = new Set(messages.map((message) => message.id));
  const scopedReviews: EmailCampaignDossier["reviews"] = (reviews.error ? [] : reviews.data ?? []).filter((row) => ids.has(row.message_id)).map((row) => {
    const message = messages.find((item) => item.id === row.message_id)!; const review = row.review as Record<string, any>;
    return { id: row.id, message_id: row.message_id, dimension: String(review.dimension ?? ""), claim_type: String(review.claim_type ?? ""), observation: String(review.observation ?? ""), quote: typeof review.quote === "string" ? review.quote : null, change: String(review.permitted_change ?? ""), criterion: String(review.acceptance_criterion ?? ""), limitation: String(review.limitation ?? ""), status: row.status, current_version: message.content_hash !== null && row.content_hash === message.content_hash && String(row.source_revision) === message.source_revision && row.status !== "superseded", created_at: row.created_at, draft_id: row.draft_id, task_id: row.task_id };
  });
  // A no-change decision only covers messages explicitly present in that run's exact evidence.
  let noChangeVerified = false;
  const runs = messages.length ? await db.from("agent_runs").select("id,agent_outputs(output,status),agent_context_snapshots(snapshot,context_level),agent_versions!inner(agent_definitions!inner(code))").eq("organization_id", organizationId).eq("store_id", store.data.id).eq("status", "succeeded").eq("agent_versions.agent_definitions.code", "a26_contenido_email").order("finished_at", { ascending: false }).limit(5) : { data: [], error: null };
  if (!runs.error && messages.length === inventoryRows.length) noChangeVerified = (runs.data ?? []).some((run: any) => {
    const outputs = Array.isArray(run.agent_outputs) ? run.agent_outputs : [run.agent_outputs];
    const valid = outputs.some((output: any) => ["approved", "published"].includes(output?.status) && output.output?.content_decision === "no_change");
    const evidence = (run.agent_context_snapshots ?? []).flatMap((snapshot: any) => snapshot.context_level === "C2" ? (snapshot.snapshot?.blocks ?? []).flatMap((block: any) => block.label === "Evidencia editorial A26 por mensaje y version" ? block.data?.messages ?? [] : []) : []);
    return valid && messages.every((message) => message.content_hash && evidence.some((item: any) => item.message_id === message.id && item.account_id === accountId && item.content_hash === message.content_hash && String(item.source_revision) === message.source_revision));
  });
  const editorialStatus = reviews.error || runs.error ? "unavailable" : noChangeVerified || scopedReviews.some((review) => review.current_version) ? "current_review" : scopedReviews.length ? "stale" : "not_reviewed";
  if (reviews.error || runs.error) limitations.push("No se pudieron consultar todas las revisiones guardadas de A26.");
  const metrics = campaignMetricTotals(rows);
  if (!account.data.currency_code) { metrics.revenue = null; limitations.push("Sin moneda de cuenta verificada no se presenta ingreso monetario."); }
  const conclusion = assessEmailCampaign({ metrics, metricStatus, messages, reviews: scopedReviews, noChangeVerified: noChangeVerified && editorialStatus !== "unavailable" });
  if (inventory.error && conclusion.status !== "fix_before_reuse") { conclusion.status = "insufficient_evidence"; conclusion.summary = "Contenido no disponible para valorar"; }
  const synthetic = String(campaign.data.external_campaign_id).startsWith("synthetic:");
  if (synthetic) limitations.push("Esta campaña pertenece al histórico sintético de la cuenta TEST; no son resultados comerciales reales.");
  const data: EmailCampaignDossier = { organization_id: organizationId, store_id: store.data.id, connection_id: store.data.connection_id, currency: account.data.currency_code, campaign: { id: campaignId, name: campaign.data.name, subject: messages[0]?.subject ?? null, status: campaign.data.status, send_time: campaign.data.send_time, synthetic }, period: { start: start.toISOString(), end: end.toISOString(), granularity: "monthly_aggregates" }, metrics, metric_status: metricStatus, conclusion, messages, reviews: scopedReviews, editorial_status: editorialStatus,
    strengths: [metrics.conversions !== null && metrics.conversions > 0 ? `El informe registra ${metrics.conversions} conversiones atribuidas; no demuestra que las causara el diseño.` : null, messages.some((message) => message.historical_observation) ? "Existe una versión histórica observada del contenido; no verifica la personalización recibida por cada destinatario." : null].filter((item): item is string => item !== null),
    next_steps: [...new Set(scopedReviews.filter((review) => review.current_version && !["rejected", "superseded"].includes(review.status)).map((review) => review.change).filter(Boolean)), ...(editorialStatus !== "current_review" ? ["Solicitar o esperar la revisión A26 de esta versión desde Klaviyo → Resumen."] : []), "Definir hipótesis, audiencia comparable y criterio de éxito antes de probar cambios; revalidar producto, oferta y fechas antes de reutilizar."], limitations, captured_at: end.toISOString() };
  return { ok: true as const, data };
}
