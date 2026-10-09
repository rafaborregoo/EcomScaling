"use client";

import { useState } from "react";
import type { CampaignBrief } from "@e-nora/contracts";
import { formatMoney } from "@/lib/money";
import { AsyncState } from "@/components/ui";
import { pct } from "../klaviyo-workspace";
import { useCampaignsOverview, type CampaignsOverview } from "./campaign-api";
import { CONSULTANT_STATE, cx, dayLabel, dayParts, plural } from "./campaign-format";
import type { CampaignsNav } from "./campanas-nav";
import { Chip, Counters, Hero, IaTag, Kpis, Panel, Section, Seg, Stage, Who, css as s } from "./campanas-parts";

/**
 * Campañas, nivel 2: un cliente, sin tienda elegida.
 *
 * Un mini resumen de sus tiendas y de sus campañas: qué sale esta semana en
 * cada una, qué hay que mover en los próximos 14 días y cómo le fue lo último.
 * Cada tienda baja al calendario y la cola de esa tienda.
 */

const DAY_MS = 86_400_000;
const rate = (value: number | null) => (value === null ? "—" : pct(value));

const UPCOMING = ["late", "plan", "nopiece", "review", "ready", "scheduled", "sending"];

type QueueRow = { key: string; tone: "bad" | "warn" | "acc"; title: string; text: string; cta: string; id: string };

function buildQueue(items: CampaignBrief[], nowMs: number): QueueRow[] {
  const inWeek = (item: CampaignBrief) => {
    const time = Date.parse(item.starts_at);
    return time >= nowMs - DAY_MS && time - nowMs <= 7 * DAY_MS;
  };
  const rows: QueueRow[] = [];
  for (const item of items.filter((entry) => entry.origin === "client" && entry.review_status === "pending")) {
    rows.push({ key: `rev-${item.id}`, tone: "acc", title: `Revisa «${item.title}»`, text: `La creó el cliente. Sale el ${dayLabel(item.starts_at)}. Anota, corrige a mano o pídele a la IA que la ajuste.`, cta: "Revisar", id: item.id });
  }
  for (const item of items.filter((entry) => entry.state === "late")) {
    rows.push({ key: `late-${item.id}`, tone: "bad", title: `«${item.title}» no ha salido`, text: `Estaba prevista el ${dayLabel(item.starts_at)}. Reprogramarla o cancelarla.`, cta: "Resolver", id: item.id });
  }
  for (const item of items.filter((entry) => entry.state === "nopiece" && entry.origin !== "client" && inWeek(entry))) {
    rows.push({ key: `np-${item.id}`, tone: "warn", title: `Falta la pieza de «${item.title}»`, text: `Sale el ${dayLabel(item.starts_at)}${item.store_label ? ` en ${item.store_label}` : ""}.`, cta: "Escribir", id: item.id });
  }
  for (const item of items.filter((entry) => entry.state === "review" && entry.origin !== "client")) {
    rows.push({ key: `wait-${item.id}`, tone: "warn", title: `«${item.title}» espera al cliente`, text: `Sale el ${dayLabel(item.starts_at)}.`, cta: "Abrir", id: item.id });
  }
  for (const item of items.filter((entry) => entry.state === "plan")) {
    rows.push({ key: `plan-${item.id}`, tone: "acc", title: `A05 propone «${item.title}»`, text: "Plan pendiente de revisar y aplicar al calendario.", cta: "Revisar el plan", id: item.id });
  }
  return rows;
}

