"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { Badge, Button, Card, ErrorBlock, Textarea, toast } from "@/components/ui";

type FixtureRow = {
  id: string;
  agent_code: string;
  dataset_version: string;
  split: "development" | "calibration" | "release";
  provenance: "synthetic" | "anonymized_production";
  privacy_reviewed: boolean;
  content_sha256: string;
  created_at: string;
};
type FixtureList = { cases: FixtureRow[]; page: number; page_size: number; total: number };
type CandidateList = { candidates: Array<{ id: string; code: string; name: string; version: string; model: string }> };
type EvalRunResult = {
  evaluation_id: string;
  status: string;
  release_eligible: boolean;
  results: Array<{ caseId: string; passed: boolean; failures: string[]; latencyMs: number; costUsd: number }>;
};
type VisualArtifactInput = { artifact_id: string; role: string; media_type: string; sha256?: string; bytes_base64?: string };

export function AgentReleaseEvalFixturesPanel() {
  const { data, error, isLoading, reload } = useCachedQuery<FixtureList>(
    "/v1/admin/agent-release-eval-fixtures?page=0",
  );
  const { data: candidateData } = useCachedQuery<CandidateList>("/v1/admin/agent-release-candidates");
  const [fixtureText, setFixtureText] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidateVersionId, setCandidateVersionId] = useState("");
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<string[]>([]);
  const [runBusy, setRunBusy] = useState(false);
  const [runResult, setRunResult] = useState<EvalRunResult | null>(null);
  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(fixtureText) as Record<string, unknown>;
      return value && typeof value === "object" && !Array.isArray(value)
        ? { ok: true as const, value }
        : { ok: false as const };
    } catch {
      return { ok: false as const };
    }
  }, [fixtureText]);
  const selectedFixtures = (data?.cases ?? []).filter((item) => selectedFixtureIds.includes(item.id));
  const selectedCandidate = (candidateData?.candidates ?? []).find((item) => item.id === candidateVersionId);
  const selectedAgentMismatch = Boolean(selectedCandidate && selectedFixtures.some((item) => item.agent_code !== selectedCandidate.code));
  const visualArtifacts = parsed.ok && Array.isArray(parsed.value.visual_artifacts)
    ? (parsed.value.visual_artifacts as VisualArtifactInput[]).filter((artifact) => artifact.media_type !== "text/html") : [];

  async function importFixture() {
    if (!parsed.ok || busy) return;
    setBusy(true);
    try {
      const response = await apiFetch("/v1/admin/agent-release-eval-fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      setFixtureText("");
      toast.success("Fixture inmutable añadido al dataset de replay.");
      reload();
    } catch {
      toast.danger("No se pudo guardar el fixture. Revisa el JSON y la conexión.");
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(file?: File) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.danger("El archivo supera el límite de 8 MiB.");
      return;
    }
    try {
      setFixtureText(await file.text());
    } catch {
      toast.danger("No se pudo leer el archivo JSON.");
    }
  }

  async function attachVisualArtifact(index: number, file?: File) {
    if (!file || !parsed.ok) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 1_350_000) {
      toast.danger("Usa una imagen PNG, JPEG o WebP de hasta 1,35 MB.");
      return;
    }
    const current = parsed.value.visual_artifacts;
    if (!Array.isArray(current) || !current[index] || typeof current[index] !== "object") return;
    const existingTotal = current.reduce((total, artifact, artifactIndex) => {
      if (artifactIndex === index || !artifact || typeof artifact !== "object") return total;
      const value = (artifact as VisualArtifactInput).bytes_base64;
      return total + (typeof value === "string" ? Math.floor(value.length * 3 / 4) : 0);
    }, 0);
    const imageCount = current.filter((artifact) => artifact && typeof artifact === "object"
      && (artifact as VisualArtifactInput).media_type !== "text/html").length;
    if (imageCount > 4 || existingTotal + file.size > 5 * 1024 * 1024) {
      toast.danger("El fixture admite cuatro imágenes y 5 MiB en total.");
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 32_768) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
      }
      const updated = structuredClone(parsed.value);
      const artifacts = updated.visual_artifacts as VisualArtifactInput[];
      artifacts[index] = { ...artifacts[index]!, media_type: file.type, sha256, bytes_base64: btoa(binary) };
      setFixtureText(JSON.stringify(updated, null, 2));
      toast.success(`Imagen ${artifacts[index]!.role} adjuntada y hasheada.`);
    } catch {
      toast.danger("No se pudo preparar la imagen para el fixture.");
    }
  }

  function toggleFixture(id: string) {
    setRunResult(null);
    setSelectedFixtureIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function runEvaluation() {
    if (!candidateVersionId.trim() || selectedFixtureIds.length === 0 || runBusy) return;
    setRunBusy(true);
    setRunResult(null);
    try {
      const response = await apiFetch("/v1/admin/agent-release-eval-fixtures/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate_version_id: candidateVersionId.trim(), fixture_ids: selectedFixtureIds }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const result = await response.json() as EvalRunResult;
      setRunResult(result);
      toast.success(result.release_eligible ? "Evaluación completada y elegible para revisión." : "Evaluación completada; no certifica esta candidata.");
    } catch {
      toast.danger("No se pudo ejecutar la evaluación. Revisa la candidata y los fixtures seleccionados.");
    } finally {
      setRunBusy(false);
    }
  }

  return (
    <Card
      kicker="Replay de versiones candidatas"
      title="Fixtures de ejecución"
      description="Importa escenarios congelados y ejecútalos contra una versión candidata. La suite usa solo fuentes y resultados de herramientas capturados; nunca llama a conectores reales."
    >
      <div className="grid gap-4">
        <div className="rounded-lg border border-separator p-3 text-sm text-muted">
          Los datos sintéticos solo se aceptan en desarrollo. Calibración y release requieren datos anonimizados y revisados. La ejecución llama al modelo configurado y puede generar coste; cada caso tiene un límite de coste.
        </div>
        <label className="text-sm text-muted">
          Archivo JSON (máximo 8 MiB)
          <input
            className="mt-1 block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border file:border-separator file:bg-surface file:px-3 file:py-2"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void loadFile(event.currentTarget.files?.[0])}
          />
        </label>
        <label className="text-sm text-muted">
          Fixture JSON
          <Textarea
            className="mt-1 min-h-48 font-mono text-xs"
            value={fixtureText}
            onChange={(event) => setFixtureText(event.target.value)}
            placeholder='{"schema_version":"agent-release-replay-v1", ...}'
            spellCheck={false}
          />
        </label>
        {visualArtifacts.length > 0 ? (
          <section aria-label="Evidencia visual del fixture" className="grid gap-2 rounded-lg border border-separator p-3">
            <strong className="text-sm">Evidencia visual · {visualArtifacts.filter((artifact) => artifact.bytes_base64).length}/{visualArtifacts.length} adjunta</strong>
            <p className="text-xs text-muted">Adjunta cada imagen al artefacto con el rol correcto. El servidor validará la firma y el hash antes de guardar o ejecutar el caso.</p>
            {visualArtifacts.map((artifact, index) => (
              <label key={`${artifact.artifact_id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-separator p-2 text-sm">
                <span>{artifact.role} · {artifact.media_type} · {artifact.bytes_base64 ? "lista" : "falta imagen"}</span>
                <input className="max-w-full text-xs" type="file" accept="image/png,image/jpeg,image/webp"
                  aria-label={`Adjuntar imagen ${artifact.role}`}
                  onChange={(event) => { void attachVisualArtifact(index, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
            ))}
          </section>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={!parsed.ok || busy} onClick={() => void importFixture()}>
            {busy ? "Guardando…" : "Importar fixture"}
          </Button>
          {fixtureText && !parsed.ok ? <span className="text-sm text-danger">El JSON no es válido.</span> : null}
          {parsed.ok ? <span className="text-sm text-muted">JSON válido; el servidor comprobará esquema, hashes y privacidad.</span> : null}
        </div>
        {error ? <ErrorBlock>{error}</ErrorBlock> : null}
        <div className="overflow-x-auto rounded-lg border border-separator">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-separator text-muted">
              <tr><th className="p-3">Usar</th><th className="p-3">Agente</th><th className="p-3">Dataset</th><th className="p-3">Split</th><th className="p-3">Procedencia</th><th className="p-3">Hash</th></tr>
            </thead>
            <tbody>
              {(data?.cases ?? []).map((item) => (
                <tr key={item.id} className="border-b border-separator last:border-0">
                  <td className="p-3"><input aria-label={`Seleccionar fixture ${item.id}`} type="checkbox" checked={selectedFixtureIds.includes(item.id)} onChange={() => toggleFixture(item.id)} /></td>
                  <td className="p-3 font-mono text-xs">{item.agent_code}</td>
                  <td className="p-3">{item.dataset_version}</td>
                  <td className="p-3"><Badge tone={item.split === "release" ? "warn" : "neutral"}>{item.split}</Badge></td>
                  <td className="p-3">{item.provenance === "synthetic" ? "Sintético" : item.privacy_reviewed ? "Producción anonimizada · revisada" : "Producción · pendiente de revisión"}</td>
                  <td className="p-3 font-mono text-xs">{item.content_sha256.slice(0, 12)}…</td>
                </tr>
              ))}
              {!isLoading && (data?.cases.length ?? 0) === 0 ? <tr><td colSpan={6} className="p-4 text-muted">No hay fixtures registrados.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 rounded-lg border border-separator p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="text-sm text-muted">
            Versión candidata
            <select className="mt-1 block w-full rounded-md border border-separator bg-surface px-3 py-2 text-sm text-foreground" value={candidateVersionId} onChange={(event) => setCandidateVersionId(event.target.value)}>
              <option value="">Selecciona un agente y versión</option>
              {(candidateData?.candidates ?? []).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.version} · {candidate.code} · {candidate.model}</option>)}
            </select>
          </label>
          <Button variant="primary" disabled={runBusy || selectedFixtureIds.length === 0 || !candidateVersionId.trim() || selectedAgentMismatch} onClick={() => void runEvaluation()}>
            {runBusy ? "Evaluando…" : `Ejecutar ${selectedFixtureIds.length || ""} casos`}
          </Button>
          {selectedAgentMismatch ? <p className="text-sm text-danger sm:col-span-2">Selecciona fixtures del mismo agente que la candidata.</p> : null}
        </div>
        {runResult ? (
          <section aria-live="polite" className="grid gap-2 rounded-lg border border-separator p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2"><strong>Resultado: {runResult.status}</strong><Badge tone={runResult.release_eligible ? "success" : "warn"}>{runResult.release_eligible ? "Elegible" : "No certifica"}</Badge><span className="font-mono text-xs text-muted">{runResult.evaluation_id}</span></div>
            {runResult.results.map((item) => <div key={item.caseId} className="border-t border-separator pt-2"><strong>{item.passed ? "Aprobado" : "Fallido"}</strong> · {item.caseId}{item.failures.length ? <span className="text-danger"> · {item.failures.join(", ")}</span> : null}<span className="text-muted"> · {item.latencyMs} ms · ${item.costUsd.toFixed(4)}</span></div>)}
          </section>
        ) : null}
        <p className="text-xs text-muted">{data?.total ?? 0} fixtures registrados. Los registros son inmutables; cualquier corrección requiere una nueva versión de dataset y un nuevo hash.</p>
      </div>
    </Card>
  );
}
