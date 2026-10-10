import assert from "node:assert/strict";
import test from "node:test";
import {
  assertHardenedAgentReleaseGate,
  assertMigrationReleasePreflight,
  migrationActivatesAgentVersion,
} from "./agent-release-migration-preflight.mjs";

test("detects direct activation and upsert of agent versions", () => {
  assert.equal(migrationActivatesAgentVersion(`update public.agent_versions set is_active = true where id = 'x';`), true);
  assert.equal(migrationActivatesAgentVersion(`insert into agent_versions (id, is_active) values ('x', true);`), true);
  assert.equal(migrationActivatesAgentVersion(`insert into public.agent_versions (id, is_active) values ('x', true) on conflict (id) do update set is_active = excluded.is_active;`), true);
});

test("ignores comments and SQL function bodies that define the protected promotion RPC", () => {
  assert.equal(migrationActivatesAgentVersion(`-- update agent_versions set is_active = true\nselect 1;`), false);
  assert.equal(migrationActivatesAgentVersion(`update public.agent_versions set prompt_code = 'is_active = true';`), false);
  assert.equal(migrationActivatesAgentVersion(`create function public.promote_agent_version() returns void language plpgsql as $$ begin update public.agent_versions set is_active = true; end $$;`), false);
});

test("checks dynamic DO blocks for migration-time activation", () => {
  assert.equal(migrationActivatesAgentVersion(`do $$ begin execute 'update public.agent_versions set is_active = true'; end $$;`), true);
});

test("requires an enabled trigger, pinned per-case checks, holdout and protected promotion RPC", async () => {
  const markers = [
    "candidate_pin_verified", "executed_agent_code", "executed_agent_version_id",
    "executed_candidate_fingerprint", "candidate_judge_status",
    "candidate_judge_rubric_version", "candidate_judged_output_sha256", "holdout_manifest_sha256",
  ];
  const client = { query: async () => ({ rows: [{
    trigger_ready: true,
    evidence_gate: markers.join(" "),
    promotion_rpc: "perform private.agent_version_has_release_evidence(p_agent_version_id)",
  }] }) };
  await assertHardenedAgentReleaseGate(client);
  await assert.rejects(assertHardenedAgentReleaseGate({ query: async () => ({ rows: [{
    trigger_ready: true, evidence_gate: "candidate_pin_verified candidate_judge_status candidate_judge_rubric_version candidate_judged_output_sha256 holdout_manifest_sha256", promotion_rpc: "begin null; end",
  }] }) }), /agent_release_gate_preflight_failed/);
});

test("does not query the database for migrations with no agent activation", async () => {
  let calls = 0;
  await assertMigrationReleasePreflight({ query: async () => { calls++; return { rows: [] }; } }, "select 1;");
  assert.equal(calls, 0);
});
