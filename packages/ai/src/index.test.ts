/**
 * AI-06: tests de la guarda de calidad estructural (checkOutputSanity).
 * Puros, sin I/O: reproducen los dos glitches reales observados en
 * produccion (answer vacio en A06, texto corrupto repetido en A02) para que
 * no puedan volver a colarse como pending_approval sin que nadie se de cuenta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkOutputSanity,
  estimateCostUsd,
  evaluateAgentBudget,
  klaviyoEmailDraftPatchSchema,
  klaviyoEmailOutputSchema,
  sanitizeGeneratedEmailHtml,
  createReplayToolExecutor,
  createToolReplayFixture,
  TOOL_REGISTRY,
  authorizeTool,
  getToolContract,
  provenanceSchema,
  toolWriteRequestSchema,
} from "./index.js";

function assertOk(output: unknown) {
  const result = checkOutputSanity(output);
  assert.equal(result.ok, true, `deberia aceptarse: ${JSON.stringify(output)}`);
}

function assertRejected(output: unknown, reason: string) {
  const result = checkOutputSanity(output);
  assert.equal(
    result.ok,
    false,
    `deberia rechazarse: ${JSON.stringify(output)}`,
  );
  if (!result.ok) {
    assert.equal(result.reason, reason);
  }
}

test("acepta una salida normal con answer y proposed_writes validos", () => {
  assertOk({
    answer: "El backlog cubre las alertas activas.",
    proposed_writes: [
      {
        kind: "task",
        title: "Subir costes",
        description: "Cargar 52 items.",
        priority: "high",
      },
    ],
  });
});

test("acepta una salida de chat sin proposed_writes (A09)", () => {
  assertOk({
    answer: "El AOV de los ultimos 30 dias es 28.7 EUR.",
    sources: [],
  });
});

test("acepta una salida de resumen de llamada con proposed_tasks (A01)", () => {
  assertOk({
    summary: "Se acordo subir costes.",
    proposed_tasks: [{ title: "Subir costes", description: "x" }],
  });
});

test("rechaza answer vacio (glitch real observado en A06 pre-fix)", () => {
  assertRejected({ answer: "", proposed_writes: [] }, "answer_vacio");
});

test("rechaza answer solo con espacios", () => {
  assertRejected({ answer: "   \n  " }, "answer_vacio");
});

test("rechaza summary vacio", () => {
  assertRejected({ summary: "" }, "summary_vacio");
});

test("rechaza texto corrupto con fragmento repetido (glitch real observado en A02)", () => {
  assertRejected(
    {
      answer:
        "C ConfigC Configfigcostiguration financn financiera del negocio, repetido repetido repetido repetido repetido",
    },
    "answer_con_texto_corrupto",
  );
});

test("no confunde repeticion legitima de palabras cortas con gibberish", () => {
  assertOk({
    answer:
      "Muy bien, muy bien, muy bien: las ventas van muy bien este mes. El margen mejora cada semana que pasa.",
  });
});

test("rechaza proposed_writes con titulo vacio (glitch real observado en A06 pre-fix)", () => {
  assertRejected(
    {
      answer: "diagnostico normal",
      proposed_writes: [
        { kind: "task", title: "", description: "algo", priority: "high" },
      ],
    },
    "proposed_writes_con_titulo_vacio",
  );
});

test("rechaza proposed_writes con titulo solo espacios", () => {
  assertRejected(
    {
      answer: "diagnostico normal",
      proposed_writes: [{ title: "   ", description: "algo" }],
    },
    "proposed_writes_con_titulo_vacio",
  );
});

test("rechaza proposed_tasks con titulo vacio (A01)", () => {
  assertRejected(
    {
      summary: "resumen normal",
      proposed_tasks: [{ title: "", description: "algo" }],
    },
    "proposed_tasks_con_titulo_vacio",
  );
});

test("rechaza proposed_writes con descripcion corrupta aunque el titulo este bien", () => {
  assertRejected(
    {
      answer: "diagnostico normal",
      proposed_writes: [
        {
          title: "Reponer FUSION",
          description: "abcabcabcabcabcabcabcabcabcabc sin sentido",
          priority: "high",
        },
      ],
    },
    "proposed_writes_con_texto_corrupto",
  );
});

test("acepta proposed_writes vacio (sin hallazgos que proponer)", () => {
  assertOk({
    answer: "Todo en orden, sin tareas nuevas.",
    proposed_writes: [],
  });
});

test("rechaza un output que no es un objeto", () => {
  assertRejected(null, "output_no_es_objeto");
  assertRejected("texto suelto", "output_no_es_objeto");
});

// AI-06 (hallazgo real 2026-07-23, eval de A08 -- ver eval-a08-knowledge-manager.ts
// y AI-06-evaluaciones-calidad.md): dos glitches nuevos observados contra el
// LLM real que pasaban checkOutputSanity porque no eran ni vacios ni
// repeticion.
test("rechaza un answer casi sin letras reales (glitch real observado en A08)", () => {
  assertRejected({ answer: ", ecd" }, "answer_con_apertura_incoherente");
});

test("rechaza un answer con salto de linea partiendo una palabra al inicio (glitch real observado en A08)", () => {
  assertRejected(
    {
      answer:
        "El catlogo del catos c\ntene tres documentos y ninguno cubre las areas centrales.",
    },
    "answer_con_apertura_incoherente",
  );
});

test("acepta un answer corto pero real", () => {
  assertOk({ answer: "Sin hallazgos nuevos." });
});

test("no confunde un salto de linea legitimo (tras puntuacion, en un parrafo) con apertura incoherente", () => {
  assertOk({
    answer:
      "El catalogo esta vacio.\nNo hay documentos que revisar todavia, hace falta sincronizar la fuente.",
  });
});

// AI-06 (hallazgo 2026-07-28): hasIncoherentOpening solo cubria el primer
// salto de linea cerca del inicio -- el mismo glitch de palabra partida a
// mitad de un answer largo, en una linea posterior, pasaba sin deteccion.
test("rechaza un answer con palabra partida a mitad de texto, no solo al inicio", () => {
  assertRejected(
    {
      answer:
        "El diagnostico esta listo. Hay tres alertas activas de stock bajo.\nContinua man\nana con la revision del margen por producto, que sigue sin cerrarse.",
    },
    "answer_con_texto_partido",
  );
});

test("no confunde varios parrafos legitimos (todos con punto de cierre) con texto partido", () => {
  assertOk({
    answer:
      "Primer hallazgo: el stock de FUSION esta roto.\nSegundo hallazgo: el margen de PADEL bajo del 20%.\nTercer hallazgo: sin alertas nuevas esta semana.",
  });
});

test("no confunde una lista con guiones (mayuscula tras salto) con texto partido", () => {
  assertOk({
    answer:
      "Hallazgos de la semana\n- Stock roto en FUSION\n- Margen bajo en PADEL",
  });
});

test("ignora campos que no son string/array (no revienta con tipos inesperados)", () => {
  assertOk({ answer: "ok", confidence: "high", warnings: ["x"], findings: [] });
});

/**
 * AI-00/AI-06 (R-011): el presupuesto se registraba pero no se aplicaba.
 * `evaluateAgentBudget` es la decision pura que ahora corta un turno; se
 * prueba aislada de la API de Anthropic (runAgentTurn solo la invoca).
 */

