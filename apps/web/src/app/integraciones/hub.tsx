"use client";

// Hub de /integraciones: qué hay que arreglar primero, cada tienda con sus
// canales en una fila, y la ficha de cada conexión a la derecha (estado, qué
// trae cada bloque, permisos e historial). Conectar es un asistente de pasos.
// La configuración fina de cada conector sigue en /integraciones/<slug>.

import { useEffect, useState } from "react";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { timeAgo } from "@/lib/elapsed";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useModuleSummary } from "@/components/module-summary";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  cn,
  Dialog,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Input,
  Link,
  List,
  Metric,
  ProviderIcon,
  Sheet,
  Table,
  toast,
} from "@/components/ui";
import { classifyAuthorizationAttempt } from "@e-nora/contracts";
import { ClientDataQualityNotice } from "./data-quality-panel";
import { ShopifyAccountAssignmentModal } from "./shopify-account-assignment-modal";
import {
  PROVIDER_SLUG,
  readOAuthNotice,
  StateBadge,
  stateOf,
  useIntegrations,
  useStoreScope,
  type IntegrationConnection,
  type IntegrationProvider,
  type IntegrationsResponse,
  type KlaviyoMetricsResponse,
} from "./shared";
import {
  STORE_PROVIDERS,
  buildStoreViews,
  CONNECTION_STATES,
  connectionState,
  explainError,
  explainHealth,
  unassignedConnections,
  type StoreView,
} from "./store-view-model";
import {
  blockLabel,
  buildFixQueue,
  klaviyoReceivesStore,
  latestBlocks,
  permissionRows,
  runHistory,
  runMark,
  type FixItem,
  type RunMark,
} from "./hub-model";

const ACCOUNT_PROVIDERS = ["instagram", "fathom"];
const KLAVIYO_INTEGRATIONS_URL = "https://www.klaviyo.com/integrations";

type Integrations = ReturnType<typeof useIntegrations>;
type Selection = { provider: string; storeId: string | null };

// Opción seleccionable (aplicación del asistente, método de conexión, casilla
// del mapa): borde del catálogo y el acento solo en la elegida.
const OPTION =
  "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-lg border border-edge bg-surface p-3 text-left transition hover:border-edge-strong disabled:cursor-not-allowed disabled:opacity-55 aria-pressed:border-accent aria-pressed:ring-2 aria-pressed:ring-accent-soft";
const NOTE = "text-sm text-muted";
const CALLOUT = "rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground";
const MARK: Record<RunMark, string> = { ok: "bg-success", partial: "bg-warning", fail: "bg-danger", run: "bg-accent" };

function Logo({ provider, small = false }: { provider: string; small?: boolean }) {
  return (
    <span className={cn("grid shrink-0 place-items-center border border-edge bg-white", small ? "size-6 rounded-md" : "size-8 rounded-lg")}>
      <ProviderIcon provider={provider} size={small ? 14 : 20} />
    </span>
  );
}

function Runs({ connection }: { connection: IntegrationConnection | null }) {
  const marks = runHistory(connection);
  if (marks.length === 0) return null;
  const failed = marks.filter((mark) => mark === "fail").length;
  return (
    <span className="flex gap-0.5" role="img" aria-label={`Últimas ${marks.length} sincronizaciones: ${failed} con error`}>
      {marks.map((mark, index) => (
        <i key={index} className={cn("h-3 w-1.5 rounded-sm", MARK[mark])} />
      ))}
    </span>
  );
}

function SectionTitle({ id, title, hint }: { id: string; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {hint ? <p className={NOTE}>{hint}</p> : null}
    </div>
  );
}

// --- Pulso ------------------------------------------------------------------

function Pulse({ stores, accountProviders, queue }: { stores: StoreView[]; accountProviders: IntegrationProvider[]; queue: FixItem[] }) {
  const connections = [
    ...stores.flatMap((store) => store.providers.flatMap((view) => view.connections)),
    ...accountProviders.flatMap((provider) => provider.connections),
  ].filter((connection) => classifyAuthorizationAttempt(connection) !== "in_progress");
  const healthy = connections.filter((connection) => connection.health.status === "healthy" || connection.health.status === "syncing").length;
  const latest = connections
    .map((connection) => connection.health.lastSyncAt ?? connection.last_sync_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const missing =
    stores.reduce((total, store) => total + store.providers.filter((view) => view.available && view.connections.length === 0).length, 0) +
    accountProviders.filter((provider) => provider.available && provider.connections.length === 0).length;

  useModuleSummary({
    metrics: [
      { label: "Tiendas", value: stores.length.toLocaleString("es-ES") },
      { label: "Necesitan atención", value: queue.length.toLocaleString("es-ES"), tone: queue.length > 0 ? "danger" : "success" },
    ],
  });

  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Resumen">
      <Metric card label="Conexiones al día" value={`${healthy}/${connections.length}`} tone={connections.length && healthy === connections.length ? "success" : "default"} />
      <Metric card label="Necesitan que hagas algo" value={queue.length} tone={queue.length ? "danger" : "success"} />
      <Metric card label="Último dato recibido" value={timeAgo(latest) ?? "—"} />
      <Metric card label="Canales sin conectar" value={missing} />
    </section>
  );
}

// --- Cola -------------------------------------------------------------------

