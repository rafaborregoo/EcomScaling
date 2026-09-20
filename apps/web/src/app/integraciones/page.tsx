"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
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
  Modal,
  ProviderIcon,
  toast,
} from "@/components/ui";
import { classifyAuthorizationAttempt } from "@ecomscaling/contracts";
import { ClientDataQualityNotice, DataQualityPanel } from "./data-quality-panel";
import {
  PROVIDER_SLUG,
  readOAuthNotice,
  useIntegrations,
  useStoreScope,
  type IntegrationProvider,
} from "./shared";
import {
  buildStoreViews,
  explainHealth,
  healthTone,
  unassignedConnections,
  type StoreView,
} from "./store-view-model";

// Los 5 conectores del catalogo, en el orden fijo en que se leen: primero los
// que tienen tienda detras (Shopify, Meta, Klaviyo), luego los que no.
const PROVIDER_ORDER = ["shopify", "meta_ads", "klaviyo", "instagram", "fathom"];

// Hub de /integraciones: una rejilla de 2 columnas, una tarjeta por conexion
// (Shopify, Meta Ads, Klaviyo, Instagram, Fathom). Shopify es la excepcion --
// Meta y Klaviyo son conexiones DE una tienda, pero Shopify ES la tienda, asi
// que su tarjeta lista cada una en vez de resumir "conectado/no conectado".
// El detalle de cada tienda vive en /integraciones/tienda/<connectionId>, y la
// configuracion de cada conector en /integraciones/<slug>.

/** Solo el nombre de la tienda y si necesita atencion: el detalle de sus tres
 * conexiones (cuenta, ultimo sync, error) vive en su propia ficha, un clic
 * mas alla. Esta pantalla es para conectar, no para diagnosticar. */
