"use client";

/**
 * FASE 3 / D08 — que puede estar pasando, y que ya se ha descartado.
 *
 * LO QUE ESTA PANTALLA NO PUEDE DEJAR QUE PASE: que la lista se lea como un
 * diagnostico. Cinco explicaciones ordenadas invitan a quedarse con la primera,
 * y el guardrail 1 dice justamente que la primera causa plausible no lo es. Por
 * eso no hay ranking, ninguna esta marcada como la buena, y cuando nada las
 * separa se avisa con esas palabras.
 *
 * TRES PILAS, NO UNA LISTA. Arriba **lo que puede tumbarlo todo** ("puede que no
 * haya caido nada y sea el tracking"): si eso es cierto, lo demas sobra, y
 * leerlo el ultimo es leerlo tarde. En medio lo que sigue en pie. Y abajo **lo
 * descartado con su motivo**, que es medio bloque: sin eso, dentro de un mes
 * alguien repite la misma busqueda.
 *
 * Solo consultor. Una lista de hipotesis delante de un cliente se lee como una
 * lista de diagnosticos.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";

import {
  availabilityLabel,
  confidenceLabel,
  coverageLabel,
  groupByCase,
  priorLabel,
  separationWarning,
  splitEvidence,
  splitHypotheses,
  statusLabel,
  typeLabel,
  type HypothesisView,
} from "./hypotheses-view-model";

function Test({ hypothesis }: { hypothesis: HypothesisView }) {
  const test = hypothesis.test;
  if (!test) return null;
  const origen = availabilityLabel(test.availability);

  return (
    <div className="border-default-200 mt-3 border-l-2 pl-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-xs uppercase tracking-wide">Lo que despejaría esto</p>
        {/* Guardrail 47: de donde sale el dato manda sobre que dato es. */}
        <Badge tone={origen.tone}>{origen.label}</Badge>
      </div>
      <p className="mt-1 max-w-prose text-sm leading-6">{test.diagnostic_question}</p>
      {test.required_data ? (
        <p className="text-muted mt-1 max-w-prose text-sm leading-6">{test.required_data}</p>
      ) : null}
      {/* Las dos predicciones juntas: un test cuyo resultado encaja con las dos
          cosas no discrimina nada, y verlas al lado lo delata. */}
      <ul className="text-muted mt-2 space-y-1 text-sm leading-6">
        <li>Si es cierta: {test.expected_if_true}</li>
        <li>Si no lo es: {test.expected_if_false}</li>
      </ul>
    </div>
  );
}

function Hipotesis({ hypothesis }: { hypothesis: HypothesisView }) {
  const estado = statusLabel(hypothesis.status);
  const confianza = confidenceLabel(hypothesis.confidence);
  const cobertura = coverageLabel(hypothesis.explanatory_coverage);
  const { mirada, huecos } = splitEvidence(hypothesis.evidence);

  return (
    <li className="border-default-200 border-t py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone={estado.tone}>{estado.label}</Badge>
        <Badge tone="neutral">{typeLabel(hypothesis.hypothesis_type)}</Badge>
        <Badge tone={confianza.tone}>{confianza.label}</Badge>
      </div>

      <p className="mt-2 max-w-prose leading-6">{hypothesis.statement}</p>

      {hypothesis.rejection_reason ? (
        // El motivo va delante de todo lo demas: es lo unico que importa de una
        // hipotesis muerta, y lo que evita repetir la busqueda.
        <p className="mt-2 max-w-prose text-sm leading-6">
          Se cayó porque: {hypothesis.rejection_reason}
        </p>
      ) : null}

      {/* El prior y la confianza, separados siempre (guardrail 2). */}
      <p className="text-muted mt-2 max-w-prose text-sm leading-6">
        {priorLabel(hypothesis.prior_plausibility)}
        {cobertura ? `. ${cobertura}.` : "."}
      </p>

      {hypothesis.residual_note ? (
        <p className="text-muted mt-1 max-w-prose text-sm leading-6">
          {hypothesis.residual_note}
        </p>
      ) : null}

      {hypothesis.falsification_condition ? (
        // El campo mas util de la tabla: una hipotesis que no dice que la
        // tumbaria no se puede descartar nunca.
        <p className="mt-2 max-w-prose text-sm leading-6">
          La tumbaría: {hypothesis.falsification_condition}
        </p>
      ) : null}

      {mirada.length > 0 ? (
        <ul className="text-muted mt-2 space-y-1 text-sm leading-6">
          {mirada.map((e, i) => (
            <li key={`${hypothesis.id}-m-${i}`}>
              {e.relation === "contradicts" ? "En contra: " : "A favor: "}
              {e.observation}
            </li>
          ))}
        </ul>
      ) : null}

      {huecos.length > 0 ? (
        // Guardrail 5: lo que nadie ha mirado no contradice nada, y no puede
        // compartir lista con lo observado.
        <ul className="text-muted mt-2 space-y-1 text-sm leading-6">
          {huecos.map((e, i) => (
            <li key={`${hypothesis.id}-h-${i}`}>Nadie lo ha mirado: {e.observation}</li>
          ))}
        </ul>
      ) : null}

      <Test hypothesis={hypothesis} />
    </li>
  );
}

export function HypothesesPanel() {
  const [hypotheses, setHypotheses] = useState<HypothesisView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/hypotheses")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as { hypotheses: HypothesisView[] };
        setHypotheses(payload.hypotheses);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar las hipótesis por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !hypotheses) {
    return <LoadingBlock label="Cargando las hipótesis..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!hypotheses) return null;

  const casos = groupByCase(hypotheses);

  return (
    <Card
      title="Qué puede estar pasando"
      description="Las explicaciones que se han barajado para cada caso, ninguna elegida. Las descartadas siguen abajo con el motivo: sin eso, dentro de un mes alguien repite la misma búsqueda."
    >
      {casos.length === 0 ? (
        <EmptyState
          title="Sin hipótesis"
          hint="Aparecen cuando el motor causal ha dejado rutas candidatas sobre las que trabajar."
        />
      ) : (
        <div className="space-y-8">
          {casos.map(({ caseId, hypotheses: lista }) => {
            const { challenger, vivas, descartadas } = splitHypotheses(lista);
            const aviso = separationWarning(lista);

            return (
              <div key={caseId}>
                {challenger.length > 0 ? (
                  // Arriba a propósito: si esto es cierto, lo de abajo sobra.
                  <div className="border-warning/40 mb-4 border-l-2 pl-3">
                    <p className="text-xs uppercase tracking-wide">
                      Lo que tumbaría todo lo demás
                    </p>
                    <ul>
                      {challenger.map((h) => (
                        <Hipotesis key={h.id} hypothesis={h} />
                      ))}
                    </ul>
                  </div>
                ) : null}

                {aviso ? (
                  <p className="text-muted mb-2 max-w-prose text-sm leading-6">{aviso}</p>
                ) : null}

                {vivas.length > 0 ? (
                  <ul>
                    {vivas.map((h) => (
                      <Hipotesis key={h.id} hypothesis={h} />
                    ))}
                  </ul>
                ) : null}

                {descartadas.length > 0 ? (
                  <div className="border-default-200 mt-4 border-t pt-3">
                    <p className="text-muted text-xs uppercase tracking-wide">
                      Ya descartadas, y por qué
                    </p>
                    <ul>
                      {descartadas.map((h) => (
                        <Hipotesis key={h.id} hypothesis={h} />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
