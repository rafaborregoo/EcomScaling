// Compara seis modelos en la replanificación real de Mi Camino por CLI, sin claves API.
// Mismo contexto (snapshot real de A19), mismo prompt y mismo contrato. Solo escribe en
// .e-nora-test-lab; guardar la ganadora es un paso aparte (--save=<modelo>).
//   npx dotenv -e .env.local -- npx tsx scripts/a19-replan-model-comparison.mts
//   ... --report            recalcula la comparación sin llamar a los modelos
//   ... --save=claude-opus-5-5   guarda esa respuesta como propuesta en TEST
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import {
  anchorCaminoMonths,
  caminoCalendarHorizonDays,
  caminoCalendarMonthsTouched,
  caminoPlanJsonSchema,
  caminoPlanOutputSchema,
  caminoPlanSchemaForHorizon,
  normalizeCaminoTimeline,
  toAnthropicCompatibleOutputSchema,
} from "@e-nora/ai";
import { caminoOperationalContract } from "../apps/api/src/ai-runtime.js";
import { analyzeReplan, CAMINO_REPLAN_CONTRACT, dropUnknownReferences, normalizeTitle } from "../apps/api/src/camino-replan.js";
import { loadManualDecisions, loadPlan, loadRestrictions } from "../apps/api/src/camino-replan-service.js";
import { caminoProposalToPlanInput } from "../apps/api/src/strategic-plans.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";

const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const SNAPSHOT_RUN = "7316abd6-2736-4a27-9384-7de268f62fb7";
const SCOPES = ["dates", "margin", "tasks", "goals", "strategy"];
const MONTHS = 6;
const dir = resolve(".e-nora-test-lab/a19-replan-2026-11-05");
const models = [
  { id: "claude-haiku-5-5", provider: "anthropic" },
  { id: "claude-sonnet-5-5", provider: "anthropic" },
  { id: "claude-opus-5-5", provider: "anthropic" },
  { id: "gpt-6-luna", provider: "openai" },
  { id: "gpt-6.1-sol", provider: "openai" },
  { id: "gpt-6.1-terra", provider: "openai" },
];
const hash = (value: unknown) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
await mkdir(dir, { recursive: true });

const { data: run, error: runError } = await db.from("agent_runs").select("organization_id, store_id, objective, agent_version_id, actor_user_id, lookback_days").eq("id", SNAPSHOT_RUN).single();
assert.ifError(runError);
const { data: snapshot } = await db.from("agent_context_snapshots").select("snapshot").eq("run_id", SNAPSHOT_RUN).single();
const { data: promptRow } = await db.from("prompt_versions").select("content").eq("code", "a19_arquitecto_camino_system").eq("version", "v17").single();
const blocks = (snapshot!.snapshot as { blocks: Array<{ label: string; data: unknown }> }).blocks;
assert.ok(blocks[0]!.label.startsWith("REPLANIFICACIÓN"), "snapshot sin bloque de replanificación");
const org = run!.organization_id as string;
const { data: planRow } = await db.from("strategic_plans").select("id").eq("organization_id", org).eq("status", "active").eq("store_id", run!.store_id).single();
const loaded = await loadPlan(db, org, planRow!.id as string);
if (loaded.ok === false) throw new Error(loaded.error);
const plan = loaded.plan;
const now = new Date();
const horizonDays = caminoCalendarHorizonDays(now, MONTHS);
const checkpoints = caminoCalendarMonthsTouched(now, horizonDays);
const system = `${promptRow!.content}\n\n${CAMINO_REPLAN_CONTRACT} ${caminoOperationalContract(checkpoints)}`;
const prompt = `CONTEXTO Y ENCARGO VERIFICADOS\n${JSON.stringify({ objective: run!.objective, blocks })}\nNo uses herramientas: solo existen los datos entregados. Devuelve únicamente el JSON del contrato.`;
const schemaFile = resolve(dir, "schema.json");
const systemFile = resolve(dir, "system.txt");
await writeFile(schemaFile, JSON.stringify(caminoPlanJsonSchema));
await writeFile(systemFile, system);

