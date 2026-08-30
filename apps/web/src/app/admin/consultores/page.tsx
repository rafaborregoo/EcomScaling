"use client";

import { useCallback, useEffect, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AsyncState,
  Badge,
  BarChart,
  Button,
  Card,
  ErrorBlock,
  EYEBROW,
  Select,
  Table,
  type TableColumnDef,
} from "@/components/ui";

type AgentUsage = { name: string; runs: number };
type AiStats = {
  cost_usd: number;
  run_count: number;
  top_agents: AgentUsage[];
};

type AssignedOrg = {
  organization_id: string;
  display_name: string;
  is_primary: boolean;
};

type Consultant = {
  id: string;
  full_name: string | null;
  is_active: boolean;
  assignments: AssignedOrg[];
  ai: AiStats;
};

type OrganizationOption = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
};

type ConsultantsPayload = {
  window_days: number;
  consultants: Consultant[];
  organizations: OrganizationOption[];
  organization_stats: Record<string, AiStats>;
};

function formatCost(usd: number) {
  return `$${usd.toFixed(usd > 0 && usd < 1 ? 4 : 2)}`;
}

function topAgentsLabel(agents: AgentUsage[]) {
  if (agents.length === 0) {
    return "—";
  }
  return agents.map((agent) => `${agent.name} (${agent.runs})`).join(", ");
}

function ConsultantsPanel() {
  const [data, setData] = useState<ConsultantsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/v1/admin/consultants");
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setData((await response.json()) as ConsultantsPayload);
      setError(null);
    } catch {
      setError("No se pudieron cargar los consultores. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading && !data) {
    return <AsyncState status="loading" loadingLabel="Cargando consultores..." />;
  }

  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }

  if (!data) {
    return null;
  }

  const columns: TableColumnDef<Consultant>[] = [
    {
      key: "full_name",
      label: "Consultor",
      render: (row) => row.full_name ?? row.id,
    },
    {
      key: "is_active",
      label: "Estado",
      render: (row) => (
        <Badge tone={row.is_active ? "success" : "neutral"}>
          {row.is_active ? "activo" : "inactivo"}
        </Badge>
      ),
    },
    {
      key: "clients",
      label: "Clientes",
      render: (row) => String(row.assignments.length),
    },
    {
      key: "cost",
      label: "Coste IA",
      render: (row) => formatCost(row.ai.cost_usd),
    },
    {
      key: "runs",
      label: "Ejecuciones",
      render: (row) => String(row.ai.run_count),
    },
    {
      key: "agents",
      label: "Agentes más usados",
      render: (row) => (
        <span className="text-xs text-muted">
          {topAgentsLabel(row.ai.top_agents)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            setExpandedId((current) => (current === row.id ? null : row.id))
          }
        >
          {expandedId === row.id ? "Cerrar" : "Ver clientes"}
        </Button>
      ),
    },
  ];

  const expanded = data.consultants.find(
    (consultant) => consultant.id === expandedId,
  );

  // El gráfico solo aporta comparando: 2+ consultores y algún coste real.
  const costChartData = data.consultants
    .filter((consultant) => consultant.ai.cost_usd > 0)
    .sort((a, b) => b.ai.cost_usd - a.ai.cost_usd)
    .map((consultant) => ({
      name: consultant.full_name ?? consultant.id,
      cost: Number(consultant.ai.cost_usd.toFixed(2)),
    }));

  return (
    <div className="grid gap-6">
      <Card
        kicker="Panel platform admin"
        title="Consultores"
        description={`Uso de IA y clientes por consultor. Ventana: últimos ${data.window_days} días.`}
      >
        {costChartData.length >= 2 ? (
          <div className="mb-6">
            <p className={EYEBROW}>Coste IA por consultor (USD)</p>
            <div className="mt-2">
              <BarChart
                data={costChartData}
                xKey="name"
                series={[{ key: "cost", label: "Coste IA" }]}
                horizontal
                height={Math.max(120, costChartData.length * 40)}
                valueFormatter={formatCost}
              />
            </div>
          </div>
        ) : null}

        <Table
          ariaLabel="Consultores"
          columns={columns}
          rows={data.consultants}
          emptyLabel="No hay consultores todavía."
        />
      </Card>

      {expanded ? (
        <AssignmentEditor
          consultant={expanded}
          organizations={data.organizations}
          organizationStats={data.organization_stats}
          windowDays={data.window_days}
          onChanged={load}
        />
      ) : null}
    </div>
  );
}

function AssignmentEditor({
  consultant,
  organizations,
  organizationStats,
  windowDays,
  onChanged,
}: {
  consultant: Consultant;
  organizations: OrganizationOption[];
  organizationStats: Record<string, AiStats>;
  windowDays: number;
  onChanged: () => Promise<void>;
}) {
  const [pendingOrgId, setPendingOrgId] = useState("");
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(
    consultant.assignments.map((assignment) => assignment.organization_id),
  );
  const unassigned = organizations.filter((org) => !assignedIds.has(org.id));

  async function setAssignment(organizationId: string, isActive: boolean) {
    setBusyOrgId(organizationId);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/assignments`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultant_user_id: consultant.id,
            is_active: isActive,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setPendingOrgId("");
      await onChanged();
    } catch {
      setError("No se pudo guardar el cambio. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusyOrgId(null);
    }
  }

  const clientColumns: TableColumnDef<AssignedOrg & { id: string }>[] = [
    {
      key: "display_name",
      label: "Cliente",
      render: (row) => (
        <span className="font-medium">
          {row.display_name}
          {row.is_primary ? (
            <Badge tone="brand" className="ml-2">
              principal
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: "cost",
      label: "Coste IA",
      render: (row) =>
        formatCost(organizationStats[row.organization_id]?.cost_usd ?? 0),
    },
    {
      key: "runs",
      label: "Ejecuciones",
      render: (row) =>
        String(organizationStats[row.organization_id]?.run_count ?? 0),
    },
    {
      key: "agents",
      label: "Agentes más usados",
      render: (row) => (
        <span className="text-xs text-muted">
          {topAgentsLabel(organizationStats[row.organization_id]?.top_agents ?? [])}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          disabled={busyOrgId === row.organization_id}
          onClick={() => void setAssignment(row.organization_id, false)}
        >
          {busyOrgId === row.organization_id ? "Quitando..." : "Quitar"}
        </Button>
      ),
    },
  ];

  return (
    <Card
      kicker={`Clientes · últimos ${windowDays} días`}
      title={consultant.full_name ?? consultant.id}
    >
      <div className="grid gap-4">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}

        <Table
          ariaLabel={`Clientes de ${consultant.full_name ?? consultant.id}`}
          columns={clientColumns}
          rows={consultant.assignments.map((assignment) => ({
            ...assignment,
            id: assignment.organization_id,
          }))}
          emptyLabel="Sin clientes asignados."
        />

        <div className="flex flex-wrap items-end gap-3 border-t border-separator pt-4">
          <Select
            className="w-64"
            aria-label="Cliente a asignar"
            placeholder="Elegir cliente..."
            value={pendingOrgId}
            onChange={setPendingOrgId}
            options={unassigned.map((org) => ({
              value: org.id,
              label: org.display_name,
            }))}
          />
          <Button
            size="sm"
            disabled={!pendingOrgId || busyOrgId === pendingOrgId}
            onClick={() => void setAssignment(pendingOrgId, true)}
          >
            Asignar cliente
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function AdminConsultoresPage() {
  return (
    <PlatformAdminShell title="Consultores">
      {() => <ConsultantsPanel />}
    </PlatformAdminShell>
  );
}
