"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { EvidenceChips } from "@/components/ai-proposed-tasks";
import { ChannelBadge } from "@/components/marketing-channel";
import {
  AiEvidence,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  LoadingBlock,
  Select,
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
  title: string;
  channel: string;
  objective: string;
  audience: string;
  hypothesis: string;
  start_offset_days: number;
  duration_days: number;
  evidence: CampaignEvidence[];
  success_metric: string;
};

type CampaignPlanContent = {
  plan_name: string;
  diagnosis: string;
  campaigns: ProposedCampaign[];
  sources: Array<{ kind: string; reference: string; period: string | null }>;
  confidence: "low" | "medium" | "high";
  warnings: string[];
};

type CampaignPlanProposal = {
  output_id: string;
  run_id: string;
  status: string;
  generated_at: string;
  content: CampaignPlanContent | null;
};

type Calendar = { id: string; name: string; year: number; status: string };

const HORIZONS = [
  { value: "month", label: "Próximo mes" },
  { value: "quarter", label: "Próximo trimestre" },
];

const CONFIDENCE: Record<string, { label: string; tone: Tone }> = {
  low: { label: "Confianza baja", tone: "warn" },
  medium: { label: "Confianza media", tone: "neutral" },
  high: { label: "Confianza alta", tone: "success" },
};


// Fechas que tendría la campaña si se aprobara ahora mismo. El backend las
// vuelve a calcular al aceptar, anclándolas a ESE momento: un plan aprobado
// una semana después no arranca con la primera campaña ya empezada.
function windowLabel(startOffsetDays: number, durationDays: number) {
  const start = new Date(Date.now() + startOffsetDays * 86_400_000);
  const end = new Date(start.getTime() + durationDays * 86_400_000);
  const fmt = (date: Date) =>
    date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${fmt(start)} → ${fmt(end)} · ${durationDays} d`;
}

export function CampaignPlanProposal({
  organizationId,
  connectionId,
  onApplied,
}: {
  organizationId: string;
  connectionId?: string;
  onApplied?: () => void;
}) {
  const [horizon, setHorizon] = useState("month");
  const [proposal, setProposal] = useState<CampaignPlanProposal | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarId, setCalendarId] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const [planResponse, planningResponse] = await Promise.all([
        apiFetch(`/v1/organizations/${organizationId}/ai/campaign-plan`),
        apiFetch(`/v1/organizations/${organizationId}/campaign-planning`),
      ]);

      if (!planResponse.ok) {
        setError(await readApiError(planResponse));
        return;
      }
      const payload = (await planResponse.json()) as {
        proposal: CampaignPlanProposal | null;
      };
      setProposal(payload.proposal);
      // Todas marcadas por defecto: el consultor descarta, no selecciona una a
      // una. Lo normal es querer el plan entero.
      setSelected(
        new Set(
          (payload.proposal?.content?.campaigns ?? []).map(
            (_, index) => index,
          ),
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
        setCalendarId((current) => current || (list[0]?.id ?? ""));
      }
      setError(null);
    } catch {
      setError("No se pudo cargar el plan de campañas. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setIsGenerating(true);
    setError(null);
    try {
      const query = connectionId
        ? `?connectionId=${encodeURIComponent(connectionId)}`
        : "";
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/campaign-plan/run${query}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ horizon }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await load();
      toast.success("Plan propuesto. Revísalo antes de llevarlo al calendario.");
    } catch {
      setError("No se pudo generar el plan. Reintenta.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function apply() {
    if (!proposal || !calendarId) return;
    setIsApplying(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/campaign-planning/from-proposal`,
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
        failed: Array<{ title: string; error: string }>;
      };
      toast.success(
        `${result.created} campaña(s) en el calendario, como planificadas.`,
      );
      if (result.failed.length > 0) {
        setError(
          `No se pudieron crear ${result.failed.length}: ${result.failed
            .map((item) => item.title)
            .join(", ")}`,
        );
      }
      await load();
      onApplied?.();
    } catch {
      setError("No se pudo llevar el plan al calendario. Reintenta.");
    } finally {
      setIsApplying(false);
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
  const alreadyApplied = proposal?.status === "published";

  return (
    <Card
      title="Plan de campañas propuesto"
      description="Mira ventas, margen, stock, email y adquisición de esta tienda y propone qué lanzar y cuándo. No publica nada: lo aprobado entra en el calendario como planificado."
      actions={
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
            disabled={isGenerating}
            onClick={() => void generate()}
          >
            {isGenerating
              ? "Analizando la tienda..."
              : content
                ? "Proponer otro"
                : "Proponer plan"}
          </Button>
        </div>
      }
    >
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {isLoading ? (
        <LoadingBlock label="Cargando plan..." />
      ) : isGenerating ? (
        <LoadingBlock label="Analizando ventas, margen, stock, email y adquisición..." />
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
            <Badge tone="neutral">{content.campaigns.length} campañas</Badge>
          </div>

          <p className="text-sm leading-6">{content.diagnosis}</p>

          {content.campaigns.length === 0 ? (
            /* Salida legitima del contrato: sin datos suficientes, A05 devuelve
               lista vacia en vez de inventar un plan. */
            <Banner tone="warn">
              El agente no ha propuesto ninguna campaña. Suele significar que
              faltan datos: revisa los avisos de abajo.
            </Banner>
          ) : (
            <ol className="space-y-3">
              {content.campaigns.map((campaign, index) => (
                <li
                  key={`${campaign.title}-${index}`}
                  className="rounded-lg border border-separator p-3"
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <Checkbox
                      checked={selected.has(index)}
                      onChange={() => toggle(index)}
                    >
                      <span className="text-sm font-medium">
                        {campaign.title}
                      </span>
                    </Checkbox>
                    <ChannelBadge channel={campaign.channel} />
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">
                      {windowLabel(
                        campaign.start_offset_days,
                        campaign.duration_days,
                      )}
                    </span>
                  </div>

                  <div className="mt-1 space-y-1 pl-6">
                    <p className="text-xs text-muted">{campaign.objective}</p>
                    <p className="text-xs text-muted">
                      <span className="font-medium text-foreground">
                        Audiencia:{" "}
                      </span>
                      {campaign.audience}
                    </p>
                    {/* La hipotesis es lo que separa una campana de un capricho:
                        siempre visible, no plegada. */}
                    <p className="text-xs text-muted">
                      <span className="font-medium text-foreground">
                        Hipótesis:{" "}
                      </span>
                      {campaign.hypothesis}
                    </p>
                    <p className="text-xs text-muted">
                      <span className="font-medium text-foreground">
                        Se cumple cuando:{" "}
                      </span>
                      {campaign.success_metric}
                    </p>
                    <EvidenceChips evidence={campaign.evidence} />
                  </div>
                </li>
              ))}
            </ol>
          )}

          <AiEvidence sources={content.sources} warnings={content.warnings} />

          {alreadyApplied ? (
            <Banner tone="success">
              Este plan ya se llevó al calendario.
            </Banner>
          ) : content.campaigns.length > 0 ? (
            <div className="space-y-2 border-t border-separator pt-3">
              <p className={EYEBROW}>Llevar al calendario</p>
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
                      : `Crear ${selected.size} de ${content.campaigns.length}`}
                  </Button>
                  <span className="text-xs text-muted">
                    Entran como planificadas y sin compartir con el cliente.
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
