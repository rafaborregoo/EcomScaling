"use client";

import { useEffect, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  AsyncState,
  Button,
  Card,
  ErrorBlock,
  Input,
  toast,
} from "@/components/ui";

type AgentRefreshLimit = {
  code: string;
  name: string;
  daily_manual_refresh_limit: number;
  updated_at: string | null;
};

type SettingsPayload = {
  default_daily_limit: number;
  agents: AgentRefreshLimit[];
};

export default function AdminAiAgentsPage() {
  const { data, error, isLoading, reload } =
    useCachedQuery<SettingsPayload>("/v1/admin/ai-agent-refresh-limits");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingAgent, setSavingAgent] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDrafts((current) => {
      const next = { ...current };
      for (const agent of data.agents) {
        if (next[agent.code] === undefined) {
          next[agent.code] = String(agent.daily_manual_refresh_limit);
        }
      }
      return next;
    });
  }, [data]);

  async function saveLimit(agent: AgentRefreshLimit) {
    const value = Number(drafts[agent.code]);
    if (!Number.isInteger(value) || value < 1 || value > 10000) {
      toast.danger("Indica un límite entero entre 1 y 10000.");
      return;
    }

    setSavingAgent(agent.code);
    try {
      const response = await apiFetch("/v1/admin/ai-agent-refresh-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_code: agent.code,
          daily_manual_refresh_limit: value,
        }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(`Límite actualizado para ${agent.name}.`);
      reload();
    } catch {
      toast.danger("No se pudo guardar el límite. Reintenta.");
    } finally {
      setSavingAgent(null);
    }
  }

  return (
    <PlatformAdminShell title="Configuración de IA">
      {() => (
        <Card
          kicker="Límites por agente"
          title="Actualizaciones manuales"
          description="Cada agente tiene un cupo diario independiente por organización. Las actualizaciones manuales no se suman entre agentes."
        >
        <p className="mb-4 rounded-md border border-accent bg-accent/5 p-3 text-sm leading-6 text-muted">
          El valor inicial para agentes sin un ajuste propio es de{" "}
          <span className="font-semibold text-foreground">
            {data?.default_daily_limit.toLocaleString("es-ES") ?? 1000}
          </span>{" "}
          actualizaciones al día. Los presupuestos de coste de IA siguen
          funcionando de forma independiente.
        </p>

        {isLoading ? (
          <AsyncState status="loading" loadingLabel="Cargando agentes..." />
        ) : error || !data ? (
          <ErrorBlock>{error ?? "No se pudo cargar la configuración."}</ErrorBlock>
        ) : data.agents.length ? (
          <ul className="divide-y divide-separator">
            {data.agents.map((agent) => (
              <li
                key={agent.code}
                className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{agent.name}</p>
                  <p className="mt-1 truncate font-mono text-xs text-muted">
                    {agent.code}
                  </p>
                </div>
                <label className="text-xs text-muted">
                  Límite por organización / día
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    value={drafts[agent.code] ?? agent.daily_manual_refresh_limit}
                    aria-label={`Límite diario para ${agent.name}`}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [agent.code]: event.target.value,
                      }))
                    }
                  />
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={savingAgent !== null}
                  onClick={() => saveLimit(agent)}
                >
                  {savingAgent === agent.code ? "Guardando..." : "Guardar"}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <AsyncState
            status="empty"
            emptyTitle="No hay agentes activos"
            emptyHint="Cuando haya agentes activos aparecerán aquí."
          />
        )}
        </Card>
      )}
    </PlatformAdminShell>
  );
}