test("sin budget declarado, nunca corta el turno", () => {
  const verdict = evaluateAgentBudget(undefined, 999, 999);
  assert.equal(verdict.exceeded, false);
});

test("corta el turno cuando el coste estimado supera maxCostUsd", () => {
  const verdict = evaluateAgentBudget({ maxCostUsd: 1 }, 1.01, 0);
  assert.equal(verdict.exceeded, true);
  if (verdict.exceeded) {
    assert.match(verdict.message, /cost \$1\.0100 > max \$1/);
  }
});

test("no corta el turno cuando el coste esta justo en el limite (estricto: solo > corta)", () => {
  const verdict = evaluateAgentBudget({ maxCostUsd: 1 }, 1, 0);
  assert.equal(verdict.exceeded, false);
});

test("corta el turno cuando las tool calls superan maxToolCalls", () => {
  const verdict = evaluateAgentBudget({ maxToolCalls: 10 }, 0, 11);
  assert.equal(verdict.exceeded, true);
  if (verdict.exceeded) {
    assert.match(verdict.message, /11 tool calls > max 10/);
  }
});

test("el limite de coste corta incluso con pocas tool calls (glitch de exploracion cara, ver A02)", () => {
  const verdict = evaluateAgentBudget(
    { maxCostUsd: 0.5, maxToolCalls: 20 },
    0.6,
    2,
  );
  assert.equal(verdict.exceeded, true);
  if (verdict.exceeded) {
    assert.match(verdict.message, /cost/);
  }
});

