"use client";

/**
 * FASE 3 / D09 — por qué pasó, y qué límite lo explica.
 *
 * DOS TARJETAS SEPARADAS, NUNCA UNA. La causa raíz responde "¿por qué pasó
 * esto?"; el constraint responde "¿qué me está limitando?". El esquema no las
 * ata con ninguna clave ajena (apartado 23) porque las cuatro combinaciones son
 * reales: causa resuelta con constraint activo, constraint resuelto con un
 * driver estructural que sigue ahí. Juntarlas en pantalla sugeriría que son la
 * misma respuesta, y no lo son.
 *
 * LO QUE ESTA PANTALLA NO PUEDE DEJAR QUE PASE: que "sin resolver" se lea como
 * "casi resuelto" o como "nadie lo ha mirado". Casi todo llega así hoy, y es la
 * respuesta correcta: la evidencia disponible es co-movimiento, y cerrar más
 * sería mentir. Por eso se dice tal cual, con el motivo delante.
 *
 * Solo consultor. Una causa candidata sin cerrar, delante de un cliente, se lee
 * como una causa.
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
  bindingStatusLabel,
  chainRoleLabel,
  confidenceLabel,
  exposureLabel,
  groupConstraintsByCase,
  groupRootCausesByCase,
  missingForBinding,
  roleLabel,
  rootCauseStatusLabel,
  sortChain,
  type ConstraintView,
  type RootCauseView,
} from "./root-cause-view-model";

function Cadena({ rootCause }: { rootCause: RootCauseView }) {
  const pasos = sortChain(rootCause.chain);
  if (pasos.length === 0) return null;

  return (
    <ol className="text-muted mt-2 space-y-1 text-sm leading-6">
      {pasos.map((paso) => (
        <li
          key={`${paso.root_cause_id}-${paso.step_order}`}
          className="flex flex-wrap items-center gap-2"
        >
          <Badge tone={paso.supported ? "brand" : "neutral"}>
            {chainRoleLabel(paso.chain_role)}
          </Badge>
          <span>{paso.statement}</span>
        </li>
      ))}
    </ol>
  );
}

function CausaRaiz({ rootCause }: { rootCause: RootCauseView }) {
  const estado = rootCauseStatusLabel(rootCause.status);
  const confianza = confidenceLabel(rootCause.confidence);

  return (
    <li className="border-default-200 border-t py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone={estado.tone}>{estado.label}</Badge>
        <Badge tone={confianza.tone}>{confianza.label}</Badge>
        <Badge tone="neutral">{roleLabel(rootCause.role)}</Badge>
        {rootCause.affects_observability_only ? (
          <Badge tone="warn">Puede ser la medición</Badge>
        ) : null}
      </div>

      {/* El estado se explica siempre, no solo se etiqueta. */}
      <p className="text-muted mt-1 max-w-prose text-sm leading-6">
        {estado.hint}
      </p>

      <p className="mt-2 max-w-prose leading-6">{rootCause.statement}</p>

      {rootCause.residual_note ? (
        <p className="text-muted mt-1 max-w-prose text-sm leading-6">
          {rootCause.residual_note}
        </p>
      ) : null}

      <Cadena rootCause={rootCause} />

      {rootCause.limitations ? (
        <p className="text-muted mt-2 max-w-prose text-sm leading-6">
          {rootCause.limitations}
        </p>
      ) : null}
    </li>
  );
}

function Cuello({ constraint }: { constraint: ConstraintView }) {
  const estado = bindingStatusLabel(constraint.binding_status);
  const falta = missingForBinding(constraint);
  const test = constraint.tests[0];

  return (
    <li className="border-default-200 border-t py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone={estado.tone}>{estado.label}</Badge>
        <Badge tone="neutral">{exposureLabel(constraint.exposure)}</Badge>
      </div>

      <p className="text-muted mt-1 max-w-prose text-sm leading-6">
        {estado.hint}
      </p>

      <p className="mt-2 max-w-prose leading-6">{constraint.statement}</p>

      {falta ? (
        <p className="text-muted mt-2 max-w-prose text-sm leading-6">{falta}</p>
      ) : null}

      {test ? (
        <div className="mt-3 rounded-md border border-default-200 p-3">
          <p className="text-xs uppercase tracking-wide">
            El test que lo resolvería
          </p>
          <p className="mt-1 max-w-prose text-sm leading-6">
            {test.counterfactual_question}
          </p>
          <ul className="text-muted mt-1 space-y-1 text-sm leading-6">
            <li>Si limita: {test.expected_if_binding}</li>
            <li>Si no limita: {test.expected_if_not_binding}</li>
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export function RootCausePanel() {
  const [rootCauses, setRootCauses] = useState<RootCauseView[] | null>(null);
  const [constraints, setConstraints] = useState<ConstraintView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/root-causes")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          rootCauses: RootCauseView[];
          businessConstraints: ConstraintView[];
        };
        setRootCauses(payload.rootCauses);
        setConstraints(payload.businessConstraints);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "No se pudieron cargar las causas raíz por un error de red.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !rootCauses) {
    return <LoadingBlock label="Cargando causa raíz y límites..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!rootCauses) return null;

  const casosCausa = groupRootCausesByCase(rootCauses);
  const casosConstraint = groupConstraintsByCase(constraints);

  return (
    <div className="space-y-6">
      <Card
        title="Por qué pasó"
        description="La cadena mejor sostenida de cada caso, con su cierre. Casi siempre sale «sin resolver»: la evidencia de hoy es co-movimiento, y cerrar más sería mentir."
      >
        {casosCausa.length === 0 ? (
          <EmptyState
            title="Sin causas evaluadas"
            hint="Aparecen cuando D08 ha dejado hipótesis vivas sobre un caso abierto."
          />
        ) : (
          <div className="space-y-6">
            {casosCausa.map(({ caseId, rootCauses: lista }) => (
              <ul key={caseId}>
                {lista.map((rc) => (
                  <CausaRaiz key={rc.id} rootCause={rc} />
                ))}
              </ul>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Qué le está limitando"
        description="Capacidades con salud mala que podrían estar frenando el objetivo. Ninguna se declara vinculante sin capacidad y demanda medidas: hoy son candidatas, con el test que haría falta correr."
      >
        {casosConstraint.length === 0 ? (
          <EmptyState
            title="Sin límites candidatos"
            hint="Aparecen cuando alguna capacidad tiene salud mala o crítica en D04."
          />
        ) : (
          <div className="space-y-6">
            {casosConstraint.map(({ caseId, constraints: lista }) => (
              <ul key={caseId}>
                {lista.map((k) => (
                  <Cuello key={k.id} constraint={k} />
                ))}
              </ul>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
