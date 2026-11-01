"use client";

import { useEffect, useState } from "react";
import type { AiModelLabReport } from "@e-nora/contracts";
import {
  Banner,
  Button,
  DataTable,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { apiFetch } from "@/lib/bootstrap";
import { readApiFailure } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { calculateLabApiPrice, formatUsd } from "./lab-price";

type Setting = {
  store_id: string;
  mode: "off" | "shadow" | "live";
  coverage_review_days: number;
  cooldown_minutes: number;
  daily_model_cap: number;
};
type Evaluation = {
  id: string;
  store_id: string;
  mode: string;
  decision: string;
  created_at: string;
  error_code: string | null;
  evidence: {
    signals?: Array<{ reason: string; days_of_cover: number | null }>;
    abstentions?: Array<{ reason: string }>;
  };
  run_id: string | null;
  agent_runs: {
    estimated_cost_usd: number | null;
    input_tokens: number | null;
    output_tokens: number | null;
  } | null;
};
type Payload = {
  available: boolean;
  message?: string;
  settings?: Setting[];
  stores?: Array<{ id: string; shop_name: string; organization_id: string }>;
  evaluations?: Evaluation[];
  queue?: Array<{
    store_id: string;
    revision: number;
    processed_revision: number;
    due_at: string | null;
  }>;
  current_model?: string;
  autorun_enabled?: boolean;
  provider_configured?: boolean;
  sampling?: string;
  examples: Array<{
    id: string;
    label: string;
    expected: boolean;
    threshold: number;
    after: number;
    daily: number;
    result: { shouldReview: boolean };
  }>;
};
const decisions: Record<string, string> = {
  no_material_change: "Sin señal nueva para IA",
  would_review: "Activaría A06 · sin consumo",
  same_signal: "Señal ya analizada",
  cooldown: "Agrupado hasta el próximo análisis",
  daily_cap: "Pendiente por cupo diario",
  autorun_disabled: "Automatización pausada",
  provider_not_configured: "Esperando configuración de API",
  evaluating: "Comprobando datos",
  running: "A06 analizando",
  completed: "Análisis generado · revisar propuesta",
  failed: "No se completó · reintento previsto",
};
const signalLabels: Record<string, string> = {
  location_empty: "Nivel de variante/ubicación agotado",
  coverage_crossed: "Cruza el umbral de cobertura",
  coverage_critical: "Cobertura cae a un día o menos",
};

export function A06StockEvents({ report }: { report: AiModelLabReport }) {
  const query = useCachedQuery<Payload>("/v1/admin/a06-stock-events");
  const [storeId, setStoreId] = useState("");
  const [mode, setMode] = useState<Setting["mode"]>("shadow");
  const [threshold, setThreshold] = useState("3");
  const [cooldown, setCooldown] = useState("15");
  const [cap, setCap] = useState("4");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [monthlyEvents, setMonthlyEvents] = useState("10");
  useEffect(() => {
    const timer = setInterval(query.reload, 20_000);
    return () => clearInterval(timer);
  }, [query.reload]);
  const data = query.data;
  const selectStore = (id: string) => {
    setStoreId(id);
    setMessage("");
    const current = data?.settings?.find((setting) => setting.store_id === id);
    setMode(current?.mode ?? "shadow");
    setThreshold(String(current?.coverage_review_days ?? 3));
    setCooldown(String(current?.cooldown_minutes ?? 15));
    setCap(String(current?.daily_model_cap ?? 4));
  };
  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await apiFetch("/v1/admin/a06-stock-events/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store_id: storeId,
          mode,
          coverage_review_days: Number(threshold),
          cooldown_minutes: Number(cooldown),
          daily_model_cap: Number(cap),
        }),
      });
      if (!response.ok) throw await readApiFailure(response);
      setMessage(
        mode === "shadow"
          ? "Observación activada: registra señales sin llamadas de IA."
          : mode === "live"
            ? "Análisis por eventos activado para esta tienda."
            : "Piloto desactivado para esta tienda.",
      );
      query.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración.",
      );
    } finally {
      setSaving(false);
    }
  };
  const names = new Map(
    (data?.stores ?? []).map((store) => [store.id, store.shop_name]),
  );
  const evaluations = (data?.evaluations ?? []).filter(
    (row) => !storeId || row.store_id === storeId,
  );
  const withRuns = evaluations.filter((row) => row.run_id);
  const costKnown = withRuns.every(
    (row) =>
      row.agent_runs?.estimated_cost_usd !== null &&
      row.agent_runs?.estimated_cost_usd !== undefined,
  );
  const recordedCost = withRuns.reduce(
    (sum, row) => sum + Number(row.agent_runs?.estimated_cost_usd ?? 0),
    0,
  );
  const exampleCount = Math.max(
    0,
    Math.min(100000, Number(monthlyEvents) || 0),
  );
  return (
    <section
      className="space-y-4 rounded-xl border border-line bg-surface p-5"
      aria-labelledby="a06-events-title"
    >
      <h3 id="a06-events-title" className="text-lg font-semibold">
        Stock: reaccionar a cambios durante el día
      </h3>
      <p className="text-sm text-muted">
        El inventario se actualiza por eventos. El piloto agrupa los cambios,
        comprueba su importancia y adelanta A06 cuando corresponde. Conserva su
        modelo y su contexto completo: el ahorro procede de evitar análisis
        innecesarios. La revisión periódica sigue siendo independiente.
      </p>
      <Banner tone="info" title="Qué significa un cambio importante">
        Una bajada porcentual no basta. Revisamos si una variante se queda sin
        unidades en una ubicación o si la cobertura cruza el umbral elegido para
        la tienda. Se necesitan inventario fiable y ventas suficientes para
        calcular cobertura. El valor inicial de 3 días pide revisar: no
        significa que toque comprar ni sustituye al plazo del proveedor o al
        stock de seguridad.
      </Banner>
      {query.error ? (
        <p role="alert" className="text-sm">
          {query.error}
        </p>
      ) : !data ? (
        <p className="text-sm text-muted">Cargando el piloto…</p>
      ) : !data.available ? (
        <p role="status" className="text-sm">
          {data.message}
        </p>
      ) : (
        <>
          <p className="text-sm">
            Modelo asignado a A06: <strong>{data.current_model}</strong>. Sol
            queda como respaldo si Anthropic no puede atender la llamada. La
            decisión de modelo está cerrada; ninguna tienda entra en el piloto
            automáticamente.
          </p>
          {!data.provider_configured ? (
            <Banner tone="info" title="Observación disponible sin API">
              Podemos vigilar cambios y probar respuestas con los CLI. Para
              generar análisis automáticos durante el día hace falta configurar
              una API de OpenAI o Anthropic. Las pruebas CLI no mantienen el
              servicio activo.
            </Banner>
          ) : null}
          {!data.autorun_enabled ? (
            <Banner tone="info" title="La automatización general está pausada">
              La observación funciona; el modo con IA esperará a que se habilite
              la automatización general.
            </Banner>
          ) : null}
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Tienda del piloto">
                <Select
                  value={storeId}
                  onChange={selectStore}
                  options={[
                    { value: "", label: "Selecciona una tienda" },
                    ...(data.stores ?? []).map((store) => ({
                      value: store.id,
                      label: store.shop_name,
                    })),
                  ]}
                />
              </Field>
              <Field label="Funcionamiento">
                <Select
                  value={mode}
                  onChange={(value) => setMode(value as Setting["mode"])}
                  options={[
                    { value: "shadow", label: "Observar · sin gasto de IA" },
                    { value: "live", label: "Analizar con IA · consume API" },
                    { value: "off", label: "Desactivado" },
                  ]}
                />
              </Field>
              <Field
                label="Revisar al cruzar esta cobertura"
                hint="Días estimados de existencias; no es un punto de compra."
              >
                <Input
                  type="number"
                  min={0.25}
                  max={90}
                  step={0.25}
                  required
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value)}
                />
              </Field>
              <Field
                label="Agrupar análisis durante"
                hint="Minutos entre análisis por eventos."
              >
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  required
                  value={cooldown}
                  onChange={(event) => setCooldown(event.target.value)}
                />
              </Field>
              <Field
                label="Máximo de análisis de eventos"
                hint="Por día UTC y tienda; no incluye los periódicos."
              >
                <Input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={cap}
                  onChange={(event) => setCap(event.target.value)}
                />
              </Field>
            </div>
            <Button
              type="submit"
              disabled={
                !storeId ||
                saving ||
                (mode === "live" && !data.provider_configured)
              }
            >
              {saving ? "Guardando…" : "Guardar piloto de esta tienda"}
            </Button>
            {message ? (
              <p role="status" className="text-sm">
                {message}
              </p>
            ) : null}
          </form>
          <p className="text-sm text-muted">
            Agrupación inicial de 60 segundos y comprobación de cola cada
            minuto. Los cupos, pausas y fallos pueden retrasar el análisis. Una
            propuesta anterior pendiente no bloquea una señal nueva; las tareas
            conservan su aprobación y comprobaciones de duplicados.
          </p>
          <p className="text-sm">
            <strong>{evaluations.length}</strong> evaluaciones mostradas ·{" "}
            <strong>{withRuns.length}</strong> ejecuciones IA enlazadas · coste
            registrado:{" "}
            <strong>
              {costKnown ? formatUsd(recordedCost) : "Incompleto"}
            </strong>
            .{" "}
            {storeId &&
            !data.settings?.some((setting) => setting.store_id === storeId)
              ? "Esta tienda todavía no está inscrita."
              : ""}
          </p>
          <DataTable
            ariaLabel="Decisiones del piloto de stock A06"
            pageSize={8}
            rows={evaluations.map((row) => ({
              id: row.id,
              when: new Date(row.created_at).toLocaleString("es-ES", {
                timeZone: "Europe/Madrid",
              }),
              store: names.get(row.store_id) ?? row.store_id,
              decision: decisions[row.decision] ?? row.decision,
              reason:
                row.evidence.signals
                  ?.map(
                    (signal) => signalLabels[signal.reason] ?? signal.reason,
                  )
                  .join("; ") ||
                (row.evidence.abstentions?.length
                  ? "Datos insuficientes: se abstiene"
                  : "No cruza una señal nueva"),
              cost: row.run_id
                ? row.agent_runs?.estimated_cost_usd != null
                  ? formatUsd(Number(row.agent_runs.estimated_cost_usd))
                  : "No disponible"
                : row.decision === "running"
                  ? "En curso"
                  : "Sin ejecución enlazada",
            }))}
            columns={[
              { key: "when", label: "Fecha · Madrid" },
              { key: "store", label: "Tienda" },
              { key: "decision", label: "Decisión" },
              { key: "reason", label: "Por qué" },
              { key: "cost", label: "Coste IA · USD" },
            ]}
          />
          <p className="text-xs text-muted">{data.sampling}</p>
        </>
      )}
      {data?.examples?.length ? (
        <DataTable
          ariaLabel="Ejemplos de cambios de stock"
          pageSize={7}
          rows={data.examples.map((example) => ({
            id: example.id,
            scenario: example.label,
            cover: `${Number((example.after / example.daily).toFixed(1))} días`,
            result: example.result.shouldReview
              ? "Pedir revisión a A06"
              : "Actualizar datos sin IA",
            verdict:
              example.result.shouldReview === example.expected
                ? "Resultado esperado"
                : "Revisar regla",
          }))}
          columns={[
            { key: "scenario", label: "Mismo cambio, distinto contexto" },
            { key: "cover", label: "Cobertura restante" },
            { key: "result", label: "Decisión de la regla" },
            { key: "verdict", label: "Comprobación" },
          ]}
        />
      ) : null}
      <h4 className="font-semibold">
        Prueba del análisis: revisión periódica frente a evento
      </h4>
      <p className="text-sm text-muted">
        Mismo producto con 10 unidades, ventas de 4 al día y cobertura de 2,5
        días. Comparamos el snapshot especialista con y sin la señal 30 → 10; el
        tercer caso añade una propuesta anterior pendiente. Seis modelos por
        CLI, sin Astra, herramientas ni escrituras. No demuestra calidad en
        todos los catálogos ni ahorro de contexto recortado.
      </p>
      <DataTable
        ariaLabel="Calidad A06 en las pruebas de eventos"
        pageSize={6}
        rows={report.models
          .filter(
            (model) =>
              !model.id.includes("astra") &&
              report.cases.some(
                (item) =>
                  item.stock_benchmark?.scenario.startsWith("event_") &&
                  item.model_ids?.includes(model.id),
              ),
          )
          .map((model) => {
            const sample = (scenario: string) =>
              report.results.find(
                (result) =>
                  result.model_id === model.id &&
                  report.cases.some(
                    (item) =>
                      item.id === result.case_id &&
                      item.stock_benchmark?.scenario === scenario,
                  ),
              );
            const control = sample("event_periodic"),
              reactive = sample("event_reactive"),
              pending = sample("event_pending");
            const fields = (result: typeof control) => {
              const checks = result?.field_assessment?.checks ?? [];
              return checks.length === 16
                ? `${checks.filter((check) => check.status === "pass").length} / ${checks.filter((check) => check.status === "fail").length} / ${checks.filter((check) => check.status === "uncertain").length}`
                : result?.status === "completed"
                  ? "Respuesta recibida · revisando"
                  : "Pendiente";
            };
            let tasks: number | null = null;
            try {
              const parsed = JSON.parse(pending?.raw_response ?? "");
              tasks = parsed.proposed_writes.filter(
                (write: { kind: string }) => write.kind === "task",
              ).length;
            } catch {
              /* A missing/invalid response is never counted as zero tasks. */
            }
            return {
              id: model.id,
              model: model.label,
              valid: `${[control, reactive, pending].filter((result) => result?.checks.native_contract === true).length}/3`,
              control: fields(control),
              event: fields(reactive),
              pending: fields(pending),
              tasks:
                tasks === null ? "No disponible" : `${tasks} tareas nuevas`,
            };
          })}
        columns={[
          { key: "model", label: "Modelo" },
          { key: "valid", label: "Contrato válido" },
          { key: "control", label: "Periódico · sin fallo / fallos / dudas" },
          { key: "event", label: "Evento · sin fallo / fallos / dudas" },
          { key: "pending", label: "Propuesta pendiente · campos" },
          { key: "tasks", label: "Con propuesta anterior" },
        ]}
      />
      <p className="text-xs text-muted">
        Dos revisores automáticos, también candidatos. Los recuentos son campos
        revisados, no porcentajes de precisión. Los CLI de Codex no confirman el
        ID de modelo servido. Las respuestas completas se pueden desplegar en
        los casos del laboratorio.
      </p>
      <Field
        label="Análisis adicionales por eventos al mes · escenario de coste"
        hint="Cuenta análisis que pasan el filtro, no pedidos ni cambios de stock. No es uso observado."
      >
        <Input
          type="number"
          min={0}
          max={100000}
          value={monthlyEvents}
          onChange={(event) => setMonthlyEvents(event.target.value)}
        />
      </Field>
      <DataTable
        ariaLabel="Coste orientativo de A06 por eventos"
        pageSize={6}
        rows={report.models
          .filter(
            (model) =>
              !model.id.includes("astra") &&
              report.cases.some(
                (item) =>
                  item.stock_benchmark && item.model_ids?.includes(model.id),
              ),
          )
          .map((model) => {
            const cases = report.cases.filter(
              (item) =>
                item.stock_benchmark &&
                !item.stock_benchmark.scenario.startsWith("event_"),
            );
            const samples = report.results.filter(
              (result) =>
                result.model_id === model.id &&
                result.status === "completed" &&
                cases.some((item) => item.id === result.case_id),
            );
            const prices = samples.map((result) => {
              const u = result.usage;
              if (
                u.input === null ||
                u.cached === null ||
                u.cache_creation === null
              )
                return null;
              return calculateLabApiPrice(model.id, {
                ...u,
                input:
                  model.provider === "anthropic"
                    ? u.input + u.cached + u.cache_creation
                    : u.input,
                cached: 0,
                cache_creation: 0,
              });
            });
            const each =
              samples.length === 4 && prices.every(Boolean)
                ? prices.reduce((sum, price) => sum + price!.low, 0) /
                  prices.length
                : null;
            return {
              id: model.id,
              model: model.label,
              each: each === null ? "Pendiente" : formatUsd(each),
              additional:
                each === null ? "Pendiente" : formatUsd(each * exampleCount),
              total:
                each === null
                  ? "Pendiente"
                  : formatUsd(each * (30 + exampleCount)),
            };
          })}
        columns={[
          { key: "model", label: "Modelo" },
          { key: "each", label: "Un análisis · USD" },
          { key: "additional", label: "Eventos del escenario · USD/mes" },
          { key: "total", label: "+ 30 revisiones periódicas · USD/mes" },
        ]}
      />
      <p className="text-xs text-muted">
        Proyección con el coste medio de los cuatro casos A06, contexto completo
        y sin caché. El coste por evento real puede variar. No incluye
        infraestructura, herramientas, reintentos ni impuestos. La caché de
        entrada, si se aplica, reduce tokens facturados sin resumir datos; no
        significa memoria permanente.
      </p>
    </section>
  );
}
