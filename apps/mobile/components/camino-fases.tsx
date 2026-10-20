import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Circle, CircleCheck, Flag, Pencil, Plus, Target, TrendingDown, TrendingUp } from "lucide-react-native";
import { apiSend } from "../lib/api";
import { useApi } from "../lib/use-api";
import { c, font, GOOD } from "../lib/theme";
import { LEVEL_COLOR, Sheet, SheetError } from "./sheet";
import { CountUp, FadeIn, Grow } from "./motion";
import { Note } from "./ui";
import { withStore, type Org } from "./views";

// GET /v1/organizations/:id/strategic-plan: fases (mundos) con sus hitos y las tareas de cada hito.
type Task = { id: string; title: string; status: string; priority: string; due_at: string | null };
type Milestone = { id: string; name: string; status: string; position: number; milestone_task_links: Array<{ tasks: Task | null }> };
type Phase = { id: string; name: string; position: number; status: string; strategic_plan_milestones: Milestone[] };
type Goal = { metric_label?: string; baseline?: number | null; target?: number | null; target_date?: string; unit?: string; currency_code?: string | null };
type Plan = { name: string; goal: Goal | null; currency_code?: string | null; strategic_plan_phases: Phase[] };

const PHASE_LABEL: Record<string, string> = { active: "En curso", completed: "Hecha", pending: "Siguiente", locked: "Más adelante" };
const PRIORITIES = [["low", "Baja"], ["medium", "Media"], ["high", "Alta"], ["urgent", "Urgente"]] as const;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const day = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const closed = (t: Task) => ["completed", "ignored", "cancelled"].includes(t.status);
const overdue = (t: Task) => !closed(t) && !!t.due_at && new Date(t.due_at).getTime() < Date.now();

