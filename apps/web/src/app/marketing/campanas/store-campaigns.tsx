"use client";

import { useMemo, useState } from "react";
import { buildStoreCampaignsHeadline } from "@e-nora/contracts";
import { formatMoney } from "@/lib/money";
import { audienceSize, UPCOMING, type CampaignRow } from "../campaign-rows";
import { int, pct, ratio, type KWorkspace } from "../klaviyo-workspace";
import { itemDayKey, localDayKey } from "../../planificacion/calendar-days";
import { useCampaignsOverview } from "./campaign-api";
import { CONSULTANT_STATE, cx, dayLabel, dayParts, isMetaChannel, plural, rowToBrief } from "./campaign-format";
import type { CampaignsNav } from "./campanas-nav";
import { Btn, Chip, Counters, Hero, IaTag, Kpis, MonthNav, Panel, Section, Seg, Stage, Who, css as s } from "./campanas-parts";
import { QuickActionsBar } from "./quick-actions";

/**
 * Campañas, nivel 3: una tienda.
 *
 * El calendario y la cola de trabajo de una tienda, con lo creado por el
 * cliente a la vista. Cada campaña con ficha propia se abre a pantalla
 * completa (revisar, corregir con IA, programar); las que solo existen en
 * Klaviyo, en Meta o como plan de la IA conservan su propia entrada.
 */

const DAY_MS = 86_400_000;

const FILTERS: Array<{ key: string; label: string; match: (row: CampaignRow) => boolean }> = [
  { key: "upcoming", label: "Próximas", match: (row) => UPCOMING.includes(row.state) },
  { key: "review", label: "Por revisar", match: (row) => row.state === "plan" || row.state === "review" || awaitsReview(row) },
  { key: "active", label: "Activas en Meta", match: (row) => row.state === "active" },
  { key: "sent", label: "Enviadas", match: (row) => row.state === "sent" },
  { key: "draft", label: "Borradores", match: (row) => row.state === "draft" },
  { key: "all", label: "Todas", match: () => true },
];

const awaitsReview = (row: CampaignRow) => row.item?.origin === "client" && row.item.review_status === "pending";
const dayKeyOf = (row: CampaignRow) => (row.date ? (/^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date : itemDayKey(row.date)) : "");

const SOURCE_LABEL = (row: CampaignRow) =>
  row.source === "proposal"
    ? "PROPUESTA IA"
    : row.source === "klaviyo"
      ? "KLAVIYO"
      : row.source === "meta"
        ? "META"
        : row.source === "both"
          ? `NORA + ${isMetaChannel(row.channel) ? "META" : "KLAVIYO"}`
          : "NORA";

