"use client";
import { OverlayCompositionPreview } from "./overlay-composition-preview";

import type { ReactNode } from "react";
import { useState } from "react";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import { ChannelBadge, channelStyle, toChannel } from "@/components/marketing-channel";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import {
  Separator,
  ScrollArea,
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  EmptyState,
  MessageIcon,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui";
import { getMetaCallToAction, getMetaDestinationUrl, isInstagramDraft } from "./meta-ad-plan";
import { dueText, needsViewer, PIECE_STATE, piecesOnDay, queueOrder, weekDays } from "./content-state";
import { threadIndicator, type PieceAuthorKind } from "./piece-analysis";
import { fmtDate } from "./format";
import s from "./content-view.module.css";

export const pieceTitle = (draft: MarketingDraft) => draft.template_name || draft.subject || "Pieza sin nombre";

const contentTypeLabels: Record<string, string> = {
  campaign: "Campaña",
  flow_step: "Email de flow",
  popup: "Popup",
};

/** Qué es la pieza, en una palabra que el cliente reconoce. */
export function pieceKind(draft: MarketingDraft) {
  const channel = toChannel(draft.request?.channel);
  if (channel === "meta_ads") return "Anuncio";
  if (channel === "instagram_organic") return "Publicación";
  return contentTypeLabels[draft.content_type] ?? "Email";
}

const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

function Thumb({ draft }: { draft: MarketingDraft }) {
  const style = channelStyle(draft.request?.channel);
  const composition = draft.request?.overlay_composition?.assets[0];
  if (composition) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={composition.url} alt={composition.alt_text ?? draft.subject} className="h-full w-full object-contain" loading="lazy" />;
  }
  if (toChannel(draft.request?.channel) !== "email_klaviyo") {
    return (
      <div className={`${s.thumbSocial} ${style.soft}`}>
        <span className={`text-[0.7rem] font-medium uppercase tracking-[0.08em] ${style.text}`}>{style.label}</span>
        <p className="line-clamp-2 text-sm font-medium">{draft.subject}</p>
        <p className="line-clamp-4 text-xs leading-relaxed">{draft.plain_text}</p>
      </div>
    );
  }
  // sandbox vacío: el HTML de la pieza no ejecuta nada ni navega.
  return <iframe title="" tabIndex={-1} sandbox="" srcDoc={draft.html} loading="lazy" />;
}

type Filter = { channel: "all" | "email_klaviyo" | "meta_ads" | "instagram_organic"; state: "all" | "ready" | "live" | "open"; query: string };

const CHANNEL_FILTERS: Array<[Filter["channel"], string]> = [
  ["all", "Todo"],
  ["email_klaviyo", "Email"],
  ["meta_ads", "Meta Ads"],
  ["instagram_organic", "Instagram"],
];
const STATE_FILTERS: Array<[Filter["state"], string]> = [
  ["all", "Cualquier estado"],
  ["ready", "Listas"],
  ["live", "Publicadas"],
  ["open", "En curso"],
];

/**
 * Contenido: qué me toca, qué sale esta semana y dónde está todo. Sustituye a
 * las dos rejillas («Plantillas en uso» / «Borradores») ordenadas por fecha de
 * creación, donde lo único que el cliente viene a hacer —decidir— quedaba
 * mezclado con lo ya cerrado.
 */