const reportPath = resolve(dir, "report.json");
let report: { prompt_hash: string; context_hash: string; created_at: string; results: Array<Record<string, any>> };
try {
  report = JSON.parse(await readFile(reportPath, "utf8"));
} catch {
  report = { prompt_hash: hash(system), context_hash: hash(blocks), created_at: now.toISOString(), results: [] };
}
let writes = Promise.resolve();
const save = () => {
  const contents = JSON.stringify(report, null, 2);
  writes = writes.then(async () => {
    await writeFile(`${reportPath}.tmp`, contents);
    await rename(`${reportPath}.tmp`, reportPath);
  });
  return writes;
};

const cliEnv = { ...process.env };
for (const key of Object.keys(cliEnv)) if (/^(ANTHROPIC_|OPENAI_|CODEX_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|SUPABASE_|NEXT_PUBLIC_|STRIPE_|META_|SHOPIFY_|KLAVIYO_|CLAUDECODE)/.test(key)) delete cliEnv[key];
const cwd = resolve(tmpdir(), "a19-replan-lab");
await mkdir(cwd, { recursive: true });
const claude = resolve(homedir(), ".local/bin/claude.exe");
const codex = process.env.CODEX_BIN ?? "codex";
const TIMEOUT_MS = 1_200_000;
const invoke = (program: string, args: string[], input: string) =>
  new Promise<{ stdout: string; stderr: string; exit: number | null }>((done) => {
    const child = spawn(program, args, { cwd, env: cliEnv, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "", ended = false;
    const stop = () => {
      if (child.pid) try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch { child.kill(); }
    };
    const timer = setTimeout(() => { stderr += `\nCLI timeout after ${TIMEOUT_MS / 1000} seconds`; stop(); }, TIMEOUT_MS);
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr = (stderr + data).slice(-10000); });
    const finish = (exit: number | null) => { if (ended) return; ended = true; clearTimeout(timer); done({ stdout, stderr, exit }); };
    child.once("error", (error) => { stderr += error.message; finish(-1); });
    child.once("close", finish);
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });

const known = {
  milestones: new Set(plan.phases.flatMap((phase) => phase.milestones.map((milestone) => milestone.id))),
  tasks: new Set(plan.phases.flatMap((phase) => phase.milestones.flatMap((milestone) => milestone.tasks.map((task) => task.id)))),
};

