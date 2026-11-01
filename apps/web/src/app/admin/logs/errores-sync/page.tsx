"use client";

import { useCallback, useEffect, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  List,
  LoadingBlock,
  toast,
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

// /admin/logs/errores-sync: pantalla propia (antes mitad de la pestaña
// "Errores" de /admin/logs). Solo sincronizaciones caidas -- los agentes IA
// van en /admin/logs/errores-agentes, se arreglan de forma distinta.

type SyncError = {
  id: string;
  kind: "sync";
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

function SyncErrorsPanel() {
  const [errors, setErrors] = useState<SyncError[] | null>(null);
  const [days, setDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

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
        errors: Array<SyncError | { kind: "agent" }>;
      };
      setErrors(
        payload.errors.filter((item): item is SyncError => item.kind === "sync"),
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

  async function retry(runId: string) {
    setRetrying(runId);
    try {
      const response = await apiFetch(`/v1/admin/sync-errors/${runId}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Sincronización relanzada.");
      void load();
    } catch {
      toast.danger("No se pudo relanzar el sync por un error de red.");
    } finally {
      setRetrying(null);
    }
  }

  if (error) return <ErrorBlock>{error}</ErrorBlock>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sincronizaciones caídas</CardTitle>
        <CardDescription>Sincronizaciones fallidas de Shopify, Meta Ads y Klaviyo, de toda la plataforma.</CardDescription>
        <CardAction><div className="flex items-center gap-2">
          {errors && errors.length > 0 ? (
            <Badge tone="danger">{errors.length}</Badge>
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
            hint="Ninguna sincronización fallida en los últimos días."
          />
        ) : (
          <List as="ul">
            {errors.map((item) => (
              <Item key={item.id} size="sm" render={<li />}>
                <ItemMedia>
                  <Badge tone="danger">sync</Badge>
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
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={retrying === item.id}
                  onClick={() => void retry(item.id)}
                >
                  {retrying === item.id ? "Relanzando…" : "Reintentar"}
                </Button>
                </ItemActions>
              </Item>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminSyncErrorsPage() {
  return (
    <PlatformAdminShell title="Errores de sincronización">
      {() => (
        <div className="portal-page space-y-5 sm:space-y-6">
          <SyncErrorsPanel />
        </div>
      )}
    </PlatformAdminShell>
  );
}
