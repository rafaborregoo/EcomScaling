"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { ModuleSummary } from "@/components/module-summary";
import { daysSince } from "@/lib/elapsed";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Heading,
  Input,
  List,
  LoadingBlock,
  toast,
  type Tone,
} from "@/components/ui";

/**
 * "Mi trabajo": la pantalla del consultor sobre SÍ MISMO, no sobre una tienda.
 *
 * No guarda nada nuevo. Los apuntes de preparación son las notas internas de
 * la llamada (`call_internal_notes`), que ya existían y ya nacen ancladas a la
 * llamada donde se van a usar -- un cuaderno suelto las desconectaría justo
 * del sitio donde sirven. Lo que faltaba era una pantalla donde la próxima
 * llamada y lo que debes para ella estén juntos, sin cambiar de cliente cuatro
 * veces para preparar el lunes.
 */

type WorkGap = { topic: string; severity: string };

type WorkCall = {
  id: string;
  title: string;
  call_type: string;
  scheduled_at: string | null;
  organization_id: string;
  organization_name: string;
  is_overdue: boolean;
  my_open_tasks: number;
  internal_notes: Array<{ id: string; body: string; created_at: string }>;
  last_call: {
    id: string;
    title: string;
    held_at: string | null;
    gaps: WorkGap[];
  } | null;
};

type WorkTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  organization_id: string;
  organization_name: string;
  is_overdue: boolean;
};

type UncoveredClient = {
  id: string;
  display_name: string;
  last_call_at: string | null;
  days_since_last_call: number | null;
  my_open_tasks: number;
};

type WorkResponse = {
  upcoming_calls: WorkCall[];
  my_tasks: WorkTask[];
  uncovered_clients: UncoveredClient[];
  organizations: Array<{ id: string; display_name: string }>;
};

