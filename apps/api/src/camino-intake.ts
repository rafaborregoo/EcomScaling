import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import {
  createKnowledgeDocument,
  requireKnowledgeManager,
  updateKnowledgeDocument,
} from "./knowledge.js";

type ApiEnv = LoadedApiEnv;
export const CAMINO_CONTEXT_KNOWLEDGE_TITLE = "Contexto permanente de Mi Camino";
export const CAMINO_LEARNINGS_KNOWLEDGE_TITLE = "Aprendizajes aprobados de Mi Camino";
export const CAMINO_SEASONAL_KNOWLEDGE_TITLE = "Inteligencia estacional de Mi Camino";

export type CaminoIntakeContext = {
  version: 1;
  priority: string[];
  desiredOutcome: string;
  market: string;
  brandCategory: string;
  constraints: string;
  previousLearning: string;
  diagnosticAnswers: Record<string, string>;
  importantDates: Array<{
    name: string;
    date: string;
    repeatsAnnually: boolean;
    confirmed: boolean;
    note: string;
  }>;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function parseContext(value: unknown): CaminoIntakeContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return null;
  const rawPriorities = Array.isArray(raw.priority)
    ? raw.priority
    : typeof raw.priority === "string" ? [raw.priority] : [];
  const priority = [...new Set(rawPriorities.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 80)))].slice(0, 3);
  const importantDates = Array.isArray(raw.importantDates)
    ? raw.importantDates.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const date = item as Record<string, unknown>;
        if (typeof date.name !== "string" || typeof date.date !== "string") return [];
        return [{
          name: date.name.slice(0, 120),
          date: date.date.slice(0, 10),
          repeatsAnnually: date.repeatsAnnually === true,
          confirmed: typeof date.confirmed === "boolean"
            ? date.confirmed
            : !(typeof date.note === "string" && /sugerid[ao].*calendario/i.test(date.note)),
          note: typeof date.note === "string" ? date.note.slice(0, 500) : "",
        }];
      })
    : [];
  const diagnosticAnswers: Record<string, string> = {};
  if (raw.diagnosticAnswers && typeof raw.diagnosticAnswers === "object" && !Array.isArray(raw.diagnosticAnswers)) {
    for (const [key, answer] of Object.entries(raw.diagnosticAnswers as Record<string, unknown>).slice(0, 10)) {
      if (typeof answer === "string") diagnosticAnswers[key.slice(0, 80)] = answer.slice(0, 1200);
    }
  }
  return {
    version: 1,
    priority,
    desiredOutcome: typeof raw.desiredOutcome === "string" ? raw.desiredOutcome.slice(0, 1600) : "",
    market: typeof raw.market === "string" ? raw.market.slice(0, 160) : "",
    brandCategory: typeof raw.brandCategory === "string" ? raw.brandCategory.slice(0, 300) : "",
    constraints: typeof raw.constraints === "string" ? raw.constraints.slice(0, 1600) : "",
    previousLearning: typeof raw.previousLearning === "string" ? raw.previousLearning.slice(0, 1600) : "",
    diagnosticAnswers,
    importantDates: importantDates.slice(0, 10),
  };
}

async function storeScope(
  supabase: SupabaseClient,
  organizationId: string,
  connectionId?: string | null,
) {
  if (!connectionId) return { ok: true as const, storeId: null };
  const { data, error } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("connection_id", connectionId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "camino_context_scope_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "store_not_found" };
  return { ok: true as const, storeId: data.id as string };
}

async function existingDocument(
  env: ApiEnv,
  organizationId: string,
  storeId: string | null,
) {
  const supabase = createServiceClient(env);
  let query = supabase
    .from("knowledge_documents")
    .select("id, content, updated_at")
    .eq("organization_id", organizationId)
    .eq("title", CAMINO_CONTEXT_KNOWLEDGE_TITLE)
    .eq("source_type", "manual")
    .eq("status", "active");
  query = storeId ? query.eq("store_id", storeId) : query.is("store_id", null);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "camino_context_load_failed", detail: error.message };
  return { ok: true as const, document: data };
}