function FixQueue({
  queue,
  integrations,
  canDiscard,
  onOpen,
}: {
  queue: FixItem[];
  integrations: Integrations;
  canDiscard: boolean;
  onOpen: (item: FixItem) => void;
}) {
  const { actions, pending } = integrations;
  return (
    <section aria-labelledby="fix-title">
      <SectionTitle id="fix-title" title="Qué hay que arreglar" hint="Lo más grave primero" />
      {queue.length === 0 ? (
        <Banner tone="success">Todo al día: no hay nada que arreglar.</Banner>
      ) : (
        <Card>
          <List as="ul">
            {queue.map((item) => {
              const slug = PROVIDER_SLUG[item.provider];
              const retryable = item.connection && (item.provider === "shopify" || item.provider === "klaviyo" || item.provider === "meta_ads");
              return (
                <List.Item
                  as="li"
                  key={item.key}
                  className={cn(
                    "flex flex-wrap items-center gap-3 border-l-4 py-3 pl-3",
                    item.severity === "bad" ? "border-l-danger" : "border-l-warning",
                  )}
                >
                  <Logo provider={item.provider} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.detail ? <p className="text-sm">{item.detail}</p> : null}
                    <p className="text-xs text-muted">{item.store ?? "Cuenta"}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {item.href ? (
                      <ButtonLink size="sm" href={item.href} target="_blank" rel="noreferrer">
                        {item.hrefLabel ?? "Abrir"}
                      </ButtonLink>
                    ) : item.fix === "reconnect" && slug ? (
                      <ButtonLink size="sm" href={`/integraciones/${slug}`}>
                        Reconectar
                      </ButtonLink>
                    ) : item.fix === "retry" && retryable ? (
                      <Button
                        size="sm"
                        disabled={pending === `retry-${item.provider === "meta_ads" ? "meta" : item.provider}`}
                        onClick={() =>
                          void actions.retrySync(item.provider === "meta_ads" ? "meta" : (item.provider as "shopify" | "klaviyo"), item.connection!.id)
                        }
                      >
                        Reintentar
                      </Button>
                    ) : item.fix === "discard" && canDiscard && item.connection ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending === `discard-${item.connection.id}`}
                        onClick={() => void actions.discardAuthorizationAttempt(item.connection!.id)}
                      >
                        Descartar
                      </Button>
                    ) : slug ? (
                      <ButtonLink size="sm" href={`/integraciones/${slug}`}>
                        {item.fix === "connect" || item.fix === "discard" ? "Retomar" : "Revisar"}
                      </ButtonLink>
                    ) : null}
                    {item.connection ? (
                      <Button size="sm" variant="secondary" onClick={() => onOpen(item)}>
                        Ver
                      </Button>
                    ) : null}
                  </div>
                </List.Item>
              );
            })}
          </List>
        </Card>
      )}
    </section>
  );
}

// --- Mapa tienda × canal ---------------------------------------------------

type StoreRow = StoreView & { id: string };

function StoreMap({ stores, selected, onSelect }: { stores: StoreView[]; selected: Selection | null; onSelect: (selection: Selection) => void }) {
  const rows: StoreRow[] = stores.map((store) => ({ ...store, id: store.connectionId }));
  return (
    <section aria-labelledby="stores-title">
      <SectionTitle id="stores-title" title="Tus tiendas" hint="Pulsa una casilla para ver su ficha" />
      <Card>
        <Table<StoreRow>
          ariaLabel="Tiendas y canales"
          rows={rows}
          columns={[
            {
              key: "name",
              label: "Tienda",
              render: (store) => (
                <Link href={`/integraciones/tienda/${store.connectionId}`} className="grid min-w-0 gap-0.5 text-foreground">
                  <span className="font-semibold">{store.name}</span>
                  <span className="truncate text-xs text-muted">{store.domain}</span>
                </Link>
              ),
            },
            ...STORE_PROVIDERS.map((provider) => ({
              key: provider,
              label: stores[0]?.providers.find((view) => view.provider === provider)?.name ?? provider,
              render: (store: StoreRow) => {
                const view = store.providers.find((item) => item.provider === provider)!;
                const connected = view.connections.length > 0;
                const account = view.target?.provider_account_name ?? view.target?.provider_account_id;
                const when = timeAgo(view.lastSyncAt);
                const pressed = selected?.storeId === store.connectionId && selected.provider === view.provider;
                return (
                  <button
                    type="button"
                    aria-pressed={pressed}
                    aria-label={`${view.name} de ${store.name}: ${connected ? stateOf(view.target!, view.provider).label : "sin conectar"}`}
                    className="grid w-full min-w-0 gap-1 rounded-md p-2 text-left transition hover:bg-surface-secondary aria-pressed:bg-accent-soft aria-pressed:ring-2 aria-pressed:ring-accent"
                    onClick={() => onSelect({ provider: view.provider, storeId: store.connectionId })}
                  >
                    <span className="flex items-center gap-2">
                      <Logo provider={view.provider} small />
                      <StateBadge connection={view.target} providerId={view.provider} available={view.available} />
                    </span>
                    {connected ? (
                      <>
                        <span className="truncate text-xs">
                          {account ?? "Cuenta sin nombre"}
                          {view.connections.length > 1 ? ` · +${view.connections.length - 1}` : ""}
                        </span>
                        <span className="text-xs text-muted">{when ? `Último dato ${when}` : "Aún sin datos"}</span>
                        <Runs connection={view.target} />
                      </>
                    ) : view.available ? (
                      <span className="text-xs font-medium text-accent">Conectar</span>
                    ) : null}
                  </button>
                );
              },
            })),
          ]}
        />
      </Card>
    </section>
  );
}

