"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { buildMarketingBrief } from "@/lib/marketing-brief";
import { displayValue } from "@/lib/display-labels";
import { META_OBJECTIVE_OPTIONS } from "@/lib/meta-objectives";
import { TemplateBuilder } from "./template-builder";
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
  Tabs,
  Textarea,
  toast,
  UploadButton,
  type Tone,
} from "@/components/ui";

type MarketingDraft = {
  id: string;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "published";
  content_type: "campaign" | "flow_step" | "popup";
  request: {
    channel?: string;
    content_type?: string;
    brief?: string;
    design?: TemplateDesign;
    source?: string;
    klaviyo_template_id?: string;
  } | null;
  summary: string;
  template_name: string;
  subject: string;
  preheader: string;
  from_name: string;
  reply_to: string | null;
  purpose: string;
  audience: string;
  locale: string;
  tone: string;
  plain_text: string;
  html: string;
  blocks: unknown[];
  personalization_tokens: string[];
  compliance_notes: string[];
  sources: unknown[];
  confidence: "low" | "medium" | "high";
  warnings: string[];
  version: number;
  created_at: string;
  updated_at: string;
  decision_reason: string | null;
};

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
  configuration: "configured" | "credentials_missing" | "feature_disabled" | "not_implemented";
  connectionStatus: string | null;
  connectionId: string | null;
};

type KlaviyoMarketingReports = {
  runs: Array<{
    id: string;
    period_start: string | null;
    period_end: string | null;
    status: string;
  }>;
  values: Array<{
    report_run_id: string;
    entity_name: string | null;
    external_entity_id: string | null;
    conversions: number | string | null;
    revenue: number | string | null;
    currency_code: string | null;
  }>;
};

// Fechas del modulo: `fmtDate` en listados/tarjetas, `fmtDateTime` en detalle,
// historial y notas. Un solo sitio para el locale.
const fmtDate = (value: string) =>
  new Date(value).toLocaleDateString("es-ES");
const fmtDateTime = (value: string) =>
  new Date(value).toLocaleString("es-ES");

function getMetaCallToAction(draft: MarketingDraft) {
  const buttonBlock = draft.blocks.find(
    (block): block is { type?: string; content?: unknown } =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "button",
  );
  return typeof buttonBlock?.content === "string" && buttonBlock.content.trim()
    ? buttonBlock.content
    : "Más información";
}

function isMetaDraft(draft: MarketingDraft) {
  return draft.request?.channel === "meta_ads";
}

