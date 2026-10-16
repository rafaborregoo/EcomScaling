"use client";

import { useState } from "react";
import {
  buildClientHeadline,
  overCacTarget,
  panelMoney,
  panelNumber,
  panelPct,
  type ProfitStoreRow,
} from "@e-nora/contracts";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries } from "@/lib/use-cached-query";
import { useCopilotAsk } from "@/components/copilot-ask";
import { AsyncState, EmptyState, toast } from "@/components/ui";
import {
  AiLine,
  Chip,
  Delta,
  Hero,
  IaTag,
  Kpis,
  MonthlyChart,
  Panel,
  ScopeBar,
  Section,
  Spark,
  TIER_CLASS,
  TIER_LABEL,
  cx,
} from "./panel-parts";
import { useCallNotes, usePanelReading, useProfitability, type PanelNav } from "./panel-data";
import { ClientActions, ClientThread } from "./client-extras";
import s from "./panel.module.css";

/**
 * Alcance 2 -- un cliente y todas sus tiendas.
 *
 * Responde a "¿qué llevo a la llamada con este cliente?": cuánto gana cada
 * tienda, dónde se le va el ticket a cada una y qué palancas hay sobre la mesa.
 */

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const callDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric" });

function storeChip(store: ProfitStoreRow) {
  if (store.tier === "pierde") return <Chip tone="bad">{TIER_LABEL.pierde}</Chip>;
  if (store.tier === "datos") return <Chip tone="warn">{TIER_LABEL.datos}</Chip>;
  if (overCacTarget(store)) return <Chip tone="warn">CAC sobre su objetivo</Chip>;
  if (store.tier === "bajo") return <Chip tone="warn">{TIER_LABEL.bajo}</Chip>;
  return <Chip tone="good">{TIER_LABEL.ok}</Chip>;
}

