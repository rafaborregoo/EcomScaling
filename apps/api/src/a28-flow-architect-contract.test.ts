import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { summarizeKlaviyoFlowInventory } from "./klaviyo-flow-architect-context.js";
import { A28_MAX_METRIC_VOLUME_QUERIES } from "./klaviyo-flow-event-volume.js";
import { klaviyoFlowArchitectOutputSchema } from "./klaviyo-flow-architect-output.js";

const migrationUrl = new URL(
  "../../../supabase/migrations/20261115630000_a28_klaviyo_flow_architect.sql",
  import.meta.url,
);
const orchestrationMigrationUrl = new URL(
  "../../../supabase/migrations/20261115640000_a28_approved_flow_context_orchestration.sql",
  import.meta.url,
);
const structuredArchitectureMigrationUrl = new URL(
  "../../../supabase/migrations/20261115820000_a28_structured_flow_architecture.sql",
  import.meta.url,
);
const serverUrl = new URL("./server.ts", import.meta.url);
const runtimeUrl = new URL("./ai-runtime.ts", import.meta.url);
const syncUrl = new URL("./klaviyo-sync.ts", import.meta.url);
const klaviyoPageUrl = new URL(
  "../../web/src/app/klaviyo/page.tsx",
  import.meta.url,
);
const diagnosticSectionUrl = new URL(
  "../../web/src/components/ai-diagnostic-section.tsx",
  import.meta.url,
);

test("A28 inventory remains store-scoped, bounded and free of message bodies", () => {
  const result = summarizeKlaviyoFlowInventory({
    selectedStoreId: "store-a",
    accounts: [
      { id: "account-a", store_id: "store-a", name: "Main" },
      { id: "account-b", store_id: "store-b", name: "Other" },
    ],
    flows: [
      {
        id: "flow-a",
        account_id: "account-a",
        name: "Welcome",
        status: "live",
        trigger_type: "list",
      },
      {
        id: "flow-b",
        account_id: "account-b",
        name: "Private",
        status: "live",
        trigger_type: "list",
      },
    ],
    actions: [
      {
        flow_id: "flow-a",
        action_type: "send_email",
        status: "live",
        position: 1,
        settings_data: { body: "secret" },
      },
    ],
    messages: [
      {
        flow_id: "flow-a",
        channel: "email",
        status: "live",
        subject: "private subject",
        raw_data: { html: "private body" },
      },
    ],
  });
  assert.equal(result.scope, "selected_store");
  assert.equal(result.active_flow_count_observed, 1);
  assert.equal(result.flows[0]?.name, "Welcome");
  assert.doesNotMatch(
    JSON.stringify(result),
    /secret|private subject|private body/i,
  );
});

test("A28 migration versions a manual read-only agent with bounded knowledge access", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /'a28_arquitecto_flujos'/i);
  assert.match(sql, /'\["search_knowledge"\]'::jsonb/i);
  assert.match(sql, /approval_mode/i);
  assert.match(sql, /never writes|nunca escribes en Klaviyo/i);
  assert.match(sql, /Un flow ausente no demuestra una oportunidad/i);
  assert.match(sql, /no como ventas incrementales ni prueba causal/i);
  assert.match(
    sql,
    /raises? exception 'AI_A28_FLOW_ARCHITECT_CONTRACT_INCOMPLETE'/i,
  );
});

test("A28 structured architecture requires evidence and review fields while allowing abstention", async () => {
  const base = {
    answer: "Falta validar el volumen elegible.",
    findings: [],
    recommendations: [],
    sources: [],
    proposed_writes: [],
    approval_required: true,
    confidence: "low" as const,
    warnings: [],
  };
  const abstention = klaviyoFlowArchitectOutputSchema.parse({
    ...base,
    flow_architecture: {
      decision: "needs_validation",
      summary: "No se justifica un flow hasta validar eventos y filtros.",
      candidates: [],
    },
  });
  assert.equal(abstention.flow_architecture.candidates.length, 0);

  const migration = await readFile(structuredArchitectureMigrationUrl, "utf8");
  assert.match(migration, /'a28_arquitecto_flujos_system'[\s\S]*?'v2'/);
  assert.match(migration, /'a28_arquitecto_flujos'[\s\S]*?'v2'/);
  assert.match(migration, /AI_A28_STRUCTURED_FLOW_ARCHITECTURE_INCOMPLETE/);

  const invalid = klaviyoFlowArchitectOutputSchema.safeParse({
    ...base,
    flow_architecture: {
      decision: "design_proposal",
      summary: "Propuesta.",
      candidates: [{ action: "create", name: "Welcome" }],
    },
  });
  assert.equal(invalid.success, false);
});

