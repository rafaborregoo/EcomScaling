# Observability & Tracing para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica, operativa, de seguridad y cumplimiento
- **Ámbito:** SaaS, CRM, copilotos, agentes, workflows, tools, RAG, memoria, Human-in-the-Loop y sistemas multi-tenant
- **Casos de referencia:** EcomScaling IA y CRM/SaaS
- **Fecha de referencia:** 29 de julio de 2026
- **Objetivo:** implementar una capa integral de observabilidad y trazabilidad que permita reconstruir, medir, depurar, evaluar y auditar la conducta de los agentes
- **Audiencia:** Codex, arquitectura, backend, IA, seguridad, QA, DevOps, legal, privacidad, producto y operaciones
- **Prioridad:** crítica
- **Idioma:** castellano
- **Principio rector:** ninguna acción de un agente debe depender únicamente de lo que el propio agente afirma haber hecho; la plataforma debe conservar evidencia técnica suficiente para reconstruir lo ocurrido

---

# 1. Propósito

Este documento define cómo diseñar e implementar **Observability & Tracing for Agents** en una plataforma SaaS con agentes de IA.

La arquitectura debe ser reutilizable entre productos diferentes, entre ellos:

- SaaS de analítica y escalado de tiendas.
- CRM/SaaS operativo.
- Copilotos empresariales.
- Agentes especializados.
- Plataformas documentales.
- Workflows con aprobación humana.
- Sistemas con RAG.
- Sistemas con memoria.
- Sistemas multiagente.
- Procesos de larga duración.
- Automatizaciones basadas en eventos.
- Productos multi-tenant.

La infraestructura común debe permitir responder:

- Qué pidió el usuario.
- Qué objetivo entendió el sistema.
- Qué actor estaba autenticado.
- Qué tenant era aplicable.
- Qué agente y versión actuaron.
- Qué modelo se utilizó.
- Qué prompt y configuración estaban activos.
- Qué contexto se construyó.
- Qué documentos se recuperaron.
- Qué memorias se utilizaron.
- Qué tools se expusieron.
- Qué tools se llamaron.
- Con qué argumentos.
- Qué permisos y políticas se evaluaron.
- Qué aprobaciones se solicitaron.
- Qué decisiones humanas se produjeron.
- Qué efectos se ejecutaron.
- Qué verificación se realizó.
- Qué errores aparecieron.
- Cuánto costó.
- Cuánto tardó.
- Por qué terminó.
- Qué resultado produjo.

---

# 2. Regla obligatoria de análisis previo

## 2.1 Principio

Antes de instrumentar el sistema, Codex debe analizar exhaustivamente el producto real.

No debe añadirse tracing de manera indiscriminada.

La observabilidad debe adaptarse a:

- Arquitectura.
- Stack.
- Proveedores de modelos.
- Agentes.
- Tools.
- Workflows.
- RAG.
- Memoria.
- Eventos.
- Jobs.
- Colas.
- Multi-tenancy.
- Permisos.
- Datos sensibles.
- RGPD.
- Reglamento de IA.
- Infraestructura.
- Entornos.
- Requisitos de soporte.
- Requisitos de auditoría.
- Coste de almacenamiento.
- Retención.
- Volumen.
- Riesgo.

## 2.2 Prohibiciones

Codex no debe:

- Registrar todo por defecto.
- Guardar prompts completos sin analizar privacidad.
- Guardar outputs completos sin analizar privacidad.
- Registrar secretos.
- Registrar tokens o credenciales.
- Utilizar logs de texto libre como única fuente.
- Confiar únicamente en logs del proveedor de IA.
- Crear una arquitectura acoplada a un único proveedor.
- Mezclar observabilidad, auditoría y evals en una única tabla sin distinguir finalidad.
- Inventar periodos de retención.
- Aceptar `tenantId` desde el modelo.
- Exponer trazas entre tenants.
- Omitir correlación con backend, DB y APIs.
- Omitir las versiones de prompts, tools y políticas.
- Registrar razonamiento interno completo del modelo.
- Usar trazas como sustituto de controles de seguridad.
- Dar por verificado un efecto porque una tool devolvió éxito.
- Implementar dashboards antes de definir eventos y métricas.
- Crear alertas sin playbooks.
- Marcar como terminado sin probar redacción, aislamiento y pérdida de telemetría.

## 2.3 Entregables previos

Antes de modificar código, Codex debe entregar:

1. Mapa de arquitectura.
2. Mapa de agentes.
3. Mapa de workflows.
4. Mapa de tools.
5. Mapa de RAG.
6. Mapa de memoria.
7. Mapa de HITL.
8. Mapa de eventos.
9. Mapa de jobs y colas.
10. Mapa de proveedores externos.
11. Mapa de logs actuales.
12. Mapa de métricas actuales.
13. Mapa de trazas actuales.
14. Mapa de datos sensibles.
15. Mapa de retención.
16. Mapa de permisos.
17. Mapa de incidentes.
18. Mapa de costes.
19. Matriz de instrumentación propuesta.
20. Arquitectura de exportación.
21. Política de redacción.
22. Política de sampling.
23. Política de retención.
24. SLI y SLO propuestos.
25. Alertas y playbooks propuestos.

No debe implementarse antes de revisar este análisis.

---

# 3. Definición

**Observability & Tracing** es la disciplina que permite comprender el estado interno y la conducta de un sistema a partir de sus señales externas.

Para agentes, debe cubrir:

```text
Logs
+
Métricas
+
Traces
+
Spans
+
Eventos
+
Feedback
+
Evals
+
Auditoría
```

Fórmula conceptual:

```text
Observabilidad fiable =
instrumentación
+ correlación
+ contexto técnico
+ redacción
+ métricas
+ alertas
+ trazas
+ retención
+ análisis
```

---

# 4. Observabilidad, auditoría y evals

No son lo mismo.

## 4.1 Observabilidad operativa

Finalidad:

- Depurar.
- Monitorizar.
- Detectar degradaciones.
- Medir rendimiento.
- Investigar errores.

Ejemplo:

```text
La llamada a get_campaign_metrics tardó 3,4 segundos.
```

## 4.2 Auditoría

Finalidad:

- Demostrar quién hizo qué.
- Reconstruir decisiones.
- Acreditar permisos.
- Acreditar aprobación.
- Investigar incidentes.
- Cumplir obligaciones.

Ejemplo:

```text
La usuaria con permiso reservations.cancel aprobó la cancelación
de reservation_18 con el hash de argumentos X.
```

## 4.3 Evals

Finalidad:

- Puntuar calidad.
- Comparar versiones.
- Detectar regresiones.
- Bloquear releases.

Ejemplo:

```text
La versión v3 seleccionó la tool correcta en el 97 % de casos.
```

## 4.4 Regla

Una misma ejecución puede alimentar las tres capas.

Pero deben diferenciarse:

- Finalidad.
- Acceso.
- Retención.
- Esquema.
- Sensibilidad.
- Inmutabilidad.
- Uso.

---

# 5. Señales fundamentales

## 5.1 Logs

Acontecimientos individuales.

Ejemplos:

```text
Context Builder iniciado.
Tool ejecutada.
Aprobación requerida.
Verificación fallida.
```

## 5.2 Métricas

Valores agregables.

Ejemplos:

```text
agent_runs_total
agent_run_duration_ms
tool_errors_total
model_input_tokens
approval_latency_ms
```

## 5.3 Traces

Recorrido completo de una operación.

## 5.4 Spans

Operaciones individuales dentro de la trace.

## 5.5 Eventos

Acontecimientos semánticos del dominio o de la plataforma.

Ejemplos:

```text
recommendation_approved
reservation_cancelled
agent_no_progress_detected
```

---

# 6. Trace

Una trace representa una operación lógica end-to-end.

Ejemplos:

```text
Analizar campañas de una tienda.
Preparar un expediente.
Cancelar una reserva.
Crear un informe.
```

```ts
export type AgentTrace = {
  traceId: string;

  requestId: string;
  runId: string;
  workflowId?: string;
  threadId?: string;
  groupId?: string;

  tenantId: string;
  actorId: string;

  environment:
    | "local"
    | "development"
    | "staging"
    | "production";

  productType: string;
  workflowName: string;
  taskType: string;

  status: TraceStatus;

  startedAt: string;
  endedAt?: string;
  durationMs?: number;

  rootSpanId: string;

  metadata: Record<string, unknown>;
};
```

---

# 7. Estados de trace

