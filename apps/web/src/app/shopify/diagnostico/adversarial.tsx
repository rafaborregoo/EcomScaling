"use client";


import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  toast,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  checkStatusLabel,
  comparabilityLabel,
  confounderStatusLabel,
  groupReviewsByCase,
  riskLabel,
  survivalStatusLabel,
  type AdversarialReviewView,
} from "./adversarial-view-model";

/**
 * Presupuesto de revision (decision 2026-09-24): D12 propone reabrir, el
 * consultor confirma o descarta, y como mucho hay dos reaperturas por caso.
 */
function RevisionBlock({ review }: { review: AdversarialReviewView }) {
  const [decided, setDecided] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abierta = review.revisions?.find((r) => r.status === "proposed");
  const usadas = review.revision_budget_used ?? 0;

  async function decide(requestId: string, decision: "confirm" | "decline") {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/consultant/diagnostic-revisions/${requestId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) {
        toast.danger(`No se pudo guardar: ${await readApiError(response)}`);
        return;
      }
      setDecided(decision);
      toast.success(decision === "confirm" ? "Reapertura confirmada: se revisa en la próxima pasada nocturna." : "Reapertura descartada.");
    } finally {
      setBusy(false);
    }
  }

  if (review.revision_state === "budget_exhausted") {
    return (
      <p className="text-danger text-sm">
        Presupuesto de revisión agotado ({usadas} de 2 reaperturas): el caso queda como no concluyente.
      </p>
    );
  }
  if (abierta && !decided) {
    return (
      <Card size="sm"><CardContent className="text-sm">
        <p>
          D12 propone reabrir {abierta.reopened_blocks.join(", ") || "los bloques previos"} (reapertura {abierta.attempt} de 2).
          Hasta que se revise, la confianza del caso no pasa de baja.
        </p>
        <div role="group" aria-label="Decision sobre el diagnostico" className="flex flex-wrap items-center gap-2 mt-2">
          <Button size="sm" onClick={() => void decide(abierta.id, "confirm")} disabled={busy}>
            Confirmar reapertura
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void decide(abierta.id, "decline")} disabled={busy}>
            Descartar
          </Button>
        </div>
      </CardContent></Card>
    );
  }
  if (review.revision_state === "confirmed" || decided === "confirm") {
    return <p className="text-muted text-sm">Reapertura confirmada ({Math.max(usadas, 1)} de 2): se revisa en la próxima pasada nocturna.</p>;
  }
  if (review.revision_triggered) {
    return (
      <p className="text-danger text-sm">
        Reabre: {review.reopened_blocks.join(", ") || "bloques previos"}.
      </p>
    );
  }
  return null;
}

function Review({ review }: { review: AdversarialReviewView }) {
  const status = survivalStatusLabel(review.survival_status);
  const risk = riskLabel(review.false_diagnosis_risk);
  const gate = review.gates[0];
  return (
    <article className="border-default-200 space-y-4 border-t py-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <Badge tone={risk.tone}>{risk.label}</Badge>
        {gate?.comparability ? (
          <Badge tone={comparabilityLabel(String(gate.comparability)).tone}>
            {comparabilityLabel(String(gate.comparability)).label}
          </Badge>
        ) : null}
        <span className="text-muted text-xs">Caso {review.case_id}</span>
      </div>
      <p className="text-muted max-w-prose text-sm leading-6">{status.hint}</p>
      <Card><CardContent>
        <p className="text-xs uppercase tracking-wide">
          La mejor contraexplicación
        </p>
        <p className="mt-2 max-w-prose leading-6">
          {review.red_team_counter_explanation ??
            "No hay contraexplicación persistida."}
        </p>
        {review.red_team_supporting_evidence ? (
          <p className="text-muted mt-2 text-sm">
            Evidencia: {review.red_team_supporting_evidence}
          </p>
        ) : null}
        {review.red_team_required_evidence ? (
          <p className="text-muted mt-1 text-sm">
            Para zanjarlo: {review.red_team_required_evidence}
          </p>
        ) : null}
      </CardContent></Card>
      {review.confidence_adjustment ? (
        <p className="text-muted text-sm">{review.confidence_adjustment}</p>
      ) : null}
      <RevisionBlock review={review} />
      {review.remaining_limitations ? (
        <p className="text-muted text-sm">
          Límites restantes: {review.remaining_limitations}
        </p>
      ) : null}
      <div>
        <p className="text-xs uppercase tracking-wide">Confusores evaluados</p>
        {review.confounders.length === 0 ? (
          <EmptyState title="No hay confusores observados en las fuentes disponibles" />
        ) : (
          <ul className="mt-2 space-y-3">
            {review.confounders.map((confounder) => {
              const label = confounderStatusLabel(confounder.status);
              return (
                <li key={confounder.id}><Card size="sm"><CardContent className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={label.tone}>{label.label}</Badge>
                    <span className="font-medium">
                      {confounder.confounder_type}
                    </span>
                    {confounder.masking_effect ? (
                      <Badge tone="warn">Posible enmascaramiento</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted mt-1">
                    {label.hint} {confounder.description}
                  </p>
                  {confounder.evidence ? (
                    <p className="text-muted mt-1">
                      Evidencia: {confounder.evidence}
                    </p>
                  ) : null}
                  {confounder.confidence_effect ? (
                    <p className="text-muted mt-1">
                      Efecto: {confounder.confidence_effect}
                    </p>
                  ) : null}
                </CardContent></Card></li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide">Checks obligatorios</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {review.checks.map((check) => {
            const label = checkStatusLabel(check.status);
            return (
              <li key={check.id} className="text-sm">
                <Badge tone={label.tone}>{label.label}</Badge>
                <span className="ml-2">{check.check_key}</span>
                {check.reason ? (
                  <p className="text-muted mt-1">{check.reason}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {review.sensitivity.some((item) => item.diagnosis_changes) ? (
        <p className="text-danger text-sm">
          La sensibilidad cambia el diagnóstico:{" "}
          {review.sensitivity.find((item) => item.diagnosis_changes)?.note}
        </p>
      ) : null}
    </article>
  );
}

export function AdversarialPanel() {
  const [reviews, setReviews] = useState<AdversarialReviewView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/adversarial")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          reviews: AdversarialReviewView[];
        };
        setReviews(payload.reviews);
        setError(null);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "No se pudo cargar la revisión adversarial por un error de red.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (isLoading && !reviews)
    return <LoadingBlock label="Cargando revisión adversarial..." />;
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!reviews) return null;
  const groups = groupReviewsByCase(reviews);
  return (
    <Card id="insight-d12-adversarial">
      <CardHeader>
        <CardTitle>¿Podría estar engañándonos el diagnóstico?</CardTitle>
        <CardDescription>D12 intenta refutar la interpretación completa. Los candidatos siguen siendo posibilidades; solo la evidencia los puede promover o descartar.</CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <EmptyState
            title="Sin revisiones adversariales"
            hint="Aparecen al ejecutar el motor D12 sobre un caso abierto."
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.caseId}>
                {group.reviews.map((review) => (
                  <Review key={review.id} review={review} />
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
