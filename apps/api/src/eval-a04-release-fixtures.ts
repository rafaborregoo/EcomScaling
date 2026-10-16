/**
 * Ejecuta los fixtures de un agente (A04, A06...) desde disco contra una versión
 * candidata y enseña, por caso, la salida del agente y el dictamen del juez
 * criterio a criterio. Es la vuelta de iteración: no persiste evaluaciones ni
 * consume holdouts (solo lee ficheros y llama al proveedor del candidato).
 *
 *   npm run eval:a04:fixtures -- <candidate_version_id> [development|release] [C01,C03]
 *   npm run eval:agent:fixtures -- <candidate_version_id> ...  (mismo script; el
 *   agente sale de la versión y los casos de eval-fixtures/<a04|a06|...>)
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { buildAgentReleaseCandidateProvider } from "./agent-release-candidate-eval.js";
import { buildAgentReleaseFixtureLiveEvalCases } from "./agent-release-eval-fixture.js";
import { validateAgentReleaseEvalFixture } from "./agent-release-eval-fixture.js";
import { runLiveAgentEvalCase } from "@e-nora/ai";

const [candidateVersionId, folder = "development", only] = process.argv.slice(2);
if (!candidateVersionId) throw new Error("uso: eval-a04-release-fixtures <candidate_version_id> [development|release] [C01,C02]");

const env = loadApiEnv(process.env);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: versionRow } = await supabase.from("agent_versions").select("agent_definitions!inner(code)").eq("id", candidateVersionId).single();
const agentCode = (versionRow as unknown as { agent_definitions: { code: string } }).agent_definitions.code;
const { provider } = await buildAgentReleaseCandidateProvider(env, supabase, candidateVersionId, agentCode);
const { data: manifest } = await supabase.rpc("capture_agent_version_release_manifest", { p_agent_version_id: candidateVersionId });
const candidate = { agentVersionId: candidateVersionId, agentCode: agentCode as "a04_generador_tareas", candidateFingerprint: (manifest as { manifest_sha256: string }).manifest_sha256 };

const dir = path.resolve("eval-fixtures", agentCode.slice(0, 3), folder);
const wanted = only ? new Set(only.split(",")) : null;
const files = readdirSync(dir).filter((file) => /^[A-Z][0-9]+.json$/.test(file)).filter((file) => !wanted || wanted.has(path.basename(file, ".json")));
let passed = 0;
for (const file of files) {
  const checked = validateAgentReleaseEvalFixture(JSON.parse(readFileSync(path.join(dir, file), "utf8")));
  if (!checked.ok) { console.log(`\n### ${file}: fixture inválido (${checked.detail})`); continue; }
  const [testCase] = buildAgentReleaseFixtureLiveEvalCases([{ id: path.basename(file, ".json"), fixture: checked.fixture }]);
  let output: any; let judgment: any;
  const wrapped: typeof provider = async (...args) => {
    const result = await provider(...args);
    output = result.output; judgment = result.candidateJudgment;
    return result;
  };
  const result = await runLiveAgentEvalCase(testCase!, "live", wrapped, undefined, candidate)
    .catch((error) => ({ passed: false, failures: [`error:${error instanceof Error ? error.message : error}`] }));
  if (result.passed) passed += 1;
  console.log(`\n### ${file} ${result.passed ? "PASA" : "FALLA"} juez=${judgment?.status ?? "-"} ${judgment?.overall_score ?? ""}`);
  console.log(`escenario: ${checked.fixture.scenario}`);
  if (result.failures.length) console.log(`fallos: ${result.failures.join(" | ")}`);
  if (output) {
    console.log(`answer: ${output.answer}`);
    console.log(`confidence: ${output.confidence} · sources: ${(output.sources ?? []).map((s: any) => s.reference).join(", ")}`);
    for (const write of output.proposed_writes ?? []) console.log(`  + [${write.priority}] ${write.title} — ${write.rationale}`);
    for (const warning of output.warnings ?? []) console.log(`  ! ${warning}`);
  }
  for (const criterion of judgment?.criteria ?? []) {
    console.log(`  · ${criterion.id}: ${criterion.score ?? criterion.status} — ${String(criterion.rationale ?? criterion.reason ?? "").slice(0, 400)}`);
  }
  if (judgment?.summary) console.log(`  juez: ${String(judgment.summary).slice(0, 500)}`);
}
console.log(`\n${passed}/${files.length} casos pasan`);
