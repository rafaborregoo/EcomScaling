import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Check, ChevronRight, Sparkles, X } from "lucide-react-native";
import { c, font } from "../lib/theme";

/** Un paso del razonamiento: cada herramienta que el copiloto llama (evento `tool` de consultant-chat/stream). */
export type Step = { id: string; name: string; status: "running" | "done" | "error" };

const LABEL: Record<string, string> = {
  sql_select: "Consultando los datos de la tienda",
  search_knowledge: "Buscando en el conocimiento",
  data_coverage: "Comprobando qué datos hay",
  describe_schema: "Entendiendo cómo están guardados los datos",
  get_organization_profile: "Leyendo el perfil del negocio",
  get_financial_settings: "Leyendo costes y ajustes",
  get_strategic_plan: "Leyendo el plan estratégico",
  get_current_milestone: "Leyendo el hito actual",
  list_open_alerts: "Revisando alertas abiertas",
  list_open_tasks: "Revisando tareas abiertas",
  get_task_history: "Revisando el historial de tareas",
  get_call_history: "Revisando las llamadas",
};
const label = (name: string) => LABEL[name] ?? name.replace(/_/g, " ");

/**
 * Razonamiento como en Claude: mientras piensa, «Razonando…» con pulso y los pasos a la vista;
 * al empezar a escribir (o al terminar) queda en una línea «Razonó · N pasos» que se despliega al tocarla.
 */
export function Reasoning({ steps, active }: { steps: Step[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 0.35, duration: 750, useNativeDriver: true }), Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  if (!active && steps.length === 0) return null;
  const expanded = active || open;

  return (
    <View style={{ gap: 8 }}>
      {active ? (
        <Animated.View style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: pulse }}>
          <Sparkles size={16} color={c.muted} />
          <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.muted }}>Razonando…</Text>
        </Animated.View>
      ) : (
        <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
          <Sparkles size={14} color={c.muted} />
          <Text style={{ fontSize: 13, fontFamily: font.medium, color: c.muted }}>{`Razonó · ${steps.length} ${steps.length === 1 ? "paso" : "pasos"}`}</Text>
          <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
            <ChevronRight size={14} color={c.muted} />
          </View>
        </Pressable>
      )}
      {expanded && steps.length > 0 && (
        <View style={{ gap: 6, paddingLeft: 7, marginLeft: 1, borderLeftWidth: 1, borderLeftColor: c.edge }}>
          {steps.map((s) => (
            <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 10 }}>
              {s.status === "done" ? <Check size={13} color={c.muted} /> : s.status === "error" ? <X size={13} color={c.danger} /> : <View style={{ width: 13, height: 13, alignItems: "center", justifyContent: "center" }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.muted }} /></View>}
              <Text style={{ flex: 1, fontSize: 13, fontFamily: font.regular, color: s.status === "error" ? c.danger : c.muted }}>{label(s.name)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