function getMetaDestinationUrl(draft: MarketingDraft) {
  const buttonBlock = draft.blocks.find(
    (block): block is { type?: string; href?: unknown } =>
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "button",
  );
  const href = buttonBlock?.href;
  if (typeof href !== "string" || !href.trim()) return null;
  try {
    const url = new URL(href);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

type MetaAdPlan = {
  mode: "dry_run";
  executionReady: false;
  plan: {
    adAccountId: string;
    status: "PAUSED";
    approvalRequired: true;
    idempotencyKey: string;
    steps: string[];
    input: { campaignObjective: string };
  };
};

type MetaAdAccountOption = {
  external_id: string;
  name: string;
  is_selected: boolean;
  is_active: boolean;
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

const campaignChannelOptions = [
  { value: "email_klaviyo", label: "Email / Klaviyo" },
  { value: "meta_ads", label: "Paid social / Meta Ads" },
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
  isMeta,
  metaSubject,
  title,
  status,
  metaLine,
  selected,
  onToggle,
}: {
  html: string;
  isMeta: boolean;
  metaSubject: string;
  title: string;
  status: MarketingDraft["status"];
  metaLine: ReactNode;
  selected: boolean;
  onToggle: () => void;
}) {
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
      <div className="h-40 overflow-hidden border-b border-separator bg-white">
        {isMeta ? (
          <p className="p-3 text-xs text-muted">Meta Ads · {metaSubject}</p>
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
      </div>
    </div>
  );
}

type MarketingDraftNote = {
  id: string;
  body: string;
  author_user_id: string | null;
  author_name: string | null;
  created_at: string;
};

// Objeciones del consultor sobre un borrador. Cualquier miembro del workspace
// las ve (RLS); solo consultor/platform_admin las añade (frontera en el API).
function MarketingDraftNotes({
  organizationId,
  draftId,
  canAddNote,
}: {
  organizationId: string;
  draftId: string;
  canAddNote: boolean;
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-separator pt-3">
      <p className={EYEBROW}>
        Objeciones del consultor
      </p>
      {loading ? (
        <p className="mt-1 text-sm text-muted">Cargando…</p>
      ) : notes.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Sin objeciones.</p>
      ) : (
        <div className="mt-2 space-y-2 border-l-2 border-separator pl-3">
          {notes.map((note) => (
            <div key={note.id} className="text-sm">
              <p className="leading-6">{note.body}</p>
              <p className="text-xs text-muted">
                {note.author_name ?? "Consultor"} ·{" "}
                {fmtDateTime(note.created_at)}
              </p>
            </div>
          ))}
        </div>
      )}
      {canAddNote ? (
        <div className="mt-3 space-y-2">
          {error ? <ErrorBlock>{error}</ErrorBlock> : null}
          <Textarea
            aria-label="Nueva objeción"
            placeholder="Objeción u observación para el cliente…"
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
            {busy ? "Guardando…" : "Añadir objeción"}
          </Button>
        </div>
      ) : null}
    </div>
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
  const canView =
    isConsultantRole ||
    ["owner", "manager"].includes(activeMembership?.role ?? "");
  const createCardRef = useRef<HTMLDivElement>(null);
  const draftsCardRef = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<MarketingDraft[]>([]);
  const [draftStatusFilter, setDraftStatusFilter] = useState("all");
  const [submittingDraftId, setSubmittingDraftId] = useState<string | null>(null);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [showKlaviyoImport, setShowKlaviyoImport] = useState(false);
  const [klaviyoTemplates, setKlaviyoTemplates] = useState<
    Array<{ id: string; name: string; editor_type: string | null; updated: string | null }>
  >([]);
  const [klaviyoTemplatesState, setKlaviyoTemplatesState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [klaviyoImportError, setKlaviyoImportError] = useState<string | null>(null);
  const [importingTemplateId, setImportingTemplateId] = useState<string | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [previewTemplateHtml, setPreviewTemplateHtml] = useState<string | null>(
    null,
  );
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
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [metaObjective, setMetaObjective] = useState("OUTCOME_SALES");
  const [metaCampaignName, setMetaCampaignName] = useState("");
  const [metaAdSetName, setMetaAdSetName] = useState("");
  const [metaCreativeName, setMetaCreativeName] = useState("");
  const [metaAdName, setMetaAdName] = useState("");
  const [metaDailyBudgetMinor, setMetaDailyBudgetMinor] = useState("1000");
  const [metaAdAccounts, setMetaAdAccounts] = useState<MetaAdAccountOption[]>([]);
  const [isLoadingMetaAdAccounts, setIsLoadingMetaAdAccounts] = useState(false);
  const [metaPlan, setMetaPlan] = useState<MetaAdPlan | null>(null);
  const [isPreparingMetaPlan, setIsPreparingMetaPlan] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [busyDraftId, setBusyDraftId] = useState<string | null>(null);
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
  const [error, setError] = useState<string | null>(null);
  const [aiRuntimeStatus, setAiRuntimeStatus] = useState<AiRuntimeStatus | null>(null);
  const [integrationReadiness, setIntegrationReadiness] = useState<
    Record<string, MarketingIntegrationReadiness>
  >({});
  const [klaviyoReports, setKlaviyoReports] =
    useState<KlaviyoMarketingReports | null>(null);
  const [klaviyoReportsState, setKlaviyoReportsState] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");

  const loadDrafts = useCallback(async () => {
    if (!organizationId || !canView) {
      setDrafts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        drafts?: MarketingDraft[];
      };
      setDrafts(payload.drafts ?? []);
    } catch {
      setError(
        "No se pudieron cargar los borradores por un error de red. Reintenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [canView, organizationId]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

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
    const hasUnsavedDesign =
      genMode === "template" && design.blocks.length > 0;
    if (!hasUnsavedDesign) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [genMode, design.blocks.length]);

  useEffect(() => {
    let cancelled = false;
    void apiFetch("/v1/ai/status")
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        setAiRuntimeStatus((await response.json()) as AiRuntimeStatus);
      })
      .catch(() => {
        // El estado es informativo; no debe impedir preparar la pantalla.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) return;
    void apiFetch(`/v1/organizations/${organizationId}/integrations`)
      .then(async (response) => {
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as {
          providers?: Array<{
            id: string;
            configuration?: { status?: MarketingIntegrationReadiness["configuration"] };
            connection?: { id?: string; status?: string } | null;
          }>;
        };
        const next = Object.fromEntries(
          (payload.providers ?? []).map((provider) => [
            provider.id,
            {
              configuration: provider.configuration?.status ?? "not_implemented",
              connectionStatus: provider.connection?.status ?? null,
              connectionId: provider.connection?.id ?? null,
            },
          ]),
        );
        setIntegrationReadiness(next);
      })
      .catch(() => {
        // La disponibilidad es informativa; no bloquea la creación de briefs.
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const klaviyoConnectionId = integrationReadiness.klaviyo?.connectionId ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!organizationId || !klaviyoConnectionId) {
      setKlaviyoReports(null);
      setKlaviyoReportsState("idle");
      return;
    }
    setKlaviyoReportsState("loading");
    void apiFetch(
      `/v1/organizations/${organizationId}/klaviyo/reporting?connectionId=${encodeURIComponent(klaviyoConnectionId)}`,
    )
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setKlaviyoReportsState("error");
          return;
        }
        setKlaviyoReports((await response.json()) as KlaviyoMarketingReports);
        setKlaviyoReportsState("loaded");
      })
      .catch(() => {
        if (!cancelled) setKlaviyoReportsState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, klaviyoConnectionId]);

  useEffect(() => {
    setMetaPlan(null);
  }, [channel]);

  useEffect(() => {
    let cancelled = false;
    async function loadMetaAdAccounts() {
      if (!organizationId || channel !== "meta_ads") {
        setMetaAdAccounts([]);
        setIsLoadingMetaAdAccounts(false);
        return;
      }
      setIsLoadingMetaAdAccounts(true);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/meta/assets`,
        );
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as {
          ad_accounts?: MetaAdAccountOption[];
        };
        const accounts = (payload.ad_accounts ?? []).filter(
          (account) => account.is_active,
        );
        setMetaAdAccounts(accounts);
        const selected = accounts.find((account) => account.is_selected);
        if (selected) setMetaAdAccountId(selected.external_id);
      } catch {
        if (!cancelled) setMetaAdAccounts([]);
      } finally {
        if (!cancelled) setIsLoadingMetaAdAccounts(false);
      }
    }
    void loadMetaAdAccounts();
    return () => {
      cancelled = true;
    };
  }, [channel, organizationId]);

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
                  ...(design.blocks.length > 0
                    ? { base_design: design }
                    : {}),
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
    setGenMode("template");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Plantilla cargada en el editor");
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

  function focusDraft(draftId: string) {
    setExpandedDraftId(draftId);
    requestAnimationFrame(() => {
      draftsCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
      setError("No se pudo enviar a aprobación por un error de red. Reintenta.");
    } finally {
      setSubmittingDraftId(null);
    }
  }

  async function loadKlaviyoTemplates() {
    if (!organizationId) return;
    setKlaviyoTemplatesState("loading");
    setKlaviyoImportError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/klaviyo/templates`,
      );
      if (!response.ok) {
        setKlaviyoImportError(await readApiError(response));
        setKlaviyoTemplatesState("error");
        return;
      }
      const body = (await response.json()) as {
        templates: Array<{
          id: string;
          name: string;
          editor_type: string | null;
          updated: string | null;
        }>;
      };
      setKlaviyoTemplates(body.templates);
      setKlaviyoTemplatesState("loaded");
    } catch {
      setKlaviyoImportError("No se pudieron cargar las plantillas de Klaviyo.");
      setKlaviyoTemplatesState("error");
    }
  }

  async function toggleKlaviyoPreview(templateId: string) {
    if (previewTemplateId === templateId) {
      setPreviewTemplateId(null);
      setPreviewTemplateHtml(null);
      return;
    }
    if (!organizationId) return;
    setPreviewTemplateId(templateId);
    setPreviewTemplateHtml(null);
    setKlaviyoImportError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/klaviyo/templates/${encodeURIComponent(templateId)}/preview`,
        undefined,
        60_000,
      );
      if (!response.ok) {
        setKlaviyoImportError(await readApiError(response));
        setPreviewTemplateId(null);
        return;
      }
      const body = (await response.json()) as { html?: string };
      setPreviewTemplateHtml(body.html ?? "");
    } catch {
      setKlaviyoImportError(
        "No se pudo cargar la vista previa por un error de red.",
      );
      setPreviewTemplateId(null);
    }
  }

  async function importKlaviyoTemplate(templateId: string) {
    if (!organizationId) return;
    setImportingTemplateId(templateId);
    setKlaviyoImportError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/klaviyo/templates/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId }),
        },
        60_000,
      );
      if (!response.ok) {
        setKlaviyoImportError(await readApiError(response));
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        draft_id?: string;
      } | null;
      toast.success("Plantilla importada como borrador");
      await loadDrafts();
      setShowKlaviyoImport(false);
      if (body?.draft_id) focusDraft(body.draft_id);
    } catch {
      setKlaviyoImportError("No se pudo importar la plantilla por un error de red.");
    } finally {
      setImportingTemplateId(null);
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
            design,
            html: renderTemplateHtml(design),
            plain_text: templatePlainText(design),
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
      setError("No se pudo guardar la plantilla por un error de red. Reintenta.");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function prepareMetaPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;
    setIsPreparingMetaPlan(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/meta/ad-creation-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adAccountId: metaAdAccountId.trim(),
            campaignName: metaCampaignName.trim(),
            campaignObjective: metaObjective,
            adSetName: metaAdSetName.trim(),
            dailyBudgetMinor: Number(metaDailyBudgetMinor),
            creativeName: metaCreativeName.trim(),
            creativeSpec: {
              headline: cta.trim() || brief.trim().slice(0, 80),
            },
            adName: metaAdName.trim(),
            idempotencyKey: `meta-plan-${organizationId}-${Date.now()}`,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setMetaPlan((await response.json()) as MetaAdPlan);
      toast.success("Plan Meta preparado para revisión");
    } catch {
      setError("No se pudo preparar el plan Meta por un error de red. Reintenta.");
    } finally {
      setIsPreparingMetaPlan(false);
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
      const isMeta = editingDraft ? isMetaDraft(editingDraft) : false;
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts/${draftId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isMeta
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

  if (!canView) {
    return (
      <EmptyState
        title="Sin acceso"
        hint="Necesitas ser propietario o manager de la organización, consultor o administrador de plataforma."
      />
    );
  }

  return (
    <div className="portal-page space-y-6 sm:space-y-8">
      <div>
        <Heading size="lg">Campañas de marketing</Heading>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Crea campañas y piezas de email con Claude, revisa cada propuesta y
          prepara el contenido para publicarlo cuando conectes Klaviyo. Este
          módulo nunca envía ni publica nada automáticamente.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            setGenMode("template");
            createCardRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Nueva plantilla
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setGenMode("campaign");
            createCardRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          Generar con IA
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const next = !showKlaviyoImport;
            setShowKlaviyoImport(next);
            if (next && klaviyoTemplatesState === "idle") {
              void loadKlaviyoTemplates();
            }
          }}
        >
          {showKlaviyoImport ? "Ocultar import" : "Importar de Klaviyo"}
        </Button>
      </div>

      {showKlaviyoImport ? (
        <Card
          title="Importar plantillas de Klaviyo"
          description="Trae plantillas de tu cuenta como borrador (solo HTML; no se abren en el editor visual)."
        >
          {klaviyoTemplatesState === "loading" ? (
            <LoadingBlock label="Cargando plantillas de Klaviyo…" />
          ) : klaviyoImportError ? (
            <div className="space-y-3">
              <ErrorBlock>{klaviyoImportError}</ErrorBlock>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void loadKlaviyoTemplates()}
              >
                Reintentar
              </Button>
            </div>
          ) : klaviyoTemplates.length === 0 ? (
            <EmptyState
              title="Sin plantillas"
              hint="No hay plantillas en la cuenta Klaviyo conectada."
            />
          ) : (
            <List as="ul">
              {klaviyoTemplates.map((template) => {
                const alreadyImported = drafts.some(
                  (draft) =>
                    draft.request?.klaviyo_template_id === template.id,
                );
                return (
                <List.Item as="li" key={template.id} className="space-y-2 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="text-xs text-muted">
                        {template.editor_type ?? "—"}
                        {template.updated
                          ? ` · ${fmtDate(template.updated)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {alreadyImported ? <Badge>Ya importada</Badge> : null}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void toggleKlaviyoPreview(template.id)}
                      >
                        {previewTemplateId === template.id ? "Ocultar" : "Ver"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={importingTemplateId === template.id}
                        onClick={() => void importKlaviyoTemplate(template.id)}
                      >
                        {importingTemplateId === template.id
                          ? "Importando…"
                          : alreadyImported
                            ? "Importar otra vez"
                            : "Importar"}
                      </Button>
                    </div>
                  </div>
                  {previewTemplateId === template.id ? (
                    <div className="overflow-hidden border border-separator bg-white">
                      {previewTemplateHtml === null ? (
                        <div className="p-3">
                          <LoadingBlock label="Cargando vista previa…" />
                        </div>
                      ) : (
                        <iframe
                          title={`Vista previa de ${template.name}`}
                          srcDoc={previewTemplateHtml}
                          sandbox=""
                          loading="lazy"
                          className="h-96 w-full"
                        />
                      )}
                    </div>
                  ) : null}
                </List.Item>
                );
              })}
            </List>
          )}
        </Card>
      ) : null}

      {klaviyoReportsState === "loaded" &&
      klaviyoReports &&
      klaviyoReports.values.length > 0 ? (
        <Card
          title="Rendimiento Klaviyo"
          kicker={
            klaviyoReports.runs[0]?.period_start
              ? `${klaviyoReports.runs[0].period_start} → ${klaviyoReports.runs[0].period_end ?? "hoy"}`
              : undefined
          }
          description="Campañas recientes con más ingresos atribuidos, según el reporting sincronizado. Una ausencia de filas no significa cero."
        >
          <List as="ul" className="text-sm">
            {klaviyoReports.values.slice(0, 5).map((value, index) => (
              <List.Item
                as="li"
                key={`${value.report_run_id}-${value.external_entity_id ?? index}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0 truncate">
                  {value.entity_name ?? value.external_entity_id ?? "Campaña"}
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {value.revenue != null
                    ? `${Number(value.revenue).toLocaleString("es-ES")} ${value.currency_code ?? ""}`.trim()
                    : value.conversions != null
                      ? `${Number(value.conversions).toLocaleString("es-ES")} conv.`
                      : "—"}
                </span>
              </List.Item>
            ))}
          </List>
        </Card>
      ) : null}

      {aiRuntimeStatus && !aiRuntimeStatus.configured ? (
        <Banner tone="warn" className="text-sm">
          <strong>IA preparada.</strong> Falta configurar un proveedor IA
          (Anthropic/Claude u OpenAI) en el servidor. Puedes preparar briefs y
          planes Meta en dry-run; la generación se habilitará al añadir las
          credenciales, sin cambiar esta interfaz.
        </Banner>
      ) : null}

      {(() => {
        const providerId = channel === "meta_ads" ? "meta" : "klaviyo";
        const readiness = integrationReadiness[providerId];
        const connected = ["connected", "syncing"].includes(
          readiness?.connectionStatus ?? "",
        );
        if (!readiness || connected) return null;
        const providerName = providerId === "meta" ? "Meta Ads" : "Klaviyo";
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
            <strong>{readinessMessage}</strong>{" "}
            Puedes preparar y revisar el contenido ahora; la publicación quedará disponible cuando
            completes la configuración y autorización del proveedor.
          </Banner>
        );
      })()}

      <div ref={createCardRef}>
      <Card
        kicker="AI-11 · Fase A"
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
                      if (nextChannel === "meta_ads") setContentType("campaign");
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
                      channel === "meta_ads"
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
                    onChange={(event) => setAudience(event.target.value)}
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
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre de la plantilla">
                  <Input
                    className="mt-1"
                    placeholder="Ej.: Bienvenida verano"
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    maxLength={160}
                  />
                </Field>
                <Field label="Asunto del email">
                  <Input
                    className="mt-1"
                    placeholder="Ej.: Tu colección de verano ya está aquí"
                    value={templateSubject}
                    onChange={(event) => setTemplateSubject(event.target.value)}
                    maxLength={255}
                  />
                </Field>
              </div>

              <TemplateBuilder
                design={design}
                onChange={setDesign}
                onUploadImage={uploadTemplateImage}
              />

              <div className="grid gap-6 border-t border-separator pt-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Guardar tal cual</p>
                  <Button
                    type="button"
                    onClick={() => void saveManualTemplate()}
                    disabled={isSavingTemplate || design.blocks.length === 0}
                  >
                    {isSavingTemplate ? "Guardando…" : "Guardar plantilla"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Trabajar con IA</p>
                  <p className="text-xs text-muted">
                    Claude reescribe copy y jerarquía con el contexto de la
                    empresa. El resultado siempre pasa por revisión humana.
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
                    «Referencia» = la IA imita su estilo. «Contenido» = la IA la
                    coloca dentro de la plantilla.
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
                                    role: value as "referencia" | "contenido",
                                  }
                                : item,
                            ),
                          )
                        }
                        options={[
                          { value: "contenido", label: "Contenido (colocar)" },
                          { value: "referencia", label: "Referencia (estilo)" },
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
                  Siempre requiere revisión humana · sin envío automático
                </span>
              </div>
            </>
          )}
        </Form>
      </Card>
      </div>

      {channel === "meta_ads" ? (
        <Card
          kicker="Meta Ads · Dry-run"
          title="Preparar plan de anuncios"
          description="Define la jerarquía que Meta espera. Se valida localmente y queda pausada para aprobación; todavía no crea objetos en Meta."
        >
          <Form
            aria-label="Preparar plan Meta Ads"
            className="space-y-6"
            onSubmit={prepareMetaPlan}
          >
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Cuenta publicitaria">
                {metaAdAccounts.length > 0 ? (
                  <Select
                    aria-label="Cuenta publicitaria Meta"
                    className="mt-2"
                    value={metaAdAccountId}
                    onChange={setMetaAdAccountId}
                    options={metaAdAccounts.map((account) => ({
                      value: account.external_id,
                      label: `${account.name} · ${account.external_id}`,
                    }))}
                    required
                    disabled={isLoadingMetaAdAccounts}
                  />
                ) : (
                  <Input
                    aria-label="ID de cuenta publicitaria Meta"
                    className="mt-2"
                    placeholder="act_123456789"
                    value={metaAdAccountId}
                    onChange={(event) => setMetaAdAccountId(event.target.value)}
                    required
                  />
                )}
                <p className="mt-1 text-xs text-muted">
                  {isLoadingMetaAdAccounts
                    ? "Buscando cuentas conectadas…"
                    : metaAdAccounts.length > 0
                      ? "Seleccionada desde los activos sincronizados"
                      : "Conecta Meta para seleccionar una cuenta automáticamente"}
                </p>
              </Field>
              <Field label="Nombre de campaña Meta">
                <Input
                  aria-label="Nombre de campaña Meta"
                  className="mt-2"
                  value={metaCampaignName}
                  onChange={(event) => setMetaCampaignName(event.target.value)}
                  required
                />
              </Field>
              <Field label="Objetivo de Meta">
                <Select
                  aria-label="Objetivo nativo de Meta"
                  className="mt-2"
                  value={metaObjective}
                  onChange={setMetaObjective}
                  options={[...META_OBJECTIVE_OPTIONS]}
                  required
                />
              </Field>
              <Field label="Presupuesto diario (céntimos)">
                <Input
                  aria-label="Presupuesto diario Meta"
                  className="mt-2"
                  type="number"
                  min="1"
                  step="1"
                  value={metaDailyBudgetMinor}
                  onChange={(event) => setMetaDailyBudgetMinor(event.target.value)}
                  required
                />
              </Field>
              <Field label="Nombre del ad set">
                <Input
                  aria-label="Nombre del ad set Meta"
                  className="mt-2"
                  value={metaAdSetName}
                  onChange={(event) => setMetaAdSetName(event.target.value)}
                  required
                />
              </Field>
              <Field label="Nombre del creativo">
                <Input
                  aria-label="Nombre del creativo Meta"
                  className="mt-2"
                  value={metaCreativeName}
                  onChange={(event) => setMetaCreativeName(event.target.value)}
                  required
                />
              </Field>
              <Field label="Nombre del anuncio">
                <Input
                  aria-label="Nombre del anuncio Meta"
                  className="mt-2"
                  value={metaAdName}
                  onChange={(event) => setMetaAdName(event.target.value)}
                  required
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isPreparingMetaPlan}>
                {isPreparingMetaPlan ? "Validando…" : "Preparar plan pausado"}
              </Button>
              <span className="text-xs text-muted">
                Requiere aprobación y credenciales Meta para una futura ejecución
              </span>
            </div>
          </Form>
          {metaPlan ? (
            <Banner tone="success" className="mt-6 text-sm">
              <p className="font-medium">Plan validado · listo para revisión</p>
              <p className="mt-1">
                Cuenta {metaPlan.plan.adAccountId} · estado {metaPlan.plan.status} ·
                objetivo {displayValue(metaPlan.plan.input.campaignObjective)} · pasos {metaPlan.plan.steps.join(" → ")}
              </p>
              <p className="mt-1 text-xs">
                No se ha creado ningún objeto externo.
              </p>
            </Banner>
          ) : null}
        </Card>
      ) : null}

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <div ref={draftsCardRef} className="scroll-mt-4">
      <Card
        title="Borradores recientes"
        description="Revisa, edita y aprueba el contenido antes de copiarlo o preparar su publicación."
      >
        {isLoading ? (
          <LoadingBlock label="Cargando borradores…" />
        ) : drafts.length === 0 ? (
          <EmptyState
            title="Sin borradores"
            hint="Crea el primero para revisar el preview y el HTML sanitizado."
          />
        ) : (
          <div className="space-y-6">
            <Select
              aria-label="Filtrar por estado"
              className="w-56"
              value={draftStatusFilter}
              onChange={setDraftStatusFilter}
              options={[
                { value: "all", label: "Todos los estados" },
                { value: "draft", label: "Borrador" },
                { value: "pending_approval", label: "Pendiente de aprobación" },
                { value: "approved", label: "Aprobado" },
                { value: "rejected", label: "Rechazado" },
                { value: "published", label: "Publicado" },
              ]}
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {drafts
                .filter(
                  (draft) =>
                    draftStatusFilter === "all" ||
                    draft.status === draftStatusFilter,
                )
                .map((draft) => (
                  <DraftMiniCard
                    key={draft.id}
                    html={draft.html}
                    isMeta={isMetaDraft(draft)}
                    metaSubject={draft.subject}
                    title={draft.template_name || draft.subject}
                    status={draft.status}
                    metaLine={
                      <>
                        {contentTypeLabels[draft.content_type] ??
                          draft.content_type}{" "}
                        · {fmtDate(draft.created_at)}
                        {draft.request?.source === "klaviyo_import"
                          ? " · de Klaviyo"
                          : ""}
                      </>
                    }
                    selected={expandedDraftId === draft.id}
                    onToggle={() =>
                      setExpandedDraftId(
                        expandedDraftId === draft.id ? null : draft.id,
                      )
                    }
                  />
                ))}
            </div>
            {drafts
              .filter((draft) => draft.id === expandedDraftId)
              .map((draft) => (
              <Card
                key={draft.id}
                kicker={`${contentTypeLabels[draft.content_type] ?? draft.content_type} · ${fmtDateTime(draft.created_at)}`}
                title={isMetaDraft(draft) ? `Meta · ${draft.subject}` : draft.subject}
                description={draft.summary}
                actions={
                  <Badge tone={statusTone[draft.status]}>
                    {statusLabel[draft.status]}
                  </Badge>
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
                        onClick={() => void toggleVersionHistory(draft.id)}
                      >
                        {historyDraftId === draft.id
                          ? "Ocultar historial"
                          : "Historial"}
                      </Button>
                      {!isMetaDraft(draft) &&
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
                        <p className="font-medium">Versiones auditables</p>
                        <ol className="mt-2 space-y-2">
                          {versionHistory.map((version) => (
                            <li
                              key={version.id}
                              className="flex flex-wrap justify-between gap-2 border-b border-separator pb-2 last:border-0 last:pb-0"
                            >
                              <span>
                                v{version.version} ·{" "}
                                {version.snapshot?.request?.channel === "meta_ads"
                                  ? "Meta Ads"
                                  : "Email / Klaviyo"} ·{" "}
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
                        <Field label={isMetaDraft(draft) ? "Titular del anuncio" : "Asunto del email"}>
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
                          <Field label={isMetaDraft(draft) ? "Descripción del anuncio" : "Preheader"}>
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
                          {!isMetaDraft(draft) ? (
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
                        {!isMetaDraft(draft) ? (
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
                        <Field label={isMetaDraft(draft) ? "Texto principal del anuncio" : "Texto plano"}>
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
                        {!isMetaDraft(draft) ? (
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
                          {isMetaDraft(draft) ? "Descripción" : "Preheader"}
                        </p>
                        <p className="text-sm">{draft.preheader || "—"}</p>
                      </div>
                      <div>
                        <p className={EYEBROW}>
                          Audiencia
                        </p>
                        <p className="text-sm">{draft.audience}</p>
                      </div>
                      <div>
                        <p className={EYEBROW}>
                          Tono
                        </p>
                        <p className="text-sm">{draft.tone}</p>
                      </div>
                      <div>
                        <p className={EYEBROW}>
                          Confianza de la generación
                        </p>
                        <p className="text-sm">{confidenceLabels[draft.confidence]}</p>
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
                            onClick={() => openDecision(draft.id, "approved")}
                            disabled={busyDraftId === draft.id}
                          >
                            Aprobar para copiar
                          </Button>
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => openDecision(draft.id, "rejected")}
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
                      {isMetaDraft(draft) ? (
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => void copyMetaCreative(draft)}
                          disabled={draft.status !== "approved"}
                        >
                          Copiar creativo
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => void copyHtml(draft.html)}
                          disabled={draft.status !== "approved"}
                        >
                          Copiar HTML
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Tabs
                      items={[
                        { value: "preview", label: isMetaDraft(draft) ? "Anuncio" : "Preview" },
                        { value: "plain_text", label: isMetaDraft(draft) ? "Texto principal" : "Texto plano" },
                        ...(isMetaDraft(draft) ? [] : [{ value: "html", label: "HTML" }]),
                      ]}
                      value={isMetaDraft(draft) && previewTab === "html" ? "preview" : previewTab}
                      onChange={setPreviewTab}
                      className="w-full"
                      panels={{
                        preview: isMetaDraft(draft) ? (
                          <div className="mt-3 max-w-md border border-separator bg-white p-4 shadow-sm">
                            <p className={EYEBROW}>
                              Patrocinado · Meta Ads
                            </p>
                            <h3 className="mt-3 text-base font-semibold">{draft.subject}</h3>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{draft.plain_text}</p>
                            {getMetaDestinationUrl(draft) ? (
                              <a
                                className="mt-4 inline-flex min-h-8 items-center bg-accent px-3 text-xs font-semibold text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                href={getMetaDestinationUrl(draft) ?? undefined}
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
                      {isMetaDraft(draft)
                        ? "La publicación requiere conexión y aprobación."
                        : "Copiar HTML solo se habilita tras la aprobación."}
                    </p>
                  </div>
                </div>
                {organizationId ? (
                  <MarketingDraftNotes
                    organizationId={organizationId}
                    draftId={draft.id}
                    canAddNote={isConsultantRole}
                  />
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </Card>
      </div>
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
  decision_reason: string | null;
  request: {
    channel?: string;
    objective?: string;
    brief?: string;
    source?: string;
  } | null;
  note_count: number;
};

type DraftNote = {
  id: string;
  body: string;
  author_user_id: string | null;
  author_name: string | null;
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

  const base = `/v1/organizations/${draft.organization_id}/marketing/drafts/${draft.id}`;

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
        <p className={EYEBROW}>
          Asunto
        </p>
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
        <p className={EYEBROW}>
          Objeciones del consultor
        </p>
        {notesLoading ? (
          <p className="text-sm text-muted">Cargando...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted">Sin objeciones todavía.</p>
        ) : (
          <div className="space-y-2 border-l-2 border-separator pl-3">
            {notes.map((note) => (
              <div key={note.id} className="text-sm">
                <p className="leading-6">{note.body}</p>
                <p className="text-xs text-muted">
                  {note.author_name ?? "Consultor"} ·{" "}
                  {fmtDateTime(note.created_at)}
                </p>
              </div>
            ))}
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

function ConsultantMarketingView() {
  const { setOrganizationId } = useActiveOrganization();
  const [data, setData] = useState<{
    organizations: Array<{ id: string; display_name: string }>;
    drafts: ConsultantMarketingDraft[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/v1/consultant/marketing");
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setData(
        (await response.json()) as {
          organizations: Array<{ id: string; display_name: string }>;
          drafts: ConsultantMarketingDraft[];
        },
      );
      setError(null);
    } catch {
      setError("No se pudo cargar el marketing de la cartera por un error de red.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    .filter(
      (draft) => statusFilter === "all" || draft.status === statusFilter,
    );

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
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
                  isMeta={draft.request?.channel === "meta_ads"}
                  metaSubject={draft.subject}
                  title={draft.template_name || draft.subject}
                  status={draft.status}
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
                <div key={draft.id} className="mt-4 border-t border-separator pt-4">
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
                  <ConsultantMarketingDraftPanel draft={draft} onChanged={load} />
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
    return <ConsultantMarketingView />;
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
