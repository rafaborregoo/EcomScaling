import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { apiSend } from "../lib/api";
import { c, font } from "../lib/theme";
import { Sheet } from "./sheet";
import { SummaryRow } from "./ui";

// Subconjunto de Diagnostic (ver apps/web/src/app/dashboard/client-pulse.tsx).
export type Diagnostic = {
  output_id: string;
  output_status: string;
  output: { proposed_writes: Array<{ title: string; priority: string }> };
} | null;

type Decision = "approved" | "rejected";

export const pendingDiagnostics = (diagnostics: Diagnostic[]) =>
  diagnostics.filter((d): d is NonNullable<Diagnostic> => d !== null && d.output_status === "pending_approval" && d.output.proposed_writes.length > 0);

const PRIORITY_LABEL: Record<string, string> = { urgent: "Urgente", high: "Alta", medium: "Media", low: "Baja" };

/**
 * Propuestas de la IA pendientes de decisión. Misma semántica que la web: el API decide la tanda entera,
 * así que se responde a cada propuesta y se confirma una sola vez. Aprobar crea tareas reales: por eso hay
 * botón de confirmar y no se envía al tocar. Los permisos los resuelve el API (si no puedes, te lo dice).
 */
export function ProposalsWidget({ orgId, diagnostics, onDone }: { orgId: string; diagnostics: Diagnostic[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Record<number, Decision>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = pendingDiagnostics(diagnostics);
  const total = pending.reduce((n, d) => n + d.output.proposed_writes.length, 0);
  if (total === 0) return null;

  async function confirm(d: NonNullable<Diagnostic>) {
    const mine = answers[d.output_id] ?? {};
    const approved = Object.values(mine).filter((x) => x === "approved").length;
    const decision: Decision = approved > 0 ? "approved" : "rejected";
    // Aprobada la tanda, las descartadas una a una viajan como "skip" (igual que la web).
    const edits = decision === "approved" ? Object.entries(mine).flatMap(([i, x]) => (x === "approved" ? [] : [{ index: Number(i), skip: true }])) : undefined;
    setBusy(d.output_id);
    setError(null);
    try {
      await apiSend("POST", `/v1/organizations/${orgId}/ai/outputs/${d.output_id}/decision`, { decision, ...(edits && edits.length ? { edits } : {}) });
      setAnswers((a) => ({ ...a, [d.output_id]: {} }));
      onDone();
      if (pending.length === 1) setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la decisión.");
    } finally {
      setBusy(null);
    }
  }

  const chip = (on: boolean, color: string) => ({ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? color : c.edge, backgroundColor: on ? color : c.bg });

  return (
    <>
      <SummaryRow title="Propuestas de la IA" summary={`${total} esperando`} color={c.accent} dot={c.accent} onPress={() => setOpen(true)} />

      <Sheet visible={open} onClose={() => setOpen(false)} title={`Propuestas (${total})`}>
        {pending.map((d) => {
          const mine = answers[d.output_id] ?? {};
          const writes = d.output.proposed_writes;
          const answered = Object.keys(mine).length;
          const approved = Object.values(mine).filter((x) => x === "approved").length;
          const ready = answered === writes.length;
          return (
            <View key={d.output_id} style={{ gap: 4 }}>
              {writes.map((w, i) => (
                <View key={i} style={{ paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: c.edge }}>
                  <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{w.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{PRIORITY_LABEL[w.priority] ?? w.priority}</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable onPress={() => setAnswers((a) => ({ ...a, [d.output_id]: { ...(a[d.output_id] ?? {}), [i]: "rejected" } }))} style={chip(mine[i] === "rejected", c.muted)}>
                        <Text style={{ fontSize: 14, fontFamily: font.medium, color: mine[i] === "rejected" ? "#fff" : c.muted }}>Descartar</Text>
                      </Pressable>
                      <Pressable onPress={() => setAnswers((a) => ({ ...a, [d.output_id]: { ...(a[d.output_id] ?? {}), [i]: "approved" } }))} style={chip(mine[i] === "approved", c.accent)}>
                        <Text style={{ fontSize: 14, fontFamily: font.medium, color: mine[i] === "approved" ? "#fff" : c.accent }}>Aprobar</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
              <Pressable
                disabled={!ready || busy === d.output_id}
                onPress={() => confirm(d)}
                style={{ marginTop: 8, borderRadius: 10, paddingVertical: 14, alignItems: "center", backgroundColor: ready ? c.accent : c.edge }}
              >
                <Text style={{ fontSize: 15, fontFamily: font.semibold, color: ready ? "#fff" : c.muted }}>
                  {busy === d.output_id ? "Guardando..." : !ready ? `Responde a las ${writes.length - answered} restantes` : approved > 0 ? `Confirmar · crear ${approved} tarea${approved > 1 ? "s" : ""}` : "Confirmar · descartar todas"}
                </Text>
              </Pressable>
            </View>
          );
        })}
        {error && (
          <View style={{ borderRadius: 10, padding: 12, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" }}>
            <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{error}</Text>
          </View>
        )}
      </Sheet>
    </>
  );
}