function value(n: number | null | undefined, goal: Goal, currency: string) {
  if (n == null) return "—";
  if (goal.unit === "money") return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  if (goal.unit === "pct") return `${n.toFixed(1)}%`;
  if (goal.unit === "ratio") return `${n.toFixed(2)}x`;
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

// Qué se está editando: el nombre de la fase, una tarea que existe o una nueva (en un hito).
type Edit = { kind: "phase"; id: string; name: string } | { kind: "task"; milestoneId: string; task: Task } | { kind: "new"; milestones: Milestone[] };

/** El camino de la tienda: una fase por página (se desliza; arranca en la que está en curso). El consultor edita nombres y tareas. */
export function CaminoFases({ org }: { org: Org }) {
  const { data, error, reload } = useApi<{ plan: Plan | null }>(org.connectionId ? withStore(org, `/v1/organizations/${org.id}/strategic-plan`) : null);
  const { width } = useWindowDimensions();
  const [edit, setEdit] = useState<Edit | null>(null);
  const [page, setPage] = useState<number | null>(null);
  const plan = data?.plan;
  const phases = [...(plan?.strategic_plan_phases ?? [])].sort((a, b) => a.position - b.position);
  if (!org.connectionId) return <Note flat text="Elige una tienda de este cliente en el selector de arriba para ver su camino." />;
  if (error) return <Note flat text={`No se pudo cargar el camino de esta tienda (${error}). Prueba con otra tienda en el selector.`} />;
  if (!data) return null;
  if (!plan || phases.length === 0) return <Note flat text="Esta tienda aún no tiene camino." />;

  const start = Math.max(0, phases.findIndex((p) => p.status === "active"));
  const goal = plan.goal;
  const currency = plan.currency_code ?? goal?.currency_code ?? "EUR";
  const here = Math.min(page ?? start, phases.length - 1);
  const left = goal?.target_date ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / 86_400_000) : null;
  // Cuánto tiene que moverse la métrica para llegar (en % sobre la base): +92 % en ventas, -25 % en CAC...
  const change = goal?.baseline && goal.target != null && goal.unit !== "pct" ? ((goal.target - goal.baseline) / Math.abs(goal.baseline)) * 100 : null;

  return (
    <>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
        {phases.map((p, i) => (
          <View key={p.id} style={{ flex: 1 }}>
            <Grow pct={i === here || p.status === "completed" ? 1 : 0} color={i === here ? c.ink : GOOD} track={c.edge} height={4} />
          </View>
        ))}
      </View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: start * width, y: 0 }}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ marginHorizontal: -20 }}
      >
        {phases.map((p) => {
          const milestones = [...p.strategic_plan_milestones].sort((a, b) => a.position - b.position);
          // Una misma tarea puede venir enlazada dos veces al hito: se muestra una.
          const tasksOf = (m: Milestone) => [...new Map(m.milestone_task_links.flatMap((l) => (l.tasks && l.tasks.status !== "cancelled" ? [[l.tasks.id, l.tasks] as const] : []))).values()].sort((a, b) => Number(closed(a)) - Number(closed(b)));
          const all = milestones.flatMap(tasksOf);
          const open = all.filter((t) => !closed(t));
          const late = open.filter(overdue).length;
          return (
            <View key={p.id} style={{ width, paddingHorizontal: 20, gap: 20 }}>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>{`FASE ${p.position} DE ${phases.length} · ${PHASE_LABEL[p.status] ?? p.status}`.toUpperCase()}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ flex: 1, fontSize: 24, fontFamily: font.semibold, color: c.ink }}>{p.name}</Text>
                  <Pressable onPress={() => setEdit({ kind: "phase", id: p.id, name: p.name })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cambiar el nombre de la fase">
                    <Pencil size={18} color={c.muted} />
                  </Pressable>
                </View>
                <Text style={{ fontSize: 14, fontFamily: font.regular, color: late ? c.danger : c.muted }}>
                  {open.length === 0 ? "Todo hecho" : `${open.length} tarea${open.length > 1 ? "s" : ""} abierta${open.length > 1 ? "s" : ""}${late ? ` · ${late} vencida${late > 1 ? "s" : ""}` : ""}`}
                </Text>
              </View>

              {goal?.metric_label && (
                <FadeIn>
                  <View style={{ gap: 14, padding: 20, borderRadius: 24, backgroundColor: c.ink, overflow: "hidden" }}>
                    <View style={{ position: "absolute", right: -60, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.06)" }} />
                    <View style={{ position: "absolute", right: 30, top: 50, width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.04)" }} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Target size={16} color="#fff" />
                      <Text style={{ flex: 1, fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.8, color: "rgba(255,255,255,0.7)" }}>OBJETIVO</Text>
                      {left != null && (
                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" }}>
                          <Text style={{ fontSize: 12, fontFamily: font.semibold, color: "#fff" }}>{left > 0 ? `Faltan ${left} días` : left === 0 ? "Es hoy" : "Plazo cumplido"}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ gap: 2 }}>
                      <Text style={{ fontSize: 15, fontFamily: font.regular, color: "rgba(255,255,255,0.8)" }}>{goal.metric_label}</Text>
                      {goal.target != null ? (
                        <CountUp to={goal.target} format={(n) => value(n, goal, currency)} style={{ fontSize: 44, lineHeight: 52, fontFamily: font.semibold, color: "#fff", letterSpacing: -1 }} />
                      ) : (
                        <Text style={{ fontSize: 44, fontFamily: font.semibold, color: "#fff" }}>—</Text>
                      )}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Text style={{ fontSize: 14, fontFamily: font.regular, color: "rgba(255,255,255,0.7)" }}>{`desde ${value(goal.baseline, goal, currency)}${goal.target_date ? ` · para el ${day(goal.target_date)}` : ""}`}</Text>
                        {change != null && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(15,157,122,0.25)" }}>
                            {change >= 0 ? <TrendingUp size={13} color="#5eead4" /> : <TrendingDown size={13} color="#5eead4" />}
                            <Text style={{ fontSize: 12, fontFamily: font.semibold, color: "#5eead4" }}>{`${change >= 0 ? "+" : ""}${Math.round(change)} %`}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row" }}>
                        <Text style={{ flex: 1, fontSize: 13, fontFamily: font.regular, color: "rgba(255,255,255,0.7)" }}>Tareas de la fase</Text>
                        <Text style={{ fontSize: 13, fontFamily: font.semibold, color: "#fff" }}>{`${all.length - open.length}/${all.length}`}</Text>
                      </View>
                      <Grow pct={all.length ? (all.length - open.length) / all.length : 0} color="#5eead4" track="rgba(255,255,255,0.15)" height={8} delay={250} />
                    </View>
                  </View>
                </FadeIn>
              )}

              {milestones.length === 0 && <Text style={{ fontSize: 14, fontFamily: font.regular, color: c.muted }}>Sin objetivos en esta fase.</Text>}
              {milestones.map((m, mi) => {
                const tasks = tasksOf(m);
                const ok = tasks.filter(closed).length;
                const finished = ["completed", "skipped"].includes(m.status);
                return (
                  <FadeIn key={m.id} delay={120 + mi * 90}>
                    <View style={{ gap: 12, padding: 16, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.edge }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                        <Flag size={18} color={finished ? GOOD : c.ink} style={{ marginTop: 2 }} />
                        <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, fontFamily: font.semibold, color: c.ink }}>{m.name}</Text>
                        {tasks.length > 0 && <Text style={{ fontSize: 13, fontFamily: font.semibold, color: finished || ok === tasks.length ? GOOD : c.muted }}>{`${ok}/${tasks.length}`}</Text>}
                      </View>
                      {tasks.length > 0 && <Grow pct={ok / tasks.length} color={GOOD} track={c.edge} height={5} delay={300 + mi * 90} />}
                      <View>
                        {tasks.map((t, i) => {
                          const done = closed(t);
                          const Mark = done ? CircleCheck : Circle;
                          return (
                            <FadeIn key={t.id} delay={200 + mi * 90 + i * 50}>
                              <Pressable onPress={() => setEdit({ kind: "task", milestoneId: m.id, task: t })} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge, opacity: pressed ? 0.6 : done ? 0.55 : 1 })}>
                                <Mark size={20} color={done ? GOOD : (LEVEL_COLOR[t.priority] ?? c.muted)} strokeWidth={2} />
                                <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, fontFamily: font.regular, color: c.ink, textDecorationLine: done ? "line-through" : "none" }}>{t.title}</Text>
                                {t.due_at && (
                                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: overdue(t) ? "rgba(220,38,38,0.1)" : c.bg }}>
                                    <Text style={{ fontSize: 12, fontFamily: font.semibold, color: overdue(t) ? c.danger : c.muted }}>{day(t.due_at)}</Text>
                                  </View>
                                )}
                              </Pressable>
                            </FadeIn>
                          );
                        })}
                      </View>
                    </View>
                  </FadeIn>
                );
              })}

              <Pressable onPress={() => setEdit({ kind: "new", milestones })} disabled={milestones.length === 0} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: c.edge, opacity: milestones.length ? (pressed ? 0.6 : 1) : 0.4 })}>
                <Plus size={18} color={c.ink} />
                <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.ink }}>Añadir tarea</Text>
              </Pressable>
              <View style={{ height: 8 }} />
            </View>
          );
        })}
      </ScrollView>
      <EditSheet
        orgId={org.id}
        edit={edit}
        onClose={() => setEdit(null)}
        onSaved={async () => {
          setEdit(null);
          await reload();
        }}
      />
    </>
  );
}

