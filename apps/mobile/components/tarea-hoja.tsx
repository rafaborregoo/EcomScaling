import { useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { apiSend } from "../lib/api";
import { useApi } from "../lib/use-api";
import { Check } from "lucide-react-native";
import { c, font, GOOD } from "../lib/theme";
import { storeName, useStores } from "./selector-contexto";
import { LEVEL_COLOR, Sheet, SheetError } from "./sheet";

// Qué se abre: una tarea nueva en un cliente, o una existente (la API solo deja cambiar fecha y responsable fuera del Camino).
/** `canComplete`: la API deja al consultor cerrar su trabajo interno o lo asignado a él, no las tareas del cliente. */
// `connectionId`: tienda elegida arriba; es la etiqueta por defecto de una tarea interna.
export type TaskTarget = { kind: "new"; orgId: string; connectionId?: string } | { kind: "edit"; orgId: string; id: string; title: string; dueAt: string | null; canComplete: boolean };
type Assignee = { id: string; name: string; role: string; is_self: boolean };

const PRIORITIES = [["low", "Baja"], ["medium", "Media"], ["high", "Alta"], ["urgent", "Urgente"]] as const;
const iso = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const QUICK_DATES = [["Hoy", 0], ["Mañana", 1], ["En 3 días", 3], ["En 1 semana", 7]] as const;

/** Completar = una línea de resultado (queda como comentario) y la tarea pasa a hecha; igual para cliente y consultor. */
export async function completeTask(orgId: string, taskId: string, note: string) {
  await apiSend("POST", `/v1/organizations/${orgId}/tasks/${taskId}/comments`, { body: `Resultado: ${note}`, isInternal: false });
  await apiSend("PATCH", `/v1/organizations/${orgId}/tasks/${taskId}/status`, { status: "completed" });
}

/** Hoja para crear una tarea, o cambiarle fecha y responsable y marcarla hecha. */
export function TaskSheet({ target, onClose, onSaved }: { target: TaskTarget | null; onClose: () => void; onSaved: () => void }) {
  const key = !target ? "" : target.kind === "new" ? `new-${target.orgId}` : target.id;
  return (
    <Sheet visible={!!target} onClose={onClose} title={target?.kind === "edit" ? "Tarea" : "Nueva tarea"}>
      {target && <Form key={key} target={target} onSaved={onSaved} />}
    </Sheet>
  );
}

function Form({ target, onSaved }: { target: TaskTarget; onSaved: () => void }) {
  const isNew = target.kind === "new";
  const people = useApi<{ assignees: Assignee[] }>(`/v1/organizations/${target.orgId}/task-assignees`);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState(target.kind === "edit" ? (target.dueAt?.slice(0, 10) ?? "") : "");
  // undefined = no tocar el responsable (al editar no sabemos el actual).
  const [who, setWho] = useState<string | null | undefined>(undefined);
  // Lo habitual del consultor es trabajo suyo: nace interna (el cliente no la ve).
  const [internal, setInternal] = useState(true);
  const [store, setStore] = useState(target.kind === "new" ? (target.connectionId ?? "") : "");
  const stores = useStores(isNew ? target.orgId : null);
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateOk = due === "" || /^\d{4}-\d{2}-\d{2}$/.test(due);
  const can = dateOk && !busy && (!isNew || !!title.trim());

  async function save() {
    setBusy(true);
    setError(null);
    const dueAt = due ? `${due}T12:00:00.000Z` : null;
    try {
      if (target.kind === "new") {
        await apiSend("POST", `/v1/organizations/${target.orgId}/tasks`, { title: title.trim(), priority, dueAt: dueAt ?? undefined, isVisibleToClient: !internal, ...(internal && store ? { connectionId: store } : {}), ...(who !== undefined ? { assignedTo: who } : {}) });
      } else {
        await apiSend("PATCH", `/v1/organizations/${target.orgId}/tasks/${target.id}/assignment`, { dueAt, ...(who !== undefined ? { assignedTo: who } : {}) });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      setBusy(false);
    }
  }

  async function complete() {
    if (target.kind !== "edit" || !result.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await completeTask(target.orgId, target.id, result.trim());
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 18 }}>
      {isNew ? (
        <TextInput autoFocus value={title} onChangeText={setTitle} placeholder="¿Qué hay que hacer?" placeholderTextColor={c.muted} maxLength={255} multiline style={{ fontSize: 20, lineHeight: 26, fontFamily: font.semibold, color: c.ink, paddingVertical: 4 }} />
      ) : (
        <Text style={{ fontSize: 20, lineHeight: 26, fontFamily: font.semibold, color: c.ink }}>{target.title}</Text>
      )}

      {isNew && (
        <Field label="PRIORIDAD">
          {PRIORITIES.map(([k, label]) => (
            <Chip key={k} label={label} on={priority === k} dot={LEVEL_COLOR[k]} onPress={() => setPriority(k)} />
          ))}
        </Field>
      )}

      <Field label="FECHA">
        {QUICK_DATES.map(([label, offset]) => (
          <Chip key={label} label={label} on={due === iso(offset)} onPress={() => setDue(iso(offset))} />
        ))}
        <Chip label="Sin fecha" on={due === ""} onPress={() => setDue("")} />
        <TextInput value={due} onChangeText={setDue} placeholder="AAAA-MM-DD" placeholderTextColor={c.muted} keyboardType="numbers-and-punctuation" maxLength={10} style={{ minWidth: 120, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: dateOk ? c.edge : c.danger, fontSize: 14, fontFamily: font.regular, color: c.ink }} />
      </Field>

      {(people.data?.assignees.length ?? 0) > 0 && (
        <Field label="RESPONSABLE">
          {people.data!.assignees.map((p) => (
            <Chip key={p.id} label={p.is_self ? "Yo" : p.name} on={who === p.id} onPress={() => setWho(p.id)} />
          ))}
          <Chip label="Sin asignar" on={who === null} onPress={() => setWho(null)} />
        </Field>
      )}

      {isNew && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>Solo interna</Text>
            <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{internal ? "El cliente no la verá." : "El cliente la recibe como propuesta y la acepta."}</Text>
          </View>
          <Switch value={internal} onValueChange={setInternal} />
        </View>
      )}

      {isNew && internal && stores.length > 0 && (
        <Field label="TIENDA">
          {stores.map((st) => (
            <Chip key={st.id} label={storeName(st)} on={store === st.id} onPress={() => setStore(st.id)} />
          ))}
          <Chip label="Sin tienda" on={store === ""} onPress={() => setStore("")} />
        </Field>
      )}

      {target.kind === "edit" && target.canComplete && (
        <View style={{ gap: 8, padding: 14, borderRadius: 16, backgroundColor: c.accentTint }}>
          <Text style={{ fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>MARCAR COMO HECHA</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput value={result} onChangeText={setResult} placeholder="¿Qué resultado tuvo?" placeholderTextColor={c.muted} maxLength={500} returnKeyType="done" onSubmitEditing={complete} style={{ flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: c.bg, fontSize: 15, fontFamily: font.regular, color: c.ink }} />
            <Pressable onPress={complete} disabled={!result.trim() || busy} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: GOOD, opacity: !result.trim() || busy ? 0.4 : 1 }}>
              <Check size={16} color="#fff" strokeWidth={2.6} />
              <Text style={{ fontSize: 14, fontFamily: font.semibold, color: "#fff" }}>Hecha</Text>
            </Pressable>
          </View>
        </View>
      )}

      <SheetError text={error} />
      <Pressable onPress={save} disabled={!can} accessibilityRole="button" style={{ alignItems: "center", paddingVertical: 15, borderRadius: 999, backgroundColor: c.ink, opacity: can ? 1 : 0.35 }}>
        <Text style={{ fontSize: 15, fontFamily: font.semibold, color: c.bg }}>{busy ? "Guardando…" : isNew ? "Crear tarea" : "Guardar"}</Text>
      </Pressable>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, fontFamily: font.semibold, letterSpacing: 0.6, color: c.muted }}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>
    </View>
  );
}

function Chip({ label, on, dot, onPress }: { label: string; on: boolean; dot?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: on ? c.ink : c.edge, backgroundColor: on ? c.ink : "transparent" }}>
      {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />}
      <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: on ? font.semibold : font.regular, color: on ? c.bg : c.ink }}>{label}</Text>
    </Pressable>
  );
}