/**
 * Guarda únicamente investigación estacional con URLs públicas verificables,
 * aislada en el conocimiento de la tienda. Se conserva un historial acotado y
 * cada informe caduca a los 12 meses para que no se reutilice como calendario
 * vigente indefinidamente.
 */
export async function saveCaminoSeasonalKnowledge(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  storeId: string | null,
  output: unknown,
) {
  if (!storeId || !output || typeof output !== "object" || Array.isArray(output)) {
    return { ok: true as const, data: { skipped: "store_scope_or_output_missing" } };
  }
  const raw = output as Record<string, unknown>;
  const sources = Array.isArray(raw.sources) ? raw.sources : [];
  const researchedSources = sources.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const reference = typeof source.reference === "string" ? source.reference.trim() : "";
    if (!/^https?:\/\//i.test(reference)) return [];
    return [{
      reference: reference.slice(0, 1200),
      period: typeof source.period === "string" ? source.period.slice(0, 160) : null,
      kind: typeof source.kind === "string" ? source.kind.slice(0, 40) : "tool",
    }];
  }).slice(0, 30);
  if (!researchedSources.length) {
    return { ok: true as const, data: { skipped: "no_cited_public_sources" } };
  }

  const supabase = createServiceClient(env);
  const { data: store, error: storeError } = await supabase
    .from("shopify_stores")
    .select("connection_id")
    .eq("organization_id", organizationId)
    .eq("id", storeId)
    .eq("is_active", true)
    .maybeSingle();
  if (storeError || !store?.connection_id) {
    return { ok: false as const, statusCode: 500, error: "camino_seasonal_store_scope_failed" };
  }

  const { data: existing, error: existingError } = await supabase
    .from("knowledge_documents")
    .select("id, content")
    .eq("organization_id", organizationId)
    .eq("store_id", storeId)
    .eq("title", CAMINO_SEASONAL_KNOWLEDGE_TITLE)
    .eq("source_type", "manual")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) {
    return { ok: false as const, statusCode: 500, error: "camino_seasonal_knowledge_load_failed" };
  }

  const now = new Date();
  const seasonalTerms = /temporad|estacional|navidad|black\s*friday|rebajas|verano|vuelta al cole|halloween|san valent[ií]n|evento|festiv|lanzamiento|campa[nñ]a/i;
  const findings = (Array.isArray(raw.phases) ? raw.phases : []).flatMap((phaseValue) => {
    if (!phaseValue || typeof phaseValue !== "object" || Array.isArray(phaseValue)) return [];
    const phase = phaseValue as Record<string, unknown>;
    const milestones = (Array.isArray(phase.milestones) ? phase.milestones : []).flatMap((milestoneValue) => {
      if (!milestoneValue || typeof milestoneValue !== "object" || Array.isArray(milestoneValue)) return [];
      const milestone = milestoneValue as Record<string, unknown>;
      const searchable = [milestone.name, milestone.description, milestone.success_metric]
        .filter((value): value is string => typeof value === "string").join(" ");
      if (!seasonalTerms.test(searchable)) return [];
      return [{
        name: typeof milestone.name === "string" ? milestone.name.slice(0, 180) : "Oportunidad estacional",
        description: typeof milestone.description === "string" ? milestone.description.slice(0, 700) : "",
        success_metric: typeof milestone.success_metric === "string" ? milestone.success_metric.slice(0, 300) : "",
        target_offset_days: Number.isInteger(milestone.target_offset_days) ? milestone.target_offset_days : null,
      }];
    });
    if (!milestones.length) return [];
    return [{
      phase: typeof phase.name === "string" ? phase.name.slice(0, 160) : "Fase estacional",
      milestones,
    }];
  }).slice(0, 20);
  const report = {
    researched_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    plan_name: typeof raw.plan_name === "string" ? raw.plan_name.slice(0, 180) : "Mi Camino",
    horizon_months: Number.isInteger(raw.horizon_months) ? raw.horizon_months : null,
    confidence: ["low", "medium", "high"].includes(String(raw.confidence)) ? raw.confidence : "low",
    findings,
    sources: researchedSources,
  };
  let reports: Array<Record<string, unknown>> = [];
  if (typeof existing?.content === "string") {
    try {
      const parsed = JSON.parse(existing.content) as { reports?: unknown };
      if (Array.isArray(parsed.reports)) {
        reports = parsed.reports.filter((value): value is Record<string, unknown> =>
          Boolean(value && typeof value === "object" && !Array.isArray(value)),
        );
      }
    } catch { /* Replace malformed legacy content with a clean versioned record. */ }
  }
  reports = [report, ...reports.filter((item) => item.researched_at !== report.researched_at)].slice(0, 12);
  const content = JSON.stringify({ version: 1, scope: "store_private", reports });
  const saved = existing
    ? await updateKnowledgeDocument(env, context, organizationId, existing.id, { content })
    : await createKnowledgeDocument(env, context, organizationId, {
        title: CAMINO_SEASONAL_KNOWLEDGE_TITLE,
        description: "Investigación pública de temporadas relevante para esta tienda. Las oportunidades son hipótesis, no ventas garantizadas; revisar fechas antes de cada campaña.",
        content,
        source_type: "manual",
        audience: "client_visible",
        connection_id: store.connection_id,
      });
  return saved;
}

