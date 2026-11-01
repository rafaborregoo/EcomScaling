import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getAdminAiModelLab } from "../apps/api/src/ai-model-lab.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash } from "./ai-model-lab-core.js";

const dir = resolve(".e-nora-test-lab/ai-models");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(resolve(dir, "report.json"), "utf8")),
);
const admin = { profile: { platform_role: "platform_admin" } } as AuthContext;
const env = {
  SUPABASE_URL: `https://${report.target.project_ref}.supabase.co`,
};
assert.equal(
  new Set(report.results.map((r) => r.id)).size,
  report.results.length,
);
for (const c of report.cases) {
  if (c.schema_file)
    assert.equal(
      hash(JSON.parse(await readFile(resolve(dir, c.schema_file), "utf8"))),
      c.schema_hash,
    );
  const input = JSON.parse(
    await readFile(
      resolve(
        dir,
        `${c.agent_code}.${c.context_hash}.${c.prompt_hash}.input.json`,
      ),
      "utf8",
    ),
  );
  assert.equal(
    hash(input.system),
    c.prompt_hash,
    `${c.agent_code}: prompt modificado`,
  );
  assert.equal(
    hash(c.source === "call_transcript" ? input.input : input.input.context),
    c.context_hash,
    `${c.agent_code}: contexto modificado`,
  );
  assert.equal(input.prompt.length + input.system.length, c.input_characters);
  assert.deepEqual(
    report.results
      .filter((r) => r.case_id === c.id)
      .map((r) => r.model_id)
      .sort(),
    [...(c.model_ids ?? report.models.map((m) => m.id))].sort(),
  );
  if (c.meeting_benchmark) {
    const reference = JSON.parse(
      await readFile(
        resolve(dir, `${c.id.replaceAll(":", ".")}.reference.json`),
        "utf8",
      ),
    );
    assert.equal(hash(reference), c.meeting_benchmark.reference_hash);
    assert.equal(reference.case_id, c.id);
    assert.equal(reference.word_count, c.meeting_benchmark.transcript_words);
    assert.equal(reference.speaker_count, c.meeting_benchmark.speaker_count);
    assert.ok(reference.criteria.length >= 10);
  }
  if (c.monitor_benchmark) {
    const reference = JSON.parse(
      await readFile(
        resolve(dir, `${c.id.replaceAll(":", ".")}.reference.json`),
        "utf8",
      ),
    );
    assert.equal(hash(reference), c.monitor_benchmark.reference_hash);
    assert.equal(reference.case_id, c.id);
    assert.equal(reference.criteria.length, 16);
    assert.ok(reference.requirements.length > 0);
  }
  if (c.campaign_benchmark) {
    const reference = JSON.parse(await readFile(resolve(dir, `${c.id.replaceAll(":", ".")}.reference.json`), "utf8"));
    assert.equal(hash(reference), c.campaign_benchmark.reference_hash);
    assert.equal(reference.case_id, c.id);
    assert.equal(reference.criteria.length, 16);
  }
  if (c.stock_benchmark) {
    const reference = JSON.parse(await readFile(resolve(dir, `${c.id.replaceAll(":", ".")}.reference.json`), "utf8"));
    assert.equal(hash(reference), c.stock_benchmark.reference_hash);
    assert.equal(reference.case_id, c.id);
    assert.equal(reference.criteria.length, 16);
    if (c.source === "synthetic_snapshot") {
      assert.deepEqual(input.input.time_range, { start: "2026-09-29T09:00:00Z", end: "2026-10-29T09:00:00Z" });
      const blocks = input.input.context.snapshot;
      const data = blocks.find((block: { label: string }) => block.label.startsWith("Productos con demanda"))?.data;
      for (const product of data?.items ?? []) {
        if (product.days_of_cover != null) assert.equal(product.days_of_cover, product.available_quantity / product.average_daily_sales);
        if (product.weekly_demand_coverage === "incomplete") assert.equal(product.demand_forecast.forecast30d, null);
      }
    }
  }
  if (c.task_benchmark) {
    const reference = JSON.parse(
      await readFile(
        resolve(dir, `${c.id.replaceAll(":", ".")}.reference.json`),
        "utf8",
      ),
    );
    assert.equal(hash(reference), c.task_benchmark.reference_hash);
    assert.equal(reference.case_id, c.id);
    assert.equal(reference.criteria.length, 16);
    if (c.source === "synthetic_snapshot")
      assert.deepEqual(input.input.time_range, {
        start: "2026-09-28T00:00:00Z",
        end: "2026-10-28T00:00:00Z",
      });
    if (c.source === "synthetic_snapshot") {
      const blocks = input.input.context.snapshot;
      const stock = blocks.find((block: { label: string }) =>
        block.label.startsWith("Riesgo de stock"),
      )?.data?.data;
      if (stock?.store) assert.equal(stock.store, "E-NORA Demo");
      for (const product of stock?.products ?? []) {
        if (
          product.days_of_cover != null &&
          product.stock != null &&
          product.units_sold_30d > 0
        )
          assert.equal(
            product.days_of_cover,
            product.stock / (product.units_sold_30d / 30),
          );
      }
    }
  }
}
const index = await getAdminAiModelLab(env, admin);
assert.ok(index.ok && index.data.available);
if (index.ok && index.data.available)
  assert.ok(
    index.data.report.results.every(
      (r) =>
        !r.raw_response &&
        r.meeting_assessment === undefined &&
        r.field_assessment === undefined,
    ),
  );
