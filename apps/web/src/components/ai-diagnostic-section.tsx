"use client";


import { useEffect, useEffectEvent, useState, type ComponentProps, type FormEvent } from "react";
import { A26ContentReviews, type ContentReview } from "./a26-content-reviews";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { agentTagForPath } from "@/lib/agent-tag";
import { useActiveConnection } from "@/components/active-connection";
import { useInsights } from "@/components/insights-context";
import { insightSpotsFromFindingAreas } from "@/lib/insights-registry";
import { AiFigure, emphasizeNumbers } from "@/components/ai-insight";
import {
  EmptyState,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Banner,
  Button,
  ErrorBlock,
  Link,
  LoadingBlock,
  CheckIcon,
  CloseIcon,
  type Tone,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  IconChevronDown,
} from "@/components/ui";

type Finding = {
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  evidence: string;
  /** Clave de la lista cerrada del prompt; se traduce con `areas`. */
  area?: string;
  /** Las cifras del hallazgo como datos (contrato común de los agentes). */
  figures?: Array<{ label: string; value: string; previous: string | null; change_pct: number | null }>;
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
  content_decision?: "no_change" | "needs_evidence" | "revision_proposal";
  content_reviews?: ContentReview[];
  content_evidence?: { as_of?: string; inventory_complete?: boolean; messages?: Array<{ message_id: string; account_id: string; pertenece_a?: string; asunto?: string }> };
  visual_review?: { status: string; render_id?: string; screenshots_supplied_to_vision?: number };
  /** Legacy agents keep this; A02 v9 emits a headline instead. */
  answer?: string;
  headline?: string;
  sections?: MonitorSection[];
  findings: Finding[];
  recommendations: Recommendation[];
  measurement_assessment?: {
    status: "usable_with_attribution_limits" | "restricted" | "not_assessable" | "unknown";
    reason_codes?: string[];
    limitations?: string[];
    scope?: { store_id?: string | null };
    window?: { start?: string; end?: string; timezone?: string };
    evaluated_at?: string;
    expires_at?: string;
    evidence_counts?: Record<string, number>;
    capability_matrix?: Array<{ capability: string; state: string }>;
    action_limits?: string[];
  };
  creative_decisions?: Array<{
    decision_ref: string;
    action: "observe" | "test_variant" | "investigate_landing_offer" | "propose_pause";
    store_id: string | null;
    account_id: string | null;
    ad_id: string | null;
    creative_id: string | null;
    signal: string;
    window: string;
    spend_implicated: number | null;
    spend_currency: string | null;
    uncertainty: string;
    hypothesis: string;
    success_criterion: string;
    primary_metric: string;
    metric_denominator: string;
    comparator: string;
    evaluation_window_days: number;
    maturity_days: number | null;
    measurement_verdict: "usable_with_attribution_limits" | "restricted" | "not_assessable" | "unknown";
  }>;
  change_observations?: Array<{
    event_ref: string | null;
    action: "investigate" | "document" | "review" | "handoff";
    interpretation: string;
    limitation: string;
    next_review_at: string | null;
  }>;
  change_evidence?: Array<{
    event_id: string;
    event_time: string;
    event_type: string;
    object_name: string | null;
    entity_level: string | null;
    comparison_status: string;
    currency_code: string | null;
    days_before: number;
    days_after: number;
  }>;
  change_coverage?: { total_count: number; has_more: boolean };
  flow_architecture?: {
    decision: "no_change" | "needs_validation" | "design_proposal";
    summary: string;
    candidates: Array<{
      action: "create" | "adjust" | "retire" | "measure";
      name: string;
      objective: string;
      entry_trigger: string;
      trigger_verification: "verified" | "unverified" | "not_available";
      entry_conditions: string[];
      exit_conditions: string[];
      exclusions: string[];
      sequence: Array<{ step: number; channel: "email" | "sms" | "push" | "wait" | "branch" | "other"; delay: string; purpose: string }>;
      cadence: string;
      priority: "low" | "medium" | "high";
      primary_kpi: string;
      stop_rule: string;
      evidence: Array<{ source: string; period: string; sample_size: number | null; coverage: "complete" | "partial" | "insufficient" | "not_available" }>;
      data_gaps: string[];
      conflicts: Array<{ existing_flow_or_campaign: string; conflict: string; resolution: string }>;
    }>;
  };
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
    initiative_change?: {
      action: "replace" | "retire";
      previous_task_id: string;
      previous_task_title: string;
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
  visual_review_live?: {
    status: string;
    model_review_status?: string;
    archived_receipt?: { html_hash?: string; renderer_policy_version?: string } | null;
  } | null;
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

function A26EmailRenderPreview({ organizationId, runId, receipt }: { organizationId: string; runId: string; receipt?: Diagnostic["visual_review_live"] }) {
  const [previews, setPreviews] = useState<Array<{ viewport: string; url: string }>>([]);
  const [state, setState] = useState<"loading" | "ready" | "pending" | "error" | "expired" | "failed">("loading");

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];
    setPreviews([]);
    if (receipt?.status === "expired_or_not_available" || receipt?.status === "failed") {
      setState(receipt.status === "failed" ? "failed" : "expired");
      return;
    }
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
            if (response.status === 410) { if (active) setState("expired"); return; }
            if (!response.ok) throw new Error("render_preview_load_failed");
            const blob = await response.blob();
            if (!active) return;
            const url = URL.createObjectURL(blob);
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
  }, [organizationId, runId, receipt?.status]);

  return (
    <Card role="region" aria-label="Simulación visual del email"><CardContent className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Vista simulada del email</h3>
        <p className="mt-1 text-xs leading-5 text-muted">No es una captura de bandeja de entrada. Las imágenes y fuentes externas pueden no cargarse en esta simulación.</p>
      </div>
      {state === "loading" ? <p className="text-sm text-muted">Buscando las capturas…</p> : null}
      {state === "pending" ? <p className="text-sm text-muted">La captura aún no está lista; aparecerá cuando termine el render aislado.</p> : null}
      {state === "error" ? <p role="status" className="text-sm text-muted">No se pudieron cargar las capturas visuales.</p> : null}
      {state === "expired" ? <p className="text-sm text-muted">Las capturas ya no están disponibles. La revisión editorial y su registro se conservan.</p> : null}
      {state === "failed" ? <p className="text-sm text-muted">La simulación visual falló. Las conclusiones deben limitarse a la evidencia disponible.</p> : null}
      {receipt?.model_review_status ? <p className="text-xs text-muted">{receipt.model_review_status === "included_in_diagnosis" ? "El diagnóstico incluyó la captura disponible en ese momento." : "Una captura posterior puede revisarse aquí sin repetir el análisis. No forma parte del diagnóstico guardado."}</p> : null}
      {receipt?.archived_receipt?.html_hash ? <Collapsible className="text-xs text-muted"><CollapsibleTrigger>Registro de la simulación<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger><CollapsibleContent><p className="mt-2 break-all">HTML: {receipt.archived_receipt.html_hash}</p><p>Política: {receipt.archived_receipt.renderer_policy_version ?? "No disponible"}</p></CollapsibleContent></Collapsible> : null}
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
    </CardContent></Card>
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
        if (!response.ok) throw new Error(payload.message ?? "No se ha podido cargar la conversación.");
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
      if (!response.ok) throw new Error(payload.message ?? "No se ha podido guardar la nota. Inténtalo de nuevo.");
      setNotes((current) => [...current, { ...payload.note, author_name: null }]); setBody(""); setExpanded(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la nota."); }
    finally { setSaving(false); }
  }
  return <Collapsible open={expanded} onOpenChange={setExpanded} className="border-t border-separator pt-3">
    <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
      {expanded ? "Ocultar conversación" : `Notas del equipo${notes.length ? ` · ${notes.length}` : ""}`}
      <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
    </CollapsibleTrigger>
    <CollapsibleContent className="mt-2 space-y-3">
      {notes.map((note) => <div key={note.id} className="rounded-md bg-surface-subtle p-3">
        <p className="text-xs font-medium text-muted">{note.author_name ?? ({ consultant: "Consultor", client: "Cliente", platform: "E-NORA", ai: "IA" }[note.author_kind] ?? "Equipo")} · {new Date(note.created_at).toLocaleString("es-ES")}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>
      </div>)}
      <form onSubmit={submit} className="space-y-2"><textarea className="field min-h-20 w-full" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="Añade una observación para el equipo…" />
        <Button type="submit" size="sm" disabled={saving || !body.trim()}>{saving ? "Guardando…" : "Añadir nota"}</Button>
      </form>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </CollapsibleContent>
  </Collapsible>;
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

export function humanizeAgentText(text: string | null | undefined): string {
  if (!text) return "";
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

/** La sección del monitor con el hallazgo más grave, la que se abre de entrada. */
function worstSectionKey(sections: Array<{ key: string; findings: Finding[] }>): string[] {
  let worst: { key: string; rank: number } | null = null;
  for (const section of sections) {
    for (const finding of section.findings) {
      const rank = SEVERITY_RANK[finding.severity];
      if (!worst || rank > worst.rank) worst = { key: section.key, rank };
    }
  }
  return worst ? [worst.key] : [];
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
            {finding.figures?.length ? (
              <div className="mt-2 grid max-w-[40rem] grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
                {finding.figures.map((figure, figureIndex) => (
                  <AiFigure
                    key={`${figure.label}-${figureIndex}`}
                    {...figure}
                    tone={(finding.severity === "critical" || finding.severity === "high") && figure.change_pct != null ? "bad" : null}
                  />
                ))}
              </div>
            ) : null}
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {emphasizeNumbers(humanizeAgentText(finding.evidence))}
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
    <div className="border-t border-separator pt-3 text-xs text-muted">
      {bits.join(" · ")}
      {sources.length ? (
        <>
          {" · "}
          <HoverCard>
            <HoverCardTrigger
              render={
                <button type="button" className="underline decoration-dotted underline-offset-2">
                  {sources.length} fuente{sources.length > 1 ? "s" : ""}
                </button>
              }
            />
            <HoverCardContent side="top" align="start">
              <p className="font-medium text-foreground">Fuentes del análisis</p>
              <ul className="list-disc space-y-1 pl-4 text-muted">
                {sources.map((source) => (
                  <li key={source.label}>{source.label}</li>
                ))}
              </ul>
            </HoverCardContent>
          </HoverCard>
        </>
      ) : null}
      {showInternals && diagnostic.runtime?.langsmith_tracing
        ? " · trazas on"
        : ""}
    </div>
  );
}

/**
 * Bloque de diagnóstico reutilizable (A02, A04, A06). Al montarse solo lee el
 * resultado almacenado; A02 solo se genera mediante el cron. La aprobación humana solo materializa proposed_writes
 * como tareas reales. Mismo patrón de caché de
 * 24h en el backend (getMonitorDiagnostic / getTaskPlannerDiagnostic /
 * getStockPlannerDiagnostic), solo cambia el par de endpoints.
 */
export function AiDiagnosticSection({
  organizationId,
  title,
  description,
  getPath,
  runPath,
  loadingLabel,
  tasksLabelSingular,
  days,
  variant = "full",
  bare = false,
  showInternals = false,
  showLimitations = false,
  canReviewProposals = true,
  showMeta = true,
  areas,
  renderPreview = false,
  connectionIdOverride,
  onVerdict,
}: {
  organizationId: string;
  title: string;
  description?: string;
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
  /** Límites del análisis relevantes para el negocio, visibles en el plan semanal. */
  showLimitations?: boolean;
  /** La autorización definitiva se comprueba en el servidor. */
  canReviewProposals?: boolean;
  // Permite ocultar el periodo y la fecha generada en paneles de decisión.
  showMeta?: boolean;
  // Adonde lleva cada hallazgo. Lo aporta la pantalla que monta la seccion,
  // porque es la unica que sabe que bloques tiene y con que ancla. Sin esto,
  // un hallazgo se lee y no se arregla.
  areas?: FindingAreas;
  /** Muestra capturas privadas de la simulación A26 asociadas al run actual. */
  renderPreview?: boolean;
  connectionIdOverride?: string;
  /** Avisa del veredicto a quien lo pinta fuera (la cabecera de AiSpecialistItem). */
  onVerdict?: (verdict: SpecialistVerdict | null) => void;
}) {
  const { connectionId: activeConnectionId } = useActiveConnection();
  const connectionId = connectionIdOverride ?? activeConnectionId;
  const { registerLocalInsights } = useInsights();
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [notReadyMessage, setNotReadyMessage] = useState<string | null>(null);
  const [needsFirstRun, setNeedsFirstRun] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [tasksFeedback, setTasksFeedback] = useState<string | null>(null);
  const [proposalDecisions, setProposalDecisions] = useState<{
    outputId: string;
    decisions: Record<number, "approved" | "rejected">;
  } | null>(null);
  const [answerExpanded, setAnswerExpanded] = useState(false);

  // Mismos hallazgos que AiVerdict (sin conectividad y, salvo admin, sin los
  // de plataforma). Como evento de efecto: un `onVerdict` nuevo en cada
  // render del padre no vuelve a disparar el efecto.
  const reportVerdict = useEffectEvent((verdict: SpecialistVerdict | null) => onVerdict?.(verdict));
  useEffect(() => {
    if (!diagnostic || variant === "tasks") {
      reportVerdict(null);
      return;
    }
    const { rest } = partitionConnectivity(diagnostic.output.findings);
    const findings = showInternals ? rest : partitionPlatformFindings(rest).business;
    reportVerdict({
      ...findingsVerdict(findings),
      pendingCount: diagnostic.output_status === "pending_approval" ? diagnostic.output.proposed_writes.length : 0,
    });
  }, [diagnostic, variant, showInternals]);

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
          setNotReadyMessage(null);
          setNeedsFirstRun(false);
        } else {
          setDiagnostic(null);
          const message = await readApiError(response);
          // Una organizacion sin datos no es un fallo: es que todavia no toca.
          // Se cuenta como estado normal, no como error rojo.
          const sinDatos = message.startsWith("agent_sin_datos") || message.startsWith("agent_klaviyo_not_connected") || message.startsWith("agent_klaviyo_sync_pending") || message.startsWith("agent_klaviyo_account_not_ready");
          const pendiente = message.startsWith("agent_diagnostic_pending");
          setNotReady(sinDatos);
          setNotReadyMessage(
            message.startsWith("agent_klaviyo_not_connected")
              ? "Conecta una cuenta de Klaviyo para analizar campañas, flows e ingresos atribuidos."
              : message.startsWith("agent_klaviyo_sync_pending")
                ? "Klaviyo está conectado. El primer análisis estará disponible después de una sincronización correcta."
                : message.startsWith("agent_klaviyo_account_not_ready")
                  ? "La conexión de Klaviyo no está asignada a esta tienda. Vincula la cuenta a la tienda para que el análisis use el alcance correcto."
                : sinDatos
                  ? "No hay datos de Klaviyo disponibles todavía. Conecta la cuenta y espera a que termine la primera sincronización."
                  : pendiente
                    ? getPath === "/ai/klaviyo-flow-architect" ? "Este análisis se actualiza manualmente desde esta pantalla." : "El análisis se genera automáticamente dos veces al día cuando hay datos y el agente está habilitado."
                    : null,
          );
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
          headers: runPath === "/ai/klaviyo-flow-architect-run" ? { "Idempotency-Key": crypto.randomUUID() } : undefined,
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

  const generatedAt = diagnostic?.generated_at
    ? new Date(diagnostic.generated_at)
    : null;
  const generatedAtLabel =
    generatedAt && Number.isFinite(generatedAt.getTime())
      ? generatedAt.toLocaleString()
      : null;
  const meta = diagnostic && showMeta ? (
    <span className="text-xs text-muted">
      {days ? `últimos ${days} días · ` : ""}
      {diagnostic.from_cache ? "generado" : "recién generado"}
      {generatedAtLabel ? ` el ${generatedAtLabel}` : " · fecha no disponible"}
      {diagnostic.envelope && diagnostic.envelope.freshness.status !== "fresh"
        ? ` · datos ${
            freshnessLabelsEs[diagnostic.envelope.freshness.status] ??
            diagnostic.envelope.freshness.status
          }`
        : ""}
    </span>
  ) : null;

  const manualRunEnabled = runPath !== "/ai/monitor-run" && runPath !== "/ai/contenido-email-run";
  const refreshButton = manualRunEnabled && (diagnostic || needsFirstRun) ? (
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
      {notReadyMessage ?? "Conecta Klaviyo y completa la sincronización para generar el análisis."}
    </p>
  ) : needsFirstRun ? (
    <p className="text-sm leading-6 text-muted">
      El análisis se genera automáticamente dos veces al día cuando hay datos y el agente está habilitado.
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
              <h3 className="text-base font-semibold text-foreground">
                {diagnostic.output_status === "pending_approval"
                  ? `${pluralEs(tasksLabelSingular)} propuestas (${diagnostic.output.proposed_writes.length})`
                  : `${pluralEs(tasksLabelSingular)} propuestas · ya revisadas`}
              </h3>
              <Link href="/tareas">Ver en Tareas</Link>
            </div>

            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {diagnostic.output.proposed_writes.map((write, index) => {
                const selectedDecision =
                  proposalDecisions?.outputId === diagnostic.output_id
                    ? proposalDecisions.decisions[index]
                    : undefined;
                const selectable = canReviewProposals && diagnostic.output_status === "pending_approval";
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
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {humanizeAgentText(write.description)}
                      </p>
                    ) : null}
                    {write.owner_role || write.completion_criteria || write.expected_metric || write.due_hint ? (
                      <dl className="mt-2 grid gap-1 border-t border-separator pt-2 text-sm">
                        {write.owner_role ? <div><dt className="inline font-medium text-foreground">Rol de ejecución: </dt><dd className="inline text-muted">{write.owner_role}</dd></div> : null}
                        {write.completion_criteria ? <div><dt className="inline font-medium text-foreground">Cierre: </dt><dd className="inline text-muted">{humanizeAgentText(write.completion_criteria)}</dd></div> : null}
                        {write.expected_metric ? <div><dt className="inline font-medium text-foreground">Métrica a revisar: </dt><dd className="inline text-muted">{humanizeAgentText(write.expected_metric)}</dd></div> : null}
                        {write.due_hint ? <div><dt className="inline font-medium text-foreground">Plazo orientativo: </dt><dd className="inline text-muted">{humanizeAgentText(write.due_hint)}</dd></div> : null}
                      </dl>
                    ) : null}
                    {write.initiative_measurement ? (
                      <p className="mt-2 border-t border-separator pt-2 text-sm text-muted">
                        <span className="font-medium text-foreground">Medición mensual: </span>
                        {humanizeAgentText(write.initiative_measurement.metric_name)} · base {write.initiative_measurement.baseline === null ? "no disponible" : `${write.initiative_measurement.baseline}${write.initiative_measurement.unit ? ` ${write.initiative_measurement.unit}` : ""}`} · objetivo {write.initiative_measurement.target === null ? "sin definir" : `${write.initiative_measurement.target}${write.initiative_measurement.unit ? ` ${write.initiative_measurement.unit}` : ""}`} · {humanizeAgentText(write.initiative_measurement.evaluation_window)}
                      </p>
                    ) : null}
                    {write.initiative_change ? (
                      <p className="mt-2 rounded-md border border-warning/30 bg-warning/5 p-2 text-sm text-muted">
                        <span className="font-medium text-foreground">Cambio mensual: </span>
                        {write.initiative_change.action === "retire" ? "retirar" : "sustituir"} «{humanizeAgentText(write.initiative_change.previous_task_title)}». Si se aprueba, la iniciativa anterior quedará cancelada con su historial y, al sustituirla, se creará una versión enlazada.
                      </p>
                    ) : null}
                    {selectable ? (
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-separator pt-2">
                        <span className="text-sm text-muted">
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
              {!canReviewProposals && diagnostic.output_status === "pending_approval" ? <p className="text-sm text-muted">Tu consultor revisará estas propuestas antes de convertirlas en tareas.</p> : null}
              {canReviewProposals ? <>
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
                <div className="text-sm text-muted">
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
              </> : null}
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

      const creativeDecisions = diagnostic.output.creative_decisions ?? [];
      const creativeDecisionBlock = creativeDecisions.length ? (
        <section aria-label="Decisiones sobre creatividades" className="space-y-3">
          <h3 className="text-base font-semibold text-foreground">Qué hacer con las creatividades</h3>
          <ul className="grid gap-3 lg:grid-cols-2">
            {creativeDecisions.map((decision, index) => {
              const actionLabels = {
                observe: "Seguir observando",
                test_variant: "Probar una variante",
                investigate_landing_offer: "Investigar oferta o landing",
                propose_pause: "Propuesta de pausa · requiere aprobación",
              } as const;
              const gateLabels = {
                usable_with_attribution_limits: "Medición utilizable con límites",
                restricted: "Medición restringida",
                not_assessable: "No evaluable",
                unknown: "Medición desconocida",
              } as const;
              const spend = decision.spend_implicated === null
                ? "Importe no disponible"
                : decision.spend_currency
                  ? new Intl.NumberFormat("es-ES", {
                      style: "currency",
                      currency: decision.spend_currency,
                    }).format(decision.spend_implicated)
                  : "Importe sin divisa verificada";
              return (
                <li key={decision.decision_ref || `${decision.action}-${index}`}><Card><CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={decision.action === "propose_pause" ? "warn" : "neutral"}>
                      {actionLabels[decision.action]}
                    </Badge>
                    <Badge tone={decision.measurement_verdict === "usable_with_attribution_limits" ? "neutral" : "warn"}>
                      {gateLabels[decision.measurement_verdict]}
                    </Badge>
                    <Badge tone="neutral">{decision.decision_ref}</Badge>
                  </div>
                  {decision.ad_id ? (
                    <p className="mt-2 text-sm text-muted">
                      Anuncio {decision.ad_id} · Cuenta {decision.account_id ?? "sin identificar"}
                    </p>
                  ) : null}
                  <p className="mt-3 text-sm font-medium text-foreground">{humanizeAgentText(decision.signal)}</p>
                  <dl className="mt-3 grid gap-2 border-t border-separator pt-3 text-sm">
                    <div><dt className="font-medium text-foreground">Ventana y gasto</dt><dd className="text-muted">{humanizeAgentText(decision.window)} · {spend}</dd></div>
                    <div><dt className="font-medium text-foreground">Incertidumbre</dt><dd className="text-muted">{humanizeAgentText(decision.uncertainty)}</dd></div>
                    <div><dt className="font-medium text-foreground">Hipótesis</dt><dd className="text-muted">{humanizeAgentText(decision.hypothesis)}</dd></div>
                    <div><dt className="font-medium text-foreground">Cómo medir el éxito</dt><dd className="text-muted">{humanizeAgentText(decision.success_criterion)}</dd></div>
                    <div><dt className="font-medium text-foreground">Diseño de la prueba</dt><dd className="text-muted">{humanizeAgentText(decision.primary_metric)} / {humanizeAgentText(decision.metric_denominator)} · comparador: {decision.comparator} · evaluación: {decision.evaluation_window_days} días{decision.maturity_days !== null ? ` · maduración: ${decision.maturity_days} días` : ""}</dd></div>
                  </dl>
                </CardContent></Card></li>
              );
            })}
          </ul>
        </section>
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
              <span className="mr-1.5 text-muted">{agentTagForPath(getPath)} ·</span>
              {diagnostic.output.headline}
            </p>
          ) : null}

          {diagnostic.output.flow_architecture ? (() => {
            const architecture = diagnostic.output.flow_architecture;
            const decisionLabel = {
              no_change: "Sin cambio propuesto",
              needs_validation: "Falta validar datos",
              design_proposal: "Diseño para revisar",
            }[architecture.decision];
            const actionLabels = { create: "Crear", adjust: "Ajustar", retire: "Retirar", measure: "Medir" };
            const verificationLabels = { verified: "evento verificado", unverified: "evento por verificar", not_available: "evento no disponible" };
            const coverageLabels = { complete: "completa", partial: "parcial", insufficient: "insuficiente", not_available: "no disponible" };
            return (
              <Card role="region" aria-labelledby="flow-architecture-title"><CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 id="flow-architecture-title" className="text-base font-semibold text-foreground">Diseño revisable del flujo</h3>
                  <Badge tone={architecture.decision === "design_proposal" ? "neutral" : "warn"}>{decisionLabel}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted">{humanizeAgentText(architecture.summary.slice(0, 320))}{architecture.summary.length > 320 ? "…" : ""}</p>
                {architecture.summary.length > 320 ? <Collapsible className="mt-2 text-sm"><CollapsibleTrigger className="text-muted">Leer el contexto completo<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger><CollapsibleContent><p className="mt-2 text-muted">{humanizeAgentText(architecture.summary)}</p></CollapsibleContent></Collapsible> : null}
                {architecture.candidates.length ? (
                  <Accordion multiple className="mt-2">
                    {architecture.candidates.map((candidate, index) => (
                      <AccordionItem key={`${candidate.action}-${candidate.name}-${index}`} value={String(index)}>
                        <AccordionTrigger>
                          <span className="grid min-w-0 gap-1.5">
                            <span className="flex flex-wrap items-center gap-2">
                              <Badge tone={candidate.priority === "high" ? "warn" : "neutral"}>{actionLabels[candidate.action]}</Badge>
                              <Badge tone="neutral">Prioridad {priorityLabelsEs[candidate.priority]}</Badge>
                              <Badge tone={candidate.trigger_verification === "verified" ? "neutral" : "warn"}>{verificationLabels[candidate.trigger_verification]}</Badge>
                            </span>
                            <span className="font-semibold text-foreground">{humanizeAgentText(candidate.name)}</span>
                            <span className="font-normal text-muted">{humanizeAgentText(candidate.objective.slice(0, 220))}{candidate.objective.length > 220 ? "…" : ""}</span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                        <dl className="grid gap-3 text-sm sm:grid-cols-2">
                          <div><dt className="font-medium text-foreground">Entrada</dt><dd className="text-muted">{humanizeAgentText(candidate.entry_trigger)}{candidate.entry_conditions.length ? ` · ${candidate.entry_conditions.map(humanizeAgentText).join("; ")}` : ""}</dd></div>
                          <div><dt className="font-medium text-foreground">Salida y exclusiones</dt><dd className="text-muted">{[...candidate.exit_conditions, ...candidate.exclusions].map(humanizeAgentText).join("; ") || "Por definir y validar antes de activar"}</dd></div>
                          <div><dt className="font-medium text-foreground">Cadencia</dt><dd className="text-muted">{humanizeAgentText(candidate.cadence)}</dd></div>
                          <div><dt className="font-medium text-foreground">KPI y parada</dt><dd className="text-muted">{humanizeAgentText(candidate.primary_kpi)} · {humanizeAgentText(candidate.stop_rule)}</dd></div>
                        </dl>
                        {candidate.sequence.length ? <ol className="mt-3 list-inside list-decimal text-sm text-muted">{candidate.sequence.map((step) => <li key={step.step}>{step.channel}: {humanizeAgentText(step.purpose)} ({humanizeAgentText(step.delay)})</li>)}</ol> : null}
                        {candidate.evidence.length ? <p className="mt-3 text-xs text-muted">Evidencia: {candidate.evidence.map((item) => `${humanizeAgentText(item.source)}, ${humanizeAgentText(item.period)}, muestra ${item.sample_size ?? "no disponible"}, cobertura ${coverageLabels[item.coverage]}`).join(" · ")}</p> : null}
                        {candidate.data_gaps.length ? <p className="mt-2 text-xs text-muted">Por validar: {candidate.data_gaps.map(humanizeAgentText).join("; ")}</p> : null}
                        {candidate.conflicts.length ? <ul className="mt-2 list-inside list-disc text-xs text-muted">{candidate.conflicts.map((item, conflictIndex) => <li key={`${item.existing_flow_or_campaign}-${conflictIndex}`}>Conflicto con {humanizeAgentText(item.existing_flow_or_campaign)}: {humanizeAgentText(item.conflict)}. Revisar: {humanizeAgentText(item.resolution)}</li>)}</ul> : null}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : <EmptyState size="sm" title="No hay candidatos con evidencia suficiente" />}
              </CardContent></Card>
            );
          })() : null}

          {diagnostic.output.sections?.length ? (
            // Abierta de entrada solo la sección con el hallazgo más grave; el
            // resto se lee por su cabecera (cuántos hallazgos y acciones trae).
            <Accordion multiple defaultValue={worstSectionKey(diagnostic.output.sections)}>
              {diagnostic.output.sections.map((section) => (
                <AccordionItem key={section.key} value={section.key}>
                  <AccordionTrigger className="text-base font-semibold">
                    <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span>{section.label}</span>
                      <span className="text-xs font-normal text-muted">
                        {section.findings.length} hallazgos · {section.recommendations.length} acciones
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
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
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : null}

          {(variant === "tasks" && getPath !== "/ai/task-planner") || hasMonitorSections ? null : (
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
                <span className="mr-1.5 text-muted">{agentTagForPath(getPath)} ·</span>
                {humanizeAgentText(diagnostic.output.answer ?? "")}
              </p>
              {(diagnostic.output.answer?.length ?? 0) > 220 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="mt-1 px-0"
                  aria-expanded={answerExpanded}
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
              no ha habido actividad en la tienda.
            </p>
          ) : null}

          {proposedBlock}

          {getPath === "/ai/medicion-meta" && diagnostic.output.measurement_assessment ? (
            <Card size="sm" role="region" aria-label="Evaluación técnica de medición Meta"><CardContent>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Estado técnico de la medición</h3>
                <Badge tone={diagnostic.output.measurement_assessment.status === "usable_with_attribution_limits" ? "neutral" : "warn"}>
                  {{
                    usable_with_attribution_limits: "Señal observable; atribución limitada",
                    restricted: "Medición con restricciones",
                    not_assessable: "Sin muestra suficiente",
                    unknown: "No se puede verificar",
                  }[diagnostic.output.measurement_assessment.status]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted">
                Ventana completa UTC: {diagnostic.output.measurement_assessment.window?.start ?? "—"} a {diagnostic.output.measurement_assessment.window?.end ?? "—"}.
                {diagnostic.output.measurement_assessment.evaluated_at ? ` Evaluado ${new Date(diagnostic.output.measurement_assessment.evaluated_at).toLocaleString("es-ES")}.` : ""}
                {diagnostic.output.measurement_assessment.expires_at ? ` Vigente hasta ${new Date(diagnostic.output.measurement_assessment.expires_at).toLocaleString("es-ES")}.` : ""}
              </p>
              {diagnostic.output.measurement_assessment.reason_codes?.length ? (
                <p className="mt-2 text-xs text-muted">Motivos técnicos: {diagnostic.output.measurement_assessment.reason_codes.join(", ")}.</p>
              ) : null}
              {diagnostic.output.measurement_assessment.limitations?.length ? (
                <p className="mt-1 text-xs text-muted">{diagnostic.output.measurement_assessment.limitations.slice(0, 2).join(" ")}</p>
              ) : null}
              {diagnostic.output.measurement_assessment.capability_matrix?.some((item) => item.state === "requires_external_verification") ? (
                <p className="mt-2 text-xs text-muted">CAPI, deduplicación, calidad de coincidencia y aislamiento del dominio requieren comprobación en Events Manager o evidencia autorizada. Los eventos agregados disponibles no certifican esos aspectos.</p>
              ) : null}
              {diagnostic.output.measurement_assessment.action_limits?.length ? (
                <p className="mt-1 text-xs text-muted">{diagnostic.output.measurement_assessment.action_limits[0]}</p>
              ) : null}
            </CardContent></Card>
          ) : null}

          {getPath === "/ai/cambios-meta" && diagnostic.output.change_observations?.length ? (
            <Card size="sm" role="region" aria-label="Observaciones de cambios Meta"><CardContent>
              <h3 className="text-sm font-semibold text-foreground">Observaciones y seguimiento</h3>
              {diagnostic.output.change_coverage ? <p className="mt-1 text-xs text-muted">
                {diagnostic.output.change_coverage.total_count} eventos en el periodo; esta lectura {diagnostic.output.change_coverage.has_more ? "muestra una página de la evidencia" : "incluye todos los eventos devueltos"}.
              </p> : null}
              <Accordion multiple className="mt-1">
                {diagnostic.output.change_observations.map((observation, index) => (
                  <AccordionItem key={`${observation.event_ref ?? "scope"}-${index}`} value={String(index)}>
                    <AccordionTrigger className="py-3">
                      <span className="grid min-w-0 gap-1.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{{ investigate: "Investigar", document: "Documentar", review: "Revisar", handoff: "Derivar" }[observation.action]}</Badge>
                          {observation.event_ref ? <span className="text-xs font-normal text-muted">Evento {observation.event_ref.slice(0, 8)}</span> : null}
                        </span>
                        <span className="font-normal">{humanizeAgentText(observation.interpretation)}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-3">
                    {observation.event_ref ? (() => {
                      const event = diagnostic.output.change_evidence?.find((row) => row.event_id === observation.event_ref);
                      if (!event) return null;
                      const status = {
                        comparable_observation_only: "Ventanas completas; no causa",
                        unresolved_entity: "Entidad sin resolver",
                        attribution_immature: "Atribución inmadura",
                        partial_before_window: "Ventana previa parcial",
                        partial_after_window: "Ventana posterior parcial",
                        below_minimum_spend: "Muestra bajo umbral",
                        no_attribution: "Sin atribución disponible",
                        currency_unknown: "Moneda desconocida",
                      }[event.comparison_status] ?? "Comparación limitada";
                      return <p className="text-xs text-muted">{event.event_time} · {event.event_type}{event.object_name ? ` · ${event.object_name}` : ""} · {status} · {event.days_before}/{event.days_after} días observados{event.currency_code ? ` · ${event.currency_code}` : ""}</p>;
                    })() : null}
                    <p className="mt-1 text-xs text-muted">Límite: {humanizeAgentText(observation.limitation)}</p>
                    {observation.next_review_at ? <p className="mt-1 text-xs text-muted">Próxima revisión: {new Date(observation.next_review_at).toLocaleString("es-ES")}</p> : null}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent></Card>
          ) : null}

          {creativeDecisionBlock}

          {getPath === "/ai/contenido-email" && diagnostic.output.content_reviews?.length ? <A26ContentReviews organizationId={organizationId} connectionId={connectionId} outputId={diagnostic.output_id} outputStatus={diagnostic.output_status} reviews={diagnostic.output.content_reviews.map((review) => {
            const source = diagnostic.output.content_evidence?.messages?.find((row) => row.message_id === review.message_id && row.account_id === review.account_id);
            return { ...review, message_label: [source?.pertenece_a, source?.asunto].filter(Boolean).join(" · ") || undefined };
          })} /> : null}
          {diagnostic.output.content_decision ? <p className="text-sm text-muted">{diagnostic.output.content_decision === "no_change" ? "Sin cambios justificados con la evidencia revisada." : diagnostic.output.content_decision === "needs_evidence" ? "Falta evidencia para proponer una revisión." : "Revisión editorial propuesta."}</p> : null}
          {renderPreview && diagnostic.output.visual_review?.render_id ? <A26EmailRenderPreview organizationId={organizationId} runId={diagnostic.run_id} receipt={diagnostic.visual_review_live} /> : null}

          {variant === "tasks" && getPath !== "/ai/task-planner" && !diagnostic.output.proposed_writes.length ? (
            <EmptyState size="sm" title="Sin tareas nuevas en este ciclo" hint={<>Las que ya existen están en <Link href="/tareas">Tareas</Link>.</>} />
          ) : null}

          {/* Riesgos y qué hacer abiertos de entrada; las observaciones sin
              riesgo, plegadas: se leen si se buscan, no compiten. */}
          {variant === "full" && !hasMonitorSections && (riskFindings.length || observationFindings.length || sortedRecs.length) ? (
            <Accordion multiple defaultValue={["riesgos", "recomendaciones"]}>
              {riskFindings.length ? (
                <AccordionItem value="riesgos">
                  <AccordionTrigger className="text-base font-semibold">Riesgos ({riskFindings.length})</AccordionTrigger>
                  <AccordionContent>
                    <FindingsList rows={riskFindings} areas={areas} />
                  </AccordionContent>
                </AccordionItem>
              ) : null}
              {observationFindings.length ? (
                <AccordionItem value="observaciones">
                  <AccordionTrigger className="text-base font-semibold">
                    {`${observationFindings.length} observación${observationFindings.length > 1 ? "es" : ""} sin riesgo`}
                  </AccordionTrigger>
                  <AccordionContent>
                    <FindingsList rows={observationFindings} areas={areas} />
                  </AccordionContent>
                </AccordionItem>
              ) : null}
              {sortedRecs.length ? (
                <AccordionItem value="recomendaciones">
                  <AccordionTrigger className="text-base font-semibold">Recomendaciones ({sortedRecs.length})</AccordionTrigger>
                  <AccordionContent>
              <ul className="space-y-2">
                {sortedRecs.map((rec, index) => (
                  <li key={index}><Card size="sm"><CardContent>
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
                  </CardContent></Card></li>
                ))}
              </ul>
                  </AccordionContent>
                </AccordionItem>
              ) : null}
            </Accordion>
          ) : null}

          {(showInternals || showLimitations) && cleanWarnings.length ? (
            <Banner tone="warn">
              <Collapsible open={warningsExpanded} onOpenChange={setWarningsExpanded}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {cleanWarnings.length === 1 ? "1 límite" : `${cleanWarnings.length} límites`} del análisis{showInternals ? " (solo lo ves tú)" : ""}
                  </span>
                  <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
                    {warningsExpanded ? "Ocultar" : "Ver"}
                    <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <ul className="mt-2 space-y-1">
                    {cleanWarnings.map((warning, index) => (
                      <li key={index}>{humanizeAgentText(warning)}</li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
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
    <Card>
      <CardHeader>
        <CardTitle><span className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Badge tone="brand">{agentTagForPath(getPath)}</Badge>
          {title}
        </span></CardTitle>
        <CardDescription>{description ? <span>{description}{meta ? <span className="ml-2">{meta}</span> : null}</span> : meta ?? undefined}</CardDescription>
        <CardAction>{refreshButton}</CardAction>
      </CardHeader>
      <CardContent>
        {body}
        {diagnostic ? <AgentOutputThread key={diagnostic.output_id} organizationId={organizationId} outputId={diagnostic.output_id} /> : null}
      </CardContent>
    </Card>
  );
}

export type SpecialistVerdict = ReturnType<typeof findingsVerdict> & { pendingCount: number };

/**
 * Un especialista IA como fila de acordeón (va dentro de <Accordion>): en la
 * cabecera, el agente y su veredicto, para saber cuál mirar sin abrirlos
 * todos; dentro, el análisis completo. Sigue montado aunque esté cerrado,
 * así que carga a la vez que la página, como antes.
 */
export function AiSpecialistItem({
  value,
  id,
  ...section
}: Omit<ComponentProps<typeof AiDiagnosticSection>, "bare" | "onVerdict"> & {
  value: string;
  /** Ancla para enlazar a este especialista: abre su fila al llegar. */
  id?: string;
}) {
  const [verdict, setVerdict] = useState<SpecialistVerdict | null>(null);
  return (
    <AccordionItem value={value} id={id}>
      <AccordionTrigger className="text-base font-semibold">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Badge tone="brand">{agentTagForPath(section.getPath)}</Badge>
          <span>{section.title}</span>
          {verdict ? <Badge tone={verdict.tone}>{verdict.text}</Badge> : null}
          {verdict?.pendingCount ? (
            <Badge tone="warn">
              {verdict.pendingCount} propuesta{verdict.pendingCount > 1 ? "s" : ""} sin decidir
            </Badge>
          ) : null}
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-3">
        {section.description ? <p className="text-sm leading-relaxed text-muted">{section.description}</p> : null}
        <AiDiagnosticSection {...section} bare onVerdict={setVerdict} />
      </AccordionContent>
    </AccordionItem>
  );
}

/** "acción" → "Acciones", "tarea de redacción" → "Tareas de redacción": plural y mayúscula inicial. */
function pluralEs(label: string) {
  const [head = "", ...rest] = label.split(" ");
  const plural = /ón$/.test(head) ? `${head.slice(0, -2)}ones` : /[aeiou]$/.test(head) ? `${head}s` : `${head}es`;
  return [plural.charAt(0).toUpperCase() + plural.slice(1), ...rest].join(" ");
}
