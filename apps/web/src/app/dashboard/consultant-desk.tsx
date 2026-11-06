"use client";

import { buttonVariants } from "@/components/ui/button";
import { SparklesIcon } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, invalidateApiGetCache, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useUrlSection } from "@/lib/use-url-section";
import { useCopilotAsk } from "@/components/copilot-ask";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { Banner, Skeleton, ToggleGroup, ToggleGroupItem, toast, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown, CollapsibleMore } from "@/components/ui";
import type { DailyWorkbench, PortfolioHealthRow, UpcomingItem, WorkbenchAction } from "../consultor/workbench";
import {
  A29Reading,
  ClientPulse,
  DiagnosticReading,
  findingSteps,
  FindingReading,
  Delta,
  Empty,
  Kpi,
  A02MetricNotice,
  KpiBars,
  KpiDetail,
  SalesChart,
  SectionHead,
  ago,
  cx,
  dayLabel,
  findingFor,
  useKpiDisclosure,
  type Diagnostic,
  type KpiDetailData,
  type MetaMetrics,
  type Metrics,
} from "./client-pulse";
import { fmtCurrency, fmtNum } from "./client-pulse-model";
import { useMetricAnalysis } from "@/components/metric-verdict";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import { PortfolioChannels, PortfolioClients, PortfolioStores } from "./consultant-portfolio";
import { revenueByCurrency, roasPosition, sortPortfolio, type MatrixKey, type MatrixRow } from "./consultant-portfolio-model";
import { salesChangePct } from "./store-pulse";
import { ClientShopify } from "./client-shopify";
import { ClientMeta } from "./client-meta";
import { ClientKlaviyo } from "./client-klaviyo";
import p from "./client-pulse.module.css";
import { DashboardSections } from "./dashboard-sections";
import s from "./consultant-desk.module.css";
import ps from "./consultant-portfolio.module.css";

/**
 * Dashboard del consultor.
 *
 * Misma gramática visual que el panel del cliente (client-pulse) pero en
 * grafito + mandarina: el consultor tiene que saber de un vistazo en qué lado
 * está. Responde a "¿qué cliente necesita mi atención y qué hago hoy?" a tres
 * alturas, según el selector del shell:
 *
 *   sin cliente        -> la cartera: triaje, bandeja de la mesa, chats,
 *                         agenda, canales por cliente y tiendas.
 *   cliente            -> qué cambió desde mi revisión, qué toca decidir,
 *                         conversación, lo que ve la IA y los canales.
 *   cliente + tienda   -> lo mismo con las cifras de esa tienda.
 *
 * Nada de esto es una métrica nueva: la mesa diaria
 * (/v1/consultant/daily-workbench) ya reúne alertas, tareas, llamadas,
 * mensajes, conexiones, hitos y propuestas; aquí se le suma el negocio.
 * Las cifras atribuidas se etiquetan por plataforma y no se suman (ADR-0021).
 */

const DAY_MS = 86_400_000;
const TABS = ["todo", "shopify", "meta", "klaviyo"] as const;

// ---------------------------------------------------------------------------
// Contratos (solo los campos que pinta esta vista)
// ---------------------------------------------------------------------------

type Overview = {
  clients: number;
  stores: number;
  plan_mix: Record<string, number>;
  business: {
    shopify_currency_code: string | null;
    meta_currency_code: string | null;
    net_sales: number | null;
    orders: number;
    meta_spend: number | null;
    meta_purchase_value: number | null;
    roas: number | null;
    prev_net_sales: number | null;
    prev_orders: number;
    prev_meta_spend: number | null;
  };
  portfolio: Array<{ organization_id: string; store_count: number; plan_status: string | null }>;
};

type Thread = {
  organization_id: string;
  organization_name: string;
  counterpart_name: string | null;
  last_message: { body: string; author_kind: string; has_attachments: boolean; created_at: string } | null;
  unread_count: number;
};

type MetaRow = {
  organization_id: string;
  spend: number | null;
  currency_code: string | null;
  shopify_currency_code: string | null;
  roas: number | null;
  cac: number | null;
  break_even_roas: number | null;
  dependency_pct: number | null;
  delta: { cac_pct: number | null; roas_pct: number | null };
};

type KlaviyoRow = {
  organization_id: string;
  campaigns_sent: number;
  last_send_at: string | null;
  revenue: number | null;
  currency_code: string | null;
  open_rate: number | null;
};

type OrdersPayload = {
  rows: Array<{ organization_id: string; orders_count: number; net_sales: number | null; currency_code: string | null }>;
  stores?: Array<{
    store_id: string;
    organization_id: string;
    organization_name: string;
    shop_name: string;
    orders_count: number;
    currency_code: string | null;
    net_sales: number | null;
    aov: number | null;
  }>;
};

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

const TIERS: Array<{ key: PortfolioHealthRow["status"]; label: string; cls: string }> = [
  { key: "urgente", label: "Urgente", cls: s.tierUrgente },
  { key: "revisar", label: "Revisar", cls: s.tierRevisar },
  { key: "vigilar", label: "Vigilar", cls: s.tierVigilar },
  { key: "al_dia", label: "Al día", cls: s.tierAlDia },
];
const tierOf = (status: PortfolioHealthRow["status"] | undefined) => TIERS.find((t) => t.key === status);

const KIND_LABEL: Record<WorkbenchAction["kind"], string> = {
  critical_alert: "Alerta",
  call_approval: "Llamada",
  ai_proposal: "Propuesta IA",
  unread_message: "Mensaje",
  integration_reauth: "Integración",
  financial_coverage: "Datos",
  milestone_due: "Hito",
};

const UPCOMING_LABEL: Record<UpcomingItem["kind"], string> = {
  task: "Tarea",
  milestone: "Hito",
  campaign: "Campaña",
  call: "Llamada",
};

const SOURCE_LABEL: Record<string, string> = {
  alerts: "alertas",
  tasks: "tareas",
  calls: "llamadas",
  proposals: "propuestas de IA",
  messages: "mensajes",
  connections: "integraciones",
  financial: "configuración financiera",
  milestones: "hitos",
  campaigns: "planificación",
};

type InboxFilter = "todo" | "urgente" | "decision" | "datos";
const DECISION_KINDS: Array<WorkbenchAction["kind"]> = ["call_approval", "ai_proposal", "unread_message"];
const DATA_KINDS: Array<WorkbenchAction["kind"]> = ["integration_reauth", "financial_coverage"];
const INBOX_FILTERS: Array<{ key: InboxFilter; label: string; test: (a: WorkbenchAction) => boolean }> = [
  { key: "todo", label: "Todo", test: () => true },
  { key: "urgente", label: "Urgente", test: (a) => a.priority === "urgent" },
  { key: "decision", label: "Mi decisión", test: (a) => DECISION_KINDS.includes(a.kind) && a.kind !== "unread_message" },
  { key: "datos", label: "Datos", test: (a) => DATA_KINDS.includes(a.kind) },
];

