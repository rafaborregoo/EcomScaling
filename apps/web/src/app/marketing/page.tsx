"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { A01_CAMPAIGN_BRIEF_KEY, parseA01BriefHandoff } from "@/lib/a01-call-handoff";
import { formatMoney } from "@/lib/money";
import { useUrlSection } from "@/lib/use-url-section";
import { ModuleSummary } from "@/components/module-summary";
import { CampaignPlanProposal } from "@/components/campaign-plan-proposal";
import {
  useMarketingDrafts,
  type MarketingDraft,
} from "@/hooks/use-marketing-drafts";
import { MetaAdPlanBlock } from "./meta-ad-plan-block";
import {
  getMetaCallToAction,
  getMetaDestinationUrl,
  isInstagramDraft,
  isMetaDraft,
  isSocialDraft,
} from "./meta-ad-plan";
import {
  channelStyle,
  toChannel,
} from "@/components/marketing-channel";
import {
  linkDraftToCampaign,
  useCampaignItems,
  type CampaignItem,
} from "@/hooks/use-campaign-items";
import { useAttributionReport } from "@/hooks/use-attribution-report";
import { useActiveConnection } from "@/components/active-connection";
import { useKlaviyoWorkspace } from "./klaviyo-workspace";
import { buildCampaignRows, type CampaignPlanSummary, type CampaignRow } from "./campaign-rows";
import type { MetaCampaignsResponse } from "../meta/campaign-types";
import { CampaignDrawer } from "./campaign-drawer";
import { TodayView } from "./today-view";
import { CampaignsView } from "./campaigns-view";
import { useCampaignsNav } from "./campanas/campanas-nav";
import { PortfolioCampaigns } from "./campanas/portfolio-campaigns";
import { FlowsView } from "./flows-view";
import { TemplatesView } from "./templates-view";
import { AudiencesView } from "./audiences-view";
import { KlaviyoPerformance } from "./klaviyo-performance";
import s from "./marketing-views.module.css";
import { DraftCampaignLink } from "./draft-campaign-link";
import { PerformanceTab } from "./performance-tab";
import { WeeklyMailingPlanner } from "./weekly-mailing-planner";
import { fmtDate, fmtDateTime, fmtSchedule, toDatetimeLocal } from "./format";
import { ContentStudio } from "./studio/content-studio";
import { useCopilotAsk } from "@/components/copilot-ask";
import { useMarketingPortal } from "./marketing-portal-context";
import {
  buildPieceAnalysisQuestion,
  threadIndicator,
  type AnalyzablePiece,
  type PieceThread,
} from "./piece-analysis";
import { ContentDrawer, ContentOverview, contentStyles } from "./content-view";
import { dueText, PIECE_STATE, pieceStatusNote } from "./content-state";

import {
  LoadingBlock,
  Badge,
  ButtonLink,
  Banner,
  Button,
  Card,
  CollapsibleSection,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Heading,
  Input,
  Dialog,
  Select,
  MessageIcon,
  Tabs,
  Textarea,
  toast,
  type Tone,
} from "@/components/ui";

const MARKETING_SECTIONS = [
  "plan",
  "campanas",
  "flows",
  "plantillas",
  "audiencias",
  "contenido",
  "crear",
  "rendimiento",
] as const;

// Las secciones que ya traen su propia cabecera y sus cifras (Hoy, Campañas,
// Flows, Plantillas, Audiencias, Rendimiento, y Crear con la barra del estudio).
// Contenido sigue con la cabecera y la franja del módulo.
const SELF_HEADED_SECTIONS = new Set<string>([
  "plan",
  "crear",
  "campanas",
  "flows",
  "plantillas",
  "audiencias",
  "rendimiento",
]);

type MarketingDraftEdit = {
  subject: string;
  preheader: string;
  from_name: string;
  reply_to: string;
  plain_text: string;
  html: string;
  destination_url: string;
};

type MarketingDraftVersion = {
  id: string;
  version: number;
  change_type: "generated" | "manual";
  edited_by: string | null;
  snapshot: {
    subject?: string;
    preheader?: string;
    content_type?: string;
    request?: { channel?: string } | null;
  };
  created_at: string;
};

type AiRuntimeStatus = {
  configured: boolean;
  primary_provider: "anthropic" | "openai" | null;
};

const statusLabel: Record<MarketingDraft["status"], string> = {
  draft: PIECE_STATE.draft.label,
  pending_approval: PIECE_STATE.pending_approval.label,
  approved: PIECE_STATE.approved.label,
  rejected: PIECE_STATE.rejected.label,
  published: PIECE_STATE.published.label,
};

const statusTone: Record<MarketingDraft["status"], Tone> = {
  draft: "neutral",
  pending_approval: "warn",
  approved: "success",
  rejected: "warn",
  published: "success",
};

const contentTypeLabels: Record<string, string> = {
  campaign: "Campaña / broadcast",
  flow_step: "Email de flow",
  popup: "Popup / formulario",
};

const draftStatusLabels: Record<string, string> = {
  draft: PIECE_STATE.draft.label,
  pending_approval: PIECE_STATE.pending_approval.label,
  approved: PIECE_STATE.approved.label,
  rejected: PIECE_STATE.rejected.label,
  published: PIECE_STATE.published.label,
};

const confidenceLabels: Record<MarketingDraft["confidence"], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