```ts
export type TraceStatus =
  | "running"
  | "waiting_for_user"
  | "waiting_for_approval"
  | "partially_completed"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";
```

No reducir todo a:

```text
success
error
```

El estado debe reflejar procesos reales.

---

# 8. Span

Un span representa una operación dentro de una trace.

```ts
export type AgentSpan = {
  spanId: string;
  traceId: string;
  parentSpanId?: string;

  name: string;
  type: AgentSpanType;

  status:
    | "unset"
    | "ok"
    | "error";

  startedAt: string;
  endedAt?: string;
  durationMs?: number;

  attributes: Record<string, unknown>;
  events: SpanEvent[];
  links?: SpanLink[];
};
```

---

# 9. Tipos de spans

```ts
export type AgentSpanType =
  | "http"
  | "workflow"
  | "agent"
  | "model"
  | "tool"
  | "retrieval"
  | "reranking"
  | "context_build"
  | "context_compression"
  | "memory_read"
  | "memory_write"
  | "routing"
  | "guardrail"
  | "authorization"
  | "approval"
  | "human_review"
  | "handoff"
  | "worker"
  | "verification"
  | "database"
  | "external_api"
  | "queue"
  | "job"
  | "event"
  | "custom";
```

---

# 10. Jerarquía recomendada

```text
TRACE: case_preparation
│
├── HTTP request
├── authenticate_actor
├── resolve_tenant
├── classify_intent
├── select_loop
├── build_context
│   ├── retrieve_reservation
│   ├── retrieve_documents
│   ├── retrieve_checklist
│   ├── retrieve_memory
│   └── compress_context
│
├── agent_run
│   ├── model_turn
│   ├── tool_call
│   │   ├── authorize_tool
│   │   ├── execute_service
│   │   └── validate_result
│   └── model_turn
│
├── human_review
├── revalidate_action
├── execute_action
├── verify_action
├── emit_domain_event
└── final_response
```

---

# 11. Correlation Context

Todos los componentes deben compartir identificadores.

```ts
export type CorrelationContext = {
  requestId: string;
  traceId: string;
  runId: string;

  workflowId?: string;
  threadId?: string;
  groupId?: string;

  tenantId: string;
  actorId: string;

  causationId?: string;
  correlationId?: string;
};
```

## Propagación

Debe propagarse a:

- HTTP.
- WebSocket.
- SSE.
- Jobs.
- Colas.
- Eventos.
- DB.
- APIs.
- Workers.
- Subagentes.
- Webhooks.

---

# 12. Trace Context en trabajos asíncronos

Cuando una ejecución continúa en una cola:

```text
HTTP trace
  ↓
enqueue job
  ↓
job trace vinculada
```

Usar:

- `traceparent`
- `tracestate`
- Span links.
- `correlationId`
- `causationId`

No asumir que un job pertenece al mismo proceso.

---

# 13. OpenTelemetry como capa neutral

La arquitectura recomendada debe utilizar OpenTelemetry o una abstracción compatible.

```text
Aplicación
  ↓
OpenTelemetry SDK
  ↓
OpenTelemetry Collector
  ├── almacenamiento interno
  ├── proveedor de APM
  ├── plataforma de IA
  └── archivo de auditoría
```

Ventajas:

- Vendor neutrality.
- Correlación con backend.
- Exportadores múltiples.
- Convenciones comunes.
- Sampling centralizado.
- Migración más sencilla.
- Instrumentación manual y automática.

---

# 14. Convenciones semánticas GenAI

Las convenciones GenAI de OpenTelemetry continúan evolucionando.

Por tanto:

1. Crear un esquema canónico interno.
2. Versionarlo.
3. Crear un adaptador OpenTelemetry.
4. No dispersar atributos experimentales por el código.
5. Registrar la versión de convenciones utilizada.

Ejemplos actuales de operaciones GenAI:

```text
chat
embeddings
execute_tool
generate_content
invoke_agent
invoke_workflow
retrieval
```

## Contrato interno

```ts
export type GenAiTelemetryAttributes = {
  operationName: string;

  providerName?: string;

  requestModel?: string;
  responseModel?: string;

  agentId?: string;
  agentName?: string;
  agentVersion?: string;

  workflowName?: string;

  conversationId?: string;

  inputTokens?: number;
  outputTokens?: number;

  outputType?: string;

  finishReasons?: string[];

  errorType?: string;
};
```

---

# 15. Adaptador OpenTelemetry

```ts
export interface TelemetryAttributeAdapter {
  toOtel(
    attributes: GenAiTelemetryAttributes
  ): Record<string, string | number | boolean>;
}
```

El adaptador debe permitir cambiar de versión sin modificar la lógica de negocio.

---

# 16. Integración con OpenAI Agents SDK

Si se utiliza OpenAI Agents SDK:

- Aprovechar tracing de generaciones.
- Aprovechar spans de tools.
- Aprovechar spans de guardrails.
- Aprovechar spans de handoffs.
- Añadir spans propios para RAG, memoria, políticas y dominio.
- Configurar procesadores personalizados.
- Decidir si se exporta también a un backend propio.
- Gestionar flush en workers cuando sea necesario.
- Analizar Zero Data Retention antes de depender del tracing alojado.

No depender exclusivamente del dashboard del proveedor.

---

# 17. Integración con LangChain o LangGraph

Si se utiliza LangChain/LangGraph:

- Instrumentar traces de agente.
- Registrar runs por nodo.
- Adjuntar tags y metadata.
- Aplicar anonymizers.
- Mantener correlación con OpenTelemetry.
- No duplicar indiscriminadamente prompts completos.
- Vincular threads.
- Instrumentar nodos custom.

No convertir LangSmith en la única fuente de auditoría legal.

---

# 18. Arquitectura multi-proveedor

```ts
export interface TraceExporter {
  exportTrace(trace: AgentTrace): Promise<void>;
  exportSpans(spans: AgentSpan[]): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
```

Implementaciones posibles:

```text
OtelTraceExporter
OpenAiTraceExporter
LangSmithTraceExporter
InternalTraceExporter
AuditTraceExporter
```

La selección debe configurarse por entorno.

---

# 19. Instrumentación automática y manual

## Automática

Adecuada para:

- HTTP.
- DB.
- OpenAI SDK.
- LangChain.
- Colas.
- Framework web.

## Manual

Necesaria para:

- Selección de loop.
- Context Builder.
- Tool Policy.
- Memory Policy.
- HITL.
- Verificación.
- Síntesis.
- Decisiones de negocio.
- Fallos semánticos.

Una arquitectura solo automática no entiende el dominio.

---

# 20. Instrumentación del agente

```ts
export type AgentTraceAttributes = {
  agentId: string;
  agentName: string;
  agentVersion: string;

  taskType: string;
  loopType: string;
  orchestrationPattern: string;

  maxSteps: number;
  actualSteps: number;

  completionStatus: string;
  completionReason: string;

  modelCalls: number;
  toolCalls: number;
};
```

---

# 21. Instrumentación del modelo

```ts
export type ModelSpanAttributes = {
  provider: string;
  requestModel: string;
  responseModel?: string;

  temperature?: number;
  maxOutputTokens?: number;

  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;

  latencyMs: number;

  finishReason?: string;
  responseId?: string;

  promptVersion: string;
  systemInstructionVersion: string;

  estimatedCost?: number;
};
```

No registrar secretos.

---

# 22. Instrumentación de prompts

Debe registrarse:

- Prompt ID.
- Prompt version.
- Hash.
- Template variables permitidas.
- Feature.
- Entorno.

No es obligatorio guardar siempre el texto completo.

```ts
export type PromptTraceReference = {
  promptId: string;
  promptVersion: string;
  promptHash: string;
  capturedContent: boolean;
  contentReferenceId?: string;
};
```

---

# 23. Instrumentación de tools

```ts
export type ToolTraceData = {
  toolName: string;
  toolVersion: string;

  toolGroup: string;
  category: string;
  riskLevel: string;

  inputSchemaVersion: string;
  outputSchemaVersion: string;

  argumentsHash: string;
  normalizedArgumentsReference?: string;

  requiredPermissions: string[];
  authorizationDecision: string;

  idempotencyKey?: string;

  startedAt: string;
  endedAt?: string;
  durationMs?: number;

  resultStatus:
    | "success"
    | "partial"
    | "failed";

  retryCount: number;

  verificationStatus?:
    | "not_required"
    | "passed"
    | "failed";

  errorCode?: string;
};
```

