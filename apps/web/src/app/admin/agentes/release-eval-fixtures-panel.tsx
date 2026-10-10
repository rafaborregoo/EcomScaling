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
    if (file.size > 250_000) {
      toast.danger("El archivo supera el límite de 250 KB.");
      return;
    }
    try {
      setFixtureText(await file.text());
    } catch {
      toast.danger("No se pudo leer el archivo JSON.");
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
          Archivo JSON (máximo 250 KB)
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