export function ClientCampaigns({
  organizationId,
  organizationName,
  nav,
  onPropose,
  onCreate,
}: {
  organizationId: string;
  organizationName: string;
  nav: CampaignsNav;
  onPropose: () => void;
  onCreate: () => void;
}) {
  const query = useCampaignsOverview(organizationId, null);
  if (query.isLoading && !query.data) {
    return (
      <Stage>
        <AsyncState status="loading" loadingLabel={`Leyendo las campañas de ${organizationName}…`} />
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
  return <Loaded data={query.data} organizationId={organizationId} organizationName={organizationName} nav={nav} onPropose={onPropose} onCreate={onCreate} />;
}

function Loaded({
  data,
  organizationId,
  organizationName,
  nav,
  onPropose,
  onCreate,
}: {
  data: CampaignsOverview;
  organizationId: string;
  organizationName: string;
  nav: CampaignsNav;
  onPropose: () => void;
  onCreate: () => void;
}) {
  const [store, setStore] = useState("all");
  // La hora se fija una vez: «hoy» no cambia mientras se mira la pantalla.
  const [nowMs] = useState(() => Date.now());
  const client = data.clients[0];
  const items = data.items ?? [];
  const stores = data.stores ?? [];
  const currency = data.currency_code ?? "EUR";
  const sends = data.last_week_sends;
  if (!client) return <Stage><AsyncState status="empty" emptyTitle="Este cliente no tiene datos de campañas" /></Stage>;

  const queue = buildQueue(items, nowMs);
  const first = data.reviews[0];
  const storeOf = (item: CampaignBrief) => item.store_label ?? "Todas las tiendas";
  const upcoming = items
    .filter((item) => UPCOMING.includes(item.state) && (item.state === "late" || Date.parse(item.starts_at) - nowMs <= 14 * DAY_MS))
    .filter((item) => store === "all" || item.store_id === store || item.store_id === null)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const count = (state: CampaignBrief["state"]) => items.filter((item) => item.state === state).length;

  return (
    <Stage>
      <Hero
        id="h-cliente"
        meta={[
          "Marketing · Campañas",
          `${organizationName} · ${client.store_count} ${plural(client.store_count, "tienda", "tiendas")}`,
          new Date(nowMs).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }),
        ]}
        title={data.headline.title}
        lines={[data.headline.detail]}
        actions={
          <>
            {first ? (
              <button type="button" className={cx(s.btn, s.acc)} onClick={() => nav.campaign(organizationId, first.item_id)}>
                Revisar «{first.title}»
              </button>
            ) : null}
            <button type="button" className={cx(s.btn, s.ghost)} onClick={onPropose}>
              <IaTag />
              Proponer campañas
            </button>
            <button type="button" className={cx(s.btn, s.ghost)} onClick={onCreate}>
              Nueva campaña
            </button>
          </>
        }
        side={
          <Counters
            items={[
              { n: client.awaiting_review, label: "Creada por el cliente, por revisar", hot: true },
              { n: client.late, label: "Va tarde", hot: true },
              { n: client.no_piece_soon, label: "Sin pieza y sale en 7 días" },
              { n: count("review"), label: "Espera al cliente" },
              { n: client.scheduled, label: "Programada en Klaviyo" },
              { n: client.active_meta, label: "Activa en Meta" },
            ]}
          />
        }
      />

      <Kpis
        label={`Cifras de campañas de ${organizationName}`}
        items={[
          { label: "Envíos esta semana", value: client.week.length, foot: stores.map((entry) => `${entry.label} ${entry.week.length}`).join(" · ") || "—" },
          { label: "Enviados la semana pasada", value: client.last_week.sent, foot: "emails de los últimos 7 días" },
          { label: "Apertura media", value: rate(client.last_week.open_rate), foot: `de ${client.last_week.sent} ${plural(client.last_week.sent, "envío", "envíos")}` },
          { label: "Clic medio", value: rate(client.last_week.click_rate), foot: `de ${client.last_week.sent} ${plural(client.last_week.sent, "envío", "envíos")}` },
          {
            label: "EUR atribuidos por Klaviyo",
            value: client.last_week.revenue === null ? "—" : formatMoney(client.last_week.revenue, currency),
            foot: stores.length > 1 ? `una cuenta de Klaviyo para las ${stores.length} tiendas` : "de esos envíos",
          },
        ]}
      />

      <Section id="tiendas" title="Tus tiendas" lead="Resumen por tienda de este cliente. Abre una para ver su calendario y sus campañas.">
        <Panel>
          {stores.length === 0 ? (
            <p className={s.empty}>Este cliente no tiene tiendas activas.</p>
          ) : (
            <div className={s.tblWrap}>
              <div className={cx(s.rt, s.stores)} role="table" aria-label={`Tiendas de ${organizationName}`}>
                <div className={s.rtH} role="row">
                  <span>Tienda</span>
                  <span>Envía esta semana</span>
                  <span>Atención</span>
                  <span>Semana pasada</span>
                  <span />
                </div>
                {stores.map((entry) => (
                  <div key={entry.store_id} className={s.rtR} role="row">
                    <div>
                      <button type="button" className={cx(s.rtN, s.linkBtn)} onClick={() => nav.store(organizationId, entry.connection_id)}>
                        {entry.label}
                      </button>
                    </div>
                    <ul className={s.mini}>
                      {entry.week.slice(0, 3).map((item) => (
                        <li key={item.id}>
                          <span className={cx(s.dot, s[CONSULTANT_STATE[item.state].dot])} />
                          <b>{dayLabel(item.starts_at)}</b>
                          <span>{item.title}</span>
                          {item.origin === "client" ? <Who cli>Creada por el cliente</Who> : null}
                        </li>
                      ))}
                      {entry.week.length > 3 ? <li className={s.mut}>+{entry.week.length - 3} más</li> : null}
                      {entry.week.length === 0 ? <li className={s.mut}>Nada planificado en 7 días</li> : null}
                    </ul>
                    <div className={s.stCell}>
                      {entry.awaiting_review ? <Chip tone="acc">{entry.awaiting_review} {plural(entry.awaiting_review, "creada por el cliente", "creadas por el cliente")}</Chip> : null}
                      {entry.late ? <Chip tone="bad">{entry.late} {plural(entry.late, "va tarde", "van tarde")}</Chip> : null}
                      {entry.week.length === 0 ? <Chip tone="warn">Sin envíos esta semana</Chip> : null}
                      {!entry.awaiting_review && !entry.late && entry.week.length > 0 ? <Chip tone="good">Al día</Chip> : null}
                    </div>
                    <div className={s.res2}>
                      <span>{entry.last_week.sent ? `${entry.last_week.sent} ${plural(entry.last_week.sent, "enviado", "enviados")}` : "Nada enviado"}</span>
                      <span className={s.mut}>{entry.last_week.sent ? `Apertura ${rate(entry.last_week.open_rate)} · clic ${rate(entry.last_week.click_rate)}` : "—"}</span>
                      <b>{entry.last_week.revenue === null ? "—" : formatMoney(entry.last_week.revenue, currency)}</b>
                    </div>
                    <div>
                      <button type="button" className={cx(s.btn, s.sm, s.ghost)} onClick={() => nav.store(organizationId, entry.connection_id)}>
                        Abrir tienda
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </Section>

      <Section
        id="mover"
        title="Qué hay que mover"
        lead="Los próximos 14 días de todas las tiendas, y lo que se te escapa si no lo tocas hoy."
        action={
          stores.length > 1 ? (
            <Seg
              label="Filtrar por tienda"
              value={store}
              onChange={setStore}
              options={[
                { key: "all", label: "Todas", count: items.filter((item) => UPCOMING.includes(item.state)).length },
                ...stores.map((entry) => ({
                  key: entry.store_id,
                  label: entry.label.replace(/^https?:\/\//, "").replace(/\.myshopify\.com$/, ""),
                  count: items.filter((item) => UPCOMING.includes(item.state) && item.store_id === entry.store_id).length,
                })),
              ]}
            />
          ) : undefined
        }
      >
        <div className={s.two}>
          <Panel title="Próximos 14 días" sub="Lo que sale y lo que va tarde">
            {upcoming.length === 0 ? (
              <p className={s.empty}>Nada en este filtro.</p>
            ) : (
              <div className={s.tl}>
                {upcoming.map((item) => {
                  const parts = dayParts(item.starts_at);
                  const state = CONSULTANT_STATE[item.state];
                  return (
                    <div key={item.id} className={s.tlR}>
                      <div className={s.tlD}>
                        <b>{parts.day}</b>
                        <small>{parts.mon}</small>
                      </div>
                      <div>
                        <button type="button" className={s.linkBtn} onClick={() => nav.campaign(organizationId, item.id)}>
                          <b>{item.title}</b>
                        </button>
                        <p>{item.origin === "client" ? "Creada por el cliente" : item.origin === "ai" ? "Propuesta de A05" : state.label}</p>
                      </div>
                      <span className={s.stCell} style={{ justifyContent: "flex-end" }}>
                        <Chip tone={state.tone}>{state.label}</Chip>
                        <span className={s.src}>{storeOf(item)}</span>
                        {item.origin === "client" ? <Who cli>Cliente</Who> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
          <div style={{ display: "grid", gap: 16 }}>
            <Panel title="Cola del consultor" sub="Por orden de urgencia">
              {queue.length === 0 ? (
                <p className={s.empty}>No se te escapa nada.</p>
              ) : (
                queue.map((row, index) => (
                  <div key={row.key} className={s.qi}>
                    <span className={cx(s.qn, s[row.tone])}>{index + 1}</span>
                    <b>{row.title}</b>
                    <p>{row.text}</p>
                    <button type="button" className={cx(s.btn, s.sm, s.ghost)} onClick={() => nav.campaign(organizationId, row.id)}>
                      {row.cta}
                    </button>
                  </div>
                ))
              )}
            </Panel>
            <Panel title="Lo último que salió" sub="EUR atribuidos por Klaviyo, no son ventas de Shopify">
              {sends.length === 0 ? (
                <p className={s.empty}>La semana pasada no salió ningún email.</p>
              ) : (
                sends.slice(0, 5).map((send) => (
                  <div key={send.campaign_id} className={s.qi} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                    <b>{send.name}</b>
                    <b>{send.revenue === null ? "—" : formatMoney(send.revenue, send.currency_code ?? currency)}</b>
                    <p style={{ gridColumn: "1 / -1" }}>
                      {dayLabel(send.sent_at)} · apertura {rate(send.open_rate)} · clic {rate(send.click_rate)}
                      {send.top_link ? ` · ${send.top_link.url.replace(/^https?:\/\//, "")}` : ""}
                    </p>
                  </div>
                ))
              )}
            </Panel>
          </div>
        </div>
      </Section>
    </Stage>
  );
}
