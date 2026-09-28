"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { AsyncState, Button, Card, ErrorBlock, Input, toast } from "@/components/ui";
import { profileScreenshotFile, type ScreenshotVisualProfile } from "./screenshot-profile";

type Entry = {
  id: string;
  entry_key: string;
  version: number;
  kind: "strategy" | "example" | "counterexample";
  title: string;
  objective: string;
  audience_tags: string[];
  lifecycle_tags: string[];
  content: Record<string, unknown>;
  evidence: Record<string, unknown>;
  source: Record<string, unknown>;
  status: "draft" | "published" | "retired";
  created_at: string;
};
type EntrySummary = Omit<Entry, "content" | "evidence" | "source">;
type PlaybookPreview = {
  candidate_count: number;
  matched_count: number;
  excluded: { not_published: number; not_strategy: number; rights_unconfirmed: number; no_match: number; outside_top_four: number };
  selected: Array<{
    id: string;
    title: string;
    objective: string;
    fit_score: number;
    matched_objective_terms: string[];
    matched_audience_tags: string[];
    planner_context: { when_to_use: string | null; when_not_to_use: string | null; sequence_arc: string | null; visual_direction: string | null; persuasion_principles: string[]; cta_guidance: string | null; risks: string[] };
  }>;
};

const blankEntry = {
  kind: "strategy",
  title: "",
  objective: "",
  audience_tags: "",
  lifecycle_tags: "",
  when_to_use: "",
  when_not_to_use: "",
  sequence_arc: "",
  visual_direction: "",
  persuasion_principles: "",
  cta_guidance: "",
  risks: "",
  lesson: "",
  excerpt: "",
  do_not_copy: "",
  source_type: "internal",
  source_reference: "",
  rights_confirmed: false,
  evidence_label: "inspiration",
  evidence_metric: "",
  evidence_denominator: "",
  evidence_period: "",
  evidence_confidence: "low",
  evidence_limitations: "",
  reference_text: "",
  raw_html: "",
  reference_notice: "",
};

function splitLines(value: string) {
  return value.split(/[,\n]/).map((part) => part.trim()).filter(Boolean);
}

function formFromEntry(editing: Entry) {
  return {
    ...blankEntry,
    kind: editing.kind,
    title: editing.title,
    objective: editing.objective,
    audience_tags: editing.audience_tags.join(", "),
    lifecycle_tags: editing.lifecycle_tags.join(", "),
    when_to_use: String(editing.content.when_to_use ?? ""),
    when_not_to_use: String(editing.content.when_not_to_use ?? ""),
    sequence_arc: String(editing.content.sequence_arc ?? ""),
    visual_direction: String(editing.content.visual_direction ?? ""),
    persuasion_principles: Array.isArray(editing.content.persuasion_principles) ? editing.content.persuasion_principles.join("\n") : "",
    cta_guidance: String(editing.content.cta_guidance ?? ""),
    risks: Array.isArray(editing.content.risks) ? editing.content.risks.join("\n") : "",
    lesson: String(editing.content.lesson ?? ""),
    excerpt: String(editing.content.excerpt ?? ""),
    do_not_copy: Array.isArray(editing.content.do_not_copy) ? editing.content.do_not_copy.join("\n") : "",
    source_type: String(editing.source.type ?? "internal"),
    source_reference: String(editing.source.reference ?? ""),
    rights_confirmed: editing.source.rights_confirmed === true,
    evidence_label: String(editing.evidence.label ?? "inspiration"),
    evidence_metric: String(editing.evidence.metric ?? ""),
    evidence_denominator: String(editing.evidence.denominator ?? ""),
    evidence_period: String(editing.evidence.period ?? ""),
    evidence_confidence: String(editing.evidence.confidence ?? "low"),
    evidence_limitations: String(editing.evidence.limitations ?? ""),
    reference_text: String(editing.content.reference_text ?? ""),
    raw_html: String(editing.content.raw_html ?? ""),
  };
}

