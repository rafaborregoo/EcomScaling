"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import {
  AREA_LABEL,
  useProposedTasks,
  type ProposedTasksClient,
} from "@/components/ai-proposed-tasks";
import { apiFetch } from "@/lib/bootstrap";
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBlock,
  Heading,
  List,
  LoadingBlock,
  toast,
} from "@/components/ui";
import type { BootstrapResponse } from "@/lib/bootstrap";

/**
 * Sin cliente activo esta página era una tarjeta muerta con un "Volver al
 * dashboard". Pero las propuestas de los agentes se acumulan por cliente y
 * nadie las ve hasta entrar tienda por tienda: la pregunta es "¿dónde hay algo
 * esperando decisión?", y el endpoint que lo responde ya existía.
 */
function ProposalsPortfolio() {
  const { setOrganizationId } = useActiveOrganization();
  const { clients, error } = useProposedTasks();

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!clients)
    return <LoadingBlock label="Buscando propuestas sin decidir…" />;

  const pending = clients
    .map((client) => ({
      ...client,
      pendingTasks: client.tasks.filter((task) => task.pending_approval),
    }))
    .filter((client) => client.pendingTasks.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <Heading>Decisiones del consultor IA</Heading>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Lo que los agentes han propuesto en toda la cartera y sigue sin
          decidir.
        </p>
      </div>

      <Card
        title="Propuestas esperando decisión"
        description="Ordenadas por cuánta atención necesita el cliente, no por antigüedad."
        actions={
          pending.length > 0 ? (
            <Badge tone="warn">{pending.length} clientes</Badge>
          ) : undefined
        }
      >
        {pending.length === 0 ? (
          <EmptyState
            title="Nada pendiente de decidir"
            hint="Cuando un agente proponga trabajo en cualquier cliente, aparecerá aquí."
          />
        ) : (
          <List as="ul">
            {pending.map(
              (
                client: ProposedTasksClient & {
                  pendingTasks: typeof client.tasks;
                },
              ) => (
                <List.Item
                  as="li"
                  key={client.organization_id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {client.display_name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {client.pendingTasks[0]?.title}
                      {client.pendingTasks.length > 1
                        ? ` · y ${client.pendingTasks.length - 1} más`
                        : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap gap-1">
                    {[
                      ...new Set(client.pendingTasks.map((task) => task.area)),
                    ].map((area) => (
                      <Badge key={area}>{AREA_LABEL[area]}</Badge>
                    ))}
                  </span>
                  <Badge tone="warn">{client.pendingTasks.length}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setOrganizationId(client.organization_id);
                      toast.success(`Ahora ves ${client.display_name}`);
                    }}
                  >
                    Revisar
                  </Button>
                </List.Item>
              ),
            )}
          </List>
        )}
      </Card>
    </div>
  );
}

/** Cuánto hay ya en el calendario, para no aprobar trabajo encima de trabajo. */
function CalendarLoad({ organizationId }: { organizationId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void apiFetch(`/v1/organizations/${organizationId}/campaign-planning`)
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as {
          items?: Array<{ starts_at: string; status: string }>;
        };
        const now = Date.now();
        const horizon = now + 30 * 86_400_000;
        setCount(
          (payload.items ?? []).filter((item) => {
            const at = Date.parse(item.starts_at);
            return (
              !["completed", "cancelled"].includes(item.status) &&
              at >= now &&
              at <= horizon
            );
          }).length,
        );
      })
      .catch(() => {
        // Es contexto, no un requisito para decidir.
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (count === null) return null;
  return (
    <Banner tone={count > 0 ? "success" : "warn"} className="text-sm">
      {count > 0 ? (
        <>
          Ya hay <strong>{count} acciones</strong> planificadas para los
          próximos 30 días. Apruébalo sabiendo lo que ya está comprometido.
        </>
      ) : (
        <>
          No hay nada planificado en los próximos 30 días: lo que apruebes aquí
          será el plan.
        </>
      )}
    </Banner>
  );
}

function RecommendationsContent({
  bootstrap,
}: {
  bootstrap: BootstrapResponse;
}) {
  const { organizationId } = useActiveOrganization();
  const consultant = ["consultant", "platform_admin"].includes(
    bootstrap.profile.platform_role,
  );
  if (!consultant)
    return (
      <Card
        title="Recomendaciones del consultor IA"
        description="Esta vista es interna del consultor."
      >
        <ButtonLink href="/dashboard">Volver al dashboard</ButtonLink>
      </Card>
    );
  if (!organizationId) return <ProposalsPortfolio />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Decisiones del consultor IA</Heading>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            La IA cruza los datos conectados y propone el siguiente trabajo. El
            consultor revisa y aprueba antes de crear tareas.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/planificacion" variant="secondary">
            Resumen
          </ButtonLink>
          <ButtonLink href="/planificacion/calendario" variant="secondary">
            Calendario
          </ButtonLink>
        </div>
      </div>

      <CalendarLoad organizationId={organizationId} />

      <AiDiagnosticSection
        organizationId={organizationId}
        title="Plan de acciones IA"
        getPath="/ai/task-planner"
        runPath="/ai/task-planner-run"
        loadingLabel="Analizando datos de las plataformas…"
        tasksLabelSingular="acción"
        days={30}
      />
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <PortalShell title="Recomendaciones IA">
      {(bootstrap) => <RecommendationsContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