---

# 24. Tool call y servicio de dominio

Debe existir trazabilidad separada:

```text
tool_call
  ↓
authorization
  ↓
domain_service
  ↓
database
  ↓
external_api
  ↓
verification
```

Así puede diferenciarse:

- Tool incorrecta.
- Servicio fallido.
- API externa fallida.
- Verificación fallida.

---

# 25. Instrumentación de RAG

```ts
export type RetrievalTraceData = {
  retrievalProvider: string;
  indexId: string;
  indexVersion?: string;

  queryHash: string;
  queryCaptured: boolean;

  filters: Record<string, unknown>;

  requestedLimit: number;
  retrievedCount: number;
  selectedCount: number;

  retrievedChunkIds: string[];
  selectedChunkIds: string[];

  scores?: number[];

  reranker?: string;
  rerankerVersion?: string;

  tenantFilterApplied: boolean;
  permissionFilterApplied: boolean;
  freshnessFilterApplied: boolean;

  latencyMs: number;
};
```

---

# 26. Instrumentación de documentos

Registrar:

- Documento.
- Versión.
- Chunk.
- Fuente.
- Tenant.
- Permiso.
- Fecha.
- Vigencia.
- Selección.

No guardar necesariamente el documento completo en la trace.

---

# 27. Instrumentación del Context Builder

```ts
export type ContextBuildTraceData = {
  contextPackId: string;
  contextPackVersion: string;

  taskType: string;

  sourcesRequested: string[];
  sourcesLoaded: string[];

  resourceIds: string[];
  documentChunkIds: string[];
  memoryIds: string[];

  factsIncluded: number;
  factsExcluded: number;

  inputTokensEstimated: number;
  outputTokensEstimated: number;

  compressionApplied: boolean;
  truncationApplied: boolean;

  tenantIsolationPassed: boolean;

  missingRequiredFacts: string[];
  staleFactsExcluded: string[];
};
```

---

# 28. Instrumentación de memoria

## Lectura

```ts
export type MemoryReadTraceData = {
  queryId: string;
  scopes: string[];
  memoryTypes: string[];

  candidates: number;
  selected: number;

  selectedMemoryIds: string[];

  staleExcluded: number;
  conflictCount: number;

  tenantFilterApplied: boolean;
  permissionFilterApplied: boolean;
};
```

## Escritura

```ts
export type MemoryWriteTraceData = {
  candidateId: string;
  memoryType: string;
  scope: string;

  sourceType: string;
  confidence: number;

  policyDecision:
    | "stored"
    | "rejected"
    | "approval_required";

  memoryId?: string;
  rejectionReason?: string;
};
```

---

# 29. Instrumentación de routing

```ts
export type RoutingTraceData = {
  routerId: string;
  routerVersion: string;

  candidateRoutes: string[];
  selectedRoute: string;

  confidence?: number;
  reasonCode: string;

  deterministic: boolean;
  clarificationRequired: boolean;
};
```

---

# 30. Instrumentación del loop

Registrar:

- Loop seleccionado.
- Máximo de pasos.
- Paso actual.
- Progreso.
- Repetición.
- Replanificación.
- Criterio de parada.
- Motivo de finalización.

```ts
export type LoopTraceData = {
  loopType: string;
  stepNumber: number;

  maxSteps: number;
  maxToolCalls: number;

  progressDetected: boolean;
  repeatedStateDetected: boolean;

  replanned: boolean;

  completionReason?: string;
};
```

---

# 31. Instrumentación de orquestación

```ts
export type OrchestrationTraceData = {
  pattern: string;

  workflowId: string;
  workflowVersion: string;

  nodeId: string;
  nodeType: string;

  workerCount: number;
  parallelism: number;

  delegationDepth: number;
  handoffCount: number;

  checkpointCreated: boolean;
};
```

---

# 32. Instrumentación de workers

Registrar:

- Objetivo delegado.
- Scope.
- Restricciones.
- Contexto recibido.
- Budget.
- Resultado.
- Evidencias.
- Coste.
- Duración.
- Estado parcial.
- Errores.

No registrar únicamente:

```text
Worker completado.
```

---

# 33. Instrumentación de handoffs

```ts
export type HandoffTraceData = {
  fromAgentId: string;
  toAgentId: string;

  reasonCode: string;

  contextTransferredReference?: string;
  contextTokenCount: number;

  conversationControlTransferred: boolean;

  returnExpected: boolean;
};
```

---

# 34. Instrumentación de guardrails

```ts
export type GuardrailTraceData = {
  guardrailId: string;
  guardrailVersion: string;

  category:
    | "input"
    | "tool_selection"
    | "arguments"
    | "volume"
    | "financial"
    | "output"
    | "persistence"
    | "security";

  decision:
    | "allow"
    | "deny"
    | "transform"
    | "approval_required";

  reasons: string[];
  riskLevel: string;

  evaluatedAt: string;
};
```

---

# 35. Instrumentación de autorización

```ts
export type AuthorizationTraceData = {
  policyIds: string[];
  policyVersions: string[];

  action: string;
  resourceType?: string;
  resourceId?: string;

  requiredPermissions: string[];

  decision:
    | "allow"
    | "deny"
    | "approval_required";

  reasonCodes: string[];

  tenantCheckPassed: boolean;
  resourceAccessPassed: boolean;
  stateCheckPassed: boolean;
};
```

---

# 36. Instrumentación HITL

Registrar:

- Interrupt.
- Política.
- Acción propuesta.
- Hash.
- Impacto.
- Revisor.
- Autoridad.
- Decisión.
- Edición.
- Expiración.
- Revalidación.
- Ejecución.
- Verificación.

```ts
export type HumanReviewTraceData = {
  interruptId: string;
  policyId: string;
  policyVersion: string;

  reviewType: string;

  requestedAt: string;
  decidedAt?: string;

  reviewerId?: string;
  reviewerRole?: string;

  decision?: string;

  originalArgumentsHash: string;
  finalArgumentsHash?: string;

  revalidationPassed?: boolean;
};
```

---

# 37. Instrumentación de verificación

```ts
export type VerificationTraceData = {
  verifierId: string;
  verifierVersion: string;

  expectedStateReference?: string;
  actualStateReference?: string;

  passed: boolean;
  discrepancies: string[];

  verifiedAt: string;
};
```

Una escritura no debe marcarse `completed` antes de este span cuando la verificación sea obligatoria.

---

# 38. Instrumentación de eventos

```ts
export type EventTraceData = {
  eventId: string;
  eventType: string;
  eventVersion: string;

  resourceType: string;
  resourceId: string;

  correlationId: string;
  causationId?: string;

  published: boolean;
  consumed: boolean;
};
```

---

# 39. Instrumentación de jobs y colas

Registrar:

- Job ID.
- Queue.
- Attempt.
- Scheduled time.
- Start.
- End.
- Delay.
- Retry.
- Dead-letter.
- Correlation.

```ts
export type JobTraceData = {
  jobId: string;
  queueName: string;
  attempt: number;
  maxAttempts: number;

  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;

  status: string;
  deadLettered: boolean;
};
```

---

# 40. Datos sensibles y privacidad

Las traces pueden contener información sensible.

Debe existir una clasificación:

```ts
export type TelemetryDataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted"
  | "secret";
```

## Posibles datos restringidos

- Datos personales.
- Datos financieros.
- Contratos.
- Documentos.
- Identificadores oficiales.
- Información comercial.
- Datos de campañas.
- Credenciales.
- Información jurídica.

---

# 41. Política de captura

```ts
export type TraceCapturePolicy = {
  policyId: string;
  version: string;

  environment: string;
  productType: string;
  riskLevel: string;

  capturePromptContent: boolean;
  captureModelOutputContent: boolean;
  captureToolArgumentsContent: boolean;
  captureToolResultsContent: boolean;
  captureRetrievedContent: boolean;

  storeHashes: boolean;
  storeReferences: boolean;

  redactSensitiveFields: boolean;

  samplingPolicyId: string;
  retentionPolicyId: string;
};
```

---

# 42. Redacción

## 42.1 Registry

```ts
export type SensitiveFieldDefinition = {
  path: string;
  classification: TelemetryDataClassification;

  strategy:
    | "remove"
    | "mask"
    | "hash"
    | "tokenize"
    | "reference_only";
};
```

## 42.2 Ejemplos

```text
password        → remove
apiKey          → remove
email           → hash o mask
nationalId      → mask
bankAccount     → mask
documentContent → reference_only
```

