"use client";


import { StoreIcon } from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useState,
} from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/money";
import { useCachedQuery } from "@/lib/use-cached-query";
import { panelPct } from "@e-nora/contracts";
import { useProfitability } from "@/app/panel/panel-data";
import { CONNECTION_STATES, stateFromStatus } from "@/app/integraciones/store-view-model";
import { timeAgo } from "@/lib/elapsed";
import {
  Avatar,
  avatarInitials,
  AvatarFallback,
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  Link,
  List,
  LoadingBlock,
  Metric,
  Select,
  Tabs,
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
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ButtonLink,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui";

// Navegador de tiendas del consultor: sus tiendas propias (membership real) y
// las de su cartera (consultant_assignment), cada una enlazando al dashboard de
// esa tienda. La gestión de cartera (altas, suscripción, borrado) sigue en
// /consultor; aquí solo se pivota entre tiendas, propias y de clientes.

type OwnStore = {
  organization_id: string;
  display_name: string;
  status: string;
  currency_code: string | null;
  meta_currency_code: string | null;
  net_sales: number | null;
  orders: number;
  meta_spend: number | null;
  roas: number | null;
};

const ORGANIZATION_STATUS_LABELS: Record<string, string> = {
  onboarding: "Incorporación",
  active: "Activa",
  suspended: "Suspendida",
  cancelled: "Cancelada",
  pending_deletion: "Borrado pendiente",
};

function statusLabel(status: string) {
  return ORGANIZATION_STATUS_LABELS[status] ?? status;
}

function OpenStoreLink({
  organizationId,
  connectionId,
  children,
}: {
  organizationId: string;
  connectionId?: string | null;
  children: ReactNode;
}) {
  const { setOrganizationId } = useActiveOrganization();
  return (
    <Link
      href={withPortalRouteContext("/dashboard", organizationId, connectionId)}
      onClick={() => setOrganizationId(organizationId)}
      className="font-medium no-underline hover:text-brand hover:no-underline"
    >
      {children}
    </Link>
  );
}

function OpenStoreButton({ organizationId, connectionId }: { organizationId: string; connectionId?: string | null }) {
  const { setOrganizationId } = useActiveOrganization();
  return (
    <Link href={withPortalRouteContext("/dashboard", organizationId, connectionId)} onClick={() => setOrganizationId(organizationId)}>
      <Button variant="secondary" size="sm">
        Abrir
      </Button>
    </Link>
  );
}

// Alta y edición comparten campos (nombre + moneda); `store` presente = editar.
function OwnStoreDialog({
  store,
  onOpenChange,
  onDone,
}: {
  store?: OwnStore;
  onOpenChange: (open: boolean) => void;
  onDone: (result: { id: string; name: string }) => void;
}) {
  const [displayName, setDisplayName] = useState(store?.display_name ?? "");
  const [currencyCode, setCurrencyCode] = useState(store?.currency_code ?? "EUR");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isEdit = Boolean(store);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        isEdit
          ? `/v1/consultant/organizations/${store!.organization_id}`
          : "/v1/consultant/own-stores",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: displayName,
            currency_code: currencyCode,
          }),
        },
      );
      if (response.ok) {
        toast.success(isEdit ? "Tienda actualizada." : "Tienda creada.");
        if (isEdit) {
          onDone({ id: store!.organization_id, name: displayName });
        } else {
          const payload = (await response.json()) as {
            organization: { id: string };
          };
          onDone({ id: payload.organization.id, name: displayName });
        }
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError(
        `No se pudo ${isEdit ? "actualizar" : "crear"} la tienda. Revisa la conexión e inténtalo de nuevo.`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      busy={isSaving}
      dirty={displayName !== (store?.display_name ?? "") || currencyCode !== (store?.currency_code ?? "EUR")}
    >
      <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar tienda" : "Añadir mi tienda"}</DialogTitle>
      </DialogHeader>
    <form id="own-store-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_8rem]">
      <Field label="Nombre de la tienda">
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Mi tienda"
          required
        />
      </Field>
      <Field label="Moneda">
        <Input
          value={currencyCode}
          onChange={(event) =>
            setCurrencyCode(event.target.value.toUpperCase().slice(0, 3))
          }
          maxLength={3}
        />
      </Field>
      {error ? (
        <div className="sm:col-span-2">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : null}
    </form>
      <DialogFooter>
        <DialogClose>Cancelar</DialogClose>
        <Button type="submit" form="own-store-form" disabled={isSaving || !displayName.trim()}>
          {isSaving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear tienda"}
        </Button>
      </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OwnStoresCard({ days, query }: { days: number; query: string }) {
  const { setOrganizationId } = useActiveOrganization();
  const storesQuery = useCachedQuery<{ stores?: OwnStore[] }>(
    `/v1/consultant/own-stores?days=${days}`,
  );
  const needle = query.trim().toLowerCase();
  const allStores = storesQuery.data?.stores ?? null;
  const stores =
    allStores && needle
      ? allStores.filter((store) => store.display_name.toLowerCase().includes(needle))
      : allStores;
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (storesQuery.error
    ? "No se pudieron cargar tus tiendas. Revisa la conexión e inténtalo de nuevo."
    : null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OwnStore | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadStores = useCallback(() => {
    setActionError(null);
    storesQuery.reload();
  }, [storesQuery.reload]);

  // Tras crear una tienda: la ponemos activa y arrancamos el onboarding de
  // integraciones (conectar Shopify/Meta/Klaviyo) desde /integraciones. Recarga
  // completa para que el shell recoja la membership nueva del bootstrap.
  function startOnboarding(organizationId: string, name: string) {
    setOrganizationId(organizationId);
    window.location.assign(
      `/integraciones?welcome=${encodeURIComponent(name)}`,
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${deleteTarget.organization_id}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        toast.success("Tienda marcada para borrado.");
        setDeleteTarget(null);
        void loadStores();
      } else {
        setActionError(await readApiError(response));
      }
    } catch {
      setActionError("No se pudo borrar la tienda. Reintenta.");
    } finally {
      setIsDeleting(false);
    }
  }

  const editingStore = allStores?.find((store) => store.organization_id === editingId);
  const storeDialog = isAdding || editingStore ? (
    <OwnStoreDialog
      store={editingStore}
      onOpenChange={(open) => {
        if (open) return;
        setIsAdding(false);
        setEditingId(null);
      }}
      onDone={({ id, name }) => {
        if (editingStore) {
          setEditingId(null);
          void loadStores();
          return;
        }
        setIsAdding(false);
        startOnboarding(id, name);
      }}
    />
  ) : null;

  // Sin tiendas propias: no ocupamos una card entera, solo el disparador.
  if (allStores !== null && allStores.length === 0 && !error) {
    return (
      <>
        <Button variant="secondary" size="sm" onClick={() => setIsAdding(true)}>
          Añadir mi tienda
        </Button>
        {storeDialog}
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis tiendas</CardTitle>
        <CardDescription>{`Tiendas de tu propiedad, con sus totales de los últimos ${days} días.`}</CardDescription>
        <CardAction><Button
          variant="secondary"
          size="sm"
          onClick={() => setIsAdding(true)}
        >
          Añadir mi tienda
        </Button></CardAction>
      </CardHeader>
      <CardContent>
        {storeDialog}
        {error ? (
          <ErrorBlock>{error}</ErrorBlock>
        ) : stores === null ? (
          <LoadingBlock label="Cargando tus tiendas..." />
        ) : stores.length === 0 ? (
          <EmptyState size="sm" title="Ninguna tienda tuya coincide con la búsqueda" />
        ) : (
          <List as="ul">
            {stores.map((store) => (
              <Item key={store.organization_id} className="first:pt-1 last:pb-1" render={<li />}>
                    <ItemMedia>
                      <Avatar>
                        <AvatarFallback>{avatarInitials(store.display_name)}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        <OpenStoreLink organizationId={store.organization_id}>
                          {store.display_name}
                        </OpenStoreLink>
                        <Badge
                          tone={store.status === "active" ? "success" : "neutral"}
                        >
                          {statusLabel(store.status)}
                        </Badge>
                      </ItemTitle>
                      <ItemDescription>
                        {/* Sin moneda unica el API no suma ventas (no mezcla divisas): se dice, no se pinta "—". */}
                        {store.net_sales == null
                          ? store.orders > 0
                            ? "Ventas: moneda no comparable"
                            : "Sin ventas"
                          : formatMoney(store.net_sales, store.currency_code)}{" "}
                        ·{" "}
                        {store.orders} {store.orders === 1 ? "pedido" : "pedidos"}
                        {" · "}
                        {store.roas == null
                          ? "ROAS —"
                          : `ROAS ${store.roas.toFixed(2)}`}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions role="group" aria-label="Acciones de la tienda">
                      <OpenStoreButton organizationId={store.organization_id} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(store.organization_id)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(store)}
                      >
                        Borrar
                      </Button>
                    </ItemActions>
              </Item>
            ))}
          </List>
        )}
        {/* confirmDelete lo cierra al acabar bien; si falla, sigue abierto. */}
        {deleteTarget ? (
          <AlertDialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-danger/10 text-danger">
                  <StoreIcon />
                </AlertDialogMedia>
                <AlertDialogTitle>¿Borrar la tienda «{deleteTarget.display_name}»?</AlertDialogTitle>
                <AlertDialogDescription>Se borra con 30 días de gracia para restaurarla.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogConfirmPhrase phrase={deleteTarget.display_name} />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={async () => {
                    await confirmDelete();
                    return false;
                  }}
                >
                  Borrar tienda
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ProfitabilityQuery = ReturnType<typeof useProfitability>;
type ProfitStore = NonNullable<ProfitabilityQuery["data"]>["stores"][number];
type Tier = ProfitStore["tier"];

// Una linea de decision por tienda: lo que el consultor necesita para elegir
// donde entrar (beneficio, margen contra objetivo, palanca en EUR/mes y si el
// dato es fiable). El detalle completo sigue en el Panel de rentabilidad.
function storeSignals(store: ProfitStore): string[] {
  const money = (value: number) => formatMoney(value, store.currency_code);
  if (store.tier === "datos") {
    const blocking = store.flags.filter((flag) => flag.blocking).map((flag) => flag.label);
    return [blocking.length ? `Falta: ${blocking.join(", ")}` : "Beneficio no fiable todavía"];
  }
  const signals = [
    `Beneficio ${money(store.net_profit)}`,
    store.margin_target == null
      ? `margen ${panelPct(store.margin_pct)}`
      : `margen ${panelPct(store.margin_pct)} (objetivo ${panelPct(store.margin_target)})`,
  ];
  if (store.ads_spend > 0) signals.push(`ads ${money(store.ads_spend)}`);
  if (store.levers[0]) {
    signals.push(`${store.levers[0].palanca}: +${money(store.levers[0].eur_mes)}/mes`);
  }
  return signals;
}

// En la base Meta es "meta_ads". Una organizacion puede tener varias filas por
// proveedor (reintentos de OAuth a medias): manda la que mas recientemente
// sincronizo, y las "pending" (OAuth sin terminar) no cuentan.
const PROVIDERS = [
  { id: "shopify", label: "Shopify" },
  { id: "meta_ads", label: "Meta" },
  { id: "klaviyo", label: "Klaviyo" },
];

function freshest<T extends { status: string; last_sync_at: string | null }>(rows: T[]): T | undefined {
  return rows
    .filter((row) => row.status !== "pending")
    .sort((a, b) => (b.last_sync_at ?? "").localeCompare(a.last_sync_at ?? ""))[0];
}

// De que fuente salen las cifras y si estan al dia: sin esto, un margen malo
// puede ser solo un sync parado. Mismo estado que /integraciones, sin cuentas
// ni mensajes de error (son privados de cada cliente).
function ConnectionChips({
  connections,
}: {
  connections: NonNullable<NonNullable<ProfitabilityQuery["data"]>["connections"]>;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {PROVIDERS.map((provider) => {
        const connection = freshest(connections.filter((item) => item.provider === provider.id));
        if (!connection) {
          return (
            <Badge key={provider.id} tone="neutral">
              {provider.label}: sin conectar
            </Badge>
          );
        }
        const state = CONNECTION_STATES[stateFromStatus(connection.status, connection.needs_reconnect)];
        return (
          <Badge key={provider.id} tone={state.tone}>
            {provider.label}: {state.label.toLowerCase()}
            {connection.last_sync_at ? ` · ${timeAgo(connection.last_sync_at)}` : ""}
          </Badge>
        );
      })}
    </div>
  );
}

// Tiendas de los clientes (no los clientes: esa lista es la de Clientes). Salen
// de la misma lectura que el Panel de rentabilidad, asi que cada tienda enlaza
// directo a su nivel del Panel.
function ClientStoresCard({
  profitability,
  excludeIds,
  query,
  tier,
  days,
}: {
  profitability: ProfitabilityQuery;
  excludeIds: Set<string>;
  query: string;
  tier: Tier | null;
  days: number;
}) {
  const { setOrganizationId } = useActiveOrganization();
  const error = profitability.error && !profitability.data
    ? "No se pudieron cargar las tiendas de tus clientes. Revisa la conexión e inténtalo de nuevo."
    : null;
  const needle = query.trim().toLowerCase();
  const stores = (profitability.data?.stores ?? [])
    .filter((store) => !excludeIds.has(store.organization_id))
    .filter((store) => !tier || store.tier === tier)
    .filter(
      (store) =>
        !needle ||
        store.shop_name.toLowerCase().includes(needle) ||
        store.organization_name.toLowerCase().includes(needle),
    )
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.lever_total - a.lever_total || b.revenue - a.revenue);
  const failed = profitability.data?.failed_stores ?? [];
  const connectionsByOrg = new Map<string, NonNullable<ProfitabilityQuery["data"]>["connections"]>();
  for (const connection of profitability.data?.connections ?? []) {
    connectionsByOrg.set(connection.organization_id, [...(connectionsByOrg.get(connection.organization_id) ?? []), connection]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiendas de tus clientes</CardTitle>
        <CardDescription>{`Últimos ${days} días, sin IVA. Primero las que pierden dinero; dentro de cada grupo, la palanca más grande.`}</CardDescription>
        <CardAction><Link
          href="/consultor?tab=gestion"
          className="text-xs text-muted no-underline hover:text-brand hover:no-underline"
        >
          Gestionar clientes
        </Link></CardAction>
      </CardHeader>
      <CardContent>
        {failed.length > 0 ? (
          <div className="mb-4">
            <ErrorBlock>
              No se pudo leer {failed.map((store) => store.shop_name).join(", ")}. No aparece con datos a medias; recarga en unos segundos.
            </ErrorBlock>
          </div>
        ) : null}
        {error ? (
          <ErrorBlock>{error}</ErrorBlock>
        ) : profitability.isLoading ? (
          <LoadingBlock label="Cargando tiendas..." />
        ) : stores.length === 0 ? (
          <EmptyState
            title={needle || tier ? "Ninguna tienda coincide" : "Aún no hay tiendas de clientes"}
            hint={needle || tier ? "Quita el filtro o prueba con otro nombre." : "Cuando un cliente conecte Shopify, su tienda aparecerá aquí."}
          />
        ) : (
          <List as="ul">
            {stores.map((store) => {
              const badge = TIER_BADGE[store.tier];
              const panelHref = store.connection_id
                ? `/panel?organizationId=${store.organization_id}&connectionId=${store.connection_id}`
                : `/panel?organizationId=${store.organization_id}`;
              const change = store.revenue_change_pct;
              return (
                <Item key={store.store_id} className="first:pt-1 last:pb-1" render={<li />}>
                    <ItemMedia>
                      <Avatar>
                        <AvatarFallback>{avatarInitials(store.shop_name)}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        <OpenStoreLink organizationId={store.organization_id} connectionId={store.connection_id}>{store.shop_name}</OpenStoreLink>
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </ItemTitle>
                      <ItemDescription>
                        {store.organization_name} · {formatMoney(store.revenue, store.currency_code)}
                        {change == null ? null : (
                          <span className={change < 0 ? "text-danger" : "text-success"}>
                            {" "}({panelPct(change)})
                          </span>
                        )}{" "}
                        · {store.orders} {store.orders === 1 ? "pedido" : "pedidos"}
                      </ItemDescription>
                      <ItemDescription className={store.tier === "datos" ? "text-warning" : "text-ink"}>
                        {storeSignals(store).join(" · ")}
                      </ItemDescription>
                      <ConnectionChips connections={connectionsByOrg.get(store.organization_id) ?? []} />
                    </ItemContent>
                    <ItemActions role="group" aria-label="Acciones de la tienda">
                      {/* Enlaces con forma de botón: un <a> con un <button> dentro son dos paradas de tabulador. */}
                      {store.tier === "datos" ? (
                        <ButtonLink
                          href="/configuracion?section=rentabilidad"
                          variant="ghost"
                          size="sm"
                          onClick={() => setOrganizationId(store.organization_id)}
                        >
                          Completar costes
                        </ButtonLink>
                      ) : null}
                      <ButtonLink href={panelHref} variant="secondary" size="sm" onClick={() => setOrganizationId(store.organization_id)}>
                        Rentabilidad
                      </ButtonLink>
                      <OpenStoreButton organizationId={store.organization_id} connectionId={store.connection_id} />
                    </ItemActions>
                </Item>
              );
            })}
          </List>
        )}
        {profitability.data?.truncated ? (
          <p className="mt-4 text-xs text-muted">La cartera es muy grande: se muestran las primeras 150 tiendas.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

const TIER_ORDER = { pierde: 0, datos: 1, bajo: 2, ok: 3 } as const;
const TIER_BADGE = {
  pierde: { label: "Pierde dinero", tone: "danger" as const },
  datos: { label: "Datos sin completar", tone: "warn" as const },
  bajo: { label: "Bajo objetivo", tone: "warn" as const },
  ok: { label: "Cumple", tone: "success" as const },
};

// Lo que importa de un vistazo antes de bajar a la lista: cuantas tiendas hay,
// cuales pierden dinero y cuales no se pueden juzgar todavia. Mismo criterio
// (tier) que el Panel de rentabilidad. Cada contador de estado filtra la lista.
function StoresSummary({
  profitability,
  excludeIds,
  ownCount,
  tier,
  onTierChange,
  days,
}: {
  profitability: ProfitabilityQuery;
  excludeIds: Set<string>;
  ownCount: number;
  tier: Tier | null;
  onTierChange: (tier: Tier | null) => void;
  days: number;
}) {
  const stores = (profitability.data?.stores ?? []).filter((store) => !excludeIds.has(store.organization_id));
  const count = (key: Tier) => stores.filter((store) => store.tier === key).length;
  const currencies = new Set(stores.map((store) => store.currency_code));
  const currency = currencies.size === 1 ? [...currencies][0] : null;
  const revenue = stores.reduce((sum, store) => sum + store.revenue, 0);
  const levers = stores.reduce((sum, store) => sum + store.lever_total, 0);
  const tierTiles: Array<{ key: Tier; label: string; hint: string; tone: "danger" | "warn" }> = [
    { key: "pierde", label: "Pierden dinero", hint: `margen negativo en ${days} días`, tone: "danger" },
    { key: "datos", label: "Datos sin completar", hint: "su beneficio no es fiable", tone: "warn" },
    { key: "bajo", label: "Bajo objetivo", hint: "margen por debajo del pactado", tone: "warn" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Metric card label="Tiendas" value={ownCount + stores.length} hint={`${ownCount} propias · ${stores.length} de clientes`} />
      {tierTiles.map((tile) => {
        const value = count(tile.key);
        const active = tier === tile.key;
        return (
          <button
            key={tile.key}
            type="button"
            aria-pressed={active}
            disabled={value === 0 && !active}
            onClick={() => onTierChange(active ? null : tile.key)}
            className={`rounded-md text-left outline-offset-2 disabled:cursor-default ${active ? "ring-2 ring-accent" : ""}`}
          >
            <Metric card label={tile.label} value={value} tone={value > 0 ? tile.tone : "default"} hint={active ? "Filtrando · pulsa para quitar" : tile.hint} />
          </button>
        );
      })}
      <Metric
        card
        label="Ventas de clientes"
        value={currency ? formatMoney(revenue, currency) : "—"}
        hint={
          currency
            ? levers > 0
              ? `palancas: +${formatMoney(levers, currency)}/mes`
              : `últimos ${days} días, sin IVA`
            : "monedas distintas: se ven por tienda"
        }
      />
    </div>
  );
}

type Scope = "todas" | "propias" | "clientes";
const SCOPES: Array<{ key: Scope; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "propias", label: "Propias" },
  { key: "clientes", label: "De clientes" },
];
const DAY_OPTIONS = [7, 30, 90] as const;

function TiendasContent({ ownStoreIds }: { ownStoreIds: Set<string> }) {
  const [scope, setScope] = useState<Scope>("todas");
  const [query, setQuery] = useState("");
  const [days, setDays] = useState(30);
  const [tier, setTier] = useState<Tier | null>(null);
  // Una sola lectura de rentabilidad para el resumen y la lista: mismas cifras.
  const profitability = useProfitability(days, null);
  return (
    <div className="portal-page space-y-6">
      <StoresSummary
        profitability={profitability}
        excludeIds={ownStoreIds}
        ownCount={ownStoreIds.size}
        tier={tier}
        onTierChange={(next) => {
          setTier(next);
          if (next) setScope("clientes");
        }}
        days={days}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={SCOPES.map((item) => ({ value: item.key, label: item.label }))}
          value={scope}
          onChange={(key) => {
            setScope(key as Scope);
            if (key === "propias") setTier(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Periodo"
            value={String(days)}
            onChange={(value) => setDays(Number(value))}
            options={DAY_OPTIONS.map((value) => ({ value: String(value), label: `Últimos ${value} días` }))}
          />
          <Input
            type="search"
            aria-label="Buscar tienda o cliente"
            placeholder="Buscar tienda o cliente…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full max-w-xs"
          />
        </div>
      </div>
      {scope !== "clientes" ? <OwnStoresCard days={days} query={query} /> : null}
      {scope !== "propias" ? (
        <ClientStoresCard profitability={profitability} excludeIds={ownStoreIds} query={query} tier={tier} days={days} />
      ) : null}
    </div>
  );
}

export default function TiendasPage() {
  return (
    <PortalShell title="Tiendas">
      {(bootstrap) => (
        // Las tiendas propias (membership real) no son cartera: se excluyen de
        // las de clientes aunque el backend las devuelva (p. ej. platform_admin
        // ve todas las organizaciones).
        <TiendasContent
          ownStoreIds={
            new Set(
              bootstrap.memberships
                .filter((membership) => membership.accessSource === "membership")
                .map((membership) => membership.organization_id),
            )
          }
        />
      )}
    </PortalShell>
  );
}
