"use client";

import { buttonVariants } from "@/components/ui/button";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { useCopilotAsk } from "@/components/copilot-ask";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { AsyncState, Pagination, ErrorBlock, ToggleGroup, ToggleGroupItem, Card, CardContent, CardDescription, CardHeader, CardTitle, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown } from "@/components/ui";
import { cx, Empty, SectionHead } from "../../../dashboard/client-pulse";
import { fmtNum } from "../../../dashboard/client-pulse-model";
import pulse from "../../../dashboard/client-pulse.module.css";
import s from "../../productos/catalogo.module.css";
import p from "../promociones.module.css";
import type { CatalogDiscount, CatalogDiscountApplication, CatalogDiscountDetailResponse } from "../../catalog-types";
import { benefitBig, classLabel, discountAlerts, discountState, money, PERIODS, type Period } from "../promo-model";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 12;

function coverageLabel(status: string) {
  return status === "complete" ? "completo" : status === "partial" ? "parcial" : "no disponible";
}

function amountLabel(application: CatalogDiscountApplication, fallbackCurrency: string | null) {
  if (application.amount_coverage !== "complete") return application.amount_coverage === "partial" ? "Importe parcial" : "Importe no disponible";
  return money(application.amount, application.currency_code ?? fallbackCurrency);
}

function targetLabel(targetType: string) {
  switch (targetType) {
    case "all": return "Todos los productos";
    case "product": return "Producto";
    case "variant": return "Variante";
    case "collection": return "Colección";
    default: return "Objetivo de Shopify";
  }
}

// Lunes (UTC) de las ultimas 12 semanas, la mas antigua primero; mismo criterio que la API.
function weekLabels() {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: WEEKS }, (_unused, index) =>
    new Date(monday.getTime() - (WEEKS - 1 - index) * 7 * DAY_MS).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }));
}

function Timeline({ discount }: { discount: CatalogDiscount }) {
  const start = discount.starts_at ? new Date(discount.starts_at).getTime() : null;
  const end = discount.ends_at ? new Date(discount.ends_at).getTime() : null;
  const [now] = useState(() => Date.now());
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  if (start == null || end == null) {
    return (
      <div className={p.tl}>
        <div className={p.ends}><span>{discount.starts_at ? `Desde ${fmt(discount.starts_at)}` : "Sin fecha de inicio"}</span><span>Sin fecha de fin</span></div>
        <div className={p.track}><span className={p.fill} style={{ width: "100%", opacity: 0.5 }} /></div>
        {start != null && start <= now ? <span>Lleva {fmtNum(Math.round((now - start) / DAY_MS))} días activa</span> : null}
      </div>
    );
  }
  const pct = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const text = now < start ? `Empieza en ${Math.round((start - now) / DAY_MS)} días` : now > end ? `Terminó hace ${Math.round((now - end) / DAY_MS)} días` : `Quedan ${Math.round((end - now) / DAY_MS)} días`;
  return (
    <div className={p.tl}>
      <div className={p.ends}><span>{fmt(discount.starts_at!)}</span><span>{fmt(discount.ends_at!)}</span></div>
      <div className={p.track}>
        <span className={p.fill} style={{ width: `${pct * 100}%` }} />
        {pct > 0 && pct < 1 ? <span className={p.now} style={{ left: `${pct * 100}%` }} title="Hoy" /> : null}
      </div>
      <span>{text}</span>
    </div>
  );
}

function CopyCode({ code }: { code: string }) {
  const [label, setLabel] = useState("Copiar");
  return (
    <span className={p.tCode}>
      {code}
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(code).then(() => setLabel("Copiado"), () => setLabel("No se pudo")); }}>{label}</button>
    </span>
  );
}