test("estimateCostUsd calcula coste real por modelo conocido", () => {
  // claude-opus-4-8: $5/1M input, $25/1M output (packages/ai/src/index.ts MODEL_PRICING)
  const cost = estimateCostUsd("claude-opus-4-8", 1_000_000, 1_000_000);
  assert.equal(cost, 30);
});

test("estimateCostUsd devuelve 0 para un modelo desconocido en vez de reventar", () => {
  const cost = estimateCostUsd("modelo-inexistente", 1_000_000, 1_000_000);
  assert.equal(cost, 0);
});

test("el contrato de email Klaviyo exige aprobación y estructura reutilizable", () => {
  const result = klaviyoEmailOutputSchema.safeParse({
    summary: "Email de bienvenida",
    template_name: "welcome-v1",
    subject: "Bienvenido {{ first_name }}",
    preheader: "Una selección para empezar",
    from_name: "EcomScaling",
    reply_to: null,
    purpose: "welcome",
    audience: "new_customers",
    locale: "es-ES",
    tone: "clear",
    plain_text: "Hola",
    html: "<p>Hola</p>",
    blocks: [{ type: "text", content: "Hola", href: null, alt: null }],
    personalization_tokens: ["first_name"],
    compliance_notes: [],
    sources: [],
    confidence: "high",
    warnings: [],
    approval_required: true,
  });

  assert.equal(result.success, true);
});

test("sanitizeGeneratedEmailHtml elimina vectores activos del HTML generado", () => {
  const safe = sanitizeGeneratedEmailHtml(
    '<img src="javascript:alert(1)" onerror="alert(2)"><script>alert(3)</script><p>ok</p>',
  );
  assert.equal(safe.includes("script"), false);
  assert.equal(safe.includes("onerror"), false);
  assert.equal(safe.includes("javascript:"), false);
  assert.match(safe, /ok/);
});

test("el Tool Layer bloquea tools futuras que aún no tienen executor operativo", () => {
  const result = authorizeTool(
    "klaviyo_send_campaign",
    {
      organization_id: "00000000-0000-0000-0000-000000000001",
      actor_user_id: "00000000-0000-0000-0000-000000000002",
      allowed_tools: ["klaviyo_send_campaign"],
      approval_mode: "required_before_publish",
      connected_connectors: ["core"],
    },
    "write",
  );

  assert.equal(result.allowed, false);
  if (!result.allowed)
    assert.equal(result.reason.error, "tool_not_implemented");
  assert.equal(
    TOOL_REGISTRY.some((tool) => tool.name === "klaviyo_send_campaign"),
    true,
  );
});

test("el Tool Layer permite únicamente las tools parciales declaradas y autorizadas", () => {
  const result = authorizeTool("sql_select", {
    organization_id: "00000000-0000-0000-0000-000000000001",
    actor_user_id: "00000000-0000-0000-0000-000000000002",
    allowed_tools: ["sql_select"],
    approval_mode: "none",
    connected_connectors: ["core"],
  });

  assert.equal(result.allowed, true);
});

test("data_coverage forma parte del núcleo activo de lectura", () => {
  const tool = TOOL_REGISTRY.find(
    (candidate) => candidate.name === "data_coverage",
  );
  assert.equal(tool?.permission, "read");
  assert.equal(tool?.status, "implemented_partial");
});

test("las tools de contexto de dominio tienen contrato y permanecen en solo lectura", () => {
  const names = [
    "get_organization_profile",
    "get_strategic_plan",
    "list_open_tasks",
    "list_open_alerts",
    "get_call_history",
    "get_financial_settings",
  ];

  for (const name of names) {
    const tool = TOOL_REGISTRY.find((candidate) => candidate.name === name);
    const contract = getToolContract(name);
    assert.equal(tool?.permission, "read");
    assert.equal(tool?.status, "implemented_partial");
    assert.equal(contract?.inputSchema.safeParse({}).success, true);
    assert.equal(
      contract?.inputSchema.safeParse({ unexpected: true }).success,
      false,
    );
  }
});

