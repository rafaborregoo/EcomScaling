"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import { useShopifyOverview } from "@/hooks/use-shopify-overview";
import { ModuleSummary } from "@/components/module-summary";
import { ShopifyInsightsSections } from "./insights-sections";
import { ProductCostImport } from "./product-cost-import";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import {
  AreaChart,
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Heading,
  IconChevronRight,
  Input,
  Link,
  List,
  LoadingBlock,
  Metric,
  Select,
} from "@/components/ui";

type ShopifyMetrics = {
  organization_id: string;
  selected_connection_id: string | null;
  store_id: string | null;
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

const periodOptions: Array<{ days: number | "all"; label: string }> = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "1 año" },
  { days: "all", label: "Todo" },
];


function formatDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Medicion: que invalida las cifras de esta pantalla.
 *
 * Estas tres senales ya estaban, pero repartidas: "productos sin coste" era
 * una tarjeta mas de la tira de KPIs, al lado de "margen bruto" y con el mismo
 * peso visual -- cuando lo que dice es precisamente que ese margen esta mal. El
 * aviso vivia en el `hint` de la tarjeta, que es lo ultimo que se lee.
 *
 * Aqui van juntas y nombrando la cifra que estropean. La tira de arriba se deja
 * intacta a proposito: ademas de pintarse, se publica al Consultor IA como
 * "vista actual" (ver components/module-summary), asi que quitarle senales le
 * quitaria contexto al agente.
 */
