"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { EvidenceChips } from "@/components/ai-proposed-tasks";
import { ChannelBadge } from "@/components/marketing-channel";
import {
  AiEvidence,
  Badge,
  Banner,
  Button,
  Checkbox,
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  Select,
  Textarea,
  toast,
  type Tone,
} from "@/components/ui";

/**
 * Plan de campañas del agente A05.
 *
 * Es el paso que faltaba en el módulo: hasta ahora el consultor decidía a ojo
 * qué campañas lanzar y el generador (A11) solo escribía la pieza. A05 mira
 * ventas, margen, stock, email y adquisición reales y propone QUÉ lanzar y
 * CUÁNDO; el generador sigue siendo quien escribe.
 *
 * Dos reglas del flujo, iguales que en el camino (A19):
 *  - No se autogenera al abrir. Cuesta caro y se lee despacio; el GET solo
 *    recupera lo que ya exista.
 *  - Aprobar crea items del calendario en estado `planned` y NO visibles al
 *    cliente. Publicar o compartir sigue siendo un gesto humano aparte.
 */

type CampaignEvidence = {
  label: string;
  value: string;
  period: string | null;
  source: string;
};

type ProposedCampaign = {
  initiative?: string;
  title: string;
  channel: string;
  objective: string;
  audience: string;
  hypothesis: string;
  creative_brief: string;
  start_offset_days: number;
  duration_days: number;
  evidence: CampaignEvidence[];
  success_metric: string;
  scheduled_date: string;
  scheduled_time?: string;
};

type PlannedInitiative = {
  name: string;
  objective: string;
  audience: string;
  offer: { status: "verified" | "proposal" | "none"; description: string; evidence: CampaignEvidence[] };
  start_date: string;
  end_date: string;
  hypothesis: string;
  evidence: CampaignEvidence[];
  success_metric: string;
};

type PlannedCalendarAction = {
  index: number;
  initiative_index: number | null;
  initiative: string;
  title: string;
  channel: string;
  scheduled_date: string;
  scheduled_time?: string;
  action_type: string;
  objective: string;
  audience: string;
  purpose: string;
  creative_brief: string;
  breadcrumb: string[];
  hierarchy: Record<string, unknown>;
  description: string;
};

type CampaignPlanContent = {
  plan_name: string;
  diagnosis: string;
  campaigns: ProposedCampaign[];
  initiatives?: PlannedInitiative[];
  calendar_actions?: PlannedCalendarAction[];
  sources: Array<{ kind: string; reference: string; period: string | null }>;
  confidence: "low" | "medium" | "high";
  warnings: string[];
  planning_window: {
    start_date: string;
    end_date: string;
    timezone: string;
  };
};

type CampaignPlanProposal = {
  output_id: string;
  run_id: string;
  status: string;
  generated_at: string;
  content: CampaignPlanContent | null;
  applied_indexes?: number[];
  calendar_indexes?: number[];
};

type Calendar = { id: string; name: string; year: number; status: string };
type CampaignPlanActionResult = { tone: "success" | "warn"; title: string; detail: string; retryable?: boolean };

const HORIZONS = [
  { value: "week_1", label: "1 semana" },
  { value: "week_2", label: "2 semanas" },
  { value: "week_3", label: "3 semanas" },
  { value: "month", label: "Próximo mes" },
  { value: "quarter", label: "Próximo trimestre" },
  { value: "custom", label: "Fechas concretas" },
];

const CONFIDENCE: Record<string, { label: string; tone: Tone }> = {
  low: { label: "Confianza baja", tone: "warn" },
  medium: { label: "Confianza media", tone: "neutral" },
  high: { label: "Confianza alta", tone: "success" },
};

