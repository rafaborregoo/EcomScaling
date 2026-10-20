"use client";

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
import { Skeleton, toast } from "@/components/ui";
import type { DailyWorkbench, PortfolioHealthRow, UpcomingItem, WorkbenchAction } from "../consultor/workbench";
import {
  ClientPulse,
  Delta,
  Empty,
  Kpi,
  KpiBars,
  KpiDetail,
  SalesChart,
  SectionHead,
  ago,
  cx,
  dayLabel,
  findingFor,
  type Diagnostic,
  type KpiDetailData,
  type MetaMetrics,
  type Metrics,
} from "./client-pulse";
import { clientReadable, evidenceText, fmtCurrency, fmtNum } from "./client-pulse-model";
import { AiExplanation, useMetricAnalysis } from "@/components/metric-verdict";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import { formatMoney } from "@/lib/money";
import { salesChangePct } from "./store-pulse";
import { ClientShopify } from "./client-shopify";
import { ClientMeta } from "./client-meta";
import { ClientKlaviyo } from "./client-klaviyo";
import p from "./client-pulse.module.css";
import { DashboardSections } from "./dashboard-sections";
import s from "./consultant-desk.module.css";

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
  { key: "decision", label: "Mi decisión", test: (a) => DECISION_KINDS.includes(a.kind) },
  { key: "datos", label: "Datos", test: (a) => DATA_KINDS.includes(a.kind) },
];

