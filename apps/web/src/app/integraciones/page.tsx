"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import { readApiError } from "@/lib/api-error";
import { useModuleSummary } from "@/components/module-summary";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBlock,
  IconChevronRight,
  Link,
  List,
  LoadingBlock,
  ProviderIcon,
  toast,
} from "@/components/ui";
import { classifyAuthorizationAttempt } from "@ecomscaling/contracts";
import { ClientDataQualityNotice, DataQualityPanel } from "./data-quality-panel";
import { PROVIDER_SLUG, readOAuthNotice, useIntegrations, useStoreScope } from "./shared";
import {
  buildStoreViews,
  healthTone,
  unassignedConnections,
  type StoreView,
} from "./store-view-model";

// Hub de /integraciones: LA LISTA DE TIENDAS.
//
// Antes era una rejilla de cinco tarjetas por proveedor, cada una con el estado
// de su peor tienda y una lista de ids crudos debajo. Para saber si la tienda de
// un cliente estaba bien habia que leer las cinco y cruzarlas de cabeza, y todo
// lo que no estaba conectado -- que es una decision, no una averia -- salia en
// rojo junto a lo que si estaba roto.
//
// Aqui la unidad es la tienda, que es como el cliente piensa su negocio: entras
// en una y ves sus tres conexiones. El detalle de cada tienda vive en
// /integraciones/tienda/<connectionId>, y la configuracion de cada conector en
// /integraciones/<slug>.

// Texto plano, sin badges: el color de la palabra ya dice el estado, no hace
// falta una pastilla alrededor. "Sin conectar" en gris no es una averia.
const TEXT_TONE: Record<string, string> = {
  success: "text-success",
  warn: "text-warning",
  danger: "text-danger",
  brand: "text-brand",
  neutral: "text-muted",
};

function StoreRow({
  store,
  isActive,
}: {
  store: StoreView;
  isActive: boolean;
}) {
  return (
    <Link
      href={`/integraciones/tienda/${store.connectionId}`}
      aria-label={`Abrir ${store.name}`}
      className="flex items-center justify-between gap-4 px-1 py-3 no-underline"
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-foreground">{store.name}</span>
          {isActive ? <span className="text-xs text-muted">(activa)</span> : null}
          {store.domain ? (
            <span className="truncate font-mono text-xs text-muted">
              {store.domain}
            </span>
          ) : null}
        </div>
        <p className="text-sm">
          {store.providers.map((provider, index) => {
            const connected = provider.connections.length > 0;
            return (
              <span key={provider.provider}>
                {index > 0 ? <span className="text-muted"> · </span> : null}
                <span
                  className={
                    connected ? TEXT_TONE[healthTone(provider.status)] : "text-muted"
                  }
                >
                  {provider.name}: {provider.explanation.label}
                </span>
              </span>
            );
          })}
        </p>
      </div>
      <IconChevronRight aria-hidden className="shrink-0 text-muted" />
    </Link>
  );
}

/** Numeros y texto plano, sin tarjetas: publica el resumen al Consultor IA
 * (mismo contrato que ModuleSummary) pero lo pinta como una linea, no como
 * KPIs con borde y fondo de color. */
function IntegrationsSummaryLine({
  stores,
  needAttention,
}: {
  stores: StoreView[];
  needAttention: StoreView[];
}) {
  useModuleSummary({
    metrics: [
      { label: "Tiendas", value: stores.length.toLocaleString("es-ES") },
      {
        label: "Necesitan atención",
        value: needAttention.length.toLocaleString("es-ES"),
        tone: needAttention.length > 0 ? "danger" : "success",
      },
    ],
  });

  return (
    <p className="text-sm">
      <span className="text-muted">Tiendas: </span>
      <span className="font-medium text-foreground">{stores.length}</span>
      <span className="text-muted"> · Necesitan atención: </span>
      <span
        className={
          needAttention.length > 0
            ? "font-medium text-danger"
            : "font-medium text-success"
        }
      >
        {needAttention.length}
      </span>
      {needAttention.length > 0 ? (
        <span className="text-muted">
          {" "}
          ({needAttention.map((store) => store.name).join(", ")})
        </span>
      ) : null}
    </p>
  );
}