// Tarjeta compacta de borrador: miniatura + nombre + estado. Compartida entre
// el grid del cliente y el de la vista de consultor.
function DraftMiniCard({
  html,
  channel,
  subject,
  body,
  title,
  status,
  metaLine,
  thread,
  viewerKind,
  selected,
  onToggle,
}: {
  html: string;
  channel: string | null | undefined;
  subject: string;
  /** `plain_text` del borrador: el cuerpo de la pieza social. */
  body: string;
  title: string;
  status: MarketingDraft["status"];
  metaLine: ReactNode;
  thread?: PieceThread | null;
  viewerKind: DraftAuthorKind;
  selected: boolean;
  onToggle: () => void;
}) {
  const style = channelStyle(channel);
  const indicator = threadIndicator(thread, viewerKind);
  const isSocial = toChannel(channel) !== "email_klaviyo";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={selected}
      aria-label={`Ver ${title}`}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle();
        }
      }}
      className={`flex cursor-pointer flex-col overflow-hidden border text-left transition-colors ${
        selected ? "border-accent" : "border-separator hover:border-muted"
      }`}
    >
      {/* Franja del canal: en una rejilla es lo unico que se distingue sin leer. */}
      <div className={`h-1 ${style.fill}`} />
      <div className="h-40 overflow-hidden border-b border-separator bg-white">
        {isSocial ? (
          // Antes era una linea de texto gris, asi que media rejilla salia en
          // blanco. Una maqueta minima del anuncio se reconoce de un vistazo.
          <div className={`flex h-full flex-col gap-2 p-3 ${style.soft}`}>
            <span
              className={`text-[0.7rem] font-medium uppercase tracking-[0.08em] ${style.text}`}
            >
              {style.label}
            </span>
            <p className="line-clamp-2 text-sm font-medium text-ink">
              {subject}
            </p>
            <p className="line-clamp-4 text-xs leading-relaxed text-muted">
              {body}
            </p>
          </div>
        ) : (
          <iframe
            title=""
            srcDoc={html}
            sandbox=""
            loading="lazy"
            tabIndex={-1}
            className="pointer-events-none h-[470px] w-[600px] origin-top-left scale-[0.34]"
          />
        )}
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-medium">{title}</span>
          <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
        </div>
        <p className="text-xs text-muted">{metaLine}</p>
        {/* La conversación de la pieza, visible sin abrirla: si hay algo
            dicho, se ve desde la rejilla. En acento cuando el último que
            habló no eres tú. */}
        {indicator ? (
          <span
            className={`mt-1 inline-flex items-center gap-1.5 text-xs ${
              indicator.attention ? "font-medium text-accent" : "text-muted"
            }`}
            title={indicator.label}
          >
            <MessageIcon aria-hidden />
            {indicator.count}
            <span className="sr-only">{indicator.label}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Lo que el Consultor IA necesita saber de una pieza para poder analizarla. */
function analyzablePiece(draft: MarketingDraft): AnalyzablePiece {
  return {
    template_name: draft.template_name,
    subject: draft.subject,
    preheader: draft.preheader,
    plain_text: draft.plain_text,
    status: PIECE_STATE[draft.status].label,
    purpose: draft.purpose,
    audience: draft.audience,
    channel: draft.request?.channel,
    campaignTitle: draft.campaign_item?.title ?? null,
  };
}

type DraftAuthorKind = "consultant" | "client" | "platform" | "ai";

type MarketingDraftNote = {
  id: string;
  body: string;
  author_user_id: string | null;
  author_name: string | null;
  author_kind: DraftAuthorKind | null;
  created_at: string;
};

const authorKindLabel: Record<DraftAuthorKind, string> = {
  consultant: "Consultor",
  client: "Cliente",
  platform: "Plataforma",
  ai: "Consultor IA",
};

// Hilo de conversación de un borrador: consultor <-> cliente (y plataforma /
// IA). Cualquier miembro del workspace lo ve y escribe. Las líneas que empiezan
// por 📅 son de sistema (cambios de fecha de publicación).
function MarketingDraftNotes({
  organizationId,
  draftId,
  viewerKind,
  autoFocus,
  onChanged,
}: {
  organizationId: string;
  draftId: string;
  viewerKind: DraftAuthorKind;
  autoFocus?: boolean;
  onChanged?: () => void;
}) {
  const [notes, setNotes] = useState<MarketingDraftNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/v1/organizations/${organizationId}/marketing/drafts/${draftId}/notes`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(base);
      if (response.ok) {
        setNotes(
          ((await response.json()) as { notes: MarketingDraftNote[] }).notes,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addNote() {
    if (!noteDraft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteDraft.trim() }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNoteDraft("");
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-separator pt-3">
      <p className={EYEBROW}>Conversación</p>
      {loading ? (
        <p className="mt-1 text-sm text-muted">Cargando…</p>
      ) : notes.length === 0 ? (
        <p className="mt-1 text-sm text-muted">
          Sin mensajes todavía. Escribe el primero.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {notes.map((note) => {
            const isSystem = note.body.startsWith("📅");
            if (isSystem) {
              return (
                <p key={note.id} className="text-center text-xs text-muted">
                  {note.body} · {fmtDateTime(note.created_at)}
                </p>
              );
            }
            const kind = note.author_kind ?? "consultant";
            const mine = kind === viewerKind;
            return (
              <div
                key={note.id}
                className={`rounded-md border p-3 text-sm ${
                  mine
                    ? "border-accent/30 bg-accent-soft/30"
                    : "border-separator bg-surface"
                }`}
              >
                <p className="leading-6 whitespace-pre-wrap">{note.body}</p>
                <p className="text-xs text-muted">
                  {note.author_name ?? authorKindLabel[kind]}
                  {mine ? " (tú)" : ""} · {authorKindLabel[kind]} ·{" "}
                  {fmtDateTime(note.created_at)}
                </p>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-3 space-y-2">
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <Textarea
          aria-label="Nuevo mensaje en la conversación"
          placeholder={
            viewerKind === "client"
              ? "Escribe al consultor sobre esta publicación…"
              : "Objeción, observación o pregunta para el cliente…"
          }
          className="min-h-24"
          autoFocus={autoFocus}
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !noteDraft.trim()}
          onClick={() => void addNote()}
        >
          {busy ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}

// Programación de la publicación. La fija normalmente el cliente; el consultor
// puede proponer otra fecha. Cada cambio deja línea de sistema en el hilo.
function SchedulePublicationBlock({
  organizationId,
  draftId,
  scheduledFor,
  onChanged,
}: {
  organizationId: string;
  draftId: string;
  scheduledFor: string | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    scheduledFor ? toDatetimeLocal(scheduledFor) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(scheduledFor ? toDatetimeLocal(scheduledFor) : "");
    setEditing(false);
  }, [scheduledFor, draftId]);

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/${draftId}/schedule`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduled_for: next ? new Date(next).toISOString() : null,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-separator pt-3">
      <p className={EYEBROW}>Programación</p>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {!editing ? (
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
          {scheduledFor ? (
            <>
              <span className="font-medium">
                Prevista para el {fmtSchedule(scheduledFor)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
              >
                Cambiar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void save(null)}
              >
                Quitar
              </Button>
            </>
          ) : (
            <>
              <span className="text-muted">Sin fecha de publicación.</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(true)}
              >
                Programar publicación
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Input
            type="datetime-local"
            aria-label="Fecha y hora de publicación"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button
            size="sm"
            disabled={busy || !value}
            onClick={() => void save(value)}
          >
            {busy ? "Guardando…" : "Guardar fecha"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

type UpcomingEntry = {
  id: string;
  title: string;
  meta: ReactNode;
  scheduledFor: string;
  channel?: string | null;
  noteCount?: number;
  onOpen: () => void;
};

// Agenda compartida: publicaciones con fecha acordada, agrupadas por día. La
// usan la vista cliente y la de consultor con la misma forma.
function UpcomingPublications({
  entries,
  title = "Próximas publicaciones",
}: {
  entries: UpcomingEntry[];
  title?: string;
}) {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort(
    (a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor),
  );
  const groups = new Map<string, UpcomingEntry[]>();
  for (const entry of sorted) {
    const key = new Date(entry.scheduledFor).toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  return (
    <Card
      title={title}
      description="Publicaciones con fecha acordada. Ábrelas para ver la conversación y objetar."
    >
      <div className="space-y-4">
        {[...groups.entries()].map(([day, dayEntries]) => (
          <div key={day}>
            <p className={EYEBROW}>{day}</p>
            <ul className="mt-1 divide-y divide-separator">
              {dayEntries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={entry.onOpen}
                    className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span
                      aria-hidden
                      className={`h-6 w-1 shrink-0 ${channelStyle(entry.channel).fill}`}
                    />
                    <span className="mr-auto flex flex-col">
                      <span className="font-medium">{entry.title}</span>
                      <span className="text-xs text-muted">{entry.meta}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted">
                      {new Date(entry.scheduledFor).toLocaleTimeString(
                        "es-ES",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                      {entry.noteCount && entry.noteCount > 0 ? (
                        <Badge tone="warn">{entry.noteCount}</Badge>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MarketingContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId } = useActiveOrganization();
  const activeMembership = bootstrap.memberships.find(
    (membership) => membership.organization_id === organizationId,
  );
  const isConsultantRole = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const viewerKind: DraftAuthorKind =
    bootstrap.profile.platform_role === "platform_admin"
      ? "platform"
      : bootstrap.profile.platform_role === "consultant"
        ? "consultant"
        : "client";
  const canView =
    isConsultantRole ||
    ["owner", "manager"].includes(activeMembership?.role ?? "");
  // Los tres trabajos del modulo. Antes eran tres zonas del mismo scroll y se
  // navegaba con `scrollIntoView`; ahora la pestaña ES la navegacion.
  const [tab, setTab] = useUrlSection(
    "section",
    MARKETING_SECTIONS,
    "plan",
  );
  // Campaña para la que se esta escribiendo. Es lo que convierte "generar
  // contenido" en "sacar ESTA campaña": al terminar, la pieza queda enlazada.
  const [campaignTarget, setCampaignTarget] = useState<CampaignItem | null>(
    null,
  );
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(
    null,
  );
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [focusReply, setFocusReply] = useState(false);
  // `Date.now()` no es puro: se fija una vez para la agenda y los "sale en N días".
  const [contentNow] = useState(() => Date.now());
  const [isMailingPlannerOpen, setIsMailingPlannerOpen] = useState(false);
  const [isCampaignProposalOpen, setIsCampaignProposalOpen] = useState(
    () => searchParams.get("openCampaignPlan") === "1",
  );
  const [campaignProposalBrief, setCampaignProposalBrief] = useState("");
  const campaignIntentConsumed = useRef(false);
  useEffect(() => {
    if (
      campaignIntentConsumed.current ||
      !organizationId ||
      searchParams.get("openCampaignPlan") !== "1"
    ) return;
    campaignIntentConsumed.current = true;
    const stagedBrief = parseA01BriefHandoff(
      window.sessionStorage.getItem(A01_CAMPAIGN_BRIEF_KEY),
      organizationId,
    );
    window.sessionStorage.removeItem(A01_CAMPAIGN_BRIEF_KEY);
    setCampaignProposalBrief(stagedBrief ?? "");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openCampaignPlan");
    router.replace(`/marketing?${params.toString()}`, { scroll: false });
  }, [organizationId, router, searchParams]);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
  const [pushingDraftId, setPushingDraftId] = useState<string | null>(null);
  const [decisionDraft, setDecisionDraft] = useState<{
    id: string;
    decision: "approved" | "rejected";
  } | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MarketingDraftEdit | null>(null);
  const [historyDraftId, setHistoryDraftId] = useState<string | null>(null);
  const [versionHistory, setVersionHistory] = useState<MarketingDraftVersion[]>(
    [],
  );
  const aiRuntimeQuery = useCachedQuery<AiRuntimeStatus>("/v1/ai/status");
  const aiRuntimeStatus = aiRuntimeQuery.data ?? null;
  const { connectionId: activeConnectionId } = useActiveConnection();

  // La lista de borradores es el estado que comparten las tres pestañas, asi
  // que sale del componente a su propio hook (ver use-marketing-drafts.ts):
  // aqui dentro el React Compiler ya no podia preservar su memoizacion y
  // dejaba de optimizar la pagina entera.
  const {
    drafts,
    isLoading,
    error,
    setError,
    reload: loadDrafts,
  } = useMarketingDrafts(organizationId, canView, activeConnectionId);

  // Pieza que el estudio tiene que abrir. `asCopy` = punto de partida para
  // una pieza nueva (plantilla de la biblioteca), no editar la original.
  const [studioOpen, setStudioOpen] = useState<{ draft: MarketingDraft; nonce: number; asCopy?: boolean } | null>(null);
  const editInBuilder = useCallback((draft: MarketingDraft, asCopy = false) => {
    setStudioOpen({ draft, nonce: Date.now(), asCopy });
    setTab("crear");
  }, [setTab]);

  // Lo que ofrece "Elegir plantilla": piezas guardadas que traen un diseño
  // reutilizable. Una pieza sin bloques no se puede abrir en el editor, así
  // que ofrecerla sería una opción que no hace nada al pulsarla.
  const savedTemplates = drafts
    .filter(
      (draft) =>
        (draft.request?.design?.blocks?.length ?? 0) > 0 ||
        (Array.isArray(draft.blocks) && draft.blocks.length > 0),
    )
    .slice(0, 15);

  const referenceTemplateId = searchParams.get("reference");
  const draftIntentId = searchParams.get("draft");
  const systemTemplateId = searchParams.get("system");
  // Constructor de flows abierto (Marketing → Flows): va a pantalla completa.
  const flowBuilderOpen = tab === "flows" && Boolean(searchParams.get("flow"));
  const handledReferenceTemplate = useRef<string | null>(null);
  const handledDraftIntent = useRef<string | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect -- A deliberate one-shot URL intent hydrates the email editor from the selected library template. */
  useEffect(() => {
    if (!referenceTemplateId) {
      handledReferenceTemplate.current = null;
      return;
    }
    if (
      isLoading ||
      handledReferenceTemplate.current === referenceTemplateId
    ) return;
    const source = savedTemplates.find((draft) => draft.id === referenceTemplateId);
    if (source) {
      editInBuilder(source, true);
    } else {
      try {
        const stored = window.sessionStorage.getItem(
          "e-nora:marketing:reference-template",
        );
        const reference = stored
          ? (JSON.parse(stored) as {
              id?: unknown;
              name?: unknown;
              subject?: unknown;
              design?: unknown;
            })
          : null;
        const design = reference?.design as { blocks?: unknown } | undefined;
        if (reference?.id !== referenceTemplateId || !design || !Array.isArray(design.blocks)) return;
        // La plantilla viene de la biblioteca pero no está en esta lista: se
        // abre como punto de partida de una pieza nueva.
        editInBuilder(
          {
            id: referenceTemplateId,
            status: "draft",
            content_type: "campaign",
            request: { channel: "email_klaviyo", design },
            template_name: typeof reference.name === "string" ? reference.name : "",
            subject: typeof reference.subject === "string" ? reference.subject : "",
            preheader: "",
            from_name: "",
            reply_to: null,
            blocks: [],
            html: "",
            plain_text: "",
          } as unknown as MarketingDraft,
          true,
        );
        toast.success("Plantilla cargada como punto de partida");
      } catch {
        return;
      }
    }
    handledReferenceTemplate.current = referenceTemplateId;
    window.sessionStorage.removeItem("e-nora:marketing:reference-template");
    setTab("crear");
    router.replace("/marketing?section=crear", { scroll: false });
  }, [editInBuilder, isLoading, referenceTemplateId, router, savedTemplates, setTab]);

  useEffect(() => {
    if (!draftIntentId) {
      handledDraftIntent.current = null;
      return;
    }
    if (isLoading || handledDraftIntent.current === draftIntentId) return;
    const draft = drafts.find((item) => item.id === draftIntentId);
    if (!draft) return;
    handledDraftIntent.current = draftIntentId;
    editInBuilder(draft);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("draft");
    params.set("section", "crear");
    router.replace(`/marketing?${params.toString()}`, { scroll: false });
  }, [draftIntentId, drafts, editInBuilder, isLoading, router, searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const askCopilot = useCopilotAsk();

  /**
   * "Analiza esta pieza": abre el Consultor IA con la pieza dentro de la
   * pregunta y deja dejar la respuesta en el hilo de la propia pieza, firmada
   * como IA. Así el análisis no se queda en un chat que se cierra: lo ve
   * también el consultor (o el cliente) la próxima vez que abra la pieza.
   */
  function analyzePiece(draft: MarketingDraft) {
    askCopilot({
      question: buildPieceAnalysisQuestion(analyzablePiece(draft)),
      focusLabel: draft.template_name || draft.subject || "Pieza de marketing",
      reference: { kind: "entity", entity: { type: "marketing_draft", id: draft.id } },
      saveAnswer: async (text) => {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/marketing/drafts/${draft.id}/notes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: text, from_ai: true }),
          },
        );
        if (!response.ok) throw new Error(await readApiError(response));
        await loadDrafts();
      },
    });
  }

  // El calendario de campañas: el otro extremo del hilo. Lo comparten la
  // pestaña Plan (que campañas hay y cuales no tienen pieza) y el detalle de
  // cada borrador (a que campaña sirve).
  const {
    items: campaignItems,
    agenda: campaignAgenda,
    isLoading: campaignItemsLoading,
    reload: reloadCampaignItems,
  } = useCampaignItems(organizationId, activeConnectionId);
  const campaignsNav = useCampaignsNav();

  // El tramo final del hilo. Una sola carga para los tres sitios que la
  // necesitan (la tira de KPIs, el resultado por campaña en Plan y la pestaña
  // Rendimiento), con el periodo compartido: si cada uno pidiera el suyo, la
  // misma cifra saldria distinta en dos pantallas a la vez.
  const [performanceDays, setPerformanceDays] = useState("30");
  // El panel de rendimiento se lee de la tienda activa del selector: con dos
  // tiendas en el mismo cliente, el agregado no es de ninguna de las dos.
  const campaignPlanQuery = useCachedQuery<{ proposal: CampaignPlanSummary | null }>(
    organizationId && activeConnectionId
      ? `/v1/organizations/${organizationId}/ai/campaign-plan?connectionId=${encodeURIComponent(activeConnectionId)}`
      : null,
  );
  const metaCampaignQuery = useCachedQuery<MetaCampaignsResponse>(
    organizationId && activeConnectionId
      ? `/v1/organizations/${organizationId}/meta/campaigns?page=1&sort=spend&periodDays=30&connectionId=${encodeURIComponent(activeConnectionId)}`
      : null,
  );
  const attribution = useAttributionReport(
    organizationId,
    Number(performanceDays),
    activeConnectionId,
  );
  // Klaviyo dentro de NORA: campañas, flows, plantillas, audiencias y
  // rendimiento en una sola carga, con el mismo periodo que Rendimiento.
  const klaviyoWorkspace = useKlaviyoWorkspace(
    organizationId,
    Number(performanceDays),
    activeConnectionId || null,
  );
  const campaignRows = buildCampaignRows(
    campaignItems,
    drafts,
    klaviyoWorkspace.data?.campaigns ?? [],
  );
  const campaignListRows = buildCampaignRows(
    campaignItems,
    drafts,
    klaviyoWorkspace.data?.campaigns ?? [],
    contentNow,
    campaignPlanQuery.data?.proposal ?? null,
    metaCampaignQuery.data?.campaigns ?? [],
  );
  const todayRows = campaignRows.filter(
    (row) => Boolean(row.item || row.campaign || !row.draft),
  );
  const [openRow, setOpenRow] = useState<CampaignRow | null>(null);
  const reloadMarketing = () => {
    klaviyoWorkspace.reload();
    void reloadCampaignItems();
    void loadDrafts();
  };





  // Al generar algo, el borrador nuevo esta en otra pestaña. Antes esto hacia
  // `scrollIntoView` porque estaba mas abajo en la misma pagina; ahora hay que
  // llevar al usuario a donde vive, o generaria a ciegas sin ver el resultado.
  function focusDraft(draftId: string) {
    setExpandedDraftId(draftId);
    setTab("contenido");
  }

  /**
   * Desde una campaña sin pieza: abre el generador ya apuntando a ella y con
   * el brief traido de la propia campaña (titulo, objetivo, hipotesis). Sin
   * esto habria que releer el plan en otra pestaña y copiarlo a mano, que es
   * exactamente el salto que hacia que campaña y pieza fueran dos mundos.
   */
  function writePieceFor(item: CampaignItem) {
    // El estudio abre "Nueva pieza" con el brief de la campaña ya escrito.
    setCampaignTarget(item);
    setTab("crear");
  }

  useEffect(() => {
    const campaignId = searchParams.get("campaignId");
    if (!campaignId) return;
    const item = campaignItems.find((candidate) => candidate.id === campaignId);
    if (!item) return;
    setCampaignTarget(item);
    setTab("crear");
    const params = new URLSearchParams({ section: "crear" });
    if (activeConnectionId) params.set("connectionId", activeConnectionId);
    router.replace(`/marketing?${params.toString()}`, { scroll: false });
  }, [activeConnectionId, campaignItems, router, searchParams, setTab]);

  /**
   * Cierra el hilo: la primera vez que el estudio guarda la pieza de una
   * campaña, queda colgada de ella. Si el enlace falla, la pieza ya existe y
   * se puede enlazar a mano desde su detalle.
   */
  async function linkStudioDraft(draftId: string) {
    if (!organizationId || !campaignTarget) return;
    const target = campaignTarget;
    setCampaignTarget(null);
    const linked = await linkDraftToCampaign(organizationId, target.id, draftId).catch(() => null);
    if (linked?.ok) {
      await reloadCampaignItems();
      toast.success(`Pieza enlazada a «${target.title}»`);
    } else {
      toast.danger("La pieza se guardó, pero no se pudo enlazar a la campaña.");
    }
  }

  async function submitDraft(draftId: string) {
    if (!organizationId) return;
    setSubmittingDraftId(draftId);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/${draftId}/submit`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Enviado a aprobación");
      await loadDrafts();
    } catch {
      setError(
        "No se pudo enviar a aprobación por un error de red. Reintenta.",
      );
    } finally {
      setSubmittingDraftId(null);
    }
  }


  async function decideDraft(
    draftId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) {
    if (!organizationId) return;
    setBusyDraftId(draftId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/${draftId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            reason: reason.trim() || undefined,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success(
        decision === "approved"
          ? "Pieza aprobada"
          : "Cambios enviados",
      );
      setDecisionDraft(null);
      setDecisionReason("");
      await loadDrafts();
    } catch {
      setError(
        "No se pudo guardar la decisión del borrador por un error de red. Reintenta.",
      );
    } finally {
      setBusyDraftId(null);
    }
  }

  function openDecision(draftId: string, decision: "approved" | "rejected") {
    setDecisionDraft({ id: draftId, decision });
    setDecisionReason("");
  }

  function startEditing(draft: MarketingDraft) {
    setEditingDraftId(draft.id);
    setEditForm({
      subject: draft.subject,
      preheader: draft.preheader,
      from_name: draft.from_name,
      reply_to: draft.reply_to ?? "",
      plain_text: draft.plain_text,
      html: draft.html,
      destination_url: getMetaDestinationUrl(draft) ?? "",
    });
    setError(null);
  }

  function cancelEditing() {
    setEditingDraftId(null);
    setEditForm(null);
  }

  async function saveEditing(draftId: string) {
    if (!organizationId || !editForm) return;
    setBusyDraftId(draftId);
    setError(null);
    try {
      const editingDraft = drafts.find((draft) => draft.id === draftId);
      const isSocial = editingDraft ? isSocialDraft(editingDraft) : false;
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/${draftId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isSocial
              ? {
                  headline: editForm.subject,
                  description: editForm.preheader,
                  primary_text: editForm.plain_text,
                  destination_url: editForm.destination_url.trim() || null,
                }
              : {
                  subject: editForm.subject,
                  preheader: editForm.preheader,
                  from_name: editForm.from_name,
                  plain_text: editForm.plain_text,
                  html: editForm.html,
                  reply_to: editForm.reply_to.trim() || null,
                },
          ),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Cambios guardados; el borrador vuelve a revisión");
      cancelEditing();
      await loadDrafts();
    } catch {
      setError(
        "No se pudieron guardar los cambios por un error de red. Reintenta.",
      );
    } finally {
      setBusyDraftId(null);
    }
  }

  async function toggleVersionHistory(draftId: string) {
    if (historyDraftId === draftId) {
      setHistoryDraftId(null);
      return;
    }
    if (!organizationId) return;
    setHistoryDraftId(draftId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/${draftId}/versions`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        setHistoryDraftId(null);
        return;
      }
      const payload = (await response.json()) as {
        versions?: MarketingDraftVersion[];
      };
      setVersionHistory(payload.versions ?? []);
    } catch {
      setHistoryDraftId(null);
      setError(
        "No se pudo cargar el historial del borrador por un error de red. Reintenta.",
      );
    }
  }

  /**
   * Envia la pieza aprobada a Klaviyo como plantilla. Escritura en la cuenta
   * del cliente: solo desde aprobado, y la primera vez crea mientras que las
   * siguientes actualizan la misma plantilla (el id vive en el borrador).
   */
  async function pushToKlaviyo(draft: MarketingDraft) {
    if (!organizationId) return;
    setPushingDraftId(draft.id);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/klaviyo/templates/push`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId: draft.id }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        created?: boolean;
      } | null;
      toast.success(
        body?.created
          ? "Plantilla creada en Klaviyo"
          : "Plantilla actualizada en Klaviyo",
      );
      await loadDrafts();
    } catch {
      setError(
        "No se pudo enviar la plantilla a Klaviyo por un error de red. Reintenta.",
      );
    } finally {
      setPushingDraftId(null);
    }
  }

  async function copyHtml(html: string) {
    try {
      await navigator.clipboard.writeText(html);
      toast.success("HTML copiado al portapapeles");
    } catch {
      setError(
        "No se pudo copiar el HTML al portapapeles. Selecciónalo manualmente.",
      );
    }
  }

  async function copyMetaCreative(draft: MarketingDraft) {
    try {
      await navigator.clipboard.writeText(
        [
          draft.subject,
          draft.plain_text,
          getMetaCallToAction(draft),
          getMetaDestinationUrl(draft),
        ]
          .filter(Boolean)
          .join("\n\n"),
      );
      toast.success("Creativo Meta copiado al portapapeles");
    } catch {
      setError(
        "No se pudo copiar el creativo Meta al portapapeles. Selecciónalo manualmente.",
      );
    }
  }

  async function copyInstagramPost(draft: MarketingDraft) {
    try {
      // draft.plain_text ya es caption + hashtags; el brief creativo queda
      // fuera a propósito (no es parte del post).
      await navigator.clipboard.writeText(
        [draft.plain_text, getMetaCallToAction(draft)]
          .filter(Boolean)
          .join("\n\n"),
      );
      toast.success("Post de Instagram copiado al portapapeles");
    } catch {
      setError(
        "No se pudo copiar el post al portapapeles. Selecciónalo manualmente.",
      );
    }
  }

  if (!canView) {
    return (
      <EmptyState
        title="Sin acceso"
        hint="Necesitas ser propietario o manager de la organización, consultor o administrador de plataforma."
      />
    );
  }

  // Lo que espera una decision tuya, en la propia pestaña: es lo unico del
  // modulo que esta parado esperando a alguien.
  const pendingDecisionCount = drafts.filter((draft) =>
    ["draft", "pending_approval"].includes(draft.status),
  ).length;

  // Panel de la pieza abierta. Una sola acción principal abajo según el
  // estado; la conversación va junto a la vista previa, no al final.
  const openDraft = drafts.find((draft) => draft.id === expandedDraftId) ?? null;
  const canOpenInStudio = (draft: MarketingDraft) =>
    !isSocialDraft(draft) &&
    ((draft.request?.design &&
      Array.isArray(draft.request.design.blocks) &&
      draft.request.design.blocks.length > 0) ||
      (Array.isArray(draft.blocks) && draft.blocks.length > 0));
  const contentDrawer = (
    <ContentDrawer
      draft={openDraft}
      onClose={() => {
        setExpandedDraftId(null);
        setDecisionDraft(null);
        cancelEditing();
        setHistoryDraftId(null);
      }}
      tools={
        openDraft && openDraft.status !== "published" ? (
          canOpenInStudio(openDraft) ? (
            <Button size="sm" variant="ghost" onClick={() => editInBuilder(openDraft)}>
              Editar en el estudio
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={busyDraftId === openDraft.id}
              onClick={() =>
                editingDraftId === openDraft.id ? cancelEditing() : startEditing(openDraft)
              }
            >
              {editingDraftId === openDraft.id ? "Cancelar edición" : "Editar textos"}
            </Button>
          )
        ) : null
      }
      side={
        openDraft ? (
          <>
            <div
              className={contentStyles.status}
              data-tone={PIECE_STATE[openDraft.status].tone}
            >
              <b>{PIECE_STATE[openDraft.status].label}</b>
              <span>{pieceStatusNote(openDraft, viewerKind, contentNow)}</span>
            </div>
            {openDraft.status === "rejected" && openDraft.decision_reason ? (
              <Banner tone="warn" className="text-sm">
                {openDraft.decision_reason}
              </Banner>
            ) : null}
            {openDraft.warnings.length > 0 ? (
              <Banner tone="warn" className="text-sm">
                <ul className="list-disc pl-5">
                  {openDraft.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Banner>
            ) : null}
                            {editingDraftId === openDraft.id && editForm ? (
                              <Card
                                title="Editar contenido"
                                description="Al guardar volverá a requerir aprobación."
                                className="border-warning/40 bg-warning/10"
                              >
                                <div className="space-y-4">
                                  <Field
                                    label={
                                      isInstagramDraft(openDraft)
                                        ? "Título del post"
                                        : isMetaDraft(openDraft)
                                          ? "Titular del anuncio"
                                          : "Asunto del email"
                                    }
                                  >
                                    <Input
                                      className="mt-2"
                                      value={editForm.subject}
                                      onChange={(event) =>
                                        setEditForm({
                                          ...editForm,
                                          subject: event.target.value,
                                        })
                                      }
                                      maxLength={255}
                                    />
                                  </Field>
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <Field
                                      label={
                                        isInstagramDraft(openDraft)
                                          ? "Brief creativo"
                                          : isMetaDraft(openDraft)
                                            ? "Descripción del anuncio"
                                            : "Preheader"
                                      }
                                    >
                                      <Input
                                        className="mt-2"
                                        value={editForm.preheader}
                                        onChange={(event) =>
                                          setEditForm({
                                            ...editForm,
                                            preheader: event.target.value,
                                          })
                                        }
                                        maxLength={255}
                                      />
                                    </Field>
                                    {!isSocialDraft(openDraft) ? (
                                      <Field label="Remitente">
                                        <Input
                                          className="mt-2"
                                          value={editForm.from_name}
                                          onChange={(event) =>
                                            setEditForm({
                                              ...editForm,
                                              from_name: event.target.value,
                                            })
                                          }
                                          maxLength={160}
                                        />
                                      </Field>
                                    ) : null}
                                  </div>
                                  {!isSocialDraft(openDraft) ? (
                                    <Field label="Reply-to (opcional)">
                                      <Input
                                        className="mt-2"
                                        type="email"
                                        value={editForm.reply_to}
                                        onChange={(event) =>
                                          setEditForm({
                                            ...editForm,
                                            reply_to: event.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                  ) : null}
                                  <Field
                                    label={
                                      isInstagramDraft(openDraft)
                                        ? "Caption + hashtags"
                                        : isMetaDraft(openDraft)
                                          ? "Texto principal del anuncio"
                                          : "Texto plano"
                                    }
                                  >
                                    <Textarea
                                      className="mt-2 min-h-32"
                                      value={editForm.plain_text}
                                      onChange={(event) =>
                                        setEditForm({
                                          ...editForm,
                                          plain_text: event.target.value,
                                        })
                                      }
                                      maxLength={100000}
                                    />
                                  </Field>
                                  {isMetaDraft(openDraft) ? (
                                    <Field label="Destino del CTA">
                                      <Input
                                        className="mt-2"
                                        type="url"
                                        value={editForm.destination_url}
                                        onChange={(event) =>
                                          setEditForm({
                                            ...editForm,
                                            destination_url: event.target.value,
                                          })
                                        }
                                        placeholder="https://tu-tienda.com/coleccion"
                                      />
                                    </Field>
                                  ) : null}
                                  {!isSocialDraft(openDraft) ? (
                                    <Field label="HTML sanitizado">
                                      <Textarea
                                        className="mt-2 min-h-40 font-mono text-xs"
                                        value={editForm.html}
                                        onChange={(event) =>
                                          setEditForm({
                                            ...editForm,
                                            html: event.target.value,
                                          })
                                        }
                                        maxLength={200000}
                                      />
                                    </Field>
                                  ) : null}
                                  <Button
                                    type="button"
                                    onClick={() => void saveEditing(openDraft.id)}
                                    disabled={busyDraftId === openDraft.id}
                                  >
                                    {busyDraftId === openDraft.id
                                      ? "Guardando…"
                                      : "Guardar nueva versión"}
                                  </Button>
                                </div>
                              </Card>
                            ) : null}
            <div className={contentStyles.block}>
              <h3>Qué es</h3>
              <dl className={contentStyles.kv}>
                {openDraft.campaign_item ? (
                  <>
                    <dt>Para</dt>
                    <dd>{openDraft.campaign_item.title}</dd>
                  </>
                ) : null}
                <dt>{isInstagramDraft(openDraft) ? "Título" : isMetaDraft(openDraft) ? "Titular" : "Asunto"}</dt>
                <dd>{openDraft.subject}</dd>
                {!isSocialDraft(openDraft) && openDraft.preheader ? (
                  <>
                    <dt>Vista previa</dt>
                    <dd>{openDraft.preheader}</dd>
                  </>
                ) : null}
                <dt>A quién</dt>
                <dd>{openDraft.audience || "—"}</dd>
              </dl>
            </div>
            {organizationId ? (
              <>
                <div className={contentStyles.block}>
                  <MarketingDraftNotes
                    organizationId={organizationId}
                    draftId={openDraft.id}
                    viewerKind={viewerKind}
                    autoFocus={focusReply}
                    onChanged={() => void loadDrafts()}
                  />
                  <div>
                    <Button size="sm" variant="ghost" onClick={() => analyzePiece(openDraft)}>
                      ¿Qué mejorarías? · Consultor IA
                    </Button>
                  </div>
                </div>
                <SchedulePublicationBlock
                  organizationId={organizationId}
                  draftId={openDraft.id}
                  scheduledFor={openDraft.scheduled_for}
                  onChanged={() => void loadDrafts()}
                />
                <DraftCampaignLink
                  organizationId={organizationId}
                  draft={openDraft}
                  items={campaignItems}
                  onChanged={() => {
                    void loadDrafts();
                    void reloadCampaignItems();
                  }}
                />
                {isMetaDraft(openDraft) ? (
                  <MetaAdPlanBlock organizationId={organizationId} draft={openDraft} />
                ) : null}
              </>
            ) : null}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">Detalles</summary>
              <dl className={`${contentStyles.kv} mt-2`}>
                <dt>Versión</dt>
                <dd>{openDraft.version}</dd>
                <dt>Creada</dt>
                <dd>{fmtDateTime(openDraft.created_at)}</dd>
                {viewerKind !== "client" ? (
                  <>
                    <dt>Tono</dt>
                    <dd>{openDraft.tone}</dd>
                    <dt>Confianza</dt>
                    <dd>{confidenceLabels[openDraft.confidence]}</dd>
                  </>
                ) : null}
              </dl>
              <div className="mt-2">
                <Button size="sm" variant="ghost" onClick={() => void toggleVersionHistory(openDraft.id)}>
                  {historyDraftId === openDraft.id ? "Ocultar historial" : "Historial de versiones"}
                </Button>
              </div>
                            {historyDraftId === openDraft.id ? (
                              <div className="rounded-md border border-separator bg-surface p-4 text-sm">
                                <p className="font-medium">
                                  Versiones auditables
                                </p>
                                <ol className="mt-2 space-y-2">
                                  {versionHistory.map((version) => (
                                    <li
                                      key={version.id}
                                      className="flex flex-wrap justify-between gap-2 border-b border-separator pb-2 last:border-0 last:pb-0"
                                    >
                                      <span>
                                        v{version.version} ·{" "}
                                        {version.snapshot?.request?.channel ===
                                        "meta_ads"
                                          ? "Meta Ads"
                                          : version.snapshot?.request
                                                ?.channel ===
                                              "instagram_organic"
                                            ? "Instagram"
                                            : "Email / Klaviyo"}{" "}
                                        ·{" "}
                                        {version.change_type === "manual"
                                          ? "edición humana"
                                          : "generada por IA"}
                                      </span>
                                      <span className="text-muted">
                                        {fmtDateTime(version.created_at)}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            ) : null}
            </details>
          </>
        ) : null
      }
      footer={
        openDraft ? (
          decisionDraft?.id === openDraft.id && decisionDraft.decision === "rejected" ? (
            <div className={contentStyles.ask}>
              <Field label="¿Qué cambiarías?">
                <Textarea
                  className="mt-2 min-h-24"
                  value={decisionReason}
                  onChange={(event) => setDecisionReason(event.target.value)}
                  maxLength={2000}
                  placeholder="Ej.: el precio es 49 €, y prefiero otra foto de portada."
                />
              </Field>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setDecisionDraft(null)} disabled={busyDraftId === openDraft.id}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void decideDraft(openDraft.id, "rejected", decisionReason)}
                  disabled={busyDraftId === openDraft.id || !decisionReason.trim()}
                >
                  {busyDraftId === openDraft.id ? "Enviando…" : "Enviar los cambios"}
                </Button>
              </div>
            </div>
          ) : openDraft.status === "pending_approval" ? (
            <>
              <span className={contentStyles.note}>
                {openDraft.scheduled_for ? dueText(openDraft.scheduled_for, contentNow) : "Sin fecha todavía"}
              </span>
              <Button variant="secondary" onClick={() => openDecision(openDraft.id, "rejected")} disabled={busyDraftId === openDraft.id}>
                Pedir cambios
              </Button>
              <Button onClick={() => void decideDraft(openDraft.id, "approved", "")} disabled={busyDraftId === openDraft.id}>
                {busyDraftId === openDraft.id ? "Aprobando…" : "Aprobar"}
              </Button>
            </>
          ) : openDraft.status === "draft" ? (
            <Button onClick={() => void submitDraft(openDraft.id)} disabled={submittingDraftId === openDraft.id}>
              {submittingDraftId === openDraft.id ? "Enviando…" : "Enviar a aprobación"}
            </Button>
          ) : openDraft.status === "approved" ? (
            isInstagramDraft(openDraft) ? (
              <Button onClick={() => void copyInstagramPost(openDraft)}>Copiar post</Button>
            ) : isMetaDraft(openDraft) ? (
              <Button onClick={() => void copyMetaCreative(openDraft)}>Copiar creativo</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => void copyHtml(openDraft.html)}>
                  Copiar HTML
                </Button>
                {/* El envío a Klaviyo deja la plantilla lista en la cuenta del
                    cliente; la campaña y el envío se deciden allí. */}
                <Button onClick={() => void pushToKlaviyo(openDraft)} disabled={pushingDraftId === openDraft.id}>
                  {pushingDraftId === openDraft.id
                    ? "Enviando…"
                    : openDraft.request?.klaviyo_template_id
                      ? "Actualizar en Klaviyo"
                      : "Enviar a Klaviyo"}
                </Button>
              </>
            )
          ) : (
            <span className={contentStyles.note}>{pieceStatusNote(openDraft, viewerKind, contentNow)}</span>
          )
        ) : null
      }
    />
  );


  return (
    // Crear y el constructor de flows son herramientas a pantalla completa:
    // sin el ancho máximo ni el ritmo vertical de las demás pestañas.
    <div className={tab === "crear" || flowBuilderOpen ? "marketing-workspace" : "portal-page marketing-workspace space-y-7"}>
      {/* Los atajos que habia aqui ("Nueva plantilla", "Generar con IA",
          "Importar de Klaviyo") hacian `scrollIntoView` a una tarjeta de mas
          abajo. Existian porque TODO vivia en la misma pagina: crear, revisar,
          importar y medir apilados en un solo scroll. Con las pestañas de
          abajo el atajo es la pestaña, asi que sobran. */}
      {SELF_HEADED_SECTIONS.has(tab) ? null : (
      <div className="mkt-page-header">
        <div className="min-w-0">
          <Heading size="lg" className="mkt-page-title">Revisión de piezas</Heading>
          <p className="mkt-page-description">
            Revisa el contenido pendiente, consulta sus comentarios y sigue el estado de cada pieza.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === "crear" ? (
            <ButtonLink href="/marketing/plantillas" variant="secondary">
              Explorar plantillas
            </ButtonLink>
          ) : tab !== "plan" ? (
            <Button type="button" onClick={() => setTab("crear")}>
              Crear contenido
            </Button>
          ) : null}
        </div>
      </div>
      )}

      {aiRuntimeStatus && !aiRuntimeStatus.configured ? (
        <Banner tone="warn" className="text-sm">
          <strong>La generación de contenido no está disponible ahora.</strong>{" "}
          Puedes seguir preparando briefs y revisando tus piezas. La generación
          se habilitará cuando la conexión de IA esté configurada.
        </Banner>
      ) : null}

      {/* Un modulo, tres trabajos distintos: revisar lo que espera
          decision, crear algo nuevo, y mirar que rindio. Antes los tres
          estaban apilados en el mismo scroll, y por eso hacia falta un
          atajo con scrollIntoView para llegar a cualquiera de ellos. */}
      <Tabs
        value={tab}
        onChange={(value) =>
          setTab(value as (typeof MARKETING_SECTIONS)[number])
        }
        hideNavigation
        items={[
          { value: "plan", label: "Hoy" },
          { value: "campanas", label: "Campañas" },
          { value: "flows", label: "Flows" },
          { value: "plantillas", label: "Plantillas" },
          { value: "audiencias", label: "Audiencias" },
          {
            value: "contenido",
            label: pendingDecisionCount
              ? `Contenido (${pendingDecisionCount})`
              : "Contenido",
          },
          { value: "crear", label: "Crear" },
          { value: "rendimiento", label: "Rendimiento" },
        ]}
        panels={{
          /* Primero de izquierda a derecha porque es lo primero del trabajo:
             que campañas lanzar y cuando. Hasta ahora esa decision no vivia en
             ninguna pantalla -- se tomaba de cabeza y se saltaba directo a
             escribir la pieza. */
          plan: (
            <TodayView
              organizationId={organizationId}
              campaignPlan={campaignPlanQuery.data?.proposal ?? null}
              rows={todayRows}
              items={campaignItems}
              drafts={drafts}
              workspace={klaviyoWorkspace.data}
              onOpenRow={setOpenRow}
              onWritePiece={writePieceFor}
              onOpenDraft={focusDraft}
              onPropose={() => setTab("campanas")}
              onPrepareMailing={() => setIsMailingPlannerOpen(true)}
              onGoTo={setTab}
            />
          ),
          campanas: (
            <>
              {!searchParams.get("campaign") && searchParams.get("acciones") !== "1" && (
                <div className={s.acts}>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setIsMailingPlannerOpen(true)}
                  >
                    Planificar secuencia de emails
                  </Button>
                </div>
              )}
              <CampaignsView
                rows={campaignListRows}
                workspace={klaviyoWorkspace.data}
                organizationId={organizationId}
                organizationName={activeMembership?.organization?.display_name ?? "Cliente"}
                connectionId={activeConnectionId}
                viewer={isConsultantRole ? "consultant" : "client"}
                viewerUserId={bootstrap.profile.id}
                hasConsultant={isConsultantRole ? true : (campaignAgenda?.has_consultant ?? null)}
                campaignId={searchParams.get("campaign")}
                quickActions={searchParams.get("acciones") === "1"}
                itemsLoading={campaignItemsLoading}
                nav={campaignsNav}
                onChanged={reloadMarketing}
                onOpenStudio={(draft) => editInBuilder(draft)}
                onWritePiece={writePieceFor}
                onWriteWithAi={(itemId) =>
                  router.push(`/marketing?section=crear&campaignId=${encodeURIComponent(itemId)}`)
                }
                onOpenRow={setOpenRow}
                onOpenDraft={focusDraft}
                onReviewPlan={() => setIsCampaignProposalOpen(true)}
                onOpenMetaCampaign={(campaignId) => {
                  const params = new URLSearchParams({ organizationId });
                  if (activeConnectionId) params.set("connectionId", activeConnectionId);
                  router.push(`/meta/campanas/${encodeURIComponent(campaignId)}?${params.toString()}`);
                }}
                onPropose={() => setIsCampaignProposalOpen(true)}
                onCreate={() => setTab("crear")}
                onOpenAgenda={() => {
                  const params = new URLSearchParams();
                  if (activeConnectionId) params.set("connectionId", activeConnectionId);
                  router.push(`/planificacion/calendario${params.size ? `?${params.toString()}` : ""}`);
                }}
              />
            </>
          ),
          flows: (
            <FlowsView
              organizationId={organizationId}
              workspace={klaviyoWorkspace.data}
              drafts={drafts}
              onOpenPiece={(draftId) => {
                const draft = drafts.find((item) => item.id === draftId);
                if (draft) editInBuilder(draft);
              }}
              onNewPiece={() => setTab("crear")}
            />
          ),
          plantillas: (
            <TemplatesView
              organizationId={organizationId}
              workspace={klaviyoWorkspace.data}
              drafts={drafts}
              onOpenDraft={focusDraft}
              onCreate={() => setTab("crear")}
              onChanged={reloadMarketing}
            />
          ),
          audiencias: <AudiencesView workspace={klaviyoWorkspace.data} />,
          contenido: (
            <div className="space-y-6">
              {error ? <ErrorBlock>{error}</ErrorBlock> : null}
              {isLoading ? (
                <LoadingBlock label="Cargando el contenido…" />
              ) : (
                <ContentOverview
                  drafts={drafts}
                  viewerKind={viewerKind}
                  now={contentNow}
                  busyId={busyDraftId}
                  onOpen={(id, reply) => {
                    setExpandedDraftId(id);
                    setFocusReply(Boolean(reply));
                  }}
                  onApprove={(id) => void decideDraft(id, "approved", "")}
                />
              )}
              {contentDrawer}
            </div>
          ),
          crear: organizationId ? (
            <div className="space-y-3">
              {studioOpen?.draft.request?.camino_task ? (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-separator bg-surface px-4 py-3 text-sm">
                  <div className="min-w-0 space-y-1">
                    <p>
                      Borrador creado desde Mi Camino: <strong>{studioOpen.draft.request.camino_task.title}</strong>
                      {studioOpen.draft.request.camino_task.milestone_name
                        ? ` · Hito: ${studioOpen.draft.request.camino_task.milestone_name}`
                        : ""}
                    </p>
                    <p className="max-w-4xl text-xs text-muted">
                      Antes de enviarlo a aprobación, revisa oferta y condiciones, audiencia y elegibilidad, fecha y horario, disponibilidad, contenido, enlaces y medición. La pieza no se envía a Klaviyo hasta que una persona la apruebe.
                    </p>
                  </div>
                  <ButtonLink href="/camino" size="sm" variant="secondary">
                    Volver a Mi Camino
                  </ButtonLink>
                </div>
              ) : null}
              <ContentStudio
                key={organizationId}
                organizationId={organizationId}
                connectionId={activeConnectionId || null}
                storeName={activeMembership?.organization?.display_name ?? "Tu tienda"}
                workspace={klaviyoWorkspace.data}
                drafts={drafts}
                campaignTarget={campaignTarget}
                onClearCampaignTarget={() => setCampaignTarget(null)}
                openRequest={studioOpen}
                startTemplate={systemTemplateId}
                onTemplateStarted={() => router.replace("/marketing?section=crear", { scroll: false })}
                aiReady={aiRuntimeStatus?.configured !== false}
                onDraftsChanged={() => void loadDrafts()}
                onCreated={(draftId) => void linkStudioDraft(draftId)}
              />
            </div>
          ) : null,
          rendimiento: (
            <div className={s.root}>
              <div className={s.head}>
                <div>
                  <h1>Rendimiento</h1>
                  <p>Qué ha traído el email, separado entre flows y campañas.</p>
                </div>
                <div className={s.chips} role="group" aria-label="Periodo">
                  {["7", "30", "90"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={s.chip}
                      aria-pressed={performanceDays === value}
                      onClick={() => setPerformanceDays(value)}
                    >
                      {value} días
                    </button>
                  ))}
                </div>
              </div>
              <KlaviyoPerformance workspace={klaviyoWorkspace.data} isLoading={klaviyoWorkspace.isLoading} storeCurrency={attribution.shopify?.currency_code} />
              <CollapsibleSection title="Comparar con Meta y Shopify">
            <div className="mkt-performance-tab">
              <PerformanceTab
                days={performanceDays}
                onDaysChange={setPerformanceDays}
                klaviyo={attribution.klaviyo}
                klaviyoCurrency={klaviyoWorkspace.data?.account?.currency}
                meta={attribution.meta}
                shopify={attribution.shopify}
                isLoading={attribution.isLoading}
              />
            </div>
              </CollapsibleSection>
            </div>
          ),
        }}
      />

              <Dialog
                isOpen={isMailingPlannerOpen}
                onOpenChange={setIsMailingPlannerOpen}
                size="xl"
                title="Crear secuencia semanal de emails"
              >
                <WeeklyMailingPlanner
                  organizationId={organizationId}
                  storeConnectionId={activeConnectionId}
                  isOpen={isMailingPlannerOpen}
                  onGenerated={async () => {
                    await Promise.all([
                      loadDrafts(),
                      reloadCampaignItems(),
                    ]);
                    setIsMailingPlannerOpen(false);
                    setTab("contenido");
                  }}
                />
              </Dialog>
              <Dialog
                isOpen={isCampaignProposalOpen}
                onOpenChange={setIsCampaignProposalOpen}
                size="xl"
                title="Planificar campañas con A05"
              >
                <CampaignPlanProposal
                  organizationId={organizationId}
                  connectionId={activeConnectionId || undefined}
                  initialBrief={campaignProposalBrief}
                  redirectOnComplete={false}
                  onProposed={() => {
                    campaignPlanQuery.reload();
                    void reloadCampaignItems();
                  }}
                  onApplied={(complete) => {
                    void loadDrafts();
                    void reloadCampaignItems();
                    campaignPlanQuery.reload();
                    if (complete) {
                      setIsCampaignProposalOpen(false);
                      setTab("campanas");
                    }
                  }}
                  onRejected={() => {
                    campaignPlanQuery.reload();
                    void reloadCampaignItems();
                    setIsCampaignProposalOpen(false);
                  }}
                />
              </Dialog>

      <CampaignDrawer
        row={openRow}
        organizationId={organizationId}
        workspace={klaviyoWorkspace.data}
        onClose={() => setOpenRow(null)}
        onChanged={reloadMarketing}
        onWritePiece={(item) => {
          setOpenRow(null);
          writePieceFor(item);
        }}
        onOpenDraft={(draftId) => {
          setOpenRow(null);
          focusDraft(draftId);
        }}
      />
    </div>
  );
}

// --- Estado "vista general" de /marketing (consultor sin cliente activo):
// espejo de todo lo que crean los clientes + objeciones del consultor. ---

type ConsultantMarketingDraft = {
  id: string;
  organization_id: string;
  organization_name: string;
  content_type: string;
  status: MarketingDraft["status"];
  template_name: string;
  subject: string;
  summary: string;
  purpose: string;
  audience: string;
  locale: string;
  tone: string;
  plain_text: string;
  html: string;
  confidence: MarketingDraft["confidence"];
  version: number;
  created_at: string;
  updated_at: string;
  scheduled_for: string | null;
  decision_reason: string | null;
  request: {
    channel?: string;
    objective?: string;
    brief?: string;
    source?: string;
  } | null;
  note_count: number;
  thread: PieceThread | null;
};

type DraftNote = {
  id: string;
  body: string;
  author_user_id: string | null;
  author_name: string | null;
  author_kind: DraftAuthorKind | null;
  created_at: string;
};

function ConsultantMarketingDraftPanel({
  draft,
  onChanged,
}: {
  draft: ConsultantMarketingDraft;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState<DraftNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState<null | "note" | "reject" | "approve">(null);
  const [error, setError] = useState<string | null>(null);
  const askCopilot = useCopilotAsk();

  const base = `/v1/organizations/${draft.organization_id}/marketing/drafts/${draft.id}`;

  // El consultor analiza la pieza del cliente con el mismo copiloto y con la
  // misma pregunta que usaría el cliente. Si guarda la respuesta, cae en el
  // hilo de la pieza y el cliente la ve ahí: por eso la conversación es el
  // sitio donde vive el análisis, y no el chat.
  function analyze() {
    askCopilot({
      question: buildPieceAnalysisQuestion({
        template_name: draft.template_name,
        subject: draft.subject,
        // El espejo del consultor no trae preheader: el análisis se hace con
        // lo que hay (asunto y cuerpo), no se inventa el que falta.
        preheader: "",
        plain_text: draft.plain_text,
        status: statusLabel[draft.status],
        purpose: draft.purpose,
        audience: draft.audience,
        channel: draft.request?.channel,
      }),
      focusLabel: `${draft.template_name || draft.subject || "Pieza"} · ${draft.organization_name}`,
      reference: { kind: "entity", entity: { type: "marketing_draft", id: draft.id } },
      saveAnswer: async (text) => {
        const response = await apiFetch(`${base}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text, from_ai: true }),
        });
        if (!response.ok) throw new Error(await readApiError(response));
        await loadNotes();
        onChanged();
      },
    });
  }

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const response = await apiFetch(`${base}/notes`);
      if (response.ok) {
        setNotes(((await response.json()) as { notes: DraftNote[] }).notes);
      }
    } finally {
      setNotesLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  async function addNote() {
    if (!noteDraft.trim()) return;
    setBusy("note");
    setError(null);
    try {
      const response = await apiFetch(`${base}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteDraft.trim() }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNoteDraft("");
      await loadNotes();
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision === "approved" ? "approve" : "reject");
    setError(null);
    try {
      if (decision === "rejected" && noteDraft.trim()) {
        await apiFetch(`${base}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: noteDraft.trim() }),
        });
      }
      const response = await apiFetch(`${base}/decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reason: decision === "rejected" ? noteDraft.trim() || null : null,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNoteDraft("");
      await loadNotes();
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 grid gap-4 border-t border-separator pt-4 lg:grid-cols-2">
      <div className="space-y-2 text-sm">
        <p className={EYEBROW}>Asunto</p>
        <p className="font-medium">{draft.subject || "—"}</p>
        <p className="text-muted">{draft.summary}</p>
        <p className="text-xs text-muted">
          Propósito: {draft.purpose} · Audiencia: {draft.audience}
        </p>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap border border-separator bg-surface p-3 text-xs leading-5">
          {draft.plain_text}
        </pre>
      </div>

      <div className="space-y-3">
        <SchedulePublicationBlock
          organizationId={draft.organization_id}
          draftId={draft.id}
          scheduledFor={draft.scheduled_for}
          onChanged={onChanged}
        />
        <p className={EYEBROW}>Conversación con el cliente</p>
        {notesLoading ? (
          <p className="text-sm text-muted">Cargando...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted">Sin mensajes todavía.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => {
              if (note.body.startsWith("📅")) {
                return (
                  <p key={note.id} className="text-center text-xs text-muted">
                    {note.body} · {fmtDateTime(note.created_at)}
                  </p>
                );
              }
              const kind = note.author_kind ?? "consultant";
              return (
                <div
                  key={note.id}
                  className={`rounded-md border p-3 text-sm ${
                    kind === "client"
                      ? "border-separator bg-surface"
                      : "border-accent/30 bg-accent-soft/30"
                  }`}
                >
                  <p className="leading-6 whitespace-pre-wrap">{note.body}</p>
                  <p className="text-xs text-muted">
                    {note.author_name ?? authorKindLabel[kind]} ·{" "}
                    {authorKindLabel[kind]} · {fmtDateTime(note.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {error ? <ErrorBlock>{error}</ErrorBlock> : null}

        <Textarea
          aria-label="Nueva objeción"
          placeholder="Escribe una objeción u observación para el cliente..."
          className="h-20"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy !== null || !noteDraft.trim()}
            onClick={() => void addNote()}
          >
            {busy === "note" ? "Guardando..." : "Añadir objeción"}
          </Button>
          <Button size="sm" variant="ghost" onClick={analyze}>
            Analizar con el Consultor IA
          </Button>
          {["draft", "pending_approval"].includes(draft.status) ? (
            <>
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => void decide("approved")}
              >
                {busy === "approve" ? "..." : "Aprobar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void decide("rejected")}
              >
                {busy === "reject" ? "..." : "Rechazar con objeción"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ConsultantMarketingView({
  viewerKind,
}: {
  viewerKind: DraftAuthorKind;
}) {
  const { setOrganizationId } = useActiveOrganization();
  const marketingQuery = useCachedQuery<{
    organizations: Array<{ id: string; display_name: string }>;
    drafts: ConsultantMarketingDraft[];
  }>("/v1/consultant/marketing");
  const data = marketingQuery.data ?? null;
  const error = marketingQuery.error
    ? "No se pudo cargar el marketing de la cartera. Revisa la conexión e inténtalo de nuevo."
    : null;
  const isLoading = marketingQuery.isLoading;
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    marketingQuery.reload();
  }, [marketingQuery.reload]);

  if (isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando marketing de la cartera..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="portal-page">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!data) return null;

  const pending = data.drafts.filter(
    (draft) => draft.status === "pending_approval",
  ).length;
  const rows = data.drafts
    .filter(
      (draft) =>
        clientFilter === "all" || draft.organization_id === clientFilter,
    )
    .filter((draft) => statusFilter === "all" || draft.status === statusFilter);

  const scheduled = data.drafts.filter(
    (draft) =>
      draft.scheduled_for &&
      (clientFilter === "all" || draft.organization_id === clientFilter),
  );

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <UpcomingPublications
        title="Calendario de publicaciones · cartera"
        entries={scheduled.map((draft) => ({
          id: draft.id,
          title: draft.template_name || draft.subject || "Publicación",
          meta: `${draft.organization_name} · ${
            draftStatusLabels[draft.status] ?? draft.status
          }`,
          scheduledFor: draft.scheduled_for as string,
          channel: draft.request?.channel,
          noteCount: draft.note_count,
          onOpen: () => setExpandedId(draft.id),
        }))}
      />

      <Card
        title="Marketing · toda la cartera"
        description={`${data.drafts.length} borradores · ${pending} pendientes de aprobar. Espejo de lo que crean tus clientes.`}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            className="w-52"
            aria-label="Filtrar por cliente"
            value={clientFilter}
            onChange={setClientFilter}
            options={[
              { value: "all", label: "Todos los clientes" },
              ...data.organizations.map((organization) => ({
                value: organization.id,
                label: organization.display_name,
              })),
            ]}
          />
          <Select
            className="w-52"
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "Todos los estados" },
              { value: "pending_approval", label: "Pendiente de aprobación" },
              { value: "draft", label: "Borrador" },
              { value: "approved", label: "Aprobado" },
              { value: "rejected", label: "Rechazado" },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Sin borradores para este filtro"
            hint="Los clientes generan contenido desde su propio panel de Marketing."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((draft) => (
                <DraftMiniCard
                  key={draft.id}
                  html={draft.html}
                  channel={draft.request?.channel}
                  subject={draft.subject}
                  body={draft.plain_text}
                  title={draft.template_name || draft.subject}
                  status={draft.status}
                  thread={draft.thread}
                  viewerKind={viewerKind}
                  metaLine={
                    <>
                      {draft.organization_name} ·{" "}
                      {contentTypeLabels[draft.content_type] ??
                        draft.content_type}{" "}
                      · v{draft.version} · {fmtDate(draft.updated_at)}
                      {draft.note_count > 0
                        ? ` · ${draft.note_count} objeci${draft.note_count === 1 ? "ón" : "ones"}`
                        : ""}
                    </>
                  }
                  selected={expandedId === draft.id}
                  onToggle={() =>
                    setExpandedId(expandedId === draft.id ? null : draft.id)
                  }
                />
              ))}
            </div>
            {rows
              .filter((draft) => draft.id === expandedId)
              .map((draft) => (
                <div
                  key={draft.id}
                  className="mt-4 border-t border-separator pt-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {draft.template_name} · {draft.organization_name}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setOrganizationId(draft.organization_id);
                        toast.success(`Ahora ves ${draft.organization_name}`);
                      }}
                    >
                      Ir al cliente
                    </Button>
                  </div>
                  <ConsultantMarketingDraftPanel
                    draft={draft}
                    onChanged={load}
                  />
                </div>
              ))}
          </>
        )}
      </Card>
    </div>
  );
}

/** Campañas del consultor sin cliente elegido: la cartera entera. */
function PortfolioCampaignsRoute() {
  const nav = useCampaignsNav();
  return <PortfolioCampaigns nav={nav} />;
}

function MarketingRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const searchParams = useSearchParams();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (isConsultant && !organizationId) {
    if (searchParams.get("section") === "campanas") return <PortfolioCampaignsRoute />;
    return (
      <ConsultantMarketingView
        viewerKind={
          bootstrap.profile.platform_role === "platform_admin"
            ? "platform"
            : "consultant"
        }
      />
    );
  }

  return <MarketingContent bootstrap={bootstrap} />;
}

export default function MarketingPage() {
  const { bootstrap } = useMarketingPortal();
  return <MarketingRouter bootstrap={bootstrap} />;
}