export async function getCaminoIntakeContext(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId?: string | null,
) {
  const access = requireKnowledgeManager(context, organizationId);
  if (access.ok === false) return access;
  const scope = await storeScope(createServiceClient(env), organizationId, connectionId);
  if (scope.ok === false) return scope;
  const found = await existingDocument(env, organizationId, scope.storeId);
  if (found.ok === false) return found;
  let saved: CaminoIntakeContext | null = null;
  if (typeof found.document?.content === "string") {
    try {
      saved = parseContext(JSON.parse(found.document.content));
    } catch {
      saved = null;
    }
  }
  return {
    ok: true as const,
    data: { context: saved, document_id: found.document?.id ?? null },
  };
}

export async function assessCaminoIntake(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId: string | null | undefined,
  body: unknown,
) {
  const access = requireKnowledgeManager(context, organizationId);
  if (access.ok === false) return access;
  const intake = parseContext(body);
  if (!intake || intake.priority.length === 0) {
    return { ok: false as const, statusCode: 400, error: "camino_context_priority_required" };
  }
  const supabase = createServiceClient(env);
  const scope = await storeScope(supabase, organizationId, connectionId);
  if (scope.ok === false) return scope;
  const now = new Date();
  const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const [sales, financial, stock, plan, tasks, alerts] = await Promise.all([
    supabase.rpc("shopify_sales_summary", {
      target_organization_id: organizationId,
      period_start: start.toISOString(),
      period_end: now.toISOString(),
      target_store_id: scope.storeId,
    }),
    supabase.rpc("shopify_financial_summary", {
      target_organization_id: organizationId,
      period_start: start.toISOString(),
      period_end: now.toISOString(),
      target_store_id: scope.storeId,
    }),
    supabase.rpc("shopify_stock_summary", {
      target_organization_id: organizationId,
      low_stock_threshold: 5,
      target_store_id: scope.storeId,
    }),
    (() => {
      let query = supabase.from("strategic_plans").select("id, name, status")
        .eq("organization_id", organizationId).neq("status", "archived");
      query = scope.storeId ? query.eq("store_id", scope.storeId) : query.is("store_id", null);
      return query.order("version", { ascending: false }).limit(1).maybeSingle();
    })(),
    (() => {
      let query = supabase.from("tasks").select("id, title, store_id", { count: "exact", head: true })
        .eq("organization_id", organizationId).in("status", ["pending", "in_progress"]);
      query = scope.storeId ? query.or(`store_id.is.null,store_id.eq.${scope.storeId}`) : query.is("store_id", null);
      return query;
    })(),
    (() => {
      let query = supabase.from("alerts").select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId).in("status", ["open", "acknowledged"]);
      query = scope.storeId ? query.eq("store_id", scope.storeId) : query.is("store_id", null);
      return query;
    })(),
  ]);
  const signals = [
    { key: "sales", label: "Ventas recientes de Shopify", status: sales.error ? "unavailable" : sales.data?.length ? "available" : "empty" },
    { key: "finance", label: "Resumen financiero y costes", status: financial.error ? "unavailable" : financial.data?.length ? "available" : "empty" },
    { key: "stock", label: "Inventario", status: stock.error ? "unavailable" : stock.data?.length ? "available" : "empty" },
    { key: "plan", label: "Camino anterior", status: plan.error ? "unavailable" : plan.data ? "available" : "empty" },
    { key: "tasks", label: "Tareas abiertas", status: tasks.error ? "unavailable" : (tasks.count ?? 0) > 0 ? "available" : "empty" },
    { key: "alerts", label: "Alertas activas", status: alerts.error ? "unavailable" : (alerts.count ?? 0) > 0 ? "available" : "empty" },
  ];
  const question = (key: string, prompt: string, placeholder: string, required = false) => ({ key, prompt, placeholder, required });
  const priorityQuestion: Record<string, { key: string; prompt: string; placeholder: string; required: boolean }> = {
    customer: question("customer_signal", "¿Qué comentarios, incidencias o devoluciones te hacen pensar que la experiencia necesita mejorar?", "Por ejemplo: consultas repetidas sobre tallas o retrasos de entrega…", true),
    conversion: question("conversion_signal", "¿En qué parte de la compra notas más fricción, si lo sabes?", "Por ejemplo: visitas sin añadir al carrito, carritos abandonados o dudas en checkout…", true),
    retention: question("retention_signal", "¿Qué sabes hoy sobre clientes que vuelven y qué les anima o les frena?", "Si no lo medís, puedes indicarlo; el camino puede empezar por medirlo…", true),
    offer: question("offer_focus", "¿Qué productos, colecciones o partes de la propuesta te interesa revisar primero?", "Indica una categoría, producto o problema de catálogo…", true),
    operations: question("operations_bottleneck", "¿Cuál es hoy el mayor bloqueo operativo de la tienda?", "Por ejemplo: reposición, preparación de pedidos, devoluciones o falta de tiempo…", true),
    acquisition: question("acquisition_channels", "¿Qué canales usáis para atraer clientes y cuál os preocupa más?", "Por ejemplo: SEO, anuncios, redes, email o colaboraciones…", true),
    seasonal: question("seasonal_event", "¿Qué campaña, temporada o lanzamiento quieres preparar y qué tiene que estar listo antes?", "Añade fechas y necesidades de preparación si las conoces…", true),
    stability: question("stability_risk", "¿Qué riesgo o problema te gustaría resolver antes de intentar crecer?", "Por ejemplo: dependencia de una persona, errores de pedido o catálogo difícil de mantener…", true),
    profitability: question("economic_path", "¿Qué resultado económico mensual quieres alcanzar y para cuándo? ¿La cifra se refiere a ventas, beneficio o margen?", "Por ejemplo: pasar de 50.000 € a 75.000 € de ventas mensuales; indica si es una meta o un mínimo y qué margen necesitas proteger…", true),
    help_me_prioritize: question("priority_signal", "¿Qué problema te ocupa más ahora mismo, aunque todavía no sepas cómo medirlo?", "Describe lo que ves en clientes, pedidos, operaciones o equipo…", true),
  };
  const followUpQuestions = intake.priority
    .map((priority) => priorityQuestion[priority] ?? priorityQuestion.help_me_prioritize!)
    .filter((selectedQuestion) => !intake.diagnosticAnswers[selectedQuestion.key]?.trim())
    .slice(0, 2);
  const capacityIsKnown = /\b(equipo|persona|personas|horas?|tiempo|capacidad|disponibilidad|dedicar|dedicaci[oó]n|semanal)\b/i.test(intake.constraints);
  if (followUpQuestions.length < 3 && !capacityIsKnown && !intake.diagnosticAnswers.team_capacity?.trim()) {
    followUpQuestions.push(question("team_capacity", "¿Quién podrá trabajar en el camino y cuánto tiempo puede dedicar aproximadamente?", "Por ejemplo: una persona, unas 3 horas por semana…", true));
  }
  if (!intake.previousLearning.trim() && !intake.diagnosticAnswers.past_attempts?.trim() && followUpQuestions.length < 3) {
    followUpQuestions.push(question("past_attempts", "¿Qué habéis probado ya relacionado con esta prioridad y qué resultado tuvo?", "Si todavía no habéis probado nada, indícalo…"));
  }
  const economicIntent = intake.priority.includes("profitability") || /\b(ventas|facturaci[oó]n|beneficio|margen|rentabilidad|€|eur|usd|\d+\s*k)\b/i.test(intake.desiredOutcome);
  if (economicIntent && !intake.diagnosticAnswers.economic_path?.trim() && !followUpQuestions.some((item) => item.key === "economic_path") && followUpQuestions.length < 3) {
    followUpQuestions.push(question("economic_path", "Para ordenar la progresión económica, ¿qué cifra mensual quieres alcanzar, en qué fecha y qué significa exactamente: ventas, beneficio o margen?", "Por ejemplo: de 50.000 € a 75.000 € de ventas netas mensuales, manteniendo al menos un 20 % de margen…", true));
  }
  if (!intake.brandCategory.trim() && !intake.diagnosticAnswers.brand_category?.trim() && followUpQuestions.length < 3) {
    followUpQuestions.push(question("brand_category", "¿Qué vende la marca y cuáles son sus categorías o productos principales?", "Por ejemplo: cosmética natural, moda femenina o accesorios infantiles…", true));
  }
  return { ok: true as const, data: { signals, follow_up_questions: followUpQuestions.slice(0, 3) } };
}

