"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Heading,
  List,
  LoadingBlock,
  toast,
} from "@/components/ui";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { StatusStrip } from "@/components/trabajo-ui";

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
      <Heading>Recomendaciones IA · cartera</Heading>

      <Card
        title="Propuestas esperando decisión"
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
    <StatusStrip
      items={[
        {
          value: count,
          label: "Acciones ya planificadas · 30 días",
          tone: count ? undefined : "warn",
        },
      ]}
    />
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
  const router = useRouter();
  // Vista interna del consultor: el cliente vuelve a su agenda.
  useEffect(() => {
    if (!consultant) router.replace("/planificacion/calendario");
  }, [consultant, router]);
  if (!consultant) return null;
  if (!organizationId) return <ProposalsPortfolio />;

  return (
    <div className="space-y-6">
      <Heading>Recomendaciones IA</Heading>

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
