"use client";

import { useState } from "react";
import { useCachedQuery } from "@/lib/use-cached-query";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AsyncState,
  Badge,
  Banner,
  BarChart,
  Button,
  Card,
  ErrorBlock,
  EYEBROW,
  Field,
  Input,
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
  const {
    data,
    error: loadError,
    isLoading,
    reload: load,
  } = useCachedQuery<ConsultantsPayload>("/v1/admin/consultants");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActive(consultant: Consultant) {
    setBusyId(consultant.id);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(`/v1/admin/consultants/${consultant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !consultant.is_active }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNotice(
        consultant.is_active
          ? "Consultor desactivado."
          : "Consultor reactivado.",
      );
      load();
    } catch {
      setError("No se pudo cambiar el estado. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvite(consultant: Consultant) {
    setBusyId(consultant.id);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(
        `/v1/admin/consultants/${consultant.id}/resend-invite`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNotice("Invitación reenviada por email.");
    } catch {
      setError("No se pudo reenviar la invitación. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando consultores..." />;
  }

  if (loadError && !data) {
    return <ErrorBlock>{loadError}</ErrorBlock>;
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
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === row.id}
            onClick={() => void toggleActive(row)}
          >
            {row.is_active ? "Desactivar" : "Reactivar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyId === row.id}
            onClick={() => void resendInvite(row)}
          >
            Reenviar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setExpandedId((current) => (current === row.id ? null : row.id))
            }
          >
            {expandedId === row.id ? "Cerrar" : "Ver clientes"}
          </Button>
        </div>
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
      <ConsultantCreateForm
        onCreated={async (msg) => {
          setNotice(msg);
          load();
        }}
      />

      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

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
                height={Math.min(280, Math.max(88, costChartData.length * 30))}
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
  onChanged: () => void;
}) {
  const [pendingOrgId, setPendingOrgId] = useState("");
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(consultant.full_name ?? "");
  const [savingName, setSavingName] = useState(false);

  async function saveName() {
    setSavingName(true);
    setError(null);
    try {
      const response = await apiFetch(`/v1/admin/consultants/${consultant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      onChanged();
    } catch {
      setError("No se pudo guardar el nombre. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setSavingName(false);
    }
  }

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
      onChanged();
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

        <div className="flex flex-wrap items-end gap-3 border-b border-separator pb-4">
          <Field label="Nombre del consultor">
            <Input
              className="w-64"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Button
            size="sm"
            disabled={savingName || name.trim().length === 0}
            onClick={() => void saveName()}
          >
            {savingName ? "Guardando..." : "Guardar nombre"}
          </Button>
        </div>

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

function ConsultantCreateForm({
  onCreated,
}: {
  onCreated: (message: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/v1/admin/consultants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          full_name: fullName || undefined,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setEmail("");
      setFullName("");
      await onCreated(`Invitación enviada por email a ${email}.`);
    } catch {
      setError("No se pudo invitar al consultor. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return (
    <Card
      kicker="Alta"
      title="Nuevo consultor"
      description="Invita a un consultor por email. Entra con su cuenta y paga su cuota al acceder."
    >
      <div className="grid gap-4">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="consultor@empresa.com"
            />
          </Field>
          <Field label="Nombre (opcional)">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre Apellido"
            />
          </Field>
        </div>
        <div>
          <Button disabled={!canSubmit || busy} onClick={() => void submit()}>
            {busy ? "Invitando..." : "Invitar consultor"}
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
