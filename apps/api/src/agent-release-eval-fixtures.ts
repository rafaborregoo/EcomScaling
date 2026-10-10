import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { AGENT_EVAL_AGENT_CODES, JUDGE_RUBRIC_VERSION, type LiveAgentEvalProvider } from "@e-nora/ai";
import { createServiceClient } from "./ai-runtime.js";
import type { AuthContext } from "./auth-context.js";
import { buildAgentReleaseFixtureLiveEvalCases, validateAgentReleaseEvalFixture } from "./agent-release-eval-fixture.js";
import { runAndPersistLiveAgentEvals } from "./agent-eval-runner.js";
import { buildAgentReleaseCandidateProvider } from "./agent-release-candidate-eval.js";

function isPlatformAdmin(auth: AuthContext): boolean {
  return auth.profile.platform_role === "platform_admin";
}

export async function createAgentReleaseEvalFixture(env: LoadedApiEnv, auth: AuthContext, raw: unknown) {
  if (!isPlatformAdmin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  const checked = validateAgentReleaseEvalFixture(raw);
  if (!checked.ok) return { ok: false as const, statusCode: 400, error: "invalid_release_fixture", detail: checked.detail };
  const { fixture, contentSha256 } = checked;
  const { data, error } = await (createServiceClient(env) as any)
    .from("agent_release_eval_cases")
    .insert({
      agent_code: fixture.agent_code,
      dataset_version: fixture.dataset_version,
      rubric_version: fixture.rubric_version,
      split: fixture.split,
      provenance: fixture.provenance,
      privacy_reviewed: fixture.privacy_reviewed,
      content_sha256: contentSha256,
      fixture,
      created_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false as const, statusCode: 409, error: "duplicate_release_fixture_content" };
    return { ok: false as const, statusCode: 500, error: "release_fixture_create_failed" };
  }
  return { ok: true as const, data: { id: data.id, content_sha256: contentSha256 } };
}

export async function listAgentReleaseEvalFixtures(
  env: LoadedApiEnv,
  auth: AuthContext,
  filters: { dataset_version?: string; agent_code?: string; split?: string; page?: number },
) {
  if (!isPlatformAdmin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  const query = z.object({
    dataset_version: z.string().trim().min(1).max(80).optional(),
    agent_code: z.enum(AGENT_EVAL_AGENT_CODES).optional(),
    split: z.enum(["development", "calibration", "release"]).optional(),
    page: z.number().int().min(0).max(999).optional(),
  }).strict().safeParse(filters);
  if (!query.success) return { ok: false as const, statusCode: 400, error: "invalid_release_fixture_filters" };
  const page = query.data.page ?? 0;
  let request = (createServiceClient(env) as any)
    .from("agent_release_eval_cases")
    .select("id, agent_code, dataset_version, rubric_version, split, provenance, privacy_reviewed, content_sha256, created_at", { count: "exact" })
    .order("created_at", { ascending: true })
    .range(page * 100, page * 100 + 99);
  if (query.data.dataset_version) request = request.eq("dataset_version", query.data.dataset_version);
  if (query.data.agent_code) request = request.eq("agent_code", query.data.agent_code);
  if (query.data.split) request = request.eq("split", query.data.split);
  const { data, count, error } = await request;
  if (error) return { ok: false as const, statusCode: 500, error: "release_fixture_list_failed" };
  return { ok: true as const, data: { cases: data ?? [], page, page_size: 100, total: count ?? 0 } };
}

/** Executes exactly the selected immutable fixture rows against one candidate version. */
export async function runAgentReleaseFixtureEvaluation(
  supabase: SupabaseClient,
  input: {
    candidateVersionId: string;
    candidateAgentCode: string;
    fixtureIds: readonly string[];
    provider: LiveAgentEvalProvider;
  },
) {
  const ids = [...new Set(input.fixtureIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length !== input.fixtureIds.length || ids.length > 100) {
    throw new Error("agent_release_fixture_ids_invalid");
  }
  const { data, error } = await supabase
    .from("agent_release_eval_cases")
    .select("id, agent_code, dataset_version, rubric_version, fixture")
    .in("id", ids);
  if (error) throw new Error(`agent_release_fixture_load_failed:${error.message}`);
  const rows = data ?? [];
  if (rows.length !== ids.length) throw new Error("agent_release_fixture_ids_missing");
  const fixtures = rows.map((row) => {
    const checked = validateAgentReleaseEvalFixture(row.fixture);
    if (!checked.ok) throw new Error(`agent_release_fixture_invalid:${row.id}:${checked.detail}`);
    if (row.agent_code !== input.candidateAgentCode || checked.fixture.agent_code !== input.candidateAgentCode) {
      throw new Error("agent_release_fixture_agent_mismatch");
    }
    if (row.rubric_version !== JUDGE_RUBRIC_VERSION || checked.fixture.rubric_version !== JUDGE_RUBRIC_VERSION) {
      throw new Error("agent_release_fixture_rubric_mismatch");
    }
    if (row.dataset_version !== checked.fixture.dataset_version) throw new Error("agent_release_fixture_dataset_version_mismatch");
    return { id: row.id, fixture: checked.fixture };
  });
  const datasetVersions = new Set(fixtures.map(({ fixture }) => fixture.dataset_version));
  if (datasetVersions.size !== 1) throw new Error("agent_release_fixture_mixed_dataset_versions");

  // Release holdout rows are a one-shot blind set. Claim them atomically before
  // the first candidate call; a failed or interrupted run still consumes them.
  // Development and calibration fixtures remain reusable for iteration.
  const releaseFixtureIds = fixtures
    .filter(({ fixture }) => fixture.split === "release")
    .map(({ id }) => id);
  if (releaseFixtureIds.length > 0) {
    const { error: claimError } = await supabase.rpc("claim_agent_release_eval_holdout", {
      p_fixture_ids: releaseFixtureIds,
      p_agent_version_id: input.candidateVersionId,
      p_agent_code: input.candidateAgentCode,
    });
    if (claimError) {
      if (claimError.code === "23505" || claimError.message?.includes("already_claimed")) {
        throw new Error("agent_release_eval_holdout_already_consumed");
      }
      throw new Error(`agent_release_eval_holdout_claim_failed:${claimError.message}`);
    }
  }
  const cases = buildAgentReleaseFixtureLiveEvalCases(fixtures);
  const datasetVersion = [...datasetVersions][0]!;
  return runAndPersistLiveAgentEvals(
    supabase,
    { id: input.candidateVersionId, code: input.candidateAgentCode },
    "live",
    input.provider,
    cases,
    datasetVersion,
  );
}

export async function runAgentReleaseEvalAsPlatformAdmin(
  env: LoadedApiEnv,
  auth: AuthContext,
  input: { candidateVersionId: string; fixtureIds: readonly string[] },
) {
  if (!isPlatformAdmin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  try {
    const supabase = createServiceClient(env);
    const candidate = await buildAgentReleaseCandidateProvider(env, supabase, input.candidateVersionId);
    const result = await runAgentReleaseFixtureEvaluation(supabase, {
      ...input, candidateAgentCode: candidate.agentCode, provider: candidate.provider,
    });
    return { ok: true as const, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "agent_release_eval_run_failed";
    if (message === "agent_release_eval_holdout_already_consumed") {
      return { ok: false as const, statusCode: 409, error: message };
    }
    return { ok: false as const, statusCode: 503, error: message };
  }
}
