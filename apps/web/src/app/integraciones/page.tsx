"use client";

import { useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import { timeAgo } from "@/lib/elapsed";
import { useCachedQuery } from "@/lib/use-cached-query";
import { EmptyState, ErrorBlock, LoadingBlock, ProviderIcon } from "@/components/ui";
import { DataQualityPanel } from "./data-quality-panel";
import { IntegrationsHub } from "./hub";
import { hasIntegrationAttention, integrationStatusTone } from "./consultant-view-model";
import s from "./hub.module.css";

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

const SIGNAL = { danger: "bad", warn: "warn", success: "ok", neutral: "off" } as const;

function CellStatus({ status, lastSync }: { status: string; lastSync?: string | null }) {
  const when = timeAgo(lastSync);
  return (
    <span className={s.st} data-s={SIGNAL[integrationStatusTone(status)]} title={when ? `Último dato ${when}` : undefined}>
      <i aria-hidden />
      {displayValue(status)}
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

  return (
    <div className={s.hub}>
      <header className={s.band}>
        <div>
          <h1>{organizationId ? "Integraciones · cliente" : "Integraciones · cartera"}</h1>
          <p>
            {organizationId
              ? "Solo lectura. Las cuentas se conectan o reautorizan desde la sesión del cliente."
              : `${data.portfolio.length} clientes · ${issueCount} con alguna integración por arreglar`}
          </p>
        </div>
      </header>

      <section>
        <div className={s.filters}>
          <button type="button" className={s.chip} aria-pressed={!onlyIssues} onClick={() => setOnlyIssues(false)}>
            Todos
          </button>
          <button type="button" className={s.chip} aria-pressed={onlyIssues} onClick={() => setOnlyIssues(true)}>
            Con incidencias · {issueCount}
          </button>
          {organizationId ? null : (
            <input className={s.search} type="search" placeholder="Buscar cliente…" aria-label="Buscar cliente" value={query} onChange={(event) => setQuery(event.target.value)} />
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={onlyIssues ? "Ninguna integración con incidencias" : "Sin clientes"}
            hint={onlyIssues ? "Toda la cartera con las integraciones al día." : "Cuando se te asigne un cliente aparecerá aquí."}
          />
        ) : (
          <div className={s.map}>
            <table className={s.table}>
              <caption className="sr-only">Estado de cada integración por cliente.</caption>
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  {data.providers.map((provider) => (
                    <th scope="col" key={provider}>
                      <span className={s.pair}>
                        <ProviderIcon provider={provider} size={14} />
                        {displayValue(provider)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.organization_id}>
                    <th scope="row">{row.display_name}</th>
                    {data.providers.map((provider) => {
                      const cell = row.providers[provider];
                      return <td key={provider}>{cell ? <CellStatus status={cell.status} lastSync={cell.last_sync_at} /> : <span className={s.muted}>—</span>}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {organizationId ? (
        <section>
          <div className={s.secHead}>
            <h2>Cuentas conectadas</h2>
          </div>
          {connections.length === 0 ? (
            <EmptyState title="No hay conexiones activas registradas" hint="Entra con el usuario del cliente para conectar sus aplicaciones." />
          ) : (
            <div className={s.map}>
              <table className={s.table}>
                <caption className="sr-only">Cuentas conectadas del cliente</caption>
                <thead>
                  <tr>
                    <th scope="col">Aplicación</th>
                    <th scope="col">Cuenta</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Último dato</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((connection, index) => (
                    <tr key={`${connection.provider}:${connection.account_name ?? index}`}>
                      <th scope="row">
                        <span className={s.pair}>
                          <ProviderIcon provider={connection.provider} size={16} />
                          {displayValue(connection.provider)}
                        </span>
                      </th>
                      <td>{connection.account_name ?? "Cuenta"}</td>
                      <td>
                        <CellStatus status={connection.status} />
                      </td>
                      <td>{timeAgo(connection.last_sync_at) ?? "Sin sincronización"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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

function IntegrationsRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  // useIntegrations resuelve la organización contra membresías propias y
  // descarta la organización de cliente seleccionada en el shell consultor.
  if (bootstrap.profile.platform_role === "platform_admin") {
    return <PlatformAdminIntegrationsRouter />;
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
