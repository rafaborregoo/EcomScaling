import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Phone } from "lucide-react-native";
import { refreshWorkbench } from "../lib/cartera";
import { useApi } from "../lib/use-api";
import { CAUTION, c, font } from "../lib/theme";
import { CaminoFases } from "./camino-fases";
import { LEVEL_COLOR } from "./sheet";
import { sortTasks, type Task as ClientTask } from "./tasks";
import { ActionCard, AllDone, Group, Note, Screen, Status, SubNav } from "./ui";
import type { OpenTarget } from "./consultor-hoy";
import type { Org } from "./views";

// /v1/consultant/work (apps/web/src/app/mi-trabajo/page.tsx): lo tuyo, de todos tus clientes.
type Call = { id: string; title: string; scheduled_at: string | null; organization_id: string; organization_name: string; is_overdue: boolean; my_open_tasks: number };
type Task = { id: string; title: string; status: string; priority: string; due_at: string | null; organization_id: string; organization_name: string };
type Uncovered = { id: string; display_name: string; days_since_last_call: number | null };
type Work = { upcoming_calls: Call[]; my_tasks: Task[]; uncovered_clients: Uncovered[] };

type Open = (client: { id: string; name: string }, target: OpenTarget) => void;

const MAX_LIST = 6;

function when(iso: string | null) {
  if (!iso) return "Sin fecha";
  const at = new Date(iso);
  const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  const time = at.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (days < 0) return at.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  if (days === 0) return `Hoy ${time}`;
  if (days === 1) return `Mañana ${time}`;
  return `${at.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })} ${time}`;
}

/**
 * Trabajo del consultor: sus propuestas de la IA por decidir, sus tareas, sus llamadas y los clientes que llevan
 * tiempo sin una. Con un cliente elegido, solo lo suyo. Es la pantalla «Mi trabajo» de la web, en lo que cabe en un minuto.
 */
export function ConsultorTrabajo({ org, onOpen }: { org: Org | null; onOpen: Open }) {
  const work = useApi<Work>("/v1/consultant/work");
  // Con un cliente abierto: también SUS tareas (las que ve él), solo lectura; completarlas es del cliente.
  const ops = useApi<{ tasks: ClientTask[] }>(org ? `/v1/organizations/${org.id}/operations` : null);
  const clientTasks = org ? sortTasks(ops.data?.tasks ?? []) : [];
  // Con un cliente abierto el trabajo se reparte en páginas; la primera es SU camino. Sin cliente, todo junto.
  const [page, setPage] = useState<"camino" | "tareas" | "llamadas">("camino");
  const show = (p: typeof page) => !org || page === p;
  const [more, setMore] = useState(false);

  const here = (id: string) => !org || org.id === id;
  const tasks = (work.data?.my_tasks ?? []).filter((t) => here(t.organization_id));
  const calls = (work.data?.upcoming_calls ?? []).filter((x) => here(x.organization_id));
  const uncovered = (work.data?.uncovered_clients ?? []).filter((x) => here(x.id)).slice(0, 5);
  const reload = async () => void (await Promise.all([work.reload(), refreshWorkbench(), ...(org ? [ops.reload()] : [])]));

  const empty = !!work.data && !org && tasks.length + clientTasks.length + calls.length + uncovered.length === 0;
  const shownTasks = more ? tasks : tasks.slice(0, MAX_LIST);

  return (
    <Screen flat title="Trabajo" onRefresh={reload}>
      <Status error={work.error} loading={!work.data} retry={work.retry} />
      {org && <SubNav items={[{ key: "camino", label: "Camino" }, { key: "tareas", label: "Tareas" }, { key: "llamadas", label: "Llamadas" }]} value={page} onChange={setPage} />}
      {empty && <AllDone text="Nada pendiente" />}

      {org && page === "camino" && <CaminoFases org={org} />}

      {show("tareas") && tasks.length > 0 && (
        <Group title="Tareas tuyas">
          <View>
            {shownTasks.map((t, i) => {
              const overdue = !!t.due_at && new Date(t.due_at).getTime() < Date.now();
              return (
                <Pressable key={t.id} onPress={() => onOpen({ id: t.organization_id, name: t.organization_name }, "hoy")} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEVEL_COLOR[t.priority] ?? c.edge }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={2} style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{t.title}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{t.organization_name}</Text>
                  </View>
                  {t.due_at && <Text style={{ fontSize: 13, fontFamily: overdue ? font.semibold : font.regular, color: overdue ? c.danger : c.muted }}>{new Date(t.due_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</Text>}
                </Pressable>
              );
            })}
          </View>
          {tasks.length > MAX_LIST && (
            <Pressable onPress={() => setMore((v) => !v)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: "flex-start", paddingVertical: 6 }}>
              <Text style={{ fontSize: 14, fontFamily: font.semibold, color: c.ink }}>{more ? "Ver menos" : `Ver las ${tasks.length - MAX_LIST} restantes`}</Text>
            </Pressable>
          )}
        </Group>
      )}

      {show("tareas") && clientTasks.length > 0 && (
        <Group title="Tareas del cliente">
          <View>
            {clientTasks.map((t, i) => {
              const overdue = !!t.due_at && new Date(t.due_at).getTime() < Date.now();
              return (
                <View key={t.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: LEVEL_COLOR[t.priority] ?? c.edge }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={2} style={{ fontSize: 15, fontFamily: font.medium, color: c.ink }}>{t.title}</Text>
                    {t.assignee_name && <Text numberOfLines={1} style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{t.assignee_name}</Text>}
                  </View>
                  {t.due_at && <Text style={{ fontSize: 13, fontFamily: overdue ? font.semibold : font.regular, color: overdue ? c.danger : c.muted }}>{new Date(t.due_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</Text>}
                </View>
              );
            })}
          </View>
        </Group>
      )}

      {show("llamadas") && calls.length > 0 && (
        <Group title="Llamadas">
          {calls.map((x) => (
            <ActionCard
              key={x.id}
              color={x.is_overdue ? c.danger : c.edge}
              Icon={Phone}
              eyebrow={x.organization_name}
              when={when(x.scheduled_at)}
              whenColor={x.is_overdue ? c.danger : c.muted}
              title={x.my_open_tasks > 0 ? `${x.my_open_tasks} tarea${x.my_open_tasks > 1 ? "s" : ""} tuya${x.my_open_tasks > 1 ? "s" : ""} abierta${x.my_open_tasks > 1 ? "s" : ""}` : x.title}
              onPress={() => onOpen({ id: x.organization_id, name: x.organization_name }, "hoy")}
            />
          ))}
        </Group>
      )}

      {show("llamadas") && uncovered.length > 0 && (
        <Group title="Sin llamada reciente">
          <View>
            {uncovered.map((x, i) => (
              <Pressable key={x.id} onPress={() => onOpen({ id: x.id, name: x.display_name }, "hoy")} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x.days_since_last_call == null ? c.edge : CAUTION }} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: c.ink }}>{x.display_name}</Text>
                <Text style={{ fontSize: 13, fontFamily: font.regular, color: c.muted }}>{x.days_since_last_call == null ? "Nunca" : `Hace ${x.days_since_last_call} días`}</Text>
              </Pressable>
            ))}
          </View>
        </Group>
      )}
    </Screen>
  );
}
