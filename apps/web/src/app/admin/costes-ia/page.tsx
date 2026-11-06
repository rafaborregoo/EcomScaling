"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { CopilotCreditPolicy } from "@/components/copilot-credit-policy";
import { useMemo, useState } from "react";
import { A01_MODEL_DECISION, getAgentModelDecision } from "@e-nora/contracts";
import { A02OperatingCost } from "../laboratorio-ia/a02-operating-cost";
import type { MonitorOperation } from "../laboratorio-ia/a02-cost-sim";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ErrorBlock,
  Field,
  Input,
  SearchableSelect,
  DataTable,
  toast,
  type DataTableColumn,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  DAYS_PER_MONTH,
  plannedRunsPerDay,
  costPerRun,
  closedAgentsCost,
  totals,
  type SimModel,
  type SimProfile,
} from "./cost-sim";

type Agent = {
  code: string;
  name: string;
  default_model: string;
  effective_model?: string;
  model_decision?: ReturnType<typeof getAgentModelDecision>;
  model_configurable: boolean;
  scheduled: boolean;
  default_runs_per_day: number;
  additional_runs_per_day?: number;
  max_runs_per_day: number | null;
  cadence: string;
  saved: { runs_per_day: number | null; model: string | null };
  profile: SimProfile & {
    samples: number;
    source: "medido" | "estimado" | "sin_datos";
  };
};

type CostModel = {
  models: Array<SimModel & { provider: string }>;
  agents: Agent[];
  caps: {
    org_daily_run_cap: number;
    platform_runs_per_tick: number;
    panel_runs_per_tick?: number;
    ticks_per_day: number;
  };
  prices_verified_on: string;
  monitor_operation?: MonitorOperation;
};

type Draft = { runs: Record<string, number>; models: Record<string, string> };

