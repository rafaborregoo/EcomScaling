"use client";
import { ScrollArea, FieldSet, FieldLegend, FieldDescription, Field, EmptyState, Checkbox, DateRangePicker, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown, Pagination } from "@/components/ui";


import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { CoinsIcon, FlaskConicalIcon, XIcon } from "lucide-react";
import { Attachment, AttachmentAction, AttachmentActions, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from "@/components/ui/attachment";
import { fileMeta } from "@/lib/file-meta";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  Button,
  ErrorBlock,
  Input,
  Select,
  Textarea,
  toast,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui";

type Criterion = { id: string; title: string; instruction: string; critical?: boolean };
type EvalCase = { id: string; agent_code: string; dataset_version: string; rubric_version: string; split: string; provenance: string; scenario: string; evidence: Record<string, unknown>; artifact: Record<string, unknown>; rubric: Criterion[]; created_by_me: boolean; reviewed_by_me: boolean; review_count: number; adjudicated: boolean };
type Queue = { cases: EvalCase[]; page: number; page_size: number; total: number };
type LabelDraft = { score: string; status: "evaluable" | "no_evaluable"; critical_failure: boolean; rationale: string; evidence_refs: string };
type CalibrationRun = { id: string; status: "passed" | "blocked" | "incomplete"; estimated_cost_usd: number; report: { allowed?: boolean; agents?: Record<string, { cases: number; status_agreement: number | null; within_one_score_rate: number | null; critical_recall: number | null; false_critical_rate: number | null; reasons: string[]; allowed: boolean }> } };
type HoldoutState = { runtime: { mode: "off" | "shadow" | "visible"; model: string; provider_ready: boolean; configuration_error: string | null }; consumed: boolean; frozen: boolean; holdout_cases: number; calibration_cases: number; coverage: { agent_code: string; case_count: number; approved_case_count: number; critical_positive_cases: number; critical_negative_cases: number }[]; claim: { model: string; claimed_at: string } | null; latest_run: CalibrationRun | null };
type VisualUploadDraft = { id: string; file: File; previewUrl: string; role: "input" | "render" | "reference" | "neighbor"; viewport?: "desktop" | "mobile" };

async function fileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function isVisualAgent(agent: string) {
  return ["a15_analista_imagenes", "a16_texto_sobre_imagen", "a23_creatividad_meta", "a26_contenido_email"].includes(agent);
}

export function JudgeDatasetPanel() {
  const [split, setSplit] = useState("development");
  // Ejecutar el juez cuesta dinero: se confirma con el tope ya validado.
  const [confirmRun, setConfirmRun] = useState<{ kind: "holdout" | "calibration"; limit: number } | null>(null);
  const [datasetVersion, setDatasetVersion] = useState("judge-gold-v7");
  const [page, setPage] = useState(0);
  const { data, error, isLoading, reload } = useCachedQuery<Queue>(`/v1/admin/agent-judge-dataset/cases?split=${split}&datasetVersion=${encodeURIComponent(datasetVersion)}&page=${page}`);
  const { data: holdoutState, reload: reloadHoldoutState } = useCachedQuery<HoldoutState>(`/v1/admin/agent-judge-dataset/holdout-state?datasetVersion=${encodeURIComponent(datasetVersion)}`);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [rubricVersion, setRubricVersion] = useState("judge-rubrics-v7");
  const [scenario, setScenario] = useState("");
  const [agentCode, setAgentCode] = useState("a05_estrategia_campanas");
  const [provenance, setProvenance] = useState("synthetic");
  const [evidenceText, setEvidenceText] = useState("{}");
  const [artifactText, setArtifactText] = useState("{}");
  const [captureMode, setCaptureMode] = useState<"guided" | "json">("guided");
  const [sourceRunId, setSourceRunId] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [observedOutput, setObservedOutput] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [visualUploads, setVisualUploads] = useState<VisualUploadDraft[]>([]);
  const [metaCreativeId, setMetaCreativeId] = useState("");
  const [metaAdId, setMetaAdId] = useState("");
  const [metaPeriodStart, setMetaPeriodStart] = useState("");
  const [metaPeriodEnd, setMetaPeriodEnd] = useState("");
  const cases = data?.cases ?? [];
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0];
  const [drafts, setDrafts] = useState<Record<string, LabelDraft>>({});
  const [costLimit, setCostLimit] = useState("50");
  const [calibration, setCalibration] = useState<CalibrationRun | null>(null);

  useEffect(() => { setSelectedId(""); setPage(0); }, [split, datasetVersion]);
  useEffect(() => { setSelectedId(""); }, [page]);
  useEffect(() => { if (split !== "development") setProvenance("anonymized_production"); else setProvenance("synthetic"); }, [split]);
  const readyToAdjudicate = !!selected && selected.review_count === 2 && !selected.adjudicated && !selected.reviewed_by_me;
  const holdoutReady = holdoutState?.coverage?.length === 26 && holdoutState.coverage.every((item) => item.case_count >= 50 && item.approved_case_count >= 50 && item.critical_positive_cases >= 10 && item.critical_negative_cases >= 10);
  const action = readyToAdjudicate ? "adjudication" : "reviews";
  const submitLabel = readyToAdjudicate ? "Adjudicar y aprobar" : "Enviar revisión independiente";
  const labels = useMemo(() => (selected?.rubric ?? []).map((criterion) => {
    const value = drafts[criterion.id] ?? { score: "3", status: "evaluable" as const, critical_failure: false, rationale: "", evidence_refs: "artifact" };
    return { criterion_id: criterion.id, score: value.status === "evaluable" ? Number(value.score) : null, status: value.status, critical_failure: value.critical_failure, rationale: value.rationale, evidence_refs: value.evidence_refs.split(",").map((item) => item.trim()).filter(Boolean) };
  }), [selected, drafts]);

  async function createCase() {
    try {
      const evidence = captureMode === "guided"
        ? { ...(sourceRunId.trim() ? { source_run_id: sourceRunId.trim() } : {}), context_summary: evidenceSummary.trim(), expected_behavior: expectedBehavior.trim() }
        : JSON.parse(evidenceText);
      const artifact = captureMode === "guided"
        ? { ...(sourceRunId.trim() ? { source_run_id: sourceRunId.trim() } : {}), observed_output: observedOutput.trim() }
        : JSON.parse(artifactText);
      if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) throw new Error("La evidencia debe ser un objeto JSON.");
      if (captureMode === "guided" && (!scenario.trim() || !evidenceSummary.trim() || !expectedBehavior.trim() || !observedOutput.trim())) throw new Error("Completa el escenario, el contexto disponible, el comportamiento esperado y la salida observada.");
      if (visualUploads.length && !organizationId.trim()) throw new Error("Indica el ID de organización para guardar evidencia visual.");
      if (visualUploads.length && agentCode === "a23_creatividad_meta" && (!metaCreativeId.trim() || !metaAdId.trim() || !metaPeriodStart || !metaPeriodEnd)) throw new Error("Completa creativo, anuncio y periodo de Meta para asociar las imágenes.");
      if (organizationId.trim()) evidence.organization_id = organizationId.trim();
      const visual_uploads = await Promise.all(visualUploads.map(async (item) => ({
        bytes_base64: await fileBase64(item.file), media_type: item.file.type, role: item.role,
        ...(agentCode === "a23_creatividad_meta" ? { entity_type: "meta_creative_image", related_entity_id: metaCreativeId.trim(), ad_id: metaAdId.trim(), period_start: metaPeriodStart, period_end: metaPeriodEnd } : {}),
        ...(agentCode === "a26_contenido_email" ? { entity_type: "a26_email_render_capture", viewport: item.viewport ?? "desktop" } : {}),
        ...(agentCode === "a15_analista_imagenes" ? { entity_type: "instagram_image_bank" } : {}),
        ...(agentCode === "a16_texto_sobre_imagen" ? { entity_type: item.role === "input" ? "instagram_image_bank" : "a16_render_capture" } : {}),
      })));
      const response = await apiFetch("/v1/admin/agent-judge-dataset/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_code: agentCode, dataset_version: datasetVersion, rubric_version: rubricVersion, split, provenance, privacy_reviewed: provenance === "anonymized_production", scenario, evidence, artifact, ...(visualUploads.length ? { visual_uploads } : {}) }) });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      toast.success("Caso añadido al dataset."); setScenario(""); visualUploads.forEach((item) => URL.revokeObjectURL(item.previewUrl)); setVisualUploads([]); reload();
    } catch (error) { toast.danger(error instanceof Error ? error.message : "Revisa que evidencia y artefacto sean JSON válidos."); }
  }

  function addVisualFiles(files: FileList | null) {
    const incoming = Array.from(files ?? []);
    if (!incoming.length) return;
    if (visualUploads.length + incoming.length > 4) { toast.danger("Adjunta como máximo 4 imágenes por caso."); return; }
    if (incoming.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1_300_000)) { toast.danger("Cada imagen debe ser PNG, JPEG o WebP y pesar como máximo 1,3 MB."); return; }
    const combined = [...visualUploads, ...incoming.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), role: (agentCode === "a26_contenido_email" ? "render" : "input") as VisualUploadDraft["role"], ...(agentCode === "a26_contenido_email" ? { viewport: "desktop" as const } : {}) }))];
    if (combined.reduce((sum, item) => sum + item.file.size, 0) > 4_800_000) { toast.danger("El total de imágenes no puede superar 4,8 MB."); combined.slice(visualUploads.length).forEach((item) => URL.revokeObjectURL(item.previewUrl)); return; }
    setVisualUploads(combined);
  }

  function removeVisualUpload(id: string) {
    setVisualUploads((current) => { const target = current.find((item) => item.id === id); if (target) URL.revokeObjectURL(target.previewUrl); return current.filter((item) => item.id !== id); });
  }
  async function submitLabels() {
    if (!selected) return;
    if (labels.some((label) => !label.rationale.trim() || !label.evidence_refs.length || (label.status === "evaluable" && (typeof label.score !== "number" || !Number.isInteger(label.score) || label.score < 0 || label.score > 4)))) { toast.danger("Completa puntuación, justificación y referencia de evidencia en todos los criterios."); return; }
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/admin/agent-judge-dataset/cases/${selected.id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labels, request_id: crypto.randomUUID() }) });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      toast.success(readyToAdjudicate ? "Adjudicación guardada." : "Revisión guardada. El contenido de otras revisiones sigue oculto."); setDrafts({}); reload();
    } catch { toast.danger("No se pudo guardar la revisión."); }
    finally { setBusy(false); }
  }
  async function runCalibration() {
    const limit = Number(costLimit);
    const maximum = (holdoutState?.holdout_cases ?? cases.length) * 0.03;
    if (!Number.isFinite(limit) || limit < maximum || limit > 50) { toast.danger(`El límite debe cubrir el máximo previsto de ${maximum.toFixed(2)} $ y no superar 50 $.`); return; }
    setConfirmRun({ kind: "holdout", limit });
  }

  async function certifyHoldout(limit: number) {
    setBusy(true);
    try {
      const response = await apiFetch("/v1/admin/agent-judge-dataset/certify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataset_version: datasetVersion, cost_limit_usd: limit, request_id: crypto.randomUUID() }) });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      const result = await response.json() as CalibrationRun;
      setCalibration(result);
      toast.success(result.status === "passed" ? "El holdout aprobó el juez." : "Evaluación guardada; el holdout bloquea la salida visible.");
    } catch { toast.danger("No se pudo ejecutar la calibración del holdout."); }
    finally { setBusy(false); reloadHoldoutState(); }
  }

  async function runCalibrationSet() {
    const limit = Number(costLimit);
    const maximum = (holdoutState?.calibration_cases ?? cases.length) * 0.03;
    if (!Number.isFinite(limit) || limit < maximum || limit > 50) { toast.danger(`El límite debe cubrir el máximo previsto de ${maximum.toFixed(2)} $ y no superar 50 $.`); return; }
    setConfirmRun({ kind: "calibration", limit });
  }

  async function calibrateSet(limit: number) {
    setBusy(true);
    try {
      const response = await apiFetch("/v1/admin/agent-judge-dataset/calibrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataset_version: datasetVersion, cost_limit_usd: limit, request_id: crypto.randomUUID() }) });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      const result = await response.json() as CalibrationRun;
      setCalibration(result);
      toast.success("Prueba de calibración guardada. El holdout sigue reservado.");
    } catch { toast.danger("No se pudo ejecutar el conjunto de calibración."); }
    finally { setBusy(false); reloadHoldoutState(); }
  }

  return <Card>
    <CardHeader>
      <CardKicker>Evaluación humana ciega</CardKicker>
      <CardTitle>Dataset gold del juez</CardTitle>
      <CardDescription>Crea casos y evalúalos sin ver el resultado del juez ni las etiquetas de otros revisores. Holdout solo admite casos anonimizados.</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid gap-5">
        <div role="status" className="rounded-lg border border-separator p-3 text-sm">
          <p className="font-medium">Runtime del juez: {holdoutState?.runtime.mode ?? "consultando"} · {holdoutState?.runtime.model ?? ""}</p>
          {holdoutState?.runtime.mode === "off" ? <p className="mt-1 text-muted">El juez no está evaluando ejecuciones. Configura `AI_JUDGE_MODE=shadow` en el servicio API para iniciar la observación.</p> : null}
          {holdoutState?.runtime.mode !== "off" && holdoutState?.runtime.provider_ready === false ? <p className="mt-1 text-muted">Proveedor no listo: {holdoutState.runtime.configuration_error}. Las ejecuciones no producirán una evaluación.</p> : null}
          {holdoutState?.runtime.mode === "shadow" && holdoutState.runtime.provider_ready ? <p className="mt-1 text-muted">Activo en shadow: registra dictámenes en segundo plano sin mostrarlos como decisión al consultor.</p> : null}
          {holdoutState?.runtime.mode === "visible" && holdoutState.runtime.provider_ready ? <p className="mt-1 text-muted">El API adjunta el dictamen a la respuesta. La vista del consultor aún no lo presenta en un componente; completa esa integración antes de activar el modo visible.</p> : null}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Conjunto"><Select value={split} onChange={setSplit} options={[{ value: "development", label: "Desarrollo" }, { value: "calibration", label: "Calibración" }, { value: "holdout", label: "Holdout" }]} /></Field>
          <Field label="Versión"><Input value={datasetVersion} onChange={(event) => setDatasetVersion(event.target.value)} /></Field>
          <Button variant="secondary" onClick={reload}>Actualizar</Button>
        </div>
        <Collapsible className="rounded-lg border border-separator p-4"><CollapsibleTrigger className="w-full justify-between font-medium">Añadir caso<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
          <CollapsibleContent>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Agente"><Input value={agentCode} onChange={(event) => setAgentCode(event.target.value)} /></Field>
            <Field label="Versión de rúbrica"><Input value={rubricVersion} onChange={(event) => setRubricVersion(event.target.value)} /></Field>
            <Field label="Escenario" className="sm:col-span-2"><Input value={scenario} onChange={(event) => setScenario(event.target.value)} /></Field>
            <Field label="ID de organización" className="sm:col-span-2"><Input className="font-mono" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="UUID de la tienda del caso" /></Field>
            <Field label="Procedencia"><Select value={provenance} onChange={setProvenance} options={[{ value: "synthetic", label: "Sintético (solo desarrollo)" }, { value: "anonymized_production", label: "Producción anonimizada" }]} /></Field>
            {isVisualAgent(agentCode) ? <Card size="sm" className="sm:col-span-2"><CardContent className="grid gap-3">
              <div><p className="font-medium">Evidencia visual</p><p className="mt-1 text-xs text-muted">PNG, JPEG o WebP · hasta 4 imágenes · 1,3 MB por imagen. Se guardan en almacenamiento privado.</p><p className="mt-1 text-xs text-muted">{agentCode === "a16_texto_sobre_imagen" ? "A16 necesita entrada, resultado y comparación." : agentCode === "a26_contenido_email" ? "A26 necesita dos resultados: escritorio y móvil." : null}</p></div>
              <Input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => { addVisualFiles(event.target.files); event.currentTarget.value = ""; }} />
              {agentCode === "a23_creatividad_meta" ? <div className="grid gap-2 sm:grid-cols-2"><Input aria-label="ID interno del creativo (UUID)" placeholder="ID interno del creativo (UUID)" value={metaCreativeId} onChange={(event) => setMetaCreativeId(event.target.value)} /><Input aria-label="ID interno del anuncio (UUID)" placeholder="ID interno del anuncio (UUID)" value={metaAdId} onChange={(event) => setMetaAdId(event.target.value)} /><DateRangePicker aria-label="Periodo de la evidencia" value={{ from: metaPeriodStart, to: metaPeriodEnd }} onChange={(range) => { setMetaPeriodStart(range.from ?? ""); setMetaPeriodEnd(range.to ?? ""); }} /></div> : null}
              {visualUploads.map((item) => <div key={item.id} className="grid gap-2">
                <Attachment size="sm">
                  <AttachmentMedia variant="image"><img src={item.previewUrl} alt={`Vista previa ${item.file.name}`} /></AttachmentMedia>
                  <AttachmentContent><AttachmentTitle>{item.file.name}</AttachmentTitle><AttachmentDescription>{fileMeta(item.file.name, item.file.size, item.file.type)}</AttachmentDescription></AttachmentContent>
                  <AttachmentActions><AttachmentAction aria-label={`Quitar ${item.file.name}`} onClick={() => removeVisualUpload(item.id)}><XIcon aria-hidden /></AttachmentAction></AttachmentActions>
                </Attachment>
                <div className="grid gap-2 sm:grid-cols-2"><Select aria-label={`Tipo de imagen ${item.file.name}`} disabled={agentCode === "a26_contenido_email"} value={item.role} onChange={(value) => setVisualUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, role: value as VisualUploadDraft["role"] } : entry))} options={[{ value: "input", label: "Entrada del agente" }, { value: "render", label: "Resultado renderizado" }, { value: "reference", label: "Referencia" }, { value: "neighbor", label: "Imagen comparativa" }]} />
                  {agentCode === "a26_contenido_email" ? <Select aria-label={`Dispositivo ${item.file.name}`} value={item.viewport ?? "desktop"} onChange={(value) => setVisualUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, viewport: value as "desktop" | "mobile" } : entry))} options={[{ value: "desktop", label: "Escritorio" }, { value: "mobile", label: "Móvil" }]} /> : null}
                </div>
              </div>)}
            </CardContent></Card> : null}
            <Card size="sm" className="sm:col-span-2"><CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">Captura guiada</p><p className="text-xs text-muted">Resume el caso sin escribir JSON. El ID se guarda como referencia para localizar la ejecución.</p></div><Button type="button" variant="secondary" onClick={() => setCaptureMode(captureMode === "guided" ? "json" : "guided")}>{captureMode === "guided" ? "Usar JSON avanzado" : "Volver a captura guiada"}</Button></div>
              {captureMode === "guided" ? <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ID de ejecución de origen (opcional)" className="sm:col-span-2"><Input className="font-mono" value={sourceRunId} onChange={(event) => setSourceRunId(event.target.value)} placeholder="UUID de agent_runs" /></Field>
                <Field label="Contexto y evidencia disponible"><Textarea className="min-h-24" value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)} placeholder="Qué datos recibió el agente y qué fuentes puede usar" /></Field>
                <Field label="Comportamiento esperado"><Textarea className="min-h-24" value={expectedBehavior} onChange={(event) => setExpectedBehavior(event.target.value)} placeholder="Qué debería hacer, evitar y reconocer como incierto" /></Field>
                <Field label="Salida observada" className="sm:col-span-2"><Textarea className="min-h-24" value={observedOutput} onChange={(event) => setObservedOutput(event.target.value)} placeholder="Pega o resume el resultado real del agente" /></Field>
              </div> : <div className="grid gap-3 sm:grid-cols-2"><Field label="Evidencia JSON"><Textarea className="min-h-24 font-mono text-xs" value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} /></Field><Field label="Salida del agente JSON"><Textarea className="min-h-24 font-mono text-xs" value={artifactText} onChange={(event) => setArtifactText(event.target.value)} /></Field></div>}
            </CardContent></Card>
            {provenance === "anonymized_production" ? <p className="text-xs text-muted sm:col-span-2">Al guardar declaras que eliminaste identificadores de cliente, tienda y personas. El servidor también bloquea patrones habituales de email y teléfono.</p> : null}
            <div><Button disabled={!scenario.trim() || (holdoutState?.frozen ?? false)} onClick={() => void createCase()}>Guardar caso ciego</Button></div>
          </div>
        </CollapsibleContent>
        </Collapsible>
        {isLoading ? <p className="text-sm text-muted">Cargando casosâ€¦</p> : null}
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        {!isLoading && !error && !cases.length ? <EmptyState size="sm" title="No hay casos en este conjunto" /> : null}
        {cases.length ? <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label="Casos del dataset" className="grid content-start gap-2">{cases.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`rounded-md border p-3 text-left text-sm ${selected?.id === item.id ? "border-accent bg-accent/5" : "border-separator"}`}><span className="block font-medium">{item.agent_code}</span><span className="mt-1 block text-xs text-muted">{item.review_count}/2 revisiones · {item.adjudicated ? "aprobado" : item.reviewed_by_me ? "revisado por ti" : "pendiente"}</span></button>)}</nav>
          {selected ? <div className="grid gap-4">
            <div className="rounded-md bg-surface p-4"><p className="font-medium">{selected.scenario}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Evidencia</p><ScrollArea className="mt-1 max-h-56 text-xs"><pre className="whitespace-pre-wrap break-words">{JSON.stringify(selected.evidence, null, 2)}</pre></ScrollArea><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Salida generada</p><ScrollArea className="mt-1 max-h-56 text-xs"><pre className="whitespace-pre-wrap break-words">{JSON.stringify(selected.artifact, null, 2)}</pre></ScrollArea></div>
            {selected.created_by_me ? <p className="text-sm text-muted">La persona que preparó el caso no puede revisarlo ni adjudicarlo.</p> : selected.reviewed_by_me ? <p className="text-sm text-muted">Ya enviaste tu revisión independiente.</p> : selected.adjudicated ? <p className="text-sm text-muted">Este caso ya tiene adjudicación.</p> : <>
              {readyToAdjudicate ? <p className="rounded-md border border-accent p-3 text-sm">Dos revisiones están registradas. Compara el caso a ciegas y fija la etiqueta gold; las respuestas previas siguen ocultas para preservar la independencia.</p> : null}
              <div className="grid gap-3">{selected.rubric.map((criterion) => { const value = drafts[criterion.id] ?? { score: "3", status: "evaluable" as const, critical_failure: false, rationale: "", evidence_refs: "" }; return <FieldSet key={criterion.id} className="gap-2 rounded-md border border-separator p-3"><FieldLegend variant="label" className="px-1">{criterion.title}{criterion.critical ? " · crítico" : ""}</FieldLegend><FieldDescription>{criterion.instruction}</FieldDescription><div className="grid gap-2 sm:grid-cols-[9rem_8rem_1fr]"><Select aria-label={`Estado ${criterion.title}`} value={value.status} onChange={(status) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, status: status as LabelDraft["status"] } }))} options={[{ value: "evaluable", label: "Evaluable" }, { value: "no_evaluable", label: "No evaluable" }]} /><Select aria-label={`Puntuación ${criterion.title}`} value={value.score} disabled={value.status !== "evaluable"} onChange={(score) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, score } }))} options={[0,1,2,3,4].map((score) => ({ value: String(score), label: `${score} / 4` }))} /><Input aria-label={`Referencias de evidencia ${criterion.title}`} placeholder="evidence.metric o artifact.answer" value={value.evidence_refs} onChange={(event) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, evidence_refs: event.target.value } }))} /></div><Textarea aria-label={`Justificación ${criterion.title}`} placeholder="Justifica la etiqueta con evidencia observable" value={value.rationale} onChange={(event) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, rationale: event.target.value } }))} />{criterion.critical ? <Checkbox checked={value.critical_failure} onChange={(event) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, critical_failure: event.target.checked } }))}>Fallo crítico en este criterio</Checkbox> : null}</FieldSet>; })}</div>
              <Button disabled={busy} onClick={() => void submitLabels()}>{busy ? "Guardandoâ€¦" : submitLabel}</Button>
            </>}
          </div> : null}
        </div> : null}
        {data && data.total > data.page_size ? <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted">Casos {data.page * data.page_size + 1}–{Math.min((data.page + 1) * data.page_size, data.total)} de {data.total}</span><Pagination page={page + 1} pageCount={Math.ceil(data.total / data.page_size)} onChange={(next) => setPage(next - 1)} /></div> : null}\n      {split === "calibration" ? <Card><CardContent className="grid gap-3"><div><p className="font-medium">Pruebas iterativas del juez</p><p className="mt-1 text-sm text-muted">Usa este conjunto para ajustar el modelo y revisar desacuerdos. Las ejecuciones quedan registradas y nunca autorizan promoción.</p></div><div className="flex flex-wrap items-end gap-3"><Field label="Tope de coste ($)"><Input className="w-32" type="number" min="0.1" max="50" step="0.1" value={costLimit} onChange={(event) => setCostLimit(event.target.value)} /></Field><Button disabled={busy || !cases.length} onClick={() => void runCalibrationSet()}>{busy ? "Evaluandoâ€¦" : `Probar calibración · máximo ${((holdoutState?.calibration_cases ?? cases.length) * 0.03).toFixed(2)} $`}</Button></div>{calibration ? <p role="status" className="text-sm">Resultado de la prueba: {calibration.status} · coste ${calibration.estimated_cost_usd.toFixed(4)}.</p> : null}</CardContent></Card> : null}
        {split === "holdout" ? <Card><CardContent className="grid gap-3">
          <p className="text-sm text-muted">El holdout se congela y se consulta una sola vez por versión y rúbrica. Usa desarrollo y calibración para iterar el prompt antes de certificar.</p>
          {holdoutState?.coverage ? <Card size="sm"><CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"><p className="font-medium sm:col-span-2 xl:col-span-3">Cobertura necesaria por agente: 50 casos gold aprobados, incluidos 10 críticos positivos y 10 críticos negativos.</p>{holdoutState.coverage.map((item) => { const ready = item.case_count >= 50 && item.approved_case_count >= 50 && item.critical_positive_cases >= 10 && item.critical_negative_cases >= 10; return <div key={item.agent_code} className="rounded border border-separator p-2 text-xs"><p className="font-medium">{item.agent_code} · {ready ? "completo" : "pendiente"}</p><p className="mt-1 text-muted">{item.approved_case_count}/50 aprobados · críticos {item.critical_positive_cases}/10 + / {item.critical_negative_cases}/10 −</p></div>; })}</CardContent></Card> : null}
          {holdoutState?.consumed ? <p role="status" className="rounded-md border border-separator p-3 text-sm">Holdout consumido por {holdoutState.claim?.model ?? "el modelo configurado"}. Resultado: {holdoutState.latest_run?.status ?? "sin informe persistido; requiere revisión operativa"}.</p> : null}
          <div><p className="font-medium">Calibrar modelo juez</p><p className="mt-1 text-sm text-muted">Ejecuta el modelo configurado en el servidor sobre casos gold aprobados y guarda el gate por agente. Los casos visuales deben llevar `evidence.visual_images` con bytes base64 validados.</p></div>
          <div className="flex flex-wrap items-end gap-3"><Field label="Tope de coste ($)"><Input className="w-32" type="number" min="0.1" max="50" step="0.1" value={costLimit} onChange={(event) => setCostLimit(event.target.value)} /></Field><Button disabled={busy || !holdoutReady || !holdoutState || !!holdoutState.consumed} onClick={() => void runCalibration()}>{busy ? "Evaluando…" : holdoutState?.consumed ? "Holdout ya utilizado" : holdoutReady ? `Certificar una vez · máximo ${((holdoutState?.holdout_cases ?? cases.length) * 0.03).toFixed(2)} $` : "Completa la muestra de los 26 agentes"}</Button></div>
          {calibration ? <div className="grid gap-3 rounded-md bg-surface p-4"><p className="font-medium">Resultado: {calibration.status} · coste estimado {calibration.estimated_cost_usd.toFixed(4)} $</p><ul className="grid gap-2 sm:grid-cols-2">{Object.entries(calibration.report.agents ?? {}).map(([code, result]) => <li key={code}><Card size="sm"><CardContent className="text-sm"><p className="font-medium">{code} · {result.allowed ? "aprobado" : "bloqueado"}</p><p className="mt-1 text-xs text-muted">{result.cases} casos · acuerdo {result.status_agreement == null ? "â€”" : `${Math.round(result.status_agreement * 100)}%`} · críticos {result.critical_recall == null ? "â€”" : `${Math.round(result.critical_recall * 100)}%`}</p>{result.reasons.length ? <p className="mt-1 text-xs text-muted">{result.reasons.join(" · ")}</p> : null}</CardContent></Card></li>)}</ul></div> : null}
        </CardContent></Card> : null}
      </div>
      <AlertDialog open={confirmRun !== null} onOpenChange={(open) => !open && setConfirmRun(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>{confirmRun?.kind === "holdout" ? <CoinsIcon /> : <FlaskConicalIcon />}</AlertDialogMedia>
            <AlertDialogTitle>
              {confirmRun?.kind === "holdout" ? "¿Certificar el juez con el holdout?" : "¿Probar el modelo con la calibración?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRun?.kind === "holdout"
                ? `Ejecuta el juez sobre ${holdoutState?.holdout_cases ?? cases.length} casos holdout. El coste máximo queda limitado a ${confirmRun.limit.toFixed(2)} $.`
                : `Prueba el modelo con ${holdoutState?.calibration_cases ?? cases.length} casos del conjunto de calibración. Puedes repetir esta prueba; no consume el holdout ni habilita promoción. Coste máximo: ${(confirmRun?.limit ?? 0).toFixed(2)} $.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              busyLabel="Evaluando…"
              onClick={() => (confirmRun?.kind === "holdout" ? certifyHoldout(confirmRun.limit) : calibrateSet(confirmRun?.limit ?? 0))}
            >
              {confirmRun?.kind === "holdout" ? "Certificar" : "Probar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent>
  </Card>;
}
