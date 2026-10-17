import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { apiSend } from "../lib/api";
import { c, font } from "../lib/theme";
import { Sheet } from "./sheet";
import { SummaryRow } from "./ui";

// Subconjunto de /v1/organizations/:id/operations (ver apps/web/src/app/tareas/page.tsx).
export type Alert = {
  id: string;
  status: string;
  severity: string;
  title: string;
  message: string;
  first_detected_at: string;
};

const SEVERITY_LABEL: Record<string, string> = { critical: "Crítica", high: "Alta", medium: "Media", low: "Baja", info: "Informativa" };
const SEVERITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Mismo criterio que la web: una alerta cuenta mientras esté abierta o reconocida.
const isActive = (a: Alert) => a.status === "open" || a.status === "acknowledged";
export const sortAlerts = (alerts: Alert[]) =>
  alerts.filter(isActive).sort((a, b) => (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0) || b.first_detected_at.localeCompare(a.first_detected_at));

type AlertAction = "acknowledged" | "resolved";

const btn = (primary: boolean) => ({ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: primary ? c.accent : c.edge, backgroundColor: primary ? c.accent : c.bg });

function Row({ alert, busy, onAction }: { alert: Alert; busy: boolean; onAction: (status: AlertAction) => void }) {
  const hot = alert.severity === "critical" || alert.severity === "high";
  const d = new Date(alert.first_detected_at);
  return (
    <View style={{ paddingVertical: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hot ? c.danger : c.warning }} />
        <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: c.ink }}>{alert.title}</Text>
      </View>
      <Text style={{ marginLeft: 16, fontSize: 13, fontFamily: font.regular, color: hot ? c.danger : c.muted }}>
        {SEVERITY_LABEL[alert.severity] ?? alert.severity} · {d.getDate()} {MONTHS[d.getMonth()]}{alert.status === "acknowledged" ? " · Vista" : ""}
      </Text>
      <View style={{ marginLeft: 16, flexDirection: "row", gap: 8 }}>
        {alert.status === "open" && (
          <Pressable disabled={busy} onPress={() => onAction("acknowledged")} style={btn(false)}>
            <Text style={{ fontSize: 14, fontFamily: font.medium, color: c.muted }}>Marcar vista</Text>
          </Pressable>
        )}
        <Pressable disabled={busy} onPress={() => onAction("resolved")} style={btn(true)}>
          <Text style={{ fontSize: 14, fontFamily: font.medium, color: "#fff" }}>{busy ? "Guardando..." : "Resolver"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Alertas activas: una fila-resumen y todas en la hoja, donde se marcan como vistas o se resuelven. Si no hay ninguna, no ocupa sitio. */
export function AlertsWidget({ orgId, alerts, onChanged }: { orgId: string; alerts: Alert[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = sortAlerts(alerts);
  if (list.length === 0) return null;
  const hot = list.some((a) => a.severity === "critical" || a.severity === "high");

  async function act(alert: Alert, status: AlertAction) {
    setBusy(alert.id);
    setError(null);
    try {
      await apiSend("PATCH", `/v1/organizations/${orgId}/alerts/${alert.id}/status`, { status });
      if (status === "resolved" && list.length === 1) setOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la alerta.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SummaryRow title="Alertas" summary={`${list.length} activa${list.length > 1 ? "s" : ""}`} color={hot ? c.danger : undefined} dot={hot ? c.danger : c.warning} onPress={() => setOpen(true)} />

      <Sheet visible={open} onClose={() => setOpen(false)} title={`Alertas activas (${list.length})`}>
        {list.map((a, i) => (
          <View key={a.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
            <Row alert={a} busy={busy === a.id} onAction={(status) => act(a, status)} />
          </View>
        ))}
        {error && <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.danger }}>{error}</Text>}
      </Sheet>
    </>
  );
}
