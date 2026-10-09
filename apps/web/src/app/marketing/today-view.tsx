"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { HeroBlock, StatusStrip, heroPrimary } from "@/components/trabajo-ui";
import { Button, ButtonLink, Card } from "@/components/ui";
import { audienceSize, STATE_LABEL, UPCOMING, type CampaignPlanSummary, type CampaignRow } from "./campaign-rows";
import { flowKind, flowStatus, int, KEY_FLOWS, pct, ratio, type KWorkspace } from "./klaviyo-workspace";
import { fmtSchedule } from "./format";
import s from "./marketing-views.module.css";

type ContextEvent = { id: string; event_type: string; description: string; occurred_at: string; ended_at: string | null };
const DAY_MS = 86_400_000;

// Estado en la celda del día: corto, porque la columna es estrecha. El borde
// discontinuo ya dice "creada en Klaviyo".
const SHORT_STATE: Record<CampaignRow["state"], string> = {
  late: "Va tarde",
  plan: "Plan IA · revisar",
  nopiece: "Sin pieza",
  review: "En revisión",
  ready: "Lista",
  scheduled: "Programada",
  sending: "Enviándose",
  active: "Activa en Meta",
  paused: "En pausa",
  sent: "Enviada",
  draft: "Borrador",
  cancelled: "Cancelada",
};