async function runModel(model: (typeof models)[number]) {
  const previous = report.results.find((row) => row.model_id === model.id);
  if (previous?.status === "completed") return;
  const row: Record<string, any> = { model_id: model.id, provider: model.provider, status: "running", started_at: new Date().toISOString(), usage: null, raw_response: "", error: null };
  if (previous) report.results.splice(report.results.indexOf(previous), 1, row);
  else report.results.push(row);
  await save();
  console.log(JSON.stringify({ started: model.id }));
  const args = model.provider === "anthropic"
    ? ["-p", "--model", model.id, "--output-format", "json", "--tools", "", "--safe-mode", "--strict-mcp-config", "--no-session-persistence", "--system-prompt-file", systemFile, "--json-schema", JSON.stringify(toAnthropicCompatibleOutputSchema(caminoPlanJsonSchema as never))]
    : ["exec", "--ignore-user-config", "--disable", "shell_tool", "--disable", "unified_exec", "--skip-git-repo-check", "--ephemeral", "--sandbox", "read-only", "--model", model.id, "-c", 'model_reasoning_effort="medium"', "--output-schema", schemaFile, "--json", "-"];
  const start = Date.now();
  const result = await invoke(model.provider === "anthropic" ? claude : codex, args, model.provider === "anthropic" ? prompt : `${system}\n\n${prompt}\n\nNo uses las herramientas de Codex.`);
  row.duration_ms = Date.now() - start;
  await writeFile(resolve(dir, `${model.id}.receipt.json`), JSON.stringify(result));
  let failure = result.exit === 0 ? "" : result.stderr.slice(-1500) || "La CLI terminó con error";
  if (model.provider === "anthropic") {
    let parsed: any = null;
    try { parsed = JSON.parse(result.stdout); } catch { failure ||= "La CLI no devolvió JSON"; }
    row.raw_response = parsed?.structured_output ? JSON.stringify(parsed.structured_output) : (parsed?.result ?? "");
    const served = Object.keys(parsed?.modelUsage ?? {});
    row.actual_model = served.length === 1 ? (parsed.modelUsage[served[0]!].canonicalModel ?? served[0]) : null;
    if (parsed?.usage) row.usage = { input: parsed.usage.input_tokens ?? null, cached: parsed.usage.cache_read_input_tokens ?? null, cache_creation: parsed.usage.cache_creation_input_tokens ?? null, output: parsed.usage.output_tokens ?? null };
    if (parsed?.is_error) failure ||= String(row.raw_response).slice(0, 800);
  } else {
    const events = result.stdout.split(/\r?\n/).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
    row.raw_response = events.filter((e: any) => e.type === "item.completed" && e.item?.type === "agent_message").map((e: any) => e.item.text).join("\n");
    const completed = events.find((e: any) => e.type === "turn.completed");
    if (completed?.usage) row.usage = { input: completed.usage.input_tokens ?? null, cached: completed.usage.cached_input_tokens ?? null, cache_creation: completed.usage.cache_write_input_tokens ?? null, output: completed.usage.output_tokens ?? null };
    if (!completed) failure ||= events.findLast((e: any) => e.type === "turn.failed" || e.type === "error")?.error?.message ?? "Turno de Codex no completado";
  }
  row.status = failure ? "failed" : "completed";
  row.error = failure || null;
  row.finished_at = new Date().toISOString();
  row.price = row.usage ? calculateLabApiPrice(model.id, row.usage) : null;
  await save();
  console.log(JSON.stringify({ finished: model.id, status: row.status, duration_ms: row.duration_ms, error: row.error?.slice(0, 200) }));
}

/** El mismo camino que recorre una respuesta en runCaminoArchitectAgent. */
function prepare(raw: string) {
  const parsed = caminoPlanOutputSchema.safeParse(parseOutput(raw));
  if (!parsed.success) return { ok: false as const, error: parsed.error.message.slice(0, 400) };
  const generated = new Date(report.created_at);
  const normalized = anchorCaminoMonths(normalizeCaminoTimeline(parsed.data, { referenceDate: generated, horizonMonths: MONTHS }), generated);
  const clean = dropUnknownReferences(normalized, known);
  const checked = caminoPlanSchemaForHorizon(caminoCalendarHorizonDays(generated, MONTHS), MONTHS, generated).safeParse(clean);
  if (!checked.success) return { ok: false as const, error: checked.error.message.slice(0, 600) };
  return { ok: true as const, output: checked.data };
}

