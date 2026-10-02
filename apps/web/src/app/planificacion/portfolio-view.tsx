"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useActiveOrganization } from "@/components/active-organization";
import { channelStyle } from "@/components/marketing-channel";
import { ModuleSummary } from "@/components/module-summary";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Heading,
  List,
  LoadingBlock,
  toast,
} from "@/components/ui";
import {
  clientsNeedingWork,
  triageClients,
  type PlanningItem,
  type TriageClient,
} from "./portfolio-triage";

/** Ventana del triaje: lo que se arrastra y lo que viene. */
const PAST_DAYS = 30;
const FUTURE_DAYS = 30;

const fmtDay = (value: string) =>
  new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });

function ClientRow({
  row,
  onOpen,
}: {
  row: TriageClient;
  onOpen: (organizationId: string) => void;
}) {
  return (
    <List.Item as="li" className="flex flex-wrap items-center gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {row.organizationName}
        </span>
        <span className="block text-xs text-muted">
          {row.next ? (
            <>
              Próxima: {row.next.title} · {fmtDay(row.next.starts_at)}
            </>
          ) : (
            "Sin próximas acciones en 30 días"
          )}
        </span>
      </span>

      {/* El motivo por el que este cliente está donde está. */}
      <Badge tone={row.tone}>{row.reason}</Badge>

      {row.blocked[0]?.blocked_reason ? (
        <span className="max-w-56 truncate text-xs text-muted">
          «{row.blocked[0].blocked_reason}»
        </span>
      ) : null}

      <span className="shrink-0 text-xs tabular-nums text-muted">
        {row.upcomingCount} en agenda
      </span>

      <Button
        size="sm"
        variant="ghost"
        onClick={() => onOpen(row.organizationId)}
      >
        Abrir
      </Button>
    </List.Item>
  );
}

/**
 * Vista general de Planificación: la cartera en orden de urgencia.
 *
 * Sustituye a un "Selecciona un cliente para empezar" que obligaba a entrar
 * tienda por tienda para descubrir cuál estaba parada. Aquí el consultor ve de
 * una pasada dónde tiene que meter horas, y entra directo.
 */
export function PlanningPortfolio() {
  const { setOrganizationId } = useActiveOrganization();
  const [rows, setRows] = useState<TriageClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const now = Date.now();
      const from = new Date(now - PAST_DAYS * 86_400_000).toISOString();
      const to = new Date(now + FUTURE_DAYS * 86_400_000).toISOString();
      try {
        const [agendaResponse, clientsResponse] = await Promise.all([
          apiFetch(
            `/v1/consultant/agenda?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&scope=all`,
          ),
          apiFetch("/v1/consultant/organizations"),
        ]);
        if (cancelled) return;
        if (!agendaResponse.ok) {
          setError(await readApiError(agendaResponse));
          return;
        }
        if (!clientsResponse.ok) {
          setError(await readApiError(clientsResponse));
          return;
        }
        const agenda = (await agendaResponse.json()) as {
          planning_items?: PlanningItem[];
        };
        const clients = (await clientsResponse.json()) as {
          organizations?: Array<{ id: string; display_name: string }>;
        };
        if (cancelled) return;
        setRows(
          triageClients(
            agenda.planning_items ?? [],
            clients.organizations ?? [],
            now,
          ),
        );
      } catch {
        if (!cancelled)
          setError("No se pudo cargar la cartera. Reintenta en un momento.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openClient(organizationId: string) {
    const row = rows.find((entry) => entry.organizationId === organizationId);
    setOrganizationId(organizationId);
    toast.success(`Ahora ves ${row?.organizationName ?? "el cliente"}`);
  }

  if (isLoading) return <LoadingBlock label="Cargando la cartera…" />;
  if (error) return <ErrorBlock>{error}</ErrorBlock>;

  const needWork = clientsNeedingWork(rows);
  const blocked = rows.filter((row) => row.blocked.length > 0);
  const overdue = rows.filter((row) => row.overdue.length > 0);
  const empty = rows.filter(
    (row) => row.upcomingCount === 0 && row.blocked.length === 0,
  );

  return (
    <div className="space-y-6">
      <Heading>Resumen de la cartera</Heading>
      {/* El titular cuenta CLIENTES, no acciones: "38 acciones vencidas" no
          dice a dónde ir; "4 clientes piden algo" sí. */}
      <ModuleSummary
        period={`Ventana de ${PAST_DAYS} días atrás a ${FUTURE_DAYS} adelante`}
        metrics={[
          {
            label: "Clientes que piden algo",
            value: `${needWork} de ${rows.length}`,
            tone: needWork > 0 ? "warn" : "success",
            hint: needWork === 0 ? "Toda la cartera al día" : undefined,
          },
          {
            label: "Con acciones paradas",
            value: blocked.length.toLocaleString("es-ES"),
            tone: blocked.length > 0 ? "danger" : "default",
            hint: blocked.length > 0 ? "Esperan una decisión" : undefined,
          },
          {
            label: "Con acciones vencidas",
            value: overdue.length.toLocaleString("es-ES"),
            tone: overdue.length > 0 ? "warn" : "default",
          },
          {
            label: "Sin nada planificado",
            value: empty.length.toLocaleString("es-ES"),
            tone: empty.length > 0 ? "warn" : "default",
            hint: empty.length > 0 ? "Agenda vacía a 30 días" : undefined,
          },
        ]}
      />

      <Card title="Dónde meter horas">
        {rows.length === 0 ? (
          <EmptyState
            title="Sin clientes asignados"
            hint="Cuando tengas clientes asignados, aquí verás cuál necesita atención."
          />
        ) : (
          <List as="ul">
            {rows.map((row) => (
              <ClientRow
                key={row.organizationId}
                row={row}
                onOpen={openClient}
              />
            ))}
          </List>
        )}
      </Card>

      {blocked.length > 0 ? (
        <Card title="Lo que está parado">
          <List as="ul">
            {blocked.flatMap((row) =>
              row.blocked.map((item) => (
                <List.Item
                  as="li"
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <span
                    aria-hidden
                    className={`h-8 w-1 shrink-0 ${channelStyle(item.channel).fill}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="block text-xs text-muted">
                      {row.organizationName} · desde el {fmtDay(item.starts_at)}
                    </span>
                  </span>
                  <span className="max-w-72 text-xs text-danger">
                    {item.blocked_reason}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openClient(row.organizationId)}
                  >
                    Abrir
                  </Button>
                </List.Item>
              )),
            )}
          </List>
        </Card>
      ) : null}

    </div>
  );
}