const CALL_TYPE_LABELS: Record<string, string> = {
  monthly_review: "Revisión mensual",
  onboarding: "Onboarding",
  strategy: "Estrategia",
  ad_hoc: "Puntual",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const GAP_TONE: Record<string, Tone> = {
  high: "danger",
  medium: "warn",
  low: "neutral",
};

// Cuándo es la llamada, en la forma en la que se planifica el día: "mañana",
// no "06 sep 2026, 10:00".
function whenLabel(scheduledAt: string | null) {
  if (!scheduledAt) return "Sin fecha";
  const at = new Date(scheduledAt);
  const target = new Date(at);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round(
    (target.getTime() - today.getTime()) / 86_400_000,
  );
  const time = at.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (days < 0) return `Sin cerrar · era el ${at.toLocaleDateString("es-ES")}`;
  if (days === 0) return `Hoy ${time}`;
  if (days === 1) return `Mañana ${time}`;
  if (days <= 7)
    return `${at.toLocaleDateString("es-ES", { weekday: "long" })} ${time}`;
  return `${at.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} ${time}`;
}

/**
 * Preparación de una llamada: lo que te espera, lo que quedó sin tratar la vez
 * anterior y tus apuntes. El campo de apunte guarda una nota interna en la
 * propia llamada, así que lo escrito aquí está donde tiene que estar cuando
 * abras /llamadas.
 */
function CallPrepCard({
  call,
  onOpenClient,
  onNoteSaved,
}: {
  call: WorkCall;
  onOpenClient: () => void;
  onNoteSaved: () => void;
}) {
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${call.organization_id}/calls/${call.id}/internal-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: note.trim() }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNote("");
      toast.success("Apunte guardado en la llamada.");
      onNoteSaved();
    } catch {
      setError("No se pudo guardar el apunte. Reintenta.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {call.is_overdue ? <Badge tone="danger">Sin cerrar</Badge> : null}
            <p className="text-sm font-medium text-foreground">
              {call.organization_name}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {call.title} · {CALL_TYPE_LABELS[call.call_type] ?? call.call_type}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={[
              "text-sm tabular-nums",
              call.is_overdue ? "font-medium text-danger" : "text-foreground",
            ].join(" ")}
          >
            {whenLabel(call.scheduled_at)}
          </span>
          <Button size="sm" variant="ghost" onClick={onOpenClient}>
            Abrir cliente
          </Button>
        </div>
      </div>

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-3 [&>div]:rounded-lg [&>div]:bg-surface [&>div]:p-3">
        <div>
          <p className={EYEBROW}>De la última llamada</p>
          {call.last_call ? (
            <>
              <p className="mt-1 text-xs text-muted">
                {call.last_call.title}
                {call.last_call.held_at
                  ? ` · hace ${daysSince(call.last_call.held_at)} d`
                  : ""}
              </p>
              {/* Lo que el agente dijo que no trataste y sigue sin tratarse:
                  es exactamente lo que hay que llevar preparado. */}
              {call.last_call.gaps.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {call.last_call.gaps.map((gap, index) => (
                    <li
                      key={index}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <Badge tone={GAP_TONE[gap.severity] ?? "neutral"}>
                        {gap.topic}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  Sin huecos señalados.
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">
              Es la primera llamada con este cliente.
            </p>
          )}
        </div>

        <div>
          <p className={EYEBROW}>Sin cerrar</p>
          <p
            className={`mt-1 text-sm ${call.my_open_tasks > 0 ? "text-warning" : "text-muted"}`}
          >
            {call.my_open_tasks > 0
              ? `${call.my_open_tasks} ${call.my_open_tasks === 1 ? "tarea tuya abierta" : "tareas tuyas abiertas"} con este cliente`
              : "Nada tuyo pendiente con este cliente."}
          </p>
        </div>

        <div>
          <p className={EYEBROW}>Apuntes para la llamada</p>
          {call.internal_notes.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {call.internal_notes.map((entry) => (
                <li key={entry.id} className="text-sm text-foreground">
                  {entry.body}
                </li>
              ))}
            </ul>
          ) : null}
          <form className="mt-2 flex flex-col gap-2 sm:flex-row" onSubmit={saveNote}>
            <Input
              className="w-full"
              aria-label={`Apunte para la llamada con ${call.organization_name}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Preguntar por..., traer el análisis de..."
            />
            <Button
              size="sm"
              type="submit"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={isSaving || !note.trim()}
            >
              {isSaving ? "..." : "Apuntar"}
            </Button>
          </form>
        </div>
      </div>
    </Card>
  );
}

/** Pantalla del consultor: el cliente va a sus tareas. */
function RedirectTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [href, router]);
  return null;
}

function MyWorkContent() {
  const { setOrganizationId } = useActiveOrganization();
  const router = useRouter();
  const [data, setData] = useState<WorkResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/v1/consultant/work");
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setData((await response.json()) as WorkResponse);
      setError(null);
    } catch {
      setError("No se pudo cargar tu trabajo por un error de red. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando tu trabajo..." />
      </div>
    );
  }

  const upcoming = data?.upcoming_calls ?? [];
  const myTasks = data?.my_tasks ?? [];
  const uncovered = data?.uncovered_clients ?? [];
  const overdueCalls = upcoming.filter((call) => call.is_overdue).length;
  const overdueTasks = myTasks.filter((task) => task.is_overdue).length;
  const silent = uncovered.filter(
    (client) =>
      client.days_since_last_call === null || client.days_since_last_call >= 30,
  ).length;

  return (
    <div className="portal-page space-y-5">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <Heading>Mi trabajo</Heading>

      <ModuleSummary
        period="Próximos 14 días"
        metrics={[
          {
            label: "Llamadas próximas",
            value: upcoming.length.toLocaleString("es-ES"),
            tone: overdueCalls > 0 ? "warn" : "default",
            hint:
              overdueCalls > 0
                ? `${overdueCalls} agendada${overdueCalls === 1 ? "" : "s"} sin cerrar`
                : undefined,
          },
          {
            label: "Mis tareas abiertas",
            value: myTasks.length.toLocaleString("es-ES"),
          },
          {
            label: "Mías vencidas",
            value: overdueTasks.toLocaleString("es-ES"),
            tone: overdueTasks > 0 ? "danger" : "success",
          },
          {
            label: "Clientes sin agendar",
            value: uncovered.length.toLocaleString("es-ES"),
            tone: silent > 0 ? "warn" : "default",
            hint:
              silent > 0
                ? `${silent} sin hablar hace 30 d o más`
                : undefined,
          },
        ]}
      />

      <section className="space-y-3">
        <p className={EYEBROW}>Próximas llamadas</p>
        {upcoming.length === 0 ? (
          <EmptyState
            title="Nada agendado en 14 días"
            hint="Registra una llamada desde el cliente para que aparezca aquí con su preparación."
          />
        ) : (
          upcoming.map((call) => (
            <CallPrepCard
              key={call.id}
              call={call}
              onOpenClient={() => setOrganizationId(call.organization_id)}
              onNoteSaved={load}
            />
          ))
        )}
      </section>

      <Card title="Mis tareas">
        {myTasks.length === 0 ? (
          <EmptyState
            title="Sin tareas internas abiertas"
            hint="Al aprobar un resumen de llamada, lo que quede a tu nombre aparece aquí."
          />
        ) : (
          <List>
            {myTasks.map((task) => (
              <List.Item
                key={task.id}
                className="task-lift flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="min-w-[15rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {["urgent", "high"].includes(task.priority) ? (
                      <Badge
                        tone={task.priority === "urgent" ? "danger" : "warn"}
                      >
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </Badge>
                    ) : null}
                    <p className="text-sm font-medium text-foreground">
                      {task.title}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    <span className="font-medium text-foreground">
                      {task.organization_name}
                    </span>
                  </p>
                </div>
                <span
                  className={[
                    "w-28 shrink-0 pt-0.5 text-right text-xs tabular-nums",
                    task.is_overdue ? "font-medium text-danger" : "text-muted",
                  ].join(" ")}
                >
                  {task.due_at
                    ? new Date(task.due_at).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "Sin fecha"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOrganizationId(task.organization_id)}
                >
                  Abrir cliente
                </Button>
              </List.Item>
            ))}
          </List>
        )}
      </Card>

      <Card title="Clientes sin llamada agendada">
        {uncovered.length === 0 ? (
          <EmptyState title="Toda la cartera tiene su próxima llamada agendada" />
        ) : (
          <List>
            {uncovered.map((client) => (
              <List.Item
                key={client.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {client.display_name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {client.days_since_last_call === null
                      ? "Nunca has tenido una llamada con este cliente"
                      : `Última llamada hace ${client.days_since_last_call} d`}
                    {client.my_open_tasks > 0
                      ? ` · ${client.my_open_tasks} tarea${client.my_open_tasks === 1 ? "" : "s"} tuya${client.my_open_tasks === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOrganizationId(client.id)}
                  >
                    Abrir cliente
                  </Button>
                  {/* La llamada se agenda donde viven las llamadas, ya con el
                      cliente activo. */}
                  <Button
                    size="sm"
                    onClick={() => {
                      setOrganizationId(client.id);
                      router.push("/llamadas");
                    }}
                  >
                    Agendar
                  </Button>
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}

export default function MyWorkPage() {
  return (
    <PortalShell title="Mi trabajo">
      {(bootstrap: BootstrapResponse) =>
        ["platform_admin", "consultant"].includes(
          bootstrap.profile.platform_role,
        ) ? (
          <MyWorkContent />
        ) : (
          <RedirectTo href="/tareas" />
        )
      }
    </PortalShell>
  );
}
