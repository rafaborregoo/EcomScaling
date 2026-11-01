"use client";

import { useEffect, useState } from "react";
import { CopilotCreditPolicy } from "@/components/copilot-credit-policy";
import { MarketingLabPreview } from "./marketing-preview";
import { CampaignPlanPreview } from "./campaign-plan-preview";
import type { AiModelLabReport, AiModelLabResult } from "@e-nora/contracts";
import { A01_MODEL_DECISION, A08_MODEL_DECISION, getAgentModelDecision } from "@e-nora/contracts";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import {
  ScrollArea,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  DataTable,
  EmptyState,
  ErrorBlock,
  Field,
  Link,
  Select,
} from "@/components/ui";
import { useCachedQuery } from "@/lib/use-cached-query";
import { costPerRun, plannedRunsPerDay, type SimModel, type SimProfile } from "../costes-ia/cost-sim";
import { A02OperatingCost } from "./a02-operating-cost";
import { A06StockEvents } from "./a06-stock-events";
import { a02ColdUsage } from "./a02-cost-sim";
import {
  calculateLabApiPrice,
  estimatedApiPrice,
  formatUsd,
} from "./lab-price";
import {
  AGENT_MODEL_ANALYSES,
  AGENT_REVIEWS,
} from "../auditoria-ia/audit-data";

type Payload =
  | { available: false; message: string }
  | { available: true; report: AiModelLabReport };
type CostPayload = {
  models: Array<SimModel & { provider: string }>;
  agents: Array<{
    code: string;
    name: string;
    effective_model: string;
    model_decision: unknown | null;
    scheduled: boolean;
    default_runs_per_day: number;
    additional_runs_per_day?: number;
    saved: { runs_per_day: number | null };
    profile: SimProfile;
  }>;
};
const USD_PER_EUR_REFERENCE = 1.113;
const EUR_REFERENCE_DATE = "29/10/2026";
const stateLabel = {
  pending: "Pendiente",
  running: "En ejecución",
  completed: "Respuesta recibida",
  failed: "Falló",
  blocked: "Bloqueada por cuota",
  skipped: "No ejecutada",
};
const number = (v: number | null) =>
  v === null ? "No informado" : v.toLocaleString("es-ES");
const fieldLabels: Record<string, string> = {
  summary: "Resumen",
  facts: "Hechos",
  decisions: "Decisiones",
  recommendations: "Recomendaciones y prioridad",
  risks: "Riesgos y seguimiento",
  proposed_tasks: "Tareas: alcance, responsable y plazo",
  proposed_campaign_ideas: "Campañas: preparación y permiso",
  proposed_camino_changes: "Cambios del Camino",
  key_quotes: "Citas literales",
  consultant_gaps: "Huecos de consultoría",
  conversation_signals: "Señales y recuentos",
  sources: "Fuentes consultadas",
  confidence: "Confianza declarada",
  warnings: "Advertencias",
};
const fieldVerdict = {
  pass: "Sin fallo detectado",
  fail: "Fallo coincidente",
  uncertain: "Por resolver",
};
const monitorFieldLabels: Record<string, string> = {
  headline: "Titular",
  sections: "Secciones y alcance",
  findings: "Hallazgos",
  severity: "Gravedad",
  evidence: "Evidencia y periodo",
  area: "Área del hallazgo",
  figures: "Cifras y comparaciones",
  recommendation_action: "Acción recomendada",
  recommendation_priority: "Prioridad",
  expected_impact: "Impacto esperado",
  owner: "Responsable",
  sources: "Fuentes",
  confidence: "Confianza declarada",
  warnings: "Advertencias",
  history: "Seguimiento del histórico",
  scope_and_safety: "Alcance y seguridad",
};
const taskFieldLabels: Record<string, string> = {
  answer: "Respuesta",
  proposals: "Propuestas de hoy",
  title: "Título",
  description: "Descripción",
  priority: "Prioridad",
  rationale: "Motivo",
  evidence: "Evidencia",
  ownership: "Responsable",
  due_and_completion: "Plazo y criterio de finalización",
  alignment: "Vinculación con Mi Camino",
  categories: "Canal",
  deduplication: "Duplicados",
  reactivation: "Riesgos descartados",
  sources: "Fuentes",
  confidence_warnings: "Confianza y advertencias",
  safety: "Aprobación y seguridad",
};
const campaignFieldLabels: Record<string, string> = {
  plan_name: "Nombre del plan", diagnosis: "Diagnóstico", planning_window: "Ventana y zona horaria", initiatives: "Iniciativas y abstención", objectives: "Objetivos y métricas", audience: "Audiencia y consentimiento", offer: "Ofertas y descuentos", evidence: "Evidencia y cifras", stock: "Disponibilidad y stock", duplicates: "Duplicados", cadence: "Número y cadencia de envíos", channel_structure: "Canales y estructura", action_briefs: "Ficha de cada acción", sources: "Fuentes y conocimiento", confidence_warnings: "Confianza y advertencias", approval_safety: "Aprobación y seguridad",
};
const stockFieldLabels: Record<string, string> = {
  answer: "Resumen", findings: "Hallazgos", forecasts: "Previsión de demanda", inventory: "Fiabilidad del inventario", coverage: "Cobertura de stock", data_freshness: "Antigüedad de los datos", missing_values: "Datos ausentes", priority: "Prioridad", tasks: "Tareas propuestas", product_ids: "Producto y vínculo", duplicates: "Duplicados", recommendations: "Recomendaciones", sources: "Fuentes", confidence: "Confianza", warnings: "Advertencias", approval_safety: "Aprobación y seguridad",
};
const when = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })
    : "Sin contexto guardado";

function LabSystemSummary() {
  const query = useCachedQuery<CostPayload>("/v1/admin/ai-cost-model");
  if (!query.data) return null;
  const { models, agents } = query.data;
  const selected = agents.filter((agent) => agent.model_decision);
  const modelById = new Map(models.map((model) => [model.id, model]));
  const pending: string[] = [];
  let monthlyUsd = 0;
  for (const agent of selected) {
    const model = modelById.get(agent.effective_model);
    if (!model) {
      pending.push(agent.name);
      continue;
    }
    const runsPerDay = agent.saved.runs_per_day ?? agent.default_runs_per_day;
    // Las ejecuciones iniciadas por personas no tienen frecuencia mensual
    // configurada en Costes de IA; no se inventa una para cerrar el total.
    if (!agent.scheduled) {
      pending.push(agent.name);
      continue;
    }
    const projectedRuns = plannedRunsPerDay(agent.code, runsPerDay, agent.additional_runs_per_day);
    monthlyUsd += costPerRun(agent.profile, model) * projectedRuns * 30;
  }
  const monthlyEur = monthlyUsd / USD_PER_EUR_REFERENCE;
  const formattedEur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(monthlyEur);
  return (
    <section className="grid gap-4 rounded-xl border border-line bg-surface p-5 sm:grid-cols-2" aria-label="Uso y coste mensual estimado de IA">
      <div>
        <p className="text-sm text-muted">Agentes con modelo decidido</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{selected.length}</p>
        <p className="mt-1 text-xs text-muted">Modelos fijados para el runtime.</p>
      </div>
      <div>
        <p className="text-sm text-muted">Coste mensual programado · por cliente y tienda</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{pending.length ? `≥ ${formattedEur}` : formattedEur}</p>
        <p className="mt-1 text-xs text-muted">
          {pending.length
            ? `Subtotal de frecuencias programadas; falta definir uso manual de ${pending.join(", ")}.`
            : "Estimación con modelo, tokens y ejecuciones/día configuradas; no es gasto facturado."}
          {` Conversión orientativa BCE ${EUR_REFERENCE_DATE} (1 € = ${USD_PER_EUR_REFERENCE} $).`}
        </p>
        <Link href="/admin/costes-ia" className="mt-2 inline-block text-sm">Ajustar frecuencias y modelos en Costes de IA</Link>
      </div>
    </section>
  );
}

