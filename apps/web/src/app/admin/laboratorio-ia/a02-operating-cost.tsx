"use client";
import { useState } from "react";
import type { AiModelLabReport } from "@e-nora/contracts";
import {
  Banner,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  DataTable,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  a02OperatingCosts,
  a02OperatingPlan,
  type MonitorOperation,
} from "./a02-cost-sim";
import { formatUsd } from "./lab-price";

const count = (value: number) =>
  value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
const range = (low: number, high: number) =>
  formatUsd(low) + (Math.abs(low - high) < 1e-10 ? "" : "–" + formatUsd(high));

export function A02OperatingCost({
  report: suppliedReport,
}: {
  report?: AiModelLabReport;
}) {
  const [stores, setStores] = useState(1);
  const [clients, setClients] = useState(1);
  const [consultant, setConsultant] = useState(true);
  const [extraAttempts, setExtraAttempts] = useState(0);
  const config = useCachedQuery<{ monitor_operation?: MonitorOperation }>(
    "/v1/admin/ai-cost-model",
  );
  const lab = useCachedQuery<{ available: boolean; report?: AiModelLabReport }>(
    suppliedReport ? null : "/v1/admin/ai-model-lab/a02_monitor_negocio",
  );
  const report = suppliedReport ?? lab.data?.report;
  const operation = config.data?.monitor_operation;
  if (!operation || !report)
    return (
      <Banner tone="info" title="Coste operativo A02">
        {config.error || lab.error
          ? "No se pudo cargar la cadencia o los precios del laboratorio. Actualiza la página para calcular; no se sustituye por cero."
          : config.isLoading || lab.isLoading
            ? "Cargando cadencias aplicadas y resultados por modelo…"
            : "Falta la cadencia actual o el informe A02 en este entorno."}
      </Banner>
    );
  const plan = a02OperatingPlan(operation, stores, consultant);
  const costs = a02OperatingCosts(report, plan, clients, extraAttempts);
  const visibleCosts = costs.filter((row) => row.id !== "gpt-6-astra");
  const sol = costs.find((row) => row.id === "gpt-6.1-sol");
  const terra = costs.find((row) => row.id === "gpt-6.1-terra");
  const haiku = costs.find((row) => row.id === "claude-haiku-5-5");
  return (
    <Card>
      <CardHeader>
        <CardTitle>A02: cuánto cuesta mantener las lecturas</CardTitle>
        <CardDescription>
          Dashboards del cliente y panel del consultor, por separado. Demanda
          antes de cupos; no son ejecuciones medidas ni una factura. La
          comparacion con historico real contrasta Overview y Panel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Banner tone="success" title="A02 asignado: GPT-6.1 Terra">
          Terra es el modelo principal para las vistas de cliente y consultor;
          GPT-6.1 Sol queda como fallback ante fallos transitorios sin uso
          registrado. El selector de respuestas abre por defecto Overview con
          ambas respuestas completas para comparar.
        </Banner>
        <Banner tone="info" title="Abrir una pantalla no llama al modelo">
          A02 lee la respuesta guardada. El cron pasa a las 06:00 y 15:00,
          Europe/Madrid. Cliente y consultor pueden leerla muchas veces sin
          regenerarla. No hay generación manual. Cada vista, ventana temporal y
          alcance de tienda tiene su propia caché; el panel del consultor se
          genera aparte.
        </Banner>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Clientes del escenario">
            <Input
              type="number"
              min={1}
              max={10000}
              value={String(clients)}
              onChange={(event) =>
                setClients(
                  Math.max(
                    1,
                    Math.min(
                      10000,
                      Math.trunc(Number(event.target.value) || 1),
                    ),
                  ),
                )
              }
            />
          </Field>
          <Field label="Tiendas activas por cliente">
            <Input
              type="number"
              min={1}
              max={100}
              value={String(stores)}
              onChange={(event) =>
                setStores(
                  Math.max(
                    1,
                    Math.min(100, Math.trunc(Number(event.target.value) || 1)),
                  ),
                )
              }
            />
          </Field>
          <Field label="Consultor asignado">
            <Select
              value={consultant ? "yes" : "no"}
              onChange={(value) => setConsultant(value === "yes")}
              options={[
                { value: "yes", label: "Sí" },
                { value: "no", label: "No" },
              ]}
            />
          </Field>
          <Field label="Intentos adicionales de pago">
            <Select
              value={String(extraAttempts)}
              onChange={(value) => setExtraAttempts(Number(value))}
              options={[
                { value: "0", label: "0 % · escenario base" },
                { value: "10", label: "+10 % · reserva" },
                { value: "100", label: "+100 % · duplicar consumo" },
              ]}
            />
          </Field>
        </div>
        <p className="text-sm">
          Por cliente:{" "}
          <strong>
            {count(plan.client)} lecturas/día del cliente + {count(plan.panel)}{" "}
            del consultor = {count(plan.total)} en total
          </strong>
          , unas {count(plan.total * 30)} al mes. Para {count(clients)}{" "}
          clientes: {count(plan.total * clients * 30)} lecturas/mes antes de
          intentos adicionales.
        </p>
        <DataTable
          ariaLabel="Frecuencias A02 por destinatario, vista y ventana"
          pageSize={7}
          rows={plan.rows.map((row) => ({
            ...row,
            days: row.days + " días",
            daily: count(row.runsPerDay),
            monthly: count(row.runsPerDay * 30),
          }))}
          columns={[
            { key: "audience", label: "Destinatario" },
            { key: "view", label: "Vista" },
            { key: "days", label: "Ventana" },
            { key: "scopes", label: "Cachés" },
            { key: "daily", label: "Lecturas/día" },
            { key: "monthly", label: "Lecturas/mes" },
            { key: "note", label: "Qué se cuenta" },
          ]}
        />
        <p className="text-xs text-muted">
          Mínimos del runtime:{" "}
          {operation.cadences
            .map(
              (row) =>
                row.lookback_days +
                " días cada " +
                row.min_run_age_hours +
                " h",
            )
            .join("; ")}
          . Ajuste de plataforma:{" "}
          {operation.saved_client_runs_per_day === null
            ? "sin ajuste"
            : count(operation.saved_client_runs_per_day)}
          ; referencia {count(operation.design_client_runs_per_day)}. Para
          planificar se redondean intervalos a pasadas de 12 h: 56 h → unas 60
          h. El cron real alterna 9 y 15 h, cuenta desde la finalización y puede
          retrasar también las ventanas diaria y semanal. El panel mantiene{" "}
          {operation.panel_min_run_age_hours} h de mínimo y dos pasadas/día; el
          ajuste del cliente solo lo apaga cuando es cero. Este simulador no
          cambia la programación.
        </p>
        <Banner tone="warn" title="La demanda no garantiza esa frecuencia">
          El cupo de {operation.org_daily_run_cap} ejecuciones/día por
          organización se comparte con todos los agentes. A02 solo encola una
          tienda por pasada para los dashboards. El panel admite hasta 20
          lecturas por pasada para toda la plataforma y va después del ciclo
          principal. Con varias tiendas o clientes se pueden posponer lecturas;
          no se reduce el precio para hacerlas parecer atendidas.
        </Banner>
        <DataTable
          ariaLabel="Coste operativo A02 entre los modelos comparados"
          pageSize={visibleCosts.length}
          rows={visibleCosts.map((row) => ({
            id: row.id,
            model: row.label,
            client: row.available
              ? range(row.clientLow, row.clientHigh)
              : "Uso incompleto",
            consultant: row.available
              ? range(row.panelLow, row.panelHigh)
              : "Uso incompleto",
            daily: row.available
              ? range(row.dailyLow, row.dailyHigh)
              : "Uso incompleto",
            monthly: row.available
              ? range(row.monthlyLow, row.monthlyHigh)
              : "Uso incompleto",
          }))}
          columns={[
            { key: "model", label: "Modelo" },
            { key: "client", label: "Cliente · USD/mes" },
            { key: "consultant", label: "Consultor · USD/mes" },
            { key: "daily", label: "Total · USD/día" },
            { key: "monthly", label: "Total · USD/30 días" },
          ]}
        />
        {sol?.available && terra?.available ? (
          <p className="text-sm">
            Comparación Terra/Sol:{" "}
            <strong>
              Terra {range(terra.monthlyLow, terra.monthlyHigh)} frente a Sol{" "}
              {range(sol.monthlyLow, sol.monthlyHigh)} al mes
            </strong>
            . Ahorro estimado de Terra:{" "}
            {range(
              sol.monthlyLow - terra.monthlyHigh,
              sol.monthlyHigh - terra.monthlyLow,
            )}{" "}
            en este escenario. La decisión de calidad se explica en la ficha
            A02; ningún modelo se asigna desde este simulador.
          </p>
        ) : null}
        {sol?.available && haiku?.available ? (
          <p className="text-sm">
            Sol:{" "}
            <strong>{range(sol.monthlyLow, sol.monthlyHigh)} al mes</strong>.
            Haiku: {range(haiku.monthlyLow, haiku.monthlyHigh)}. Diferencia:{" "}
            {range(
              sol.monthlyLow - haiku.monthlyHigh,
              sol.monthlyHigh - haiku.monthlyLow,
            )}{" "}
            al mes. La calidad observada de Sol hay que contrastarla con este
            gasto; no demuestra rentabilidad comercial sin conocer el precio del
            servicio y los errores evitados.
          </p>
        ) : null}
        <p className="text-xs text-muted">
          Fórmula: suma por vista de (precio de su respuesta × lecturas/día × 30
          × clientes), más la reserva elegida. Usa tokens y precios orientativos
          de las respuestas más recientes de Overview y Panel, con su
          sobrecarga interna. Overview de 30 días
          es un proxy para las ventanas de 7 y 90 días, todavía sin medir. Se
          retira el descuento de lecturas de caché entre pasadas: en OpenAI pasa
          a entrada nueva y en Claude a escritura (intervalo de tarifa de 5
          min/1 h). No es el precio histórico mostrado arriba. La reserva no
          mide reintentos reales: fallos o salidas rechazadas pueden consumir
          tokens y repetirse en el siguiente cron. No se han medido aquí
          search_knowledge, contexto grande ni ejecución API completa. USD, mes
          de 30 días, sin impuestos.
        </p>
        <p className="text-xs text-muted">
          Fuentes: ai-runtime.ts (MONITOR_CADENCES,
          runDiagnosticOrchestratorTickInner y runPanelReadingsPass),
          agent-schedule.ts y worker/repeatable-jobs.ts. Tarifas:{" "}
          <a
            className="underline"
            href="https://developers.openai.com/api/docs/pricing"
          >
            OpenAI
          </a>{" "}
          y{" "}
          <a
            className="underline"
            href="https://platform.claude.com/docs/en/about-claude/pricing"
          >
            Anthropic
          </a>
          , consultadas el 28/10/2026.
        </p>
      </CardContent>
    </Card>
  );
}
