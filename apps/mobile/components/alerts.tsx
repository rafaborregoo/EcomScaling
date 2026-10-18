import { useContext, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Check, Eye, MessageSquare } from "lucide-react-native";
import { WriteToClient } from "./mensajes";
import { apiSend } from "../lib/api";
import { c, font, GOOD } from "../lib/theme";
import { LEVEL_COLOR, RoundIcon, Sheet, SheetError } from "./sheet";
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

const SEVERITY_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Mismo criterio que la web: una alerta cuenta mientras esté abierta o reconocida.
const isActive = (a: Alert) => a.status === "open" || a.status === "acknowledged";
export const sortAlerts = (alerts: Alert[]) =>
  alerts.filter(isActive).sort((a, b) => (SEVERITY_WEIGHT[b.severity] ?? 0) - (SEVERITY_WEIGHT[a.severity] ?? 0) || b.first_detected_at.localeCompare(a.first_detected_at));

type AlertAction = "acknowledged" | "resolved";


// Vista = ojo relleno y sin botón; resolver = ✓. La severidad la dice el color del punto. Tocar la alerta despliega
// su detalle y, para el consultor, el acceso a escribir al cliente sobre ella.
function Row({ alert, busy, onAction, onWrite }: { alert: Alert; busy: boolean; onAction: (status: AlertAction) => void; onWrite: (() => void) | null }) {
  const [open, setOpen] = useState(false);
  const d = new Date(alert.first_detected_at);
  const seen = alert.status === "acknowledged";
  return (
    <View style={{ paddingVertical: 10, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEVEL_COLOR[alert.severity] ?? c.warning }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={open ? undefined : 2} style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{alert.title}</Text>
            <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{d.getDate()} {MONTHS[d.getMonth()]}</Text>
          </View>
        </Pressable>
        {seen ? (
          <Eye size={18} color={c.muted} accessibilityLabel="Vista" style={{ marginHorizontal: 11 }} />
        ) : (
          <RoundIcon Icon={Eye} color={c.muted} disabled={busy} label="Marcar vista" onPress={() => onAction("acknowledged")} />
        )}
        <RoundIcon Icon={Check} color={GOOD} disabled={busy} label="Resolver" onPress={() => onAction("resolved")} />
      </View>
      {open && (
        <View style={{ marginLeft: 20, gap: 8 }}>
          {alert.message && alert.message !== alert.title ? <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: font.regular, color: c.muted }}>{alert.message}</Text> : null}
          {onWrite && (
            <Pressable onPress={onWrite} hitSlop={8} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
              <MessageSquare size={16} color={c.ink} />
              <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.ink }}>Escribir al cliente</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

/** Alertas activas: una fila-resumen y todas en la hoja, donde se marcan como vistas o se resuelven. Si no hay ninguna, no ocupa sitio. */
export function AlertsWidget({ orgId, alerts, onChanged }: { orgId: string; alerts: Alert[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const write = useContext(WriteToClient);
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

      <Sheet visible={open} onClose={() => setOpen(false)} title="Alertas" count={list.length}>
        {list.map((a, i) => (
          <View key={a.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
            <Row
              alert={a}
              busy={busy === a.id}
              onAction={(status) => act(a, status)}
              onWrite={
                write &&
                (() => {
                  setOpen(false);
                  write(orgId, `Sobre «${a.title}»: `);
                })
              }
            />
          </View>
        ))}
        <SheetError text={error} />
      </Sheet>
    </>
  );
}
