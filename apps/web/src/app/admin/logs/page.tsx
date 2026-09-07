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
  Field,
  Input,
  List,
  LoadingBlock,
  Select,
  Tabs,
} from "@/components/ui";
import { AUDIT_AREAS, auditSummary, errorTone } from "./audit-entry";

/**
 * /admin/logs: era `AdminComingSoon` ("Área pendiente de construir").
 *
 * `audit_logs` se escribe desde 61 puntos del código y no tenía una sola
 * lectura: el registro de quién hizo qué llevaba acumulándose desde julio sin
 * que nadie pudiera verlo. Los errores existían repartidos (los syncs fallidos
 * por integración, los agentes en observabilidad); aquí responden juntos a
 * "qué se ha roto".
 */

type AuditEntry = {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
  organization_name: string | null;
  actor_name: string | null;
  new_data: unknown;
};

type PlatformError = {
  id: string;
  kind: "sync" | "agent";
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
        // Al paginar se acumula; al cambiar de filtro se reemplaza.
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
    // Recarga desde cero cada vez que cambia el filtro.
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

function ErrorsPanel() {
  const [errors, setErrors] = useState<PlatformError[] | null>(null);
  const [counts, setCounts] = useState({ sync: 0, agent: 0 });
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
        errors: PlatformError[];
        counts: { sync: number; agent: number };
      };
      setErrors(payload.errors);
      setCounts(payload.counts);
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
      title="Qué se ha roto"
      description="Sincronizaciones fallidas y ejecuciones de agente con error, de toda la plataforma."
      actions={
        <div className="flex items-center gap-2">
          {errors && errors.length > 0 ? (
            <>
              <Badge tone="danger">{counts.sync} syncs</Badge>
              <Badge tone="warn">{counts.agent} agentes</Badge>
            </>
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
          hint="Ni sincronizaciones fallidas ni agentes con error en los últimos días."
        />
      ) : (
        <List as="ul">
          {errors.map((item) => (
            <List.Item
              as="li"
              key={`${item.kind}:${item.id}`}
              className="flex flex-wrap items-start gap-3 py-3"
            >
              <Badge tone={errorTone(item.kind)}>
                {item.kind === "sync" ? "sync" : "agente"}
              </Badge>
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

function LogsPanel() {
  const [tab, setTab] = useState<"auditoria" | "errores">("auditoria");

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <Tabs
        value={tab}
        onChange={(value) => setTab(value as "auditoria" | "errores")}
        items={[
          { value: "auditoria", label: "Auditoría" },
          { value: "errores", label: "Errores" },
        ]}
      />
      {tab === "auditoria" ? <AuditPanel /> : <ErrorsPanel />}
    </div>
  );
}

export default function AdminLogsPage() {
  return (
    <PlatformAdminShell title="Logs">
      {() => <LogsPanel />}
    </PlatformAdminShell>
  );
}
