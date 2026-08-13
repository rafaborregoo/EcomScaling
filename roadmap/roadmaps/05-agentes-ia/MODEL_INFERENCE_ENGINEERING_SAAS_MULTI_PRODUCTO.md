# Model & Inference Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica transversal.
- **Ámbito:** SaaS, CRM, agentes, copilotos, RAG, tool calling, structured outputs, routing, modelos, proveedores, prompts, costes, latencia y despliegues.
- **Casos de referencia:** NORA, EcomScaling IA y CRM/SaaS.
- **Objetivo:** diseñar una arquitectura de inferencia que seleccione, configure, versiona, evalúe y sustituya modelos de forma controlada, medible y segura.
- **Audiencia:** Codex, arquitectura, backend, IA, QA, DevOps, seguridad, producto y operaciones.
- **Prioridad:** crítica.
- **Principio rector:** ningún modelo debe utilizarse por prestigio, tamaño o novedad; debe utilizarse porque cumple el objetivo medido de una tarea concreta con un coste y una latencia aceptables.

---

# 1. Propósito

Este documento define cómo implementar **Model & Inference Engineering** en una plataforma SaaS con agentes de IA.

La arquitectura debe permitir:

- Clasificar tareas.
- Seleccionar modelos.
- Seleccionar proveedor.
- Configurar esfuerzo de razonamiento.
- Definir límites de contexto.
- Definir límites de salida.
- Aplicar Structured Outputs.
- Controlar tool calling.
- Versionar modelos.
- Versionar prompts.
- Versionar schemas.
- Versionar configuraciones.
- Aplicar fallback.
- Ejecutar shadow mode.
- Ejecutar canary releases.
- Comparar modelos.
- Medir coste.
- Medir latencia.
- Medir calidad.
- Detectar drift.
- Mantener rollback.
- Aplicar políticas de privacidad.
- Mantener trazabilidad por tenant y producto.

La arquitectura común debe reutilizarse en:

- NORA.
- EcomScaling IA.
- CRM/SaaS.
- Copilotos.
- Agentes especializados.
- Procesamiento documental.
- RAG.
- Clasificación.
- Extracción.
- Resumen.
- Análisis.
- Tool calling.
- Generación de comunicaciones.
- Workflows con aprobación.
- Jobs batch.

---

# 2. Regla obligatoria de análisis previo

## 2.1 Principio

Antes de implementar un Model Router, un Model Registry o una política de fallback, Codex debe analizar exhaustivamente el sistema real.

No debe imponer una taxonomía genérica sin revisar:

- Agentes.
- Casos de uso.
- Prompts.
- Tools.
- Schemas.
- RAG.
- Memoria.
- Workflows.
- Riesgos.
- Datos.
- Idiomas.
- Volumen.
- Latencia.
- Coste.
- Proveedores.
- Modelos actuales.
- Reglas de negocio.
- Multi-tenancy.
- Seguridad.
- Privacidad.
- Evals.
- Observabilidad.
- Productos.
- Planes comerciales.

## 2.2 Prohibiciones

Codex no debe:

- Usar un único modelo para todo.
- Usar siempre el modelo más caro.
- Usar siempre el modelo más barato.
- Elegir por benchmark general.
- Cambiar un modelo sin evals.
- Cambiar un alias sin control.
- Utilizar texto libre cuando el código necesita estructura.
- Tratar JSON válido como esquema válido.
- Permitir tools no autorizadas.
- Permitir que el modelo elija cualquier modelo.
- Usar temperatura o razonamiento por intuición.
- Llenar la context window sin necesidad.
- Truncar datos críticos silenciosamente.
- Mezclar configuración entre tenants.
- Omitir versionado.
- Omitir rollback.
- Implementar multi-provider mediante una abstracción falsa.
- Utilizar fine-tuning para sustituir datos vivos.
- Guardar secretos en prompts.
- Enviar datos sensibles a proveedores no autorizados.
- Diferenciar la calidad mínima por plan comercial.
- Marcar terminado sin evals de regresión.

## 2.3 Entregables previos

Antes de modificar código, Codex debe entregar:

1. Inventario de modelos actuales.
2. Inventario de proveedores.
3. Inventario de prompts.
4. Inventario de schemas.
5. Inventario de tools.
6. Inventario de task types.
7. Matriz de riesgo por tarea.
8. Matriz de calidad objetivo.
9. Matriz de coste objetivo.
10. Matriz de latencia objetivo.
11. Matriz task-to-model.
12. Matriz model-to-capability.
13. Matriz de privacidad.
14. Matriz de fallback.
15. Matriz de snapshots y aliases.
16. Matriz de routing.
17. Matriz de structured outputs.
18. Matriz de tool calling.
19. Mapa de observabilidad.
20. Mapa de costes.
21. Dataset de evals actual.
22. Gaps de evaluación.
23. Arquitectura propuesta.
24. Archivos exactos.
25. Fases de implementación.
26. Tests.
27. Quality gates.
28. Plan de migración.
29. Plan de rollback.

No debe implementarse antes de revisar este análisis.

---

# 3. Definición

**Model & Inference Engineering** es la disciplina que decide:

- Qué modelo resuelve una tarea.
- Qué proveedor se utiliza.
- Qué versión se fija.
- Qué razonamiento se permite.
- Qué tools se exponen.
- Qué contexto se envía.
- Qué schema se exige.
- Qué presupuesto se aplica.
- Qué fallback existe.
- Qué métricas deben cumplirse.
- Cómo se despliega una nueva configuración.

Fórmula conceptual:

```text
Model & Inference Engineering =
task profiling
+ model registry
+ routing
+ prompt contracts
+ reasoning policy
+ context budget
+ structured outputs
+ tool compatibility
+ cost control
+ evals
+ rollout control
```

---

# 4. Diferencia con Prompt Engineering

## Prompt Engineering

Define:

- Instrucciones.
- Contexto.
- Ejemplos.
- Formato.
- Restricciones.

## Model & Inference Engineering

Define:

- Modelo.
- Proveedor.
- Snapshot.
- Reasoning effort.
- Herramientas.
- Budget.
- Fallback.
- Latencia.
- Coste.
- Versionado.
- Despliegue.

Un buen prompt no compensa un modelo inadecuado.

Un modelo potente no compensa una mala arquitectura de datos, tools o permisos.

---

# 5. Antes del modelo: decidir si hace falta IA

## Usar lógica determinista

Para:

- Cálculos fiscales.
- Fórmulas.
- Validación de permisos.
- Invariantes.
- Sumas.
- Comparaciones.
- Estados.
- Transiciones.
- Límites.
- Idempotencia.
- Normalización conocida.
- Aplicación de reglas explícitas.

## Usar modelo

Para:

