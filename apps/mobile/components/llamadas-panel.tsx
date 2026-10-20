import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { CAUTION, c, font } from "../lib/theme";
import { FadeIn, Grow } from "./motion";

export type PanelCall = { id: string; title: string; scheduled_at: string | null; client: string | null; overdue: boolean; openTasks: number; onPress: () => void };
export type PanelGap = { id: string; name: string; days: number | null; onPress: () => void };

// A partir de aquí una cartera «se enfría»: la barra se llena del todo y se pone roja.
const COLD_DAYS = 30;

const dayDiff = (iso: string) => Math.round((new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
const time = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
function dayLabel(iso: string) {
  const d = dayDiff(iso);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === -1) return "Ayer";
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
}
function countdown(iso: string) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins < 0) return "ya debería haber empezado";
  if (mins < 60) return `empieza en ${mins} min`;
  if (mins < 24 * 60) return `en ${Math.round(mins / 60)} h`;
  const d = dayDiff(iso);
  return `en ${d} día${d === 1 ? "" : "s"}`;
}
const tasksText = (n: number) => `${n} tarea${n > 1 ? "s" : ""} tuya${n > 1 ? "s" : ""} abierta${n > 1 ? "s" : ""}`;

/** Llamadas como agenda: la próxima en grande con cuenta atrás, el resto en columna horaria y un termómetro de clientes sin llamada. */
export function LlamadasPanel({ calls, gaps }: { calls: PanelCall[]; gaps: PanelGap[] }) {
  const dated = calls.filter((x) => x.scheduled_at).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  const late = dated.filter((x) => x.overdue);
  const ahead = dated.filter((x) => !x.overdue);
  const next = ahead[0];
  const rest = [...late, ...ahead.slice(1), ...calls.filter((x) => !x.scheduled_at)];

  return (
    <View style={{ gap: 28 }}>
      {next ? (
        <FadeIn>
          <Pressable onPress={next.onPress} accessibilityRole="button" style={({ pressed }) => ({ gap: 6, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pulse live={dayDiff(next.scheduled_at!) === 0} />
              <Text style={{ fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.8, color: c.muted }}>{`PRÓXIMA LLAMADA · ${countdown(next.scheduled_at!)}`.toUpperCase()}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
              <Text style={{ fontSize: 56, lineHeight: 62, fontFamily: font.semibold, color: c.ink, letterSpacing: -2 }}>{time(next.scheduled_at!)}</Text>
              <Text style={{ fontSize: 20, fontFamily: font.medium, color: c.muted }}>{dayLabel(next.scheduled_at!)}</Text>
            </View>
            <Text style={{ fontSize: 17, lineHeight: 23, fontFamily: font.medium, color: c.ink }}>{next.client ? `${next.title} · ${next.client}` : next.title}</Text>
            {next.openTasks > 0 && <Text style={{ fontSize: 14, fontFamily: font.semibold, color: CAUTION }}>{`Llega con ${tasksText(next.openTasks)}`}</Text>}
          </Pressable>
        </FadeIn>
      ) : (
        <FadeIn style={{ gap: 6 }}>
          <Text style={{ fontSize: 28, lineHeight: 34, fontFamily: font.semibold, color: c.ink, letterSpacing: -0.5 }}>Sin llamadas agendadas</Text>
          <Text style={{ fontSize: 15, fontFamily: font.regular, color: c.muted }}>{late.length ? "Solo quedan llamadas pasadas por cerrar." : "Agenda la siguiente desde la web."}</Text>
        </FadeIn>
      )}

      {rest.length > 0 && (
        <View>
          {rest.map((x, i) => (
            <FadeIn key={x.id} delay={120 + i * 50}>
              <Pressable onPress={x.onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.surface, opacity: pressed ? 0.5 : 1 })}>
                <View style={{ width: 64 }}>
                  <Text style={{ fontSize: 20, fontFamily: font.semibold, color: x.overdue ? c.danger : c.ink }}>{x.scheduled_at ? time(x.scheduled_at) : "—"}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.regular, color: x.overdue ? c.danger : c.muted }}>{x.scheduled_at ? dayLabel(x.scheduled_at) : "Sin fecha"}</Text>
                </View>
                <View style={{ width: 2, alignSelf: "stretch", borderRadius: 1, backgroundColor: x.overdue ? c.danger : c.edge }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={2} style={{ fontSize: 15, lineHeight: 20, fontFamily: font.medium, color: c.ink }}>{x.title}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: x.overdue ? c.danger : c.muted }}>
                    {[x.overdue ? "Pasada sin cerrar" : null, x.client, x.openTasks ? tasksText(x.openTasks) : null].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <ChevronRight size={18} color={c.muted} />
              </Pressable>
            </FadeIn>
          ))}
        </View>
      )}

      {gaps.length > 0 && (
        <View style={{ gap: 14 }}>
          <Text style={{ fontSize: 13, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>SIN LLAMADA RECIENTE</Text>
          {gaps.map((g, i) => {
            const pct = g.days == null ? 1 : g.days / COLD_DAYS;
            const color = pct >= 1 ? c.danger : pct >= 0.5 ? CAUTION : c.muted;
            return (
              <FadeIn key={g.id} delay={200 + i * 60}>
                <Pressable onPress={g.onPress} accessibilityRole="button" style={({ pressed }) => ({ gap: 8, opacity: pressed ? 0.5 : 1 })}>
                  <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: c.ink }}>{g.name}</Text>
                    <Text style={{ fontSize: 13, fontFamily: font.semibold, color }}>{g.days == null ? "Nunca" : `${g.days} días`}</Text>
                  </View>
                  <Grow pct={pct} color={color} track={c.surface} height={6} delay={300 + i * 60} />
                </Pressable>
              </FadeIn>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Punto que late cuando la llamada es hoy. */
function Pulse({ live }: { live: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!live) return;
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1400, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [live]);
  const color = live ? c.danger : c.ink;
  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      {live && <Animated.View style={{ position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: color, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }} />}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}
