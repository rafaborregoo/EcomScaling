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
import { AsyncState, Banner, Button, Drawer, ErrorBlock, Link, Modal, ProviderIcon, toast } from "@/components/ui";
import { classifyAuthorizationAttempt } from "@e-nora/contracts";
import { ClientDataQualityNotice } from "./data-quality-panel";
import {
  PROVIDER_SLUG,
  readOAuthNotice,
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
  signalOf,
  type FixItem,
  type Signal,
} from "./hub-model";
import s from "./hub.module.css";

const ACCOUNT_PROVIDERS = ["instagram", "fathom"];
const KLAVIYO_INTEGRATIONS_URL = "https://www.klaviyo.com/integrations";

type Integrations = ReturnType<typeof useIntegrations>;
type Selection = { provider: string; storeId: string | null };

function Logo({ provider, small = false }: { provider: string; small?: boolean }) {
  return (
    <span className={s.logo} data-size={small ? "sm" : undefined}>
      <ProviderIcon provider={provider} size={small ? 14 : 20} />
    </span>
  );
}

function Status({ signal, children }: { signal: Signal; children: React.ReactNode }) {
  return (
    <span className={s.st} data-s={signal}>
      <i aria-hidden />
      {children}
    </span>
  );
}

function Runs({ connection }: { connection: IntegrationConnection | null }) {
  const marks = runHistory(connection);
  if (marks.length === 0) return null;
  const failed = marks.filter((mark) => mark === "fail").length;
  return (
    <span className={s.runs} role="img" aria-label={`Últimas ${marks.length} sincronizaciones: ${failed} con error`}>
      {marks.map((mark, index) => (
        <i key={index} data-r={mark} />
      ))}
    </span>
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
    <section className={s.pulse} aria-label="Resumen">
      <div data-tone={connections.length && healthy === connections.length ? "good" : undefined}>
        <b>
          {healthy}/{connections.length}
        </b>
        <span>conexiones al día</span>
      </div>
      <div data-tone={queue.length ? "bad" : "good"}>
        <b>{queue.length}</b>
        <span>{queue.length === 1 ? "necesita que hagas algo" : "necesitan que hagas algo"}</span>
      </div>
      <div>
        <b>{timeAgo(latest) ?? "—"}</b>
        <span>último dato recibido</span>
      </div>
      <div>
        <b>{missing}</b>
        <span>canales sin conectar</span>
      </div>
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
      <div className={s.secHead}>
        <h2 id="fix-title">Qué hay que arreglar</h2>
        <p>Lo más grave primero</p>
      </div>
      {queue.length === 0 ? (
        <p className={s.allOk}>Todo al día: no hay nada que arreglar.</p>
      ) : (
        <ul className={s.queue}>
          {queue.map((item) => {
            const slug = PROVIDER_SLUG[item.provider];
            const retryable = item.connection && (item.provider === "shopify" || item.provider === "klaviyo" || item.provider === "meta_ads");
            return (
              <li key={item.key} className={s.fix} data-sev={item.severity}>
                <span className={s.stripe} aria-hidden />
                <Logo provider={item.provider} />
                <div className={s.fixText}>
                  <b>{item.title}</b>
                  {item.detail ? <span>{item.detail}</span> : null}
                  <small>{item.store ?? "Cuenta"}</small>
                </div>
                <div className={s.fixActs}>
                  {item.href ? (
                    <a className={s.btn} data-primary href={item.href} target="_blank" rel="noreferrer">
                      {item.hrefLabel ?? "Abrir"}
                    </a>
                  ) : item.fix === "reconnect" && slug ? (
                    <Link className={`${s.btn} ${s.btnPrimary}`} href={`/integraciones/${slug}`}>
                      Reconectar
                    </Link>
                  ) : item.fix === "retry" && retryable ? (
                    <button
                      type="button"
                      className={s.btn}
                      data-primary
                      disabled={pending === `retry-${item.provider === "meta_ads" ? "meta" : item.provider}`}
                      onClick={() =>
                        void actions.retrySync(item.provider === "meta_ads" ? "meta" : (item.provider as "shopify" | "klaviyo"), item.connection!.id)
                      }
                    >
                      Reintentar
                    </button>
                  ) : item.fix === "discard" && canDiscard && item.connection ? (
                    <button
                      type="button"
                      className={s.btn}
                      disabled={pending === `discard-${item.connection.id}`}
                      onClick={() => void actions.discardAuthorizationAttempt(item.connection!.id)}
                    >
                      Descartar
                    </button>
                  ) : slug ? (
                    <Link className={`${s.btn} ${s.btnPrimary}`} href={`/integraciones/${slug}`}>
                      {item.fix === "connect" || item.fix === "discard" ? "Retomar" : "Revisar"}
                    </Link>
                  ) : null}
                  {item.connection ? (
                    <button type="button" className={s.btn} onClick={() => onOpen(item)}>
                      Ver
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// --- Mapa tienda × canal ---------------------------------------------------

function StoreMap({ stores, selected, onSelect }: { stores: StoreView[]; selected: Selection | null; onSelect: (selection: Selection) => void }) {
  return (
    <section aria-labelledby="stores-title">
      <div className={s.secHead}>
        <h2 id="stores-title">Tus tiendas</h2>
        <p>Pulsa una casilla para ver su ficha</p>
      </div>
      <div className={s.map}>
        <div className={s.grid} role="table" aria-label="Tiendas y canales">
          <div className={s.gh} role="columnheader">
            Tienda
          </div>
          {STORE_PROVIDERS.map((provider) => (
            <div key={provider} className={s.gh} role="columnheader">
              <Logo provider={provider} small />
              {stores[0]?.providers.find((view) => view.provider === provider)?.name ?? provider}
            </div>
          ))}
          {stores.map((store) => {
            const signals = store.providers.map((view) => signalOf(view.status, view.connections.length > 0));
            return (
              <div key={store.connectionId} role="row" style={{ display: "contents" }}>
                <Link className={s.store} href={`/integraciones/tienda/${store.connectionId}`}>
                  <b>{store.name}</b>
                  <span>{store.domain}</span>
                  <span className={s.health} aria-hidden>
                    {signals.map((signal, index) => (
                      <i key={index} data-s={signal} />
                    ))}
                  </span>
                </Link>
                {store.providers.map((view) => {
                  const connected = view.connections.length > 0;
                  const signal = signalOf(view.status, connected);
                  const account = view.target?.provider_account_name ?? view.target?.provider_account_id;
                  const when = timeAgo(view.lastSyncAt);
                  const pressed = selected?.storeId === store.connectionId && selected.provider === view.provider;
                  return (
                    <button
                      key={view.provider}
                      type="button"
                      role="cell"
                      className={s.cell}
                      aria-pressed={pressed}
                      aria-label={`${view.name} de ${store.name}: ${connected ? view.explanation.label : "sin conectar"}`}
                      onClick={() => onSelect({ provider: view.provider, storeId: store.connectionId })}
                    >
                      <Status signal={signal}>{connected ? view.explanation.label : view.available ? "Sin conectar" : "Aún no disponible"}</Status>
                      {connected ? (
                        <>
                          <span className={s.acc}>
                            {account ?? "Cuenta sin nombre"}
                            {view.connections.length > 1 ? ` · +${view.connections.length - 1}` : ""}
                          </span>
                          <span className={s.when}>{when ? `Último dato ${when}` : "Aún sin datos"}</span>
                          <Runs connection={view.target} />
                        </>
                      ) : view.available ? (
                        <span className={s.cta}>Conectar</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AccountRow({ providers, onSelect }: { providers: IntegrationProvider[]; onSelect: (selection: Selection) => void }) {
  if (providers.length === 0) return null;
  return (
    <section aria-labelledby="account-title">
      <div className={s.secHead}>
        <h2 id="account-title">De la cuenta</h2>
        <p>No dependen de ninguna tienda</p>
      </div>
      <div className={s.orgRow}>
        {providers.map((provider) => {
          const connection = provider.connections[0] ?? null;
          const explanation = explainHealth(provider.health, connection);
          const signal = provider.available ? signalOf(connection?.health.status ?? null, Boolean(connection)) : "off";
          return (
            <button key={provider.id} type="button" className={s.orgCard} onClick={() => onSelect({ provider: provider.id, storeId: null })}>
              <Logo provider={provider.id} />
              <div>
                <b>{provider.name}</b>
                <Status signal={signal}>{!provider.available ? "Aún no disponible" : connection ? explanation.label : "Sin conectar"}</Status>
                <small>{connection?.provider_account_name ?? provider.description}</small>
              </div>
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
      <div className={s.secHead}>
        <h2 id="loose-title">Sueltas</h2>
        <p>Cuentas sin tienda y tiendas que se van a borrar</p>
      </div>
      <ul className={s.loose}>
        {loose.map(({ provider, name, connection }) => {
          const attempt = classifyAuthorizationAttempt(connection);
          return (
            <li key={connection.id} className={s.looseRow}>
              <Logo provider={provider} small />
              <div className={s.grow}>
                <b>{connection.provider_account_name ?? connection.provider_account_id ?? name}</b>
                <small>
                  {attempt === "abandoned"
                    ? `${name}: se empezó a conectar y nunca se autorizó.`
                    : attempt === "in_progress"
                      ? `${name}: autorización en curso.`
                      : `${name} conectado, pero sus cifras no entran en ninguna tienda.`}
                </small>
              </div>
              {attempt === "abandoned" ? (
                canDiscard ? (
                  <button
                    type="button"
                    className={s.btn}
                    disabled={pending === `discard-${connection.id}`}
                    onClick={() => void actions.discardAuthorizationAttempt(connection.id)}
                  >
                    {pending === `discard-${connection.id}` ? "Descartando…" : "Descartar"}
                  </button>
                ) : null
              ) : attempt ? null : (
                <Link className={s.btn} href="/integraciones/cuentas">
                  Asignar a una tienda
                </Link>
              )}
            </li>
          );
        })}
        {pendingStores.map((store) => (
          <li key={store.connectionId} className={s.looseRow}>
            <Logo provider="shopify" small />
            <div className={s.grow}>
              <b>{store.name}</b>
              <small>Borrado programado: se puede restaurar durante 30 días.</small>
            </div>
            <Link className={s.btn} href={`/integraciones/tienda/${store.connectionId}`}>
              Restaurar
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- Ficha ------------------------------------------------------------------

function ConnectionDrawer({
  selection,
  stores,
  payload,
  klaviyoStore,
  integrations,
  onClose,
  onConnect,
}: {
  selection: Selection | null;
  stores: StoreView[];
  payload: IntegrationsResponse;
  klaviyoStore: boolean | null;
  integrations: Integrations;
  onClose: () => void;
  onConnect: (provider: string) => void;
}) {
  const store = selection?.storeId ? (stores.find((item) => item.connectionId === selection.storeId) ?? null) : null;
  const provider = payload.providers.find((item) => item.id === selection?.provider) ?? null;
  const view = store?.providers.find((item) => item.provider === selection?.provider) ?? null;
  const connection = view ? view.target : (provider?.connections[0] ?? null);
  const explanation = connection ? explainHealth(connection.health, connection) : null;
  const error = explainError(connection?.latest_sync?.error_message ?? connection?.last_error_message);
  const signal = signalOf(connection?.health.status ?? null, Boolean(connection));
  const slug = selection ? PROVIDER_SLUG[selection.provider] : undefined;
  const syncKey = selection?.provider === "meta_ads" ? "meta" : selection?.provider;
  const canSync = connection && (syncKey === "shopify" || syncKey === "klaviyo" || syncKey === "meta");
  const blocks = latestBlocks(connection);
  const permissions = connection ? permissionRows(selection!.provider, connection.scopes) : [];
  const history = (connection?.recent_syncs ?? []).slice(0, 10);
  const { actions, pending } = integrations;

  return (
    <Drawer isOpen={Boolean(selection)} onOpenChange={(open) => (open ? null : onClose())}>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className={`${s.drawer} w-full max-w-[640px]`} aria-label={provider ? `Ficha de ${provider.name}` : "Ficha de la conexión"}>
            <Drawer.Header>
              <div className={s.drawerHead}>
                {selection ? <Logo provider={selection.provider} /> : null}
                <div>
                  <Drawer.Heading>
                    <b>{provider?.name ?? ""}</b>
                  </Drawer.Heading>
                  <span>{store?.name ?? "De la cuenta"}</span>
                </div>
                <Drawer.CloseTrigger />
              </div>
            </Drawer.Header>
            <Drawer.Body>
              <div className={s.drawerBody}>
                <div className={s.state} data-s={signal}>
                  <b>{connection ? explanation?.label : provider?.available ? "Sin conectar" : "Aún no disponible"}</b>
                  <span>{connection ? (error?.text ?? explanation?.detail ?? "Todo en orden.") : provider?.description}</span>
                </div>

                {(selection?.provider === "klaviyo" && connection) || (selection?.provider === "shopify" && klaviyoStore !== null) ? (
                  <div className={s.cross} data-s={klaviyoStore === false ? "bad" : undefined}>
                    <span className={s.pair}>
                      <Logo provider="klaviyo" small /> Klaviyo ↔ <Logo provider="shopify" small /> Shopify
                    </span>
                    {klaviyoStore === null ? (
                      <span>Aún no hay métricas de Klaviyo para comprobarlo.</span>
                    ) : klaviyoStore ? (
                      <span>Klaviyo recibe los pedidos y carritos de la tienda.</span>
                    ) : (
                      <>
                        <span>Klaviyo no recibe eventos de la tienda: sin carrito abandonado, post-compra ni ingresos atribuidos.</span>
                        <a className={s.btn} href={KLAVIYO_INTEGRATIONS_URL} target="_blank" rel="noreferrer" style={{ justifySelf: "start" }}>
                          Conectar Shopify en Klaviyo
                        </a>
                      </>
                    )}
                  </div>
                ) : null}

                {connection ? (
                  <div className={s.blk}>
                    <h3>Cuenta</h3>
                    <dl className={s.kv}>
                      <dt>Nombre</dt>
                      <dd>{connection.provider_account_name ?? "—"}</dd>
                      <dt>Id</dt>
                      <dd className={s.mono}>{connection.provider_account_id ?? "—"}</dd>
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
                  </div>
                ) : null}

                {blocks.length > 0 ? (
                  <div className={s.blk}>
                    <h3>Qué trae</h3>
                    <div className={s.data}>
                      {blocks.map((run) => (
                        <div key={run.sync_scope} className={s.drow} data-s={runMark(run.status)}>
                          <span>{blockLabel(run.sync_scope!)}</span>
                          <b>{run.records_written.toLocaleString("es-ES")}</b>
                          <small>{timeAgo(run.finished_at ?? run.started_at) ?? "en curso"}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {permissions.length > 0 ? (
                  <div className={s.blk}>
                    <h3>Permisos</h3>
                    <div>
                      {permissions.map((row) => (
                        <div key={row.scope} className={s.perm}>
                          {row.granted ? <span data-ok>✓</span> : <span data-no>✕</span>}
                          <div>
                            {row.label}
                            <small>
                              {row.granted ? row.scope : row.required ? "Imprescindible: falta" : (row.note ?? "Opcional: sin él, esta parte no está disponible")}
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {history.length > 0 ? (
                  <div className={s.blk}>
                    <h3>Últimas sincronizaciones</h3>
                    <div>
                      {history.map((run, index) => (
                        <div key={index} className={s.tl} data-r={runMark(run.status)}>
                          <i aria-hidden />
                          <div>
                            {run.sync_scope ? blockLabel(run.sync_scope) : run.sync_type}
                            {run.error_message ? <span> · {explainError(run.error_message)?.text}</span> : null}
                          </div>
                          <span>{timeAgo(run.finished_at ?? run.started_at ?? run.created_at) ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {error?.technical || connection ? (
                  <details className={s.details}>
                    <summary>Detalle técnico</summary>
                    <dl className={s.kv} style={{ marginTop: 8 }}>
                      <dt>Conexión</dt>
                      <dd className={s.mono}>{connection?.id}</dd>
                      <dt>Estado</dt>
                      <dd className={s.mono}>
                        {connection?.status} · {connection?.health.status}
                        {connection?.health.reason ? ` · ${connection.health.reason}` : ""}
                      </dd>
                      {connection?.api_version ? (
                        <>
                          <dt>API</dt>
                          <dd className={s.mono}>{connection.api_version}</dd>
                        </>
                      ) : null}
                      {error?.technical ? (
                        <>
                          <dt>Error</dt>
                          <dd className={s.mono}>{error.technical}</dd>
                        </>
                      ) : null}
                    </dl>
                  </details>
                ) : null}
              </div>
            </Drawer.Body>
            <Drawer.Footer>
              <div className={s.drawerFoot}>
                {!connection && provider?.available ? (
                  <button type="button" className={s.btn} data-primary onClick={() => selection && onConnect(selection.provider)}>
                    Conectar {provider.name}
                  </button>
                ) : null}
                {canSync ? (
                  <button
                    type="button"
                    className={s.btn}
                    data-primary={explanation?.fix === "retry" ? true : undefined}
                    disabled={pending === `retry-${syncKey}`}
                    onClick={() => void actions.retrySync(syncKey as "shopify" | "klaviyo" | "meta", connection!.id)}
                  >
                    {pending === `retry-${syncKey}` ? "Sincronizando…" : "Sincronizar ahora"}
                  </button>
                ) : null}
                {connection && slug ? (
                  <Link className={explanation?.fix === "reconnect" ? `${s.btn} ${s.btnPrimary}` : s.btn} href={`/integraciones/${slug}`}>
                    {explanation?.fix === "reconnect" ? "Reconectar" : "Configurar"}
                  </Link>
                ) : null}
                {store ? (
                  <Link className={s.btn} href={`/integraciones/tienda/${store.connectionId}`}>
                    Ficha de la tienda
                  </Link>
                ) : null}
              </div>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
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

  return (
    <Modal isOpen={open} onOpenChange={(value) => (value ? null : onClose())}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog aria-label="Conectar una aplicación" className={s.dialog}>
            <Modal.Header>
              <Modal.Heading>{provider ? `Conectar ${provider.name}` : "Conectar una aplicación"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div style={{ display: "grid", gap: 14 }}>
                <div className={s.steps} aria-label={`Paso ${step} de 3`}>
                  {[1, 2, 3].map((index) => (
                    <i key={index} data-on={index <= step ? true : undefined} />
                  ))}
                </div>

                {step === 1 ? (
                  <div className={s.apps}>
                    {ordered.map((item) => (
                      <button key={item.id} type="button" className={s.app} disabled={!item.available} aria-pressed={app === item.id} onClick={() => setApp(item.id)}>
                        <Logo provider={item.id} />
                        <b>{item.name}</b>
                        <small>{item.available ? item.description : "Disponible más adelante"}</small>
                      </button>
                    ))}
                  </div>
                ) : null}

                {step === 2 && app === "shopify" ? (
                  <>
                    {payload.shopify_custom_app_available ? (
                      <div className={s.apps}>
                        <button type="button" className={s.opt} aria-pressed={appMode === "public"} onClick={() => setAppMode("public")}>
                          <span className={s.dot} />
                          <b>App pública</b>
                          <small>La recomendada para tiendas nuevas.</small>
                        </button>
                        <button type="button" className={s.opt} aria-pressed={appMode === "custom"} onClick={() => setAppMode("custom")}>
                          <span className={s.dot} />
                          <b>App personalizada</b>
                          <small>Solo si la tienda ya la tenía instalada.</small>
                        </button>
                      </div>
                    ) : null}
                    <label className={s.lbl} htmlFor="wizard-domain">
                      Dominio .myshopify.com
                    </label>
                    <input
                      id="wizard-domain"
                      className={s.inp}
                      placeholder="tu-tienda.myshopify.com"
                      value={domain}
                      onChange={(event) => setDomain(event.target.value)}
                      autoComplete="off"
                    />
                    <p className={s.note}>Está en Shopify → Configuración → Dominios. No sirve el dominio público de la tienda.</p>
                    <p className={s.callout}>Te llevamos a Shopify para aceptar los permisos; al volver, la tienda ya aparece aquí.</p>
                  </>
                ) : null}

                {step === 2 && app === "meta_ads" ? (
                  <>
                    <p className={s.callout}>Te llevamos a Facebook para elegir el Business y las cuentas publicitarias. Al volver, asígnalas a su tienda.</p>
                    <p className={s.note}>Hace falta ser administrador del Business Manager.</p>
                  </>
                ) : null}

                {step === 2 && app === "klaviyo" ? (
                  <>
                    <div className={s.apps}>
                      <button type="button" className={s.opt} aria-pressed={method === "oauth"} onClick={() => setMethod("oauth")}>
                        <span className={s.dot} />
                        <b>Iniciar sesión en Klaviyo</b>
                        <small>Recomendado. Aceptas los permisos en Klaviyo.</small>
                      </button>
                      <button type="button" className={s.opt} aria-pressed={method === "key"} onClick={() => setMethod("key")}>
                        <span className={s.dot} />
                        <b>Clave privada</b>
                        <small>Pega una clave pk_ creada en Klaviyo.</small>
                      </button>
                    </div>
                    {method === "key" ? (
                      <>
                        <label className={s.lbl} htmlFor="wizard-key">
                          Clave privada
                        </label>
                        <input id="wizard-key" className={s.inp} placeholder="pk_…" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" />
                        <p className={s.note}>En Klaviyo → Ajustes → Claves API → Crear clave privada, con acceso de lectura a:</p>
                        <div className={s.chips}>
                          {KLAVIYO_KEY_SCOPES.map((scope) => (
                            <code key={scope}>{scope}</code>
                          ))}
                        </div>
                        <p className={s.note}>Y acceso completo a Templates, Campaigns y Flows si vas a crear piezas, campañas o flows desde NORA.</p>
                      </>
                    ) : null}
                  </>
                ) : null}

                {step === 2 && app === "instagram" ? (
                  <p className={s.callout}>Instagram se configura desde su página.</p>
                ) : null}

                {step === 3 ? (
                  integrations.actionError ? (
                    <p className={s.callout}>{integrations.actionError}</p>
                  ) : klaviyo ? (
                    <div className={s.blk}>
                      <h3>Permisos comprobados</h3>
                      <div>
                        {permissionRows("klaviyo", klaviyo.scopes).map((row) => (
                          <div key={row.scope} className={s.perm}>
                            {row.granted ? <span data-ok>✓</span> : <span data-no>✕</span>}
                            <div>
                              {row.label}
                              <small>{row.granted ? row.scope : row.required ? "Imprescindible: falta" : "Opcional: sin él, esta parte no está disponible"}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className={s.note}>Comprobando…</p>
                  )
                ) : null}
              </div>
            </Modal.Body>
            <Modal.Footer>
              {step === 2 && !keyDone ? (
                <Button variant="ghost" onClick={() => setApp(null)}>
                  Atrás
                </Button>
              ) : null}
              <Button variant="secondary" onClick={onClose}>
                {step === 3 ? "Cerrar" : "Cancelar"}
              </Button>
              {step === 2 && app === "instagram" ? (
                <Link className={`${s.btn} ${s.btnPrimary}`} href="/integraciones/instagram">
                  Ir a Instagram
                </Link>
              ) : step === 2 ? (
                <Button disabled={!ready || busy} onClick={() => void submit()}>
                  {busy ? "Conectando…" : app === "klaviyo" && method === "key" ? "Comprobar y conectar" : "Continuar"}
                </Button>
              ) : null}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
  const { scope } = useStoreScope(organization?.id ?? null);
  const [welcomeStore, setWelcomeStore] = useState<string | null>(null);
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
    // El resultado del OAuth es una noticia: sale flotando y se va.
    const notice = readOAuthNotice();
    if (notice) {
      if (notice.tone === "success") toast.success(notice.text);
      else if (notice.tone === "warn") toast.warning(notice.text);
      else toast.danger(notice.text, { timeout: 0 });
    }
    const welcome = new URLSearchParams(window.location.search).get("welcome");
    if (welcome) setWelcomeStore(welcome);
  }, []);

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
    for (const item of syncable) await actions.retrySync(item.provider, item.id);
    if (payload?.providers.find((provider) => provider.id === "meta_ads")?.connections.length) await actions.retrySync("meta", "");
    toast.success("Sincronización lanzada. Los datos llegan en unos minutos.");
  }

  function openFix(item: FixItem) {
    const store = stores.find((candidate) => candidate.providers.some((view) => view.connections.some((c) => c.id === item.connection?.id)));
    setSelection({ provider: item.provider, storeId: store?.connectionId ?? null });
  }

  function connect(app: string | null) {
    setSelection(null);
    setWizard((current) => ({ open: true, app, key: current.key + 1 }));
  }

  return (
    <div className={s.hub}>
      <header className={s.band}>
        <div>
          <h1>Integraciones</h1>
          <p>
            {stores.length} {stores.length === 1 ? "tienda" : "tiendas"} · Shopify, Meta Ads y Klaviyo por tienda
          </p>
        </div>
        <div className={s.bandActions}>
          <button type="button" className={s.bandBtn} disabled={syncing || syncable.length === 0} onClick={() => void syncAll()}>
            {syncing ? "Sincronizando…" : "Sincronizar todo"}
          </button>
          <button type="button" className={s.bandBtn} data-primary onClick={() => connect(null)}>
            Conectar
          </button>
        </div>
      </header>

      {welcomeStore ? <Banner tone="success">Tienda «{welcomeStore}» creada. Conéctala a Shopify, Meta y Klaviyo para empezar a ver sus datos.</Banner> : null}
      <ClientDataQualityNotice organizationId={organization?.id ?? null} />
      {!payload.schema_ready ? <Banner tone="danger">No se pudo cargar el estado de las integraciones. Reintenta en unos minutos.</Banner> : null}

      <Pulse stores={stores} accountProviders={accountProviders} queue={queue} />
      <FixQueue queue={queue} integrations={integrations} canDiscard={canDiscard} onOpen={openFix} />
      {stores.length > 0 ? (
        <StoreMap stores={stores} selected={selection} onSelect={setSelection} />
      ) : (
        <section className={s.allOk} style={{ background: "var(--ih-surface-2)", color: "inherit", fontWeight: 400 }}>
          Todavía no hay ninguna tienda. Una tienda nace al conectar Shopify; después se le añaden Meta Ads y Klaviyo.{" "}
          <button type="button" className={s.btn} data-primary onClick={() => connect("shopify")}>
            Conectar Shopify
          </button>
        </section>
      )}
      <AccountRow providers={accountProviders} onSelect={setSelection} />
      <LooseAccounts payload={payload} scope={scope} integrations={integrations} canDiscard={canDiscard} pendingStores={pendingStores} />

      <ConnectionDrawer
        selection={selection}
        stores={stores}
        payload={payload}
        klaviyoStore={klaviyoStore}
        integrations={integrations}
        onClose={() => setSelection(null)}
        onConnect={(provider) => connect(provider)}
      />
      <ConnectWizard key={wizard.key} open={wizard.open} initial={wizard.app} payload={payload} integrations={integrations} onClose={() => setWizard((current) => ({ ...current, open: false }))} />
    </div>
  );
}