const plural = (n: number, one: string, many: string) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const sourceMoney = (value: number | null, currencyCode: string | null) =>
  fmtCurrency(value, currencyCode, 2);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
const clock = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });


// ---------------------------------------------------------------------------
// Router del consultor
// ---------------------------------------------------------------------------

export function ConsultantDashboard({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId, setOrganizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [tab] = useUrlSection("tab", TABS, "todo");

  if (!organizationId) {
    return (
      <div className={p.consultant}>
        <ConsultantPortfolio userName={bootstrap.profile.full_name} onSelectClient={setOrganizationId} />
      </div>
    );
  }

  const organizationName =
    bootstrap.memberships.find((m) => m.organization_id === organizationId)?.organization?.display_name ?? "Cliente";
  const connection = connectionId || null;

  if (tab === "shopify" || tab === "meta") {
    return (
      <div className={p.consultant}>
        {tab === "shopify" ? (
          <ClientShopify
            organizationId={organizationId}
            organizationName={organizationName}
            connectionId={connection}
            userId={bootstrap.profile.id}
            asConsultant
          />
        ) : (
          <ClientMeta
            organizationId={organizationId}
            organizationName={organizationName}
            connectionId={connection}
            userId={bootstrap.profile.id}
            asConsultant
          />
        )}
      </div>
    );
  }

  if (tab === "klaviyo") {
    return (
      <div className={p.consultant}>
        <ClientKlaviyo organizationId={organizationId} organizationName={organizationName} connectionId={connection} hasConsultant asConsultant />
      </div>
    );
  }

  return (
    <div className={p.consultant}>
      <ConsultantClientDesk
        userId={bootstrap.profile.id}
        organizationId={organizationId}
        organizationName={organizationName}
        connectionId={connection}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------

function ActionRow({ action, onClient }: { action: WorkbenchAction; onClient?: (id: string) => void }) {
  return (
    <li className={ps.action} data-kind={action.kind} data-priority={action.priority}>
      <div>
        <div className={ps.actionMeta}>
          <span>{action.priority === "urgent" ? "Urgente · " : ""}{KIND_LABEL[action.kind]}</span>
          {onClient ? <button type="button" onClick={() => onClient(action.organization_id)}>{action.organization_name}</button> : null}
        </div>
        <h4>{action.title}</h4>
        <p className={ps.actionReason}>{action.reason}</p>
        {action.evidence.length ? <div className={ps.evidence}>{action.evidence.slice(0, 2).map((item, i) => <span key={i}>{item.label}: <b>{item.value}</b></span>)}</div> : null}
        <Collapsible className={ps.actionContext}>
          <CollapsibleTrigger>Ver contexto y evidencia<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
          <CollapsibleContent>
          <p>{action.reason}</p>
          <div className={ps.evidence}>{action.evidence.map((item, i) => <span key={i}>{item.label}: <b>{item.value}</b>{item.source ? ` · ${item.source}` : ""}</span>)}</div>
        </CollapsibleContent>
        </Collapsible>
      </div>
      <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={action.href}>{action.action_label}</Link>
    </li>
  );
}

function Inbox({ actions, filter, onFilter, onClient }: {
  actions: WorkbenchAction[];
  filter: InboxFilter;
  onFilter: (filter: InboxFilter) => void;
  onClient: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const active = INBOX_FILTERS.find((f) => f.key === filter) ?? INBOX_FILTERS[0];
  const visible = actions.filter(active.test);

  const clients = new Set(visible.map((a) => a.organization_id)).size;
  return (
    <div className={cx(p.panel, ps.inboxPanel)}>
      <div className={ps.panelHead}>
        <div>
          <h3>Bandeja</h3>
          <p role="status">
            {plural(visible.length, "asunto", "asuntos")} de {plural(clients, "cliente", "clientes")} · por prioridad
          </p>
        </div>
        <ToggleGroup
          aria-label="Filtrar la bandeja"
          className={ps.inboxFilters}
          spacing={1.5}
          value={active.key}
          onValueChange={(key) => {
            onFilter(key);
            setShowAll(false);
          }}
        >
          {INBOX_FILTERS.map((f) => (
            <ToggleGroupItem key={f.key} value={f.key}>
              {f.label}
              <span className="text-xs text-muted tabular-nums">{actions.filter(f.test).length}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {visible.length === 0 ? (
        <Empty action={filter !== "todo" ? <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={() => onFilter("todo")}>Ver toda la bandeja</button> : undefined}>
          {filter === "todo" ? "No hay asuntos pendientes en las fuentes disponibles." : "No hay asuntos que coincidan con este filtro."}
        </Empty>
      ) : (
        <Collapsible open={showAll} onOpenChange={setShowAll}>
          <ul>
            {visible.slice(0, 8).map((action) => (
              <ActionRow key={action.id} action={action} onClient={onClient} />
            ))}
          </ul>
          {visible.length > 8 ? (
            <>
              <CollapsibleContent>
                <ul className={ps.actionMore}>
                  {visible.slice(8).map((action) => (
                    <ActionRow key={action.id} action={action} onClient={onClient} />
                  ))}
                </ul>
              </CollapsibleContent>
              <CollapsibleMore count={visible.length - 8} more={`Ver los ${visible.length} asuntos`} less="Ver menos asuntos" className={s.showAll} />
            </>
          ) : null}
        </Collapsible>
      )}
    </div>
  );
}

function Upcoming({ items, showClient }: { items: UpcomingItem[]; showClient: boolean }) {
  return (
    <div className={p.panel}>
      <div className={p.panelH}>
        <div>
          <h3>Próximos 7 días</h3>
          <p className={p.sub}>Tareas, hitos, campañas y llamadas</p>
        </div>
      </div>
      {items.length === 0 ? (
        <Empty>Nada en la agenda esta semana.</Empty>
      ) : (
        <ul>
          {items.slice(0, 8).map((item) => {
            const at = new Date(item.at);
            return (
              <li key={`${item.kind}-${item.id}`} className={cx(s.ag, ps.agendaItem, "task-lift")}>
                <span className={s.day}>
                  <small>{at.toLocaleDateString("es-ES", { weekday: "short" })}</small>
                  <b>{at.getDate()}</b>
                </span>
                <div>
                  <p className={s.agT}>
                    <Link href={item.href} style={{ color: "inherit", textDecoration: "none" }}>
                      {item.title}
                    </Link>
                  </p>
                  <p className={s.agM}>
                    <span className={p.chip}>{UPCOMING_LABEL[item.kind]}</span>
                    {showClient ? <span>{item.organization_name}</span> : null}
                    {item.kind === "call" ? <span>{clock(item.at)}</span> : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartera
// ---------------------------------------------------------------------------


export function ConsultantPortfolio({ userName, onSelectClient }: {
  userName: string | null;
  onSelectClient: (organizationId: string) => void;
}) {
  const [ordersKey] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * DAY_MS);
    return `/v1/consultant/orders?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
  });
  const workbench = useCachedQuery<DailyWorkbench>("/v1/consultant/daily-workbench?days=30");
  const overview = useCachedQuery<Overview>("/v1/consultant/overview?days=30");
  const threads = useCachedQuery<{ threads: Thread[] }>("/v1/consultant/message-threads");
  const meta = useCachedQuery<{ clients: MetaRow[] }>("/v1/consultant/meta-portfolio?compare=month");
  const klaviyo = useCachedQuery<{ clients: KlaviyoRow[] }>("/v1/consultant/klaviyo-portfolio?window=30d");
  const orders = useCachedQuery<OrdersPayload>(ordersKey);
  const ask = useCopilotAsk();
  const [filter, setFilter] = useState<InboxFilter>("todo");
  const [sort, setSort] = useState<{ key: MatrixKey; dir: 1 | -1 } | null>(null);
  const [today] = useState(() => new Date());
  // Cifra de la cartera abierta: reparto por cliente, lectura y a dónde ir.
  const { openKpi, toggleKpi, closeKpi, closingKpi } = useKpiDisclosure();

  const wb = workbench.data;
  const threadList = useMemo(
    () =>
      (threads.data?.threads ?? [])
        .slice()
        .sort(
          (a, b) =>
            b.unread_count - a.unread_count ||
            Date.parse(b.last_message?.created_at ?? "0") - Date.parse(a.last_message?.created_at ?? "0"),
        ),
    [threads.data],
  );

  const matrix = useMemo<MatrixRow[]>(() => {
    const salesBy = new Map((orders.data?.rows ?? []).map((r) => [r.organization_id, r]));
    const metaBy = new Map((meta.data?.clients ?? []).map((r) => [r.organization_id, r]));
    const klaviyoBy = new Map((klaviyo.data?.clients ?? []).map((r) => [r.organization_id, r]));
    return (wb?.portfolio ?? []).map((row, rank) => {
      const m = metaBy.get(row.organization_id);
      const k = klaviyoBy.get(row.organization_id);
      const o = salesBy.get(row.organization_id);
      // Cliente con tiendas en varias monedas: la API no suma; si solo vende
      // una moneda, se enseña esa suma en vez de un "—".
      const clientStores = (orders.data?.stores ?? []).filter(store => store.organization_id === row.organization_id);
      const groups = revenueByCurrency(clientStores);
      const complete = clientStores.every(store => store.net_sales != null && store.currency_code != null);
      const storeSales = complete && groups.length === 1 ? { sales: groups[0][1].sales, currency: groups[0][0] } : null;
      return {
        id: row.organization_id,
        name: row.organization_name,
        tier: row.status,
        rank,
        sales: o?.net_sales ?? storeSales?.sales ?? null,
        salesCurrencyCode: o?.net_sales != null ? o.currency_code ?? null : storeSales?.currency ?? null,
        orders: o?.orders_count ?? null,
        roas: m?.spend != null && m.spend > 0 ? m.roas : null,
        breakEven: m?.break_even_roas ?? null,
        cac: m?.spend != null && m.spend > 0 ? m.cac : null,
        cacCurrencyCode: m?.currency_code ?? null,
        cacDelta: m?.delta.cac_pct ?? null,
        dep: m?.spend != null && m.spend > 0 ? m.dependency_pct : null,
        sent: k ? k.campaigns_sent : null,
        lastSend: k?.last_send_at ?? null,
        emailRev: k ? k.revenue : null,
        emailRevCurrencyCode: k?.currency_code ?? null,
        alerts: row.open_alerts,
      };
    });
  }, [wb, orders.data, meta.data, klaviyo.data]);

  const sortedMatrix = useMemo(() => sortPortfolio(matrix, sort), [matrix, sort]);

  if (workbench.isLoading && !wb) {
    return (
      <div className={cx(p.root, ps.portfolio)} data-scope="all-stores">
        <div className={p.hero} role="status" aria-busy="true">
          <p className={p.heroMeta}>Tu cartera</p>
          <p className={p.headline}>Preparando tu mesa…</p>
          <Skeleton className="h-32 w-full" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (!wb) {
    return (
      <div className={cx(p.root, ps.portfolio)} data-scope="all-stores">
        <div className={p.hero}>
          <p className={p.heroMeta}>Tu cartera</p>
          <h1 className={p.headline}>No se pudo cargar la mesa</h1>
          <p className={p.headlineDetail}>{workbench.error ?? "Reintenta en unos segundos."}</p>
          <div className={p.heroActions}>
            <button type="button" className={buttonVariants()} onClick={() => workbench.reload()}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const summary = wb.summary;
  const urgentActions = wb.actions.filter((a) => a.priority === "urgent").length;
  const decisions = wb.actions.filter((a) => DECISION_KINDS.includes(a.kind) && a.kind !== "unread_message").length;
  const downSources = Object.entries(wb.sources)
    .filter(([, state]) => state === "error")
    .map(([key]) => SOURCE_LABEL[key] ?? key);
  const unreadBy = new Map(threadList.map((t) => [t.organization_id, t.unread_count]));
  const storesBy = new Map((overview.data?.portfolio ?? []).map((r) => [r.organization_id, r.store_count]));
  const firstName = userName?.split(" ")[0];
  const hour = today.getHours();
  const greeting = hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
  const headline =
    summary.urgent_clients > 0
      ? `${plural(summary.urgent_clients, "cliente necesita", "clientes necesitan")} que intervengas hoy.`
      : wb.actions.length > 0
        ? "Nada urgente hoy: toca avanzar lo pendiente."
        : "Tu cartera está al día.";
  const business = overview.data?.business;
  const stores = (orders.data?.stores ?? []).slice().sort((a, b) => b.orders_count - a.orders_count);
  const dataIssueRows = wb.portfolio.filter((row) => row.data_issues.length > 0);

  // ---- detalle de las cifras de la cartera ----
  // No hay un agente sobre la cartera entera: la lectura sale de los datos
  // (concentración, quién está por debajo) y "Preguntar a la IA" lleva al copiloto.
  const shopifyCurrency = business?.shopify_currency_code ?? null;
  const metaCurrency = business?.meta_currency_code ?? null;
  const nameOf = new Map(wb.portfolio.map((row) => [row.organization_id, row.organization_name]));
  // Las barras solo comparan importes en la misma moneda; el resto se lista sin barra.
  const sameCurrency = (code: string | null, base: string | null) => code != null && base != null && code === base;
  const byOrders = matrix.filter((r) => r.orders != null).sort((a, b) => (b.orders ?? 0) - (a.orders ?? 0));
  const byRoas = matrix.filter((r) => r.roas != null).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
  const metaSpend = (meta.data?.clients ?? []).filter((c) => (c.spend ?? 0) > 0).sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  const share = (part: number | null | undefined, total: number | null | undefined) =>
    part != null && total ? Math.round((part / total) * 100) : null;
  const reading = (text: string | null) =>
    text ? <p className={p.aiLine}>{text}</p> : <p className={p.aiLine}>Sin datos suficientes para leer esta cifra todavía.</p>;
  // Con un solo cliente o tienda, "concentra el 100 %" no dice nada: se
  // compara con los 30 días anteriores.
  const versus = (current: number | null | undefined, previous: number | null | undefined, format: (value: number) => string) => {
    if (current == null || previous == null || previous === 0) return null;
    const change = Math.round(((current - previous) / Math.abs(previous)) * 100);
    return change === 0
      ? `Igual que los 30 días anteriores (${format(previous)}).`
      : `${change > 0 ? "Sube" : "Baja"} un ${Math.abs(change)} % frente a los 30 días anteriores (${format(previous)}).`;
  };
  const belowBreakEven = byRoas.filter((r) => roasPosition(r.roas, r.breakEven) === "below");
  const withoutBreakEven = byRoas.filter((r) => roasPosition(r.roas, r.breakEven) === null);
  const withoutOrders = matrix.filter((r) => r.orders === 0);
  const topSpendShare = metaSpend[0] && sameCurrency(metaSpend[0].currency_code, metaCurrency) ? share(metaSpend[0].spend, business?.meta_spend) : null;
  const storeAov = (orders.data?.stores ?? []).filter((st) => st.aov != null).sort((a, b) => (a.currency_code ?? "").localeCompare(b.currency_code ?? "") || (b.aov ?? 0) - (a.aov ?? 0));
  // Con tiendas en varias monedas la API no suma ventas (ADR-0021: nada de
  // mezclar EUR y USD). Cada moneda conserva sus ventas, devoluciones y pedidos.
  const byCurrency = new Map(revenueByCurrency(orders.data?.stores ?? []));
  const sellingCurrencies = [...byCurrency.entries()];
  const mixedCurrency = business?.net_sales == null && sellingCurrencies.length > 0;
  const unknownCurrencyStores = stores.filter((store) => store.net_sales != null && !store.currency_code).length;
  // La tienda que más vende, comparada solo con las de su misma moneda.
  const topStoreSales = (orders.data?.stores ?? [])
    .filter((st) => (st.net_sales ?? 0) > 0 && st.currency_code === sellingCurrencies[0]?.[0])
    .sort((a, b) => (b.net_sales ?? 0) - (a.net_sales ?? 0))[0];
  const salesValue = mixedCurrency
    ? sellingCurrencies.map(([code, entry], index) => <span key={code} className={entry.sales < 0 ? ps.negativeValue : undefined}>{index ? " · " : ""}{sourceMoney(entry.sales, code)}</span>)
    : sourceMoney(business?.net_sales ?? null, shopifyCurrency);
  const aovValue = mixedCurrency
    ? sellingCurrencies.map(([code, entry], index) => <span key={code} className={entry.sales < 0 ? ps.negativeValue : undefined}>{index ? " · " : ""}{sourceMoney(entry.orders ? entry.sales / entry.orders : null, code)}</span>)
    : business?.orders && business.net_sales != null
      ? sourceMoney(business.net_sales / business.orders, shopifyCurrency)
      : "—";
  // La ausencia de moneda mantiene visible que los importes son parciales.
  const currencyNote = unknownCurrencyStores ? `Moneda pendiente en ${plural(unknownCurrencyStores, "tienda", "tiendas")}; importes parciales.` : mixedCurrency
    ? sellingCurrencies.length === 1
      ? `Importes disponibles en ${sellingCurrencies[0][0]}`
      : "Varias monedas: no se suman"
    : null;
  const portfolioDetails: Record<string, KpiDetailData> = {
    sales: {
      title: "Ventas netas",
      chart: (
        <KpiBars
          rows={(orders.data?.stores ?? [])
            .filter((st) => st.net_sales != null)
            .sort((a, b) => (a.currency_code ?? "~").localeCompare(b.currency_code ?? "~") || (b.net_sales ?? 0) - (a.net_sales ?? 0))
            .slice(0, 12)
            .map((st) => ({
              key: st.store_id,
              id: st.organization_id,
              name: `${st.shop_name} · ${st.organization_name}`,
              value: st.currency_code === sellingCurrencies[0]?.[0] ? st.net_sales : null,
              text: sourceMoney(st.net_sales, st.currency_code),
              tone: st.net_sales != null && st.net_sales < 0 ? "bad" as const : undefined,
            }))}
          onSelect={onSelectClient}
        />
      ),
      ai: reading(
        stores.filter((st) => (st.net_sales ?? 0) > 0).length > 1 && topStoreSales
          ? `${topStoreSales.shop_name} concentra el ${share(topStoreSales.net_sales, byCurrency.get(topStoreSales.currency_code ?? "")?.sales)} % de las ventas en ${topStoreSales.currency_code}.`
          : versus(business?.net_sales, business?.prev_net_sales, (value) => sourceMoney(value, shopifyCurrency)),
      ),
      href: "/panel",
      action: "Ver la rentabilidad de la cartera",
    },
    orders: {
      title: "Pedidos",
      chart: (
        <KpiBars
          rows={byOrders.map((r) => ({ key: r.id, id: r.id, name: r.name, value: r.orders, text: fmtNum(r.orders ?? 0), tone: r.orders === 0 ? ("bad" as const) : undefined }))}
          onSelect={onSelectClient}
        />
      ),
      ai: reading(
        withoutOrders.length
          ? `${plural(withoutOrders.length, "cliente", "clientes")} sin pedidos en 30 días: ${withoutOrders.slice(0, 3).map((r) => r.name).join(", ")}.`
          : byOrders.length > 1 && business?.orders
            ? `${byOrders[0].name} trae el ${share(byOrders[0].orders, business.orders)} % de los pedidos.`
            : versus(business?.orders, business?.prev_orders, (value) => fmtNum(value)),
      ),
      href: "#mesa-tiendas",
      action: "Ver pedidos por tienda",
    },
    aov: {
      title: "Ticket medio",
      chart: (
        <KpiBars
          rows={storeAov.slice(0, 12).map((st) => ({
            key: st.store_id,
            id: st.organization_id,
            name: `${st.shop_name} · ${st.organization_name}`,
              value: sameCurrency(st.currency_code, shopifyCurrency ?? sellingCurrencies[0]?.[0] ?? null) ? st.aov : null,
            text: sourceMoney(st.aov, st.currency_code),
            tone: st.aov != null && st.aov < 0 ? "bad" as const : undefined,
          }))}
          onSelect={onSelectClient}
        />
      ),
      ai: reading(
        storeAov.length > 1 && new Set(storeAov.map(store => store.currency_code)).size > 1
          ? "Cada tienda muestra su ticket en su moneda. Los importes de distintas monedas no se comparan entre sí."
          : storeAov.length > 1
          ? `El ticket va de ${sourceMoney(storeAov[storeAov.length - 1].aov, storeAov[storeAov.length - 1].currency_code)} en ${storeAov[storeAov.length - 1].shop_name} a ${sourceMoney(storeAov[0].aov, storeAov[0].currency_code)} en ${storeAov[0].shop_name}.`
          : null,
      ),
      href: "/tiendas",
      action: "Ver tiendas",
    },
    spend: {
      title: "Inversión Meta",
      chart: (
        <KpiBars
          rows={metaSpend.map((c) => ({
            key: c.organization_id,
            id: c.organization_id,
            name: nameOf.get(c.organization_id) ?? "Cliente",
            value: sameCurrency(c.currency_code, metaCurrency) ? c.spend : null,
            text: sourceMoney(c.spend, c.currency_code),
          }))}
          onSelect={onSelectClient}
        />
      ),
      ai: reading(
        metaSpend.length > 1 && topSpendShare !== null
          ? `${nameOf.get(metaSpend[0].organization_id) ?? "Un cliente"} se lleva el ${topSpendShare} % de la inversión en Meta.`
          : versus(business?.meta_spend, business?.prev_meta_spend, (value) => sourceMoney(value, metaCurrency)),
      ),
      href: "#mesa-canales",
      action: "Ver canales por cliente",
    },
    roas: {
      title: "ROAS Meta",
      chart: (
        <KpiBars
          rows={byRoas.map((r) => ({
            key: r.id,
            id: r.id,
            name: r.name,
            value: r.roas,
            text: `${fmtNum(r.roas ?? 0, 2)}×${r.breakEven !== null ? ` / ${fmtNum(r.breakEven, 2)}×` : ""}`,
            tone: r.breakEven !== null && (r.roas ?? 0) < r.breakEven ? ("bad" as const) : undefined,
          }))}
          onSelect={onSelectClient}
        />
      ),
      ai: reading(
        byRoas.length
          ? belowBreakEven.length
            ? `${plural(belowBreakEven.length, "cliente está", "clientes están")} por debajo de su ROAS de equilibrio: ${belowBreakEven.slice(0, 3).map((r) => r.name).join(", ")}.`
            : withoutBreakEven.length
              ? `Falta un ROAS de equilibrio válido para ${plural(withoutBreakEven.length, "cliente", "clientes")}. No se puede valorar la rentabilidad de toda la cartera.`
              : "Los clientes con datos comparables igualan o superan su ROAS de equilibrio."
          : null,
      ),
      href: "#mesa-canales",
      action: "Ver canales por cliente",
    },
  };
  const portfolioDetail = openKpi ? portfolioDetails[openKpi] : null;

  function jump(next: InboxFilter) {
    setFilter(next);
    document.getElementById("mesa-hoy")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }


  return (
    <div className={cx(p.root, ps.portfolio)} data-scope="all-stores">
      <DashboardSections items={[{ id: "mesa-headline", label: "Resumen" }, { id: "mesa-clientes", label: "Clientes" }, { id: "mesa-hoy", label: "Bandeja" }, { id: "mesa-canales", label: "Canales" }, { id: "mesa-tiendas", label: "Tiendas" }]} />
      <header className={ps.welcome}>
        <div>
          <h1 id="mesa-headline">{firstName ? `${greeting}, ${firstName}` : "Tu cartera"}</h1>
          <p className={ps.welcomeSubtitle}>{headline}</p>
          <p className={ps.scope}><span>Todas las tiendas · {plural(summary.clients, "cliente", "clientes")}{overview.data ? ` · ${plural(overview.data.stores, "tienda", "tiendas")}` : ""}</span><span>Últimos 30 días</span><span>Actualizado {ago(wb.generated_at)}</span></p>
        </div>
        <div className={ps.headerActions}>
          <button type="button" className={buttonVariants()} onClick={() => ask({question: "¿Qué cliente de mi cartera necesita más mi atención hoy y qué haría primero con él?", focusLabel: "Tu cartera"})}><SparklesIcon data-icon="inline-start" aria-hidden="true" />Priorizar con IA</button>
          <button type="button" className={buttonVariants({ variant: "secondary" })} disabled={workbench.isLoading} aria-busy={workbench.isLoading} onClick={() => {workbench.reload();overview.reload();orders.reload();meta.reload();klaviyo.reload();threads.reload();}}>{workbench.isLoading ? "Actualizando…" : "Actualizar"}</button>
        </div>
      </header>
      {downSources.length ? <Banner tone="warn" title={`No se ha podido leer ${downSources.join(", ")}`}>El resto de la mesa está al día; lo de esas fuentes puede faltar.</Banner> : null}
      <div className={ps.workload} role="group" aria-label="Prioridades de tu cartera">
        <button type="button" data-status={urgentActions ? "urgente" : undefined} onClick={() => jump("urgente")}><b>{fmtNum(urgentActions)}</b><span>Asuntos urgentes</span></button>
        <button type="button" data-status={decisions ? "revisar" : undefined} onClick={() => jump("decision")}><b>{fmtNum(decisions)}</b><span>Esperan tu decisión</span></button>
        <button type="button" data-status={summary.unread_threads ? "vigilar" : undefined} onClick={() => document.getElementById("mesa-chats")?.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start"})}><b>{fmtNum(summary.unread_threads)}</b><span>Chats sin leer</span></button>
        <button type="button" data-status={summary.data_issues ? "revisar" : undefined} onClick={() => jump("datos")}><b>{fmtNum(summary.data_issues)}</b><span>Incidencias de datos</span></button>
      </div>

      {/* ------------------------------ KPIs ------------------------------ */}
      {business ? (
        <div className={ps.kpis} aria-label="Cifras de la cartera, últimos 30 días">
          <Kpi
            metric="sales"
            numericValue={business.net_sales}
            previousNumericValue={business.prev_net_sales}
            open={openKpi === "sales"}
            onOpen={toggleKpi("sales")}
            label="Ventas netas"
            value={salesValue}
            delta={<Delta change={business.net_sales != null && business.prev_net_sales != null ? salesChangePct(business.net_sales, business.prev_net_sales) : null} />}
            vs={business.prev_net_sales != null ? sourceMoney(business.prev_net_sales, business.shopify_currency_code) : null}
            slot={<p className={p.trackTxt}>{currencyNote ?? "Todas las tiendas, 30 días"}</p>}
          />
          <Kpi
            metric="orders"
            open={openKpi === "orders"}
            onOpen={toggleKpi("orders")}
            label="Pedidos"
            value={fmtNum(business.orders)}
            delta={<Delta change={salesChangePct(business.orders, business.prev_orders)} />}
            vs={fmtNum(business.prev_orders)}
            slot={<p className={p.trackTxt}>Pedidos de Shopify</p>}
          />
          <Kpi
            metric="aov"
            numericValue={business.orders && business.net_sales != null ? business.net_sales / business.orders : null}
            open={openKpi === "aov"}
            onOpen={toggleKpi("aov")}
            label="Ticket medio"
            value={aovValue}
            delta={
              <Delta
                change={
                  business.orders && business.prev_orders && business.net_sales != null && business.prev_net_sales != null
                    ? salesChangePct(business.net_sales / business.orders, business.prev_net_sales / business.prev_orders)
                    : null
                }
              />
            }
            slot={<p className={p.trackTxt}>Media de la cartera</p>}
          />
          <Kpi
            metric="spend"
            numericValue={business.meta_spend}
            previousNumericValue={business.prev_meta_spend}
            open={openKpi === "spend"}
            onOpen={toggleKpi("spend")}
            label="Inversión Meta"
            value={sourceMoney(business.meta_spend, business.meta_currency_code)}
            vs={sourceMoney(business.prev_meta_spend, business.meta_currency_code)}
            slot={<p className={p.trackTxt}>Suma de todas las cuentas</p>}
          />
          <Kpi
            metric="roas"
            numericValue={business.roas}
            open={openKpi === "roas"}
            onOpen={toggleKpi("roas")}
            label="ROAS Meta"
            value={business.roas !== null ? `${fmtNum(business.roas, 2)}×` : "—"}
            slot={<p className={p.trackTxt}>{sourceMoney(business.meta_purchase_value, business.meta_currency_code)} atribuidos por Meta</p>}
          />
          <Kpi
            metric="coverage"
            label="Tiendas con datos"
            value={!orders.data ? orders.isLoading ? "—" : "No disponible" : overview.data ? `${stores.length}/${overview.data.stores}` : fmtNum(stores.length)}
            slot={<p className={p.trackTxt}>{orders.isLoading && !orders.data ? "Cargando datos de pedidos" : "Con datos de pedidos del periodo"}</p>}
          />
        </div>
      ) : null}

      {portfolioDetail ? (
        <KpiDetail
          key={openKpi}
          metric={openKpi ?? undefined}
          closing={closingKpi}
          {...portfolioDetail}
          onClose={closeKpi}
          onAsk={() =>
            ask({
              question: `¿Cómo va la cifra «${portfolioDetail.title}» en mi cartera estos 30 días? ¿Qué clientes destacan, para bien o para mal, y qué haría con ellos?`,
              focusLabel: portfolioDetail.title,
            })
          }
        />
      ) : null}

      {!business && overview.error ? <Banner tone="warn" action={<button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={() => overview.reload()}>Reintentar</button>}>No se ha podido cargar el resumen del negocio.</Banner> : null}
      <PortfolioClients rows={wb.portfolio} storesBy={storesBy} unreadBy={unreadBy} onSelect={onSelectClient} />

      {/* ------------------------------ Hoy ------------------------------ */}
      <section className={p.sec} aria-labelledby="mesa-hoy">
        <SectionHead
          id="mesa-hoy"
          title="Hoy"
          ai={null}
          onAsk={() => ask({ question: "Ordena mi bandeja de hoy: ¿qué haría primero y qué puede esperar?", focusLabel: "Bandeja de hoy" })}
        />
        <div className={ps.activityColumns}>
          <Inbox actions={wb.actions} filter={filter} onFilter={setFilter} onClient={onSelectClient} />
          <div className={s.stackCol}>
            <div className={cx(p.panel, ps.sidePanel)} id="mesa-chats">
              <div className={p.panelH}>
                <div>
                  <h3>Conversaciones</h3>
                  <p className={p.sub}>
                    {summary.unread_threads ? `${plural(summary.unread_threads, "chat", "chats")} sin leer` : "Todo leído"}
                  </p>
                </div>
                <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href="/mensajes">
                  Abrir chats
                </Link>
              </div>
              {threads.error && !threads.data ? (
                <p className={p.error}>No se pudieron cargar los chats.</p>
              ) : threadList.length === 0 ? (
                <Empty>{threads.isLoading ? "Cargando conversaciones…" : "Sin conversaciones todavía."}</Empty>
              ) : (
                <div>
                  {threadList.slice(0, 6).map((thread) => {
                    const who = thread.counterpart_name ?? thread.organization_name;
                    const mine = thread.last_message && thread.last_message.author_kind !== "client";
                    const text = thread.last_message
                      ? thread.last_message.body || (thread.last_message.has_attachments ? "Adjunto" : "")
                      : "Sin mensajes";
                    return (
                      <Link key={thread.organization_id} className={s.thr} href={`/mensajes?organizationId=${encodeURIComponent(thread.organization_id)}`}>
                        <span className={cx(s.av, ps.messageAvatar, thread.unread_count > 0 && s.avHot)} aria-hidden="true">
                          {initials(who)}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <b>
                            {thread.organization_name}
                            {thread.counterpart_name ? <span className={p.muted} style={{ fontWeight: 500 }}> · {thread.counterpart_name}</span> : null}
                          </b>
                          <p>
                            {mine ? "Tú: " : ""}
                            {text}
                          </p>
                        </span>
                        <span style={{ display: "grid", gap: 4, justifyItems: "end" }}>
                          {thread.last_message ? <span className={s.time}>{dayLabel(thread.last_message.created_at)}</span> : null}
                          {thread.unread_count ? <span className={s.unread}>{thread.unread_count}</span> : null}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            <Upcoming items={wb.upcoming} showClient />
          </div>
        </div>
      </section>

      <section className={p.sec} aria-labelledby="mesa-canales">
        <SectionHead id="mesa-canales" title="Resultados por canal" ai={null} onAsk={() => ask({question: "Compara los canales de mis clientes: ¿quién está por debajo de su ROAS de equilibrio o depende demasiado de Meta?", focusLabel: "Canales por cliente"})} />
        <PortfolioChannels rows={sortedMatrix} sort={sort} onSort={setSort} onSelect={onSelectClient} unavailable={[
          ...(orders.error && !orders.data ? [{label: "Shopify", retry: orders.reload}] : []),
          ...(meta.error && !meta.data ? [{label: "Meta", retry: meta.reload}] : []),
          ...(klaviyo.error && !klaviyo.data ? [{label: "Klaviyo", retry: klaviyo.reload}] : []),
        ]} />
      </section>

      <section className={p.sec} aria-labelledby="mesa-tiendas">
        <SectionHead id="mesa-tiendas" title="Actividad y calidad del dato" ai={null} onAsk={() => ask({question: "¿Qué tiendas de mi cartera han bajado pedidos este mes y por qué?", focusLabel: "Tiendas"})} />
        <div className={ps.storesColumns}>
          <PortfolioStores stores={stores} totalStores={overview.data?.stores ?? null} onSelect={onSelectClient} loading={orders.isLoading} error={Boolean(orders.error && !orders.data)} onRetry={orders.reload} />
          <aside className={ps.quality} aria-labelledby="mesa-calidad">
            <h3 id="mesa-calidad">Calidad de los datos</h3><p>Lo que conviene resolver antes de tomar decisiones.</p>
            {dataIssueRows.length ? <ul>{dataIssueRows.map(row => <li key={row.organization_id}><strong>{row.organization_name}</strong><p>{row.data_issues.join(" · ")}</p><button type="button" className={buttonVariants({ variant: "ghost", size: "sm" })} onClick={() => onSelectClient(row.organization_id)}>Revisar cliente</button></li>)}</ul> : <div className={ps.empty}>Sin incidencias detectadas en las fuentes disponibles.</div>}
          </aside>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Un cliente (o una de sus tiendas)
// ---------------------------------------------------------------------------

// La portada de un cliente vista por su consultor es la misma que ve el
// cliente (ClientPulse): titular, cifras, Prioridades, Vigilar y Canales, con
// los mismos estilos y los textos dichos desde su lado. Encima, lo que solo
// necesita el consultor para llevar la tienda: tres cifras más (ticket, ROAS
// frente a equilibrio, stock), el seguimiento de la relación con "Marcar como
// revisado", qué ha cambiado desde su revisión y los agentes que lanza él.
export function ConsultantClientDesk({ userId, organizationId, organizationName, connectionId }: {
  userId: string;
  organizationId: string;
  organizationName: string;
  connectionId: string | null;
}) {
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const workbench = useCachedQuery<DailyWorkbench>(`/v1/consultant/daily-workbench?days=30&organizationId=${encodeURIComponent(organizationId)}${scope}`);
  // Mismas claves que ClientPulse: comparten caché, no se piden dos veces.
  const metrics = useCachedQuery<Metrics>(`${base}/shopify/metrics?days=30${scope}`);
  const meta = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=30${scope}`);
  // Mismas claves que ClientPulse para A02 y A06: la lectura del detalle no cuesta otra llamada.
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30&view=overview${scope}`);
  const stockAi = useCachedQuery<Diagnostic>(`${base}/ai/stock-planner?days=30${scope}`);
  const verdictOf = useMetricAnalysis(organizationId, 30, connectionId);
  const router = useRouter();
  const week = useCachedQuery<Diagnostic>(`${base}/ai/plan/week?days=30${scope}`);
  const month = useCachedQuery<Diagnostic>(`${base}/ai/plan/month?days=30${scope}`);
  const extraProposals = useMemo(
    () => [week.data, month.data].filter((d): d is Diagnostic => Boolean(d)),
    [week.data, month.data],
  );

  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  const client = workbench.data?.client;
  const row = workbench.data?.portfolio.find((r) => r.organization_id === organizationId);
  const tier = tierOf(row?.status);
  const relationship = client?.relationship;
  const camino = client?.camino;

  const data = metrics.data;
  const money = (value: number | null | undefined, decimals = 0) => fmtCurrency(value, data?.currency_code, decimals);
  const previous = data?.previous_period ?? null;
  const acquisition = meta.data?.acquisition;
  const hasMeta = Boolean(acquisition && acquisition.days_with_data > 0);
  const breakeven = data?.financial_currency_coverage?.status === "compatible" ? data.financial?.breakeven_roas ?? null : null;

  // "Marcar como revisado" es explícito a propósito: abrir la ficha no puede
  // mover el corte, o el consultor perdería la comparación justo al entrar.
  async function markReviewed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingReview(true);
    try {
      const response = await apiFetch(`/v1/consultant/organizations/${organizationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewNote.trim() ? { note: reviewNote.trim() } : {}),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Revisión marcada. A partir de aquí empieza lo nuevo.");
      setReviewing(false);
      setReviewNote("");
      invalidateApiGetCache();
      workbench.reload();
    } catch {
      toast.danger("No se pudo marcar la revisión. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setSavingReview(false);
    }
  }

  // Lectura de un agente sobre una cifra: hallazgo de A02 o de A06 (stock).
  // Con patrón, el hallazgo del agente sobre esa cifra; sin patrón, su lectura entera.
  const agentLine = (tag: string, diagnostic: Diagnostic | undefined, pattern: RegExp | null) => {
    if (!pattern && diagnostic) return <DiagnosticReading tag={tag} diagnostic={diagnostic} audience="consultor" maxFindings={3} />;
    const finding = pattern ? findingFor(diagnostic, pattern) : null;
    return <FindingReading tag={tag} finding={finding} steps={findingSteps(diagnostic, finding)} audience="consultor" />;
  };
  const route = (href: string) => withPortalRouteContext(href, organizationId, connectionId);
  const roasAnalysis = verdictOf("meta_roas");
  const daily = data?.daily ?? [];
  const extraKpiDetails: Record<string, KpiDetailData> = {
    aov: {
      title: "Ticket medio",
      chart: (
        <SalesChart
          daily={daily.filter((d) => d.orders_count > 0).map((d) => ({ date: d.date, value: d.net_sales / d.orders_count, detail: `${fmtNum(d.orders_count)} pedidos` }))}
          previousAverage={previous?.sales.aov ?? null}
          averageLabel="Ticket del periodo anterior"
          pins={[]}
          active={null}
          onPin={() => undefined}
          currencyCode={data?.currency_code}
          label="Ticket medio por día"
        />
      ),
      ai: null,
      href: route("/shopify"),
      action: "Ver ventas en Shopify",
    },
    roas: {
      title: "ROAS Meta",
      chart: (
        <KpiBars
          label="ROAS por campaña"
          rows={(meta.data?.campaigns ?? [])
            .map((c) => ({ c, roas: c.roas == null ? null : Number(c.roas), spend: Number(c.spend ?? 0) }))
            .filter((row) => row.spend > 0)
            .sort((a, b) => (b.roas ?? -1) - (a.roas ?? -1))
            .slice(0, 8)
            .map(({ c, roas }) => ({
              key: c.campaign_id,
              id: c.campaign_id,
              name: c.campaign_name ?? "Campaña sin nombre",
              value: roas,
              text: roas != null ? `${fmtNum(roas, 2)}×` : "—",
              tone: roas != null && breakeven !== null && roas < breakeven ? ("bad" as const) : undefined,
            }))}
          onSelect={(id) => router.push(route(`/meta/campanas/${encodeURIComponent(id)}`))}
        />
      ),
      ai: roasAnalysis ? <A29Reading analysis={roasAnalysis} tag="A29" audience="consultor" /> : null,
      href: route(hasMeta ? "/meta" : "/integraciones/meta"),
      action: hasMeta ? "Ver campañas en Meta" : "Conectar Meta",
    },
    stock: {
      title: "Stock",
      chart: data ? (
        <p className={p.trackTxt}>
          {plural(data.stock.out_of_stock_items, "producto agotado", "productos agotados")} y {plural(data.stock.low_stock_items, "producto", "productos")} con poco stock de {fmtNum(data.stock.tracked_items)} con inventario.
        </p>
      ) : null,
      ai: agentLine("A06", stockAi.data, null),
      href: route(data?.stock.out_of_stock_items ? "/shopify/inventario?filter=out" : "/shopify/inventario?filter=low"),
      action: "Ver inventario",
    },
  };

  const extraKpis = (open: string | null, toggle: (key: string) => () => void) => data ? (
    <>
      <Kpi
        metric="aov"
        aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Ticket medio" metricKey="average_order_value" pattern={/ticket|aov|pedido medio|cesta/i} audience="consultor" />}
        numericValue={data.sales.aov}
        previousNumericValue={previous?.sales.aov}
        open={open === "aov"}
        onOpen={toggle("aov")}
        label="Ticket medio"
        value={money(data.sales.aov, 2)}
        delta={<Delta change={salesChangePct(data.sales.aov, previous?.sales.aov ?? null)} />}
        vs={previous ? money(previous.sales.aov, 2) : null}
        slot={<p className={p.trackTxt}>Por pedido</p>}
      />
      <Kpi
        metric="roas"
        aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="ROAS Meta" metricKey="meta_roas" pattern={/roas|meta|anunc|campa/i} audience="consultor" />}
        numericValue={hasMeta ? acquisition?.roas : null}
        open={open === "roas"}
        onOpen={toggle("roas")}
        label="ROAS Meta"
        value={hasMeta && acquisition?.roas != null ? `${fmtNum(acquisition.roas, 2)}×` : "—"}
        tag={hasMeta && acquisition?.roas != null && breakeven !== null && acquisition.roas < breakeven ? "bajo equilibrio" : undefined}
        slot={
          <p className={p.trackTxt}>
            {!hasMeta ? "Sin datos de Meta" : breakeven !== null ? `Equilibrio ${fmtNum(breakeven, 2)}× · atribuido por Meta` : "Atribuido por Meta"}
          </p>
        }
      />
      <Kpi
        metric="stock"
        aiNotice={<A02MetricNotice diagnostic={monitor.data} metricLabel="Stock" metricKey="stock_risk" pattern={/stock|inventario|agotad|rotura/i} audience="consultor" />}
        open={open === "stock"}
        onOpen={toggle("stock")}
        label="Stock"
        value={`${fmtNum(data.stock.out_of_stock_items)} agotados`}
        tag={data.stock.out_of_stock_items ? "agotados" : undefined}
        slot={<p className={p.trackTxt}>{plural(data.stock.low_stock_items, "producto", "productos")} con poco stock</p>}
      />
    </>
  ) : null;

  const seguimiento = (
      <section className={p.pBlock} aria-labelledby="desk-seguimiento">
        <h2 id="desk-seguimiento" className={p.pBlockT}>Seguimiento del cliente</h2>
        <p className="mb-2 text-xs text-muted">Relación y revisión de {organizationName}, incluidas todas sus tiendas.</p>
        <ul className={p.pList}>
          {tier ? (
            <li className={tier.cls}>
              <span className={p.pRow}>
                <span className={p.dot} style={{ background: "var(--t)" }} aria-hidden="true" />
                <span className={p.pRowT}>
                  Estado de la cuenta
                  <small>
                    {client?.last_review
                      ? `Revisada ${dayLabel(client.last_review.reviewed_at, true)}${client.last_review.note ? ` · ${client.last_review.note}` : ""}`
                      : "Sin revisión tuya todavía"}
                  </small>
                </span>
                <span className={p.pRowV}>{tier.label}</span>
              </span>
            </li>
          ) : null}
          <li>
            <Link className={cx(p.pRow, "hover-sweep")} href="/llamadas">
              <span className={cx(p.dot, p.dotMuted)} aria-hidden="true" />
              <span className={p.pRowT}>
                Próxima llamada
                <small>
                  {relationship?.last_call?.held_at
                    ? `Última ${dayLabel(relationship.last_call.held_at, true)}${relationship.last_call.summary_pending ? " · resumen pendiente" : ""}`
                    : "Sin llamadas anteriores"}
                </small>
              </span>
              <span className={p.pRowV}>
                {relationship?.next_call?.scheduled_at
                  ? `${dayLabel(relationship.next_call.scheduled_at, true)}, ${clock(relationship.next_call.scheduled_at)}`
                  : "Sin agendar"}
              </span>
            </Link>
          </li>
          <li>
            <Link className={cx(p.pRow, "hover-sweep")} href="/mensajes">
              <span className={cx(p.dot, relationship?.unread_count ? p.dotWarn : p.dotMuted)} aria-hidden="true" />
              <span className={p.pRowT}>
                Mensajes sin leer
                <small>{relationship?.counterpart_name ?? organizationName}</small>
              </span>
              <span className={p.pRowV}>{fmtNum(relationship?.unread_count ?? 0)}</span>
            </Link>
          </li>
          <li>
            <Link className={cx(p.pRow, "hover-sweep")} href={route("/camino")}>
              <span className={cx(p.dot, p.dotMuted)} aria-hidden="true" />
              <span className={p.pRowT}>
                {camino ? `Camino · ${camino.store_name ?? "tienda"} · ${camino.phase_name}` : "Camino de la tienda"}
                <small>
                  {camino?.next_milestone ? `Siguiente: ${camino.next_milestone.name}` : camino ? "Sin hito siguiente" : client?.camino_notice ?? "Sin plan estratégico"}
                </small>
              </span>
              <span className={p.pRowV}>{camino ? `${camino.milestones_done}/${camino.milestones_total}` : "—"}</span>
            </Link>
          </li>
        </ul>
        {reviewing ? (
          <form className={s.review} onSubmit={markReviewed}>
            <label className="sr-only" htmlFor="desk-review-note">Nota de la revisión (opcional)</label>
            <input
              id="desk-review-note"
              value={reviewNote}
              maxLength={500}
              autoFocus
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder="Qué has mirado o dejado pendiente (opcional)"
            />
            <button type="submit" className={buttonVariants({ size: "sm" })} disabled={savingReview}>
              {savingReview ? "Guardando…" : "Confirmar"}
            </button>
            <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={() => setReviewing(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" className={buttonVariants({ size: "sm" })} onClick={() => setReviewing(true)}>
            Marcar como revisado
          </button>
        )}
      </section>
  );

  const sideTop = (
    <>{seguimiento}</>
  );

  return (
    <ClientPulse
      userId={userId}
      organizationId={organizationId}
      organizationName={organizationName}
      connectionId={connectionId}
      consultant={null}
      asConsultant
      extraProposals={extraProposals}
      extraKpis={extraKpis}
      extraKpiDetails={extraKpiDetails}
      sideTop={sideTop}
      onReload={() => {
        week.reload();
        month.reload();
        workbench.reload();
      }}
    />
  );
}
