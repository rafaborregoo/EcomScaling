import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { apiSend } from "../lib/api";
import { c, font, GOOD } from "../lib/theme";
import { LEVEL_COLOR, RoundIcon, Sheet, SheetError } from "./sheet";
import { SummaryRow } from "./ui";

// Subconjunto de Diagnostic (ver apps/web/src/app/dashboard/client-pulse.tsx).
export type Diagnostic = {
  output_id: string;
  output_status: string;
  output: { proposed_writes: Array<{ title: string; priority: string }> };
} | null;

type Decision = "approved" | "rejected";
type D = NonNullable<Diagnostic>;


export const pendingDiagnostics = (diagnostics: Diagnostic[]) =>
  diagnostics.filter((d): d is D => d !== null && d.output_status === "pending_approval" && d.output.proposed_writes.length > 0);

/**
 * Propuestas de la IA pendientes de decisión. El API decide cada tanda (diagnóstico) entera: se marca ✓ o ✗ en cada
 * propuesta y un único botón al final envía las tandas ya respondidas del todo. Aprobar crea tareas reales: por eso
 * hay confirmación y no se envía al tocar. Los permisos los resuelve el API (si no puedes, te lo dice).
 */
export function ProposalsWidget({ orgId, diagnostics, onDone }: { orgId: string; diagnostics: Diagnostic[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Record<number, Decision>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = pendingDiagnostics(diagnostics);
  const total = pending.reduce((n, d) => n + d.output.proposed_writes.length, 0);
  if (total === 0) return null;

  const ready = pending.filter((d) => Object.keys(answers[d.output_id] ?? {}).length === d.output.proposed_writes.length);
  const approvedIn = (d: D) => Object.values(answers[d.output_id] ?? {}).filter((x) => x === "approved").length;
  const toCreate = ready.reduce((n, d) => n + approvedIn(d), 0);

  const answer = (id: string, i: number, x: Decision) => setAnswers((a) => ({ ...a, [id]: { ...(a[id] ?? {}), [i]: x } }));

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      for (const d of ready) {
        const mine = answers[d.output_id] ?? {};
        const decision: Decision = approvedIn(d) > 0 ? "approved" : "rejected";
        // Aprobada la tanda, las descartadas una a una viajan como "skip" (igual que la web).
        const edits = decision === "approved" ? Object.entries(mine).flatMap(([i, x]) => (x === "approved" ? [] : [{ index: Number(i), skip: true }])) : [];
        await apiSend("POST", `/v1/organizations/${orgId}/ai/outputs/${d.output_id}/decision`, { decision, ...(edits.length ? { edits } : {}) });
        setAnswers((a) => ({ ...a, [d.output_id]: {} }));
      }
      if (ready.length === pending.length) setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
      onDone();
    }
  }

  return (
    <>
      <SummaryRow title="Propuestas de la IA" summary={`${total} esperando`} color={c.accent} dot={c.accent} onPress={() => setOpen(true)} />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Propuestas" count={total}>
        {pending.flatMap((d) =>
          d.output.proposed_writes.map((w, i) => {
            const x = answers[d.output_id]?.[i];
            return (
              <View key={`${d.output_id}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.edge }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEVEL_COLOR[w.priority] ?? c.edge }} />
                <Text style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: x === "rejected" ? c.muted : c.ink, textDecorationLine: x === "rejected" ? "line-through" : "none" }}>{w.title}</Text>
                <RoundIcon Icon={X} color={c.muted} on={x === "rejected"} label="Descartar" onPress={() => answer(d.output_id, i, "rejected")} />
                <RoundIcon Icon={Check} color={GOOD} on={x === "approved"} label="Aprobar" onPress={() => answer(d.output_id, i, "approved")} />
              </View>
            );
          }),
        )}
        <SheetError text={error} />
        {ready.length > 0 && (
          <Pressable disabled={busy} onPress={confirm} accessibilityRole="button" style={{ marginTop: 4, flexDirection: "row", gap: 8, borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }}>
            <Check size={18} color="#fff" strokeWidth={2.6} />
            <Text style={{ fontSize: 15, fontFamily: font.semibold, color: "#fff" }}>{busy ? "Guardando…" : toCreate > 0 ? `Crear ${toCreate} tarea${toCreate > 1 ? "s" : ""}` : "Confirmar"}</Text>
          </Pressable>
        )}
      </Sheet>
    </>
  );
}