---

# 43. Redacción antes de exportar

La redacción debe producirse:

```text
Antes de enviar al proveedor externo.
```

No:

```text
Guardar completo y ocultar después en la UI.
```

La UI no es una barrera suficiente.

---

# 44. Redacción por proveedor

Puede existir una política distinta para:

- Almacenamiento interno.
- OpenAI tracing.
- LangSmith.
- APM.
- Data warehouse.
- Auditoría.

Ejemplo:

```text
Interno:
hash + referencias.

Proveedor externo:
solo metadata y métricas.
```

---

# 45. No capturar razonamiento interno

No almacenar chain-of-thought privado.

Registrar:

- Decisión observable.
- Reason code.
- Evidencia.
- Política.
- Resultado.

Ejemplo correcto:

```text
Se consultó el margen porque el ROAS por sí solo no determina beneficio.
```

No:

```text
Razonamiento interno token a token.
```

---

# 46. Seguridad de la telemetría

Aplicar:

- Cifrado en tránsito.
- Cifrado en reposo.
- IAM.
- RBAC.
- ABAC.
- Tenant isolation.
- Retención.
- Backups.
- Acceso auditado.
- Exportación restringida.
- Secrets management.

---

# 47. Multi-tenancy

Toda señal debe contener `tenantId` obtenido del backend.

## Controles

- Particionado.
- RLS.
- Filtros.
- Proyectos separados cuando proceda.
- API de consulta con tenant obligatorio.
- Dashboards aislados.
- Exportaciones aisladas.
- Tests cross-tenant.

## Regla

```text
Una trace sin tenant válido no debe exportarse a una vista de cliente.
```

---

# 48. Roles de acceso a observabilidad

Ejemplos:

```text
platform_observability_admin
security_auditor
tenant_admin
ai_engineer
support_agent
legal_auditor
readonly_observer
```

Cada rol debe tener campos visibles distintos.

## Support

Puede ver:

- IDs.
- Estado.
- Errores redactados.

No necesariamente:

- Prompt completo.
- Documentos.
- Datos bancarios.

---

# 49. Retención

No debe existir una única retención global.

```ts
export type TraceRetentionPolicy = {
  id: string;
  version: string;

  category:
    | "routine"
    | "error"
    | "security"
    | "high_risk"
    | "audit"
    | "eval_dataset";

  retentionDays: number;

  anonymizeAfterDays?: number;
  archiveAfterDays?: number;

  legalHoldSupported: boolean;
  deletionMethod: string;
};
```

---

# 50. Retención y RGPD

Aplicar:

- Minimización.
- Limitación de finalidad.
- Limitación del plazo.
- Seguridad.
- Exactitud.
- Responsabilidad proactiva.

No conservar prompts completos durante años simplemente porque resultan útiles para depuración.

Debe definirse:

- Finalidad.
- Base jurídica.
- Plazo.
- Acceso.
- Borrado.
- Anonimización.
- Derechos.

---

# 51. Retención y Reglamento de IA

Para sistemas de alto riesgo:

- El artículo 12 exige capacidades automáticas de logging.
- Los logs deben permitir trazabilidad adecuada a la finalidad.
- Deben apoyar identificación de riesgos.
- Deben apoyar vigilancia poscomercialización.
- Deben apoyar monitorización del uso.
- El responsable del despliegue debe conservar los logs bajo su control durante el periodo legal aplicable.
- Debe analizarse el mínimo de seis meses del artículo 26 cuando resulte aplicable.
- Otras normas pueden exigir plazos diferentes.

No aplicar automáticamente estas obligaciones a todos los módulos.

---

# 52. Vigilancia poscomercialización

Para sistemas de alto riesgo, la observabilidad debe poder alimentar:

- Monitorización de rendimiento.
- Incidentes.
- Riesgos emergentes.
- Sesgos.
- Uso indebido.
- Drift.
- Modificaciones sustanciales.
- Acciones correctivas.
- Evaluación continua.

Debe diferenciarse:

```text
telemetría operativa
de
post-market monitoring evidence
```

---

# 53. Sampling

## 53.1 Tipos

- Always-on.
- Head sampling.
- Tail sampling.
- Risk-based.
- Error-based.
- Tenant-based.
- Feature-based.
- Adaptive.

## 53.2 Recomendación

Captura completa para:

- Errores.
- Violaciones de seguridad.
- Acciones críticas.
- HITL.
- Alto riesgo.
- Fallos de verificación.
- Incidentes.
- Nuevas versiones canary.

Sampling para:

- Lecturas rutinarias.
- Resúmenes repetitivos.
- Operaciones de alto volumen.

---

# 54. Contrato de sampling

```ts
export type TraceSamplingPolicy = {
  id: string;
  version: string;

  defaultRate: number;

  alwaysSampleWhen: Array<
    | "error"
    | "security_event"
    | "approval"
    | "high_risk"
    | "verification_failed"
    | "cross_tenant_attempt"
    | "new_agent_version"
  >;

  tenantOverrides?: Record<string, number>;
  featureOverrides?: Record<string, number>;
};
```

---

# 55. Tail sampling

Permite decidir después de observar el resultado.

Ejemplo:

```text
Guardar completa si:
- falló,
- superó 20 segundos,
- tuvo 10 tool calls,
- necesitó aprobación,
- produjo error de tenant.
```

Muy útil para agentes.

---

# 56. Métricas de modelo

```text
gen_ai_requests_total
gen_ai_request_duration_ms
gen_ai_input_tokens_total
gen_ai_output_tokens_total
gen_ai_cached_tokens_total
gen_ai_errors_total
gen_ai_cost_total
```

Dimensiones:

- Provider.
- Model.
- Agent.
- Workflow.
- Environment.
- Product.

Evitar cardinalidad explosiva.

---

# 57. Métricas de agente

```text
agent_runs_total
agent_runs_completed_total
agent_runs_partial_total
agent_runs_failed_total
agent_steps_total
agent_tool_calls_total
agent_replans_total
agent_no_progress_total
agent_completion_duration_ms
```

---

# 58. Métricas de tools

```text
tool_calls_total
tool_call_duration_ms
tool_errors_total
tool_retries_total
tool_verification_failures_total
tool_duplicate_actions_prevented_total
```

---

# 59. Métricas de contexto

```text
context_tokens_total
context_documents_selected
context_memories_selected
context_compressions_total
context_truncations_total
context_missing_required_facts_total
context_stale_facts_excluded_total
```

---

# 60. Métricas de RAG

```text
retrieval_requests_total
retrieval_latency_ms
retrieval_chunks_returned
retrieval_chunks_selected
retrieval_empty_results_total
retrieval_cross_tenant_blocks_total
retrieval_stale_documents_total
```

---

# 61. Métricas de memoria

```text
memory_candidates_total
memory_writes_total
memory_write_rejections_total
memory_reads_total
memory_conflicts_total
memory_stale_exclusions_total
memory_cross_tenant_blocks_total
```

---

# 62. Métricas de orquestación

```text
workflow_runs_total
workflow_node_duration_ms
workflow_checkpoints_total
workflow_resumptions_total
workflow_handoffs_total
workflow_workers_total
workflow_parallelism
workflow_cycles_prevented_total
```

---

# 63. Métricas HITL

```text
approvals_requested_total
approvals_approved_total
approvals_rejected_total
approvals_edited_total
approvals_expired_total
approval_latency_ms
post_approval_verification_failures_total
human_overrides_total
```

---

# 64. Métricas de seguridad

```text
authorization_denials_total
tenant_mismatch_attempts_total
unauthorized_tool_attempts_total
prompt_injection_detections_total
approval_bypass_attempts_total
sensitive_data_redactions_total
security_incidents_total
```

---

# 65. Métricas de negocio: EcomScaling IA

```text
recommendations_generated_total
recommendations_approved_total
recommendations_executed_total
recommendations_rejected_total
campaign_actions_executed_total
campaign_actions_reverted_total
estimated_spend_avoided
measured_margin_improvement
analysis_time_saved_minutes
```

Las métricas económicas deben distinguir:

- Estimado.
- Medido.
- Atribuido.
- Confirmado.

---

# 66. Métricas de negocio: CRM/SaaS

```text
cases_reviewed_total
cases_ready_for_signing_total
missing_documents_detected_total
duplicate_tasks_prevented_total
tasks_created_by_agent_total
tasks_corrected_by_human_total
reservations_processed_total
administrative_errors_prevented_total
case_preparation_time_saved_minutes
```