function PromotionDetail({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const params = useParams<{ discountId: string }>();
  const searchParams = useSearchParams();
  const activeOrganization = useActiveOrganization();
  const activeConnection = useActiveConnection();
  const ask = useCopilotAsk();
  const requestedOrganizationId = searchParams.get("organizationId");
  const organizationId = requestedOrganizationId && bootstrap.memberships.some((item) => item.organization_id === requestedOrganizationId)
    ? requestedOrganizationId
    : activeOrganization.organizationId;
  const connectionId = requestedOrganizationId ? (searchParams.get("connectionId") ?? "") : activeConnection.connectionId;
  const [page, setPage] = useState(1);
  const [targetsPage, setTargetsPage] = useState(1);
  const [periodDays, setPeriodDays] = useState<Period>(90);
  useEffect(() => { setPage(1); setTargetsPage(1); }, [organizationId, connectionId, params.discountId]);

  const queryParams = new URLSearchParams({ page: String(page), targetsPage: String(targetsPage), periodDays: String(periodDays) });
  if (connectionId) queryParams.set("connectionId", connectionId);
  const key = organizationId ? `/v1/organizations/${organizationId}/shopify/catalog/discounts/${encodeURIComponent(params.discountId)}?${queryParams.toString()}` : null;
  const query = useCachedQuery<CatalogDiscountDetailResponse>(key);
  const data = query.data;

  const backParams = new URLSearchParams();
  if (organizationId) backParams.set("organizationId", organizationId);
  if (connectionId) backParams.set("connectionId", connectionId);
  const backHref = `/shopify/promociones${backParams.size ? `?${backParams.toString()}` : ""}`;

  function returnToPromotions() {
    if (organizationId) activeOrganization.setOrganizationId(organizationId);
    activeConnection.setConnectionId(connectionId);
  }

  if (!organizationId) return <div className={pulse.root}><Card>
    <CardHeader>
      <CardTitle>Selecciona un cliente</CardTitle>
      <CardDescription>Elige una organización en la barra superior.</CardDescription>
    </CardHeader>
  </Card></div>;
  if (query.error && !data) return <div className={pulse.root}><Card>
    <CardHeader>
      <CardTitle>No se pudo abrir la promoción</CardTitle>
    </CardHeader>
    <CardContent><ErrorBlock>{query.error}</ErrorBlock></CardContent>
  </Card></div>;
  if (!data) return <div className={pulse.root}><AsyncState status="loading" loadingLabel="Cargando ficha de promoción…" /></div>;

  // ---- derivados ----
  const { discount } = data;
  const currency = discount.currency_code;
  const state = discountState(discount.status);
  const alerts = discountAlerts({ ...discount, weekly_orders: data.weekly_orders ?? null, metrics: data.metrics ?? null });
  const metricsOn = data.metrics_coverage === "observed_only" && data.metrics != null;
  const m = metricsOn ? data.metrics! : null;
  const appManaged = discount.configuration_coverage === "app_managed";
  const grossSales = m && m.discount_amount != null ? m.net_revenue + m.discount_amount : null;
  const share = m && m.discount_amount != null && grossSales ? m.discount_amount / grossSales : null;
  const lift = m && m.aov != null && m.aov_baseline ? (m.aov - m.aov_baseline) / m.aov_baseline : null;
  const weekly = metricsOn ? data.weekly_orders ?? [] : [];
  const weeklyMax = Math.max(...weekly, 1);
  const labels = weekLabels();
  const pace = weekly.length >= 2 ? (weekly[weekly.length - 1] + weekly[weekly.length - 2]) / 14 : null;
  const left = discount.usage_limit == null ? null : Math.max(discount.usage_limit - discount.usage_count, 0);
  const daysToLimit = left != null && pace && pace > 0 && discount.status?.toUpperCase() === "ACTIVE" ? left / pace : null;
  const buys = data.targets.filter((target) => target.rule_side === "buys");
  const gets = data.targets.filter((target) => target.rule_side === "gets");
  const topMax = Math.max(...(data.top_products ?? []).map((item) => item.units), 1);
  const codesUsage = data.codes_usage ?? [];
  const codesMax = Math.max(...codesUsage.map((item) => item.orders), 1);
  const showCodes = discount.codes.length > 1 || codesUsage.length > 1;
  const totalPages = data.applications_total == null ? 1 : Math.max(1, Math.ceil(data.applications_total / data.applications_page_size));
  const targetTotalPages = data.targets_total == null ? 1 : Math.max(1, Math.ceil(data.targets_total / data.targets_page_size));
  const title = discount.title || discount.code || "Promoción sin título";
  const ticketSub = appManaged ? "beneficio calculado por la app" : gets.length === 1 && gets[0].target_type === "all" ? "en todo el pedido" : gets.length ? `en ${gets.slice(0, 2).map((target) => target.target_title || targetLabel(target.target_type)).join(", ")}` : classLabel(discount);

  const askCopilot = (question: string, focusLabel: string) =>
    ask({ question: `${question} (promoción «${title}», últimos ${periodDays} días)`, focusLabel, reference: { filters: { periodDays: String(periodDays) } } });

  return (
    <div className={pulse.root}>
      <nav className={s.crumb} aria-label="Ruta">
        <a href="/shopify">Shopify</a>
        <span aria-hidden="true">/</span>
        <Link href={backHref} onClick={returnToPromotions}>Promociones</Link>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>

      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.fHero} aria-labelledby="promo-titulo">
        <div className={p.ticket}>
          <div className={p.ticketBig}>{benefitBig(discount)}<small>{ticketSub}</small></div>
          <Timeline discount={discount} />
          <div className={p.tCodes}>
            {discount.codes.length ? (
              <>
                {discount.codes.slice(0, 3).map((code) => <CopyCode key={code} code={code} />)}
                {discount.codes.length > 3 ? <a href="#codigos" className={p.tAuto}>+{discount.codes.length - 3} códigos más</a> : null}
              </>
            ) : <span className={p.tAuto}>Automática: se aplica en el carrito sin código.</span>}
          </div>
        </div>
        <div className={s.info}>
          <div>
            <div className={s.chips}>
              <span className={cx(pulse.chip, state.tone === "good" ? pulse.chipGood : state.tone === "warn" ? pulse.chipWarn : undefined)}>{state.label}</span>
              {alerts.filter((alert) => alert.kind !== "idle").map((alert) => <span key={alert.kind} className={cx(pulse.chip, alert.tone === "bad" ? pulse.chipBad : alert.tone === "warn" ? pulse.chipWarn : alert.tone === "acc" ? pulse.chipAcc : undefined)}>{alert.text}</span>)}
              {discount.codes_coverage === "partial" ? <span className={cx(pulse.chip, pulse.chipWarn)}>Códigos parciales</span> : null}
            </div>
            <h1 id="promo-titulo">{title}</h1>
          </div>
          <p className={p.lead}>{discount.summary ?? (appManaged ? "Shopify no expone la regla porque la gestiona una app. Se muestran los usos y los pedidos donde aparece." : "Shopify no devuelve un resumen de esta regla.")}</p>
          {!m?.orders ? (
            <p className={pulse.sub}>
              Usada {fmtNum(discount.usage_count)} {discount.usage_count === 1 ? "vez" : "veces"}{discount.usage_limit != null ? ` de ${fmtNum(discount.usage_limit)}` : ""}. Todavía no hay pedidos con esta promoción en los últimos {periodDays} días.
            </p>
          ) : (
          <dl className={s.dl}>
            <div><dt>Usos</dt><dd>{fmtNum(discount.usage_count)}<small>{discount.usage_limit == null ? "sin límite informado" : `de ${fmtNum(discount.usage_limit)} · ${fmtNum((discount.usage_count / discount.usage_limit) * 100)} %`}</small></dd></div>
            <div><dt>Pedidos observados</dt><dd>{m ? fmtNum(m.orders) : "—"}<small>{m ? (m.orders ? `de ${fmtNum(discount.usage_count)} usos totales` : "sin pedidos en el periodo") : "sin métricas"}</small></dd></div>
            <div><dt>Descuento concedido</dt><dd>{m ? (m.orders === 0 ? "—" : m.discount_amount == null ? "parcial" : money(m.discount_amount, currency)) : "—"}<small>{share != null ? `${fmtNum(share * 100, 1)} % de lo que vende` : m?.discount_amount == null && m?.orders ? "falta algún importe" : "sin pedidos"}</small></dd></div>
            <div><dt>Ventas con la promo</dt><dd>{m?.orders ? money(m.net_revenue, currency) : "—"}<small>{m?.orders ? "importe neto de esos pedidos" : "sin pedidos"}</small></dd></div>
            {m?.aov == null ? null : <div><dt>Gasto medio por pedido</dt><dd>{m?.aov != null ? money(m.aov, currency) : "—"}<small>{lift != null ? `${lift > 0 ? "+" : ""}${fmtNum(lift * 100)} % vs. pedidos sin promo` : m?.aov != null ? "pocos pedidos sin promo para comparar" : "sin pedidos"}</small></dd></div>}
            {m?.new_customer_share == null ? null : <div><dt>Clientes nuevos</dt><dd>{fmtNum(m.new_customer_share * 100)} %<small>primer pedido en la tienda</small></dd></div>}
          </dl>
          )}
          <div className={s.actions}>
            <button type="button" className={buttonVariants()} onClick={() => askCopilot("Explícame cómo funciona esta promoción y qué haría primero", "Ficha de promoción")}>
              <span className={pulse.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>IA</span>
              Preguntar qué haría
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------ Fiabilidad ------------------------------ */}
      <Collapsible>
      <CollapsibleTrigger className={pulse.sub}>Sobre estos datos<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
      <CollapsibleContent>
      <div className={s.checks} role="group" aria-label="Fiabilidad de los datos">
        <div className={s.check}>
          <div className={s.checkH}><span>Regla</span><span className={cx(pulse.chip, appManaged || data.details_coverage === "migration_pending" ? pulse.chipWarn : pulse.chipGood)}>{appManaged ? "no visible" : data.details_coverage === "migration_pending" ? "pendiente" : "leída"}</span></div>
          <p>{appManaged ? "La gestiona una app: Shopify no devuelve condiciones ni objetivos." : data.details_coverage === "migration_pending" ? "Falta la migración de reglas y códigos; los campos ausentes no significan vacío." : "Resumen y límites leídos de Shopify."}</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Códigos</span><span className={cx(pulse.chip, discount.codes_coverage === "partial" ? pulse.chipWarn : pulse.chipGood)}>{discount.codes_coverage === "partial" ? "parcial" : "OK"}</span></div>
          <p>{discount.codes_coverage === "partial" ? `Shopify ha devuelto ${discount.codes.length} códigos; puede haber más y sus usos no aparecerían.` : discount.codes.length ? "Todos los códigos importados." : "Automática, no usa códigos."}</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Productos</span><span className={cx(pulse.chip, data.target_coverage.status === "available" && !appManaged ? pulse.chipGood : pulse.chipWarn)}>{data.target_coverage.status === "available" ? (appManaged ? "parcial" : "OK") : data.target_coverage.status === "migration_pending" ? "pendiente" : "parcial"}</span></div>
          <p>{data.target_coverage.status === "migration_pending" ? "Los objetivos estarán disponibles al aplicar su migración." : appManaged ? "No se puede confirmar a qué productos aplica." : "Objetivos de requisito y beneficio revisados."}</p>
        </div>
        <div className={s.check}>
          <div className={s.checkH}><span>Pedidos</span><span className={cx(pulse.chip, pulse.chipWarn)}>{data.applications_coverage === "migration_pending" ? "pendiente" : "parciales"}</span></div>
          <p>Solo pedidos sincronizados. Shopify cuenta {fmtNum(discount.usage_count)} usos{m ? `; aquí se ven ${fmtNum(m.orders)} en ${periodDays} días` : ""}.</p>
        </div>
      </div>
      </CollapsibleContent>
      </Collapsible>

      {/* ------------------------------ Rendimiento ------------------------------ */}
      <section id="rendimiento" className={pulse.sec}>
        <div className={pulse.secHead} style={{ gridTemplateColumns: "auto minmax(0, 1fr) auto" }}>
          <h2>Rendimiento</h2>
          <p className={pulse.aiLine}>{m?.orders ? `${fmtNum(weekly.reduce((sum, value) => sum + value, 0))} pedidos en las últimas ${WEEKS} semanas.` : ""}</p>
          <ToggleGroup aria-label="Periodo de las métricas" value={periodDays} onValueChange={setPeriodDays}>
            {PERIODS.map((value) => <ToggleGroupItem key={value} value={value}>{value === 365 ? "1 año" : `${value} días`}</ToggleGroupItem>)}
          </ToggleGroup>
        </div>
        {metricsOn ? (
          <div className={pulse.two}>
            <div className={pulse.panel}>
              <div className={pulse.panelH}>
                <div>
                  <h3>Pedidos por semana</h3>
                  <p className={pulse.sub}>Pedidos sincronizados con esta promoción aplicada</p>
                </div>
              </div>
              {weekly.some((value) => value > 0) ? (
                <>
                  <div className={s.bars} role="img" aria-label="Pedidos con la promoción por semana, últimas 12 semanas">
                    {weekly.map((value, index) => (
                      <div key={labels[index]} title={`Semana del ${labels[index]}: ${value} pedidos`}>
                        <i style={{ height: `${(value / weeklyMax) * 100}%`, background: index === WEEKS - 1 ? "var(--accent)" : undefined }} />
                      </div>
                    ))}
                  </div>
                  <div className={s.barsL}>{labels.map((label, index) => <span key={label}>{index % 2 === 0 ? label : ""}</span>)}</div>
                </>
              ) : (
                <Empty>{discount.status?.toUpperCase() === "SCHEDULED" ? "Todavía no ha empezado. Aquí verás los pedidos semana a semana desde el primer día." : "Sin pedidos con esta promoción en las últimas 12 semanas."}</Empty>
              )}
            </div>
            <div className={s.minis}>
              <div className={s.mini}><span className={pulse.lbl}>Ritmo actual</span><span>{pace != null ? `${fmtNum(pace, 1)}/día` : "—"}</span><small>últimos 14 días</small></div>
              <div className={s.mini}>
                <span className={pulse.lbl}>{discount.usage_limit ? "Agota el límite" : "Límite de usos"}</span>
                <span style={{ color: daysToLimit != null && daysToLimit < 7 ? "var(--bad)" : undefined }}>{discount.usage_limit == null ? "Sin límite" : daysToLimit != null ? `≈ ${fmtNum(daysToLimit, daysToLimit < 10 ? 1 : 0)} días` : `${fmtNum(left ?? 0)} restantes`}</span>
                <small>{discount.usage_limit == null ? "no hay tope de usos" : daysToLimit != null ? `${fmtNum(left ?? 0)} usos restantes al ritmo actual` : "sin ritmo reciente para estimar"}</small>
              </div>
              {m?.orders ? <div className={s.mini}><span className={pulse.lbl}>Descuento por pedido</span><span>{m?.orders && m.discount_amount != null ? money(m.discount_amount / m.orders, currency) : "—"}</span><small>media de lo concedido</small></div> : null}
              {m?.orders ? <div className={cx(s.mini, s.wide)}>
                <span className={pulse.lbl}>Gasto medio con y sin la promo</span>
                {m?.aov != null && m.aov_baseline != null ? (
                  <>
                    <div className={p.cmp}>
                      <div className={p.cmpR}><span>Con la promo</span><i className={p.meter}><b style={{ width: `${(m.aov / Math.max(m.aov, m.aov_baseline)) * 100}%`, background: "var(--store)" }} /></i><span>{money(m.aov, currency)}</span></div>
                      <div className={p.cmpR}><span>Sin promo</span><i className={p.meter}><b style={{ width: `${(m.aov_baseline / Math.max(m.aov, m.aov_baseline)) * 100}%`, background: "var(--ink-3)" }} /></i><span>{money(m.aov_baseline, currency)}</span></div>
                    </div>
                    <small>{lift != null && lift > 0 ? "Los pedidos con la promoción son más grandes que los demás." : "Los pedidos con la promoción son más pequeños que los demás."}</small>
                  </>
                ) : <small>{m?.aov != null ? "Hay pocos pedidos sin promoción en el periodo para comparar." : "Se calculará con los primeros pedidos."}</small>}
              </div> : null}
            </div>
          </div>
        ) : (
          <div className={pulse.panel}>
            <Empty>{data.metrics_coverage === "migration_pending" ? "El rendimiento estará disponible cuando se aplique la migración de métricas de promociones." : "No se pudo cargar el rendimiento. Los datos de la regla siguen disponibles."}</Empty>
          </div>
        )}
      </section>

      {/* ------------------------------ Regla ------------------------------ */}
      <section id="regla" className={pulse.sec}>
        <SectionHead id="regla-titulo" title="Regla" ai={null} fallback="Qué compra el cliente y qué recibe a cambio." />
        {data.details_coverage === "migration_pending" ? <p className={s.note}>La tienda no tiene el esquema ampliado de reglas y códigos. Los campos que faltan no se interpretan como vacíos.</p> : null}
        <div className={pulse.panel}>
          {appManaged ? (
            <p className={s.note}>Esta promoción la crea y calcula una app. Shopify solo devuelve su nombre y su contador de usos, así que no se pueden mostrar condiciones ni productos.</p>
          ) : (
            <div className={p.rule}>
              <div className={p.side}>
                <h3>El cliente compra</h3>
                {buys.length ? <ul className={p.list}>{buys.map((target) => <li key={`${target.target_type}:${target.external_target_id}`}>{target.target_title && target.target_title !== targetLabel(target.target_type) ? <><span className={pulse.chip}>{targetLabel(target.target_type)}</span>{target.target_title}</> : <span>{targetLabel(target.target_type)}</span>}</li>)}</ul> : <p className={pulse.sub}>Sin requisito de productos guardado.</p>}
              </div>
              <div className={p.arrow} aria-hidden="true">→</div>
              <div className={cx(p.side, p.gets)}>
                <h3>Y recibe {benefitBig(discount)}</h3>
                {gets.length ? <ul className={p.list}>{gets.map((target) => <li key={`${target.target_type}:${target.external_target_id}`}>{target.target_title && target.target_title !== targetLabel(target.target_type) ? <><span className={pulse.chip}>{targetLabel(target.target_type)}</span>{target.target_title}</> : <span>{targetLabel(target.target_type)}</span>}</li>)}</ul> : <p className={pulse.sub}>Sin objetivos de beneficio guardados.</p>}
              </div>
            </div>
          )}
          <div className={p.conds}>
            <div className={p.cond}><span className={pulse.lbl}>Límite de usos</span><span>{discount.usage_limit == null ? "Sin límite" : fmtNum(discount.usage_limit)}</span></div>
            {discount.uses_per_order_limit == null ? null : <div className={p.cond}><span className={pulse.lbl}>Usos por pedido</span><span>{fmtNum(discount.uses_per_order_limit)}</span></div>}
            <div className={p.cond}><span className={pulse.lbl}>Inicio</span><span>{discount.starts_at ? new Date(discount.starts_at).toLocaleString("es-ES") : "Sin fecha"}</span></div>
            <div className={p.cond}><span className={pulse.lbl}>Fin</span><span>{discount.ends_at ? new Date(discount.ends_at).toLocaleString("es-ES") : "Sin fecha"}</span></div>
          </div>
          {targetTotalPages > 1 ? (
            <div className={s.pager} style={{ marginTop: 14 }}>
              <span className={pulse.muted}>Productos de la regla</span>
              <Pagination page={targetsPage} pageCount={targetTotalPages} onChange={setTargetsPage} />
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------ Productos ------------------------------ */}
      {data.top_products?.length ? (
      <section id="productos" className={pulse.sec}>
        <SectionHead id="productos-titulo" title="Qué se vende con la promo" ai={null} fallback={`Unidades en pedidos con la promoción, últimos ${periodDays} días.`} />
        <div className={pulse.panel}>
          <ul className={p.list}>
            {data.top_products.map((item) => (
              <li key={item.product_id ?? item.title} className={p.prodRow}>
                {item.product_id ? <Link href={`/shopify/productos/${item.product_id}?organizationId=${organizationId}${connectionId ? `&connectionId=${connectionId}` : ""}`} style={{ fontWeight: 600 }}>{item.title}</Link> : <span style={{ fontWeight: 600 }}>{item.title}</span>}
                <span className={pulse.num} style={{ fontWeight: 600 }}>{fmtNum(item.units)} uds.</span>
                <i className={p.meter}><b style={{ width: `${(item.units / topMax) * 100}%`, background: "var(--store)" }} /></i>
              </li>
            ))}
          </ul>
        </div>
      </section>
      ) : null}

      {/* ------------------------------ Pedidos ------------------------------ */}
      {data.applications.length ? (
      <section id="pedidos" className={pulse.sec}>
        <SectionHead id="pedidos-titulo" title="Pedidos donde se usó" ai={null} />
        <div className={pulse.panel}>
          <div className={pulse.panelH}>
            <div>
              <h3>Aplicaciones observadas</h3>
              <p className={pulse.sub}>{data.applications_coverage === "migration_pending" ? "El detalle estará disponible cuando el esquema de pedidos tenga su alcance por tienda." : `${fmtNum(data.applications_total ?? 0)} aplicaciones enlazadas; no representa necesariamente todo el historial de Shopify`}</p>
            </div>
          </div>
          {data.applications.length ? (
            <div className={pulse.tblWrap} style={{ marginTop: 0 }}>
              <table className={pulse.tbl}>
                <thead><tr><th>Pedido</th><th>Fecha</th><th>Código / aplicación</th><th style={{ textAlign: "right" }}>Descuento</th><th>Cobertura</th></tr></thead>
                <tbody>
                  {data.applications.map((row) => (
                    <tr key={row.id}>
                      <td><b style={{ fontWeight: 600 }}>{row.order_name || "Pedido sin referencia"}</b></td>
                      <td className={pulse.muted}>{row.order_at ? new Date(row.order_at).toLocaleDateString("es-ES") : "Sin fecha"}</td>
                      <td>{row.code ? <span className={p.code}>{row.code}</span> : row.title || <span className={pulse.muted}>Automática / sin código</span>}</td>
                      <td className={pulse.tdN}>{amountLabel(row, currency)}</td>
                      <td><span className={cx(pulse.chip, row.amount_coverage === "complete" ? pulse.chipGood : pulse.chipWarn)}>{coverageLabel(row.amount_coverage)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>{discount.status?.toUpperCase() === "SCHEDULED" ? "La promoción todavía no ha empezado." : "No hay aplicaciones enlazadas en los pedidos sincronizados disponibles."}</Empty>}
          {data.applications_total != null && data.applications_total > data.applications_page_size ? (
            <div className={s.pager} style={{ marginTop: 14 }}>
              <Pagination page={page} pageCount={totalPages} onChange={setPage} />
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      {/* ------------------------------ Códigos ------------------------------ */}
      {showCodes ? (
        <section id="codigos" className={pulse.sec}>
          <SectionHead id="codigos-titulo" title="Códigos" ai={null} fallback="Qué código aparece en más pedidos. Útil para decidir qué códigos mantener." />
          <div className={pulse.panel}>
            {discount.codes_coverage === "partial" ? <p className={s.note} style={{ marginBottom: 12 }}>Shopify no ha devuelto todos los códigos. Los que falten no aparecen aquí.</p> : null}
            {codesUsage.length ? (
              <div className={pulse.tblWrap} style={{ marginTop: 0 }}>
                <table className={pulse.tbl}>
                  <thead><tr><th>Código</th><th style={{ textAlign: "right" }}>Pedidos</th><th>Peso</th><th style={{ textAlign: "right" }}>Descuento</th></tr></thead>
                  <tbody>
                    {codesUsage.map((row) => (
                      <tr key={row.code}>
                        <td><span className={p.code}>{row.code}</span></td>
                        <td className={pulse.tdN}>{fmtNum(row.orders)}</td>
                        <td style={{ minWidth: 140 }}><i className={p.meter}><b style={{ width: `${(row.orders / codesMax) * 100}%`, background: "var(--store)" }} /></i></td>
                        <td className={pulse.tdN}>{row.discount_amount == null ? "parcial" : money(row.discount_amount, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty>{data.codes_usage ? "Ningún código aparece todavía en pedidos sincronizados." : "Disponible al aplicar la migración de métricas de promociones."}</Empty>}
          </div>
        </section>
      ) : null}

      <footer className={s.foot}>
        <span>Regla y usos: Shopify. Pedidos e importes: pedidos sincronizados.</span>
        <Link href={backHref} onClick={returnToPromotions}>← Volver a promociones</Link>
      </footer>
    </div>
  );
}

export default function ShopifyPromotionDetailPage() {
  return (
    <PortalShell title="Ficha de promoción Shopify">
      {(bootstrap) => (
        <Suspense fallback={<AsyncState status="loading" loadingLabel="Cargando promoción…" />}>
          <PromotionDetail bootstrap={bootstrap} />
        </Suspense>
      )}
    </PortalShell>
  );
}
