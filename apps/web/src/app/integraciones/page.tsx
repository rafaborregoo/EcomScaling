"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import { readApiError } from "@/lib/api-error";
import { ModuleSummary } from "@/components/module-summary";
import { daysSince, oldest } from "@/lib/elapsed";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  IconChevronRight,
  IntegrationStatusBadge,
  Link,
  LoadingBlock,
  Select,
} from "@/components/ui";
import {
  PROVIDER_SLUG,
  healthLabel,
  healthTone,
  readOAuthNotice,
  useIntegrations,
} from "./shared";
import { StoreScopeCard } from "./store-scope-card";

// Hub de /integraciones: una tarjeta de estado por conector con enlace a su
// propia pagina. La configuracion detallada de cada uno vive en
// /integraciones/<slug>.
function IntegrationsHub({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const {
    organization,
    memberships,
    setOrganizationId,
    payload,
    isLoading,
    error,
  } = useIntegrations(bootstrap);
  const [oauthNotice, setOauthNotice] =
    useState<ReturnType<typeof readOAuthNotice>>(null);
  // Onboarding: se llega aquí justo después de crear una tienda propia en
  // /tiendas (?welcome=<nombre>) para conectar sus integraciones.
  const [welcomeStore, setWelcomeStore] = useState<string | null>(null);

  useEffect(() => {
    setOauthNotice(readOAuthNotice());
    const welcome = new URLSearchParams(window.location.search).get("welcome");
    if (welcome) setWelcomeStore(welcome);
  }, []);

  if (isLoading) {
    return (
      <AsyncState status="loading" loadingLabel="Cargando integraciones..." />
    );
  }
  if (error) {
    return (
      <div className="portal-page">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!payload) {
    return (
      <AsyncState
        status="empty"
        emptyTitle="No hay integraciones para mostrar"
        emptyHint="Selecciona una organización activa y vuelve a intentarlo."
      />
    );
  }

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      {welcomeStore ? (
        <Banner tone="success">
          Tienda «{welcomeStore}» creada. Conéctala a Shopify, Meta y Klaviyo
          aquí para empezar a ver sus datos.
        </Banner>
      ) : null}
      {oauthNotice ? (
        <Banner tone={oauthNotice.tone}>{oauthNotice.text}</Banner>
      ) : null}
      {!payload.schema_ready ? (
        <Banner tone="danger">
          No se pudo cargar el estado de las integraciones ahora mismo. Reintenta
          en unos minutos o contacta con soporte si sigue igual.
        </Banner>
      ) : null}

      <Card
        title="Integraciones"
        description="Conecta las plataformas de la tienda. Abre cada una para ver los pasos, el estado y su configuración."
      >
        <Field label="Cliente activo">
          <Select
            aria-label="Cliente activo"
            value={organization?.id ?? ""}
            onChange={setOrganizationId}
            options={memberships.map((membership) => ({
              value: membership.organization_id,
              label:
                membership.organization?.display_name ??
                membership.organization_id,
            }))}
          />
        </Field>
      </Card>

      {organization?.id ? (
        <StoreScopeCard organizationId={organization.id} />
      ) : null}

      {/* Cobertura de datos: sin esto, cualquier consejo sobre un canal es una
          opinión. Es la misma pregunta que el Consultor IA responde con
          data_coverage antes de recomendar nada. */}
      <ModuleSummary
        metrics={[
          {
            label: "Conectadas",
            value: `${payload.providers.filter((provider) => provider.connection).length}/${payload.providers.length}`,
            tone: payload.providers.every((provider) => provider.connection)
              ? "success"
              : "warn",
          },
          {
            label: "Con incidencia",
            value: payload.providers
              .filter((provider) => provider.health.status !== "healthy")
              .length.toLocaleString("es-ES"),
            tone: payload.providers.some(
              (provider) => provider.health.status !== "healthy",
            )
              ? "danger"
              : "success",
          },
          {
            label: "Sincronización más antigua",
            value: (() => {
              const days = daysSince(
                oldest(
                  payload.providers.map((provider) => provider.health.lastSyncAt),
                ),
              );
              if (days === null) return "Nunca";
              return days === 0 ? "Hoy" : `Hace ${days} d`;
            })(),
            hint: "Antigüedad del dato más viejo",
          },
          {
            label: "Pendientes de activar",
            value: payload.providers
              .filter(
                (provider) => provider.connection && !provider.activation.ready,
              )
              .length.toLocaleString("es-ES"),
            hint: "Conectadas pero sin permisos o activos elegidos",
          },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {payload.providers.map((provider) => {
          const slug = PROVIDER_SLUG[provider.id];
          return (
            <Card
              key={provider.id}
              title={provider.name}
              description={provider.description}
              actions={
                <IntegrationStatusBadge
                  available={provider.available}
                  configurationStatus={provider.configuration.status}
                  connectionStatus={provider.connection?.status}
                  healthStatus={provider.health.status}
                />
              }
              className="flex h-full flex-col"
            >
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <Badge tone={healthTone(provider.health.status)}>
                  {healthLabel(provider.health.status)}
                </Badge>
                {provider.connection?.provider_account_name ? (
                  <span className="text-muted">
                    {provider.connection.provider_account_name}
                  </span>
                ) : (
                  <span className="text-muted">Sin conectar</span>
                )}
              </div>

              <div className="mt-4 pt-2">
                {slug ? (
                  <Link
                    className="inline-flex items-center gap-1 text-sm font-medium"
                    href={`/integraciones/${slug}`}
                  >
                    {provider.connection ? "Ver y configurar" : "Conectar"}
                    <IconChevronRight aria-hidden />
                  </Link>
                ) : (
                  <span className="text-xs text-muted">
                    Configuración no disponible todavía.
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// --- Vista consultor sin cliente activo: matriz cliente × proveedor -------

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
  }>;
};

const INTEGRATION_ATTENTION = [
  "error",
  "reauthorization_required",
  "needs_reauth",
];

function ConsultantIntegrationsView() {
  const { setOrganizationId } = useActiveOrganization();
  const [data, setData] = useState<ConsultantIntegrationsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onlyIssues, setOnlyIssues] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch("/v1/consultant/integrations")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        setData((await response.json()) as ConsultantIntegrationsData);
        setError(null);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "No se pudieron cargar las integraciones por un error de red.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando integraciones de la cartera..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="portal-page">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!data) return null;

  const rowHasIssue = (row: ConsultantIntegrationsData["portfolio"][number]) =>
    Object.values(row.providers).some((cell) =>
      INTEGRATION_ATTENTION.includes(cell.status),
    );
  const issueCount = data.portfolio.filter(rowHasIssue).length;
  const rows = onlyIssues ? data.portfolio.filter(rowHasIssue) : data.portfolio;

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <Card
        title="Integraciones · toda la cartera"
        description={`${data.portfolio.length} clientes · ${issueCount} con alguna integración en error o por reautorizar.`}
      >
        <div className="mb-4">
          <Button
            variant={onlyIssues ? "primary" : "secondary"}
            size="sm"
            onClick={() => setOnlyIssues((value) => !value)}
          >
            Solo con incidencias
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={
              onlyIssues
                ? "Ninguna integración con incidencias"
                : "Sin clientes"
            }
            hint={
              onlyIssues
                ? "Toda la cartera con las integraciones al día."
                : "Cuando se te asigne un cliente aparecerá aquí."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-separator text-left">
                  <th className="py-2 pr-4 font-medium">Cliente</th>
                  {data.providers.map((provider) => (
                    <th key={provider} className="px-3 py-2 font-medium">
                      {displayValue(provider)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.organization_id}
                    className="cursor-pointer border-b border-separator hover:bg-surface"
                    onClick={() => setOrganizationId(row.organization_id)}
                  >
                    <td className="py-3 pr-4 font-medium">{row.display_name}</td>
                    {data.providers.map((provider) => {
                      const cell = row.providers[provider];
                      return (
                        <td key={provider} className="px-3 py-3">
                          {cell ? (
                            <Badge
                              tone={
                                INTEGRATION_ATTENTION.includes(cell.status)
                                  ? "danger"
                                  : cell.status === "connected"
                                    ? "success"
                                    : "neutral"
                              }
                            >
                              {displayValue(cell.status)}
                            </Badge>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function IntegrationsRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (isConsultant && !organizationId) {
    return <ConsultantIntegrationsView />;
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
