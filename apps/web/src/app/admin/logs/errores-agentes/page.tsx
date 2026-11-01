"use client";

import { useCallback, useEffect, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
  LoadingBlock,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
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
    <Card>
      <CardHeader>
        <CardTitle>Agentes IA con error</CardTitle>
        <CardDescription>Ejecuciones de agente fallidas o con salida rechazada, de toda la plataforma.</CardDescription>
        <CardAction><div className="flex items-center gap-2">
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
        </div></CardAction>
      </CardHeader>
      <CardContent>
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
              <Item key={item.id} size="sm" render={<li />}>
                <ItemMedia>
                  <Badge tone="warn">agente</Badge>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {item.source}
                    {item.organization_name ? ` · ${item.organization_name}` : ""}
                  </ItemTitle>
                  {item.message ? (
                    <ItemDescription className="break-words">
                      {item.message.slice(0, 300)}
                    </ItemDescription>
                  ) : null}
                </ItemContent>
                <ItemActions>
                <span className="text-sm text-muted">
                  {when(item.occurred_at)}
                </span>
                </ItemActions>
              </Item>
            ))}
          </List>
        )}
      </CardContent>
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
