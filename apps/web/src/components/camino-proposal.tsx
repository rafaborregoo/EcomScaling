"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { EvidenceChips } from "@/components/ai-proposed-tasks";
import {
  AiEvidence,
  Badge,
  Banner,
  Button,
  Card,
  ErrorBlock,
  LoadingBlock,
  Select,
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

type CaminoProposalContent = {
  plan_name: string;
  diagnosis: string;
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
  content: CaminoProposalContent | null;
};

const HORIZONS = [
  { value: "month", label: "1 mes" },
  { value: "quarter", label: "3 meses" },
  { value: "half_year", label: "6 meses" },
  { value: "year", label: "1 año" },
];

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
  const [horizon, setHorizon] = useState("quarter");
  const [proposal, setProposal] = useState<CaminoProposal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/camino-proposal`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        proposal: CaminoProposal | null;
      };
      setProposal(payload.proposal);
      setError(null);
    } catch {
      setError("No se pudo cargar la propuesta de camino. Reintenta.");
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
        `/v1/organizations/${organizationId}/ai/camino-proposal/run${query}`,
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
          body: JSON.stringify({ output_id: proposal.output_id }),
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
  const alreadyApplied = proposal?.status === "published";
  const totalMilestones =
    content?.phases.reduce((total, phase) => total + phase.milestones.length, 0) ??
    0;

  return (
    <Card
      title="Camino propuesto por la IA"
      description="Analiza los datos reales de esta tienda y la metodología de Conocimiento para proponer fases e hitos con fecha. No activa nada: el plan nace en borrador."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="w-36"
            aria-label="Horizonte del camino"
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
                : "Proponer camino"}
          </Button>
        </div>
      }
    >
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {isLoading ? (
        <LoadingBlock label="Cargando propuesta..." />
      ) : isGenerating ? (
        <LoadingBlock label="La IA está analizando ventas, margen, stock y adquisición..." />
      ) : !content ? (
        <p className="text-sm text-muted">
          Elige el horizonte y pide una propuesta. La IA no inventa el plan: lo
          construye sobre las cifras de esta tienda y avisa de lo que le falta.
        </p>
      ) : (
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

          <ol className="space-y-3">
            {content.phases.map((phase, phaseIndex) => (
              <li
                key={`${phase.name}-${phaseIndex}`}
                className="rounded-lg border border-separator p-3"
              >
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {phaseIndex + 1}
                  </span>
                  <h3 className="min-w-0 text-sm font-semibold">{phase.name}</h3>
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
                      className="border-l-2 border-separator pl-3"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="shrink-0 font-mono text-[0.65rem] text-muted">
                          {phaseIndex + 1}.{milestoneIndex + 1}
                        </span>
                        <p className="min-w-0 text-xs font-medium">
                          {milestone.name}
                        </p>
                        <span className="shrink-0 text-[0.65rem] text-muted">
                          {targetDateLabel(milestone.target_offset_days)}
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

          <AiEvidence
            sources={content.sources}
            warnings={content.warnings}
          />

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
