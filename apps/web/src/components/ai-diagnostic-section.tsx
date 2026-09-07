"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useActiveConnection } from "@/components/active-connection";
import {
  Badge,
  Banner,
  Button,
  Card,
  ErrorBlock,
  EYEBROW,
  Link,
  LoadingBlock,
  type Tone,
} from "@/components/ui";

type Finding = {
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  evidence: string;
};
type Recommendation = {
  action: string;
  priority: "low" | "medium" | "high" | "urgent";
  expected_impact: string;
  owner: "cliente" | "consultor";
};
type DiagnosticOutput = {
  answer: string;
  findings: Finding[];
  recommendations: Recommendation[];
  proposed_writes: Array<{
    kind: string;
    title: string;
    description: string;
    priority: string;
  }>;
  confidence: "low" | "medium" | "high";
  warnings: string[];
};
type Diagnostic = {
  run_id: string;
  output_id: string;
  output_status: string;
  output: DiagnosticOutput;
  generated_at: string;
  from_cache: boolean;
  /** El run supera las 24h pero se sigue sirviendo (ver no_activity_since). */
  stale?: boolean;
  /** No se ha vuelto a analizar porque no ha habido actividad en la tienda. */
  no_activity_since?: boolean;
  runtime?: {
    orchestration_mode: "direct" | "langgraph";
    langsmith_tracing: boolean;
  };
  envelope?: {
    freshness: { status: "fresh" | "stale" | "superseded"; reason?: string };
    quality: {
      confidence: "low" | "medium" | "high";
      groundedness:
        "verified" | "partially_supported" | "insufficient_evidence";
      dataCompleteness: "complete" | "partial" | "insufficient";
      warnings: string[];
    };
    sources: Array<{ id: string; label: string }>;
  };
};

const severityTone: Record<Finding["severity"], Tone> = {
  info: "neutral",
  low: "neutral",
  medium: "warn",
  high: "danger",
  critical: "danger",
};

const priorityLabelsEs: Record<string, string> = {
  low: "baja",
  medium: "media",
  high: "alta",
  urgent: "urgente",
};

// El agente devuelve enums en ingles (severity, confidence, groundedness...).
// El cliente y el consultor no tienen por que conocerlos: se traducen aqui a
// una etiqueta en castellano y el valor crudo queda como fallback si aparece
// un enum nuevo antes de mapearlo.
const severityLabelsEs: Record<Finding["severity"], string> = {
  info: "informativo",
  low: "bajo",
  medium: "medio",
  high: "alto",
  critical: "crítico",
};

const confidenceLabelsEs: Record<DiagnosticOutput["confidence"], string> = {
  low: "baja",
  medium: "media",
  high: "alta",
};

const groundednessLabelsEs: Record<string, string> = {
  verified: "verificado con datos",
  partially_supported: "parcialmente respaldado",
  insufficient_evidence: "evidencia insuficiente",
};

const dataCompletenessLabelsEs: Record<string, string> = {
  complete: "completos",
  partial: "parciales",
  insufficient: "insuficientes",
};

const freshnessLabelsEs: Record<string, string> = {
  fresh: "actualizados",
  stale: "algo antiguos",
  superseded: "reemplazados por datos más nuevos",
};

const ownerLabelsEs: Record<string, string> = {
  cliente: "Cliente",
  consultor: "Consultor",
};

