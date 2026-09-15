"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveConnection } from "@/components/active-connection";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { daysSince } from "@/lib/elapsed";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  ErrorBlock,
  IconChevronLeft,
  Link,
  List,
  ProviderIcon,
  toast,
} from "@/components/ui";
import { PROVIDER_SLUG, useIntegrations, useStoreScope } from "../../shared";
import {
  buildStoreViews,
  healthTone,
  type StoreProviderView,
  type StoreView,
} from "../../store-view-model";

// Una tienda y sus tres conexiones.
//
// Es la pantalla que contesta la unica pregunta que se hace de verdad delante de
// /integraciones: "esta tienda, ¿esta bien, y si no, que hago?". Antes esa
// respuesta estaba repartida entre cinco tarjetas de proveedor, un badge que
// resumia la peor tienda de cada uno y una lista de ids en rojo.

function lastSyncText(value: string | null): string {
  const days = daysSince(value);
  if (days === null) return "Nunca";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days} días`;
}

function ProviderCard({
  provider,
  storeName,
  onRetry,
  retrying,
  onDiscard,
  discarding,
}: {
  provider: StoreProviderView;
  storeName: string;
  onRetry?: () => void;
  retrying: boolean;
  /** Solo se pasa cuando lo que hay es un intento de OAuth sin terminar: no se
   * ofrece "descartar" sobre una tienda con datos detras. */
  onDiscard?: () => void;
  discarding: boolean;
}) {
  const slug = PROVIDER_SLUG[provider.provider];
  const { explanation } = provider;
  const connected = provider.connections.length > 0;
  const cuentas = provider.connections
    .map(
      (connection) =>
        connection.provider_account_name ??
        connection.provider_account_id ??
        connection.id,
    )
    .filter(Boolean);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <ProviderIcon provider={provider.provider} size={18} />
          {provider.name}
        </span>
      }
      actions={
        <Badge tone={healthTone(provider.status)} variant={connected ? "solid" : "soft"}>
          {explanation.label}
        </Badge>
      }
    >
      {explanation.detail ? (
        <p className="max-w-prose text-sm leading-6">{explanation.detail}</p>
      ) : (
        <p className="max-w-prose text-sm leading-6 text-muted">
          Los datos de {provider.name} para {storeName} están al día.
        </p>
      )}

      {/* El error del proveedor, traducido. El texto crudo no se tira: se
          guarda detras de "detalle tecnico", que es donde lo busca quien
          depura y donde no molesta a quien solo quiere su tienda arreglada. */}
      {provider.error ? (
        <Banner className="mt-3" tone="warn">
          {provider.error.text}
          {provider.error.technical ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted">
                Detalle técnico
              </summary>
              <p className="mt-1 break-words font-mono text-xs">
                {provider.error.technical}
              </p>
            </details>
          ) : null}
        </Banner>
      ) : null}

      {connected ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">
              {cuentas.length > 1 ? "Cuentas" : "Cuenta"}
            </dt>
            <dd className="break-words">{cuentas.join(", ") || "Sin nombre"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Última sincronización</dt>
            <dd>{lastSyncText(provider.lastSyncAt)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {explanation.fix === "retry" && onRetry ? (
          <Button size="sm" onClick={onRetry} disabled={retrying}>
            {retrying ? "Reintentando..." : "Reintentar sincronización"}
          </Button>
        ) : null}
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
              ? "Retomar la conexión"
              : explanation.fix === "reconnect"
                ? `Reconectar ${provider.name}`
                : explanation.fix === "connect"
                  ? `Conectar ${provider.name}`
                  : "Configurar"}
          </ButtonLink>
        ) : null}
        {/* Descartar borra de verdad y al momento: en un intento sin terminar
            no hay datos que perder, y el borrado programado de 30 dias lo
            dejaria ocupando cupo del plan un mes por nada. */}
        {onDiscard ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onDiscard}
            disabled={discarding}
          >
            {discarding ? "Descartando..." : "Descartar intento"}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function StoreDetail({
  bootstrap,
  connectionId,
}: {
  bootstrap: BootstrapResponse;
  connectionId: string;
}) {
  const { organization, payload, isLoading, error, actions, pending, actionError } =
    useIntegrations(bootstrap);
  const { scope } = useStoreScope(organization?.id ?? null);
  const { connectionId: activeConnectionId, setConnectionId } =
    useActiveConnection();
  const router = useRouter();

  // Reintentar, reconectar o descartar falla arriba, flotando, no en un bloque
  // rojo pegado a la ficha que sigue ahi cuando ya has resuelto lo que decia.
  useEffect(() => {
    if (actionError) toast.danger(actionError);
  }, [actionError]);

  // Entrar en una tienda ES elegirla: si el selector del encabezado siguiera en
  // otra, el resto del programa (dashboard, marketing, tareas) estaria hablando
  // de una tienda distinta a la que tienes abierta.
  useEffect(() => {
    if (connectionId && connectionId !== activeConnectionId) {
      setConnectionId(connectionId);
    }
    // Solo al aterrizar: si dependiera de activeConnectionId, cambiar de tienda
    // en el encabezado te devolveria a esta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando la tienda..." />;
  }
  if (error) {
    return (
      <div className="portal-page space-y-4">
        <BackToStores />
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }

  const store: StoreView | undefined = payload
    ? buildStoreViews(payload, scope).find(
        (item) => item.connectionId === connectionId,
      )
    : undefined;

  if (!store) {
    return (
      <div className="portal-page space-y-4">
        <BackToStores />
        <AsyncState
          status="empty"
          emptyTitle="Esta tienda ya no existe"
          emptyHint="La conexión se borró o pertenece a otro cliente. Vuelve a la lista de tiendas."
        />
      </div>
    );
  }

  const retryable: Record<string, "shopify" | "klaviyo" | undefined> = {
    shopify: "shopify",
    klaviyo: "klaviyo",
  };

  // Mismo criterio que el backend (canDiscardAuthorizationAttempt): quien pudo
  // empezar el OAuth -- owner o manager -- puede tirarlo si se quedo a medias.
  const canDiscard =
    bootstrap.profile.platform_role === "platform_admin" ||
    bootstrap.memberships.some(
      (membership) =>
        membership.organization_id === organization?.id &&
        ["owner", "manager"].includes(membership.role),
    );

  // Descartar la conexion de Shopify es descartar la tienda entera: esta
  // pagina deja de tener sujeto, asi que se vuelve a la lista.
  async function discardAndLeave(targetId: string) {
    await actions.discardAuthorizationAttempt(targetId);
    if (targetId === connectionId) router.replace("/integraciones");
  }

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <BackToStores />

      <Card
        title={store.name}
        description={store.domain}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={healthTone(store.status)} variant="solid">
              {store.severity === 0 ? "Al día" : "Necesita atención"}
            </Badge>
            <ButtonLink variant="secondary" href="/shopify">
              Ver datos de la tienda
            </ButtonLink>
          </div>
        }
      >
        <p className="max-w-prose text-sm leading-6 text-muted">
          {store.severity === 0
            ? "Las conexiones de esta tienda están trayendo datos con normalidad."
            : "Algo de esta tienda no está trayendo datos. Abajo está qué es y qué hacer."}
        </p>

        {/* Sin fila en shopify_stores no hay a que colgar las cuentas de Meta y
            Klaviyo, asi que se veria "sin conectar" aunque existan. */}
        {!store.storeId ? (
          <Banner className="mt-3" tone="warn">
            Esta tienda todavía no está dada de alta del todo, así que sus
            cuentas de Meta y Klaviyo no se pueden asignar. Termina de conectar
            Shopify y vuelve.
          </Banner>
        ) : null}

      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {store.providers.map((provider) => {
          const kind = retryable[provider.provider];
          const target = provider.connections[0];
          const descartable =
            canDiscard && provider.attempt === "abandoned" && provider.target;
          return (
            <ProviderCard
              key={provider.provider}
              provider={provider}
              storeName={store.name}
              retrying={pending === `retry-${kind}`}
              onRetry={
                kind && target
                  ? () => void actions.retrySync(kind, target.id)
                  : undefined
              }
              discarding={pending === `discard-${provider.target?.id}`}
              onDiscard={
                descartable
                  ? () => void discardAndLeave(provider.target!.id)
                  : undefined
              }
            />
          );
        })}
      </div>

      {store.storeId ? (
        <Card title="Cuentas de esta tienda">
          <List as="ul">
            {store.providers
              .filter((provider) => provider.provider !== "shopify")
              .map((provider) => (
                <List.Item
                  as="li"
                  key={provider.provider}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <ProviderIcon provider={provider.provider} />
                    {provider.name}
                  </span>
                  <span className="text-muted">
                    {provider.connections.length === 0
                      ? "Ninguna cuenta asignada a esta tienda"
                      : `${provider.connections.length} ${
                          provider.connections.length === 1
                            ? "cuenta"
                            : "cuentas"
                        }`}
                  </span>
                </List.Item>
              ))}
          </List>
          <p className="mt-3 text-sm text-muted">
            Una cuenta de Meta o Klaviyo que no cuelgue de una tienda no entra en
            sus cifras.{" "}
            <Link href="/integraciones/cuentas">Revisar la asignación</Link>
          </p>
        </Card>
      ) : null}
    </div>
  );
}

function BackToStores() {
  return (
    <Link className="inline-flex items-center gap-1 text-sm" href="/integraciones">
      <IconChevronLeft aria-hidden /> Todas las tiendas
    </Link>
  );
}

export default function StoreIntegrationsPage() {
  const params = useParams<{ connectionId: string }>();
  const connectionId = String(params?.connectionId ?? "");

  return (
    <PortalShell title="Integraciones · Tienda">
      {(bootstrap) => (
        <StoreDetail bootstrap={bootstrap} connectionId={connectionId} />
      )}
    </PortalShell>
  );
}