- Comprender lenguaje.
- Interpretar documentos.
- Clasificar texto ambiguo.
- Extraer datos no estructurados.
- Resumir.
- Comparar.
- Explicar.
- Razonar.
- Proponer.
- Redactar.
- Sintetizar evidencia.

Regla:

```text
Si una función determinista puede resolverlo con calidad,
no utilizar un LLM.
```

---

# 6. Task Taxonomy

Toda inferencia debe pertenecer a un tipo de tarea.

```ts
export type InferenceTaskType =
  | "intent_classification"
  | "document_classification"
  | "field_extraction"
  | "entity_resolution"
  | "query_rewriting"
  | "retrieval_planning"
  | "summarization"
  | "comparison"
  | "reasoning"
  | "recommendation"
  | "tool_selection"
  | "tool_argument_generation"
  | "response_generation"
  | "draft_generation"
  | "verification"
  | "risk_assessment"
  | "handoff_decision";
```

La taxonomía debe adaptarse al repositorio real.

---

# 7. Inference Task Profile

```ts
export type InferenceTaskProfile = {
  taskType: InferenceTaskType | string;

  product:
    | "nora"
    | "ecommerce"
    | "crm"
    | "shared";

  complexity:
    | "low"
    | "medium"
    | "high"
    | "critical";

  modality:
    | "text"
    | "image"
    | "document"
    | "multimodal";

  outputType:
    | "free_text"
    | "structured"
    | "tool_call"
    | "decision"
    | "classification";

  riskLevel:
    | "low"
    | "medium"
    | "high"
    | "critical";

  latencyTargetMs: number;
  maximumCost: number;

  requiresTools: boolean;
  requiresLongContext: boolean;
  requiresReasoning: boolean;
  requiresVerification: boolean;

  containsPersonalData: boolean;
  containsSensitiveBusinessData: boolean;
};
```

---

# 8. Model Registry

Debe existir un registro central.

```ts
export type ModelCapability =
  | "classification"
  | "extraction"
  | "reasoning"
  | "tool_calling"
  | "structured_output"
  | "vision"
  | "long_context"
  | "streaming"
  | "low_latency"
  | "high_accuracy"
  | "batch";

export type ModelRegistryEntry = {
  id: string;

  provider: string;
  model: string;
  snapshot?: string;

  capabilities: ModelCapability[];

  contextWindow: number;
  maximumOutputTokens: number;

  supportsTools: boolean;
  supportsStructuredOutputs: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;

  costProfile:
    | "low"
    | "medium"
    | "high";

  latencyProfile:
    | "fast"
    | "medium"
    | "slow";

  approvedTaskTypes: string[];
  prohibitedTaskTypes: string[];

  allowedDataClasses: string[];
  allowedRegions?: string[];

  active: boolean;
  deprecated: boolean;

  createdAt: string;
  deprecatedAt?: string;
};
```

---

# 9. Model Capability Registry

No asumir que dos modelos con el mismo proveedor son equivalentes.

Registrar:

- Tool calling.
- Structured outputs.
- Vision.
- Long context.
- Streaming.
- Reasoning.
- Batch.
- Prompt caching.
- Safety behavior.
- Refusal behavior.
- JSON schema limits.
- Context limits.
- Output limits.

---

# 10. Model Version Policy

```ts
export type ModelVersionPolicy = {
  taskType: string;

  mode:
    | "pinned"
    | "controlled_alias"
    | "dynamic";

  approvedModelIds: string[];

  requiresRegressionEvals: boolean;
  requiresCanary: boolean;
  requiresShadowMode: boolean;
};
```

## Pinned

Usar para:

- Workflows críticos.
- Operaciones jurídicas.
- Tool calling sensible.
- Procesos con replay.
- Evals reguladas.

## Controlled alias

Usar para:

- Tareas de bajo riesgo.
- Resúmenes.
- Clasificación no crítica.
- Contenido narrativo.

## Dynamic

Solo cuando:

- Existe router probado.
- Existen evals continuas.
- Existen límites.
- Existe rollback.

---

# 11. Alias y snapshots

## Alias

Puede cambiar de implementación.

## Snapshot

Fija una versión concreta.

Regla:

```text
Workflow crítico
→ snapshot fijado.

Tarea no crítica
→ alias controlado.
```

Toda ejecución debe registrar:

- Provider.
- Model.
- Snapshot.
- Alias recibido.
- Configuración.
- Prompt version.
- Schema version.
- Tool policy version.

---

# 12. Model Router

```ts
export interface ModelRouter {
  route(
    task: InferenceTaskProfile,
    context: ModelRoutingContext
  ): Promise<ModelRoute>;
}
```

```ts
export type ModelRoute = {
  provider: string;
  model: string;
  snapshot?: string;

  reasoningEffort: ReasoningEffort;
  responseMode: ResponseMode;

  fallbackPolicyId: string;
  budgetPolicyId: string;
  toolPolicyId?: string;
  schemaId?: string;

  reasonCodes: string[];
};
```

---

# 13. Model Routing Context

```ts
export type ModelRoutingContext = {
  tenantId: string;
  product: string;

  userPlan?: string;

  dataHandlingRequirements: DataHandlingRequirement;

  providerHealth: Record<string, string>;

  currentBudget: {
    monthlyRemaining: number;
    runRemaining: number;
  };

  featureFlags: Record<string, boolean>;
};
```

El plan comercial no debe degradar la calidad mínima.

Puede limitar:

- Volumen.
- Frecuencia.
- Concurrencia.
- Automatizaciones.
- Retención.

No debe cambiar silenciosamente a un modelo que no cumpla el objetivo de calidad.

---

# 14. Routing determinista

Adecuado cuando existen reglas claras.

```ts
if (
  task.taskType === "field_extraction" &&
  task.outputType === "structured"
) {
  return extractionRoute;
}
```

Ventajas:

- Predecible.
- Auditable.
- Barato.
- Rápido.
- Fácil de testear.

---

# 15. Routing mediante IA

Puede utilizarse cuando la intención es ambigua.

Debe producir un output estructurado:

```ts
const RouteDecisionSchema = z.object({
  taskType: z.string(),
  complexity: z.enum([
    "low",
    "medium",
    "high",
    "critical"
  ]),
  requiresTools: z.boolean(),
  requiresReasoning: z.boolean(),
  confidence: z.number().min(0).max(1),
});
```

No utilizar el modelo más caro para routing.

---

# 16. Arquitectura híbrida de routing

```text
Reglas deterministas
  ↓
Si no resuelven
  ↓
Router ligero
  ↓
Validación
  ↓
Política
  ↓
Ruta final
```

---

# 17. Reasoning Effort

```ts
export type ReasoningEffort =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";
```

Debe asignarse por tarea.

Ejemplo orientativo:

```text
Clasificación simple
→ none / low

Extracción estructurada
→ low / medium

Comparación compleja
→ medium / high

Análisis jurídico complejo
→ high

Operación crítica
→ modelo como apoyo, no autoridad final
```

---

# 18. Reasoning Policy

```ts
export type ReasoningPolicy = {
  taskType: string;

  defaultEffort: ReasoningEffort;
  maximumEffort: ReasoningEffort;

  escalationConditions: string[];

  requiresEvalEvidence: boolean;
};
```

No aumentar esfuerzo por intuición.

Debe justificarse con:

- Mejora de eval.
- Aumento de coste.
- Aumento de latencia.
- Valor del caso.

---

# 19. Accuracy first

Proceso recomendado:

```text
Definir calidad objetivo
  ↓
Usar modelo capaz
  ↓
Construir dataset
  ↓
Alcanzar objetivo
  ↓
Probar modelos menores
  ↓
Elegir el más eficiente que cumpla
```

---

# 20. Accuracy Targets

```ts
export type TaskQualityTarget = {
  taskType: string;

  minimumAccuracy?: number;
  minimumStructuredOutputValidity?: number;
  minimumToolSelectionAccuracy?: number;
  minimumGroundingScore?: number;
  maximumHallucinationRate?: number;
  maximumHumanOverrideRate?: number;
};
```

---

# 21. No elegir por benchmarks generales

Debe evaluarse sobre:

- Español real.
- Documentos reales.
- Tools reales.
- Schemas reales.
- Datos del producto.
- Errores reales.
- Casos difíciles.
- Casos adversariales.
- Variantes por tenant.
- Variantes por producto.

---

# 22. Model Evaluation Result

```ts
export type ModelEvaluationResult = {
  modelId: string;
  taskType: string;

  accuracyScore: number;
  safetyScore: number;
  structuredOutputScore: number;
  toolSelectionScore: number;
  groundingScore: number;

  averageLatencyMs: number;
  p95LatencyMs: number;

  averageCost: number;

  passed: boolean;
};
```

---

# 23. Inference Budget

```ts
export type InferenceBudget = {
  maximumInputTokens: number;
  maximumOutputTokens: number;
  maximumReasoningTokens?: number;

  maximumModelCalls: number;
  maximumToolCalls?: number;

  maximumCost: number;
  maximumLatencyMs: number;
};
```

---

# 24. Budget Enforcement

El budget debe aplicarse:

- Antes de llamar.
- Durante loops.
- Antes de fallback.
- Antes de usar un modelo superior.
- Antes de añadir contexto.
- Antes de reintentar.

```ts
export interface InferenceBudgetEnforcer {
  assertCanRun(
    request: CanonicalModelRequest,
    currentUsage: InferenceUsage
  ): void;
}
```

---

# 25. Structured Outputs

Para outputs consumidos por código:

```text
Modelo
  ↓
JSON Schema
  ↓
Parser
  ↓
Validación
  ↓
Reglas de dominio
```

No usar texto libre.

---

# 26. JSON mode frente a Structured Output

## JSON mode

Garantiza JSON sintáctico.

## Structured Output

Garantiza ajuste a schema.

Ejemplo inválido semánticamente:

```json
{
  "priority": "super-urgent"
}
```

Puede ser JSON válido, pero no respetar el enum.

---

# 27. Schema-first inference

```ts
const DecisionSchema = z.object({
  decision: z.enum([
    "allow",
    "deny",
    "review"
  ]),
  reasons: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
```

Diseñar el schema antes del prompt.

---

# 28. Schema Registry

```ts
export type OutputSchemaDefinition = {
  id: string;
  version: string;

  taskType: string;

  jsonSchema: unknown;

  semanticValidatorId?: string;

  compatibleModels: string[];

  active: boolean;
};
```

---

# 29. Semantic Validation

Structured Output garantiza forma, no verdad.

```ts
export interface SemanticValidator<T> {
  validate(
    value: T,
    context: SemanticValidationContext
  ): Promise<SemanticValidationResult>;
}
```

Ejemplos:

- Validar tipos fiscales.
- Validar fechas.
- Validar importes.
- Validar IDs.
- Validar que el recurso existe.
- Validar tenant.
- Validar consistencia con fuente canónica.

---

# 30. Output Repair

Puede existir reparación limitada.

```ts
export type OutputRepairPolicy = {
  maximumRepairAttempts: number;

  repairableErrors: string[];

  allowModelRepair: boolean;
  allowDeterministicRepair: boolean;
};
```

No reparar silenciosamente:

- Cambios jurídicos.
- Importes.
- Identidades.
- Permisos.
- Tool arguments críticos.

---

# 31. Refusals

```ts
export type InferenceStatus =
  | "completed"
  | "refused"
  | "invalid_output"
  | "budget_exceeded"
  | "provider_error"
  | "timeout";
```

No tratar una refusal como JSON roto.

Debe:

- Detectarse.
- Auditarse.
- Informarse.
- Escalarse si procede.
- No reintentarse ciegamente.

---

# 32. Tool Calling Engineering

El modelo solo debe recibir tools relevantes.

```ts
export type InferenceToolPolicy = {
  id: string;
  version: string;

  taskType: string;

  allowedTools: string[];
  prohibitedTools: string[];

  maximumToolCalls: number;

  parallelToolCalls: boolean;

  requiresApprovalForTools: string[];
};
```

---

# 33. Tool Choice Mode

```ts
export type ToolChoiceMode =
  | "none"
  | "auto"
  | "required"
  | "specific";
```

---

# 34. Compatibilidad modelo-tool

Evaluar:

- Tool selection.
- Argumentos.
- Schemas.
- Errores.
- Corrección.
- Paralelismo.
- Handoffs.
- Refusals.
- Tool result handling.
- Máximo de llamadas.

---

# 35. Tool Capability Validator

```ts
export interface ToolCapabilityValidator {
  validate(
    modelId: string,
    toolPolicy: InferenceToolPolicy
  ): ToolCapabilityValidationResult;
}
```

Bloquear ruta si:

- El modelo no soporta tools.
- No soporta schema.
- No pasó evals.
- No soporta modalidad.
- El fallback no es compatible.

---

# 36. Prompt Definition

```ts
export type PromptDefinition<TInput> = {
  id: string;
  version: string;

  taskType: string;

  build(
    input: TInput
  ): ModelInput;

  expectedOutputSchemaId?: string;

  compatibleModels: string[];

  evaluationDatasetId: string;
};
```

---

# 37. Prompt Versioning

Los prompts deben:

- Vivir en el repositorio.
- Tener versión.
- Tener hash.
- Tener owner.
- Tener tests.
- Tener evals.
- Tener rollback.
- Tener feature flag si es necesario.
- Registrarse en cada run.