function ReadableValue({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}) {
  const labels: Record<string, string> = {
    title: "Asunto",
    description: "Detalle",
    severity: "Importancia",
    evidence: "Evidencia",
    source: "Fuente",
    rationale: "Motivo",
    action: "Acción",
    priority: "Prioridad",
    recommendation: "Recomendación",
    confidence: "Confianza",
    section: "Área",
    owner: "Responsable",
    expected_impact: "Impacto esperado",
    figures: "Cifras",
    value: "Valor",
    previous: "Periodo anterior",
    change_pct: "Variación %",
    kind: "Tipo",
    reference: "Referencia",
    period: "Periodo",
    area: "Área",
  };
  if (typeof value === "string") {
    if (depth === 0) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(value);
      } catch {
        /* Texto original. */
      }
      if (parsed && typeof parsed === "object")
        return <ReadableValue value={parsed} depth={1} />;
    }
    return <span className="whitespace-pre-wrap break-words">{value}</span>;
  }
  if (value === null || value === undefined) return <span>Sin dato</span>;
  if (depth > 3)
    return <span className="break-words">{JSON.stringify(value)}</span>;
  if (Array.isArray(value))
    return (
      <ul className="list-disc space-y-1 pl-4">
        {value.map((item, i) => (
          <li key={i}>
            <ReadableValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  if (typeof value === "object")
    return (
      <dl className="space-y-2">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt className="font-medium">
              {labels[key] ?? key.replaceAll("_", " ")}
            </dt>
            <dd className="text-muted">
              <ReadableValue value={item} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return <span>{String(value)}</span>;
}

function ResultPanel({
  result,
  label,
}: {
  result?: AiModelLabResult;
  label: string;
}) {
  return (
    <article className="min-w-0 space-y-4 rounded-xl border border-line bg-surface p-5">
      <h3 className="text-lg font-semibold">{label}</h3>
      {!result ? (
        <p>Selecciona un modelo con resultados.</p>
      ) : (
        <>
          <Badge
            tone={
              result.status === "completed"
                ? "neutral"
                : result.status === "failed" || result.status === "blocked"
                  ? "danger"
                  : "neutral"
            }
          >
            {stateLabel[result.status]}
          </Badge>
          <p className="text-xs text-muted">
            {result.model_verified
              ? `Modelo confirmado por CLI: ${result.actual_model}`
              : `Solicitado: ${result.model_id}. La CLI no confirma el ID servido.`}
          </p>
          {result.error ? <Banner tone="warn">{result.error}</Banner> : null}
          {result.case_id.startsWith("a11_generador_marketing:") ? <MarketingLabPreview result={result} /> : null}
          {result.case_id.startsWith("a05_estrategia_campanas:") ? <CampaignPlanPreview result={result} /> : null}
          {result.field_assessment ? (
            <Accordion>
              <AccordionItem value="fields">
                <AccordionTrigger>Revisión de cada campo</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 text-sm">
                    {result.field_assessment.checks.map((check) => (
                      <div
                        key={check.id}
                        className="space-y-1 border-b border-line pb-3"
                      >
                        <p className="font-medium">
                          {fieldLabels[check.id] ??
                            monitorFieldLabels[check.id] ??
                            taskFieldLabels[check.id] ??
                            campaignFieldLabels[check.id] ??
                            stockFieldLabels[check.id] ??
                            check.id}
                          : {fieldVerdict[check.status]}
                        </p>
                        <p className="text-xs text-muted">
                          {check.description}
                        </p>
                        {check.adjudication ? (
                          <p className="text-xs text-muted">
                            Revisión de fuente y aritmética:{" "}
                            {check.adjudication.note} Veredicto automático
                            original:{" "}
                            {fieldVerdict[check.adjudication.original_status]}.
                            Se conservan las notas originales debajo.
                          </p>
                        ) : null}
                        {check.judgments.map((judgment) => (
                          <p key={judgment.reviewer} className="text-xs">
                            {judgment.reviewer}: {judgment.note}
                            {judgment.output_quote
                              ? ` · «${judgment.output_quote}»`
                              : ""}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
          {result.meeting_assessment ? (
            <div className="rounded-lg border border-line p-3 text-sm">
              <p className="font-medium">Referencia de esta reunión</p>
              <p>
                {
                  result.meeting_assessment.checks.filter(
                    (x) => x.status === "pass",
                  ).length
                }{" "}
                criterios coincidentes ·{" "}
                {
                  result.meeting_assessment.checks.filter(
                    (x) => x.status === "fail",
                  ).length
                }{" "}
                fallos coincidentes ·{" "}
                {
                  result.meeting_assessment.checks.filter(
                    (x) => x.status === "uncertain",
                  ).length
                }{" "}
                por resolver
              </p>
            </div>
          ) : null}
          {result.normalized.summary ? (
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {result.normalized.summary}
            </div>
          ) : (
            <EmptyState size="sm" title="Todavía no hay una respuesta disponible." />
          )}
          {(
            [
              ["Hallazgos", result.normalized.findings],
              ["Propuestas", result.normalized.recommendations],
              ["Límites que declara el modelo", result.normalized.warnings],
            ] as const
          ).map(([title, items]) =>
            items.length ? (
              <div key={title} className="space-y-2">
                <h4 className="font-semibold">{title}</h4>
                <ul className="list-disc space-y-2 pl-5 text-sm">
                  {items.map((text, i) => (
                    <li key={i} className="break-words">
                      <ReadableValue value={text} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          <div className="border-t border-line pt-4 text-sm">
            <strong>
              Revisión del contenido
              {result.review.method === "automated" ? " · automática" : ""}:
            </strong>{" "}
            {result.review.status === "pending"
              ? "Pendiente. Respuesta recibida no significa modelo aprobado."
              : result.review.verdict}
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.review.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
          {result.meeting_assessment ? (
            <Accordion>
              <AccordionItem value="meeting-evaluation">
                <AccordionTrigger>
                  Comprobación de la reunión con referencia
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    {result.meeting_assessment.checks.map((check) => (
                      <article
                        key={check.id}
                        className="rounded-lg border border-line p-3 text-sm"
                      >
                        <p className="font-medium">
                          {check.status === "pass"
                            ? "Coincide"
                            : check.status === "fail"
                              ? "No coincide"
                              : "Duda entre revisores"}
                          : {check.description}
                        </p>
                        <p className="mt-1 text-muted">
                          Referencia: «{check.reference_quote}»
                        </p>
                        {check.judgments.map((judgment) => (
                          <p
                            key={judgment.reviewer}
                            className="mt-1 text-xs text-muted"
                          >
                            {judgment.reviewer}: {judgment.status}
                            {judgment.output_quote
                              ? ` · cita: «${judgment.output_quote}»`
                              : ""}
                            {judgment.note ? ` · ${judgment.note}` : ""}
                          </p>
                        ))}
                      </article>
                    ))}
                    <p className="text-xs text-muted">
                      Dos jueces automáticos compararon candidatos anónimos con
                      los puntos de control congelados antes de las llamadas.
                      Las citas se validaron contra la salida. Esto no sustituye
                      revisión humana.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
          <Accordion>
            <AccordionItem value="original">
              <AccordionTrigger>
                Ver respuesta original y datos de ejecución
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-xs">
                  <p>
                    Duración total CLI:{" "}
                    {result.duration_ms === null
                      ? "Pendiente"
                      : `${(result.duration_ms / 1000).toFixed(1)} s`}{" "}
                    · {result.cli_version ?? "Versión pendiente"}
                  </p>
                  <p>
                    Entrada: {number(result.usage.input)} · caché leída:{" "}
                    {number(result.usage.cached)} · caché creada:{" "}
                    {number(result.usage.cache_creation)} · salida:{" "}
                    {number(result.usage.output)}
                  </p>
                  <p>
                    Coste indicado por CLI:{" "}
                    {result.provider_reported_cost === null
                      ? "No informado"
                      : `$${result.provider_reported_cost.toFixed(5)}`}
                    . Es un dato orientativo de la CLI, no una factura ni un
                    coste API validado.
                  </p>
                  <p>
                    Contrato nativo local:{" "}
                    {result.checks.native_contract === null
                      ? "no evaluado en esta tanda"
                      : result.checks.native_contract
                        ? "validación aprobada"
                        : "validación fallida"}
                    . Sigue pendiente la validación en runtime. Herramientas de
                    E-NORA ejecutadas: ninguna en esta fase.
                  </p>
                  <ScrollArea className="max-h-[32rem] rounded-lg bg-background p-3"><pre className="whitespace-pre-wrap break-words">
                    {result.raw_response || "Sin salida"}
                  </pre></ScrollArea>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </article>
  );
}

function AgentResults({
  report,
  code,
}: {
  report: AiModelLabReport;
  code: string;
}) {
  const decision = getAgentModelDecision(code);
  const fallbackModel =
    decision && "fallbackModel" in decision ? decision.fallbackModel : null;
  const [left, setLeft] = useState(
    decision?.model ??
      (["a04_generador_tareas", "a05_estrategia_campanas", "a06_planificador_stock"].includes(code) &&
      report.models.some((model) => model.id === "gpt-6.1-sol")
        ? "gpt-6.1-sol"
        : report.models[0]!.id),
  );
  const [right, setRight] = useState(
    code === "a05_estrategia_campanas" &&
      report.models.some((model) => model.id === "claude-sonnet-5-5")
      ? "claude-sonnet-5-5"
      : fallbackModel && report.models.some((model) => model.id === fallbackModel)
      ? fallbackModel
      : code === "a04_generador_tareas" && report.models.some((model) => model.id === "gpt-6.1-sol")
      ? "gpt-6.1-sol"
      : ["a02_monitor_negocio", "a05_estrategia_campanas", "a06_planificador_stock"].includes(code) &&
      report.models.some((model) => model.id === "gpt-6.1-terra")
      ? "gpt-6.1-terra"
      : report.models[1]!.id,
  );
  const cases = report.cases.filter((c) => c.agent_code === code);
  const [caseId, setCaseId] = useState(
    (code === "a05_estrategia_campanas"
      ? cases.find((c) => c.id.includes("clean-runtime-v2-2026-10-31")) ??
        cases.find((c) => c.id.includes("real-store-two-months-v2")) ??
        cases.find((c) => c.id.includes("real-store-two-months")) ??
        cases.find((c) => c.id.includes("native-historico"))
      : code === "a02_monitor_negocio"
        ? cases.find((c) => c.id.includes("real-store-history-overview"))
        : code === "a06_planificador_stock"
          ? cases.find((c) => c.id === "a06_planificador_stock:real-store-runtime-2026-10-31")
        : code === "a08_gestor_conocimiento"
          ? cases.find((c) => c.id === "a08_gestor_conocimiento:real-org-methodology-runtime-2026-10-31")
        : null)?.id ??
      [...cases].reverse().find((c) => c.source !== "missing_data")?.id ??
      cases[0]!.id,
  );
  const c = cases.find((c) => c.id === caseId) ?? cases[0]!;
  const purpose = AGENT_REVIEWS.find((r) => r.code === code);
  const analysis = AGENT_MODEL_ANALYSES[code];
  const activeFieldLabels = c.stock_benchmark
    ? stockFieldLabels
    : c.campaign_benchmark
    ? campaignFieldLabels
    : c.task_benchmark
    ? taskFieldLabels
    : c.monitor_benchmark
      ? monitorFieldLabels
      : fieldLabels;
  const longMeetingCases = cases.filter((item) => item.meeting_benchmark);
  const monitorCases = cases.filter((item) => item.monitor_benchmark);
  const realStoreMonitorCases = monitorCases.filter((item) =>
    item.id.includes("real-store"),
  );
  const historyStoreMonitorCases = realStoreMonitorCases.filter((item) =>
    item.id.includes("real-store-history"),
  );
  const taskCases = cases.filter((item) => item.task_benchmark);
  const caseModels = report.models.filter(
    (model) => ((code !== "a11_generador_marketing" && code !== "a05_estrategia_campanas") || model.id !== "gpt-6-astra") && (!c.model_ids || c.model_ids.includes(model.id)),
  );
  const options = caseModels.map((m) => ({ value: m.id, label: m.label }));
  const rows = caseModels.map((m) => ({
    ...m,
    result: report.results.find(
      (r) => r.case_id === c.id && r.model_id === m.id,
    ),
  }));
  return (
    <div className="space-y-7">
      {code === "a09_copiloto_consultor" ? <CopilotCreditPolicy /> : null}
      {code === "a11_generador_marketing" ? <Banner tone="info" title="A11 · La elección final queda pendiente de tu revisión">
        Compara los seis modelos con el mismo caso. Revisa el diseño y el texto, si respetan la marca y los datos, y después el precio de la tabla. A11 se ejecuta al solicitar una pieza: no hay 30 ejecuciones diarias automáticas. La referencia actual de Costes es de cuatro generaciones al mes, una hipótesis que debes ajustar al uso real.
      </Banner> : null}
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{c.agent_name}</h2>
        <p className="max-w-3xl text-sm text-muted">
          {purpose?.job ?? code}.{" "}
          {purpose?.reads ? `Lee: ${purpose.reads}.` : ""}
        </p>
      </div>
      {cases.length > 1 ? (
        <Field label="Caso de prueba">
          <Select
            value={c.id}
            onChange={(value) => {
              setCaseId(value);
              const selected = cases.find((item) => item.id === value);
              const allowed = report.models.filter(
                (model) =>
                  !selected?.model_ids || selected.model_ids.includes(model.id),
              );
              if (!allowed.some((model) => model.id === left))
                setLeft(allowed[0]!.id);
              if (!allowed.some((model) => model.id === right))
                setRight(
                  allowed.find((model) => model.id !== left)?.id ??
                    allowed[0]!.id,
                );
            }}
            options={cases.map((item) => ({
              value: item.id,
              label:
                item.label ??
                (item.source === "missing_data"
                  ? "Datos ausentes · comprobar abstención"
                  : `${item.source === "call_transcript" ? "Transcripción real" : "Contexto guardado"} · ${when(item.snapshot_at)}`),
            }))}
          />
        </Field>
      ) : null}
      <Banner
        tone={c.source === "missing_data" ? "warn" : "info"}
        title={
          c.source === "synthetic_snapshot"
            ? "Escenario sintético; sus cifras no son datos reales de la tienda"
            : c.source === "synthetic_transcript"
              ? "Transcripción sintética para medir longitud; no es una grabación"
              : c.source === "missing_data"
                ? "Solo podemos probar abstención por falta de datos"
                : "Los modelos previstos reciben la misma entrada guardada"
        }
      >
        {c.meeting_benchmark
          ? `${c.meeting_benchmark.simulated_minutes} min nominales · ${c.meeting_benchmark.transcript_words.toLocaleString("es-ES")} palabras · ${c.meeting_benchmark.speaker_count} interlocutores · ${c.meeting_benchmark.turn_count} turnos. Duración estimada por carga de texto; no se midió audio. Las tres longitudes parten de una misma plantilla con controles repetidos, así que no representan la variedad de reuniones reales. `
          : `Contexto del ${when(c.snapshot_at)}. `}
        {c.source === "synthetic_snapshot"
          ? "Las cifras son ficticias y se usan para probar reglas; no describen el estado real de la tienda. "
          : ""}
        Se compara el prompt {c.prompt_version} sobre{" "}
        {c.input_characters.toLocaleString("es-ES")} caracteres. Las respuestas
        se muestran sin corregirlas.
      </Banner>
      {analysis ? (
        <section
          className="space-y-3 rounded-xl border border-line bg-surface p-5"
          aria-labelledby="agent-analysis-title"
        >
          <h3 id="agent-analysis-title" className="text-lg font-semibold">
            Lectura de este agente
          </h3>
          <p className="font-medium">{analysis.heading}</p>
          <p className="text-sm text-muted">{analysis.evidence}</p>
          <p className="text-sm">{analysis.unresolved}</p>
          {analysis.taskReview?.length ? (
            <div className="grid gap-2 pt-2 sm:grid-cols-2">
              {analysis.taskReview.map((item) => (
                <div key={item.scenario} className="rounded-lg border border-line p-3">
                  <p className="text-sm font-medium">{item.scenario}</p>
                  <p className="mt-1 text-sm text-muted">{item.detail}</p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <Banner tone="info" title="Análisis individual pendiente">
          Iremos agente por agente. Esta ficha muestra los resultados previstos,
          pero todavía no asigna un mejor o peor modelo.
        </Banner>
      )}
      {code === "a02_monitor_negocio" ? (
        <A02OperatingCost report={report} />
      ) : null}
      {code === "a08_gestor_conocimiento" ? (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
          <h3 className="text-lg font-semibold">Coste de la auditoría de conocimiento</h3>
          <p className="text-sm text-muted">A08 se ejecuta manualmente para la organización. Abrir el resultado desde otra cuenta no genera otra auditoría. No tiene un gasto mensual fijo: se multiplica el coste por las ejecuciones solicitadas.</p>
          <DataTable ariaLabel="Coste por modelo A08" pageSize={caseModels.length} rows={caseModels.map((model) => {
            const result = report.results.find((row) => row.case_id === c.id && row.model_id === model.id && row.status === "completed");
            const usage = result?.usage;
            const input = usage && usage.input !== null && usage.cached !== null && usage.cache_creation !== null
              ? model.provider === "anthropic" ? usage.input + usage.cached + usage.cache_creation : usage.input : null;
            const price = result && input !== null ? calculateLabApiPrice(model.id, { ...result.usage, input, cached: 0, cache_creation: 0 }) : null;
            return { id: model.id, model: model.label, perRun: price ? formatUsd(price.low) : "Pendiente", four: price ? formatUsd(price.low * 4) : "Pendiente", thirty: price ? formatUsd(price.low * 30) : "Pendiente" };
          })} columns={[{ key: "model", label: "Modelo" }, { key: "perRun", label: "1 ejecución · USD" }, { key: "four", label: "4 ejecuciones · USD" }, { key: "thirty", label: "30 ejecuciones · USD" }]} />
          <p className="text-xs text-muted">Equivalencias API con tokens CLI y tarifas internas de referencia del 28/10/2026, sin caché. Los escenarios de 4 y 30 ejecuciones no son una frecuencia programada. Herramientas, embeddings, reintentos y fallback se calculan aparte. No son cargos facturados.</p>
        </section>
      ) : null}
      {code === "a05_estrategia_campanas" ? (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
          <h3 className="text-lg font-semibold">Coste orientativo por modelo</h3>
          <p className="text-sm text-muted">Estimación de 30 generaciones manuales, con los tres escenarios nativos y sin descuento de caché. A05 es manual: no es una frecuencia mensual real ni un gasto facturado.</p>
          <DataTable ariaLabel="Comparación mensual A05" pageSize={caseModels.length} rows={caseModels.map((model) => {
            const samples = report.results.filter((result) => result.model_id === model.id && report.cases.some((item) => item.agent_code === code && item.schema_file && item.id === result.case_id && !item.campaign_benchmark?.scenario?.startsWith("two_month_window_real_test_store")));
            const prices = samples.map((result) => {
              const usage = result.usage;
              if (usage.input === null || usage.cached === null || usage.cache_creation === null) return null;
              const input = model.provider === "anthropic" ? usage.input + usage.cached + usage.cache_creation : usage.input;
              return calculateLabApiPrice(model.id, { ...usage, input, cached: 0, cache_creation: 0 });
            });
            const checks = samples.flatMap((result) => result.field_assessment?.checks ?? []);
            return { id: model.id, model: model.label, valid: `${samples.filter((result) => result.checks.native_contract === true).length}/${samples.length}`, fields: checks.length === 48 ? `${checks.filter((check) => check.status === "pass").length} / ${checks.filter((check) => check.status === "fail").length} / ${checks.filter((check) => check.status === "uncertain").length}` : `${checks.length}/48 revisados`, monthly: samples.length === 3 && prices.every((price) => price !== null) ? formatUsd(prices.reduce((sum, price) => sum + (price?.low ?? 0), 0) / samples.length * 30) : "Pendiente" };
          })} columns={[{ key: "model", label: "Modelo" }, { key: "valid", label: "Contrato válido" }, { key: "fields", label: "Sin fallo / fallos coincidentes / dudas" }, { key: "monthly", label: "30 generaciones · USD/mes" }]} />
          <p className="text-xs text-muted">Se comparan los seis modelos acordados, sin Astra. Los recuentos de campos requieren una revisión guardada y no son porcentajes de precisión. El replay histórico es de octubre y no sirve para lanzar acciones actuales.</p>
        </section>
      ) : null}
      {code === "a06_planificador_stock" ? (
        <A06StockEvents report={report} />
      ) : null}
      {code === "a06_planificador_stock" ? (
        <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
          <h3 className="text-lg font-semibold">Pruebas de stock y coste orientativo</h3>
          <p className="text-sm text-muted">Escenario comparable de 30 análisis al mes por tienda, sin caché; no es una frecuencia medida ni obligatoria. El cron depende de actividad, propuestas pendientes y cupos. El piloto de eventos puede añadir análisis durante el día. Las ejecuciones manuales, herramientas y reintentos se calculan aparte. Los casos tienen el mismo peso, no representan frecuencia observada.</p>
          {(() => {
            const a06ModelIds = new Set(report.cases.filter((item) => item.stock_benchmark).flatMap((item) => item.model_ids ?? []));
            const a06Models = report.models.filter((model) => a06ModelIds.has(model.id));
            return <DataTable ariaLabel="Comparación mensual A06" pageSize={a06Models.length} rows={a06Models.map((model) => {
            const samples = report.results.filter((result) => result.model_id === model.id && report.cases.some((item) => item.stock_benchmark && !item.stock_benchmark.scenario.startsWith("event_") && item.id === result.case_id));
            const prices = samples.map((result) => {
              const u = result.usage;
              if (u.input === null || u.cached === null || u.cache_creation === null) return null;
              return calculateLabApiPrice(model.id, { ...u, input: model.provider === "anthropic" ? u.input + u.cached + u.cache_creation : u.input, cached: 0, cache_creation: 0 });
            });
            const checks = samples.flatMap((result) => result.field_assessment?.checks ?? []);
            return { id: model.id, model: model.label, valid: `${samples.filter((result) => result.checks.native_contract === true).length}/${samples.length}`, fields: checks.length === 64 ? `${checks.filter((check) => check.status === "pass").length} / ${checks.filter((check) => check.status === "fail").length} / ${checks.filter((check) => check.status === "uncertain").length}` : `${checks.length}/64 revisados`, monthly: samples.length === 4 && prices.every((price) => price !== null) ? formatUsd(prices.reduce((sum, price) => sum + (price?.low ?? 0), 0) / samples.length * 30) : "Pendiente" };
          })} columns={[{ key: "model", label: "Modelo" }, { key: "valid", label: "Contrato válido" }, { key: "fields", label: "Sin fallo / fallos coincidentes / dudas" }, { key: "monthly", label: "30 ejecuciones · USD/mes" }]} />;
          })()}
          <p className="text-xs text-muted">Revisores automáticos, también candidatos; los campos no son porcentajes de precisión. Codex no confirma el ID servido.</p>
        </section>
      ) : null}
      {longMeetingCases.length ? (
        <section className="space-y-3" aria-labelledby="long-meetings-title">
          <h3 id="long-meetings-title" className="text-lg font-semibold">
            Prueba de reuniones largas de A01
          </h3>
          <p className="text-sm text-muted">
            Transcripciones simuladas de varias personas; la duración se estima
            por carga de texto. No son grabaciones y no evalúan audio ni
            reconocimiento de interlocutores. Cada modelo recibe los mismos
            hechos de control y el contrato JSON del agente.
          </p>
          <DataTable
            ariaLabel="Casos simulados de A01 por longitud"
            rows={longMeetingCases.map((item) => {
              const results = report.results.filter(
                (result) => result.case_id === item.id,
              );
              return {
                id: item.id,
                duration: `${item.meeting_benchmark!.simulated_minutes} min nominales`,
                words: `${item.meeting_benchmark!.transcript_words.toLocaleString("es-ES")} palabras`,
                participants: item.meeting_benchmark!.speaker_count,
                turns: item.meeting_benchmark!.turn_count,
                contracts: `${results.filter((result) => result.checks.native_contract === true).length} / ${results.length}`,
                judged: `${results.filter((result) => result.meeting_assessment).length} / ${results.length}`,
                status: `${results.filter((result) => result.status === "completed").length} / ${results.length}`,
              };
            })}
            pageSize={3}
            columns={[
              { key: "duration", label: "Escenario" },
              { key: "words", label: "Carga de texto" },
              { key: "participants", label: "Personas" },
              { key: "turns", label: "Turnos" },
              { key: "contracts", label: "Contrato válido" },
              { key: "judged", label: "Evaluación de referencia" },
              { key: "status", label: "Respuestas" },
            ]}
          />
        </section>
      ) : null}
      {monitorCases.length ? (
        <section className="space-y-3" aria-labelledby="monitor-cases-title">
          <h3 id="monitor-cases-title" className="text-lg font-semibold">
            Casos y cobertura de A02
          </h3>
          <p className="text-sm text-muted">
            Hay casos historicos y sinteticos anteriores, mas dos casos nuevos con datos actuales e historico de seis meses de TEST de E-NORA Demo: Overview de cliente y Panel del consultor. Cada caso compara los modelos indicados con el mismo contrato JSON. Las simulaciones CLI no ejecutan herramientas ni crean tareas.
          </p>
          <DataTable
            ariaLabel="Casos del Monitor de negocio por vista"
            rows={monitorCases.map((item) => {
              const results = report.results.filter(
                (result) => result.case_id === item.id,
              );
              return {
                id: item.id,
                scope: item.monitor_benchmark!.dashboard_scope,
                source:
                  item.source === "synthetic_snapshot"
                    ? "Sintetico controlado"
                    : item.source === "read_only_query"
                      ? item.id.includes("real-store-history")
                        ? "Snapshot + historico - TEST"
                        : "Snapshot real - TEST"
                      : "Snapshot real historico",
                completed:
                  results.filter((result) => result.status === "completed")
                    .length +
                  "/" +
                  (item.model_ids?.length ?? report.models.length),
                native:
                  results.filter(
                    (result) => result.checks.native_contract === true,
                  ).length +
                  "/" +
                  (item.model_ids?.length ?? report.models.length),
                reviewed:
                  results.filter(
                    (result) =>
                      result.field_assessment?.judges.length === 2 &&
                      result.field_assessment.judges.every(
                        (judge) => judge.status === "completed",
                      ),
                  ).length +
                  "/" +
                  (item.model_ids?.length ?? report.models.length),
              };
            })}
            pageSize={monitorCases.length}
            columns={[
              { key: "scope", label: "Vista" },
              { key: "source", label: "Datos" },
              { key: "completed", label: "Respuestas" },
              { key: "native", label: "Contrato válido" },
              { key: "reviewed", label: "Revisión por campos" },
            ]}
          />
          <p className="text-sm font-medium">
            Comparacion de E-NORA Demo con historico de seis meses - 1 lectura cliente +
            1 lectura consultor
          </p>
          <DataTable
            ariaLabel="Comparación A02 con snapshot real de TEST"
            rows={report.models
              .filter((model) =>
                historyStoreMonitorCases.some(
                  (item) => !item.model_ids || item.model_ids.includes(model.id),
                ),
              )
              .map((model) => {
              const results = report.results.filter(
                (result) =>
                  result.model_id === model.id &&
                  historyStoreMonitorCases.some((item) => item.id === result.case_id),
              );
              const checks = results.flatMap(
                (result) => result.field_assessment?.checks ?? [],
              );
              const prices = results.map((result) =>
                calculateLabApiPrice(model.id, result.usage),
              );
              const completePrices = prices.filter((price) => price !== null);
              const low = completePrices.reduce(
                (total, price) => total + price.low,
                0,
              );
              const high = completePrices.reduce(
                (total, price) => total + price.high,
                0,
              );
              const durations = results.flatMap((result) =>
                result.duration_ms === null ? [] : [result.duration_ms / 1000],
              );
              return {
                id: model.id,
                model: model.label,
                pass: checks.filter((check) => check.status === "pass").length,
                fail: checks.filter((check) => check.status === "fail").length,
                uncertain: checks.filter(
                  (check) => check.status === "uncertain",
                ).length,
                reviewed: checks.length + "/" + historyStoreMonitorCases.length * 16,
                price:
                  completePrices.length === results.length && results.length
                    ? formatUsd(low) +
                      (low === high ? "" : "–" + formatUsd(high))
                    : "Uso incompleto",
                time: durations.length
                  ? Math.round(Math.min(...durations)) +
                    "–" +
                    Math.round(Math.max(...durations)) +
                    " s"
                  : "Pendiente",
              };
              })}
            pageSize={6}
            columns={[
              { key: "model", label: "Modelo" },
              { key: "pass", label: "Checks superados" },
              { key: "fail", label: "Checks fallidos" },
              { key: "uncertain", label: "Dudas" },
              { key: "reviewed", label: "Campos revisados" },
              { key: "price", label: "USD - Overview + Panel historico" },
              { key: "time", label: "Duración observada CLI" },
            ]}
          />
          <p className="text-xs text-muted">
            La tabla suma una lectura Overview y otra Panel con historico por modelo; el coste
            aplica tarifas API publicadas a los tokens CLI y no es una factura.
            Los checks son campos revisados, no porcentajes de precisión.
            Sonnet y Sol también participan como revisores automáticos, así que
            la evaluación no es independiente. Codex CLI no verifica el ID
            servido de OpenAI. La duración observada no es un p95.
          </p>
        </section>
      ) : null}
      {taskCases.length ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">
            A04: cuatro situaciones para los siete modelos
          </h3>
          <p className="text-sm text-muted">
            Un snapshot real histórico y tres casos sintéticos: urgencia que una
            tarea tardía no cubre, riesgo ya cubierto y reactivación con
            evidencia nueva. Las propuestas se evalúan sin ejecutarlas ni
            aprobarlas.
          </p>
          <DataTable
            ariaLabel="Cobertura de A04 por escenario"
            pageSize={4}
            rows={taskCases.map((item) => {
              const results = report.results.filter(
                (result) => result.case_id === item.id,
              );
              const total = item.model_ids?.length ?? report.models.length;
              return {
                id: item.id,
                case: item.label,
                source:
                  item.source === "synthetic_snapshot"
                    ? "Sintético"
                    : "Histórico real",
                done:
                  results.filter((result) => result.status === "completed")
                    .length +
                  "/" +
                  total,
                native:
                  results.filter(
                    (result) => result.checks.native_contract === true,
                  ).length +
                  "/" +
                  total,
                reviewed:
                  results.filter(
                    (result) =>
                      result.field_assessment?.judges.length === 2 &&
                      result.field_assessment.judges.every(
                        (judge) => judge.status === "completed",
                      ),
                  ).length +
                  "/" +
                  total,
              };
            })}
            columns={[
              { key: "case", label: "Escenario" },
              { key: "source", label: "Datos" },
              { key: "done", label: "Respuestas" },
              { key: "native", label: "Contrato válido" },
              { key: "reviewed", label: "Evaluaciones" },
            ]}
          />
          <DataTable
            ariaLabel="Balance A04 por modelo"
            pageSize={report.models.length}
            rows={report.models.map((model) => {
              const results = report.results.filter(
                (result) =>
                  result.model_id === model.id &&
                  taskCases.some((item) => item.id === result.case_id),
              );
              const checks = results.flatMap(
                (result) => result.field_assessment?.checks ?? [],
              );
              const prices = results.map((result) =>
                calculateLabApiPrice(model.id, result.usage),
              );
              const ready = prices.filter((price) => price !== null);
              const coldPrices = results
                .map((result) =>
                  calculateLabApiPrice(
                    model.id,
                    a02ColdUsage(model.id, result.usage),
                  ),
                )
                .filter((price) => price !== null);
              const monthlyLow =
                (coldPrices.reduce((sum, price) => sum + price.low, 0) /
                  results.length) *
                60;
              const monthlyHigh =
                (coldPrices.reduce((sum, price) => sum + price.high, 0) /
                  results.length) *
                60;
              const low =
                ready.reduce((sum, price) => sum + price.low, 0) /
                results.length;
              const high =
                ready.reduce((sum, price) => sum + price.high, 0) /
                results.length;
              return {
                id: model.id,
                model: model.label,
                pass: checks.filter((check) => check.status === "pass").length,
                fail: checks.filter((check) => check.status === "fail").length,
                uncertain: checks.filter(
                  (check) => check.status === "uncertain",
                ).length,
                reviewed: checks.length + "/64",
                price:
                  ready.length === taskCases.length
                    ? formatUsd(low) +
                      (low === high ? "" : "–" + formatUsd(high))
                    : "Uso incompleto",
                monthly:
                  coldPrices.length === taskCases.length
                    ? formatUsd(monthlyLow) +
                      (monthlyLow === monthlyHigh
                        ? ""
                        : "–" + formatUsd(monthlyHigh))
                    : "Uso incompleto",
              };
            })}
            columns={[
              { key: "model", label: "Modelo" },
              { key: "pass", label: "Sin fallo detectado" },
              { key: "fail", label: "Fallo coincidente" },
              { key: "uncertain", label: "Por resolver" },
              { key: "reviewed", label: "Campos revisados" },
              { key: "price", label: "Precio medio orientativo · USD" },
              { key: "monthly", label: "Escenario 60 ejecuciones · USD/mes" },
            ]}
          />
          <p className="text-xs text-muted">
            Las cifras son comprobaciones por campo, no porcentajes de
            precisión; la tarifa se aplica a tokens CLI, con caché y sobrecarga
            variables. El escenario mensual supone una ejecución diaria para la
            organización y otra para una tienda durante 30 días, sin refrescos
            manuales ni caché entre pasadas. A04 también admite ejecución
            manual; la actividad, las aprobaciones pendientes, los límites y el
            cron pueden cambiar la frecuencia. La media asigna el mismo peso a
            cuatro casos, no es un perfil real de producción. Los evaluadores
            automáticos también son candidatos y no se ha probado la API real.
          </p>
          <Banner
            tone="warn"
            title="Los refrescos manuales no están incluidos en el escenario"
          >
            A04 dispone de regeneración manual. El límite predeterminado de
            pruebas es 1.000 usos diarios por organización y agente si no hay un
            ajuste; en la lectura de TEST del 28/10/2026 no había override para
            A04. El presupuesto puede detener ejecuciones. Antes de producción
            conviene definir y medir un límite coherente con el coste y el uso
            previsto.
          </Banner>
        </section>
      ) : null}
      {c.meeting_benchmark || c.monitor_benchmark || c.task_benchmark || c.campaign_benchmark || c.stock_benchmark ? (
        <section className="space-y-3" aria-labelledby="field-review-title">
          <h3 id="field-review-title" className="text-lg font-semibold">
            Comparación campo a campo
          </h3>
          <p className="text-sm text-muted">
            {c.stock_benchmark ? (
              <>Se revisan 16 campos con los requisitos, contexto y contrato fijados antes de generar. Dos revisores automáticos, también candidatos, contrastan datos, cobertura, duplicados y aprobaciones. Sus discrepancias y citas no verificables quedan como dudas. No se probaron herramientas ni compras reales.</>
            ) : c.campaign_benchmark ? (
              <>Se revisan 16 campos y sus subcampos con las respuestas, el contexto y el contrato nativo. La rúbrica se definió después de generar las respuestas, por lo que puede existir sesgo retrospectivo. Los dos revisores son automáticos y también candidatos; sus desacuerdos y citas no verificables quedan pendientes. Sin herramientas ni publicación real.</>
            ) : c.task_benchmark ? (
              <>
                Se revisan 16 campos con el prompt, las entradas y los
                requisitos fijados antes de generar. Dos revisores automáticos
                comprueban tareas, evidencia, duplicados, aprobación y
                seguridad. También son candidatos: el análisis no sustituye
                revisión humana ni prueba ejecución real.
              </>
            ) : c.monitor_benchmark ? (
              <>
                Evaluación de los 16 campos y sus subcampos del Monitor. Prompt,
                métricas y requisitos de cada caso se fijaron antes de generar.
                La rúbrica v2 corrige después dos falsos positivos de v1:
                gravedades permitidas y alcance del panel del consultor. Se
                conservan ambas versiones. No se habilitan herramientas. Ambos
                revisores son automáticos y también candidatos; no equivale a
                revisión humana independiente. Terra se revisó junto a Sol: en
                tres vistas evaluaron Sonnet y Sol; en Klaviyo y panel, Sonnet y
                Opus porque Codex alcanzó su límite de uso.
              </>
            ) : (
              <>
                Segunda evaluación con el prompt, el contexto y la transcripción
                completos, además de recuentos calculados de turnos y
                compromisos. Cada campo incluye sus subcampos: por ejemplo,
                tareas comprueba título, descripción, prioridad, responsable y
                plazo. Un fallo coincidente es señalado por los dos revisores;
                los desacuerdos quedan por resolver. Es evaluación automática,
                pendiente de revisión humana. Sonnet y Sol también son
                candidatos de esta comparación, por lo que la revisión no es
                independiente. La confianza declarada no es una precisión
                medida. Esta rúbrica se añadió después de generar las respuestas
                y sirve para diagnosticar los campos, no para certificar un
                ganador de producción.
              </>
            )}
          </p>
          {c.meeting_benchmark ? (
            <p className="text-sm text-muted">
              El contrato actual solo distingue cliente y consultor como dueño
              de la tarea. Si una respuesta pierde el nombre de la persona
              responsable, aquí se señala como problema de calidad, aunque el
              JSON sea válido.
            </p>
          ) : null}
          <DataTable
            ariaLabel="Comparación por campo entre modelos previstos"
            rows={Object.entries(activeFieldLabels).map(([id, label]) => ({
              id,
              label,
            }))}
            pageSize={Object.keys(activeFieldLabels).length}
            columns={[
              { key: "label", label: "Campo evaluado" },
              ...caseModels.map((model) => ({
                key: model.id,
                label: model.label,
                render: (field: { id: string; label: string }) => {
                  const check = rows
                    .find((row) => row.id === model.id)
                    ?.result?.field_assessment?.checks.find(
                      (item) => item.id === field.id,
                    );
                  return check ? fieldVerdict[check.status] : "Pendiente";
                },
              })),
            ]}
          />
          <p className="text-xs text-muted">
            En «Comparar dos respuestas» puedes abrir la revisión de cada campo
            y leer las notas y evidencias de ambos revisores.
          </p>
        </section>
      ) : null}
      {c.meeting_benchmark && analysis ? (
        <section
          className="space-y-3"
          aria-labelledby="duration-selection-title"
        >
          <h3 id="duration-selection-title" className="text-lg font-semibold">
            Modelo asignado por duración
          </h3>
          <p className="text-sm text-muted">
            Veredicto: GPT-6.1 Sol como principal y GPT-6.1 Terra como fallback, para las tres duraciones.
            A01 queda cerrado tras la comparación por campos y coste.
            Los resultados disponibles son sintéticos y proceden de CLI; el coste
            API real se medirá cuando existan ejecuciones con acceso y saldo del
            proveedor.
          </p>
          <DataTable
            ariaLabel="Propuesta de modelo A01 por duración"
            rows={longMeetingCases.map((testCase) => {
              const result = report.results.find(
                (item) =>
                  item.case_id === testCase.id &&
                  item.model_id === "gpt-6.1-sol",
              );
              const checks = result?.field_assessment?.checks;
              return {
                id: testCase.id,
                duration: `${testCase.meeting_benchmark!.simulated_minutes} min nominales`,
                candidate: checks
                  ? "GPT-6.1 Sol · ID solicitado"
                  : "Pendiente de revisión",
                fields: checks
                  ? `${checks.filter((item) => item.status === "pass").length}/14 sin fallo detectado · ${checks.filter((item) => item.status === "fail").length} fallos · ${checks.filter((item) => item.status === "uncertain").length} por resolver`
                  : "Pendiente",
                price: estimatedApiPrice(result),
                assignment: "GPT-6.1 Sol principal · GPT-6.1 Terra fallback",
              };
            })}
            pageSize={3}
            columns={[
              { key: "duration", label: "Duración" },
              { key: "candidate", label: "Modelo de las pruebas" },
              { key: "fields", label: "Revisión por campos" },
              { key: "price", label: "Precio API estimado · USD" },
              { key: "assignment", label: "Asignación" },
            ]}
          />
        </section>
      ) : null}
      <p className="text-xs text-muted">
        El precio API estimado corresponde al caso seleccionado y se calcula con
        sus tokens CLI y tarifas estándar públicas, aplicando el tramo de
        contexto cuando corresponde; no es una factura. La CLI añade contexto
        propio y su caché varía, por lo que esto no presupone el consumo real
        del agente por API. En GPT se asume el ID solicitado porque Codex no
        confirma cuál modelo sirvió. Claude aparece como intervalo porque el
        informe no indica si la escritura de caché fue de 5 minutos o de 1 hora.
        El coste informado por CLI se muestra aparte. Tarifas consultadas el
        28/10/2026:{" "}
        <a
          className="underline"
          href="https://platform.claude.com/docs/en/about-claude/pricing"
          target="_blank"
          rel="noreferrer"
        >
          Anthropic
        </a>
        {" · "}
        <a
          className="underline"
          href="https://developers.openai.com/api/docs/pricing"
          target="_blank"
          rel="noreferrer"
        >
          OpenAI
        </a>
        .
      </p>
      <DataTable
        ariaLabel="Estado de los modelos previstos para este caso"
        rows={rows}
        pageSize={rows.length}
        columns={[
          { key: "label", label: "Modelo" },
          {
            key: "status",
            label: "Ejecución",
            value: (r) => r.result?.status,
            render: (r) =>
              r.result ? stateLabel[r.result.status] : "Pendiente",
          },
          {
            key: "json",
            label: "JSON interpretable",
            render: (r) =>
              r.result?.checks.json_valid === null || !r.result
                ? "Pendiente"
                : r.result.checks.json_valid
                  ? "Sí · no mide calidad"
                  : "No",
          },
          ...(c.schema_file
            ? [
                {
                  key: "native_contract",
                  label: "Contrato nativo",
                  render: (r: (typeof rows)[number]) =>
                    r.result?.checks.native_contract == null
                      ? "Pendiente"
                      : r.result.checks.native_contract
                        ? "Válido"
                        : "Incumplido",
                },
              ]
            : []),
          ...(c.meeting_benchmark
            ? [
                {
                  key: "reference",
                  label: "Criterios de reunión",
                  render: (r: (typeof rows)[number]) => {
                    const assessment = r.result?.meeting_assessment;
                    return assessment
                      ? `${assessment.checks.filter((x) => x.status === "pass").length} coinciden · ${assessment.checks.filter((x) => x.status === "fail").length} fallos · ${assessment.checks.filter((x) => x.status === "uncertain").length} dudas`
                      : "Pendiente de dos revisores";
                  },
                },
              ]
            : []),
          {
            key: "duration",
            label: "Duración de CLI",
            render: (r: (typeof rows)[number]) =>
              r.result?.duration_ms == null
                ? "Pendiente"
                : `${(r.result.duration_ms / 1000).toFixed(1)} s`,
          },
          {
            key: "input_tokens",
            label: "Tokens de entrada",
            render: (r: (typeof rows)[number]) => {
              if (!r.result) return "Pendiente";
              if (r.result.model_id.startsWith("gpt-"))
                return number(r.result.usage.input);
              const parts = [
                r.result.usage.input,
                r.result.usage.cached,
                r.result.usage.cache_creation,
              ];
              const known = parts.filter((v): v is number => v !== null);
              if (!known.length) return "No informados";
              const total = known
                .reduce((sum, v) => sum + v, 0)
                .toLocaleString("es-ES");
              return parts.some((v) => v === null) ? `≥ ${total}` : total;
            },
          },
          {
            key: "output_tokens",
            label: "Tokens de salida informados",
            render: (r: (typeof rows)[number]) =>
              number(r.result?.usage.output ?? null),
          },
          {
            key: "api_price",
            label: "Precio API estimado · USD",
            render: (r: (typeof rows)[number]) => estimatedApiPrice(r.result),
          },
          {
            key: "cli_price",
            label: "Coste CLI informado · USD",
            render: (r: (typeof rows)[number]) =>
              r.result?.provider_reported_cost == null
                ? "No informado"
                : formatUsd(r.result.provider_reported_cost),
          },
          {
            key: "quality",
            label: "Revisión del contenido",
            render: (r) =>
              r.result?.field_assessment
                ? `${r.result.field_assessment.checks.filter((check) => check.status === "pass").length}/${r.result.field_assessment.checks.length} campos sin fallo detectado · ${r.result.field_assessment.checks.filter((check) => check.status === "fail").length} fallos · ${r.result.field_assessment.checks.filter((check) => check.status === "uncertain").length} por resolver`
                : r.result?.review.status === "reviewed"
                  ? r.result.review.verdict
                  : "Pendiente de revisión",
          },
          ...(analysis
            ? [
                {
                  key: "fit",
                  label: "Lectura específica",
                  render: (r: (typeof rows)[number]) =>
                    analysis.readings[r.id] ?? "Sin valoración individual.",
                },
              ]
            : []),
        ]}
      />
      <Accordion defaultValue={code === "a11_generador_marketing" || code === "a05_estrategia_campanas" ? ["responses"] : []}>
        <AccordionItem value="responses">
          <AccordionTrigger>
            Ver y comparar las respuestas guardadas
          </AccordionTrigger>
          <AccordionContent>
            <section className="space-y-4" aria-labelledby="compare-title">
              <h2 id="compare-title" className="text-xl font-semibold">
                Comparar dos respuestas
              </h2>
              <div className="grid gap-5 lg:grid-cols-2">
                <Field label="Primer modelo">
                  <Select value={left} onChange={setLeft} options={options} />
                </Field>
                <Field label="Segundo modelo">
                  <Select value={right} onChange={setRight} options={options} />
                </Field>
              </div>
              <div className="grid items-start gap-5 lg:grid-cols-2">
                <ResultPanel
                  label={report.models.find((m) => m.id === left)!.label}
                  result={report.results.find(
                    (r) => r.case_id === c.id && r.model_id === left,
                  )}
                />
                <ResultPanel
                  label={report.models.find((m) => m.id === right)!.label}
                  result={report.results.find(
                    (r) => r.case_id === c.id && r.model_id === right,
                  )}
                />
              </div>
            </section>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <section className="space-y-3 border-t border-line pt-6">
        <h2 className="text-xl font-semibold">
          {getAgentModelDecision(code)
            ? "Alcance de la validación archivada"
            : "Qué falta para elegir el modelo"}
        </h2>
        <p className="max-w-3xl text-sm">
          {purpose?.validation ??
            "Comprobar precisión, uso de datos y herramientas."}
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          {c.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
      <Accordion>
        <AccordionItem value="case">
          <AccordionTrigger>
            Procedencia y condiciones de la prueba
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 break-words text-sm">
              <p>
                Fuente: {c.source_run_id ?? "Sin ejecución original"}. La tienda
                es{" "}
                {report.target.stores.find((s) => s.id === c.store_id)?.name ??
                  "el conjunto de la organización"}
                .
              </p>
              <p>
                Bloques disponibles:{" "}
                {c.context_labels.join("; ") || "Sin bloques"}.
              </p>
              <p>
                Herramientas declaradas por la versión:{" "}
                {c.allowed_tools.join(", ") || "Ninguna"}. No se han ejecutado
                en este replay.
              </p>
              <p className="font-mono text-xs">
                Prompt: {c.prompt_hash}
                <br />
                Contexto: {c.context_hash}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function Content({ code }: { code?: string }) {
  const query = useCachedQuery<Payload>(
    `/v1/admin/ai-model-lab${code ? `/${encodeURIComponent(code)}` : ""}`,
  );
  const { reload } = query;
  useEffect(() => {
    const timer = setInterval(reload, 20_000);
    return () => clearInterval(timer);
  }, [reload]);
  if (query.isLoading && !query.data)
    return (
      <AsyncState status="loading" loadingLabel="Cargando las comparaciones…" />
    );
  if (query.error)
    return (
      <ErrorBlock>
        {query.error}
        <Button variant="outline" onClick={reload}>
          Volver a cargar
        </Button>
      </ErrorBlock>
    );
  if (!query.data?.available)
    return (
      <Banner tone="info" title="Laboratorio sin resultados disponibles">
        {query.data?.message ?? "Esperando informe."}
      </Banner>
    );
  const { report } = query.data;
  const completed = report.results.filter(
    (r) => r.status === "completed",
  ).length;
  const reviewed = report.results.filter(
    (r) => r.review.status === "reviewed",
  ).length;
  const rows = report.cases
    .filter(
      (c, i, all) =>
        all.findIndex((item) => item.agent_code === c.agent_code) === i,
    )
    .map((c) => ({
      ...c,
      case_count: report.cases.filter(
        (item) => item.agent_code === c.agent_code,
      ).length,
      expected: report.cases
        .filter((item) => item.agent_code === c.agent_code)
        .reduce(
          (sum, item) => sum + (item.model_ids?.length ?? report.models.length),
          0,
        ),
      completed: report.results.filter(
        (r) =>
          report.cases.find((item) => item.id === r.case_id)?.agent_code ===
            c.agent_code && r.status === "completed",
      ).length,
      reviewed: report.results.filter(
        (r) =>
          report.cases.find((item) => item.id === r.case_id)?.agent_code ===
            c.agent_code && r.review.status === "reviewed",
      ).length,
    }));
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        {code ? (
          <ButtonLink href="/admin/laboratorio-ia" variant="outline">
            Todos los agentes
          </ButtonLink>
        ) : null}
        <Button variant="outline" onClick={reload}>
          Actualizar resultados
        </Button>
        <Link href="/admin/auditoria-ia">Ver auditoría y correcciones</Link>
        <span className="text-xs text-muted">
          Última actualización: {when(report.updated_at)}
        </span>
      </div>
      <p className="max-w-3xl text-sm">
        Cuenta de pruebas: <strong>{report.target.owner}</strong> · consultor{" "}
        <strong>{report.target.consultant}</strong>. Asignación verificada.
        Tienda activa:{" "}
        {report.target.stores
          .filter((s) => s.active)
          .map((s) => s.name)
          .join(", ")}
        . Las tiendas inactivas quedan fuera de esta tanda.
      </p>
      {!code ? <LabSystemSummary /> : null}
      {!code ? (
        <>
          <p className="max-w-3xl text-lg">
            {rows.length} agentes · {report.models.length} modelos · {completed}{" "}
            de {report.results.length} respuestas recibidas · {reviewed} con
            revisión de contenido.
          </p>
          <p className="max-w-3xl text-sm text-muted">
            La tanda inicial usa tres modelos de Claude y tres de OpenAI. Terra
            se incorpora a las comparaciones nuevas. A01 queda cerrado tras revisar las 18 respuestas con contexto de tienda y reuniones sintéticas de 30, 60 y 120 minutos. Cada columna muestra respuestas recibidas sobre casos
            previstos; recibir una respuesta no implica que su calidad esté
            aprobada.
          </p>
          <Banner
            tone="info"
            title="A01 cerrado · GPT-6.1 Sol principal y Terra fallback"
          >
            Pruebas CLI con datos guardados de la cuenta. Todavía no certifican
            herramientas, imágenes ni el funcionamiento completo por API. No se
            editan asignaciones desde esta pantalla. Las decisiones cerradas se
            aplican en la política del runtime y se reflejan en Costes de IA.
            Los resultados se guardan en este servidor local del laboratorio.
          </Banner>
          <DataTable
            ariaLabel="Comparaciones agrupadas por agente"
            rows={rows}
            pageSize={10}
            searchPlaceholder="Buscar un agente"
            columns={[
              {
                key: "agent_name",
                label: "Agente",
                render: (r) => (
                  <div className="space-y-1">
                    <Link href={`/admin/laboratorio-ia/${r.agent_code}`}>
                      {r.agent_name}
                    </Link>
                    <p className="text-xs text-muted">{r.agent_code}</p>
                  </div>
                ),
              },
              {
                key: "decision",
                label: "Decisión",
                render: (r) => {
                  const decision = getAgentModelDecision(r.agent_code);
                  return decision ? (
                    <div className="space-y-1">
                      <Badge tone={decision.status === "closed" ? "success" : "warn"}>{decision.status === "closed" ? "Cerrado" : "En revisión"}</Badge>
                      <p className="text-sm font-medium">{decision.label}</p>
                      <p className="text-xs text-muted">
                        {decision.status === "closed" ? `Modelo fijo · ${decision.closedAt}` : "Asignación provisional"}
                      </p>
                    </div>
                  ) : AGENT_MODEL_ANALYSES[r.agent_code] ? (
                    "Analizado · decisión pendiente"
                  ) : (
                    "Pendiente de revisión individual"
                  );
                },
              },
              {
                key: "completed",
                label: "Respuestas recibidas",
                render: (r) => `${r.completed} / ${r.expected}`,
              },
              ...report.models.map((model) => ({
                key: model.id,
                label: model.label,
                render: (r: { agent_code: string }) => {
                  const cases = new Set(
                    report.cases
                      .filter(
                        (c) =>
                          c.agent_code === r.agent_code &&
                          (!c.model_ids || c.model_ids.includes(model.id)),
                      )
                      .map((c) => c.id),
                  );
                  const results = report.results.filter(
                    (result) =>
                      cases.has(result.case_id) && result.model_id === model.id,
                  );
                  const counts = new Map<string, number>();
                  for (const result of results)
                    counts.set(
                      result.status,
                      (counts.get(result.status) ?? 0) + 1,
                    );
                  if (cases.size === 0) return "No incluido en esta tanda";
                  return (
                    <div className="min-w-28 space-y-1 text-xs">
                      <p className="font-medium">
                        {counts.get("completed") ?? 0} / {cases.size}
                      </p>
                      {Array.from(counts)
                        .filter(([status]) => status !== "completed")
                        .map(([status, count]) => (
                          <p key={status}>
                            {count} ·{" "}
                            {stateLabel[status as AiModelLabResult["status"]]}
                          </p>
                        ))}
                    </div>
                  );
                },
              })),
              {
                key: "source",
                label: "Datos de la prueba",
                render: (r) =>
                  r.case_count > 1
                    ? `${r.case_count} casos · ver condiciones`
                    : r.source === "missing_data"
                      ? "Falta contexto; prueba de abstención"
                      : `Contexto del ${new Date(r.snapshot_at!).toLocaleDateString("es-ES")}`,
              },
              {
                key: "reviewed",
                label: "Revisión",
                render: (r) => `${r.reviewed} / ${r.expected} revisadas`,
              },
            ]}
          />
        </>
      ) : code === A01_MODEL_DECISION.agentCode ? (
        <div className="space-y-5">
          <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <Badge tone="success">A01 · modelo decidido</Badge>
            <h2 className="text-2xl font-semibold">
              Analista de llamadas · {A01_MODEL_DECISION.label}
            </h2>
            <p>
              GPT-6.1 Sol queda como modelo principal para reuniones de cualquier
              duración. GPT-6.1 Terra es el fallback automático. Resume la llamada y extrae acuerdos, riesgos y tareas
              propuestas para revisión del consultor.
            </p>
            <p className="text-sm text-muted">
              Decisión cerrada el 29/10/2026 tras comparar seis modelos en reuniones sintéticas de 30, 60 y 120 minutos. Sol obtuvo la mejor puntuación por campos; Terra fue la segunda opción y queda como fallback.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/admin/costes-ia">Ver costes de A01</Link>
              <Link href="/admin/auditoria-ia">
                Ver asignación en la auditoría
              </Link>
            </div>
          </section>
          <Accordion>
            <AccordionItem value="archive">
              <AccordionTrigger>
                Ver pruebas, métricas y respuestas archivadas
              </AccordionTrigger>
              <AccordionContent>
                <AgentResults report={report} code={code} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ) : code === A08_MODEL_DECISION.agentCode ? (
        <div className="space-y-5">
          <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
            <Badge tone="success">A08 · revisión cerrada</Badge>
            <h2 className="text-2xl font-semibold">
              Gestor de conocimiento · {A08_MODEL_DECISION.label}
            </h2>
            <p>
              Modelo fijo de solo lectura para auditar el conocimiento.
              Respaldo entre proveedores: Claude Sonnet 5.5. Sol queda como
              alternativa. El resultado seleccionado se consulta en la cuenta
              del consultor, en Conocimiento → Gestor IA.
            </p>
            <p className="text-sm text-muted">
              Decisión cerrada el {A08_MODEL_DECISION.closedAt}. Las pruebas
              actuales comparan seis modelos con catálogo autorizado real y una
              búsqueda de contraste preparada por el arnés. La CLI no verifica
              selección dinámica de herramientas ni consumo API real.
            </p>
            <p className="font-medium">Referencia sin caché: 0,0451 USD por ejecución · 0,1805 USD si solicitas cuatro al mes. Manual, sin gasto mensual fijo; herramientas y reintentos aparte.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/admin/costes-ia">Ver costes de A08</Link>
              <Link href="/admin/auditoria-ia">Ver decisión en la auditoría</Link>
              <Link href="/conocimiento?section=ia">Ver resultado en Conocimiento</Link>
            </div>
          </section>
          <Accordion>
            <AccordionItem value="archive">
              <AccordionTrigger>Ver comparaciones y respuestas archivadas</AccordionTrigger>
              <AccordionContent>
                <AgentResults report={report} code={code} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ) : (
        <AgentResults report={report} code={code} />
      )}
      <Accordion>
        <AccordionItem value="issues">
          <AccordionTrigger>
            Historial de fallos y correcciones ({report.issues.length})
          </AccordionTrigger>
          <AccordionContent>
            <section className="space-y-3 border-t border-line pt-6">
              <h2 className="text-xl font-semibold">Fallos y correcciones</h2>
              {report.issues.map((issue) => (
                <article
                  key={issue.id}
                  className="space-y-2 border-b border-line py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        issue.status === "fixed"
                          ? "success"
                          : issue.severity === "high"
                            ? "danger"
                            : "warn"
                      }
                    >
                      {issue.status === "fixed"
                        ? "Corregido"
                        : issue.status === "limited"
                          ? "Límite de la prueba"
                          : "Pendiente"}
                    </Badge>
                    <h3 className="font-semibold">{issue.title}</h3>
                  </div>
                  <p className="max-w-4xl text-sm">{issue.detail}</p>
                  {issue.resolution ? (
                    <p className="max-w-4xl text-sm">
                      <strong>Resolución:</strong> {issue.resolution}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted">
                    Evidencia: {issue.evidence}
                  </p>
                </article>
              ))}
            </section>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export function ModelLabPage({ agentCode }: { agentCode?: string }) {
  return (
    <PlatformAdminShell title="Laboratorio de IA">
      {() => <Content code={agentCode} />}
    </PlatformAdminShell>
  );
}
