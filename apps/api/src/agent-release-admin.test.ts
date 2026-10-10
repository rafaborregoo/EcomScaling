import assert from "node:assert/strict";
import test from "node:test";
import { listAgentReleaseCandidatesFromClient } from "./agent-release-admin.js";

function queryResult(data: unknown, error: unknown = null) {
  const builder: any = {
    select() { return this; },
    order() { return this; },
    limit() { return this; },
    in() { return this; },
    eq() { return this; },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve({ data, error }).then(resolve, reject);
    },
  };
  return builder;
}

test("lists active-catalog versions and requires judge calibration alongside offline/live evidence", async () => {
  const versions = [
    {
      id: "candidate-a05",
      version: "v6",
      model: "gpt-6-luna",
      is_active: false,
      created_at: "2026-10-10T10:00:00Z",
      agent_definitions: { code: "a05_estrategia_campanas", name: "Estrategia de campañas" },
    },
    {
      id: "retired",
      version: "v1",
      model: "old-model",
      is_active: false,
      created_at: "2026-10-09T10:00:00Z",
      agent_definitions: { code: "a03_agente_retirado", name: "Agente retirado" },
    },
  ];
  const evaluations = [
    { agent_version_id: "candidate-a05", evaluation_mode: "offline", status: "passed", evaluated_at: "2026-10-10T11:00:00Z", evidence: {}, evaluated_agent_codes: [] },
    { agent_version_id: "candidate-a05", evaluation_mode: "live", status: "failed", evaluated_at: "2026-10-10T11:05:00Z", evidence: {}, evaluated_agent_codes: [] },
  ];
  let queryNumber = 0;
  const client = {
    from: () => {
      const index = queryNumber++;
      return queryResult(index === 0 ? versions : index === 1 ? evaluations : []);
    },
  } as any;

  const candidates = await listAgentReleaseCandidatesFromClient(client);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.code, "a05_estrategia_campanas");
  assert.equal(candidates[0]?.evaluations.offline?.status, "passed");
  assert.equal(candidates[0]?.evaluations.live?.status, "failed");
  assert.equal(candidates[0]?.judge_calibration, null);
  assert.equal(candidates[0]?.can_promote, false);
});

test("surfaces only calibration whose approved report matches frozen holdout", async () => {
  const versions = [{ id: "candidate-a05", version: "v6", model: "gpt-6-luna", is_active: false, created_at: "2026-10-10T10:00:00Z", agent_definitions: { code: "a05_estrategia_campanas", name: "Campañas" } }];
  let queryNumber = 0;
  const client = { from: () => {
    const index = queryNumber++;
    if (index === 0) return queryResult(versions);
    if (index === 1) return queryResult([]);
    if (index === 3) return queryResult([{ dataset_version: "judge-gold-v1", rubric_version: "judge-rubrics-v1", evaluation_split: "holdout", status: "passed", report: { allowed: true, holdout_only: true, holdout_manifest_sha256: "a".repeat(64) }, created_at: "2026-10-10T12:00:00Z" }]);
    if (index === 4) return queryResult([{ dataset_version: "judge-gold-v1", manifest_sha256: "a".repeat(64) }]);
    return queryResult([]);
  } } as any;
  const candidates = await listAgentReleaseCandidatesFromClient(client);
  assert.equal(candidates[0]?.judge_calibration?.status, "passed");
  assert.equal(candidates[0]?.can_promote, false);
});

test("iterative calibration reports never satisfy the release judge gate", async () => {
  const versions = [{ id: "candidate-a05", version: "v6", model: "gpt-6-luna", is_active: false, created_at: "2026-10-10T10:00:00Z", agent_definitions: { code: "a05_estrategia_campanas", name: "Campañas" } }];
  let queryNumber = 0;
  const client = { from: () => {
    const index = queryNumber++;
    if (index === 0) return queryResult(versions);
    if (index === 1) return queryResult([]);
    if (index === 3) return queryResult([{ dataset_version: "judge-gold-v1", rubric_version: "judge-rubrics-v1", evaluation_split: "calibration", status: "passed", report: { allowed: true, holdout_manifest_sha256: "a".repeat(64) }, created_at: "2026-10-10T12:00:00Z" }]);
    if (index === 4) return queryResult([{ dataset_version: "judge-gold-v1", manifest_sha256: "a".repeat(64) }]);
    return queryResult([]);
  } } as any;
  const candidates = await listAgentReleaseCandidatesFromClient(client);
  assert.equal(candidates[0]?.judge_calibration, null);
  assert.equal(candidates[0]?.can_promote, false);
});

test("does not report candidates promotable when either evaluation is missing", async () => {
  const client = {
    from: () => queryResult([{
      id: "candidate-a09",
      version: "v2",
      model: "gpt-6-luna",
      is_active: false,
      created_at: "2026-10-10T10:00:00Z",
      agent_definitions: { code: "a09_copiloto_consultor", name: "Copiloto consultor" },
    }]),
  } as any;

  const candidates = await listAgentReleaseCandidatesFromClient(client);
  assert.equal(candidates[0]?.can_promote, false);
  assert.equal(candidates[0]?.evaluations.offline, null);
  assert.equal(candidates[0]?.evaluations.live, null);
  assert.equal(candidates[0]?.judge_calibration, null);
});
