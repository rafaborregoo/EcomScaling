import { spawn, execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { labImages } from "./ai-model-lab-images.mjs";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import {
  caminoPlanOutputSchema,
  callSummaryOutputSchema,
  monitorOutputSchema,
  currentCampaignPlanOutputSchema,
  agentOutputSchema,
  toAnthropicCompatibleOutputSchema,
  buildLeanOutputContract,
  buildReadOnlyOutputContract,
  klaviyoEmailGenerationOutputSchema,
  metaAdsOutputSchema,
  instagramPostOutputSchema,
  buildA13OperationalOutputContract,
  instagramImageAnalysisSchema,
} from "../packages/ai/src/index.js";
import {
  normalizeOutput,
  parseOutput,
  redact,
  isUsageLimitFailure,
  hash,
} from "./ai-model-lab-core.js";

const dir = resolve(".e-nora-test-lab/ai-models");
const reportPath = resolve(dir, "report.json");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(reportPath, "utf8")),
);
const agentFilter = process.argv
  .find((arg) => arg.startsWith("--agent="))
  ?.slice("--agent=".length);
const caseFilter = process.argv.find((arg) => arg.startsWith("--case="))?.slice("--case=".length);
const modelFilter = process.argv.find((arg) => arg.startsWith("--model="))?.slice("--model=".length);
if (
  agentFilter &&
  !report.cases.some((item) => item.agent_code === agentFilter)
)
  throw new Error("lab_agent_filter_not_found");
const cwd = resolve(tmpdir(), "e-nora-ai-cli-lab");
await mkdir(cwd, { recursive: true });
const env = { ...process.env };
for (const key of Object.keys(env))
  if (
    /^(ANTHROPIC_|OPENAI_|CODEX_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|SUPABASE_|NEXT_PUBLIC_|STRIPE_|META_|SHOPIFY_|KLAVIYO_)/.test(
      key,
    )
  )
    delete env[key];
