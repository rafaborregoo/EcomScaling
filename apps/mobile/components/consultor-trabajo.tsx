import { useState } from "react";
import { refreshWorkbench } from "../lib/cartera";
import { useApi } from "../lib/use-api";
import { CaminoFases } from "./camino-fases";
import { LlamadasPanel } from "./llamadas-panel";
import { PropuestasIA, PropuestasPorCuenta, type ProposedClient } from "./propuestas-ia";
import { TaskSheet, completeTask, type TaskTarget } from "./tarea-hoja";
import { TareasPanel } from "./tareas-panel";
import { sortTasks, type Task as ClientTask } from "./tasks";
import { AllDone, Screen, Status, SubNav } from "./ui";
import type { OpenTarget } from "./consultor-hoy";
import type { Org } from "./views";

// /v1/consultant/work (apps/web/src/app/mi-trabajo/page.tsx): lo tuyo, de todos tus clientes.
type Call = { id: string; title: string; scheduled_at: string | null; organization_id: string; organization_name: string; is_overdue: boolean; my_open_tasks: number };
type Task = { id: string; title: string; status: string; priority: string; due_at: string | null; organization_id: string; organization_name: string; store_name?: string | null };
type Uncovered = { id: string; display_name: string; days_since_last_call: number | null };
type Work = { upcoming_calls: Call[]; my_tasks: Task[]; uncovered_clients: Uncovered[] };

type Open = (client: { id: string; name: string }, target: OpenTarget) => void;

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
  const proposed = useApi<{ clients: ProposedClient[] }>("/v1/consultant/proposed-tasks");
  const [sheet, setSheet] = useState<TaskTarget | null>(null);
  const show = (p: typeof page) => !org || page === p;

  const here = (id: string) => !org || org.id === id;
  const tasks = (work.data?.my_tasks ?? []).filter((t) => here(t.organization_id));
  const calls = (work.data?.upcoming_calls ?? []).filter((x) => here(x.organization_id));
  const uncovered = (work.data?.uncovered_clients ?? []).filter((x) => here(x.id)).slice(0, 5);
  const proposals = (proposed.data?.clients ?? []).filter((x) => here(x.organization_id));
  const reload = async () => void (await Promise.all([work.reload(), proposed.reload(), refreshWorkbench(), ...(org ? [ops.reload()] : [])]));

  const empty = !!work.data && !org && calls.length + uncovered.length + proposals.length === 0;

  return (
    <Screen flat title="Trabajo" onRefresh={reload}>
      <Status error={work.error} loading={!work.data} retry={work.retry} />
      {org && <SubNav items={[{ key: "camino", label: "Camino" }, { key: "tareas", label: "Tareas" }, { key: "llamadas", label: "Llamadas" }]} value={page} onChange={setPage} />}
      {empty && <AllDone text="Nada pendiente" />}

      {org && page === "camino" && <CaminoFases org={org} />}

      {/* Sin cliente: primero las cuentas con lo que propone la IA; las tareas se ven con un cliente elegido. */}
      {!org && proposed.data && <PropuestasPorCuenta clients={proposals} onDone={() => void reload()} />}

      {org && page === "tareas" && ops.data && (
        <TareasPanel
          top={<PropuestasIA clients={proposals} showClient={false} onDone={() => void reload()} />}
          onAdd={() => setSheet({ kind: "new", orgId: org.id, connectionId: org.connectionId })}
          tasks={[
            ...tasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority, due_at: t.due_at, who: "Tú", store: t.store_name, mine: true, onPress: () => setSheet({ kind: "edit", orgId: t.organization_id, id: t.id, title: t.title, dueAt: t.due_at, canComplete: true }), onComplete: async (note: string) => { await completeTask(t.organization_id, t.id, note); await reload(); } })),
            // Una tarea del cliente asignada al consultor llega por las dos fuentes: se queda solo como suya.
            ...clientTasks.filter((t) => !tasks.some((m) => m.id === t.id)).map((t) => ({ id: t.id, title: t.title, priority: t.priority, due_at: t.due_at, who: t.assignee_name ?? "Cliente", store: t.store?.name, mine: false, onPress: () => setSheet({ kind: "edit", orgId: org.id, id: t.id, title: t.title, dueAt: t.due_at, canComplete: false }) })),
          ]}
        />
      )}

      {show("llamadas") && (calls.length + uncovered.length > 0 || org) && (
        <LlamadasPanel
          calls={calls.map((x) => ({ id: x.id, title: x.title, scheduled_at: x.scheduled_at, client: org ? null : x.organization_name, overdue: x.is_overdue, openTasks: x.my_open_tasks, onPress: () => onOpen({ id: x.organization_id, name: x.organization_name }, "hoy") }))}
          gaps={uncovered.map((x) => ({ id: x.id, name: x.display_name, days: x.days_since_last_call, onPress: () => onOpen({ id: x.id, name: x.display_name }, "hoy") }))}
        />
      )}
      <TaskSheet
        target={sheet}
        onClose={() => setSheet(null)}
        onSaved={() => {
          setSheet(null);
          void reload();
        }}
      />
    </Screen>
  );
}
