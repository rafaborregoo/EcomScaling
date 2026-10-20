"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, invalidateApiGetCache, type BootstrapResponse } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { useShopifyOverview } from "@/hooks/use-shopify-overview";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import { useModuleSummary } from "@/components/module-summary";
import { ClientShopify } from "../dashboard/client-shopify";
import { ChannelBand } from "../dashboard/channel-band";
import { ShopifyTrustStrip } from "./trust-strip";
import { PortfolioAttention } from "@/components/portfolio-attention";
import { useProfitability } from "../panel/panel-data";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  IconChevronRight,
  Link,
  List,
  LoadingBlock,
  RetryIcon,
  Select,
  toast,
} from "@/components/ui";

type ShopifyMetrics = {
  organization_id: string;
  selected_connection_id: string | null;
  store_id: string | null;
  order_history: {
    earliest_imported_order_at: string | null;
    access_scope: "all_orders" | "last_60_days" | "unknown";
  };
  period: { days: number | "all"; start: string | null; end: string };
  sales: {
    orders_count: number;
    gross_sales: number;
    net_sales: number;
    discounts: number;
    refunds: number;
    units_sold: number;
    aov: number;
  };
  top_products: Array<{
    product_id: string;
    title: string;
    quantity_sold: number;
    revenue: number;
    lines_with_exact_metrics: number;
    lines_with_estimated_metrics: number;
    lines_without_metrics: number;
  }>;
  stock: {
    tracked_items: number;
    total_available: number;
    low_stock_items: number;
    out_of_stock_items: number;
  };
  margin: {
    revenue: number;
    cogs: number;
    gross_margin: number;
    margin_pct: number;
    items_with_cost: number;
    items_without_cost: number;
    // Lineas valoradas con el coste que Shopify reporta HOY, porque no hay un
    // coste fechado que cubra la fecha del pedido.
    items_with_estimated_cost: number;
    lines_with_exact_metrics: number;
    lines_with_estimated_metrics: number;
    lines_without_metrics: number;
  };
  // Embudo: sesiones de ShopifyQL + pedidos propios. `null` o
  // `has_sessions: false` = todavía no tenemos el dato (bloque `sessions` sin
  // ejecutar o conexión sin permiso de informes), que no es lo mismo que 0.
  funnel: {
    has_sessions: boolean;
    sessions: number;
    online_store_visitors: number;
    conversion_rate_shopify: number | null;
    orders_count: number;
    net_sales: number;
    conversion_rate_own: number | null;
    revenue_per_session: number | null;
    days_with_sessions: number;
  } | null;
  funnel_daily: Array<{
    date: string;
    sessions: number;
    orders_count: number;
    conversion_rate_own: number | null;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const PERIODS: Array<number | "all"> = [7, 30, 90, 180, 365, "all"];

function ShopifyBusinessView({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const {
    organizationId: selectedOrganizationId,
    setOrganizationId: setSelectedOrganizationId,
  } = useActiveOrganization();
  const {
    connectionId: selectedConnectionId,
    setConnectionId: setSelectedConnectionId,
  } = useActiveConnection();
  const [hasAppliedUrlSelection, setHasAppliedUrlSelection] = useState(false);
  const [periodDays, setPeriodDays] = useState<number | "all">(30);
  const [costsVersion, setCostsVersion] = useState(0);

  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  const metricsParams = new URLSearchParams({ days: String(periodDays) });
  if (selectedConnectionId) {
    metricsParams.set("connectionId", selectedConnectionId);
  }
  const metricsQuery = useCachedQuery<ShopifyMetrics>(
    organization
      ? `/v1/organizations/${organization.id}/shopify/metrics?${metricsParams.toString()}`
      : null,
  );
  const metrics = metricsQuery.data ?? null;

  const { consultant } = useAssignedConsultant(organization?.id ?? null);

  const {
    overview,
    isLoading,
    isRefreshing,
    error,
    reload,
    isSyncing,
    syncError,
    triggerSync,
  } = useShopifyOverview(organization?.id, selectedConnectionId);

  const currency = overview?.store?.currency_code ?? null;

  // Las cifras ya se pintan en el hero y en la tira de KPIs de abajo; aqui solo
  // se publican al Consultor IA como "vista actual" (ver components/module-summary).
  const costsIncomplete =
    metrics !== null &&
    (metrics.margin.items_without_cost > 0 ||
      metrics.margin.lines_without_metrics > 0);
  useModuleSummary(
    metrics
      ? {
          period:
            metrics.period.days === "all"
              ? metrics.order_history.earliest_imported_order_at
                ? `Desde ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(metrics.order_history.earliest_imported_order_at))}`
                : "Histórico disponible"
              : `Últimos ${metrics.period.days} días`,
          metrics: [
            {
              label: "Ventas netas",
              value: formatMoney(metrics.sales.net_sales, currency),
              hint: `${metrics.sales.orders_count.toLocaleString("es-ES")} pedidos`,
            },
            {
              label: "Ticket medio",
              value: formatMoney(metrics.sales.aov, currency),
            },
            {
              label: "Margen bruto",
              value: costsIncomplete
                ? "Parcial"
                : `${metrics.margin.margin_pct.toFixed(1)}%`,
              tone: costsIncomplete
                ? "warn"
                : metrics.margin.margin_pct < 20
                  ? "danger"
                  : metrics.margin.margin_pct < 35
                    ? "warn"
                    : "success",
              hint: costsIncomplete
                ? "Faltan costes o líneas de pedidos"
                : formatMoney(metrics.margin.gross_margin, currency),
            },
            {
              label: "Conversión",
              value:
                metrics.funnel?.has_sessions &&
                metrics.funnel.conversion_rate_own != null
                  ? `${(metrics.funnel.conversion_rate_own * 100).toFixed(2)}%`
                  : "Sin datos",
              hint: metrics.funnel?.has_sessions
                ? `${metrics.funnel.sessions.toLocaleString("es-ES")} sesiones`
                : "Falta el permiso de informes de Shopify",
            },
            {
              label: "Sin stock",
              value: metrics.stock.out_of_stock_items.toLocaleString("es-ES"),
              tone: metrics.stock.out_of_stock_items > 0 ? "danger" : "success",
              hint: `${metrics.stock.low_stock_items} con stock bajo`,
            },
            {
              label: "Productos sin coste",
              value: metrics.margin.items_without_cost.toLocaleString("es-ES"),
              tone: metrics.margin.items_without_cost > 0 ? "warn" : "success",
              hint:
                metrics.margin.items_without_cost > 0
                  ? "Faltan costes; el margen puede cambiar cuando se completen"
                  : "Sin líneas pendientes de coste detectadas",
            },
          ],
        }
      : null,
  );

  function onCostsChanged() {
    if (!organization) return;
    invalidateApiGetCache();
    invalidateCachedQueries(`/v1/organizations/${organization.id}`);
    setCostsVersion((version) => version + 1);
    metricsQuery.reload();
  }

  useEffect(() => {
    if (hasAppliedUrlSelection || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const organizationId = params.get("organizationId");
    const connectionId = params.get("connectionId");

    if (
      organizationId &&
      bootstrap.memberships.some(
        (membership) => membership.organization_id === organizationId,
      )
    ) {
      setSelectedOrganizationId(organizationId);
    }
    if (connectionId) {
      setSelectedConnectionId(connectionId);
    }

    setHasAppliedUrlSelection(true);
  }, [
    bootstrap.memberships,
    hasAppliedUrlSelection,
    setSelectedConnectionId,
    setSelectedOrganizationId,
  ]);

  // Aqui vivia un efecto que, si no habia tienda elegida, ponia la que el
  // backend hubiera resuelto por su cuenta. Hacia imposible usar "Todas las
  // tiendas": el selector del shell escribe "" para decir "agregado", este
  // efecto lo leia como "no ha elegido nada todavia" y devolvia una tienda
  // concreta, asi que la seleccion rebotaba cada vez.
  //
  // "" no es ausencia de eleccion, es una eleccion -- el propio shell lo
  // documenta ("Por defecto: '' = todas las tiendas del cliente agregadas").
  // Las metricas ya agregan bien sin connectionId; el unico que no sabe
  // agregar es el overview, y eso se resuelve abajo diciendolo en pantalla en
  // vez de cambiando la seleccion del usuario a su espalda.

  if (isLoading) {
    return (
      <div className="border-t border-ink/20 pt-5">
        <AsyncState status="loading" loadingLabel="Cargando datos Shopify..." />
      </div>
    );
  }

  if (error) {
    // El código técnico solo le sirve al consultor; el cliente necesita saber
    // que no es culpa suya y cómo reintentar.
    return (
      <AsyncState
        status="error"
        error={
          <>
            No hemos podido cargar los datos de tu tienda.{" "}
            <button type="button" className="underline" onClick={() => void reload()}>
              Reintentar
            </button>
            {isConsultant ? <span className="block text-xs opacity-70">{error}</span> : null}
          </>
        }
      />
    );
  }

  if (!overview) {
    return (
      <AsyncState
        status="empty"
        emptyTitle="No hay datos Shopify disponibles"
        emptyHint="Conecta una tienda o selecciona otra conexión activa."
      />
    );
  }

  const connectionStatus = overview.connection?.status;
  const canShowStoreDashboard = Boolean(overview.store);

  if (!canShowStoreDashboard || !organization) {
    return (
      <div className="portal-page">
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-separator py-2"
        >
          <p className="text-sm text-muted">
            {connectionStatus === "syncing"
              ? "Shopify está sincronizando la tienda."
              : connectionStatus === "error"
                ? "La conexión Shopify necesita atención. Revísala en"
                : connectionStatus === "connected"
                  ? "Shopify está conectada, pero la tienda todavía se está preparando. Revísala en"
                  : "Shopify todavía no está conectada. Completa la conexión en"}{" "}
            {connectionStatus !== "syncing" ? (
              <Link href="/integraciones">Integraciones</Link>
            ) : null}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-0 px-2"
            aria-label="Actualizar estado de Shopify"
            title="Actualizar estado"
            disabled={isRefreshing}
            onClick={() => void reload()}
          >
            <RetryIcon
              aria-hidden
              className={`size-4${isRefreshing ? " animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>
    );
  }

  // "Todas las tiendas" con mas de una conectada. Con una sola, el agregado y
  // esa tienda son lo mismo y la ficha de siempre es correcta.
  //
  // Importante: el overview NO sabe agregar -- cuando no se le pasa conexion
  // resuelve una por su cuenta (la primera que no este pendiente). Las cifras
  // de abajo si agregan. Sin decirlo, la pantalla mezclaria la ficha de una
  // tienda con los numeros de todas.
  const isAggregate = !selectedConnectionId && overview.connections.length > 1;

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <ChannelBand
        eyebrow={
          isAggregate
            ? `${overview.connections.length} tiendas · las cifras de abajo son la suma de todas`
            : `${overview.store?.primary_domain ?? overview.store?.myshopify_domain ?? "sin dominio"} · actualizado ${formatDate(overview.sync_runs[0]?.finished_at)}`
        }
        title={
          isAggregate
            ? "Todas tus tiendas"
            : (overview.store?.shop_name ?? "Sin tienda conectada")
        }
        actions={
          <div className="flex flex-wrap gap-3">
            {overview.connection?.status === "syncing" ? (
              <Badge tone="warn">Sincronizando...</Badge>
            ) : null}
            {/* Sincronizar es siempre de UNA conexion. Con el agregado
                delante, el boton sincronizaria la tienda que el backend
                resolvio por su cuenta -- que no es ninguna de las que el
                usuario cree estar mirando. */}
            {isAggregate ||
            (overview.connection?.status !== "connected" &&
              overview.connection?.status !== "error") ? null : (
              <Button
                variant="secondary"
                type="button"
                disabled={isSyncing}
                onClick={async () => {
                  // El sync va a una cola: sin este aviso el botón parecía no hacer nada.
                  if (await triggerSync()) toast.success("Sincronización en marcha: las cifras se actualizan en unos minutos.");
                }}
              >
                {isSyncing ? "Sincronizando..." : "Sincronizar ahora"}
              </Button>
            )}
          </div>
        }
      >
        {syncError ? (
          <div className="mt-3">
            <ErrorBlock>{syncError}</ErrorBlock>
          </div>
        ) : null}
        {isAggregate ? (
          <p className="mt-3 text-sm">
            El estado de la conexión y el sincronizado manual son de cada
            tienda, no del conjunto. Elige una arriba para verlos.
          </p>
        ) : null}
        {!isAggregate && overview.connection?.last_error_message ? (
          <div className="mt-3">
            <Banner tone="danger">
              <span className="font-mono text-xs">
                {overview.connection.last_error_message}
              </span>
            </Banner>
          </div>
        ) : null}
        {isConsultant ? (
        <div className="mt-3 flex justify-end text-sm">
          <Link
            className="inline-flex items-center gap-1"
            href="/shopify/diagnostico"
          >
            Diagnóstico técnico <IconChevronRight aria-hidden />
          </Link>
        </div>
        ) : null}
      </ChannelBand>

      <ClientShopify
        key={costsVersion}
        organizationId={organization.id}
        organizationName={organization.display_name}
        connectionId={selectedConnectionId || null}
        userId={bootstrap.user.id}
        consultant={consultant}
        asConsultant={isConsultant}
        days={periodDays}
        onDaysChange={setPeriodDays}
        periods={PERIODS}
        hideFullLink
        afterHero={
          <>
            {metrics && metrics.period.days === "all" ? (
              <Banner tone="warn">
                {/* Una frase: desde cuándo cuentan las cifras. El detalle del permiso
                    es del diagnóstico técnico. */}
                Las cifras cuentan desde{" "}
                {metrics.order_history.earliest_imported_order_at
                  ? `el ${new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(metrics.order_history.earliest_imported_order_at))}, el pedido más antiguo que tenemos`
                  : "el pedido más antiguo que tenemos"}
                .{metrics.order_history.access_scope === "last_60_days" ? " Shopify solo nos deja leer los pedidos de los últimos 60 días." : null}
              </Banner>
            ) : null}
            <ShopifyTrustStrip
              organizationId={organization.id}
              metrics={metrics}
              onCostsChanged={onCostsChanged}
            />
          </>
        }
      />

      {/* Los dos especialistas del modulo. Las anclas apuntan a las secciones
          de arriba que demuestran cada hallazgo. */}
      {isConsultant ? (
      <details id="shopify-ia" className="group rounded-xl border border-separator bg-surface p-4">
        <summary className="cursor-pointer text-base font-semibold">Análisis de los especialistas IA</summary>
        <div className="mt-4 space-y-5">
        <AiDiagnosticSection
          organizationId={organization.id}
          title="Retención de clientes"
          getPath="/ai/retencion-clientes"
          runPath="/ai/retencion-clientes-run"
          loadingLabel="Analizando si tus clientes vuelven…"
          tasksLabelSingular="tarea"
          days={90}
          showInternals={isConsultant}
          areas={{
            clientes: { label: "Ver los clientes", href: "#shop-cli" },
            medicion: { label: "Ver medición", href: "#shopify-medicion" },
          }}
        />
        <AiDiagnosticSection
          organizationId={organization.id}
          title="Adquisición y conversión"
          getPath="/ai/adquisicion-shopify"
          runPath="/ai/adquisicion-shopify-run"
          loadingLabel="Analizando de dónde vienen tus ventas…"
          tasksLabelSingular="tarea"
          days={90}
          showInternals={isConsultant}
          areas={{
            embudo: { label: "Ver el embudo", href: "#shop-conv" },
            carritos: { label: "Ver los carritos abandonados", href: "#shop-conv" },
            promociones: { label: "Ver las promociones", href: "/shopify/promociones" },
            medicion: { label: "Ver medición", href: "#shopify-medicion" },
          }}
        />
        </div>
      </details>
      ) : null}
    </div>
  );
}

// --- Estado "vista general" de /shopify (consultor sin cliente activo):
// las tiendas de la cartera ordenadas por urgencia de revisión. ---
//
// El orden lo calcula el backend sumando lo que ya dijeron los cuatro agentes
// que leen cada tienda entera (operativa, retención, adquisición, postventa).
// Aquí no se decide nada: se pinta el porqué, que es lo que convierte un
// ranking en algo en lo que se puede confiar.

type TriageReason = {
  text: string;
  kind: "conexion" | "dato" | "hallazgo" | "trabajo" | "silencio";
};

type TriagedStore = {
  connection_id: string;
  organization_id: string;
  organization_name: string;
  store_name: string;
  status: string;
  last_sync_at: string | null;
  level: "critica" | "alta" | "media" | "estable";
  reasons: TriageReason[];
  analyzed_at: string | null;
  agents_reporting: number;
  // Cuando es true la tienda sube por lo que NO se sabe de ella, no por lo que
  // se sabe. Se dice distinto: "no sabemos cómo va" no es "va mal".
  blind: boolean;
  score: number;
};

const LEVEL_PRESENTATION: Record<
  TriagedStore["level"],
  { label: string; tone: "danger" | "warn" | "neutral" | "success" }
> = {
  critica: { label: "Crítica", tone: "danger" },
  alta: { label: "Alta", tone: "warn" },
  media: { label: "Media", tone: "neutral" },
  estable: { label: "Estable", tone: "success" },
};

function analyzedLabel(analyzedAt: string | null) {
  if (!analyzedAt) return "sin analizar";
  const days = Math.floor(
    (Date.now() - Date.parse(analyzedAt)) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "analizada hoy";
  if (days === 1) return "analizada ayer";
  return `analizada hace ${days} días`;
}

function ConsultantStoresView() {
  // El peso de cada tienda en la cartera es su facturación de 30 días, la misma
  // que lee /panel. Si no se puede leer, las burbujas quedan sin peso.
  const profitability = useProfitability(30, null);
  const { setOrganizationId } = useActiveOrganization();
  const { setConnectionId } = useActiveConnection();
  const [data, setData] = useState<{
    ranking: TriagedStore[];
    organizations: Array<{ id: string; display_name: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch("/v1/consultant/stores")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(
            `No se pudieron cargar las tiendas (HTTP ${response.status}).`,
          );
          return;
        }
        setData(
          (await response.json()) as {
            ranking: TriagedStore[];
            organizations: Array<{ id: string; display_name: string }>;
          },
        );
        setError(null);
      })
      .catch(() => {
        if (!cancelled)
          setError("No se pudieron cargar las tiendas por un error de red.");
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
        <LoadingBlock label="Ordenando las tiendas por urgencia..." />
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

  const ranking = data.ranking ?? [];
  const needsReview = ranking.filter((store) => store.level !== "estable");
  const blind = ranking.filter((store) => store.blind);
  const rows = ranking
    .filter(
      (store) =>
        clientFilter === "all" || store.organization_id === clientFilter,
    )
    .filter((store) => !onlyNeedsReview || store.level !== "estable");

  function openStore(store: TriagedStore) {
    setOrganizationId(store.organization_id);
    setConnectionId(store.connection_id);
  }

  const revenueByConnection = new Map(
    (profitability.data?.stores ?? []).map((store) => [store.connection_id, store.revenue] as const),
  );

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <PortfolioAttention
        noun="tiendas"
        weightLabel="Facturación 30 días"
        formatWeight={(value) => `${Math.round(value).toLocaleString("es-ES")} €`}
        onOpen={(id) => {
          const store = ranking.find((entry) => entry.connection_id === id);
          if (store) openStore(store);
        }}
        items={ranking.map((store) => ({
          id: store.connection_id,
          name: store.store_name,
          sub: `${store.organization_name} · ${analyzedLabel(store.analyzed_at)}`,
          level: store.level,
          score: store.score,
          reasons: store.reasons.map((reason) => reason.text),
          weight: revenueByConnection.get(store.connection_id) || null,
          blind: store.blind,
        }))}
      />
      <Card
        title="Tiendas por urgencia de revisión"
        description={
          ranking.length === 0
            ? "Todavía no hay tiendas conectadas en la cartera."
            : `${needsReview.length} de ${ranking.length} piden revisión${
                blind.length
                  ? ` · ${blind.length} sin datos suficientes para juzgarlas`
                  : ""
              }.`
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            className="w-52"
            aria-label="Filtrar por cliente"
            value={clientFilter}
            onChange={setClientFilter}
            options={[
              { value: "all", label: "Todos los clientes" },
              ...data.organizations.map((organization) => ({
                value: organization.id,
                label: organization.display_name,
              })),
            ]}
          />
          <Button
            variant={onlyNeedsReview ? "primary" : "secondary"}
            size="sm"
            onClick={() => setOnlyNeedsReview((value) => !value)}
          >
            Solo las que piden revisión
          </Button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={
              onlyNeedsReview
                ? "Ninguna tienda pide revisión"
                : "Sin tiendas conectadas"
            }
            hint={
              onlyNeedsReview
                ? "Toda la cartera al día según los agentes."
                : "Los clientes conectan sus tiendas desde Integraciones."
            }
          />
        ) : (
          <List>
            {rows.map((store, index) => {
              const level = LEVEL_PRESENTATION[store.level];
              return (
                <List.Item
                  as="button"
                  key={store.connection_id}
                  type="button"
                  onClick={() => openStore(store)}
                  className="flex w-full items-start gap-4 py-3 text-left hover:bg-surface"
                >
                  {/* El puesto se muestra solo mientras la lista está entera:
                      con un filtro puesto, un "3" sería el tercero de lo que
                      queda en pantalla, no de la cartera. */}
                  <span className="w-6 shrink-0 pt-0.5 text-sm tabular-nums text-muted">
                    {clientFilter === "all" && !onlyNeedsReview
                      ? index + 1
                      : "·"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={level.tone}>{level.label}</Badge>
                      {store.blind ? (
                        <Badge tone="neutral">sin datos fiables</Badge>
                      ) : null}
                      <span className="font-medium">{store.store_name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {store.organization_name} · {analyzedLabel(store.analyzed_at)}
                      {store.agents_reporting > 0
                        ? ` · ${store.agents_reporting} de 5 agentes`
                        : ""}
                    </p>
                    {store.reasons.length ? (
                      <ul className="mt-2 space-y-1">
                        {store.reasons.map((reason) => (
                          <li key={reason.text} className="text-sm">
                            {reason.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-muted">
                        Los agentes no han encontrado nada que revisar.
                      </p>
                    )}
                  </div>
                </List.Item>
              );
            })}
          </List>
        )}
      </Card>
    </div>
  );
}

function ShopifyRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (isConsultant && !organizationId) {
    return <ConsultantStoresView />;
  }

  return <ShopifyBusinessView bootstrap={bootstrap} />;
}

export default function ShopifyPage() {
  return (
    <PortalShell title="Shopify">
      {(bootstrap) => <ShopifyRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