test("only approved A28 architecture is passed to A27, A11 and A26 without implying activation", async () => {
  const sql = await readFile(orchestrationMigrationUrl, "utf8");
  assert.equal((sql.match(/convert_to\(/g) ?? []).length, 3);
  assert.equal((sql.match(/'UTF8'\)\), 'hex'\)/g) ?? []).length, 3);
  assert.doesNotMatch(sql, /\)::bytea\)/);
  assert.match(sql, /a27_planificador_mailing_system'[\s\S]*?'v5'/);
  assert.match(sql, /a11_generador_marketing_system'[\s\S]*?'v10'/);
  assert.match(sql, /a26_contenido_email_system'[\s\S]*?'v6'/);
  assert.match(sql, /no significa que el flow esté creado, editado o activo/i);
  assert.match(
    sql,
    /es una propuesta, no prueba de que el flow esté creado o activo/i,
  );
  assert.match(sql, /AI_A28_APPROVED_FLOW_CONTEXT_ORCHESTRATION_INCOMPLETE/);
});

test("A28 manual UI section maps to authenticated GET/run API routes", async () => {
  const [server, runtime, page, diagnosticSection] = await Promise.all([
    readFile(serverUrl, "utf8"),
    readFile(runtimeUrl, "utf8"),
    readFile(klaviyoPageUrl, "utf8"),
    readFile(diagnosticSectionUrl, "utf8"),
  ]);
  assert.match(server, /\/ai\/klaviyo-flow-architect/);
  assert.match(server, /\/ai\/klaviyo-flow-architect-run/);
  assert.match(page, /title="Arquitectura de flujos"/);
  assert.match(page, /getPath="\/ai\/klaviyo-flow-architect"/);
  assert.match(page, /runPath="\/ai\/klaviyo-flow-architect-run"/);
  assert.match(page, /days=\{90\}/);
  assert.match(diagnosticSection, /flow_architecture\?:/);
  assert.match(diagnosticSection, /Diseño revisable del flujo/);
  assert.equal(
    (runtime.match(/klaviyo_flow_architect_store_required/g) ?? []).length,
    2,
  );
  assert.match(
    runtime,
    /Selecciona una tienda concreta para analizar sus flujos de Klaviyo/,
  );
});

test("A28 flow-definition sync is incremental, bounded and persists only the extracted structure", async () => {
  const sync = await readFile(syncUrl, "utf8");
  assert.match(sync, /additional-fields%5Bflow%5D=definition/);
  assert.match(sync, /\.slice\(0, 6\)/);
  assert.match(sync, /mapWithConcurrency\(definitionCandidates, 2/);
  assert.match(sync, /a28_flow_structure_attempted_at/);
  assert.match(sync, /a28_flow_structure: flowDefinitionSummaries/);
  assert.match(
    sync,
    /definitionRetryAfter = Date\.now\(\) - 24 \* 60 \* 60 \* 1000/,
  );
});

test("A28 event volume is cached by the bounded sync and never fetched by a manual run", async () => {
  const [sync, runtime] = await Promise.all([
    readFile(syncUrl, "utf8"),
    readFile(runtimeUrl, "utf8"),
  ]);
  assert.equal(A28_MAX_METRIC_VOLUME_QUERIES, 6);
  assert.match(sync, /selectKlaviyoMetricIdsForRefresh/);
  assert.match(sync, /queryKlaviyoFlowMetricVolumes\(api/);
  assert.match(sync, /a28_flow_metric_volumes/);
  assert.match(sync, /flow_event_volume/);
  assert.doesNotMatch(runtime, /queryKlaviyoFlowMetricVolumes/);
  assert.doesNotMatch(runtime, /a28_flow_metric_refs/);
});
