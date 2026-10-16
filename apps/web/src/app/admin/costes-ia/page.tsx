"use client";

import { useMemo, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  Card,
  ConfirmDialog,
  ErrorBlock,
  Input,
  Select,
  Table,
  toast,
  type TableColumnDef,
} from "@/components/ui";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { DAYS_PER_MONTH, costPerRun, totals, type SimModel, type SimProfile } from "./cost-sim";

type Agent = {
  code: string;
  name: string;
  default_model: string;
  model_configurable: boolean;
  scheduled: boolean;
  default_runs_per_day: number;
  max_runs_per_day: number | null;
  cadence: string;
  saved: { runs_per_day: number | null; model: string | null };
  profile: SimProfile & { samples: number; source: "medido" | "estimado" | "sin_datos" };
};

type CostModel = {
  models: Array<SimModel & { provider: string }>;
  agents: Agent[];
  caps: { org_daily_run_cap: number; platform_runs_per_tick: number; ticks_per_day: number };
  prices_verified_on: string;
};

type Draft = { runs: Record<string, number>; models: Record<string, string> };

const n = (value: number) => Math.round(value).toLocaleString("es-ES");
const usd = (value: number) => `$${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd4 = (value: number) => `$${value.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const mtok = (value: number) => `${(value / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M`;

/** Lo que está aplicado hoy: lo guardado o, si no hay nada, el diseño. */
const appliedRuns = (agent: Agent) => agent.saved.runs_per_day ?? agent.default_runs_per_day;
const appliedModel = (agent: Agent) => agent.saved.model ?? agent.default_model;

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function Simulator({ data, reload }: { data: CostModel; reload: () => void }) {
  const [draft, setDraft] = useState<Draft>({ runs: {}, models: {} });
  const [clients, setClients] = useState(1);
  const [confirming, setConfirming] = useState(false);

  const modelById = useMemo(() => new Map(data.models.map((model) => [model.id, model])), [data.models]);
  const rows = data.agents.map((agent) => {
    const model = modelById.get(draft.models[agent.code] ?? appliedModel(agent)) ?? data.models[0]!;
    const runsPerDay = draft.runs[agent.code] ?? appliedRuns(agent);
    const changed = (agent.scheduled && runsPerDay !== appliedRuns(agent)) || (agent.model_configurable && model.id !== appliedModel(agent));
    return { ...agent, id: agent.code, model, runsPerDay, changed, runCost: costPerRun(agent.profile, model) };
  });
  const pending = rows.filter((row) => row.changed);

  const sim = totals(rows.map((row) => ({ code: row.code, profile: row.profile, model: row.model, runsPerDay: row.runsPerDay })));
  const scheduledPerDay = rows.filter((row) => row.scheduled).reduce((sum, row) => sum + row.runsPerDay, 0);
  const allOn = (model: SimModel) =>
    totals(rows.map((row) => ({ code: row.code, profile: row.profile, model: row.model_configurable ? model : row.model, runsPerDay: row.runsPerDay }))).perMonth;
  const setRuns = (code: string, value: number) => setDraft((d) => ({ ...d, runs: { ...d.runs, [code]: Math.max(0, value || 0) } }));
  const setModel = (code: string, value: string) => setDraft((d) => ({ ...d, models: { ...d.models, [code]: value } }));
  const setAllModels = (id: string) =>
    setDraft((d) => ({ ...d, models: Object.fromEntries(data.agents.filter((agent) => agent.model_configurable).map((agent) => [agent.code, id])) }));
  const toDesign = () =>
    setDraft({
      runs: Object.fromEntries(data.agents.map((agent) => [agent.code, agent.default_runs_per_day])),
      models: Object.fromEntries(data.agents.map((agent) => [agent.code, agent.default_model])),
    });
  const modelOptions = data.models.map((model) => ({ value: model.id, label: model.label }));
  const platformCap = data.caps.platform_runs_per_tick * data.caps.ticks_per_day;

  async function apply() {
    // Se guarda solo lo que difiere del diseño; lo que vuelve al diseño se borra.
    const settings = rows.map((row) => ({
      agent_code: row.code,
      runs_per_day: row.scheduled && row.runsPerDay !== row.default_runs_per_day ? row.runsPerDay : null,
      model: row.model_configurable && row.model.id !== row.default_model ? row.model.id : null,
    }));
    const response = await apiFetch("/v1/admin/ai-agent-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    if (!response.ok) throw new Error(await readApiError(response));
    toast.success("Aplicado. El orquestador y los agentes lo usan desde la próxima ejecución.");
    setDraft({ runs: {}, models: {} });
    reload();
  }

  const columns: TableColumnDef<(typeof rows)[number]>[] = [
    {
      key: "name",
      label: "Agente",
      render: (row) => (
        <span className="flex flex-col gap-1">
          <span className="font-medium">{row.name}</span>
          <span className="font-mono text-xs text-muted">{row.code}</span>
          {row.changed ? <Badge tone="warn">Sin aplicar</Badge> : null}
        </span>
      ),
    },
    {
      key: "model",
      label: "Modelo",
      render: (row) =>
        row.model_configurable ? (
          <Select aria-label={`Modelo de ${row.name}`} value={row.model.id} onChange={(value) => setModel(row.code, value)} options={modelOptions} />
        ) : (
          <span className="text-xs text-muted">{row.model.label} · lo decide el plan</span>
        ),
    },
    {
      key: "profile",
      label: "Tokens por ejecución",
      render: (row) => (
        <span className="flex flex-col text-xs tabular-nums">
          <span>
            {n(row.profile.input_total)} entrada ({n(row.profile.cache_read)} caché)
          </span>
          <span>{n(row.profile.output)} salida</span>
          <Badge tone={row.profile.source === "medido" ? "success" : "neutral"}>
            {row.profile.source === "medido" ? `medido · ${row.profile.samples}` : row.profile.source === "estimado" ? "estimado" : "sin datos"}
          </Badge>
        </span>
      ),
    },
    {
      key: "runsPerDay",
      label: "Ejecuciones/día",
      render: (row) => (
        <span className="flex flex-col gap-1">
          <Input
            type="number"
            min={0}
            step={0.1}
            aria-label={`Ejecuciones al día de ${row.name}`}
            value={String(row.runsPerDay)}
            onChange={(event) => setRuns(row.code, Number(event.target.value))}
            className="w-24"
          />
          <span className="text-xs text-muted">{row.scheduled ? row.cadence : `${row.cadence} · solo simulación`}</span>
          {row.scheduled && row.runsPerDay === 0 ? <span className="text-xs text-muted">No se programa; se puede lanzar a mano.</span> : null}
          {row.max_runs_per_day !== null && row.runsPerDay > row.max_runs_per_day ? (
            <span className="text-xs text-warning">Con 2 pasadas al día no pasará de ≈{row.max_runs_per_day}.</span>
          ) : null}
        </span>
      ),
    },
    { key: "runCost", label: "Coste/ejec.", render: (row) => usd4(row.runCost) },
    { key: "day", label: "Coste/día", render: (row) => usd(row.runCost * row.runsPerDay) },
    { key: "month", label: "Coste/mes", render: (row) => <strong>{usd(row.runCost * row.runsPerDay * DAYS_PER_MONTH)}</strong> },
  ];

  return (
    <div className="space-y-4">
      {scheduledPerDay > data.caps.org_daily_run_cap ? (
        <Banner tone="warn">
          Las ejecuciones programadas suman {scheduledPerDay.toFixed(1)} al día por cliente y el orquestador solo permite {data.caps.org_daily_run_cap}: el
          coste real no pasará de ese tope.
        </Banner>
      ) : null}
      {clients * scheduledPerDay > platformCap ? (
        <Banner tone="warn">
          {clients} clientes pedirían {(clients * scheduledPerDay).toFixed(0)} ejecuciones programadas al día y la plataforma lanza como máximo {platformCap} (
          {data.caps.platform_runs_per_tick} por pasada, {data.caps.ticks_per_day} pasadas al día).
        </Banner>
      ) : null}

      <Card
        kicker="Control de coste"
        title="Coste de IA por cliente"
        description="Cambia las ejecuciones al día y el modelo de cada agente: el coste se recalcula al momento y, al aplicar, el orquestador y los agentes pasan a usarlo. La elección de modelo que tenga un cliente concreto (Clientes › agentes) sigue mandando para ese cliente."
        actions={
          <span className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={toDesign}>
              Volver al diseño
            </Button>
            {pending.length ? (
              <Button variant="secondary" size="sm" onClick={() => setDraft({ runs: {}, models: {} })}>
                Descartar cambios
              </Button>
            ) : null}
            <Button size="sm" disabled={!pending.length} onClick={() => setConfirming(true)}>
              Aplicar{pending.length ? ` (${pending.length})` : ""}
            </Button>
          </span>
        }
      >
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Figure label="Coste por cliente al día" value={usd(sim.perDay)} hint={`${sim.runsPerDay.toFixed(1)} ejecuciones al día`} />
          <Figure label="Coste por cliente al mes" value={usd(sim.perMonth)} hint={`${DAYS_PER_MONTH} días`} />
          <Figure label="Tokens de entrada al mes" value={mtok(sim.inputPerMonth)} />
          <Figure label="Tokens de salida al mes" value={mtok(sim.outputPerMonth)} />
          <div>
            <label className="text-xs text-muted" htmlFor="sim-clients">
              Clientes
            </label>
            <Input
              id="sim-clients"
              type="number"
              min={1}
              value={String(clients)}
              onChange={(event) => setClients(Math.max(1, Math.floor(Number(event.target.value)) || 1))}
              className="w-24"
            />
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {usd(sim.perMonth * clients)}
              <span className="text-xs font-normal text-muted"> /mes</span>
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Todos los agentes con:</span>
          {data.models.map((model) => (
            <Button key={model.id} variant="secondary" size="sm" onClick={() => setAllModels(model.id)}>
              {model.label} · {usd(allOn(model))}/mes
            </Button>
          ))}
        </div>

        <Table ariaLabel="Coste de IA por agente" columns={columns} rows={rows} />
      </Card>

      <Card
        kicker="Tarifa"
        title="Precios usados"
        description={`USD por millón de tokens. Contrastados con las páginas oficiales de precios de Anthropic y OpenAI el ${data.prices_verified_on}; el valor mostrado es el de la tabla de tarifas en vivo.`}
      >
        <Table
          ariaLabel="Precios por modelo"
          columns={[
            { key: "label", label: "Modelo" },
            { key: "input", label: "Entrada", render: (row) => `$${row.input}` },
            { key: "cache_read", label: "Caché leída", render: (row) => `$${row.cache_read}` },
            { key: "output", label: "Salida", render: (row) => `$${row.output}` },
          ]}
          rows={data.models.map((model) => ({ ...model, id: model.id }))}
        />
      </Card>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        status="warning"
        title={`Aplicar ${pending.length} cambio${pending.length === 1 ? "" : "s"} a todos los clientes`}
        description="Desde la próxima pasada del orquestador (6:00 y 15:00) los agentes corren con esta cadencia y este modelo."
        consequences={pending.map(
          (row) =>
            `${row.name}: ${row.scheduled && row.runsPerDay !== appliedRuns(row) ? `${appliedRuns(row)} → ${row.runsPerDay} al día` : ""}${
              row.scheduled && row.runsPerDay !== appliedRuns(row) && row.model.id !== appliedModel(row) ? " · " : ""
            }${row.model_configurable && row.model.id !== appliedModel(row) ? `${modelById.get(appliedModel(row))?.label ?? appliedModel(row)} → ${row.model.label}` : ""}`,
        )}
        confirmLabel="Aplicar"
        busyLabel="Aplicando…"
        onConfirm={apply}
      />
    </div>
  );
}

function Loader() {
  const { data, error, isLoading, reload } = useCachedQuery<CostModel>("/v1/admin/ai-cost-model");
  if (isLoading && !data) return <AsyncState status="loading" loadingLabel="Cargando agentes y tarifas..." />;
  if (error || !data) return <ErrorBlock>{error ?? "Sin datos."}</ErrorBlock>;
  return <Simulator data={data} reload={reload} />;
}

export default function CostesIaPage() {
  return <PlatformAdminShell title="Costes de IA">{() => <Loader />}</PlatformAdminShell>;
}
