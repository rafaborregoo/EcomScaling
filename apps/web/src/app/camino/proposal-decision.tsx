"use client";


import { useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Field, Badge, Button, Textarea, toast, Card, CardContent, AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui";

type Proposal = { change?: string; target_type?: string; target_id?: string | null; description?: string; reason?: string; evidence?: string; structured_change?: { field: string; before: string | number | null; value: string | number } | null };
type ProposalEvent = { id: string; action: string; actor_label?: string; reason?: string | null; created_at: string };
export type StoredCaminoProposal = {
  id: string;
  proposal_index: number;
  current_proposal: Proposal;
  status: "pending" | "accepted" | "edited" | "rejected" | "completed";
  latest_event_id: string | null;
  events: ProposalEvent[];
};

const STATUS_LABEL: Record<StoredCaminoProposal["status"], string> = {
  pending: "Pendiente", accepted: "Aceptada · falta aplicarla", edited: "Editada · falta aplicarla",
  rejected: "Rechazada", completed: "Aplicada y completada",
};

export function CaminoProposalDecision({
  organizationId, planId, record, canManage, onUpdated,
}: {
  organizationId: string; planId: string; record: StoredCaminoProposal; canManage: boolean; onUpdated: () => void;
}) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState(record.current_proposal.description ?? "");
  const [rationale, setRationale] = useState(record.current_proposal.reason ?? "");
  const [evidence, setEvidence] = useState(record.current_proposal.evidence ?? "");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const terminal = record.status === "completed" || record.status === "rejected";
  const canComplete = record.status === "accepted" || record.status === "edited";
  const patch = record.current_proposal.structured_change;
  const executable = Boolean(patch) && ["pending", "accepted"].includes(record.status);

  async function submit(action: "accept" | "reject" | "edit" | "complete" | "apply") {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/${planId}/proposals/${record.id}/action`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action, reason: reason.trim() || undefined, expected_last_event_id: record.latest_event_id,
          ...(action === "edit" ? { edited_proposal: { description, reason: rationale, evidence, target_id: record.current_proposal.target_id ?? null } } : {}),
        }),
      });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      toast.success(action === "apply" ? "Cambio aplicado al Camino y registrado." : action === "accept" ? "Propuesta aceptada para aplicación manual." : action === "reject" ? "Propuesta rechazada." : action === "edit" ? "Propuesta editada." : "Cambio marcado como aplicado.");
      setReason(""); setEditing(false); onUpdated();
    } catch {
      toast.danger("No se pudo guardar la decisión. Comprueba la conexión e inténtalo de nuevo.");
    } finally { setBusy(false); }
  }

  return (
    <Card size="sm" className="mt-3"><CardContent>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={record.status === "rejected" ? "neutral" : record.status === "completed" ? "success" : record.status === "pending" ? "warn" : "brand"}>{STATUS_LABEL[record.status]}</Badge>
        {record.events.at(-1)?.actor_label ? <span className="text-xs text-muted">Última decisión: {record.events.at(-1)?.actor_label}</span> : null}
      </div>
      {patch ? <div className="mt-3 text-sm"><p>Campo: {({ target: "Meta", target_date: "Fecha del hito", name: "Nombre", description: "Descripción" } as Record<string, string>)[patch.field] ?? patch.field}</p><p>Antes: {patch.before ?? "Sin valor"}</p><p>Después: {patch.value}</p><p>{record.current_proposal.reason}</p></div> : <p className="mt-2 text-xs text-muted">Recomendación de aplicación manual.</p>}
      {record.status === "accepted" || record.status === "edited" ? <p className="mt-2 text-xs text-muted">La aceptación no altera el plan. Actualiza las fases o hitos manualmente y luego registra aquí que ya se aplicó.</p> : null}
      {editing ? (
        <div className="mt-3 space-y-2">
          <Field label="Cambio propuesto"><Textarea className="w-full" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Field label="Motivo"><Textarea className="w-full" value={rationale} onChange={(event) => setRationale(event.target.value)} /></Field>
          <Field label="Evidencia"><Textarea className="w-full" value={evidence} onChange={(event) => setEvidence(event.target.value)} /></Field>
          <Field label="Nota de edición (opcional)"><Textarea className="w-full" value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
        </div>
      ) : null}
      {canManage && !terminal ? (
        <div className="mt-3 space-y-2">
          {!editing && !canComplete ? <Field label="Motivo (obligatorio al rechazar)"><Textarea className="w-full" value={reason} onChange={(event) => setReason(event.target.value)} /></Field> : null}
          {canComplete ? <Field label="Nota de aplicación (obligatoria para completar)"><Textarea className="w-full" value={reason} onChange={(event) => setReason(event.target.value)} /></Field> : null}
          <div role="group" aria-label="Decision sobre la propuesta" className="flex flex-wrap items-center gap-2">
            {!editing && executable ? <AlertDialog><AlertDialogTrigger render={<Button size="sm" disabled={busy}>Revisar y aplicar</Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Aplicar este cambio al Camino?</AlertDialogTitle><AlertDialogDescription>Se cambiará únicamente el campo mostrado y quedará registrada tu aprobación. Si el elemento ha cambiado desde la revisión, tendrás que revisar la propuesta de nuevo.</AlertDialogDescription></AlertDialogHeader><p>Antes: {patch?.before ?? "Sin valor"}</p><p>Después: {patch?.value}</p><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void submit("apply")}>Aplicar cambio</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog> : null}
            {!editing && record.status === "pending" && !executable ? <Button size="sm" onClick={() => void submit("accept")} disabled={busy}>Aceptar para aplicar manualmente</Button> : null}
            {!editing && record.status !== "rejected" ? <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={busy}>Editar propuesta</Button> : null}
            {editing ? <><Button size="sm" onClick={() => void submit("edit")} disabled={busy || !description.trim() || !rationale.trim() || !evidence.trim()}>Guardar edición</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>Cancelar</Button></> : null}
            {!editing && record.status === "pending" ? <Button size="sm" variant="destructive" onClick={() => void submit("reject")} disabled={busy || reason.trim().length < 3}>Rechazar</Button> : null}
            {!editing && canComplete && !executable ? <Button size="sm" onClick={() => void submit("complete")} disabled={busy || reason.trim().length < 3}>Marcar como aplicada manualmente</Button> : null}
          </div>
        </div>
      ) : null}
      {record.events.length ? <ol className="mt-3 space-y-1 border-t border-separator pt-2 text-xs text-muted">{record.events.map((event) => <li key={event.id}>{new Date(event.created_at).toLocaleString("es-ES")} · {event.actor_label ?? "Usuario"} · {STATUS_LABEL[event.action as StoredCaminoProposal["status"]] ?? event.action}{event.reason ? ` · ${event.reason}` : ""}</li>)}</ol> : null}
    </CardContent></Card>
  );
}
