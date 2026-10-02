import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resumen del camino de cada tienda ("ruta"): lo que pintan la vista general
 * del cliente con varias tiendas y la de caminos del consultor. Una ruta por
 * tienda Shopify activa, más el camino general de la organización (sin tienda)
 * cuando existe. Nada se calcula en el navegador: fases, estado de cada hito,
 * hito en curso, tareas de la semana y el último seguimiento semanal.
 *
 * Quien llama ya ha comprobado el acceso a `organizationIds`; por eso se lee
 * con el cliente de servicio acotado a esos ids.
 */

export type RouteStop = "done" | "current" | "late" | "pending" | "locked";

type PhaseRow = { id: string; plan_id: string; name: string; status: string; position: number };
type MilestoneRow = { id: string; phase_id: string; name: string; status: string; position: number; target_date: string | null };

const CLOSED = ["completed", "skipped"];
const PLAN_RANK: Record<string, number> = { active: 3, completed: 2, draft: 1 };
const DAY_MS = 86_400_000;

export function buildCaminoRoute(phasesIn: PhaseRow[], milestonesIn: MilestoneRow[], today: string) {
  const phases = phasesIn.slice().sort((a, b) => a.position - b.position);
  const active = phases.find((phase) => phase.status === "active") ?? null;
  const byPhase = (phaseId: string) =>
    milestonesIn.filter((m) => m.phase_id === phaseId).sort((a, b) => a.position - b.position);
  const activeMilestones = active ? byPhase(active.id) : [];
  const focus =
    activeMilestones.find((m) => m.status === "in_progress") ??
    activeMilestones.find((m) => !CLOSED.includes(m.status)) ??
    null;
  const isLate = (m: MilestoneRow) => Boolean(m.target_date && m.target_date < today);

  const focusCode = focus && active ? `${phases.indexOf(active) + 1}.${activeMilestones.indexOf(focus) + 1}` : null;
  let late = 0;
  const routePhases = phases.map((phase) => ({
    name: phase.name,
    status: phase.status,
    stops: byPhase(phase.id).map((m): RouteStop => {
      if (CLOSED.includes(m.status) || phase.status === "completed") return "done";
      if (phase.status !== "active") return "locked";
      if (isLate(m)) late += 1;
      if (m.id === focus?.id) return isLate(m) ? "late" : "current";
      return isLate(m) ? "late" : "pending";
    }),
  }));

  const all = phases.flatMap((phase) => byPhase(phase.id));
  const days = focus?.target_date
    ? Math.round((Date.parse(`${focus.target_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
    : null;
  return {
    phases: routePhases,
    focus: focus ? { code: focusCode, name: focus.name, target_date: focus.target_date, days } : null,
    late_milestones: late,
    milestones_done: all.filter((m) => CLOSED.includes(m.status)).length,
    milestones_total: all.length,
  };
}

export type CaminoRoute = {
  organization_id: string;
  store_id: string | null;
  connection_id: string | null;
  store_name: string | null;
  plan:
    | (ReturnType<typeof buildCaminoRoute> & {
        id: string;
        name: string;
        status: string;
        goal: Record<string, unknown> | null;
        week_tasks: number;
        review: { summary: string; observed: number | null; expected: number | null; period_end: string } | null;
      })
    | null;
};

export async function loadCaminoRoutes(
  service: SupabaseClient,
  organizationIds: string[],
  today = new Date().toISOString().slice(0, 10),
): Promise<{ ok: true; routes: CaminoRoute[] } | { ok: false; detail: string }> {
  if (organizationIds.length === 0) return { ok: true, routes: [] };

  const [storesResult, plansResult] = await Promise.all([
    service.from("shopify_stores").select("id, organization_id, shop_name, connection_id").in("organization_id", organizationIds).eq("is_active", true),
    service.from("strategic_plans").select("id, organization_id, store_id, name, status, version, goal").in("organization_id", organizationIds).neq("status", "archived"),
  ]);
  if (storesResult.error || plansResult.error) {
    return { ok: false, detail: (storesResult.error ?? plansResult.error)!.message };
  }

  // Plan vigente por (organización, tienda): mejor estado y, a igualdad, la
  // versión más alta. Mismo criterio que el resto de vistas del camino.
  const current = new Map<string, Record<string, unknown>>();
  for (const plan of plansResult.data ?? []) {
    const key = `${plan.organization_id}|${plan.store_id ?? ""}`;
    const prev = current.get(key);
    const rank = PLAN_RANK[plan.status as string] ?? 0;
    const prevRank = prev ? (PLAN_RANK[prev.status as string] ?? 0) : -1;
    if (!prev || rank > prevRank || (rank === prevRank && Number(plan.version) > Number(prev.version))) current.set(key, plan);
  }
  const planIds = [...current.values()].map((plan) => plan.id as string);
  const connectionIds = (storesResult.data ?? []).map((store) => store.connection_id).filter(Boolean) as string[];

  const safe = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const [phasesResult, reviewsResult, connectionsResult] = await Promise.all([
    service.from("strategic_plan_phases").select("id, plan_id, name, status, position").in("plan_id", safe(planIds)),
    service
      .from("strategic_plan_weekly_reviews")
      .select("plan_id, period_end, created_at, agent_outputs(output)")
      .in("plan_id", safe(planIds))
      .eq("status", "succeeded")
      .order("created_at", { ascending: false }),
    service.from("integration_connections").select("id, provider_account_name").in("id", safe(connectionIds)),
  ]);
  if (phasesResult.error || reviewsResult.error || connectionsResult.error) {
    return { ok: false, detail: (phasesResult.error ?? reviewsResult.error ?? connectionsResult.error)!.message };
  }
  const phases = (phasesResult.data ?? []) as PhaseRow[];

  const milestonesResult = await service
    .from("strategic_plan_milestones")
    .select("id, phase_id, name, status, position, target_date")
    .in("phase_id", safe(phases.map((phase) => phase.id)));
  if (milestonesResult.error) return { ok: false, detail: milestonesResult.error.message };
  const milestones = (milestonesResult.data ?? []) as MilestoneRow[];

  const linksResult = await service
    .from("milestone_task_links")
    .select("milestone_id, tasks(status, due_at)")
    .in("milestone_id", safe(milestones.map((m) => m.id)));
  if (linksResult.error) return { ok: false, detail: linksResult.error.message };

  const weekEnd = new Date(Date.parse(`${today}T00:00:00Z`) + 8 * DAY_MS).toISOString();
  const openThisWeek = new Map<string, number>();
  for (const link of linksResult.data ?? []) {
    const relation = link.tasks as unknown as { status: string; due_at: string | null } | Array<{ status: string; due_at: string | null }> | null;
    const task = Array.isArray(relation) ? relation[0] : relation;
    if (!task || !["pending", "in_progress"].includes(task.status) || !task.due_at || task.due_at >= weekEnd) continue;
    openThisWeek.set(link.milestone_id as string, (openThisWeek.get(link.milestone_id as string) ?? 0) + 1);
  }

  const latestReview = new Map<string, Record<string, unknown>>();
  for (const review of reviewsResult.data ?? []) {
    if (!latestReview.has(review.plan_id as string)) latestReview.set(review.plan_id as string, review);
  }
  const accountName = new Map((connectionsResult.data ?? []).map((row) => [row.id as string, row.provider_account_name as string | null]));

  const summarize = (plan: Record<string, unknown> | undefined): CaminoRoute["plan"] => {
    if (!plan) return null;
    const planPhases = phases.filter((phase) => phase.plan_id === plan.id);
    const phaseIds = new Set(planPhases.map((phase) => phase.id));
    const planMilestones = milestones.filter((m) => phaseIds.has(m.phase_id));
    const review = latestReview.get(plan.id as string);
    const relation = review?.agent_outputs as unknown as { output?: Record<string, unknown> } | Array<{ output?: Record<string, unknown> }> | null;
    const output = (Array.isArray(relation) ? relation[0] : relation)?.output as
      | { executive_summary?: string; goal_progress?: { observed_value?: number | null; expected_value?: number | null } }
      | undefined;
    return {
      id: plan.id as string,
      name: plan.name as string,
      status: plan.status as string,
      goal: (plan.goal as Record<string, unknown> | null) ?? null,
      ...buildCaminoRoute(planPhases, planMilestones, today),
      week_tasks: planMilestones.reduce((sum, m) => sum + (openThisWeek.get(m.id) ?? 0), 0),
      review: output?.executive_summary
        ? {
            summary: output.executive_summary,
            observed: output.goal_progress?.observed_value ?? null,
            expected: output.goal_progress?.expected_value ?? null,
            period_end: review!.period_end as string,
          }
        : null,
    };
  };

  const routes: CaminoRoute[] = [];
  for (const organizationId of organizationIds) {
    const stores = (storesResult.data ?? []).filter((store) => store.organization_id === organizationId);
    const general = current.get(`${organizationId}|`);
    // Sin tiendas: la organización se representa con su camino general (o sin
    // camino), para que no desaparezca de la vista.
    if (general || stores.length === 0) {
      routes.push({ organization_id: organizationId, store_id: null, connection_id: null, store_name: null, plan: summarize(general) });
    }
    for (const store of stores) {
      routes.push({
        organization_id: organizationId,
        store_id: store.id as string,
        connection_id: (store.connection_id as string | null) ?? null,
        store_name: accountName.get(store.connection_id as string) ?? (store.shop_name as string | null) ?? null,
        plan: summarize(current.get(`${organizationId}|${store.id}`)),
      });
    }
  }
  return { ok: true, routes };
}