const SEVERITY_RANK: Record<Finding["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

const PRIORITY_RANK: Record<string, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

export type AiFinding = Finding;

// La IA filtra nombres crudos de tablas/campos internos en su texto libre
// (answer / evidence / warnings). Aqui se traducen a lenguaje del negocio
// antes de mostrarlos -- ni el cliente ni el consultor tienen por que leer
// `has_settings=false` o `product_costs`.
const AGENT_TEXT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bhas_settings\s*=\s*false\b/gi, "sin configuración financiera"],
  [/\bhas_settings\s*=\s*true\b/gi, "con configuración financiera"],
  [/\bsin_datos_meta\b/gi, "sin datos de Meta"],
  [
    /\borganization_financial_settings\b/gi,
    "ajustes financieros de la organización",
  ],
  [/\bproduct_costs\b/gi, "costes de producto"],
  [/\bpending_approval\b/gi, "pendiente de aprobación"],
  [/\bavailable_quantity\s*=\s*0(?:\s*\/\s*null)?\b/gi, "0 unidades disponibles"],
  [/\bavailable_quantity\b/gi, "unidades disponibles"],
  [/\btracked\s*=\s*false\b/gi, "sin seguimiento de inventario"],
  [/\btracked\s*=\s*true\b/gi, "con seguimiento de inventario"],
  [/\bgross_sales\b/gi, "ventas brutas"],
  [/\bnet_sales\b/gi, "ventas netas"],
  [
    /\bknowledge_embedding_failed\b/gi,
    "fallo al consultar la base de conocimiento",
  ],
  [/\bsearch_knowledge\b/gi, "la búsqueda en la base de conocimiento"],
  // El agente cita el backlog con la jerga de la tabla `tasks`.
  [/\btasks? con status\s*=\s*'?pending'?/gi, "tareas pendientes"],
  [/\bstatus\s*=\s*'?ignored'?/gi, "descartada"],
  [/\bstatus\s*=\s*'?pending'?/gi, "pendiente"],
  [/\bstatus\s*=\s*'?completed'?/gi, "completada"],
  [/\bproposed_writes\b/gi, "propuestas de tarea"],
  [/\bdiscounts\s*=\s*/gi, "descuentos: "],
  [/\bnet_margin_pct\b/gi, "margen neto"],
  [/\bnet_margin\b/gi, "margen neto"],
  [/\bcogs\s*=\s*0\b/gi, "sin coste de producto cargado"],
  [/\bcogs\b/gi, "coste de producto"],
  [/\bout_of_stock_items\b/gi, "productos sin stock"],
  [/\bis_test_order\b/gi, "pedido de prueba"],
];

export function humanizeAgentText(text: string): string {
  return AGENT_TEXT_REPLACEMENTS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text,
  );
}

// "Meta no está conectado" no es un riesgo: el cliente ya sabe que no lo ha
// conectado y la IA tambien. Se saca de hallazgos/avisos y se resume en una
// sola linea discreta.
function connectorFromDisconnectText(text: string): string | null {
  const saysDisconnected =
    /\b(no est[aá]s? conectad|sin conectar|no (?:se )?ha[ns]? conectad|not connected|aún no está conectad)\b/i.test(
      text,
    ) || /sin_datos_meta/i.test(text);
  if (!saysDisconnected) return null;
  if (/meta/i.test(text)) return "Meta Ads";
  if (/klaviyo/i.test(text)) return "Klaviyo";
  if (/shopify/i.test(text)) return "Shopify";
  return null;
}

export function partitionConnectivity(findings: Finding[]): {
  rest: Finding[];
  connectors: string[];
} {
  const connectors = new Set<string>();
  const rest: Finding[] = [];
  for (const finding of findings) {
    const connector = connectorFromDisconnectText(
      `${finding.title} ${finding.evidence}`,
    );
    if (connector) connectors.add(connector);
    else rest.push(finding);
  }
  return { rest, connectors: [...connectors] };
}

// Hallazgos sobre la propia plataforma (el pipeline de IA, la facturacion de un
// proveedor, el catalogo de conocimiento) en vez de sobre la tienda del
// cliente. El consultor no puede accionarlos: son de platform_admin.
//
// ponytail: heuristica por palabras clave sobre el texto del agente; si empieza
// a colar falsos positivos, lo correcto es que el agente marque el hallazgo con
// un campo `scope: "platform" | "business"` en su contrato de salida.
const PLATFORM_FINDING_PATTERNS = [
  /\bpipeline de (?:la )?ia\b/i,
  /\bvoyage ai\b/i,
  /\bsearch_knowledge\b/i,
  /\bknowledge_embedding\b/i,
  /\bcat[aá]logo de conocimiento\b/i,
  /\bbloqueo de facturaci[oó]n\b/i,
  /\bm[eé]todo de pago en\b/i,
  /\bagent_runs?\b/i,
  /\bproposed_writes\b/i,
];

export function partitionPlatformFindings(findings: Finding[]): {
  business: Finding[];
  platform: Finding[];
} {
  const business: Finding[] = [];
  const platform: Finding[] = [];
  for (const finding of findings) {
    const text = `${finding.title} ${finding.evidence}`;
    if (PLATFORM_FINDING_PATTERNS.some((pattern) => pattern.test(text))) {
      platform.push(finding);
    } else {
      business.push(finding);
    }
  }
  return { business, platform };
}

