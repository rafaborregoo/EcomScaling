"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { Heading, Badge, Button, ErrorBlock, Input, LoadingBlock, ProgressBar, Textarea } from "@/components/ui";

type Milestone = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  status: string;
  target_date: string | null;
  completed_at: string | null;
  milestone_task_links: Array<{ task_id: string }>;
};

type Phase = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  status: string;
  activated_at: string | null;
  completed_at: string | null;
  strategic_plan_milestones: Milestone[];
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  starts_on: string | null;
  completed_on: string | null;
  strategic_plan_phases: Phase[];
};

type PlanResponse = {
  organization_id: string;
  plan: Plan | null;
};

const PHASE_STATUS_LABELS: Record<string, string> = {
  locked: "Bloqueada",
  pending: "Pendiente",
  active: "Activa",
  completed: "Completada",
};

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  locked: "Bloqueado",
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completado",
  skipped: "Omitido",
};

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; detail?: string }
    | null;
  return [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - ");
}

function PlanContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const organization =
    bootstrap.memberships.find((membership) => membership.organization_id === selectedOrganizationId)
      ?.organization ?? bootstrap.memberships[0]?.organization ?? null;
  const membership = bootstrap.memberships.find(
    (item) => item.organization_id === (organization?.id ?? ""),
  );
  const canManage =
    ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role) ||
    ["owner", "manager"].includes(membership?.role ?? "");

  const [payload, setPayload] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planOutline, setPlanOutline] = useState("");

  const loadPlan = useCallback(async () => {
    if (!organization) {
      return;
    }

    setIsLoading(true);
    const response = await apiFetch(`/v1/organizations/${organization.id}/strategic-plan`);

    if (!response.ok) {
      setError(await readApiError(response));
      setIsLoading(false);
      return;
    }

    setPayload((await response.json()) as PlanResponse);
    setError(null);
    setIsLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organization) {
      return;
    }

    // Formato del esquema: una linea "Fase: nombre" abre fase; el resto son hitos.
    const phases: Array<{ name: string; milestones: Array<{ name: string }> }> = [];

    for (const rawLine of planOutline.split("\n")) {
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      if (/^fase\s*:/i.test(line)) {
        phases.push({ name: line.replace(/^fase\s*:/i, "").trim(), milestones: [] });
      } else if (phases.length > 0) {
        phases[phases.length - 1].milestones.push({ name: line.replace(/^[-*]\s*/, "") });
      }
    }

    setIsSubmitting(true);
    setError(null);

    const response = await apiFetch(`/v1/organizations/${organization.id}/strategic-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: planName, phases }),
    });

    if (!response.ok) {
      setError(await readApiError(response));
      setIsSubmitting(false);
      return;
    }

    setPlanName("");
    setPlanOutline("");
    setIsSubmitting(false);
    void loadPlan();
  }

  async function activatePlan(planId: string) {
    if (!organization) {
      return;
    }

    const response = await apiFetch(
      `/v1/organizations/${organization.id}/strategic-plan/${planId}/activate`,
      { method: "POST" },
    );

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    void loadPlan();
  }

  async function changeMilestone(milestoneId: string, status: string) {
    if (!organization) {
      return;
    }

    const response = await apiFetch(
      `/v1/organizations/${organization.id}/milestones/${milestoneId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    void loadPlan();
  }

  const plan = payload?.plan ?? null;
  const phases = (plan?.strategic_plan_phases ?? []).slice().sort((a, b) => a.position - b.position);
  const totalMilestones = phases.reduce((sum, phase) => sum + phase.strategic_plan_milestones.length, 0);
  const doneMilestones = phases.reduce(
    (sum, phase) =>
      sum +
      phase.strategic_plan_milestones.filter((m) => ["completed", "skipped"].includes(m.status)).length,
    0,
  );

  return (
    <div className="space-y-4">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {isLoading ? (
        <LoadingBlock label="Cargando plan..." />
      ) : plan ? (
        <>
          <section className="border-t border-ink/20 pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-brand">
                  v{plan.version} · {plan.status}
                </p>
                <h2 className="mt-1 text-lg font-semibold">{plan.name}</h2>
                {plan.description ? (
                  <p className="mt-1 text-sm leading-6 text-muted">{plan.description}</p>
                ) : null}
              </div>
              {plan.status === "draft" && canManage ? (
                <Button type="button" onClick={() => void activatePlan(plan.id)}>
                  Activar plan
                </Button>
              ) : null}
            </div>
            {totalMilestones > 0 ? (
              <ProgressBar
                className="mt-4"
                value={(doneMilestones / totalMilestones) * 100}
                aria-label="Progreso del plan"
              >
                <div className="flex justify-between text-xs text-muted">
                  <span>Progreso</span>
                  <span className="font-mono">
                    {doneMilestones}/{totalMilestones} hitos
                  </span>
                </div>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            ) : null}
          </section>

          {phases.map((phase) => (
            <section key={phase.id} className="border-t border-ink/20">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <Heading level={3} size="md">
                  Fase {phase.position}: {phase.name}
                </Heading>
                <Badge tone={phase.status === "active" ? "brand" : phase.status === "completed" ? "success" : "neutral"}>
                  {PHASE_STATUS_LABELS[phase.status] ?? phase.status}
                </Badge>
              </div>
              <div className="divide-y divide-line">
                {phase.strategic_plan_milestones
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p
                          className={[
                            "text-sm",
                            ["completed", "skipped"].includes(milestone.status)
                              ? "text-muted line-through"
                              : "",
                          ].join(" ")}
                        >
                          {milestone.name}
                        </p>
                        <p className="font-mono text-xs text-muted">
                          {MILESTONE_STATUS_LABELS[milestone.status] ?? milestone.status}
                          {milestone.target_date ? ` · objetivo ${milestone.target_date}` : ""}
                          {milestone.milestone_task_links.length
                            ? ` · ${milestone.milestone_task_links.length} tareas`
                            : ""}
                        </p>
                      </div>
                      {canManage && ["pending", "in_progress"].includes(milestone.status) ? (
                        <div className="flex gap-2">
                          {milestone.status === "pending" ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={() => void changeMilestone(milestone.id, "in_progress")}
                            >
                              Empezar
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            type="button"
                            onClick={() => void changeMilestone(milestone.id, "completed")}
                          >
                            Completar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <section className="border-t border-ink/20 pt-5">
          <Heading size="lg">Sin plan estratégico</Heading>
          <p className="mt-1 text-sm leading-6 text-muted">
            {canManage
              ? "Crea el primer plan: escribe el nombre y el esquema de fases e hitos."
              : "Tu consultor todavia no ha publicado un plan para esta organización."}
          </p>
          {canManage ? (
            <form className="mt-4 space-y-3" onSubmit={createPlan}>
              <Input
                aria-label="Nombre del plan"
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                placeholder="Nombre del plan (p. ej. Escalar a 50k/mes)"
                required
              />
              <Textarea
                className="h-48 font-mono"
                aria-label="Esquema de fases e hitos"
                value={planOutline}
                onChange={(event) => setPlanOutline(event.target.value)}
                placeholder={"Fase: Fundamentos\n- Configurar costes y gastos fijos\n- Cargar costes de producto\nFase: Adquisicion\n- Conectar Meta Ads\n- Definir presupuesto inicial"}
                required
              />
              <p className="text-xs text-muted">
                Formato: cada linea &quot;Fase: nombre&quot; abre una fase; las lineas siguientes son sus hitos.
              </p>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear plan en borrador"}
              </Button>
            </form>
          ) : null}
        </section>
      )}
    </div>
  );
}

function StrategicPlanPageContent() {
  return (
    <PortalShell title="Mi Camino">
      {(bootstrap) => <PlanContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}

export default function StrategicPlanPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando Mi Camino..." />}>
      <StrategicPlanPageContent />
    </Suspense>
  );
}