export default function AdminMailingLaboratoryPage() {
  const { data, error, isLoading, reload } = useCachedQuery<EntrySummary[]>("/v1/admin/marketing-playbook");
  const [form, setForm] = useState(blankEntry);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [screenshotProfile, setScreenshotProfile] = useState<ScreenshotVisualProfile | null>(null);
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [visualAnalysis, setVisualAnalysis] = useState<Record<string, unknown> | null>(null);
  const [visualAnalysisRunId, setVisualAnalysisRunId] = useState<string | null>(null);
  const [previewObjective, setPreviewObjective] = useState("");
  const [previewAudience, setPreviewAudience] = useState("");
  const [preview, setPreview] = useState<PlaybookPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => () => {
    if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl);
  }, [screenshotPreviewUrl]);

  function reset() {
    setEditing(null);
    setForm(blankEntry);
    setScreenshotProfile(null);
    setScreenshotPreviewUrl(null);
    setScreenshotFile(null);
    setVisualAnalysis(null);
    setVisualAnalysisRunId(null);
  }

  async function loadEntry(entry: EntrySummary) {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/admin/marketing-playbook/${entry.id}`);
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      const loaded = await response.json() as Entry;
      setForm(formFromEntry(loaded));
      setScreenshotProfile((loaded.content.screenshot_visual_profile as ScreenshotVisualProfile | undefined) ?? null);
      setScreenshotPreviewUrl(null);
      setScreenshotFile(null);
      setVisualAnalysis((loaded.content.screenshot_semantic_analysis as Record<string, unknown> | undefined) ?? null);
      setVisualAnalysisRunId(typeof loaded.content.screenshot_analysis_run_id === "string" ? loaded.content.screenshot_analysis_run_id : null);
      setEditing(loaded);
    } catch { toast.danger("No se pudo abrir esta referencia privada."); }
    finally { setBusy(false); }
  }

  async function saveDraft() {
    setBusy(true);
    try {
      const body = {
        kind: form.kind,
        title: form.title,
        objective: form.objective,
        audience_tags: splitLines(form.audience_tags),
        lifecycle_tags: splitLines(form.lifecycle_tags),
        content: {
          when_to_use: form.when_to_use || undefined,
          when_not_to_use: form.when_not_to_use || undefined,
          sequence_arc: form.sequence_arc || undefined,
          visual_direction: form.visual_direction || undefined,
          persuasion_principles: splitLines(form.persuasion_principles),
          cta_guidance: form.cta_guidance || undefined,
          risks: splitLines(form.risks),
          lesson: form.lesson || undefined,
          excerpt: form.excerpt || undefined,
          do_not_copy: splitLines(form.do_not_copy),
          reference_text: form.reference_text || undefined,
          raw_html: form.raw_html || undefined,
          screenshot_visual_profile: screenshotProfile ?? undefined,
          screenshot_semantic_analysis: visualAnalysis ?? undefined,
          screenshot_analysis_run_id: visualAnalysisRunId ?? undefined,
        },
        evidence: {
          label: form.evidence_label,
          metric: form.evidence_metric || undefined,
          denominator: form.evidence_denominator ? Number(form.evidence_denominator) : undefined,
          period: form.evidence_period || undefined,
          confidence: form.evidence_confidence,
          limitations: form.evidence_limitations || undefined,
        },
        source: {
          type: form.source_type,
          reference: form.source_reference || undefined,
          rights_confirmed: form.rights_confirmed,
        },
      };
      const endpoint = editing ? `/v1/admin/marketing-playbook/${editing.id}/versions` : "/v1/admin/marketing-playbook";
      const response = await apiFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      toast.success("Borrador guardado como una versión nueva.");
      reset();
      reload();
    } catch { toast.danger("No se pudo guardar el borrador."); }
    finally { setBusy(false); }
  }

  async function analyzeScreenshot() {
    if (!screenshotFile || !form.rights_confirmed) return;
    setBusy(true);
    try {
      const response = await apiFetch("/v1/admin/marketing-playbook/analyze-image", {
        method: "POST",
        headers: {
          "Content-Type": screenshotFile.type || (/\.png$/i.test(screenshotFile.name) ? "image/png" : /\.jpe?g$/i.test(screenshotFile.name) ? "image/jpeg" : "image/webp"),
          "X-Reference-Rights-Confirmed": "true",
        },
        body: screenshotFile,
      });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      const result = await response.json() as { data: { run_id: string; analysis: Record<string, unknown>; usage: { estimated_cost_usd: number } } };
      setVisualAnalysis(result.data.analysis);
      setVisualAnalysisRunId(result.data.run_id);
      toast.success(`Análisis completado · coste estimado $${result.data.usage.estimated_cost_usd.toFixed(4)}`);
    } catch { toast.danger("No se pudo analizar la captura."); }
    finally { setBusy(false); }
  }

  async function runRetrievalPreview() {
    setPreviewBusy(true);
    setPreview(null);
    try {
      const response = await apiFetch("/v1/admin/marketing-playbook/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: previewObjective, audience: previewAudience || undefined }),
      });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      setPreview(await response.json() as PlaybookPreview);
    } catch { toast.danger("No se pudo simular la recuperación del playbook."); }
    finally { setPreviewBusy(false); }
  }

  async function changeStatus(entry: Pick<EntrySummary, "id" | "status">, action: "publish" | "retire") {
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/admin/marketing-playbook/${entry.id}/${action}`, { method: "POST" });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      toast.success(action === "publish" ? "Versión publicada." : "Versión retirada.");
      reload();
    } catch { toast.danger("No se pudo actualizar el estado."); }
    finally { setBusy(false); }
  }

  const field = (key: keyof typeof blankEntry, label: string, multiline = false) => (
    <label className="grid gap-1 text-sm text-muted" key={key}>
      {label}
      {multiline ? <textarea className="min-h-20 rounded-md border border-separator bg-surface px-3 py-2 text-foreground" value={form[key] as string} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /> : <Input value={form[key] as string} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />}
    </label>
  );

  return (
    <PlatformAdminShell title="Laboratorio de mailing">
      {() => (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <Card kicker="Repositorio interno" title="Patrones editoriales" description="Solo plataforma. Estas fichas no se añaden al conocimiento de clientes; A27 recupera un resumen acotado para inspirar cada secuencia.">
            <div className="mb-4 grid gap-3 rounded-md border border-separator bg-surface-subtle p-3">
              <div><p className="text-sm font-medium text-foreground">Probar recuperación de A27</p><p className="mt-1 text-xs leading-5 text-muted">Usa el mismo ranking que el planificador. No genera un mailing ni guarda datos.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs text-muted">Objetivo<Input value={previewObjective} onChange={(event) => setPreviewObjective(event.target.value)} placeholder="p. ej. bienvenida y primera compra" /></label>
                <label className="grid gap-1 text-xs text-muted">Audiencia<Input value={previewAudience} onChange={(event) => setPreviewAudience(event.target.value)} placeholder="p. ej. nuevos clientes" /></label>
              </div>
              <Button size="sm" variant="secondary" disabled={previewBusy || !previewObjective.trim()} onClick={() => void runRetrievalPreview()}>{previewBusy ? "Probando…" : "Simular selección"}</Button>
              {preview && <div className="grid gap-3 border-t border-separator pt-3">
                <p className="text-xs leading-5 text-muted">{preview.candidate_count} estrategias revisadas · {preview.matched_count} con coincidencia · A27 usa como máximo 4. Excluidas: borrador/retirada {preview.excluded.not_published}, no estrategia {preview.excluded.not_strategy}, sin derechos {preview.excluded.rights_unconfirmed}, sin coincidencia {preview.excluded.no_match}; otras coincidencias fuera del top 4: {preview.excluded.outside_top_four}.</p>
                {preview.selected.length ? <ul className="grid gap-2">{preview.selected.map((item) => <li key={item.id} className="rounded border border-separator bg-surface p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-medium text-foreground">{item.title}</p><span className="text-xs text-muted">ajuste {item.fit_score}</span></div>
                  <p className="mt-1 text-xs text-muted">{item.objective}</p>
                  <p className="mt-1 text-xs text-muted">Coincide por: {[...item.matched_objective_terms, ...item.matched_audience_tags].join(" · ") || "sin término literal"}</p>
                  <details className="mt-2 text-xs text-muted"><summary className="cursor-pointer">Contexto que recibiría A27</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(item.planner_context, null, 2)}</pre></details>
                </li>)}</ul> : <p className="text-sm text-muted">No se recuperaría ninguna estrategia; el planificador usaría su propio criterio.</p>}
              </div>}
            </div>
            {isLoading ? <AsyncState status="loading" loadingLabel="Cargando el playbook..." /> : error || !data ? <ErrorBlock>{error ?? "No se pudo cargar el playbook."}</ErrorBlock> : data.length ? (
              <ul className="divide-y divide-separator">
                {data.map((entry) => <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-foreground">{entry.title}</p><span className="rounded border border-separator px-2 py-0.5 text-xs text-muted">v{entry.version} · {entry.kind} · {entry.status}</span></div>
                    <p className="mt-1 text-sm text-muted">{entry.objective}</p>
                    <p className="mt-1 text-xs text-muted">{entry.lifecycle_tags.join(" · ") || "Sin etiquetas"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void loadEntry(entry)}>Nueva versión</Button>
                    {entry.status === "draft" && <Button size="sm" disabled={busy} onClick={() => void changeStatus(entry, "publish")}>Revisar y publicar</Button>}
                    {entry.status === "published" && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void changeStatus(entry, "retire")}>Retirar</Button>}
                  </div>
                </li>)}
              </ul>
            ) : <p className="text-sm text-muted">Aún no hay patrones. Crea la primera ficha editorial a la derecha.</p>}
          </Card>

          <Card kicker="Curación" title={editing ? `Nueva versión de ${editing.title}` : "Añadir patrón"} description="Las ediciones crean versiones nuevas; publicar requiere revisión explícita y retirar no borra el historial.">
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm text-muted">Tipo<select className="h-10 rounded-md border border-separator bg-surface px-3 text-foreground" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as typeof current.kind }))}><option value="strategy">Estrategia</option><option value="example">Ejemplo</option><option value="counterexample">Contraejemplo</option></select></label>
              {field("title", "Nombre")}{field("objective", "Objetivo / cuándo encaja", true)}
              {field("audience_tags", "Audiencias (separadas por coma)")}{field("lifecycle_tags", "Etapas o tipos de secuencia")}
              {field("when_to_use", "Cuándo aplicarlo", true)}{field("when_not_to_use", "Cuándo no aplicarlo", true)}
              {field("sequence_arc", "Arco de secuencia", true)}{field("visual_direction", "Dirección visual", true)}
              {field("persuasion_principles", "Principios persuasivos (uno por línea)", true)}{field("cta_guidance", "Guía de CTA", true)}
              {field("risks", "Riesgos y fatiga (uno por línea)", true)}{field("lesson", "Lección aprendida", true)}
              {form.kind !== "strategy" && field("excerpt", "Extracto autorizado de referencia (no copiar literalmente)", true)}
              {form.kind !== "strategy" && field("do_not_copy", "Elementos que no se deben copiar (uno por línea)", true)}
              {form.kind !== "strategy" && <>
                <label className="grid gap-1 text-sm text-muted">Importar HTML, texto, PDF o captura autorizada (imagen/PDF máx. 2 MB)<input className="rounded-md border border-separator bg-surface p-2 text-foreground" type="file" accept=".html,.htm,.txt,.pdf,.png,.jpg,.jpeg,.webp,text/html,text/plain,application/pdf,image/png,image/jpeg,image/webp" onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(file.name)) {
                    setScreenshotProfile(null);
                    setScreenshotFile(null);
                    setVisualAnalysis(null);
                    setVisualAnalysisRunId(null);
                    try {
                      const profile = await profileScreenshotFile(file);
                      setScreenshotProfile(profile);
                      setScreenshotPreviewUrl(URL.createObjectURL(file));
                      setScreenshotFile(file);
                      setVisualAnalysis(null);
                      setVisualAnalysisRunId(null);
                      setForm((current) => ({ ...current, source_reference: current.source_reference || file.name, reference_notice: "Perfil visual calculado localmente en este navegador. No se sube ni conserva la captura; comparte estimaciones de color, no OCR ni interpretación semántica." }));
                    } catch (error) {
                      setScreenshotPreviewUrl(null);
                      const reason = error instanceof Error ? error.message : "";
                      toast.danger(reason === "screenshot_dimensions_unsupported" ? "La captura supera las dimensiones admitidas." : "No se pudo analizar la captura; usa PNG, JPG o WebP de hasta 2 MB.");
                    } finally { event.target.value = ""; }
                    return;
                  }
                  setScreenshotProfile(null);
                  setScreenshotPreviewUrl(null);
                  setScreenshotFile(null);
                  setVisualAnalysis(null);
                  setVisualAnalysisRunId(null);
                  const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
                  if (isPdf) {
                    if (file.size > 2 * 1024 * 1024) { toast.danger("El PDF supera el límite de 2 MB."); event.target.value = ""; return; }
                    setBusy(true);
                    try {
                      const response = await apiFetch("/v1/admin/marketing-playbook/extract-pdf", { method: "POST", headers: { "Content-Type": "application/pdf" }, body: file });
                      if (!response.ok) { toast.danger(await readApiError(response)); return; }
                      const extracted = await response.json() as { text: string; page_count: number; pages_extracted: number; truncated: boolean };
                      setForm((current) => ({ ...current, reference_text: extracted.text, raw_html: "", source_reference: current.source_reference || file.name, reference_notice: extracted.truncated ? `Extracción parcial: ${extracted.pages_extracted} de ${extracted.page_count} páginas (o máximo de texto alcanzado). Revisa el contenido antes de guardar.` : `Texto extraído de ${extracted.pages_extracted} página(s). El PDF no se almacena.` }));
                    } catch { toast.danger("No se pudo extraer el texto del PDF."); }
                    finally { setBusy(false); }
                    return;
                  }
                  if (file.size > 60_000) { toast.danger("El archivo supera el límite de 60 KB."); event.target.value = ""; return; }
                  const value = await file.text();
                  const isHtml = /\.html?$/i.test(file.name) || file.type === "text/html";
                  setForm((current) => ({ ...current, ...(isHtml ? { raw_html: value, reference_text: "" } : { reference_text: value, raw_html: "" }), source_reference: current.source_reference || file.name, reference_notice: "" }));
                }} /></label>
                {screenshotProfile && <div className="grid gap-3 rounded-md border border-separator bg-surface-subtle p-3">
                  <p className="text-sm font-medium text-foreground">Perfil de captura · {screenshotProfile.width} × {screenshotProfile.height}</p>
                  <p className="text-xs leading-5 text-muted">Estimación local sobre una muestra de 64 × 64 píxeles. Los porcentajes no describen elementos, texto ni intención; revisa la referencia y redacta la dirección visual manualmente.</p>
                  {screenshotPreviewUrl && <Image src={screenshotPreviewUrl} alt="Previsualización temporal de la captura de referencia" width={screenshotProfile.width} height={screenshotProfile.height} unoptimized className="h-auto max-h-72 w-auto max-w-full rounded border border-separator object-contain object-left-top" />}
                  <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={busy || !screenshotFile || !form.rights_confirmed || screenshotFile.size > 1_400_000} onClick={() => void analyzeScreenshot()}>{busy ? "Analizando…" : visualAnalysis ? "Volver a analizar · IA" : "Analizar con IA"}</Button><span className="text-xs text-muted">Ejecución manual, solo admin; límite 1,4 MB, cuota y coste auditados.</span></div>
                  {visualAnalysis && <div className="grid gap-2 rounded border border-separator bg-surface p-3 text-sm text-foreground"><p className="font-medium">Análisis visual guardado · ejecución {visualAnalysisRunId}</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(visualAnalysis, null, 2)}</pre></div>}
                  <div className="grid grid-cols-8 overflow-hidden rounded border border-separator" role="img" aria-label="Colores dominantes estimados por banda vertical de la captura">{screenshotProfile.vertical_bands.map((band) => <span key={`${band.from_percent}-${band.to_percent}`} className="h-5" style={{ backgroundColor: band.dominant_hex }} title={`${band.from_percent}–${band.to_percent}%: ${band.dominant_hex}`} />)}</div>
                  <div className="flex flex-wrap gap-2">{screenshotProfile.colors.map((color) => <span key={color.hex} className="inline-flex items-center gap-1.5 rounded border border-separator bg-surface px-2 py-1 text-xs text-foreground"><span className="size-3 rounded-sm border border-separator" style={{ backgroundColor: color.hex }} />{color.hex} · {color.share_percent}%</span>)}</div>
                </div>}
                {form.reference_notice && <p className="rounded-md border border-separator bg-surface-subtle p-3 text-xs leading-5 text-muted">{form.reference_notice}</p>}
                {field("reference_text", "Notas de contexto / texto autorizado", true)}
                {field("raw_html", "HTML original (privado; nunca se renderiza ni se envía al agente)", true)}
                {Boolean(form.raw_html) && <p className="rounded-md border border-separator bg-surface-subtle p-3 text-xs leading-5 text-muted">El HTML se conserva como referencia interna y se calcula un perfil heurístico de estructura, colores mencionados, tamaños tipográficos y enlaces. Los porcentajes cuentan menciones de códigos de color; no representan superficie visual real. El contenido original no se añade al contexto del modelo.</p>}
              </>}
              <p className="mt-2 text-sm font-medium text-foreground">Evidencia y límites</p>
              <label className="grid gap-1 text-sm text-muted">Tipo de evidencia<select className="h-10 rounded-md border border-separator bg-surface px-3 text-foreground" value={form.evidence_label} onChange={(event) => setForm((current) => ({ ...current, evidence_label: event.target.value }))}><option value="inspiration">Inspiración</option><option value="observed_result">Resultado observado</option><option value="significant_test">Test significativo</option><option value="counterexample">Contraejemplo</option></select></label>
              {field("evidence_metric", "Métrica")}
              <label className="grid gap-1 text-sm text-muted">Denominador / muestra<Input type="number" min={0} value={form.evidence_denominator} onChange={(event) => setForm((current) => ({ ...current, evidence_denominator: event.target.value }))} /></label>
              {field("evidence_period", "Periodo")}
              <label className="grid gap-1 text-sm text-muted">Confianza<select className="h-10 rounded-md border border-separator bg-surface px-3 text-foreground" value={form.evidence_confidence} onChange={(event) => setForm((current) => ({ ...current, evidence_confidence: event.target.value }))}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></label>
              {field("evidence_limitations", "Limitaciones", true)}
              <label className="grid gap-1 text-sm text-muted">Origen<select className="h-10 rounded-md border border-separator bg-surface px-3 text-foreground" value={form.source_type} onChange={(event) => setForm((current) => ({ ...current, source_type: event.target.value }))}><option value="internal">Interno</option><option value="authorized_import">Importación autorizada</option><option value="public_reference">Referencia pública</option></select></label>
              {field("source_reference", "Referencia / procedencia")}
              {(form.source_type !== "internal" || form.kind !== "strategy" || form.raw_html.length > 0 || form.reference_text.length > 0 || screenshotProfile !== null) && <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={form.rights_confirmed} onChange={(event) => setForm((current) => ({ ...current, rights_confirmed: event.target.checked }))} />Confirmo que tenemos derechos para guardar y usar esta referencia</label>}
              <div className="flex gap-2"><Button disabled={busy} onClick={() => void saveDraft()}>{busy ? "Guardando…" : "Guardar como borrador"}</Button>{editing && <Button variant="secondary" disabled={busy} onClick={reset}>Cancelar</Button>}</div>
            </div>
          </Card>
        </div>
      )}
    </PlatformAdminShell>
  );
}
