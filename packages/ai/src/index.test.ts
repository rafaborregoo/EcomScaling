/**
 * AI-06: tests de la guarda de calidad estructural (checkOutputSanity).
 * Puros, sin I/O: reproducen los dos glitches reales observados en
 * produccion (answer vacio en A06, texto corrupto repetido en A02) para que
 * no puedan volver a colarse como pending_approval sin que nadie se de cuenta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  checkOutputSanity,
  buildAgentSystemPrompt,
  buildA23CreativeOutputContract,
  buildMetricAnalystOutputContract,
  renderAgentPromptSections,
  estimateCostUsd,
  getPricingVersion,
  PRICING_VERSION,
  setLiveModelPricing,
  costBasisFor,
  getModelCapabilities,
  evaluateAgentBudget,
  klaviyoEmailDraftPatchSchema,
  klaviyoEmailOutputSchema,
  klaviyoEmailGenerationOutputSchema,
  metaAdsDraftPatchSchema,
  metaAdsOutputSchema,
  instagramPostOutputSchema,
  instagramImageAnalysisSchema,
  instagramImageAnalysisToMarkdown,
  instagramOverlayDraftSchema,
  sanitizeGeneratedEmailHtml,
  normalizeGeneratedEmailLinks,
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
  caminoPlanJsonSchema,
  campaignPlanJsonSchema,
  klaviyoEmailJsonSchema,
  metaAdsJsonSchema,
  instagramPostJsonSchema,
  instagramImageAnalysisJsonSchema,
  instagramOverlayDraftJsonSchema,
  callSummaryJsonSchema,
  callProposedTaskSchema,
  callSummaryOutputSchema,
  monitorOutputJsonSchema,
  monitorOutputSchema,
  weeklyMailingPlanJsonSchema,
  weeklyMailingPlanOutputSchema,
  validateAgentImageAttachments,
  agentInputSchema,
  platformAgentInputSchema,
  toAnthropicCompatibleOutputSchema,
  runAgentTurn,
} from "./index.js";

test("A29 fixes factual output from validated evidence and accepts only recommendations from the model", () => {
  const canonical = {
    answer: "ConversiÃ³n: conviene vigilarla.",
    findings: [{ title: "ConversiÃ³n: conviene vigilarla", severity: "medium", area: "conversion", evidence: "La tasa cae frente al periodo anterior.", figures: [{ label: "ConversiÃ³n", value: "2,00 %", previous: "3,00 %", change_pct: -33.3 }] }],
    recommendations: [], confidence: "medium", warnings: [], proposed_writes: [], approval_required: false,
    sources: [{ kind: "metric", reference: "conversion", period: "periodo probado" }],
  } as const;
  const contract = buildMetricAnalystOutputContract(canonical as any);
  const output = contract.schema.parse({ recommendations: [{ action: "Revisar el embudo de compra", priority: "medium", expected_impact: "Localizar el paso con mayor fricciÃ³n", owner: "cliente" }] });
  assert.equal(output.answer, canonical.answer);
  assert.equal(output.findings[0]?.figures?.[0]?.value, "2,00 %");
  assert.equal(output.recommendations[0]?.action, "Revisar el embudo de compra");
  assert.deepEqual(output.proposed_writes, []);
  assert.throws(() => contract.schema.parse({ answer: "La cifra va bien.", findings: [], recommendations: [] }));
  assert.throws(() => contract.schema.parse({ recommendations: [{ action: "Subir el presupuesto un 20%", priority: "medium", expected_impact: "Mejorar", owner: "cliente" }] }));
});

test("runAgentTurn sends Anthropic a compatible schema and parses with the original Zod contract", async () => {
  const requestCapture: { body?: Record<string, unknown> } = {};
  const response = {
    content: [{ type: "text", text: JSON.stringify({ answer: "ok", items: ["one"], impact: "low" }) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 2, output_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  };
  const client = {
    messages: {
      create: async (body: Record<string, unknown>) => {
        requestCapture.body = body;
        return response;
      },
    },
  } as never;

  const contract = {
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["answer", "items"],
      properties: {
        answer: { type: "string", maxLength: 20 },
        items: { type: "array", maxItems: 2, items: { type: "string" } },
        impact: { type: ["string", "null"], enum: ["low", "medium", "high", null] },
      },
    },
    schema: z.object({
      answer: z.string().max(20),
      items: z.array(z.string()).max(2),
      impact: z.enum(["low", "medium", "high"]).nullable(),
    }),
  };

  const result = await runAgentTurn({
    client,
    model: "claude-sonnet-4-5",
    systemPrompt: "Return the requested JSON.",
    input: {
      run_id: "00000000-0000-4000-8000-000000000001",
      agent_code: "test",
      agent_version: "1",
      organization_id: "00000000-0000-4000-8000-000000000002",
      actor_user_id: "00000000-0000-4000-8000-000000000003",
      trigger_type: "manual",
      objective: "schema compatibility",
      allowed_tools: [],
      approval_mode: "none",
    },
    contextBlocks: [],
    outputContract: contract,
  });

  assert.deepEqual(result.output, { answer: "ok", items: ["one"], impact: "low" });
  assert.ok(requestCapture.body);
  const outputConfig = requestCapture.body.output_config as { format: { schema: Record<string, unknown> } };
  const sentSchema = outputConfig.format.schema;
  const properties = sentSchema.properties as Record<string, { maxLength?: number; maxItems?: number; description?: string; type?: unknown; enum?: unknown[]; anyOf?: Array<Record<string, unknown>> }>;
  const answerProperty = properties.answer;
  const itemsProperty = properties.items;
  const impactProperty = properties.impact;
  assert.ok(answerProperty);
  assert.ok(itemsProperty);
  assert.ok(impactProperty);
  assert.equal(answerProperty.maxLength, undefined);
  assert.match(answerProperty.description ?? "", /at most 20 characters/);
  assert.equal(itemsProperty.maxItems, undefined);
  assert.match(itemsProperty.description ?? "", /no more than 2/);
  assert.equal(impactProperty.type, undefined);
  assert.equal(impactProperty.enum, undefined);
  assert.deepEqual(impactProperty.anyOf, [
    { type: "string", enum: ["low", "medium", "high"] },
    { type: "null" },
  ]);
  assert.equal(contract.jsonSchema.properties.answer.maxLength, 20);
  assert.equal(contract.jsonSchema.properties.items.maxItems, 2);
});

test("the real copilot schema keeps absent collections empty to fit Anthropic grammar compilation", () => {
  const schema = toAnthropicCompatibleOutputSchema(chatJsonSchema);
  assert.equal(Object.keys(chatJsonSchema.properties)[0], "answer", "the streaming extractor requires answer before other fields");
  const nullableCollections: string[] = [];
  const unionParameters: string[] = [];
  const visit = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.type) || Array.isArray(record.anyOf)) unionParameters.push(path);
    if (Array.isArray(record.type) && record.type.includes("array") && record.type.includes("null")) {
      nullableCollections.push(path);
    }
    for (const [key, value] of Object.entries(record)) visit(value, `${path}.${key}`);
  };
  visit(schema, "chat");
  assert.deepEqual(nullableCollections, [], "nullable collections multiply the provider's compiled grammar");
  assert.ok(unionParameters.length <= 5, `the chat plus tools must compile with at most five unions, found ${unionParameters.length}`);
  const parsed = chatOutputSchema.parse({
    answer: "Prueba correcta", sources: [], confidence: "low", warnings: [],
    summary: null, findings: [], recommendation: null, next_action: null,
    key_figures: [], ui_actions: [], proposed_writes: [],
  });
  assert.deepEqual(parsed.findings, []);
  assert.deepEqual(parsed.key_figures, []);
  assert.deepEqual(parsed.proposed_writes, []);
});

test("Anthropic output schema removes unsupported limits and keeps them as hints", () => {
  const original = {
    type: "object",
    properties: {
      findings: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            title: { type: "string", maxLength: 80 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      recommendations: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
    },
  };

  const compatible = toAnthropicCompatibleOutputSchema(original) as {
    properties: {
      findings: {
        minItems?: number;
        maxItems?: number;
        description?: string;
        items: { properties: { title: { maxLength?: number; description?: string }; confidence: { minimum?: number; maximum?: number; description?: string } } };
      };
      recommendations: { minItems?: number; maxItems?: number };
    };
  };

  assert.equal(compatible.properties.findings.maxItems, undefined);
  assert.equal(compatible.properties.findings.minItems, undefined);
  assert.match(compatible.properties.findings.description ?? "", /no more than 5/);
  assert.match(compatible.properties.findings.description ?? "", /at least 2/);
  assert.equal(compatible.properties.findings.items.properties.title.maxLength, undefined);
  assert.match(compatible.properties.findings.items.properties.title.description ?? "", /at most 80 characters/);
  assert.equal(compatible.properties.findings.items.properties.confidence.minimum, undefined);
  assert.equal(compatible.properties.findings.items.properties.confidence.maximum, undefined);
  assert.equal(compatible.properties.recommendations.maxItems, undefined);
  assert.equal(compatible.properties.recommendations.minItems, 1);
  assert.equal(original.properties.findings.maxItems, 5);
});

test("A23 output requires a structured evidence-backed decision and blocks pause on an unknown measurement gate", () => {
  const contract = buildA23CreativeOutputContract();
  const output = {
    answer: "El alcance observado no basta para atribuir compras.",
    findings: [],
    recommendations: [],
    sources: [],
    proposed_writes: [],
    approval_required: false,
    confidence: "low",
    warnings: [],
    creative_decisions: [{
      decision_ref: "a23-1",
      action: "observe",
      store_id: null,
      account_id: null,
      ad_id: null,
      creative_id: null,
      signal: "La fuente de compras no tiene estado de disponibilidad.",
      window: "2026-09-01 a 2026-09-28",
      spend_implicated: null,
      spend_currency: null,
      uncertainty: "No se puede confirmar si la lectura de compras tuvo éxito.",
      hypothesis: "Verificar primero la disponibilidad y frescura del informe.",
      success_criterion: "Contar con lectura disponible y una ventana comparable.",
      primary_metric: "compras observadas",
      metric_denominator: "impresiones de la misma ventana",
      comparator: "periodo anterior comparable",
      evaluation_window_days: 7,
      maturity_days: null,
      measurement_verdict: "unknown",
    }],
  } as const;

  assert.equal(contract.schema.safeParse(output).success, true);
  assert.equal(contract.schema.safeParse({
    ...output,
    creative_decisions: [{ ...output.creative_decisions[0], action: "propose_pause" }],
  }).success, false);
  assert.equal(contract.schema.safeParse({
    ...output,
    creative_decisions: [{ ...output.creative_decisions[0], measurement_verdict: "restricted" }],
  }).success, false);
  assert.equal(contract.schema.safeParse({
    ...output,
    creative_decisions: [{ ...output.creative_decisions[0], spend_implicated: 45 }],
  }).success, false);
  assert.equal(contract.schema.safeParse({
    ...output,
    creative_decisions: [{ ...output.creative_decisions[0], signal: undefined }],
  }).success, false);

  const jsonSchema = contract.jsonSchema as { required?: string[]; properties?: Record<string, unknown> };
  assert.equal(jsonSchema.required?.includes("creative_decisions"), true);
  assert.ok(jsonSchema.properties?.creative_decisions);
});

test("platform agent turn is explicitly tenantless and rejects organization IDs", () => {
  const platformInput = {
    run_id: "00000000-0000-4000-8000-000000000001",
    agent_code: "a27_internal_reference_visual",
    agent_version: "1",
    actor_user_id: "00000000-0000-4000-8000-000000000002",
    trigger_type: "manual" as const,
    objective: "Analyze a private mailing reference",
    allowed_tools: [],
    approval_mode: "none" as const,
    scope: "platform" as const,
  };
  assert.equal(platformAgentInputSchema.safeParse(platformInput).success, true);
  assert.equal(platformAgentInputSchema.safeParse({
    ...platformInput,
    organization_id: "00000000-0000-4000-8000-000000000003",
  }).success, false);
  assert.equal(agentInputSchema.safeParse(platformInput).success, false);
});

test("una propuesta de tarea conserva un milestone_id exacto para enlazar tras aprobación", () => {
  const write = {
    kind: "task" as const,
    title: "Completar la fase de margen",
    description: "Auditar costes y descuentos",
    priority: "high" as const,
    rationale: "El hito activo depende de esta revisión.",
    evidence: [],
    milestone_id: "00000000-0000-4000-8000-000000000123",
  };
  assert.equal(agentProposedWriteSchema.parse(write).milestone_id, write.milestone_id);
  assert.equal(agentProposedWriteSchema.safeParse({ ...write, milestone_id: "inventado" }).success, false);
  const proposedWriteJson = agentOutputJsonSchema.properties.proposed_writes.items;
  assert.deepEqual(proposedWriteJson.properties.milestone_id, { type: ["string", "null"], format: "uuid" });
});

test("una propuesta conserva el product ID exacto opcional para dedupe determinista de A06", () => {
  const write = {
    kind: "task" as const,
    title: "Revisar reposición de SKU X",
    description: "Comprobar con proveedor.",
    priority: "high" as const,
    rationale: "La cobertura es baja.",
    evidence: [],
    related_product_id: "00000000-0000-4000-8000-000000000111",
  };
  assert.equal(agentProposedWriteSchema.parse(write).related_product_id, write.related_product_id);
  assert.equal(agentProposedWriteSchema.safeParse({ ...write, related_product_id: "SKU-X" }).success, false);
  const jsonWrite = agentOutputJsonSchema.properties.proposed_writes.items;
  assert.deepEqual(jsonWrite.properties.related_product_id, { type: ["string", "null"], format: "uuid" });
});

test("A11 internal design playbook tool is read-only, bounded and has a strict input contract", () => {
  const definition = TOOL_REGISTRY.find((tool) => tool.name === "search_internal_email_design_playbook");
  const contract = getToolContract("search_internal_email_design_playbook");
  assert.ok(definition);
  assert.equal(definition.permission, "read");
  assert.equal(definition.connector, null);
  assert.equal(definition.status, "implemented_partial");
  assert.ok(contract);
  assert.equal(contract.inputSchema.safeParse({ objective: "launch" }).success, true);
  assert.equal(contract.inputSchema.safeParse({ objective: "x".repeat(501) }).success, false);
  assert.equal(contract.inputSchema.safeParse({ objective: "launch", unknown: true }).success, false);
  assert.equal(contract.outputSchema.safeParse({
    data: { status: "available", selected: [] },
    provenance: { source: "search_internal_email_design_playbook", as_of: new Date().toISOString(), freshness_seconds: 0 },
  }).success, true);
});

test("propuestas admiten estimaciones acotadas y rechazan divisa/coste inventado mal formado", () => {
  const write = {
    kind: "task" as const,
    title: "Revisar la oferta",
    description: "Validar el impacto antes de publicar.",
    priority: "medium" as const,
    rationale: "Hay una hipótesis por comprobar.",
    evidence: [],
    effort_estimate: "unknown" as const,
    financial_cost_estimate: null,
  };
  assert.equal(agentProposedWriteSchema.parse(write).financial_cost_estimate, null);
  assert.equal(agentProposedWriteSchema.safeParse({ ...write, financial_cost_estimate: { amount: -1, currency: "EUR", basis: "" } }).success, false);
  const properties = agentOutputJsonSchema.properties.proposed_writes.items.properties;
  assert.deepEqual(properties.effort_estimate.enum, ["low", "medium", "high", "unknown", null]);
  assert.ok(properties.financial_cost_estimate.anyOf);
});

test("validates bounded private image attachments and limits image count", () => {
  const image = {
    base64: "aGVsbG8=",
    mediaType: "image/png" as const,
    label: "desktop preview",
  };
  assert.deepEqual(validateAgentImageAttachments([image]), [image]);
  assert.equal(
    validateAgentImageAttachments(Array.from({ length: 10 }, () => image))
      .length,
    8,
  );
  assert.throws(
    () =>
      validateAgentImageAttachments([
        { ...image, base64: "a".repeat(2_000_001) },
      ]),
    /agent_image_payload_out_of_bounds/,
  );
});

test("A27 entrega dirección visual común y módulos por correo para el handoff A11", () => {
  const valid = weeklyMailingPlanOutputSchema.safeParse({
    plan_name: "Semana lanzamiento",
    diagnosis: "Sin evidencia suficiente",
    strategy_decision: "Educación primero, oferta solo con margen validado",
    alternatives_rejected: [{ alternative: "Descuento inmediato", reason: "No hay margen validado" }],
    objective_rationale: "La prioridad es enseñar el valor antes de pedir la compra.",
    audience_rationale: "El segmento indicado coincide con la fase de consideración.",
    cadence: {
      recommendation: "Dos envíos separados por cuatro días.",
      requested_schedule_assessment: "El calendario solicitado es razonable para este volumen.",
      requires_user_approval: true,
    },
    experiment: {
      hypothesis: "Un beneficio concreto aumentará los clics cualificados.",
      primary_metric: "click_rate",
      guardrail_metrics: ["unsubscribe_rate", "complaint_rate"],
      design: "Comparar asunto A/B solo si Klaviyo ofrece muestra suficiente.",
      decision_rule: "No elegir ganador si la muestra o ventana no bastan.",
      evidence_status: "insufficient_evidence",
    },
    success_criteria: ["Mejorar clics cualificados sin empeorar bajas."],
    stop_criteria: ["Detener si aumentan quejas o bajas frente al umbral acordado."],
    sequence_rationale: "Educar y luego presentar el producto",
    visual_direction:
      "Editorial modular, paleta de marca y una imagen de producto por correo",
    emails: [
      {
        sequence_number: 1,
        title: "Presentación",
        sequence_role: "Abrir el tema y aportar contexto útil.",
        objective: "Educación",
        audience: "Nuevos",
        angle: "Problema y solución",
        subject_direction: "Curiosidad específica",
        preheader_direction: "Beneficio concreto",
        cta: "Ver producto",
        copy_brief: "No inventar claims",
        visual_modules:
          "Hero de texto, producto, bloque de prueba, CTA y footer",
      },
    ],
    sources: [],
    confidence: "low",
    warnings: [],
  });
  assert.equal(valid.success, true);
  assert.deepEqual(weeklyMailingPlanJsonSchema.required, [
    "decision", "decision_reasons", "questions",
    "plan_name",
    "diagnosis",
    "strategy_decision",
    "alternatives_rejected",
    "objective_rationale",
    "audience_rationale",
    "cadence",
    "experiment",
    "success_criteria",
    "stop_criteria",
    "sequence_rationale",
    "visual_direction",
    "emails",
    "sources",
    "confidence",
    "warnings",
  ]);
  assert.equal(
    weeklyMailingPlanOutputSchema.safeParse({
      plan_name: "x",
      diagnosis: "x",
      strategy_decision: "x",
      alternatives_rejected: [],
      objective_rationale: "x",
      audience_rationale: "x",
      cadence: { recommendation: "x", requested_schedule_assessment: "x", requires_user_approval: false },
      experiment: { hypothesis: "x", primary_metric: "x", guardrail_metrics: [], design: "x", decision_rule: "x", evidence_status: "not_applicable" },
      success_criteria: ["x"],
      stop_criteria: ["x"],
      sequence_rationale: "x",
      emails: [],
      sources: [],
      confidence: "low",
      warnings: [],
    }).success,
    false,
  );
});

test("A01 conserva due_hint y acepta propuestas antiguas sin el campo", () => {
  const proposal = {
    title: "Preparar informe",
    description: "Revisar margen",
    priority: "medium" as const,
    owner: "consultor" as const,
  };
  assert.equal(
    callProposedTaskSchema.parse({
      ...proposal,
      due_hint: "antes de la próxima llamada",
    }).due_hint,
    "antes de la próxima llamada",
  );
  assert.equal(callProposedTaskSchema.parse(proposal).due_hint, null);
});

test("A01 conserva referencias de conocimiento separadas de los hechos de llamada", () => {
  const legacy = callSummaryOutputSchema.parse({
    summary: "Resumen",
    facts: [],
    decisions: [],
    recommendations: [],
    risks: [],
    proposed_tasks: [],
    key_quotes: [],
    confidence: "medium",
    warnings: [],
  });
  assert.deepEqual(legacy.sources, []);
  assert.deepEqual(legacy.proposed_campaign_ideas, []);
  assert.deepEqual(legacy.proposed_camino_changes, []);
  const withReference = callSummaryOutputSchema.parse({
    ...legacy,
    sources: [{ kind: "document", reference: "Guía de margen", period: null }],
    proposed_campaign_ideas: [
      {
        objective: "Lanzamiento de verano",
        audience: "Clientes recurrentes",
        timing_hint: "Primera semana de junio",
        evidence_quote: "Hagamos el lanzamiento la primera semana de junio.",
      },
    ],
    proposed_camino_changes: [
      {
        change: "Añadir una fase de retención",
        rationale: "Se acordó priorizar la recompra",
        evidence_quote:
          "El siguiente trimestre enfoquémonos en que vuelvan a comprar.",
      },
    ],
  });
  assert.deepEqual(withReference.sources, [
    { kind: "document", reference: "Guía de margen", period: null },
  ]);
  assert.equal(
    withReference.proposed_campaign_ideas[0]?.audience,
    "Clientes recurrentes",
  );
  assert.equal(
    withReference.proposed_camino_changes[0]?.change,
    "Añadir una fase de retención",
  );
});

test("A02 emite titular y secciones, y normaliza compatibilidad sin pedir listas planas", () => {
  const parsed = monitorOutputSchema.parse({
    headline: "El margen requiere atención por el aumento de descuentos.",
    sections: [
      {
        key: "finanzas",
        label: "Ventas y margen",
        findings: [
          {
            title: "Más descuentos",
            severity: "medium",
            evidence:
              "Los descuentos fueron 20 % de la venta bruta durante 30 días.",
            area: null,
          },
        ],
        recommendations: [
          {
            action: "Revisar las reglas de descuento.",
            priority: "high",
            expected_impact: "Proteger el margen bruto.",
            owner: "consultor",
          },
        ],
      },
    ],
    sources: [
      {
        kind: "metric",
        reference: "shopify_financial_summary",
        period: "30 días",
      },
    ],
    confidence: "high",
    warnings: [],
  });

  assert.equal(parsed.answer, parsed.headline);
  assert.equal(parsed.findings[0]?.area, "finanzas");
  assert.equal(parsed.recommendations.length, 1);
  assert.deepEqual(parsed.proposed_writes, []);
  assert.equal(parsed.approval_required, false);
  assert.equal("answer" in monitorOutputJsonSchema.properties, false);
  assert.equal("findings" in monitorOutputJsonSchema.properties, false);
  assert.equal("recommendations" in monitorOutputJsonSchema.properties, false);
  assert.equal("maxItems" in monitorOutputJsonSchema.properties.sections, false);
});

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
    (
      chatJsonSchema.properties.ui_actions as {
        items: { properties: { kind: { enum: readonly string[] } } };
      }
    ).items.properties.kind.enum,
    ["open_insight"],
  );
});

test("todos los contratos JSON estrictos requieren cada propiedad de sus objetos", () => {
  const schemas: Record<string, unknown> = {
    agentOutputJsonSchema,
    monitorOutputJsonSchema,
    caminoPlanJsonSchema,
    campaignPlanJsonSchema,
    weeklyMailingPlanJsonSchema,
    chatJsonSchema,
    klaviyoEmailJsonSchema,
    metaAdsJsonSchema,
    instagramPostJsonSchema,
    instagramImageAnalysisJsonSchema,
    instagramOverlayDraftJsonSchema,
    callSummaryJsonSchema,
  };

  function inspect(node: unknown, schemaName: string, path = "root") {
    if (!node || typeof node !== "object") return;
    const schema = node as {
      type?: unknown;
      additionalProperties?: unknown;
      properties?: Record<string, unknown>;
      required?: unknown;
      [key: string]: unknown;
    };
    if (schema.type === "object") {
      assert.equal(
        schema.additionalProperties,
        false,
        `${schemaName}.${path} must reject unknown properties`,
      );
      if (schema.properties) {
        const required = new Set(
          Array.isArray(schema.required) ? schema.required : [],
        );
        assert.equal(required.size, Array.isArray(schema.required) ? schema.required.length : 0, `${schemaName}.${path} must not duplicate required properties`);
        const missing = Object.keys(schema.properties).filter(
          (key) => !required.has(key),
        );
        assert.deepEqual(
          missing,
          [],
          `${schemaName}.${path} must require every declared property`,
        );
      }
    }
    for (const [key, value] of Object.entries(schema)) {
      if (Array.isArray(value)) {
        value.forEach((child, index) =>
          inspect(child, schemaName, `${path}.${key}[${index}]`),
        );
      } else if (value && typeof value === "object") {
        inspect(value, schemaName, `${path}.${key}`);
      }
    }
  }

  for (const [name, schema] of Object.entries(schemas)) inspect(schema, name);
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

test("acepta variantes de campo propias del copiloto y del resumen de llamada", () => {
  assertOk({
    answer: "Revisaría primero la caída de conversión.",
    findings: [{
      title: "Más visitas abandonan el checkout",
      detail: "La conversión cayó del 2,4 % al 1,8 % en los últimos 30 días.",
      impact: "high",
    }],
  });
  assertOk({
    summary: "El cliente quiere recuperar margen.",
    recommendations: [{
      action: "Revisar los descuentos activos",
      rationale: "La llamada detectó tres promociones sin medición de margen.",
    }],
  });
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

test("la tarifa de ai_model_prices gana al respaldo y el id fechado cae en su alias", () => {
  assert.equal(estimateCostUsd("claude-haiku-4-5-20251001", 1_000_000, 0), 1);
  setLiveModelPricing(
    { "gpt-5.5": { inputPerMTok: 6, outputPerMTok: 36 } },
    "2026-10-01",
  );
  try {
    assert.equal(
      estimateCostUsd("gpt-5.5-2026-04-23", 1_000_000, 1_000_000),
      42,
    );
    assert.equal(getPricingVersion(), "2026-10-01");
    // Lo que la tabla no tiene sigue saliendo del respaldo.
    assert.equal(estimateCostUsd("claude-opus-4-8", 1_000_000, 1_000_000), 30);
  } finally {
    setLiveModelPricing({}, PRICING_VERSION);
  }
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
    from_name: "E-NORA",
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

test("normaliza enlaces inválidos de email sin inventar destinos y deja aviso", () => {
  const raw = {
    summary: "Email de temporada",
    template_name: "seasonal",
    subject: "Novedades",
    preheader: "Selección editorial",
    from_name: "E-NORA",
    reply_to: null,
    purpose: "presentar novedades",
    audience: "suscriptores con consentimiento",
    locale: "es-ES",
    tone: "Una descripción extensa del tono editorial que antes podía superar el límite aunque siguiera siendo útil y válida para la persona que revisa el borrador.",
    plain_text: "Novedades de temporada",
    html: '<p><a href="no-es-url">Novedades</a><a href="https://example.com">Tienda</a></p>',
    blocks: [
      { type: "button", content: "Ver novedades", href: "no-es-url", alt: null },
      { type: "button", content: "Ver tienda", href: "https://example.com", alt: null },
    ],
    personalization_tokens: [],
    compliance_notes: [],
    sources: [],
    confidence: "medium",
    warnings: [],
    approval_required: true,
  };
  assert.equal(klaviyoEmailGenerationOutputSchema.safeParse(raw).success, true);
  const result = normalizeGeneratedEmailLinks(raw);
  assert.equal((result.blocks as Array<{ href: string | null }>)[0]?.href, null);
  assert.equal(
    (result.blocks as Array<{ href: string | null }>)[1]?.href,
    "https://example.com",
  );
  assert.match((result.warnings as string[])[0] ?? "", /enlace.*no válido/i);
  assert.doesNotMatch(result.html as string, /href="no-es-url"/);
  assert.match(result.html as string, /href="https:\/\/example\.com"/);
  assert.equal(klaviyoEmailOutputSchema.safeParse(result).success, true);
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
    composition: "El producto ocupa el centro y queda aire en los laterales.",
    aspect_ratio_estimate: "square" as const,
    ocr_text: "",
    suggested_use: "Portada de carrusel de lanzamiento.",
    inferences: [],
    alt_text: "Vela encendida sobre una superficie de mármol claro.",
    confidence: "high" as const,
    visible_message: "",
    visible_call_to_action: "",
    design_findings: [],
    ocr_segments: [],
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
    { filename: "vela.jpg" },
  );
  assert.match(md, /# Activo visual: vela\.jpg/);
  assert.doesNotMatch(md, /https?:\/\//);
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
    true,
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

test("A12 tiene tools de rendimiento acotadas y estrictamente read-only", () => {
  const validWindow = { period_start: "2026-01-01", period_end: "2026-03-31" };
  for (const name of ["klaviyo_performance_summary", "klaviyo_deliverability_health"]) {
    const contract = getToolContract(name);
    assert.equal(contract?.definition.permission, "read");
    assert.equal(contract?.definition.status, "implemented_partial");
    assert.equal(contract?.definition.connector, "klaviyo");
    assert.equal(contract?.inputSchema.safeParse(validWindow).success, true);
    assert.equal(contract?.inputSchema.safeParse({ ...validWindow, store_id: "other" }).success, false);
    assert.equal(contract?.inputSchema.safeParse({ ...validWindow, period_end: "2026-04-01T00:00:00Z" }).success, false);
  }
  const entity = getToolContract("klaviyo_entity_performance");
  assert.equal(entity?.inputSchema.safeParse({
    ...validWindow,
    entity_type: "flow",
    entity_id: "123e4567-e89b-42d3-a456-426614174000",
  }).success, true);
  assert.equal(entity?.inputSchema.safeParse({
    ...validWindow,
    entity_type: "campaign",
    entity_id: "not-a-uuid",
  }).success, false);
});

test("A23 creative drilldown is a bounded read-only tool with server-owned store scope", () => {
  const contract = getToolContract("meta_creative_diagnostics");
  const tool = TOOL_REGISTRY.find((item) => item.name === "meta_creative_diagnostics");
  const base = {
    ad_id: "00000000-0000-4000-8000-000000000001",
    period_start: "2020-01-01",
    period_end: "2020-03-31",
  };
  assert.equal(tool?.permission, "read");
  assert.equal(tool?.connector, "meta");
  assert.equal(tool?.status, "implemented_partial");
  assert.equal(contract?.inputSchema.safeParse(base).success, true);
  assert.equal(contract?.inputSchema.safeParse({ ...base, store_id: "other" }).success, false);
  assert.equal(contract?.inputSchema.safeParse({ ...base, ad_id: "not-an-id" }).success, false);
  assert.equal(contract?.inputSchema.safeParse({ ...base, period_end: "2020-04-01" }).success, false);
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

test("las propuestas tipan el contrato de entrega semanal y siguen aceptando salidas antiguas", () => {
  const write = {
    kind: "task" as const,
    title: "Preparar una prueba de oferta",
    description: "Comparar la oferta actual con una alternativa.",
    priority: "medium" as const,
    owner_role: "cliente" as const,
    completion_criteria: "Prueba aprobada y resultado registrado en Tareas.",
    expected_metric: "Conversión de sesión a pedido durante 14 días.",
    due_hint: "Antes del viernes de esta semana",
  };
  assert.deepEqual(
    agentProposedWriteSchema.parse(write),
    { ...write, rationale: "", evidence: [] },
  );
  assert.equal(agentProposedWriteSchema.safeParse({ ...write, owner_role: "equipo" }).success, false);
  assert.equal(agentProposedWriteSchema.safeParse({ ...write, completion_criteria: "x".repeat(501) }).success, false);
  assert.equal(agentProposedWriteSchema.safeParse({ ...write, due_hint: " " }).success, false);

  const properties = agentOutputJsonSchema.properties.proposed_writes.items.properties;
  assert.deepEqual(properties.owner_role.enum, ["cliente", "consultor", null]);
  assert.equal(properties.completion_criteria.maxLength, 500);
  assert.equal(properties.expected_metric.maxLength, 240);
  assert.equal(properties.due_hint.maxLength, 100);
});

test("las propuestas admiten línea base y objetivo nulos sin confundirlos con cero", () => {
  const measurement = {
    metric_name: "Margen de contribución",
    unit: "%",
    baseline: 18.5,
    target: null,
    evaluation_window: "30 días desde la activación",
  };
  assert.equal(
    agentProposedWriteSchema.parse({
      kind: "task",
      title: "Ajustar descuentos",
      description: "Probar regla por margen.",
      priority: "medium",
      initiative_measurement: measurement,
    }).initiative_measurement?.target,
    null,
  );
  assert.equal(
    agentProposedWriteSchema.safeParse({
      kind: "task",
      title: "Ajustar descuentos",
      description: "Probar regla por margen.",
      priority: "medium",
      initiative_measurement: { ...measurement, target: Number.POSITIVE_INFINITY },
    }).success,
    false,
  );
  const properties = agentOutputJsonSchema.properties.proposed_writes.items.properties;
  const initiativeMeasurementObject = properties.initiative_measurement.anyOf[1];
  assert.deepEqual(initiativeMeasurementObject.required, [
    "metric_name", "unit", "baseline", "target", "evaluation_window",
  ]);
  assert.deepEqual(initiativeMeasurementObject.properties.target.type, ["number", "null"]);
});
