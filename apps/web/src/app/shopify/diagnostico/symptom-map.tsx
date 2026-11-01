"use client";

/**
 * FASE 3 / D06 — el mapa de sintomas, en pantalla.
 *
 * Es la tercera pregunta de la cadena. `D01` en `/integraciones` contesta "¿me
 * puedo fiar del dato?". `D02`, justo debajo de esto, "¿que significa este
 * movimiento?". Y esto: **¿que patron forman los movimientos juntos?**
 *
 * Y lo que NO contesta esta escrito en la propia tarjeta, no solo en este
 * comentario: por que pasa. Un sintoma sin esa linea se lee como una causa, y
 * entonces el consultor entra en la llamada con una conclusion que el sistema
 * nunca ha afirmado.
 *
 * Solo consultor, como `D02` y por el mismo motivo llevado un paso mas: un
 * patron sin causa le da al cliente el susto sin la salida.
 */

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

import {
  buildSymptomTree,
  coherenceReasons,
  confidenceLabel,
  persistenceLabel,
  relationLabel,
  scopeLabel,
  signalRoleLabel,
  valenceLabel,
  type SymptomView,
} from "./symptom-map-view-model";

function SignalList({ symptom }: { symptom: SymptomView }) {
  if (symptom.signals.length === 0) return null;

  return (
    <ul className="mt-3 space-y-1 text-sm">
      {symptom.signals.map((senal, indice) => {
        const papel = signalRoleLabel(senal.role);
        return (
          <li
            key={`${senal.id ?? senal.metric}-${indice}`}
            className="flex flex-wrap items-center gap-2"
          >
            <Badge tone={papel.tone}>{papel.label}</Badge>
            <span className="font-mono tabular-nums">
              {senal.metric ?? "señal"}
            </span>
            {senal.direction ? (
              <span className="text-muted">{senal.direction}</span>
            ) : null}
            {typeof senal.magnitude_relative === "number" ? (
              <span className="text-muted font-mono tabular-nums">
                {(senal.magnitude_relative * 100).toFixed(1)}%
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SymptomBody({ symptom }: { symptom: SymptomView }) {
  const valencia = valenceLabel(symptom.valence);
  const confianza = confidenceLabel(symptom.confidence);
  const contradicen = symptom.evidence.filter(
    (e) => e.stance === "contradicting",
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">{symptom.label}</span>
        {symptom.organization_name ? (
          <span className="text-muted text-sm">
            {symptom.organization_name}
          </span>
        ) : null}
        <Badge tone={valencia.tone}>{valencia.label}</Badge>
        <Badge tone={confianza.tone}>{confianza.label}</Badge>
      </div>

      <p className="text-muted mt-1 text-sm">
        {scopeLabel(symptom)} · {persistenceLabel(symptom)}
      </p>

      <p className="mt-2 max-w-prose text-sm leading-6">{confianza.detail}</p>

      <ul className="text-muted mt-2 space-y-1 text-sm">
        {coherenceReasons(symptom).map((razon) => (
          <li key={razon}>· {razon}</li>
        ))}
      </ul>

      <SignalList symptom={symptom} />

      {contradicen.length > 0 ? (
        // Guardrail 13. Va en su propio bloque y con el mismo peso visual que lo
        // demas: lo que no encaja es lo primero que hay que mirar.
        <div className="mt-3 rounded-md border border-danger/40 bg-danger-soft/20 p-3">
          <p className="text-xs uppercase tracking-wide">Lo que no encaja</p>
          {contradicen.map((e) => (
            <p
              key={e.observation}
              className="text-muted mt-1 max-w-prose text-sm leading-6"
            >
              {e.observation}
              {e.representativeness
                ? ` (representatividad: ${e.representativeness})`
                : ""}
            </p>
          ))}
        </div>
      ) : null}

      {symptom.relations.length > 0 ? (
        <p className="text-muted mt-3 text-xs">
          {symptom.relations.map((r) => relationLabel(r.relation)).join(", ")}{" "}
          otro síntoma activo. Coincidir no es explicar.
        </p>
      ) : null}
    </>
  );
}

export function SymptomMapPanel() {
  const [symptoms, setSymptoms] = useState<SymptomView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/symptoms")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as { symptoms: SymptomView[] };
        setSymptoms(payload.symptoms);
        setError(null);
      })
      .catch(() => {
        if (!cancelled)
          setError("No se pudieron cargar los síntomas por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !symptoms) {
    return <LoadingBlock label="Cargando el mapa de síntomas..." />;
  }
  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }
  if (!symptoms) return null;

  const arbol = buildSymptomTree(symptoms);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Qué patrón forman las señales</CardTitle>
        <CardDescription>Los síntomas activos: qué señales los sostienen, qué los contradice y hasta dónde llega lo que se puede afirmar. Ninguno dice por qué pasa.</CardDescription>
      </CardHeader>
      <CardContent>
        {arbol.length === 0 ? (
          <EmptyState
            title="Sin síntomas activos"
            hint="Aparecen cuando varias señales coherentes entre sí forman un patrón. Coincidir en el tiempo no basta."
          />
        ) : (
          <ul>
            {arbol.map(({ symptom, children }) => (
              <li
                key={symptom.id}
                className="border-t border-default-200 py-5 first:border-t-0 first:pt-0"
              >
                <SymptomBody symptom={symptom} />

                {children.length > 0 ? (
                  <div className="mt-4 space-y-4 border-l border-default-200 pl-4">
                    {/* Guardrail 43: el resultado no es donde se para el diagnostico. */}
                    <p className="text-muted text-xs uppercase tracking-wide">
                      En qué se descompone
                    </p>
                    {children.map((hijo) => (
                      <div key={hijo.id}>
                        <SymptomBody symptom={hijo} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