---

# 38. Prompt Registry

```ts
export type PromptRegistryEntry = {
  id: string;
  version: string;

  filePath: string;
  contentHash: string;

  taskType: string;
  compatibleModels: string[];

  active: boolean;
  deprecated: boolean;

  createdAt: string;
};
```

---

# 39. Prompt Contract

Debe declarar:

- Task type.
- Inputs.
- Variables.
- Output schema.
- Models compatibles.
- Tools.
- Context.
- Política de datos.
- Dataset de evals.
- Owner.
- Riesgo.

---

# 40. Prompt Caching

Puede aprovechar prefijos estables.

Orden recomendado:

```text
Instrucciones estables
Políticas estables
Tool schemas estables
Ejemplos estables
----------------
Contexto variable
Datos del caso
Pregunta
```

---

# 41. Cache Policy

```ts
export type PromptCachePolicy = {
  enabled: boolean;

  stablePrefixSections: string[];

  minimumReusableTokens: number;

  maximumCacheWriteCost: number;

  requiredHitRate: number;
};
```

---

# 42. Cache Metrics

Medir:

- Cache hit rate.
- Cached input tokens.
- Cache write tokens.
- Coste de escritura.
- Coste ahorrado.
- Latencia ahorrada.
- Prefijos reutilizados.
- Cache invalidation rate.

---

# 43. Latency Engineering

La latencia depende de:

- Modelo.
- Tokens de entrada.
- Tokens de salida.
- Reasoning effort.
- Número de llamadas.
- Tools.
- Retrieval.
- Red.
- Reintentos.
- Validaciones.
- Streaming.
- Paralelismo.

---

# 44. Latency Budget

```ts
export type LatencyBudget = {
  totalMs: number;

  routingMs: number;
  retrievalMs: number;
  modelMs: number;
  toolMs: number;
  validationMs: number;
};
```

---

# 45. Reducir llamadas

Analizar si varias llamadas pueden combinarse.

Ejemplo:

```text
clasificar intención
+ decidir RAG
+ generar query
```

puede ser una única salida estructurada si las evals lo permiten.

---

# 46. Paralelización

Adecuado para:

- Retrieval independiente.
- Moderación.
- Consultas de fuentes.
- Workers.
- Precarga.
- Cálculos deterministas.

No adecuado cuando:

- Una salida condiciona otra.
- Existen efectos conflictivos.
- Aumenta coste sin beneficio.
- Impide cancelación.
- Complica trazabilidad.

---

# 47. Streaming

Usar para:

- Explicaciones.
- Informes.
- Respuestas narrativas.
- Chat.

Evitar para:

- Tool arguments críticos.
- Outputs que deben validarse antes.
- Decisiones sensibles.
- Structured outputs breves.
- Contenido que debe moderarse por completo.

---

# 48. Context Budget

```ts
export type ContextBudget = {
  maximumTokens: number;

  systemTokens: number;
  toolTokens: number;
  retrievedTokens: number;
  memoryTokens: number;
  conversationTokens: number;

  reservedOutputTokens: number;
};
```

---

# 49. Context Window Engineering

No llenar toda la ventana.

Problemas:

- Coste.
- Latencia.
- Ruido.
- Prompt injection.
- Menor precisión.
- Context overflow.
- Pérdida de prioridad.

---

# 50. Context Overflow Policy

```ts
export type ContextOverflowPolicy = {
  strategy:
    | "summarize"
    | "retrieve_selectively"
    | "split_task"
    | "compress_tools"
    | "switch_model"
    | "fail";

  preserveCriticalFields: string[];
};
```

Nunca truncar silenciosamente:

- Importes.
- Fechas.
- Cláusulas.
- Referencias.
- Evidencias.
- Restricciones legales.
- IDs.
- Permisos.

---

# 51. Output Policy

```ts
export type OutputPolicy = {
  maximumOutputTokens: number;

  verbosity:
    | "short"
    | "medium"
    | "detailed";

  requireCitations: boolean;
  requireSources: boolean;
  requireUncertainty: boolean;
};
```

---

# 52. Batching

Usar para:

- Evaluaciones.
- Clasificaciones masivas.
- Embeddings.
- Procesamiento nocturno.
- Reindexación.
- Informes no urgentes.
- Dataset generation.

No usar para:

- Chat interactivo.
- Acciones urgentes.
- Aprobaciones.
- Workflows con SLA corto.

---

# 53. Multi-provider Engineering

Puede existir:

- OpenAI.
- Anthropic.
- Modelo local.
- Otro proveedor.

No crear una abstracción simplista:

```ts
generate(prompt);
```

Los proveedores difieren en:

- Tools.
- Schemas.
- Streaming.
- Reasoning.
- Caching.
- Tokens.
- Errores.
- Safety.
- Retención.
- Context.
- Modalidades.
- Batch.

---

# 54. Canonical Provider Adapter

```ts
export interface ModelProviderAdapter {
  generate(
    request: CanonicalModelRequest
  ): Promise<CanonicalModelResponse>;

  stream?(
    request: CanonicalModelRequest
  ): AsyncIterable<ModelStreamEvent>;

  supports(
    capability: ModelCapability
  ): boolean;
}
```

---

# 55. Canonical Model Request

```ts
export type CanonicalModelRequest = {
  taskType: string;

  instructions: string;
  input: ModelInputItem[];

  tools?: CanonicalToolDefinition[];

  outputSchema?: unknown;

  reasoningEffort: ReasoningEffort;

  budget: InferenceBudget;

  metadata: {
    tenantId: string;
    traceId: string;
    promptVersion: string;
    schemaVersion?: string;
  };
};
```

---

# 56. Canonical Model Response

```ts
export type CanonicalModelResponse = {
  provider: string;
  model: string;
  snapshot?: string;

  output: unknown;

  toolCalls: CanonicalToolCall[];

  refusal?: string;

  finishReason?: string;

  usage: {
    inputTokens: number;
    cachedInputTokens?: number;
    cacheWriteTokens?: number;
    outputTokens: number;
    reasoningTokens?: number;
  };

  latencyMs: number;
  estimatedCost: number;
};
```

---

# 57. Provider Error Normalization

```ts
export type ProviderError =
  | "rate_limit"
  | "timeout"
  | "unavailable"
  | "invalid_request"
  | "context_overflow"
  | "invalid_output"
  | "safety_refusal"
  | "authentication"
  | "unknown";
```

---

# 58. Model Fallback Policy

```ts
export type ModelFallbackPolicy = {
  id: string;
  version: string;

  primaryModelId: string;
  fallbackModelIds: string[];

  activationErrors: string[];

  maximumFallbackDepth: number;

  requiresEquivalentCapabilities: boolean;
  requiresPassedEvals: boolean;

  allowedRiskLevels: string[];
};
```

