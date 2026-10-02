"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { apiFetch, invalidateApiGetCache, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { useUrlSection } from "@/lib/use-url-section";
import { useCopilotAsk } from "@/components/copilot-ask";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { toast } from "@/components/ui";
import type { DailyWorkbench, PortfolioHealthRow, UpcomingItem, WorkbenchAction } from "../consultor/workbench";
import {
  ConsultantThread,
  Delta,
  Empty,
  Kpi,
  SalesChart,
  SectionHead,
  Spark,
  WorkQueue,
  ago,
  cx,
  dayLabel,
  usePins,
  type Diagnostic,
  type KlaviyoReport,
  type MetaMetrics,
  type Metrics,
  type Operations,
} from "./client-pulse";
import { fmtEur, fmtNum } from "./client-pulse-model";
import { formatMoney } from "@/lib/money";
import { canShowProfit, salesChangePct } from "./store-pulse";
import { ClientShopify } from "./client-shopify";
import { ClientMeta } from "./client-meta";
import { ClientKlaviyo } from "./client-klaviyo";
import p from "./client-pulse.module.css";
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
  overdue_task: "Tarea vencida",
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

type InboxFilter = "todo" | "urgente" | "vencidas" | "decision" | "datos";
const DECISION_KINDS: Array<WorkbenchAction["kind"]> = ["call_approval", "ai_proposal", "unread_message"];
const DATA_KINDS: Array<WorkbenchAction["kind"]> = ["integration_reauth", "financial_coverage"];
const INBOX_FILTERS: Array<{ key: InboxFilter; label: string; test: (a: WorkbenchAction) => boolean }> = [
  { key: "todo", label: "Todo", test: () => true },
  { key: "urgente", label: "Urgente", test: (a) => a.priority === "urgent" },
  { key: "vencidas", label: "Vencidas", test: (a) => a.kind === "overdue_task" },
  { key: "decision", label: "Mi decisión", test: (a) => DECISION_KINDS.includes(a.kind) },
  { key: "datos", label: "Datos", test: (a) => DATA_KINDS.includes(a.kind) },
];

// En la ficha de un cliente la cola de trabajo ya pinta alertas, tareas y
// propuestas; de la mesa solo sube lo que esa cola no cubre.
const DESK_ONLY_KINDS: Array<WorkbenchAction["kind"]> = [
  "call_approval",
  "unread_message",
  "integration_reauth",
  "financial_coverage",
  "milestone_due",
];

// Agentes que solo ve el consultor: planifican su trabajo, no el del cliente.
const CONSULTANT_AGENTS = [
  { key: "task-planner", label: "Plan diario", getPath: "/ai/task-planner", runPath: "/ai/task-planner-run" },
  { key: "plan-week", label: "Plan semanal", getPath: "/ai/plan/week", runPath: "/ai/plan/week/run" },
  { key: "plan-month", label: "Plan mensual", getPath: "/ai/plan/month", runPath: "/ai/plan/month/run" },
  { key: "stock", label: "Stock", getPath: "/ai/stock-planner", runPath: "/ai/stock-planner-run" },
  { key: "email", label: "Email", getPath: "/ai/email-analyst", runPath: "/ai/email-analyst-run" },
] as const;

const plural = (n: number, one: string, many: string) => `${fmtNum(n)} ${n === 1 ? one : many}`;
const signedEur = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtEur(Math.abs(n))}`);
const sourceMoney = (value: number | null, currencyCode: string | null) =>
  value == null || !currencyCode ? "—" : formatMoney(value, currencyCode);
const signedNum = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtNum(Math.abs(n))}`);
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
const clock = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

// Un CTA de la mesa casi siempre cambia de cliente al saltar de módulo; la
// caché es por URL, no por tenant (igual que hace /consultor).
const leaveForModule = () => invalidateCachedQueries();

// ---------------------------------------------------------------------------
// Router del consultor
// ---------------------------------------------------------------------------

