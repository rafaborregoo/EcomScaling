"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBlock,
  Link,
  List,
  LoadingBlock,
  Select,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui";
import { AUDIT_AREAS, auditSummary } from "../audit-entry";

// /admin/logs/auditoria: pantalla propia (antes pestaña de /admin/logs).
// Separada de los errores porque responden a preguntas distintas: "quien hizo
// que" vs "que se ha roto".

type AuditEntry = {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
  organization_name: string | null;
  actor_name: string | null;
  new_data: unknown;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // La ficha de /admin/clientes enlaza aqui ya filtrado por su cliente.
  const organizationId = useSearchParams().get("organizationId") ?? "";

  const load = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams({ limit: "50" });
      if (area) params.set("action", area);
      if (organizationId) params.set("organizationId", organizationId);
      if (before) params.set("before", before);
      try {
        const response = await apiFetch(`/v1/admin/audit-log?${params}`);
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          entries: AuditEntry[];
          next_before: string | null;
        };
        setEntries((current) =>
          before ? [...(current ?? []), ...payload.entries] : payload.entries,
        );
        setNextBefore(payload.next_before);
        setError(null);
      } catch {
        setError("No se pudo cargar la auditoría por un error de red.");
      }
    },
    [area, organizationId],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quién hizo qué</CardTitle>
        <CardDescription>{organizationId
          ? `Solo las acciones sobre ${entries?.[0]?.organization_name ?? "este cliente"}.`
          : "Cada acción con consecuencias queda registrada aquí: altas, cambios de rol, ediciones de cliente, conocimiento y configuración."}</CardDescription>
        <CardAction><div className="flex items-center gap-3">
          {organizationId ? (
            <Link href="/admin/logs/auditoria">Ver todos los clientes</Link>
          ) : null}
          <Select
            className="w-52"
            aria-label="Filtrar por área"
            value={area}
            onChange={setArea}
            options={AUDIT_AREAS}
          />
        </div></CardAction>
      </CardHeader>
      <CardContent>
        {entries === null ? (
          <LoadingBlock label="Cargando auditoría…" />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Sin registros"
            hint={
              area
                ? "No hay acciones de esa área todavía."
                : "Cuando alguien haga algo con consecuencias, aparecerá aquí."
            }
          />
        ) : (
          <>
            <List as="ul">
              {entries.map((entry) => {
                const summary = auditSummary(entry.action);
                return (
                  <Item key={entry.id} size="sm" render={<li />}>
                    <ItemMedia>
                      <Badge>{summary.area}</Badge>
                    </ItemMedia>
                    <ItemContent>
                    <ItemTitle className="block font-normal">
                      <strong>{entry.actor_name ?? "Alguien"}</strong>{" "}
                      {summary.verb}
                      {entry.organization_name ? (
                        <>
                          {" en "}
                          <strong>{entry.organization_name}</strong>
                        </>
                      ) : null}
                    </ItemTitle>
                    </ItemContent>
                    <ItemDescription>
                      {when(entry.created_at)}
                    </ItemDescription>
                  </Item>
                );
              })}
            </List>
            {nextBefore ? (
              <Button
                className="mt-4"
                variant="secondary"
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  void load(nextBefore).finally(() => setLoadingMore(false));
                }}
              >
                {loadingMore ? "Cargando…" : "Cargar más"}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminAuditLogPage() {
  return (
    <PlatformAdminShell title="Auditoría">
      {() => (
        <div className="portal-page space-y-5 sm:space-y-6">
          <AuditPanel />
        </div>
      )}
    </PlatformAdminShell>
  );
}