---

# 59. Requisitos de fallback

Debe ser compatible con:

- Tools.
- Schema.
- Modalidad.
- Context window.
- Reasoning.
- Seguridad.
- Coste.
- Latencia.
- Política de datos.
- Región.
- Retención.

---

# 60. Casos sin fallback automático

- Operación jurídica crítica.
- Pago o reembolso.
- Tool calling sensible.
- Modelo alternativo no evaluado.
- Diferencia de política de datos.
- Contexto no soportado.
- Sistema de alto riesgo.
- Resultado irreversible.

Respuesta:

```text
degradar
+ encolar
+ escalar
```

---

# 61. Failure Handling

Errores:

- Rate limit.
- Timeout.
- Invalid output.
- Refusal.
- Context overflow.
- Provider unavailable.
- Tool incompatibility.
- Safety block.
- Budget exceeded.
- Region unavailable.
- Policy violation.

Cada error debe mapearse a:

- Retry.
- Fallback.
- Wait.
- Queue.
- Degrade.
- Escalate.
- Fail.

---

# 62. Model Reliability Contract

```ts
export type ModelReliabilityContract = {
  modelId: string;

  taskTypes: string[];

  minimumEvalScores: Record<string, number>;

  timeoutMs: number;
  maximumRetries: number;

  supportsFallback: boolean;

  outputValidationRequired: boolean;
  semanticVerificationRequired: boolean;
};
```

---

# 63. Fine-tuning

Considerar cuando:

- Tarea estable.
- Volumen alto.
- Ejemplos de calidad.
- Necesidad de consistencia.
- Posible reducción de coste.
- Posible reducción de latencia.

No usar para:

- Datos vivos.
- Normativa cambiante.
- Reglas de negocio.
- Permisos.
- Datos privados dinámicos.
- Falta de RAG.
- Mala tool architecture.

---

# 64. Distillation

Proceso:

```text
Modelo capaz
  ↓
Generar ejemplos de calidad
  ↓
Curar dataset
  ↓
Entrenar/evaluar modelo menor
  ↓
Comparar
  ↓
Desplegar si mantiene calidad
```

---

# 65. Model Drift

Causas:

- Cambio de alias.
- Cambio de proveedor.
- Cambio de prompt.
- Cambio de datos.
- Cambio de tools.
- Cambio de usuarios.
- Cambio de idioma.
- Cambio de distribución de tareas.

Medir:

- Eval score.
- Tool accuracy.
- Refusals.
- Invalid outputs.
- Human corrections.
- Cost.
- Latency.
- Completion rate.

---

# 66. Inference Drift

Puede ocurrir por:

- Reasoning effort.
- Temperature.
- Tool choice.
- Context order.
- Schema.
- Cache.
- Output limit.
- Ejemplos.
- Retrieval.

Registrar todo.

---

# 67. Inference Configuration

```ts
export type InferenceConfiguration = {
  id: string;
  version: string;

  modelRouteId: string;
  promptDefinitionId: string;

  reasoningEffort: ReasoningEffort;

  maximumInputTokens: number;
  maximumOutputTokens: number;

  temperature?: number;

  toolPolicyId?: string;
  outputSchemaId?: string;
  cachePolicyId?: string;

  active: boolean;
};
```

---

# 68. Reproducibilidad práctica

Registrar:

- Modelo.
- Snapshot.
- Prompt.
- Prompt hash.
- Schema.
- Tools.
- Context builder.
- Retrieval version.
- Memory policy.
- Guardrails.
- Budgets.
- Routing reason.
- Output persistido.

No prometer mismas palabras.

---

# 69. Data Handling Requirement

```ts
export type DataHandlingRequirement = {
  containsPersonalData: boolean;
  containsSpecialCategoryData: boolean;
  containsConfidentialBusinessData: boolean;

  allowedProviders: string[];

  requiredRegion?: string;

  zeroRetentionRequired: boolean;
  localModelRequired?: boolean;
};
```

---

# 70. Privacy Routing

Puede obligar a:

- Proveedor específico.
- Región específica.
- Zero retention.
- Modelo local.
- Redacción previa.
- Exclusión de memoria.
- Menor contexto.
- Bloqueo.

---

# 71. Seguridad de inferencia

Controlar:

- Prompt injection.
- Tool injection.
- Exfiltración.
- Datos sensibles.
- Context poisoning.
- Output validation.
- Refusal handling.
- Provider retention.
- Multi-tenancy.

No enviar:

- Secrets.
- Credenciales.
- Datos de otros tenants.
- Tools no autorizadas.
- Documentos innecesarios.
- Tokens de acceso.

---

# 72. Cost Attribution

```ts
export type InferenceCostRecord = {
  tenantId: string;
  productType: string;

  taskType: string;
  featureId: string;

  modelId: string;

  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens?: number;
  outputTokens: number;
  reasoningTokens?: number;

  estimatedCost: number;

  successful: boolean;
};
```

---

# 73. Coste por resultado útil

Medir:

- Coste por estudio.
- Coste por expediente.
- Coste por recomendación aceptada.
- Coste por campaña analizada.
- Coste por acción verificada.
- Coste por documento procesado.
- Coste por usuario activo.
- Coste por tenant.

---

# 74. Cost Budget Policy

```ts
export type CostBudgetPolicy = {
  id: string;

  perRunMaximum: number;
  perTenantMonthlyMaximum: number;
  perFeatureMaximum: number;

  warningThreshold: number;
  hardStopThreshold: number;

  onLimit:
    | "downgrade_route"
    | "queue"
    | "block"
    | "escalate";
};
```

No degradar por debajo de la calidad mínima.

---

# 75. Model SLO

Ejemplos:

```text
classification_accuracy >= 97 %
structured_output_validity >= 99.9 %
tool_selection_accuracy >= 98 %
p95_latency <= objetivo
cost_per_successful_case <= límite
critical_false_action = 0
```

---

# 76. Aplicación a NORA

## Cálculo fiscal

```text
Modelo: ninguno.
Fuente: motor determinista.
```

## Resumen de estudio

```text
TAX_RESULT canónico
  ↓
modelo narrativo
  ↓
resumen
```

## Explicación jurídica compleja

```text
modelo de razonamiento
+ fuentes
+ límites
+ revisión
```

## Extracción documental

```text
vision/extraction model
+ schema
+ validación
+ confidence
```

---

# 77. NORA: regla de arquitectura

```text
Input normalizado
  ↓
Motor fiscal
  ↓
TAX_RESULT
  ↓
Modelo narrativo
  ↓
PDF
```

Nunca:

```text
Input
  ↓
Modelo
  ↓
Importe fiscal definitivo
```

---

# 78. NORA: Task Matrix

