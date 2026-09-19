"use client";

import { useCallback, useEffect, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  List,
  LoadingBlock,
  Select,
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

  const load = useCallback(
    async (before?: string) => {
      const params = new URLSearchParams({ limit: "50" });
      if (area) params.set("action", area);
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
    [area],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;

  return (
    <Card
      title="Quién hizo qué"
      description="Cada acción con consecuencias queda registrada aquí: altas, cambios de rol, ediciones de cliente, conocimiento y configuración."
      actions={
        <Select
          className="w-52"
          aria-label="Filtrar por área"
          value={area}
          onChange={setArea}
          options={AUDIT_AREAS}
        />
      }
    >
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
                <List.Item
                  as="li"
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3"
                >
                  <Badge>{summary.area}</Badge>
                  <span className="min-w-0 flex-1 text-sm">
                    <strong>{entry.actor_name ?? "Alguien"}</strong>{" "}
                    {summary.verb}
                    {entry.organization_name ? (
                      <>
                        {" en "}
                        <strong>{entry.organization_name}</strong>
                      </>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {when(entry.created_at)}
                  </span>
                </List.Item>
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