/** Guarda en Conocimiento un aprendizaje revisado por una persona. La clave
 * de origen hace que volver a pulsar no duplique la lección. */
export async function approveCaminoReviewLearning(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  planId: string,
  connectionId: string | null | undefined,
  reviewId: string,
  learningIndex: number,
) {
  const access = requireKnowledgeManager(context, organizationId);
  if (access.ok === false) return access;
  if (!/^[0-9a-f-]{36}$/i.test(planId) || !/^[0-9a-f-]{36}$/i.test(reviewId) || !Number.isInteger(learningIndex) || learningIndex < 0 || learningIndex > 99) {
    return { ok: false as const, statusCode: 400, error: "camino_learning_reference_invalid" };
  }
  const supabase = createServiceClient(env);
  const scope = await storeScope(supabase, organizationId, connectionId);
  if (scope.ok === false) return scope;
  const { data: plan, error: planError } = await supabase.from("strategic_plans")
    .select("id, store_id").eq("organization_id", organizationId).eq("id", planId).maybeSingle();
  if (planError || !plan || (plan.store_id ?? null) !== scope.storeId) {
    return { ok: false as const, statusCode: 404, error: "camino_not_found" };
  }
  const { data: review, error: reviewError } = await supabase.from("strategic_plan_weekly_reviews")
    .select("id, output_id, status, review_week_start")
    .eq("organization_id", organizationId).eq("plan_id", planId).eq("id", reviewId).eq("status", "succeeded").maybeSingle();
  if (reviewError || !review?.output_id) {
    return { ok: false as const, statusCode: 404, error: "camino_review_not_found" };
  }
  const { data: outputRow, error: outputError } = await supabase.from("agent_outputs")
    .select("output").eq("id", review.output_id).maybeSingle();
  if (outputError || !outputRow) return { ok: false as const, statusCode: 404, error: "camino_review_output_not_found" };
  const output = outputRow.output && typeof outputRow.output === "object" ? outputRow.output as Record<string, unknown> : {};
  const candidates = Array.isArray(output.learnings) ? output.learnings : [];
  const candidate = candidates[learningIndex];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { ok: false as const, statusCode: 404, error: "camino_learning_not_found" };
  }
  const raw = candidate as Record<string, unknown>;
  const sourceKey = `${review.id}:${learningIndex}`;
  const found = await existingLearningsDocument(env, organizationId, scope.storeId);
  if (found.ok === false) return found;
  const learning = {
    source_key: sourceKey,
    title: typeof raw.title === "string" ? raw.title.slice(0, 180) : "Aprendizaje de Mi Camino",
    learning: typeof raw.learning === "string" ? raw.learning.slice(0, 1200) : "",
    evidence: typeof raw.evidence === "string" ? raw.evidence.slice(0, 1200) : "",
    applies_to: typeof raw.applies_to === "string" ? raw.applies_to.slice(0, 300) : "",
    confidence: ["low", "medium", "high"].includes(String(raw.confidence)) ? raw.confidence : "low",
    approved_at: new Date().toISOString(),
    review_week_start: review.review_week_start,
    plan_id: planId,
  };
  let learnings: Array<Record<string, unknown>> = [];
  if (typeof found.document?.content === "string") {
    try {
      const parsed = JSON.parse(found.document.content) as unknown;
      if (Array.isArray(parsed)) learnings = parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)));
    } catch { /* Replace malformed legacy content with a clean versioned list. */ }
  }
  if (learnings.some((item) => item.source_key === sourceKey)) {
    return { ok: true as const, data: { already_approved: true, source_key: sourceKey } };
  }
  learnings = [...learnings, learning].slice(-100);
  const content = JSON.stringify(learnings, null, 2);
  if (found.document?.id) {
    const updated = await updateKnowledgeDocument(env, context, organizationId, found.document.id, { content });
    if (updated.ok === false) return updated;
  } else {
    const created = await createKnowledgeDocument(env, context, organizationId, {
      title: CAMINO_LEARNINGS_KNOWLEDGE_TITLE,
      description: "Aprendizajes de Mi Camino aprobados por el equipo, con evidencia, alcance, confianza y fecha.",
      content,
      source_type: "manual",
      audience: "client_visible",
      ...(connectionId ? { connection_id: connectionId } : {}),
    });
    if (created.ok === false) return created;
  }
  return { ok: true as const, data: { already_approved: false, source_key: sourceKey } };
}

