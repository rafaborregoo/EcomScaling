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
  buildAgentSystemPrompt,
  renderAgentPromptSections,
  estimateCostUsd,
  costBasisFor,
  getModelCapabilities,
  evaluateAgentBudget,
  klaviyoEmailDraftPatchSchema,
  klaviyoEmailOutputSchema,
  metaAdsDraftPatchSchema,
  metaAdsOutputSchema,
  instagramPostOutputSchema,
  instagramImageAnalysisSchema,
  instagramImageAnalysisToMarkdown,
  instagramOverlayDraftSchema,
  sanitizeGeneratedEmailHtml,
  createReplayToolExecutor,
  createToolReplayFixture,
  TOOL_REGISTRY,
  authorizeTool,
  getToolContract,
  getUnavailableToolNames,
  normalizeToolConnectorId,
  provenanceSchema,
  toolWriteRequestSchema,
  VoyageEmbeddingProvider,
  RAG_EMBEDDING_PROFILE,
  chunkText,
  agentProposedWriteSchema,
  agentOutputJsonSchema,
  chatOutputSchema,
  chatJsonSchema,
} from "./index.js";

test("el perfil RAG centraliza el contrato de embeddings y chunking", () => {
  assert.deepEqual(RAG_EMBEDDING_PROFILE, {
    version: "structural-v4",
    model: "voyage-context-4",
    dimensions: 1024,
    maxChars: 1500,
    overlapChars: 200,
  });
});

test("A09 devuelve acciones de UI con destino semantico, no URLs libres", () => {
  const parsed = chatOutputSchema.parse({
    answer: "Hay evidencia pendiente.",
    sources: [],
    confidence: "low",
    warnings: ["Falta atribucion"],
    ui_actions: [
      {
        kind: "open_insight",
        insight_slug: "continuous-learning",
        label: "Revisar datos faltantes",
        reason: "La evidencia del aprendizaje aun no supera el gate.",
      },
    ],
  });

  assert.equal(parsed.ui_actions?.[0]?.insight_slug, "continuous-learning");
  assert.deepEqual(
    (chatJsonSchema.properties.ui_actions as { items: { properties: { kind: { enum: readonly string[] } } } }).items.properties.kind.enum,
    ["open_insight"],
  );
});

test("chunking conserva contexto de secciones y estructura de tablas", () => {
  const chunks = chunkText(
    "# Playbook ROAS\n\n| Canal | ROAS | Acción |\n| --- | --- | --- |\n| Meta | 2.1 | Revisar |\n| Google | 3.4 | Mantener |\n\nLa decisión debe aprobarla un consultor.",
    { maxChars: 70, overlapChars: 10 },
  );

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.includes("# Playbook ROAS")));
  assert.ok(
    chunks.some((chunk) => chunk.includes("| Canal | ROAS | Acción |")),
  );
  assert.ok(chunks.some((chunk) => chunk.includes("La decisión")));
});

test("el encabezado arrastrado no se repite dos veces en el mismo fragmento", () => {
  const chunks = chunkText(
    "# 1. Modelo de Negocio\n\n## 1.1 Qué es\n\nEl modelo de negocio describe cómo se gana dinero.\n\nY cómo se sostiene en el tiempo.",
  );

  assert.ok(chunks.length > 0);
  for (const chunk of chunks) {
    const veces = chunk.split("## 1.1 Qué es").length - 1;
    assert.ok(veces <= 1, `encabezado repetido ${veces} veces en:\n${chunk}`);
  }
  // Sigue llegando a los bloques que lo necesitan para no perder contexto.
  assert.ok(chunks.some((chunk) => chunk.includes("## 1.1 Qué es")));
});

test("la politica comun de prompts fuerza evidencia, abstencion y aprobacion", () => {
  const prompt = buildAgentSystemPrompt("Analiza el rendimiento del negocio.");

  assert.match(prompt, /contexto verificado/i);
  assert.match(prompt, /abstente de inventar/i);
  assert.match(prompt, /evidencia concreta/i);
  assert.match(prompt, /aprobacion humana/i);
  assert.match(prompt, /Analiza el rendimiento del negocio/);
});

test("rechaza prompts especificos vacios", () => {
  assert.throws(
    () => buildAgentSystemPrompt("  "),
    /agent_system_prompt_required/,
  );
});

