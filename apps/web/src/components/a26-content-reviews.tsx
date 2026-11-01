"use client";


import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Button, ErrorBlock, Input, Link, Textarea, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export type ContentReview = {
  review_ref: string; message_id: string; account_id: string; content_hash: string;
  dimension: string; quote: string | null; observation: string; limitation: string;
  permitted_change: string; acceptance_criterion: string; destination: string;
  message_label?: string; claim_type?: string; confidence?: string;
};
type Delivery = { id: string; review_ref: string; delivery_status: string; status: string; draft_id: string | null; task_id: string | null };

function ReviewCard({ organizationId, review, delivery, approved }: { organizationId: string; review: ContentReview; delivery?: Delivery; approved: boolean }) {
  const [draftId, setDraftId] = useState(delivery?.draft_id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [version, setVersion] = useState("1");
  const [outcome, setOutcome] = useState(delivery?.status ?? "open");
  async function createDraft() {
    if (!delivery) return;
    setBusy(true); setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/marketing/drafts`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a26_review_id: delivery.id }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = await response.json(); setDraftId(payload.draft.id);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo preparar el borrador."); }
    finally { setBusy(false); }
  }
  async function saveOutcome(status: string) {
    if (!delivery) return;
    setBusy(true); setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/ai/content-reviews/${delivery.id}/outcome`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note, ...(draftId ? { draft_version: Number(version) } : {}) }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      setOutcome(status);
    } catch (error) { setError(error instanceof Error ? error.message : "No se pudo guardar la comprobación."); }
    finally { setBusy(false); }
  }
  return <Card>
    <CardHeader>
      <CardTitle>{review.observation}</CardTitle>
      <CardDescription>{`${review.message_label ?? "Email"} · revisión ${review.content_hash.slice(0, 10)}`}</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <Badge tone={outcome === "verified" ? "success" : "neutral"}>{outcome === "verified" ? "Borrador comprobado" : outcome === "inconclusive" ? "Sin conclusión" : outcome === "superseded" ? "Pieza modificada" : "Pendiente de comprobación"}</Badge>
        <p className="text-xs text-muted">{review.claim_type === "observed_fact" ? "Observación" : "Hipótesis editorial"} · confianza {review.confidence === "high" ? "alta" : review.confidence === "low" ? "baja" : "media"}</p>
        {review.quote ? <blockquote className="border-l-2 border-separator pl-3">{review.quote}</blockquote> : null}
        <p>{review.permitted_change}</p><p className="text-sm">Criterio de cierre: {review.acceptance_criterion}</p>
        <p className="text-xs text-muted">{review.limitation}</p>
        {draftId ? <Link href={`/marketing?draft=${encodeURIComponent(draftId)}`}>Abrir borrador en Marketing</Link> : review.destination === "a11" ?
          <Button disabled={busy || !approved || !delivery || outcome === "superseded"} onClick={() => void createDraft()}>Preparar revisión con A11</Button> : <p className="text-sm text-muted">Seguimiento: {review.destination.toUpperCase()}.</p>}
        {!approved && review.destination === "a11" ? <p className="text-xs text-muted">Aprueba primero la revisión para preparar el borrador.</p> : null}
        {delivery && approved ? <div className="space-y-2">
          <Textarea aria-label="Evidencia de comprobación editorial" placeholder="Describe qué has comprobado y con qué evidencia…" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1500} />
          {draftId ? <Input type="number" min={1} aria-label="Versión del borrador comprobada" value={version} onChange={(event) => setVersion(event.target.value)} /> : null}
          <div role="group" aria-label="Acciones de revision editorial" className="flex flex-wrap items-center gap-2">
            {draftId ? <Button disabled={busy || note.trim().length < 10} onClick={() => void saveOutcome("verified")}>Verificar esta revisión del borrador</Button> : null}
            <Button variant="secondary" disabled={busy || note.trim().length < 10} onClick={() => void saveOutcome(outcome === "verified" ? "open" : "inconclusive")}>{outcome === "verified" ? "Reabrir revisión" : "Guardar sin conclusión"}</Button>
          </div><p className="text-xs text-muted">La comprobación editorial no acredita envío ni un efecto sobre ventas.</p>
        </div> : null}
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      </div>
    </CardContent>
  </Card>;
}

export function A26ContentReviews({ organizationId, outputId, connectionId, outputStatus, reviews }: { organizationId: string; outputId: string; connectionId: string; outputStatus: string; reviews: ContentReview[] }) {
  const [delivery, setDelivery] = useState<Delivery[]>([]);
  useEffect(() => {
    let active = true;
    setDelivery([]);
    void apiFetch(`/v1/organizations/${organizationId}/ai/contenido-email?connectionId=${encodeURIComponent(connectionId)}`)
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && payload?.output_id === outputId) setDelivery(payload.content_review_delivery ?? []); })
      .catch(() => { if (active) setDelivery([]); });
    return () => { active = false; };
  }, [organizationId, connectionId, outputId, outputStatus]);
  return <div className="space-y-3">{reviews.map((review) => <ReviewCard key={`${review.review_ref}:${delivery.find((row) => row.review_ref === review.review_ref)?.id ?? "loading"}`} organizationId={organizationId} review={review} delivery={delivery.find((row) => row.review_ref === review.review_ref)} approved={["approved", "published"].includes(outputStatus)} />)}</div>;
}