function AccountRow({ providers, onSelect }: { providers: IntegrationProvider[]; onSelect: (selection: Selection) => void }) {
  if (providers.length === 0) return null;
  return (
    <section aria-labelledby="account-title">
      <SectionTitle id="account-title" title="De la cuenta" hint="No dependen de ninguna tienda" />
      <div className="grid gap-3 sm:grid-cols-2">
        {providers.map((provider) => {
          const connection = provider.connections[0] ?? null;
          return (
            <button key={provider.id} type="button" className={OPTION} onClick={() => onSelect({ provider: provider.id, storeId: null })}>
              <span className="row-span-2">
                <Logo provider={provider.id} />
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <b className="text-sm font-semibold">{provider.name}</b>
                <StateBadge connection={connection} providerId={provider.id} available={provider.available} />
              </span>
              <small className="text-xs text-muted">{connection?.provider_account_name ?? provider.description}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LooseAccounts({
  payload,
  scope,
  integrations,
  canDiscard,
  pendingStores,
}: {
  payload: IntegrationsResponse;
  scope: ReturnType<typeof useStoreScope>["scope"];
  integrations: Integrations;
  canDiscard: boolean;
  pendingStores: StoreView[];
}) {
  const loose = unassignedConnections(payload, scope);
  if (loose.length === 0 && pendingStores.length === 0) return null;
  const { actions, pending } = integrations;
  return (
    <section aria-labelledby="loose-title">
      <SectionTitle id="loose-title" title="Sueltas" hint="Cuentas sin tienda y tiendas que se van a borrar" />
      <Card>
        <List as="ul">
          {loose.map(({ provider, name, connection }) => {
            const attempt = classifyAuthorizationAttempt(connection);
            return (
              <List.Item as="li" key={connection.id} className="flex flex-wrap items-center gap-3 py-3">
                <Logo provider={provider} small />
                <div className="min-w-[200px] flex-1">
                  <p className="text-sm font-semibold">{connection.provider_account_name ?? connection.provider_account_id ?? name}</p>
                  <p className="text-xs text-muted">
                    {attempt === "abandoned"
                      ? `${name}: se empezó a conectar y nunca se autorizó.`
                      : attempt === "in_progress"
                        ? `${name}: autorización en curso.`
                        : `${name} conectado, pero sus cifras no entran en ninguna tienda.`}
                  </p>
                </div>
                {attempt === "abandoned" ? (
                  canDiscard ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending === `discard-${connection.id}`}
                      onClick={() => void actions.discardAuthorizationAttempt(connection.id)}
                    >
                      {pending === `discard-${connection.id}` ? "Descartando…" : "Descartar"}
                    </Button>
                  ) : null
                ) : attempt ? null : (
                  <ButtonLink size="sm" variant="secondary" href="/integraciones/cuentas">
                    Asignar a una tienda
                  </ButtonLink>
                )}
              </List.Item>
            );
          })}
          {pendingStores.map((store) => (
            <List.Item as="li" key={store.connectionId} className="flex flex-wrap items-center gap-3 py-3">
              <Logo provider="shopify" small />
              <div className="min-w-[200px] flex-1">
                <p className="text-sm font-semibold">{store.name}</p>
                <p className="text-xs text-muted">Borrado programado: se puede restaurar durante 30 días.</p>
              </div>
              <ButtonLink size="sm" variant="secondary" href={`/integraciones/tienda/${store.connectionId}`}>
                Restaurar
              </ButtonLink>
            </List.Item>
          ))}
        </List>
      </Card>
    </section>
  );
}

// --- Ficha ------------------------------------------------------------------

function DrawerBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <h3 className={EYEBROW}>{title}</h3>
      {children}
    </div>
  );
}

const KV = "grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm [&_dd]:break-words [&_dt]:text-muted";
const MONO = "font-mono text-xs";

function PermissionList({ rows, withNote = true }: { rows: ReturnType<typeof permissionRows>; withNote?: boolean }) {
  return (
    <List as="ul">
      {rows.map((row) => (
        <List.Item as="li" key={row.scope} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2 py-2 text-sm">
          <span aria-hidden className={cn("font-bold", row.granted ? "text-success" : "text-danger")}>
            {row.granted ? "✓" : "✕"}
          </span>
          <div>
            {row.label}
            <span className="block text-xs text-muted">
              {row.granted
                ? row.scope
                : row.required
                  ? "Imprescindible: falta"
                  : ((withNote ? row.note : null) ?? "Opcional: sin él, esta parte no está disponible")}
            </span>
          </div>
        </List.Item>
      ))}
    </List>
  );
}

function ConnectionDrawer({
  selection,
  stores,
  payload,
  klaviyoStore,
  integrations,
  canManage,
  onClose,
  onConnect,
}: {
  selection: Selection | null;
  stores: StoreView[];
  payload: IntegrationsResponse;
  klaviyoStore: boolean | null;
  integrations: Integrations;
  canManage: boolean;
  onClose: () => void;
  onConnect: (provider: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const store = selection?.storeId ? (stores.find((item) => item.connectionId === selection.storeId) ?? null) : null;
  const provider = payload.providers.find((item) => item.id === selection?.provider) ?? null;
  const view = store?.providers.find((item) => item.provider === selection?.provider) ?? null;
  const connection = view ? view.target : (provider?.connections[0] ?? null);
  const explanation = connection ? explainHealth(connection.health, connection, selection?.provider) : null;
  const state = connection && explanation ? connectionState(connection, explanation) : null;
  const error = explainError(connection?.latest_sync?.error_message ?? connection?.last_error_message);
  const slug = selection ? PROVIDER_SLUG[selection.provider] : undefined;
  const syncKey = selection?.provider === "meta_ads" ? "meta" : selection?.provider;
  const canSync = connection && (syncKey === "shopify" || syncKey === "klaviyo" || syncKey === "meta");
  const blocks = latestBlocks(connection);
  const permissions = connection ? permissionRows(selection!.provider, connection.scopes) : [];
  const history = (connection?.recent_syncs ?? []).slice(0, 10);
  const { actions, pending } = integrations;
  const disconnectable =
    canManage &&
    Boolean(connection) &&
    connection?.status !== "disconnected" &&
    (selection?.provider === "meta_ads" || selection?.provider === "klaviyo");
  const sharedStores =
    selection?.provider === "meta_ads" && connection
      ? stores
          .filter((item) => item.providers.some((view) => view.connections.some((c) => c.id === connection.id)))
          .map((item) => item.name)
      : [];
  const stateTone = state ? CONNECTION_STATES[state].tone : "neutral";

  async function disconnect() {
    if (!connection || !selection) return;
    const result = await actions.disconnect(selection.provider as "meta_ads" | "klaviyo", connection.id);
    if (!result.ok) return;
    setConfirming(false);
    onClose();
    if (result.providerRevoked) toast.success(`${provider?.name ?? "La aplicación"} desconectada y permiso retirado.`);
    else if (result.reason === "api_key")
      toast.warning("Desconectada. Era una clave privada: bórrala también en Klaviyo → Ajustes → Claves API.", { timeout: 0 });
    else if (result.reason === "shared_meta_user")
      toast.warning("Desconectada aquí. El permiso de Meta sigue vivo porque tu usuario de Facebook lo usa en otra conexión.");
    else toast.warning("Desconectada. No pudimos retirar el permiso en el proveedor; puedes quitarlo desde su panel.");
  }

  return (
    <Sheet
      isOpen={Boolean(selection)}
      onOpenChange={(open) => {
        if (!open) {
          setConfirming(false);
          onClose();
        }
      }}
      size="md"
      title={
        <span className="flex items-center gap-3">
          {selection ? <Logo provider={selection.provider} /> : null}
          {provider?.name ?? ""}
        </span>
      }
      meta={store?.name ?? "De la cuenta"}
      start={
        store ? (
          <ButtonLink variant="ghost" href={`/integraciones/tienda/${store.connectionId}`}>
            Ficha de la tienda
          </ButtonLink>
        ) : undefined
      }
      footer={
        confirming ? (
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={pending === `disconnect-${connection?.id}`} onClick={() => void disconnect()}>
              {pending === `disconnect-${connection?.id}` ? "Desconectando…" : "Sí, desconectar"}
            </Button>
          </>
        ) : (
          <>
            {disconnectable ? (
              <Button variant="ghost" onClick={() => setConfirming(true)}>
                Desconectar
              </Button>
            ) : null}
            {canSync ? (
              <Button
                variant={state === "atrasado" || state === "error" ? "primary" : "secondary"}
                disabled={pending === `retry-${syncKey}`}
                onClick={() => void actions.retrySync(syncKey as "shopify" | "klaviyo" | "meta", connection!.id)}
              >
                {pending === `retry-${syncKey}` ? "Sincronizando…" : "Sincronizar ahora"}
              </Button>
            ) : null}
            {connection && slug ? (
              <ButtonLink variant={state === "reconectar" ? "primary" : "secondary"} href={`/integraciones/${slug}`}>
                {state === "reconectar" ? "Reconectar" : "Configurar"}
              </ButtonLink>
            ) : null}
            {!connection && provider?.available ? (
              <Button onClick={() => selection && onConnect(selection.provider)}>Conectar {provider.name}</Button>
            ) : null}
          </>
        )
      }
    >
      <div className="grid content-start gap-5">
        {confirming && connection ? (
          <Banner tone="danger">
            <b>
              ¿Desconectar {provider?.name}
              {store ? ` de ${store.name}` : ""}?
            </b>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Retiramos el permiso también en {provider?.name} cuando es posible: dejamos de leer datos al momento.</li>
              {sharedStores.length > 1 ? (
                <li>
                  Esta cuenta la usan {sharedStores.length} tiendas: {sharedStores.join(", ")}. Se desconecta en todas.
                </li>
              ) : null}
              <li>Los datos ya importados se conservan: si vuelves a conectar no se pierde el histórico.</li>
              <li>Los paneles y agentes que usan {provider?.name} dejan de actualizarse.</li>
            </ul>
          </Banner>
        ) : null}

        <div
          className={cn(
            "grid gap-1 rounded-lg border p-3 text-sm",
            stateTone === "success" && "border-success bg-success-soft",
            stateTone === "warn" && "border-warning bg-warning-soft",
            stateTone === "danger" && "border-danger bg-danger-soft",
            (stateTone === "neutral" || stateTone === "brand") && "border-edge",
          )}
        >
          <span className="flex items-center gap-2">
            <StateBadge connection={connection} providerId={selection?.provider} available={provider?.available ?? false} />
            {explanation && state && state !== "conectado" && explanation.label !== CONNECTION_STATES[state].label ? (
              <span className="font-medium">{explanation.label}</span>
            ) : null}
          </span>
          <span>{connection ? (error?.text ?? explanation?.detail ?? "Todo en orden.") : provider?.description}</span>
        </div>

        {(selection?.provider === "klaviyo" && connection) || (selection?.provider === "shopify" && klaviyoStore !== null) ? (
          <div className={cn("grid gap-1.5 rounded-lg border p-3 text-sm", klaviyoStore === false ? "border-danger" : "border-edge")}>
            <span className="flex items-center gap-1.5 font-semibold">
              <Logo provider="klaviyo" small /> Klaviyo ↔ <Logo provider="shopify" small /> Shopify
            </span>
            {klaviyoStore === null ? (
              <span>Aún no hay métricas de Klaviyo para comprobarlo.</span>
            ) : klaviyoStore ? (
              <span>Klaviyo recibe los pedidos y carritos de la tienda.</span>
            ) : (
              <>
                <span>Klaviyo no recibe eventos de la tienda: sin carrito abandonado, post-compra ni ingresos atribuidos.</span>
                <ButtonLink size="sm" variant="secondary" href={KLAVIYO_INTEGRATIONS_URL} target="_blank" rel="noreferrer">
                  Conectar Shopify en Klaviyo
                </ButtonLink>
              </>
            )}
          </div>
        ) : null}

        {connection ? (
          <DrawerBlock title="Cuenta">
            <dl className={KV}>
              <dt>Nombre</dt>
              <dd>{connection.provider_account_name ?? "—"}</dd>
              <dt>Id</dt>
              <dd className={MONO}>{connection.provider_account_id ?? "—"}</dd>
              <dt>Conectada</dt>
              <dd>{connection.connected_at ? new Date(connection.connected_at).toLocaleDateString("es-ES") : "—"}</dd>
              <dt>Último dato</dt>
              <dd>{timeAgo(connection.health.lastSyncAt ?? connection.last_sync_at) ?? "Aún sin datos"}</dd>
              {view && view.connections.length > 1 ? (
                <>
                  <dt>Otras cuentas</dt>
                  <dd>{view.connections.slice(1).map((item) => item.provider_account_name ?? item.provider_account_id).join(", ")}</dd>
                </>
              ) : null}
            </dl>
          </DrawerBlock>
        ) : null}

        {blocks.length > 0 ? (
          <DrawerBlock title="Qué trae">
            <List as="ul">
              {blocks.map((run) => {
                const mark = runMark(run.status);
                return (
                  <List.Item as="li" key={run.sync_scope} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 py-2 text-sm">
                    <i aria-hidden className={cn("size-2 rounded-full", MARK[mark])} />
                    <span>{blockLabel(run.sync_scope!)}</span>
                    <b className="font-semibold tabular-nums">{run.records_written.toLocaleString("es-ES")}</b>
                    <small className="text-xs text-muted">{timeAgo(run.finished_at ?? run.started_at) ?? "en curso"}</small>
                  </List.Item>
                );
              })}
            </List>
          </DrawerBlock>
        ) : null}

        {permissions.length > 0 ? (
          <DrawerBlock title="Permisos">
            <PermissionList rows={permissions} />
          </DrawerBlock>
        ) : null}

        {history.length > 0 ? (
          <DrawerBlock title="Últimas sincronizaciones">
            <List as="ul">
              {history.map((run, index) => (
                <List.Item as="li" key={index} className="grid grid-cols-[12px_minmax(0,1fr)_auto] gap-2.5 py-1.5 text-sm">
                  <i aria-hidden className={cn("mt-1.5 size-2 rounded-full", MARK[runMark(run.status)])} />
                  <div>
                    {run.sync_scope ? blockLabel(run.sync_scope) : run.sync_type}
                    {run.error_message ? <span> · {explainError(run.error_message)?.text}</span> : null}
                  </div>
                  <span className="text-muted">{timeAgo(run.finished_at ?? run.started_at ?? run.created_at) ?? "—"}</span>
                </List.Item>
              ))}
            </List>
          </DrawerBlock>
        ) : null}

        {error?.technical || connection ? (
          <details>
            <summary className="cursor-pointer text-sm text-muted">Detalle técnico</summary>
            <dl className={cn(KV, "mt-2")}>
              <dt>Conexión</dt>
              <dd className={MONO}>{connection?.id}</dd>
              <dt>Estado</dt>
              <dd className={MONO}>
                {connection?.status} · {connection?.health.status}
                {connection?.health.reason ? ` · ${connection.health.reason}` : ""}
              </dd>
              {connection?.api_version ? (
                <>
                  <dt>API</dt>
                  <dd className={MONO}>{connection.api_version}</dd>
                </>
              ) : null}
              {error?.technical ? (
                <>
                  <dt>Error</dt>
                  <dd className={MONO}>{error.technical}</dd>
                </>
              ) : null}
            </dl>
          </details>
        ) : null}
      </div>
    </Sheet>
  );
}

// --- Qué se autoriza -------------------------------------------------------
// Antes de mandar a alguien a la pantalla del proveedor (en inglés, con nombres
// de permisos técnicos), se le dice qué lee E-NORA, qué escribe y qué no hace
// nunca. Tiene que coincidir con los scopes que pide el backend.
const ACCESS_SUMMARY: Record<string, Array<{ kind: "Lee" | "Escribe" | "Nunca"; text: string }>> = {
  shopify: [
    { kind: "Lee", text: "Pedidos, productos, clientes, stock y devoluciones" },
    { kind: "Lee", text: "Informes de sesiones, para el embudo de compra" },
    { kind: "Nunca", text: "Cambiar precios, pedidos ni pagos" },
  ],
  meta_ads: [
    { kind: "Lee", text: "Campañas, gasto y resultados de tus cuentas publicitarias" },
    { kind: "Escribe", text: "Borradores de anuncios, solo cuando tú los apruebas" },
    { kind: "Nunca", text: "Publicar ni gastar sin tu aprobación" },
  ],
  klaviyo: [
    { kind: "Lee", text: "Campañas, flows, listas, métricas e ingresos atribuidos" },
    { kind: "Escribe", text: "Plantillas y borradores de campaña que tú apruebas" },
    { kind: "Nunca", text: "Enviar emails a tus clientes sin tu aprobación" },
  ],
};

function AccessSummary({ provider }: { provider: string }) {
  const rows = ACCESS_SUMMARY[provider];
  if (!rows) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm">Esto es lo que vas a autorizar. Puedes retirarlo cuando quieras desde la ficha de la conexión.</p>
      <List as="ul" className="rounded-md border border-edge">
        {rows.map((row) => (
          <List.Item as="li" key={row.text} className="flex items-center gap-3 px-3 py-2 text-sm">
            <Badge tone={row.kind === "Nunca" ? "neutral" : row.kind === "Escribe" ? "warn" : "success"}>{row.kind}</Badge>
            <span>{row.text}</span>
          </List.Item>
        ))}
      </List>
    </div>
  );
}

// --- Asistente para conectar -----------------------------------------------

const KLAVIYO_KEY_SCOPES = ["Accounts", "Campaigns", "Flows", "Lists", "Segments", "Metrics", "Forms", "Templates", "Profiles", "Events"];

function ConnectWizard({
  open,
  initial,
  payload,
  integrations,
  onClose,
}: {
  open: boolean;
  initial: string | null;
  payload: IntegrationsResponse;
  integrations: Integrations;
  onClose: () => void;
}) {
  const [app, setApp] = useState<string | null>(initial);
  const [method, setMethod] = useState<"oauth" | "key">("oauth");
  const [domain, setDomain] = useState("");
  const [appMode, setAppMode] = useState<"public" | "custom">("public");
  const [apiKey, setApiKey] = useState("");
  const [keyDone, setKeyDone] = useState(false);
  const { actions, pending } = integrations;
  const provider = payload.providers.find((item) => item.id === app) ?? null;
  const step = keyDone ? 3 : app ? 2 : 1;
  const ordered = ["shopify", "meta_ads", "klaviyo", "instagram"]
    .map((id) => payload.providers.find((item) => item.id === id))
    .filter((item): item is IntegrationProvider => Boolean(item));
  const klaviyo = payload.providers.find((item) => item.id === "klaviyo")?.connections[0] ?? null;

  async function submit() {
    if (app === "shopify") await actions.connectShopify(domain.trim(), appMode);
    else if (app === "meta_ads") await actions.connectMeta();
    else if (app === "klaviyo" && method === "oauth") await actions.connectKlaviyo();
    else if (app === "klaviyo") {
      await actions.connectKlaviyoApiKey(apiKey);
      setKeyDone(true);
    }
  }

  const busy = pending === "shopify" || pending === "meta" || pending === "klaviyo" || pending === "klaviyo-key";
  const ready = app === "shopify" ? /\.myshopify\.com$/i.test(domain.trim()) : app === "klaviyo" && method === "key" ? apiKey.trim().startsWith("pk_") : Boolean(app);

  const stepLabels = ["Elegir", "Conectar", "Comprobar"];

  return (
    <Dialog
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      size="md"
      title={provider ? `Conectar ${provider.name}` : "Conectar una aplicación"}
      isBusy={busy}
      cancelLabel={step === 3 ? "Cerrar" : "Cancelar"}
      start={
        step === 2 && !keyDone ? (
          <Button variant="ghost" onClick={() => setApp(null)}>
            Atrás
          </Button>
        ) : undefined
      }
      primary={
        step === 2 && app !== "instagram"
          ? {
              label: app === "klaviyo" && method === "key" ? "Comprobar y conectar" : "Continuar",
              busyLabel: "Conectando…",
              disabled: !ready,
              onClick: () => void submit(),
            }
          : undefined
      }
      footer={
        step === 2 && app === "instagram" ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <ButtonLink href="/integraciones/instagram">Ir a Instagram</ButtonLink>
          </>
        ) : undefined
      }
    >
      <ol className="flex items-center gap-2 text-xs text-muted" aria-label={`Paso ${step} de 3`}>
        {stepLabels.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full text-xs font-medium",
                index + 1 <= step ? "bg-accent text-accent-foreground" : "border border-edge",
              )}
            >
              {index + 1}
            </span>
            <span className={index + 1 === step ? "font-medium text-ink" : undefined}>{label}</span>
            {index < stepLabels.length - 1 ? <span aria-hidden className="h-px w-6 bg-edge" /> : null}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {ordered.map((item) => (
            <button key={item.id} type="button" className={OPTION} disabled={!item.available} aria-pressed={app === item.id} onClick={() => setApp(item.id)}>
              <span className="row-span-2">
                <Logo provider={item.id} />
              </span>
              <b className="text-sm font-semibold">{item.name}</b>
              <small className="text-xs text-muted">{item.available ? item.description : "Disponible más adelante"}</small>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 && app === "shopify" ? (
        <>
          {payload.shopify_custom_app_available ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className={OPTION} aria-pressed={appMode === "public"} onClick={() => setAppMode("public")}>
                <span aria-hidden className={cn("row-span-2 size-4 self-start rounded-full border-2", appMode === "public" ? "border-[5px] border-accent" : "border-edge-strong")} />
                <b className="text-sm font-semibold">App pública</b>
                <small className="text-xs text-muted">La recomendada para tiendas nuevas.</small>
              </button>
              <button type="button" className={OPTION} aria-pressed={appMode === "custom"} onClick={() => setAppMode("custom")}>
                <span aria-hidden className={cn("row-span-2 size-4 self-start rounded-full border-2", appMode === "custom" ? "border-[5px] border-accent" : "border-edge-strong")} />
                <b className="text-sm font-semibold">App personalizada</b>
                <small className="text-xs text-muted">Solo si la tienda ya la tenía instalada.</small>
              </button>
            </div>
          ) : null}
          <Field label="Dominio .myshopify.com">
            <Input placeholder="tu-tienda.myshopify.com" value={domain} onChange={(event) => setDomain(event.target.value)} autoComplete="off" />
          </Field>
          <p className={NOTE}>Está en Shopify → Configuración → Dominios. No sirve el dominio público de la tienda.</p>
          <AccessSummary provider="shopify" />
          <p className={CALLOUT}>Te llevamos a Shopify para aceptar los permisos; al volver, la tienda ya aparece aquí.</p>
        </>
      ) : null}

      {step === 2 && app === "meta_ads" ? (
        <>
          <AccessSummary provider="meta_ads" />
          <p className={CALLOUT}>Te llevamos a Facebook para elegir el Business y las cuentas publicitarias. Al volver, asígnalas a su tienda.</p>
          <p className={NOTE}>Hace falta ser administrador del Business Manager.</p>
        </>
      ) : null}

      {step === 2 && app === "klaviyo" ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className={OPTION} aria-pressed={method === "oauth"} onClick={() => setMethod("oauth")}>
              <span aria-hidden className={cn("row-span-2 size-4 self-start rounded-full border-2", method === "oauth" ? "border-[5px] border-accent" : "border-edge-strong")} />
              <b className="text-sm font-semibold">Iniciar sesión en Klaviyo</b>
              <small className="text-xs text-muted">Recomendado. Aceptas los permisos en Klaviyo.</small>
            </button>
            <button type="button" className={OPTION} aria-pressed={method === "key"} onClick={() => setMethod("key")}>
              <span aria-hidden className={cn("row-span-2 size-4 self-start rounded-full border-2", method === "key" ? "border-[5px] border-accent" : "border-edge-strong")} />
              <b className="text-sm font-semibold">Clave privada</b>
              <small className="text-xs text-muted">Pega una clave pk_ creada en Klaviyo.</small>
            </button>
          </div>
          {method === "oauth" ? <AccessSummary provider="klaviyo" /> : null}
          {method === "key" ? (
            <>
              <Field label="Clave privada">
                <Input placeholder="pk_…" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" />
              </Field>
              <p className={NOTE}>En Klaviyo → Ajustes → Claves API → Crear clave privada, con acceso de lectura a:</p>
              <div className="flex flex-wrap gap-1.5">
                {KLAVIYO_KEY_SCOPES.map((scope) => (
                  <Badge key={scope}>{scope}</Badge>
                ))}
              </div>
              <p className={NOTE}>Y acceso completo a Templates, Campaigns y Flows si vas a crear piezas, campañas o flows desde NORA.</p>
            </>
          ) : null}
        </>
      ) : null}

      {step === 2 && app === "instagram" ? <p className={CALLOUT}>Instagram se configura desde su página.</p> : null}

      {step === 3 ? (
        integrations.actionError ? (
          <p className={CALLOUT}>{integrations.actionError}</p>
        ) : klaviyo ? (
          <DrawerBlock title="Permisos comprobados">
            <PermissionList rows={permissionRows("klaviyo", klaviyo.scopes)} withNote={false} />
          </DrawerBlock>
        ) : (
          <p className={NOTE}>Comprobando…</p>
        )
      ) : null}
    </Dialog>
  );
}

// --- Página -----------------------------------------------------------------

export function IntegrationsHub({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const integrations = useIntegrations(bootstrap);
  const { organization, payload, isLoading, error, reload, actions, pending, actionError } = integrations;
  // Descartar un OAuth a medias lo puede hacer quien pudo empezarlo (owner o
  // manager), no solo el consultor: mismo criterio que el backend.
  const canDiscard =
    bootstrap.profile.platform_role === "platform_admin" ||
    bootstrap.memberships.some((membership) => membership.organization_id === organization?.id && ["owner", "manager"].includes(membership.role));
  const { scope, error: scopeError, reload: reloadScope } = useStoreScope(organization?.id ?? null);
  const [welcomeStore, setWelcomeStore] = useState<string | null>(null);
  const [shopifyAssignmentDomain, setShopifyAssignmentDomain] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [wizard, setWizard] = useState<{ open: boolean; app: string | null; key: number }>({ open: false, app: null, key: 0 });
  // La cuenta Klaviyo de la tienda (no una suelta) es la que se cruza con Shopify.
  const klaviyoConnection = payload
    ? (buildStoreViews(payload, scope)
        .flatMap((store) => store.providers)
        .find((view) => view.provider === "klaviyo" && view.target)?.target ??
      payload.providers.find((provider) => provider.id === "klaviyo")?.connections[0] ??
      null)
    : null;
  const hasKlaviyo = Boolean(klaviyoConnection);
  const metrics = useCachedQuery<KlaviyoMetricsResponse>(
    organization && klaviyoConnection
      ? `/v1/organizations/${organization.id}/klaviyo/metrics?connectionId=${encodeURIComponent(klaviyoConnection.id)}`
      : null,
  );

  useEffect(() => {
    const isConnectedReturn = () => {
      const params = new URLSearchParams(window.location.search);
      return ["shopify", "meta", "klaviyo"].some((provider) =>
        ["connected", "connected_partial"].includes(params.get(provider) ?? ""),
      );
    };
    const params = new URLSearchParams(window.location.search);
    const shopifyStatus = params.get("shopify");
    const shopifyDomain = params.get("shop");
    if (["connected", "connected_partial"].includes(shopifyStatus ?? "") && shopifyDomain) {
      setShopifyAssignmentDomain(shopifyDomain);
    }
    const refreshIntegrationState = () => {
      void reload();
      void reloadScope();
      void metrics.reload();
      window.dispatchEvent(new Event("integration-status-changed"));
    };

    // El resultado del OAuth es una noticia: sale flotando y se va.
    const notice = readOAuthNotice();
    if (notice) {
      if (notice.tone === "success") toast.success(notice.text);
      else if (notice.tone === "warn") toast.warning(notice.text);
      else toast.danger(notice.text, { timeout: 0 });
      if (isConnectedReturn()) {
        // El evento de cambio se dispara al iniciar OAuth, antes de que el
        // proveedor haya autorizado y guardado la conexión. Al volver hay que
        // pedir de nuevo los datos para mostrar el estado recién persistido.
        refreshIntegrationState();
      }
    }
    const welcome = new URLSearchParams(window.location.search).get("welcome");
    if (welcome) setWelcomeStore(welcome);
    const refreshAfterOAuthReturn = (event: PageTransitionEvent) => {
      if (event.persisted && isConnectedReturn()) refreshIntegrationState();
    };
    window.addEventListener("pageshow", refreshAfterOAuthReturn);
    return () => window.removeEventListener("pageshow", refreshAfterOAuthReturn);
  }, [reload, reloadScope, metrics.reload]);

  useEffect(() => {
    if (!shopifyAssignmentDomain || !organization?.id) return;
    const domain = shopifyAssignmentDomain.trim().toLowerCase();
    const storeReady = scope?.stores.some(
      (store) => store.myshopify_domain.trim().toLowerCase() === domain,
    );
    if (storeReady) return;
    // El callback inicia el primer sync en segundo plano. Mantén el modal
    // abierto y vuelve a consultar hasta que el sync registre shopify_stores.
    // Hasta 2 minutos: si el primer sync tarda mas, la tienda aparecera sola
    // al recargar; no se sigue consultando para siempre.
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      if (ticks > 60) {
        window.clearInterval(timer);
        return;
      }
      void reloadScope();
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [organization?.id, reloadScope, scope?.stores, shopifyAssignmentDomain]);

  useEffect(() => {
    if (actionError && !wizard.open) toast.danger(actionError);
  }, [actionError, wizard.open]);

  if (isLoading) return <AsyncState status="loading" loadingLabel="Cargando integraciones..." />;
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
    return <AsyncState status="empty" emptyTitle="No hay integraciones para mostrar" emptyHint="Selecciona una organización activa y vuelve a intentarlo." />;
  }

  const allStores = buildStoreViews(payload, scope);
  const pendingRemoval = new Set(
    (payload.providers.find((provider) => provider.id === "shopify")?.connections ?? [])
      .filter((connection) => connection.status === "pending_deletion")
      .map((connection) => connection.id),
  );
  const stores = allStores.filter((store) => !pendingRemoval.has(store.connectionId));
  const pendingStores = allStores.filter((store) => pendingRemoval.has(store.connectionId));
  const accountProviders = ACCOUNT_PROVIDERS.map((id) => payload.providers.find((provider) => provider.id === id)).filter(
    (provider): provider is IntegrationProvider => Boolean(provider),
  );
  const klaviyoStore = hasKlaviyo ? klaviyoReceivesStore(metrics.data?.metrics ?? null) : null;
  const crossChecks: FixItem[] =
    klaviyoStore === false && klaviyoConnection
      ? [
          {
            key: "cross:klaviyo-shopify",
            provider: "klaviyo",
            store: stores.length === 1 ? stores[0].name : null,
            severity: "warn",
            title: "Klaviyo no está conectado a Shopify",
            detail: "Sin pedidos ni carritos en Klaviyo no hay carrito abandonado, post-compra ni ingresos atribuidos.",
            fix: null,
            connection: klaviyoConnection,
            href: KLAVIYO_INTEGRATIONS_URL,
            hrefLabel: "Abrir Klaviyo",
          },
        ]
      : [];
  const queue = buildFixQueue(stores, accountProviders, crossChecks);
  const syncable = stores.flatMap((store) =>
    store.providers
      .filter((view) => view.target && (view.provider === "shopify" || view.provider === "klaviyo"))
      .map((view) => ({ provider: view.provider as "shopify" | "klaviyo", id: view.target!.id })),
  );
  const syncing = Boolean(pending?.startsWith("retry-"));

  async function syncAll() {
    const jobs = syncable.map((item) => actions.retrySync(item.provider, item.id));
    if (payload?.providers.find((provider) => provider.id === "meta_ads")?.connections.length) jobs.push(actions.retrySync("meta", ""));
    const results = await Promise.all(jobs);
    const failed = results.filter((ok) => !ok).length;
    if (failed === 0) toast.success("Sincronización lanzada. Los datos llegan en unos minutos.");
    else if (failed === results.length) toast.danger("No se pudo lanzar ninguna sincronización. Revisa el aviso y reintenta.");
    else toast.warning(`Lanzadas ${results.length - failed} de ${results.length}. Las que fallaron muestran el motivo en su ficha.`);
  }

  function openFix(item: FixItem) {
    const store = stores.find((candidate) => candidate.providers.some((view) => view.connections.some((c) => c.id === item.connection?.id)));
    setSelection({ provider: item.provider, storeId: store?.connectionId ?? null });
  }

  function connect(app: string | null) {
    setSelection(null);
    setWizard((current) => ({ open: true, app, key: current.key + 1 }));
  }

  function closeShopifyAssignment() {
    setShopifyAssignmentDomain(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("shopify");
    url.searchParams.delete("shop");
    window.history.replaceState({}, "", url);
  }

  return (
    <div className="portal-page space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className={cn(NOTE, "mr-auto")}>
          {stores.length} {stores.length === 1 ? "tienda" : "tiendas"} · Shopify, Meta Ads y Klaviyo por tienda
        </p>
        <Button variant="secondary" disabled={syncing || syncable.length === 0} onClick={() => void syncAll()}>
          {syncing ? "Sincronizando…" : "Sincronizar todo"}
        </Button>
        <Button onClick={() => connect(null)}>Conectar</Button>
      </div>

      {welcomeStore ? <Banner tone="success">Tienda «{welcomeStore}» creada. Conéctala a Shopify, Meta y Klaviyo para empezar a ver sus datos.</Banner> : null}
      <ClientDataQualityNotice organizationId={organization?.id ?? null} />
      {!payload.schema_ready ? <Banner tone="danger">No se pudo cargar el estado de las integraciones. Reintenta en unos minutos.</Banner> : null}
      {(scope?.unassigned_count ?? 0) > 0 ? (
        <Banner tone="warn">
          E-NORA tiene {scope?.unassigned_count ?? 0} cuentas de Klaviyo o Meta conectadas, pero todavía no sabe a qué tienda pertenecen.
          La relación que ya existe dentro de esas plataformas no se registra automáticamente aquí.{" "}
          <Link href="/integraciones/cuentas">Ver diagnóstico y asignar tienda</Link>
        </Banner>
      ) : null}

      <Pulse stores={stores} accountProviders={accountProviders} queue={queue} />
      <FixQueue queue={queue} integrations={integrations} canDiscard={canDiscard} onOpen={openFix} />
      {stores.length > 0 ? (
        <StoreMap stores={stores} selected={selection} onSelect={setSelection} />
      ) : (
        <Card>
          <EmptyState
            title="Todavía no hay ninguna tienda"
            hint="Una tienda nace al conectar Shopify; después se le añaden Meta Ads y Klaviyo."
            action={<Button onClick={() => connect("shopify")}>Conectar Shopify</Button>}
          />
        </Card>
      )}
      <AccountRow providers={accountProviders} onSelect={setSelection} />
      <LooseAccounts payload={payload} scope={scope} integrations={integrations} canDiscard={canDiscard} pendingStores={pendingStores} />

      <ConnectionDrawer
        selection={selection}
        stores={stores}
        payload={payload}
        klaviyoStore={klaviyoStore}
        integrations={integrations}
        canManage={canDiscard}
        onClose={() => setSelection(null)}
        onConnect={(provider) => connect(provider)}
      />
      <ConnectWizard key={wizard.key} open={wizard.open} initial={wizard.app} payload={payload} integrations={integrations} onClose={() => setWizard((current) => ({ ...current, open: false }))} />
      {shopifyAssignmentDomain && organization ? (
        <ShopifyAccountAssignmentModal
          organizationId={organization.id}
          shopDomain={shopifyAssignmentDomain}
          scope={scope ?? null}
          loadError={scopeError}
          reload={reloadScope}
          onClose={closeShopifyAssignment}
        />
      ) : null}
    </div>
  );
}
