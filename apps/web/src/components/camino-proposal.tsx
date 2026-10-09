"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { A01_CAMINO_BRIEF_KEY, parseA01BriefHandoff } from "@/lib/a01-call-handoff";
import { EvidenceChips } from "@/components/ai-proposed-tasks";
import { calendarHorizonDays } from "@/app/camino/camino-calendar";
import {
  AiEvidence,
  Badge,
  Banner,
  Button,
  Card,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Select,
  Textarea,
  toast,
} from "@/components/ui";

/**
 * Propuesta de camino del agente A19.
 *
 * Es el modulo para las tiendas que NO tienen consultor asignado -- la IA les
 * dibuja el plan -- y el borrador de partida para las que si: el consultor
 * genera, lee y edita despues con las herramientas del arbol.
 *
 * Dos cosas que no son negociables aqui:
 *  - No se autogenera al abrir la pantalla. Un camino cuesta caro de generar y
 *    se lee despacio; el GET solo recupera lo que ya exista.
 *  - Aceptar crea el plan en BORRADOR. Activarlo sigue siendo un gesto humano
 *    aparte, igual que con un plan escrito a mano.
 */

type CaminoEvidence = {
  label: string;
  value: string;
  period: string | null;
  source: string;
};

type CaminoMilestone = {
  name: string;
  description: string;
  target_offset_days: number;
  success_metric: string;
};

type CaminoPhase = {
  name: string;
  description: string;
  rationale: string;
  evidence: CaminoEvidence[];
  milestones: CaminoMilestone[];
};

type CaminoGoal = {
  metric_key: string;
  metric_label: string;
  unit: "money" | "pct" | "count" | "ratio";
  currency_code: string | null;
  baseline: number | null;
  target: number | null;
  target_offset_days: number;
  monthly_targets?: Array<{ month: number; target_value: number | null; rationale: string }>;
  rationale: string;
  assumptions: string[];
  confidence: "low" | "medium" | "high";
};

type CaminoProposalContent = {
  plan_name: string;
  horizon_months?: number;
  diagnosis: string;
  goal?: CaminoGoal;
  phases: CaminoPhase[];
  sources: Array<{ kind: string; reference: string; period: string | null }>;
  confidence: "low" | "medium" | "high";
  warnings: string[];
};

type CaminoProposal = {
  output_id: string;
  run_id: string;
  status: string;
  generated_at: string;
  horizon_months: number | null;
  content: CaminoProposalContent | null;
};

const HORIZONS = Array.from({ length: 12 }, (_, index) => {
  const months = index + 1;
  return { value: String(months), label: months === 1 ? "1 mes" : `${months} meses` };
});

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "Confianza baja",
  medium: "Confianza media",
  high: "Confianza alta",
};

