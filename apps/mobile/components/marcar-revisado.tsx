import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Check, CircleCheck, History } from "lucide-react-native";
import { apiSend } from "../lib/api";
import { refreshWorkbench } from "../lib/cartera";
import { useApi } from "../lib/use-api";
import { c, font, GOOD } from "../lib/theme";
import { Sheet, SheetError } from "./sheet";

// "Marcar como revisado" (apps/web/src/app/consultor/workbench.tsx): acción explícita del consultor, nunca un efecto de
// abrir la ficha. Fija el corte del «desde mi última revisión» de la mesa. La última revisión llega con la mesa de
// ese cliente (`client.last_review`).
type Desk = {
  client?: {
    last_review: { reviewed_at: string; note: string | null } | null;
    changes: { since: string; since_kind: "review" | "window"; new_alerts: number; closed_tasks: number };
  };
};

const ago = (iso: string) => {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000);
  return days <= 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`;
};

/** Icono junto a las pestañas del cliente: verde si ya lo revisaste hoy. Al tocarlo, deja una nota y lo marca. */
export function ReviewedButton({ orgId, onReviewed }: { orgId: string; onReviewed?: () => void }) {
  const { data, reload } = useApi<Desk>(`/v1/consultant/daily-workbench?days=30&organizationId=${orgId}`);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const last = data?.client?.last_review ?? null;
  const today = !!last && ago(last.reviewed_at) === "hoy";

  async function mark() {
    setBusy(true);
    setFailed(null);
    try {
      await apiSend("POST", `/v1/consultant/organizations/${orgId}/review`, note.trim() ? { note: note.trim() } : {});
      setNote("");
      await Promise.all([reload(), refreshWorkbench()]);
      onReviewed?.();
      setOpen(false);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={last ? `Marcar revisado. Última revisión ${ago(last.reviewed_at)}` : "Marcar revisado"} style={{ paddingBottom: 6 }}>
        <CircleCheck size={22} color={today ? GOOD : c.muted} strokeWidth={today ? 2.4 : 1.9} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Marcar revisado">
        <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>{last ? `Última revisión ${ago(last.reviewed_at)}${last.note ? `: ${last.note}` : ""}` : "Aún sin revisar"}</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Nota (opcional)"
          placeholderTextColor={c.muted}
          multiline
          maxLength={500}
          style={{ minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: c.edge, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: font.regular, color: c.ink }}
        />
        <SheetError text={failed} />
        <Pressable disabled={busy} onPress={mark} accessibilityRole="button" style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: GOOD, opacity: busy ? 0.6 : 1 }}>
          <Check size={18} color="#fff" strokeWidth={2.6} />
          <Text style={{ fontSize: 15, fontFamily: font.semibold, color: "#fff" }}>{busy ? "Guardando…" : "Revisado"}</Text>
        </Pressable>
      </Sheet>
    </>
  );
}

/**
 * Qué ha pasado en el cliente desde tu última revisión (o en la ventana de la mesa si nunca lo revisaste): la línea
 * que responde «¿qué me he perdido?» al abrirlo. Sin nada nuevo no ocupa sitio.
 */
export function SinceReview({ orgId }: { orgId: string }) {
  const { data } = useApi<Desk>(`/v1/consultant/daily-workbench?days=30&organizationId=${orgId}`);
  const ch = data?.client?.changes;
  if (!ch || ch.new_alerts + ch.closed_tasks === 0) return null;
  const parts = [ch.new_alerts > 0 && `${ch.new_alerts} alerta${ch.new_alerts > 1 ? "s" : ""} nueva${ch.new_alerts > 1 ? "s" : ""}`, ch.closed_tasks > 0 && `${ch.closed_tasks} tarea${ch.closed_tasks > 1 ? "s" : ""} cerrada${ch.closed_tasks > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 10 }}>
      <History size={14} color={c.muted} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontFamily: font.regular, color: c.muted }}>
        {`${ch.since_kind === "review" ? `Desde tu revisión (${ago(ch.since)})` : "En 30 días"}: `}
        <Text style={{ fontFamily: font.semibold, color: c.ink }}>{parts}</Text>
      </Text>
    </View>
  );
}