| Tarea | Solución |
|---|---|
| Cálculo ITP | Determinista |
| Beneficios fiscales | Motor de reglas |
| Resumen | Modelo intermedio |
| Comparación de escenarios | Motor + modelo narrativo |
| OCR | Modelo de visión/extracción |
| Explicación jurídica | Modelo de razonamiento + fuentes |
| PDF | Motor de plantillas |
| Clasificación documental | Modelo ligero |

---

# 79. Aplicación a EcomScaling IA

## Clasificación

Modelo ligero.

## Obtención de métricas

Tools deterministas.

## Rentabilidad

Código determinista.

## Interpretación

Modelo intermedio.

## Análisis multivariable

Modelo de razonamiento si mejora evals.

## Acción sobre campañas

```text
modelo
+ structured output
+ guardrails
+ HITL
+ workflow
+ verificación
```

---

# 80. EcomScaling: calidad entre planes

Growth y Scale pueden diferenciar:

- Usuarios.
- Tiendas.
- Volumen.
- Frecuencia.
- Automatizaciones.
- Retención.
- Integraciones.

No deben diferenciar:

- Exactitud mínima.
- Profundidad mínima.
- Seguridad.
- Calidad base.

---

# 81. Aplicación al CRM

## Búsqueda

- Retrieval.
- Query expansion si procede.

## Extracción

- Modelo con schema.
- Validación.

## Tareas

- Modelo intermedio.
- Tools limitadas.
- Dedupe.

## Contratos

- Modelo de razonamiento.
- Fuentes.
- Revisión.

## Comunicaciones

- Modelo narrativo.
- Plantilla.
- Revisión según riesgo.

## CRUD

- Modelo propone.
- Tool ejecuta.
- Servicio de dominio valida.

---

# 82. Task-to-Model Matrix orientativa

| Tarea | Solución |
|---|---|
| Cálculo fiscal | Determinista |
| Permisos | Determinista |
| Clasificación simple | Modelo ligero |
| Extracción | Modelo con schema |
| Resumen | Ligero/intermedio |
| Análisis complejo | Razonamiento |
| Decisión financiera | Solo apoyo |
| CRUD | Tool + dominio |
| Generación jurídica | Modelo + revisión |
| Routing | Reglas + modelo ligero |

---

# 83. Arquitectura técnica propuesta

```text
src/
  ai/
    inference/
      inference.types.ts
      inference.config.ts

      registry/
        model.registry.ts
        model-capability.registry.ts
        model-version.registry.ts

      routing/
        model-router.ts
        task-profiler.ts
        routing-policy.registry.ts

      providers/
        provider.interface.ts
        openai.adapter.ts
        anthropic.adapter.ts
        local-model.adapter.ts

      configuration/
        inference-config.registry.ts
        reasoning-policy.ts
        output-policy.ts
        context-budget.ts
        cost-budget.ts
        latency-budget.ts

      prompts/
        prompt-definition.ts
        prompt.registry.ts
        prompt-renderer.ts
        prompt-version.ts

      structured-output/
        schema.registry.ts
        output-parser.ts
        output-repair.ts
        semantic-validator.ts

      tools/
        inference-tool-policy.ts
        tool-capability-validator.ts

      caching/
        prompt-cache-policy.ts
        cache-metrics.ts

      fallbacks/
        model-fallback.registry.ts
        fallback-selector.ts

      evaluation/
        model-benchmark.service.ts
        model-comparison.service.ts
        regression-gate.ts

      deployment/
        shadow-mode.service.ts
        canary.service.ts
        rollout.service.ts
        rollback.service.ts

      observability/
        inference.metrics.ts
        inference.tracing.ts
        inference-cost.service.ts

      tests/
      evals/

      adapters/
        nora/
        ecommerce/
        crm/
```

Adaptar al repositorio real.

---

# 84. Persistencia orientativa

Posibles tablas:

```text
ai_model_registry
ai_model_versions
ai_model_capabilities
ai_inference_configurations
ai_model_routes
ai_prompt_definitions
ai_prompt_versions
ai_output_schemas
ai_model_eval_results
ai_model_rollouts
ai_inference_costs
ai_model_incidents
```

No crear sin analizar el esquema real.

---

# 85. Model Registry Table orientativa