test("las tools de listas exigen paginacion explicita y nunca cortan en silencio", () => {
  const contract = getToolContract("list_open_tasks");
  assert.equal(
    contract?.inputSchema.safeParse({ limit: 25, cursor: "offset:25" }).success,
    true,
  );
  assert.equal(contract?.inputSchema.safeParse({ limit: 101 }).success, false);
  assert.equal(
    contract?.inputSchema.safeParse({ cursor: "opaque-cursor" }).success,
    false,
  );
  assert.equal(
    contract?.outputSchema.safeParse({
      rows: [],
      truncated: true,
      next_cursor: "offset:25",
      total_count: null,
      provenance: {
        source: "list_open_tasks",
        as_of: "2026-08-02T10:00:00.000Z",
        freshness_seconds: 0,
      },
    }).success,
    true,
  );
});

test("describe_schema expone únicamente el contrato de lectura documentado", () => {
  const schema = getToolContract("describe_schema");
  assert.equal(schema?.inputSchema.safeParse({}).success, true);
  assert.equal(
    schema?.inputSchema.safeParse({ tables: ["shopify_order_facts"] }).success,
    true,
  );
  assert.equal(
    schema?.inputSchema.safeParse({ tables: ["x"], extra: true }).success,
    false,
  );
});

test("dry_run_write nunca permite una escritura implícita", () => {
  const dryRun = getToolContract("dry_run_write");
  assert.equal(dryRun?.definition.status, "implemented_partial");
  assert.equal(
    dryRun?.inputSchema.safeParse({
      operation: "update_product",
      target: "product:123",
      changes: { title: "Nuevo título" },
      reason: "Propuesta de mejora de catálogo",
    }).success,
    true,
  );
  assert.equal(
    dryRun?.outputSchema.safeParse({
      dry_run: true,
      changed: false,
      operation: "update_product",
      target: "product:123",
      changes: { title: "Nuevo título" },
      approval_required: true,
      rollback_token: null,
      provenance: {
        source: "ecomscaling_tool_layer",
        as_of: "2026-08-02T10:00:00.000Z",
        freshness_seconds: 0,
      },
    }).success,
    true,
  );
});

test("las tools de contexto de cliente devuelven datos con provenance", () => {
  const profile = getToolContract("get_organization_profile");
  assert.equal(profile?.inputSchema.safeParse({}).success, true);
  assert.equal(
    profile?.outputSchema.safeParse({
      data: { id: "org-1", display_name: "Demo" },
      provenance: {
        source: "get_organization_profile",
        as_of: "2026-08-02T10:00:00.000Z",
        freshness_seconds: 0,
      },
    }).success,
    true,
  );
});

test("cada tool activa tiene contrato Zod de entrada y valida argumentos", () => {
  const sql = getToolContract("sql_select");
  const coverage = getToolContract("data_coverage");
  assert.equal(sql?.inputSchema.safeParse({ query: "select 1" }).success, true);
  assert.equal(sql?.inputSchema.safeParse({ query: "" }).success, false);
  assert.equal(
    sql?.outputSchema.safeParse({
      rows: [],
      row_limit: 200,
      truncated: false,
      next_cursor: null,
      total_count: null,
      tables_used: ["shopify_order_facts"],
      provenance: {
        source: "sql_gateway",
        as_of: "2026-08-02T10:00:00.000Z",
        freshness_seconds: 0,
      },
    }).success,
    true,
  );
  assert.equal(
    coverage?.inputSchema.safeParse({ unexpected: true }).success,
    false,
  );
});

