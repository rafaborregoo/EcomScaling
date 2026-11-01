"use client";
import { useState } from "react";
import { Badge, Button, Field, Input, Textarea, toast } from "@/components/ui";
export type LearningEdits = { decision?: string; title?: string; learning?: string; applies_to?: string };
export function LearningDecision({ learning, onSave }: { learning: { title: string; learning: string; applies_to: string; decision?: string }; onSave: (edits: LearningEdits) => Promise<void> }) {
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState(learning.decision);
  const [title, setTitle] = useState(learning.title), [text, setText] = useState(learning.learning), [scope, setScope] = useState(learning.applies_to);
  async function save(next: string) {
    setBusy(true);
    try { await onSave({ decision: next, title, learning: text, applies_to: scope }); setDecision(next); setEditing(false); toast.success(next === "discarded" ? "Aprendizaje descartado; no se reutilizará en Conocimiento." : "Aprendizaje confirmado en Conocimiento."); }
    catch (error) { toast.danger(error instanceof Error ? error.message : "No se pudo guardar la decisión."); }
    finally { setBusy(false); }
  }
  return <div className="mt-2 space-y-2">
    {decision ? <Badge tone="neutral">{decision === "approved" ? "Confirmado en Conocimiento" : "Descartado"}</Badge> : null}
    {editing ? <><Field label="Título del aprendizaje"><Input value={title} maxLength={180} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="Aprendizaje corregido"><Textarea value={text} maxLength={1200} onChange={(e) => setText(e.target.value)} /></Field><Field label="Alcance"><Input value={scope} maxLength={300} onChange={(e) => setScope(e.target.value)} /></Field></> : null}
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={busy || !text.trim() || !title.trim() || !scope.trim()} onClick={() => void save("approved")}>{editing ? "Guardar corrección y confirmar" : "Confirmar en Conocimiento"}</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? "Cancelar edición" : "Corregir"}</Button>
      <Button size="sm" variant="ghost" disabled={busy || decision === "discarded"} onClick={() => void save("discarded")}>Descartar</Button>
    </div>
  </div>;
}
