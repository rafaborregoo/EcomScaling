"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue, organizationStatusTone } from "@/lib/display-labels";
import { PlanEditor } from "@/components/concesion-de-plan";
import { VerComoButton } from "@/components/ver-como-button";
import {
  Badge,
  Button,
  ErrorBlock,
  Field,
  Input,
  SearchableSelect,
  Select,
  DataTable,
  type DataTableColumn,
  Card,
  CardContent,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui";
export type AgentUsage = { name: string; runs: number };
export type AiStats = {
  cost_usd: number;
  run_count: number;
  top_agents: AgentUsage[];
};

export type AssignedOrg = {
  organization_id: string;
  display_name: string;
  is_primary: boolean;
  status: string;
};

export type Plan = {
  plan_code: string;
  store_limit: number | null;
  member_limit: number | null;
  status: string;
  ends_at: string | null;
};

export type Consultant = {
  id: string;
  full_name: string | null;
  is_active: boolean;
  assignments: AssignedOrg[];
  ai: AiStats;
  consulting_organization_id: string | null;
  plan: Plan | null;
};

export type OrganizationOption = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
};

export type ConsultantsPayload = {
  window_days: number;
  consultants: Consultant[];
  organizations: OrganizationOption[];
  organization_stats: Record<string, AiStats>;
};

export function formatCost(usd: number) {
  return `$${usd.toFixed(usd > 0 && usd < 1 ? 4 : 2)}`;
}

export function topAgentsLabel(agents: AgentUsage[]) {
  if (agents.length === 0) {
    return "—";
  }
  return agents.map((agent) => `${agent.name} (${agent.runs})`).join(", ");
}

export function AssignmentEditor({
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

  const clientColumns: DataTableColumn<AssignedOrg & { id: string }>[] = [
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
      key: "status",
      label: "Estado",
      render: (row) => (
        <Badge tone={organizationStatusTone(row.status)}>
          {displayValue(row.status)}
        </Badge>
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
        <div className="flex justify-end gap-2">
          <VerComoButton
            organizationId={row.organization_id}
            displayName={row.display_name}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={busyOrgId === row.organization_id}
            onClick={() => void setAssignment(row.organization_id, false)}
          >
            {busyOrgId === row.organization_id ? "Quitando..." : "Quitar"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardKicker>{`Clientes · últimos ${windowDays} días`}</CardKicker>
        <CardTitle>{consultant.full_name ?? consultant.id}</CardTitle>
      </CardHeader>
      <CardContent>
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

          {consultant.consulting_organization_id ? (
            <PlanEditor
              subjectType="organization"
              subjectId={consultant.consulting_organization_id}
              plan={consultant.plan}
              onSaved={onChanged}
            />
          ) : null}

          <DataTable
            ariaLabel={`Clientes de ${consultant.full_name ?? consultant.id}`}
            columns={clientColumns}
            rows={consultant.assignments.map((assignment) => ({
              ...assignment,
              id: assignment.organization_id,
            }))}
            emptyLabel="Sin clientes asignados."
          />

          <div className="flex flex-wrap items-end gap-3 border-t border-separator pt-4">
            <SearchableSelect
              className="w-64"
              aria-label="Cliente a asignar"
              placeholder="Busca un cliente"
              emptyText="No hay ningún cliente sin asignar con ese nombre."
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
      </CardContent>
    </Card>
  );
}

