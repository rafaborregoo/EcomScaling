"use client";

/**
 * FASE 3 / D10 — cuanto dano hay, en pantalla.
 *
 * Es la ultima pregunta de la cadena que hoy se puede contestar. `D05` dice que
 * cambio, `D06` que patron forman esos cambios, `D04` como deja eso a cada
 * capacidad, y esto: **cuanto dinero se movio y sobre que base**.
 *
 * Lo que NO contesta esta escrito en la propia tarjeta: **como de grave es**.
 * La fuente no define formula de severidad ni umbral de cuota (apartado 29,
 * guardrail 17), asi que las cinco severidades salen `unknown` y la pantalla
 * explica por que en vez de dejar un hueco.
 *
 * Y tampoco dice que se ataca primero: los guardrails 3, 46, 47 y 48 dejan el
 * orden en F4. Por eso la lista va por fecha y no por importe.
 *
 * Solo consultor: una cifra de perdida sin causa y sin gravedad, delante de un
 * cliente, es un susto con factura y sin salida.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
} from "@/components/ui";

import {
  amountText,
  chosenShare,
  confidenceRow,
  denominatorLabel,
  quantificationLabel,
  severityAbsenceReason,
  sortAssessments,
  type SeverityView,
} from "./severity-view-model";

function Measurements({ assessment }: { assessment: SeverityView }) {
  if (assessment.measurements.length === 0) return null;

  return (
    <ul className="mt-3 space-y-3 text-sm">
      {assessment.measurements.map((medida, indice) => {
        const importe = amountText(medida);
        const firmeza = quantificationLabel(medida);
        return (
          <li key={`${medida.dimension}-${indice}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono tabular-nums font-medium">
                {importe ?? "sin cifrar"}
              </span>
              {/* La cifra nunca va sola: al lado va de que firmeza es. */}
              <Badge tone={firmeza.tone}>{firmeza.label}</Badge>
              {medida.metric ? (
                <span className="text-muted">{medida.metric}</span>
              ) : null}
            </div>
            {medida.assumptions ? (
              // Guardrail 22: los supuestos se ven. Una cifra sin ellos se lee
              // como un hecho cuando es una resta contra un modelo.
              <p className="text-muted mt-1 max-w-prose leading-6">
                {medida.assumptions}
              </p>
            ) : null}
            {medida.note ? (
              <p className="text-muted mt-1 max-w-prose leading-6">
                {medida.note}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function Exposures({ assessment }: { assessment: SeverityView }) {
  if (assessment.exposures.length === 0) return null;

  return (
    <ul className="text-muted mt-3 space-y-1 text-sm">
      {assessment.exposures.map((exposicion) => (
        <li key={exposicion.denominator}>
          ·{" "}
          {exposicion.exposure_share != null
            ? `${(exposicion.exposure_share * 100).toFixed(1)}% de ${denominatorLabel(exposicion.denominator)}`
            : `${denominatorLabel(exposicion.denominator)}: ${
                exposicion.denominator_value?.toLocaleString("es-ES") ??
                "sin medir"
              }`}
          {exposicion.denominator_note
            ? ` — ${exposicion.denominator_note}`
            : ""}
        </li>
      ))}
    </ul>
  );
}

function AssessmentBody({ assessment }: { assessment: SeverityView }) {
  const cuota = chosenShare(assessment);
  const sinSeveridad = severityAbsenceReason(assessment);

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">{assessment.target}</span>
        {assessment.organization_name ? (
          <span className="text-muted text-sm">
            {assessment.organization_name}
          </span>
        ) : null}
        {assessment.measurement_compromised ? (
          <Badge tone="warn">Medición comprometida</Badge>
        ) : null}
      </div>

      {assessment.summary ? (
        <p className="mt-2 max-w-prose text-sm leading-6">
          {assessment.summary}
        </p>
      ) : null}

      <Measurements assessment={assessment} />

      {cuota?.rationale ? (
        // Guardrail 16: elegir una base en vez de otra es un juicio, y se razona.
        <p className="text-muted mt-3 max-w-prose text-sm leading-6">
          {cuota.rationale}
        </p>
      ) : null}

      <Exposures assessment={assessment} />

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {/* Las tres confianzas juntas y separadas: se puede saber muy bien
            cuanto se movio el dinero y no tener ni idea de por que. */}
        {confidenceRow(assessment).map((fila) => (
          <span key={fila.label} className="flex items-center gap-1">
            <span className="text-muted text-xs">{fila.label}</span>
            <Badge tone={fila.tone}>{fila.value}</Badge>
          </span>
        ))}
      </div>

      {sinSeveridad ? (
        <div className="mt-3 rounded-md border border-default-200 p-3">
          <p className="text-xs uppercase tracking-wide">
            Por qué no hay una gravedad
          </p>
          <p className="text-muted mt-1 max-w-prose text-sm leading-6">
            {sinSeveridad}
          </p>
        </div>
      ) : null}

      {assessment.limitations ? (
        <p className="text-muted mt-3 max-w-prose text-xs leading-5">
          {assessment.limitations}
        </p>
      ) : null}
    </>
  );
}

export function SeverityPanel() {
  const [assessments, setAssessments] = useState<SeverityView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/severity")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          assessments: SeverityView[];
        };
        setAssessments(payload.assessments);
        setError(null);
      })
      .catch(() => {
        if (!cancelled)
          setError("No se pudo cargar el impacto medido por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !assessments) {
    return <LoadingBlock label="Cargando el impacto medido..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!assessments) return null;

  const ordenadas = sortAssessments(assessments);

  return (
    <Card
      title="Cuánto daño hay"
      description="Cuánto se movió, sobre qué base y con qué supuestos. Ninguna cifra dice cuán grave es, y el orden de la lista no es un orden de ataque: eso se decide con el esfuerzo y el momento delante, que aquí no están."
    >
      {ordenadas.length === 0 ? (
        <EmptyState
          title="Sin impacto medido"
          hint="Aparece cuando hay un caso abierto con una señal en su ventana. Que no haya nada no significa que no haya daño: significa que no se ha medido."
        />
      ) : (
        <ul>
          {ordenadas.map((assessment) => (
            <li
              key={assessment.id}
              className="border-t border-default-200 py-5 first:border-t-0 first:pt-0"
            >
              <AssessmentBody assessment={assessment} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
