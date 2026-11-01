"use client";

import { buttonVariants } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/money";
import { apiFetch } from "@/lib/bootstrap";
import { toast, Link } from "@/components/ui";
import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import type { CampaignRow } from "../campaign-rows";
import { int, pct, ratio, type KWorkspace } from "../klaviyo-workspace";
import {
  decideDraft,
  requestCampaignReview,
  setCampaignReview,
  submitDraft,
  type NoteTarget,
  type ThreadNote,
  type useCampaignThread,
} from "./campaign-api";
import { dateTimeLabel, isMetaChannel, plural } from "./campaign-format";
import type { CampaignsNav } from "./campanas-nav";
import { Banner, Btn, Hero, Panel, ScopeBar, Section, Stage, Steps, type StepItem, css as s } from "./campanas-parts";
import { PieceEditor, useAiEdit } from "./piece-editor";
import { SendPanel } from "./send-panel";
import { ThreadPanel } from "./thread-panel";

/**
 * Una campaña abierta, a pantalla completa, para el consultor y para el cliente.
 *
 * Lo mismo con dos voces: el consultor revisa lo que crea el cliente (notas,
 * correcciones, a mano o con IA), aprueba y programa en Klaviyo; el cliente
 * edita lo suyo, pide ayuda a la IA y habla con su consultor, o, sin consultor,
 * aprueba y programa él. Cada cambio guarda una versión y nada sale sin una
 * aprobación humana.
 */

type Phase = "nopiece" | "piece" | "review" | "changes" | "approved" | "scheduled" | "sent";