// Veredicto de una linea: lo primero que se lee. Cuenta hallazgos por
// severidad y resume "N riesgos sin resolver" vs "sin riesgos". Reutilizable
// desde el widget de sincronia de agentes del dashboard.
export function findingsVerdict(findings: Finding[]): {
  text: string;
  tone: Tone;
  riskCount: number;
  observationCount: number;
} {
  const counts: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  }
  const risk = counts.critical + counts.high + counts.medium;
  const observations = counts.low + counts.info;

  // Una sola cifra. El desglose por severidad ya lo lleva cada riesgo en su
  // propia etiqueta justo debajo: repetirlo aqui solo hace la linea mas larga.
  if (risk > 0) {
    return {
      text: `${risk} riesgo${risk > 1 ? "s" : ""} abierto${risk > 1 ? "s" : ""}`,
      tone: counts.critical || counts.high ? "danger" : "warn",
      riskCount: risk,
      observationCount: observations,
    };
  }
  if (observations > 0) {
    return {
      text: "Sin riesgos abiertos",
      tone: "success",
      riskCount: 0,
      observationCount: observations,
    };
  }
  return {
    text: "Sin hallazgos en el periodo",
    tone: "neutral",
    riskCount: 0,
    observationCount: 0,
  };
}

function AiVerdict({
  findings,
  pendingCount,
}: {
  findings: Finding[];
  pendingCount: number;
}) {
  const verdict = findingsVerdict(findings);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={verdict.tone}>{verdict.text}</Badge>
      {pendingCount > 0 ? (
        <Badge tone="warn">
          {pendingCount} propuesta{pendingCount > 1 ? "s" : ""} sin decidir
        </Badge>
      ) : null}
    </div>
  );
}

const severityBorder: Record<Finding["severity"], string> = {
  critical: "border-l-danger",
  high: "border-l-danger",
  medium: "border-l-warn",
  low: "border-l-separator",
  info: "border-l-separator",
};