---

# 67. Cost attribution

```ts
export type AgentCostAttribution = {
  tenantId: string;
  productType: string;

  workflowType: string;
  featureId: string;

  agentId: string;
  agentVersion: string;

  modelCost: number;
  embeddingCost: number;
  rerankingCost: number;
  externalToolCost: number;
  storageCostEstimate?: number;

  totalCost: number;

  currency: "EUR";
};
```

---

# 68. Coste por tenant y feature

Debe poder saberse:

- Qué tenant consume.
- Qué feature consume.
- Qué agente consume.
- Qué modelo consume.
- Qué workflow no es sostenible.
- Qué herramienta externa domina el coste.

No degradar calidad por plan sin una decisión de producto.

---

# 69. Cardinalidad

Evitar labels de alta cardinalidad en métricas:

Incorrecto:

```text
user_id como label de Prometheus.
prompt completo como label.
resource_id como label.
```

Correcto:

- Guardar IDs en traces.
- Usar dimensiones agregables en métricas.
- Mantener control de cardinalidad.

---

# 70. SLI

Ejemplos:

- Tasa de finalización.
- Tasa de verificación.
- Latencia.
- Coste.
- Errores.
- Seguridad.
- Calidad.
- Disponibilidad de tools.

```ts
export type AgentSli = {
  id: string;
  name: string;
  measurementQuery: string;
  unit: string;
};
```

---

# 71. SLO

Ejemplos orientativos:

```text
tenant_isolation = 100 %
unauthorized_execution = 0
verified_write_success >= 99 %
read_workflow_success >= 99 %
p95_read_latency <= 8 s
p95_write_workflow_latency <= 30 s
```

Los valores reales deben definirse tras baseline.

---

# 72. Error budget

Para métricas no críticas:

```text
SLO: 99 % éxito.
Error budget: 1 %.
```

Para seguridad:

```text
Cross-tenant:
error budget = 0.
```

Una mejora funcional no compensa una violación de seguridad.

---

# 73. Alertas

## Críticas

- Cross-tenant.
- Acción no autorizada ejecutada.
- Exposición de secretos.
- Bypass de aprobación.
- Reembolso duplicado.
- Fallo de verificación crítico.
- Pérdida total de telemetría en workflow crítico.

## Altas

- Incremento de errores.
- Tool externa degradada.
- Coste anómalo.
- Loops sin progreso.
- Aprobaciones caducadas.
- Jobs en dead-letter.
- Contexto cross-tenant bloqueado.

## Medias

- Latencia elevada.
- Contexto excesivo.
- Retrieval vacío.
- Aumento de reintentos.
- Drift de modelo.

---

# 74. Contrato de alerta

```ts
export type AlertRule = {
  id: string;
  version: string;

  severity:
    | "critical"
    | "high"
    | "medium"
    | "low";

  condition: string;
  window: string;

  labels: Record<string, string>;

  playbookId: string;

  deduplicationKey: string;
  cooldownSeconds: number;
};
```

---

# 75. Playbooks

Toda alerta importante debe tener:

- Qué significa.
- Cómo confirmar.
- Qué datos revisar.
- Qué acción inmediata tomar.
- Cuándo detener agentes.
- Cuándo escalar.
- Cómo resolver.
- Cómo documentar.
- Cómo crear caso de regresión.

Ejemplo:

```text
TENANT_MISMATCH_ATTEMPT
1. Detener workflow.
2. Conservar trace.
3. Bloquear exportación.
4. Revisar actor.
5. Revisar RLS.
6. Notificar seguridad.
7. Crear incidente.
8. Añadir eval de regresión.
```

---

# 76. Detección de anomalías

Puede utilizar:

- Reglas.
- Baselines.
- Estadística.
- ML.
- Evals online.

Ejemplos:

- Coste 5 veces superior.
- Tool calls inusuales.
- Cambio de distribución de rutas.
- Caída de aprobación.
- Aumento de overrides.
- Aumento de retrieval vacío.
- Modelo más lento.
- Mayor tasa de output inválido.

---

# 77. Detección de loops defectuosos

```ts
export type NoProgressDetectorInput = {
  repeatedToolCalls: number;
  repeatedStateHashes: number;
  newFactsAdded: number;
  stepsSinceProgress: number;
};
```

Emitir:

```text
AGENT_NO_PROGRESS
```

cuando:

- Repite tool.
- Repite argumentos.
- No obtiene datos nuevos.
- No cambia plan.
- Consume presupuesto.

---

# 78. Detección de duplicados

Instrumentar:

- Idempotency key.
- Resultado anterior.
- Acción evitada.
- Causa.

Métrica:

```text
duplicate_actions_prevented_total
```

---

# 79. Dashboards

## 79.1 Ejecutivo

- Uso.
- Coste.
- Impacto.
- Tasa de éxito.
- Riesgos.
- Adopción.
- Ahorro.
- Correcciones humanas.

## 79.2 Técnico

- Latencia.
- Tokens.
- Errores.
- Modelos.
- Tools.
- Retries.
- DB.
- APIs.
- Queues.

## 79.3 Agentes

- Loops.
- Steps.
- Replanning.
- Workers.
- Handoffs.
- Contexto.
- Memoria.
- Verificación.

## 79.4 Seguridad

- Denegaciones.
- Tenant violations.
- Injection.
- Secrets.
- Aprobaciones.
- Incidentes.

## 79.5 Cumplimiento

- Casos de alto riesgo.
- Logs disponibles.
- HITL.
- Overrides.
- Incidentes.
- Retención.
- Sistemas y versiones.

---

# 80. Búsqueda de traces

Debe permitir filtrar por:

- Trace ID.
- Run ID.
- Workflow.
- Thread.
- Tenant.
- Actor.
- Agent.
- Model.
- Tool.
- Error.
- Policy.
- Approval.
- Resource.
- Time range.
- Environment.
- Version.
- Incident.

---

# 81. Timeline

La UI debe mostrar:

```text
12:00:01 Request
12:00:01 Authenticated
12:00:02 Context built
12:00:04 Model selected tool
12:00:05 Tool completed
12:00:06 Approval requested
12:03:10 Approved
12:03:11 Revalidated
12:03:12 Executed
12:03:13 Verified
12:03:14 Completed
```

---

# 82. Diff entre versiones

Permitir comparar:

```text
Agent v4
vs.
Agent v5
```

Comparar:

- Tools.
- Contexto.
- Coste.
- Latencia.
- Output.
- Guardrails.
- Resultado.
- Eval score.

---

# 83. Feedback

Vincular feedback a:

- Trace.
- Span.
- Output.
- Tool.
- Recommendation.
- Human review.

```ts
export type TraceFeedback = {
  traceId: string;
  spanId?: string;

  feedbackType:
    | "thumbs"
    | "rating"
    | "correction"
    | "incident"
    | "business_outcome";

  value: unknown;
  submittedBy: string;
  submittedAt: string;
};
```

---

# 84. Relación con evals

```text
Trace
  ↓
Dataset candidate
  ↓
Grader
  ↓
Regression case
  ↓
Release gate
```

Debe poder convertir una trace fallida en caso de evaluación sin copiar datos sensibles innecesarios.

---

# 85. Relación con memoria

Observabilidad debe permitir responder:

- Qué memoria se utilizó.
- Si estaba vigente.
- Si tenía fuente.
- Si fue determinante.
- Si provocó error.
- Si se creó una nueva memoria.
- Si fue rechazada.

No debe convertir cada trace en memoria.

---

# 86. Relación con Human-in-the-Loop

Debe reconstruirse:

- Qué vio el humano.
- Qué no vio.
- Qué decisión tomó.
- Qué cambió.
- Qué se ejecutó.
- Qué se verificó.

Una aprobación sin trace completa tiene bajo valor probatorio y operativo.

---

# 87. Relación con Guardrails

Debe registrarse:

- Guardrail.
- Versión.
- Input evaluado.
- Resultado.
- Motivo.
- Acción posterior.

No basta:

```text
Blocked.
```

---

# 88. Relación con Tool Design

Toda tool debe definir:

- Span name.
- Atributos permitidos.
- Campos sensibles.
- Métricas.
- Error taxonomy.
- Verificación.
- Sampling.

```ts
export type ToolObservabilityConfig = {
  spanName: string;
  capturePolicyId: string;
  metrics: string[];
  sensitivePaths: string[];
  expectedErrorCodes: string[];
};
```

---

