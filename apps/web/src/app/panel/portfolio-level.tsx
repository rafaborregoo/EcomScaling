"use client";

import { useState } from "react";
import {
  buildPortfolioHeadline,
  panelMoney,
  panelNumber,
  panelPct,
  type ProfitClientRow,
  type ProfitFlag,
  type ProfitFlagKey,
  type ProfitStoreRow,
  type ProfitTier,
  type ProfitTotals,
} from "@e-nora/contracts";
import { useCopilotAsk } from "@/components/copilot-ask";
import { AsyncState, EmptyState } from "@/components/ui";
import {
  CostStack,
  Delta,
  FlagChips,
  GoalBar,
  Hero,
  IaTag,
  Kpis,
  MonthlyChart,
  Panel,
  ScopeBar,
  Section,
  Seg,
  TIER_CLASS,
  cx,
} from "./panel-parts";
import { useProfitability, type PanelNav } from "./panel-data";
import s from "./panel.module.css";

/**
 * Alcance 1 -- la cartera entera, cliente por cliente o tienda por tienda.
 *
 * Responde a "¿dónde pierdo dinero y dónde no me puedo fiar de la cifra?" antes
 * de abrir ningún cliente. Cada fila lleva al nivel de abajo.
 */

type View = "cliente" | "tienda";
type Filter = "todos" | Exclude<ProfitTier, "ok">;

type MatrixRow = {
  id: string;
  name: string;
  sub: string;
  tier: ProfitTier;
  currency: string | null;
  revenue: number | null;
  change: number | null;
  profit: number | null;
  margin: number | null;
  marginTarget: number | null;
  contribution: number | null;
  cac: number | null;
  cacTarget: number | null;
  flags: ProfitFlag[];
  lever: number;
  open: () => void;
};

function fromClient(row: ProfitClientRow, nav: PanelNav): MatrixRow {
  return {
    id: row.organization_id,
    name: row.name,
    sub: `${row.store_count} ${row.store_count === 1 ? "tienda" : "tiendas"}${row.currency_code ? "" : " · varias monedas"}`,
    tier: row.tier,
    currency: row.currency_code,
    revenue: row.revenue,
    change: row.revenue_change_pct,
    profit: row.net_profit,
    margin: row.margin_pct,
    marginTarget: row.margin_target,
    contribution: row.contribution_per_order,
    cac: row.cac,
    cacTarget: row.cac_target,
    flags: row.flags,
    lever: row.lever_total,
    open: () => nav.client(row.organization_id),
  };
}

function fromStore(row: ProfitStoreRow, nav: PanelNav): MatrixRow {
  return {
    id: row.store_id,
    name: row.shop_name,
    sub: row.organization_name,
    tier: row.tier,
    currency: row.currency_code,
    revenue: row.revenue,
    change: row.revenue_change_pct,
    profit: row.net_profit,
    margin: row.margin_pct,
    marginTarget: row.margin_target,
    contribution: row.tier === "datos" ? null : row.per_order.contribution,
    cac: row.cac,
    cacTarget: row.cac_target,
    flags: row.flags,
    lever: row.lever_total,
    open: () => nav.store(row.organization_id, row.connection_id),
  };
}

const goalDigits = (target: number) => (Number.isInteger(target) ? 0 : 1);