for (const agent of new Set(report.cases.map((c) => c.agent_code))) {
  const detail = await getAdminAiModelLab(env, admin, agent);
  assert.ok(detail.ok && detail.data.available);
  if (detail.ok && detail.data.available)
    assert.ok(detail.data.report.cases.every((c) => c.agent_code === agent));
  if (agent === "a01_analista_llamadas" && detail.ok && detail.data.available) {
    const cases = detail.data.report.cases.filter((c) => c.meeting_benchmark);
    const rows = detail.data.report.results.filter((r) =>
      cases.some((c) => c.id === r.case_id),
    );
    assert.equal(cases.length, 3);
    assert.equal(rows.length, 18);
    assert.ok(rows.every((r) => r.meeting_assessment?.checks.length === 14));
    assert.ok(rows.every((r) => r.review.status === "reviewed"));
    if (process.argv.includes("--fields")) {
      assert.ok(
        rows.every(
          (r) => r.field_assessment?.rubric_version === "a01-fields-v1",
        ),
      );
      assert.ok(rows.every((r) => r.field_assessment?.checks.length === 14));
      assert.ok(
        rows.every(
          (r) => r.field_assessment?.output_hash === hash(r.raw_response),
        ),
      );
    }
  }
  if (agent === "a05_estrategia_campanas" && process.argv.includes("--campaign-fields") && detail.ok && detail.data.available) {
    const cases = detail.data.report.cases.filter((c) => c.campaign_benchmark);
    const rows = detail.data.report.results.filter((r) => cases.some((c) => c.id === r.case_id));
    assert.equal(cases.length, 3);
    assert.equal(rows.length, 21);
    assert.ok(rows.every((r) => r.status === "completed" && r.checks.native_contract === true));
    assert.ok(rows.every((r) => r.field_assessment?.rubric_version === "a05-fields-v1" && r.field_assessment.checks.length === 16 && r.field_assessment.output_hash === hash(r.raw_response)));
    assert.ok(rows.every((r) => r.field_assessment?.judges.length === 2 && r.field_assessment.judges.every((j) => j.status === "completed")));
  }
  if (agent === "a06_planificador_stock" && process.argv.includes("--stock-fields") && detail.ok && detail.data.available) {
    const cases = detail.data.report.cases.filter((c) => c.stock_benchmark);
    const rows = detail.data.report.results.filter((r) => cases.some((c) => c.id === r.case_id));
    assert.equal(cases.length, 4);
    assert.equal(rows.length, 28);
    assert.ok(rows.every((r) => r.status === "completed"));
    assert.ok(rows.every((r) => r.field_assessment?.rubric_version === "a06-fields-v1" && r.field_assessment.checks.length === 16 && r.field_assessment.output_hash === hash(r.raw_response)));
    assert.ok(rows.every((r) => r.field_assessment?.judges.length === 2 && r.field_assessment.judges.every((j) => j.status === "completed")));
  }
  if (
    agent === "a02_monitor_negocio" &&
    process.argv.includes("--monitor-fields") &&
    detail.ok &&
    detail.data.available
  ) {
    const cases = detail.data.report.cases.filter((c) => c.monitor_benchmark);
    const rows = detail.data.report.results.filter((r) =>
      cases.some((c) => c.id === r.case_id),
    );
    assert.equal(cases.length, 5);
    assert.equal(
      rows.length,
      cases.reduce(
        (sum, c) => sum + (c.model_ids?.length ?? report.models.length),
        0,
      ),
    );
    assert.ok(
      rows.every(
        (r) => r.status === "completed" && r.checks.native_contract === true,
      ),
    );
    assert.ok(
      rows.every(
        (r) => r.field_assessment?.rubric_version === "a02-fields-v2-contract",
      ),
    );
    assert.ok(rows.every((r) => r.field_assessment?.checks.length === 16));
    assert.ok(
      rows.every(
        (r) => r.field_assessment?.output_hash === hash(r.raw_response),
      ),
    );
    assert.ok(
      rows.every(
        (r) =>
          r.field_assessment?.judges.length === 2 &&
          r.field_assessment.judges.every((j) => j.status === "completed"),
      ),
    );
    assert.ok(rows.every((r) => r.review.status === "reviewed"));
  }
}
if (process.argv.includes("--task-fields")) {
  const detail = await getAdminAiModelLab(env, admin, "a04_generador_tareas");
  assert.ok(detail.ok && detail.data.available);
  if (detail.ok && detail.data.available) {
    const cases = detail.data.report.cases.filter((c) => c.task_benchmark);
    const rows = detail.data.report.results.filter((r) =>
      cases.some((c) => c.id === r.case_id),
    );
    assert.equal(cases.length, 4);
    assert.equal(rows.length, 28);
    assert.ok(
      rows.every(
        (r) => r.status === "completed" && r.checks.native_contract !== null,
      ),
    );
    assert.ok(
      rows.every(
        (r) =>
          r.field_assessment?.rubric_version === "a04-fields-v1" &&
          r.field_assessment.checks.length === 16,
      ),
    );
    assert.ok(
      rows.every(
        (r) => r.field_assessment?.output_hash === hash(r.raw_response),
      ),
    );
    assert.ok(
      rows.every(
        (r) =>
          r.field_assessment?.judges.length === 2 &&
          r.field_assessment.judges.every((j) => j.status === "completed"),
      ),
    );
  }
}
const wrongEnv = await getAdminAiModelLab(
  { SUPABASE_URL: "https://other.supabase.co" },
  admin,
);
assert.ok(wrongEnv.ok && !wrongEnv.data.available);
const missing = await getAdminAiModelLab(env, admin, "../../private");
assert.ok(!missing.ok && missing.statusCode === 404);
console.log(
  JSON.stringify({
    verified: true,
    agents: new Set(report.cases.map((c) => c.agent_code)).size,
    cases: report.cases.length,
    combinations: report.results.length,
    note: "Verifica artefactos y servicio directamente; no sustituye login ni revisión visual de administrador.",
  }),
);
