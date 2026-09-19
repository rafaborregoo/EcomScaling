"use client";

import { useCallback, useEffect, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Card,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
  LoadingBlock,
} from "@/components/ui";

// /admin/logs/errores-agentes: pantalla propia (antes la otra mitad de la
// pestaña "Errores" de /admin/logs). Sin boton de reintento todavia -- a
// diferencia de un sync, relanzar un agente no tiene un trigger reutilizable
// hoy; se anade cuando haga falta de verdad.

type AgentError = {
  id: string;
  kind: "agent";
  source: string;
  organization_name: string | null;
  message: string | null;
  occurred_at: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function AgentErrorsPanel() {
  const [errors, setErrors] = useState<AgentError[] | null>(null);
  const [days, setDays] = useState("7");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch(
        `/v1/admin/platform-errors?days=${days}&limit=100`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const payload = (await response.json()) as {
        errors: Array<AgentError | { kind: "sync" }>;
      };
      setErrors(
        payload.errors.filter(
          (item): item is AgentError => item.kind === "agent",
        ),
      );
      setError(null);
    } catch {
      setError("No se pudieron cargar los errores por un error de red.");
    }
  }, [days]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;

  return (
    <Card
      title="Agentes IA con error"
      description="Ejecuciones de agente fallidas o con salida rechazada, de toda la plataforma."
      actions={
        <div className="flex items-center gap-2">
          {errors && errors.length > 0 ? (
            <Badge tone="warn">{errors.length}</Badge>
          ) : null}
          <Field label="Días">
            <Input
              className="mt-1 w-20"
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </Field>
        </div>
      }
    >
      {errors === null ? (
        <LoadingBlock label="Buscando fallos…" />
      ) : errors.length === 0 ? (
        <EmptyState
          title="Nada roto en esta ventana"
          hint="Ningún agente con error en los últimos días."
        />
      ) : (
        <List as="ul">
          {errors.map((item) => (
            <List.Item
              as="li"
              key={item.id}
              className="flex flex-wrap items-start gap-3 py-3"
            >
              <Badge tone="warn">agente</Badge>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {item.source}
                  {item.organization_name ? ` · ${item.organization_name}` : ""}
                </span>
                {item.message ? (
                  <span className="mt-0.5 block break-words text-xs text-muted">
                    {item.message.slice(0, 300)}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {when(item.occurred_at)}
              </span>
            </List.Item>
          ))}
        </List>
      )}
    </Card>
  );
}

export default function AdminAgentErrorsPage() {
  return (
    <PlatformAdminShell title="Errores de agentes IA">
      {() => (
        <div className="portal-page space-y-5 sm:space-y-6">
          <AgentErrorsPanel />
        </div>
      )}
    </PlatformAdminShell>
  );
}
