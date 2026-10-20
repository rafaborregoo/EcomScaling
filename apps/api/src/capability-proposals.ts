import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { findDelegatedAnalysisSteps } from "@e-nora/ai";
import { createLogger } from "@e-nora/observability";
import { type AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";

const logger = createLogger("capability-proposals");

/**
 * Bandeja de capacidades de la IA (/admin/tools).
 *
 * Tres entradas y una tabla (`agent_capability_proposals`, una fila por
 * necesidad que suma repeticiones):
 *  - `propose_capability`: el agente pide una función SQL o un dato.
 *  - `analysis_gap` del detallador del Camino: el cálculo que una tarea
 *    necesita y E-NORA aún no da.
 *  - El detector de análisis delegado: tareas cuyos pasos piden al cliente
 *    comparar o calcular con datos que E-NORA ya tiene.
 *
 * Nada de esto bloquea al agente: es la cola del platform_admin para decidir
 * qué cálculo se convierte en función.
 */

type CapabilityEnv = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY?: string };

export type CapabilityProposalInput = {
  kind: "sql_function" | "missing_data" | "delegated_analysis";
  slug: string;
  title: string;
  need: string;
  benefit?: string | null;
  sqlDraft?: string | null;
  example?: string | null;
};

export async function recordCapabilityProposal(
  supabase: SupabaseClient,
  runId: string,
  input: CapabilityProposalInput,
) {
  const { data, error } = await supabase.rpc("record_agent_capability_proposal", {
    target_run_id: runId,
    proposal_kind: input.kind,
    proposal_slug: input.slug,
    proposal_title: input.title,
    proposal_need: input.need,
    proposal_benefit: input.benefit ?? null,
    proposal_sql_draft: input.sqlDraft ?? null,
    proposal_example: input.example ?? null,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) {
    logger.error("capability_proposal_record_failed", {
      run_id: runId,
      slug: input.slug,
      message: error?.message?.slice(0, 240) ?? "no_row",
    });
    return null;
  }
  return row as { id: string; occurrences: number; status: string };
}

/** "Contribución por pedido de cada alternativa…" -> "contribucion_por_pedido_de_cada_alternativa". */
export function capabilitySlug(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .split("_")
    .slice(0, 8)
    .join("_")
    .slice(0, 80);
  return slug.length >= 3 ? slug : "calculo_sin_nombre";
}

type TaskText = { title: string; description: string };

/** Tareas de cualquier contrato: `proposed_writes` (genérico) o `tasks` (Camino). */
export function collectTaskTexts(value: unknown, out: TaskText[] = []): TaskText[] {
  if (Array.isArray(value)) {
    for (const item of value) collectTaskTexts(item, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((key === "proposed_writes" || key === "tasks") && Array.isArray(child)) {
      for (const item of child) {
        const task = item as Record<string, unknown> | null;
        if (task && typeof task.description === "string" && (task.kind === undefined || task.kind !== "note")) {
          out.push({ title: typeof task.title === "string" ? task.title : "", description: task.description });
        }
      }
    }
    collectTaskTexts(child, out);
  }
  return out;
}

/**
 * Registra cada tarea que delega análisis al cliente. `source` separa al
 * detallador del Camino del resto: comparte agente (A19) pero es otro prompt.
 */
export async function recordDelegatedAnalysis(
  supabase: SupabaseClient,
  runId: string,
  source: string,
  output: unknown,
) {
  for (const task of collectTaskTexts(output)) {
    const steps = findDelegatedAnalysisSteps(task.description);
    if (!steps.length) continue;
    await recordCapabilityProposal(supabase, runId, {
      kind: "delegated_analysis",
      slug: capabilitySlug(`analisis_delegado_${source}`),
      title: `Tareas que piden al cliente calcular (${source})`,
      need: "Pasos de tarea que piden comparar, calcular o estimar con datos que E-NORA ya tiene. Se corrige en el prompt del agente o dándole la función que le falta.",
      example: `${task.title}: ${steps.join(" | ")}`,
    });
  }
}

// --- Bandeja del platform_admin -------------------------------------------

function requirePlatformAdmin(context: AuthContext) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
      message: "Solo un platform admin puede ver la bandeja de la IA.",
    };
  }
  return { ok: true as const };
}

function createServiceClient(env: CapabilityEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const STATUSES = ["pending", "accepted", "rejected", "done"] as const;
type ProposalStatus = (typeof STATUSES)[number];

export async function listCapabilityProposals(env: CapabilityEnv, context: AuthContext) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const { data, error } = await createServiceClient(env)
    .from("agent_capability_proposals")
    .select("id, slug, kind, title, need, benefit, sql_draft, status, occurrences, agent_codes, organization_ids, examples, first_seen_at, last_seen_at, decided_at, decision_note")
    .order("occurrences", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(200);
  if (error) {
    return { ok: false as const, statusCode: 500, error: "capability_proposals_load_failed", detail: error.message };
  }
  return {
    ok: true as const,
    data: {
      proposals: (data ?? []).map(({ organization_ids, ...row }) => ({
        ...row,
        organization_count: Array.isArray(organization_ids) ? organization_ids.length : 0,
      })),
    },
  };
}

export async function decideCapabilityProposal(
  env: CapabilityEnv,
  context: AuthContext,
  proposalId: string,
  body: { status?: unknown; note?: unknown },
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proposalId)) {
    return { ok: false as const, statusCode: 404, error: "capability_proposal_not_found" };
  }
  if (!STATUSES.includes(body.status as ProposalStatus)) {
    return { ok: false as const, statusCode: 400, error: "invalid_status" };
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 1000) : null;

  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .from("agent_capability_proposals")
    .update({
      status: body.status as ProposalStatus,
      decision_note: note,
      decided_by: context.user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", proposalId)
    .select("id, slug, status")
    .maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "capability_proposal_update_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "capability_proposal_not_found" };

  await recordAuditLog(supabase, {
    organizationId: null,
    actorUserId: context.user.id,
    action: "ai.capability_proposal.decide",
    entityType: "agent_capability_proposal",
    entityId: data.id,
    newData: { slug: data.slug, status: data.status, note },
  });
  return { ok: true as const, data };
}