function startOfDay(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sameDay(iso: string, day: Date) {
  return startOfDay(new Date(iso)).getTime() === day.getTime();
}

function hour(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/** Marketing -> Hoy: qué mandar hoy, qué viene y qué se escapa. */
export function TodayView({
  organizationId,
  campaignPlan,
  rows,
  items,
  drafts,
  workspace,
  onOpenRow,
  onWritePiece,
  onOpenDraft,
  onPropose,
  onPrepareMailing,
  onGoTo,
}: {
  organizationId: string;
  campaignPlan: CampaignPlanSummary | null;
  rows: CampaignRow[];
  items: CampaignItem[];
  drafts: MarketingDraft[];
  workspace: KWorkspace | undefined;
  onOpenRow: (row: CampaignRow) => void;
  onWritePiece: (item: CampaignItem) => void;
  onOpenDraft: (draftId: string) => void;
  onPropose: () => void;
  onPrepareMailing: () => void;
  onGoTo: (section: "flows" | "campanas" | "rendimiento") => void;
}) {
  const [now] = useState(() => Date.now());
  const today = startOfDay(new Date(now));
  const context = useCachedQuery<{ events: ContextEvent[] }>(organizationId ? `/v1/organizations/${organizationId}/context` : null);
  const currency = workspace?.account?.currency ?? "EUR";
  const connected = Boolean(workspace?.connected);

  const upcoming = rows.filter((row) => UPCOMING.includes(row.state));
  const late = rows.filter((row) => row.state === "late");
  const soon = (row: CampaignRow) => row.date && Date.parse(row.date) - now < 7 * DAY_MS;
  const noPiece = rows.filter((row) => row.state === "nopiece" && soon(row));
  const pending = drafts.filter((draft) => draft.status === "pending_approval");
  const flows = workspace?.flows ?? [];
  const stoppedFlows = flows.filter((flow) => flowKind(flow) && flowStatus(flow.status).key !== "live");

  // ---- Lo de hoy ----
  const readyToday = upcoming.find((row) => row.state === "ready" && row.date && sameDay(row.date, today));
  const scheduledToday = upcoming.find((row) => (row.state === "scheduled" || row.state === "sending") && row.date && sameDay(row.date, today));
  let hero: { label: string; title: string; meta: ReactNode; action: ReactNode };
  const metaOf = (row: CampaignRow) => {
    const size = audienceSize(row.audiences.included);
    return (
      <span className={s.row} style={{ gap: "6px 16px" }}>
        {row.audiences.included.length ? (
          <span>
            Audiencia: {row.audiences.included.map((audience) => audience.name).join(", ")}
            {size != null ? ` · ${int(size)} perfiles` : ""}
          </span>
        ) : null}
        {row.date ? <span>Hora: {hour(row.date)}</span> : null}
        <span>{STATE_LABEL[row.state].label}</span>
      </span>
    );
  };
  if (readyToday) {
    hero = {
      label: "Hoy",
      title: `Envía «${readyToday.name}»`,
      meta: metaOf(readyToday),
      action: (
        <button type="button" className={heroPrimary} onClick={() => onOpenRow(readyToday)}>
          {connected ? "Revisar y programar" : "Revisar y copiar"}
        </button>
      ),
    };
  } else if (scheduledToday) {
    hero = {
      label: "Hoy",
      title: `Hoy sale «${scheduledToday.name}» a las ${hour(scheduledToday.date!)}`,
      meta: metaOf(scheduledToday),
      action: (
        <button type="button" onClick={() => onOpenRow(scheduledToday)}>
          Ver la campaña
        </button>
      ),
    };
  } else if (late[0]) {
    hero = {
      label: "Va tarde",
      title: `«${late[0].name}» no ha salido`,
      meta: <span>Estaba prevista {late[0].date ? `el ${fmtSchedule(late[0].date)}` : "sin fecha"}.</span>,
      action: (
        <button type="button" className={heroPrimary} onClick={() => onOpenRow(late[0]!)}>
          Resolver
        </button>
      ),
    };
  } else if (noPiece[0]?.item) {
    hero = {
      label: "Esta semana",
      title: `Escribe la pieza de «${noPiece[0].name}»`,
      meta: <span>Sale {noPiece[0].date ? fmtSchedule(noPiece[0].date) : "pronto"}.</span>,
      action: (
        <button type="button" className={heroPrimary} onClick={() => onWritePiece(noPiece[0]!.item!)}>
          Escribir la pieza
        </button>
      ),
    };
  } else if (pending[0]) {
    hero = {
      label: "Espera tu decisión",
      title: `${pending.length} pieza${pending.length === 1 ? "" : "s"} esperando aprobación`,
      meta: <span>«{pending[0].template_name || pending[0].subject}»{pending.length > 1 ? " y otras" : ""}.</span>,
      action: (
        <button type="button" className={heroPrimary} onClick={() => onOpenDraft(pending[0]!.id)}>
          Revisar
        </button>
      ),
    };
  } else {
    hero = {
      label: "Al día",
      title: "No hay nada pendiente para hoy",
      meta: <span>Buen momento para preparar lo siguiente.</span>,
      action: (
        <>
          <button type="button" className={heroPrimary} onClick={onPropose}>
            Ir a Campañas
          </button>
          <button type="button" onClick={onPrepareMailing}>
            Crear secuencia de emails
          </button>
        </>
      ),
    };
  }

  // ---- Cifras ----
  const next = upcoming
    .filter((row) => row.state !== "late" && row.date && Date.parse(row.date) >= now)
    .sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!))[0];
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
  const weekEnd = week[6]!.getTime() + DAY_MS;
  const inWeek = (iso: string | null) => Boolean(iso) && Date.parse(iso!) >= monday.getTime() && Date.parse(iso!) < weekEnd;
  const weekPlanned = rows.filter((row) => row.source !== "klaviyo" && UPCOMING.includes(row.state) && inWeek(row.date));
  const weekWithPiece = weekPlanned.filter((row) => row.state !== "nopiece").length;
  const daily = workspace?.daily ?? [];
  const last7 = daily.slice(-7).reduce((sum, point) => sum + point.flow + point.campaign, 0);
  const prev7 = daily.length >= 14 ? daily.slice(-14, -7).reduce((sum, point) => sum + point.flow + point.campaign, 0) : null;
  const live = flows.filter((flow) => flowStatus(flow.status).key === "live").length;

  // ---- Atención ----
  const attention: Array<{ key: string; tone: "bad" | "warn" | "info"; title: string; text: string; action: ReactNode }> = [
    ...late.map((row) => ({
      key: `late-${row.key}`,
      tone: "bad" as const,
      title: `«${row.name}» nunca salió`,
      text: row.date ? `Planificada para ${fmtSchedule(row.date)}` : "Sin fecha",
      action: <Button size="sm" variant="secondary" onClick={() => onOpenRow(row)}>Resolver</Button>,
    })),
    ...noPiece.map((row) => ({
      key: `np-${row.key}`,
      tone: "warn" as const,
      title: `«${row.name}» no tiene pieza`,
      text: row.date ? `Sale ${fmtSchedule(row.date)}` : "Sin fecha",
      action: row.item ? <Button size="sm" onClick={() => onWritePiece(row.item!)}>Escribir</Button> : null,
    })),
    ...pending.map((draft) => ({
      key: `pd-${draft.id}`,
      tone: "warn" as const,
      title: `«${draft.template_name || draft.subject}» espera aprobación`,
      text: "Pieza en revisión",
      action: <Button size="sm" variant="secondary" onClick={() => onOpenDraft(draft.id)}>Revisar</Button>,
    })),
    ...stoppedFlows.map((flow) => ({
      key: `fl-${flow.id}`,
      tone: "warn" as const,
      title: `${KEY_FLOWS.find((kind) => kind.key === flowKind(flow))?.label ?? flow.name}: ${flowStatus(flow.status).label.toLowerCase()}`,
      text: `«${flow.name}» no está enviando`,
      action: <Button size="sm" variant="secondary" onClick={() => onGoTo("flows")}>Ver flow</Button>,
    })),
  ];

  const sent = rows
    .filter((row) => row.state === "sent" && row.stats)
    .sort((a, b) => Date.parse(b.date ?? "") - Date.parse(a.date ?? ""))
    .slice(0, 3);
  const ideas = (campaignPlan?.content?.calendar_actions ?? campaignPlan?.content?.campaigns ?? [])
    .filter((action) => action.scheduled_date >= new Date(now).toISOString().slice(0, 10))
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 3);
  const contextEvents = context.data?.events ?? [];

  return (
    <div className={s.root}>
      <HeroBlock label={hero.label} title={hero.title} actions={hero.action}>
        {hero.meta}
      </HeroBlock>

      <StatusStrip
        items={[
          {
            value: next?.date ? fmtSchedule(next.date) : "—",
            label: "Próximo envío",
            hint: next?.name,
            text: true,
          },
          {
            value: weekPlanned.length ? `${weekWithPiece} / ${weekPlanned.length}` : "—",
            label: "Esta semana con pieza",
            tone: weekWithPiece < weekPlanned.length ? "warn" : undefined,
          },
          ...(connected
            ? [
                {
                  value: formatMoney(last7, currency),
                  label: "EUR atribuidos por Klaviyo · 7 d",
                  hint: prev7 ? `${last7 >= prev7 ? "+" : "−"}${Math.abs(Math.round((last7 / prev7 - 1) * 100))} % frente a la semana anterior` : undefined,
                  tone: last7 > 0 ? ("good" as const) : undefined,
                },
                {
                  value: `${live} / ${flows.length}`,
                  label: "Flows activos",
                  hint: stoppedFlows[0] ? `${stoppedFlows[0].name} parado` : undefined,
                  tone: stoppedFlows.length ? ("warn" as const) : undefined,
                },
              ]
            : []),
          { value: late.length, label: "Va tarde", tone: late.length ? "bad" : undefined },
        ]}
      />

      <Card
        title="Esta semana"
        actions={<span className={s.muted}>{`${week[0]!.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} – ${week[6]!.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`}</span>}
      >
        <div className="grid gap-3">
          <div className={s.weekBox}>
            <div className={s.week}>
              {week.map((day) => {
                const isToday = day.getTime() === today.getTime();
                const dayRows = rows.filter((row) => row.date && sameDay(row.date, day));
                const otherItems = items.filter(
                  (item) => item.status !== "cancelled" && !/email|klaviyo/i.test(item.channel) && sameDay(item.starts_at, day),
                );
                const dayContext = contextEvents.filter((event) => {
                  const start = startOfDay(new Date(event.occurred_at)).getTime();
                  const end = event.ended_at ? startOfDay(new Date(event.ended_at)).getTime() : start;
                  return day.getTime() >= start && day.getTime() <= end;
                });
                return (
                  <div key={day.toISOString()} className={s.day} data-today={isToday ? "" : undefined}>
                    <span className={s.dayHead}>
                      <span>
                        {day.toLocaleDateString("es-ES", { weekday: "short" })}
                        {isToday ? " · hoy" : ""}
                      </span>
                      <span>{day.getDate()}</span>
                    </span>
                    {dayRows.map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        className={s.ev}
                        data-kind={row.source === "klaviyo" ? "klaviyo" : "email"}
                        onClick={() => onOpenRow(row)}
                      >
                        {row.name}
                        <small>{SHORT_STATE[row.state]}</small>
                      </button>
                    ))}
                    {otherItems.map((item) => (
                      <div key={item.id} className={s.ev} data-kind={/meta/i.test(item.channel) ? "meta" : "other"}>
                        {item.title}
                        <small>{/meta/i.test(item.channel) ? "Meta" : item.channel}</small>
                      </div>
                    ))}
                    {dayContext.map((event) => (
                      <div key={event.id} className={s.ev} data-kind="context">
                        {event.description}
                        <small>Mi negocio</small>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className={s.legend}>
            <span>
              <i className={s.swatch} style={{ background: "var(--mk-email)" }} />
              Email
            </span>
            <span>
              <i className={s.swatch} style={{ background: "var(--mk-meta)" }} />
              Meta
            </span>
            <span>
              <i className={s.swatch} style={{ background: "var(--mk-accent)" }} />
              Mi negocio
            </span>
            {connected ? (
              <span>
                <i className={s.swatch} style={{ border: "1px dashed var(--mk-email)" }} />
                Creada en Klaviyo
              </span>
            ) : null}
          </div>
        </div>
      </Card>

      <div className={s.two}>
        <div className={s.col}>
          <Card
            title="Próximas acciones del plan"
            actions={
              campaignPlan ? (
                <span className={s.muted}>Propuesta del {new Date(campaignPlan.generated_at ?? now).toLocaleDateString("es-ES")}</span>
              ) : undefined
            }
          >
            {ideas.length ? (
              <div className="grid gap-2">
                {ideas.map((idea) => (
                  <div key={idea.title} className={s.idea}>
                    <b>{idea.title}</b>
                    <p>{idea.objective}</p>
                    <p className={s.muted}>{fmtSchedule(idea.scheduled_date)}</p>
                  </div>
                ))}
                <div className={s.acts}>
                  <Button size="sm" onClick={onPropose}>
                    Ver en Campañas
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid justify-items-start gap-2">
                <p className={s.muted}>
                  {campaignPlan
                    ? "El último plan no tiene acciones futuras. Revisa sus avisos o pide una propuesta nueva."
                    : "A05 consulta ventas, margen, stock, email, Meta y conocimiento para proponer qué planificar y cuándo."}
                </p>
                <Button size="sm" onClick={onPropose}>
                  {campaignPlan ? "Ver en Campañas" : "Ir a Campañas"}
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className={s.col}>
          <Card title="Necesita tu atención" actions={<span className={s.muted}>{attention.length}</span>}>
            {attention.length ? (
              <ul className={s.att}>
                {attention.slice(0, 7).map((entry) => (
                  <li key={entry.key}>
                    <span className={s.dot} data-tone={entry.tone} />
                    <span>
                      <span className={s.attTitle}>{entry.title}</span>
                      <span className={s.attText}>{entry.text}</span>
                    </span>
                    {entry.action}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.muted}>Nada se escapa esta semana.</p>
            )}
          </Card>
          {connected ? (
            <Card title="Últimos envíos" actions={<span className={s.muted}>EUR atribuidos por Klaviyo</span>}>
              {sent.length ? (
                <div className="grid">
                  {sent.map((row) => (
                    <div key={row.key} className={s.res}>
                      <button type="button" className={s.linkBtn} onClick={() => onOpenRow(row)}>
                        <b>{row.name}</b>
                      </button>
                      <span className={s.num}>{formatMoney(row.stats!.revenue, currency)}</span>
                      <span className={s.muted}>
                        {row.date ? new Date(row.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""} ·{" "}
                        {pct(ratio(row.stats!.opens_unique, row.stats!.delivered))} aperturas ·{" "}
                        {pct(ratio(row.stats!.clicks_unique, row.stats!.delivered))} clics
                      </span>
                    </div>
                  ))}
                  <div className={s.acts} style={{ marginTop: 8 }}>
                    <Button size="sm" variant="ghost" onClick={() => onGoTo("rendimiento")}>
                      Ver rendimiento
                    </Button>
                  </div>
                </div>
              ) : (
                <p className={s.muted}>Aún no hay envíos con resultados.</p>
              )}
            </Card>
          ) : (
            <Card title="Sin Klaviyo, el plan sigue funcionando">
              <div className="grid justify-items-start gap-2">
                <p className={s.muted}>
                  Planificas, escribes la pieza y la copias a tu herramienta. Con Klaviyo conectado, además la programas y ves sus
                  resultados sin salir de NORA.
                </p>
                <ButtonLink href="/integraciones" variant="secondary">
                  Conectar Klaviyo
                </ButtonLink>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