export function ClientLevel({
  organizationId,
  organizationName,
  days,
  onDays,
  nav,
}: {
  organizationId: string;
  organizationName: string;
  days: number;
  onDays: (days: number) => void;
  nav: PanelNav;
}) {
  const query = useProfitability(days, organizationId);
  const reading = usePanelReading({ organizationId, connectionId: null, days });
  const { nextCall, queued, adding, add: addToCall } = useCallNotes(organizationId);
  const ask = useCopilotAsk();
  const [reviewing, setReviewing] = useState(false);

  const bar = <ScopeBar days={days} onDays={onDays} />;

  if (query.isLoading) {
    return <div className={s.stage}><div className={s.wrap}>{bar}<AsyncState status="loading" loadingLabel="Calculando la rentabilidad del cliente…" /></div></div>;
  }
  if (query.error && !query.data) {
    return <div className={s.stage}><div className={s.wrap}>{bar}<AsyncState status="error" error={query.error} /></div></div>;
  }
  const data = query.data;
  const client = data?.clients[0];
  if (!data || !client || data.stores.length === 0) {
    return (
      <div className={s.stage}>
        <div className={s.wrap}>
          {bar}
          <EmptyState
            title={`${organizationName} no tiene tiendas con datos`}
            hint="Conecta Shopify en Integraciones para ver su rentabilidad."
          />
        </div>
      </div>
    );
  }

  const stores = data.stores;
  const currency = client.currency_code;
  const money = (value: number, digits = 0) => panelMoney(value, currency, digits);
  const headline = buildClientHeadline(client, stores, days);
  const name = client.name;

  // --- fiabilidad agregada -------------------------------------------------
  const total = stores.length;
  const without = (key: string) => stores.filter((store) => store.flags.some((flag) => flag.key === key)).length;
  const reliability = [
    { label: "Coste de producto", missing: without("no_cogs"), warn: true },
    { label: "Gastos fijos", missing: without("no_fixed"), warn: true },
    { label: "Comisiones y envío", missing: without("no_settings"), warn: true },
    { label: "Sesiones", missing: without("no_sessions"), warn: true },
  ].map((row) => ({ ...row, text: `${total - row.missing} de ${total} ${total === 1 ? "tienda" : "tiendas"}` }));
  const withAds = stores.filter((store) => store.ads_spend > 0).length;
  const blockingMissing = reliability.slice(0, 3).some((row) => row.missing > 0);

  // --- cifras del cliente ---------------------------------------------------
  const prevOrders = stores.every((store) => store.prev_orders !== null)
    ? stores.reduce((sum, store) => sum + (store.prev_orders ?? 0), 0)
    : null;
  const ordersChange = prevOrders ? ((client.orders - prevOrders) / prevOrders) * 100 : null;
  const withOrders = stores.filter((store) => store.orders > 0);
  const aovs = withOrders.map((store) => store.per_order.aov_ex_tax);
  const profitChange = (() => {
    const prev = stores.every((store) => store.prev_profit !== null)
      ? stores.reduce((sum, store) => sum + (store.prev_profit ?? 0), 0)
      : null;
    return prev && client.net_profit !== null ? ((client.net_profit - prev) / Math.abs(prev)) * 100 : null;
  })();

  // --- pedido por tienda ----------------------------------------------------
  const stackScale = Math.max(
    1,
    ...withOrders.map((store) => {
      const p = store.per_order;
      return Math.max(p.aov_ex_tax, p.cogs + p.shipping + p.fees + p.ads + p.fixed);
    }),
  );
  const ranked = [...withOrders].sort((a, b) => a.per_order.profit - b.per_order.profit);
  const worst = ranked[0];
  const best = ranked[ranked.length - 1];
  const gap = (() => {
    if (!worst || !best || worst === best) return "";
    const shipping = worst.per_order.shipping - best.per_order.shipping;
    const ads = worst.per_order.ads - best.per_order.ads;
    const parts = [
      shipping >= 0.5 ? `el envío cuesta ${panelMoney(shipping, worst.currency_code, 2)} más por pedido` : null,
      ads >= 0.5 ? `${shipping >= 0.5 ? "y " : ""}la publicidad ${panelMoney(ads, worst.currency_code, 2)} más` : null,
    ].filter(Boolean);
    if (parts.length === 0) return "";
    return `En ${worst.shop_name} ${parts.join(" ")}. Por eso deja ${panelMoney(worst.per_order.profit, worst.currency_code, 2)} por pedido frente a ${panelMoney(best.per_order.profit, best.currency_code, 2)} en ${best.shop_name}.`;
  })();

  // --- palancas -------------------------------------------------------------
  const levers = stores
    .flatMap((store) => store.levers.map((lever) => ({ store, lever })))
    .sort((a, b) => b.lever.eur_mes - a.lever.eur_mes);


  async function markReviewed() {
    setReviewing(true);
    try {
      const response = await apiFetch(`/v1/consultant/organizations/${organizationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Revisión marcada. A partir de aquí empieza lo nuevo.");
      invalidateApiGetCache();
      invalidateCachedQueries("/v1/consultant/daily-workbench");
    } catch {
      toast.danger("No se pudo marcar la revisión. Revisa la conexión e inténtalo de nuevo.");
    } finally {
      setReviewing(false);
    }
  }

  const positiveProfit = stores.reduce((sum, store) => sum + Math.max(0, store.net_profit), 0);
  const share = (store: ProfitStoreRow) => (positiveProfit > 0 ? (Math.max(0, store.net_profit) / positiveProfit) * 100 : 0);

  const aiLine = reading.text ? (
    <AiLine text={reading.text} generatedAt={reading.generatedAt} stale={reading.stale} />
  ) : !reading.supported ? (
    <span className={s.mut}>La lectura IA cubre 30 y 90 días.</span>
  ) : reading.isLoading ? (
    <span className={s.mut}>Leyendo la rentabilidad…</span>
  ) : (
    <span className={s.mut}>Sin lectura IA de este cliente todavía.</span>
  );

  return (
    <div className={s.stage}>
      <div className={s.wrap}>
        {bar}

        <Hero
          id="h-cliente"
          tier={client.tier}
          meta={
            <>
              <span>Rentabilidad</span>
              <span>Cliente · {total} {total === 1 ? "tienda" : "tiendas"}</span>
              <span className={s.tier}>● {TIER_LABEL[client.tier]}</span>
              <span>Últimos {days === 365 ? "12 meses" : `${days} días`} · sin IVA</span>
            </>
          }
          title={headline.title}
          lines={[headline.detail, aiLine].filter(Boolean)}
          actions={
            <>
              <button
                type="button"
                className={cx(s.btn, s.acc)}
                onClick={() =>
                  ask({
                    question: `Prepárame la llamada con ${name}: qué cifras de rentabilidad llevo, qué tiendas lo explican y qué le propondría.`,
                    focusLabel: name,
                  })
                }
              >
                <IaTag />
                Preparar la llamada con {name}
              </button>
              <button
                type="button"
                className={cx(s.btn, s.ghost)}
                onClick={() =>
                  ask({
                    question: `Escríbeme el guion de la llamada con ${name} en tres bloques: 1) qué le enseño primero (las cifras que mejor se explican), 2) qué le propongo y qué le pido permiso para cambiar, 3) cómo cierro con acuerdos concretos. ${
                      queued.length > 0
                        ? `Parte de los puntos que ya llevo: ${queued.map((note) => note.body).join("; ")}.`
                        : "Todavía no llevo puntos añadidos."
                    }`,
                    focusLabel: `Guion · ${name}`,
                  })
                }
              >
                <IaTag />
                Guion de la llamada
              </button>
              <button type="button" className={cx(s.btn, s.ghost)} onClick={nav.portfolio}>
                ← Toda la cartera
              </button>
              <button type="button" className={cx(s.btn, s.ghost)} disabled={reviewing} onClick={markReviewed}>
                {reviewing ? "Guardando…" : "Marcar como revisado"}
              </button>
              {reading.supported ? (
                <button type="button" className={cx(s.btn, s.ghost)} disabled={reading.running} title="La lectura se actualiza sola dos veces al día. A mano, hasta dos veces al día." onClick={reading.run}>
                  {reading.running ? "Leyendo…" : "Actualizar lectura IA"}
                </button>
              ) : null}
            </>
          }
          side={
            <aside className={s.side} aria-label="Fiabilidad de los datos">
              <h3>Fiabilidad de los datos</h3>
              {reliability.map((row) => (
                <div key={row.label} className={s.sRow}>
                  <span>
                    <i className={row.missing > 0 ? s.w : undefined} />
                    {row.label}
                  </span>
                  <strong>{row.text}</strong>
                </div>
              ))}
              <div className={s.sRow}>
                <span>
                  <i />
                  Publicidad
                </span>
                <strong>{withAds === 0 ? "Sin inversión" : `Inversión en ${withAds} de ${total}`}</strong>
              </div>
              <p className={s.sideNote}>
                {blockingMissing
                  ? "Hasta completarlo, el beneficio de este cliente no es firme: sale como «≈ estimado»."
                  : reliability[3]!.missing > 0
                    ? "El beneficio de este cliente es fiable. Sin sesiones no hay embudo en esas tiendas."
                    : "El beneficio de este cliente es fiable."}
              </p>
            </aside>
          }
        />

        <Kpis
          label={`Cifras del cliente, últimos ${days} días`}
          items={[
            {
              label: "Ingresos (sin IVA)",
              value: client.revenue === null ? "—" : money(client.revenue),
              foot: <Delta value={client.revenue_change_pct} suffix="vs periodo anterior" />,
            },
            {
              label: "Beneficio neto",
              value: client.net_profit === null ? "—" : `${client.tier === "datos" ? "≈ " : ""}${money(client.net_profit)}`,
              foot: <Delta value={profitChange} suffix="vs periodo anterior" />,
            },
            {
              label: "Margen neto",
              value: client.margin_pct === null ? "—" : panelPct(client.margin_pct),
              foot:
                client.margin_target !== null ? (
                  <Chip tone={client.margin_pct !== null && client.margin_pct >= client.margin_target ? "good" : "warn"}>
                    objetivo {panelNumber(client.margin_target, Number.isInteger(client.margin_target) ? 0 : 1)} %
                  </Chip>
                ) : (
                  <span>sin objetivo fijado</span>
                ),
            },
            {
              label: "Pedidos",
              value: panelNumber(client.orders),
              foot: <Delta value={ordersChange} suffix="vs periodo anterior" />,
            },
            {
              label: "Ticket medio",
              value: client.revenue !== null && client.orders > 0 ? money(client.revenue / client.orders, 1) : "—",
              foot:
                aovs.length > 1 ? (
                  <span>
                    de {money(Math.min(...aovs), 1)} a {money(Math.max(...aovs), 1)} según la tienda
                  </span>
                ) : (
                  <span>media del cliente</span>
                ),
            },
            {
              label: "CAC real",
              value: client.cac === null ? "—" : money(client.cac, 1),
              foot:
                client.cac === null ? (
                  <span>Sin CAC calculado</span>
                ) : client.cac_target !== null ? (
                  <>
                    <Chip tone={client.cac <= client.cac_target ? "good" : "warn"}>objetivo {money(client.cac_target, 1)}</Chip>
                    <span>media ponderada</span>
                  </>
                ) : (
                  <span>sin objetivo fijado</span>
                ),
            },
          ]}
        />

        <Section
          id="tiendas"
          title="Sus tiendas"
          lead="Abre una tienda para revisar sus cifras. La etiqueta indica si cumple el objetivo, pierde dinero o necesita completar sus datos."
        >
          <div className={s.three}>
            {stores.map((store) => {
              const cur = store.currency_code;
              const estimated = store.tier === "datos";
              return (
                <article key={store.store_id} className={cx(s.sc, TIER_CLASS[store.tier])}>
                  <div className={s.scH}>
                    <div>
                      <b>{store.shop_name}</b>
                      <span>{store.domain && store.domain !== store.shop_name ? `${store.domain} · ` : ""}{cur ?? "sin moneda"}</span>
                    </div>
                    {storeChip(store)}
                  </div>
                  <div className={s.scKpi}>
                    <div>
                      <small>Ingresos</small>
                      <strong>{panelMoney(store.revenue, cur)}</strong>
                      {store.revenue_change_pct !== null ? (
                        <em className={store.revenue_change_pct >= 0 ? s.pos : s.neg}>
                          {store.revenue_change_pct >= 0 ? "▲" : "▼"} {panelPct(Math.abs(store.revenue_change_pct))}
                        </em>
                      ) : null}
                    </div>
                    <div>
                      <small>Beneficio neto</small>
                      <strong className={store.net_profit < 0 ? s.neg : undefined}>
                        {estimated ? "≈ " : ""}
                        {panelMoney(store.net_profit, cur)}
                      </strong>
                      <em className={store.tier === "bajo" || estimated ? s.est : undefined}>
                        Margen {panelPct(store.margin_pct)}
                        {store.margin_target !== null ? ` · obj. ${panelNumber(store.margin_target, Number.isInteger(store.margin_target) ? 0 : 1)} %` : ""}
                      </em>
                    </div>
                    <div>
                      <small>Pedidos</small>
                      <strong>{panelNumber(store.orders)}</strong>
                      <em>ticket {panelMoney(store.per_order.aov_ex_tax, cur, 1)}</em>
                    </div>
                    <div>
                      <small>CAC real</small>
                      {store.cac === null ? (
                        <>
                          <strong className={s.mut}>—</strong>
                          <em>sin publicidad</em>
                        </>
                      ) : (
                        <>
                          <strong className={overCacTarget(store) ? s.neg : undefined}>{panelMoney(store.cac, cur, 1)}</strong>
                          <em>{store.cac_target !== null ? `objetivo ${panelMoney(store.cac_target, cur, 1)}` : "sin objetivo"}</em>
                        </>
                      )}
                    </div>
                  </div>
                  <Spark values={store.daily} label={`Ventas diarias de ${store.shop_name} en el periodo`} />
                  <div className={s.scF}>
                    {store.lever_total > 0 ? (
                      <Chip tone="acc">Palanca +{panelMoney(store.lever_total, cur)}/mes</Chip>
                    ) : store.flags.length > 0 ? (
                      <Chip tone={store.flags[0]!.blocking ? "warn" : undefined}>{store.flags[0]!.label}</Chip>
                    ) : (
                      <Chip>Sin palanca</Chip>
                    )}
                    <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={() => nav.store(store.organization_id, store.connection_id)}>
                      Abrir tienda →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </Section>

        {withOrders.length > 0 ? (
          <Section
            id="pedido"
            title="Qué se queda cada pedido"
            lead="El mismo ticket, tienda a tienda. La longitud de la barra es el ticket medio; la parte verde es lo que queda después de todo."
          >
            <div className={s.panel}>
              <div className={s.cmp} aria-hidden="true" style={{ borderTop: 0, paddingTop: 0 }}>
                <span className={s.mut}>Tienda</span>
                <div className={s.key} style={{ margin: 0 }}>
                  <span><i className={s.cProd} />Producto</span>
                  <span><i className={s.cShip} />Envío</span>
                  <span><i className={s.cFees} />Comisiones</span>
                  <span><i className={s.cAds} />Publicidad</span>
                  <span><i className={s.cFix} />Gastos fijos</span>
                  <span><i className={s.cProfit} />Te quedan</span>
                </div>
                <span className={s.mut}>Por pedido</span>
              </div>
              {withOrders.map((store) => {
                const p = store.per_order;
                const cur = store.currency_code;
                const width = (value: number) => `${(Math.max(0, value) / stackScale) * 100}%`;
                return (
                  <div key={store.store_id} className={s.cmp}>
                    <b>{store.shop_name}</b>
                    <div
                      className={s.stk}
                      role="img"
                      aria-label={`Ticket de ${panelMoney(p.aov_ex_tax, cur, 1)}: producto ${panelMoney(p.cogs, cur, 1)}, envío ${panelMoney(p.shipping, cur, 1)}, comisiones ${panelMoney(p.fees, cur, 1)}, publicidad ${panelMoney(p.ads, cur, 1)}, fijos ${panelMoney(p.fixed, cur, 1)}, te quedan ${panelMoney(p.profit, cur, 1)}`}
                    >
                      <i className={s.cProd} style={{ width: width(p.cogs) }} />
                      <i className={s.cShip} style={{ width: width(p.shipping) }} />
                      <i className={s.cFees} style={{ width: width(p.fees) }} />
                      <i className={s.cAds} style={{ width: width(p.ads) }} />
                      <i className={s.cFix} style={{ width: width(p.fixed) }} />
                      <i className={s.cProfit} style={{ width: width(p.profit) }} />
                    </div>
                    <span className={s.cv}>
                      <b className={p.profit < 0 ? s.neg : store.tier === "datos" ? s.est : store.tier === "bajo" ? s.est : s.pos}>
                        {store.tier === "datos" ? "≈ " : ""}
                        {panelMoney(p.profit, cur, 2)}
                      </b>{" "}
                      de {panelMoney(p.aov_ex_tax, cur, 2)}
                    </span>
                  </div>
                );
              })}
              {gap ? <p className={s.foot} style={{ marginTop: 12 }}>{gap}</p> : null}
            </div>
          </Section>
        ) : null}

        <Section
          id="palancas"
          title="Qué llevar a la llamada"
          lead="Cada palanca sale de un objetivo que tú fijaste. Se añade al orden del día y deja de ser un número suelto."
        >
          <div className={s.two}>
            <Panel title="Dinero sobre la mesa" sub="Beneficio extra al mes si cada métrica llegara a su objetivo">
              {levers.length === 0 ? (
                <p className={s.empty}>
                  Nada que calcular todavía. Las palancas salen de los objetivos de Configuración y solo de tiendas con coste de producto cargado.
                </p>
              ) : (
                <>
                  <ul>
                    {levers.slice(0, 6).map(({ store, lever }) => {
                      const key = `${store.store_id}-${lever.clave}`;
                      const note = `${store.shop_name} · ${lever.palanca}: +${panelMoney(lever.eur_mes, store.currency_code)}/mes (${lever.regla}).`;
                      return (
                        <li key={key} className={s.li}>
                          <div>
                            <b>{store.shop_name} · {lever.palanca}</b>
                            <p>{lever.regla}</p>
                          </div>
                          <div className={s.liR}>
                            <span className={cx(s.big, s.pos)}>+{panelMoney(lever.eur_mes, store.currency_code)}/mes</span>
                            <button
                              type="button"
                              className={cx(s.btn, s.ghost, s.sm)}
                              disabled={!nextCall || adding === key}
                              title={nextCall ? undefined : "Agenda una llamada con este cliente para llevar puntos"}
                              onClick={() => addToCall(note, key)}
                            >
                              {adding === key ? "Añadiendo…" : "Añadir a la llamada"}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className={s.tot}>
                    <span>Todo junto</span>
                    <b className={s.pos}>+{money(client.lever_total)}/mes</b>
                  </div>
                </>
              )}
            </Panel>

            <Panel
              title={nextCall?.scheduled_at ? `Llamada del ${callDay(nextCall.scheduled_at)} · ${clock(nextCall.scheduled_at)}` : "Próxima llamada"}
              sub={nextCall ? "Lo que ya está en el orden del día" : "No hay ninguna llamada agendada con este cliente"}
              aside={nextCall ? <Chip tone="acc">{queued.length} {queued.length === 1 ? "punto" : "puntos"}</Chip> : undefined}
            >
              {nextCall ? (
                queued.length === 0 ? (
                  <p className={s.empty}>Todavía no has añadido ningún punto.</p>
                ) : (
                  <ul>
                    {queued.map((note, index) => (
                      <li key={note.id} className={s.qi}>
                        <span className={s.qn}>{index + 1}</span>
                        <b>{note.body}</b>
                        <Chip>Tuyo</Chip>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}
            </Panel>
          </div>
        </Section>

        <Section
          id="conversacion"
          title="Conversación y acciones"
          lead={`El hilo con ${name} y lo que tienes abierto con este cliente, sin salir de las cifras.`}
        >
          <div className={s.two}>
            <Panel title={`Hilo con ${name}`} sub="El mismo canal que Mensajes: lo que escribes aquí le llega al cliente">
              <ClientThread organizationId={organizationId} name={name} />
            </Panel>
            <Panel title="Acciones abiertas" sub="Tareas internas de este cliente, incluidas las que creas desde las palancas">
              <ClientActions organizationId={organizationId} />
            </Panel>
          </div>
        </Section>

        <Section id="evolucion" title="Cómo evoluciona" lead="Doce meses del cliente y, debajo, de qué tienda sale el beneficio.">
          <div className={s.two}>
            <Panel title="Ingresos y beneficio por mes" sub="Doce meses · la parte verde de cada barra es el beneficio">
              {data.monthly.length === 0 ? (
                <p className={s.empty}>Sin serie mensual.</p>
              ) : (
                <MonthlyChart months={data.monthly} currency={currency} label={`Ingresos y beneficio mensual de ${name}, doce meses`} />
              )}
            </Panel>
            <Panel
              title="De dónde sale el beneficio"
              sub={client.net_profit === null ? undefined : `Reparto de ${money(client.net_profit)} entre sus tiendas`}
            >
              <div className={s.fun}>
                {[...stores]
                  .sort((a, b) => b.net_profit - a.net_profit)
                  .map((store) => (
                    <div key={store.store_id} className={s.funR}>
                      <div className={s.funT}>
                        <span>{store.shop_name}</span>
                        <span className={store.net_profit < 0 ? s.neg : undefined}>
                          {panelMoney(store.net_profit, store.currency_code)}
                          <em>{panelNumber(share(store))} %</em>
                        </span>
                      </div>
                      <div className={s.funB}>
                        <i style={{ width: `${share(store)}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </Panel>
          </div>
        </Section>
      </div>
    </div>
  );
}
