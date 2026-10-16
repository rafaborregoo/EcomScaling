import { useState } from "react";
import { Text, View } from "react-native";
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
const sortAlerts = (alerts: Alert[]) =>
  alerts.filter(isActive).sort((a, b) => (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0) || b.first_detected_at.localeCompare(a.first_detected_at));

function Row({ alert }: { alert: Alert }) {
  const hot = alert.severity === "critical" || alert.severity === "high";
  const d = new Date(alert.first_detected_at);
  return (
    <View style={{ paddingVertical: 12, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hot ? c.danger : c.warning }} />
        <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: c.ink }}>{alert.title}</Text>
      </View>
      <Text style={{ marginLeft: 16, fontSize: 13, fontFamily: font.regular, color: hot ? c.danger : c.muted }}>
        {SEVERITY_LABEL[alert.severity] ?? alert.severity} · {d.getDate()} {MONTHS[d.getMonth()]}
      </Text>
    </View>
  );
}

/** Alertas activas: una fila-resumen y todas en la hoja. Solo lectura. Si no hay ninguna, no ocupa sitio. */
export function AlertsWidget({ alerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState(false);
  const list = sortAlerts(alerts);
  if (list.length === 0) return null;
  const hot = list.some((a) => a.severity === "critical" || a.severity === "high");

  return (
    <>
      <SummaryRow title="Alertas" summary={`${list.length} activa${list.length > 1 ? "s" : ""}`} color={hot ? c.danger : undefined} dot={hot ? c.danger : c.warning} onPress={() => setOpen(true)} />

      <Sheet visible={open} onClose={() => setOpen(false)} title={`Alertas activas (${list.length})`}>
        {list.map((a, i) => (
          <View key={a.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
            <Row alert={a} />
          </View>
        ))}
      </Sheet>
    </>
  );
}