// Los hallazgos son titulo corto + evidencia larga en prosa: una tabla de 3
// columnas los aplasta. Cada uno como bloque apilado -> se escanean los
// titulos, la evidencia queda debajo sin competir por el ancho.
function FindingsList({ rows }: { rows: Finding[] }) {
  return (
    <ul className="mt-2 space-y-3">
      {rows.map((finding, index) => (
        <li
          key={index}
          className={`border-l-2 pl-3 ${severityBorder[finding.severity]}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={severityTone[finding.severity]}>
              {severityLabelsEs[finding.severity] ?? finding.severity}
            </Badge>
            <span className="text-sm font-medium text-foreground">
              {finding.title}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {humanizeAgentText(finding.evidence)}
          </p>
        </li>
      ))}
    </ul>
  );
}

// Metadatos de fiabilidad del propio analisis (no es contenido del agente):
// una sola linea "meta" en vez de tres badges sueltos + un parrafo de fuentes.
// El detalle de calidad y el runtime son diagnostico de la plataforma: solo se
// muestran a platform_admin (ver `showInternals` en AiDiagnosticSection).
function TrustStrip({
  diagnostic,
  showInternals,
}: {
  diagnostic: Diagnostic;
  showInternals: boolean;
}) {
  const bits: string[] = [
    `confianza ${confidenceLabelsEs[diagnostic.output.confidence] ?? diagnostic.output.confidence}`,
  ];
  if (showInternals && diagnostic.envelope) {
    bits.push(
      `respaldo ${
        groundednessLabelsEs[diagnostic.envelope.quality.groundedness] ??
        diagnostic.envelope.quality.groundedness
      }`,
    );
    bits.push(
      `datos ${
        dataCompletenessLabelsEs[diagnostic.envelope.quality.dataCompleteness] ??
        diagnostic.envelope.quality.dataCompleteness
      }`,
    );
  }
  const sources = diagnostic.envelope?.sources ?? [];
  return (
    <p className="border-t border-separator pt-3 text-xs text-muted">
      {bits.join(" · ")}
      {sources.length ? (
        <>
          {" · "}
          <span
            className="underline decoration-dotted underline-offset-2"
            title={sources.map((source) => source.label).join("\n")}
          >
            {sources.length} fuente{sources.length > 1 ? "s" : ""}
          </span>
        </>
      ) : null}
      {showInternals && diagnostic.runtime
        ? ` · runtime ${
            diagnostic.runtime.orchestration_mode === "direct"
              ? "directo"
              : "LangGraph"
          }${diagnostic.runtime.langsmith_tracing ? " · trazas on" : ""}`
        : ""}
    </p>
  );
}

/**
 * Bloque de diagnostico automatico reutilizable (AI-02/AI-05: A02, A04, A06).
 * Se genera solo (sin boton de "aprobar para ver"); la aprobacion humana solo
 * materializa proposed_writes como tareas reales. Mismo patron de cache de
 * 24h en el backend (getMonitorDiagnostic / getTaskPlannerDiagnostic /
 * getStockPlannerDiagnostic), solo cambia el par de endpoints.
 */
export function AiDiagnosticSection({
  organizationId,
  title,
  getPath,
  runPath,
  loadingLabel,
  tasksLabelSingular,
  days,
  variant = "full",
  bare = false,
  showInternals = false,
}: {
  organizationId: string;
  title: string;
  getPath: string;
  runPath: string;
  loadingLabel: string;
  tasksLabelSingular: string;
  days?: number;
  // "full": diagnostico completo (analisis + riesgos + recomendaciones).
  // "summary": version corta para el cliente, solo lectura.
  // "tasks": el agente propone trabajo, no diagnostica -- solo las tareas.
  variant?: "full" | "summary" | "tasks";
  // `bare`: sin el <Card> propio ni el badge "IA" -- para incrustarlo dentro
  // de otro contenedor (el panel "Agentes IA" del dashboard).
  bare?: boolean;
  // Diagnostico de la plataforma, no del negocio: los avisos sobre los limites
  // del analisis, el detalle de calidad y el runtime. Hablan de como funciona
  // el agente (que no escribe tareas, que le faltan costes, que dos fuentes no
  // cuadran) y solo son accionables para platform_admin. El consultor ve el
  // analisis; si algo no es fiable, el agente ya lo dice en el propio texto.
  showInternals?: boolean;
}) {
  const { connectionId } = useActiveConnection();
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [tasksFeedback, setTasksFeedback] = useState<string | null>(null);
  const [answerExpanded, setAnswerExpanded] = useState(false);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [observationsExpanded, setObservationsExpanded] = useState(false);

  const queryParams = [
    connectionId ? `connectionId=${encodeURIComponent(connectionId)}` : null,
    days ? `days=${days}` : null,
  ].filter(Boolean);
  const connectionParam =
    queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      setTasksFeedback(null);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}${getPath}${connectionParam}`,
        );

        if (response.ok) {
          setDiagnostic((await response.json()) as Diagnostic);
        } else {
          setDiagnostic(null);
          setError(await readApiError(response));
        }
      } catch {
        setDiagnostic(null);
        setError(
          "No se pudo cargar el diagnóstico IA por un error de red. Reintenta.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [organizationId, getPath, connectionParam]);

  async function regenerate() {
    setIsRegenerating(true);
    setError(null);
    setTasksFeedback(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}${runPath}${connectionParam}`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        setDiagnostic((await response.json()) as Diagnostic);
      } else {
        setError(await readApiError(response));
      }
    } catch {
      setError(
        "No se pudo regenerar el diagnóstico IA por un error de red. Reintenta.",
      );
    } finally {
      setIsRegenerating(false);
    }
  }

  async function createSuggestedTasks() {
    if (!diagnostic) {
      return;
    }

    setIsCreatingTasks(true);
    setTasksFeedback(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/outputs/${diagnostic.output_id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: "approved" }),
        },
      );

      if (!response.ok) {
        setTasksFeedback(await readApiError(response));
        return;
      }

      const payload = (await response.json()) as { tasks_created: number };
      setDiagnostic({ ...diagnostic, output_status: "approved" });
      setTasksFeedback(
        payload.tasks_created > 0
          ? `${payload.tasks_created} tarea(s) creada(s) en Tareas.`
          : "Sin tareas nuevas que crear.",
      );
    } catch {
      setTasksFeedback(
        "No se pudieron crear las tareas sugeridas por un error de red. Reintenta.",
      );
    } finally {
      setIsCreatingTasks(false);
    }
  }

  const meta = diagnostic ? (
    <span className="text-xs text-muted">
      {days ? `últimos ${days} días · ` : ""}
      {diagnostic.from_cache ? "generado" : "recién generado"} el{" "}
      {new Date(diagnostic.generated_at).toLocaleString()}
      {diagnostic.envelope && diagnostic.envelope.freshness.status !== "fresh"
        ? ` · datos ${
            freshnessLabelsEs[diagnostic.envelope.freshness.status] ??
            diagnostic.envelope.freshness.status
          }`
        : ""}
    </span>
  ) : null;

  const refreshButton = diagnostic ? (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      disabled={isRegenerating}
      onClick={regenerate}
    >
      {isRegenerating ? "Actualizando..." : "Actualizar ahora"}
    </Button>
  ) : null;

  const body =
    isLoading ? (
      <LoadingBlock label={loadingLabel} />
    ) : error ? (
      <ErrorBlock>{error}</ErrorBlock>
    ) : diagnostic ? (
        (() => {
          const { rest: connectedFindings, connectors } = partitionConnectivity(
            diagnostic.output.findings,
          );
          // Los hallazgos sobre la propia plataforma solo los ve admin: el
          // consultor no puede accionar "falta metodo de pago en Voyage AI".
          const cleanFindings = showInternals
            ? connectedFindings
            : partitionPlatformFindings(connectedFindings).business;
          const sortedFindings = [...cleanFindings].sort(
            (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
          );
          const riskFindings = sortedFindings.filter(
            (finding) => SEVERITY_RANK[finding.severity] >= SEVERITY_RANK.medium,
          );
          const observationFindings = sortedFindings.filter(
            (finding) => SEVERITY_RANK[finding.severity] < SEVERITY_RANK.medium,
          );
          const sortedRecs = [...diagnostic.output.recommendations].sort(
            (a, b) =>
              (PRIORITY_RANK[b.priority] ?? 0) -
              (PRIORITY_RANK[a.priority] ?? 0),
          );
          const cleanWarnings = diagnostic.output.warnings.filter(
            (warning) => !connectorFromDisconnectText(warning),
          );
          const pendingCount =
            diagnostic.output_status === "pending_approval"
              ? diagnostic.output.proposed_writes.length
              : 0;

          // Lo que el consultor viene a hacer aqui: leer cada tarea que propone
          // la IA y decidir. Una card por tarea, siempre visibles (no detras de
          // un "ver detalle") y por encima del diagnostico: son el contenido
          // principal, no un anexo. Aprobar las materializa en /tareas, donde
          // el consultor puede reescribirlas antes de asignarlas.
          const showsTasks = variant === "full" || variant === "tasks";
          const proposedBlock =
            showsTasks && diagnostic.output.proposed_writes.length ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={EYEBROW}>
                    {diagnostic.output_status === "pending_approval"
                      ? `${tasksLabelSingular}s propuestas (${diagnostic.output.proposed_writes.length})`
                      : `${tasksLabelSingular}s propuestas · ya revisadas`}
                  </p>
                  <Link href="/tareas">Ver en Tareas</Link>
                </div>

                <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                  {diagnostic.output.proposed_writes.map((write, index) => (
                    <li
                      key={index}
                      className="rounded-md border border-accent p-3"
                    >
                      <Badge
                        tone={
                          ["urgent", "high"].includes(write.priority)
                            ? "danger"
                            : write.priority === "medium"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {priorityLabelsEs[write.priority] ?? write.priority}
                      </Badge>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {humanizeAgentText(write.title)}
                      </p>
                      {write.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          {humanizeAgentText(write.description)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Button
                    type="button"
                    disabled={
                      isCreatingTasks ||
                      diagnostic.output_status !== "pending_approval"
                    }
                    onClick={createSuggestedTasks}
                  >
                    {isCreatingTasks
                      ? "Creando..."
                      : diagnostic.output_status !== "pending_approval"
                        ? "Ya revisadas"
                        : "Aprobar y crear en Tareas"}
                  </Button>
                  {tasksFeedback ? (
                    <p className="text-sm text-muted">{tasksFeedback}</p>
                  ) : null}
                </div>
              </div>
            ) : variant === "summary" &&
              diagnostic.output.proposed_writes.length ? (
              <Banner tone="warn">
                {diagnostic.output.proposed_writes.length} propuesta(s)
                pendiente(s) de revisión del consultor. No se ha ejecutado
                ninguna escritura.
              </Banner>
            ) : tasksFeedback ? (
              <p className="text-sm text-muted">{tasksFeedback}</p>
            ) : null;

          return (
            <div className="space-y-5">
              {/* En "tasks" el veredicto de riesgos y el analisis en prosa no
                  se pintan: este agente propone trabajo, el diagnostico del
                  negocio es el "Resumen ejecutivo". */}
              {variant === "tasks" ? null : (
                <AiVerdict
                  findings={cleanFindings}
                  pendingCount={pendingCount}
                />
              )}

              {connectors.length ? (
                <p className="text-xs text-muted">
                  Sin conectar: {connectors.join(" · ")}. El análisis los omite —{" "}
                  <Link href="/integraciones">conéctalos en Integraciones</Link>.
                </p>
              ) : null}

              {variant === "tasks" ? null : (
                <div>
                  {variant === "full" ? (
                    <p className={EYEBROW}>Análisis</p>
                  ) : null}
                  <p
                    className={`text-[13px] leading-relaxed text-foreground${
                      variant === "full" ? " mt-1" : ""
                    }${answerExpanded ? "" : " line-clamp-3"}`}
                  >
                    {humanizeAgentText(diagnostic.output.answer)}
                  </p>
                  {diagnostic.output.answer.length > 220 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="mt-1 px-0"
                      onClick={() => setAnswerExpanded((v) => !v)}
                    >
                      {answerExpanded ? "Ver menos" : "Ver análisis completo"}
                    </Button>
                  ) : null}
                </div>
              )}

              {diagnostic.no_activity_since ? (
                <p className="text-xs text-muted">
                  Sin cambios desde la última vez: no se ha vuelto a analizar
                  porque no ha habido actividad en la tienda. Usa “Actualizar
                  ahora” para forzarlo.
                </p>
              ) : null}

              {proposedBlock}

              {variant === "tasks" &&
              !diagnostic.output.proposed_writes.length ? (
                <p className="text-sm text-muted">
                  Sin tareas nuevas en este ciclo. Las que ya existen están en{" "}
                  <Link href="/tareas">Tareas</Link>.
                </p>
              ) : null}

              {variant === "full" && riskFindings.length ? (
                <div>
                  <p className={EYEBROW}>Riesgos ({riskFindings.length})</p>
                  <FindingsList rows={riskFindings} />
                </div>
              ) : null}

              {variant === "full" && observationFindings.length ? (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="px-0"
                    aria-expanded={observationsExpanded}
                    onClick={() => setObservationsExpanded((v) => !v)}
                  >
                    {observationsExpanded
                      ? "Ocultar observaciones"
                      : `Ver ${observationFindings.length} observación${
                          observationFindings.length > 1 ? "es" : ""
                        } sin riesgo`}
                  </Button>
                  {observationsExpanded ? (
                    <FindingsList rows={observationFindings} />
                  ) : null}
                </div>
              ) : null}

              {variant === "full" && sortedRecs.length ? (
                <div>
                  <p className={EYEBROW}>Recomendaciones</p>
                  <ul className="mt-2 space-y-2">
                    {sortedRecs.map((rec, index) => (
                      <li
                        key={index}
                        className="rounded-md border border-separator p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            tone={
                              ["urgent", "high"].includes(rec.priority)
                                ? "danger"
                                : rec.priority === "medium"
                                  ? "warn"
                                  : "neutral"
                            }
                          >
                            {priorityLabelsEs[rec.priority] ?? rec.priority}
                          </Badge>
                          <Badge tone="neutral">
                            {ownerLabelsEs[rec.owner] ?? rec.owner}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-foreground">
                          {humanizeAgentText(rec.action)}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          {humanizeAgentText(rec.expected_impact)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {showInternals && cleanWarnings.length ? (
                <Banner tone="warn">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {cleanWarnings.length} límite
                      {cleanWarnings.length > 1 ? "s" : ""} del análisis (solo
                      admin)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      aria-expanded={warningsExpanded}
                      onClick={() => setWarningsExpanded((v) => !v)}
                    >
                      {warningsExpanded ? "Ocultar" : "Ver"}
                    </Button>
                  </div>
                  {warningsExpanded ? (
                    <ul className="mt-2 space-y-1">
                      {cleanWarnings.map((warning, index) => (
                        <li key={index}>{humanizeAgentText(warning)}</li>
                      ))}
                    </ul>
                  ) : null}
                </Banner>
              ) : null}

              <TrustStrip
                diagnostic={diagnostic}
                showInternals={showInternals}
              />
            </div>
          );
        })()
    ) : null;

  if (bare) {
    return (
      <div className="space-y-3">
        {meta || refreshButton ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {meta}
            {refreshButton}
          </div>
        ) : null}
        {body}
      </div>
    );
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Badge tone="brand">IA</Badge>
          {title}
        </span>
      }
      description={meta ?? undefined}
      actions={refreshButton}
    >
      {body}
    </Card>
  );
}