const input = { borderWidth: 1, borderColor: c.edge, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: font.regular, color: c.ink } as const;

/** Una hoja para los tres cambios: nombre de fase, tarea existente y tarea nueva. */
function EditSheet({ orgId, edit, onClose, onSaved }: { orgId: string; edit: Edit | null; onClose: () => void; onSaved: () => void }) {
  // `key` reinicia el formulario al abrir otra cosa.
  const key = !edit ? "" : edit.kind === "phase" ? `p${edit.id}` : edit.kind === "task" ? `t${edit.task.id}` : "new";
  return (
    <Sheet visible={!!edit} onClose={onClose} title={!edit ? "" : edit.kind === "phase" ? "Nombre de la fase" : edit.kind === "task" ? "Tarea" : "Nueva tarea"}>
      {edit && <EditForm key={key} orgId={orgId} edit={edit} onSaved={onSaved} />}
    </Sheet>
  );
}

function EditForm({ orgId, edit, onSaved }: { orgId: string; edit: Edit; onSaved: () => void }) {
  const task = edit.kind === "task" ? edit.task : null;
  const [text, setText] = useState(edit.kind === "phase" ? edit.name : (task?.title ?? ""));
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [due, setDue] = useState(task?.due_at?.slice(0, 10) ?? "");
  const [milestoneId, setMilestoneId] = useState(edit.kind === "new" ? (edit.milestones.find((m) => !["completed", "skipped"].includes(m.status)) ?? edit.milestones[0]).id : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/v1/organizations/${orgId}`;
  const dateOk = due === "" || /^\d{4}-\d{2}-\d{2}$/.test(due);

  async function save() {
    setBusy(true);
    setError(null);
    const dueAt = due ? `${due}T12:00:00.000Z` : null;
    try {
      if (edit.kind === "phase") await apiSend("PATCH", `${base}/strategic-plan/phases/${edit.id}`, { name: text.trim() });
      else if (edit.kind === "task") await apiSend("PATCH", `${base}/strategic-plan/milestones/${edit.milestoneId}/tasks/${edit.task.id}`, { title: text.trim(), priority, dueAt });
      else await apiSend("POST", `${base}/milestones/${milestoneId}/tasks`, { title: text.trim(), priority, dueAt });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <TextInput autoFocus value={text} onChangeText={setText} placeholder={edit.kind === "phase" ? "Nombre" : "Título de la tarea"} placeholderTextColor={c.muted} maxLength={255} multiline={edit.kind !== "phase"} style={input} />
      {edit.kind !== "phase" && (
        <>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {PRIORITIES.map(([k, label]) => (
              <Chip key={k} label={label} on={priority === k} onPress={() => setPriority(k)} />
            ))}
          </View>
          <TextInput value={due} onChangeText={setDue} placeholder="Fecha límite (AAAA-MM-DD), opcional" placeholderTextColor={c.muted} keyboardType="numbers-and-punctuation" maxLength={10} style={input} />
        </>
      )}
      {edit.kind === "new" && edit.milestones.length > 1 && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>HITO</Text>
          {edit.milestones.map((m) => (
            <Chip key={m.id} label={m.name} on={milestoneId === m.id} onPress={() => setMilestoneId(m.id)} />
          ))}
        </View>
      )}
      <SheetError text={error} />
      <Pressable onPress={save} disabled={busy || !text.trim() || !dateOk} accessibilityRole="button" style={{ alignItems: "center", paddingVertical: 14, borderRadius: 12, backgroundColor: c.ink, opacity: busy || !text.trim() || !dateOk ? 0.4 : 1 }}>
        <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.bg }}>{busy ? "Guardando…" : "Guardar"}</Text>
      </Pressable>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: on ? c.ink : c.edge, backgroundColor: on ? c.ink : "transparent" }}>
      <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: on ? font.semibold : font.regular, color: on ? c.bg : c.ink }}>{label}</Text>
    </Pressable>
  );
}