export function CampaignWorkspace({
  organizationId,
  organizationName,
  viewer,
  viewerUserId,
  hasConsultant,
  row,
  thread,
  workspace,
  nav,
  onChanged,
  onOpenStudio,
  onWritePiece,
}: {
  organizationId: string;
  organizationName: string;
  viewer: "consultant" | "client";
  viewerUserId: string;
  /** El cliente tiene consultor asignado (para el consultor siempre es cierto). */
  hasConsultant: boolean;
  row: CampaignRow & { item: CampaignItem };
  thread: ReturnType<typeof useCampaignThread>;
  workspace: KWorkspace | undefined;
  nav: CampaignsNav;
  onChanged: () => void;
  onOpenStudio: (draft: MarketingDraft) => void;
  onWritePiece: (item: CampaignItem) => void;
}) {
  const staff = viewer === "consultant";
  const { item, draft } = row;
  const origin = item.origin ?? "staff";
  const review = item.review_status ?? null;
  const own = origin === "client";
  const meta = isMetaChannel(item.channel);
  const notes = thread.thread?.notes ?? [];
  const corrections = notes.filter((note) => note.kind === "correction" && !note.resolution);
  const proposals = notes.filter((note) => note.kind === "ai_proposal" && !note.resolution);
  const approved = Boolean(draft && ["approved", "published"].includes(draft.status));
  // Un cliente con consultor solo edita lo que creó él; sin consultor, todo.
  const canEdit = staff || !hasConsultant || own;
  // Y solo programa sin consultor o, si lo tiene, cuando ya la ha revisado (lo comprueba también el servidor).
  const canSend = staff || !hasConsultant;

  const phase: Phase =
    row.state === "sent"
      ? "sent"
      : row.state === "scheduled" || row.state === "sending"
        ? "scheduled"
        : review === "changes_requested"
          ? "changes"
          : review === "pending"
            ? "review"
            : !draft
              ? "nopiece"
              : approved
                ? "approved"
                : "piece";

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const refresh = () => {
    onChanged();
    void thread.reload();
  };
  const ai = useAiEdit(organizationId, item.id, refresh);

  async function approvePiece() {
    if (!draft) return;
    setBusy(true);
    try {
      if (draft.status === "draft") {
        const submitted = await submitDraft(organizationId, draft.id);
        if (!submitted.ok) {
          toast.danger(submitted.error);
          return;
        }
      }
      const decided = await decideDraft(organizationId, draft.id, "approved");
      if (!decided.ok) {
        toast.danger(decided.error);
        return;
      }
      if (staff && own && review && review !== "reviewed") await setCampaignReview(organizationId, item.id, "reviewed");
      setNote(staff ? "Pieza aprobada. Ya puedes programarla en Klaviyo; el cliente recibe un aviso." : hasConsultant ? "Aprobada. Tu consultor la programará y te avisará cuando salga." : "Aprobada. Ya puedes programarla en Klaviyo desde aquí.");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function review_(status: "reviewed" | "changes_requested") {
    setBusy(true);
    const result = await setCampaignReview(organizationId, item.id, status);
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setNote(status === "reviewed" ? "Campaña revisada. El cliente recibe un aviso." : "Cambios pedidos. El cliente recibe un aviso con tus notas visibles.");
    refresh();
  }

  async function returnToReview() {
    setBusy(true);
    const result = await requestCampaignReview(organizationId, item.id);
    setBusy(false);
    if (!result.ok) {
      toast.danger(result.error);
      return;
    }
    setNote("Enviada a tu consultor para revisar. Recibe un aviso.");
    refresh();
  }

  function fixByHand(target: NoteTarget | null) {
    setManualOpen(true);
    setNote(target ? `Edita «${target}» en «Editar a mano» y guarda la versión.` : "Edita a mano y guarda la versión.");
  }
  function fixWithAi(correction: ThreadNote) {
    void ai.propose(`Aplica esta corrección${correction.target ? ` sobre ${correction.target}` : ""}: ${correction.body}`);
  }

  // --- hero
  const name = item.title;
  const when = dateTimeLabel(item.starts_at);
  const open = corrections.length;
  const needsMyApproval = !staff && !(hasConsultant && own) && Boolean(draft) && !approved && phase === "piece";

  let title: string;
  let detail: string;
  if (staff) {
    title =
      phase === "review"
        ? `«${name}» la creó el cliente y espera tu revisión.`
        : phase === "changes"
          ? `«${name}» espera los cambios del cliente.`
          : phase === "nopiece"
            ? `«${name}» todavía no tiene pieza.`
            : phase === "piece"
              ? `«${name}» tiene la pieza lista para aprobar.`
              : phase === "approved"
                ? `«${name}» está aprobada y lista para programar.`
                : phase === "scheduled"
                  ? `«${name}» sale el ${when} desde Klaviyo.`
                  : `«${name}» ya salió.`;
    detail =
      phase === "scheduled"
        ? "Puedes devolverla a borrador hasta la hora de envío."
        : phase === "sent"
          ? "Los resultados de Klaviyo están abajo."
          : `Sale el ${when}. ${open ? `Tiene ${open} ${plural(open, "corrección del cliente sin resolver", "correcciones del cliente sin resolver")}.` : "No quedan correcciones del cliente sin resolver."}`;
  } else if (hasConsultant) {
    title =
      phase === "review"
        ? `Tu consultor está revisando «${name}».`
        : phase === "changes"
          ? open
            ? `Tu consultor ha pedido ${open} ${plural(open, "cambio", "cambios")} en «${name}».`
            : "Has resuelto los cambios: ya puedes devolverla a revisión."
          : phase === "approved"
            ? `«${name}» está aprobada: tu consultor la programará.`
            : phase === "scheduled"
              ? `«${name}» sale el ${when}.`
              : phase === "sent"
                ? `«${name}» ya salió.`
                : phase === "nopiece"
                  ? `Tu consultor está escribiendo «${name}».`
                  : `«${name}» espera tu visto bueno.`;
    detail = own
      ? "La creaste tú. Puedes seguir editándola; cada cambio guarda una versión y tu consultor recibe un aviso."
      : "Tu consultor la ha preparado. Nada sale sin tu visto bueno.";
  } else {
    title =
      phase === "approved"
        ? "Aprobada: ya puedes programarla en Klaviyo."
        : phase === "scheduled"
          ? `«${name}» sale el ${when}.`
          : phase === "sent"
            ? `«${name}» ya salió.`
            : phase === "nopiece"
              ? `«${name}» todavía no tiene email.`
              : `«${name}» está lista para que la apruebes.`;
    detail = "La escribió tu asistente con lo que le contaste. Nada se envía sin tu aprobación.";
  }

  const steps: StepItem[] = (() => {
    const done = (value: boolean, now: boolean): "ok" | "now" | "" => (value ? "ok" : now ? "now" : "");
    const isApproved = approved || phase === "scheduled" || phase === "sent";
    const isScheduled = phase === "scheduled" || phase === "sent";
    if (staff) {
      return own
        ? [
            { title: "Creada por el cliente", sub: dateTimeLabel(item.created_at ?? item.starts_at), state: "ok" },
            { title: "Revisión del consultor", sub: phase === "review" ? "Pendiente de ti" : phase === "changes" ? "Cambios pedidos al cliente" : "Hecha", state: done(phase !== "review" && phase !== "changes", phase === "review" || phase === "changes") },
            { title: "Pieza aprobada", sub: isApproved ? "Aprobada" : "Sin aprobar", state: done(isApproved, false) },
            { title: "Programada en Klaviyo", sub: isScheduled ? when : "Sin programar", state: done(isScheduled, phase === "approved") },
            { title: "Enviada", sub: phase === "sent" ? "Enviada" : "Los resultados llegan tras el envío", state: done(phase === "sent", false) },
          ]
        : [
            { title: origin === "ai" ? "Propuesta de A05" : "Planificada", sub: dateTimeLabel(item.created_at ?? item.starts_at), state: "ok" },
            { title: "Pieza escrita", sub: draft ? "Escrita" : "Falta escribirla", state: done(Boolean(draft), !draft) },
            { title: "Pieza aprobada", sub: isApproved ? "Aprobada" : "Sin aprobar", state: done(isApproved, Boolean(draft) && !isApproved) },
            { title: "Programada en Klaviyo", sub: isScheduled ? when : "Sin programar", state: done(isScheduled, phase === "approved") },
            { title: "Enviada", sub: phase === "sent" ? "Enviada" : "Los resultados llegan tras el envío", state: done(phase === "sent", false) },
          ];
    }
    if (hasConsultant) {
      return own
        ? [
            { title: "Creada por ti", sub: dateTimeLabel(item.created_at ?? item.starts_at), state: "ok" },
            { title: "Revisión de tu consultor", sub: phase === "review" ? "En curso" : phase === "changes" ? "Cambios pedidos" : "Hecha", state: done(phase !== "review" && phase !== "changes", phase === "review" || phase === "changes") },
            { title: "Aprobada", sub: isApproved ? "Aprobada" : "Pendiente", state: done(isApproved, false) },
            { title: "Programada en Klaviyo", sub: isScheduled ? when : "Pendiente", state: done(isScheduled, phase === "approved") },
          ]
        : [
            { title: "Preparada por tu consultor", sub: dateTimeLabel(item.created_at ?? item.starts_at), state: "ok" },
            { title: "Tu visto bueno", sub: isApproved ? "Aprobada" : draft ? "Pendiente de ti" : "Cuando esté escrita", state: done(isApproved, !isApproved && Boolean(draft)) },
            { title: "Programada en Klaviyo", sub: isScheduled ? when : "Pendiente", state: done(isScheduled, phase === "approved") },
          ];
    }
    return [
      { title: "Escrita con tu asistente", sub: dateTimeLabel(item.created_at ?? item.starts_at), state: "ok" },
      { title: "Aprobada por ti", sub: isApproved ? "Aprobada" : "Pendiente de ti", state: done(isApproved, !isApproved) },
      { title: "Programada en Klaviyo", sub: isScheduled ? when : "Pendiente", state: done(isScheduled, phase === "approved") },
    ];
  })();

  const showSend = phase !== "sent" && !meta && Boolean(draft || row.campaign);

  return (
    <Stage client={!staff}>
      <ScopeBar
        right={
          <Btn size="sm" variant="ghost" onClick={nav.closeCampaign}>
            Volver a Campañas
          </Btn>
        }
      />
      <Hero
        id="h-campana"
        meta={[`Campaña · ${meta ? "Meta Ads" : "Email"}`, organizationName, draft ? `Versión ${draft.version}` : "Sin pieza"]}
        title={title}
        lines={[detail]}
        actions={
          <>
            {staff && !meta ? <Link href="/klaviyo#revision-contenido-email">Revisión editorial A26</Link> : null}
            {phase === "nopiece" && canEdit ? (
              <Btn variant="acc" onClick={() => onWritePiece(item)}>
                {meta ? "Preparar el creativo" : "Escribir la pieza"}
              </Btn>
            ) : null}
            {staff && draft && !approved && phase !== "scheduled" && phase !== "sent" ? (
              <Btn variant="acc" disabled={busy} onClick={() => void approvePiece()}>
                Aprobar la pieza
              </Btn>
            ) : null}
            {staff && phase === "review" ? (
              <>
                <Btn variant="ghost" disabled={busy} onClick={() => void review_("changes_requested")}>
                  Pedir cambios al cliente
                </Btn>
                <Btn variant="ghost" disabled={busy} onClick={() => void review_("reviewed")}>
                  Dar por revisada
                </Btn>
              </>
            ) : null}
            {staff && phase === "approved" && !meta ? (
              <a className={buttonVariants()} href="#enviar">
                Programar en Klaviyo
              </a>
            ) : null}
            {!staff && needsMyApproval ? (
              <Btn variant="acc" disabled={busy} onClick={() => void approvePiece()}>
                Aprobar
              </Btn>
            ) : null}
            {!staff && hasConsultant && own && phase === "changes" && open === 0 ? (
              <Btn variant="acc" disabled={busy} onClick={() => void returnToReview()}>
                Enviar a mi consultor para revisar
              </Btn>
            ) : null}
            {!staff && !hasConsultant && phase === "approved" && !meta ? (
              <a className={buttonVariants({ variant: "secondary" })} href="#enviar">
                Ir a programar
              </a>
            ) : null}
          </>
        }
        side={<Steps title="Dónde está esta campaña" steps={steps} />}
      />

      {note ? <Banner onClose={() => setNote(null)}>{note}</Banner> : null}
      {thread.error ? <p className={s.err}>{thread.error}</p> : null}

      <Section
        id="pieza"
        title={staff ? "La pieza" : meta ? "Tu anuncio" : "Tu email"}
        lead={
          staff
            ? "Edítala a mano o pídele a la IA que la ajuste. Cada cambio guarda una versión y devuelve la pieza a revisión."
            : hasConsultant
              ? "Edítalo tú o pídele ayuda a la IA. Tu consultor ve cada cambio y puede anotar o corregir."
              : "Edítalo tú o pídele otra versión a tu asistente."
        }
        action={draft ? <span className={s.chip}>Versión {draft.version} · se guardan todas</span> : undefined}
      >
        <div className={s.two}>
          {draft ? (
            <PieceEditor
              organizationId={organizationId}
              itemId={item.id}
              draft={draft}
              meta={meta}
              canEdit={canEdit}
              viewer={viewer}
              corrections={corrections}
              proposals={proposals}
              manualOpen={manualOpen}
              onManualOpen={setManualOpen}
              onOpenStudio={onOpenStudio}
              onChanged={refresh}
              ai={ai}
            />
          ) : (
            <Panel>
              <p className={s.empty}>
                {row.campaign ? "Esta campaña está en Klaviyo y no se creó desde NORA: su contenido se edita allí." : canEdit ? "Esta campaña todavía no tiene pieza." : "Tu consultor está escribiendo esta campaña."}
              </p>
              {canEdit && !row.campaign ? (
                <div className={s.cRow} style={{ justifyContent: "center" }}>
                  <Btn variant="acc" onClick={() => onWritePiece(item)}>
                    {meta ? "Preparar el creativo" : "Escribir la pieza"}
                  </Btn>
                </div>
              ) : null}
            </Panel>
          )}
          <ThreadPanel
            organizationId={organizationId}
            itemId={item.id}
            notes={notes}
            openCorrections={open}
            viewer={viewer}
            viewerUserId={viewerUserId}
            hasConsultant={hasConsultant}
            canCompose={staff || hasConsultant}
            title={staff ? "Hilo de revisión" : hasConsultant ? "Conversación con tu consultor" : "Historial y avisos"}
            subtitle={
              staff
                ? `${open} ${plural(open, "corrección pendiente", "correcciones pendientes")} · el cliente ve lo que no marques como solo tuyo`
                : hasConsultant
                  ? open
                    ? `${open} ${plural(open, "cambio pendiente", "cambios pendientes")}`
                    : "Sin cambios pendientes"
                  : "Lo que ha hecho tu asistente y lo que has cambiado tú"
            }
            onChanged={refresh}
            onFixByHand={fixByHand}
            onFixWithAi={fixWithAi}
          />
        </div>
      </Section>

      {showSend ? (
        <SendPanel
          organizationId={organizationId}
          row={row}
          item={item}
          draft={draft}
          workspace={workspace}
          clientName={organizationName}
          onDone={refresh}
        />
      ) : null}
      {phase === "sent" ? <Results organizationId={organizationId} row={row} workspace={workspace} /> : null}
      {!canSend && phase === "approved" ? (
        <Banner info>Tu consultor programa esta campaña en Klaviyo y te avisa cuando salga.</Banner>
      ) : null}
    </Stage>
  );
}

function Results({ organizationId, row, workspace }: { organizationId: string; row: CampaignRow; workspace: KWorkspace | undefined }) {
  const [links, setLinks] = useState<Array<{ url: string; clicks: number; people: number }> | null>(null);
  const externalId = row.campaign?.external_id;
  const currency = workspace?.account?.currency ?? "EUR";
  useEffect(() => {
    if (!externalId) return;
    let alive = true;
    void apiFetch(`/v1/organizations/${organizationId}/marketing/klaviyo/campaigns/${encodeURIComponent(externalId)}/clicks`)
      .then(async (response) => {
        if (!alive || !response.ok) return;
        setLinks(((await response.json()) as { links: Array<{ url: string; clicks: number; people: number }> }).links);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [organizationId, externalId]);
  const stats = row.stats;
  const max = Math.max(1, ...(links ?? []).map((link) => link.clicks));
  return (
    <Section id="resultados" title="Qué ha traído" lead="Lo que ha hecho este envío, contado por Klaviyo. Ingresos atribuidos por Klaviyo, no son ventas de Shopify.">
      <Panel>
        {stats ? (
          <div className={s.res}>
            <div>
              <small>Personas que lo abrieron</small>
              <b>{pct(ratio(stats.opens_unique, stats.delivered))}</b>
              <em>{int(stats.recipients)} destinatarios</em>
            </div>
            <div>
              <small>Personas que hicieron clic</small>
              <b>{pct(ratio(stats.clicks_unique, stats.delivered))}</b>
              <em>{int(stats.unsubscribes)} bajas</em>
            </div>
            <div>
              <small>Ingresos atribuidos por Klaviyo</small>
              <b>{formatMoney(stats.revenue, currency)}</b>
              <em>de toda la vida de esta campaña</em>
            </div>
          </div>
        ) : (
          <p className={s.mut}>Klaviyo aún no ha dado resultados de este envío. Llegan en la siguiente sincronización.</p>
        )}
        {links && links.length ? (
          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            <b style={{ fontSize: 14 }}>Dónde hicieron clic</b>
            {links.map((link) => (
              <div key={link.url} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 4 }}>
                <span title={link.url} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {link.url.replace(/^https?:\/\//, "")}
                </span>
                <span>
                  {int(link.clicks)} <span className={s.mut}>· {int(link.people)} personas</span>
                </span>
                <span style={{ gridColumn: "1 / -1", height: 6, borderRadius: 3, background: "var(--sunken)", overflow: "hidden" }}>
                  <i style={{ display: "block", height: "100%", width: `${Math.round((100 * link.clicks) / max)}%`, background: "var(--accent)" }} />
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
    </Section>
  );
}