const claude = resolve(homedir(), ".local/bin/claude.exe");
const versions = {
  anthropic: execFileSync(claude, ["--version"], {
    env,
    encoding: "utf8",
    windowsHide: true,
  }).trim(),
  openai: execFileSync("codex", ["--version"], {
    env,
    encoding: "utf8",
    windowsHide: true,
  }).trim(),
};
let writes = Promise.resolve();
const save = () => {
  report.updated_at = new Date().toISOString();
  const contents = JSON.stringify(
    aiModelLabReportSchema.parse(report),
    null,
    2,
  );
  writes = writes.then(async () => {
    const temp = `${reportPath}.tmp`;
    await writeFile(temp, contents);
    await rename(temp, reportPath);
  });
  return writes;
};
const invoke = (
  program: string,
  args: string[],
  input: string,
  timeoutMs = 150_000,
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timeout: boolean;
}> =>
  new Promise((done) => {
    const child = spawn(program, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "",
      timeout = false;
    const stop = () => {
      if (process.platform === "win32" && child.pid) {
        try {
          execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
            windowsHide: true,
            stdio: "ignore",
          });
        } catch {
          child.kill();
        }
      } else child.kill();
    };
    const timer = setTimeout(() => {
      timeout = true;
      stop();
    }, timeoutMs);
    child.stdout.on("data", (s) => {
      stdout += s;
      if (stdout.length > 3_000_000) stop();
    });
    child.stderr.on("data", (s) => {
      stderr += s;
    });
    child.once("error", (e) => {
      clearTimeout(timer);
      done({ stdout, stderr: e.message, exitCode: -1, timeout });
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      done({ stdout, stderr, exitCode, timeout });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });

const blockedProviders = new Map<string, string>();
async function runModel(model: (typeof report.models)[number]) {
  const provider = model.provider;
  for (const row of report.results.filter(
    (r) =>
      r.model_id === model.id &&
      (!caseFilter || r.case_id === caseFilter) &&
      (!modelFilter || r.model_id === modelFilter) &&
      (!agentFilter ||
        report.cases.some(
          (item) => item.id === r.case_id && item.agent_code === agentFilter,
        )),
  )) {
    if (!["pending", "running"].includes(row.status)) continue;
    const testCase = report.cases.find((c) => c.id === row.case_id)!;
    const blockedReason = blockedProviders.get(provider);
    if (blockedReason) {
      row.status = "blocked";
      row.error = `No ejecutada: ${blockedReason}`;
      await save();
      continue;
    }
    if (testCase.input_characters > 650_000) {
      row.status = "skipped";
      row.error =
        "Entrada demasiado grande para esta tanda CLI; no se ha truncado.";
      await save();
      continue;
    }
    const input = JSON.parse(
      await readFile(
        resolve(
          dir,
          `${testCase.agent_code}.${testCase.context_hash}.${testCase.prompt_hash}.input.json`,
        ),
        "utf8",
      ),
    );
    row.status = "running";
    row.started_at = new Date().toISOString();
    row.cli_version = versions[provider];
    await save();
    const started = Date.now();
    const schema = testCase.schema_file
      ? JSON.parse(await readFile(resolve(dir, testCase.schema_file), "utf8"))
      : null;
    if (schema && hash(schema) !== testCase.schema_hash)
      throw new Error("lab_schema_hash_mismatch");
    const timeoutMs = testCase.timeout_ms ?? 150_000;
    const images = await labImages(dir, input.image_files);
    const args =
      provider === "anthropic"
        ? [
            "-p",
            "--model",
            row.model_id,
            "--output-format",
            images.length ? "stream-json" : "json",
            ...(images.length ? ["--verbose"] : []),
            "--tools",
            "",
            "--safe-mode",
            "--strict-mcp-config",
            "--no-session-persistence",
            "--system-prompt",
            input.system,
            ...(images.length ? ["--input-format", "stream-json"] : []),
            ...(schema
              ? [
                  "--json-schema",
                  JSON.stringify(toAnthropicCompatibleOutputSchema(schema)),
                ]
              : []),
          ]
        : [
            "exec",
            "--ignore-user-config",
            "--disable",
            "shell_tool",
            "--disable",
            "unified_exec",
            "--skip-git-repo-check",
            "--ephemeral",
            "--sandbox",
            "read-only",
            "--model",
            row.model_id,
            "-c",
            'model_reasoning_effort="medium"',
            ...(testCase.schema_file
              ? ["--output-schema", resolve(dir, testCase.schema_file)]
              : []),
            "--json",
            ...images.flatMap((image) => ["--image", image.path]),
            "-",
          ];
    const result = await invoke(
      provider === "anthropic" ? claude : "codex",
      args,
      provider === "anthropic"
        ? images.length ? JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: input.prompt }, ...images.map((image) => ({ type: "image", source: image.source }))] } }) + "\n" : input.prompt
        : `${input.system}\n\n${input.prompt}\n\nNo uses las herramientas de Codex: esta prueba solo admite los datos entregados.`,
      timeoutMs,
    );
    row.duration_ms = Date.now() - started;
    let failure = result.timeout
      ? `Tiempo máximo de ${timeoutMs / 1000} segundos superado.`
      : "";
    if (provider === "anthropic") {
      let parsed: any;
      try {
        parsed = images.length
          ? result.stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).findLast((event) => event.type === "result")
          : JSON.parse(result.stdout);
      } catch {
        failure ||= "La CLI no devolvió un resultado JSON interpretable.";
      }
      row.raw_response = String(
        redact(
          parsed?.structured_output
            ? JSON.stringify(parsed.structured_output)
            : (parsed?.result ?? ""),
        ),
      );
      const models = Object.keys(parsed?.modelUsage ?? {});
      row.actual_model =
        models.length === 1
          ? (parsed.modelUsage[models[0]!].canonicalModel ?? models[0])
          : null;
      row.model_verified = row.actual_model === row.model_id;
      const usage = parsed?.usage;
      if (usage)
        row.usage = {
          input: usage.input_tokens ?? null,
          cached: usage.cache_read_input_tokens ?? null,
          cache_creation: usage.cache_creation_input_tokens ?? null,
          output: usage.output_tokens ?? null,
        };
      row.provider_reported_cost =
        typeof parsed?.total_cost_usd === "number"
          ? parsed.total_cost_usd
          : null;
      if (parsed?.is_error) failure ||= row.raw_response;
    } else {
      const events = result.stdout
        .split(/\r?\n/)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      row.raw_response = String(
        redact(
          events
            .filter(
              (e) =>
                e.type === "item.completed" && e.item?.type === "agent_message",
            )
            .map((e) => e.item.text)
            .join("\n"),
        ),
      );
      const completed = events.find((e) => e.type === "turn.completed");
      if (completed?.usage)
        row.usage = {
          input: completed.usage.input_tokens ?? null,
          cached: completed.usage.cached_input_tokens ?? null,
          cache_creation: completed.usage.cache_write_input_tokens ?? null,
          output: completed.usage.output_tokens ?? null,
        };
      // Codex JSONL no expone el ID servido: no se toma el nombre solicitado como prueba.
      row.actual_model = null;
      row.model_verified = false;
      if (!completed)
        failure ||=
          events.findLast((e) => e.type === "turn.failed" || e.type === "error")
            ?.error?.message ?? "Turno de Codex no completado.";
      const toolExecutions = events.filter(
        (e) =>
          e.type === "item.completed" &&
          !["agent_message", "reasoning"].includes(e.item?.type),
      );
      if (toolExecutions.length) {
        failure ||=
          "Codex utilizó herramientas propias; ejecución excluida de la comparación controlada.";
      }
    }
    if (result.exitCode !== 0)
      failure ||= String(
        redact(result.stderr.slice(-1500) || "La CLI terminó con error."),
      );
    row.error = failure || null;
    row.status = failure ? "failed" : "completed";
    row.normalized = normalizeOutput(row.raw_response);
    row.checks = {
      json_valid: Boolean(parseOutput(row.raw_response)),
      nonempty: row.raw_response.trim().length > 0,
      native_contract: schema
        ? testCase.agent_code === "a19_arquitecto_camino"
          ? caminoPlanOutputSchema.safeParse(parseOutput(row.raw_response))
              .success
          : testCase.agent_code === "a01_analista_llamadas"
            ? callSummaryOutputSchema.safeParse(parseOutput(row.raw_response))
                .success
            : testCase.agent_code === "a02_monitor_negocio"
              ? monitorOutputSchema.safeParse(parseOutput(row.raw_response))
                  .success
              : testCase.agent_code === "a06_planificador_stock" || testCase.agent_code === "a12_analista_email" || testCase.agent_code === "a14_operativa_meta"
                ? agentOutputSchema.safeParse(parseOutput(row.raw_response)).success
              : testCase.agent_code === "a05_estrategia_campanas"
                ? currentCampaignPlanOutputSchema.safeParse(parseOutput(row.raw_response)).success
              : ["a04_generador_tareas", "a17_plan_semanal", "a18_plan_mensual"].includes(testCase.agent_code)
                ? (() => {
                    const result = buildLeanOutputContract([
                      "findings",
                      "recommendations",
                    ]).schema.safeParse(parseOutput(row.raw_response));
                    return (
                      result.success && (testCase.agent_code !== "a04_generador_tareas" || result.data.proposed_writes.length <= 5)
                    );
                  })()
                : testCase.agent_code === "a08_gestor_conocimiento"
                  ? buildReadOnlyOutputContract().schema.safeParse(parseOutput(row.raw_response)).success
                : testCase.agent_code === "a13_operativa_shopify"
                  ? buildA13OperationalOutputContract().schema.safeParse(parseOutput(row.raw_response)).success
                : testCase.agent_code === "a15_analista_imagenes"
                  ? instagramImageAnalysisSchema.safeParse(parseOutput(row.raw_response)).success
                : testCase.agent_code === "a11_generador_marketing"
                  ? (testCase.schema_file?.includes("meta") ? metaAdsOutputSchema : testCase.schema_file?.includes("instagram") ? instagramPostOutputSchema : klaviyoEmailGenerationOutputSchema).safeParse(parseOutput(row.raw_response)).success
                : null
        : null,
    };
    // No se confunde el coste indicado por una CLI con una factura ni con el coste de la API.
    if (isUsageLimitFailure(Boolean(failure), failure)) {
      blockedProviders.set(provider, failure.slice(0, 1000));
      row.status = "blocked";
    }
    await writeFile(
      resolve(
        dir,
        `${testCase.agent_code}.${hash(testCase.id)}.${row.model_id}.receipt.json`,
      ),
      JSON.stringify(
        {
          stdout: result.stdout,
          stderr: result.stderr,
          exit_code: result.exitCode,
        },
        null,
        2,
      ),
    );
    await save();
    console.log(
      JSON.stringify({
        agent: testCase.agent_code,
        model: row.model_id,
        status: row.status,
        ms: row.duration_ms,
        json: row.checks.json_valid,
        verified: row.model_verified,
        error: row.error?.slice(0, 180),
      }),
    );
  }
}
await Promise.all(report.models.map(runModel));
await save();
console.log(
  JSON.stringify({
    finished: true,
    completed: report.results.filter((r) => r.status === "completed").length,
    total: report.results.length,
  }),
);