const n = (value: number) => Math.round(value).toLocaleString("es-ES");
const usd = (value: number) =>
  `$${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd4 = (value: number) =>
  `$${value.toLocaleString("es-ES", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
const mtok = (value: number) =>
  `${(value / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M`;

/** Lo que está aplicado hoy: lo guardado o, si no hay nada, el diseño. */
const appliedRuns = (agent: Agent) =>
  agent.saved.runs_per_day ?? agent.default_runs_per_day;
const appliedModel = (agent: Agent) =>
  agent.effective_model ?? agent.saved.model ?? agent.default_model;

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
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
  const [meetings, setMeetings] = useState("");
  const [confirming, setConfirming] = useState(false);

  const modelById = useMemo(
    () => new Map(data.models.map((model) => [model.id, model])),
    [data.models],
  );
  const rows = data.agents.map((agent) => {
    const model = modelById.get(
      draft.models[agent.code] ?? appliedModel(agent),
    );
    if (!model)
      throw new Error(`Falta la tarifa exacta de ${appliedModel(agent)}`);
    const runsPerDay = draft.runs[agent.code] ?? appliedRuns(agent);
    const changed =
      (agent.scheduled && runsPerDay !== appliedRuns(agent)) ||
      (agent.model_configurable && model.id !== appliedModel(agent));
    return {
      ...agent,
      id: agent.code,
      model,
      runsPerDay,
      projectedRunsPerDay: plannedRunsPerDay(
        agent.code,
        runsPerDay,
        agent.additional_runs_per_day,
      ),
      changed,
      runCost: costPerRun(agent.profile, model),
    };
  });
  const pending = rows.filter((row) => row.changed);
  const meetingCount = meetings.trim() === "" ? null : Number(meetings);
  const closed = closedAgentsCost(rows.filter((row) => row.model_decision).map((row) => ({ code: row.code, profile: row.profile, model: row.model, runsPerDay: row.projectedRunsPerDay })), meetingCount !== null && Number.isFinite(meetingCount) && meetingCount >= 0 ? meetingCount : null);

  const sim = totals(
    rows.map((row) => ({
      code: row.code,
      profile: row.profile,
      model: row.model,
      runsPerDay: row.projectedRunsPerDay,
    })),
  );
  const scheduledPerDay = rows
    .filter((row) => row.scheduled)
    .reduce((sum, row) => sum + row.projectedRunsPerDay, 0);
  const allOn = (model: SimModel) =>
    totals(
      rows.map((row) => ({
        code: row.code,
        profile: row.profile,
        model: row.model_configurable ? model : row.model,
        runsPerDay: row.projectedRunsPerDay,
      })),
    ).perMonth;
  const setRuns = (code: string, value: number) =>
    setDraft((d) => ({
      ...d,
      runs: { ...d.runs, [code]: Math.max(0, value || 0) },
    }));
  const setModel = (code: string, value: string) =>
    setDraft((d) => ({ ...d, models: { ...d.models, [code]: value } }));
  const setAllModels = (id: string) =>
    setDraft((d) => ({
      ...d,
      models: Object.fromEntries(
        data.agents
          .filter((agent) => agent.model_configurable)
          .map((agent) => [agent.code, id]),
      ),
    }));
  const toDesign = () =>
    setDraft({
      runs: Object.fromEntries(
        data.agents.map((agent) => [agent.code, agent.default_runs_per_day]),
      ),
      models: Object.fromEntries(
        data.agents.map((agent) => [agent.code, agent.default_model]),
      ),
    });
  const modelOptions = data.models.map((model) => ({
    value: model.id,
    label: model.label,
    section:
      model.provider === "openai"
        ? "OpenAI"
        : model.provider === "anthropic"
          ? "Claude"
          : model.provider,
  }));
  const platformCap =
    (data.caps.platform_runs_per_tick + (data.caps.panel_runs_per_tick ?? 0)) *
    data.caps.ticks_per_day;

  async function apply() {
    // Se guarda solo lo que difiere del diseño; lo que vuelve al diseño se borra.
    const settings = rows.map((row) => ({
      agent_code: row.code,
      runs_per_day:
        row.scheduled && row.runsPerDay !== row.default_runs_per_day
          ? row.runsPerDay
          : null,
      model:
        row.model_configurable && row.model.id !== row.default_model
          ? row.model.id
          : null,
    }));
    const response = await apiFetch("/v1/admin/ai-agent-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    if (!response.ok) throw new Error(await readApiError(response));
    toast.success(
      "Aplicado. El orquestador y los agentes lo usan desde la próxima ejecución.",
    );
    setDraft({ runs: {}, models: {} });
    reload();
  }

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "name",
      label: "Agente",
      render: (row) => (
        <span className="flex flex-col gap-1">
          <span className="font-medium">{row.name}</span>
          <span className="font-mono text-xs text-muted">{row.code}</span>
          {row.changed ? <Badge tone="warn">Sin aplicar</Badge> : null}
          {row.model_decision ? (
            row.model_decision.status === "closed" ? (
              <Badge tone="success">Revisión cerrada</Badge>
            ) : (
              <Badge tone="warn">Revisión provisional</Badge>
            )
          ) : null}
        </span>
      ),
    },
    {
      key: "model",
      label: "Modelo",
      render: (row) =>
        row.model_configurable ? (
          <SearchableSelect
            className="min-w-56"
            aria-label={`Modelo de ${row.name}`}
            placeholder="Busca un modelo"
            emptyText="No hay ningún modelo con ese nombre."
            value={row.model.id}
            onChange={(value) => setModel(row.code, value)}
            options={modelOptions}
          />
        ) : (
          <span className="text-xs text-muted">
            {row.model.label} ·{" "}
            {row.model_decision
              ? "modelo fijado por plataforma"
              : "lo decide el plan"}
          </span>
        ),
    },
    {
      key: "profile",
      label: "Tokens por ejecución",
      render: (row) => (
        <span className="flex flex-col text-xs tabular-nums">
          <span>
            {n(row.profile.input_total)} entrada ({n(row.profile.cache_read)}{" "}
            caché)
          </span>
          <span>{n(row.profile.output)} salida</span>
          <Badge tone={row.profile.source === "medido" ? "success" : "neutral"}>
            {row.profile.source === "medido"
              ? `medido · ${row.profile.samples}`
              : row.profile.source === "estimado"
                ? "estimado"
                : "sin datos"}
          </Badge>
          {row.code === "a01_analista_llamadas" && row.model_decision ? (
            <span className="text-muted">
              Referencia: llamada sintética de 60 min por CLI. El perfil
              histórico no distingue modelos.
            </span>
          ) : null}
          {row.code === "a02_monitor_negocio" && row.model_decision ? (
            <span className="text-muted">
              GPT-6.1 Terra asignado en ambas vistas; GPT-6.1 Sol es el fallback.
              Perfil CLI basado en Overview y Panel con historico TEST; el
              desglose inferior estima cada vista por separado.
            </span>
          ) : null}
          {row.code === "a19_arquitecto_camino" && row.model_decision ? (
            <span className="text-muted">Opus 5.5 asignado, con GPT-6.1 Sol de respaldo. Una replanificación real por API del 5-nov: estrategia 3,07 USD más detalle de tareas 3,64 USD, unos 20 min. El perfil no incluye la escritura de caché, así que el coste real queda un 7 % por encima. Una sola tienda y un solo caso.</span>
          ) : null}
          {row.code === "a04_generador_tareas" && row.model_decision ? (
            <span className="text-muted">Media de cuatro pruebas CLI con Terra, sin caché; el historial mezcla modelos.</span>
          ) : null}
          {row.code === "a05_estrategia_campanas" && row.model_decision ? (
            <span className="text-muted">Media de tres pruebas CLI con Sol, sin caché; el historial mezcla modelos. La frecuencia es una hipótesis manual editable.</span>
          ) : null}
          {row.code === "a06_planificador_stock" && row.model_decision ? (
            <span className="text-muted">Haiku 5.5 asignado. Respaldo entre proveedores: GPT-6.1 Sol. Estimación basada en pruebas CLI; no es consumo API facturado.</span>
          ) : null}
          {row.code === "a08_gestor_conocimiento" && row.model_decision ? (
            <span className="text-muted">Sonnet 5.5 asignado. Fallback entre proveedores: GPT-6.1 Sol; Opus 5.5 es alternativa dentro de Anthropic. El coste estimado por ejecución manual depende de cuántas auditorías se soliciten; 0 programadas no significa coste gratuito. El coste por ejecución usa el perfil histórico amplio de A08, no los casos sintéticos pequeños del laboratorio. Estimación basada en CLI, no en consumo API facturado.</span>
          ) : null}
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
          <span className="text-xs text-muted">
            {row.scheduled ? row.cadence : `${row.cadence} · solo simulación`}
          </span>
          {row.code === "a02_monitor_negocio" ? (
            <span className="text-xs text-muted">
              El campo ajusta los dashboards. Se añaden{" "}
              {row.runsPerDay === 0 ? 0 : (row.additional_runs_per_day ?? 0)}{" "}
              lecturas/día del consultor al coste: total{" "}
              {row.projectedRunsPerDay.toFixed(2)}. Referencia: un cliente, una
              tienda y consultor asignado; desglose A02 debajo.
            </span>
          ) : null}
          {row.code === "a04_generador_tareas" ? (
            <span className="text-xs text-muted">
              Escenario de una tienda: se estima una ejecución para la
              organización y otra para la tienda; total{" "}
              {row.projectedRunsPerDay.toFixed(2)}/día. La actividad,
              aprobaciones, límites y refrescos manuales pueden cambiar esta
              cifra.
            </span>
          ) : null}
          {row.scheduled && row.runsPerDay === 0 ? (
            <span className="text-xs text-muted">
              {row.code === "a02_monitor_negocio"
                ? "A02 queda desactivado; no admite generación manual."
                : "No se programa; se puede lanzar a mano."}
            </span>
          ) : null}
          {row.max_runs_per_day !== null &&
          row.runsPerDay > row.max_runs_per_day ? (
            <span className="text-xs text-warning">
              Con 2 pasadas al día no pasará de ≈{row.max_runs_per_day}.
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "runCost",
      label: "Coste/ejec.",
      render: (row) => usd4(row.runCost),
    },
    {
      key: "day",
      label: "Coste/día",
      render: (row) => usd(row.runCost * row.projectedRunsPerDay),
    },
    {
      key: "month",
      label: "Coste/mes",
      render: (row) => (
        <strong>
          {usd(row.runCost * row.projectedRunsPerDay * DAYS_PER_MONTH)}
        </strong>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <CopilotCreditPolicy />
      {scheduledPerDay > data.caps.org_daily_run_cap ? (
        <Banner tone="warn">
          Las ejecuciones programadas suman {scheduledPerDay.toFixed(1)} al día
          por cliente y el orquestador solo permite{" "}
          {data.caps.org_daily_run_cap} para todos los agentes: puede posponer
          lecturas. Un cupo de ejecuciones no es un tope monetario.
        </Banner>
      ) : null}
      {clients * scheduledPerDay > platformCap ? (
        <Banner tone="warn">
          {clients} clientes pedirían {(clients * scheduledPerDay).toFixed(0)}{" "}
          ejecuciones programadas al día y la plataforma lanza como máximo{" "}
          {platformCap} sumando ambos ciclos ({data.caps.platform_runs_per_tick}{" "}
          del principal + {data.caps.panel_runs_per_tick ?? 0} del panel por
          pasada, {data.caps.ticks_per_day} pasadas al día). Son cupos
          compartidos: no garantizan frecuencia para cada cliente.
        </Banner>
      ) : null}

      <Card>
        <CardHeader>
          <CardKicker>Agentes revisados</CardKicker>
          <CardTitle>Acumulado mensual de decisiones cerradas</CardTitle>
          <CardDescription>Estimación por cliente y una tienda, no gasto facturado. Incluye solo agentes cerrados; usa las cadencias de esta simulación y las tarifas API sobre consumos CLI, sin caché ni herramientas o reintentos adicionales.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Reuniones al mes por cliente (A01, duración de referencia: 60 minutos)">
            <Input type="number" min={0} step={1} value={meetings} onChange={(event) => setMeetings(event.target.value)} placeholder="Sin dato" className="w-36" />
          </Field>
          {closed.agents.map((item) => {
            const row = rows.find((candidate) => candidate.code === item.code)!;
            return <p key={item.code} className="text-sm">{row.name} · {row.model.label}: {item.monthly === null ? "pendiente de frecuencia" : `${usd(item.monthly)}/mes`}</p>;
          })}
          <p className="font-semibold">{closed.complete ? "Total estimado" : `Total parcial · pendiente: ${closed.pending.map((code) => code === "a01_analista_llamadas" ? "frecuencia de A01" : "frecuencia manual de A08").join(" y ")}`}: {usd(closed.partial)}/mes por cliente · {usd(closed.partial * clients)}/mes para {clients} cliente(s)</p>
          {!closed.complete ? <p className="text-xs text-muted">Indica las reuniones al mes de A01 y/o una frecuencia mensual para las auditorías manuales de A08. Los agentes aún no revisados quedan fuera de este acumulado.</p> : <p className="text-xs text-muted">El resto de agentes aún no revisados queda fuera de este acumulado.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardKicker>Control de coste</CardKicker>
          <CardTitle>Coste de IA por cliente</CardTitle>
          <CardDescription>
            Cambia las ejecuciones al día y el modelo de cada agente: el coste
            se recalcula al momento y, al aplicar, el orquestador y los agentes
            pasan a usarlo. La plataforma fija el modelo de los especialistas;
            el copiloto conserva su elección según plan y saldo.
          </CardDescription>
          <CardAction>
            <span className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={toDesign}>
                Volver al diseño
              </Button>
              {pending.length ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDraft({ runs: {}, models: {} })}
                >
                  Descartar cambios
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={!pending.length}
                onClick={() => setConfirming(true)}
              >
                Aplicar{pending.length ? ` (${pending.length})` : ""}
              </Button>
            </span>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Figure
              label="Coste por cliente al día"
              value={usd(sim.perDay)}
              hint={`${sim.runsPerDay.toFixed(1)} ejecuciones al día`}
            />
            <Figure
              label="Coste por cliente al mes"
              value={usd(sim.perMonth)}
              hint={`${DAYS_PER_MONTH} días`}
            />
            <Figure
              label="Tokens de entrada al mes"
              value={mtok(sim.inputPerMonth)}
            />
            <Figure
              label="Tokens de salida al mes"
              value={mtok(sim.outputPerMonth)}
            />
            <div>
              <Field label="Clientes">
                <Input
                  type="number"
                  min={1}
                  value={String(clients)}
                  onChange={(event) =>
                    setClients(
                      Math.max(1, Math.floor(Number(event.target.value)) || 1),
                    )
                  }
                  className="w-24"
                />
              </Field>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {usd(sim.perMonth * clients)}
                <span className="text-xs font-normal text-muted"> /mes</span>
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Todos los agentes con:</span>
            {data.models.map((model) => (
              <Button
                key={model.id}
                variant="secondary"
                size="sm"
                onClick={() => setAllModels(model.id)}
              >
                {model.label} · {usd(allOn(model))}/mes
              </Button>
            ))}
          </div>

          <DataTable
            ariaLabel="Coste de IA por agente"
            columns={columns}
            rows={rows}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardKicker>A01 · modelo decidido</CardKicker>
          <CardTitle>
            Analista de llamadas · {A01_MODEL_DECISION.label}
          </CardTitle>
          <CardDescription>
            Modelo fijo para todas las duraciones. Estos importes por reunión
            usan los tokens de las pruebas CLI sintéticas y la tarifa API del
            modelo seleccionado; son estimaciones, sin transcripción de audio ni
            herramientas de pago. La referencia del simulador es una llamada de 60 minutos. Fallback automatico: GPT-6.1 Terra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            ariaLabel="Coste de A01 con GPT-6.1 Sol segun duracion de reunion"
            rows={A01_MODEL_DECISION.benchmarks.map((sample) => ({
              id: String(sample.minutes),
              duration: String(sample.minutes) + " min",
              input: n(sample.inputTokens),
              cache: n(sample.cacheReadTokens ?? 0),
              output: n(sample.outputTokens),
              cost: modelById.has(A01_MODEL_DECISION.model)
                ? usd4(
                    costPerRun(
                      {
                        input_total: sample.inputTokens,
                        cache_read: sample.cacheReadTokens ?? 0,
                        output: sample.outputTokens,
                      },
                      modelById.get(A01_MODEL_DECISION.model)!,
                    ),
                  )
                : "Tarifa no disponible",
            }))}
            pageSize={3}
            columns={[
              { key: "duration", label: "Duración nominal" },
              { key: "input", label: "Tokens de entrada" },
              { key: "cache", label: "Entrada en caché" },
              { key: "output", label: "Tokens de salida" },
              { key: "cost", label: "Precio API estimado · USD" },
            ]}
          />
          <p className="mt-3 text-xs text-muted">
            Tarifa Standard de Sol contrastada el 28/10/2026. La cuenta necesita
            acceso y saldo API para ejecutar el modelo.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardKicker>Tarifa</CardKicker>
          <CardTitle>Precios usados</CardTitle>
          <CardDescription>{`USD por millón de tokens. Contrastados con las páginas oficiales de precios de Anthropic y OpenAI el ${data.prices_verified_on}; el valor mostrado es el de la tabla de tarifas en vivo.`}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            ariaLabel="Precios por modelo"
            columns={[
              { key: "label", label: "Modelo" },
              {
                key: "input",
                label: "Entrada",
                render: (row) => `$${row.input}`,
              },
              {
                key: "cache_read",
                label: "Caché leída",
                render: (row) => `$${row.cache_read}`,
              },
              {
                key: "output",
                label: "Salida",
                render: (row) => `$${row.output}`,
              },
            ]}
            rows={data.models.map((model) => ({ ...model, id: model.id }))}
          />
        </CardContent>
      </Card>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <SlidersHorizontalIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>
              ¿Aplicar {pending.length} cambio{pending.length === 1 ? "" : "s"}{" "}
              a todos los clientes?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Desde la próxima pasada del orquestador (6:00 y 15:00) los agentes
              corren con esta cadencia y este modelo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="ui-alert-dialog__list">
            {pending.map((row) => (
              <li key={row.name}>
                {`${row.name}: ${row.scheduled && row.runsPerDay !== appliedRuns(row) ? `${appliedRuns(row)} → ${row.runsPerDay} al día` : ""}${
                  row.scheduled &&
                  row.runsPerDay !== appliedRuns(row) &&
                  row.model.id !== appliedModel(row)
                    ? " · "
                    : ""
                }${row.model_configurable && row.model.id !== appliedModel(row) ? `${modelById.get(appliedModel(row))?.label ?? appliedModel(row)} → ${row.model.label}` : ""}`}
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction busyLabel="Aplicando…" onClick={apply}>
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Loader() {
  const { data, error, isLoading, reload } = useCachedQuery<CostModel>(
    "/v1/admin/ai-cost-model",
  );
  if (isLoading && !data)
    return (
      <AsyncState
        status="loading"
        loadingLabel="Cargando agentes y tarifas..."
      />
    );
  if (error || !data) return <ErrorBlock>{error ?? "Sin datos."}</ErrorBlock>;
  const unknown = data.agents.filter(
    (agent) => !data.models.some((model) => model.id === appliedModel(agent)),
  );
  if (unknown.length)
    return (
      <Banner
        tone="warn"
        title="No se puede calcular un total con modelos sin tarifa exacta"
      >
        <p>
          Actualiza el catálogo antes de simular. No se sustituyen estos modelos
          por otros:
        </p>
        <ul className="mt-2 list-disc pl-5">
          {unknown.map((agent) => (
            <li key={agent.code}>
              {agent.name}: {appliedModel(agent)}
            </li>
          ))}
        </ul>
      </Banner>
    );
  return <Simulator data={data} reload={reload} />;
}

export default function CostesIaPage() {
  return (
    <PlatformAdminShell title="Costes de IA">
      {() => (
        <>
          <Loader />
          <A02OperatingCost />
        </>
      )}
    </PlatformAdminShell>
  );
}