export function ConsultantDashboard({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId, setOrganizationId } = useActiveOrganization();
  const { connectionId, setConnectionId } = useActiveConnection();
  const [tab, setTab] = useUrlSection("tab", TABS, "todo");

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
        onBack={() => setOrganizationId("")}
        onSelectStore={setConnectionId}
        onTab={setTab}
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
    <li className={s.act}>
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
      <a className={cx(p.btn, p.ghost, p.sm)} href={action.href} onClick={leaveForModule}>
        {action.action_label}
      </a>
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
        <Empty>Nada por aquí. Lo demás está vigilado.</Empty>
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
              <li key={`${item.kind}-${item.id}`} className={s.ag}>
                <span className={s.day}>
                  <small>{at.toLocaleDateString("es-ES", { weekday: "short" })}</small>
                  <b>{at.getDate()}</b>
                </span>
                <div>
                  <p className={s.agT}>
                    <a href={item.href} onClick={leaveForModule} style={{ color: "inherit", textDecoration: "none" }}>
                      {item.title}
                    </a>
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
        <div className={p.hero}>
          <p className={p.heroMeta}>Tu cartera</p>
          <p className={p.headline}>Preparando tu mesa…</p>
        </div>
      </div>
    );
  }

  if (!wb) {
    return (
      <div className={p.root}>
        <div className={p.hero}>
          <p className={p.heroMeta}>Tu cartera</p>
          <p className={p.headline}>No se pudo cargar la mesa.</p>
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
    <th aria-sort={sort?.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => sortBy(key)}>
        {label}
        {sort?.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className={p.root}>
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
            <button type="button" className={s.counter} onClick={() => jump("vencidas")}>
              <b>{fmtNum(summary.overdue_tasks)}</b>
              <span>Tareas vencidas</span>
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
                    <button key={row.organization_id} type="button" className={s.card} onClick={() => onSelectClient(row.organization_id)}>
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
                        {row.overdue_tasks ? <span className={s.w}>{plural(row.overdue_tasks, "vencida", "vencidas")}</span> : null}
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
            label="Ventas netas"
            value={sourceMoney(business.net_sales, business.shopify_currency_code)}
            delta={<Delta change={business.net_sales != null && business.prev_net_sales != null ? salesChangePct(business.net_sales, business.prev_net_sales) : null} />}
            vs={sourceMoney(business.prev_net_sales, business.shopify_currency_code)}
            slot={<p className={p.trackTxt}>Todas las tiendas, 30 días</p>}
          />
          <Kpi
            label="Pedidos"
            value={fmtNum(business.orders)}
            delta={<Delta change={salesChangePct(business.orders, business.prev_orders)} />}
            vs={fmtNum(business.prev_orders)}
            slot={<p className={p.trackTxt}>Pedidos de Shopify</p>}
          />
          <Kpi
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
            label="Inversión Meta"
            value={sourceMoney(business.meta_spend, business.meta_currency_code)}
            vs={sourceMoney(business.prev_meta_spend, business.meta_currency_code)}
            slot={<p className={p.trackTxt}>Suma de todas las cuentas</p>}
          />
          <Kpi
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
                <a className={cx(p.btn, p.ghost, p.sm)} href="/mensajes">
                  Abrir chats
                </a>
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
            <div className={s.matrix}>
              <table>
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

export function ConsultantClientDesk({ userId, organizationId, organizationName, connectionId, onBack, onSelectStore, onTab }: {
  userId: string;
  organizationId: string;
  organizationName: string;
  connectionId: string | null;
  onBack: () => void;
  onSelectStore: (connectionId: string) => void;
  onTab: (tab: (typeof TABS)[number]) => void;
}) {
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const workbench = useCachedQuery<DailyWorkbench>(`/v1/consultant/daily-workbench?days=30&organizationId=${encodeURIComponent(organizationId)}`);
  const metrics = useCachedQuery<Metrics>(`${base}/shopify/metrics?days=30${scope}`);
  const meta = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=30`);
  const klaviyo = useCachedQuery<KlaviyoReport>(`${base}/klaviyo/email-report?days=30`);
  const operations = useCachedQuery<Operations>(`${base}/operations`);
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30${scope}`);
  const planner = useCachedQuery<Diagnostic>(`${base}${CONSULTANT_AGENTS[0].getPath}?days=30${scope}`);
  const week = useCachedQuery<Diagnostic>(`${base}${CONSULTANT_AGENTS[1].getPath}?days=30${scope}`);
  const month = useCachedQuery<Diagnostic>(`${base}${CONSULTANT_AGENTS[2].getPath}?days=30${scope}`);
  const stockAi = useCachedQuery<Diagnostic>(`${base}${CONSULTANT_AGENTS[3].getPath}?days=30${scope}`);
  const emailAi = useCachedQuery<Diagnostic>(`${base}${CONSULTANT_AGENTS[4].getPath}?days=30${scope}`);
  const agentQueries = [planner, week, month, stockAi, emailAi];

  const ask = useCopilotAsk();
  const [draft, setDraft] = useState("");
  const messageRef = useRef<HTMLInputElement>(null);
  const [activePin, setActivePin] = useState<number | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const pins = usePins(metrics.data?.daily, operations.data?.alerts);

  const wb = workbench.data;
  const client = wb?.client;
  const name = client?.organization_name ?? organizationName;
  const row = wb?.portfolio.find((r) => r.organization_id === organizationId);
  const tier = tierOf(row?.status);
  const shopifyStores = (client?.stores ?? []).filter((store) => store.provider === "shopify");
  const activeStore = shopifyStores.find((store) => store.id === connectionId) ?? null;
  const deskActions = (wb?.actions ?? []).filter(
    (a) => a.organization_id === organizationId && DESK_ONLY_KINDS.includes(a.kind),
  );
  const upcoming = (wb?.upcoming ?? []).filter((u) => u.organization_id === organizationId);

  function reloadAll() {
    invalidateApiGetCache();
    invalidateCachedQueries(base);
    operations.reload();
    monitor.reload();
    agentQueries.forEach((q) => q.reload());
    workbench.reload();
  }

  async function runAgent(runPath: string, label: string, reload: () => void) {
    setRunning(runPath);
    try {
      const response = await apiFetch(`${base}${runPath}?days=30${scope}`, { method: "POST" });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(`${label} actualizado.`);
      invalidateApiGetCache();
      invalidateCachedQueries(base);
      reload();
    } catch {
      toast.danger("No se pudo lanzar el análisis por un error de red.");
    } finally {
      setRunning(null);
    }
  }

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
      invalidateCachedQueries("/v1/consultant/daily-workbench");
      workbench.reload();
    } catch {
      toast.danger("No se pudo marcar la revisión. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setSavingReview(false);
    }
  }

  const data = metrics.data;
  const previous = data?.previous_period ?? null;
  const financial = data?.financial;
  const showProfit = financial
    ? canShowProfit({
        hasFinancialSettings: financial.has_settings,
        itemsWithoutCost: financial.items_without_cost,
        linesWithoutNetMetrics: metrics.data?.margin.lines_without_metrics,
      })
    : false;
  const daily = data?.daily ?? [];
  const previousAverage = previous && daily.length ? previous.sales.net_sales / daily.length : null;
  const diagnostic = monitor.data;
  const aiHeadline = diagnostic?.output.headline ?? diagnostic?.output.answer ?? null;
  const nextStep = diagnostic?.output.recommendations[0]?.action ?? null;
  const proposals = [monitor.data, ...agentQueries.map((q) => q.data)].filter((d): d is Diagnostic => Boolean(d));
  const acquisition = meta.data?.acquisition;
  const hasMeta = Boolean(acquisition && acquisition.days_with_data > 0);
  const breakeven = showProfit ? financial?.breakeven_roas ?? null : null;
  const report = klaviyo.data;
  const hasKlaviyo = Boolean(report?.connected && report.totals);
  const changes = client?.changes;
  const relationship = client?.relationship;
  const camino = client?.camino;

  return (
    <div className={p.root}>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className={cx(p.hero, tier?.cls)} aria-labelledby="desk-headline">
        <div className={p.heroTop}>
          <div>
            <p className={p.heroMeta}>
              <span>
                {activeStore
                  ? `Tienda · ${activeStore.name ?? "sin nombre"}`
                  : `Cliente · ${plural(shopifyStores.length, "tienda", "tiendas")}`}
              </span>
              {tier ? <span style={{ color: "var(--t)" }}>● {tier.label}</span> : null}
              <span>Últimos 30 días</span>
            </p>
            <h1 id="desk-headline" className={p.headline}>
              {name}
            </h1>
            {aiHeadline ? (
              <p className={p.headlineDetail}>
                <span className={p.ia}>IA</span>
                {aiHeadline}
              </p>
            ) : null}
            {workbench.error && !wb ? <p className={p.headlineDetail}>No se pudo cargar la mesa de este cliente.</p> : null}
            <div className={p.heroActions}>
              {reviewing ? (
                <form className={s.review} onSubmit={markReviewed}>
                  <label className="sr-only" htmlFor="desk-review-note">
                    Nota de la revisión (opcional)
                  </label>
                  <input
                    id="desk-review-note"
                    value={reviewNote}
                    maxLength={500}
                    autoFocus
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Qué has mirado o dejado pendiente (opcional)"
                  />
                  <button type="submit" className={cx(p.btn, p.acc)} disabled={savingReview}>
                    {savingReview ? "Guardando…" : "Confirmar"}
                  </button>
                  <button type="button" className={cx(p.btn, p.ghost)} onClick={() => setReviewing(false)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <button type="button" className={cx(p.btn, p.acc)} onClick={() => setReviewing(true)}>
                    Marcar como revisado
                  </button>
                  <button
                    type="button"
                    className={cx(p.btn, p.ghost)}
                    onClick={() =>
                      ask({
                        question: `Resume la situación de ${name} y dime qué harías primero como su consultor.`,
                        focusLabel: name,
                      })
                    }
                  >
                    <span className={p.ia}>IA</span>
                    Preguntar
                  </button>
                  <button type="button" className={cx(p.btn, p.ghost)} onClick={onBack}>
                    ← Toda la cartera
                  </button>
                </>
              )}
            </div>
            {client?.last_review ? (
              <p className={s.heroNote} style={{ marginTop: 10 }}>
                Última revisión: {dayLabel(client.last_review.reviewed_at, true)} a las {clock(client.last_review.reviewed_at)}
                {client.last_review.note ? ` · ${client.last_review.note}` : ""}
              </p>
            ) : null}
          </div>
          <aside className={s.rel} aria-label="Relación con el cliente">
            <div className={s.relRow}>
              <span>Contacto</span>
              <strong>{relationship?.counterpart_name ?? "—"}</strong>
            </div>
            <div className={s.relRow}>
              <span>Próxima llamada</span>
              <strong>
                {relationship?.next_call?.scheduled_at
                  ? `${dayLabel(relationship.next_call.scheduled_at, true)}, ${clock(relationship.next_call.scheduled_at)}`
                  : "Sin agendar"}
              </strong>
            </div>
            <div className={s.relRow}>
              <span>Última llamada</span>
              <strong>
                {relationship?.last_call?.held_at ? dayLabel(relationship.last_call.held_at, true) : "—"}
                {relationship?.last_call?.summary_pending ? " · resumen pendiente" : ""}
              </strong>
            </div>
            <div className={s.relRow}>
              <span>Mensajes sin leer</span>
              <strong>{fmtNum(relationship?.unread_count ?? 0)}</strong>
            </div>
            <div className={s.relRow}>
              <span>Tareas</span>
              <strong>
                {row ? `${fmtNum(row.open_tasks)} abiertas${row.overdue_tasks ? ` · ${fmtNum(row.overdue_tasks)} vencidas` : ""}` : "—"}
              </strong>
            </div>
            <div className={s.relRow}>
              <span>Camino</span>
              <strong>
                {camino ? `${camino.phase_name} · ${camino.milestones_done}/${camino.milestones_total} hitos` : "Sin plan"}
              </strong>
            </div>
          </aside>
        </div>

        {changes ? (
          <div>
            <p className={s.heroNote} style={{ marginBottom: 8 }}>
              {changes.since_kind === "review"
                ? `Desde tu última revisión (${dayLabel(changes.since, true)}):`
                : "En los últimos 30 días (no hay una revisión tuya dentro de esta ventana):"}
            </p>
            <div className={s.since}>
              <div>
                <b>{fmtNum(changes.new_alerts)}</b>
                <span>Alertas nuevas</span>
              </div>
              <div>
                <b>{fmtNum(changes.closed_tasks)}</b>
                <span>Tareas cerradas</span>
              </div>
              <div>
                <b>{signedEur(changes.net_sales_delta)}</b>
                <span>Ventas netas</span>
              </div>
              <div>
                <b>{signedNum(changes.orders_delta)}</b>
                <span>Pedidos</span>
              </div>
              <div>
                <b>{signedEur(changes.meta_spend_delta)}</b>
                <span>Inversión Meta</span>
              </div>
            </div>
          </div>
        ) : null}

        {shopifyStores.length > 1 ? (
          <div className={s.stores} role="group" aria-label="Elegir tienda">
            <button type="button" className={s.st} aria-pressed={!activeStore} onClick={() => onSelectStore("")}>
              <span>
                Todas las tiendas
                <small>Cifras agregadas</small>
              </span>
            </button>
            {shopifyStores.map((store) => {
              const stale = !store.last_sync_at || Date.parse(store.last_sync_at) < Date.parse(wb?.generated_at ?? "") - 3 * DAY_MS;
              const broken = !["connected", "syncing"].includes(store.status);
              return (
                <button
                  key={store.id}
                  type="button"
                  className={s.st}
                  aria-pressed={store.id === activeStore?.id}
                  onClick={() => onSelectStore(store.id)}
                >
                  <span className={cx(s.stDot, (stale || broken) && s.stDotWarn)} aria-hidden="true" />
                  <span>
                    {store.name ?? "Tienda sin nombre"}
                    <small>{broken ? "Requiere reconectar" : `Sincronizada ${ago(store.last_sync_at)}`}</small>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {daily.length > 1 ? (
          <>
            <SalesChart
              daily={daily.map((d) => ({ date: d.date, value: d.net_sales, detail: `${fmtNum(d.orders_count)} pedidos` }))}
              previousAverage={previousAverage}
              pins={pins}
              active={activePin}
              onPin={(k) => setActivePin((current) => (current === k ? null : k))}
            />
            <div className={p.legend} aria-hidden="true">
              <span>
                <i className={p.lgLine} />
                Ventas netas por día
              </span>
              {previousAverage !== null ? (
                <span>
                  <i className={p.lgPrev} />
                  Media diaria del periodo anterior
                </span>
              ) : null}
              {pins.length ? (
                <span>
                  <i className={p.lgPin} />
                  Alertas detectadas en el periodo
                </span>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      {/* ------------------------------ KPIs ------------------------------ */}
      {data ? (
        <div className={p.kpis} aria-label="Cifras clave, últimos 30 días">
          <Kpi
            label="Ventas netas"
            value={fmtEur(data.sales.net_sales)}
            delta={<Delta change={salesChangePct(data.sales.net_sales, previous?.sales.net_sales ?? null)} />}
            vs={previous ? fmtEur(previous.sales.net_sales) : null}
            slot={<Spark values={daily.map((d) => d.net_sales)} />}
          />
          <Kpi
            label="Pedidos"
            value={fmtNum(data.sales.orders_count)}
            delta={<Delta change={salesChangePct(data.sales.orders_count, previous?.sales.orders_count ?? null)} />}
            vs={previous ? fmtNum(previous.sales.orders_count) : null}
            slot={<Spark values={daily.map((d) => d.orders_count)} />}
          />
          <Kpi
            label="Ticket medio"
            value={fmtEur(data.sales.aov, 2)}
            delta={<Delta change={salesChangePct(data.sales.aov, previous?.sales.aov ?? null)} />}
            vs={previous ? fmtEur(previous.sales.aov, 2) : null}
            slot={<p className={p.trackTxt}>Por pedido</p>}
          />
          {showProfit && financial ? (
            <Kpi
              label="Beneficio neto"
              value={fmtEur(financial.net_profit)}
              delta={<Delta change={previous?.financial.lines_without_metrics === 0 ? salesChangePct(financial.net_profit, previous.financial.net_profit) : null} />}
              vs={previous?.financial.lines_without_metrics === 0 ? fmtEur(previous.financial.net_profit) : null}
              slot={<p className={p.trackTxt}>Margen neto {fmtNum(financial.net_margin_pct, 1)} %</p>}
            />
          ) : (
            <Kpi
              label="Beneficio neto"
              tag={metrics.data?.margin.lines_without_metrics !== 0 ? "cobertura pendiente" : "faltan costes"}
              value="—"
              slot={
                <p className={p.trackTxt}>
                  {metrics.data?.margin.lines_without_metrics !== 0
                    ? `Falta cobertura neta en ${metrics.data?.margin.lines_without_metrics ?? "algunas"} líneas de pedido; sincronízalas antes de consultar beneficio y margen.`
                    : financial?.has_settings
                    ? `Faltan los costes de ${plural(financial.items_without_cost, "producto", "productos")}`
                    : "Sin configuración financiera"}
                </p>
              }
            />
          )}
          <Kpi
            label="ROAS Meta"
            value={hasMeta && acquisition?.roas != null ? `${fmtNum(acquisition.roas, 2)}×` : "—"}
            slot={
              <p className={p.trackTxt}>
                {!hasMeta
                  ? "Sin datos de Meta"
                  : breakeven !== null
                    ? `Equilibrio ${fmtNum(breakeven, 2)}× · atribuido por Meta`
                    : "Atribuido por Meta"}
              </p>
            }
          />
          <Kpi
            label="Stock"
            tag={data.stock.out_of_stock_items ? "agotados" : undefined}
            value={`${fmtNum(data.stock.out_of_stock_items)} agotados`}
            slot={<p className={p.trackTxt}>{plural(data.stock.low_stock_items, "producto", "productos")} con poco stock</p>}
          />
        </div>
      ) : metrics.error ? (
        <div className={p.panel}>
          <p className={p.error}>No se pudieron cargar las cifras de Shopify: {metrics.error}</p>
        </div>
      ) : null}

      {/* ------------------------------ Pendiente ------------------------------ */}
      <section className={p.sec} aria-labelledby="desk-hoy">
        <SectionHead
          id="desk-hoy"
          title="Pendiente"
          ai={nextStep ? `Lo primero: ${nextStep}` : null}
          fallback="Propuestas de la IA, alertas y tareas de este cliente; y la conversación al lado."
          onAsk={() => ask({ question: `¿Qué debería resolver primero esta semana con ${name}?`, focusLabel: `Pendiente de ${name}` })}
        />
        <div className={p.two}>
          <div className={s.stackCol}>
            {operations.error && !operations.data ? (
              <div className={p.panel}>
                <p className={p.error}>No se pudieron cargar las tareas: {operations.error}</p>
              </div>
            ) : (
              <WorkQueue
                base={base}
                userId={userId}
                consultant={null}
                asConsultant
                proposals={proposals}
                operations={operations.data}
                reloadAll={reloadAll}
                onComment={(text) => {
                  setDraft(text);
                  messageRef.current?.focus();
                }}
              />
            )}
            {deskActions.length ? (
              <div className={p.panel}>
                <div className={p.panelH}>
                  <div>
                    <h3>Otros asuntos de la mesa</h3>
                    <p className={p.sub}>Llamadas, integraciones, datos e hitos</p>
                  </div>
                </div>
                <ul>
                  {deskActions.map((action) => (
                    <ActionRow key={action.id} action={action} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className={s.stackCol}>
            <ConsultantThread
              base={base}
              name={relationship?.counterpart_name ?? name}
              role={`Cliente · ${name}`}
              viewer="consultant"
              draft={draft}
              setDraft={setDraft}
              inputRef={messageRef}
            />
            <Upcoming items={upcoming} showClient={false} />
          </div>
        </div>
      </section>

      {/* ------------------------------ IA ------------------------------ */}
      <section className={p.sec} aria-labelledby="desk-ia">
        <SectionHead
          id="desk-ia"
          title="Lo que ve la IA"
          ai={null}
          fallback="El resumen lo ve también el cliente; los planes y los agentes de canal son solo para ti."
          onAsk={() => ask({ question: `¿Qué riesgos ves en ${name} que yo debería vigilar?`, focusLabel: `Riesgos de ${name}` })}
        />
        <div className={p.three}>
          <div className={p.panel}>
            <div className={p.panelH}>
              <div>
                <h3>Resumen ejecutivo</h3>
                <p className={p.sub}>
                  {diagnostic ? `Análisis del ${dayLabel(diagnostic.generated_at, true)}, ${clock(diagnostic.generated_at)}` : "Sin análisis todavía"}
                </p>
              </div>
              <button
                type="button"
                className={cx(p.btn, p.ghost, p.sm)}
                disabled={running !== null}
                onClick={() => void runAgent("/ai/monitor-run", "Resumen", monitor.reload)}
              >
                {running === "/ai/monitor-run" ? "Analizando…" : diagnostic ? "Actualizar" : "Analizar"}
              </button>
            </div>
            {diagnostic?.output.findings.length ? (
              <div>
                {diagnostic.output.findings.slice(0, 4).map((finding, i) => (
                  <div key={`${finding.title}-${i}`} className={s.agent}>
                    <div>
                      <b>{finding.title}</b>
                      <p>{finding.evidence}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>{diagnostic ? "Sin hallazgos en este análisis." : "Lánzalo para ver qué está pasando y qué haría la IA."}</Empty>
            )}
          </div>
          <div className={p.panel}>
            <div className={p.panelH}>
              <div>
                <h3>Agentes solo para ti</h3>
                <p className={p.sub}>Sus propuestas entran en Pendiente</p>
              </div>
            </div>
            <div>
              {CONSULTANT_AGENTS.map((agent, i) => {
                const query = agentQueries[i];
                const output = query.data;
                const pending = output?.output_status === "pending_approval" ? output.output.proposed_writes.length : 0;
                return (
                  <div key={agent.key} className={s.agent}>
                    <div style={{ minWidth: 0 }}>
                      <b>{agent.label}</b>
                      {output ? <p>{output.output.headline ?? output.output.findings[0]?.title ?? "Sin hallazgos."}</p> : null}
                      <p className={s.agentMeta}>
                        {output
                          ? `${ago(output.generated_at)}${pending ? ` · ${plural(pending, "propuesta", "propuestas")} por decidir` : ""}`
                          : "Sin ejecutar"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={cx(p.btn, p.ghost, p.sm)}
                      disabled={running !== null}
                      onClick={() => void runAgent(agent.runPath, agent.label, query.reload)}
                    >
                      {running === agent.runPath ? "…" : output ? "Actualizar" : "Lanzar"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={p.panel}>
            <div className={p.panelH}>
              <div>
                <h3>Camino</h3>
                <p className={p.sub}>{camino ? `Fase: ${camino.phase_name}` : "Sin plan estratégico"}</p>
              </div>
              <a className={cx(p.btn, p.ghost, p.sm)} href="/camino">
                Abrir
              </a>
            </div>
            {camino ? (
              <>
                <div className={s.steps} aria-label={`${camino.milestones_done} de ${camino.milestones_total} hitos cumplidos`}>
                  {Array.from({ length: Math.max(1, camino.milestones_total) }, (_, i) => (
                    <i key={i} className={i < camino.milestones_done ? s.stepDone : i === camino.milestones_done ? s.stepNext : undefined} />
                  ))}
                </div>
                <div className={s.chanR}>
                  <span>Hitos cumplidos</span>
                  <b>
                    {camino.milestones_done} / {camino.milestones_total}
                  </b>
                </div>
                {camino.next_milestone ? (
                  <div className={s.chanR}>
                    <span>Siguiente: {camino.next_milestone.name}</span>
                    <b>{camino.next_milestone.target_date ? dayLabel(camino.next_milestone.target_date) : "sin fecha"}</b>
                  </div>
                ) : null}
              </>
            ) : (
              <Empty>Cuando definas el plan de este cliente, aquí verás en qué fase está y el siguiente hito.</Empty>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------ Canales ------------------------------ */}
      <section className={p.sec} aria-labelledby="desk-canales">
        <SectionHead
          id="desk-canales"
          title="Canales"
          ai={null}
          fallback="Un resumen por canal; el detalle está en su pestaña. Lo atribuido va con su plataforma y no se suma."
          onAsk={() => ask({ question: `¿Qué canal de ${name} tiene más margen de mejora ahora mismo?`, focusLabel: `Canales de ${name}` })}
        />
        <div className={p.three}>
          <div className={p.panel}>
            <div className={p.panelH}>
              <div>
                <h3>
                  <span className={p.sw} style={{ background: "var(--store)" }} />
                  Tienda
                </h3>
                <p className={p.sub}>{activeStore ? activeStore.name : "Shopify"}</p>
              </div>
              <button type="button" className={cx(p.btn, p.ghost, p.sm)} onClick={() => onTab("shopify")}>
                Ver
              </button>
            </div>
            {data ? (
              <div>
                <div className={s.chanR}>
                  <span>Conversión</span>
                  <b>
                    {data.funnel?.has_sessions && data.funnel.conversion_rate_own !== null
                      ? `${fmtNum(data.funnel.conversion_rate_own * 100, 2)} %`
                      : "—"}
                  </b>
                </div>
                <div className={s.chanR}>
                  <span>Producto más vendido</span>
                  <b>{data.top_products[0] ? (
                    <a
                      className="underline decoration-dotted underline-offset-4"
                      href={`/shopify/productos/${encodeURIComponent(data.top_products[0].product_id)}?${new URLSearchParams({ organizationId, ...(connectionId ? { connectionId } : {}) }).toString()}`}
                      aria-label={`Abrir ficha de ${data.top_products[0].title}`}
                    >
                      {data.top_products[0].title} · {fmtNum(data.top_products[0].quantity_sold)} u.
                    </a>
                  ) : "—"}</b>
                </div>
                <div className={s.chanR}>
                  <span>CAC combinado</span>
                  <b>{financial?.cac_blended != null ? fmtEur(financial.cac_blended, 2) : "—"}</b>
                </div>
              </div>
            ) : (
              <Empty>Sin datos de Shopify.</Empty>
            )}
          </div>
          <div className={p.panel}>
            <div className={p.panelH}>
              <div>
                <h3>
                  <span className={p.sw} style={{ background: "var(--meta)" }} />
                  Meta Ads
                </h3>
                <p className={p.sub}>Atribuido por Meta</p>
              </div>
              <button type="button" className={cx(p.btn, p.ghost, p.sm)} onClick={() => onTab("meta")}>
                Ver
              </button>
            </div>
            {hasMeta && acquisition ? (
              <div>
                <div className={s.chanR}>
                  <span>Inversión</span>
                  <b>{fmtEur(acquisition.spend)}</b>
                </div>
                <div className={s.chanR}>
                  <span>ROAS frente a equilibrio</span>
                  <b className={acquisition.roas !== null && breakeven !== null && acquisition.roas < breakeven ? s.bad : undefined}>
                    {acquisition.roas !== null ? `${fmtNum(acquisition.roas, 2)}×` : "—"}
                    {breakeven !== null ? ` / ${fmtNum(breakeven, 2)}×` : ""}
                  </b>
                </div>
                <div className={s.chanR}>
                  <span>CPA</span>
                  <b>
                    {acquisition.cac !== null ? fmtEur(acquisition.cac, 2) : "—"}
                    {showProfit && financial?.mbee ? ` · máx. ${fmtEur(financial.mbee, 2)}` : ""}
                  </b>
                </div>
              </div>
            ) : (
              <Empty>{meta.isLoading ? "Cargando…" : "Sin datos de Meta Ads en los últimos 30 días."}</Empty>
            )}
          </div>
          <div className={p.panel}>
            <div className={p.panelH}>
              <div>
                <h3>
                  <span className={p.sw} style={{ background: "var(--klaviyo)" }} />
                  Email
                </h3>
                <p className={p.sub}>Atribuido por Klaviyo</p>
              </div>
              <button type="button" className={cx(p.btn, p.ghost, p.sm)} onClick={() => onTab("klaviyo")}>
                Ver
              </button>
            </div>
            {hasKlaviyo && report ? (
              <div>
                <div className={s.chanR}>
                  <span>Ingresos atribuidos</span>
                  <b>
                    {fmtEur(report.totals.revenue)}{" "}
                    <Delta change={salesChangePct(report.totals.revenue, report.previous?.revenue ?? null)} />
                  </b>
                </div>
                <div className={s.chanR}>
                  <span>Flujos</span>
                  <b>{fmtEur(report.totals.flow_revenue)}</b>
                </div>
                <div className={s.chanR}>
                  <span>Campañas</span>
                  <b>{fmtEur(report.totals.campaign_revenue)}</b>
                </div>
              </div>
            ) : (
              <Empty>{klaviyo.isLoading ? "Cargando…" : "Klaviyo sin conectar."}</Empty>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
