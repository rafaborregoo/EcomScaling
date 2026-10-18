import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Pencil, Plus } from "lucide-react-native";
import { apiSend } from "../lib/api";
import { useApi } from "../lib/use-api";
import { c, font, GOOD } from "../lib/theme";
import { LEVEL_COLOR, Sheet, SheetError } from "./sheet";
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
  const plan = data?.plan;
  const phases = [...(plan?.strategic_plan_phases ?? [])].sort((a, b) => a.position - b.position);
  if (!org.connectionId) return <Note flat text="Elige una tienda de este cliente en el selector de arriba para ver su camino." />;
  if (error) return <Note flat text={`No se pudo cargar el camino de esta tienda (${error}). Prueba con otra tienda en el selector.`} />;
  if (!data) return null;
  if (!plan || phases.length === 0) return <Note flat text="Esta tienda aún no tiene camino." />;

  const start = Math.max(0, phases.findIndex((p) => p.status === "active"));
  const goal = plan.goal;
  const currency = plan.currency_code ?? goal?.currency_code ?? "EUR";

  return (
    <>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: start * width, y: 0 }} style={{ marginHorizontal: -20 }}>
        {phases.map((p) => {
          const milestones = [...p.strategic_plan_milestones].sort((a, b) => a.position - b.position);
          const tasks = milestones
            .flatMap((m) => m.milestone_task_links.map((l) => l.tasks && { t: l.tasks, m }))
            .filter((x): x is { t: Task; m: Milestone } => !!x && x.t.status !== "cancelled")
            .sort((a, b) => Number(closed(a.t)) - Number(closed(b.t)));
          const open = tasks.filter((x) => !closed(x.t));
          const late = open.filter((x) => overdue(x.t)).length;
          const done = milestones.filter((m) => ["completed", "skipped"].includes(m.status)).length;
          return (
            <View key={p.id} style={{ width, paddingHorizontal: 20, gap: 20 }}>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>{`FASE ${p.position}/${phases.length} · ${PHASE_LABEL[p.status] ?? p.status}`.toUpperCase()}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ flex: 1, fontSize: 24, fontFamily: font.semibold, color: c.ink }}>{p.name}</Text>
                  <Pressable onPress={() => setEdit({ kind: "phase", id: p.id, name: p.name })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cambiar el nombre de la fase">
                    <Pencil size={18} color={c.muted} />
                  </Pressable>
                </View>
              </View>

              {goal?.metric_label && (
                <View style={{ gap: 2 }}>
                  <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>Objetivo · {goal.metric_label}</Text>
                  <Text style={{ fontSize: 17, fontFamily: font.semibold, color: c.ink }}>
                    {value(goal.baseline, goal, currency)} → {value(goal.target, goal, currency)}
                    {goal.target_date ? <Text style={{ fontFamily: font.regular, color: c.muted }}>{`  ·  ${day(goal.target_date)}`}</Text> : null}
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 28 }}>
                <Stat label="Hitos" value={`${done}/${milestones.length}`} />
                <Stat label="Tareas abiertas" value={String(open.length)} />
                {late > 0 && <Stat label="Vencidas" value={String(late)} color={c.danger} />}
              </View>

              <View>
                <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 4 }}>
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>TAREAS DE LA FASE</Text>
                  <Pressable onPress={() => setEdit({ kind: "new", milestones })} hitSlop={10} accessibilityRole="button" accessibilityLabel="Añadir tarea" disabled={milestones.length === 0}>
                    <Plus size={20} color={milestones.length ? c.ink : c.edge} />
                  </Pressable>
                </View>
                {tasks.length === 0 && <Text style={{ paddingVertical: 12, fontSize: 14, fontFamily: font.regular, color: c.muted }}>Sin tareas en esta fase.</Text>}
                {tasks.map(({ t, m }, i) => (
                  <Pressable key={t.id} onPress={() => setEdit({ kind: "task", milestoneId: m.id, task: t })} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge, opacity: closed(t) ? 0.5 : 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: closed(t) ? GOOD : (LEVEL_COLOR[t.priority] ?? c.edge) }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={2} style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{t.title}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{m.name}</Text>
                    </View>
                    {t.due_at && <Text style={{ fontSize: 13, fontFamily: overdue(t) ? font.semibold : font.regular, color: overdue(t) ? c.danger : c.muted }}>{day(t.due_at)}</Text>}
                  </Pressable>
                ))}
              </View>
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View>
      <Text style={{ fontSize: 20, fontFamily: font.semibold, color: color ?? c.ink }}>{value}</Text>
      <Text style={{ fontSize: 12, fontFamily: font.regular, color: c.muted }}>{label}</Text>
    </View>
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
