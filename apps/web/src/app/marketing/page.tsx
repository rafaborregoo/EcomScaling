"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { buildMarketingBrief } from "@/lib/marketing-brief";
import { formatMoney } from "@/lib/money";
import { ModuleSummary } from "@/components/module-summary";
import { CampaignPlanProposal } from "@/components/campaign-plan-proposal";
import { isUpcoming, isWithinLastDays } from "@/lib/elapsed";
import {
  useMarketingDrafts,
  type MarketingDraft,
} from "@/hooks/use-marketing-drafts";
import { KlaviyoImportPanel } from "./klaviyo-import-panel";
import { MetaAdPlanBlock } from "./meta-ad-plan-block";
import {
  getMetaCallToAction,
  getMetaDestinationUrl,
  isInstagramDraft,
  isMetaDraft,
  isSocialDraft,
} from "./meta-ad-plan";
import {
  ChannelBadge,
  channelStyle,
  toChannel,
} from "@/components/marketing-channel";
import {
  linkDraftToCampaign,
  useCampaignItems,
  useCampaignResources,
  type CampaignItem,
} from "@/hooks/use-campaign-items";
import { useAttributionReport } from "@/hooks/use-attribution-report";
import { useActiveConnection } from "@/components/active-connection";
import { CampaignThread } from "./campaign-thread";
import { DraftCampaignLink } from "./draft-campaign-link";
import { PerformanceTab } from "./performance-tab";
import { fmtDate, fmtDateTime, fmtSchedule, toDatetimeLocal } from "./format";
import { TemplateBuilder } from "./template-builder";
import {
  collectMergeTokens,
  insertMergeField,
  MERGE_FIELDS,
  type MergeField,
} from "./template-fields";
import { useCopilotAsk } from "@/components/copilot-ask";
import {
  buildPieceAnalysisQuestion,
  isTemplateInUse,
  threadIndicator,
  type AnalyzablePiece,
  type PieceThread,
} from "./piece-analysis";
import {
  defaultDesign,
  designFromAiBlocks,
  renderTemplateHtml,
  templatePlainText,
  type TemplateDesign,
} from "./template-design";
import {
  AsyncState,
  LoadingBlock,
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  Form,
  Heading,
  Input,
  List,
  Select,
  Dropdown,
  Label,
  MessageIcon,
  Tabs,
  Textarea,
  toast,
  UploadButton,
  type Tone,
} from "@/components/ui";

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

type MarketingIntegrationReadiness = {
  configuration:
    | "configured"
    | "credentials_missing"
    | "feature_disabled"
    | "not_implemented";
  connectionStatus: string | null;
  connectionId: string | null;
};

type MarketingIntegrationsPayload = {
  providers?: Array<{
    id: string;
    configuration?: {
      status?: MarketingIntegrationReadiness["configuration"];
    };
    connection?: { id?: string; status?: string } | null;
  }>;
};

const statusLabel: Record<MarketingDraft["status"], string> = {
  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  approved: "Listo para copiar",
  rejected: "Rechazado",
  published: "Publicado",
};

const statusTone: Record<MarketingDraft["status"], Tone> = {
  draft: "neutral",
  pending_approval: "warn",
  approved: "success",
  rejected: "danger",
  published: "success",
};

const contentTypeOptions = [
  { value: "campaign", label: "Campaña / broadcast" },
  { value: "flow_step", label: "Email de flow" },
  { value: "popup", label: "Popup / formulario" },
];

const contentTypeLabels: Record<string, string> = {
  campaign: "Campaña / broadcast",
  flow_step: "Email de flow",
  popup: "Popup / formulario",
};

const draftStatusLabels: Record<string, string> = {
  draft: "Borrador",
  pending_approval: "Pendiente de aprobación",
  approved: "Aprobado",
  rejected: "Rechazado",
  published: "Publicado",
};

const campaignChannelOptions = [
  { value: "email_klaviyo", label: "Email / Klaviyo" },
  { value: "meta_ads", label: "Paid social / Meta Ads" },
  { value: "instagram_organic", label: "Instagram / orgánico" },
];

const campaignObjectiveOptions = [
  { value: "conversion", label: "Conversión / ventas" },
  { value: "launch", label: "Lanzamiento" },
  { value: "retention", label: "Retención / recompra" },
  { value: "engagement", label: "Engagement" },
  { value: "winback", label: "Reactivación" },
];

// El objetivo de negocio que usa Claude no es el mismo contrato que espera
// Meta. Se mantienen separados para no enviar valores internos como
// `conversion` al endpoint de creación cuando se active el conector.
const campaignToneOptions = [
  { value: "brand", label: "Alineado con la marca" },
  { value: "direct", label: "Directo y orientado a venta" },
  { value: "educational", label: "Educativo" },
  { value: "warm", label: "Cercano y cálido" },
  { value: "urgent", label: "Urgente, sin presión artificial" },
];

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

/**
 * Una fila de la cabecera del compositor: etiqueta a la izquierda, valor al
 * lado. Es la forma de una ventana de correo, y esa forma es la que dice qué
 * estás preparando — antes eran campos sueltos en una rejilla encima del
 * editor y no se leía como un email.
 */
function ComposerRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-separator px-3 py-2">
      <span className={`w-24 shrink-0 ${EYEBROW}`}>{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
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
    status: statusLabel[draft.status],
    purpose: draft.purpose,
    audience: draft.audience,
    channel: draft.request?.channel,
    campaignTitle: draft.campaign_item?.title ?? null,
  };
}

/**
 * Rejilla de piezas. La usan las dos secciones del cliente (plantillas en uso
 * y borradores) con la misma tarjeta: son el mismo objeto en dos momentos de
 * su vida, no dos cosas distintas.
 */