```sql
CREATE TABLE ai_model_registry (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  model text NOT NULL,
  snapshot text,
  capabilities jsonb NOT NULL,
  allowed_task_types jsonb NOT NULL,
  prohibited_task_types jsonb NOT NULL,
  allowed_data_classes jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  deprecated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Adaptar a convenciones reales.

---

# 86. Prompt Version Table orientativa

```sql
CREATE TABLE ai_prompt_versions (
  id uuid PRIMARY KEY,
  prompt_id text NOT NULL,
  version text NOT NULL,
  content_hash text NOT NULL,
  file_path text NOT NULL,
  task_type text NOT NULL,
  compatible_models jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

# 87. Inference Configuration Table orientativa

```sql
CREATE TABLE ai_inference_configurations (
  id uuid PRIMARY KEY,
  version text NOT NULL,
  task_type text NOT NULL,
  model_route_id uuid NOT NULL,
  prompt_version_id uuid NOT NULL,
  reasoning_effort text NOT NULL,
  max_input_tokens integer NOT NULL,
  max_output_tokens integer NOT NULL,
  tool_policy_id uuid,
  output_schema_id uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

# 88. Model Eval Table orientativa

```sql
CREATE TABLE ai_model_eval_results (
  id uuid PRIMARY KEY,
  model_id uuid NOT NULL,
  task_type text NOT NULL,
  dataset_version text NOT NULL,
  accuracy_score numeric,
  tool_selection_score numeric,
  structured_output_score numeric,
  grounding_score numeric,
  average_latency_ms integer,
  average_cost numeric,
  passed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

# 89. Métricas técnicas

```text
model_requests_total
model_request_duration_ms
model_input_tokens_total
model_output_tokens_total
model_reasoning_tokens_total
model_cached_tokens_total
model_cache_write_tokens_total
model_cost_total
model_errors_total
model_refusals_total
model_invalid_outputs_total
model_fallbacks_total
model_routing_decisions_total
```

---

# 90. Métricas de calidad

```text
task_accuracy
structured_output_validity
tool_selection_accuracy
tool_argument_accuracy
grounding_score
hallucination_rate
human_override_rate
human_edit_rate
semantic_validation_failure_rate
```

---

# 91. Métricas de routing

- Modelo elegido.
- Motivo.
- Coste.
- Latencia.
- Accuracy.
- Fallback.
- Budget violation.
- Router confidence.
- Disagreement.
- Escalation.

---

# 92. Alertas críticas

- Cross-tenant.
- Modelo no aprobado.
- Tool incompatible.
- Schema bypass.
- Acción crítica incorrecta.
- Provider policy violation.
- Datos sensibles enviados a proveedor prohibido.
- Fallback no evaluado.

---

# 93. Alertas altas

- Caída de accuracy.
- Invalid output spike.
- Cost anomaly.
- Latency spike.
- Fallback spike.
- Refusal spike.
- Human override spike.
- Canary underperformance.

---

# 94. Alertas medias

- Context growth.
- Output growth.
- Modelo antiguo activo.
- Cache writes sin reutilización.
- Prompt version antigua.
- Reasoning cost creciendo.
- Tool calls por run aumentando.

---

# 95. Unit Tests

- Task profiling.
- Routing.
- Budget enforcement.
- Schema parsing.
- Semantic validation.
- Fallback selection.
- Cost calculation.
- Prompt rendering.
- Provider normalization.
- Data handling.
- Snapshot pinning.

---

# 96. Integration Tests

- Provider call.
- Structured output.
- Tool call.
- Refusal.
- Timeout.
- Fallback.
- Streaming.
- Cache metrics.
- Snapshot.
- Multi-provider.
- Region policy.
- Zero-retention policy.

---

# 97. Evals

Evaluar:

- Accuracy.
- Tool selection.
- Tool arguments.
- Reasoning.
- Grounding.
- Safety.
- Cost.
- Latency.
- Robustness.
- Spanish quality.
- Product-specific quality.
- Tenant-specific edge cases.

---

# 98. Model Migration Tests

Antes de cambiar modelo:

- Dataset completo.
- Casos difíciles.
- Casos adversariales.
- Tool calls.
- Structured outputs.
- Refusals.
- Coste.
- Latencia.
- Context limits.
- Idiomas.
- Tenants.
- Modalidades.
- Fallback.
- Safety.
- Privacy.

---

# 99. Shadow Mode

```text
Modelo estable
→ respuesta real

Modelo candidato
→ ejecución paralela sin efecto
```

Comparar:

- Output.
- Tools.
- Coste.
- Latencia.
- Refusals.
- Correcciones.
- Grounding.
- Human preference.

---

# 100. Canary Release

Ejemplo:

```text
1 %
  ↓
5 %
  ↓
20 %
  ↓
50 %
  ↓
100 %
```

Detener si:

- Baja calidad.
- Suben errores.
- Suben costes.
- Falla schema.
- Cambia tool behavior.
- Aumentan overrides.
- Aumenta latencia.
- Aparecen incidencias.

---

# 101. Rollout Policy

```ts
export type ModelRolloutPolicy = {
  shadowModeRequired: boolean;

  canaryPercentages: number[];

  minimumRunsPerStage: number;

  rollbackThresholds: {
    accuracyDrop: number;
    costIncrease: number;
    latencyIncrease: number;
    invalidOutputIncrease: number;
  };
};
```

---

# 102. Rollback

Debe poder restaurar:

- Modelo.
- Snapshot.
- Prompt.
- Schema.
- Tool policy.
- Reasoning effort.
- Context policy.
- Cache policy.
- Routing policy.

---

# 103. Quality Gates

Bloquear release si:

- No existe dataset.
- No existe objetivo de calidad.
- Modelo no registrado.
- Prompt no versionado.
- Schema no versionado.
- Falla tool calling.
- Falla structured output.
- Coste supera límite.
- Latencia supera límite.
- No existe fallback.
- No existe rollback.
- No existe observabilidad.
- No existe canary.
- No existe privacy review.
- No existe multi-tenant test.

---

# 104. Fase 0 — Análisis exhaustivo

Analizar:

- Agentes.
- Task types.
- Modelos.
- Proveedores.
- Prompts.
- Schemas.
- Tools.
- Evals.
- Costes.
- Latencia.
- Privacy.
- Routing.
- Fallback.
- Despliegue.

Entregables:

- Diagnóstico.
- Inventarios.
- Matrices.
- Arquitectura.
- Persistencia.
- Archivos.
- Fases.
- Tests.
- Evals.
- Métricas.
- Alertas.

No implementar todavía.

---

# 105. Fase 1 — Contratos

Crear:

- `InferenceTaskProfile`.
- `ModelRegistryEntry`.
- `ModelRoute`.
- `InferenceBudget`.
- `InferenceConfiguration`.
- `CanonicalModelRequest`.
- `CanonicalModelResponse`.

---

# 106. Fase 2 — Model Registry

Implementar:

- Registro.
- Capabilities.
- Snapshots.
- Aliases.
- Policies.
- Prohibiciones.

---

# 107. Fase 3 — Task Profiler

Implementar:

- Clasificación.
- Complejidad.
- Modalidad.
- Riesgo.
- Output type.
- Privacy requirements.

---

# 108. Fase 4 — Model Router

Implementar:

- Reglas deterministas.
- Fallback ligero.
- Routing reasons.
- Tests.

---

# 109. Fase 5 — Prompt Registry

Implementar:

- Versiones.
- Hashes.
- Compatibilidad.
- Owner.
- Dataset.

---

# 110. Fase 6 — Structured Outputs

Implementar:

- Schema registry.
- Parser.
- Validation.
- Semantic validation.
- Repair controlado.

---

# 111. Fase 7 — Budgets

Implementar:

- Input.
- Output.
- Reasoning.
- Coste.
- Latencia.
- Calls.
- Tools.

---

# 112. Fase 8 — Tool Policies

Implementar:

- Allowed tools.
- Required tools.
- Prohibited tools.
- Compatibility.
- Approval requirements.

---

# 113. Fase 9 — Fallback

Implementar:

- Policies.
- Compatibility.
- Evals.
- Degradation.
- Alerts.

---

# 114. Fase 10 — Cost Attribution

Implementar:

- Tenant.
- Feature.
- Product.
- Agent.
- Workflow.
- Task type.
- Cost per success.

---

# 115. Fase 11 — Shadow y Canary

Implementar:

- Shadow.
- Comparison.
- Canary.
- Rollback.
- Gates.

---

# 116. Fase 12 — Segundo producto

Reutilizar núcleo con adaptadores.

---

# 117. Criterios de aceptación

- [ ] Se realizó análisis previo.
- [ ] Existe taxonomía de tareas.
- [ ] Existe Model Registry.
- [ ] Existen capabilities.
- [ ] Existe versionado.
- [ ] Existe routing.
- [ ] Existe reasoning policy.
- [ ] Existe inference budget.
- [ ] Existe context budget.
- [ ] Existe output policy.
- [ ] Existen Structured Outputs.
- [ ] Existe semantic validation.
- [ ] Existe Tool Policy.
- [ ] Existe Provider Adapter.
- [ ] Existe fallback.
- [ ] Existe privacy routing.
- [ ] Existe cost attribution.
- [ ] Existe observabilidad.
- [ ] Existen evals.
- [ ] Existe shadow.
- [ ] Existe canary.
- [ ] Existe rollback.
- [ ] NORA mantiene cálculo determinista.
- [ ] EcomScaling mantiene calidad entre planes.
- [ ] CRM no ejecuta acciones críticas directamente desde el modelo.
- [ ] Se validó en producto real.

---

# 118. Instrucciones directas para Codex

## Misión

Diseñar e integrar una arquitectura transversal de Model & Inference Engineering adaptada al SaaS real.

## Regla obligatoria

Antes de implementar, analiza:

- Repositorio.
- Agents.
- Task types.
- Models.
- Providers.
- Prompts.
- Schemas.
- Tools.
- RAG.
- Memory.
- Budgets.
- Cost.
- Latency.
- Evals.
- Privacy.
- Multi-tenancy.
- Rollouts.

## Restricciones

1. No implementar antes del análisis.
2. No usar un único modelo global.
3. No elegir por benchmark general.
4. No cambiar modelo sin evals.
5. No usar texto libre para código.
6. No confundir JSON con schema.
7. No exponer todas las tools.
8. No permitir modelos no aprobados.
9. No usar fallback sin evals.
10. No diferenciar calidad mínima por plan.
11. No mandar datos a proveedores prohibidos.
12. No guardar secretos.
13. No llenar contexto sin límites.
14. No marcar terminado sin canary y rollback.
15. Documentar desviaciones.
16. Adaptar al producto real.

---

# 119. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio y el producto para diseñar una
arquitectura de Model & Inference Engineering adaptada al sistema real.

No implementes todavía un Model Router.

Objetivos:

1. Identificar agentes.
2. Identificar task types.
3. Identificar modelos.
4. Identificar proveedores.
5. Identificar prompts.
6. Identificar schemas.
7. Identificar tools.
8. Identificar context builders.
9. Identificar memory usage.
10. Identificar RAG.
11. Identificar reasoning configs.
12. Identificar budgets.
13. Identificar fallbacks.
14. Identificar snapshots.
15. Identificar aliases.
16. Identificar evals.
17. Identificar costes.
18. Identificar latencias.
19. Identificar privacy requirements.
20. Identificar data residency.
21. Identificar planes comerciales.
22. Proponer task taxonomy.
23. Proponer Model Registry.
24. Proponer capability registry.
25. Proponer Task Profile.
26. Proponer Model Router.
27. Proponer Reasoning Policy.
28. Proponer Inference Budget.
29. Proponer Prompt Registry.
30. Proponer Schema Registry.
31. Proponer Tool Policy.
32. Proponer Provider Adapters.
33. Proponer Fallback Policy.
34. Proponer Cost Attribution.
35. Proponer Shadow.
36. Proponer Canary.
37. Proponer Rollback.
38. Proponer arquitectura.
39. Proponer persistencia.
40. Proponer archivos.
41. Proponer fases.
42. Proponer tests.
43. Proponer evals.
44. Proponer métricas.
45. Proponer alertas.

Antes de modificar código, entrega:

a) diagnóstico,
b) inventario de modelos,
c) inventario de prompts,
d) matriz task-to-model,
e) matriz model-to-capability,
f) matriz de privacidad,
g) matriz de fallback,
h) arquitectura,
i) persistencia,
j) archivos exactos.

