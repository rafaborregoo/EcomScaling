import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Check, ChevronRight, Plus, X } from "lucide-react-native";
import { c, font, GOOD } from "../lib/theme";
import { FadeIn } from "./motion";
import { LEVEL_COLOR, RoundIcon } from "./sheet";
import { AllDone } from "./ui";

/**
 * Una tarea, venga de donde venga. `onPress` la abre (consultor); `onComplete` la cierra con una línea de resultado (cliente);
 * sin ninguno es de solo lectura (las del cliente vistas por el consultor).
 */
export type PanelTask = { id: string; title: string; priority: string; due_at: string | null; who: string | null; store?: string | null; mine: boolean; onPress?: () => void; onComplete?: (note: string) => Promise<void> };

const PRIORITY_LABEL: Record<string, string> = { low: "Prioridad baja", medium: "Prioridad media", high: "Prioridad alta", urgent: "Urgente" };
const PRIORITY_WEIGHT: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
const DAYS_AHEAD = 14;
const WEEKDAY = ["D", "L", "M", "X", "J", "V", "S"];

// Día de la tarea relativo a hoy: "late" si ya pasó la hora, "none" sin fecha, si no 0 = hoy, 1 = mañana...
type Slot = "late" | "none" | number;
function slot(due: string | null): Slot {
  if (!due) return "none";
  const at = new Date(due);
  if (at.getTime() < Date.now()) return "late";
  return Math.max(0, Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000));
}
const dateAt = (offset: number) => new Date(Date.now() + offset * 86_400_000);
const dayName = (offset: number) => (offset === 0 ? "Hoy" : offset === 1 ? "Mañana" : dateAt(offset).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Tareas como agenda: frase-resumen con barra de reparto, tira de días para filtrar y línea de tiempo. */
export function TareasPanel({ tasks, top, onAdd }: { tasks: PanelTask[]; top?: ReactNode; onAdd?: () => void }) {
  const [who, setWho] = useState<"all" | "mine" | "client">("all");
  const [pick, setPick] = useState<Slot | null>(null);
  const add = onAdd && (
    <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="Nueva tarea" style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: c.ink, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <Plus size={22} color="#fff" strokeWidth={2.4} />
    </Pressable>
  );
  if (tasks.length === 0)
    return (
      <View style={{ gap: 22 }}>
        {top}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <AllDone text="Sin tareas pendientes" />
          </View>
          {add}
        </View>
      </View>
    );

  const both = tasks.some((t) => t.mine) && tasks.some((t) => !t.mine);
  const pool = tasks.filter((t) => who === "all" || (who === "mine") === t.mine);
  const at = (s: Slot) => pool.filter((t) => slot(t.due_at) === s);
  const late = at("late").length;
  const today = at(0).length;
  const soon = pool.filter((t) => typeof slot(t.due_at) === "number" && (slot(t.due_at) as number) >= 1 && (slot(t.due_at) as number) <= 7).length;
  const rest = pool.length - late - today - soon;

  // Grupos de la línea de tiempo: con un día elegido, solo ese; si no, todos en orden.
  const order: Slot[] = ["late", ...Array.from(new Set(pool.map((t) => slot(t.due_at)).filter((s): s is number => typeof s === "number"))).sort((a, b) => a - b), "none"];
  const groups = (pick === null ? order : [pick])
    .map((s) => ({ s, items: at(s).sort((x, y) => (PRIORITY_WEIGHT[y.priority] ?? 0) - (PRIORITY_WEIGHT[x.priority] ?? 0)) }))
    .filter((g) => g.items.length > 0);

  return (
    <View style={{ gap: 22 }}>
      <FadeIn style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text style={{ flex: 1, fontSize: 28, lineHeight: 34, fontFamily: font.semibold, color: c.ink, letterSpacing: -0.5 }}>
            {late ? <Text style={{ color: c.danger }}>{plural(late, "vencida", "vencidas")}</Text> : "Nada vencido"}
            <Text style={{ color: c.muted }}>{today ? " y " : ", "}</Text>
            {today ? `${today} para hoy` : <Text style={{ color: c.muted }}>hoy libre</Text>}
          </Text>
          {add}
        </View>
        <Spread parts={[[late, c.danger], [today, c.ink], [soon, "#8a8a8a"], [rest, c.edge]]} />
        <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{`${plural(pool.length, "tarea abierta", "tareas abiertas")} · ${soon} esta semana`}</Text>
      </FadeIn>
      {top}

      {both && (
        <View style={{ flexDirection: "row", gap: 20 }}>
          {(
            [
              ["all", "Todas"],
              ["mine", "Tuyas"],
              ["client", "Del cliente"],
            ] as const
          ).map(([k, label]) => (
            <Pressable key={k} onPress={() => setWho(k)} hitSlop={8} accessibilityRole="button" accessibilityState={{ selected: who === k }}>
              <Text style={{ fontSize: 15, fontFamily: who === k ? font.semibold : font.regular, color: who === k ? c.ink : c.muted }}>{label}</Text>
              <View style={{ marginTop: 4, height: 2, borderRadius: 1, backgroundColor: who === k ? c.ink : "transparent" }} />
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 6 }}>
        {late > 0 && <DayChip top="!" main={String(late)} on={pick === "late"} danger dots={0} onPress={() => setPick(pick === "late" ? null : "late")} label="Vencidas" />}
        {Array.from({ length: DAYS_AHEAD }, (_, i) => {
          const d = dateAt(i);
          return <DayChip key={i} top={i === 0 ? "HOY" : WEEKDAY[d.getDay()]} main={String(d.getDate())} on={pick === i} today={i === 0} dots={at(i).length} onPress={() => setPick(pick === i ? null : i)} label={dayName(i)} />;
        })}
        {at("none").length > 0 && <DayChip top="—" main="∞" on={pick === "none"} dots={at("none").length} onPress={() => setPick(pick === "none" ? null : "none")} label="Sin fecha" />}
      </ScrollView>

      <View>
        {groups.length === 0 && <Text style={{ fontSize: 15, fontFamily: font.regular, color: c.muted, paddingVertical: 8 }}>Nada para este día.</Text>}
        {groups.map((g, gi) => (
          <View key={String(g.s)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 6, paddingTop: gi === 0 ? 0 : 14 }}>
              <View style={{ width: 22, alignItems: "center" }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: g.s === "late" ? c.danger : g.s === 0 ? c.ink : c.edge }} />
              </View>
              <Text style={{ fontSize: 13, fontFamily: font.semibold, letterSpacing: 0.6, color: g.s === "late" ? c.danger : c.ink }}>
                {(g.s === "late" ? "Vencidas" : g.s === "none" ? "Sin fecha" : dayName(g.s)).toUpperCase()}
              </Text>
            </View>
            {g.items.map((t, i) => (
              <FadeIn key={t.id} delay={Math.min(gi * 70 + i * 40, 500)}>
                <Row t={t} late={g.s === "late"} last={gi === groups.length - 1 && i === g.items.length - 1} />
              </FadeIn>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Barra de reparto: un segmento por grupo, proporcional, que crece al aparecer. */
function Spread({ parts }: { parts: Array<[number, string]> }) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 700, delay: 150, useNativeDriver: false }).start();
  }, []);
  const total = parts.reduce((s, [n]) => s + n, 0) || 1;
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: c.surface, overflow: "hidden" }}>
      <Animated.View style={{ flexDirection: "row", gap: 3, height: 10, width: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }}>
        {parts.filter(([n]) => n > 0).map(([n, color], i) => (
          <View key={i} style={{ flex: n / total, backgroundColor: color, borderRadius: 5 }} />
        ))}
      </Animated.View>
    </View>
  );
}

function DayChip({ top, main, on, today, danger, dots, onPress, label }: { top: string; main: string; on: boolean; today?: boolean; danger?: boolean; dots: number; onPress: () => void; label: string }) {
  const tone = danger ? c.danger : c.ink;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} style={{ width: 48, alignItems: "center", gap: 6, paddingVertical: 8, borderRadius: 24, backgroundColor: on ? tone : "transparent" }}>
      <Text style={{ fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.4, color: on ? "rgba(255,255,255,0.8)" : danger ? c.danger : c.muted }}>{top}</Text>
      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: today && !on ? 1.5 : 0, borderColor: c.ink }}>
        <Text style={{ fontSize: 17, fontFamily: font.semibold, color: on ? "#fff" : danger ? c.danger : dots ? c.ink : c.muted }}>{main}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 3, height: 5 }}>
        {Array.from({ length: Math.min(dots, 3) }, (_, i) => (
          <View key={i} style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: on ? "#fff" : tone }} />
        ))}
      </View>
    </Pressable>
  );
}

