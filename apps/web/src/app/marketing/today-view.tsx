"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { useCachedQuery } from "@/lib/use-cached-query";
import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import type { StripItem } from "@/components/trabajo-ui";
import { Banner, Button, ButtonLink, ErrorBlock, LoadingBlock, Collapsible, CollapsibleContent, CollapsibleMore, ToggleGroup, ToggleGroupItem } from "@/components/ui";
import { STATE_LABEL, UPCOMING, type CampaignPlanSummary, type CampaignRow } from "./campaign-rows";
import { flowKind, flowStatus, KEY_FLOWS, pct, ratio, type KWorkspace } from "./klaviyo-workspace";
import { fmtSchedule, toDatetimeLocal } from "./format";
import s from "./today-view.module.css";

type ContextEvent = { id: string; event_type: string; description: string; occurred_at: string; ended_at: string | null };
const DAY_MS = 86_400_000;

const SHORT_STATE: Record<CampaignRow["state"], string> = {
  late: "Fecha pasada",
  plan: "Propuesta IA",
  nopiece: "Sin contenido",
  review: "Pendiente de revisión",
  ready: "Lista para enviar",
  scheduled: "Programada",
  sending: "Enviándose",
  active: "Activa en Meta",
  paused: "En pausa",
  sent: "Enviada",
  draft: "Borrador",
  cancelled: "Cancelada",
};

function StatusBadge({ state, children }: { state: CampaignRow["state"]; children?: ReactNode }) {
  return <span className={s.statusBadge} data-state={state}>{children ?? SHORT_STATE[state]}</span>;
}