Restricciones:

- No inventes componentes.
- No implementes todavía.
- No copies arquitectura genérica.
- No marques terminado sin validación.
```

---

# 120. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de
Model & Inference Engineering.

Implementa solo:

1. Contratos comunes.
2. Model Registry.
3. Capability Registry.
4. Task Profiler.
5. Routing determinista para tres task types.
6. Prompt Registry.
7. Un Structured Output.
8. Inference Budget.
9. Cost Attribution.
10. Tests.

No implementes todavía:

- Multi-provider completo.
- Fine-tuning.
- Distillation.
- Dynamic routing global.
- Canary global.
- Segundo producto.
- Acciones críticas.

Reutiliza el análisis previo y documenta cualquier desviación.
```

---

# 121. ADR recomendados

- ADR: task taxonomy.
- ADR: model registry.
- ADR: model routing.
- ADR: reasoning effort.
- ADR: model snapshots.
- ADR: prompt versioning.
- ADR: schema versioning.
- ADR: structured outputs.
- ADR: tool compatibility.
- ADR: inference budgets.
- ADR: context budgets.
- ADR: provider abstraction.
- ADR: fallback.
- ADR: privacy routing.
- ADR: cost attribution.
- ADR: shadow mode.
- ADR: canary.
- ADR: rollback.
- ADR: quality gates.
- ADR: plan quality parity.

---

# 122. Definición de terminado

Una capacidad de inferencia está terminada cuando:

1. Se analizó la tarea.
2. Se definió el objetivo de calidad.
3. Se definió el modelo.
4. Se definió el snapshot.
5. Se definió el prompt.
6. Se definió el schema.
7. Se definió el reasoning effort.
8. Se definió el context budget.
9. Se definió el output budget.
10. Se definió el cost budget.
11. Se definió el tool policy.
12. Se definió el fallback.
13. Se definió privacy routing.
14. Se definieron evals.
15. Se definieron métricas.
16. Se definieron alertas.
17. Se probó shadow.
18. Se probó canary.
19. Existe rollback.
20. Se validó en producto real.

---

# 123. Resumen ejecutivo

La secuencia correcta es:

```text
CLASIFICAR TAREA
  ↓
APLICAR POLÍTICA
  ↓
ELEGIR MODELO
  ↓
FIJAR CONFIGURACIÓN
  ↓
APLICAR BUDGET
  ↓
EJECUTAR
  ↓
VALIDAR SCHEMA
  ↓
VALIDAR SEMÁNTICA
  ↓
MEDIR
  ↓
EVALUAR
  ↓
ROLLOUT CONTROLADO
```

La plataforma común debe proporcionar:

- Task Profiler.
- Model Registry.
- Capability Registry.
- Model Router.
- Prompt Registry.
- Schema Registry.
- Provider Adapters.
- Reasoning Policy.
- Context Budget.
- Cost Budget.
- Tool Policy.
- Fallback Registry.
- Cost Attribution.
- Evaluation Service.
- Shadow Mode.
- Canary.
- Rollback.

Cada producto debe aportar:

- Task types.
- Quality targets.
- Schemas.
- Prompts.
- Tools.
- Context sources.
- Risk levels.
- Privacy requirements.
- Product-specific evals.

Model & Inference Engineering no es:

```text
usar el mejor modelo
```

Es:

```text
usar el modelo y la configuración
que cumplen el objetivo de una tarea
con el menor coste y latencia razonables
sin reducir seguridad ni calidad
```