/** Una tarea en la línea de tiempo: el nodo es su círculo (se completa tocándolo, si se puede), y un raíl la une a la siguiente. */
function Row({ t, late, last }: { t: PanelTask; late: boolean; last: boolean }) {
  const color = LEVEL_COLOR[t.priority] ?? c.muted;
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!note.trim() || busy || !t.onComplete) return;
    setBusy(true);
    try {
      await t.onComplete(note.trim());
    } finally {
      setBusy(false);
    }
  };
  const meta = [t.who, t.store ? `Tienda ${t.store}` : null, PRIORITY_LABEL[t.priority], late && t.due_at ? `desde el ${new Date(t.due_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}` : null].filter(Boolean).join(" · ");

  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ width: 22, alignItems: "center" }}>
        {!last && <View style={{ position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: c.surface }} />}
        <Pressable onPress={() => t.onComplete && setClosing(true)} disabled={!t.onComplete} hitSlop={10} accessibilityRole={t.onComplete ? "button" : undefined} accessibilityLabel={t.onComplete ? "Completar" : undefined} style={{ marginTop: 14, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color, backgroundColor: closing ? color : c.bg, alignItems: "center", justifyContent: "center" }}>
          {closing && <Check size={12} color="#fff" strokeWidth={3} />}
        </Pressable>
      </View>
      <View style={{ flex: 1, paddingVertical: 12, gap: 10 }}>
        <Pressable onPress={t.onPress} disabled={!t.onPress} accessibilityRole={t.onPress ? "button" : undefined} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.5 : 1 })}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text numberOfLines={3} style={{ fontSize: 16, lineHeight: 22, fontFamily: font.medium, color: c.ink }}>{t.title}</Text>
            {!!meta && <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: late ? c.danger : c.muted }}>{meta}</Text>}
          </View>
          {t.onPress && <ChevronRight size={18} color={c.muted} />}
        </Pressable>
        {closing && (
          <FadeIn style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              autoFocus
              value={note}
              onChangeText={setNote}
              placeholder="¿Qué resultado tuvo?"
              placeholderTextColor={c.muted}
              maxLength={500}
              returnKeyType="done"
              onSubmitEditing={send}
              style={{ flex: 1, borderWidth: 1, borderColor: c.edge, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, fontFamily: font.regular, color: c.ink }}
            />
            <RoundIcon Icon={X} color={c.muted} label="Cancelar" onPress={() => setClosing(false)} />
            <RoundIcon Icon={Check} color={GOOD} on disabled={!note.trim() || busy} label="Completar" onPress={send} />
          </FadeIn>
        )}
      </View>
    </View>
  );
}
