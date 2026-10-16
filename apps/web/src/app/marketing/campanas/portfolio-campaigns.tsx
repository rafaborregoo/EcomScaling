"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { AsyncState, EmptyState } from "@/components/ui";
import { pct } from "../klaviyo-workspace";
import { useCampaignsOverview, type CampaignsOverview, type SentCampaign } from "./campaign-api";
import { agoLabel, CONSULTANT_STATE, cx, dayLabel, plural } from "./campaign-format";
import type { CampaignsNav } from "./campanas-nav";
import { Chip, Counters, Hero, Kpis, Panel, Section, Seg, Stage, Who, css as s } from "./campanas-parts";

/**
 * Campañas, nivel 1: la cartera del consultor.
 *
 * Responde a «¿qué envía cada cliente esta semana, qué se me escapa y cómo le
 * fue la semana pasada?» antes de abrir a ningún cliente. Cada fila baja al
 * cliente; lo que crean los clientes llega aquí para que el consultor lo revise.
 */

type Filter = "all" | "review" | "late" | "empty";

const rate = (value: number | null) => (value === null ? "—" : pct(value));
const topLink = (send: SentCampaign) =>
  send.top_link ? `${send.top_link.url.replace(/^https?:\/\//, "")} · ${send.top_link.clicks.toLocaleString("es-ES")} clics` : "—";

/** El cliente que peor abrió la semana pasada, si hay con quién compararlo. */
function weakestOpener(sends: SentCampaign[]) {
  const byClient = new Map<string, { name: string; sum: number; n: number }>();
  for (const send of sends) {
    if (send.open_rate === null) continue;
    const entry = byClient.get(send.organization_id) ?? { name: send.organization_name, sum: 0, n: 0 };
    entry.sum += send.open_rate;
    entry.n += 1;
    byClient.set(send.organization_id, entry);
  }
  const rows = [...byClient.values()].map((entry) => ({ name: entry.name, rate: entry.sum / entry.n }));
  if (rows.length < 2) return null;
  return rows.sort((a, b) => a.rate - b.rate)[0] ?? null;
}

export function PortfolioCampaigns({ nav }: { nav: CampaignsNav }) {
  const query = useCampaignsOverview(null, null);
  const [filter, setFilter] = useState<Filter>("all");

  if (query.isLoading && !query.data) {
    return (
      <Stage>
        <AsyncState status="loading" loadingLabel="Leyendo las campañas de tu cartera…" />
      </Stage>
    );
  }
  if (query.error || !query.data) {
    return (
      <Stage>
        <AsyncState status="error" error={query.error} />
      </Stage>
    );
  }
  return <Loaded data={query.data} nav={nav} filter={filter} onFilter={setFilter} />;
}