function IntegrationsHub({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const {
    organization,
    payload,
    isLoading,
    error,
    reload,
    actions,
    pending,
    actionError,
  } = useIntegrations(bootstrap);
  // Mismo criterio que el backend (canDiscardAuthorizationAttempt): descartar
  // un OAuth a medias lo puede hacer quien pudo empezarlo -- owner o manager de
  // esa organizacion --, no solo el consultor. Borrar una tienda con datos
  // sigue siendo del consultor, y de eso se encarga el backend.
  const canDiscard =
    bootstrap.profile.platform_role === "platform_admin" ||
    bootstrap.memberships.some(
      (membership) =>
        membership.organization_id === organization?.id &&
        ["owner", "manager"].includes(membership.role),
    );
  const { scope } = useStoreScope(organization?.id ?? null);
  // La tienda del selector del encabezado, para marcar cual estas viendo.
  const { connectionId: activeConnectionId } = useActiveConnection();
  // Onboarding: se llega aquí justo después de crear una tienda propia en
  // /tiendas (?welcome=<nombre>) para conectar sus integraciones.
  const [welcomeStore, setWelcomeStore] = useState<string | null>(null);

  useEffect(() => {
    // El resultado del OAuth es una noticia, no un estado de la página: sale
    // flotando arriba, se lee y se va. Como Banner empujaba la lista hacia
    // abajo y se quedaba ahí para siempre, incluso cuando ya habías arreglado
    // lo que decía.
    const notice = readOAuthNotice();
    if (notice) {
      if (notice.tone === "success") toast.success(notice.text);
      else if (notice.tone === "warn") toast.warning(notice.text);
      else toast.danger(notice.text, { timeout: 0 });
    }
    const welcome = new URLSearchParams(window.location.search).get("welcome");
    if (welcome) setWelcomeStore(welcome);
  }, []);

  // Un fallo al descartar o reintentar tambien es una noticia.
  useEffect(() => {
    if (actionError) toast.danger(actionError);
  }, [actionError]);

  if (isLoading) {
    return (
      <AsyncState status="loading" loadingLabel="Cargando integraciones..." />
    );
  }
  if (error) {
    return (
      <div className="portal-page space-y-3">
        <ErrorBlock>{error}</ErrorBlock>
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Reintentar
        </Button>
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

  const stores = buildStoreViews(payload, scope);
  const unassigned = unassignedConnections(payload, scope);
  const needAttention = stores.filter((store) => store.severity > 0);
  // Conectores que no cuelgan de una tienda todavia (Instagram, Fathom). No son
  // una averia: se dicen una vez, en gris, al final.
  const otros = payload.providers.filter(
    (provider) => !["shopify", "meta_ads", "klaviyo"].includes(provider.id),
  );

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      {welcomeStore ? (
        <Banner tone="success">
          Tienda «{welcomeStore}» creada. Conéctala a Shopify, Meta y Klaviyo
          aquí para empezar a ver sus datos.
        </Banner>
      ) : null}
      {/* F3/D01. Solo lo suyo y solo lo verificado; si no hay nada, no pinta nada. */}
      <ClientDataQualityNotice organizationId={organization?.id ?? null} />
      {!payload.schema_ready ? (
        <Banner tone="danger">
          No se pudo cargar el estado de las integraciones ahora mismo. Reintenta
          en unos minutos o contacta con soporte si sigue igual.
        </Banner>
      ) : null}

      {/* Cobertura de datos: sin esto, cualquier consejo sobre un canal es una
          opinión. Es lo mismo que el Consultor IA lee como "vista actual".
          Solo numeros y texto, sin tarjetas: publica el resumen pero no lo
          dibuja como KPI. */}
      <IntegrationsSummaryLine stores={stores} needAttention={needAttention} />

      <Card
        title="Tus tiendas"
        actions={
          <ButtonLink variant="secondary" href="/integraciones/shopify">
            Conectar otra tienda
          </ButtonLink>
        }
      >
        {stores.length === 0 ? (
          <EmptyState
            title="Todavía no hay ninguna tienda"
            hint="Una tienda nace al conectar Shopify. A partir de ahí se le añaden Meta Ads y Klaviyo."
            action={
              <ButtonLink href="/integraciones/shopify">
                Conectar la primera tienda
              </ButtonLink>
            }
          />
        ) : (
          <List as="ul" className="mt-1">
            {stores.map((store) => (
              <List.Item as="li" key={store.connectionId}>
                <StoreRow
                  store={store}
                  isActive={store.connectionId === activeConnectionId}
                />
              </List.Item>
            ))}
          </List>
        )}
      </Card>

      {unassigned.length > 0 ? (
        <Card
          title="Cuentas sin tienda"
          description="Estas cuentas están conectadas pero no cuelgan de ninguna tienda, así que sus cifras no se filtran al cambiar de tienda ni entran en el análisis de ninguna."
          actions={
            <ButtonLink variant="secondary" href="/integraciones/cuentas">
              Asignar a una tienda
            </ButtonLink>
          }
        >
          <List as="ul">
            {unassigned.map(({ provider, name, connection }) => {
              // Un OAuth de Meta que nunca se completo no tiene tienda a la que
              // colgarse, asi que cae aqui y no en la ficha de ninguna: sin este
              // boton no habia forma de quitarlo desde la interfaz.
              const attempt = classifyAuthorizationAttempt(connection);
              return (
                <List.Item
                  as="li"
                  key={connection.id}
                  className="flex flex-wrap items-center gap-2 py-3 text-sm"
                >
                  <ProviderIcon provider={provider} />
                  <span>{name}</span>
                  <span className="font-mono text-xs text-muted">
                    {connection.provider_account_name ??
                      connection.provider_account_id ??
                      connection.id}
                  </span>
                  {attempt ? (
                    <Badge tone={attempt === "abandoned" ? "warn" : "neutral"}>
                      {attempt === "abandoned"
                        ? "Intento sin terminar"
                        : "Autorización en curso"}
                    </Badge>
                  ) : (
                    <Badge tone={healthTone(connection.health.status)}>
                      {displayValue(connection.status)}
                    </Badge>
                  )}
                  {canDiscard && attempt === "abandoned" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        void actions.discardAuthorizationAttempt(connection.id)
                      }
                      disabled={pending === `discard-${connection.id}`}
                    >
                      {pending === `discard-${connection.id}`
                        ? "Descartando..."
                        : "Descartar"}
                    </Button>
                  ) : null}
                </List.Item>
              );
            })}
          </List>
        </Card>
      ) : null}

      {otros.length > 0 ? (
        <Card title="Otras integraciones">
          <List as="ul">
            {otros.map((provider) => {
              const slug = PROVIDER_SLUG[provider.id];
              return (
                <List.Item
                  as="li"
                  key={provider.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <ProviderIcon provider={provider.id} />
                    {provider.name}
                    <span className="text-muted">{provider.description}</span>
                  </span>
                  {provider.available && slug ? (
                    <Link href={`/integraciones/${slug}`}>Configurar</Link>
                  ) : (
                    <span className="text-xs text-muted">
                      Disponible más adelante
                    </span>
                  )}
                </List.Item>
              );
            })}
          </List>
        </Card>
      ) : null}
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
            aria-pressed={onlyIssues}
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
              <caption className="sr-only">
                Estado de cada integración por cliente. Activa el nombre del
                cliente para pasar a su vista.
              </caption>
              <thead>
                <tr className="border-b border-separator text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Cliente
                  </th>
                  {data.providers.map((provider) => (
                    <th
                      scope="col"
                      key={provider}
                      className="px-3 py-2 font-medium"
                    >
                      {displayValue(provider)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.organization_id}
                    className="border-b border-separator"
                  >
                    {/* La fila entera era un onClick sobre el <tr>: con teclado
                        no habia forma de abrir un cliente, y el lector de
                        pantalla no anunciaba que fuera pulsable. El disparador
                        es el nombre, que ademas es la cabecera de la fila. */}
                    <th scope="row" className="py-3 pr-4 text-left font-medium">
                      <button
                        type="button"
                        className="rounded-sm text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        onClick={() => setOrganizationId(row.organization_id)}
                      >
                        {row.display_name}
                      </button>
                    </th>
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

      <DataQualityPanel />
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