test("Voyage embeddings usan timeout, retries y abort signal comunes", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let receivedSignal = false;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    receivedSignal = init?.signal instanceof AbortSignal;
    if (calls < 3) return new Response("busy", { status: 503 });
    return new Response(
      JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2] }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const provider = new VoyageEmbeddingProvider("test-key", "test-model", {
      timeoutMs: 100,
      maxRetries: 2,
      baseBackoffMs: 0,
      maxBackoffMs: 1,
      jitterRatio: 0,
    });
    assert.deepEqual(await provider.embed(["texto"], "document"), [[0.1, 0.2]]);
    assert.equal(calls, 3);
    assert.equal(receivedSignal, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("renderiza el contrato canonico de nueve secciones", () => {
  const prompt = renderAgentPromptSections({
    role: "Analista de negocio.",
    goal: "Detectar riesgos.",
    context: "Datos de Shopify verificados.",
    input: "Periodo y tienda.",
    rules: "No inventar cifras.",
    tools: "Usar metricas cuando falte evidencia.",
    output: "JSON con hallazgos y fuentes.",
    failure_behaviour: "Abstenerse y explicar el gap.",
    examples: "Bueno: cita una métrica.",
  });

  assert.match(prompt, /1\. ROLE/);
  assert.match(prompt, /2\. GOAL/);
  assert.match(prompt, /8\. FAILURE BEHAVIOUR/);
  assert.match(prompt, /9\. EXAMPLES/);
  assert.match(
    buildAgentSystemPrompt({
      role: "Analista.",
      goal: "Analizar.",
      context: "Contexto.",
      input: "Entrada.",
      rules: "Reglas.",
      tools: "Tools.",
      output: "Salida.",
      failure_behaviour: "Abstenerse.",
    }),
    /PROMPT ESPECIFICO DEL AGENTE/,
  );
});

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

test("rechaza hallazgos sin evidencia auditable", () => {
  assertRejected(
    {
      answer: "Hay un hallazgo.",
      findings: [{ title: "Stock bajo", evidence: " " }],
    },
    "findings_con_evidencia_vacia",
  );
});

test("rechaza recomendaciones sin acción o impacto esperado", () => {
  assertRejected(
    {
      answer: "Recomendación.",
      recommendations: [{ action: " ", expected_impact: "Mejorar" }],
    },
    "recommendations_con_accion_vacia",
  );
  assertRejected(
    {
      answer: "Recomendación.",
      recommendations: [{ action: "Revisar stock", expected_impact: "" }],
    },
    "recommendations_con_impacto_vacio",
  );
});

test("rechaza fuentes sin referencia", () => {
  assertRejected(
    { answer: "Resultado.", sources: [{ reference: "", period: null }] },
    "sources_con_referencia_vacia",
  );
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
  // claude-opus-4-8: $5/1M input, $25/1M output
  // (packages/ai/src/provider-capabilities.ts MODEL_PRICING)
  const cost = estimateCostUsd("claude-opus-4-8", 1_000_000, 1_000_000);
  assert.equal(cost, 30);
  assert.equal(costBasisFor("claude-opus-4-8"), "priced");
});

// AI-30: este test afirmaba lo contrario (que un modelo desconocido costaba 0)
// y esa era precisamente la regresion silenciosa: con coste 0 los topes de
// presupuesto dejan de morder y el panel de costes factura de menos sin avisar.
// `null` obliga a quien llame a decidir que hace con el desconocimiento.
test("estimateCostUsd devuelve null para un modelo sin precio conocido, no 0", () => {
  const cost = estimateCostUsd("modelo-inexistente", 1_000_000, 1_000_000);
  assert.equal(cost, null);
  assert.equal(costBasisFor("modelo-inexistente"), "unknown_model");
});

test("las capacidades de un modelo desconocido son unknown, nunca false", () => {
  const caps = getModelCapabilities("modelo-inexistente", "anthropic");
  assert.equal(caps.reportsCacheReadTokens, "unknown");
  assert.equal(caps.reportsReasoningTokens, "unknown");
  assert.equal(caps.contextWindowMax, null);
});

test("cuantizacion y KV cache se declaran provider_managed, no controlados", () => {
  for (const model of ["claude-sonnet-5", "gpt-4.1"]) {
    const caps = getModelCapabilities(model, "anthropic");
    assert.equal(caps.quantizationControl, "provider_managed");
    assert.equal(caps.kvCacheControl, "provider_managed");
  }
});

test("prompt caching y KV cache son capacidades distintas", () => {
  // Anthropic: controlamos el prompt caching (cache_control) pero no el KV cache.
  const anthropic = getModelCapabilities("claude-sonnet-5", "anthropic");
  assert.equal(anthropic.promptCachingControl, "supported");
  assert.equal(anthropic.kvCacheControl, "provider_managed");
  // OpenAI: el prompt caching tambien lo gestiona el proveedor (es automatico),
  // pero si reporta lo leido de cache.
  const openai = getModelCapabilities("gpt-4.1", "openai");
  assert.equal(openai.promptCachingControl, "provider_managed");
  assert.equal(openai.reportsCacheReadTokens, "supported");
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

test("el contrato Meta Ads no reutiliza campos de email y exige aprobacion", () => {
  const result = metaAdsOutputSchema.safeParse({
    summary: "Campana de lanzamiento",
    campaign_name: "Lanzamiento verano",
    ad_set_name: "Clientes interesados",
    headline: "Descubre la nueva coleccion",
    primary_text: "Una seleccion pensada para este verano.",
    description: "Disponible online",
    call_to_action: "Comprar",
    destination_url: "https://example.com/coleccion",
    audience: "Clientes nuevos en Espana",
    locale: "es-ES",
    tone: "cercano",
    creative_notes: [],
    compliance_notes: [],
    sources: [],
    confidence: "high",
    warnings: [],
    approval_required: true,
  });

  assert.equal(result.success, true);
});

test("el contrato Instagram orgánico exige caption, hashtags, formato y aprobación", () => {
  const base = {
    summary: "Post de lanzamiento",
    title: "Lanzamiento colección verano",
    caption: "Ya está aquí la colección de verano. Descúbrela en la tienda.",
    hashtags: ["verano", "moda"],
    call_to_action: "Link en bio",
    format: "reel" as const,
    creative_brief: "Reel de 15s mostrando 3 prendas sobre fondo claro.",
    audience: "Seguidores en España",
    locale: "es-ES",
    tone: "cercano",
    compliance_notes: [],
    sources: [],
    confidence: "medium" as const,
    warnings: [],
    approval_required: true as const,
  };
  assert.equal(instagramPostOutputSchema.safeParse(base).success, true);
  assert.equal(
    instagramPostOutputSchema.safeParse({ ...base, format: "billboard" })
      .success,
    false,
  );
  assert.equal(
    instagramPostOutputSchema.safeParse({ ...base, approval_required: false })
      .success,
    false,
  );
});

test("la extracción de imagen de Instagram valida hex y arma el markdown de contexto", () => {
  const base = {
    description: "Bodegón de una vela sobre mármol con luz lateral.",
    objects: ["vela", "cerilla", "superficie de mármol"],
    colors: [
      { label: "blanco roto", hex: "#f4f1ec" },
      { label: "ámbar", hex: "#c8862f" },
    ],
    style: "producto editorial, luz natural dura",
    ocr_text: "",
    suggested_use: "Portada de carrusel de lanzamiento.",
    alt_text: "Vela encendida sobre una superficie de mármol claro.",
    confidence: "high" as const,
  };
  assert.equal(instagramImageAnalysisSchema.safeParse(base).success, true);
  assert.equal(
    instagramImageAnalysisSchema.safeParse({
      ...base,
      colors: [{ label: "rojo", hex: "rojo" }],
    }).success,
    false,
  );

  const md = instagramImageAnalysisToMarkdown(
    instagramImageAnalysisSchema.parse(base),
    { filename: "vela.jpg", url: "https://cdn.example.com/vela.jpg" },
  );
  assert.match(md, /# Imagen: vela\.jpg/);
  assert.match(md, /blanco roto \(#f4f1ec\)/);
  assert.match(md, /\*\*Texto en la imagen:\*\* —/);
});

test("el borrador de texto sobre imagen exige bloques, paleta con hex y colocación gruesa", () => {
  const ok = {
    blocks: [
      {
        text: "NUEVA COLECCIÓN",
        role: "headline" as const,
        placement: "center" as const,
        align: "center" as const,
        emphasis: "strong" as const,
      },
      {
        text: "Link en bio",
        role: "cta" as const,
        placement: "bottom" as const,
        align: "center" as const,
        emphasis: "normal" as const,
      },
    ],
    palette: { text_hex: "#ffffff", accent_hex: "#1d4ed8" },
    rationale: "Titular centrado sobre la zona despejada, CTA abajo.",
  };
  assert.equal(instagramOverlayDraftSchema.safeParse(ok).success, true);
  assert.equal(
    instagramOverlayDraftSchema.safeParse({ ...ok, blocks: [] }).success,
    false,
  );
  assert.equal(
    instagramOverlayDraftSchema.safeParse({
      ...ok,
      palette: { text_hex: "white", accent_hex: "#1d4ed8" },
    }).success,
    false,
  );
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

test("identifica las tools futuras sin convertirlas en capacidades ejecutables", () => {
  assert.deepEqual(
    getUnavailableToolNames([
      "meta_read_ad_accounts",
      "sql_select",
      "instagram_schedule_post",
      "tool_inexistente",
    ]),
    ["instagram_schedule_post"],
  );
  assert.deepEqual(getUnavailableToolNames(null), []);
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

test("normaliza aliases persistidos de conectores antes de autorizar tools", () => {
  assert.equal(normalizeToolConnectorId("meta_ads"), "meta");
  assert.equal(normalizeToolConnectorId("klaviyo"), "klaviyo");
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
      estimated_cost: 42.5,
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

test("el patch de draft Meta mantiene separados los campos de email", () => {
  assert.equal(
    metaAdsDraftPatchSchema.safeParse({
      headline: "Nuevo titular",
      destination_url: "https://example.com/coleccion",
    }).success,
    true,
  );
  assert.equal(
    metaAdsDraftPatchSchema.safeParse({ subject: "No es un campo Meta" })
      .success,
    false,
  );
  assert.equal(metaAdsDraftPatchSchema.safeParse({}).success, false);
});

test("el presupuesto del runtime no depende de Meta ni de otro conector", () => {
  const definition = TOOL_REGISTRY.find(
    (candidate) => candidate.name === "get_budget_status",
  );
  assert.equal(definition?.connector, "core");

  const result = authorizeTool("get_budget_status", {
    organization_id: "00000000-0000-0000-0000-000000000001",
    actor_user_id: "00000000-0000-0000-0000-000000000002",
    allowed_tools: ["get_budget_status"],
    approval_mode: "none",
    connected_connectors: ["core", "shopify"],
  });

  assert.equal(result.allowed, true);
});

// AI-30: esta comprobacion existia y estaba probada, pero NO corria en
// produccion -- `buildAgentTools` filtraba las tools a mano y solo replicaba
// dos de las seis reglas de `authorizeTool`, dejandose justo esta. Ahora la
// ruta de produccion llama a `authorizeTool`, asi que el test cubre lo que de
// verdad pasa.
test("una tool que exige aprobacion no se declara con approval_mode 'none'", () => {
  // Tiene que ser una tool IMPLEMENTADA: el motor comprueba el estado antes que
  // la aprobacion, asi que una `planned` fallaria por otro motivo y el test no
  // estaria probando lo que dice. Hoy son cuatro: dry_run_write,
  // escalate_to_human, request_missing_data y flag_data_quality_issue.
  const needsApproval = TOOL_REGISTRY.find(
    (candidate) =>
      candidate.requires_approval &&
      candidate.status === "implemented_partial" &&
      (candidate.connector === "core" || candidate.connector === null),
  );
  assert.ok(
    needsApproval,
    "deberia haber una tool implementada que exija aprobacion",
  );

  const base = {
    organization_id: "00000000-0000-0000-0000-000000000001",
    actor_user_id: "00000000-0000-0000-0000-000000000002",
    allowed_tools: [needsApproval.name],
    connected_connectors: ["core", "shopify", "meta", "klaviyo", "instagram"],
  } satisfies Omit<Parameters<typeof authorizeTool>[1], "approval_mode">;

  const denied = authorizeTool(needsApproval.name, {
    ...base,
    approval_mode: "none",
  });
  assert.equal(denied.allowed, false);
  if (!denied.allowed) {
    assert.equal(denied.reason.error, "approval_required");
  }

  // Con un modo de aprobacion real la misma tool pasa: la regla es sobre la
  // aprobacion, no un veto general sobre la tool.
  const withApproval = authorizeTool(needsApproval.name, {
    ...base,
    approval_mode: "required_before_write",
  });
  assert.equal(withApproval.allowed, true);
});

// AI-30: `buildAgentTools` autoriza dos veces -- al declarar la tool con
// permiso `read`, y al invocarla con el permiso que su registro declara. Ese
// segundo paso solo es seguro si nunca deniega lo que el primero concedio: si
// lo hiciera, el modelo recibiria un catalogo de tools que revientan al
// llamarlas. Este test lo fija sobre el registro real, no sobre un caso.
test("autorizar con el permiso declarado no deniega lo que se declaro como lectura", () => {
  const base = {
    organization_id: "00000000-0000-0000-0000-000000000001",
    actor_user_id: "00000000-0000-0000-0000-000000000002",
    approval_mode: "required_before_write",
    connected_connectors: ["core", "shopify", "meta", "klaviyo", "instagram"],
  } satisfies Omit<Parameters<typeof authorizeTool>[1], "allowed_tools">;

  for (const definition of TOOL_REGISTRY) {
    const context = { ...base, allowed_tools: [definition.name] };
    if (!authorizeTool(definition.name, context, "read").allowed) continue;

    const atInvocation = authorizeTool(
      definition.name,
      context,
      definition.permission,
    );
    assert.equal(
      atInvocation.allowed,
      true,
      `${definition.name} se declara pero se denegaria al invocarla: ${
        atInvocation.allowed ? "" : atInvocation.reason.error
      }`,
    );
  }
});

test("una tool que no esta en el registro nunca se autoriza", () => {
  const result = authorizeTool("tool_inventada", {
    organization_id: "00000000-0000-0000-0000-000000000001",
    actor_user_id: "00000000-0000-0000-0000-000000000002",
    allowed_tools: ["tool_inventada"],
    approval_mode: "required_before_write",
    connected_connectors: ["core"],
  });

  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.reason.error, "tool_not_registered");
  }
});

// El consultor decide sobre la cifra, no sobre la prosa del agente: una tarea
// propuesta viaja con su porque y con los datos que lo sostienen.
test("agentProposedWriteSchema acepta rationale y evidence", () => {
  const parsed = agentProposedWriteSchema.parse({
    kind: "task",
    title: "Auditar descuentos",
    description: "Revisar la politica de descuentos.",
    priority: "urgent",
    rationale: "El ratio de descuento lleva 30 dias por encima del 50%.",
    evidence: [
      {
        label: "ratio de descuento sobre venta bruta",
        value: "50,6%",
        period: "03/08-02/09/2026",
        source: "shopify",
      },
    ],
  });

  assert.equal(parsed.rationale.startsWith("El ratio"), true);
  assert.equal(parsed.evidence.length, 1);
  assert.equal(parsed.evidence[0]?.source, "shopify");
});

// Las salidas ya guardadas (y cualquier ruta sin structured outputs) no traen
// los campos nuevos: no deben quedar invalidas por ello.
test("agentProposedWriteSchema tolera salidas antiguas sin rationale ni evidence", () => {
  const parsed = agentProposedWriteSchema.parse({
    kind: "task",
    title: "Subir costes",
    description: "Cargar 52 items.",
    priority: "high",
  });

  assert.equal(parsed.rationale, "");
  assert.deepEqual(parsed.evidence, []);
});

// El JSON Schema es lo que fuerza el formato en la llamada al modelo: si
// rationale/evidence salen de `required`, los agentes dejan de producirlos y
// las tarjetas de /tareas se quedan sin el porque sin que falle ningun test.
test("el JSON Schema exige rationale y evidence en cada proposed_write", () => {
  const write = (
    agentOutputJsonSchema.properties.proposed_writes as {
      items: { required: readonly string[] };
    }
  ).items;

  assert.equal(write.required.includes("rationale"), true);
  assert.equal(write.required.includes("evidence"), true);
});