async function evaluate() {
  const [manual, restrictions] = await Promise.all([loadManualDecisions(db, org, plan), loadRestrictions(env as never, db, org, plan.store_id)]);
  const open = plan.phases.flatMap((phase) => phase.milestones.flatMap((milestone) => milestone.tasks)).filter((task) => !["completed", "ignored", "cancelled"].includes(task.status));
  const done = plan.phases.flatMap((phase) => phase.milestones.flatMap((milestone) => milestone.tasks)).filter((task) => task.status === "completed").map((task) => normalizeTitle(task.title));
  const rows = [];
  for (const row of report.results) {
    const base = { model: row.model_id, status: row.status, minutes: row.duration_ms ? Math.round(row.duration_ms / 6000) / 10 : null, price: row.price ?? null };
    if (row.status !== "completed") { rows.push({ ...base, error: String(row.error).slice(0, 160) }); continue; }
    const prepared = prepare(row.raw_response);
    if (!prepared.ok) { rows.push({ ...base, contract: false, error: prepared.error }); continue; }
    const output = prepared.output;
    const input = caminoProposalToPlanInput(output, Date.parse(report.created_at), plan.store_id, run!.lookback_days, report.created_at);
    const analysis = analyzeReplan({ current: plan, proposal: input, retired: output.retired_items ?? [], manual, restrictions, scopes: SCOPES, startsOn: report.created_at.slice(0, 10) });
    const tasks = output.phases.flatMap((phase) => phase.milestones.flatMap((milestone) => milestone.tasks));
    const milestones = output.phases.flatMap((phase) => phase.milestones);
    const changedTasks = analysis.changes.filter((change) => change.entity === "task" && ["modified", "rescheduled", "moved"].includes(change.kind));
    const november = output.goal?.monthly_targets?.find((month) => month.period === "2026-11");
    rows.push({
      ...base,
      contract: true,
      phases: output.phases.length,
      milestones: milestones.length,
      tasks_output: tasks.length,
      refs_tasks: tasks.filter((task) => task.source_task_id).length,
      refs_milestones: milestones.filter((milestone) => milestone.source_milestone_id).length,
      open_tasks: open.length,
      kinds: analysis.counts.changes,
      final_open: analysis.counts.final.open_tasks,
      retired: analysis.retire.length,
      retired_with_reason: (output.retired_items ?? []).length,
      blockers: analysis.blockers.map((item) => item.message).slice(0, 5),
      november_target: november?.target_value ?? null,
      goal: output.goal ? `${output.goal.metric_key}:${output.goal.target}` : null,
      months: output.goal?.monthly_targets?.map((month) => month.target_value),
      changed_without_reason: changedTasks.filter((change) => !change.reason).length,
      repeats_done: tasks.filter((task) => !task.source_task_id && done.includes(normalizeTitle(task.title))).length,
      warnings: output.warnings.length,
      diagnosis_chars: output.diagnosis.length,
    });
  }
  await writeFile(resolve(dir, "comparison.json"), JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(rows, null, 1));
}

async function saveWinner(modelId: string) {
  const row = report.results.find((item) => item.model_id === modelId);
  assert.equal(row?.status, "completed", "ese modelo no terminó");
  const prepared = prepare(row!.raw_response);
  if (!prepared.ok) throw new Error(prepared.error);
  const { data: fingerprint, error } = await db.rpc("camino_plan_fingerprint", { p_plan_id: plan.id });
  assert.ifError(error);
  const output = { ...prepared.output, replan_source: { plan_id: plan.id, version: plan.version, fingerprint: fingerprint as string, scopes: SCOPES, generated_on: report.created_at.slice(0, 10) } };
  caminoPlanOutputSchema.parse(output);
  const runId = randomUUID();
  const usage = row!.usage ?? {};
  const inserted = await db.from("agent_runs").insert({
    id: runId, organization_id: org, agent_version_id: run!.agent_version_id, actor_user_id: run!.actor_user_id, trigger_type: "manual", objective: run!.objective,
    status: "succeeded", store_id: run!.store_id, lookback_days: run!.lookback_days, execution_mode: "shadow", started_at: report.created_at, finished_at: row!.finished_at,
    provider: row!.provider, model: modelId, input_tokens: usage.input ?? null, output_tokens: usage.output ?? null, cache_read_tokens: usage.cached ?? null, latency_ms: row!.duration_ms,
  });
  assert.ifError(inserted.error);
  const output_row = await db.from("agent_outputs").insert({ run_id: runId, organization_id: org, status: "pending_approval", output }).select("id").single();
  assert.ifError(output_row.error);
  const snap = await db.from("agent_context_snapshots").insert({ run_id: runId, organization_id: org, snapshot: snapshot!.snapshot });
  if (snap.error) console.log("snapshot no guardado", snap.error.message);
  console.log(JSON.stringify({ saved: output_row.data!.id, run: runId, model: modelId }));
}

const saveArg = process.argv.find((arg) => arg.startsWith("--save="))?.slice(7);
if (saveArg) await saveWinner(saveArg);
else {
  if (!process.argv.includes("--report")) {
    const filter = process.argv.find((arg) => arg.startsWith("--model="))?.slice(8);
    await Promise.all(models.filter((model) => !filter || model.id === filter).map(runModel));
    await writes;
  }
  await evaluate();
}
process.exit(0);