# 89. Relación con Orchestration

Cada nodo debe producir:

- Span.
- Estado.
- Input reference.
- Output reference.
- Error.
- Budget.
- Checkpoint.

---

# 90. Cumplimiento del Reglamento de IA

## Artículo 12

Para alto riesgo:

- Logging automático durante ciclo de vida.
- Eventos adecuados a finalidad.
- Identificación de riesgos.
- Apoyo a vigilancia poscomercialización.
- Monitorización del funcionamiento.

## Artículo 26

Para responsables del despliegue de alto riesgo:

- Monitorización.
- Logs bajo control.
- Retención aplicable.
- Personas con autoridad.
- Gestión de riesgos e incidentes.

## Artículo 72

Para proveedores de alto riesgo:

- Sistema de vigilancia poscomercialización.
- Recopilación y análisis de datos.
- Evaluación continua.
- Acciones correctivas.

## Regla

La plataforma debe permitir habilitar un modo reforzado:

```text
HIGH_RISK_OBSERVABILITY_PROFILE
```

Solo cuando corresponda.

---

# 91. Perfil de observabilidad por riesgo

```ts
export type ObservabilityProfile =
  | "minimal"
  | "standard"
  | "enhanced"
  | "high_risk"
  | "security_incident";
```

## Minimal

- Métricas.
- Metadata.
- Errores.

## Standard

- Trace completa sin contenido sensible.
- Tools.
- Model.
- Context references.

## Enhanced

- HITL.
- Verificación.
- Evidencias.
- Coste.
- Retención mayor.

## High risk

- Logs automáticos reforzados.
- Identificación de supervisores.
- Inputs y outputs relevantes conforme a política.
- Monitorización continua.
- Post-market evidence.
- Inmutabilidad.
- Exportación para auditoría.

## Security incident

- Captura reforzada.
- Legal hold.
- Acceso restringido.
- Preservación de evidencia.

---

# 92. Integridad e inmutabilidad

Para auditoría relevante:

- Hash.
- Timestamp fiable.
- Append-only.
- Control de acceso.
- WORM cuando proceda.
- Cadena de custodia.
- Versiones.
- Firma o sellado cuando proceda.

```ts
export type AuditIntegrityMetadata = {
  recordHash: string;
  previousRecordHash?: string;
  signedAt?: string;
  signatureReference?: string;
};
```

---

# 93. Pérdida de telemetría

La plataforma debe detectar si no puede exportar.

```ts
export type TelemetryHealth = {
  exporterHealthy: boolean;
  queueDepth: number;
  droppedSpans: number;
  lastSuccessfulExportAt?: string;
};
```

## Política

Para lectura rutinaria:

```text
Continuar y alertar.
```

Para acción crítica:

```text
Evaluar fail-closed o almacenamiento local duradero.
```

No ejecutar una acción crítica sin evidencia si la política exige trazabilidad.

---

# 94. Buffer y backpressure

El tracing no debe derribar la aplicación.

Medidas:

- Batch processor.
- Queue.
- Límites.
- Dropping policy.
- Priority.
- Disk buffer.
- Retry.
- Circuit breaker.

Nunca bloquear indefinidamente una operación por un backend de observabilidad no crítico.

---

# 95. Telemetry priority

```ts
export type TelemetryPriority =
  | "critical"
  | "high"
  | "normal"
  | "low";
```

No descartar:

- Seguridad.
- Cross-tenant.
- Aprobación.
- Acción financiera.
- Verificación fallida.
- Incidente.

Puede descartarse primero:

- Spans rutinarios de bajo riesgo.
- Detalles repetitivos.
- Debug de desarrollo.

---

# 96. Entornos

## Local

- Captura amplia.
- Datos sintéticos.
- No datos reales.

## Development

- Debug.
- Sampling alto.
- Anonimización.

## Staging

- Simulación cercana a producción.
- Datasets controlados.

## Production

- Minimización.
- Seguridad.
- Retención.
- Sampling.
- Acceso restringido.

No enviar datos reales de producción a proyectos de desarrollo.

---

# 97. Instrumentación de streaming

Registrar:

- Time to first token.
- Duración total.
- Interrupciones.
- Cancelaciones.
- Chunks.
- Errores de stream.
- Resultado final.

No registrar cada token como span.

---

# 98. Voice y multimodal

Si existen:

- Transcripción.
- Síntesis de voz.
- Imágenes.
- Archivos.
- Vídeo.

Registrar:

- Modalidad.
- Duración.
- Tamaño.
- Referencias.
- Redacción.
- Consentimiento cuando proceda.

No almacenar audio completo sin política.

---

# 99. Errores estructurados

```ts
export type AgentErrorCategory =
  | "model"
  | "tool"
  | "retrieval"
  | "context"
  | "memory"
  | "authorization"
  | "validation"
  | "external_api"
  | "database"
  | "verification"
  | "timeout"
  | "orchestration"
  | "unknown";

export type AgentError = {
  code: string;
  category: AgentErrorCategory;

  message: string;
  retryable: boolean;

  traceId: string;
  spanId: string;

  occurredAt: string;

  causeReference?: string;
};
```

---

# 100. Taxonomía de errores

## Comprensión

```text
INTENT_MISCLASSIFIED
ENTITY_AMBIGUOUS
ENTITY_NOT_FOUND
```

## Contexto

```text
CONTEXT_MISSING
CONTEXT_STALE
CONTEXT_TOO_LARGE
CONTEXT_TRUNCATED
CROSS_TENANT_CONTEXT
```

## RAG

```text
RETRIEVAL_EMPTY
RETRIEVAL_IRRELEVANT
DOCUMENT_VERSION_STALE
RERANK_FAILED
```

## Tools

```text
TOOL_NOT_ALLOWED
TOOL_ARGUMENT_INVALID
TOOL_TIMEOUT
TOOL_RESULT_INVALID
TOOL_EXTERNAL_ERROR
```

## Seguridad

```text
PERMISSION_DENIED
TENANT_MISMATCH
APPROVAL_REQUIRED
APPROVAL_EXPIRED
PROMPT_INJECTION_DETECTED
```

## Loop

```text
NO_PROGRESS
MAX_STEPS_REACHED
DUPLICATE_ACTION
REPEATED_TOOL_CALL
```

## Verificación

```text
VERIFICATION_FAILED
PARTIAL_EFFECT
STATE_DIVERGENCE
```

---

# 101. Arquitectura técnica propuesta

```text
src/
  ai/
    observability/
      telemetry.types.ts
      telemetry.config.ts

      trace/
        trace.service.ts
        trace-context.ts
        trace.registry.ts
        span.service.ts
        span.factory.ts

      instrumentation/
        agent.instrumentation.ts
        model.instrumentation.ts
        prompt.instrumentation.ts
        tool.instrumentation.ts
        context.instrumentation.ts
        rag.instrumentation.ts
        memory.instrumentation.ts
        routing.instrumentation.ts
        loop.instrumentation.ts
        orchestration.instrumentation.ts
        guardrail.instrumentation.ts
        authorization.instrumentation.ts
        hitl.instrumentation.ts
        verification.instrumentation.ts
        event.instrumentation.ts
        job.instrumentation.ts

      attributes/
        canonical-attributes.ts
        otel-attribute-adapter.ts
        attribute-version.ts

      exporters/
        exporter.interface.ts
        otel.exporter.ts
        internal.exporter.ts
        openai.exporter.ts
        langsmith.exporter.ts
        audit.exporter.ts

      processors/
        batch.processor.ts
        redaction.processor.ts
        sampling.processor.ts
        enrichment.processor.ts
        cost.processor.ts

      privacy/
        capture-policy.ts
        redaction.service.ts
        sensitive-field.registry.ts
        retention-policy.ts

      metrics/
        agent.metrics.ts
        model.metrics.ts
        tool.metrics.ts
        rag.metrics.ts
        memory.metrics.ts
        orchestration.metrics.ts
        hitl.metrics.ts
        security.metrics.ts
        business.metrics.ts
        cost.metrics.ts

      alerts/
        alert.types.ts
        alert.rules.ts
        anomaly-detector.ts
        playbook.registry.ts

      compliance/
        ai-act-observability-profile.ts
        post-market-monitoring.adapter.ts
        audit-integrity.service.ts
        legal-hold.service.ts

      dashboards/
      evals/
      tests/
```

Adaptar al repositorio real.

---

# 102. Servicio de traces

