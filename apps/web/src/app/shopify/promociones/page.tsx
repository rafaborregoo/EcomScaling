"use client";

import { buttonVariants } from "@/components/ui/button";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { PortalShell } from "@/components/portal-shell";
import { Select, AsyncState, Pagination, EmptyState, ErrorBlock, ToggleGroup, ToggleGroupItem } from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { cx } from "../../dashboard/client-pulse";
import { fmtNum } from "../../dashboard/client-pulse-model";
import pulse from "../../dashboard/client-pulse.module.css";
import c from "../productos/catalogo.module.css";
import p from "./promociones.module.css";
import type { CatalogDiscount, CatalogDiscountsResponse } from "../catalog-types";
import { TaskButton } from "../task-button";
import { benefitBig, discountAlerts, discountHref, discountState, money, PERIODS, type Period, type PromoTone, usageText, validity } from "./promo-model";
import { DiscountProposalWorkspace } from "./discount-proposal-workspace";

type View = "list" | "grid";
type Filter = "" | "ending" | "limit" | "app";
type Sort = "recent" | "usage" | "ending" | "name";

const STATUSES: Array<{ value: string; label: string; count: (summary: NonNullable<CatalogDiscountsResponse["summary"]>) => number }> = [
  { value: "ACTIVE", label: "Activas", count: (summary) => summary.active },
  { value: "SCHEDULED", label: "Programadas", count: (summary) => summary.scheduled },
  { value: "EXPIRED", label: "Finalizadas", count: (summary) => summary.expired },
  { value: "DISABLED", label: "Desactivadas", count: (summary) => summary.disabled },
  { value: "", label: "Todas", count: (summary) => summary.total },
];

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: "recent", label: "Más recientes" },
  { value: "usage", label: "Más usadas" },
  { value: "ending", label: "Acaban antes" },
  { value: "name", label: "Nombre" },
];

function toneClass(tone: PromoTone) {
  return tone === "bad" ? c.bad : tone === "warn" ? c.warn : tone === "good" || tone === "acc" ? undefined : c.dim;
}

function title(discount: CatalogDiscount) {
  return discount.title || discount.code || "Promoción sin título";
}

/** Código (o «Automática») y vigencia en una línea. */
function codeLine(discount: CatalogDiscount) {
  const code = discount.codes[0];
  const codeIsTitle = code != null && code === discount.title;
  return { code: code && !codeIsTitle ? code : null, rest: [code ? (codeIsTitle ? "Código" : null) : "Automática", discount.codes.length > 1 ? `+${discount.codes.length - 1} códigos` : null, validity(discount)].filter(Boolean).join(" · ") };
}

/** La tarea que propone cada aviso; los demás avisos no piden acción. */
function alertTask(discount: CatalogDiscount, kind: string, text: string) {
  const name = title(discount);
  if (kind === "ending") return { title: `Renovar o cerrar ${name}`, description: `${text}. Decidir si se prolonga, se cambia por otra o se deja terminar.` };
  if (kind === "limit") return { title: `Ampliar límite de ${name}`, description: `${text} (${usageText(discount)} usos). Ampliar el límite o preparar el relevo.` };
  if (kind === "idle") return { title: `Revisar ${name}`, description: `${text}. Sigue activa sin pedidos: moverla en email y redes o desactivarla.` };
  return null;
}

function Benefit({ discount, large = false }: { discount: CatalogDiscount; large?: boolean }) {
  const off = ["EXPIRED", "DISABLED"].includes(discount.status?.toUpperCase() ?? "");
  return <span className={cx(p.benefit, large && p.benefitLarge, off && p.benefitOff)}>{benefitBig(discount)}</span>;
}

function UsageCell({ discount }: { discount: CatalogDiscount }) {
  const used = discount.usage_limit ? Math.min(discount.usage_count / discount.usage_limit, 1) : null;
  return (
    <>
      {usageText(discount)}
      {used != null ? <i className={p.usageBar}><b style={{ width: `${used * 100}%`, background: used >= 0.8 ? "var(--bad)" : "var(--accent)" }} /></i> : null}
    </>
  );
}

function PromotionsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const searchParams = useSearchParams();
  const activeOrganization = useActiveOrganization();
  const activeConnection = useActiveConnection();
  const requestedOrganizationId = searchParams.get("organizationId");
  const organizationId = requestedOrganizationId && bootstrap.memberships.some((item) => item.organization_id === requestedOrganizationId)
    ? requestedOrganizationId
    : activeOrganization.organizationId;
  const connectionId = requestedOrganizationId ? (searchParams.get("connectionId") ?? "") : activeConnection.connectionId;
  const canManageDiscounts = bootstrap.memberships.some((item) =>
    item.organization_id === organizationId && item.accessSource === "membership" && ["owner", "manager"].includes(item.role),
  );
  const canCreateTasks = ["consultant", "platform_admin"].includes(bootstrap.profile.platform_role);
  const requestedSearch = searchParams.get("q") ?? "";

  const [draftSearch, setDraftSearch] = useState(requestedSearch);
  const [search, setSearch] = useState(requestedSearch);
  const [status, setStatus] = useState("ACTIVE");
  const [filter, setFilter] = useState<Filter>("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<View>("list");
  const [periodDays, setPeriodDays] = useState<Period>(90);
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => setPage(1), [organizationId, connectionId]);
  useEffect(() => { setDraftSearch(requestedSearch); setSearch(requestedSearch); }, [requestedSearch, organizationId, connectionId]);

  const params = new URLSearchParams({ page: String(page), sort, periodDays: String(periodDays) });
  if (connectionId) params.set("connectionId", connectionId);
  if (search) params.set("q", search);
  if (status) params.set("status", status);
  if (filter) params.set("filter", filter);
  const key = organizationId ? `/v1/organizations/${organizationId}/shopify/catalog/discounts?${params.toString()}` : null;
  const query = useCachedQuery<CatalogDiscountsResponse>(key);
  const data = query.data;
  const summary = data?.summary ?? null;
  const metricsOn = data?.metrics_coverage === "observed_only";
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const rows = data?.discounts ?? [];
  const currency = rows[0]?.currency_code ?? null;
  const href = (id: string) => discountHref(id, organizationId ?? "", connectionId);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draftSearch.trim());
  }

  function pickFilter(next: Filter) {
    setFilter((current) => (current === next ? "" : next));
    if (next) setStatus("");
    setPage(1);
  }

  // Avisos que se pueden filtrar; solo salen si hay alguna promoción en ellos.
  const alerts: Array<{ key: Filter; label: string; value: number; tone?: string }> = summary
    ? [
        { key: "ending" as const, label: "acaban en 7 días", value: summary.ending_soon, tone: c.warn },
        { key: "limit" as const, label: "cerca del límite de usos", value: summary.near_limit, tone: c.bad },
        { key: "app" as const, label: "gestionadas por una app", value: summary.app_managed, tone: c.warn },
      ].filter((item) => item.value > 0 || filter === item.key)
    : [];

  return (
    <div className={cx(pulse.root, c.cat)}>
      <header className={`${c.top} client-sr-title`}>
        <h1>Promociones</h1>
      </header>

      {!organizationId ? (
        <EmptyState title="Selecciona un cliente" hint="Elige una organización en la barra superior para consultar sus promociones." />
      ) : (
        <>
          <div className={c.toolbar}>
            <form className={c.find} role="search" onSubmit={submitSearch}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} maxLength={120} placeholder="Buscar por título o código" aria-label="Buscar promociones" />
            </form>
            <div className={c.controls}>
              <Select bare className="w-auto" value={status} onChange={(value) => { setStatus(value); setFilter(""); setPage(1); }} aria-label="Estado" options={STATUSES.map((item) => ({ value: item.value, label: summary ? `${item.label} (${fmtNum(item.count(summary))})` : item.label }))} />
              <Select bare className="w-auto" value={sort} onChange={(value) => { setSort(value as Sort); setPage(1); }} aria-label="Ordenar por" options={SORTS} />
              <Select bare className="w-auto" value={String(periodDays)} onChange={(value) => { setPeriodDays(Number(value) as Period); setPage(1); }} aria-label="Periodo de pedidos" options={PERIODS.map((value) => ({ value: String(value), label: value === 365 ? "Último año" : `Últimos ${value} días` }))} />
              <ToggleGroup aria-label="Vista" value={view} onValueChange={setView}>
                <ToggleGroupItem value="list" size="icon-sm" aria-label="Lista" title="Lista">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" size="icon-sm" aria-label="Cuadrícula" title="Cuadrícula">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" /></svg>
                </ToggleGroupItem>
              </ToggleGroup>
              {canManageDiscounts && connectionId ? (
                <button type="button" className={buttonVariants()} onClick={() => setNewOpen(true)}>Nuevo código</button>
              ) : null}
            </div>
          </div>

          {summary ? (
            <div className={p.summaryRow}>
              <ToggleGroup aria-label="Filtrar por aviso" className={c.alerts} spacing={1.5} value={filter} onValueChange={pickFilter}>
                <ToggleGroupItem value="">
                  <b>{fmtNum(data?.total ?? summary.total)}</b> promociones
                </ToggleGroupItem>
                {alerts.map((item) => (
                  <ToggleGroupItem key={item.key} value={item.key}>
                    <b className={item.tone}>{fmtNum(item.value)}</b> {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {metricsOn && summary.discount_amount ? (
                <p className={p.given}>
                  <b>{money(summary.discount_amount, currency)}</b> descontados en {periodDays === 365 ? "el último año" : `${periodDays} días`}
                </p>
              ) : null}
            </div>
          ) : null}

          {connectionId ? (
            <DiscountProposalWorkspace
              organizationId={organizationId}
              connectionId={connectionId}
              canManage={canManageDiscounts}
              currencyCode={currency}
              isFormOpen={newOpen}
              onFormOpenChange={setNewOpen}
            />
          ) : null}

          {data?.details_coverage === "migration_pending" ? (
            <p className={pulse.error}>Se muestran los campos básicos. Aplica la migración de catálogo para ver códigos y el resumen ampliado de reglas.</p>
          ) : null}
          {data?.metrics_coverage === "migration_pending" ? (
            <p className={pulse.error}>Pedidos, descuento concedido y ticket medio por promoción estarán disponibles cuando se aplique la migración de métricas de promociones.</p>
          ) : null}
          {data?.metrics_coverage === "unavailable" ? (
            <p className={pulse.error}>No se pudieron cargar las métricas de las promociones. No significa que no tengan pedidos: reintenta en un rato.</p>
          ) : null}
          {query.error && !data ? <ErrorBlock onRetry={() => query.reload()}>No se han podido cargar los datos. Inténtalo de nuevo en unos segundos.</ErrorBlock> : null}
          {!data && !query.error ? <AsyncState status="loading" loadingLabel="Cargando promociones…" /> : null}

          {data && rows.length === 0 ? (
            <p className={cx(c.dim, c.none)}>No hay promociones con estos filtros. Si acabas de conectar la tienda, revisa la sincronización.</p>
          ) : null}

          {data && rows.length && view === "list" ? (
            <table className={c.list}>
              <thead>
                <tr>
                  <th scope="col">Promoción</th>
                  <th scope="col" className={c.num}>Usos</th>
                  <th scope="col" className={cx(c.num, c.opt)}>Pedidos</th>
                  <th scope="col" className={cx(c.num, c.opt)}>Descontado</th>
                  {canCreateTasks ? <th scope="col"><span className="sr-only">Acción</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((discount) => {
                  const state = discountState(discount.status);
                  const alert = discountAlerts(discount)[0] ?? null;
                  const task = alert ? alertTask(discount, alert.kind, alert.text) : null;
                  const line = codeLine(discount);
                  const m = metricsOn ? discount.metrics : null;
                  return (
                    <tr key={discount.id}>
                      <td>
                        <a className={c.prodLink} href={href(discount.id)}>
                          <Benefit discount={discount} />
                          <span className={c.prodText}>
                            <span className={c.prodName}>{title(discount)}</span>
                            <span className={c.dim}>
                              {line.code ? <><span className={p.codeText}>{line.code}</span> · </> : null}
                              {line.rest}
                              {status === "ACTIVE" ? null : <> · <span className={toneClass(state.tone)}>{state.label}</span></>}
                            </span>
                            {alert ? <span className={toneClass(alert.tone)}>{alert.text}</span> : null}
                          </span>
                        </a>
                      </td>
                      <td className={c.num}><UsageCell discount={discount} /></td>
                      <td className={cx(c.num, c.opt)}>{m?.orders ? fmtNum(m.orders) : <span className={c.dim}>—</span>}</td>
                      <td className={cx(c.num, c.opt)}>
                        {m?.orders ? (m.discount_amount == null ? <span className={c.dim}>parcial</span> : money(m.discount_amount, discount.currency_code)) : <span className={c.dim}>—</span>}
                        {m?.aov != null ? <small className={c.dim}>ticket {money(m.aov, discount.currency_code)}</small> : null}
                      </td>
                      {canCreateTasks ? (
                        <td className={p.actionCell}>{task ? <TaskButton organizationId={organizationId} title={task.title} description={task.description} /> : null}</td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}

          {data && rows.length && view === "grid" ? (
            <ul className={c.tiles}>
              {rows.map((discount) => {
                const alert = discountAlerts(discount)[0] ?? null;
                const line = codeLine(discount);
                return (
                  <li key={discount.id}>
                    <a className={c.tile} href={href(discount.id)}>
                      <Benefit discount={discount} large />
                      <span className={c.prodName}>{title(discount)}</span>
                      <span className={c.dim}>{line.code ? <><span className={p.codeText}>{line.code}</span> · </> : null}{line.rest}</span>
                      <span className={c.dim}>{usageText(discount)} usos</span>
                      {alert ? <span className={toneClass(alert.tone)}>{alert.text}</span> : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {data && data.total ? (
            <div className={c.pages}>
              <span className={c.dim}>Usos: contador de Shopify. Pedidos y descuento: pedidos sincronizados de los últimos {periodDays} días.</span>
              {totalPages > 1 ? (
                <Pagination page={page} pageCount={totalPages} onChange={setPage} />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function ShopifyPromotionsPage() {
  return (
    <PortalShell title="Promociones Shopify">
      {(bootstrap) => (
        <Suspense fallback={<AsyncState status="loading" loadingLabel="Cargando promociones…" />}>
          <PromotionsContent bootstrap={bootstrap} />
        </Suspense>
      )}
    </PortalShell>
  );
}