export function StoreCampaigns({
  rows,
  workspace,
  organizationId,
  organizationName,
  connectionId,
  nav,
  onOpenRow,
  onOpenDraft,
  onReviewPlan,
  onOpenMetaCampaign,
  onPropose,
  onCreate,
  onOpenAgenda,
  onChanged,
  onWriteWithAi,
}: {
  rows: CampaignRow[];
  workspace: KWorkspace | undefined;
  organizationId: string;
  organizationName: string;
  connectionId: string;
  nav: CampaignsNav;
  onOpenRow: (row: CampaignRow) => void;
  onOpenDraft: (draftId: string) => void;
  onReviewPlan: () => void;
  onOpenMetaCampaign: (campaignId: string) => void;
  onPropose: () => void;
  onCreate: () => void;
  onOpenAgenda: () => void;
  onChanged: () => void;
  onWriteWithAi: (itemId: string) => void;
}) {
  const overview = useCampaignsOverview(organizationId, connectionId);
  const [filter, setFilter] = useState("upcoming");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const currency = workspace?.account?.currency ?? "EUR";
  const storeLabel = overview.data?.stores?.find((store) => store.connection_id === connectionId)?.label ?? organizationName;
  const active = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0]!;
  const todayKey = localDayKey(new Date(nowMs));

  const own = rows.filter((row) => row.source !== "proposal");
  const headline = buildStoreCampaignsHeadline(storeLabel, own.map(rowToBrief), nowMs);
  const week = own.filter((row) => UPCOMING.includes(row.state) && row.state !== "late" && row.date && Date.parse(row.date) >= nowMs - DAY_MS && Date.parse(row.date) - nowMs <= 7 * DAY_MS);
  const late = own.filter((row) => row.state === "late");
  const fromClient = own.filter(awaitsReview);
  const noPiece = week.filter((row) => row.state === "nopiece" && row.item?.origin !== "client");
  const waitingClient = own.filter((row) => row.state === "review" && row.item?.origin !== "client");
  const plans = rows.filter((row) => row.source === "proposal" || row.state === "plan");
  const scheduled = own.filter((row) => row.state === "scheduled");

  const sent30 = own.filter((row) => row.state === "sent" && row.date && nowMs - Date.parse(row.date) <= 30 * DAY_MS && row.stats?.delivered);
  const delivered = sent30.reduce((sum, row) => sum + (row.stats?.delivered ?? 0), 0);
  const weighted = (pick: (row: CampaignRow) => number) =>
    delivered ? sent30.reduce((sum, row) => sum + pick(row), 0) / delivered : null;
  const openRate = weighted((row) => (row.stats?.opens_unique ?? 0));
  const clickRate = weighted((row) => (row.stats?.clicks_unique ?? 0));
  const revenue = sent30.reduce((sum, row) => sum + (row.stats?.revenue ?? 0), 0);

  const monthDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [visibleMonth]);
  const rowsByDay = useMemo(() => {
    const grouped = new Map<string, CampaignRow[]>();
    for (const row of rows) {
      const key = dayKeyOf(row);
      if (!key) continue;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    return grouped;
  }, [rows]);

  // Abrir: las campañas con ficha propia van a pantalla completa; el resto
  // conserva su entrada (plan de IA, campaña de Meta, borrador suelto, Klaviyo).
  const open = (row: CampaignRow) => {
    if (row.source === "proposal") onReviewPlan();
    else if (row.metaCampaign) onOpenMetaCampaign(row.metaCampaign.campaign_id);
    else if (row.item) nav.campaign(organizationId, row.item.id);
    else if (row.draft && !row.campaign) onOpenDraft(row.draft.id);
    else onOpenRow(row);
  };

  type QueueEntry = { key: string; tone: "bad" | "warn" | "acc"; title: string; text: string; cta: string; row: CampaignRow | null };
  const queue: QueueEntry[] = [
    ...fromClient.map((row) => ({ key: `c-${row.key}`, tone: "acc" as const, title: `Revisa «${row.name}»`, text: `La creó el cliente. Sale el ${dayLabel(row.date)}. Anota, corrige a mano o pídele a la IA que la ajuste.`, cta: "Revisar", row })),
    ...late.map((row) => ({ key: `l-${row.key}`, tone: "bad" as const, title: `«${row.name}» no ha salido`, text: `Estaba prevista el ${dayLabel(row.date)}. Reprogramarla o cancelarla.`, cta: "Resolver", row })),
    ...noPiece.map((row) => ({ key: `n-${row.key}`, tone: "warn" as const, title: `Falta la pieza de «${row.name}»`, text: `Sale el ${dayLabel(row.date)}. Escríbela con IA o pídesela al cliente.`, cta: "Escribir", row })),
    ...waitingClient.map((row) => ({ key: `w-${row.key}`, tone: "warn" as const, title: `«${row.name}» espera al cliente`, text: `Sale el ${dayLabel(row.date)}.`, cta: "Abrir", row })),
    ...plans.map((row) => ({ key: `p-${row.key}`, tone: "acc" as const, title: `A05 propone «${row.name}»`, text: row.initiative ? `Plan de ${row.initiative} pendiente de revisar y aplicar al calendario.` : "Plan pendiente de revisar y aplicar al calendario.", cta: "Revisar el plan", row })),
  ];

  const lead = fromClient[0] ?? late[0] ?? null;
  const selected = selectedKey ? (rows.find((row) => row.key === selectedKey) ?? null) : null;
  const shown = rows.filter(active.match);
  const recent = own
    .filter((row) => row.state === "sent")
    .sort((a, b) => Date.parse(b.date ?? "") - Date.parse(a.date ?? ""))
    .slice(0, 4);
  const sends = overview.data?.last_week_sends ?? [];

  return (
    <Stage>
      
      <Hero
        id="h-tienda"
        meta={["Marketing · Campañas", `${organizationName} · ${storeLabel}`, new Date(nowMs).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })]}
        title={headline.title}
        lines={[headline.detail]}
        actions={
          <>
            {lead ? (
              <button type="button" className={cx(s.btn, s.acc)} onClick={() => open(lead)}>
                {awaitsReview(lead) ? "Revisar" : "Resolver"} «{lead.name}»
              </button>
            ) : (
              <a className={cx(s.btn, s.acc)} href="#cola">
                Ver la cola
              </a>
            )}
            <button type="button" className={cx(s.btn, s.ghost)} onClick={onPropose}>
              <IaTag />
              Planificar con A05
            </button>
            <button type="button" className={cx(s.btn, s.ghost)} onClick={onCreate}>
              Nueva campaña
            </button>
          </>
        }
        side={
          <Counters
            items={[
              { n: fromClient.length, label: "Creadas por el cliente, por revisar", hot: true, onPick: () => setFilter("review") },
              { n: late.length, label: "Van tarde", hot: true, onPick: () => setFilter("upcoming") },
              { n: noPiece.length, label: "Sin pieza y salen en 7 días", onPick: () => setFilter("upcoming") },
              { n: waitingClient.length, label: "Esperan al cliente", onPick: () => setFilter("review") },
              { n: plans.length, label: "Planes IA por revisar", onPick: () => setFilter("review") },
              { n: scheduled.length, label: "Programadas en Klaviyo", onPick: () => setFilter("upcoming") },
            ]}
          />
        }
      />

      <Kpis
        label="Cifras de campañas"
        items={[
          { label: "Salen en 7 días", value: week.length, foot: late.length ? `y ${late.length} más ${plural(late.length, "va tarde", "van tarde")}` : "ninguna va tarde" },
          { label: "Enviadas · 30 días", value: sent30.length, foot: "email, por Klaviyo" },
          { label: "Apertura media", value: openRate === null ? "—" : pct(openRate), foot: "sobre entregados" },
          { label: "Clic medio", value: clickRate === null ? "—" : pct(clickRate), foot: "sobre entregados" },
          { label: "EUR atribuidos por Klaviyo", value: sent30.length ? formatMoney(revenue, currency) : "—", foot: "de toda la vida de cada campaña" },
        ]}
      />

      <QuickActionsBar
        mode="consultant"
        organizationId={organizationId}
        rows={rows}
        storeId={overview.data?.stores?.find((store) => store.connection_id === connectionId)?.store_id ?? null}
        onOpenManager={nav.openQuickActions}
        onChanged={onChanged}
        onWriteWithAi={onWriteWithAi}
      />

      <Section
        id="calendario"
        title="Calendario"
        lead="Planes, piezas y campañas de email y Meta en el mismo sitio. Elige una para ver qué toca hacer con ella."
        action={
          <Btn variant="ghost" size="sm" onClick={onOpenAgenda}>
            Abrir agenda completa
          </Btn>
        }
      >
        <div className={s.two} id="cola">
          <Panel>
            <div className={s.calBar}>
              <Seg
                label="Filtrar campañas"
                value={filter}
                onChange={(key) => {
                  setFilter(key);
                  setSelectedKey(null);
                }}
                options={FILTERS.map((entry) => ({ key: entry.key, label: entry.label, count: rows.filter(entry.match).length }))}
              />
              <MonthNav
                label={visibleMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                onPrev={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                onNext={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                onToday={() => {
                  const now = new Date(nowMs);
                  setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                }}
              />
            </div>
            <div className={s.calScroll}>
              <div className={s.cal} role="region" aria-label={`Calendario de campañas de ${visibleMonth.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}`}>
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                  <div key={day} className={s.wd}>
                    {day}
                  </div>
                ))}
                {monthDays.map((day) => {
                  const key = localDayKey(day);
                  const dayRows = (rowsByDay.get(key) ?? []).filter(active.match);
                  return (
                    <div
                      key={key}
                      role="group"
                      aria-label={`${day.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}, ${dayRows.length} campañas`}
                      className={cx(s.day, day.getMonth() !== visibleMonth.getMonth() && s.out, key === todayKey && s.today)}
                    >
                      <span className={s.dn}>{day.getDate()}</span>
                      {dayRows.slice(0, 3).map((row) => (
                        <button
                          key={row.key}
                          type="button"
                          className={cx(s.ev, s[CONSULTANT_STATE[row.state].dot])}
                          title={`${row.name} · ${CONSULTANT_STATE[row.state].label}`}
                          onClick={() => setSelectedKey(row.key)}
                        >
                          <span>{row.name}</span>
                          <small>
                            {isMetaChannel(row.channel) ? "Meta" : "Email"} · {CONSULTANT_STATE[row.state].label}
                          </small>
                          {awaitsReview(row) ? <span className={s.who}>Creada por el cliente</span> : null}
                        </button>
                      ))}
                      {dayRows.length > 3 ? <span className={s.more}>+{dayRows.length - 3} más</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={s.legend}>
              <span><i className={s.late} />Va tarde</span>
              <span><i className={s.work} />Falta pieza o aprobación</span>
              <span><i className={s.go} />Lista o programada</span>
              <span><i className={s.plan} />Plan IA</span>
              <span><i className={s.meta} />Meta Ads</span>
              <span><i className={s.done} />Enviada o cerrada</span>
            </div>
            <div className={cx(s.banner, s.info)} style={{ marginTop: 14 }}>
              {selected ? (
                <>
                  <span>
                    <strong>{selected.name}</strong> · {CONSULTANT_STATE[selected.state].label} · {selected.date ? dayLabel(selected.date) : "sin fecha"}
                    {selected.audiences.included.length ? ` · ${selected.audiences.included.map((audience) => audience.name).join(", ")}${audienceSize(selected.audiences.included) ? ` · ${int(audienceSize(selected.audiences.included))}` : ""}` : ""}
                  </span>
                  <span className={s.alAct}>
                    <Btn size="sm" onClick={() => open(selected)}>
                      {selected.source === "proposal" ? "Revisar el plan" : selected.item ? "Abrir la campaña" : CONSULTANT_STATE[selected.state].cta}
                    </Btn>
                  </span>
                </>
              ) : (
                <span>Elige una campaña del calendario: aquí verás qué toca hacer con ella.</span>
              )}
            </div>
          </Panel>

          <div style={{ display: "grid", gap: 16 }}>
            <Panel title="Cola del consultor" sub="Lo que se escapa si no lo mueves hoy">
              {queue.length === 0 ? (
                <p className={s.empty}>No se te escapa nada en esta tienda.</p>
              ) : (
                queue.map((entry, index) => (
                  <div key={entry.key} className={s.qi}>
                    <span className={cx(s.qn, s[entry.tone])}>{index + 1}</span>
                    <b>{entry.title}</b>
                    <p>{entry.text}</p>
                    <button type="button" className={cx(s.btn, s.sm, s.ghost)} onClick={() => (entry.row ? open(entry.row) : undefined)}>
                      {entry.cta}
                    </button>
                  </div>
                ))
              )}
            </Panel>
            <Panel title="Lo último que salió" sub="EUR atribuidos por Klaviyo, no son ventas de Shopify">
              {recent.length === 0 ? (
                <p className={s.empty}>Todavía no ha salido ningún email de esta tienda.</p>
              ) : (
                recent.map((row) => {
                  const send = sends.find((entry) => entry.name === row.name);
                  return (
                    <div key={row.key} className={s.qi} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                      <b>{row.name}</b>
                      <b>{row.stats?.revenue ? formatMoney(row.stats.revenue, currency) : "—"}</b>
                      <p style={{ gridColumn: "1 / -1" }}>
                        {dayLabel(row.date)} · apertura {row.stats?.delivered ? pct(ratio(row.stats.opens_unique, row.stats.delivered)) : "—"} · clic{" "}
                        {row.stats?.delivered ? pct(ratio(row.stats.clicks_unique, row.stats.delivered)) : "—"}
                        {send?.top_link ? ` · ${send.top_link.url.replace(/^https?:\/\//, "")}` : ""}
                      </p>
                    </div>
                  );
                })
              )}
            </Panel>
          </div>
        </div>
      </Section>

      <Section
        id="lista"
        title="Todas las campañas"
        lead={`Mostrando ${shown.length} de ${rows.length} · filtro «${active.label}».`}
      >
        <Panel>
          {shown.length === 0 ? (
            <p className={s.empty}>
              {filter === "upcoming"
                ? "No hay nada próximo. Propón un plan con IA o crea una campaña."
                : filter === "review"
                  ? "No hay propuestas ni piezas pendientes de revisión."
                  : filter === "active"
                    ? "No hay campañas activas en Meta para esta tienda."
                    : filter === "draft"
                      ? "No hay borradores de email ni Meta."
                      : "Nada en este filtro."}
            </p>
          ) : (
            <div className={s.tblWrap}>
              <div className={s.gt} role="table" aria-label="Campañas de email y Meta">
                <div className={s.gtH} role="row">
                  <span>Campaña</span>
                  <span>Estado</span>
                  <span>Canal</span>
                  <span>Audiencia</span>
                  <span>Fecha prevista</span>
                  <span>Apertura</span>
                  <span>Clics</span>
                  <span>EUR atrib. Klaviyo</span>
                  <span />
                </div>
                {shown.map((row) => {
                  const state = CONSULTANT_STATE[row.state];
                  const size = audienceSize(row.audiences.included);
                  const parts = dayParts(row.date);
                  return (
                    <div key={row.key} className={s.gtR} role="row">
                      <div>
                        <button type="button" className={s.nm} onClick={() => open(row)}>
                          {row.name}
                        </button>
                        <span className={s.nmSub}>
                          {row.initiative ? `Campaña: ${row.initiative}` : row.subject || (row.state === "plan" ? "Revisar el plan y preparar la pieza" : row.state === "nopiece" ? "Falta escribir la pieza" : "—")}
                        </span>
                      </div>
                      <div className={s.stCell}>
                        <Chip tone={state.tone}>{row.source === "proposal" ? "Plan IA por revisar" : state.label}</Chip>
                        <span className={cx(s.src, row.source === "meta" || isMetaChannel(row.channel) ? s.meta : row.source === "proposal" && s.ia)}>{SOURCE_LABEL(row)}</span>
                        {awaitsReview(row) ? <Who>Creada por el cliente</Who> : null}
                      </div>
                      <div>
                        <Chip tone={isMetaChannel(row.channel) ? "meta" : undefined}>{isMetaChannel(row.channel) ? "Meta Ads" : "Email"}</Chip>
                      </div>
                      <div>
                        {row.audiences.included.length
                          ? `${row.audiences.included.map((audience) => audience.name).join(", ")}${size != null ? ` · ${int(size)}` : ""}`
                          : "—"}
                      </div>
                      <div title={row.date ?? undefined}>{row.date ? `${parts.day} ${parts.mon}` : "Sin fecha"}</div>
                      <div>{row.stats?.delivered ? pct(ratio(row.stats.opens_unique, row.stats.delivered)) : "—"}</div>
                      <div>{row.stats?.delivered ? pct(ratio(row.stats.clicks_unique, row.stats.delivered)) : "—"}</div>
                      <div>{row.stats?.revenue ? formatMoney(row.stats.revenue, currency) : "—"}</div>
                      <div>
                        <button type="button" className={cx(s.btn, s.sm, s.ghost)} onClick={() => open(row)}>
                          {row.item ? "Abrir" : state.cta}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <p className={s.foot} style={{ marginTop: 14 }}>
            Cifras en EUR atribuidos por Klaviyo, de toda la vida de cada campaña. No se suman a Meta ni a las ventas de Shopify.
          </p>
        </Panel>
      </Section>
    </Stage>
  );
}