function PieceGrid({
  pieces,
  expandedId,
  viewerKind,
  onToggle,
}: {
  pieces: MarketingDraft[];
  expandedId: string | null;
  viewerKind: DraftAuthorKind;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {pieces.map((draft) => (
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
              {/* Para que existe esta pieza, antes que cuando se creo: es lo
                  que se busca al mirar. */}
              {draft.campaign_item
                ? `Para «${draft.campaign_item.title}» · `
                : ""}
              {contentTypeLabels[draft.content_type] ?? draft.content_type} ·{" "}
              {fmtDate(draft.created_at)}
              {draft.request?.source === "klaviyo_import"
                ? " · de Klaviyo"
                : ""}
            </>
          }
          selected={expandedId === draft.id}
          onToggle={() => onToggle(draft.id)}
        />
      ))}
    </div>
  );
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
  onChanged,
}: {
  organizationId: string;
  draftId: string;
  viewerKind: DraftAuthorKind;
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
  const [tab, setTab] = useState("plan");
  // Campaña para la que se esta escribiendo. Es lo que convierte "generar
  // contenido" en "sacar ESTA campaña": al terminar, la pieza queda enlazada.
  const [campaignTarget, setCampaignTarget] = useState<CampaignItem | null>(
    null,
  );
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(
    null,
  );
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [showKlaviyoImport, setShowKlaviyoImport] = useState(false);
  const [contentType, setContentType] = useState("campaign");
  const [channel, setChannel] = useState("email_klaviyo");
  const [objective, setObjective] = useState("conversion");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [tone, setTone] = useState("brand");
  const [cta, setCta] = useState("");
  const [brief, setBrief] = useState("");
  // AI-11 "Plantilla con marca": paleta de colores + textos literales que la IA
  // debe respetar, ademas del contexto de empresa.
  const [genMode, setGenMode] = useState<"campaign" | "template">("campaign");
  const [design, setDesign] = useState<TemplateDesign>(() => defaultDesign());
  const [templateName, setTemplateName] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  // La cabecera del email: quién lo manda, qué se lee en la bandeja antes de
  // abrirlo. Se guardan con la plantilla porque forman parte de ella.
  const [templatePreheader, setTemplatePreheader] = useState("");
  const [templateFromName, setTemplateFromName] = useState("");
  const [templateReplyTo, setTemplateReplyTo] = useState("");
  // Bloque que el editor tiene seleccionado: es donde cae "Insertar campo".
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  // #4: imágenes para "Mejorar con IA" — referencia (guía de estilo) o
  // contenido (la IA las coloca como bloques). Ya subidas al bucket propio.
  const [aiImages, setAiImages] = useState<
    Array<{ url: string; role: "referencia" | "contenido" }>
  >([]);
  const brandColors: Record<string, string> = {
    primary: design.styles.primary,
    background: design.styles.background,
    text: design.styles.text,
  };
  const [isGenerating, setIsGenerating] = useState(false);
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
  const [previewTab, setPreviewTab] = useState("preview");
  const [versionHistory, setVersionHistory] = useState<MarketingDraftVersion[]>(
    [],
  );
  const aiRuntimeQuery = useCachedQuery<AiRuntimeStatus>("/v1/ai/status");
  const integrationsQuery = useCachedQuery<MarketingIntegrationsPayload>(
    organizationId ? `/v1/organizations/${organizationId}/integrations` : null,
  );
  const aiRuntimeStatus = aiRuntimeQuery.data ?? null;
  const integrationReadiness: Record<string, MarketingIntegrationReadiness> =
    Object.fromEntries(
      (integrationsQuery.data?.providers ?? []).map((provider) => [
        provider.id,
        {
          configuration: provider.configuration?.status ?? "not_implemented",
          connectionStatus: provider.connection?.status ?? null,
          connectionId: provider.connection?.id ?? null,
        },
      ]),
    );

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
  } = useMarketingDrafts(organizationId, canView);

  // Las dos secciones de Contenido. Una pieza aprobada o publicada ya es
  // material de la casa; el resto sigue en revisión.
  const piecesInUse = drafts.filter((draft) => isTemplateInUse(draft.status));
  const piecesInProgress = drafts.filter(
    (draft) => !isTemplateInUse(draft.status),
  );

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
    isLoading: isLoadingCampaignItems,
    reload: reloadCampaignItems,
  } = useCampaignItems(organizationId);
  const campaignResources = useCampaignResources(organizationId);

  // El tramo final del hilo. Una sola carga para los tres sitios que la
  // necesitan (la tira de KPIs, el resultado por campaña en Plan y la pestaña
  // Rendimiento), con el periodo compartido: si cada uno pidiera el suyo, la
  // misma cifra saldria distinta en dos pantallas a la vez.
  const [performanceDays, setPerformanceDays] = useState("30");
  // El panel de rendimiento se lee de la tienda activa del selector: con dos
  // tiendas en el mismo cliente, el agregado no es de ninguna de las dos.
  const { connectionId: activeConnectionId } = useActiveConnection();
  const attribution = useAttributionReport(
    organizationId,
    Number(performanceDays),
    activeConnectionId,
  );

  // Blocker: el diseño del editor vive en estado local. Al cambiar de tienda,
  // reiníciazlo para no arrastrar (ni guardar por error) el diseño de otro
  // cliente. El primer render no cuenta.
  const previousOrgRef = useRef(organizationId);
  useEffect(() => {
    if (previousOrgRef.current === organizationId) return;
    previousOrgRef.current = organizationId;
    setDesign(defaultDesign());
    setTemplateName("");
    setTemplateSubject("");
    setAiImages([]);
    setExpandedDraftId(null);
  }, [organizationId]);

  // Blocker: avisar antes de perder un diseño sin guardar (refresh, cerrar
  // pestaña, navegar fuera).
  useEffect(() => {
    const hasUnsavedDesign = genMode === "template" && design.blocks.length > 0;
    if (!hasUnsavedDesign) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [genMode, design.blocks.length]);

  async function generateDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    const isTemplate = genMode === "template";
    // "Mejorar con IA" puede ir sin instrucciones: hay un diseño de partida y
    // el default basta para que la IA lo pula.
    const canImproveDesign = isTemplate && design.blocks.length > 0;
    if (!brief.trim() && !canImproveDesign) return;
    const effectiveInstructions =
      brief.trim() ||
      "Mejora el copy, la jerarquía y la coherencia del diseño actual con el contexto de la empresa. No inventes precios, descuentos ni datos que no estén en el diseño.";
    const structuredBrief = isTemplate
      ? buildMarketingBrief({
          channel: "email_klaviyo",
          objective,
          audience,
          offer,
          tone,
          cta,
          instructions: effectiveInstructions,
        })
      : buildMarketingBrief({
          channel,
          objective,
          audience,
          offer,
          tone,
          cta,
          instructions: effectiveInstructions,
        });
    setIsGenerating(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isTemplate
              ? {
                  content_type: "campaign",
                  channel: "email_klaviyo",
                  brief: structuredBrief,
                  brand_colors: brandColors,
                  ...(design.blocks.length > 0 ? { base_design: design } : {}),
                  ...(aiImages.length > 0
                    ? {
                        reference_image_urls: aiImages
                          .filter((image) => image.role === "referencia")
                          .map((image) => image.url),
                        content_image_urls: aiImages
                          .filter((image) => image.role === "contenido")
                          .map((image) => image.url),
                      }
                    : {}),
                }
              : {
                  content_type: contentType,
                  channel,
                  brief: structuredBrief,
                },
          ),
        },
        // La generación llama a un LLM con tools + salida estructurada: 20-90s.
        // El timeout por defecto de 15s abortaba y lo reportaba como "error de red".
        180_000,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        draft?: { id?: string };
      } | null;
      setBrief("");
      setAudience("");
      setOffer("");
      setCta("");
      // Cierra el hilo: la pieza recien escrita queda colgada de la campaña
      // que la pidio. Si el enlace falla, el borrador ya existe y se puede
      // enlazar a mano desde su detalle, asi que no se trata como un error de
      // la generacion.
      if (campaignTarget && body?.draft?.id) {
        const linked = await linkDraftToCampaign(
          organizationId,
          campaignTarget.id,
          body.draft.id,
        ).catch(() => null);
        if (linked?.ok) await reloadCampaignItems();
        else
          toast.danger(
            "El borrador se creó, pero no se pudo enlazar a la campaña.",
          );
        setCampaignTarget(null);
      }
      toast.success("Borrador generado y pendiente de revisión");
      await loadDrafts();
      if (body?.draft?.id) focusDraft(body.draft.id);
    } catch {
      setError(
        "No se pudo generar el borrador por un error de red. Reintenta.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function editInBuilder(draft: MarketingDraft) {
    const next = draft.request?.design
      ? draft.request.design
      : Array.isArray(draft.blocks) && draft.blocks.length > 0
        ? designFromAiBlocks(draft.blocks, design.styles)
        : null;
    if (!next) return;
    setDesign(next);
    setTemplateName(draft.template_name);
    setTemplateSubject(draft.subject);
    setTemplatePreheader(draft.preheader);
    setTemplateFromName(draft.from_name);
    setTemplateReplyTo(draft.reply_to ?? "");
    setGenMode("template");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Plantilla cargada en el editor");
  }

  /**
   * "Insertar campo": el token cae en el bloque que tengas seleccionado y, si
   * no hay ninguno, en el asunto. Siempre dice dónde ha caído: un token que
   * aparece en un sitio que no mirabas se descubre en el email enviado.
   */
  function insertField(field: MergeField) {
    const next = insertMergeField(design, selectedBlockId, field.token);
    if (next) {
      setDesign(next);
      toast.success(`${field.label} insertado en el bloque seleccionado`);
      return;
    }
    setTemplateSubject((current) =>
      `${current}${current && !current.endsWith(" ") ? " " : ""}${field.token}`.slice(
        0,
        255,
      ),
    );
    toast.success(
      selectedBlockId
        ? `Ese bloque no lleva texto: ${field.label} va al asunto`
        : `${field.label} insertado en el asunto`,
    );
  }

  async function uploadTemplateImage(file: File): Promise<string> {
    if (!organizationId) throw new Error("No hay tienda seleccionada.");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(file);
    });
    const response = await apiFetch(
      `/v1/organizations/${organizationId}/marketing/assets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_base64: dataUrl }),
      },
      60_000,
    );
    if (!response.ok) throw new Error(await readApiError(response));
    return ((await response.json()) as { url: string }).url;
  }

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
    setCampaignTarget(item);
    setGenMode("campaign");
    // `toChannel` devuelve justo los tres valores del selector del generador.
    setChannel(toChannel(item.channel));
    setBrief([item.title, item.description].filter(Boolean).join("\n\n"));
    setTab("crear");
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

  async function saveManualTemplate() {
    if (!organizationId || design.blocks.length === 0) return;
    setIsSavingTemplate(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/manual`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName.trim() || "Plantilla sin nombre",
            subject: templateSubject.trim() || templateName.trim(),
            preheader: templatePreheader.trim(),
            from_name: templateFromName.trim(),
            reply_to: templateReplyTo.trim() || null,
            design,
            html: renderTemplateHtml(design),
            plain_text: templatePlainText(design),
            // Los tokens se leen del contenido, no se declaran a mano: así la
            // lista que revisa el consultor no puede quedarse mintiendo.
            personalization_tokens: collectMergeTokens(
              renderTemplateHtml(design),
              templateSubject,
              templatePreheader,
            ),
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        draft?: { id?: string };
      } | null;
      toast.success("Plantilla guardada como borrador");
      await loadDrafts();
      if (body?.draft?.id) focusDraft(body.draft.id);
    } catch {
      setError(
        "No se pudo guardar la plantilla por un error de red. Reintenta.",
      );
    } finally {
      setIsSavingTemplate(false);
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
          ? "Borrador aprobado para copiar"
          : "Borrador rechazado",
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

  // `isUpcoming` vive en @/lib/elapsed porque `Date.now()` no es puro y
  // llamarlo en el cuerpo del render lo marca `react-hooks/purity`. Se calcula
  // una vez y ordenado: la tira lo usaba dos veces, recorriendo y ordenando la
  // lista entera dentro de un IIFE en medio del JSX.
  const scheduledDrafts = drafts
    .filter((draft) => isUpcoming(draft.scheduled_for))
    .sort(
      (a, b) =>
        Date.parse(a.scheduled_for as string) -
        Date.parse(b.scheduled_for as string),
    );

  return (
    <div className="portal-page space-y-5">
      {/* Los atajos que habia aqui ("Nueva plantilla", "Generar con IA",
          "Importar de Klaviyo") hacian `scrollIntoView` a una tarjeta de mas
          abajo. Existian porque TODO vivia en la misma pagina: crear, revisar,
          importar y medir apilados en un solo scroll. Con las pestañas de
          abajo el atajo es la pestaña, asi que sobran. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading size="lg">Marketing</Heading>
        <ButtonLink href="/marketing/imagenes" variant="secondary">
          Banco de imágenes
        </ButtonLink>
      </div>

      {/* Estado real del canal antes de generar nada más: qué espera decisión,
          qué va a salir y qué ha rendido lo ya enviado. El ingreso se nombra
          como atribuido por Klaviyo (ADR-0021): no es venta Shopify y no se
          suma con la de otras plataformas. */}
      <ModuleSummary
        metrics={[
          {
            label: "Pendientes de decisión",
            value: drafts
              .filter((draft) =>
                ["draft", "pending_approval"].includes(draft.status),
              )
              .length.toLocaleString("es-ES"),
            tone: drafts.some((draft) =>
              ["draft", "pending_approval"].includes(draft.status),
            )
              ? "warn"
              : "success",
          },
          {
            label: "Programadas",
            value: scheduledDrafts.length.toLocaleString("es-ES"),
            hint: scheduledDrafts[0]?.scheduled_for
              ? `Próxima: ${fmtDate(scheduledDrafts[0].scheduled_for as string)}`
              : undefined,
          },
          {
            label: "Publicadas · 30 días",
            value: drafts
              .filter(
                (draft) =>
                  draft.status === "published" &&
                  isWithinLastDays(draft.updated_at, 30),
              )
              .length.toLocaleString("es-ES"),
          },
          {
            label: "EUR atribuidos por Klaviyo",
            value: attribution.klaviyo?.connected
              ? formatMoney(attribution.klaviyo.totals.revenue, "EUR")
              : "Sin datos",
            hint: attribution.klaviyo?.connected
              ? `${attribution.klaviyo.totals.conversions.toLocaleString("es-ES")} conversiones atribuidas · ${performanceDays} d`
              : "Conecta Klaviyo para medir el email",
          },
        ]}
      />

      {aiRuntimeStatus && !aiRuntimeStatus.configured ? (
        <Banner tone="warn" className="text-sm">
          <strong>IA preparada.</strong> Falta configurar un proveedor IA
          (Anthropic/Claude u OpenAI) en el servidor. Puedes preparar briefs y
          planes Meta en dry-run; la generación se habilitará al añadir las
          credenciales, sin cambiar esta interfaz.
        </Banner>
      ) : null}

      {/* Un modulo, tres trabajos distintos: revisar lo que espera
          decision, crear algo nuevo, y mirar que rindio. Antes los tres
          estaban apilados en el mismo scroll, y por eso hacia falta un
          atajo con scrollIntoView para llegar a cualquiera de ellos. */}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "plan", label: "Plan" },
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
            <div className="space-y-6">
              {/* Primero lo que ya esta decidido, despues la propuesta nueva:
                  la pestaña abria vacia aunque el calendario tuviera campañas
                  dentro, porque solo sabia enseñar la ultima propuesta. */}
              <CampaignThread
                organizationId={organizationId}
                items={campaignItems}
                isLoading={isLoadingCampaignItems}
                drafts={drafts}
                klaviyo={attribution.klaviyo}
                meta={attribution.meta}
                resources={campaignResources}
                onOpenDraft={focusDraft}
                onWritePiece={writePieceFor}
                onChanged={() => {
                  void reloadCampaignItems();
                  void attribution.reload();
                }}
              />
              <CampaignPlanProposal
                organizationId={organizationId}
                onApplied={() => {
                  void loadDrafts();
                  void reloadCampaignItems();
                }}
              />
            </div>
          ),
          contenido: (
            <div className="space-y-6">
              {error ? <ErrorBlock>{error}</ErrorBlock> : null}
              <UpcomingPublications
                entries={drafts
                  .filter((draft) => draft.scheduled_for)
                  .map((draft) => ({
                    id: draft.id,
                    title:
                      draft.template_name || draft.subject || "Publicación",
                    meta: `${contentTypeLabels[draft.content_type] ?? draft.content_type} · ${
                      draftStatusLabels[draft.status] ?? draft.status
                    }`,
                    scheduledFor: draft.scheduled_for as string,
                    channel: draft.request?.channel,
                    noteCount: draft.thread?.count ?? 0,
                    onOpen: () => focusDraft(draft.id),
                  }))}
              />
              {/* Dos secciones, no un filtro de estado: lo que ya se usa y lo
                que aún se está cocinando son dos trabajos distintos. Con un
                Select delante, la mitad del material quedaba escondida detrás
                de una opción que nadie tocaba. */}
              {isLoading ? (
                <LoadingBlock label="Cargando el contenido…" />
              ) : drafts.length === 0 ? (
                <Card
                  title="Plantillas y borradores"
                  description="Aquí vive el material de la tienda: lo que ya se usa y lo que está en revisión."
                >
                  <EmptyState
                    title="Todavía no hay contenido"
                    hint="Créalo en la pestaña «Crear» o impórtalo de Klaviyo. Aparecerá aquí como borrador hasta que se apruebe."
                  />
                </Card>
              ) : (
                <div className="space-y-6">
                  <Card
                    title="Plantillas en uso"
                    description="Aprobadas y publicadas: material listo para copiar y mandar. Ábrelas para ver la conversación o pedirle un análisis al Consultor IA."
                    actions={
                      piecesInUse.length > 0 ? (
                        <Badge tone="success">{piecesInUse.length}</Badge>
                      ) : undefined
                    }
                  >
                    {piecesInUse.length === 0 ? (
                      <EmptyState
                        title="Ninguna plantilla en uso todavía"
                        hint="Cuando se apruebe un borrador pasará aquí."
                      />
                    ) : (
                      <PieceGrid
                        pieces={piecesInUse}
                        expandedId={expandedDraftId}
                        viewerKind={viewerKind}
                        onToggle={(id) =>
                          setExpandedDraftId(expandedDraftId === id ? null : id)
                        }
                      />
                    )}
                  </Card>
                  <Card
                    title="Borradores"
                    description="En revisión o devueltos con objeciones. Edítalos, coméntalos y apruébalos antes de usarlos."
                    actions={
                      piecesInProgress.length > 0 ? (
                        <Badge tone="warn">{piecesInProgress.length}</Badge>
                      ) : undefined
                    }
                  >
                    {piecesInProgress.length === 0 ? (
                      <EmptyState
                        title="Sin borradores abiertos"
                        hint="Todo lo creado está aprobado o publicado."
                      />
                    ) : (
                      <PieceGrid
                        pieces={piecesInProgress}
                        expandedId={expandedDraftId}
                        viewerKind={viewerKind}
                        onToggle={(id) =>
                          setExpandedDraftId(expandedDraftId === id ? null : id)
                        }
                      />
                    )}
                  </Card>
                  {drafts
                    .filter((draft) => draft.id === expandedDraftId)
                    .map((draft) => (
                      <Card
                        key={draft.id}
                        kicker={`${contentTypeLabels[draft.content_type] ?? draft.content_type} · ${fmtDateTime(draft.created_at)}`}
                        title={draft.subject}
                        description={draft.summary}
                        actions={
                          <div className="flex flex-wrap items-center gap-2">
                            {/* El canal iba dentro del titulo ("Meta · asunto"):
                              se leia como parte del asunto, no como el canal. */}
                            <ChannelBadge channel={draft.request?.channel} />
                            <Badge tone={statusTone[draft.status]}>
                              {statusLabel[draft.status]}
                            </Badge>
                          </div>
                        }
                      >
                        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator pb-3">
                              <span className="text-xs text-muted">
                                Versión {draft.version}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  editingDraftId === draft.id
                                    ? cancelEditing()
                                    : startEditing(draft)
                                }
                                disabled={busyDraftId === draft.id}
                              >
                                {editingDraftId === draft.id
                                  ? "Cancelar edición"
                                  : "Editar textos"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  void toggleVersionHistory(draft.id)
                                }
                              >
                                {historyDraftId === draft.id
                                  ? "Ocultar historial"
                                  : "Historial"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => analyzePiece(draft)}
                              >
                                Analizar con el Consultor IA
                              </Button>
                              {!isSocialDraft(draft) &&
                              ((draft.request?.design &&
                                Array.isArray(draft.request.design.blocks) &&
                                draft.request.design.blocks.length > 0) ||
                                (Array.isArray(draft.blocks) &&
                                  draft.blocks.length > 0)) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => editInBuilder(draft)}
                                >
                                  Abrir en el editor visual
                                </Button>
                              ) : null}
                            </div>
                            {historyDraftId === draft.id ? (
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
                            {editingDraftId === draft.id && editForm ? (
                              <Card
                                title="Editar contenido"
                                description="Al guardar volverá a requerir aprobación."
                                className="border-warning/40 bg-warning/10"
                              >
                                <div className="space-y-4">
                                  <Field
                                    label={
                                      isInstagramDraft(draft)
                                        ? "Título del post"
                                        : isMetaDraft(draft)
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
                                        isInstagramDraft(draft)
                                          ? "Brief creativo"
                                          : isMetaDraft(draft)
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
                                    {!isSocialDraft(draft) ? (
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
                                  {!isSocialDraft(draft) ? (
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
                                      isInstagramDraft(draft)
                                        ? "Caption + hashtags"
                                        : isMetaDraft(draft)
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
                                  {isMetaDraft(draft) ? (
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
                                  {!isSocialDraft(draft) ? (
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
                                    onClick={() => void saveEditing(draft.id)}
                                    disabled={busyDraftId === draft.id}
                                  >
                                    {busyDraftId === draft.id
                                      ? "Guardando…"
                                      : "Guardar nueva versión"}
                                  </Button>
                                </div>
                              </Card>
                            ) : null}
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <p className={EYEBROW}>
                                  {isInstagramDraft(draft)
                                    ? "Brief creativo"
                                    : isMetaDraft(draft)
                                      ? "Descripción"
                                      : "Preheader"}
                                </p>
                                <p className="text-sm">
                                  {draft.preheader || "—"}
                                </p>
                              </div>
                              <div>
                                <p className={EYEBROW}>Audiencia</p>
                                <p className="text-sm">{draft.audience}</p>
                              </div>
                              <div>
                                <p className={EYEBROW}>Tono</p>
                                <p className="text-sm">{draft.tone}</p>
                              </div>
                              <div>
                                <p className={EYEBROW}>
                                  Confianza de la generación
                                </p>
                                <p className="text-sm">
                                  {confidenceLabels[draft.confidence]}
                                </p>
                              </div>
                            </div>
                            {draft.warnings.length > 0 ? (
                              <Banner tone="warn" className="text-sm">
                                <p className="font-medium">Avisos</p>
                                <ul className="mt-1 list-disc pl-5">
                                  {draft.warnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                  ))}
                                </ul>
                              </Banner>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              {draft.status === "draft" ? (
                                <Button
                                  type="button"
                                  onClick={() => void submitDraft(draft.id)}
                                  disabled={submittingDraftId === draft.id}
                                >
                                  {submittingDraftId === draft.id
                                    ? "Enviando…"
                                    : "Enviar a aprobación"}
                                </Button>
                              ) : null}
                              {draft.status === "pending_approval" ? (
                                <>
                                  <Button
                                    type="button"
                                    onClick={() =>
                                      openDecision(draft.id, "approved")
                                    }
                                    disabled={busyDraftId === draft.id}
                                  >
                                    Aprobar para copiar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    type="button"
                                    onClick={() =>
                                      openDecision(draft.id, "rejected")
                                    }
                                    disabled={busyDraftId === draft.id}
                                  >
                                    Rechazar
                                  </Button>
                                </>
                              ) : null}
                              {decisionDraft?.id === draft.id ? (
                                <Card
                                  title={
                                    decisionDraft.decision === "approved"
                                      ? "Nota de aprobación"
                                      : "Motivo del rechazo"
                                  }
                                  description="Opcional · queda guardado con la decisión."
                                  className="basis-full"
                                >
                                  <div className="space-y-3">
                                    <Field
                                      label={
                                        decisionDraft.decision === "approved"
                                          ? "Nota de aprobación (opcional)"
                                          : "Motivo del rechazo (opcional)"
                                      }
                                    >
                                      <Textarea
                                        aria-label="Razón de la decisión"
                                        className="mt-2 min-h-24"
                                        value={decisionReason}
                                        onChange={(event) =>
                                          setDecisionReason(event.target.value)
                                        }
                                        maxLength={2000}
                                        placeholder="Deja contexto para el siguiente revisor…"
                                      />
                                    </Field>
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        onClick={() =>
                                          void decideDraft(
                                            draft.id,
                                            decisionDraft.decision,
                                            decisionReason,
                                          )
                                        }
                                        disabled={busyDraftId === draft.id}
                                      >
                                        {busyDraftId === draft.id
                                          ? "Guardando…"
                                          : "Confirmar decisión"}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        type="button"
                                        onClick={() => setDecisionDraft(null)}
                                        disabled={busyDraftId === draft.id}
                                      >
                                        Cancelar
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              ) : null}
                              {isInstagramDraft(draft) ? (
                                <Button
                                  variant="ghost"
                                  type="button"
                                  onClick={() => void copyInstagramPost(draft)}
                                  disabled={draft.status !== "approved"}
                                >
                                  Copiar post
                                </Button>
                              ) : isMetaDraft(draft) ? (
                                <Button
                                  variant="ghost"
                                  type="button"
                                  onClick={() => void copyMetaCreative(draft)}
                                  disabled={draft.status !== "approved"}
                                >
                                  Copiar creativo
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    type="button"
                                    onClick={() => void copyHtml(draft.html)}
                                    disabled={draft.status !== "approved"}
                                  >
                                    Copiar HTML
                                  </Button>
                                  {/* El envio a Klaviyo deja la plantilla lista
                                    en la cuenta del cliente; la campana y el
                                    envio siguen decidiendose alli. */}
                                  <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={() => void pushToKlaviyo(draft)}
                                    disabled={
                                      draft.status !== "approved" ||
                                      pushingDraftId === draft.id
                                    }
                                  >
                                    {pushingDraftId === draft.id
                                      ? "Enviando…"
                                      : draft.request?.klaviyo_template_id
                                        ? "Actualizar en Klaviyo"
                                        : "Enviar a Klaviyo"}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          <div>
                            <Tabs
                              items={[
                                {
                                  value: "preview",
                                  label: isInstagramDraft(draft)
                                    ? "Publicación"
                                    : isMetaDraft(draft)
                                      ? "Anuncio"
                                      : "Preview",
                                },
                                {
                                  value: "plain_text",
                                  label: isInstagramDraft(draft)
                                    ? "Caption"
                                    : isMetaDraft(draft)
                                      ? "Texto principal"
                                      : "Texto plano",
                                },
                                ...(isSocialDraft(draft)
                                  ? []
                                  : [{ value: "html", label: "HTML" }]),
                              ]}
                              value={
                                isSocialDraft(draft) && previewTab === "html"
                                  ? "preview"
                                  : previewTab
                              }
                              onChange={setPreviewTab}
                              className="w-full"
                              panels={{
                                preview: isSocialDraft(draft) ? (
                                  <div className="mt-3 max-w-md border border-separator bg-white p-4 shadow-sm">
                                    <p className={EYEBROW}>
                                      {isInstagramDraft(draft)
                                        ? "Instagram · orgánico"
                                        : "Patrocinado · Meta Ads"}
                                    </p>
                                    <h3 className="mt-3 text-base font-semibold">
                                      {draft.subject}
                                    </h3>
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                                      {draft.plain_text}
                                    </p>
                                    {getMetaDestinationUrl(draft) ? (
                                      <a
                                        className="mt-4 inline-flex min-h-8 items-center bg-accent px-3 text-xs font-semibold text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                        href={
                                          getMetaDestinationUrl(draft) ??
                                          undefined
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {getMetaCallToAction(draft)}
                                      </a>
                                    ) : (
                                      <span className="mt-4 inline-flex min-h-8 items-center bg-accent px-3 text-xs font-semibold text-white">
                                        {getMetaCallToAction(draft)}
                                      </span>
                                    )}
                                    {getMetaDestinationUrl(draft) ? (
                                      <p className="mt-3 break-all text-xs text-muted">
                                        Destino: {getMetaDestinationUrl(draft)}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="mt-3 overflow-hidden border border-separator bg-white">
                                    <iframe
                                      title={`Preview de ${draft.subject}`}
                                      srcDoc={draft.html}
                                      sandbox=""
                                      className="h-[480px] w-full"
                                    />
                                  </div>
                                ),
                                plain_text: (
                                  <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap border border-separator bg-surface p-3 text-sm">
                                    {draft.plain_text}
                                  </pre>
                                ),
                                html: (
                                  <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap border border-separator bg-surface p-3 font-mono text-xs">
                                    {draft.html}
                                  </pre>
                                ),
                              }}
                            />
                            <p className="mt-2 text-xs text-muted">
                              {isInstagramDraft(draft)
                                ? "Instagram no se publica desde aquí: copia el texto tras aprobar y sube la pieza."
                                : isMetaDraft(draft)
                                  ? "La publicación requiere conexión y aprobación."
                                  : "Copiar HTML solo se habilita tras la aprobación."}
                            </p>
                          </div>
                        </div>
                        {organizationId ? (
                          <>
                            <DraftCampaignLink
                              organizationId={organizationId}
                              draft={draft}
                              items={campaignItems}
                              onChanged={() => {
                                void loadDrafts();
                                void reloadCampaignItems();
                              }}
                            />
                            {isMetaDraft(draft) ? (
                              <MetaAdPlanBlock
                                organizationId={organizationId}
                                draft={draft}
                              />
                            ) : null}
                            <SchedulePublicationBlock
                              organizationId={organizationId}
                              draftId={draft.id}
                              scheduledFor={draft.scheduled_for}
                              onChanged={() => void loadDrafts()}
                            />
                            <MarketingDraftNotes
                              organizationId={organizationId}
                              draftId={draft.id}
                              viewerKind={viewerKind}
                              onChanged={() => void loadDrafts()}
                            />
                          </>
                        ) : null}
                      </Card>
                    ))}
                </div>
              )}
            </div>
          ),
          crear: (
            <div className="space-y-6">
              {campaignTarget ? (
                // Sin este aviso, "generar" vuelve a ser un acto suelto: no se
                // ve que la pieza va a quedar colgada de una campaña concreta.
                <Banner tone="success" className="text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      Escribiendo la pieza de{" "}
                      <strong>{campaignTarget.title}</strong> ·{" "}
                      {fmtDate(campaignTarget.starts_at)}. Al generarla queda
                      enlazada a esa campaña.
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCampaignTarget(null)}
                    >
                      Desvincular
                    </Button>
                  </div>
                </Banner>
              ) : null}
              {(() => {
                // Instagram orgánico no publica desde aquí (el consultor copia el
                // texto y sube la pieza), así que no hay conexión que avisar.
                if (channel === "instagram_organic") return null;
                const providerId = channel === "meta_ads" ? "meta" : "klaviyo";
                const readiness = integrationReadiness[providerId];
                const connected = ["connected", "syncing"].includes(
                  readiness?.connectionStatus ?? "",
                );
                if (!readiness || connected) return null;
                const providerName =
                  providerId === "meta" ? "Meta Ads" : "Klaviyo";
                const readinessMessage =
                  readiness.configuration === "feature_disabled"
                    ? `${providerName} está desactivado por configuración del servidor.`
                    : readiness.configuration === "credentials_missing"
                      ? `Faltan las credenciales de la aplicación de ${providerName}.`
                      : readiness.configuration === "not_implemented"
                        ? `La conexión de ${providerName} todavía no está habilitada en este entorno.`
                        : readiness.connectionStatus === "error"
                          ? `La conexión de ${providerName} necesita atención antes de sincronizar.`
                          : `Aún no hay una cuenta de ${providerName} autorizada para esta organización.`;
                return (
                  <Banner tone="warn" className="text-sm">
                    <strong>{readinessMessage}</strong> Puedes preparar y
                    revisar el contenido ahora; la publicación quedará
                    disponible cuando completes la configuración y autorización
                    del proveedor.
                  </Banner>
                );
              })()}
              {/* La importacion existia pero no habia forma de abrirla: el atajo
                que ponia `showKlaviyoImport` a true desaparecio al pasar a
                pestañas. Vive aqui, junto a lo demas que crea borradores. */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowKlaviyoImport(!showKlaviyoImport)}
                >
                  {showKlaviyoImport
                    ? "Ocultar plantillas de Klaviyo"
                    : "Importar de Klaviyo"}
                </Button>
                <span className="text-xs text-muted">
                  Trae una plantilla que ya existe en tu cuenta como borrador.
                </span>
              </div>
              {showKlaviyoImport && organizationId ? (
                <KlaviyoImportPanel
                  organizationId={organizationId}
                  importedTemplateIds={drafts
                    .map((draft) => draft.request?.klaviyo_template_id)
                    .filter((id): id is string => Boolean(id))}
                  onImported={(draftId) => {
                    setShowKlaviyoImport(false);
                    void loadDrafts();
                    if (draftId) focusDraft(draftId);
                  }}
                />
              ) : null}
              <Card
                title="Crear contenido"
                description="Describe el objetivo, la audiencia y la oferta. Claude propondrá el contenido con el contexto de la empresa y señalará cualquier dato que falte, sin inventar descuentos ni resultados."
              >
                <Tabs
                  items={[
                    { value: "campaign", label: "Campaña (email o Meta)" },
                    { value: "template", label: "Plantilla de email" },
                  ]}
                  value={genMode}
                  onChange={(value) => {
                    const next = value as "campaign" | "template";
                    setGenMode(next);
                    // El modo plantilla es solo email: no dejes la tarjeta de plan
                    // Meta colgando debajo.
                    if (next === "template" && channel === "meta_ads") {
                      setChannel("email_klaviyo");
                    }
                  }}
                  className="mb-4"
                />
                <Form
                  aria-label="Crear contenido con Claude"
                  className="space-y-6"
                  onSubmit={generateDraft}
                >
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {genMode === "campaign" ? (
                      <>
                        <Field label="Canal de destino">
                          <Select
                            aria-label="Canal de destino de campaña"
                            className="mt-2"
                            value={channel}
                            onChange={(nextChannel) => {
                              setChannel(nextChannel);
                              if (
                                nextChannel === "meta_ads" ||
                                nextChannel === "instagram_organic"
                              )
                                setContentType("campaign");
                            }}
                            options={campaignChannelOptions}
                          />
                        </Field>
                        <Field label="Tipo de contenido">
                          <Select
                            aria-label="Tipo de contenido"
                            className="mt-2"
                            value={contentType}
                            onChange={setContentType}
                            options={
                              channel === "meta_ads" ||
                              channel === "instagram_organic"
                                ? contentTypeOptions.filter(
                                    (option) => option.value === "campaign",
                                  )
                                : contentTypeOptions
                            }
                          />
                        </Field>
                      </>
                    ) : null}
                    <Field label="Objetivo principal">
                      <Select
                        aria-label="Objetivo de campaña"
                        className="mt-2"
                        value={objective}
                        onChange={setObjective}
                        options={campaignObjectiveOptions}
                      />
                    </Field>
                    <Field label="Tono">
                      <Select
                        aria-label="Tono de campaña"
                        className="mt-2"
                        value={tone}
                        onChange={setTone}
                        options={campaignToneOptions}
                      />
                    </Field>
                    {genMode === "campaign" ? (
                      <>
                        <Field label="Audiencia (opcional)">
                          <Input
                            aria-label="Audiencia de campaña"
                            className="mt-2"
                            placeholder="Ej.: clientes nuevos en España"
                            value={audience}
                            onChange={(event) =>
                              setAudience(event.target.value)
                            }
                            maxLength={500}
                          />
                        </Field>
                        <Field label="Oferta o producto (opcional)">
                          <Input
                            aria-label="Oferta o producto de campaña"
                            className="mt-2"
                            placeholder="Ej.: colección de verano"
                            value={offer}
                            onChange={(event) => setOffer(event.target.value)}
                            maxLength={500}
                          />
                        </Field>
                        <Field label="CTA preferido (opcional)">
                          <Input
                            aria-label="CTA de campaña"
                            className="mt-2"
                            placeholder="Ej.: Ver la colección"
                            value={cta}
                            onChange={(event) => setCta(event.target.value)}
                            maxLength={160}
                          />
                        </Field>
                      </>
                    ) : null}
                  </div>
                  {genMode === "template" ? (
                    <div className="space-y-4">
                      {/* La plantilla se prepara como se prepara un email: la
                        cabecera arriba, las herramientas debajo del asunto y
                        el cuerpo en el lienzo. */}
                      <div className="border border-separator">
                        <ComposerRow label="Nombre">
                          <Input
                            aria-label="Nombre interno de la plantilla"
                            placeholder="Bienvenida verano (nombre interno, no se envía)"
                            value={templateName}
                            onChange={(event) =>
                              setTemplateName(event.target.value)
                            }
                            maxLength={160}
                          />
                        </ComposerRow>
                        <ComposerRow label="De">
                          <div className="flex flex-wrap gap-2">
                            <Input
                              aria-label="Nombre del remitente"
                              className="sm:w-56"
                              placeholder="Nombre visible del remitente"
                              value={templateFromName}
                              onChange={(event) =>
                                setTemplateFromName(event.target.value)
                              }
                              maxLength={120}
                            />
                            <Input
                              aria-label="Dirección de respuesta"
                              className="sm:w-64"
                              type="email"
                              placeholder="Responder a (opcional)"
                              value={templateReplyTo}
                              onChange={(event) =>
                                setTemplateReplyTo(event.target.value)
                              }
                              maxLength={255}
                            />
                          </div>
                        </ComposerRow>
                        <ComposerRow label="Asunto">
                          <Input
                            aria-label="Asunto del email"
                            placeholder="Tu colección de verano ya está aquí"
                            value={templateSubject}
                            onChange={(event) =>
                              setTemplateSubject(event.target.value)
                            }
                            maxLength={255}
                          />
                        </ComposerRow>
                        <ComposerRow label="Preheader">
                          <Input
                            aria-label="Preheader del email"
                            placeholder="La línea que se lee en la bandeja, tras el asunto"
                            value={templatePreheader}
                            onChange={(event) =>
                              setTemplatePreheader(event.target.value)
                            }
                            maxLength={255}
                          />
                        </ComposerRow>
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                          <Dropdown>
                            <Button type="button" variant="ghost" size="sm">
                              Elegir plantilla
                            </Button>
                            <Dropdown.Popover>
                              <Dropdown.Menu
                                onAction={(key) => {
                                  const source = savedTemplates.find(
                                    (item) => item.id === String(key),
                                  );
                                  if (source) editInBuilder(source);
                                }}
                              >
                                {savedTemplates.length === 0 ? (
                                  <Dropdown.Item
                                    id="none"
                                    textValue="Sin plantillas"
                                  >
                                    <Label>
                                      Todavía no hay plantillas guardadas
                                    </Label>
                                  </Dropdown.Item>
                                ) : (
                                  savedTemplates.map((item) => (
                                    <Dropdown.Item
                                      key={item.id}
                                      id={item.id}
                                      textValue={
                                        item.template_name || item.subject
                                      }
                                    >
                                      <Label>
                                        {item.template_name || item.subject}
                                      </Label>
                                    </Dropdown.Item>
                                  ))
                                )}
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                          <Dropdown>
                            <Button type="button" variant="ghost" size="sm">
                              Insertar campo
                            </Button>
                            <Dropdown.Popover>
                              <Dropdown.Menu
                                onAction={(key) => {
                                  const field = MERGE_FIELDS.find(
                                    (entry) => entry.name === String(key),
                                  );
                                  if (field) insertField(field);
                                }}
                              >
                                {MERGE_FIELDS.map((field) => (
                                  <Dropdown.Item
                                    key={field.name}
                                    id={field.name}
                                    textValue={field.label}
                                  >
                                    <Label>
                                      {field.label} · {field.token}
                                    </Label>
                                  </Dropdown.Item>
                                ))}
                              </Dropdown.Menu>
                            </Dropdown.Popover>
                          </Dropdown>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="ms-auto"
                            onClick={() => setShowAiPanel(!showAiPanel)}
                          >
                            {showAiPanel
                              ? "Cerrar la IA"
                              : design.blocks.length > 0
                                ? "Mejorar con IA"
                                : "Escribir con IA"}
                          </Button>
                        </div>
                      </div>

                      <TemplateBuilder
                        design={design}
                        onChange={setDesign}
                        onUploadImage={uploadTemplateImage}
                        onSelect={setSelectedBlockId}
                      />

                      {/* El panel de IA se abre desde la barra, como cualquier
                        otra herramienta del compositor. Antes ocupaba media
                        pantalla debajo del lienzo estuviera o no en uso. */}
                      {showAiPanel ? (
                        <div className="space-y-3 border border-separator p-4">
                          <p className="text-sm font-medium">Trabajar con IA</p>
                          <p className="text-xs text-muted">
                            Claude reescribe copy y jerarquía con el contexto de
                            la empresa. El resultado siempre pasa por revisión
                            humana, y escribe su propio asunto: lo que pongas
                            arriba sirve de partida, no queda fijado.
                          </p>
                          <Field label="Qué quieres que haga">
                            <Textarea
                              aria-label="Instrucciones para la IA"
                              className="mt-2 min-h-32"
                              placeholder="Ej.: Presenta la colaboración con Reventxz y termina con un CTA a la app. Si hay frases que deben salir tal cual, escríbelas entre comillas: «Envío gratis a partir de 50 €». No inventes precios ni descuentos."
                              value={brief}
                              onChange={(event) => setBrief(event.target.value)}
                              maxLength={12000}
                            />
                          </Field>

                          <Field label="Imágenes (opcional)">
                            <div className="mt-2 space-y-2">
                              <p className="text-xs text-muted">
                                «Referencia» = la IA imita su estilo.
                                «Contenido» = la IA la coloca dentro de la
                                plantilla.
                              </p>
                              <UploadButton
                                accept="image/png,image/jpeg,image/gif,image/webp"
                                onFile={async (file) => {
                                  setError(null);
                                  try {
                                    const url = await uploadTemplateImage(file);
                                    setAiImages((current) => [
                                      ...current,
                                      { url, role: "contenido" },
                                    ]);
                                  } catch (uploadError) {
                                    setError(
                                      uploadError instanceof Error
                                        ? uploadError.message
                                        : "No se pudo subir la imagen.",
                                    );
                                  }
                                }}
                              >
                                Adjuntar imagen
                              </UploadButton>
                              {aiImages.map((image, index) => (
                                <div
                                  key={image.url}
                                  className="flex flex-wrap items-center gap-3 border border-separator p-2 text-sm"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={image.url}
                                    alt={`Imagen ${index + 1} (${image.role})`}
                                    className="h-12 w-12 object-cover"
                                  />
                                  <Select
                                    aria-label="Rol de la imagen"
                                    className="w-48"
                                    value={image.role}
                                    onChange={(value) =>
                                      setAiImages((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                role: value as
                                                  "referencia" | "contenido",
                                              }
                                            : item,
                                        ),
                                      )
                                    }
                                    options={[
                                      {
                                        value: "contenido",
                                        label: "Contenido (colocar)",
                                      },
                                      {
                                        value: "referencia",
                                        label: "Referencia (estilo)",
                                      },
                                    ]}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      setAiImages((current) =>
                                        current.filter(
                                          (_, itemIndex) => itemIndex !== index,
                                        ),
                                      )
                                    }
                                  >
                                    Quitar
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </Field>

                          <Button
                            type="submit"
                            disabled={
                              isGenerating ||
                              (design.blocks.length === 0 && !brief.trim())
                            }
                          >
                            {isGenerating
                              ? "Generando…"
                              : design.blocks.length > 0
                                ? "Mejorar con IA"
                                : "Hacer con IA"}
                          </Button>
                        </div>
                      ) : null}

                      {/* El cierre del compositor: guardar está donde está
                        "Enviar" en un cliente de correo, y dice qué pasa
                        después en vez de dejarlo a la intuición. */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-4">
                        <span className="text-xs text-muted">
                          Se guarda como borrador y pasa por revisión antes de
                          usarse.
                        </span>
                        <Button
                          type="button"
                          onClick={() => void saveManualTemplate()}
                          disabled={
                            isSavingTemplate || design.blocks.length === 0
                          }
                        >
                          {isSavingTemplate
                            ? "Guardando…"
                            : "Guardar plantilla"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Field label="Indicaciones para Claude">
                        <Textarea
                          aria-label="Brief de contenido"
                          className="mt-2 min-h-40"
                          placeholder="Ej.: Presenta la marca, explica el beneficio principal y termina con un CTA hacia la colección de verano. No inventar descuentos ni resultados."
                          value={brief}
                          onChange={(event) => setBrief(event.target.value)}
                          maxLength={12000}
                          required
                        />
                      </Field>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="submit"
                          disabled={isGenerating || !brief.trim()}
                        >
                          {isGenerating ? "Generando…" : "Generar borrador"}
                        </Button>
                        <span className="text-xs text-muted">
                          Siempre requiere revisión humana · sin envío
                          automático
                        </span>
                      </div>
                    </>
                  )}
                </Form>
              </Card>
            </div>
          ),
          rendimiento: (
            <PerformanceTab
              days={performanceDays}
              onDaysChange={setPerformanceDays}
              klaviyo={attribution.klaviyo}
              meta={attribution.meta}
              shopify={attribution.shopify}
              isLoading={attribution.isLoading}
            />
          ),
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

function MarketingRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (isConsultant && !organizationId) {
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
  return (
    <PortalShell title="Marketing IA">
      {(bootstrap) => <MarketingRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
