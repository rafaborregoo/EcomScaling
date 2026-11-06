import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { requireOperationalOrganization, type AuthContext } from "./auth-context.js";
import { authorizeAgentOutputScope } from "./agent-output-authorization.js";

/**
 * Una propuesta de la IA, de solo lectura y con todo el detalle: que agente
 * la hizo y cuando, que proponia cada tarea y por que (con sus cifras), quien
 * decidio, que decidio con cada una y por que. Es el destino del aviso
 * «X ha descartado N propuestas de la IA» (docs/AUDITORIA_NOTIFICACIONES.md),
 * que antes llevaba a una lista sin rastro de la propuesta.
 */

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

const str = (value: unknown, max = 2000) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

const SUMMARY_KEYS = ["summary", "executive_summary", "headline", "diagnosis_summary", "overview"];

export type ProposalStatus = "created" | "retired" | "rejected" | "skipped" | "failed" | "pending";

export async function getAgentOutputDetail(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  outputId: string,
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false && !context.storeMemberships?.some((item) => item.organization_id === organizationId)) return access;

  const supabase = createServiceClient(env);
  const { data: output, error } = await supabase
    .from("agent_outputs")
    .select("id, status, created_at, output, run_id")
    .eq("id", outputId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "agent_output_load_failed", detail: error.message };
  if (!output) return { ok: false as const, statusCode: 404, error: "agent_output_not_found" };

  const { data: run, error: runError } = await supabase
      .from("agent_runs")
      .select("organization_id, store_id, objective, started_at, agent_versions(agent_definitions(code, name, description))")
      .eq("id", output.run_id)
      .eq("organization_id", organizationId)
      .maybeSingle();
  if (runError) return { ok: false as const, statusCode: 503, error: "approval_scope_unavailable" };
  if (!run) return { ok: false as const, statusCode: 404, error: "agent_output_not_found" };

  const versions = (run as { agent_versions?: unknown } | null)?.agent_versions;
  const version = (Array.isArray(versions) ? versions[0] : versions) as
    | { agent_definitions?: { code?: string; name?: string; description?: string | null } | Array<{ code?: string; name?: string; description?: string | null }> }
    | undefined;
  const definitionRaw = version?.agent_definitions;
  const definition = Array.isArray(definitionRaw) ? definitionRaw[0] : definitionRaw;
  const outputAccess = authorizeAgentOutputScope(context, organizationId, {
    organization_id: run.organization_id, store_id: run.store_id ?? null,
    agent_code: definition?.code ?? null, objective: run.objective ?? null,
  });
  if (!outputAccess.ok) return outputAccess;
  const { data: approval, error: approvalError } = await supabase.from("agent_approvals")
    .select("id, decision, decided_by, reason, reason_category, decided_at, decision_context")
    .eq("organization_id", organizationId).eq("output_id", outputId).maybeSingle();
  if (approvalError) return { ok: false as const, statusCode: 503, error: "approval_receipt_unavailable" };

  const body = (output.output ?? {}) as Record<string, unknown>;
  const writes = Array.isArray(body.proposed_writes) ? (body.proposed_writes as Array<Record<string, unknown>>) : [];
  const decisions = new Map<number, Record<string, unknown>>();
  for (const item of Array.isArray(body.proposal_decisions) ? (body.proposal_decisions as Array<Record<string, unknown>>) : []) {
    if (Number.isInteger(item.index)) decisions.set(Number(item.index), item);
  }
  const skippedBeforeDecision = new Set(
    (Array.isArray(body.proposal_edits) ? (body.proposal_edits as Array<Record<string, unknown>>) : [])
      .filter((edit) => edit.skip === true && Number.isInteger(edit.index))
      .map((edit) => Number(edit.index)),
  );

  const taskIds = [...decisions.values()].map((item) => item.task_id).filter((id): id is string => typeof id === "string");
  let taskQuery = taskIds.length ? supabase.from("tasks").select("id, title, status").in("id", taskIds).eq("organization_id", organizationId) : null;
  if (taskQuery && run.store_id) taskQuery = taskQuery.eq("store_id", run.store_id);
  const { data: tasks, error: taskError } = taskQuery ? await taskQuery : { data: [], error: null };
  if (taskError) return { ok: false as const, statusCode: 503, error: "proposal_tasks_unavailable" };
  const taskById = new Map((tasks ?? []).map((task) => [task.id as string, task]));

  const proposals = writes.map((write, index) => {
    const decision = decisions.get(index);
    const rawStatus = String(decision?.status ?? decision?.decision ?? "");
    const status: ProposalStatus =
      rawStatus === "created" || rawStatus === "link_failed"
        ? "created"
        : rawStatus === "retired" ? "retired" : rawStatus === "rejected"
          ? "rejected"
          : rawStatus === "skipped" || decision?.decision === "skipped" || skippedBeforeDecision.has(index)
            ? "skipped"
            : rawStatus === "failed"
              ? "failed"
              : output.status === "rejected"
                ? "rejected"
                : "pending";
    const taskId = typeof decision?.task_id === "string" ? decision.task_id : null;
    const evidence = (Array.isArray(write.evidence) ? write.evidence : []).flatMap((item: unknown) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      const label = str(row?.label, 120);
      const value = str(row?.value, 120);
      return label && value ? [{ label, value, period: str(row?.period, 60), source: str(row?.source, 60) }] : [];
    });
    return {
      index,
      kind: write.kind === "note" ? "note" : "task",
      title: str(decision?.title, 255) ?? str(write.title, 255) ?? "Propuesta sin título",
      original_title: str(write.title, 255),
      description: str(decision?.description) ?? str(write.description),
      rationale: str(write.rationale),
      priority: str(decision?.priority, 20) ?? str(write.priority, 20),
      completion_criteria: str(write.completion_criteria, 500),
      expected_metric: str(write.expected_metric, 240),
      due_hint: str(write.due_hint, 100),
      owner_role: write.owner_role === "cliente" || write.owner_role === "consultor" ? write.owner_role : null,
      evidence,
      status,
      task: taskId ? (taskById.get(taskId) ?? null) : null,
      note_id: typeof decision?.note_id === "string" ? decision.note_id : null,
    };
  });

  const approvalRow = approval as Record<string, unknown> | null;
  let decidedBy: { name: string | null; side: "client" | "consultant" } | null = null;
  const decidedById = typeof approvalRow?.decided_by === "string" ? approvalRow.decided_by : null;
  if (decidedById) {
    const [{ data: profile }, { data: member }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", decidedById).maybeSingle(),
      supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("user_id", decidedById)
        .eq("is_active", true)
        .maybeSingle(),
    ]);
    const receiptContext = approvalRow?.decision_context as { actor_side?: unknown } | null;
    decidedBy = { name: (profile?.full_name as string | null) ?? null,
      side: receiptContext?.actor_side === "client" || receiptContext?.actor_side === "consultant"
        ? receiptContext.actor_side : member ? "client" : "consultant" };
  }

  return {
    ok: true as const,
    data: {
      id: output.id,
      status: output.status as string,
      created_at: output.created_at as string,
      agent: {
        name: definition?.name ?? null,
        description: definition?.description ?? null,
      },
      summary: SUMMARY_KEYS.map((key) => str(body[key], 4000)).find(Boolean) ?? null,
      decision: approvalRow
        ? {
            receipt_id: approvalRow.id,
            source_verified: Boolean(approvalRow.decision_context && typeof approvalRow.decision_context === "object" &&
              (approvalRow.decision_context as Record<string, unknown>).version === "agent-decision-v1"),
            decision: String(approvalRow.decision),
            decided_at: (approvalRow.decided_at as string | null) ?? null,
            decided_by: decidedBy,
            reason: str(approvalRow.reason, 1000),
            reason_category: str(approvalRow.reason_category, 40),
          }
        : null,
      proposals,
    },
  };
}