```ts
export interface TraceService {
  startTrace(input: StartTraceInput): AgentTraceContext;

  startSpan(input: StartSpanInput): AgentSpanContext;

  addEvent(
    spanId: string,
    event: SpanEvent
  ): void;

  recordError(
    spanId: string,
    error: AgentError
  ): void;

  endSpan(
    spanId: string,
    status: AgentSpan["status"]
  ): void;

  endTrace(
    traceId: string,
    status: TraceStatus
  ): Promise<void>;
}
```

---

# 103. Wrapper de workflow

```ts
export async function traceAgentWorkflow<T>(input: {
  workflowName: string;
  actor: AuthenticatedActor;
  taskType: string;
  execute: (
    context: AgentTraceContext
  ) => Promise<T>;
}): Promise<T> {
  const trace = traceService.startTrace({
    workflowName: input.workflowName,
    tenantId: input.actor.tenantId,
    actorId: input.actor.userId,
    taskType: input.taskType,
  });

  try {
    const result = await input.execute(trace);

    await traceService.endTrace(
      trace.traceId,
      "completed"
    );

    return result;
  } catch (error) {
    traceService.recordError(
      trace.rootSpanId,
      normalizeAgentError(error)
    );

    await traceService.endTrace(
      trace.traceId,
      "failed"
    );

    throw error;
  }
}
```

---

# 104. Wrapper de tool

```ts
export async function traceToolExecution<T>(
  input: TraceToolExecutionInput<T>
): Promise<ToolResult<T>> {
  const span = traceService.startSpan({
    traceId: input.traceId,
    parentSpanId: input.parentSpanId,
    name: input.tool.name,
    type: "tool",
  });

  try {
    const result =
      await input.execute();

    span.setAttributes({
      "tool.name": input.tool.name,
      "tool.version": input.tool.version,
      "tool.risk_level": input.tool.riskLevel,
      "tool.result_status": result.ok
        ? "success"
        : "failed",
    });

    return result;
  } catch (error) {
    span.recordError(
      normalizeAgentError(error)
    );

    throw error;
  } finally {
    span.end();
  }
}
```

---

# 105. Esquema de persistencia orientativo

Posibles tablas:

```text
agent_traces
agent_spans
agent_span_events
agent_errors
agent_costs
agent_feedback
agent_alerts
agent_incidents
agent_audit_records
telemetry_retention_policies
telemetry_capture_policies
telemetry_export_status
```

No crear tablas sin revisar:

- Volumen.
- Particionado.
- Índices.
- Retención.
- Coste.
- RLS.
- Proveedor.

---

# 106. Particionado

Para alto volumen:

- Particionar por fecha.
- Posible subpartición por tenant o entorno.
- Índices por trace.
- Índices por workflow.
- Índices por error.
- Índices por actor.
- Índices por resource reference.

No usar JSONB indiscriminadamente sin índices y esquema canónico.

---

# 107. Almacenamiento caliente y frío

## Hot storage

- Traces recientes.
- Debug.
- Alertas.
- Soporte.

## Warm storage

- Tendencias.
- Auditorías.
- Incidentes.

## Cold storage

- Evidencia legal.
- Histórico.
- Post-market monitoring.
- Datos agregados.

Aplicar distinta retención y acceso.

---

# 108. Dashboards mínimos

## Dashboard 1 — Salud del agente

- Runs.
- Éxito.
- Parcial.
- Fallo.
- Latencia.
- Coste.
- Steps.
- Tool calls.

## Dashboard 2 — Tools

- Uso.
- Error.
- Latencia.
- Retry.
- Verification failure.

## Dashboard 3 — RAG y contexto

- Retrieval vacío.
- Chunks.
- Tokens.
- Stale.
- Truncation.

## Dashboard 4 — Seguridad

- Tenant blocks.
- Authorization denials.
- Injection.
- Approval bypass.

## Dashboard 5 — HITL

- Pending.
- Approval latency.
- Reject.
- Edit.
- Expire.

## Dashboard 6 — Negocio

- Impacto por producto.

---

# 109. Tests unitarios

- Trace creation.
- Span hierarchy.
- Correlation propagation.
- Attribute redaction.
- Sampling.
- Retention selection.
- Cost calculation.
- Error normalization.
- Tenant attribute.
- Exporter failure.
- High-risk profile.

---

# 110. Tests de integración

- HTTP a agent trace.
- Agent a tool.
- Tool a DB.
- Tool a external API.
- Queue propagation.
- Worker continuation.
- RAG trace.
- Memory trace.
- HITL pause.
- HITL resume.
- Verification.
- Event emission.
- Exporter.

---

# 111. Tests de seguridad

- Cross-tenant query.
- Cross-tenant dashboard.
- Secret redaction.
- Prompt content disabled.
- Tool argument redaction.
- Exporter access.
- Trace deletion.
- Legal hold.
- RLS.
- Support role visibility.
- Audit role visibility.
- Injection payload in logs.
- Log forging.
- Trace ID guessing.

---

# 112. Evals de observabilidad

Debe comprobarse:

- Trace completa.
- Spans esperados.
- Orden correcto.
- Correlation IDs.
- Model version.
- Tool version.
- Policy version.
- Prompt version.
- Context references.
- Verification span.
- Error code.
- Redaction.
- Cost.
- Completion reason.

---

# 113. Quality gates

Una release debe bloquearse si:

- No se generan traces.
- Faltan spans críticos.
- No se propaga tenant.
- Se registran secretos.
- No se registra verificación.
- No se registra versión.
- Se rompe correlación.
- Se pierden eventos críticos.
- No funciona exportación de seguridad.
- No se puede reconstruir un workflow crítico.

---

# 114. Fases de implementación

## Fase 0 — Análisis exhaustivo

Analizar:

- Arquitectura.
- Frameworks.
- Agentes.
- Tools.
- RAG.
- Memoria.
- HITL.
- Jobs.
- Eventos.
- Seguridad.
- Privacidad.
- Proveedores.
- Coste.
- Retención.
- Legislación.

Entregables:

- Diagnóstico.
- Mapa de señales.
- Matriz de instrumentación.
- Política de captura.
- Política de redacción.
- Sampling.
- Retención.
- SLI/SLO.
- Alertas.
- Arquitectura.
- Archivos.

No implementar todavía.

## Fase 1 — Contratos comunes

Crear:

- `AgentTrace`
- `AgentSpan`
- `CorrelationContext`
- `TraceCapturePolicy`
- `TraceRetentionPolicy`
- `AgentError`
- `AgentCostAttribution`

## Fase 2 — Trace Context

Implementar:

- Request ID.
- Trace ID.
- Run ID.
- Tenant.
- Actor.
- Propagación.

## Fase 3 — OpenTelemetry base

Implementar:

- SDK.
- Collector.
- Exporter interno.
- Batch processor.
- Health.

## Fase 4 — Agente y modelo

Instrumentar:

- Agent.
- Model.
- Prompt references.
- Tokens.
- Coste.

## Fase 5 — Tools y servicios

Instrumentar:

- Tool.
- Authorization.
- Domain service.
- DB.
- External API.
- Verification.

## Fase 6 — RAG y contexto

Instrumentar retrieval y Context Builder.

## Fase 7 — Memoria y orquestación

Instrumentar memoria, loops, workers y handoffs.

## Fase 8 — HITL y guardrails

Instrumentar decisiones y aprobaciones.

## Fase 9 — Redacción y retención

Añadir políticas completas.

## Fase 10 — Métricas y alertas

Crear SLI, SLO, alerts y playbooks.

## Fase 11 — Evals

Conectar traces con datasets.

## Fase 12 — Segundo producto

Reutilizar núcleo con adaptadores.

## Fase 13 — Cumplimiento reforzado

Activar perfiles de alto riesgo cuando proceda.

---

# 115. Criterios de aceptación

- [ ] Se realizó análisis previo.
- [ ] Cada request tiene trace.
- [ ] Cada operación relevante tiene span.
- [ ] Existe jerarquía padre-hijo.
- [ ] Se propagan correlation IDs.
- [ ] Tenant procede del backend.
- [ ] Actor procede de autenticación.
- [ ] Se registran versiones.
- [ ] Se registran tool calls.
- [ ] Se registra RAG.
- [ ] Se registra memoria.
- [ ] Se registra HITL.
- [ ] Se registra autorización.
- [ ] Se registra verificación.
- [ ] Se registra completion reason.
- [ ] Se registran errores estructurados.
- [ ] Se mide coste.
- [ ] Se mide latencia.
- [ ] Existe redacción.
- [ ] No se registran secretos.
- [ ] Existe sampling.
- [ ] Existe retención.
- [ ] Existe aislamiento multi-tenant.
- [ ] Existen dashboards.
- [ ] Existen alertas.
- [ ] Existen playbooks.
- [ ] Existe integración con evals.
- [ ] Existe perfil de cumplimiento.
- [ ] Se puede reconstruir una ejecución crítica.
- [ ] La pérdida de telemetría se detecta.
- [ ] Existen tests.