async function existingLearningsDocument(env: ApiEnv, organizationId: string, storeId: string | null) {
  const supabase = createServiceClient(env);
  let query = supabase.from("knowledge_documents").select("id, content")
    .eq("organization_id", organizationId).eq("title", CAMINO_LEARNINGS_KNOWLEDGE_TITLE)
    .eq("source_type", "manual").eq("status", "active");
  query = storeId ? query.eq("store_id", storeId) : query.is("store_id", null);
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "camino_learning_load_failed", detail: error.message };
  return { ok: true as const, document: data };
}

export async function saveCaminoIntakeContext(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId: string | null | undefined,
  body: unknown,
) {
  const access = requireKnowledgeManager(context, organizationId);
  if (access.ok === false) return access;
  const intake = parseContext(body);
  if (!intake || intake.priority.length === 0) {
    return { ok: false as const, statusCode: 400, error: "camino_context_priority_required" };
  }
  const scope = await storeScope(createServiceClient(env), organizationId, connectionId);
  if (scope.ok === false) return scope;
  const content = JSON.stringify(intake, null, 2);
  const found = await existingDocument(env, organizationId, scope.storeId);
  if (found.ok === false) return found;
  if (found.document?.id) {
    const updated = await updateKnowledgeDocument(env, context, organizationId, found.document.id, { content });
    if (updated.ok === false) return updated;
    return { ok: true as const, data: { document_id: found.document.id, context: intake } };
  }
  const created = await createKnowledgeDocument(env, context, organizationId, {
    title: CAMINO_CONTEXT_KNOWLEDGE_TITLE,
    description: "Prioridades, respuestas adaptadas, fechas, capacidad y aprendizajes que el equipo de la tienda aporta para planificar Mi Camino.",
    content,
    source_type: "manual",
    audience: "client_visible",
    ...(connectionId ? { connection_id: connectionId } : {}),
  });
  if (created.ok === false) return created;
  return { ok: true as const, data: { document_id: created.data.document_id, context: intake } };
}