function MatrixLine({ row }: { row: MatrixRow }) {
  const estimated = row.tier === "datos";
  const marginTone = estimated
    ? "est"
    : row.margin !== null && row.margin < 0
      ? "bad"
      : row.marginTarget !== null && row.margin !== null && row.margin < row.marginTarget
        ? "low"
        : "ok";

  return (
    <div className={cx(s.gtR, TIER_CLASS[row.tier])} role="row">
      <div className={s.nmCell} role="cell">
        <span className={s.dot} />
        <span>
          <button type="button" className={cx(s.nm, s.rowBtn)} onClick={row.open}>
            {row.name}
          </button>
          <span className={s.nmSub}>{row.sub}</span>
        </span>
      </div>
      <div className={s.num} role="cell">
        {row.revenue === null ? "—" : panelMoney(row.revenue, row.currency)}
        {row.change !== null ? (
          <span className={cx(s.nmSub, row.change >= 0 ? s.pos : s.neg)}>
            {row.change >= 0 ? "▲" : "▼"} {panelPct(Math.abs(row.change))}
          </span>
        ) : null}
      </div>
      <div className={s.num} role="cell">
        {row.profit === null ? (
          "—"
        ) : (
          <span className={row.profit < 0 ? s.neg : estimated ? s.est : undefined}>
            {estimated ? "≈ " : ""}
            {panelMoney(row.profit, row.currency)}
          </span>
        )}
        {estimated && row.profit !== null ? <span className={cx(s.nmSub, s.est)}>estimado</span> : null}
      </div>
      <div role="cell">
        {row.margin === null ? (
          "—"
        ) : (
          <GoalBar
            value={row.margin}
            goal={row.marginTarget}
            tone={marginTone}
            text={panelPct(row.margin)}
            goalText={row.marginTarget !== null ? `/ obj. ${panelNumber(row.marginTarget, goalDigits(row.marginTarget))} %` : "/ sin objetivo"}
          />
        )}
      </div>
      <div className={cx(s.num, row.contribution === null ? s.mut : row.contribution < 0 ? s.neg : undefined)} role="cell">
        {row.contribution === null ? "—" : panelMoney(row.contribution, row.currency, 2)}
      </div>
      <div role="cell">
        {row.cac === null ? (
          <span className={s.mut}>sin publicidad</span>
        ) : (
          <GoalBar
            value={row.cac}
            goal={row.cacTarget}
            tone={row.cacTarget === null ? "est" : row.cac <= row.cacTarget ? "ok" : "bad"}
            text={panelMoney(row.cac, row.currency, 2)}
            goalText={row.cacTarget !== null ? `/ obj. ${panelMoney(row.cacTarget, row.currency, 1)}` : "/ sin objetivo"}
          />
        )}
      </div>
      <div className={s.flags} role="cell">
        <FlagChips flags={row.flags} />
      </div>
      <div className={s.num} role="cell">
        <b>{row.lever > 0 ? `+${panelMoney(row.lever, row.currency)}/mes` : "—"}</b>
      </div>
    </div>
  );
}