export function ContentOverview({
  drafts,
  viewerKind,
  now,
  busyId,
  onOpen,
  onApprove,
}: {
  drafts: MarketingDraft[];
  viewerKind: PieceAuthorKind;
  /** Instante del render: `Date.now()` no es puro, lo fija quien llama. */
  now: number;
  busyId: string | null;
  onOpen: (id: string, focusReply?: boolean) => void;
  onApprove: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>({ channel: "all", state: "all", query: "" });
  const isClient = viewerKind === "client";

  const mine = queueOrder(drafts.filter((draft) => needsViewer(draft, viewerKind)));
  const days = weekDays(now);
  const weekStart = days[0].getTime();
  const weekEnd = days[6].getTime() + 86_400_000;
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const thisWeek = drafts.filter((draft) => {
    const at = draft.scheduled_for ? Date.parse(draft.scheduled_for) : NaN;
    return at >= Math.max(weekStart, todayStart) && at < weekEnd;
  });
  const ready = drafts.filter((draft) => draft.status === "approved").length;
  const waiting = drafts.filter(
    (draft) => !needsViewer(draft, viewerKind) && ["draft", "pending_approval", "rejected"].includes(draft.status),
  ).length;

  const query = filter.query.trim().toLowerCase();
  const library = drafts.filter((draft) => {
    if (filter.channel !== "all" && toChannel(draft.request?.channel) !== filter.channel) return false;
    if (filter.state === "ready" && draft.status !== "approved") return false;
    if (filter.state === "live" && draft.status !== "published") return false;
    if (filter.state === "open" && !["draft", "pending_approval", "rejected"].includes(draft.status)) return false;
    return !query || `${pieceTitle(draft)} ${draft.campaign_item?.title ?? ""}`.toLowerCase().includes(query);
  });
  const countChannel = (channel: Filter["channel"]) =>
    channel === "all" ? drafts.length : drafts.filter((draft) => toChannel(draft.request?.channel) === channel).length;

  function jump(id: string, state?: Filter["state"]) {
    if (state) setFilter({ channel: "all", state, query: "" });
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (drafts.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay contenido"
        hint="Créalo en la pestaña «Crear» o impórtalo de Klaviyo. Aparecerá aquí para revisarlo."
      />
    );
  }

  return (
    <div className={`${s.tok} ${s.root}`}>
      <section className={s.pulse} aria-label="Resumen">
        <button type="button" onClick={() => jump("ct-queue")} data-act={mine.length ? "" : undefined}>
          <b>{mine.length}</b>
          <span>Te toca a ti</span>
        </button>
        <button type="button" onClick={() => jump("ct-week")}>
          <b>{thisWeek.length}</b>
          <span>Salen esta semana</span>
        </button>
        <button type="button" onClick={() => jump("ct-library", "ready")}>
          <b>{ready}</b>
          <span>Listas para usar</span>
        </button>
        <button type="button" onClick={() => jump("ct-library", "open")}>
          <b>{waiting}</b>
          <span>{isClient ? "Esperando al consultor" : "Esperando al cliente"}</span>
        </button>
      </section>

      <section className={s.sec} id="ct-queue" aria-labelledby="ct-queue-t">
        <div className={s.secHead}>
          <h2 id="ct-queue-t">Te toca</h2>
          <span className={s.muted}>Lo que sale antes, primero.</span>
        </div>
        <div className={s.queue}>
          {mine.length === 0 ? (
            <div className={s.allok}>Nada pendiente. Todo está al día.</div>
          ) : (
            mine.map((draft) => {
              const toReview = isClient && draft.status === "pending_approval";
              const indicator = threadIndicator(draft.thread, viewerKind);
              return (
                <div key={draft.id} className={s.qrow} data-why={toReview ? "review" : "msg"}>
                  <span className={s.stripe} />
                  <div className={s.qthumb} aria-hidden>
                    <Thumb draft={draft} />
                  </div>
                  <div className={s.qtext}>
                    <b>{pieceTitle(draft)}</b>
                    <span className={s.qmeta}>
                      <ChannelBadge channel={draft.request?.channel} />
                      {draft.campaign_item ? <span>Para «{draft.campaign_item.title}»</span> : null}
                      {draft.scheduled_for ? (
                        <span
                          className={s.due}
                          data-soon={Date.parse(draft.scheduled_for) - now < 2 * 86_400_000 ? "" : undefined}
                        >
                          {dueText(draft.scheduled_for, now)}
                        </span>
                      ) : (
                        <span>Sin fecha</span>
                      )}
                    </span>
                    <span className={s.muted}>
                      {indicator?.attention
                        ? indicator.label
                        : toReview
                          ? "Revísala y apruébala, o pide cambios."
                          : PIECE_STATE[draft.status].label}
                    </span>
                  </div>
                  <div className={s.qacts}>
                    {toReview ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => onOpen(draft.id)}>
                          Revisar
                        </Button>
                        <Button size="sm" disabled={busyId === draft.id} onClick={() => onApprove(draft.id)}>
                          {busyId === draft.id ? "Aprobando…" : "Aprobar"}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => onOpen(draft.id, true)}>
                        {indicator?.attention ? "Contestar" : "Abrir"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className={s.sec} id="ct-week" aria-labelledby="ct-week-t">
        <div className={s.secHead}>
          <h2 id="ct-week-t">Esta semana</h2>
          <span className={s.muted}>
            {days[0].toLocaleDateString("es-ES", { day: "numeric", month: "short" })} –{" "}
            {days[6].toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
          </span>
        </div>
        <div className={s.weekBox}>
          <div className={s.week}>
            {days.map((day) => {
              const isToday = day.getTime() === todayStart;
              const list = piecesOnDay(drafts, day);
              return (
                <div key={day.toISOString()} className={s.day} data-today={isToday ? "" : undefined}>
                  <span className={s.dayHead}>
                    <span>
                      {day.toLocaleDateString("es-ES", { weekday: "short" })}
                      {isToday ? " · hoy" : ""}
                    </span>
                    <b>{day.getDate()}</b>
                  </span>
                  {list.length === 0 ? <span className={s.emptyDay}>—</span> : null}
                  {list.map((draft) => (
                    <button
                      key={draft.id}
                      type="button"
                      className={s.slot}
                      data-ch={toChannel(draft.request?.channel)}
                      data-review={draft.status === "pending_approval" ? "" : undefined}
                      onClick={() => onOpen(draft.id)}
                    >
                      <span>{pieceTitle(draft)}</span>
                      <small>
                        {hour(draft.scheduled_for as string)} · {PIECE_STATE[draft.status].label}
                      </small>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className={s.sec} id="ct-library" aria-labelledby="ct-library-t">
        <div className={s.secHead}>
          <h2 id="ct-library-t">Todas las piezas</h2>
        </div>
        <div className={s.filters}>
          <ToggleGroup aria-label="Canal" spacing={1.5} value={filter.channel} onValueChange={(channel) => setFilter({ ...filter, channel })}>
            {CHANNEL_FILTERS.map(([value, label]) => (
              <ToggleGroupItem key={value} value={value}>
                {label}
                <span className="text-xs text-muted tabular-nums">{countChannel(value)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Separator orientation="vertical" className="h-5 self-center" />
          <ToggleGroup aria-label="Estado" spacing={1.5} value={filter.state} onValueChange={(state) => setFilter({ ...filter, state })}>
            {STATE_FILTERS.map(([value, label]) => (
              <ToggleGroupItem key={value} value={value}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <input
            className={s.search}
            type="search"
            aria-label="Buscar pieza o campaña"
            placeholder="Buscar pieza o campaña"
            value={filter.query}
            onChange={(event) => setFilter({ ...filter, query: event.target.value })}
          />
        </div>
        <div className={s.lib}>
          {library.length === 0 ? <div className={s.none}>Nada con esos filtros.</div> : null}
          {library.map((draft) => {
            const indicator = threadIndicator(draft.thread, viewerKind);
            const state = PIECE_STATE[draft.status];
            return (
              <button key={draft.id} type="button" className={s.card} onClick={() => onOpen(draft.id)}>
                <div className={s.thumb}>
                  <Thumb draft={draft} />
                </div>
                <div className={s.cbody}>
                  <div className={s.ctitle}>
                    <b>{pieceTitle(draft)}</b>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </div>
                  <div className={s.cmeta}>
                    <span>
                      {draft.campaign_item ? `Para «${draft.campaign_item.title}»` : pieceKind(draft)}
                      {draft.request?.source === "klaviyo_import" ? " · de Klaviyo" : ""}
                    </span>
                    {indicator ? (
                      <span className={s.msgs} data-att={indicator.attention ? "" : undefined} title={indicator.label}>
                        <MessageIcon aria-hidden />
                        {indicator.count}
                        <span className="sr-only">{indicator.label}</span>
                      </span>
                    ) : null}
                  </div>
                  <div className={s.cmeta}>
                    <span>{draft.scheduled_for ? `${fmtDate(draft.scheduled_for)} · ${hour(draft.scheduled_for)}` : "Sin fecha"}</span>
                    <ChannelBadge channel={draft.request?.channel} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Vista previa de la pieza tal como la verá quien la reciba. */
export function PiecePreview({ draft }: { draft: MarketingDraft }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  if (toChannel(draft.request?.channel) === "email_klaviyo") {
    return (
      <div className={s.stage}>
        <OverlayCompositionPreview draft={draft} />
        <ToggleGroup aria-label="Dispositivo" value={device} onValueChange={setDevice}>
          {(["desktop", "mobile"] as const).map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {value === "desktop" ? "Ordenador" : "Móvil"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <iframe title={`Vista previa de ${pieceTitle(draft)}`} className={s.frame} data-dev={device} sandbox="" srcDoc={draft.html} />
      </div>
    );
  }
  const destination = getMetaDestinationUrl(draft);
  return (
    <div className={s.stage}>
      <OverlayCompositionPreview draft={draft} />
      <div className={s.social}>
        <span className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted">
          {isInstagramDraft(draft) ? "Instagram · orgánico" : "Patrocinado · Meta Ads"}
        </span>
        <h3>{draft.subject}</h3>
        <p>{draft.plain_text}</p>
        <span className={s.cta}>{getMetaCallToAction(draft)}</span>
        {destination ? <span className={s.muted}>Destino: {destination}</span> : null}
      </div>
    </div>
  );
}

/**
 * Panel de la pieza: la vista previa a un lado, la conversación y lo que se
 * puede decidir al otro, y una sola acción principal abajo según el estado.
 */
export function ContentDrawer({
  draft,
  onClose,
  tools,
  side,
  footer,
}: {
  draft: MarketingDraft | null;
  onClose: () => void;
  tools?: ReactNode;
  side: ReactNode;
  footer: ReactNode;
}) {
  const state = draft ? PIECE_STATE[draft.status] : null;
  const isDesktop = useIsDesktop();
  return (
    <Drawer
      open={Boolean(draft)}
      onOpenChange={(open) => !open && onClose()}
      swipeDirection={isDesktop ? "right" : "down"}
      showSwipeHandle={!isDesktop}
    >
      <DrawerContent className={`${s.tok} sm:max-w-[60rem]`}>
        <DrawerHeader>
          <DrawerTitle>{draft ? pieceTitle(draft) : "Pieza"}</DrawerTitle>
          {draft && state ? (
            <DrawerDescription>
              <Badge tone={state.tone}>{state.label}</Badge>
              <ChannelBadge channel={draft.request?.channel} />
              <span>{pieceKind(draft)}</span>
            </DrawerDescription>
          ) : null}
          {tools ? <div className="flex flex-wrap items-center gap-2">{tools}</div> : null}
        </DrawerHeader>
        <ScrollArea className="flex-1 p-4 sm:px-6">
          {draft && state ? (
            <div className={s.dgrid}>
              <PiecePreview key={draft.id} draft={draft} />
              <div className={s.side}>{side}</div>
            </div>
          ) : null}
        </ScrollArea>
        {draft ? (
          <DrawerFooter>
            <div className={s.foot}>{footer}</div>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export { s as contentStyles };
