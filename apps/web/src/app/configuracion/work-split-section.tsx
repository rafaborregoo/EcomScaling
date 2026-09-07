"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  Input,
  List,
  LoadingBlock,
  toast,
} from "@/components/ui";
import { toPercentages } from "./work-split";

/**
 * Quién se encarga de qué en cada cliente compartido.
 *
 * Sin esto, dos consultores sobre la misma tienda ven la misma lista de tareas
 * y ninguna es de nadie: `tasks.assigned_to` existía y no la escribía nadie.
 * El peso decide a quién se le asignan las tareas que nacen solas (alertas,
 * IA); el principal es el interlocutor que ve el cliente.
 */

type Consultant = {
  user_id: string;
  full_name: string | null;
  is_primary: boolean;
  work_share: number;
};

type Client = {
  organization_id: string;
  display_name: string;
  consultants: Consultant[];
};

type Payload = {
  clients: Client[];
  solo_clients: number;
  workload: Array<{
    user_id: string;
    full_name: string | null;
    open_tasks: number;
  }>;
};

type Draft = { shares: Record<string, number>; primaryUserId: string };

function draftFor(client: Client): Draft {
  return {
    shares: Object.fromEntries(
      client.consultants.map((consultant) => [
        consultant.user_id,
        consultant.work_share,
      ]),
    ),
    primaryUserId:
      client.consultants.find((consultant) => consultant.is_primary)?.user_id ??
      "",
  };
}

export function WorkSplitSection() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/v1/consultant/work-split");
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const data = (await response.json()) as Payload;
      setPayload(data);
      setDrafts(
        Object.fromEntries(
          data.clients.map((client) => [
            client.organization_id,
            draftFor(client),
          ]),
        ),
      );
      setError(null);
    } catch {
      setError("No se pudo cargar el reparto de trabajo.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const allOrgIds = useMemo(
    () => (payload?.clients ?? []).map((client) => client.organization_id),
    [payload],
  );

  function patchDraft(organizationId: string, patch: Partial<Draft>) {
    setDrafts((current) => {
      const draft = current[organizationId];
      if (!draft) return current;
      return { ...current, [organizationId]: { ...draft, ...patch } };
    });
  }

  async function save(client: Client, organizationIds: string[]) {
    const draft = drafts[client.organization_id];
    if (!draft) return;

    setSaving(client.organization_id);
    try {
      const response = await apiFetch("/v1/consultant/work-split", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_ids: organizationIds,
          shares: client.consultants.map((consultant) => ({
            user_id: consultant.user_id,
            work_share: draft.shares[consultant.user_id] ?? 0,
          })),
          ...(draft.primaryUserId
            ? { primary_user_id: draft.primaryUserId }
            : {}),
        }),
      });

      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }

      const result = (await response.json()) as {
        updated: number;
        skipped: number;
      };
      toast.success(
        result.updated === 1
          ? "Reparto guardado"
          : `Reparto aplicado a ${result.updated} clientes`,
        // Se saltan las tiendas donde ese reparto no dejaria a nadie recibiendo
        // tareas, normalmente porque el socio no esta asignado a ellas.
        result.skipped > 0
          ? {
              description: `${result.skipped} sin cambios: ahí no está asignado todo el equipo del reparto.`,
            }
          : undefined,
      );
      await load();
    } catch {
      toast.danger("No se pudo guardar por un error de red.");
    } finally {
      setSaving(null);
    }
  }

  if (error) {
    return (
      <Card title="Reparto de trabajo">
        <ErrorBlock>{error}</ErrorBlock>
      </Card>
    );
  }

  if (payload === null) {
    return (
      <Card title="Reparto de trabajo">
        <LoadingBlock label="Cargando…" />
      </Card>
    );
  }

  if (payload.clients.length === 0) {
    return (
      <Card
        title="Reparto de trabajo"
        description="Cuando compartas un cliente con otro consultor, aquí decides a quién se le asigna cada tarea."
      >
        <EmptyState
          title="No compartes ningún cliente"
          hint={
            payload.solo_clients > 0
              ? `Llevas tus ${payload.solo_clients} clientes tú solo: todas las tareas son tuyas.`
              : "Todavía no tienes clientes asignados."
          }
        />
      </Card>
    );
  }

  return (
    <Card
      title="Reparto de trabajo"
      description="Las tareas que nacen solas (alertas, IA) se asignan según este reparto. El principal es el interlocutor que ve el cliente."
      actions={
        <div className="flex flex-wrap gap-2">
          {payload.workload.map((entry) => (
            <Badge key={entry.user_id} tone="neutral">
              {entry.full_name ?? "Sin nombre"}: {entry.open_tasks} abiertas
            </Badge>
          ))}
        </div>
      }
    >
      <List as="ul">
        {payload.clients.map((client) => {
          const draft = drafts[client.organization_id];
          if (!draft) return null;

          const percentages = toPercentages(
            client.consultants.map(
              (consultant) => draft.shares[consultant.user_id] ?? 0,
            ),
          );
          const busy = saving === client.organization_id;

          return (
            <List.Item
              as="li"
              key={client.organization_id}
              className="flex flex-col gap-3 py-4"
            >
              <span className="text-sm font-medium">{client.display_name}</span>

              {client.consultants.map((consultant, index) => (
                <div
                  key={consultant.user_id}
                  className="flex flex-wrap items-center gap-3"
                >
                  <span className="min-w-40 flex-1 truncate text-sm">
                    {consultant.full_name ?? "Sin nombre"}
                  </span>

                  {draft.primaryUserId === consultant.user_id ? (
                    <Badge tone="brand">Principal</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        patchDraft(client.organization_id, {
                          primaryUserId: consultant.user_id,
                        })
                      }
                    >
                      Hacer principal
                    </Button>
                  )}

                  <Input
                    className="w-20"
                    type="number"
                    min={0}
                    max={100}
                    value={String(draft.shares[consultant.user_id] ?? 0)}
                    onChange={(event) =>
                      patchDraft(client.organization_id, {
                        shares: {
                          ...draft.shares,
                          [consultant.user_id]: Math.max(
                            0,
                            Math.min(
                              100,
                              Math.round(Number(event.target.value) || 0),
                            ),
                          ),
                        },
                      })
                    }
                  />
                  <span className="w-28 text-xs text-muted">
                    {percentages[index] ?? 0}% de las tareas
                  </span>
                </div>
              ))}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    patchDraft(client.organization_id, {
                      shares: Object.fromEntries(
                        client.consultants.map((consultant) => [
                          consultant.user_id,
                          100,
                        ]),
                      ),
                    })
                  }
                >
                  A partes iguales
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void save(client, [client.organization_id])}
                >
                  {busy ? "Guardando…" : "Guardar"}
                </Button>
                {allOrgIds.length > 1 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void save(client, allOrgIds)}
                  >
                    Aplicar a mis {allOrgIds.length} clientes compartidos
                  </Button>
                ) : null}
              </div>
            </List.Item>
          );
        })}
      </List>

      {payload.solo_clients > 0 ? (
        <p className="mt-4 text-xs text-muted">
          Los otros {payload.solo_clients} clientes los llevas tú solo: sus
          tareas se te asignan siempre.
        </p>
      ) : null}
    </Card>
  );
}