function MeasurementCard({ metrics }: { metrics: ShopifyMetrics | null }) {
  if (!metrics) return null;

  const problems: ReactNode[] = [];

  if (metrics.margin.items_without_cost > 0) {
    problems.push(
      <>
        <strong>El margen bruto de arriba esta inflado.</strong>{" "}
        {metrics.margin.items_without_cost.toLocaleString("es-ES")} lineas de
        pedido no tienen coste cargado, y lo que no tiene coste cuenta como si
        no costara nada. Lo normal es rellenarlo en Shopify, en el coste por
        articulo de la variante, y que lo traiga el sync;{" "}
        <a href="#shopify-costes" className="underline">
          aqui abajo se puede cargar suelto por SKU
        </a>
        .
      </>,
    );
  }

  // No es un error, es una aproximacion que hay que declarar: el coste actual
  // de Shopify aplicado a un pedido viejo. Mejor que contar el producto como
  // gratis, pero el margen de ese periodo no es exacto y conviene saberlo.
  if (metrics.margin.items_with_estimated_cost > 0) {
    problems.push(
      <>
        <strong>
          {metrics.margin.items_with_estimated_cost.toLocaleString("es-ES")}{" "}
          lineas se valoran con el coste de hoy.
        </strong>{" "}
        No tienen un coste cargado para la fecha de su pedido, asi que se usa el
        que Shopify reporta ahora mismo. Si los costes han cambiado desde
        entonces, el margen de los meses viejos se desvia.
      </>,
    );
  }

  // `funnel: null` y `has_sessions: false` son lo mismo para el usuario: no hay
  // sesiones. La causa habitual es el permiso de informes, no la tienda.
  if (!metrics.funnel || !metrics.funnel.has_sessions) {
    problems.push(
      <>
        <strong>No hay tasa de conversion.</strong> Las sesiones vienen de los
        informes de Shopify y necesitan ese permiso en la conexion. Sin ellas se
        ve cuanto se vende, pero no cuanta gente entro para conseguirlo.{" "}
        <Link href="/integraciones">Revisar la conexion</Link>
      </>,
    );
  }

  if (metrics.stock.tracked_items === 0) {
    problems.push(
      <>
        <strong>Ningun articulo lleva seguimiento de inventario.</strong> Los
        agotados y el stock bajo salen de ahi: sin seguimiento, un cero no
        significa que no queden unidades.
      </>,
    );
  }

  return (
    <Card
      title="Medición"
      description="Si esto está roto, lo de abajo mide otra cosa."
    >
      {problems.length === 0 ? (
        <p className="text-sm text-muted">
          Nada invalida las cifras de esta pantalla: los costes están cargados,
          hay sesiones y el inventario se sigue.
        </p>
      ) : (
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
          {problems.map((problem, index) => (
            <li key={index}>{problem}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

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
  const [metrics, setMetrics] = useState<ShopifyMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<number | "all">(30);
  const [costSku, setCostSku] = useState("");
  const [costUnitCost, setCostUnitCost] = useState("");
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [costFeedback, setCostFeedback] = useState<string | null>(null);

  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

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

  const loadMetrics = useCallback(async () => {
    if (!organization) {
      return;
    }

    setMetricsError(null);

    const params = new URLSearchParams({ days: String(periodDays) });
    if (selectedConnectionId) {
      params.set("connectionId", selectedConnectionId);
    }

    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/shopify/metrics?${params.toString()}`,
      );

      if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        detail?: string;
      } | null;
      setMetricsError(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
          .filter(Boolean)
          .join(" - "),
      );
        return;
      }

      setMetrics((await response.json()) as ShopifyMetrics);
    } catch {
      setMetricsError("No se pudieron cargar las métricas de Shopify. Revisa la conexión e inténtalo de nuevo.");
    }
  }, [organization, periodDays, selectedConnectionId]);

  async function saveCost(event: FormEvent) {
    event.preventDefault();

    if (!organization || !costSku.trim() || !costUnitCost) {
      return;
    }

    setIsSavingCost(true);
    setCostFeedback(null);

    try {
      const response = await apiFetch(
      `/v1/organizations/${organization.id}/shopify/product-costs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: costSku.trim(),
          unitCost: Number(costUnitCost),
        }),
      },
      );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        message?: string;
        detail?: string;
      } | null;
      setCostFeedback(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
          .filter(Boolean)
          .join(" - "),
      );
      return;
    }

    setCostFeedback("Coste guardado.");
    setCostSku("");
    setCostUnitCost("");
    void loadMetrics();
    } catch {
      setCostFeedback("No se pudo guardar el coste. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setIsSavingCost(false);
    }
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

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  if (isLoading) {
    return (
      <div className="border-t border-ink/20 pt-5">
        <AsyncState status="loading" loadingLabel="Cargando datos Shopify..." />
      </div>
    );
  }

  if (error) {
    return <AsyncState status="error" error={error} />;
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

  if (!overview.connection) {
    return (
      <EmptyState
        title="Shopify todavía no está conectado"
        hint="Conecta una tienda para importar ventas, productos, stock y métricas reales. Meta Ads y Klaviyo no son necesarios para empezar."
        action={<Link href="/integraciones">Ir a Integraciones</Link>}
      />
    );
  }

  const currency = overview.store?.currency_code ?? "EUR";

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
      <Card
        title={
          isAggregate
            ? "Todas tus tiendas"
            : (overview.store?.shop_name ?? "Sin tienda conectada")
        }
        description={
          isAggregate
            ? `${overview.connections.length} tiendas · las cifras de abajo son la suma de todas`
            : (overview.store?.primary_domain ??
              overview.store?.myshopify_domain ??
              "sin dominio")
        }
        actions={
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={isRefreshing}
              onClick={() => void reload()}
            >
              {isRefreshing ? "Actualizando..." : "Actualizar"}
            </Button>
            {/* Sincronizar es siempre de UNA conexion. Con el agregado
                delante, el boton sincronizaria la tienda que el backend
                resolvio por su cuenta -- que no es ninguna de las que el
                usuario cree estar mirando. */}
            {isAggregate ? null : (
              <Button
                variant="danger"
                type="button"
                disabled={
                  isSyncing ||
                  !overview.connection ||
                  overview.connection.status === "syncing"
                }
                onClick={() => void triggerSync()}
              >
                {isSyncing || overview.connection?.status === "syncing"
                  ? "Sincronizando..."
                  : "Sincronizar ahora"}
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
          <p className="mt-3 text-sm text-muted">
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
      </Card>

      {/* Las seis cifras con las que se abre una consultoría de tienda: cuánto
          vende, a qué ticket, con qué margen, si convierte, si se está
          quedando sin stock y si el margen es fiable. Estaban todas en la
          página, repartidas en cuatro bloques distintos. */}
      {metrics ? (
        <ModuleSummary
          period={
            metrics.period.days === "all"
              ? "Todo el histórico"
              : `Últimos ${metrics.period.days} días`
          }
          metrics={[
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
              value: `${metrics.margin.margin_pct.toFixed(1)}%`,
              tone:
                metrics.margin.margin_pct < 20
                  ? "danger"
                  : metrics.margin.margin_pct < 35
                    ? "warn"
                    : "success",
              hint: formatMoney(metrics.margin.gross_margin, currency),
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
                  ? "El margen real es mejor que el mostrado"
                  : "Margen fiable",
            },
          ]}
        />
      ) : null}

      {/* Las anclas son el destino de los hallazgos de los agentes de abajo. El
          mapa área->ancla va con cada AiDiagnosticSection. */}
      <section id="shopify-medicion">
        <MeasurementCard metrics={metrics} />
      </section>

      <Card
        id="shopify-ventas"
        title="Ventas"
        actions={
          <div className="flex flex-wrap gap-2">
            {periodOptions.map((option) => (
              <Button
                key={option.days}
                size="sm"
                variant={periodDays === option.days ? "primary" : "ghost"}
                onClick={() => setPeriodDays(option.days)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        }
      >
        {metricsError ? (
          <div className="p-4">
            <ErrorBlock>{metricsError}</ErrorBlock>
          </div>
        ) : !metrics ? (
          <div className="p-4">
            <LoadingBlock label="Cargando métricas..." />
          </div>
        ) : (
          <>
            <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-6">
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Ventas brutas</p>
                <p className="mt-2 font-mono text-xl">
                  {formatMoney(metrics.sales.gross_sales, currency)}
                </p>
              </article>
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Ventas netas</p>
                <p className="mt-2 font-mono text-xl">
                  {formatMoney(metrics.sales.net_sales, currency)}
                </p>
              </article>
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Pedidos</p>
                <p className="mt-2 font-mono text-xl">
                  {metrics.sales.orders_count}
                </p>
              </article>
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Ticket medio (AOV)</p>
                <p className="mt-2 font-mono text-xl">
                  {formatMoney(metrics.sales.aov, currency)}
                </p>
              </article>
              <article className="border-b border-separator p-4 xl:border-r">
                <p className="text-sm text-muted">Unidades vendidas</p>
                <p className="mt-2 font-mono text-xl">
                  {metrics.sales.units_sold}
                </p>
              </article>
              <article className="border-b border-separator p-4">
                <p className="text-sm text-muted">Reembolsos</p>
                <p className="mt-2 font-mono text-xl text-warn">
                  {formatMoney(metrics.sales.refunds, currency)}
                </p>
              </article>
            </div>

            <div className="grid gap-0 md:grid-cols-3">
              <div className="border-b border-separator p-4 md:border-r">
                <Heading level={3} size="md">
                  Productos top
                </Heading>
                <List className="mt-3">
                  {metrics.top_products.length ? (
                    metrics.top_products.map((product) => (
                      <List.Item
                        key={product.product_id}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <span>{product.title}</span>
                        <span className="font-mono text-muted">
                          {product.quantity_sold}u /{" "}
                          {formatMoney(product.revenue, currency)}
                        </span>
                      </List.Item>
                    ))
                  ) : (
                    <p className="py-2 text-sm text-muted">
                      Sin ventas en el periodo seleccionado.
                    </p>
                  )}
                </List>
              </div>
              <div className="border-b border-separator p-4 md:border-r">
                <Heading level={3} size="md">
                  Stock
                </Heading>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted">SKUs con tracking</p>
                    <p className="font-mono text-lg">
                      {metrics.stock.tracked_items}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Unidades disponibles</p>
                    <p className="font-mono text-lg">
                      {metrics.stock.total_available}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Stock bajo (&le;5)</p>
                    <p className="font-mono text-lg text-warn">
                      {metrics.stock.low_stock_items}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Sin stock</p>
                    <p className="font-mono text-lg text-danger">
                      {metrics.stock.out_of_stock_items}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <Heading level={3} size="md">
                  Margen
                </Heading>
                <p className="mt-1 text-sm text-muted">
                  {metrics.margin.items_with_cost} con coste,{" "}
                  {metrics.margin.items_without_cost} sin coste.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted">Margen bruto</p>
                    <p className="font-mono text-lg">
                      {formatMoney(metrics.margin.gross_margin, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">% margen</p>
                    <p className="font-mono text-lg">
                      {metrics.margin.margin_pct}%
                    </p>
                  </div>
                </div>
                <form
                  id="shopify-costes"
                  onSubmit={(event) => void saveCost(event)}
                  className="mt-4 space-y-2"
                >
                  <p className={EYEBROW}>Cargar coste por SKU</p>
                  <Field label="SKU">
                    <Input
                      className="mt-2"
                      type="text"
                      placeholder="Ej. CAMISETA-NEGRA-M"
                      value={costSku}
                      onChange={(event) => setCostSku(event.target.value)}
                    />
                  </Field>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Field label="Coste unitario">
                      <Input
                        className="mt-2 w-full"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={costUnitCost}
                        onChange={(event) => setCostUnitCost(event.target.value)}
                      />
                    </Field>
                    <Button
                      type="submit"
                      className="whitespace-nowrap"
                      disabled={
                        isSavingCost || !costSku.trim() || !costUnitCost
                      }
                    >
                      {isSavingCost ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                  {costFeedback ? <p className="text-xs text-muted">{costFeedback}</p> : null}
                </form>
                <ProductCostImport
                  organizationId={organization!.id}
                  onImported={() => void loadMetrics()}
                />
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Embudo: sesiones (ShopifyQL) vs pedidos propios. Se separan las dos
          tasas de conversión a propósito -- cada una lleva su fuente, no se
          promedian entre sí (ADR-0021). */}
      <Card
        id="shopify-embudo"
        title="Embudo"
        description="Cuánta gente entra y cuánta compra."
      >
        {!metrics ? (
          <LoadingBlock label="Cargando embudo..." />
        ) : !metrics.funnel || !metrics.funnel.has_sessions ? (
          <Banner tone="warn" className="text-sm">
            <p className="font-medium">
              Todavía no hay datos de sesiones para esta tienda.
            </p>
            <p className="text-muted">
              Las sesiones vienen de los informes de Shopify y necesitan el
              permiso de informes en la conexión. Si la tienda se autorizó antes
              de activarlo, vuelve a conectarla en{" "}
              <Link href="/integraciones">Integraciones</Link> y lanza un
              sincronizado.
            </p>
          </Banner>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                card
                label="Sesiones"
                value={metrics.funnel.sessions.toLocaleString("es-ES")}
                trend={metrics.funnel_daily.map((day) => day.sessions)}
              />
              <Metric
                card
                label="Pedidos"
                value={metrics.funnel.orders_count.toLocaleString("es-ES")}
                trend={metrics.funnel_daily.map((day) => day.orders_count)}
              />
              <Metric
                card
                label="Tasa de conversión"
                value={
                  metrics.funnel.conversion_rate_own != null
                    ? `${(metrics.funnel.conversion_rate_own * 100).toFixed(2)}%`
                    : "—"
                }
                hint={
                  metrics.funnel.conversion_rate_shopify != null
                    ? `${(metrics.funnel.conversion_rate_shopify * 100).toFixed(2)}% según Shopify`
                    : "pedidos ÷ sesiones"
                }
              />
              <Metric
                card
                label="Ingreso por sesión"
                value={
                  metrics.funnel.revenue_per_session != null
                    ? formatMoney(metrics.funnel.revenue_per_session, currency)
                    : "—"
                }
              />
            </div>

            {metrics.funnel_daily.length > 1 ? (
              <div className="mt-4">
                <AreaChart
                  data={metrics.funnel_daily.map((day) => ({
                    date: new Date(day.date).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                    }),
                    Sesiones: day.sessions,
                    Pedidos: day.orders_count,
                  }))}
                  xKey="date"
                  series={[
                    { key: "Sesiones", label: "Sesiones", color: "#1d4ed8" },
                    { key: "Pedidos", label: "Pedidos", color: "#059669" },
                  ]}
                  height={220}
                  valueFormatter={(value) => String(Math.round(value))}
                />
              </div>
            ) : null}

            <p className="mt-3 text-xs text-muted">
              {metrics.funnel.days_with_sessions} días con datos de sesiones ·{" "}
              {metrics.funnel.online_store_visitors.toLocaleString("es-ES")}{" "}
              visitantes únicos. La tasa propia es pedidos ÷ sesiones sobre el
              mismo periodo; la de Shopify es la que reporta su analítica.
            </p>
          </>
        )}
      </Card>

      {/* Clientes, cohortes, canales, carritos, promociones y operativa. El
          orden va de quien compra a como se le sirve, que es el mismo en el
          que se revisa una tienda. */}
      {organization ? (
        <ShopifyInsightsSections
          organizationId={organization.id}
          connectionId={selectedConnectionId}
          periodDays={periodDays}
          currency={currency}
        />
      ) : null}
      {/* Los tres especialistas del modulo. Cada uno debajo de las cifras
          que analiza: leer "no retienen" pegado a la tabla de cohortes que
          lo demuestra vale mas que un panel de IA aparte. */}
      {organization ? (
        <>
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
              clientes: { label: "Ver los clientes", href: "#shopify-clientes" },
              cohortes: { label: "Ver las cohortes", href: "#shopify-cohortes" },
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
              origen: { label: "Ver de dónde vienen", href: "#shopify-origen" },
              embudo: { label: "Ver el embudo", href: "#shopify-embudo" },
              carritos: {
                label: "Ver los carritos abandonados",
                href: "#shopify-carritos",
              },
              promociones: {
                label: "Ver las promociones",
                href: "#shopify-promociones",
              },
              medicion: { label: "Ver medición", href: "#shopify-medicion" },
            }}
          />
          <AiDiagnosticSection
            organizationId={organization.id}
            title="Entrega y devoluciones"
            getPath="/ai/postventa-shopify"
            runPath="/ai/postventa-shopify-run"
            loadingLabel="Revisando plazos y devoluciones…"
            tasksLabelSingular="tarea"
            days={90}
            showInternals={isConsultant}
            areas={{
              operativa: { label: "Ver la operativa", href: "#shopify-operativa" },
              ventas: { label: "Ver las ventas", href: "#shopify-ventas" },
              medicion: { label: "Ver medición", href: "#shopify-medicion" },
            }}
          />
        </>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <span>
            Último sync: {formatDate(overview.sync_runs[0]?.finished_at)}
          </span>
          {isConsultant ? (
            <Link
              className="inline-flex items-center gap-1"
              href="/shopify/diagnostico"
            >
              Diagnóstico técnico <IconChevronRight aria-hidden />
            </Link>
          ) : null}
        </div>
      </Card>
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

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
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