// Fecha real del hito: el modelo propone dias desde hoy y el backend la fija al
// aceptar. Aqui se muestra la fecha que tendria si se aceptase ahora mismo, que
// es lo que el consultor necesita para juzgar si el reparto es realista.
function targetDateLabel(offsetDays: number) {
  return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString(
    "es-ES",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

function goalValue(goal: CaminoGoal, value: number | null) {
  if (value === null) return "sin baseline/objetivo cuantificable";
  if (goal.unit === "money" && goal.currency_code) {
    try {
      return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: goal.currency_code,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${value} ${goal.currency_code}`;
    }
  }
  if (goal.unit === "money") return `${value} (moneda no disponible)`;
  return goal.unit === "pct" ? `${value}%` : String(value);
}

export function CaminoProposal({
  organizationId,
  connectionId,
  hasOpenPlan,
  onPlanCreated,
}: {
  organizationId: string;
  connectionId?: string;
  /** Con un plan en borrador o activo no se puede crear otro (409 del backend). */
  hasOpenPlan: boolean;
  onPlanCreated: () => void;
}) {
  const searchParams = useSearchParams();
  const fromCall = searchParams.get("fromCall") === "1";
  const [horizon, setHorizon] = useState("3");
  const [brief, setBrief] = useState("");
  const [adjustedHorizon, setAdjustedHorizon] = useState("3");
  const [adjustedGoalTarget, setAdjustedGoalTarget] = useState("");
  const [proposal, setProposal] = useState<CaminoProposal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callHandoffConsumed = useRef(false);

  useEffect(() => {
    if (!fromCall || !organizationId || callHandoffConsumed.current) return;
    callHandoffConsumed.current = true;
    const stagedBrief = parseA01BriefHandoff(
      window.sessionStorage.getItem(A01_CAMINO_BRIEF_KEY),
      organizationId,
    );
    window.sessionStorage.removeItem(A01_CAMINO_BRIEF_KEY);
    if (stagedBrief) setBrief(stagedBrief);
  }, [fromCall, organizationId]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ horizonMonths: horizon });
      if (connectionId) query.set("connectionId", connectionId);
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/camino-proposal?${query.toString()}`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        proposal: CaminoProposal | null;
      };
      setProposal(payload.proposal);
      if (payload.proposal) {
        setAdjustedHorizon(String(payload.proposal.content?.horizon_months ?? payload.proposal.horizon_months ?? horizon));
        setAdjustedGoalTarget(payload.proposal.content?.goal?.target == null ? "" : String(payload.proposal.content.goal.target));
      }
      setError(null);
    } catch {
      setError("No se pudo cargar la propuesta de camino. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, horizon, connectionId]);

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
        `/v1/organizations/${organizationId}/ai/camino-proposal/run${query}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            horizon_months: Number(horizon),
            ...(brief.trim() ? { brief: brief.trim().slice(0, 2000) } : {}),
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await load();
      toast.success("Camino propuesto. Revísalo antes de crearlo.");
    } catch {
      setError("No se pudo generar el camino. Reintenta.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function acceptProposal() {
    if (!proposal) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/strategic-plan/from-proposal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            output_id: proposal.output_id,
            horizon_months: Number(adjustedHorizon),
            ...(proposal.content?.goal ? { goal_target: adjustedGoalTarget.trim() ? Number(adjustedGoalTarget) : null } : {}),
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Camino creado como borrador. Revísalo y actívalo.");
      await load();
      onPlanCreated();
    } catch {
      setError("No se pudo crear el camino. Reintenta.");
    } finally {
      setIsCreating(false);
    }
  }

  const content = proposal?.content ?? null;
  const proposalHorizon = Math.max(1, content?.horizon_months ?? proposal?.horizon_months ?? Number(horizon));
  const proposalHorizonDays = calendarHorizonDays(proposalHorizon);
  const adjustedHorizonDays = calendarHorizonDays(Number(adjustedHorizon));
  const scaledMilestoneOffset = (days: number) => Math.min(
    adjustedHorizonDays,
    Math.round((days * adjustedHorizonDays) / proposalHorizonDays),
  );
  const alreadyApplied = proposal?.status === "published";
  const totalMilestones =
    content?.phases.reduce(
      (total, phase) => total + phase.milestones.length,
      0,
    ) ?? 0;

  return (
    <Card
      title="Nueva versión con IA"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-36"
            aria-label="Horizonte del camino"
            value={horizon}
            disabled={isLoading || isGenerating || isCreating}
            onChange={(value) => {
              setHorizon(value);
              setProposal(null);
            }}
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
                : "Proponer camino"}
          </Button>
        </div>
      }
    >
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <Field label="Acuerdo o cambio citado en una llamada (opcional)">
        <Textarea
          value={brief}
          maxLength={2000}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Qué pidió cambiar el cliente; la IA lo contrastará con resultados y margen"
          rows={3}
        />
      </Field>

      {isLoading ? (
        <LoadingBlock label="Cargando propuesta..." />
      ) : isGenerating ? (
        <LoadingBlock label="La IA está analizando ventas, margen, stock y adquisición..." />
      ) : !content ? null : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-sm font-semibold">
              {content.plan_name}
            </p>
            <Badge
              tone={
                content.confidence === "high"
                  ? "success"
                  : content.confidence === "medium"
                    ? "neutral"
                    : "warn"
              }
            >
              {CONFIDENCE_LABEL[content.confidence] ?? content.confidence}
            </Badge>
            <Badge tone="neutral">
              {content.phases.length} fases · {totalMilestones} hitos
            </Badge>
          </div>

          <p className="text-sm leading-6">{content.diagnosis}</p>

          {content.goal ? (
            <div className="rounded-lg border border-separator bg-surface-subtle p-3">
              <p className="text-xs font-medium text-muted">Objetivo recomendado</p>
              <p className="mt-1 text-sm font-semibold">
                  {content.goal.metric_label}: {goalValue(content.goal, content.goal.baseline)}
                  {content.goal.target === null ? " → objetivo por definir" : ` → ${goalValue(content.goal, content.goal.target)}`}
              </p>
              <p className="mt-1 text-xs text-muted">
                Plazo recomendado: {Math.max(1, Math.ceil(content.goal.target_offset_days / 30))} meses · {content.goal.rationale}
              </p>
              {content.goal.monthly_targets?.length ? (
                <div className="mt-3 rounded-md border border-separator bg-surface p-3">
                  <p className="text-xs font-medium">Trayectoria de revisión mensual</p>
                  <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {content.goal.monthly_targets.map((checkpoint) => (
                      <li key={checkpoint.month} className="rounded border border-separator p-2 text-xs">
                        <strong>Mes {checkpoint.month}: {goalValue(content.goal!, checkpoint.target_value)}</strong>
                        <p className="mt-1 text-muted">{checkpoint.rationale}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium">
                  Plazo al crear el borrador
                  <Select className="mt-1 w-full" aria-label="Plazo ajustado para el Camino" value={adjustedHorizon} disabled={isCreating || alreadyApplied} onChange={setAdjustedHorizon} options={HORIZONS} />
                </label>
                <label className="text-xs font-medium">
                  Objetivo ajustado ({content.goal.unit === "money" ? content.goal.currency_code ?? "moneda" : content.goal.unit})
                  <Input className="mt-1" type="number" step="any" value={adjustedGoalTarget} disabled={isCreating || alreadyApplied} onChange={(event) => setAdjustedGoalTarget(event.target.value)} placeholder="Sin objetivo cuantificado" />
                </label>
              </div>
              {Number(adjustedHorizon) !== (content.horizon_months ?? proposal?.horizon_months ?? Number(horizon)) ? <p className="mt-2 text-xs text-muted">Al crear el borrador, las fechas de hitos y del objetivo se reajustarán proporcionalmente al plazo elegido. Podrás revisarlas antes de activar el Camino.</p> : null}
              {content.goal.assumptions.length ? (
                <p className="mt-1 text-xs text-muted">Supuestos: {content.goal.assumptions.join(" · ")}</p>
              ) : null}
            </div>
          ) : null}

          <ol className="space-y-3">
            {content.phases.map((phase, phaseIndex) => (
              <li
                key={`${phase.name}-${phaseIndex}`}
                className="rounded-lg border border-separator p-3"
              >
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 text-xs font-medium text-muted">
                    Fase {phaseIndex + 1}
                  </span>
                  <h3 className="min-w-0 text-sm font-semibold">
                    {phase.name}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-muted">{phase.description}</p>
                {phase.rationale ? (
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-medium text-foreground">
                      Por qué ahora:{" "}
                    </span>
                    {phase.rationale}
                  </p>
                ) : null}
                <EvidenceChips evidence={phase.evidence} />

                <ul className="mt-3 space-y-2">
                  {phase.milestones.map((milestone, milestoneIndex) => (
                    <li
                      key={`${milestone.name}-${milestoneIndex}`}
                      className="border-t border-separator pt-2 first:border-t-0 first:pt-0"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="min-w-0 text-xs font-medium">
                          {milestone.name}
                        </p>
                        <span className="shrink-0 text-[0.65rem] text-muted">
                          {targetDateLabel(scaledMilestoneOffset(milestone.target_offset_days))}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {milestone.description}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        <span className="font-medium text-foreground">
                          Se cumple cuando:{" "}
                        </span>
                        {milestone.success_metric}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <AiEvidence sources={content.sources} warnings={content.warnings} />

          {alreadyApplied ? (
            <Banner tone="success">
              Esta propuesta ya se convirtió en un plan.
            </Banner>
          ) : hasOpenPlan ? (
            <Banner tone="warn">
              Ya hay un plan en borrador o activo. Archívalo o complétalo antes
              de crear este camino; mientras tanto puedes usar la propuesta como
              guía para editar el plan actual.
            </Banner>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={isCreating}
                onClick={() => void acceptProposal()}
              >
                {isCreating ? "Creando..." : "Crear este camino"}
              </Button>
              <span className="text-xs text-muted">
                Se crea como borrador: podrás editar fases e hitos antes de
                activarlo.
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
