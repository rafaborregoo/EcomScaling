import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useApi } from "../lib/use-api";
import { c, fmtNum, font } from "../lib/theme";
import { MetricList, Screen, Status } from "./ui";

// Subconjunto de /v1/consultant/daily-workbench (ver apps/web/src/app/consultor/workbench.tsx).
type Portfolio = {
  organization_id: string;
  organization_name: string;
  status: "urgente" | "revisar" | "vigilar" | "al_dia";
  next_action: { title: string } | null;
  critical_alerts: number;
  overdue_tasks: number;
};
type Workbench = {
  summary: { urgent_clients: number; critical_alerts: number; overdue_tasks: number; pending_ai_proposals: number };
  portfolio: Portfolio[];
};

const STATUS = {
  urgente: { label: "Urgente", color: c.danger, rank: 0 },
  revisar: { label: "Revisar", color: c.warning, rank: 1 },
  vigilar: { label: "Vigilar", color: c.muted, rank: 2 },
  al_dia: { label: "Al día", color: c.accent, rank: 3 },
} as const;

/** Cartera del consultor: qué cliente necesita atención hoy. Tocar un cliente abre su Pulso. */
export function Cartera({ onSelect }: { onSelect: (org: { id: string; name: string }) => void }) {
  const { data, error, reload, retry } = useApi<Workbench>("/v1/consultant/daily-workbench?days=30");
  const rows = data ? [...data.portfolio].sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || a.organization_name.localeCompare(b.organization_name)) : [];

  return (
    <Screen flat title="Cartera" subtitle="Qué cliente necesita atención hoy" onRefresh={reload}>
      <Status error={error} loading={!data} retry={retry} />
      {data && (
        <>
          <MetricList
            rows={[
              { label: "Clientes urgentes", value: fmtNum(data.summary.urgent_clients) },
              { label: "Alertas críticas", value: fmtNum(data.summary.critical_alerts) },
              { label: "Tareas vencidas", value: fmtNum(data.summary.overdue_tasks) },
              { label: "Propuestas IA", value: fmtNum(data.summary.pending_ai_proposals) },
            ]}
          />
          <View>
            {rows.map((r, i) => {
              const s = STATUS[r.status];
              const meta = [r.critical_alerts > 0 && `${r.critical_alerts} crítica${r.critical_alerts > 1 ? "s" : ""}`, r.overdue_tasks > 0 && `${r.overdue_tasks} vencida${r.overdue_tasks > 1 ? "s" : ""}`].filter(Boolean).join(" · ");
              return (
                <Pressable
                  key={r.organization_id}
                  onPress={() => onSelect({ id: r.organization_id, name: r.organization_name })}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 18, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>{r.organization_name}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: r.status === "urgente" ? c.danger : c.muted }}>
                      {s.label}
                      {meta ? ` · ${meta}` : ""}
                    </Text>
                    {r.next_action && <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.ink }}>{r.next_action.title}</Text>}
                  </View>
                  <ChevronRight size={18} color={c.muted} />
                </Pressable>
              );
            })}
            {rows.length === 0 && <Text style={{ paddingVertical: 16, fontSize: 14, fontFamily: font.regular, color: c.muted }}>No tienes clientes asignados.</Text>}
          </View>
        </>
      )}
    </Screen>
  );
}