function CampaignPlanGenerating({ horizon }: { horizon: string }) {
  const horizonLabel = HORIZONS.find((item) => item.value === horizon)?.label ?? "el periodo elegido";
  const contextSources = [
    "Métodos generales de marketing ecommerce de E-NORA",
    "Guías temáticas y contexto de la tienda en el RAG",
    "Ventas, margen e inventario",
    "Estacionalidad y fechas comerciales",
    "Histórico y resultados de campañas",
    "Canales Klaviyo y Meta",
  ];

  return (
    <section
      className="overflow-hidden rounded-xl border border-separator bg-surface"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="h-1 w-full overflow-hidden bg-muted/20">
        <div className="h-full w-2/5 animate-pulse rounded-full bg-primary" />
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
            <span className="size-2.5 animate-pulse rounded-full bg-current" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">A05 · Planificador de campañas</p>
            <h3 className="mt-1 text-base font-semibold">Preparando el plan para {horizonLabel.toLowerCase()}</h3>
            <p className="mt-1 text-sm leading-5 text-muted">
              Está contrastando señales de la tienda para proponer acciones con fechas. El plan aparecerá aquí y se guardará en el calendario como borrador.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-separator bg-background/60 p-3">
          <p className="mb-2 text-xs font-medium text-muted">Fuentes que intenta consultar</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {contextSources.map((source) => (
              <li key={source} className="flex items-center gap-2 text-sm">
                <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary/70" aria-hidden="true" />
                {source}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">Puede tardar unos segundos. No cierres esta ventana mientras se prepara.</p>
      </div>
    </section>
  );
}

function formatCampaignDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function CampaignPlanProposal({
  organizationId,
  connectionId,
  initialBrief = "",
  onProposed,
  onApplied,
  onRejected,
  mode = "apply",
  initialWindow,
  redirectOnComplete = true,
  onSelect,
  selectedOutputId,
}: {
  organizationId: string;
  connectionId?: string;
  initialBrief?: string;
  onProposed?: () => void;
  onApplied?: (complete?: boolean) => void;
  onRejected?: () => void;
  /**
   * "apply": lleva las campañas al calendario ya (Marketing). "select": solo las
   * elige; se llevan al calendario y al Camino cuando este se acepta.
   */
  mode?: "apply" | "select";
  /** Fechas fijas (el Camino): el plan se genera para esa ventana exacta. */
  initialWindow?: { start: string; end: string };
  redirectOnComplete?: boolean;
  onSelect?: (selection: { outputId: string; indexes: number[]; total: number }) => void;
  selectedOutputId?: string | null;
}) {
  const generationRequestKey = useRef<string | null>(null);
  const router = useRouter();
  const [horizon, setHorizon] = useState(initialWindow ? "custom" : "month");
  const [startDate, setStartDate] = useState(initialWindow?.start ?? "");
  const [endDate, setEndDate] = useState(initialWindow?.end ?? "");
  const [emailTargetCount, setEmailTargetCount] = useState("");
  const [creativeTargetCount, setCreativeTargetCount] = useState("");
  const [market, setMarket] = useState("España");
  const [brief, setBrief] = useState(initialBrief);
  const [proposal, setProposal] = useState<CampaignPlanProposal | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarId, setCalendarId] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<CampaignPlanActionResult | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    if (!connectionId) {
      setProposal(null);
      setCalendars([]);
      setCalendarId("");
      setError("Selecciona una tienda en el selector superior para consultar su calendario.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [planResponse, planningResponse] = await Promise.all([
        apiFetch(`/v1/organizations/${organizationId}/ai/campaign-plan${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`),
        apiFetch(`/v1/organizations/${organizationId}/campaign-planning${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`),
      ]);

      if (!planResponse.ok) {
        setError(await readApiError(planResponse));
        return;
      }
      const payload = (await planResponse.json()) as {
        proposal: CampaignPlanProposal | null;
      };
      setProposal(payload.proposal);
      const proposalTimezone = payload.proposal?.content?.planning_window?.timezone || "UTC";
      const todayInProposalTimezone = new Intl.DateTimeFormat("en-CA", {
        timeZone: proposalTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      // Todas marcadas por defecto: el consultor descarta, no selecciona una a
      // una. Lo normal es querer el plan entero.
      setSelected(
        new Set(
            (payload.proposal?.content?.calendar_actions ?? (payload.proposal?.content?.campaigns ?? []).map((campaign, index) => ({ index, scheduled_date: campaign.scheduled_date })))
              .map((_, index) => index)
              .filter((index) => mode === "select" || !payload.proposal?.applied_indexes?.includes(index))
              // Una acción con fecha ya pasada no se puede llevar al calendario.
              .filter((index) => ((payload.proposal?.content?.calendar_actions ?? payload.proposal?.content?.campaigns ?? [])[index]?.scheduled_date ?? "9999") >= todayInProposalTimezone),
        ),
      );

      if (planningResponse.ok) {
        const planning = (await planningResponse.json()) as {
          calendars?: Calendar[];
        };
        const list = (planning.calendars ?? []).filter(
          (calendar) => calendar.status !== "archived",
        );
        setCalendars(list);
        setCalendarId((current) =>
          list.some((calendar) => calendar.id === current)
            ? current
            : (list[0]?.id ?? ""),
        );
      } else {
        setCalendars([]);
        setError(await readApiError(planningResponse));
      }
    } catch {
      setError("No se pudo cargar el plan de campañas. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, connectionId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!connectionId) {
      setError("Selecciona una tienda en el selector superior antes de generar el calendario.");
      return;
    }
    setIsGenerating(true);
    setConfirmReject(false);
    setError(null);
    setActionResult(null);
    try {
      generationRequestKey.current ??= crypto.randomUUID();
      const query = connectionId
        ? `?connectionId=${encodeURIComponent(connectionId)}`
        : "";
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/campaign-plan/run${query}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": generationRequestKey.current },
          body: JSON.stringify({
            horizon,
            ...(horizon === "custom" ? { start_date: startDate, end_date: endDate } : {}),
            market: market.trim(),
            ...((brief.trim() || emailTargetCount || creativeTargetCount) ? {
              brief: [
                brief.trim(),
                emailTargetCount ? `Objetivo de planificación solicitado: ${emailTargetCount} envíos de Klaviyo durante toda la ventana. Cada envío debe ser una acción fechada independiente, con tema y brief propios; no escribas el contenido final.` : "",
                creativeTargetCount ? `Objetivo de planificación solicitado: ${creativeTargetCount} anuncios/creativos de Meta durante toda la ventana. Cada anuncio debe ser una acción fechada independiente, con formato y brief propios; no generes el recurso creativo.` : "",
              ].filter(Boolean).join("\n\n").slice(0, 2000),
            } : {}),
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const generated = (await response.json()) as { output_id?: string };
      generationRequestKey.current = null;
      if (!generated.output_id) {
        const detail = "El servidor terminó la propuesta, pero no devolvió el identificador necesario para guardarla en el calendario.";
        setError(detail);
        setActionResult({ tone: "warn", title: "Propuesta generada, pendiente de guardar", detail });
        await load();
        onProposed?.();
        return;
      }
      const saveResponse = await apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning/from-proposal/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            output_id: generated.output_id,
            ...(calendarId ? { calendar_id: calendarId } : {}),
            selected_indexes: [...selected],
          }),
        },
      );
      if (!saveResponse.ok) {
        const detail = `El plan se generó, pero no se pudo guardar en el calendario: ${await readApiError(saveResponse)}`;
        setError(detail);
        setActionResult({ tone: "warn", title: "Plan generado, aún no está en el calendario", detail, retryable: true });
        await load();
        onProposed?.();
        return;
      }
      const saved = (await saveResponse.json()) as {
        created: number;
        already_created?: number;
        failed: Array<{ title: string; error: string }>;
      };
      const total = saved.created + (saved.already_created ?? 0);
      setActionResult(saved.failed.length
        ? {
            tone: "warn",
            title: "Plan guardado parcialmente",
            detail: `${saved.created} acciones nuevas añadidas${saved.already_created ? `; ${saved.already_created} ya estaban en el calendario` : ""}. No se pudieron guardar: ${saved.failed.map((item) => item.title).join(", ")}.`,
            retryable: true,
          }
        : total
          ? {
              tone: "success",
              title: "Plan guardado en el calendario",
              detail: `${saved.created} acciones nuevas${saved.already_created ? ` y ${saved.already_created} que ya estaban` : ""}. Quedan como planificación interna; todavía no se han creado piezas ni se ha enviado nada.`,
            }
          : {
              tone: "warn",
              title: "Plan generado sin acciones para guardar",
              detail: "A05 no ha recomendado acciones fechadas para este periodo con los datos disponibles.",
            });
      await load();
      onProposed?.();
      if (saved.failed.length) {
        setError(`El plan se guardó parcialmente. No se pudieron añadir: ${saved.failed.map((item) => item.title).join(", ")}`);
        return;
      }
      toast.success(total
        ? `${total} acciones fechadas añadidas al calendario como planificación interna. No se ha generado ni enviado contenido.`
        : "Plan listo; no propone acciones para este periodo con los datos disponibles.");
    } catch {
      setError("No se pudo generar el plan. Reintenta.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function retrySaveAsDraft() {
    if (!proposal?.output_id) return;
    setIsApplying(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning/from-proposal/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            output_id: proposal.output_id,
            ...(calendarId ? { calendar_id: calendarId } : {}),
            selected_indexes: [...selected],
          }),
        },
      );
      if (!response.ok) {
        const detail = await readApiError(response);
        setError(detail);
        setActionResult({ tone: "warn", title: "No se pudo guardar todavía", detail, retryable: true });
        return;
      }
      const saved = (await response.json()) as {
        created: number;
        already_created?: number;
        failed: Array<{ title: string; error: string }>;
      };
      const total = saved.created + (saved.already_created ?? 0);
      setActionResult(saved.failed.length
        ? {
            tone: "warn",
            title: "Plan guardado parcialmente",
            detail: `${saved.created} acciones nuevas añadidas${saved.already_created ? `; ${saved.already_created} ya estaban en el calendario` : ""}. No se pudieron guardar: ${saved.failed.map((item) => item.title).join(", ")}.`,
            retryable: true,
          }
        : total
          ? {
              tone: "success",
              title: "Plan guardado en el calendario",
              detail: `${saved.created} acciones nuevas${saved.already_created ? ` y ${saved.already_created} que ya estaban` : ""}. Quedan pendientes de revisión; no se ha publicado ni enviado nada.`,
            }
          : {
              tone: "warn",
              title: "No hay acciones para guardar",
              detail: "A05 no propuso acciones fechadas en esta planificación.",
            });
      await load();
      onProposed?.();
    } catch {
      const detail = "No se pudo guardar la propuesta. Reintenta.";
      setError(detail);
      setActionResult({ tone: "warn", title: "No se pudo guardar todavía", detail, retryable: true });
    } finally {
      setIsApplying(false);
    }
  }

  async function apply() {
    if (!proposal || !calendarId) return;
    setIsApplying(true);
    setError(null);
    setActionResult(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning/from-proposal/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            output_id: proposal.output_id,
            calendar_id: calendarId,
            selected_indexes: [...selected],
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const result = (await response.json()) as {
        created: number;
        already_created?: number;
        complete?: boolean;
        failed: Array<{ title: string; error: string }>;
      };
      const total = result.created + (result.already_created ?? 0);
      setActionResult(result.failed.length
        ? {
            tone: "warn",
            title: "Plan guardado parcialmente",
            detail: `${result.created} acciones nuevas añadidas${result.already_created ? `; ${result.already_created} ya estaban en el calendario` : ""}. No se pudieron guardar: ${result.failed.map((item) => item.title).join(", ")}.`,
          }
        : {
            tone: "success",
            title: total ? "Plan actualizado en el calendario" : "No se añadieron acciones",
            detail: total
              ? `${result.created} acciones nuevas${result.already_created ? ` y ${result.already_created} que ya estaban` : ""}. Quedan como planificación interna; todavía no se han creado piezas ni se ha enviado nada.`
              : "No hay acciones nuevas seleccionadas para añadir.",
          });
      toast.success(result.complete
        ? "El plan completo está en el calendario como planificación interna."
        : `${result.created} acción(es) añadidas como planificación interna; puedes completar las pendientes.`);
      if (result.failed.length > 0) {
        setError(
          `No se pudieron crear ${result.failed.length}: ${result.failed
            .map((item) => item.title)
            .join(", ")}`,
        );
      }
      await load();
      onApplied?.(result.complete);
      if (result.complete && redirectOnComplete) {
        const params = new URLSearchParams();
        if (connectionId) params.set("connectionId", connectionId);
        const plannedStart = proposal?.content?.planning_window.start_date;
        if (plannedStart) params.set("date", plannedStart);
        router.push(`/planificacion/calendario?${params.toString()}`);
      }
    } catch {
      setError("No se pudo llevar el plan al calendario. Reintenta.");
    } finally {
      setIsApplying(false);
    }
  }

  async function rejectProposal() {
    if (!proposal?.output_id) return;
    setIsRejecting(true);
    setError(null);
    try {
      const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/campaign-plan/${proposal.output_id}/reject${query}`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setProposal(null);
      setSelected(new Set());
      setActionResult(null);
      setConfirmReject(false);
      await load();
      onRejected?.();
      toast.success("Plan rechazado. Sus campañas planificadas se han quitado del calendario.");
    } catch {
      setError("No se pudo rechazar el plan. Reintenta.");
    } finally {
      setIsRejecting(false);
    }
  }

  function toggle(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const content = proposal?.content ?? null;
  const todayInProposalTimezone = new Intl.DateTimeFormat("en-CA", {
    timeZone: content?.planning_window?.timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const actions: PlannedCalendarAction[] = content
    ? content.calendar_actions ?? content.campaigns.map((campaign, index) => ({
        index,
        initiative_index: null,
        initiative: campaign.initiative || campaign.title,
        title: campaign.title,
        channel: campaign.channel,
        scheduled_date: campaign.scheduled_date,
        scheduled_time: campaign.scheduled_time,
        action_type: "legacy_action",
        objective: campaign.objective,
        audience: campaign.audience,
        purpose: campaign.objective,
        creative_brief: campaign.creative_brief,
        breadcrumb: [campaign.title],
        hierarchy: {},
        description: campaign.hypothesis,
      }))
    : [];
  const actionCount = actions.length;
  const emailActionCount = actions.filter((action) => action.action_type === "klaviyo_campaign_message").length;
  const metaCreativeCount = actions.filter((action) => action.action_type === "meta_ad_creative").length;
  const monthlySummary = Object.entries(actions.reduce<Record<string, { emails: number; meta: number; other: number }>>((months, action) => {
    const month = action.scheduled_date.slice(0, 7);
    const entry = months[month] ?? { emails: 0, meta: 0, other: 0 };
    if (action.action_type === "klaviyo_campaign_message") entry.emails += 1;
    else if (action.action_type === "meta_ad_creative") entry.meta += 1;
    else entry.other += 1;
    months[month] = entry;
    return months;
  }, {})).sort(([a], [b]) => a.localeCompare(b));
  const weeklySummary = Object.entries(actions.reduce<Record<string, { emails: number; meta: number; other: number }>>((weeks, action) => {
    const date = new Date(`${action.scheduled_date}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const week = date.toISOString().slice(0, 10);
    const entry = weeks[week] ?? { emails: 0, meta: 0, other: 0 };
    if (action.action_type === "klaviyo_campaign_message") entry.emails += 1;
    else if (action.action_type === "meta_ad_creative") entry.meta += 1;
    else entry.other += 1;
    weeks[week] = entry;
    return weeks;
  }, {})).sort(([a], [b]) => a.localeCompare(b));
  const alreadyApplied = proposal?.status === "published";
  const allCalendarized = Boolean(
    content && actionCount > 0 &&
    (proposal?.applied_indexes?.length ?? 0) >= actionCount,
  );
  const renderAction = (action: PlannedCalendarAction) => (
    <li key={`action-${action.index}`} className="rounded-md border border-separator p-3">
      <div className="flex flex-wrap items-start gap-2">
        <Checkbox
          checked={selected.has(action.index)}
          disabled={(mode !== "select" && proposal?.applied_indexes?.includes(action.index)) || action.scheduled_date < todayInProposalTimezone}
          onChange={() => toggle(action.index)}
        >
          <span className="text-sm font-medium">{action.title}</span>
        </Checkbox>
        {action.action_type === "klaviyo_flow_preparation" ? <Badge tone="brand">Flow · automático</Badge> : <ChannelBadge channel={action.channel} />}
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">
          {formatCampaignDate(action.scheduled_date)} · {action.scheduled_time ?? "09:00"} ({content?.planning_window.timezone ?? "hora local"})
        </span>
        {proposal?.calendar_indexes?.includes(action.index) ? <Badge tone="success">En calendario</Badge> : null}
      </div>
      <div className="mt-2 space-y-1 pl-6">
        {action.breadcrumb.length > 1 ? <p className="text-xs text-muted">{action.breadcrumb.join(" / ")}</p> : null}
        {typeof action.hierarchy.budget_guidance === "string" ? <p className="text-xs text-muted"><b>Presupuesto orientativo:</b> {action.hierarchy.budget_guidance}</p> : null}
        {Array.isArray(action.hierarchy.placements) ? <p className="text-xs text-muted"><b>Ubicaciones:</b> {action.hierarchy.placements.filter((placement): placement is string => typeof placement === "string").join(", ")}</p> : null}
        <p className="text-xs text-muted">{action.purpose}</p>
        <p className="text-xs text-muted"><span className="font-medium text-foreground">Audiencia: </span>{action.audience}</p>
        <p className="whitespace-pre-line text-xs text-muted"><span className="font-medium text-foreground">Guía para producción: </span>{action.creative_brief}</p>
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        Prepara un calendario de esta tienda usando ventas, stock, email, Meta, estacionalidad e historial. Las iniciativas fechadas se añaden como planificación interna; aquí no se genera HTML ni se envía o publica nada.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-44"
            aria-label="Horizonte del plan"
            value={horizon}
            onChange={setHorizon}
            options={HORIZONS}
          />
          <Button
            type="button"
            variant={content ? "secondary" : "primary"}
            disabled={!connectionId || isGenerating || isLoading || isApplying || isRejecting}
            onClick={() => void generate()}
          >
            {isGenerating
              ? "Analizando la tienda..."
              : content
                ? "Proponer otro"
                : "Proponer plan"}
          </Button>
        </div>
      </div>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {actionResult ? (
        <div className="space-y-2">
          <Banner tone={actionResult.tone}>
            <span className="font-semibold">{actionResult.title}. </span>{actionResult.detail}
          </Banner>
          {actionResult.retryable && proposal?.output_id ? (
            <Button type="button" size="sm" variant="secondary" disabled={isApplying || isGenerating} onClick={() => void retrySaveAsDraft()}>
              {isApplying ? "Guardando..." : "Reintentar guardar esta propuesta"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {horizon === "custom" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Desde">
            <input className="w-full rounded-md border border-separator bg-background px-3 py-2 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="Hasta">
            <input className="w-full rounded-md border border-separator bg-background px-3 py-2 text-sm" type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fijar cantidad de mailings (opcional)">
          <input className="w-full rounded-md border border-separator bg-background px-3 py-2 text-sm" type="number" min="1" max="30" value={emailTargetCount} onChange={(event) => setEmailTargetCount(event.target.value)} placeholder="A05 la decide con conocimiento e histórico" />
        </Field>
        <Field label="Fijar cantidad de creativos Meta (opcional)">
          <input className="w-full rounded-md border border-separator bg-background px-3 py-2 text-sm" type="number" min="1" max="30" value={creativeTargetCount} onChange={(event) => setCreativeTargetCount(event.target.value)} placeholder="A05 la decide con conocimiento e histórico" />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-muted">Déjalas vacías para que A05 consulte primero el conocimiento relevante y decida las cantidades al contrastarlo con estacionalidad, histórico, audiencia y stock. Nunca se envía ni publica desde aquí.</p>

      <Field label="Mercado para fechas comerciales (opcional)">
        <input className="w-full rounded-md border border-separator bg-background px-3 py-2 text-sm" value={market} onChange={(event) => setMarket(event.target.value)} placeholder="Ej.: España" />
        <p className="mt-1 text-xs text-muted">Se usa para tener en cuenta festivos y momentos comerciales locales. No implica que exista demanda sin datos de la tienda.</p>
      </Field>

      <Field label="Contexto de la llamada (opcional)">
        <Textarea
          value={brief}
          maxLength={2000}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="La idea o acuerdo que A05 debe contrastar con los datos de la tienda"
          rows={3}
        />
        <p className="mt-1 text-xs text-muted">
          La IA lo usará como dirección inicial, pero comprobará su viabilidad con margen, stock y rendimiento actuales.
        </p>
      </Field>

      {isLoading ? (
        <LoadingBlock label="Cargando plan..." />
      ) : isGenerating ? (
        <CampaignPlanGenerating horizon={horizon} />
      ) : !content ? (
        <EmptyState
          title="Todavía no hay plan propuesto"
          hint="Elige el horizonte y pide una propuesta. Se apoya en las cifras reales de esta tienda y avisa de lo que le falta."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-sm font-semibold">
              {content.plan_name}
            </p>
            <Badge tone={CONFIDENCE[content.confidence]?.tone ?? "neutral"}>
              {CONFIDENCE[content.confidence]?.label ?? content.confidence}
            </Badge>
            <Badge tone="neutral">{actionCount} acciones</Badge>
            <Badge tone="neutral">{emailActionCount} mailings</Badge>
            <Badge tone="neutral">{metaCreativeCount} creativos Meta</Badge>
          </div>

          <p className="text-sm leading-6">{content.diagnosis}</p>

          <p className="text-xs text-muted">
            Calendario: {formatCampaignDate(content.planning_window.start_date)}–{formatCampaignDate(content.planning_window.end_date)} · zona horaria {content.planning_window.timezone}
          </p>
          {monthlySummary.length ? (
            <div className="flex flex-wrap gap-2" aria-label="Resumen mensual de acciones planificadas">
              {monthlySummary.map(([month, counts]) => (
                <span key={month} className="rounded-md border border-separator px-3 py-2 text-xs tabular-nums">
                  <strong>{new Date(`${month}-01T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</strong>
                  {` · ${counts.emails} envíos · ${counts.meta} creativos Meta${counts.other ? ` · ${counts.other} preparaciones` : ""}`}
                </span>
              ))}
            </div>
          ) : null}
          {weeklySummary.length ? (
            <details className="rounded-md border border-separator px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium">Ver distribución por semanas</summary>
              <ul className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
                {weeklySummary.map(([week, counts]) => (
                  <li key={week} className="tabular-nums">
                    Semana del {formatCampaignDate(week)}: {counts.emails} envíos, {counts.meta} creativos Meta{counts.other ? `, ${counts.other} preparaciones` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {actionCount === 0 ? (
            /* Salida legitima del contrato: sin datos suficientes, A05 devuelve
               lista vacia en vez de inventar un plan. */
            <Banner tone="warn">
              El agente no ha propuesto ninguna acción fechada. Suele significar que
              faltan datos: revisa los avisos de abajo.
            </Banner>
          ) : content.initiatives?.length ? (
            <ol className="space-y-4">
              {content.initiatives.map((initiative, initiativeIndex) => {
                const initiativeActions = actions.filter((action) => action.initiative_index === initiativeIndex);
                return (
                  <li key={`${initiative.name}-${initiativeIndex}`} className="rounded-lg border border-separator p-4">
                    <details className="group">
                      <summary className="flex cursor-pointer flex-wrap items-center gap-2 marker:text-muted">
                        <span className="min-w-0 flex-1 text-sm font-semibold">{initiative.name}</span>
                        <span className="text-xs text-muted">{formatCampaignDate(initiative.start_date)}–{formatCampaignDate(initiative.end_date)}</span>
                        <Badge tone="neutral">{initiativeActions.length} acciones</Badge>
                      </summary>
                    <div className="mt-3 space-y-3">
                    <header className="space-y-1">
                      <p className="text-sm">{initiative.objective}</p>
                      <p className="text-xs text-muted"><b>Audiencia:</b> {initiative.audience}</p>
                      <p className="text-xs text-muted"><b>Oferta · {initiative.offer.status === "verified" ? "confirmada" : initiative.offer.status === "proposal" ? "pendiente de aprobar" : "ninguna"}:</b> {initiative.offer.description}</p>
                      <p className="text-xs text-muted"><b>Periodo:</b> {formatCampaignDate(initiative.start_date)}–{formatCampaignDate(initiative.end_date)}</p>
                      <p className="text-xs text-muted"><b>Hipótesis:</b> {initiative.hypothesis}</p>
                      <p className="text-xs text-muted"><b>Éxito:</b> {initiative.success_metric}</p>
                      <EvidenceChips evidence={initiative.evidence} />
                    </header>
                    <ol className="space-y-2">{initiativeActions.map(renderAction)}</ol>
                    </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          ) : (
            <ol className="space-y-3">{actions.map(renderAction)}</ol>
          )}

          <AiEvidence sources={content.sources} warnings={content.warnings} />

          {mode === "select" && actionCount > 0 && proposal ? (
            <div className="space-y-2 border-t border-separator pt-3">
              <Button
                type="button"
                disabled={selected.size === 0}
                onClick={() => onSelect?.({ outputId: proposal.output_id, indexes: [...selected].sort((a, b) => a - b), total: actionCount })}
              >
                {selectedOutputId === proposal.output_id ? "Actualizar selección" : `Usar ${selected.size} de ${actionCount} acciones con el Camino`}
              </Button>
            </div>
          ) : alreadyApplied ? (
            <Banner tone="success">Este plan ya se llevó al calendario.</Banner>
          ) : allCalendarized ? (
            <Banner tone="success">
              Todas las acciones ya están en el calendario como planificación interna. Revisa allí las fechas; no se ha generado HTML ni se ha enviado o publicado contenido.
            </Banner>
          ) : actionCount > 0 ? (
            <div className="space-y-2 border-t border-separator pt-3">
              <p className="text-sm font-semibold text-foreground">
                Completar planificación en el calendario
              </p>
              {calendars.length === 0 ? (
                <Banner tone="warn">
                  Esta tienda no tiene ningún calendario de campañas. Crea uno
                  en Planificación y vuelve.
                </Banner>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    className="w-64"
                    aria-label="Calendario de destino"
                    value={calendarId}
                    onChange={setCalendarId}
                    options={calendars.map((calendar) => ({
                      value: calendar.id,
                      label: `${calendar.name} · ${calendar.year}`,
                    }))}
                  />
                  <Button
                    type="button"
                    disabled={isApplying || selected.size === 0 || !calendarId}
                    onClick={() => void apply()}
                  >
                    {isApplying
                      ? "Creando..."
                      : `Añadir ${selected.size} de ${actionCount} acciones`}
                  </Button>
                  <span className="text-xs text-muted">
                    Se guardan como planificadas; esta acción no aprueba ni publica el plan.
                  </span>
                </div>
              )}
            </div>
          ) : null}
          {proposal ? (
            <div className="border-t border-separator pt-3">
              {confirmReject ? (
                <div className="space-y-2">
                  <p className="text-sm">Se quitarán del calendario las campañas planificadas de esta propuesta. Esta acción no se puede deshacer.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="danger" disabled={isRejecting || isGenerating || isApplying} onClick={() => void rejectProposal()}>
                      {isRejecting ? "Rechazando..." : "Sí, rechazar y borrar"}
                    </Button>
                    <Button type="button" variant="secondary" disabled={isRejecting} onClick={() => setConfirmReject(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="secondary" disabled={isRejecting || isGenerating || isApplying} onClick={() => setConfirmReject(true)}>
                  Rechazar plan y borrar campañas
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
