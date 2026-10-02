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
  Select,
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

type ClientAgentRuntime = {
  agents: Array<{ code: string; name: string }>;
  active_agent_codes: string[];
  model_id: string;
  models: Array<{ id: string; provider: string; tier: string }>;
};

type AdminClientList = {
  clients: Array<{
    id: string;
    display_name: string;
    consultants: Array<{ user_id: string; full_name: string | null }>;
  }>;
};

export default function AdminAiAgentsPage() {
  const { data, error, isLoading, reload } = useCachedQuery<SettingsPayload>(
    "/v1/admin/ai-agent-refresh-limits",
  );
  const {
    data: clientData,
    error: clientError,
    isLoading: clientsLoading,
  } = useCachedQuery<AdminClientList>("/v1/admin/clients");
  const [organizationId, setOrganizationId] = useState("");
  const [consultantFilter, setConsultantFilter] = useState("");
  const [modelDraft, setModelDraft] = useState("gpt-6-luna");
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const runtimeQuery = organizationId
    ? `?organizationId=${encodeURIComponent(organizationId)}`
    : "";
  const {
    data: runtimeConfig,
    error: runtimeError,
    isLoading: runtimeLoading,
    reload: reloadRuntime,
  } = useCachedQuery<ClientAgentRuntime>(
    `/v1/admin/client-agent-runtime${runtimeQuery}`,
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingAgent, setSavingAgent] = useState<string | null>(null);
  const clients = clientData?.clients ?? [];
  const consultantOptions = [
    ...new Map(
      clients
        .flatMap((client) => client.consultants)
        .map((consultant) => [
          consultant.user_id,
          {
            value: consultant.user_id,
            label: consultant.full_name ?? consultant.user_id,
          },
        ]),
    ).values(),
  ];
  const filteredClients = consultantFilter
    ? clients.filter((client) =>
        client.consultants.some(
          (consultant) => consultant.user_id === consultantFilter,
        ),
      )
    : clients;

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

  useEffect(() => {
    if (!clients.length) {
      setOrganizationId("");
      return;
    }
    if (!filteredClients.some((client) => client.id === organizationId)) {
      setOrganizationId(filteredClients[0]?.id ?? "");
    }
  }, [clients, filteredClients, organizationId]);

  useEffect(() => {
    if (runtimeConfig) setModelDraft(runtimeConfig.model_id);
  }, [runtimeConfig]);

  async function saveRuntimeConfig(activeAgentCodes: string[]) {
    if (!organizationId) return;
    setRuntimeSaving(true);
    try {
      const response = await apiFetch("/v1/admin/client-agent-runtime", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: organizationId,
          active_agent_codes: activeAgentCodes,
          model_id: modelDraft,
        }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(
        activeAgentCodes.length
          ? "Configuración de agentes guardada para este cliente."
          : "Todos los agentes de este cliente están desactivados.",
      );
      reloadRuntime();
    } catch {
      toast.danger("No se pudo guardar la configuración del cliente.");
    } finally {
      setRuntimeSaving(false);
    }
  }

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
        <div className="grid gap-6">
          <Card
            kicker="Activación por cliente"
            title="Agente y modelo de ejecución"
            description="Los agentes activos del catálogo se habilitan por defecto. Solo un platform admin puede configurar cada cliente y desactivarlos durante las pruebas."
          >
            {clientsLoading && !clientData ? (
              <p className="text-sm text-muted">Cargando clientes...</p>
            ) : clientError && !clientData ? (
              <ErrorBlock>{clientError}</ErrorBlock>
            ) : !clients.length ? (
              <p className="text-sm text-muted">
                Todavía no hay clientes para configurar.
              </p>
            ) : (
              <div className="grid gap-5">
                <p className="text-sm text-muted">
                  La configuración se guarda en la organización cliente. Puedes
                  localizarla por cliente o filtrar la lista por su consultor
                  asignado.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-muted">
                    Consultor asignado (filtro)
                    <Select
                      className="mt-1"
                      aria-label="Filtrar clientes por consultor"
                      value={consultantFilter}
                      onChange={setConsultantFilter}
                      options={[
                        { value: "", label: "Todos los consultores" },
                        ...consultantOptions,
                      ]}
                    />
                  </label>
                  <label className="text-sm text-muted">
                    Cliente exacto
                    <Select
                      className="mt-1"
                      aria-label="Cliente para configurar agentes"
                      value={organizationId}
                      onChange={setOrganizationId}
                      options={filteredClients.map((client) => {
                        const consultantNames = client.consultants
                          .map(
                            (consultant) =>
                              consultant.full_name ?? consultant.user_id,
                          )
                          .join(", ");
                        return {
                          value: client.id,
                          label: consultantNames
                            ? `${client.display_name} · ${consultantNames}`
                            : `${client.display_name} · sin consultor`,
                        };
                      })}
                    />
                  </label>
                </div>
                {runtimeError ? (
                  <ErrorBlock>{runtimeError}</ErrorBlock>
                ) : runtimeLoading || !runtimeConfig ? (
                  <p className="text-sm text-muted">Cargando agentes...</p>
                ) : (
                  <>
                    <div className="grid gap-2 sm:max-w-xl">
                      <label className="text-sm text-muted">
                        Modelo para los agentes activos del cliente
                        <Select
                          className="mt-1"
                          aria-label="Modelo de IA del cliente"
                          value={modelDraft}
                          onChange={setModelDraft}
                          options={runtimeConfig.models.map((model) => ({
                            value: model.id,
                            label: `${model.provider === "openai" ? "OpenAI" : "Claude"} · ${model.tier} · ${model.id}`,
                          }))}
                        />
                      </label>
                      <p className="text-xs leading-5 text-muted">
                        El proveedor elegido debe tener su API key configurada
                        en el runtime. La selección se aplica a todos los
                        agentes activos de este cliente.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={
                          runtimeSaving || modelDraft === runtimeConfig.model_id
                        }
                        onClick={() =>
                          void saveRuntimeConfig(
                            runtimeConfig.active_agent_codes,
                          )
                        }
                      >
                        {runtimeSaving ? "Guardando..." : "Guardar modelo"}
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-separator bg-surface-subtle p-4">
                      <div>
                        <p className="font-medium text-foreground">
                          Activación de agentes
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {runtimeConfig.active_agent_codes.length} de{" "}
                          {runtimeConfig.agents.length} agentes activos para
                          este cliente.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={
                            runtimeSaving ||
                            runtimeConfig.active_agent_codes.length ===
                              runtimeConfig.agents.length
                          }
                          onClick={() =>
                            void saveRuntimeConfig(
                              runtimeConfig.agents.map((agent) => agent.code),
                            )
                          }
                        >
                          {runtimeSaving ? "Guardando..." : "Activar todos"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={
                            runtimeSaving ||
                            runtimeConfig.active_agent_codes.length === 0
                          }
                          onClick={() => void saveRuntimeConfig([])}
                        >
                          Desactivar todos
                        </Button>
                      </div>
                    </div>
                    <ul className="grid gap-3">
                      {runtimeConfig.agents.map((agent) => {
                        const active =
                          runtimeConfig.active_agent_codes.includes(agent.code);
                        return (
                          <li
                            key={agent.code}
                            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-separator bg-surface px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                {agent.name}
                              </p>
                              <p className="mt-1 truncate font-mono text-xs text-muted">
                                {agent.code}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span
                                className={`text-sm font-medium ${active ? "text-foreground" : "text-muted"}`}
                              >
                                {runtimeSaving
                                  ? "Guardando..."
                                  : active
                                    ? "Activo"
                                    : "Desactivado"}
                              </span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={active}
                                aria-label={`${active ? "Desactivar" : "Activar"} agente ${agent.name}`}
                                disabled={runtimeSaving}
                                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${active ? "bg-accent" : "bg-separator"}`}
                                onClick={() =>
                                  void saveRuntimeConfig(
                                    active
                                      ? runtimeConfig.active_agent_codes.filter(
                                          (code) => code !== agent.code,
                                        )
                                      : [
                                          ...runtimeConfig.active_agent_codes,
                                          agent.code,
                                        ],
                                  )
                                }
                              >
                                <span
                                  aria-hidden="true"
                                  className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${active ? "translate-x-6" : "translate-x-1"}`}
                                />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}
          </Card>
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
              <ErrorBlock>
                {error ?? "No se pudo cargar la configuración."}
              </ErrorBlock>
            ) : data.agents.length ? (
              <ul className="divide-y divide-separator">
                {data.agents.map((agent) => (
                  <li
                    key={agent.code}
                    className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {agent.name}
                      </p>
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
                        value={
                          drafts[agent.code] ?? agent.daily_manual_refresh_limit
                        }
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
        </div>
      )}
    </PlatformAdminShell>
  );
}