const plural = (n: number, one: string, many: string) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const sourceMoney = (value: number | null, currencyCode: string | null) =>
  value == null || !currencyCode ? "—" : formatMoney(value, currencyCode);
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
  const kindClass =
    action.kind === "ai_proposal"
      ? s.kindAi
      : action.priority === "urgent"
        ? s.kindUrgent
        : action.priority === "high"
          ? s.kindHigh
          : undefined;
  return (
    <li className={cx(s.act, "task-lift")}>
      <span className={cx(s.kind, kindClass)}>{KIND_LABEL[action.kind]}</span>
      <div>
        <p className={s.actT}>
          {onClient ? (
            <>
              <button type="button" onClick={() => onClient(action.organization_id)}>
                {action.organization_name}
              </button>
              {" · "}
            </>
          ) : null}
          {action.title}
        </p>
        <p className={s.actR}>{action.reason}</p>
        {action.evidence.length ? (
          <div className={s.evid}>
            {action.evidence.slice(0, 4).map((item, i) => (
              <span key={`${item.label}-${i}`}>
                {item.label} <b>{item.value}</b>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <Link className={cx(p.btn, p.ghost, p.sm)} href={action.href}>
        {action.action_label}
      </Link>
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
  const shown = showAll ? visible : visible.slice(0, 8);
  const clients = new Set(actions.map((a) => a.organization_id)).size;
  return (
    <div className={p.panel}>
      <div className={p.panelH} style={{ flexWrap: "wrap" }}>
        <div>
          <h3>Bandeja</h3>
          <p className={p.sub}>
            {plural(actions.length, "asunto", "asuntos")} de {plural(clients, "cliente", "clientes")} · lo más urgente arriba
          </p>
        </div>
        <div className={p.seg} role="group" aria-label="Filtrar la bandeja">
          {INBOX_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={f.key === active.key}
              onClick={() => {
                onFilter(f.key);
                setShowAll(false);
              }}
            >
              {f.label}
              <b>{actions.filter(f.test).length}</b>
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <Empty action={filter !== "todo" ? <button type="button" className={cx(p.btn, p.ghost, p.sm)} onClick={() => onFilter("todo")}>Ver toda la bandeja</button> : undefined}>
          {filter === "todo" ? "No hay asuntos pendientes en las fuentes disponibles." : "No hay asuntos que coincidan con este filtro."}
        </Empty>
      ) : (
        <ul>
          {shown.map((action) => (
            <ActionRow key={action.id} action={action} onClient={onClient} />
          ))}
        </ul>
      )}
      {visible.length > shown.length ? (
        <button type="button" className={cx(p.btn, p.ghost, p.sm, s.showAll)} onClick={() => setShowAll(true)}>
          Ver los {visible.length}
        </button>
      ) : null}
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
              <li key={`${item.kind}-${item.id}`} className={cx(s.ag, "task-lift")}>
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

type MatrixKey = "name" | "sales" | "orders" | "roas" | "cac" | "dep" | "email" | "emailRev" | "alerts";
type MatrixRow = {
  id: string;
  name: string;
  tier: PortfolioHealthRow["status"];
  rank: number;
  sales: number | null;
  salesCurrencyCode: string | null;
  orders: number | null;
  roas: number | null;
  breakEven: number | null;
  cac: number | null;
  cacCurrencyCode: string | null;
  cacDelta: number | null;
  dep: number | null;
  sent: number | null;
  lastSend: string | null;
  emailRev: number | null;
  emailRevCurrencyCode: string | null;
  alerts: number;
};

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<{ key: MatrixKey; dir: 1 | -1 } | null>(null);
  const [today] = useState(() => new Date());
  // Cifra de la cartera abierta: reparto por cliente, lectura y a dónde ir.
  const [openKpi, setOpenKpi] = useState<string | null>(null);

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
      return {
        id: row.organization_id,
        name: row.organization_name,
        tier: row.status,
        rank,
        sales: o?.net_sales ?? null,
        salesCurrencyCode: o?.currency_code ?? null,
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

  const sortedMatrix = useMemo(() => {
    if (!sort) return matrix;
    const value = (row: MatrixRow): number | string | null =>
      sort.key === "name"
        ? row.name
        : sort.key === "email"
          ? row.sent
          : (row[sort.key as Exclude<MatrixKey, "name" | "email">] as number | null);
    return matrix.slice().sort((a, b) => {
      if (sort.key === "sales" && a.salesCurrencyCode !== b.salesCurrencyCode) {
        return a.name.localeCompare(b.name, "es") * sort.dir;
      }
      const va = value(a);
      const vb = value(b);
      if (va === null && vb === null) return a.rank - b.rank;
      if (va === null) return 1; // sin dato, siempre al final
      if (vb === null) return -1;
      if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb)) * sort.dir;
      return (va - vb) * sort.dir || a.rank - b.rank;
    });
  }, [matrix, sort]);

  if (workbench.isLoading && !wb) {
    return (
      <div className={p.root}>
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
      <div className={p.root}>
        <div className={p.hero}>
          <p className={p.heroMeta}>Tu cartera</p>
          <h1 className={p.headline}>No se pudo cargar la mesa</h1>
          <p className={p.headlineDetail}>{workbench.error ?? "Reintenta en unos segundos."}</p>
          <div className={p.heroActions}>
            <button type="button" className={cx(p.btn, p.acc)} onClick={() => workbench.reload()}>
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
  const maxStoreOrders = Math.max(1, ...stores.map((st) => st.orders_count));
  const planMix = Object.entries(overview.data?.plan_mix ?? {}).sort((a, b) => b[1] - a[1]);
  const withoutStore = (overview.data?.portfolio ?? []).filter((r) => r.store_count === 0).length;

  // ---- detalle de las cifras de la cartera ----
  // No hay un agente sobre la cartera entera: la lectura sale de los datos
  // (concentración, quién está por debajo) y "Preguntar a la IA" lleva al copiloto.
  const toggleKpi = (key: string) => () => setOpenKpi((current) => (current === key ? null : key));
  const shopifyCurrency = business?.shopify_currency_code ?? null;
  const metaCurrency = business?.meta_currency_code ?? null;
  const nameOf = new Map(wb.portfolio.map((row) => [row.organization_id, row.organization_name]));
  // Las barras solo comparan importes en la misma moneda; el resto se lista sin barra.
  const sameCurrency = (code: string | null, base: string | null) => !base || !code || code === base;
  const bySales = matrix.filter((r) => r.sales != null).sort((a, b) => (b.sales ?? 0) - (a.sales ?? 0));
  const byOrders = matrix.filter((r) => r.orders != null).sort((a, b) => (b.orders ?? 0) - (a.orders ?? 0));
  const byRoas = matrix.filter((r) => r.roas != null).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
  const metaSpend = (meta.data?.clients ?? []).filter((c) => (c.spend ?? 0) > 0).sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  const share = (part: number | null | undefined, total: number | null | undefined) =>
    part != null && total ? Math.round((part / total) * 100) : null;
  const reading = (text: string | null) =>
    text ? <p className={p.aiLine}>{text}</p> : <p className={p.aiLine}>Sin datos suficientes para leer esta cifra todavía.</p>;
  const belowBreakEven = byRoas.filter((r) => r.breakEven !== null && (r.roas ?? 0) < r.breakEven);
  const withoutOrders = matrix.filter((r) => r.orders === 0);
  const topSalesShare = bySales[0] && sameCurrency(bySales[0].salesCurrencyCode, shopifyCurrency) ? share(bySales[0].sales, business?.net_sales) : null;
  const topSpendShare = metaSpend[0] && sameCurrency(metaSpend[0].currency_code, metaCurrency) ? share(metaSpend[0].spend, business?.meta_spend) : null;
  const storeAov = (orders.data?.stores ?? []).filter((st) => st.aov != null).sort((a, b) => (b.aov ?? 0) - (a.aov ?? 0));
  const portfolioDetails: Record<string, KpiDetailData> = {
    sales: {
      title: "Ventas netas",
      chart: (
        <KpiBars
          rows={bySales.map((r) => ({ key: r.id, id: r.id, name: r.name, value: sameCurrency(r.salesCurrencyCode, shopifyCurrency) ? r.sales : null, text: sourceMoney(r.sales, r.salesCurrencyCode) }))}
          onSelect={onSelectClient}
        />
      ),
      ai: reading(topSalesShare !== null ? `${bySales[0].name} concentra el ${topSalesShare} % de las ventas de la cartera.` : null),
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
          : byOrders[0] && business?.orders
            ? `${byOrders[0].name} trae el ${share(byOrders[0].orders, business.orders)} % de los pedidos.`
            : null,
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
            value: sameCurrency(st.currency_code, shopifyCurrency) ? st.aov : null,
            text: sourceMoney(st.aov, st.currency_code),
          }))}
          onSelect={onSelectClient}
        />
      ),
      ai: reading(
        storeAov.length > 1
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
      ai: reading(topSpendShare !== null ? `${nameOf.get(metaSpend[0].organization_id) ?? "Un cliente"} se lleva el ${topSpendShare} % de la inversión en Meta.` : null),
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
            : "Todos los clientes con Meta están por encima de su ROAS de equilibrio."
          : null,
      ),
      href: "#mesa-canales",
      action: "Ver canales por cliente",
    },
  };
  const portfolioDetail = openKpi ? portfolioDetails[openKpi] : null;

  function jump(next: InboxFilter) {
    setFilter(next);
    document.getElementById("mesa-hoy")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function sortBy(key: MatrixKey) {
    setSort((current) =>
      current?.key === key ? (current.dir === -1 ? { key, dir: 1 } : null) : { key, dir: key === "name" ? 1 : -1 },
    );
  }

  const th = (key: MatrixKey, label: string) => (
    <th scope="col" aria-sort={sort?.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => sortBy(key)}>
        {label}
        {sort?.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className={p.root}>
      <DashboardSections items={[{ id: "mesa-headline", label: "Cartera" }, { id: "mesa-hoy", label: "Bandeja" }, { id: "mesa-canales", label: "Canales por cliente" }, { id: "mesa-tiendas", label: "Tiendas" }]} />
      {/* ------------------------------ Hero ------------------------------ */}
      <section className={p.hero} aria-labelledby="mesa-headline">
        <div className={p.heroTop}>
          <div>
            <p className={p.heroMeta}>
              <span>{today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}</span>
              <span>
                Tu cartera · {plural(summary.clients, "cliente", "clientes")}
                {overview.data ? ` · ${plural(overview.data.stores, "tienda", "tiendas")}` : ""}
              </span>
              <span>Mesa actualizada {ago(wb.generated_at)}</span>
            </p>
            <h1 id="mesa-headline" className={p.headline}>
              {firstName ? `${greeting}, ${firstName}. ` : ""}
              {headline}
            </h1>
            <p className={p.headlineDetail}>
              Lo demás está vigilado: alertas, tareas, llamadas, mensajes, integraciones, hitos y propuestas de la IA.
            </p>
            {downSources.length ? (
              <p className={p.headlineDetail} style={{ color: "var(--accent)" }}>
                No se pudieron leer {downSources.join(", ")}: la mesa puede estar incompleta.
              </p>
            ) : null}
            <div className={p.heroActions}>
              <button
                type="button"
                className={cx(p.btn, p.acc)}
                onClick={() =>
                  ask({
                    question: "¿Qué cliente de mi cartera necesita más mi atención hoy y qué haría primero con él?",
                    focusLabel: "Tu cartera",
                  })
                }
              >
                <span className={p.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>
                  IA
                </span>
                ¿Por dónde empiezo?
              </button>
              <a className={cx(p.btn, p.ghost)} href="#mesa-hoy">
                Ir a la bandeja
              </a>
            </div>
          </div>
          <div className={s.counters}>
            <button type="button" className={cx(s.counter, urgentActions > 0 && s.hot)} onClick={() => jump("urgente")}>
              <b>{fmtNum(urgentActions)}</b>
              <span>Urgentes</span>
            </button>
            <button type="button" className={s.counter} onClick={() => jump("decision")}>
              <b>{fmtNum(decisions)}</b>
              <span>Esperan tu decisión</span>
            </button>
            <button
              type="button"
              className={cx(s.counter, summary.unread_threads > 0 && s.hot)}
              onClick={() => document.getElementById("mesa-chats")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <b>{fmtNum(summary.unread_threads)}</b>
              <span>Chats sin leer</span>
            </button>
            {summary.data_issues ? (
              <button type="button" className={s.counter} onClick={() => jump("datos")} style={{ gridColumn: "1 / -1" }}>
                <b>{fmtNum(summary.data_issues)}</b>
                <span>Problemas de datos o integraciones</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Tablero de triaje: los mismos tramos que /consultor y el overview. */}
        <div className={s.board}>
          {TIERS.map((tier) => {
            const list = wb.portfolio.filter((row) => row.status === tier.key);
            const shown = expanded[tier.key] ? list : list.slice(0, 5);
            return (
              <div key={tier.key} className={cx(s.col, tier.cls)}>
                <p className={s.colH}>
                  <i aria-hidden="true" />
                  {tier.label}
                  <b>{list.length}</b>
                </p>
                {list.length === 0 ? <p className={s.colEmpty}>Nadie aquí.</p> : null}
                {shown.map((row) => {
                  const unread = unreadBy.get(row.organization_id) ?? 0;
                  const storeCount = storesBy.get(row.organization_id);
                  const otherAlerts = row.open_alerts - row.critical_alerts;
                  return (
                    <button key={row.organization_id} type="button" className={s.card} aria-label={`Abrir ${row.organization_name}, estado ${tier.label}`} onClick={() => onSelectClient(row.organization_id)}>
                      <span className={s.cardT}>
                        {row.organization_name}
                        {storeCount ? <small>{plural(storeCount, "tienda", "tiendas")}</small> : null}
                      </span>
                      <span className={s.cardR}>
                        {row.next_action?.title ?? row.data_issues[0] ?? row.next_event?.label ?? "Sin nada pendiente"}
                      </span>
                      <span className={s.cardB}>
                        {row.critical_alerts ? <span className={s.b}>{plural(row.critical_alerts, "crítica", "críticas")}</span> : null}
                        {otherAlerts > 0 ? <span>{plural(otherAlerts, "alerta", "alertas")}</span> : null}
                        {unread ? <span className={s.a}>{unread} sin leer</span> : null}
                        {row.data_issues.length ? <span className={s.w}>datos</span> : null}
                      </span>
                    </button>
                  );
                })}
                {list.length > shown.length ? (
                  <button type="button" className={s.more} onClick={() => setExpanded((e) => ({ ...e, [tier.key]: true }))}>
                    y {list.length - shown.length} más
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------ KPIs ------------------------------ */}
      {business ? (
        <div className={p.kpis} aria-label="Cifras de la cartera, últimos 30 días">
          <Kpi
            open={openKpi === "sales"}
            onOpen={toggleKpi("sales")}
            label="Ventas netas"
            value={sourceMoney(business.net_sales, business.shopify_currency_code)}
            delta={<Delta change={business.net_sales != null && business.prev_net_sales != null ? salesChangePct(business.net_sales, business.prev_net_sales) : null} />}
            vs={sourceMoney(business.prev_net_sales, business.shopify_currency_code)}
            slot={<p className={p.trackTxt}>Todas las tiendas, 30 días</p>}
          />
          <Kpi
            open={openKpi === "orders"}
            onOpen={toggleKpi("orders")}
            label="Pedidos"
            value={fmtNum(business.orders)}
            delta={<Delta change={salesChangePct(business.orders, business.prev_orders)} />}
            vs={fmtNum(business.prev_orders)}
            slot={<p className={p.trackTxt}>Pedidos de Shopify</p>}
          />
          <Kpi
            open={openKpi === "aov"}
            onOpen={toggleKpi("aov")}
            label="Ticket medio"
            value={business.orders && business.net_sales != null ? sourceMoney(business.net_sales / business.orders, business.shopify_currency_code) : "—"}
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
            open={openKpi === "spend"}
            onOpen={toggleKpi("spend")}
            label="Inversión Meta"
            value={sourceMoney(business.meta_spend, business.meta_currency_code)}
            vs={sourceMoney(business.prev_meta_spend, business.meta_currency_code)}
            slot={<p className={p.trackTxt}>Suma de todas las cuentas</p>}
          />
          <Kpi
            open={openKpi === "roas"}
            onOpen={toggleKpi("roas")}
            label="ROAS Meta"
            value={business.roas !== null ? `${fmtNum(business.roas, 2)}×` : "—"}
            slot={<p className={p.trackTxt}>{sourceMoney(business.meta_purchase_value, business.meta_currency_code)} atribuidos por Meta</p>}
          />
          <Kpi
            label="Cartera"
            value={plural(overview.data?.clients ?? summary.clients, "cliente", "clientes")}
            slot={
              <p className={p.trackTxt}>
                {plural(overview.data?.stores ?? 0, "tienda", "tiendas")}
                {withoutStore ? ` · ${withoutStore} sin tienda` : ""}
              </p>
            }
          />
        </div>
      ) : null}

      {portfolioDetail ? (
        <KpiDetail
          {...portfolioDetail}
          onClose={() => setOpenKpi(null)}
          onAsk={() =>
            ask({
              question: `¿Cómo va la cifra «${portfolioDetail.title}» en mi cartera estos 30 días? ¿Qué clientes destacan, para bien o para mal, y qué haría con ellos?`,
              focusLabel: portfolioDetail.title,
            })
          }
        />
      ) : null}

      {/* ------------------------------ Hoy ------------------------------ */}
      <section className={p.sec} aria-labelledby="mesa-hoy">
        <SectionHead
          id="mesa-hoy"
          title="Hoy"
          ai={null}
          fallback={
            wb.actions.length
              ? "Cada fila dice qué hacer, por qué ahora y con qué evidencia; el botón abre el módulo con el cliente ya elegido."
              : null
          }
          onAsk={() => ask({ question: "Ordena mi bandeja de hoy: ¿qué haría primero y qué puede esperar?", focusLabel: "Bandeja de hoy" })}
        />
        <div className={p.two}>
          <Inbox actions={wb.actions} filter={filter} onFilter={setFilter} onClient={onSelectClient} />
          <div className={s.stackCol}>
            <div className={p.panel} id="mesa-chats">
              <div className={p.panelH}>
                <div>
                  <h3>Conversaciones</h3>
                  <p className={p.sub}>
                    {summary.unread_threads ? `${plural(summary.unread_threads, "chat", "chats")} sin leer` : "Todo leído"}
                  </p>
                </div>
                <Link className={cx(p.btn, p.ghost, p.sm)} href="/mensajes">
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
                      <button key={thread.organization_id} type="button" className={s.thr} onClick={() => onSelectClient(thread.organization_id)}>
                        <span className={cx(s.av, thread.unread_count > 0 && s.avHot)} aria-hidden="true">
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
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <Upcoming items={wb.upcoming} showClient />
          </div>
        </div>
      </section>

      {/* ------------------------------ Canales ------------------------------ */}
      <section className={p.sec} aria-labelledby="mesa-canales">
        <SectionHead
          id="mesa-canales"
          title="Canales por cliente"
          ai={null}
          fallback="ROAS frente al equilibrio de cada cliente, no frente a una media. Lo atribuido por Meta y por Klaviyo va por separado: no se suma."
          onAsk={() =>
            ask({
              question: "Compara los canales de mis clientes: ¿quién está por debajo de su ROAS de equilibrio o depende demasiado de Meta?",
              focusLabel: "Canales por cliente",
            })
          }
        />
        <div className={p.panel}>
          {matrix.length === 0 ? (
            <Empty>No tienes clientes asignados todavía.</Empty>
          ) : (
            <div className={s.matrix} role="region" aria-label="Canales por cliente; desliza para ver todas las columnas" tabIndex={0}>
              <table aria-label="Resultados y alertas por cliente">
                <thead>
                  <tr>
                    {th("name", "Cliente")}
                    {th("sales", "Ventas 30 d")}
                    {th("orders", "Pedidos")}
                    {th("roas", "ROAS vs equilibrio")}
                    {th("cac", "CPA Meta")}
                    {th("dep", "Dependencia Meta")}
                    {th("email", "Campañas email")}
                    {th("emailRev", "Atribuido Klaviyo")}
                    {th("alerts", "Alertas")}
                  </tr>
                </thead>
                <tbody>
                  {sortedMatrix.map((row) => {
                    const scale = Math.max(row.roas ?? 0, row.breakEven ?? 0) * 1.25 || 1;
                    const below = row.roas !== null && row.breakEven !== null && row.roas < row.breakEven;
                    return (
                      <tr key={row.id} className={tierOf(row.tier)?.cls} onClick={() => onSelectClient(row.id)}>
                        <td>
                          <button
                            type="button"
                            className={s.cl}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectClient(row.id);
                            }}
                            style={{ border: 0, background: "transparent", padding: 0, color: "inherit", cursor: "pointer", font: "inherit", fontWeight: 600 }}
                          >
                            <i aria-hidden="true" />
                            {row.name}
                            <span className={p.chip}>{tierOf(row.tier)?.label ?? "Sin estado"}</span>
                          </button>
                        </td>
                        <td className={s.n}>{sourceMoney(row.sales, row.salesCurrencyCode)}</td>
                        <td className={s.n}>{row.orders !== null ? fmtNum(row.orders) : "—"}</td>
                        <td className={s.n}>
                          {row.roas !== null ? (
                            <>
                              <span className={s.rb} aria-hidden="true">
                                <i style={{ width: `${Math.min(100, (row.roas / scale) * 100)}%` }} />
                                {row.breakEven !== null ? <b style={{ left: `${(row.breakEven / scale) * 100}%` }} /> : null}
                              </span>
                              <span className={below ? s.bad : undefined}>{fmtNum(row.roas, 2)}×</span>
                              {row.breakEven !== null ? <span className={p.muted}> / {fmtNum(row.breakEven, 2)}×</span> : null}
                            </>
                          ) : (
                            <span className={p.muted}>sin Meta</span>
                          )}
                        </td>
                        <td className={s.n}>
                          {sourceMoney(row.cac, row.cacCurrencyCode)}{" "}
                          {row.cacDelta !== null && Math.abs(row.cacDelta) >= 0.5 ? (
                            <span className={row.cacDelta > 0 ? s.bad : s.good}>
                              {row.cacDelta > 0 ? "▲" : "▼"} {fmtNum(Math.abs(row.cacDelta), Math.abs(row.cacDelta) < 10 ? 1 : 0)} %
                            </span>
                          ) : null}
                        </td>
                        <td className={s.n}>
                          {row.dep !== null ? (
                            <>
                              <span className={s.dep} aria-hidden="true">
                                <i style={{ width: `${Math.min(100, row.dep)}%` }} />
                              </span>
                              {fmtNum(row.dep)} %
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={s.n}>
                          {row.sent !== null ? (
                            <>
                              {fmtNum(row.sent)}
                              {row.lastSend ? <span className={p.muted}> · último {dayLabel(row.lastSend)}</span> : null}
                            </>
                          ) : (
                            <span className={p.muted}>sin Klaviyo</span>
                          )}
                        </td>
                        <td className={s.n}>{sourceMoney(row.emailRev, row.emailRevCurrencyCode)}</td>
                        <td className={s.n}>{row.alerts ? fmtNum(row.alerts) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------ Tiendas ------------------------------ */}
      <section className={p.sec} aria-labelledby="mesa-tiendas">
        <SectionHead
          id="mesa-tiendas"
          title="Tiendas"
          ai={null}
          fallback="Por tienda, no por cliente: una tienda parada no se esconde en el total de su cliente."
          onAsk={() => ask({ question: "¿Qué tiendas de mi cartera han bajado pedidos este mes y por qué?", focusLabel: "Tiendas" })}
        />
        <div className={p.two}>
          <div className={p.panel}>
            <div className={p.panelH}>
              <div>
                <h3>Pedidos por tienda</h3>
                <p className={p.sub}>Últimos 30 días</p>
              </div>
            </div>
            {orders.error && !orders.data ? (
              <p className={p.error}>No se pudieron cargar los pedidos.</p>
            ) : stores.length === 0 ? (
              <Empty>{orders.isLoading ? "Cargando pedidos…" : "Sin pedidos en los últimos 30 días."}</Empty>
            ) : (
              <div className={s.bars}>
                {stores.slice(0, 12).map((store) => (
                  <button
                    key={store.store_id}
                    type="button"
                    className={s.barR}
                    onClick={() => onSelectClient(store.organization_id)}
                    style={{ border: 0, background: "transparent", padding: 0, color: "inherit", textAlign: "left", cursor: "pointer" }}
                  >
                    <span>
                      <b>{store.shop_name}</b> <span className={p.muted}>· {store.organization_name}</span>
                    </span>
                    <span className={s.n}>
                      {fmtNum(store.orders_count)} ped · {sourceMoney(store.net_sales, store.currency_code)} · ticket {sourceMoney(store.aov, store.currency_code)}
                    </span>
                    <span className={s.barT} aria-hidden="true">
                      <i style={{ width: `${(store.orders_count / maxStoreOrders) * 100}%` }} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={p.panel}>
            <div className={p.panelH}>
              <div>
                <h3>Tu cartera</h3>
                <p className={p.sub}>Planes de tus clientes</p>
              </div>
            </div>
            {planMix.length === 0 ? (
              <Empty>Sin datos de planes.</Empty>
            ) : (
              <div>
                {planMix.map(([plan, count]) => (
                  <div key={plan} className={s.chanR}>
                    <span>{plan}</span>
                    <b>{plural(count, "cliente", "clientes")}</b>
                  </div>
                ))}
                {withoutStore ? (
                  <div className={s.chanR}>
                    <span>Sin tienda conectada</span>
                    <b>{plural(withoutStore, "cliente", "clientes")}</b>
                  </div>
                ) : null}
              </div>
            )}
          </div>
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
  const workbench = useCachedQuery<DailyWorkbench>(`/v1/consultant/daily-workbench?days=30&organizationId=${encodeURIComponent(organizationId)}`);
  // Mismas claves que ClientPulse: comparten caché, no se piden dos veces.
  const metrics = useCachedQuery<Metrics>(`${base}/shopify/metrics?days=30${scope}`);
  const meta = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=30`);
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
  const agentLine = (tag: string, diagnostic: Diagnostic | undefined, pattern: RegExp | null) => {
    const finding = pattern ? findingFor(diagnostic, pattern) : null;
    const text = finding ? clientReadable(finding.title) ?? finding.title : clientReadable(diagnostic?.output.headline ?? diagnostic?.output.answer);
    if (!text) return <p className={p.aiLine}>La IA no ha señalado nada sobre esta cifra en su último análisis.</p>;
    const evidence = finding?.evidence ? clientReadable(evidenceText(finding.evidence)) : null;
    return (
      <p className={p.aiLine}>
        <span className={p.ia}>{tag}</span>
        {text}
        {evidence ? <span className={p.muted}> · {evidence}</span> : null}
      </p>
    );
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
      ai: agentLine("A02", monitor.data, /ticket|aov|pedido medio|cesta/i),
      href: route("/shopify"),
      action: "Ver ventas en Shopify",
    },
    roas: {
      title: "ROAS Meta",
      chart: (
        <KpiBars
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
      ai: roasAnalysis && roasAnalysis.verdict !== "insufficient"
        ? <AiExplanation path={roasAnalysis.explain_path} />
        : agentLine("A02", monitor.data, /roas|meta|anunc|campa/i),
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
        open={open === "aov"}
        onOpen={toggle("aov")}
        label="Ticket medio"
        value={money(data.sales.aov, 2)}
        delta={<Delta change={salesChangePct(data.sales.aov, previous?.sales.aov ?? null)} />}
        vs={previous ? money(previous.sales.aov, 2) : null}
        slot={<p className={p.trackTxt}>Por pedido</p>}
      />
      <Kpi
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
        <h2 id="desk-seguimiento" className={p.pBlockT}>Seguimiento</h2>
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
            <Link className={cx(p.pRow, "hover-sweep")} href="/camino">
              <span className={cx(p.dot, p.dotMuted)} aria-hidden="true" />
              <span className={p.pRowT}>
                {camino ? `Camino · ${camino.phase_name}` : "Camino"}
                <small>
                  {camino?.next_milestone ? `Siguiente: ${camino.next_milestone.name}` : camino ? "Sin hito siguiente" : "Sin plan estratégico"}
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
            <button type="submit" className={cx(p.btn, p.sm)} disabled={savingReview}>
              {savingReview ? "Guardando…" : "Confirmar"}
            </button>
            <button type="button" className={cx(p.btn, p.ghost, p.sm)} onClick={() => setReviewing(false)}>
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" className={cx(p.btn, p.sm)} onClick={() => setReviewing(true)}>
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
