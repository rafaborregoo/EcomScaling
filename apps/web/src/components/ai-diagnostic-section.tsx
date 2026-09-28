"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useActiveConnection } from "@/components/active-connection";
import { useInsights } from "@/components/insights-context";
import { insightSpotsFromFindingAreas } from "@/lib/insights-registry";
import {
  Badge,
  Banner,
  Button,
  Card,
  ErrorBlock,
  Link,
  LoadingBlock,
  CheckIcon,
  CloseIcon,
  type Tone,
} from "@/components/ui";

type Finding = {
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  evidence: string;
  /** Clave de la lista cerrada del prompt; se traduce con `areas`. */
  area?: string;
};

/**
 * Mapa area->donde se arregla, que aporta cada pantalla. Un area que no este
 * aqui se ignora: el hallazgo se dibuja igual, solo que sin enlace.
 */
export type FindingAreas = Record<string, { label: string; href: string }>;
type Recommendation = {
  action: string;
  priority: "low" | "medium" | "high" | "urgent";
  expected_impact: string;
  owner: "cliente" | "consultor";
};
type MonitorSection = {
  key: string;
  label: string;
  findings: Finding[];
  recommendations: Recommendation[];
};
type DiagnosticOutput = {
  /** Legacy agents keep this; A02 v9 emits a headline instead. */
  answer?: string;
  headline?: string;
  sections?: MonitorSection[];
  findings: Finding[];
  recommendations: Recommendation[];
  proposed_writes: Array<{
    kind: string;
    title: string;
    description: string;
    priority: string;
    owner_role?: "cliente" | "consultor";
    completion_criteria?: string;
    expected_metric?: string;
    due_hint?: string | null;
    initiative_measurement?: {
      metric_name: string;
      unit: string | null;
      baseline: number | null;
      target: number | null;
      evaluation_window: string;
    };
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

function A26EmailRenderPreview({ organizationId, runId }: { organizationId: string; runId: string }) {
  const [previews, setPreviews] = useState<Array<{ viewport: string; url: string }>>([]);
  const [state, setState] = useState<"loading" | "ready" | "pending" | "error">("loading");

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    setPreviews([]);
    setState("loading");
    void (async () => {
      try {
        // The isolated renderer runs asynchronously. Poll briefly so the
        // preview appears without asking the user to refresh the diagnostic.
        for (let attempt = 0; attempt < 12 && active; attempt += 1) {
          const captures: Array<{ viewport: string; url: string }> = [];
          for (const viewport of ["desktop", "mobile"] as const) {
            const fileName = `${viewport}-first-screen.png`;
            const response = await apiFetch(
              `/v1/organizations/${organizationId}/ai/runs/${runId}/email-render/${fileName}`,
              { cache: "no-store" },
            );
            if (response.status === 404) continue;
            if (!response.ok) throw new Error("render_preview_load_failed");
            const url = URL.createObjectURL(await response.blob());
            objectUrls.push(url);
            captures.push({ viewport, url });
          }
          if (!active) return;
          if (captures.length) {
            setPreviews(captures);
            setState("ready");
            return;
          }
          if (attempt < 11) await new Promise((resolve) => setTimeout(resolve, 5_000));
        }
        if (active) setState("pending");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [organizationId, runId]);

  return (
    <section className="space-y-3 rounded-lg border border-separator bg-surface-subtle p-4" aria-label="Simulación visual del email">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Vista simulada del email</h3>
        <p className="mt-1 text-xs leading-5 text-muted">No es una captura de bandeja de entrada. Las imágenes y fuentes externas pueden no cargarse en esta simulación.</p>
      </div>
      {state === "loading" ? <p className="text-sm text-muted">Buscando las capturas…</p> : null}
      {state === "pending" ? <p className="text-sm text-muted">La captura aún no está lista; aparecerá cuando termine el render aislado.</p> : null}
      {state === "error" ? <p role="status" className="text-sm text-muted">No se pudieron cargar las capturas visuales.</p> : null}
      {previews.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {previews.map((preview) => (
            <figure key={preview.viewport} className="min-w-0 overflow-hidden rounded-md border border-separator bg-white">
              <img src={preview.url} alt={`Primera pantalla del email en viewport ${preview.viewport}`} className="h-auto max-h-[34rem] w-full object-contain object-top" />
              <figcaption className="border-t border-separator px-3 py-2 text-xs text-muted">{preview.viewport === "desktop" ? "Escritorio" : "Móvil"} · primera pantalla simulada</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AgentOutputThread({ organizationId, outputId }: { organizationId: string; outputId: string }) {
  const [notes, setNotes] = useState<Array<{ id: string; body: string; author_kind: string; author_name: string | null; created_at: string }>>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!expanded || loaded) return;
    let active = true;
    void apiFetch(`/v1/organizations/${organizationId}/ai/outputs/${outputId}/notes`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? payload.error ?? "No se pudo cargar el hilo.");
        if (active) { setNotes(payload.notes ?? []); setLoaded(true); }
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar el hilo."); });
    return () => { active = false; };
  }, [organizationId, outputId, expanded, loaded]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/ai/outputs/${outputId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "No se pudo guardar la nota.");
      setNotes((current) => [...current, { ...payload.note, author_name: null }]); setBody(""); setExpanded(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la nota."); }
    finally { setSaving(false); }
  }
  return <section className="border-t border-separator pt-3">
    <Button variant="ghost" size="sm" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
      {expanded ? "Ocultar conversación" : `Notas del equipo${notes.length ? ` · ${notes.length}` : ""}`}
    </Button>
    {expanded ? <div className="mt-2 space-y-3">
      {notes.map((note) => <div key={note.id} className="rounded-md bg-surface-subtle p-3">
        <p className="text-xs font-medium text-muted">{note.author_name ?? ({ consultant: "Consultor", client: "Cliente", platform: "E-NORA", ai: "IA" }[note.author_kind] ?? "Equipo")} · {new Date(note.created_at).toLocaleString("es-ES")}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>
      </div>)}
      <form onSubmit={submit} className="space-y-2"><textarea className="field min-h-20 w-full" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="Añade una observación para el equipo…" />
        <Button type="submit" size="sm" disabled={saving || !body.trim()}>{saving ? "Guardando…" : "Añadir nota"}</Button>
      </form>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div> : null}
  </section>;
}

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
  [
    /\bavailable_quantity\s*=\s*0(?:\s*\/\s*null)?\b/gi,
    "0 unidades disponibles",
  ],
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

const severitySurface: Record<Finding["severity"], string> = {
  critical: "border-danger/30 bg-danger/5",
  high: "border-danger/30 bg-danger/5",
  medium: "border-warn/30 bg-warn/5",
  low: "border-separator bg-surface",
  info: "border-separator bg-surface",
};

// Los hallazgos son titulo corto + evidencia larga en prosa: una tabla de 3
// columnas los aplasta. Cada uno como bloque apilado -> se escanean los
// titulos, la evidencia queda debajo sin competir por el ancho.
function FindingsList({
  rows,
  areas,
}: {
  rows: Finding[];
  areas?: FindingAreas;
}) {
  return (
    <ul className="mt-2 space-y-3">
      {rows.map((finding, index) => {
        // Un area que el agente se invente, o de una version de prompt mas
        // nueva que esta pantalla, simplemente no encuentra destino.
        const target = finding.area ? areas?.[finding.area] : undefined;
        return (
          <li
            key={index}
            className={`rounded-md border p-3 ${severitySurface[finding.severity]}`}
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
            {target ? (
              <a
                href={target.href}
                className="mt-1 inline-block text-xs underline text-muted hover:text-foreground"
              >
                {target.label}
              </a>
            ) : null}
          </li>
        );
      })}
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
        dataCompletenessLabelsEs[
          diagnostic.envelope.quality.dataCompleteness
        ] ?? diagnostic.envelope.quality.dataCompleteness
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
      {showInternals && diagnostic.runtime?.langsmith_tracing
        ? " · trazas on"
        : ""}
    </p>
  );
}

/**
 * Bloque de diagnóstico reutilizable (A02, A04, A06). Al montarse solo lee el
 * resultado almacenado; la generación corresponde al cron o al botón explícito
 * «Actualizar ahora». La aprobación humana solo materializa proposed_writes
 * como tareas reales. Mismo patrón de caché de
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
  showMeta = true,
  areas,
  renderPreview = false,
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
  // Permite ocultar el periodo y la fecha generada en paneles de decisión.
  showMeta?: boolean;
  // Adonde lleva cada hallazgo. Lo aporta la pantalla que monta la seccion,
  // porque es la unica que sabe que bloques tiene y con que ancla. Sin esto,
  // un hallazgo se lee y no se arregla.
  areas?: FindingAreas;
  /** Muestra capturas privadas de la simulación A26 asociadas al run actual. */
  renderPreview?: boolean;
}) {
  const { connectionId } = useActiveConnection();
  const { registerLocalInsights } = useInsights();
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [needsFirstRun, setNeedsFirstRun] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [tasksFeedback, setTasksFeedback] = useState<string | null>(null);
  const [proposalDecisions, setProposalDecisions] = useState<{
    outputId: string;
    decisions: Record<number, "approved" | "rejected">;
  } | null>(null);
  const [answerExpanded, setAnswerExpanded] = useState(false);

  useEffect(() => {
    registerLocalInsights(
      getPath,
      insightSpotsFromFindingAreas(
        diagnostic?.output.findings ?? [],
        areas ?? {},
      ),
    );
    return () => registerLocalInsights(getPath, []);
  }, [areas, diagnostic?.output.findings, getPath, registerLocalInsights]);
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
      setNotReady(false);
      setNeedsFirstRun(false);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}${getPath}${connectionParam}`,
        );

        if (response.ok) {
          setDiagnostic((await response.json()) as Diagnostic);
          setNotReady(false);
          setNeedsFirstRun(false);
        } else {
          setDiagnostic(null);
          const message = await readApiError(response);
          // Una organizacion sin datos no es un fallo: es que todavia no toca.
          // Se cuenta como estado normal, no como error rojo.
          const sinDatos = message.startsWith("agent_sin_datos");
          const pendiente = message.startsWith("agent_diagnostic_pending");
          setNotReady(sinDatos);
          setNeedsFirstRun(pendiente);
          setError(sinDatos || pendiente ? null : message);
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
        setNeedsFirstRun(false);
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

  async function applyProposalDecisions() {
    if (!diagnostic) {
      return;
    }

    const decisions =
      proposalDecisions?.outputId === diagnostic.output_id
        ? proposalDecisions.decisions
        : {};
    const writes = diagnostic.output.proposed_writes;
    if (writes.some((_, index) => !decisions[index])) return;
    const approvedCount = writes.filter(
      (_, index) => decisions[index] === "approved",
    ).length;
    const decision = approvedCount > 0 ? "approved" : "rejected";
    const edits =
      decision === "approved"
        ? writes.flatMap((_, index) =>
            decisions[index] === "approved" ? [] : [{ index, skip: true }],
          )
        : undefined;

    setIsCreatingTasks(true);
    setTasksFeedback(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/ai/outputs/${diagnostic.output_id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, ...(edits ? { edits } : {}) }),
        },
      );

      if (!response.ok) {
        setTasksFeedback(await readApiError(response));
        return;
      }

      const payload = (await response.json()) as { tasks_created: number };
      setDiagnostic({ ...diagnostic, output_status: decision });
      setTasksFeedback(
        decision === "rejected"
          ? "Propuestas descartadas. No se ha creado ninguna tarea."
          : `${payload.tasks_created} de ${writes.length} tarea(s) aprobada(s) creada(s) en Tareas.`,
      );
    } catch {
      setTasksFeedback(
        "No se pudieron crear las tareas sugeridas por un error de red. Reintenta.",
      );
    } finally {
      setIsCreatingTasks(false);
    }
  }

  const meta = diagnostic && showMeta ? (
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

  const refreshButton = diagnostic || needsFirstRun ? (
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

  const body = isLoading ? (
    <LoadingBlock label={loadingLabel} />
  ) : notReady ? (
    <p className="text-sm leading-6 text-muted">
      Conecta tu tienda para que la IA empiece a analizarla. El primer análisis
      llega tras la primera sincronización.
    </p>
  ) : needsFirstRun ? (
    <p className="text-sm leading-6 text-muted">
      El primer análisis está pendiente. Puedes generarlo con «Actualizar ahora»
      o esperar al próximo ciclo automático.
    </p>
  ) : error ? (
    <ErrorBlock>{error}</ErrorBlock>
  ) : diagnostic ? (
    (() => {
      const hasMonitorSections = Array.isArray(diagnostic.output.sections);
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
          (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0),
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
              <h3 className="text-sm font-semibold text-foreground">
                {diagnostic.output_status === "pending_approval"
                  ? `${tasksLabelSingular}s propuestas (${diagnostic.output.proposed_writes.length})`
                  : `${tasksLabelSingular}s propuestas · ya revisadas`}
              </h3>
              <Link href="/tareas">Ver en Tareas</Link>
            </div>

            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {diagnostic.output.proposed_writes.map((write, index) => {
                const selectedDecision =
                  proposalDecisions?.outputId === diagnostic.output_id
                    ? proposalDecisions.decisions[index]
                    : undefined;
                const selectable = diagnostic.output_status === "pending_approval";
                return (
                  <li
                    key={index}
                    className={`rounded-md border p-3 ${
                      selectedDecision === "approved"
                        ? "border-success/40 bg-success/5"
                        : selectedDecision === "rejected"
                          ? "border-danger/40 bg-danger/5"
                          : "border-accent"
                    }`}
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
                    {write.owner_role || write.completion_criteria || write.expected_metric || write.due_hint ? (
                      <dl className="mt-2 grid gap-1 border-t border-separator pt-2 text-xs">
                        {write.owner_role ? <div><dt className="inline font-medium text-foreground">Rol de ejecución: </dt><dd className="inline text-muted">{write.owner_role}</dd></div> : null}
                        {write.completion_criteria ? <div><dt className="inline font-medium text-foreground">Cierre: </dt><dd className="inline text-muted">{humanizeAgentText(write.completion_criteria)}</dd></div> : null}
                        {write.expected_metric ? <div><dt className="inline font-medium text-foreground">Métrica a revisar: </dt><dd className="inline text-muted">{humanizeAgentText(write.expected_metric)}</dd></div> : null}
                        {write.due_hint ? <div><dt className="inline font-medium text-foreground">Plazo orientativo: </dt><dd className="inline text-muted">{humanizeAgentText(write.due_hint)}</dd></div> : null}
                      </dl>
                    ) : null}
                    {write.initiative_measurement ? (
                      <p className="mt-2 border-t border-separator pt-2 text-xs text-muted">
                        <span className="font-medium text-foreground">Medición mensual: </span>
                        {humanizeAgentText(write.initiative_measurement.metric_name)} · base {write.initiative_measurement.baseline === null ? "no disponible" : `${write.initiative_measurement.baseline}${write.initiative_measurement.unit ? ` ${write.initiative_measurement.unit}` : ""}`} · objetivo {write.initiative_measurement.target === null ? "sin definir" : `${write.initiative_measurement.target}${write.initiative_measurement.unit ? ` ${write.initiative_measurement.unit}` : ""}`} · {humanizeAgentText(write.initiative_measurement.evaluation_window)}
                      </p>
                    ) : null}
                    {selectable ? (
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-separator pt-2">
                        <span className="text-xs text-muted">
                          {selectedDecision === "approved"
                            ? "Se incluirá en Tareas"
                            : selectedDecision === "rejected"
                              ? "Se descartará"
                              : "Pendiente de decisión"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            aria-label={`Aprobar: ${humanizeAgentText(write.title)}`}
                            aria-pressed={selectedDecision === "approved"}
                            title="Aprobar esta tarea"
                            className={`min-w-0 rounded-full px-2 ${selectedDecision === "approved" ? "bg-success/10 text-success" : "text-success hover:bg-success/10"}`}
                            onClick={() =>
                              setProposalDecisions((current) => ({
                                outputId: diagnostic.output_id,
                                decisions: {
                                  ...(current?.outputId === diagnostic.output_id
                                    ? current.decisions
                                    : {}),
                                  [index]: "approved",
                                },
                              }))
                            }
                          >
                            <CheckIcon aria-hidden className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            aria-label={`Descartar: ${humanizeAgentText(write.title)}`}
                            aria-pressed={selectedDecision === "rejected"}
                            title="Descartar esta tarea"
                            className={`min-w-0 rounded-full px-2 ${selectedDecision === "rejected" ? "bg-danger/10 text-danger" : "text-danger hover:bg-danger/10"}`}
                            onClick={() =>
                              setProposalDecisions((current) => ({
                                outputId: diagnostic.output_id,
                                decisions: {
                                  ...(current?.outputId === diagnostic.output_id
                                    ? current.decisions
                                    : {}),
                                  [index]: "rejected",
                                },
                              }))
                            }
                          >
                            <CloseIcon aria-hidden className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Button
                type="button"
                disabled={
                  isCreatingTasks ||
                  diagnostic.output_status !== "pending_approval" ||
                  diagnostic.output.proposed_writes.some(
                    (_, index) =>
                      !(
                        proposalDecisions?.outputId === diagnostic.output_id &&
                        proposalDecisions.decisions[index]
                      ),
                  )
                }
                onClick={applyProposalDecisions}
              >
                {isCreatingTasks
                  ? "Aplicando decisiones..."
                  : diagnostic.output_status !== "pending_approval"
                    ? "Ya revisadas"
                    : "Aplicar decisiones"}
              </Button>
              {diagnostic.output_status === "pending_approval" ? (
                <div className="text-xs text-muted">
                  <span>
                    {proposalDecisions?.outputId === diagnostic.output_id
                      ? Object.keys(proposalDecisions.decisions).length
                      : 0} / {diagnostic.output.proposed_writes.length} revisadas
                  </span>
                  <p className="mt-1">
                    Marca ✓ o ✕ en cada propuesta para aplicar las decisiones.
                  </p>
                </div>
              ) : null}
              {tasksFeedback ? (
                <p className="text-sm text-muted">{tasksFeedback}</p>
              ) : null}
            </div>
          </div>
        ) : variant === "summary" &&
          diagnostic.output_status === "pending_approval" &&
          diagnostic.output.proposed_writes.length ? (
          <section aria-label="Propuestas para tu tienda">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">
                Propuestas para tu tienda
              </h3>
              <span className="text-xs text-muted">
                {diagnostic.output.proposed_writes.length} por revisar
              </span>
            </div>
            <ul className="mt-2 divide-y divide-separator rounded-md border border-edge/60">
              {diagnostic.output.proposed_writes.map((write, index) => (
                <li
                  key={`${write.kind}-${write.title}-${index}`}
                  className="p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {humanizeAgentText(write.title)}
                    </p>
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
                  </div>
                  {write.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {humanizeAgentText(write.description)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              El consultor revisará estas propuestas antes de incorporarlas a
              tus tareas.
            </p>
          </section>
        ) : tasksFeedback ? (
          <p className="text-sm text-muted">{tasksFeedback}</p>
        ) : null;

      return (
        <div className="space-y-5">
          {/* En "tasks" el veredicto de riesgos y el analisis en prosa no
                  se pintan: este agente propone trabajo, el diagnostico del
                  negocio es el "Resumen ejecutivo". */}
          {variant === "tasks" ? null : (
            <AiVerdict findings={cleanFindings} pendingCount={pendingCount} />
          )}

          {connectors.length ? (
            <p className="text-xs text-muted">
              Sin conectar: {connectors.join(" · ")}. El análisis los omite —{" "}
              <Link href="/integraciones">conéctalos en Integraciones</Link>.
            </p>
          ) : null}

          {diagnostic.output.headline ? (
            <p className="text-sm font-semibold text-foreground">
              {diagnostic.output.headline}
            </p>
          ) : null}

          {diagnostic.output.sections?.length ? (
            <div className="grid gap-x-5 gap-y-6 lg:grid-cols-2">
              {diagnostic.output.sections.map((section) => (
                <section
                  key={section.key}
                  aria-labelledby={`monitor-section-${section.key}`}
                  className="flex flex-col"
                >
                  <div className="mb-2 flex min-h-7 items-center justify-between gap-3">
                    <h3
                      id={`monitor-section-${section.key}`}
                      className="text-base font-semibold leading-6 text-foreground"
                    >
                      {section.label}
                    </h3>
                    <span className="shrink-0 text-xs text-muted">
                      {section.findings.length} hallazgos · {section.recommendations.length} acciones
                    </span>
                  </div>
                  <div className="flex-1 rounded-lg border border-edge/60 bg-surface p-4">
                    {section.findings.length ? (
                      <FindingsList rows={section.findings} areas={areas} />
                    ) : null}
                    {section.recommendations.length ? (
                      <div className={section.findings.length ? "mt-4 border-t border-separator pt-3" : "pt-0"}>
                        <h4 className="text-sm font-semibold text-foreground">
                          Qué hacer
                        </h4>
                        <ul className="mt-2 divide-y divide-separator">
                          {section.recommendations.map((recommendation, index) => (
                            <li key={index} className="py-3 first:pt-0 last:pb-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  tone={
                                    ["urgent", "high"].includes(recommendation.priority)
                                      ? "danger"
                                      : recommendation.priority === "medium"
                                        ? "warn"
                                        : "neutral"
                                  }
                                >
                                  {priorityLabelsEs[recommendation.priority] ?? recommendation.priority}
                                </Badge>
                                <Badge tone="neutral">
                                  {ownerLabelsEs[recommendation.owner] ?? recommendation.owner}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm text-foreground">
                                {humanizeAgentText(recommendation.action)}
                              </p>
                              {recommendation.expected_impact ? (
                                <p className="mt-1 text-xs leading-relaxed text-muted">
                                  {humanizeAgentText(recommendation.expected_impact)}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {variant === "tasks" || hasMonitorSections ? null : (
            <div>
              {variant === "full" ? (
                <h3 className="text-base font-semibold text-foreground">
                  Análisis
                </h3>
              ) : null}
              <p
                className={`text-[13px] leading-relaxed text-foreground${
                  variant === "full" ? " mt-1" : ""
                }${answerExpanded ? "" : " line-clamp-3"}`}
              >
                {humanizeAgentText(diagnostic.output.answer ?? "")}
              </p>
              {(diagnostic.output.answer?.length ?? 0) > 220 ? (
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
              Sin cambios desde la última vez: no se ha vuelto a analizar porque
              no ha habido actividad en la tienda. Usa “Actualizar ahora” para
              forzarlo.
            </p>
          ) : null}

          {proposedBlock}

          {renderPreview ? <A26EmailRenderPreview organizationId={organizationId} runId={diagnostic.run_id} /> : null}

          {variant === "tasks" && !diagnostic.output.proposed_writes.length ? (
            <p className="text-sm text-muted">
              Sin tareas nuevas en este ciclo. Las que ya existen están en{" "}
              <Link href="/tareas">Tareas</Link>.
            </p>
          ) : null}

          {variant === "full" && !hasMonitorSections && riskFindings.length ? (
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Riesgos ({riskFindings.length})
              </h3>
              <FindingsList rows={riskFindings} areas={areas} />
            </div>
          ) : null}

          {variant === "full" && !hasMonitorSections && observationFindings.length ? (
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
                <FindingsList rows={observationFindings} areas={areas} />
              ) : null}
            </div>
          ) : null}

          {variant === "full" && !hasMonitorSections && sortedRecs.length ? (
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Recomendaciones
              </h3>
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

          <TrustStrip diagnostic={diagnostic} showInternals={showInternals} />
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
        {diagnostic ? <AgentOutputThread key={diagnostic.output_id} organizationId={organizationId} outputId={diagnostic.output_id} /> : null}
      </div>
    );
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Badge tone="brand">IA</Badge>
          {title}
        </span>
      }
      description={meta ?? undefined}
      actions={refreshButton}
    >
      {body}
      {diagnostic ? <AgentOutputThread key={diagnostic.output_id} organizationId={organizationId} outputId={diagnostic.output_id} /> : null}
    </Card>
  );
}
