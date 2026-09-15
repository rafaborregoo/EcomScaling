"use client";

/**
 * FASE 3 / D04 — la salud por capacidad, en pantalla.
 *
 * Cierra la lectura de la pagina. `D03` dice de que es capaz el negocio, `D05`
 * que se ha movido, `D06` que patron forman esos movimientos, y esto: **como
 * esta cada capacidad hoy**.
 *
 * Lo que hoy ensena casi entero es la segunda lista: las capacidades que **no se
 * pueden juzgar** y que falta declarar para poder hacerlo. No es un estado
 * transitorio ni un fallo -- es el guardrail 11 funcionando. Sin que alguien
 * diga contra que se juzga el CAC en esta tienda, clasificar la adquisicion es
 * aplicar un numero de fuera.
 *
 * Solo consultor: el estado de una capacidad ("tu operativa esta mal") es una
 * etiqueta sin la conversacion que la acompana.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";

import {
  capabilityLabel,
  riskNote,
  severityLabel,
  splitByAssessability,
  splitEvidence,
  stateLabel,
  trajectoryLabel,
  type CapabilityHealthView,
} from "./capability-health-view-model";

function Findings({ assessment }: { assessment: CapabilityHealthView }) {
  if (assessment.findings.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2 text-sm">
      {assessment.findings.map((hallazgo, indice) => {
        const severidad = severityLabel(hallazgo.severity);
        return (
          <li key={`${hallazgo.description}-${indice}`} className="flex flex-wrap items-center gap-2">
            {/* La severidad es del hallazgo, no de la capacidad (guardrail 6).
                Por eso vive aqui y no tine la tarjeta de arriba. */}
            <Badge tone={severidad.tone}>{severidad.label}</Badge>
            <span>{hallazgo.description}</span>
            {hallazgo.kind === "opportunity" ? (
              <span className="text-muted text-xs">oportunidad, no problema</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function AssessmentBody({ assessment }: { assessment: CapabilityHealthView }) {
  const estado = stateLabel(assessment.health_state);
  const trayectoria = trajectoryLabel(assessment.trajectory);
  const riesgo = riskNote(assessment);
  const { contradice, positiva } = splitEvidence(assessment);

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">{capabilityLabel(assessment.capability)}</span>
        {assessment.organization_name ? (
          <span className="text-muted text-sm">{assessment.organization_name}</span>
        ) : null}
        <Badge tone={estado.tone}>{estado.label}</Badge>
        {/* Estado y trayectoria como dos cosas: "mal mejorando" y "sana cayendo
            en picado" son situaciones distintas y una sola etiqueta las iguala. */}
        {trayectoria ? <span className="text-muted text-sm">{trayectoria}</span> : null}
      </div>

      {assessment.assessment_blocker ? (
        <p className="mt-2 max-w-prose text-sm leading-6">
          {assessment.assessment_blocker}
        </p>
      ) : null}

      {assessment.state_justification ? (
        <p className="mt-2 max-w-prose text-sm leading-6">
          {assessment.state_justification}
        </p>
      ) : null}

      {assessment.current_failure && !assessment.state_justification ? (
        <p className="text-muted mt-2 max-w-prose text-sm leading-6">
          {assessment.current_failure}
        </p>
      ) : null}

      {riesgo ? <p className="text-muted mt-2 text-sm">{riesgo}</p> : null}

      <Findings assessment={assessment} />

      {positiva.length > 0 ? (
        <ul className="text-muted mt-3 space-y-1 text-sm">
          {positiva.map((e, i) => (
            <li key={`${e.metric}-${i}`}>· {e.observation}</li>
          ))}
        </ul>
      ) : null}

      {contradice.length > 0 ? (
        // Guardrails 27 y 28: lo que contradice el estado no se tira y no se
        // esconde entre lo que encaja, porque es lo que hay que resolver.
        <div className="border-danger/40 mt-3 border-l-2 pl-3">
          <p className="text-xs uppercase tracking-wide">Lo que contradice este estado</p>
          {contradice.map((e, i) => (
            <p key={`${e.metric}-${i}`} className="text-muted mt-1 max-w-prose text-sm leading-6">
              {e.observation}
              {e.indicator_type === "leading" ? " (indicador adelantado)" : ""}
            </p>
          ))}
          {assessment.contradiction_resolution ? (
            <p className="mt-2 max-w-prose text-sm leading-6">
              {assessment.contradiction_resolution}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function CapabilityHealthPanel() {
  const [assessments, setAssessments] = useState<CapabilityHealthView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/capability-health")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          assessments: CapabilityHealthView[];
        };
        setAssessments(payload.assessments);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar la salud por capacidad por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !assessments) {
    return <LoadingBlock label="Cargando la salud por capacidad..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!assessments) return null;

  const { evaluadas, sinEvaluar } = splitByAssessability(assessments);

  return (
    <Card
      title="Cómo está cada capacidad"
      description="El estado de hoy y hacia dónde va, como dos cosas distintas. La severidad vive en cada hallazgo, no en la capacidad: un problema grave y localizado no pinta de rojo algo que funciona."
    >
      {assessments.length === 0 ? (
        <EmptyState
          title="Sin lecturas de salud"
          hint="Aparecen cuando el motor corre sobre las señales y los síntomas de una tienda."
        />
      ) : null}

      {evaluadas.length > 0 ? (
        <ul>
          {evaluadas.map((assessment) => (
            <li
              key={assessment.id}
              className="border-t border-default-200 py-5 first:border-t-0 first:pt-0"
            >
              <AssessmentBody assessment={assessment} />
            </li>
          ))}
        </ul>
      ) : null}

      {sinEvaluar.length > 0 ? (
        // No es un cajon de descartes: hoy es el contenido principal, y cada
        // fila dice exactamente que declarar para que esa capacidad se pueda
        // juzgar. El guardrail 11 prohibe el atajo de clasificarla igualmente.
        <div className={evaluadas.length > 0 ? "mt-6 border-t border-default-200 pt-4" : ""}>
          <p className="text-muted text-xs uppercase tracking-wide">
            Lo que todavía no se puede juzgar
          </p>
          <ul className="mt-2">
            {sinEvaluar.map((assessment) => (
              <li key={assessment.id} className="border-t border-default-200 py-5 first:border-t-0">
                <AssessmentBody assessment={assessment} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
