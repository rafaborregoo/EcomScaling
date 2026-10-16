"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { Button, Card, ErrorBlock, Input, Select, Textarea, toast } from "@/components/ui";

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
  const submitLabel = readyToAdjudicate ? "Adjudicar y aprobar" : "Enviar revisiÃ³n independiente";
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
      toast.success("Caso aÃ±adido al dataset."); setScenario(""); visualUploads.forEach((item) => URL.revokeObjectURL(item.previewUrl)); setVisualUploads([]); reload();
    } catch (error) { toast.danger(error instanceof Error ? error.message : "Revisa que evidencia y artefacto sean JSON vÃ¡lidos."); }
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
    if (labels.some((label) => !label.rationale.trim() || !label.evidence_refs.length || (label.status === "evaluable" && (typeof label.score !== "number" || !Number.isInteger(label.score) || label.score < 0 || label.score > 4)))) { toast.danger("Completa puntuaciÃ³n, justificaciÃ³n y referencia de evidencia en todos los criterios."); return; }
    setBusy(true);
    try {
      const response = await apiFetch(`/v1/admin/agent-judge-dataset/cases/${selected.id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ labels, request_id: crypto.randomUUID() }) });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      toast.success(readyToAdjudicate ? "AdjudicaciÃ³n guardada." : "RevisiÃ³n guardada. El contenido de otras revisiones sigue oculto."); setDrafts({}); reload();
    } catch { toast.danger("No se pudo guardar la revisiÃ³n."); }
    finally { setBusy(false); }
  }
  async function runCalibration() {
    const limit = Number(costLimit);
    const maximum = (holdoutState?.holdout_cases ?? cases.length) * 0.03;
    if (!Number.isFinite(limit) || limit < maximum || limit > 50) { toast.danger(`El lÃ­mite debe cubrir el mÃ¡ximo previsto de ${maximum.toFixed(2)} $ y no superar 50 $.`); return; }
    if (!window.confirm(`Ejecutar el juez sobre ${holdoutState?.holdout_cases ?? cases.length} casos holdout. El coste mÃ¡ximo queda limitado a ${limit.toFixed(2)} $. Â¿Continuar?`)) return;
    setBusy(true);
    try {
      const response = await apiFetch("/v1/admin/agent-judge-dataset/certify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataset_version: datasetVersion, cost_limit_usd: limit, request_id: crypto.randomUUID() }) });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      const result = await response.json() as CalibrationRun;
      setCalibration(result);
      toast.success(result.status === "passed" ? "El holdout aprobÃ³ el juez." : "EvaluaciÃ³n guardada; el holdout bloquea la salida visible.");
    } catch { toast.danger("No se pudo ejecutar la calibraciÃ³n del holdout."); }
    finally { setBusy(false); reloadHoldoutState(); }
  }

  async function runCalibrationSet() {
    const limit = Number(costLimit);
    const maximum = (holdoutState?.calibration_cases ?? cases.length) * 0.03;
    if (!Number.isFinite(limit) || limit < maximum || limit > 50) { toast.danger(`El lÃƒÂ­mite debe cubrir el mÃƒÂ¡ximo previsto de ${maximum.toFixed(2)} $ y no superar 50 $.`); return; }
    if (!window.confirm(`Probar el modelo con ${(holdoutState?.calibration_cases ?? cases.length)} casos del conjunto de calibraciÃƒÂ³n. Puedes repetir esta prueba; no consume el holdout ni habilita promociÃƒÂ³n. Coste mÃƒÂ¡ximo: ${limit.toFixed(2)} $. Ã‚Â¿Continuar?`)) return;
    setBusy(true);
    try {
      const response = await apiFetch("/v1/admin/agent-judge-dataset/calibrate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataset_version: datasetVersion, cost_limit_usd: limit, request_id: crypto.randomUUID() }) });
      if (!response.ok) { toast.danger(await readApiError(response)); return; }
      const result = await response.json() as CalibrationRun;
      setCalibration(result);
      toast.success("Prueba de calibraciÃƒÂ³n guardada. El holdout sigue reservado.");
    } catch { toast.danger("No se pudo ejecutar el conjunto de calibraciÃƒÂ³n."); }
    finally { setBusy(false); reloadHoldoutState(); }
  }

  return <Card kicker="EvaluaciÃ³n humana ciega" title="Dataset gold del juez" description="Crea casos y evalÃºalos sin ver el resultado del juez ni las etiquetas de otros revisores. Holdout solo admite casos anonimizados." >
    <div className="grid gap-5">
      <div role="status" className="rounded-lg border border-separator p-3 text-sm">
        <p className="font-medium">Runtime del juez: {holdoutState?.runtime.mode ?? "consultando"} · {holdoutState?.runtime.model ?? ""}</p>
        {holdoutState?.runtime.mode === "off" ? <p className="mt-1 text-muted">El juez no está evaluando ejecuciones. Configura `AI_JUDGE_MODE=shadow` en el servicio API para iniciar la observación.</p> : null}
        {holdoutState?.runtime.mode !== "off" && holdoutState?.runtime.provider_ready === false ? <p className="mt-1 text-muted">Proveedor no listo: {holdoutState.runtime.configuration_error}. Las ejecuciones no producirán una evaluación.</p> : null}
        {holdoutState?.runtime.mode === "shadow" && holdoutState.runtime.provider_ready ? <p className="mt-1 text-muted">Activo en shadow: registra dictámenes en segundo plano sin mostrarlos como decisión al consultor.</p> : null}
        {holdoutState?.runtime.mode === "visible" && holdoutState.runtime.provider_ready ? <p className="mt-1 text-muted">El API adjunta el dictamen a la respuesta. La vista del consultor aún no lo presenta en un componente; completa esa integración antes de activar el modo visible.</p> : null}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-muted">Conjunto<Select className="mt-1" value={split} onChange={setSplit} options={[{ value: "development", label: "Desarrollo" }, { value: "calibration", label: "CalibraciÃ³n" }, { value: "holdout", label: "Holdout" }]} /></label>
        <label className="text-sm text-muted">VersiÃ³n<Input className="mt-1" value={datasetVersion} onChange={(event) => setDatasetVersion(event.target.value)} /></label>
        <Button variant="secondary" onClick={reload}>Actualizar</Button>
      </div>
      <details className="rounded-lg border border-separator p-4"><summary className="cursor-pointer font-medium">AÃ±adir caso</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-muted">Agente<Input className="mt-1" value={agentCode} onChange={(event) => setAgentCode(event.target.value)} /></label>
          <label className="text-sm text-muted">VersiÃ³n de rÃºbrica<Input className="mt-1" value={rubricVersion} onChange={(event) => setRubricVersion(event.target.value)} /></label>
          <label className="text-sm text-muted sm:col-span-2">Escenario<Input className="mt-1" value={scenario} onChange={(event) => setScenario(event.target.value)} /></label>
          <label className="text-sm text-muted sm:col-span-2">ID de organización<Input className="mt-1 font-mono" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="UUID de la tienda del caso" /></label>
          <label className="text-sm text-muted">Procedencia<Select className="mt-1" value={provenance} onChange={setProvenance} options={[{ value: "synthetic", label: "SintÃ©tico (solo desarrollo)" }, { value: "anonymized_production", label: "ProducciÃ³n anonimizada" }]} /></label>
          {isVisualAgent(agentCode) ? <div className="grid gap-3 rounded-md border border-separator p-3 sm:col-span-2">
            <div><p className="font-medium">Evidencia visual</p><p className="mt-1 text-xs text-muted">PNG, JPEG o WebP · hasta 4 imágenes · 1,3 MB por imagen. Se guardan en almacenamiento privado.</p><p className="mt-1 text-xs text-muted">{agentCode === "a16_texto_sobre_imagen" ? "A16 necesita entrada, resultado y comparación." : agentCode === "a26_contenido_email" ? "A26 necesita dos resultados: escritorio y móvil." : null}</p></div>
            <Input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => { addVisualFiles(event.target.files); event.currentTarget.value = ""; }} />
            {agentCode === "a23_creatividad_meta" ? <div className="grid gap-2 sm:grid-cols-2"><Input aria-label="ID interno del creativo (UUID)" placeholder="ID interno del creativo (UUID)" value={metaCreativeId} onChange={(event) => setMetaCreativeId(event.target.value)} /><Input aria-label="ID interno del anuncio (UUID)" placeholder="ID interno del anuncio (UUID)" value={metaAdId} onChange={(event) => setMetaAdId(event.target.value)} /><Input aria-label="Inicio del periodo" type="date" value={metaPeriodStart} onChange={(event) => setMetaPeriodStart(event.target.value)} /><Input aria-label="Fin del periodo" type="date" value={metaPeriodEnd} onChange={(event) => setMetaPeriodEnd(event.target.value)} /></div> : null}
            {visualUploads.map((item) => <div key={item.id} className="grid items-center gap-3 rounded border border-separator p-2 sm:grid-cols-[5rem_1fr_auto]">
              <img src={item.previewUrl} alt={`Vista previa ${item.file.name}`} className="h-16 w-20 rounded object-cover" />
              <div className="grid gap-2 sm:grid-cols-2"><span className="truncate text-xs">{item.file.name}</span><Select aria-label={`Tipo de imagen ${item.file.name}`} disabled={agentCode === "a26_contenido_email"} value={item.role} onChange={(value) => setVisualUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, role: value as VisualUploadDraft["role"] } : entry))} options={[{ value: "input", label: "Entrada del agente" }, { value: "render", label: "Resultado renderizado" }, { value: "reference", label: "Referencia" }, { value: "neighbor", label: "Imagen comparativa" }]} />
                {agentCode === "a26_contenido_email" ? <Select aria-label={`Dispositivo ${item.file.name}`} value={item.viewport ?? "desktop"} onChange={(value) => setVisualUploads((current) => current.map((entry) => entry.id === item.id ? { ...entry, viewport: value as "desktop" | "mobile" } : entry))} options={[{ value: "desktop", label: "Escritorio" }, { value: "mobile", label: "Móvil" }]} /> : null}
              </div><Button type="button" variant="secondary" onClick={() => removeVisualUpload(item.id)}>Quitar</Button>
            </div>)}
          </div> : null}
          <div className="grid gap-3 rounded-md border border-separator p-3 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">Captura guiada</p><p className="text-xs text-muted">Resume el caso sin escribir JSON. El ID se guarda como referencia para localizar la ejecución.</p></div><Button type="button" variant="secondary" onClick={() => setCaptureMode(captureMode === "guided" ? "json" : "guided")}>{captureMode === "guided" ? "Usar JSON avanzado" : "Volver a captura guiada"}</Button></div>
            {captureMode === "guided" ? <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-muted sm:col-span-2">ID de ejecución de origen (opcional)<Input className="mt-1 font-mono" value={sourceRunId} onChange={(event) => setSourceRunId(event.target.value)} placeholder="UUID de agent_runs" /></label>
              <label className="text-sm text-muted">Contexto y evidencia disponible<Textarea className="mt-1 min-h-24" value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)} placeholder="Qué datos recibió el agente y qué fuentes puede usar" /></label>
              <label className="text-sm text-muted">Comportamiento esperado<Textarea className="mt-1 min-h-24" value={expectedBehavior} onChange={(event) => setExpectedBehavior(event.target.value)} placeholder="Qué debería hacer, evitar y reconocer como incierto" /></label>
              <label className="text-sm text-muted sm:col-span-2">Salida observada<Textarea className="mt-1 min-h-24" value={observedOutput} onChange={(event) => setObservedOutput(event.target.value)} placeholder="Pega o resume el resultado real del agente" /></label>
            </div> : <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-muted">Evidencia JSON<Textarea className="mt-1 min-h-24 font-mono text-xs" value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} /></label><label className="text-sm text-muted">Salida del agente JSON<Textarea className="mt-1 min-h-24 font-mono text-xs" value={artifactText} onChange={(event) => setArtifactText(event.target.value)} /></label></div>}
          </div>
          {provenance === "anonymized_production" ? <p className="text-xs text-muted sm:col-span-2">Al guardar declaras que eliminaste identificadores de cliente, tienda y personas. El servidor tambiÃ©n bloquea patrones habituales de email y telÃ©fono.</p> : null}
          <div><Button disabled={!scenario.trim() || (holdoutState?.frozen ?? false)} onClick={() => void createCase()}>Guardar caso ciego</Button></div>
        </div>
      </details>
      {isLoading ? <p className="text-sm text-muted">Cargando casosâ€¦</p> : null}
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      {!isLoading && !error && !cases.length ? <p className="text-sm text-muted">No hay casos en este conjunto.</p> : null}
      {cases.length ? <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Casos del dataset" className="grid content-start gap-2">{cases.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`rounded-md border p-3 text-left text-sm ${selected?.id === item.id ? "border-accent bg-accent/5" : "border-separator"}`}><span className="block font-medium">{item.agent_code}</span><span className="mt-1 block text-xs text-muted">{item.review_count}/2 revisiones Â· {item.adjudicated ? "aprobado" : item.reviewed_by_me ? "revisado por ti" : "pendiente"}</span></button>)}</nav>
        {selected ? <div className="grid gap-4">
          <div className="rounded-md bg-surface p-4"><p className="font-medium">{selected.scenario}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Evidencia</p><pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(selected.evidence, null, 2)}</pre><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Salida generada</p><pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(selected.artifact, null, 2)}</pre></div>
          {selected.created_by_me ? <p className="text-sm text-muted">La persona que preparÃ³ el caso no puede revisarlo ni adjudicarlo.</p> : selected.reviewed_by_me ? <p className="text-sm text-muted">Ya enviaste tu revisiÃ³n independiente.</p> : selected.adjudicated ? <p className="text-sm text-muted">Este caso ya tiene adjudicaciÃ³n.</p> : <>
            {readyToAdjudicate ? <p className="rounded-md border border-accent p-3 text-sm">Dos revisiones estÃ¡n registradas. Compara el caso a ciegas y fija la etiqueta gold; las respuestas previas siguen ocultas para preservar la independencia.</p> : null}
            <div className="grid gap-3">{selected.rubric.map((criterion) => { const value = drafts[criterion.id] ?? { score: "3", status: "evaluable" as const, critical_failure: false, rationale: "", evidence_refs: "" }; return <fieldset key={criterion.id} className="grid gap-2 rounded-md border border-separator p-3"><legend className="px-1 font-medium">{criterion.title}{criterion.critical ? " Â· crÃ­tico" : ""}</legend><p className="text-xs text-muted">{criterion.instruction}</p><div className="grid gap-2 sm:grid-cols-[9rem_8rem_1fr]"><Select aria-label={`Estado ${criterion.title}`} value={value.status} onChange={(status) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, status: status as LabelDraft["status"] } }))} options={[{ value: "evaluable", label: "Evaluable" }, { value: "no_evaluable", label: "No evaluable" }]} /><Select aria-label={`PuntuaciÃ³n ${criterion.title}`} value={value.score} disabled={value.status !== "evaluable"} onChange={(score) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, score } }))} options={[0,1,2,3,4].map((score) => ({ value: String(score), label: `${score} / 4` }))} /><Input aria-label={`Referencias de evidencia ${criterion.title}`} placeholder="evidence.metric o artifact.answer" value={value.evidence_refs} onChange={(event) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, evidence_refs: event.target.value } }))} /></div><Textarea aria-label={`JustificaciÃ³n ${criterion.title}`} placeholder="Justifica la etiqueta con evidencia observable" value={value.rationale} onChange={(event) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, rationale: event.target.value } }))} />{criterion.critical ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.critical_failure} onChange={(event) => setDrafts((current) => ({ ...current, [criterion.id]: { ...value, critical_failure: event.target.checked } }))} />Fallo crÃ­tico en este criterio</label> : null}</fieldset>; })}</div>
            <Button disabled={busy} onClick={() => void submitLabels()}>{busy ? "Guardandoâ€¦" : submitLabel}</Button>
          </>}
        </div> : null}
      </div> : null}
      {data && data.total > data.page_size ? <div className="flex items-center justify-between text-sm"><span className="text-muted">Casos {data.page * data.page_size + 1}–{Math.min((data.page + 1) * data.page_size, data.total)} de {data.total}</span><div className="flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Anterior</Button><Button variant="secondary" disabled={(page + 1) * data.page_size >= data.total} onClick={() => setPage((value) => value + 1)}>Siguiente</Button></div></div> : null}\n      {split === "calibration" ? <div className="grid gap-3 rounded-lg border border-separator p-4"><div><p className="font-medium">Pruebas iterativas del juez</p><p className="mt-1 text-sm text-muted">Usa este conjunto para ajustar el modelo y revisar desacuerdos. Las ejecuciones quedan registradas y nunca autorizan promociÃ³n.</p></div><div className="flex flex-wrap items-end gap-3"><label className="text-sm text-muted">Tope de coste ($)<Input className="mt-1 w-32" type="number" min="0.1" max="50" step="0.1" value={costLimit} onChange={(event) => setCostLimit(event.target.value)} /></label><Button disabled={busy || !cases.length} onClick={() => void runCalibrationSet()}>{busy ? "Evaluandoâ€¦" : `Probar calibraciÃ³n Â· mÃ¡ximo ${((holdoutState?.calibration_cases ?? cases.length) * 0.03).toFixed(2)} $`}</Button></div>{calibration ? <p role="status" className="text-sm">Resultado de la prueba: {calibration.status} Â· coste ${calibration.estimated_cost_usd.toFixed(4)}.</p> : null}</div> : null}
      {split === "holdout" ? <div className="grid gap-3 rounded-lg border border-separator p-4">
        <p className="text-sm text-muted">El holdout se congela y se consulta una sola vez por versión y rúbrica. Usa desarrollo y calibración para iterar el prompt antes de certificar.</p>
        {holdoutState?.coverage ? <div className="grid gap-2 rounded-md border border-separator p-3 sm:grid-cols-2 xl:grid-cols-3"><p className="font-medium sm:col-span-2 xl:col-span-3">Cobertura necesaria por agente: 50 casos gold aprobados, incluidos 10 críticos positivos y 10 críticos negativos.</p>{holdoutState.coverage.map((item) => { const ready = item.case_count >= 50 && item.approved_case_count >= 50 && item.critical_positive_cases >= 10 && item.critical_negative_cases >= 10; return <div key={item.agent_code} className="rounded border border-separator p-2 text-xs"><p className="font-medium">{item.agent_code} · {ready ? "completo" : "pendiente"}</p><p className="mt-1 text-muted">{item.approved_case_count}/50 aprobados · críticos {item.critical_positive_cases}/10 + / {item.critical_negative_cases}/10 −</p></div>; })}</div> : null}
        {holdoutState?.consumed ? <p role="status" className="rounded-md border border-separator p-3 text-sm">Holdout consumido por {holdoutState.claim?.model ?? "el modelo configurado"}. Resultado: {holdoutState.latest_run?.status ?? "sin informe persistido; requiere revisiÃ³n operativa"}.</p> : null}
        <div><p className="font-medium">Calibrar modelo juez</p><p className="mt-1 text-sm text-muted">Ejecuta el modelo configurado en el servidor sobre casos gold aprobados y guarda el gate por agente. Los casos visuales deben llevar `evidence.visual_images` con bytes base64 validados.</p></div>
        <div className="flex flex-wrap items-end gap-3"><label className="text-sm text-muted">Tope de coste ($)<Input className="mt-1 w-32" type="number" min="0.1" max="50" step="0.1" value={costLimit} onChange={(event) => setCostLimit(event.target.value)} /></label><Button disabled={busy || !holdoutReady || !holdoutState || !!holdoutState.consumed} onClick={() => void runCalibration()}>{busy ? "Evaluando…" : holdoutState?.consumed ? "Holdout ya utilizado" : holdoutReady ? `Certificar una vez · máximo ${((holdoutState?.holdout_cases ?? cases.length) * 0.03).toFixed(2)} $` : "Completa la muestra de los 26 agentes"}</Button></div>
        {calibration ? <div className="grid gap-3 rounded-md bg-surface p-4"><p className="font-medium">Resultado: {calibration.status} Â· coste estimado {calibration.estimated_cost_usd.toFixed(4)} $</p><ul className="grid gap-2 sm:grid-cols-2">{Object.entries(calibration.report.agents ?? {}).map(([code, result]) => <li key={code} className="rounded border border-separator p-3 text-sm"><p className="font-medium">{code} Â· {result.allowed ? "aprobado" : "bloqueado"}</p><p className="mt-1 text-xs text-muted">{result.cases} casos Â· acuerdo {result.status_agreement == null ? "â€”" : `${Math.round(result.status_agreement * 100)}%`} Â· crÃ­ticos {result.critical_recall == null ? "â€”" : `${Math.round(result.critical_recall * 100)}%`}</p>{result.reasons.length ? <p className="mt-1 text-xs text-muted">{result.reasons.join(" Â· ")}</p> : null}</li>)}</ul></div> : null}
      </div> : null}
    </div>
  </Card>;
}
