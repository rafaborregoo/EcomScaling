"use client";

/**
 * FASE 3 / D11 — cuanto se puede afirmar de cada cosa, en pantalla.
 *
 * Es la ultima pregunta de la cadena, y la que le pone freno a todas las
 * anteriores. `D05` dice que cambio, `D06` que patron forman, `D04` como deja
 * eso a cada capacidad, `D10` cuanto costo -- y **esto dice de cuanto de todo
 * eso nos podemos fiar**, capa por capa.
 *
 * POR QUE IMPORTA ESTA PANTALLA MAS QUE SU TAMANO. Con senal, sintoma e impacto
 * medido, un caso **parece** un diagnostico cerrado. Poner al lado la fila "¿Por
 * que pasa? — no puede determinarse" es lo unico que impide leerlo asi. Si
 * alguna vez alguien resume esto en una sola confianza media, esa fila
 * desaparece justo cuando mas falta hace.
 *
 * Solo consultor: una lista de "sin dato suficiente" sin acompanamiento se lee
 * como que el sistema no sirve, cuando lo que dice es que falta una pieza
 * concreta y nombrada.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";

import {
  confidenceLabel,
  dimensionLabel,
  epistemicLabel,
  groupByCase,
  layerQuestion,
  negativeClaimLabel,
  ratingTone,
  resolvabilityLabel,
  splitUncertainties,
  weakDimensions,
  type ClaimView,
  type UncertaintyView,
} from "./confidence-view-model";

function LayerRow({ claim }: { claim: ClaimView }) {
  const nivel = confidenceLabel(claim.confidence_level);
  const origen = epistemicLabel(claim.epistemic_state);
  const negativa = negativeClaimLabel(claim.negative_claim_state);
  const debiles = weakDimensions(claim);

  return (
    <li className="border-t border-default-200 py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* La pregunta, no la etiqueta tecnica: deja claro que hay una respuesta
            esperada y que aqui se dice si la tenemos. */}
        <span className="font-medium">{layerQuestion(claim.claim_layer)}</span>
        <Badge tone={nivel.tone}>{nivel.label}</Badge>
        <Badge tone={origen.tone}>{origen.label}</Badge>
      </div>

      <p className="mt-1 max-w-prose text-sm leading-6">{claim.claim}</p>

      {negativa ? (
        <p className="text-muted mt-1 max-w-prose text-sm leading-6">{negativa}</p>
      ) : null}

      {claim.cap_reason ? (
        // El techo y su motivo: una confianza baja sin decir que la baja es una
        // opinion con nombre tecnico.
        <p className="text-muted mt-2 max-w-prose text-sm leading-6">
          Techo: {claim.cap_reason}
        </p>
      ) : null}

      {debiles.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {debiles.map((d) => (
            <li key={d.dimension} className="flex flex-wrap items-center gap-2">
              <Badge tone={ratingTone(d.rating)}>{dimensionLabel(d.dimension)}</Badge>
              <span className="text-muted">{d.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {claim.missing_evidence ? (
        <p className="text-muted mt-2 max-w-prose text-sm leading-6">
          Para afirmar más haría falta: {claim.missing_evidence}
        </p>
      ) : null}

      {claim.limitations ? (
        <p className="text-muted mt-2 max-w-prose text-sm leading-6">{claim.limitations}</p>
      ) : null}
    </li>
  );
}

function Uncertainties({ uncertainties }: { uncertainties: UncertaintyView[] }) {
  if (uncertainties.length === 0) return null;
  const { criticas, resto } = splitUncertainties(uncertainties);

  return (
    <div className="mt-4 space-y-4">
      {criticas.length > 0 ? (
        // Un critical unknown no es una duda mas: es lo que impide cerrar el
        // caso, y el esquema no deja escribir uno sin decir que lo resolveria.
        <div className="border-danger/40 border-l-2 pl-3">
          <p className="text-xs uppercase tracking-wide">Lo que impide cerrar el caso</p>
          {criticas.map((u) => (
            <div key={u.id} className="mt-2">
              <p className="max-w-prose text-sm leading-6">{u.description}</p>
              {u.required_evidence ? (
                <p className="text-muted mt-1 max-w-prose text-sm leading-6">
                  Lo resolvería: {u.required_evidence} ({resolvabilityLabel(u.resolvability)}).
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {resto.length > 0 ? (
        <div>
          <p className="text-muted text-xs uppercase tracking-wide">Otras incertidumbres</p>
          <ul className="text-muted mt-1 space-y-1 text-sm">
            {resto.map((u) => (
              <li key={u.id}>
                · {u.description} ({resolvabilityLabel(u.resolvability)})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ConfidencePanel() {
  const [claims, setClaims] = useState<ClaimView[] | null>(null);
  const [uncertainties, setUncertainties] = useState<UncertaintyView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/confidence")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          claims: ClaimView[];
          uncertainties: UncertaintyView[];
        };
        setClaims(payload.claims);
        setUncertainties(payload.uncertainties);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar la confianza por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !claims) {
    return <LoadingBlock label="Cargando la confianza por capa..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!claims) return null;

  const casos = groupByCase(claims);

  return (
    <Card
      title="De qué nos podemos fiar"
      description="Capa por capa: qué se sabe, cómo se sabe y qué haría falta para saber más. Se enseñan todas juntas a propósito — un caso con señal, patrón e impacto medido parece cerrado hasta que se lee la fila que dice que nadie sabe por qué pasa."
    >
      {casos.length === 0 ? (
        <EmptyState
          title="Sin lecturas de confianza"
          hint="Aparecen cuando hay un caso abierto y el motor recorre lo que los demás han escrito sobre él."
        />
      ) : (
        <div className="space-y-6">
          {casos.map(({ caseId, claims: capas }) => (
            <div key={caseId}>
              <ul>
                {capas.map((claim) => (
                  <LayerRow key={claim.id} claim={claim} />
                ))}
              </ul>
              <Uncertainties
                uncertainties={uncertainties.filter((u) => u.case_id === caseId)}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
