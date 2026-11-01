/**
 * ADR-0025: integracion del grafo de la campaña de mailing con el runtime.
 *
 * - Arranque: el consultor aprueba la estrategia de A27 y la API lanza el grafo
 *   en segundo plano con el contexto de quien pulsa.
 * - Pausa: cada borrador queda en pending_approval como siempre.
 * - Reanudacion: la decision por la ruta de borradores existente
 *   (decideMarketingContentDraft) llama a `advanceMailingCampaignForDraft`; la
 *   revision del consultor y el reintento de un email fallido tienen su propia
 *   ruta. "Reanudar" lo hace a mano y el job del worker (resumeStalledMailingCampaigns)
 *   recoge lo que se quedo parado tras un reinicio de la API.
 * - Exclusion: un lease en la secuencia (graph_lease_until) impide que la API y
 *   el worker muevan el mismo hilo a la vez.
 *
 * organization_id y store_id salen de la sesion y de la secuencia guardada,
 * nunca del cuerpo de la peticion.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import WebSocket from "ws";
import { Command } from "@langchain/langgraph";
import { weeklyMailingPlanOutputSchema } from "@e-nora/ai";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import {
  MAILING_GRAPH_MAX_CONCURRENCY,
  MAILING_GRAPH_STALE_MS,
  buildWeeklyMailingEmailBrief,
  mailingFailureDecisionSchema,
  isMailingEmailTerminal,
  mailingRetryFeedback,
  mailingCampaignGraphStateSchema,
  type MailingApproverRole,
  type MailingCampaignView,
  type MailingEmailState,
} from "@e-nora/contracts";
import type { AuthContext } from "./auth-context.js";
import { requireMailingAccess } from "./marketing-mailing-access.js";
import { buildPlatformAdminContext, runMarketingContentDraft } from "./ai-runtime.js";
import { setMarketingDraftSchedule } from "./consultant.js";
import { recordAuditLog } from "./audit-log.js";
import { isStaffActor, type ThreadActor } from "./campaign-review.js";
import {
  buildMailingCampaignGraph,
  listMailingInterrupts,
  type MailingCampaignGraph,
  type MailingGraphDeps,
} from "./mailing-campaign-graph.js";
import { MailingCampaignCheckpointSaver, createSupabaseCheckpointStore } from "./mailing-campaign-checkpointer.js";
import { reviewMailingDraft } from "./mailing-campaign-review.js";
import { verifyMailingResources, verifyMailingApprovalContext } from "./marketing-mailing-production.js";
import { mailingObservationReadiness } from "./marketing-mailing-delivery-context.js";

const logger = createLogger("mailing-campaign");

type Env = Pick<LoadedApiEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "MAILING_GRAPH_ENABLED" | "MAILING_GRAPH_ORGS">;
type Failure = { ok: false; statusCode: number; error: string; message?: string };

/** Un proceso que muere deja el lease; caduca a los 15 min y otro proceso lo recoge. */
const LEASE_RENEW_MS = 60_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serviceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export function isMailingGraphEnabled(env: Pick<Env, "MAILING_GRAPH_ENABLED" | "MAILING_GRAPH_ORGS">, organizationId: string) {
  if (env.MAILING_GRAPH_ENABLED !== "true") return false;
  const pilot = (env.MAILING_GRAPH_ORGS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  return pilot.length === 0 || pilot.includes(organizationId);
}

type SequenceRow = {
  id: string;
  organization_id: string;
  store_id: string | null;
  status: string;
  orchestrator: string;
  request: Record<string, unknown>;
  plan: Record<string, unknown>;
  client_state: Record<string, unknown>;
  graph_requires_consultant_review: boolean | null;
  revision: string;
  graph_bootstrap: unknown;
  context_snapshot: unknown;
  approved_at?: string | null;
};

/** Textos literales pedidos para toda la campaña (uno por linea en el planificador). */
export function readMailingVerbatimTexts(clientState: Record<string, unknown> | null | undefined): string[] {
  const raw = clientState?.verbatim_texts;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((text): text is string => typeof text === "string")
    .map((text) => text.trim())
    .filter((text) => text.length > 0 && text.length <= 2000)
    .slice(0, 20);
}

/**
 * Quien puede ver/mover una campaña. Puro para probar aislamiento: solo
 * membership de organizacion (las cuentas limitadas a tienda quedan fuera, como
 * en el resto de marketing) y, si la pantalla pide una tienda, tiene que ser la
 * de la campaña.
 */
export function authorizeMailingCampaign(
  context: Pick<AuthContext, "memberships" | "profile"> & Partial<Pick<AuthContext, "storeMemberships" | "subscriptions">>,
  organizationId: string,
  sequence: Pick<SequenceRow, "organization_id" | "store_id"> | null,
  requestedStoreId?: string | null,
): { ok: true; actor: ThreadActor } | Failure {
  if (!sequence || sequence.organization_id !== organizationId) {
    return { ok: false, statusCode: 404, error: "mailing_campaign_not_found" };
  }
  const operational = requireMailingAccess({ ...context, subscriptions: context.subscriptions ?? [] } as AuthContext,
    organizationId, sequence.store_id);
  if (!operational.ok) return operational;
  const actor = approverRole(context.profile.platform_role);
  if (requestedStoreId !== undefined && requestedStoreId !== null && requestedStoreId !== sequence.store_id) {
    return { ok: false, statusCode: 404, error: "mailing_campaign_not_found" };
  }
  return { ok: true, actor };
}

async function loadSequence(supabase: SupabaseClient, organizationId: string, sequenceId: string) {
  if (!UUID.test(sequenceId)) return null;
  const { data, error } = await supabase
    .from("marketing_mailing_sequences")
    .select("id, organization_id, store_id, status, orchestrator, request, plan, client_state, graph_requires_consultant_review, revision, graph_bootstrap, context_snapshot, approved_at")
    .eq("organization_id", organizationId)
    .eq("id", sequenceId)
    .maybeSingle();
  if (error) throw new Error(`mailing_sequence_load_failed: ${error.message}`);
  return (data as SequenceRow | null) ?? null;
}

function approverRole(platformRole: string | null | undefined): MailingApproverRole {
  if (platformRole === "platform_admin") return "platform";
  if (platformRole === "consultant") return "consultant";
  return "client";
}

/** Dependencias reales del grafo: los runners y tablas existentes. */
async function mutateGraph(supabase: SupabaseClient, sequenceId: string, token: string, operation: string, payload: unknown = {}) {
  const { data, error } = await supabase.rpc("mutate_mailing_graph", {
    p_sequence_id: sequenceId, p_token: token, p_operation: operation, p_payload: payload,
  });
  if (error) throw new Error(`mailing_graph_${operation}_failed: ${error.message}`);
  return data === true;
}

function realDeps(env: Env, context: AuthContext, sequence: SequenceRow, token: string): MailingGraphDeps {
  const supabase = serviceClient(env);
  const organizationId = sequence.organization_id;
  const clientState = sequence.client_state ?? {};
  const templateIds = Array.isArray(clientState.selected_template_ids)
    ? (clientState.selected_template_ids as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  const baseDesignTemplateId = typeof clientState.base_design_template_id === "string"
    ? clientState.base_design_template_id
    : null;
  const verbatimTexts = readMailingVerbatimTexts(clientState);
  const mutate = async (operation: string, payload?: unknown) => {
    if (!await mutateGraph(supabase, sequence.id, token, operation, payload)) throw new Error("mailing_graph_lease_lost_or_cancelled");
  };
  return {
    async draft(email, feedback) {
      await mutate("assert");
      const result = await runMarketingContentDraft(env as LoadedApiEnv, context, organizationId, {
        content_type: "campaign",
        channel: "email_klaviyo",
        mailing_sequence_id: sequence.id,
        mailing_email_number: email.sequence_number,
        mailing_revision: sequence.revision,
        mailing_lease_token: token,
        idempotency_key: email.attempt === 0
          ? `${sequence.id}:${email.sequence_number}`
          : `${sequence.id}:${email.sequence_number}:r${email.attempt}`,
        store_id: sequence.request.store_connection_id ?? null,
        brief: feedback.length ? `${email.brief}\n${mailingRetryFeedback(feedback)}` : email.brief,
        ...(templateIds.length ? { template_ids: templateIds } : {}),
        ...(baseDesignTemplateId ? { base_design_template_id: baseDesignTemplateId } : {}),
        ...(email.image_url ? { content_image_urls: [email.image_url] } : {}),
        ...(verbatimTexts.length ? { verbatim_texts: verbatimTexts } : {}),
      });
      if (!result.ok) return { ok: false, error: result.error };
      const draft = (result.data as { draft?: Record<string, unknown> }).draft;
      if (!draft || typeof draft.id !== "string") return { ok: false, error: "draft_missing" };
      return {
        ok: true,
        draftId: draft.id,
        content: {
          subject: (draft.subject as string | null) ?? null,
          preheader: (draft.preheader as string | null) ?? null,
          html: (draft.html as string | null) ?? null,
          plain_text: (draft.plain_text as string | null) ?? null,
          verbatim_texts: verbatimTexts,
        },
      };
    },
    review: reviewMailingDraft,
    async readDecision(draftId) {
      const { data, error } = await supabase
        .from("marketing_content_drafts")
        .select("status, decided_by, decision_reason")
        .eq("organization_id", organizationId)
        .eq("id", draftId)
        .maybeSingle();
      if (error) throw new Error(`mailing_decision_read_failed: ${error.message}`);
      if (!data || !["approved", "rejected"].includes(data.status as string)) return { status: "pending_approval" };
      let role: MailingApproverRole | null = null;
      let membershipRole: string | null = null;
      if (data.decided_by) {
        const [{ data: profile }, { data: member }] = await Promise.all([
          supabase.from("profiles").select("platform_role").eq("id", data.decided_by).maybeSingle(),
          supabase
            .from("organization_members")
            .select("role")
            .eq("organization_id", organizationId)
            .eq("user_id", data.decided_by)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle(),
        ]);
        role = approverRole(profile?.platform_role as string | undefined);
        membershipRole = (member?.role as string | undefined) ?? null;
      }
      return {
        status: data.status as "approved" | "rejected",
        decidedBy: (data.decided_by as string | null) ?? null,
        role,
        membershipRole,
        reason: (data.decision_reason as string | null) ?? null,
      };
    },
    async readConsultantReview(sequenceNumber) {
      const { data, error } = await supabase
        .from("marketing_mailing_campaign_emails")
        .select("consultant_review_decision, consultant_review_reason, consultant_reviewed_by")
        .eq("organization_id", organizationId)
        .eq("sequence_id", sequence.id)
        .eq("sequence_number", sequenceNumber)
        .maybeSingle();
      if (error) throw new Error(`mailing_review_read_failed: ${error.message}`);
      if (!data?.consultant_review_decision) return null;
      return {
        decision: data.consultant_review_decision as "approved" | "rejected",
        reviewedBy: (data.consultant_reviewed_by as string | null) ?? null,
        reason: (data.consultant_review_reason as string | null) ?? null,
      };
    },
    async readFailureDecision(sequenceNumber) {
      const { data, error } = await supabase
        .from("marketing_mailing_campaign_emails")
        .select("failure_decision")
        .eq("organization_id", organizationId)
        .eq("sequence_id", sequence.id)
        .eq("sequence_number", sequenceNumber)
        .maybeSingle();
      if (error) throw new Error(`mailing_failure_decision_read_failed: ${error.message}`);
      const parsed = mailingFailureDecisionSchema.safeParse(data?.failure_decision);
      return parsed.success ? parsed.data : null;
    },
    async schedule(email) {
      await mutate("assert");
      // programar(email) -- hoy: fecha prevista en nuestra tabla, como el flujo
      // del navegador. El envio a Klaviyo sigue siendo manual (ADR-0025).
      const result = await setMarketingDraftSchedule(env as LoadedApiEnv, context, organizationId, email.draft_id!, {
        scheduled_for: email.scheduled_for,
        mailing_lease_token: token,
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    },
    async project(email) {
      await mutate("project", email);
    },
    async recordRetry(email, rejection) {
      await mutate("assert");
      // La nueva redaccion de A11 corre con la sesion de quien movio el grafo
      // (el presupuesto diario se carga a la organizacion, no a esa persona):
      // queda constancia de quien fue.
      await recordAuditLog(supabase, {
        organizationId,
        actorUserId: context.user.id,
        action: "ai.mailing_email_redraft",
        entityType: "marketing_mailing_sequence",
        entityId: sequence.id,
        newData: { sequence_number: email.sequence_number, attempt: rejection.attempt + 1, source: rejection.source },
      });
      if (!email.draft_id) return;
      const { data: draft, error: draftError } = await supabase
        .from("marketing_content_drafts")
        .select("agent_run_id, agent_output_id")
        .eq("organization_id", organizationId)
        .eq("id", email.draft_id)
        .maybeSingle();
      if (draftError) throw new Error(`mailing_retry_draft_read_failed: ${draftError.message}`);
      // El borrador superado por la revision automatica sale de la cola de
      // aprobacion: nadie debe aprobar una version que ya se esta rehaciendo.
      if (rejection.source === "auto_review") {
        await mutate("reject_draft", { draft_id: email.draft_id, at: rejection.at,
          reason: `Revisión automática: ${rejection.reasons.join(" · ")}`.slice(0, 2000) });
      }
      const runId = draft?.agent_run_id as string | undefined;
      if (!runId) return;
      const { data: steps, error: stepsError } = await supabase
        .from("agent_run_steps")
        .select("position, step_type, payload")
        .eq("run_id", runId)
        .order("position", { ascending: false });
      if (stepsError) throw new Error(`mailing_retry_steps_read_failed: ${stepsError.message}`);
      const already = (steps ?? []).some((step) =>
        step.step_type === "graph_retry" &&
        (step.payload as Record<string, unknown> | null)?.attempt === rejection.attempt);
      if (already) return; // el nodo se re-ejecuto tras un fallo
      const { error } = await supabase.from("agent_run_steps").insert({
        run_id: runId,
        organization_id: organizationId,
        position: ((steps?.[0]?.position as number | undefined) ?? 0) + 1,
        step_type: "graph_retry",
        summary: `Reintento ${rejection.attempt + 1} de la campaña de mailing (${rejection.source}): ${rejection.reasons.join(" · ")}`.slice(0, 1000),
        payload: {
          sequence_id: sequence.id,
          sequence_number: email.sequence_number,
          attempt: rejection.attempt,
          source: rejection.source,
          reasons: rejection.reasons,
        },
        duration_ms: null,
      });
      if (error) throw new Error(`mailing_retry_step_failed: ${error.message}`);
    },
    async closeCampaign() {
      await mutate("close");
    },
  };
}

function graphFor(env: Env, context: AuthContext, sequence: SequenceRow, token: string, deps = realDeps(env, context, sequence, token)) {
  const saver = new MailingCampaignCheckpointSaver(
    createSupabaseCheckpointStore(serviceClient(env), {
      organizationId: sequence.organization_id,
      storeId: sequence.store_id,
      sequenceId: sequence.id,
    }, async (operation, payload) => {
      if (!await mutateGraph(serviceClient(env), sequence.id, token, operation, payload)) throw new Error("mailing_graph_lease_lost_or_cancelled");
    }),
    { organizationId: sequence.organization_id, storeId: sequence.store_id, sequenceId: sequence.id },
  );
  return buildMailingCampaignGraph(deps, saver);
}

const graphConfig = (sequenceId: string) => ({
  configurable: { thread_id: sequenceId },
  maxConcurrency: MAILING_GRAPH_MAX_CONCURRENCY,
  recursionLimit: 100,
});

// Cola en memoria por campaña (ordena las ejecuciones de este proceso) mas un
// lease en la secuencia (excluye a otros procesos: otra replica de la API o el
// job del worker).
const running = new Map<string, Promise<unknown>>();
function serialize(sequenceId: string, task: () => Promise<unknown>) {
  const previous = running.get(sequenceId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  running.set(sequenceId, next);
  void next
    .catch((error) => logger.error("mailing_graph_run_failed", {
      sequence_id: sequenceId,
      error: error instanceof Error ? error.message : String(error),
    }))
    .finally(() => {
      if (running.get(sequenceId) === next) running.delete(sequenceId);
    });
  return next;
}

/** Cola del proceso + lease entre procesos. Si otro proceso tiene el hilo, no hace nada: el barrido lo recoge. */
function runExclusive(env: Env, sequenceId: string, task: (token: string) => Promise<unknown>) {
  return serialize(sequenceId, async () => {
    const supabase = serviceClient(env);
    const token = crypto.randomUUID();
    if (!(await mutateGraph(supabase, sequenceId, token, "claim"))) {
      logger.info("mailing_graph_lease_held", { sequence_id: sequenceId });
      return false;
    }
    const heartbeat = setInterval(() => {
      void mutateGraph(supabase, sequenceId, token, "renew").catch((error) =>
        logger.error("mailing_graph_renew_failed", { sequence_id: sequenceId, error: String(error) }));
    }, LEASE_RENEW_MS);
    heartbeat.unref();
    try {
      await task(token);
      return true;
    } finally {
      clearInterval(heartbeat);
      await mutateGraph(supabase, sequenceId, token, "release");
    }
  });
}

/** Con la campaña cerrada solo se conserva el ultimo checkpoint. */
async function pruneIfClosed(graph: MailingCampaignGraph, sequenceId: string) {
  const snapshot = await graph.getState({ configurable: { thread_id: sequenceId } });
  if (snapshot.next.length) return;
  await (graph.checkpointer as MailingCampaignCheckpointSaver).pruneKeepingLatest();
}

/**
 * Avanza el hilo: reanuda las pausas cuya decision ya esta registrada y, si un
 * proceso murio a mitad, continua desde el ultimo checkpoint.
 */
async function advance(env: Env, context: AuthContext, sequence: SequenceRow, token: string) {
  const deps = realDeps(env, context, sequence, token);
  const graph = graphFor(env, context, sequence, token, deps);
  const config = graphConfig(sequence.id);
  const snapshot = await graph.getState(config);
  if (!snapshot.next.length) {
    if (snapshot.values?.sequence_id) return;
    const bootstrap = mailingCampaignGraphStateSchema.omit({ results: true, closed: true }).safeParse(sequence.graph_bootstrap);
    if (!bootstrap.success) throw new Error("mailing_graph_bootstrap_missing");
    await graph.invoke(bootstrap.data, config);
    await pruneIfClosed(graph, sequence.id);
    return;
  }
  const pending = await listMailingInterrupts(graph, sequence.id);
  const resume: Record<string, unknown> = {};
  for (const item of pending) {
    const decided = item.value.kind === "approval"
      ? (await deps.readDecision(item.value.draft_id!)).status !== "pending_approval"
      : item.value.kind === "consultant_review"
        ? true
        : Boolean(await deps.readFailureDecision(item.value.sequence_number));
    if (decided) resume[item.id] = { sequence_number: item.value.sequence_number };
  }
  if (Object.keys(resume).length) {
    await graph.invoke(new Command({ resume }), config);
  } else if (snapshot.tasks.some((task) => !task.interrupts?.length)) {
    await graph.invoke(null, config);
  }
  await pruneIfClosed(graph, sequence.id);
}

export async function startMailingCampaign(
  env: Env,
  context: AuthContext,
  organizationId: string,
  sequenceId: string,
  body: { scheduled_for?: unknown; revision?: unknown },
) {
  if (!isMailingGraphEnabled(env, organizationId)) {
    return { ok: false as const, statusCode: 404, error: "mailing_graph_disabled" };
  }
  const supabase = serviceClient(env);
  const sequence = await loadSequence(supabase, organizationId, sequenceId);
  const access = authorizeMailingCampaign(context, organizationId, sequence);
  if (!access.ok) return access;
  const row = sequence!;
  if (body.revision !== row.revision) return { ok: false as const, statusCode: 409, error: "mailing_revision_conflict" };
  if (row.orchestrator === "graph") {
    return { ok: true as const, data: { sequence_id: row.id, status: row.status, already_started: true } };
  }
  if (row.status !== "planned") {
    return { ok: false as const, statusCode: 409, error: "mailing_campaign_not_planned" };
  }
  const parsedPlan = weeklyMailingPlanOutputSchema.safeParse(row.plan);
  if (!parsedPlan.success) return { ok: false as const, statusCode: 409, error: "mailing_campaign_plan_invalid" };
  const plan = parsedPlan.data;
  const resourceCheck = await verifyMailingResources(supabase, organizationId, row.request, row.store_id ?? undefined);
  if (!resourceCheck.ok) return resourceCheck;
  const contextCheck = await verifyMailingApprovalContext(supabase, organizationId, row.store_id!, row.request, row.context_snapshot);
  if (!contextCheck.ok) return contextCheck;
  const planEmails = [...(plan.emails ?? [])].sort((a, b) => a.sequence_number - b.sequence_number);
  const dates = Array.isArray(row.request.scheduled_for) ? row.request.scheduled_for : [];
  if (!planEmails.length || dates.length !== planEmails.length ||
    plan.decision && plan.decision !== "ready" ||
    !dates.every((value) => typeof value === "string" && Date.parse(value) > Date.now()) ||
    (body.scheduled_for !== undefined && JSON.stringify(body.scheduled_for) !== JSON.stringify(dates))) {
    return { ok: false as const, statusCode: 400, error: "mailing_campaign_schedule_invalid" };
  }
  const request = row.request as Record<string, string>;
  const images = Array.isArray(row.client_state?.selected_image_urls)
    ? (row.client_state.selected_image_urls as unknown[]).filter((url): url is string => typeof url === "string")
    : [];
  const emails: MailingEmailState[] = planEmails.map((email, index) => {
    const scheduledFor = new Date(Date.parse(dates[index] as string)).toISOString();
    return {
      sequence_number: email.sequence_number,
      title: String(email.title ?? `Email ${email.sequence_number}`).slice(0, 300),
      scheduled_for: scheduledFor,
      brief: buildWeeklyMailingEmailBrief({
        objective: request.objective ?? "",
        audience: request.audience ?? "",
        offer: request.offer ?? "",
        instructions: request.instructions ?? "",
        campaignName: request.campaign_name ?? "",
        plan: {
          ...plan,
          diagnosis: plan.diagnosis ?? "",
          sequence_rationale: plan.sequence_rationale ?? "",
          visual_direction: plan.visual_direction ?? "",
        },
        email: {
          title: email.title ?? "", angle: email.angle ?? "", objective: email.objective ?? "",
          audience: email.audience ?? "", subject_direction: email.subject_direction ?? "",
          preheader_direction: email.preheader_direction ?? "", cta: email.cta ?? "",
          copy_brief: email.copy_brief ?? "", visual_modules: email.visual_modules ?? "",
          evidence: email.evidence, source_refs: email.source_refs,
        },
        index,
        total: planEmails.length,
        scheduledDate: (row.request.scheduled_dates as string[])[index]!,
        timezone: String(row.request.timezone ?? "UTC"),
        revision: row.revision,
      }),
      image_url: images.length ? images[index % images.length]! : null,
      status: "queued",
      attempt: 0,
      draft_id: null,
      auto_review_passed: null,
      rejections: [],
      last_error: null,
      decided_by: null,
      decided_role: null,
    };
  });
  // La revisión del consultor es una opinión; no bloquea la decisión del cliente.
  const requiresConsultantReview = false;
  const bootstrap = { sequence_id: row.id, organization_id: organizationId, store_id: row.store_id,
    requires_consultant_review: requiresConsultantReview, emails };
  if (!mailingCampaignGraphStateSchema.omit({ results: true, closed: true }).safeParse(bootstrap).success) {
    return { ok: false as const, statusCode: 409, error: "mailing_campaign_bootstrap_invalid" };
  }
  const { data: claimed, error: claimError } = await supabase.rpc("approve_mailing_sequence", {
    p_organization_id: organizationId, p_sequence_id: row.id, p_revision: row.revision,
    p_actor_id: context.user.id, p_orchestrator: "graph", p_bootstrap: bootstrap,
  });
  if (claimError) return { ok: false as const, statusCode: 503, error: "mailing_campaign_claim_failed" };
  if (!claimed) return { ok: false as const, statusCode: 409, error: "mailing_campaign_already_started" };
  const started: SequenceRow = {
    ...row,
    status: "in_progress",
    orchestrator: "graph",
    graph_requires_consultant_review: requiresConsultantReview,
    graph_bootstrap: bootstrap,
  };
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "ai.start_mailing_campaign_graph",
    entityType: "marketing_mailing_sequence",
    entityId: row.id,
    newData: { emails: emails.length, actor_role: access.actor, requires_consultant_review: requiresConsultantReview },
  });
  void runExclusive(env, row.id, (token) => advance(env, context, started, token));
  return { ok: true as const, data: { sequence_id: row.id, status: "in_progress", already_started: false } };
}

const EMAIL_COLUMNS =
  "sequence_number, title, scheduled_for, status, attempt, draft_id, auto_review_passed, rejections, last_error, decided_role, updated_at, consultant_review_decision, failure_decision, marketing_content_drafts(subject, status)";

async function loadCampaignRows(supabase: SupabaseClient, organizationId: string, sequenceId: string) {
  const { data, error } = await supabase
    .from("marketing_mailing_campaign_emails")
    .select(EMAIL_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("sequence_id", sequenceId)
    .order("sequence_number", { ascending: true });
  if (error) return { ok: false as const };
  return { ok: true as const, rows: (data ?? []) as unknown as Array<Record<string, any>> };
}

/**
 * Hay trabajo que ninguna persona esta haciendo: una decision ya tomada que no
 * llego al grafo, un email detenido a mitad, o todos terminados sin cerrar la
 * campaña. Un email fallido sin decision espera a una persona, no esta parado.
 */
export function campaignNeedsResume(sequenceStatus: string, rows: Array<Record<string, any>>, now: number) {
  if (sequenceStatus !== "in_progress") return false;
  if (rows.length === 0) return true;
  const stale = (row: Record<string, any>) => now - Date.parse(row.updated_at) > MAILING_GRAPH_STALE_MS;
  const perEmail = rows.some((row) => {
    const draft = Array.isArray(row.marketing_content_drafts) ? row.marketing_content_drafts[0] : row.marketing_content_drafts;
    const waitingDecided =
      (row.status === "awaiting_approval" && draft && draft.status !== "pending_approval") ||
      row.status === "awaiting_consultant_review" ||
      (row.status === "failed" && row.failure_decision);
    const stuck = !isMailingEmailTerminal(row.status) &&
      !["awaiting_approval", "awaiting_consultant_review"].includes(row.status) &&
      stale(row);
    return Boolean(waitingDecided) || stuck;
  });
  const unclosed = sequenceStatus === "in_progress" && rows.length > 0 &&
    rows.every((row) => isMailingEmailTerminal(row.status) && !row.failure_decision && row.status !== "failed") &&
    rows.every(stale);
  return perEmail || unclosed;
}

export async function getMailingCampaign(
  env: Env,
  context: AuthContext,
  organizationId: string,
  sequenceId: string,
  requestedStoreId?: string | null,
): Promise<{ ok: true; data: MailingCampaignView } | Failure> {
  const supabase = serviceClient(env);
  const sequence = await loadSequence(supabase, organizationId, sequenceId);
  const access = authorizeMailingCampaign(context, organizationId, sequence, requestedStoreId);
  if (!access.ok) return access;
  const loaded = await loadCampaignRows(supabase, organizationId, sequenceId);
  if (!loaded.ok) return { ok: false, statusCode: 503, error: "mailing_campaign_load_failed" };
  const rows = loaded.rows;
  const needsResume = campaignNeedsResume(sequence!.status, rows, Date.now());
  const emails = rows.map((row: Record<string, any>) => {
    const draft = Array.isArray(row.marketing_content_drafts) ? row.marketing_content_drafts[0] : row.marketing_content_drafts;
    return {
      sequence_number: row.sequence_number,
      title: row.title,
      scheduled_for: row.scheduled_for,
      status: row.status,
      attempt: row.attempt,
      draft_id: row.draft_id,
      draft_subject: draft?.subject ?? null,
      auto_review_passed: row.auto_review_passed,
      rejections: row.rejections ?? [],
      last_error: row.last_error,
      decided_role: row.decided_role,
      consultant_review_decision: row.consultant_review_decision ?? null,
      updated_at: row.updated_at,
    };
  });
  return {
    ok: true,
    data: {
      sequence_id: sequenceId,
      campaign_name: String(sequence!.request?.campaign_name ?? ""),
      sequence_status: sequence!.status,
      timezone: String(sequence!.request?.timezone ?? "UTC"),
      orchestrator: sequence!.orchestrator === "graph" ? "graph" : "browser",
      requires_consultant_review: Boolean(sequence!.graph_requires_consultant_review) ||
        emails.some((email) => email.status === "awaiting_consultant_review"),
      needs_resume: needsResume && !running.has(sequenceId),
      emails,
    },
  };
}

/** "Reanudar" manual: decisiones que no llegaron al grafo o proceso caido. */
export async function resumeMailingCampaign(
  env: Env,
  context: AuthContext,
  organizationId: string,
  sequenceId: string,
) {
  if (!isMailingGraphEnabled(env, organizationId)) {
    return { ok: false as const, statusCode: 404, error: "mailing_graph_disabled" };
  }
  const supabase = serviceClient(env);
  const sequence = await loadSequence(supabase, organizationId, sequenceId);
  const access = authorizeMailingCampaign(context, organizationId, sequence);
  if (!access.ok) return access;
  if (sequence!.orchestrator !== "graph") {
    return { ok: false as const, statusCode: 409, error: "mailing_campaign_not_graph" };
  }
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "ai.resume_mailing_campaign_graph",
    entityType: "marketing_mailing_sequence",
    entityId: sequenceId,
    newData: { actor_role: access.actor },
  });
  void runExclusive(env, sequenceId, (token) => advance(env, context, sequence!, token));
  return { ok: true as const, data: { sequence_id: sequenceId, resuming: true } };
}

/**
 * Tras una decision por la ruta de borradores: si el borrador pertenece a una
 * campaña del grafo, la reanuda. Nunca lanza: la decision ya esta guardada.
 */
export async function advanceMailingCampaignForDraft(
  env: Env,
  context: AuthContext,
  organizationId: string,
  draftId: string,
) {
  try {
    if (!isMailingGraphEnabled(env, organizationId) || !UUID.test(draftId)) return;
    const supabase = serviceClient(env);
    const { data } = await supabase
      .from("marketing_mailing_campaign_emails")
      .select("sequence_id")
      .eq("organization_id", organizationId)
      .eq("draft_id", draftId)
      .maybeSingle();
    if (!data) return;
    const sequence = await loadSequence(supabase, organizationId, data.sequence_id as string);
    if (!sequence || sequence.orchestrator !== "graph") return;
    void runExclusive(env, sequence.id, (token) => advance(env, context, sequence, token));
  } catch (error) {
    logger.error("mailing_graph_advance_failed", {
      organization_id: organizationId,
      draft_id: draftId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Revision del consultor de un email que aprobo el cliente ("el cliente crea,
 * el consultor revisa"). Solo staff. Deja rastro en agent_approvals.
 */
export async function reviewMailingCampaignEmail(
  env: Env,
  context: AuthContext,
  organizationId: string,
  sequenceId: string,
  sequenceNumber: number,
  body: { decision?: unknown; reason?: unknown },
) {
  if (!isMailingGraphEnabled(env, organizationId)) {
    return { ok: false as const, statusCode: 404, error: "mailing_graph_disabled" };
  }
  const supabase = serviceClient(env);
  const sequence = await loadSequence(supabase, organizationId, sequenceId);
  const access = authorizeMailingCampaign(context, organizationId, sequence);
  if (!access.ok) return access;
  if (!isStaffActor(access.actor)) {
    return { ok: false as const, statusCode: 403, error: "consultant_review_staff_only" };
  }
  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false as const, statusCode: 400, error: "invalid_decision" };
  }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : "";
  if (decision === "rejected" && !reason) {
    return { ok: false as const, statusCode: 400, error: "reason_required" };
  }
  const { data: updated, error } = await supabase
    .from("marketing_mailing_campaign_emails")
    .update({
      consultant_review_decision: decision,
      consultant_review_reason: reason || null,
      consultant_reviewed_by: context.user.id,
      consultant_reviewed_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("sequence_id", sequenceId)
    .eq("sequence_number", sequenceNumber)
    .in("status", ["awaiting_consultant_review", "approved", "scheduled"])
    .is("consultant_review_decision", null)
    .select("draft_id")
    .maybeSingle();
  if (error) return { ok: false as const, statusCode: 503, error: "mailing_review_failed" };
  if (!updated) return { ok: false as const, statusCode: 409, error: "mailing_review_already_decided" };
  const draftId = updated.draft_id as string | null;
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: decision === "approved" ? "ai.review_mailing_email_approved" : "ai.review_mailing_email_rejected",
    entityType: "marketing_mailing_sequence",
    entityId: sequenceId,
    newData: { sequence_number: sequenceNumber, draft_id: draftId, actor_role: access.actor, reason: reason || null },
  });
  void runExclusive(env, sequenceId, (token) => advance(env, context, sequence!, token));
  return { ok: true as const, data: { sequence_id: sequenceId, sequence_number: sequenceNumber, decision } };
}


/**
 * Una persona decide que hacer con un email que fallo (A11 caido, presupuesto,
 * fallo al programar): reintentarlo o descartarlo. Sin esto el email se pierde y
 * la campaña no puede cerrarse.
 */
export async function decideFailedMailingEmail(
  env: Env,
  context: AuthContext,
  organizationId: string,
  sequenceId: string,
  sequenceNumber: number,
  body: { decision?: unknown },
) {
  if (!isMailingGraphEnabled(env, organizationId)) {
    return { ok: false as const, statusCode: 404, error: "mailing_graph_disabled" };
  }
  const supabase = serviceClient(env);
  const sequence = await loadSequence(supabase, organizationId, sequenceId);
  const access = authorizeMailingCampaign(context, organizationId, sequence);
  if (!access.ok) return access;
  const decision = mailingFailureDecisionSchema.safeParse(body.decision);
  if (!decision.success) return { ok: false as const, statusCode: 400, error: "invalid_decision" };
  const { data: updated, error } = await supabase
    .from("marketing_mailing_campaign_emails")
    .update({
      failure_decision: decision.data,
      failure_decided_by: context.user.id,
      failure_decided_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("sequence_id", sequenceId)
    .eq("sequence_number", sequenceNumber)
    .eq("status", "failed")
    .is("failure_decision", null)
    .select("draft_id")
    .maybeSingle();
  if (error) return { ok: false as const, statusCode: 503, error: "mailing_failure_decision_failed" };
  if (!updated) return { ok: false as const, statusCode: 409, error: "mailing_email_not_failed" };
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: decision.data === "retry" ? "ai.retry_mailing_email" : "ai.discard_mailing_email",
    entityType: "marketing_mailing_sequence",
    entityId: sequenceId,
    newData: { sequence_number: sequenceNumber, draft_id: updated.draft_id, actor_role: access.actor },
  });
  void runExclusive(env, sequenceId, (token) => advance(env, context, sequence!, token));
  return { ok: true as const, data: { sequence_id: sequenceId, sequence_number: sequenceNumber, decision: decision.data } };
}

/**
 * Job del worker: recoge las campañas que se quedaron paradas (la API se
 * reinicio a mitad, una decision no llego al grafo). Corre con el contexto de
 * plataforma, como el resto de motores autonomos, y respeta el lease: si la API
 * esta moviendo el hilo, lo deja.
 */
export async function getMailingDelivery(env: Env, context: AuthContext, organizationId: string, sequenceId: string) {
  const supabase = serviceClient(env);
  const sequence = await loadSequence(supabase, organizationId, sequenceId);
  const access = authorizeMailingCampaign(context, organizationId, sequence);
  if (!access.ok) return access;
  const [drafts, receipts] = await Promise.all([
    supabase.from("marketing_content_drafts").select("id, status, version, request, created_at", { count: "exact" })
      .eq("organization_id", organizationId).filter("request->mailing_sequence->>sequence_id", "eq", sequenceId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100),
    supabase.from("marketing_mailing_delivery_receipts").select("id, sequence_number, draft_id, draft_version, provider_message_id, provider_send_time, content_match_status")
      .eq("organization_id", organizationId).eq("sequence_id", sequenceId).eq("revision", sequence!.revision)
      .order("linked_at", { ascending: false }).limit(100),
  ]);
  if (drafts.error || receipts.error) return { ok: false as const, statusCode: 503, error: "mailing_delivery_load_failed" };
  const emails = (sequence!.plan.emails ?? []) as Array<{ sequence_number: number; title: string }>;
  return { ok: true as const, data: { revision: sequence!.revision, approved: Boolean(sequence!.approved_at), timezone: String(sequence!.request.timezone ?? "UTC"),
    drafts_truncated: (drafts.count ?? 0) > (drafts.data?.length ?? 0),
    emails: emails.map((email) => {
      const draft = drafts.data?.find((item) => {
        const request = item.request as Record<string, any>;
        return request?.mailing_sequence?.revision === sequence!.revision && request.mailing_sequence.email_number === email.sequence_number;
      });
      return { ...email, draft_id: draft?.id ?? null, draft_version: draft?.version ?? null, draft_status: draft?.status ?? null,
        observation: mailingObservationReadiness(sequence!.plan, receipts.data?.find((receipt) => receipt.sequence_number === email.sequence_number)?.provider_send_time ?? null),
        receipts: receipts.data?.filter((receipt) => receipt.sequence_number === email.sequence_number).map((receipt) => ({ ...receipt,
          observation: mailingObservationReadiness(sequence!.plan, receipt.provider_send_time) })) ?? [] };
    }),
  } };
}

export async function listMailingDeliveryCandidates(
  env: Env, context: AuthContext, organizationId: string, sequenceId: string, afterId?: string,
) {
  const supabase = serviceClient(env);
  const sequence = await loadSequence(supabase, organizationId, sequenceId);
  const access = authorizeMailingCampaign(context, organizationId, sequence);
  if (!access.ok) return access;
  if (afterId && !UUID.test(afterId)) return { ok: false as const, statusCode: 400, error: "mailing_delivery_cursor_invalid" };
  if (!sequence!.approved_at) return { ok: true as const, data: { candidates: [], next_cursor: null } };
  let query = supabase.from("klaviyo_campaign_messages")
    .select("id, subject, sent_at, klaviyo_campaigns!inner(name, send_time, status, klaviyo_accounts!inner(store_id, is_active, integration_connections!inner(status)))")
    .eq("organization_id", organizationId).eq("channel", "email")
    .eq("klaviyo_campaigns.klaviyo_accounts.store_id", sequence!.store_id)
    .eq("klaviyo_campaigns.klaviyo_accounts.is_active", true)
    .in("klaviyo_campaigns.klaviyo_accounts.integration_connections.status", ["connected", "syncing"])
    .in("klaviyo_campaigns.status", ["Sent", "sent", "SENT"])
    .gte("klaviyo_campaigns.send_time", sequence!.approved_at)
    .lte("klaviyo_campaigns.send_time", new Date().toISOString())
    .order("id", { ascending: true }).limit(51);
  if (afterId) query = query.gt("id", afterId);
  const { data, error } = await query;
  if (error) return { ok: false as const, statusCode: 503, error: "mailing_delivery_candidates_failed" };
  const rows = (data ?? []).slice(0, 50);
  const one = (value: any) => Array.isArray(value) ? value[0] : value;
  return { ok: true as const, data: { candidates: rows.map((row) => {
    const campaign = one(row.klaviyo_campaigns);
    return { id: row.id, subject: row.subject, campaign_name: campaign?.name ?? "Email",
      sent_at: row.sent_at ?? campaign?.send_time ?? null };
  }), next_cursor: (data?.length ?? 0) > 50 ? rows.at(-1)!.id : null } };
}

export async function linkMailingDelivery(
  env: Env, context: AuthContext, organizationId: string, sequenceId: string, number: number,
  body: { revision?: unknown; draft_id?: unknown; draft_version?: unknown; message_id?: unknown },
) {
  if (!Number.isSafeInteger(number) || number < 1 || number > 7 ||
    ![body.revision, body.draft_id, body.message_id].every((value) => typeof value === "string" && UUID.test(value)) ||
    typeof body.draft_version !== "number" || !Number.isSafeInteger(body.draft_version) || body.draft_version < 1) {
    return { ok: false as const, statusCode: 400, error: "mailing_delivery_invalid" };
  }
  const supabase = serviceClient(env);
  const sequence = await loadSequence(supabase, organizationId, sequenceId);
  const access = authorizeMailingCampaign(context, organizationId, sequence);
  if (!access.ok) return access;
  const { data, error } = await supabase.rpc("link_mailing_delivery", {
    p_organization_id: organizationId, p_sequence_id: sequenceId, p_revision: body.revision, p_number: number,
    p_draft_id: body.draft_id, p_draft_version: body.draft_version, p_message_id: body.message_id, p_actor: context.user.id,
  });
  if (error || !data) return { ok: false as const, statusCode: error?.code === "P0001" || error?.code === "23505" ? 409 : 503, error: "mailing_delivery_link_failed" };
  await recordAuditLog(supabase, { organizationId, actorUserId: context.user.id, action: "ai.mailing_delivery_linked",
    entityType: "marketing_mailing_sequence", entityId: sequenceId,
    newData: { sequence_number: number, draft_id: body.draft_id, draft_version: body.draft_version,
      provider_message_id: body.message_id, content_match_status: "unverified" } });
  return { ok: true as const, data };
}

export async function resumeStalledMailingCampaigns(env: LoadedApiEnv) {
  const supabase = serviceClient(env);
  const { data: sequences, error } = await supabase
    .from("marketing_mailing_sequences")
    .select("id, organization_id, store_id, status, orchestrator, request, plan, client_state, graph_requires_consultant_review, revision, graph_bootstrap, context_snapshot")
    .eq("orchestrator", "graph")
    .eq("status", "in_progress")
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);
  if (error) throw new Error(`mailing_sweep_load_failed: ${error.message}`);
  const summary = { checked: 0, resumed: 0, skipped: 0, failed: 0 };
  let platform: AuthContext | null = null;
  for (const sequence of (sequences ?? []) as unknown as SequenceRow[]) {
    summary.checked += 1;
    if (!isMailingGraphEnabled(env, sequence.organization_id)) {
      summary.skipped += 1;
      continue;
    }
    try {
      const loaded = await loadCampaignRows(supabase, sequence.organization_id, sequence.id);
      if (!loaded.ok || !campaignNeedsResume(sequence.status, loaded.rows, Date.now())) {
        summary.skipped += 1;
        continue;
      }
      if (!platform) {
        const built = await buildPlatformAdminContext(env);
        if (!built.ok) throw new Error(built.error);
        platform = built.context;
      }
      const resumed = await runExclusive(env, sequence.id, (token) => advance(env, platform!, sequence, token));
      if (resumed) summary.resumed += 1;
      else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error("mailing_sweep_resume_failed", {
        sequence_id: sequence.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return summary;
}
