"use client";


import { StoreIcon, UnlinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { daysSince } from "@/lib/elapsed";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  ErrorBlock,
  IconChevronLeft,
  Link,
  List,
  ProviderIcon,
  TrashIcon,
  toast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogConfirmPhrase,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  IconChevronDown,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui";
import { PROVIDER_SLUG, StateBadge, useIntegrations, useStoreScope } from "../../shared";
import {
  buildStoreViews,
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
  discardLabel,
  onUnlink,
  unlinking,
}: {
  provider: StoreProviderView;
  storeName: string;
  onRetry?: () => void;
  retrying: boolean;
  /** Solo se pasa cuando no hay datos detras que perder: un intento de OAuth
   * sin terminar, o una conexion en error que nunca llego a sincronizar nada
   * (p.ej. se autorizo la cuenta de Shopify equivocada). No se ofrece
   * "eliminar" sobre una tienda con historico. */
  onDiscard?: () => void;
  discarding: boolean;
  /** Texto del boton: distingue "descartar un intento" de "eliminar una
   * conexion rota" para que el owner sepa que esta tirando. */
  discardLabel?: string;
  /** Desvincula esta cuenta de la tienda, sin revocar el OAuth de toda la org. */
  onUnlink?: () => void;
  unlinking: boolean;
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
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-2">
          <ProviderIcon provider={provider.provider} size={18} />
          {provider.name}
        </span></CardTitle>
        <CardAction><StateBadge connection={provider.target} providerId={provider.provider} available={provider.available} /></CardAction>
      </CardHeader>
      <CardContent>
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
              <Collapsible className="mt-2">
                <CollapsibleTrigger className="text-xs text-muted">
                  Detalle técnico
                  <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                <p className="mt-1 break-words font-mono text-xs">
                  {provider.error.technical}
                </p>
              </CollapsibleContent>
              </Collapsible>
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

        <div role="group" aria-label="Acciones de la conexion" className="flex flex-wrap items-center gap-2 mt-4">
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
                  ? "default"
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
          {/* Descartar borra de verdad y al momento: sin datos detras que
              perder, el borrado programado de 30 dias solo dejaria ocupando
              cupo del plan un mes por nada. */}
          {onDiscard ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onDiscard}
              disabled={discarding}
            >
              {discarding ? "Eliminando..." : (discardLabel ?? "Descartar intento")}
            </Button>
          ) : null}
          {onUnlink ? (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="secondary" size="sm" disabled={unlinking}>
                    {unlinking ? "Desvinculando…" : "Desvincular de esta tienda"}
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <UnlinkIcon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>
                    ¿Desvincular {provider.name} de {storeName}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Las cuentas de {provider.name} dejarán de atribuirse a esta tienda. La conexión de {provider.name} seguirá activa en E-NORA y podrás asignarla a otra tienda; el histórico ya sincronizado no se elimina.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction busyLabel="Desvinculando…" onClick={() => onUnlink()}>
                    Desvincular cuenta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </CardContent>
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
  const { organization, payload, isLoading, error, actions, pending, actionError, reload } =
    useIntegrations(bootstrap);
  const { scope, reload: reloadScope } = useStoreScope(organization?.id ?? null);
  const { connectionId: activeConnectionId, setConnectionId } =
    useActiveConnection();
  const router = useRouter();
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);

  // Reintentar, reconectar o descartar falla arriba, flotando, no en un bloque
  // rojo pegado a la ficha que sigue ahi cuando ya has resuelto lo que decia.
  useEffect(() => {
    if (actionError) toast.danger(actionError);
  }, [actionError]);

  // Entrar en una tienda ES elegirla: si el selector del encabezado siguiera en
  // otra, el resto del programa (dashboard, marketing, tareas) estaria hablando
  // de una tienda distinta a la que tienes abierta.
  useEffect(() => {
    const belongsToOwnStore = Boolean(
      payload &&
        buildStoreViews(payload, scope).some(
          (store) => store.connectionId === connectionId,
        ),
    );
    if (connectionId && belongsToOwnStore && connectionId !== activeConnectionId) {
      setConnectionId(connectionId);
    }
    // Solo al aterrizar: si dependiera de activeConnectionId, cambiar de tienda
    // en el encabezado te devolveria a esta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, payload, scope]);

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
  const currentStore = store;

  const retryable: Record<string, "shopify" | "klaviyo" | undefined> = {
    shopify: "shopify",
    klaviyo: "klaviyo",
  };

  // Solo el owner/manager de una tienda propia y platform admin pueden
  // modificarla. La asignación de consultor no da acceso a esta ficha.
  const canManageStore =
    bootstrap.profile.platform_role === "platform_admin" ||
    bootstrap.memberships.some(
      (membership) =>
        membership.organization_id === organization?.id &&
        ["owner", "manager"].includes(membership.role),
    );
  // La asignacion de cuentas requiere permiso de escritura propio.
  const canManageStoreScope =
    bootstrap.profile.platform_role === "platform_admin" ||
    bootstrap.memberships.some(
      (membership) =>
        membership.organization_id === organization?.id &&
        ["owner", "manager"].includes(membership.role),
    );
  const shopifyConnection = store.providers.find(
    (provider) => provider.provider === "shopify",
  )?.target;
  const removalPending = shopifyConnection?.status === "pending_deletion";

  // Descartar la conexion de Shopify es descartar la tienda entera: esta
  // pagina deja de tener sujeto, asi que se vuelve a la lista.
  async function discardAndLeave(targetId: string) {
    await actions.discardAuthorizationAttempt(targetId);
    if (targetId === connectionId) router.replace("/integraciones");
  }

  async function removeStore() {
    const removed = await actions.scheduleStoreRemoval(connectionId);
    if (!removed) return;
    toast.success("Tienda eliminada de E-NORA. Puedes restaurarla durante 30 días.");
    const nextConnectionId = scope?.stores.find(
      (item) => item.connection_id !== connectionId,
    )?.connection_id;
    setConnectionId(nextConnectionId ?? "");
    router.replace("/integraciones");
  }

  async function restoreStore() {
    const restored = await actions.restoreStoreRemoval(connectionId);
    if (restored) toast.success("La tienda vuelve a estar activa.");
  }

  async function unlinkProviderFromStore(providerId: string) {
    if (!organization || !currentStore.storeId) return;
    const metaAccounts =
      providerId === "meta_ads"
        ? (scope?.meta_ad_accounts ?? [])
            .filter((account) => account.store_id === currentStore.storeId)
            .map((account) => ({ id: account.id, store_id: null }))
        : [];
    const klaviyoAccounts =
      providerId === "klaviyo"
        ? (scope?.klaviyo_accounts ?? [])
            .filter((account) => account.store_id === currentStore.storeId)
            .map((account) => ({ id: account.id, store_id: null }))
        : [];
    if (metaAccounts.length + klaviyoAccounts.length === 0) return;

    setUnlinkingProvider(providerId);
    try {
      const response = await apiFetch(`/v1/organizations/${organization.id}/store-scope`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(metaAccounts.length ? { meta_ad_accounts: metaAccounts } : {}),
          ...(klaviyoAccounts.length ? { klaviyo_accounts: klaviyoAccounts } : {}),
        }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const result = (await response.json()) as {
        updated: number;
        failed?: Array<{ message: string }>;
      };
      if (result.failed?.length) {
        toast.danger(result.failed[0]?.message ?? "No se pudo desvincular la cuenta.");
      } else {
        toast.success(`${result.updated} cuenta${result.updated === 1 ? "" : "s"} desvinculada${result.updated === 1 ? "" : "s"} de ${currentStore.name}.`);
      }
      await Promise.all([reload(), reloadScope()]);
      window.dispatchEvent(new Event("integration-status-changed"));
    } catch {
      toast.danger("No se pudo desvincular la cuenta. Reintenta.");
    } finally {
      setUnlinkingProvider(null);
    }
  }

  return (
    <div className="portal-page space-y-6">
      <BackToStores />

      <Card>
        <CardHeader>
          <CardKicker>Tienda</CardKicker>
          <CardTitle><span className="flex items-center gap-3">
            <ProviderIcon provider="shopify" size={24} />
            {store.name}
          </span></CardTitle>
          <CardDescription>{store.domain}</CardDescription>
          <CardAction><Badge tone={store.severity === 0 ? "success" : store.severity >= 4 ? "danger" : "warn"}>
            {store.status === "syncing" ? "Importando" : store.severity === 0 ? "Al d\u00eda" : "Necesita atenci\u00f3n"}
          </Badge></CardAction>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div role="group" aria-label="Acciones de la tienda" className="flex flex-wrap items-center gap-2">
              <ButtonLink variant="secondary" href="/shopify">
                Ver datos de la tienda
              </ButtonLink>
              {canManageStore && !removalPending ? (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={pending === `remove-${connectionId}`}
                      >
                        <TrashIcon aria-hidden className="size-4" />
                        Eliminar tienda
                      </Button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogMedia className="bg-danger/10 text-danger">
                        <StoreIcon />
                      </AlertDialogMedia>
                      <AlertDialogTitle>¿Eliminar esta tienda de E-NORA?</AlertDialogTitle>
                      <AlertDialogDescription>
                        La tienda desaparecerá de E-NORA y dejará de sincronizar ahora. Sus datos se conservarán 30 días para que puedas restaurarla desde Integraciones; después se eliminarán definitivamente. Esto no desinstala E-NORA en Shopify ni desconecta cuentas de Meta o Klaviyo que puedas usar con otras tiendas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogConfirmPhrase phrase={store.name} />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" busyLabel="Eliminando…" onClick={() => removeStore()}>
                        Eliminar tienda
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              {canManageStore && removalPending ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending === `restore-${connectionId}`}
                  onClick={() => void restoreStore()}
                >
                  {pending === `restore-${connectionId}` ? "Restaurando…" : "Restaurar tienda"}
                </Button>
              ) : null}
            </div>
          <p className="max-w-prose text-sm leading-6 text-muted">
            {store.status === "syncing"
              ? "Shopify está trayendo datos ahora. La sincronización todavía no ha terminado."
              : store.severity === 0
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
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {store.providers.map((provider) => {
          const kind = retryable[provider.provider];
          const target = provider.connections[0];
          // Misma logica que el backend (esConexionRotaSinDatos en
          // consultant.ts): un OAuth que termino contra la cuenta equivocada
          // y nunca trajo un dato es tan basura como un intento abandonado.
          const rotaSinDatos =
            provider.target?.status === "error" && !provider.lastSyncAt;
          const descartable =
            canManageStore &&
            (provider.attempt === "abandoned" || rotaSinDatos) &&
            provider.target;
          const providerAccountCount =
            provider.provider === "meta_ads"
              ? (scope?.meta_ad_accounts ?? []).filter(
                  (account) => account.store_id === store.storeId,
                ).length
              : provider.provider === "klaviyo"
                ? (scope?.klaviyo_accounts ?? []).filter(
                    (account) => account.store_id === store.storeId,
                  ).length
                : 0;
          const canUnlink =
            canManageStoreScope &&
            Boolean(store.storeId) &&
            providerAccountCount > 0 &&
            ["meta_ads", "klaviyo"].includes(provider.provider);
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
              discardLabel={rotaSinDatos ? "Eliminar conexión" : undefined}
              onDiscard={
                descartable
                  ? () => void discardAndLeave(provider.target!.id)
                  : undefined
              }
              onUnlink={
                canUnlink
                  ? () => void unlinkProviderFromStore(provider.provider)
                  : undefined
              }
              unlinking={unlinkingProvider === provider.provider}
            />
          );
        })}
      </div>

      {store.storeId ? (
        <Card>
          <CardHeader>
            <CardTitle>Cuentas de esta tienda</CardTitle>
          </CardHeader>
          <CardContent>
            <List as="ul">
              {store.providers
                .filter((provider) => provider.provider !== "shopify")
                .map((provider) => (
                  <Item key={provider.provider} render={<li />}>
                    <ItemMedia>
                      <ProviderIcon provider={provider.provider} />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{provider.name}</ItemTitle>
                    </ItemContent>
                    <ItemDescription>
                      {provider.connections.length === 0
                        ? "Ninguna cuenta asignada a esta tienda"
                        : `${provider.connections.length} ${
                          provider.connections.length === 1
                            ? "cuenta"
                            : "cuentas"
                        }`}
                    </ItemDescription>
                  </Item>
                ))}
            </List>
            <p className="mt-3 text-sm text-muted">
              Una cuenta de Meta o Klaviyo que no cuelgue de una tienda no entra en
              sus cifras.{" "}
              <Link href="/integraciones/cuentas">Revisar la asignación</Link>
            </p>
          </CardContent>
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