test("las tools de abstencion y calidad rechazan payloads incompletos y no requieren conectores", () => {
  const request = getToolContract("request_missing_data");
  const escalation = getToolContract("escalate_to_human");
  const quality = getToolContract("flag_data_quality_issue");
  const confidence = getToolContract("report_confidence");

  assert.equal(
    request?.inputSchema.safeParse({
      provider: "klaviyo",
      missing: ["api_key", "scopes"],
      reason: "No hay conexión real",
    }).success,
    true,
  );
  assert.equal(
    escalation?.inputSchema.safeParse({
      reason: "Falta atribución",
      risk: "high",
      blocking_questions: ["¿Qué ventana usar?"],
    }).success,
    true,
  );
  assert.equal(
    quality?.inputSchema.safeParse({
      issue: "La fecha de sync es anterior al periodo",
      datasets: ["shopify_order_facts"],
      severity: "medium",
    }).success,
    true,
  );
  assert.equal(
    confidence?.inputSchema.safeParse({
      confidence: "low",
      rationale: "Meta no está conectado",
      evidence_gaps: ["spend", "attribution"],
    }).success,
    true,
  );
  for (const name of [
    "request_missing_data",
    "escalate_to_human",
    "flag_data_quality_issue",
    "report_confidence",
  ]) {
    const definition = TOOL_REGISTRY.find((tool) => tool.name === name);
    assert.equal(definition?.status, "implemented_partial");
    assert.equal(definition?.connector, "core");
  }
});

test("los contratos transversales exigen provenance y seguridad de escrituras", () => {
  assert.equal(
    provenanceSchema.safeParse({
      source: "shopify.orders",
      as_of: "2026-08-02T10:00:00.000Z",
      freshness_seconds: 60,
    }).success,
    true,
  );
  assert.equal(
    toolWriteRequestSchema.safeParse({
      idempotency_key: "order-update-2026-08-02-001",
      dry_run: true,
    }).success,
    true,
  );
  assert.equal(
    toolWriteRequestSchema.safeParse({
      idempotency_key: "short",
      dry_run: false,
    }).success,
    false,
  );
});

test("el replay de tools conserva orden, valida inputs y no necesita proveedor externo", () => {
  const fixture = createToolReplayFixture([
    {
      tool_name: "search_knowledge",
      input: { query: "AOV", filters: { channel: "shopify" } },
      output: { matches: [{ title: "Playbook AOV" }] },
      is_error: false,
      created_at: "2026-08-02T10:00:02.000Z",
    },
    {
      tool_name: "data_coverage",
      input: {},
      output: { rows: [], truncated: false, next_cursor: null },
      is_error: false,
      created_at: "2026-08-02T10:00:01.000Z",
    },
  ]);
  const replay = createReplayToolExecutor(fixture);

  assert.deepEqual(replay.execute("data_coverage", {}), {
    rows: [],
    truncated: false,
    next_cursor: null,
  });
  assert.deepEqual(
    replay.execute("search_knowledge", {
      filters: { channel: "shopify" },
      query: "AOV",
    }),
    { matches: [{ title: "Playbook AOV" }] },
  );
  replay.assertComplete();
  assert.equal(replay.cursor, 2);
});

test("el replay rechaza una tool o input distinto y una secuencia incompleta", () => {
  const replay = createReplayToolExecutor(
    createToolReplayFixture([
      {
        tool_name: "sql_select",
        input: { query: "select 1" },
        output: { rows: [] },
        is_error: false,
        created_at: null,
      },
    ]),
  );

  assert.throws(
    () => replay.execute("search_knowledge", { query: "select 1" }),
    /replay_mismatch/,
  );
  assert.throws(() => replay.assertComplete(), /replay_incomplete/);
});

test("el replay degrada timestamps históricos inválidos sin romper la traza", () => {
  const fixture = createToolReplayFixture([
    {
      tool_name: "data_coverage",
      input: {},
      output: { rows: [] },
      is_error: false,
      created_at: "2026-08-02 10:00:00",
    },
    {
      tool_name: "search_knowledge",
      input: {},
      output: { matches: [] },
      is_error: false,
      created_at: "not-a-date",
    },
  ]);

  assert.equal(fixture.calls[0]?.created_at, "2026-08-02T10:00:00.000Z");
  assert.equal(fixture.calls[1]?.created_at, null);
});

test("el patch de draft Klaviyo solo permite campos editables y exige uno", () => {
  assert.equal(
    klaviyoEmailDraftPatchSchema.safeParse({ subject: "Nuevo asunto" }).success,
    true,
  );
  assert.equal(
    klaviyoEmailDraftPatchSchema.safeParse({ confidence: "high" }).success,
    false,
  );
  assert.equal(klaviyoEmailDraftPatchSchema.safeParse({}).success, false);
});
