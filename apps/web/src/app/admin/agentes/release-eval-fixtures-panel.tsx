"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { CheckIcon, ImageIcon } from "lucide-react";
import {
  Field,
  Attachment,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  Badge,
  Button,
  DataTable,
  ErrorBlock,
  Input,
  SearchableSelect,
  Textarea,
  toast,
  UploadButton,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui";
import { fileKind } from "@/lib/file-meta";

const VISUAL_ROLE_LABEL: Record<string, string> = {
  input: "Entrada del agente",
  render: "Resultado renderizado",
  reference: "Referencia",
  neighbor: "Imagen comparativa",
};

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

  function selectFixtures(ids: string[]) {
    setRunResult(null);
    setSelectedFixtureIds(ids);
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
    <Card>
      <CardHeader>
        <CardKicker>Replay de versiones candidatas</CardKicker>
        <CardTitle>Fixtures de ejecución</CardTitle>
        <CardDescription>Importa escenarios congelados y ejecútalos contra una versión candidata. La suite usa solo fuentes y resultados de herramientas capturados; nunca llama a conectores reales.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <Card size="sm"><CardContent className="text-sm text-muted">
            Los datos sintéticos solo se aceptan en desarrollo. Calibración y release requieren datos anonimizados y revisados. La ejecución llama al modelo configurado y puede generar coste; cada caso tiene un límite de coste.
          </CardContent></Card>
          <Field label="Archivo JSON (máximo 8 MiB)">
            <Input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void loadFile(event.currentTarget.files?.[0])}
            />
          </Field>
          <Field label="Fixture JSON"><Textarea className="min-h-48 font-mono text-xs"
              value={fixtureText}
              onChange={(event) => setFixtureText(event.target.value)}
              placeholder='{"schema_version":"agent-release-replay-v1", ...}'
              spellCheck={false} /></Field>
          {visualArtifacts.length > 0 ? (
            <Card size="sm" role="region" aria-label="Evidencia visual del fixture"><CardContent className="grid gap-2">
              <strong className="text-sm">Evidencia visual · {visualArtifacts.filter((artifact) => artifact.bytes_base64).length}/{visualArtifacts.length} adjunta</strong>
              <p className="text-xs text-muted">Adjunta cada imagen al artefacto con el rol correcto. El servidor validará la firma y el hash antes de guardar o ejecutar el caso.</p>
              {visualArtifacts.map((artifact, index) => (
                <Attachment key={`${artifact.artifact_id}-${index}`} size="sm" state={artifact.bytes_base64 ? "done" : "idle"}>
                  <AttachmentMedia>{artifact.bytes_base64 ? <CheckIcon aria-hidden /> : <ImageIcon aria-hidden />}</AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{VISUAL_ROLE_LABEL[artifact.role] ?? "Imagen"}</AttachmentTitle>
                    <AttachmentDescription>{fileKind("", artifact.media_type)} · {artifact.bytes_base64 ? "adjunta" : "falta la imagen"}</AttachmentDescription>
                  </AttachmentContent>
                  <AttachmentActions>
                    <UploadButton accept="image/png,image/jpeg,image/webp" size="xs" variant={artifact.bytes_base64 ? "ghost" : "secondary"} onFile={(file) => attachVisualArtifact(index, file)}>
                      {artifact.bytes_base64 ? "Cambiar" : "Adjuntar"}
                    </UploadButton>
                  </AttachmentActions>
                </Attachment>
              ))}
            </CardContent></Card>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" disabled={!parsed.ok || busy} onClick={() => void importFixture()}>
              {busy ? "Guardando…" : "Importar fixture"}
            </Button>
            {fixtureText && !parsed.ok ? <span className="text-sm text-danger">El JSON no es válido.</span> : null}
            {parsed.ok ? <span className="text-sm text-muted">JSON válido; el servidor comprobará esquema, hashes y privacidad.</span> : null}
          </div>
          {error ? <ErrorBlock>{error}</ErrorBlock> : null}
          {isLoading ? null : (
            <DataTable
              ariaLabel="Fixtures de evaluación"
              emptyLabel="No hay fixtures registrados."
              rows={data?.cases ?? []}
              selected={selectedFixtureIds}
              onSelectedChange={selectFixtures}
              searchPlaceholder="Buscar por agente o dataset…"
              columns={[
                { key: "agent_code", label: "Agente", render: (item) => <span className="font-mono text-xs">{item.agent_code}</span> },
                { key: "dataset_version", label: "Dataset" },
                { key: "split", label: "Split", render: (item) => <Badge tone={item.split === "release" ? "warn" : "neutral"}>{item.split}</Badge> },
                { key: "provenance", label: "Procedencia", render: (item) => (item.provenance === "synthetic" ? "Sintético" : item.privacy_reviewed ? "Producción anonimizada · revisada" : "Producción · pendiente de revisión") },
                { key: "content_sha256", label: "Hash", sortable: false, render: (item) => <span className="font-mono text-xs">{item.content_sha256.slice(0, 12)}…</span> },
              ]}
            />
          )}
          <Card><CardContent className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field label="Versión candidata">
              <SearchableSelect
                value={candidateVersionId}
                onChange={setCandidateVersionId}
                placeholder="Selecciona un agente y versión"
                options={(candidateData?.candidates ?? []).map((candidate) => ({ value: candidate.id, label: `${candidate.name} · ${candidate.version} · ${candidate.code} · ${candidate.model}` }))}
              />
            </Field>
            <Button variant="default" disabled={runBusy || selectedFixtureIds.length === 0 || !candidateVersionId.trim() || selectedAgentMismatch} onClick={() => void runEvaluation()}>
              {runBusy ? "Evaluando…" : `Ejecutar ${selectedFixtureIds.length || ""} casos`}
            </Button>
            {selectedAgentMismatch ? <p className="text-sm text-danger sm:col-span-2">Selecciona fixtures del mismo agente que la candidata.</p> : null}
          </CardContent></Card>
          {runResult ? (
            <section aria-live="polite" className="grid gap-2 rounded-lg border border-separator p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2"><strong>Resultado: {runResult.status}</strong><Badge tone={runResult.release_eligible ? "success" : "warn"}>{runResult.release_eligible ? "Elegible" : "No certifica"}</Badge><span className="font-mono text-xs text-muted">{runResult.evaluation_id}</span></div>
              {runResult.results.map((item) => <div key={item.caseId} className="border-t border-separator pt-2"><strong>{item.passed ? "Aprobado" : "Fallido"}</strong> · {item.caseId}{item.failures.length ? <span className="text-danger"> · {item.failures.join(", ")}</span> : null}<span className="text-muted"> · {item.latencyMs} ms · ${item.costUsd.toFixed(4)}</span></div>)}
            </section>
          ) : null}
          <p className="text-xs text-muted">{data?.total ?? 0} fixtures registrados. Los registros son inmutables; cualquier corrección requiere una nueva versión de dataset y un nuevo hash.</p>
        </div>
      </CardContent>
    </Card>
  );
}