function startOfDay(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sameDay(iso: string, day: Date) {
  return startOfDay(new Date(iso)).getTime() === day.getTime();
}

/** Marketing -> Hoy: qué mandar hoy, qué viene y qué se escapa. */
export function TodayView({
  organizationId,
  now,
  isLoading,
  hasLoadError,
  onRetry,
  isPlanLoading,
  hasPlanError,
  onRetryPlan,
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
  now: number;
  isLoading: boolean;
  hasLoadError: boolean;
  onRetry: () => void;
  isPlanLoading: boolean;
  hasPlanError: boolean;
  onRetryPlan: () => void;
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
  onGoTo: (section: "flows" | "campanas" | "rendimiento" | "crear" | "contenido") => void;
}) {
  const [showAllAttention, setShowAllAttention] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [taskFilter, setTaskFilter] = useState<"all" | "campaign" | "flow">("all");
  const today = startOfDay(new Date(now));
  const todayDate = toDatetimeLocal(new Date(now).toISOString()).slice(0, 10);
  const context = useCachedQuery<{ events: ContextEvent[] }>(organizationId ? `/v1/organizations/${organizationId}/context` : null);
  const currency = workspace?.account?.currency ?? "EUR";
  const connected = Boolean(workspace?.connected);

  const upcoming = rows.filter((row) => UPCOMING.includes(row.state));
  const late = rows.filter((row) => row.state === "late");
  const soon = (row: CampaignRow) => row.date && Date.parse(row.date) - now < 7 * DAY_MS;
  const noPiece = rows.filter((row) => row.state === "nopiece" && soon(row));
  const pending = drafts.filter((draft) => draft.status === "pending_approval" && !late.some((row) => row.draft?.id === draft.id));
  const flows = workspace?.flows ?? [];
  const stoppedFlows = flows.filter((flow) => flowKind(flow) && flowStatus(flow.status).key !== "live");

  // ---- Cifras ----
  const next = upcoming
    .filter((row) => row.state !== "late" && row.date && Date.parse(row.date) >= now)
    .sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!))[0];
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const displayedMonday = new Date(monday);
  displayedMonday.setDate(monday.getDate() + weekOffset * 7);
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(displayedMonday);
    day.setDate(displayedMonday.getDate() + index);
    return day;
  });
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 7);
  const inWeek = (iso: string | null) => Boolean(iso) && Date.parse(iso!) >= monday.getTime() && Date.parse(iso!) < weekEnd.getTime();
  const weekPlanned = rows.filter((row) => row.source !== "klaviyo" && UPCOMING.includes(row.state) && inWeek(row.date));
  const weekWithPiece = weekPlanned.filter((row) => row.state !== "nopiece").length;
  const daily = workspace?.daily ?? [];
  const last7 = daily.slice(-7).reduce((sum, point) => sum + point.flow + point.campaign, 0);
  const prev7 = daily.length >= 14 ? daily.slice(-14, -7).reduce((sum, point) => sum + point.flow + point.campaign, 0) : null;
  const live = flows.filter((flow) => flowStatus(flow.status).key === "live").length;

  // ---- Atención ----
  const attention: Array<{ key: string; state: CampaignRow["state"]; kind: "campaign" | "flow"; status?: string; title: string; text: string; action: ReactNode }> = [
    ...late.map((row) => ({
      key: `late-${row.key}`,
      state: "late" as const,
      kind: "campaign" as const,
      title: row.name,
      text: row.date ? `Prevista el ${fmtSchedule(row.date)}. Revisa el envío y su fecha.` : "Revisa el envío y su fecha.",
      action: <Button size="sm" variant="secondary" onClick={() => onOpenRow(row)}>Revisar campaña</Button>,
    })),
    ...noPiece.map((row) => ({
      key: `np-${row.key}`,
      state: "nopiece" as const,
      kind: "campaign" as const,
      title: row.name,
      text: row.date ? `Sale ${fmtSchedule(row.date)}` : "Sin fecha",
      action: row.item ? <Button size="sm" onClick={() => onWritePiece(row.item!)}>Crear pieza</Button> : null,
    })),
    ...pending.map((draft) => ({
      key: `pd-${draft.id}`,
      state: "review" as const,
      kind: "campaign" as const,
      title: draft.template_name || draft.subject,
      text: "Revisa el contenido para aprobarlo o pedir cambios.",
      action: <Button size="sm" variant="secondary" onClick={() => onOpenDraft(draft.id)}>Revisar pieza</Button>,
    })),
    ...upcoming.filter((row) => row.state === "ready").map((row) => ({
      key: `ready-${row.key}`, state: "ready" as const,
      kind: "campaign" as const, status: "Lista para enviar", title: row.name,
      text: row.date ? `Prevista el ${fmtSchedule(row.date)}` : "Contenido listo. Revisa la audiencia y el envío.",
      action: <Button size="sm" variant="secondary" onClick={() => onOpenRow(row)}>{connected ? "Revisar y programar" : "Revisar y copiar"}</Button>,
    })),
    ...rows.filter((row) => row.state === "draft" || (row.state === "review" && !pending.some((draft) => draft.id === row.draft?.id))).map((row) => ({
      key: `prepare-${row.key}`, state: row.state,
      kind: "campaign" as const,
      status: row.draft?.status === "draft" ? "Borrador" : undefined,
      title: row.name,
      text: row.state === "draft" || row.draft?.status === "draft" ? "Completa el contenido antes de enviarlo a revisión." : "Revisa la propuesta y sus próximos pasos.",
      action: <Button size="sm" variant="secondary" onClick={() => onOpenRow(row)}>{row.state === "draft" || row.draft?.status === "draft" ? "Continuar borrador" : "Revisar campaña"}</Button>,
    })),
    ...stoppedFlows.map((flow) => ({
      key: `fl-${flow.id}`,
      state: (flowStatus(flow.status).key === "draft" ? "draft" : "paused") as CampaignRow["state"],
      kind: "flow" as const, status: flowStatus(flow.status).label,
      title: KEY_FLOWS.find((kind) => kind.key === flowKind(flow))?.label ?? flow.name,
      text: `«${flow.name}» no está enviando`,
      action: <Button size="sm" variant="secondary" onClick={() => onGoTo("flows")}>Revisar flow</Button>,
    })),
  ];

  const visibleAttention = attention.filter((entry) => taskFilter === "all" || entry.kind === taskFilter);
  const renderAttention = (entry: (typeof attention)[number]) => <li key={entry.key}>
    <StatusBadge state={entry.status === "Borrador" ? "draft" : entry.state}>{entry.status}</StatusBadge>
    <div><span className={s.attTitle}>{entry.title}</span><span className={s.attText}>{entry.text}</span></div>
    {entry.action}
  </li>;

  const sent = rows
    .filter((row) => row.state === "sent" && row.stats)
    .sort((a, b) => Date.parse(b.date ?? "") - Date.parse(a.date ?? ""))
    .slice(0, 3);
  const ideas = (campaignPlan?.content?.calendar_actions ?? campaignPlan?.content?.campaigns ?? [])
    .filter((action) => action.scheduled_date >= todayDate)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 3);
  const contextEvents = context.data?.events ?? [];

  const summary: StripItem[] = [
    { value: next?.date ? fmtSchedule(next.date) : "—", label: "Próximo envío", hint: next?.name, text: true },
    { value: weekPlanned.length ? `${weekWithPiece} / ${weekPlanned.length}` : "—", label: "Esta semana con pieza", tone: weekWithPiece < weekPlanned.length ? "warn" : undefined },
    ...(connected ? [
      { value: daily.length ? formatMoney(last7, currency) : "—", label: "Ingresos atribuidos por Klaviyo · 7 d", hint: prev7 ? `${last7 >= prev7 ? "+" : "−"}${Math.abs(Math.round((last7 / prev7 - 1) * 100))} % frente a la semana anterior` : undefined },
      { value: `${live} / ${flows.length}`, label: "Flows activos", hint: stoppedFlows[0] ? `${stoppedFlows[0].name} parado` : undefined },
    ] : []),
    { value: late.length, label: "Va tarde", tone: late.length ? "bad" : undefined },
  ];

  return (
    <>
      <header className={s.header}>
        <time dateTime={todayDate}>
          {today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </time><div className={s.toolbarActions}><Button variant="ghost" onClick={onPropose}>Todas las campañas</Button><Button variant="secondary" onClick={() => onGoTo("crear")}><Plus size={16} aria-hidden="true" /> Crear contenido</Button></div>
      </header>
      {hasLoadError ? (
        <ErrorBlock
          title="No se ha podido cargar toda tu actividad"
          action={<Button size="sm" variant="secondary" onClick={onRetry}>Reintentar</Button>}
        >
          Faltan tus pendientes o el estado de Klaviyo. Reintenta en unos segundos.
        </ErrorBlock>
      ) : isLoading ? <LoadingBlock label="Cargando tus campañas, pendientes y conexión con Klaviyo…" /> : (
        <>
            <section className={`${s.section} ${s.attention}`} aria-labelledby="marketing-attention">
              <div className={s.sectionHead}><div><h2 id="marketing-attention">Qué hacer ahora</h2><p className={s.muted}>{attention.length} {attention.length === 1 ? "acción pendiente" : "acciones pendientes"}</p></div></div>
              <ToggleGroup aria-label="Filtrar pendientes" value={taskFilter} onValueChange={(value) => { setTaskFilter(value); setShowAllAttention(false); }}>
                {([{ value: "all", label: "Todo" }, { value: "campaign", label: "Campañas y piezas" }, { value: "flow", label: "Flows" }] as const).map((filter) =>
                  <ToggleGroupItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </ToggleGroupItem>)}
              </ToggleGroup>
              {visibleAttention.length ? <Collapsible open={showAllAttention} onOpenChange={setShowAllAttention}>
                <ul className={s.att}>{visibleAttention.slice(0, 5).map(renderAttention)}</ul>
                {visibleAttention.length > 5 ? <>
                  <CollapsibleContent><ul className={s.att}>{visibleAttention.slice(5).map(renderAttention)}</ul></CollapsibleContent>
                  <CollapsibleMore className="mt-3" count={visibleAttention.length - 5} more={`Ver los ${visibleAttention.length} pendientes`} less="Mostrar menos" />
                </> : null}
              </Collapsible> : <div className={s.empty}><p>{attention.length ? "Sin pendientes en este filtro." : "No hay revisiones pendientes. Prepara tu próxima campaña."}</p>{!attention.length ? <Button variant="secondary" onClick={onPrepareMailing}>Preparar secuencia de emails</Button> : null}</div>}
            </section>
          <div className={s.planningBar}><span>Prepara tu próximo envío</span><Button variant="ghost" onClick={onPrepareMailing}>Planificar secuencia de emails</Button></div>
          <div className={s.workbench}>
            <section className={s.section} aria-labelledby="marketing-week">
              <div className={s.sectionHead}><div><h2 id="marketing-week">Agenda</h2>
                <p className={s.muted} aria-live="polite">{`${week[0]!.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} – ${week[6]!.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}`}</p></div>
                <div className={s.weekControls}>
                  <Button variant="secondary" size="sm" aria-label="Semana anterior" onClick={() => setWeekOffset((offset) => offset - 1)}><ChevronLeft size={16} aria-hidden="true" /></Button>
                  <Button variant="secondary" size="sm" disabled={weekOffset === 0} onClick={() => setWeekOffset(0)}>Hoy</Button>
                  <Button variant="secondary" size="sm" aria-label="Semana siguiente" onClick={() => setWeekOffset((offset) => offset + 1)}><ChevronRight size={16} aria-hidden="true" /></Button>
                </div>
              </div>
              <p className={s.weekHint}>Desplázate horizontalmente para ver todos los días.</p>
              <div className={s.weekBox} role="region" aria-label="Agenda de esta semana" tabIndex={0}>
                <div className={s.week}>
                  {week.map((day) => {
                    const isToday = day.getTime() === today.getTime();
                    const dayRows = rows.filter((row) => row.date && sameDay(row.date, day));
                    const otherItems = items.filter((item) => item.status !== "cancelled" && !/email|klaviyo/i.test(item.channel) && sameDay(item.starts_at, day) && !dayRows.some((row) => row.item?.id === item.id));
                    const dayContext = contextEvents.filter((event) => {
                      const start = startOfDay(new Date(event.occurred_at)).getTime();
                      const end = event.ended_at ? startOfDay(new Date(event.ended_at)).getTime() : start;
                      return day.getTime() >= start && day.getTime() <= end;
                    });
                    return <div key={day.toISOString()} className={s.day} data-today={isToday ? "" : undefined}>
                      <h3 className={s.dayHead}><span>{day.toLocaleDateString("es-ES", { weekday: "short" })}{isToday ? " · hoy" : ""}</span><span>{day.getDate()}</span></h3>
                      {dayRows.map((row) => <button key={row.key} type="button" className={s.event} onClick={() => onOpenRow(row)}
                        aria-label={`${row.name}. ${row.date ? fmtSchedule(row.date) : "Sin fecha"}. ${STATE_LABEL[row.state].label}. Ver campaña`}>
                        <span className={s.channel} data-channel={/meta/i.test(row.channel) ? "meta" : /instagram/i.test(row.channel) ? "instagram" : "email"}>{/meta/i.test(row.channel) ? "Meta" : /instagram/i.test(row.channel) ? "Instagram" : "Email"}</span>
                        <strong>{row.name}</strong><StatusBadge state={row.state === "review" && row.draft?.status === "draft" ? "draft" : row.state} />
                      </button>)}
                      {otherItems.map((item) => <div key={item.id} className={s.calendarNote}><span>{item.title}</span><small>{item.channel} · Informativo</small></div>)}
                      {dayContext.map((event) => <div key={event.id} className={s.calendarNote}><span>{event.description}</span><small>Mi negocio</small></div>)}
                      {!dayRows.length && !otherItems.length && !dayContext.length ? <p className={s.emptyDay}>Sin envíos previstos</p> : null}
                    </div>;
                  })}
                </div>
              </div>
              {context.isLoading ? <LoadingBlock label="Cargando los eventos de tu negocio…" /> : null}
              {context.error ? <Banner tone="warn" className="mt-3" action={<Button size="sm" variant="secondary" onClick={context.reload}>Reintentar</Button>}>No se han podido cargar los eventos de tu negocio. Los envíos siguen a la vista.</Banner> : null}
            </section>

          </div>
          <dl className={s.summary} aria-label="Resumen de marketing">
            {summary.map((item) => <div key={item.label} data-tone={item.tone}>
              <dt>{item.label}</dt><dd className={item.text ? s.textValue : undefined}>{item.value}</dd>
              {item.hint ? <dd className={s.hint}>{item.hint}</dd> : null}
            </div>)}
          </dl>
          <div className={s.followUp}>
            <section className={s.section} aria-labelledby="marketing-plan">
              <div className={s.sectionHead}><h2 id="marketing-plan">Próximas acciones</h2>
                {campaignPlan?.generated_at ? <span className={s.muted}>Propuesta del {new Date(campaignPlan.generated_at).toLocaleDateString("es-ES")}</span> : null}
              </div>
              {hasPlanError ? <Banner tone="warn" className="mt-3" action={<Button size="sm" variant="secondary" onClick={onRetryPlan}>Reintentar</Button>}>No se ha podido cargar la propuesta del plan.</Banner>
                : isPlanLoading ? <LoadingBlock label="Cargando las próximas acciones del plan…" />
                : ideas.length ? <>
                  <ul className={s.ideas}>{ideas.map((idea) => <li key={`${idea.title}-${idea.scheduled_date}`}><div><h3>{idea.title}</h3><p>{idea.objective}</p></div><span className={s.muted}>{fmtSchedule(idea.scheduled_date)}</span></li>)}</ul>
                  <Button variant="ghost" onClick={onPropose}>Ver el plan en Campañas</Button>
                </> : <div className={s.empty}>
                  <p>{campaignPlan ? "El último plan no tiene acciones futuras. Revisa sus avisos o pide una propuesta nueva." : "El plan cruza ventas, margen, stock y resultados de marketing para proponer qué preparar y cuándo."}</p>
                  <Button variant="secondary" onClick={onPropose}>{campaignPlan ? "Ver el plan en Campañas" : "Ir a Campañas"}</Button>
                </div>}
            </section>
            <section className={s.section} aria-labelledby="marketing-results">
              <div className={s.sectionHead}><h2 id="marketing-results">{connected ? "Últimos envíos" : "Conecta tus envíos"}</h2></div>
              {connected ? sent.length ? <>
                <p className={s.muted}>Ingresos atribuidos por Klaviyo</p>
                <ul className={s.results}>{sent.map((row) => <li key={row.key}>
                  <button type="button" className={s.resultLink} onClick={() => onOpenRow(row)}>{row.name}</button>
                  <strong>{formatMoney(row.stats!.revenue, currency)}</strong>
                  <p>{row.date ? new Date(row.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""} · {pct(ratio(row.stats!.opens_unique, row.stats!.delivered))} aperturas · {pct(ratio(row.stats!.clicks_unique, row.stats!.delivered))} clics</p>
                </li>)}</ul>
                <Button variant="ghost" onClick={() => onGoTo("rendimiento")}>Ver rendimiento</Button>
              </> : <p className={s.empty}>Aún no hay envíos con resultados.</p> : <div className={s.empty}>
                <p>Sin Klaviyo puedes planificar, escribir y copiar cada pieza a tu herramienta. Conéctalo para programar los envíos y ver sus resultados desde NORA.</p>
                <ButtonLink href="/integraciones" variant="secondary">Conectar Klaviyo</ButtonLink>
              </div>}
            </section>
          </div>
        </>
      )}
    </>
  );
}