---

# 116. Instrucciones directas para Codex

## Misión

Diseñar e integrar una arquitectura transversal de Observability & Tracing adaptada al SaaS real.

## Regla obligatoria

Antes de implementar, debes analizar exhaustivamente:

- Repositorio.
- Arquitectura.
- Agentes.
- Tools.
- Workflows.
- Context Builder.
- RAG.
- Memoria.
- HITL.
- Guardrails.
- Eventos.
- Jobs.
- Proveedores.
- Logs.
- Métricas.
- Traces.
- Datos sensibles.
- Tenants.
- Roles.
- Retención.
- Coste.
- Cumplimiento.

## Restricciones

1. No implementar antes del análisis.
2. No registrar todo por defecto.
3. No guardar secretos.
4. No guardar chain-of-thought.
5. No aceptar tenant del modelo.
6. No cruzar tenants.
7. No acoplarse a un proveedor.
8. No usar logs de texto libre como única señal.
9. No omitir versiones.
10. No omitir verificación.
11. No confundir auditoría y observabilidad.
12. No inventar retención.
13. No crear dashboards sin métricas definidas.
14. No crear alertas sin playbooks.
15. No omitir sampling.
16. No perder correlación en jobs.
17. No marcar como terminado con tests fallando.
18. Versionar atributos.
19. Documentar desviaciones.
20. Adaptar al producto real.

---

# 117. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio y el producto para diseñar una
arquitectura de Observability & Tracing adaptada al sistema real.

No implementes todavía instrumentación.

Objetivos:

1. Identificar todos los entrypoints.
2. Identificar todos los agentes.
3. Identificar todos los workflows.
4. Identificar todos los loops.
5. Identificar todas las tools.
6. Identificar servicios de dominio.
7. Identificar RAG.
8. Identificar Context Builder.
9. Identificar memoria.
10. Identificar guardrails.
11. Identificar HITL.
12. Identificar eventos.
13. Identificar jobs y colas.
14. Identificar APIs externas.
15. Identificar DB y RLS.
16. Identificar logs actuales.
17. Identificar métricas actuales.
18. Identificar tracing actual.
19. Identificar proveedores.
20. Identificar datos sensibles.
21. Identificar retención.
22. Identificar costes.
23. Identificar incidentes.
24. Identificar requisitos del Reglamento de IA.
25. Proponer:
    - AgentTrace
    - AgentSpan
    - CorrelationContext
    - TraceCapturePolicy
    - TraceSamplingPolicy
    - TraceRetentionPolicy
    - AgentError
    - AgentCostAttribution
26. Proponer esquema canónico.
27. Proponer OpenTelemetry.
28. Proponer exporters.
29. Proponer redacción.
30. Proponer métricas.
31. Proponer SLI/SLO.
32. Proponer alertas.
33. Proponer playbooks.
34. Proponer arquitectura.
35. Proponer archivos.
36. Proponer fases.
37. Proponer tests.
38. Proponer evals.

Antes de modificar código, entrega:

a) diagnóstico completo,
b) mapa de arquitectura,
c) mapa de signals,
d) matriz de instrumentación,
e) datos sensibles,
f) política de captura,
g) sampling,
h) retención,
i) SLI/SLO,
j) alertas,
k) arquitectura,
l) archivos exactos.

Restricciones:

- No inventes componentes.
- No implementes todavía.
- No registres datos completos sin justificar.
- No copies una arquitectura sin adaptarla.
- No marques como terminado sin validación.
```

---

# 118. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de
Observability & Tracing.

Implementa solo:

1. Contratos comunes.
2. Trace Context.
3. Correlation IDs.
4. OpenTelemetry SDK.
5. Exporter interno o de desarrollo.
6. Trace raíz por request.
7. Spans de:
   - agent
   - model
   - tool
   - authorization
   - verification
8. Redacción básica.
9. Métricas:
   - runs
   - latency
   - tokens
   - tool errors
   - verification failures
10. Health del exporter.
11. Tests.
12. Documentación.

No implementes todavía:

- Captura completa de prompts.
- Captura completa de documentos.
- LangSmith en producción.
- OpenAI tracing alojado como fuente única.
- Retención definitiva.
- Dashboards ejecutivos.
- Alto riesgo no confirmado.
- Segundo producto.

Reutiliza el análisis previo y documenta cualquier desviación.
```

---

# 119. ADR recomendados

- ADR: análisis previo.
- ADR: OpenTelemetry.
- ADR: esquema canónico.
- ADR: trace y span hierarchy.
- ADR: correlation context.
- ADR: provider exporters.
- ADR: prompt capture.
- ADR: redaction.
- ADR: sampling.
- ADR: retention.
- ADR: multi-tenant.
- ADR: cost attribution.
- ADR: error taxonomy.
- ADR: SLI/SLO.
- ADR: alerts.
- ADR: audit separation.
- ADR: AI Act logs.
- ADR: post-market monitoring.
- ADR: eval integration.

---

# 120. Definición de terminado

Una capacidad de observabilidad está terminada cuando:

1. Se analizó el producto.
2. Se definió la finalidad.
3. Se definió la trace.
4. Se definieron spans.
5. Se definieron atributos.
6. Se definió correlación.
7. Se definió tenant.
8. Se definió actor.
9. Se definieron versiones.
10. Se definió captura.
11. Se definió redacción.
12. Se definió sampling.
13. Se definió retención.
14. Se definió exportación.
15. Se definieron métricas.
16. Se definieron SLO.
17. Se definieron alertas.
18. Se definieron playbooks.
19. Se definió auditoría.
20. Se definió integración con evals.
21. Se definieron tests.
22. Se validó pérdida de telemetría.
23. Se validó aislamiento.
24. Se validó seguridad.
25. Se validó en producto real.

---

# 121. Resumen ejecutivo

La secuencia correcta es:

```text
ANALIZAR
  ↓
DEFINIR SEÑALES
  ↓
INSTRUMENTAR
  ↓
CORRELACIONAR
  ↓
REDACTAR
  ↓
EXPORTAR
  ↓
MEDIR
  ↓
ALERTAR
  ↓
INVESTIGAR
  ↓
CONVERTIR EN EVALS Y MEJORAS
```

La plataforma común debe proporcionar:

- Trace Service.
- Span Service.
- Correlation Context.
- OpenTelemetry.
- Exporters.
- Redaction.
- Sampling.
- Retention.
- Metrics.
- Alerts.
- Playbooks.
- Cost attribution.
- Audit integration.
- Eval integration.

Cada producto debe aportar:

- Spans de dominio.
- Métricas de negocio.
- Políticas de captura.
- Sensibilidad.
- Riesgos.
- Dashboards.
- Adaptadores.

Sin observabilidad, solo sabes lo que el agente afirma haber hecho.

Con observabilidad, puedes reconstruir:

- Qué hizo.
- Con qué información.
- En qué orden.
- Bajo qué permisos.
- Con qué coste.
- Qué efecto produjo.
- Si fue verificado.
- Por qué falló.

---

# 122. Referencias oficiales y técnicas

## OpenTelemetry

- OpenTelemetry Semantic Conventions.
- OpenTelemetry GenAI Semantic Conventions.
- OpenTelemetry Trace Context.
- OpenTelemetry Collector.
- OpenTelemetry metrics and logs specifications.

## OpenAI

- OpenAI Agents SDK.
- OpenAI Agents SDK Tracing.
- Trace processors and custom exporters.
- Function, guardrail, handoff and generation spans.

## LangChain y LangGraph

- LangSmith Observability.
- LangGraph Observability.
- Trace metadata and tags.
- Trace anonymizers.
- Evaluation integration.

## Unión Europea

- Reglamento (UE) 2024/1689.
- Artículo 12: conservación de registros.
- Artículo 26: obligaciones de responsables del despliegue.
- Artículo 72: vigilancia poscomercialización.
- Reglamento (UE) 2016/679.
- Principios de minimización, limitación de finalidad, conservación e integridad.
