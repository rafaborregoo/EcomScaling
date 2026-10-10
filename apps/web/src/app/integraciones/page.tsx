"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import { timeAgo } from "@/lib/elapsed";
import { useCachedQuery } from "@/lib/use-cached-query";
import { Badge, Button, Card, EmptyState, ErrorBlock, Input, LoadingBlock, ProviderIcon, Table } from "@/components/ui";
import { DataQualityPanel } from "./data-quality-panel";
import { IntegrationsHub } from "./hub";
import { hasIntegrationAttention } from "./consultant-view-model";
import { CONNECTION_STATES, stateFromStatus } from "./store-view-model";

// --- Vista de administración: matriz cliente × proveedor -----------------

type IntegrationCell = {
  status: string;
  last_sync_at: string | null;
  last_error_message: string | null;
};
type ConsultantIntegrationsData = {
  providers: string[];
  portfolio: Array<{
    organization_id: string;
    display_name: string;
    providers: Record<string, IntegrationCell>;
    connections?: Array<{
      provider: string;
      account_name: string | null;
      status: string;
      last_sync_at: string | null;
    }>;
  }>;
};

function CellStatus({ status, lastSync }: { status: string; lastSync?: string | null }) {
  const when = timeAgo(lastSync);
  const state = CONNECTION_STATES[stateFromStatus(status)];
  return (
    <span title={when ? `Último dato ${when}` : undefined}>
      <Badge tone={state.tone}>{state.label}</Badge>
    </span>
  );
}

function ProviderName({ provider, size = 14 }: { provider: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <ProviderIcon provider={provider} size={size} />
      {displayValue(provider)}
    </span>
  );
}

function AdminClientIntegrationsView({ organizationId }: { organizationId?: string }) {
  const integrationsQuery = useCachedQuery<ConsultantIntegrationsData>(
    organizationId ? `/v1/consultant/integrations?organizationId=${encodeURIComponent(organizationId)}` : "/v1/consultant/integrations",
  );
  const data = integrationsQuery.data;
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [query, setQuery] = useState("");

  if (integrationsQuery.isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando integraciones de la cartera..." />
      </div>
    );
  }
  if (integrationsQuery.error) {
    return (
      <div className="portal-page">
        <ErrorBlock>No se pudieron cargar las integraciones de la cartera. Revisa la conexión e inténtalo de nuevo.</ErrorBlock>
      </div>
    );
  }
  if (!data) return null;

  const rowHasIssue = (row: ConsultantIntegrationsData["portfolio"][number]) =>
    Object.values(row.providers).some((cell) => hasIntegrationAttention(cell.status));
  const issueCount = data.portfolio.filter(rowHasIssue).length;
  const needle = query.trim().toLowerCase();
  const rows = data.portfolio.filter((row) => (!onlyIssues || rowHasIssue(row)) && (!needle || row.display_name.toLowerCase().includes(needle)));
  const connections = organizationId ? (data.portfolio[0]?.connections ?? []) : [];

  type Row = ConsultantIntegrationsData["portfolio"][number] & { id: string };
  const tableRows: Row[] = rows.map((row) => ({ ...row, id: row.organization_id }));
  type ConnectionRow = (typeof connections)[number] & { id: string };
  const connectionRows: ConnectionRow[] = connections.map((connection, index) => ({
    ...connection,
    id: `${connection.provider}:${connection.account_name ?? index}`,
  }));

  return (
    <div className="portal-page space-y-6">
      <p className="text-sm text-muted">
        {organizationId
          ? "Solo lectura. Las cuentas se conectan o reautorizan desde la sesión del cliente."
          : `${data.portfolio.length} clientes · ${issueCount} con alguna integración por arreglar`}
      </p>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={onlyIssues ? "secondary" : "primary"} aria-pressed={!onlyIssues} onClick={() => setOnlyIssues(false)}>
            Todos
          </Button>
          <Button size="sm" variant={onlyIssues ? "primary" : "secondary"} aria-pressed={onlyIssues} onClick={() => setOnlyIssues(true)}>
            Con incidencias · {issueCount}
          </Button>
          {organizationId ? null : (
            <Input
              className="ml-auto w-full sm:w-64"
              type="search"
              placeholder="Buscar cliente…"
              aria-label="Buscar cliente"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={onlyIssues ? "Ninguna integración con incidencias" : "Sin clientes"}
            hint={onlyIssues ? "Toda la cartera con las integraciones al día." : "Cuando se te asigne un cliente aparecerá aquí."}
          />
        ) : (
          <Table<Row>
            ariaLabel="Estado de cada integración por cliente"
            rows={tableRows}
            columns={[
              { key: "display_name", label: "Cliente", render: (row) => <span className="font-medium">{row.display_name}</span> },
              ...data.providers.map((provider) => ({
                key: provider,
                label: displayValue(provider),
                render: (row: Row) => {
                  const cell = row.providers[provider];
                  return cell ? <CellStatus status={cell.status} lastSync={cell.last_sync_at} /> : <span className="text-muted">—</span>;
                },
              })),
            ]}
          />
        )}
      </Card>

      {organizationId ? (
        <Card title="Cuentas conectadas">
          {connections.length === 0 ? (
            <EmptyState title="No hay conexiones activas registradas" hint="Entra con el usuario del cliente para conectar sus aplicaciones." />
          ) : (
            <Table<ConnectionRow>
              ariaLabel="Cuentas conectadas del cliente"
              rows={connectionRows}
              columns={[
                { key: "provider", label: "Aplicación", render: (row) => <ProviderName provider={row.provider} size={16} /> },
                { key: "account_name", label: "Cuenta", render: (row) => row.account_name ?? "Cuenta" },
                { key: "status", label: "Estado", render: (row) => <CellStatus status={row.status} /> },
                { key: "last_sync_at", label: "Último dato", render: (row) => timeAgo(row.last_sync_at) ?? "Sin sincronización" },
              ]}
            />
          )}
        </Card>
      ) : (
        <DataQualityPanel />
      )}
    </div>
  );
}

function PlatformAdminIntegrationsRouter() {
  const { organizationId } = useActiveOrganization();
  return <AdminClientIntegrationsView organizationId={organizationId ?? undefined} />;
}

// Consultor sin tienda propia: el modulo no esta en su menu (las conexiones
// de sus clientes las conecta cada cliente). Si llega por un enlace viejo, en
// vez de un error se le lleva a Tiendas, donde puede crear la suya.
function NoOwnStore() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/tiendas");
  }, [router]);
  return (
    <div className="portal-page">
      <EmptyState
        title="Integraciones es para tus tiendas propias"
        hint="Las conexiones de tus clientes las gestiona cada cliente; su estado lo ves en Clientes. Te llevamos a Tiendas para crear la tuya."
      />
    </div>
  );
}

function IntegrationsRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  // useIntegrations resuelve la organización contra membresías propias y
  // descarta la organización de cliente seleccionada en el shell consultor.
  if (bootstrap.profile.platform_role === "platform_admin") {
    return <PlatformAdminIntegrationsRouter />;
  }
  const hasOwnStore = bootstrap.memberships.some((membership) => membership.accessSource !== "consultant_assignment");
  if (bootstrap.profile.platform_role === "consultant" && !hasOwnStore) {
    return <NoOwnStore />;
  }
  return <IntegrationsHub bootstrap={bootstrap} />;
}

export default function IntegrationsPage() {
  return (
    <PortalShell title="Integraciones">
      {(bootstrap) => <IntegrationsRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