function Loaded({
  data,
  nav,
  filter,
  onFilter,
}: {
  data: CampaignsOverview;
  nav: CampaignsNav;
  filter: Filter;
  onFilter: (filter: Filter) => void;
}) {
  const { totals, clients, reviews, last_week_sends: sends } = data;
  const currency = data.currency_code ?? "EUR";
  if (clients.length === 0) {
    return (
      <Stage>
        <EmptyState title="Todavía no tienes clientes asignados" hint="Cuando te asignen clientes, aquí verás lo que envía cada uno." />
      </Stage>
    );
  }

  const currencyOf = (organizationId: string) =>
    sends.find((send) => send.organization_id === organizationId)?.currency_code ?? currency;

  const flagsOf = (client: (typeof clients)[number]) => {
    const flags: Array<{ text: string; tone: "acc" | "warn" | "bad"; key: Filter }> = [];
    if (client.awaiting_review) flags.push({ text: `${client.awaiting_review} ${plural(client.awaiting_review, "creada por el cliente", "creadas por el cliente")}`, tone: "acc", key: "review" });
    if (client.changes_requested) flags.push({ text: "Cambios pedidos al cliente", tone: "warn", key: "review" });
    if (client.late) flags.push({ text: `${client.late} ${plural(client.late, "va tarde", "van tarde")}`, tone: "bad", key: "late" });
    if (client.week.length === 0) flags.push({ text: "Sin envíos esta semana", tone: "warn", key: "empty" });
    return flags;
  };
  const matches: Record<Filter, (client: (typeof clients)[number]) => boolean> = {
    all: () => true,
    review: (client) => client.awaiting_review + client.changes_requested > 0,
    late: (client) => client.late > 0,
    empty: (client) => client.week.length === 0,
  };
  const shown = clients.filter(matches[filter]);
  const first = reviews[0];
  const weak = weakestOpener(sends);

  return (
    <Stage>
      <Hero
        id="h-cartera"
        meta={[
          "Marketing · Campañas",
          `Tu cartera · ${totals.clients} ${plural(totals.clients, "cliente", "clientes")}`,
          new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }),
        ]}
        title={data.headline.title}
        lines={[
          data.headline.detail,
          weak ? `${weak.name} es el cliente que peor abrió la semana pasada (${pct(weak.rate)}).` : null,
        ].filter(Boolean)}
        actions={
          <>
            {first ? (
              <button type="button" className={cx(s.btn, s.acc)} onClick={() => nav.campaign(first.organization_id, first.item_id)}>
                Revisar «{first.title}»
              </button>
            ) : null}
            <a className={cx(s.btn, s.ghost)} href="#revisar">
              Ver lo que han creado los clientes
            </a>
          </>
        }
        side={
          <Counters
            items={[
              { n: totals.awaiting_review, label: "Creadas por clientes, por revisar", hot: true, onPick: () => onFilter("review") },
              { n: totals.late, label: "Campañas que van tarde", hot: true, onPick: () => onFilter("late") },
              { n: totals.no_piece_soon, label: "Sin pieza y salen en 7 días", onPick: () => onFilter("all") },
              { n: totals.changes_requested, label: "Esperan cambios del cliente", onPick: () => onFilter("review") },
              { n: totals.clients_without_sends.length, label: "Clientes sin envíos esta semana", onPick: () => onFilter("empty") },
              { n: totals.active_meta, label: "Campañas activas en Meta", onPick: () => onFilter("all") },
            ]}
          />
        }
      />

      <Kpis
        label="Cifras de campañas de la cartera"
        items={[
          { label: "Envíos esta semana", value: totals.week_items, foot: `en ${totals.clients_with_sends} de ${totals.clients} ${plural(totals.clients, "cliente", "clientes")}` },
          { label: "Enviados la semana pasada", value: totals.last_week.sent, foot: "emails de los últimos 7 días" },
          { label: "Apertura media", value: rate(totals.last_week.open_rate), foot: "ponderada por envíos" },
          { label: "Clic medio", value: rate(totals.last_week.click_rate), foot: "ponderado por envíos" },
          {
            label: "Ingresos atribuidos por Klaviyo",
            value: totals.last_week.revenue === null ? "—" : formatMoney(totals.last_week.revenue, currency),
            foot: "de esos envíos, sin sumar Meta",
          },
        ]}
      />

      <Section
        id="semana"
        title="Esta semana"
        lead="Qué envía cada cliente en los próximos 7 días, qué le pasa y cómo le fue la semana pasada."
        action={
          <Seg
            label="Filtrar clientes"
            value={filter}
            onChange={onFilter}
            options={[
              { key: "all", label: "Todos", count: clients.length },
              { key: "review", label: "Por revisar", count: clients.filter(matches.review).length },
              { key: "late", label: "Van tarde", count: clients.filter(matches.late).length },
              { key: "empty", label: "Sin envíos", count: clients.filter(matches.empty).length },
            ]}
          />
        }
      >
        <Panel>
          <div className={s.tblWrap}>
            <div className={s.rt} role="table" aria-label="Campañas por cliente">
              <div className={s.rtH} role="row">
                <span>Cliente</span>
                <span>Envía esta semana</span>
                <span>Atención</span>
                <span>Semana pasada</span>
                <span />
              </div>
              {shown.map((client) => {
                const flags = flagsOf(client).filter((flag) => flag.key !== "empty" || client.week.length === 0);
                const last = client.last_week;
                return (
                  <div key={client.organization_id} className={s.rtR} role="row">
                    <div>
                      <button type="button" className={cx(s.rtN, s.linkBtn)} onClick={() => nav.client(client.organization_id)}>
                        {client.organization_name}
                      </button>
                      <span className={s.rtS}>
                        {client.store_count} {plural(client.store_count, "tienda", "tiendas")}
                      </span>
                    </div>
                    <ul className={s.mini}>
                      {client.week.slice(0, 3).map((item) => (
                        <li key={item.id}>
                          <span className={cx(s.dot, s[CONSULTANT_STATE[item.state].dot])} />
                          <b>{dayLabel(item.starts_at)}</b>
                          <span>{item.title}</span>
                          {item.origin === "client" ? <Who cli>Creada por el cliente</Who> : null}
                        </li>
                      ))}
                      {client.week.length > 3 ? <li className={s.mut}>+{client.week.length - 3} más</li> : null}
                      {client.week.length === 0 ? <li className={s.mut}>Nada planificado en 7 días</li> : null}
                    </ul>
                    <div className={s.stCell}>
                      {flags.length === 0 ? <Chip tone="good">Al día</Chip> : flags.map((flag) => <Chip key={flag.text} tone={flag.tone}>{flag.text}</Chip>)}
                    </div>
                    <div className={s.res2}>
                      <span>{last.sent ? `${last.sent} ${plural(last.sent, "enviado", "enviados")}` : "Nada enviado"}</span>
                      <span className={s.mut}>{last.sent ? `Apertura ${rate(last.open_rate)} · clic ${rate(last.click_rate)}` : "—"}</span>
                      <b>{last.revenue === null ? "—" : formatMoney(last.revenue, currencyOf(client.organization_id))}</b>
                    </div>
                    <div>
                      <button type="button" className={cx(s.btn, s.sm, s.ghost)} onClick={() => nav.client(client.organization_id)}>
                        Abrir cliente
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {shown.length === 0 ? <p className={s.empty}>Ningún cliente en este filtro.</p> : null}
        </Panel>
      </Section>

      <Section
        id="revisar"
        title="Creadas por tus clientes"
        lead="Un cliente puede crear su propia campaña aunque tenga consultor. Aquí llegan para que las revises, las anotes y las corrijas, a mano o con IA."
      >
        <Panel>
          {reviews.length === 0 ? (
            <p className={s.empty}>Ningún cliente ha creado campañas pendientes de revisar.</p>
          ) : (
            <div>
              {reviews.map((review, index) => (
                <div key={review.item_id} className={s.qi}>
                  <span className={cx(s.qn, review.review_status === "pending" ? s.acc : s.warn)}>{index + 1}</span>
                  <b>
                    {review.organization_name} creó «{review.title}»
                  </b>
                  <p>
                    {review.channel} · sale {dayLabel(review.starts_at)} · {review.review_status === "pending" ? `creada ${agoLabel(review.review_requested_at)}` : "esperando los cambios del cliente"}
                    {review.open_corrections ? ` · ${review.open_corrections} ${plural(review.open_corrections, "corrección abierta", "correcciones abiertas")}` : ""}
                  </p>
                  <button
                    type="button"
                    className={cx(s.btn, s.sm, review.review_status === "changes_requested" && s.ghost)}
                    onClick={() => nav.campaign(review.organization_id, review.item_id)}
                  >
                    {review.review_status === "pending" ? "Revisar" : "Ver el hilo"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </Section>

      <Section id="pasada" title="La semana pasada" lead="Qué salió, cómo respondió la gente y adónde hizo clic.">
        <Panel>
          {sends.length === 0 ? (
            <p className={s.empty}>La semana pasada no salió ningún email de tus clientes.</p>
          ) : (
            <div className={s.tblWrap}>
              <div className={s.gt} style={{ minWidth: 980 }} role="table" aria-label="Envíos de la semana pasada">
                <div className={s.gtH} role="row" style={{ gridTemplateColumns: "90px minmax(260px,1.6fr) 90px 90px 140px minmax(200px,1fr)" }}>
                  <span>Salió</span>
                  <span>Cliente · campaña</span>
                  <span>Apertura</span>
                  <span>Clics</span>
                  <span>Ingresos atrib. Klaviyo</span>
                  <span>Enlace más clicado</span>
                </div>
                {sends.map((send) => (
                  <div key={send.campaign_id} className={s.gtR} role="row" style={{ gridTemplateColumns: "90px minmax(260px,1.6fr) 90px 90px 140px minmax(200px,1fr)" }}>
                    <div>{dayLabel(send.sent_at)}</div>
                    <div>
                      <b>{send.name}</b>
                      <span className={s.nmSub}>{send.organization_name}</span>
                    </div>
                    <div>{rate(send.open_rate)}</div>
                    <div>{rate(send.click_rate)}</div>
                    <div>
                      <b>{send.revenue === null ? "—" : formatMoney(send.revenue, send.currency_code ?? currency)}</b>
                    </div>
                    <div className={s.mut}>{topLink(send)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className={s.foot} style={{ marginTop: 14 }}>
            Ingresos atribuidos por Klaviyo durante toda la vida de cada campaña, en la moneda indicada. No se suman a Meta ni a las ventas de Shopify.
            {data.truncated ? " La cartera es muy grande: se muestran los primeros clientes." : ""}
          </p>
        </Panel>
      </Section>
    </Stage>
  );
}