/** Dónde está la palanca de cada tipo: las dos tiendas que más aportan. */
function topStores(stores: ProfitStoreRow[], key: "margen" | "conversion" | "cac") {
  return stores
    .map((store) => ({
      name: store.shop_name,
      amount: store.levers.filter((lever) => lever.clave === key).reduce((sum, lever) => sum + lever.eur_mes, 0),
    }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 2)
    .map((entry) => entry.name);
}

function joinNames(names: string[]) {
  return names.length > 1 ? `${names[0]} y ${names[1]}` : (names[0] ?? "");
}

function evolutionLead(totals: ProfitTotals) {
  const revenue = totals.revenue_change_pct;
  const profit = totals.profit_change_pct;
  const costs = "El reparto de costes dice dónde se queda el dinero.";
  if (revenue === null || profit === null) return `Doce meses de ingresos y beneficio de la cartera. ${costs}`;
  const sells = revenue >= 0 ? "vende más" : "vende menos";
  const earns = profit >= 0 ? "gana más" : "gana menos";
  return `La cartera ${sells}${revenue >= 0 === profit >= 0 ? " y" : " pero"} ${earns} que el periodo anterior. ${costs}`;
}

/** La lectura deterministica que acompaña al titular. No es IA y no se etiqueta como tal. */
function portfolioReading(totals: ProfitTotals, stores: ProfitStoreRow[]) {
  const parts: string[] = [];
  if (totals.revenue > 0 && totals.costs.ads > 0) {
    parts.push(`La publicidad se lleva el ${panelNumber((totals.costs.ads / totals.revenue) * 100)} % de lo que facturas`);
  }
  if (totals.counts.over_cac > 0) {
    parts.push(
      `${totals.counts.over_cac} ${totals.counts.over_cac === 1 ? "tienda paga" : "tiendas pagan"} por cada cliente nuevo más que su objetivo`,
    );
  }
  const text = parts.length ? `${parts.join(" y ")}.` : "";
  const losing = stores
    .filter((store) => store.tier === "pierde" && store.currency_code === totals.currency_code)
    .reduce((sum, store) => sum + store.lever_total, 0);
  const share = totals.lever_total > 0 ? Math.round((losing / totals.lever_total) * 100) : 0;
  const tail = share > 0 ? ` Empieza por las que pierden: concentran el ${share} % de la palanca.` : "";
  return `${text}${tail}`.trim();
}

const BLOCKING_KEYS: ProfitFlagKey[] = ["no_cogs", "no_fixed", "no_settings", "no_currency", "no_sessions"];

export function PortfolioLevel({
  days,
  onDays,
  nav,
}: {
  days: number;
  onDays: (days: number) => void;
  nav: PanelNav;
}) {
  const query = useProfitability(days, null);
  const ask = useCopilotAsk();
  const [view, setView] = useState<View>("cliente");
  const [filter, setFilter] = useState<Filter>("todos");

  const bar = <ScopeBar days={days} onDays={onDays} />;

  if (query.isLoading) {
    return <div className={s.stage}><div className={s.wrap}>{bar}<AsyncState status="loading" loadingLabel="Calculando la rentabilidad de tu cartera…" /></div></div>;
  }
  if (query.error && !query.data) {
    return <div className={s.stage}><div className={s.wrap}>{bar}<AsyncState status="error" error={query.error} /></div></div>;
  }
  const data = query.data;
  if (!data || data.stores.length === 0) {
    return (
      <div className={s.stage}>
        <div className={s.wrap}>
          {bar}
          <EmptyState
            title="Todavía no hay tiendas en tu cartera"
            hint="Cuando un cliente conecte Shopify, aparecerá aquí con su rentabilidad."
          />
        </div>
      </div>
    );
  }

  const { stores, totals } = data;
  const headline = buildPortfolioHeadline(totals, days);
  const reading = portfolioReading(totals, stores);
  const currency = totals.currency_code;
  const money = (value: number, digits = 0) => panelMoney(value, currency, digits);

  const rows: MatrixRow[] =
    view === "cliente"
      ? data.clients.map((client) => fromClient(client, nav))
      : stores.map((store) => fromStore(store, nav));
  const shown = rows.filter((row) => filter === "todos" || row.tier === filter);
  const count = (tier: Filter) => (tier === "todos" ? rows.length : rows.filter((row) => row.tier === tier).length);

  function jump(next: Filter) {
    setView("tienda");
    setFilter(next);
    document.getElementById("matriz")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Datos por completar: cada aviso con las tiendas a las que afecta.
  const pending = BLOCKING_KEYS.map((key) => {
    const affected = stores.filter((store) => store.flags.some((flag) => flag.key === key));
    const label = affected[0]?.flags.find((flag) => flag.key === key)?.label ?? "";
    return { key, label, affected };
  }).filter((entry) => entry.affected.length > 0);

  const leverRows = [
    {
      key: "margen" as const,
      title: "Margen neto al objetivo",
      amount: totals.levers_by_key.margen,
      note: (() => {
        const top = topStores(stores, "margen");
        return `Misma facturación, mejor margen.${top.length ? ` La mayor parte está en ${joinNames(top)}.` : ""}`;
      })(),
    },
    {
      key: "conversion" as const,
      title: "Conversión al objetivo",
      amount: totals.levers_by_key.conversion,
      note: "Mismo tráfico, más pedidos, cada uno dejando lo que deja hoy. Las tiendas sin objetivo de conversión no entran.",
    },
    {
      key: "cac" as const,
      title: "CAC al objetivo",
      amount: totals.levers_by_key.cac,
      note: `${totals.counts.over_cac} ${totals.counts.over_cac === 1 ? "tienda paga" : "tiendas pagan"} más por cliente nuevo que el objetivo que ${totals.counts.over_cac === 1 ? "tiene" : "tienen"}.`,
    },
  ].filter((row) => row.amount > 0);

  const costs = totals.costs;

  return (
    <div className={s.stage}>
      <div className={s.wrap}>
        {bar}

        <Hero
          id="h-cartera"
          meta={
            <>
              <span>Rentabilidad</span>
              <span>
                Tu cartera · {totals.counts.clients} {totals.counts.clients === 1 ? "cliente" : "clientes"} · {totals.counts.stores} {totals.counts.stores === 1 ? "tienda" : "tiendas"}
              </span>
              <span>Últimos {days === 365 ? "12 meses" : `${days} días`} · sin IVA</span>
            </>
          }
          title={headline.title}
          lines={[headline.detail, reading].filter(Boolean)}
          actions={
            <>
              <button
                type="button"
                className={cx(s.btn, s.acc)}
                onClick={() =>
                  ask({
                    question:
                      "¿Dónde se me escapa el dinero en mi cartera? Dime qué tiendas pierden, cuáles no tienen datos fiables y qué haría primero.",
                    focusLabel: "Rentabilidad de la cartera",
                  })
                }
              >
                <IaTag />
                ¿Dónde se me escapa el dinero?
              </button>
              {totals.counts.pierde > 0 ? (
                <button type="button" className={cx(s.btn, s.ghost)} onClick={() => jump("pierde")}>
                  Ver las tiendas que pierden
                </button>
              ) : null}
            </>
          }
          side={
            <div className={s.counters}>
              <button type="button" className={cx(s.counter, totals.counts.pierde > 0 && s.hot)} onClick={() => jump("pierde")}>
                <b>{totals.counts.pierde}</b>
                <span>Tiendas que pierden dinero</span>
              </button>
              <button type="button" className={cx(s.counter, totals.counts.datos > 0 && s.hot)} onClick={() => jump("datos")}>
                <b>{totals.counts.datos}</b>
                <span>Con beneficio no fiable</span>
              </button>
              <button type="button" className={s.counter} onClick={() => jump("bajo")}>
                <b>{totals.counts.bajo}</b>
                <span>Por debajo del objetivo de margen</span>
              </button>
              <div className={s.counter}>
                <b>{totals.counts.over_cac}</b>
                <span>Pagan más por cliente que su objetivo</span>
              </div>
              <div className={cx(s.counter, s.wide)}>
                <b>+{money(totals.lever_total)}/mes</b>
                <span>Dinero sobre la mesa si todo llegara a su objetivo</span>
              </div>
            </div>
          }
        />

        <Kpis
          label={`Cifras de la cartera, últimos ${days} días`}
          items={[
            {
              label: "Ingresos (sin IVA)",
              value: money(totals.revenue),
              foot: <Delta value={totals.revenue_change_pct} suffix="vs periodo anterior" />,
            },
            {
              label: "Beneficio neto",
              value: money(totals.net_profit),
              foot: totals.counts.datos > 0 ? (
                <>
                  <Delta value={totals.profit_change_pct} />
                  <span>incluye {totals.counts.datos} {totals.counts.datos === 1 ? "tienda" : "tiendas"} con costes sin completar</span>
                </>
              ) : (
                <Delta value={totals.profit_change_pct} suffix="vs periodo anterior" />
              ),
            },
            {
              label: "Margen neto",
              value: panelPct(totals.margin_pct),
              foot: (
                <span>
                  {totals.counts.ok} de {totals.counts.reliable} tiendas fiables cumplen su objetivo
                </span>
              ),
            },
            {
              label: "Pedidos",
              value: panelNumber(totals.orders),
              foot: <Delta value={totals.orders_change_pct} suffix="vs periodo anterior" />,
            },
            {
              label: "Ticket medio",
              value: money(totals.aov, 1),
              foot: <Delta value={totals.aov_change_pct} suffix="media de la cartera" />,
            },
            {
              label: "Inversión publicitaria",
              value: money(totals.ads_spend),
              foot: (
                <span>
                  {totals.revenue > 0 ? `${panelNumber((totals.ads_spend / totals.revenue) * 100)} % de los ingresos · ` : ""}
                  el gasto suma; la atribución no
                </span>
              ),
            },
          ]}
        />

        <Section
          id="matriz"
          title="Quién gana y quién pierde"
          lead="Lo peor primero. Cada fila lleva al nivel de abajo. Por tienda no se esconde ninguna: una tienda que pierde no se diluye en el total de su cliente."
          action={
            <Seg
              label="Agrupar por"
              value={view}
              options={[
                { key: "cliente", label: "Por cliente" },
                { key: "tienda", label: "Por tienda" },
              ]}
              onChange={(next) => {
                setView(next);
                setFilter("todos");
              }}
            />
          }
        >
          <Panel
            title={view === "cliente" ? `${data.clients.length} clientes` : `${stores.length} tiendas`}
            sub={`${days === 365 ? "Último año" : `Últimos ${days} días`} · sin IVA · la marca negra es el objetivo que tú fijaste`}
            aside={
              <Seg
                label="Filtrar"
                value={filter}
                options={[
                  { key: "todos", label: "Todos", count: count("todos") },
                  { key: "pierde", label: "Pierden dinero", count: count("pierde") },
                  { key: "datos", label: "Datos no fiables", count: count("datos") },
                  { key: "bajo", label: "Bajo objetivo", count: count("bajo") },
                ]}
                onChange={setFilter}
              />
            }
          >
            {data.failed_stores.length > 0 ? (
              <p className={s.err}>
                No se pudo leer {data.failed_stores.map((store) => store.shop_name).join(", ")}. No aparece con datos a medias; reintenta en unos segundos.
              </p>
            ) : null}
            <div className={s.tblWrap}>
              <div className={s.gt} role="table" aria-label={`Rentabilidad por ${view}`}>
                <div className={s.gtH} role="row">
                  <div role="columnheader">{view === "cliente" ? "Cliente" : "Tienda · cliente"}</div>
                  <div role="columnheader">Ingresos {days === 365 ? "1 año" : `${days} d`}</div>
                  <div role="columnheader">Beneficio neto</div>
                  <div role="columnheader">Margen vs objetivo</div>
                  <div role="columnheader">Deja / pedido</div>
                  <div role="columnheader">CAC vs objetivo</div>
                  <div role="columnheader">Fiabilidad</div>
                  <div role="columnheader">Palanca</div>
                </div>
                {shown.length === 0 ? <p className={s.empty}>Ninguna coincide con este filtro.</p> : null}
                {shown.map((row) => (
                  <MatrixLine key={row.id} row={row} />
                ))}
              </div>
            </div>
            <p className={s.foot} style={{ marginTop: 14 }}>
              Los totales suman solo tiendas en {currency ?? "la moneda mayoritaria"}
              {totals.stores_excluded > 0
                ? `: ${totals.stores_excluded} ${totals.stores_excluded === 1 ? "tienda se muestra" : "tiendas se muestran"} en su moneda y ${totals.stores_excluded === 1 ? "queda" : "quedan"} fuera`
                : ""}
              . «≈» es una cifra estimada: faltan costes y no debe decirse al cliente como cierta.
              {data.truncated ? " La cartera es muy grande: se muestran las primeras 150 tiendas." : ""}
            </p>
          </Panel>
        </Section>

        <Section
          id="dinero"
          title="Qué hacer primero"
          lead="Arriba, dónde está el dinero. Abajo, lo que hay que arreglar antes de poder fiarse de las cifras."
        >
          <div className={s.two}>
            <Panel
              title="Dinero sobre la mesa"
              sub="Beneficio extra al mes si cada métrica llegara al objetivo que has puesto · solo tiendas con coste de producto"
            >
              {leverRows.length === 0 ? (
                <p className={s.empty}>
                  Nada que calcular todavía. Fija objetivos en Configuración: sin objetivo no hay escenario, y no nos inventamos medias del sector.
                </p>
              ) : (
                <>
                  <ul>
                    {leverRows.map((row) => (
                      <li key={row.key} className={s.li}>
                        <div>
                          <b>{row.title}</b>
                          <p>{row.note}</p>
                        </div>
                        <div className={s.liR}>
                          <span className={cx(s.big, s.pos)}>+{money(row.amount)}/mes</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className={s.tot}>
                    <span>Todo junto</span>
                    <b className={s.pos}>+{money(totals.lever_total)}/mes</b>
                  </div>
                </>
              )}
              {totals.counts.datos > 0 ? (
                <p className={s.foot} style={{ marginTop: 10 }}>
                  {totals.counts.datos} {totals.counts.datos === 1 ? "tienda sin cálculo" : "tiendas sin cálculo"}: con el producto a cero la cifra sería inventada.
                </p>
              ) : null}
            </Panel>

            <Panel title="Datos por completar" sub="Lo que invalida el beneficio de una tienda">
              {pending.length === 0 ? (
                <p className={s.empty}>Todas las tiendas tienen sus costes cargados.</p>
              ) : (
                <ul>
                  {pending.map((entry) => {
                    const first = entry.affected[0]!;
                    const names = entry.affected.slice(0, 3).map((store) => store.shop_name).join(", ");
                    const more = entry.affected.length - 3;
                    const blocking = entry.affected.some((store) => store.flags.some((flag) => flag.key === entry.key && flag.blocking));
                    return (
                      <li key={entry.key} className={s.qi}>
                        <span className={cx(s.qn, blocking && s.w)}>{entry.affected.length}</span>
                        <b>{entry.label}</b>
                        <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={() => nav.store(first.organization_id, first.connection_id)}>
                          Abrir
                        </button>
                        <p>
                          {names}
                          {more > 0 ? ` y ${more} más` : ""}
                          {entry.key === "no_sessions" ? ". No bloquea el beneficio, pero sin él no hay embudo ni palanca de conversión." : ""}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </Section>

        <Section id="evolucion" title="Cómo evoluciona" lead={evolutionLead(totals)}>
          <div className={s.two}>
            <Panel title="Ingresos y beneficio por mes" sub="Doce meses · la parte verde de cada barra es el beneficio · miles de euros">
              {data.monthly.length === 0 ? (
                <p className={s.empty}>Sin serie mensual.</p>
              ) : (
                <MonthlyChart months={data.monthly} label="Ingresos y beneficio mensual de la cartera, doce meses" />
              )}
            </Panel>
            <Panel title="A dónde va cada euro facturado" sub={`Reparto de ${money(totals.revenue)} de ingresos sin IVA`}>
              <CostStack costs={costs} revenue={totals.revenue} profit={totals.net_profit} currency={currency} />
            </Panel>
          </div>
        </Section>
      </div>
    </div>
  );
}