function StoreRow({ store }: { store: StoreView }) {
  return (
    <Link
      href={`/integraciones/tienda/${store.connectionId}`}
      aria-label={`Abrir ${store.name}`}
      className="flex items-center justify-between gap-4 px-1 py-2.5 no-underline"
    >
      <span className="min-w-0 truncate font-medium text-foreground">
        {store.name}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {store.severity > 0 ? (
          <Badge tone={healthTone(store.status)}>Necesita atención</Badge>
        ) : null}
        <IconChevronRight aria-hidden className="text-muted" />
      </span>
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

/** Boton que abre el catalogo de las 5 apps con su logo. Ir a conectar una era
 * antes "adivina el slug en la barra de direcciones" o "date con la tarjeta
 * correcta en Otras integraciones"; aqui esta todo junto, se elige por logo. */
function ConnectAppsModal({ providers }: { providers: IntegrationProvider[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const ordered = [...providers].sort(
    (a, b) => PROVIDER_ORDER.indexOf(a.id) - PROVIDER_ORDER.indexOf(b.id),
  );

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Conectar</Button>
      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog aria-label="Conectar una aplicación">
              <Modal.Header>
                <Modal.Heading>Conectar una aplicación</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {ordered.map((provider) => {
                    const slug = PROVIDER_SLUG[provider.id];
                    const clickable = Boolean(slug && provider.available);
                    return (
                      <li key={provider.id}>
                        {clickable ? (
                          <Link
                            href={`/integraciones/${slug}`}
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 rounded-md border border-edge p-3 no-underline transition hover:border-accent"
                          >
                            <ProviderIcon provider={provider.id} size={28} />
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">
                                {provider.name}
                              </div>
                              <div className="truncate text-xs text-muted">
                                {provider.description}
                              </div>
                            </div>
                            <IconChevronRight
                              aria-hidden
                              className="ml-auto shrink-0 text-muted"
                            />
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 rounded-md border border-edge p-3 opacity-60">
                            <ProviderIcon provider={provider.id} size={28} />
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">
                                {provider.name}
                              </div>
                              <div className="truncate text-xs text-muted">
                                Disponible más adelante
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Cerrar
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

/** La tarjeta de Shopify en la rejilla: no es "un proveedor mas", es la que
 * cuelga las tiendas -- Meta y Klaviyo son conexiones DE una tienda, Shopify
 * ES la tienda. Por eso lista cada una (con acceso a su detalle) en vez de
 * resumir "conectado/no conectado" como las demas tarjetas. */
function ShopifyGridCard({
  provider,
  stores,
}: {
  provider: IntegrationProvider | null;
  stores: StoreView[];
}) {
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ProviderIcon provider="shopify" size={20} />
          Shopify
        </span>
      }
      description={provider?.description}
      actions={
        <ButtonLink variant="secondary" href="/integraciones/shopify">
          Conectar otra tienda
        </ButtonLink>
      }
    >
      {!provider?.available ? (
        <p className="text-sm text-muted">Disponible más adelante.</p>
      ) : stores.length === 0 ? (
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
        <List as="ul" className="-mx-1">
          {stores.map((store) => (
            <List.Item as="li" key={store.connectionId}>
              <StoreRow store={store} />
            </List.Item>
          ))}
        </List>
      )}
    </Card>
  );
}

/** Tarjeta de la rejilla para Meta Ads, Klaviyo, Instagram y Fathom: son una
 * conexion de la organizacion (no varias tiendas), asi que basta con su
 * estado y un boton para conectar/reconectar/configurar. */
function ProviderGridCard({ provider }: { provider: IntegrationProvider }) {
  const slug = PROVIDER_SLUG[provider.id];
  const explanation = explainHealth(provider.health, provider.connection);
  const connected = provider.connections.length > 0;

  return (
    <div className="flex items-start gap-3 rounded-md border border-edge p-4">
      <ProviderIcon provider={provider.id} size={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{provider.name}</p>
          <Badge
            tone={connected ? healthTone(provider.health.status) : "neutral"}
            variant="soft"
          >
            {provider.available ? explanation.label : "Disponible más adelante"}
          </Badge>
        </div>
        {/* Que se conecta y para que se usa: sin esto, "Conectar" era un salto
            de fe -- ni el propio dueño de la tienda sabe que le va a leer. */}
        <p className="mt-1 text-xs text-muted">{provider.description}</p>
      </div>
      {slug && provider.available ? (
        <ButtonLink
          variant={
            explanation.fix === "reconnect" ||
            explanation.fix === "connect" ||
            explanation.fix === "discard"
              ? "primary"
              : "secondary"
          }
          href={`/integraciones/${slug}`}
        >
          {explanation.fix === "discard"
            ? "Retomar"
            : explanation.fix === "reconnect"
              ? "Reconectar"
              : explanation.fix === "connect"
                ? "Conectar"
                : "Configurar"}
        </ButtonLink>
      ) : null}
    </div>
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
  const shopify = payload.providers.find((provider) => provider.id === "shopify") ?? null;
  const otherProviders = payload.providers
    .filter((provider) => provider.id !== "shopify")
    .sort((a, b) => PROVIDER_ORDER.indexOf(a.id) - PROVIDER_ORDER.indexOf(b.id));

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

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">Tus conexiones</h2>
        <ConnectAppsModal providers={payload.providers} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ShopifyGridCard provider={shopify} stores={stores} />
        {otherProviders.map((provider) => (
          <ProviderGridCard key={provider.id} provider={provider} />
        ))}
      </div>

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
  const integrationsQuery = useCachedQuery<ConsultantIntegrationsData>(
    "/v1/consultant/integrations",
  );
  const data = integrationsQuery.data;
  const error = integrationsQuery.error
    ? "No se pudieron cargar las integraciones de la cartera. Revisa la conexion e intentalo de nuevo."
    : null;
  const isLoading = integrationsQuery.isLoading;
  const [onlyIssues, setOnlyIssues] = useState(false);

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
