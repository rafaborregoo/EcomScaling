# AI Platform & Infrastructure Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica transversal.
- **Ámbito:** SaaS, CRM, agentes, copilotos, RAG, memoria, tools, workflows, proveedores de modelos, colas, workers, storage, observabilidad, evaluaciones, seguridad, privacidad, gobernanza y sistemas multi-tenant.
- **Casos de referencia:** NORA, EcomScaling IA y CRM/SaaS.
- **Objetivo:** construir una plataforma común, reutilizable y operable para ejecutar capacidades de IA de forma consistente, segura, observable, versionada, escalable y económicamente controlable.
- **Audiencia:** Codex, arquitectura, backend, IA, plataforma, DevOps, SRE, seguridad, privacidad, QA, producto, datos y operaciones.
- **Prioridad:** crítica.
- **Principio rector:** los productos no deben integrarse directamente con proveedores, prompts, tools, colas o memoria de forma aislada; deben utilizar caminos compartidos y gobernados.
- **Estado esperado:** documento vivo, versionado y conectado con infraestructura como código, CI/CD, observabilidad, seguridad, privacidad, gobernanza, evals, costes y runbooks.

---

# 1. Propósito

Este documento define cómo implementar **AI Platform & Infrastructure Engineering** en una plataforma SaaS con agentes de IA.

La arquitectura debe proporcionar:

- Model Gateway.
- Agent Runtime.
- Tool Gateway.
- Prompt Registry.
- Schema Registry.
- Agent Registry.
- Task Registry.
- Workflow Runtime.
- Retrieval Gateway.
- Memory Gateway.
- Eval Platform.
- Observability.
- Cost Attribution.
- Tenant Configuration.
- Feature Flags.
- Quotas.
- Budgets.
- Queues.
- Workers.
- Storage.
- Caches.
- Secrets.
- Networking.
- Deployment Control.
- Shadow Deployments.
- Canary Deployments.
- Rollback.
- Disaster Recovery.
- Developer Experience.
- Local Runtime.
- Synthetic Tenants.
- Runbooks.
- Service Catalog.

---

# 2. Regla obligatoria de análisis previo

Antes de crear una plataforma compartida, Codex debe analizar el sistema real.

Debe inspeccionar:

- Monorepo.
- Paquetes.
- Aplicaciones.
- Servicios.
- APIs.
- Workers.
- Colas.
- Cron jobs.
- Webhooks.
- Supabase.
- PostgreSQL.
- Storage.
- RLS.
- Vector stores.
- Caches.
- Secrets.
- Providers.
- Model calls.
- Prompt locations.
- Tool definitions.
- Agent runtimes.
- Workflows.
- Traces.
- Logs.
- Metrics.
- Evals.
- Feature flags.
- CI/CD.
- Environments.
- Deployments.
- Rollbacks.
- Incidents.
- Cost tracking.
- Tenant isolation.
- Developer workflows.
- Local development.
- Testing infrastructure.

No debe asumir que la solución correcta es:

```text
crear un paquete ai-platform
```

sin analizar el acoplamiento, las necesidades reales y los límites actuales.

---

# 3. Prohibiciones para Codex

Codex no debe:

- Crear una plataforma universal antes de detectar capacidades compartidas.
- Introducir abstracciones sin casos reales.
- Romper servicios estables para centralizar sin necesidad.
- Acoplar productos directamente a SDKs de proveedores.
- Crear un único worker pool para todo.
- Crear caches globales sin tenant.
- Crear un único índice vectorial global sin aislamiento.
- Crear feature flags sin ownership.
- Permitir cambios de prompt fuera del release.
- Usar configuración manual no reproducible.
- Mezclar datos de control y datos de ejecución sin límites.
- Usar producción para pruebas.
- Copiar datos reales a local.
- Hacer fallback automático sin revisar privacidad, seguridad o calidad.
- Enviar secretos a agentes.
- Desplegar una versión distinta de la evaluada.
- Desplegar sin manifest.
- Crear colas sin DLQ.
- Crear retries sin idempotencia.
- Crear autoscaling sin backpressure.
- Marcar plataforma como terminada sin adopción real.
- Marcar plataforma como terminada sin SLO.
- Marcar plataforma como terminada sin runbooks.
- Reemplazar lógica de dominio con abstracciones de plataforma.
- Introducir un SPOF sin análisis.
- Ignorar costes de operación.
- Ignorar developer experience.

---

# 4. Entregables previos obligatorios

Antes de modificar código, Codex debe entregar:

1. Inventario de productos.
2. Inventario de servicios.
3. Inventario de model calls.
4. Inventario de providers.
5. Inventario de prompts.
6. Inventario de agents.
7. Inventario de tools.
8. Inventario de schemas.
9. Inventario de workflows.
10. Inventario de queues.
11. Inventario de workers.
12. Inventario de jobs.
13. Inventario de webhooks.
14. Inventario de storage.
15. Inventario de caches.
16. Inventario de vector indexes.
17. Inventario de secrets.
18. Inventario de networking.
19. Inventario de environments.
20. Inventario de feature flags.
21. Inventario de CI/CD.
22. Inventario de observability.
23. Inventario de evals.
24. Inventario de cost tracking.
25. Inventario de tenant isolation.
26. Inventario de local development.
27. Inventario de runbooks.
28. Mapa control plane.
29. Mapa data plane.
30. Mapa developer plane.
31. Mapa de dependencias.
32. Matriz servicio-producto.
33. Matriz workload-worker.
34. Matriz provider-capability.
35. Matriz queue-policy.
36. Matriz tenant-quota.
37. Matriz environment-policy.
38. Gaps.
39. Arquitectura propuesta.
40. Paquetes.
41. Persistencia.
42. Fases.
43. Tests.
44. Evals.
45. Métricas.
46. Alertas.
47. SLO.
48. Runbooks.
49. ADR.
50. Plan de migración.

---

# 5. Definición

**AI Platform & Infrastructure Engineering** construye las capacidades comunes necesarias para desarrollar, desplegar y operar sistemas de IA.

Fórmula conceptual:

```text
AI PLATFORM =
control plane
+ data plane
+ developer plane
+ infrastructure
+ observability
+ security
+ governance
+ cost control
```

---

# 6. Problema que resuelve

Sin plataforma común:

```text
Agente A
→ SDK propio
→ prompt en código
→ logs propios
→ retries propios

Agente B
→ otro provider
→ tools directas
→ sin evals

Agente C
→ acceso directo a DB
→ sin tenant budget
→ sin versionado
```

Consecuencias:

- Duplicación.
- Inconsistencias.
- Riesgos.
- Lock-in.
- Costes imprevisibles.
- Releases difíciles.
- Debugging lento.
- Falta de trazabilidad.
- Dificultad de migración.
- Baja reutilización.
- Mayor tiempo de desarrollo.

---

# 7. Diferencia con Harness Engineering

Harness Engineering define el entorno de un agente concreto:

- Contexto.
- Tools.
- Memoria.
- Loop.
- Policies.
- Evals.
- Observability.

Platform Engineering proporciona las capacidades compartidas para muchos harnesses.

```text
Harness
→ configuración de un agente.

Platform
→ infraestructura reusable.
```

---

# 8. Diferencia con Model & Inference Engineering

Model & Inference Engineering decide:

- Modelo.
- Prompt.
- Reasoning.
- Fallback.
- Budget.
- Sampling.

Platform Engineering proporciona:

- Model Registry.
- Gateway.
- Provider adapters.
- Telemetry.
- Quotas.
- Routing runtime.
- Deployment control.

---

# 9. Diferencia con Durable Execution

Durable Execution define:

- Estado.
- Checkpoints.
- Reanudación.
- Timers.
- Replay.
- Idempotencia.

Platform Engineering proporciona:

- Workflow runtime.
- Queues.
- Workers.
- Storage.
- Scheduler.
- Capacity.
- Monitoring.
- Deployments.

---

# 10. Diferencia con DevOps tradicional

DevOps:

- Contenedores.
- CI/CD.
- Servidores.
- Bases de datos.
- Redes.
- Backups.

AI Platform añade:

- Prompt versions.
- Agent versions.
- Model policies.
- Tool permissions.
- Eval gates.
- RAG indexes.
- Memory stores.
- Token budgets.
- Cost attribution.
- Provider failover.
- AI-specific telemetry.
- Synthetic tenants.
- Shadow executions.

---

# 11. Principio de Paved Road

La plataforma debe ofrecer un camino recomendado.

```ts
const result = await aiPlatform.executeTask({
  taskType: "document_summary",
  tenantId,
  actorId,
  input,
});
```

La plataforma resuelve:

- Identity.
- Tenant.
- Authorization.
- Model routing.
- Prompt.
- Schema.
- Budget.
- Privacy.
- Security.
- Logs.
- Trace.
- Cost.
- Fallback.
- Evals.
- Governance.

---

# 12. Control Plane

Gestiona:

- Models.
- Prompts.
- Agents.
- Tools.
- Schemas.
- Policies.
- Feature flags.
- Tenant configuration.
- Quotas.
- Budgets.
- Deployments.
- Governance.
- Regulatory controls.
- Ownership.

---

# 13. Data Plane

Ejecuta:

- Inference.
- Agent runs.
- Retrieval.
- Tools.
- Workflows.
- Memory.
- Events.
- Streaming.
- Jobs.
- Checkpoints.
- Verification.

---

# 14. Developer Plane

Proporciona:

- SDK.
- CLI.
- Templates.
- Local runtime.
- Mock providers.
- Test harness.
- Synthetic tenants.
- Eval runner.
- Trace viewer.
- Scaffolding.
- Documentation.
- Fixtures.
- Failure injection.

---

# 15. Platform Core

```text
AI PLATFORM CORE
├── Identity Context
├── Tenant Context
├── Task Registry
├── Agent Registry
├── Model Gateway
├── Prompt Registry
├── Schema Registry
├── Tool Gateway
├── Workflow Runtime
├── Retrieval Gateway
├── Memory Gateway
├── Eval Service
├── Policy Engine
├── Observability
├── Cost Attribution
├── Feature Flags
└── Release Control
```

---

# 16. Service Catalog

```ts
export type AIPlatformServiceType =
  | "model_gateway"
  | "agent_runtime"
  | "tool_gateway"
  | "workflow_runtime"
  | "retrieval"
  | "memory"
  | "evaluation"
  | "observability"
  | "cost"
  | "control_plane";

export type AIPlatformService = {
  id: string;

  name: string;

  serviceType: AIPlatformServiceType;

  version: string;

  ownerId: string;

  supportedProducts: string[];

  availabilityTarget: number;

  latencyTargetMs?: number;

  documentationReference: string;

  runbookReference: string;

  status:
    | "experimental"
    | "supported"
    | "deprecated"
    | "retired";
};
```

---

# 17. Service Ownership

Cada servicio debe tener:

- Owner.
- On-call.
- SLO.
- Runbook.
- Dependencies.
- Capacity.
- Deployment.
- Version.
- Security review.
- Privacy review.
- Consumers.
- Deprecation policy.

---

# 18. Model Gateway

Arquitectura:

```text
Product
  ↓
Model Gateway
  ↓
Routing
  ↓
Provider Adapter
  ↓
Provider
```

Aplica:

- Authentication.
- Authorization.
- Tenant.
- Privacy.
- Security.
- Model policy.
- Budget.
- Rate limit.
- Retry.
- Fallback.
- Telemetry.
- Cost.
- Versioning.

---

# 19. Model Gateway Contract

```ts
export type PlatformInferenceRequest = {
  tenantId: string;
  actorId: string;

  productId: string;

  taskType: string;

  promptVersion: string;

  schemaVersion?: string;

  input: unknown;

  contextReferences: string[];

  privacyProfileId: string;

  securityProfileId: string;

  budgetProfileId: string;

  modelPolicyId: string;

  traceId: string;

  idempotencyKey?: string;
};
```

---

# 20. Platform Inference Result

```ts
export type PlatformInferenceResult = {
  output: unknown;

  providerId: string;

  modelId: string;
  modelSnapshot?: string;

  promptVersion: string;

  inputTokens: number;
  outputTokens: number;

  latencyMs: number;

  estimatedCost: number;

  traceId: string;

  warnings: string[];

  fallbackUsed: boolean;
};
```

---

# 21. Provider Adapter

```ts
export interface ModelProviderAdapter {
  providerId: string;

  infer(
    request: ProviderInferenceRequest
  ): Promise<ProviderInferenceResult>;

  stream?(
    request: ProviderInferenceRequest
  ): AsyncIterable<ProviderStreamEvent>;

  health(): Promise<ProviderHealth>;

  estimateCost(
    usage: ProviderUsage
  ): number;

  supports(
    capability: string
  ): boolean;
}
```

---

# 22. Provider Capability Registry

```ts
export type ProviderCapability = {
  providerId: string;

  capability:
    | "text"
    | "vision"
    | "audio"
    | "tools"
    | "structured_output"
    | "reasoning"
    | "embeddings"
    | "batch"
    | "streaming";

  modelIds: string[];

  regions: string[];

  privacyProfiles: string[];

  active: boolean;
};
```

---

# 23. No abstraction leakage

La abstracción debe permitir capacidades específicas.

No debe reducir todos los providers al mínimo común.

Ejemplo:

- Provider-specific structured outputs.
- Tool choice.
- Batch API.
- Prompt caching.
- Reasoning controls.
- Vision inputs.

Debe existir:

```text
common contract
+
provider extensions
```

---

# 24. Model Policy

```ts
export type ModelPolicy = {
  id: string;

  taskTypes: string[];

  primaryModelId: string;

  fallbackModelIds: string[];

  maximumInputTokens: number;
  maximumOutputTokens: number;

  maximumCost: number;

  maximumLatencyMs?: number;

  privacyProfileId: string;

  allowedRegions: string[];

  fallbackMode:
    | "none"
    | "same_provider"
    | "approved_providers";

  active: boolean;
};
```

---

# 25. Agent Runtime

Responsabilidades:

- Load agent definition.
- Resolve context.
- Resolve tools.
- Resolve model policy.
- Execute loop.
- Enforce budget.
- Persist state.
- Trace.
- Handle cancellation.
- Verify completion.
- Return status.

---

# 26. Agent Runtime Request

```ts
export type AgentRuntimeRequest = {
  agentId: string;
  agentVersion: string;

  tenantId: string;
  actorId: string;

  taskType: string;

  input: unknown;

  executionPolicyId: string;

  traceId: string;

  idempotencyKey?: string;
};
```

---

# 27. Agent Registry

```ts
export type PlatformAgentStatus =
  | "draft"
  | "shadow"
  | "canary"
  | "production"
  | "suspended"
  | "retired";

export type PlatformAgentDefinition = {
  id: string;

  name: string;
  version: string;

  productScope: string[];

  taskTypes: string[];

  modelPolicyId: string;

  promptIds: string[];

  allowedToolIds: string[];

  memoryPolicyId?: string;

  retrievalPolicyId?: string;

  executionPolicyId: string;

  evaluationSuiteId: string;

  governanceDecisionId: string;

  ownerId: string;

  status: PlatformAgentStatus;
};
```

---

# 28. Agent Runtime Result

```ts
export type AgentRuntimeResult = {
  runId: string;

  status:
    | "completed"
    | "partially_completed"
    | "waiting_for_approval"
    | "failed"
    | "cancelled";

  output?: unknown;

  actionIds: string[];

  warnings: string[];

  traceId: string;

  cost: number;
};
```

---

# 29. Tool Gateway

Arquitectura:

```text
Agent
  ↓
Tool Gateway
  ↓
Grant Resolver
  ↓
Authorization
  ↓
Schema
  ↓
Domain Service
  ↓
Verification
```

---

# 30. Tool Gateway Responsibilities

- Registry.
- Versioning.
- Tenant binding.
- Actor binding.
- Permissions.
- Purpose.
- Approval.
- Rate limits.
- Idempotency.
- Timeouts.
- Retries.
- Audit.
- Verification.
- Cost.
- Error normalization.

---

# 31. Tool Invocation Request

```ts
export type PlatformToolInvocationRequest = {
  toolName: string;
  toolVersion: string;

  tenantId: string;
  actorId: string;

  agentId: string;
  runId: string;

  arguments: unknown;

  approvalId?: string;

  purposeId: string;

  traceId: string;

  idempotencyKey: string;
};
```

---

# 32. Tool Invocation Result

```ts
export type PlatformToolInvocationResult = {
  success: boolean;

  output?: unknown;

  verificationStatus:
    | "not_required"
    | "pending"
    | "verified"
    | "failed";

  durationMs: number;

  retryable: boolean;

  errorCode?: string;

  traceId: string;
};
```

---

# 33. Prompt Registry

```ts
export type PlatformPromptDefinition = {
  id: string;

  taskType: string;

  version: string;

  templateReference: string;

  compatibleModelIds: string[];

  inputSchemaId: string;

  outputSchemaId?: string;

  evaluationSuiteId: string;

  contentHash: string;

  ownerId: string;

  status:
    | "draft"
    | "approved"
    | "deprecated";
};
```

---

# 34. Prompt Promotion

```text
DRAFT
  ↓
TEST
  ↓
EVAL
  ↓
SECURITY
  ↓
PRIVACY
  ↓
APPROVED
  ↓
SHADOW
  ↓
CANARY
  ↓
PRODUCTION
```

---

# 35. Schema Registry

```ts
export type PlatformSchema = {
  id: string;

  name: string;

  version: string;

  schema: unknown;

  compatiblePreviousVersions: string[];

  migrationReferences: string[];

  contentHash: string;

  status:
    | "active"
    | "deprecated"
    | "retired";
};
```

---

# 36. Schema Types

Versionar:

- Task input.
- Task output.
- Tool arguments.
- Tool results.
- Agent messages.
- Events.
- Checkpoints.
- Memory objects.
- Eval cases.
- Trace payloads.

---

# 37. Task Registry

```ts
export type PlatformTaskDefinition = {
  taskType: string;

  inputSchemaId: string;

  outputSchemaId: string;

  agentId?: string;

  directModelPolicyId?: string;

  allowedProducts: string[];

  riskLevel: string;

  budgetProfileId: string;

  evaluationSuiteId: string;

  active: boolean;
};
```

---

# 38. Workflow Runtime

Debe soportar:

- Durable state.
- Checkpoints.
- Timers.
- Events.
- Approvals.
- Retries.
- Compensation.
- Cancellation.
- Replay.
- Versioning.

---

# 39. Workflow Definition

```ts
export type PlatformWorkflowDefinition = {
  id: string;

  name: string;
  version: string;

  taskTypes: string[];

  stepDefinitions: unknown[];

  stateSchemaId: string;

  eventSchemaIds: string[];

  retryPolicyId: string;

  compensationPolicyId?: string;

  ownerId: string;

  status:
    | "draft"
    | "approved"
    | "production"
    | "retired";
};
```

---

# 40. Retrieval Gateway

Proporciona una interfaz común para:

- Keyword.
- Semantic.
- Hybrid.
- Filters.
- Reranking.
- Citations.
- Freshness.
- Tenant isolation.
- Permissions.
- Privacy.

---

# 41. Retrieval Request

```ts
export type PlatformRetrievalRequest = {
  tenantId: string;
  actorId: string;

  purposeId: string;

  query: string;

  retrievalPolicyId: string;

  maximumResults: number;

  traceId: string;
};
```

---

# 42. Memory Gateway

Gestiona:

- Candidate memory.
- Promotion.
- Retrieval.
- Scope.
- Tenant.
- User.
- Expiration.
- Deletion.
- Authority.
- Privacy.

---

# 43. Memory Request

```ts
export type PlatformMemoryRequest = {
  tenantId: string;
  userId?: string;

  agentId: string;

  purposeId: string;

  memoryTypes: string[];

  query?: string;

  maximumItems: number;

  traceId: string;
};
```

---

# 44. Evaluation Platform

Debe permitir:

- Dataset registry.
- Eval runners.
- Batch.
- Online evals.
- Regression gates.
- Comparisons.
- Model migration.
- Prompt migration.
- Tool migration.
- Shadow results.
- Security evals.
- Privacy evals.
- Governance evals.
- UX evals.

---

# 45. Eval Job

```ts
export type PlatformEvalJob = {
  id: string;

  suiteId: string;

  targetType:
    | "agent"
    | "prompt"
    | "model"
    | "tool"
    | "workflow"
    | "platform";

  targetVersion: string;

  datasetVersion: string;

  environment: string;

  status:
    | "queued"
    | "running"
    | "completed"
    | "failed";

  createdAt: string;
};
```

---

# 46. Feature Flags

```ts
export type AIFeatureFlag = {
  key: string;

  enabled: boolean;

  productIds?: string[];

  tenantIds?: string[];

  userIds?: string[];

  roles?: string[];

  regions?: string[];

  rolloutPercentage?: number;

  startsAt?: string;
  endsAt?: string;

  configuration: Record<string, unknown>;

  ownerId: string;
};
```

---

# 47. Feature Flag Rules

Toda flag debe tener:

- Owner.
- Purpose.
- Expiration.
- Default.
- Rollback.
- Audit.
- Environment.
- Tenant scope.
- Risk.
- Cleanup plan.

Evitar flags permanentes sin owner.

---

# 48. Tenant Configuration

```ts
export type TenantAIConfiguration = {
  tenantId: string;

  enabledAgentIds: string[];

  enabledToolIds: string[];

  modelPolicyOverrides: string[];

  approvalPolicyIds: string[];

  privacyProfileId: string;

  securityProfileId: string;

  budgetProfileId: string;

  notificationPolicyId: string;

  region: string;

  version: string;
};
```

---

# 49. Non-configurable Controls

El tenant no puede desactivar:

- Tenant isolation.
- RLS.
- Mandatory audit.
- Required transparency.
- Security policies.
- Privacy policies.
- Prohibited-use rules.
- Governance release gates.
- Regulatory retention.
- Incident reporting.

---

# 50. Environment Model

```text
LOCAL
DEV
TEST
STAGING
PILOT
PRODUCTION
```

Cada entorno debe tener:

- Credentials.
- Providers.
- Models.
- Data rules.
- Budgets.
- Quotas.
- Integrations.
- Storage.
- Telemetry.
- Feature flags.
- Secrets.
- Network policy.

---

# 51. Environment Policy

```ts
export type AIEnvironmentPolicy = {
  environment: string;

  allowedProviders: string[];

  allowedModelIds: string[];

  realPersonalDataAllowed: boolean;

  productionIntegrationsAllowed: boolean;

  maximumBudget: number;

  telemetryMode: string;

  secretsProfileId: string;

  egressPolicyId: string;
};
```

---

# 52. Synthetic Tenants

Debe poder generarse:

- Tenant.
- Users.
- Roles.
- Leads.
- Clients.
- Documents.
- Campaigns.
- Orders.
- Reservations.
- Integrations mocks.
- Workflows.
- Incidents.
- Evals.

---

# 53. Synthetic Tenant Contract

```ts
export type SyntheticTenantDefinition = {
  id: string;

  scenario: string;

  userCount: number;

  dataVolume: string;

  enabledProducts: string[];

  fixtures: string[];

  mockIntegrations: string[];

  resettable: boolean;
};
```

---

# 54. Local AI Runtime

Debe soportar:

- Mock provider.
- Recorded responses.
- Deterministic outputs.
- Tool mocks.
- Synthetic RAG.
- Memory sandbox.
- Trace capture.
- Eval runner.
- Failure injection.
- Offline mode.

---

# 55. Developer SDK

```ts
export interface AIPlatformSDK {
  executeTask(
    request: PlatformTaskRequest
  ): Promise<PlatformTaskResult>;

  startAgent(
    request: AgentRuntimeRequest
  ): Promise<AgentRuntimeResult>;

  invokeTool(
    request: PlatformToolInvocationRequest
  ): Promise<PlatformToolInvocationResult>;

  retrieve(
    request: PlatformRetrievalRequest
  ): Promise<PlatformRetrievalResult>;
}
```

---

# 56. CLI

Comandos orientativos:

```text
ai-platform agent validate
ai-platform prompt test
ai-platform eval run
ai-platform trace inspect
ai-platform tenant seed
ai-platform provider health
ai-platform release manifest
ai-platform rollback
ai-platform queue inspect
```

---

# 57. Golden Path

Crear una nueva capacidad:

```text
1. Registrar task.
2. Crear schema.
3. Crear prompt.
4. Seleccionar model policy.
5. Registrar tools.
6. Crear eval dataset.
7. Crear agent definition.
8. Añadir observability.
9. Crear feature flag.
10. Ejecutar shadow.
11. Ejecutar canary.
12. Promover.
```

---

# 58. Multi-Tenant Infrastructure

Aislamiento en:

- DB.
- Storage.
- Queues.
- Jobs.
- Traces.
- Caches.
- Vector indexes.
- Memory.
- Feature flags.
- Budgets.
- Provider connections.
- Secrets.
- Exports.
- Analytics.

---

# 59. Tenant Context

```ts
export type PlatformTenantContext = {
  tenantId: string;

  planId: string;

  region: string;

  budgetProfileId: string;

  privacyProfileId: string;

  securityProfileId: string;

  featureFlagVersion: string;

  configurationVersion: string;
};
```

---

# 60. Queue Architecture

```text
INFERENCE_QUEUE
TOOL_QUEUE
WORKFLOW_QUEUE
DOCUMENT_QUEUE
EMBEDDING_QUEUE
EVAL_QUEUE
NOTIFICATION_QUEUE
MAINTENANCE_QUEUE
```

---

# 61. Queue Policy

```ts
export type PlatformQueuePolicy = {
  queueName: string;

  workloadClass: AIWorkloadClass;

  priority: number;

  maximumAttempts: number;

  visibilityTimeoutMs: number;

  maximumExecutionMs: number;

  deadLetterQueueName: string;

  tenantFairnessEnabled: boolean;

  concurrencyLimit: number;
};
```

---

# 62. Workload Classes

```ts
export type AIWorkloadClass =
  | "interactive"
  | "background"
  | "batch"
  | "critical"
  | "evaluation"
  | "maintenance";
```

---

# 63. Interactive Workloads

- Chat.
- Smart forms.
- Action previews.
- Small retrieval.
- Low latency.

SLO:

- Lower latency.
- Higher priority.
- Strict timeout.
- Limited retries.

---

# 64. Background Workloads

- Summaries.
- Monitoring.
- Synchronization.
- Notifications.
- Non-urgent analysis.

---

# 65. Batch Workloads

- Embeddings.
- Reindexing.
- Large imports.
- Bulk evals.
- Document processing.

No deben bloquear workloads interactivos.

---

# 66. Critical Workloads

- Financial actions.
- Administrative changes.
- High-risk approvals.
- Incident remediation.

Deben tener:

- Isolation.
- Priority.
- Verification.
- Strong audit.
- Limited concurrency.

---

# 67. Worker Pools

```text
INTERACTIVE WORKERS
BACKGROUND WORKERS
DOCUMENT WORKERS
EVAL WORKERS
CRITICAL WORKERS
MAINTENANCE WORKERS
```

---

# 68. Worker Definition

```ts
export type PlatformWorkerDefinition = {
  id: string;

  workloadClasses: AIWorkloadClass[];

  queueNames: string[];

  concurrency: number;

  cpuLimit: number;

  memoryLimitMb: number;

  timeoutMs: number;

  networkPolicyId: string;

  secretsProfileId: string;

  autoscalingPolicyId: string;
};
```

---

# 69. Tenant Fairness

```ts
export type TenantExecutionQuota = {
  tenantId: string;

  maxConcurrentRuns: number;

  maxQueuedRuns: number;

  maxModelCallsPerMinute: number;

  maxToolCallsPerMinute: number;

  maxDocumentsPerHour: number;

  monthlyBudget: number;
};
```

---

# 70. Scheduling Fairness

Puede utilizar:

- Weighted fair queue.
- Per-tenant concurrency.
- Priority.
- Aging.
- Plan weight.
- Critical overrides.

No permitir starvation.

---

# 71. Backpressure

Cuando existe saturación:

- Enqueue.
- Delay.
- Reduce batch.
- Pause maintenance.
- Reject low priority.
- Show status.
- Apply tenant fairness.
- Disable retries.
- Activate circuit breaker.

---

# 72. Retry Storm Protection

Controles:

- Exponential backoff.
- Jitter.
- Maximum attempts.
- Retry budget.
- Circuit breaker.
- DLQ.
- Idempotency.
- Provider health.
- Tenant limits.

---

# 73. Dead Letter Queue

Toda DLQ debe tener:

- Owner.
- Alert.
- Inspection.
- Replay policy.
- Redaction.
- Retention.
- Tenant.
- Reason.
- Original trace.
- Runbook.

---

# 74. Capacity Planning

```ts
export type AICapacityForecast = {
  period: string;

  expectedRuns: number;

  expectedModelCalls: number;

  expectedInputTokens: number;

  expectedOutputTokens: number;

  expectedToolCalls: number;

  expectedDocuments: number;

  expectedEmbeddingTokens: number;

  requiredWorkers: number;

  expectedCost: number;
};
```

---

# 75. Capacity Inputs

- Active tenants.
- Users.
- Usage per plan.
- Feature adoption.
- Average tokens.
- Average tool calls.
- Average documents.
- Peak factor.
- Provider limits.
- Worker throughput.
- Queue age.
- Storage growth.

---

# 76. Autoscaling

Escalar según:

- Queue depth.
- Oldest job age.
- CPU.
- Memory.
- Active runs.
- Provider limits.
- Latency.
- Error rate.
- Time of day.
- Tenant demand.

---

# 77. Autoscaling Policy

```ts
export type AutoscalingPolicy = {
  id: string;

  minimumInstances: number;

  maximumInstances: number;

  targetQueueDepth?: number;

  targetOldestJobAgeMs?: number;

  targetCpuPercent?: number;

  scaleUpCooldownMs: number;

  scaleDownCooldownMs: number;

  providerRateLimitAware: boolean;
};
```

---

# 78. Secrets Infrastructure

Debe incluir:

- Secret manager.
- Encryption.
- Rotation.
- Expiration.
- Tenant binding.
- Service binding.
- Environment binding.
- Audit.
- Revocation.
- Break-glass.

---

# 79. Secret Reference

```ts
export type PlatformSecretReference = {
  secretId: string;

  provider: string;

  tenantId?: string;

  serviceIds: string[];

  environment: string;

  scope: string[];

  expiresAt?: string;

  rotationPolicyId: string;
};
```

---

# 80. Networking

Debe controlar:

- Internal service communication.
- Provider APIs.
- MCP.
- Webhooks.
- Storage.
- Database.
- DNS.
- Egress.
- Ingress.
- Private networks.
- Proxies.

---

# 81. Network Policy

```ts
export type PlatformNetworkPolicy = {
  id: string;

  allowedInternalServices: string[];

  allowedExternalDomains: string[];

  allowedPorts: number[];

  dnsPolicy: string;

  proxyRequired: boolean;

  publicIngressAllowed: boolean;

  mTLSRequired: boolean;
};
```

---

# 82. Storage Architecture

Categorías:

- Source documents.
- Generated artifacts.
- Temporary files.
- Checkpoints.
- Traces.
- Eval datasets.
- Exports.
- Backups.
- Model artifacts.

---

# 83. Storage Policy

```ts
export type PlatformStoragePolicy = {
  storageClass: string;

  tenantIsolationMode:
    | "path"
    | "bucket"
    | "account";

  encryptionRequired: boolean;

  retentionPolicyId: string;

  region: string;

  maximumObjectSizeBytes: number;

  malwareScanningRequired: boolean;

  publicAccessAllowed: boolean;
};
```

---

# 84. Database Architecture

Capas conceptuales:

- Domain data.
- AI control plane.
- AI execution.
- AI observability.
- AI governance.
- AI evaluation.
- AI cost.
- AI incidents.

No requiere bases físicas separadas inicialmente.

Sí requiere:

- Schemas.
- Ownership.
- RLS.
- Retention.
- Indexes.
- Access boundaries.

---

# 85. Vector Infrastructure

Debe soportar:

- Tenant.
- Index versions.
- Embedding versions.
- Filters.
- Reindex.
- Blue-green.
- Deletion.
- Capacity.
- Monitoring.
- Rollback.

---

# 86. Vector Index Registry

```ts
export type PlatformVectorIndex = {
  id: string;

  productId: string;

  tenantIsolationMode: string;

  embeddingModelId: string;

  version: string;

  active: boolean;

  status:
    | "building"
    | "shadow"
    | "active"
    | "retired";

  createdAt: string;
};
```

---

# 87. Cache Architecture

Tipos:

- Prompt cache.
- Model response cache.
- Retrieval cache.
- Tool cache.
- Configuration cache.
- Permission cache.
- Embedding cache.

---

# 88. Cache Policy

```ts
export type PlatformCachePolicy = {
  id: string;

  cacheType: string;

  tenantScoped: boolean;

  actorScoped: boolean;

  purposeScoped: boolean;

  ttlSeconds: number;

  maximumSizeBytes: number;

  invalidationMode:
    | "ttl"
    | "event"
    | "version"
    | "manual";

  sensitiveDataAllowed: boolean;
};
```

---

# 89. Configuration Management

```ts
export type AIPlatformConfiguration = {
  id: string;

  version: string;

  environment: string;

  productId: string;

  modelPolicyIds: string[];

  toolPolicyIds: string[];

  budgetPolicyIds: string[];

  featureFlagIds: string[];

  tenantConfigurationVersion?: string;

  contentHash: string;

  approvedBy: string;

  createdAt: string;
};
```

---

# 90. Configuration Promotion

```text
DRAFT
  ↓
VALIDATE
  ↓
TEST
  ↓
STAGING
  ↓
APPROVE
  ↓
PRODUCTION
```

No editar configuración crítica directamente en producción.

---

# 91. Infrastructure as Code

Debe cubrir:

- Networks.
- Databases.
- Queues.
- Workers.
- Storage.
- Secrets.
- Monitoring.
- Alerts.
- Policies.
- Backups.
- DNS.
- Certificates.
- Autoscaling.
- Access.

---

# 92. IaC Requirements

- Version control.
- Review.
- Plan.
- Drift detection.
- State protection.
- Secrets separation.
- Environment separation.
- Rollback.
- Documentation.
- Ownership.

---

# 93. CI/CD para IA

```text
CODE
  ↓
STATIC CHECKS
  ↓
UNIT TESTS
  ↓
INTEGRATION TESTS
  ↓
SECURITY
  ↓
PRIVACY
  ↓
EVALS
  ↓
GOVERNANCE
  ↓
BUILD
  ↓
STAGING
  ↓
SHADOW
  ↓
CANARY
  ↓
PRODUCTION
```

---

# 94. AI Artifact Promotion

Promocionar como conjunto:

```text
code
+ model policy
+ prompt
+ schema
+ agent
+ tools
+ workflow
+ policies
+ eval evidence
```

---

# 95. Deployment Manifest

```ts
export type AIPlatformDeploymentManifest = {
  releaseId: string;

  applicationVersion: string;

  agentVersions: Record<string, string>;

  promptVersions: Record<string, string>;

  schemaVersions: Record<string, string>;

  modelPolicyVersions: Record<string, string>;

  toolVersions: Record<string, string>;

  workflowVersions: Record<string, string>;

  governanceDecisionId: string;

  evaluationReportIds: string[];

  contentHash: string;

  createdAt: string;
};
```

---

# 96. Manifest Verification

Bloquear si:

- Version missing.
- Hash mismatch.
- Governance decision missing.
- Eval report missing.
- Tool version unapproved.
- Prompt deprecated.
- Model unavailable.
- Schema incompatible.
- Environment mismatch.

---

# 97. Shadow Deployments

Características:

- Same input.
- No user response.
- No side effects.
- Separate logs.
- Comparison.
- Limited data.
- Privacy review.

No ejecutar tools de escritura.

---

# 98. Shadow Result

```ts
export type ShadowExecutionResult = {
  productionRunId: string;

  shadowRunId: string;

  productionVersion: string;

  shadowVersion: string;

  outputDifferenceScore: number;

  costDifference: number;

  latencyDifferenceMs: number;

  safetyDifferences: string[];

  qualityDifferences: string[];
};
```

---

# 99. Canary Deployments

Dimensiones:

- Tenant.
- User.
- Percentage.
- Region.
- Task.
- Plan.
- Role.

---

# 100. Canary Policy

```ts
export type AICanaryPolicy = {
  releaseId: string;

  rolloutPercentages: number[];

  stageDurationMinutes: number[];

  stopThresholds: Record<string, number>;

  successThresholds: Record<string, number>;

  eligibleTenantIds?: string[];

  excludedTenantIds?: string[];
};
```

---

# 101. Rollback

Debe soportar:

- Model.
- Prompt.
- Agent.
- Tool.
- Workflow.
- Policy.
- Configuration.
- Feature flag.

---

# 102. Rollback Plan

```ts
export type AIPlatformRollbackPlan = {
  releaseId: string;

  rollbackTargetReleaseId: string;

  triggerConditions: string[];

  dataMigrationRollbackReference?: string;

  workflowCompatibilityNotes: string[];

  ownerId: string;

  maximumRollbackTimeMinutes: number;
};
```

---

# 103. Database Migrations

Cambios deben ser:

- Backward compatible.
- Expand-contract.
- Versioned.
- Tested.
- Reversible when possible.
- Compatible with old workers.
- Compatible with workflows in progress.

---

# 104. Workflow Version Compatibility

No romper runs activos.

Opciones:

- Finish on old version.
- Migrate.
- Cancel.
- Compensate.
- Dual runtime.

Debe documentarse.

---

# 105. Disaster Recovery

Escenarios:

- DB loss.
- Queue loss.
- Worker loss.
- Region failure.
- Provider outage.
- Secret compromise.
- Config corruption.
- Storage loss.
- Vector index loss.
- Observability outage.

---

# 106. Recovery Objectives

```ts
export type AIPlatformRecoveryObjective = {
  serviceId: string;

  rtoMinutes: number;

  rpoMinutes: number;

  recoveryProcedureReference: string;

  lastTestedAt: string;

  nextTestAt: string;
};
```

---

# 107. Backup Policy

Debe definir:

- Scope.
- Frequency.
- Encryption.
- Region.
- Retention.
- Restore tests.
- Tenant deletion.
- Legal hold.
- Access.
- Integrity.

---

# 108. Provider Outage

Opciones:

- Retry.
- Queue.
- Degrade.
- Fallback.
- Block.
- Human review.
- Manual execution.

No fallback indiscriminado.

---

# 109. Provider Circuit Breaker

```ts
export type ProviderCircuitBreakerPolicy = {
  providerId: string;

  failureThreshold: number;

  rollingWindowMs: number;

  openDurationMs: number;

  halfOpenRequests: number;

  fallbackPolicyId?: string;
};
```

---

# 110. Provider Health

```ts
export type ProviderHealth = {
  providerId: string;

  status:
    | "healthy"
    | "degraded"
    | "unavailable";

  latencyMs: number;

  errorRate: number;

  rateLimitRemaining?: number;

  checkedAt: string;
};
```

---

# 111. Platform SLO

```ts
export type AIPlatformSLO = {
  serviceId: string;

  availabilityTarget: number;

  latencyP95Ms?: number;

  successRateTarget?: number;

  maximumQueueAgeMs?: number;

  traceCoverageTarget?: number;

  costAttributionCoverageTarget?: number;

  measurementWindow: string;
};
```

---

# 112. Error Budget

```ts
export type PlatformErrorBudget = {
  serviceId: string;

  period: string;

  allowedFailureMinutes: number;

  consumedFailureMinutes: number;

  remainingPercent: number;

  deploymentFreezeRequired: boolean;
};
```

---

# 113. Observability

Debe registrar:

- Request.
- Tenant.
- Actor.
- Product.
- Agent.
- Model.
- Prompt.
- Tools.
- Workflow.
- Tokens.
- Cost.
- Latency.
- Queue.
- Worker.
- Errors.
- Provider.
- Fallback.
- Verification.
- Release.

---

# 114. Platform Trace Context

```ts
export type PlatformTraceContext = {
  traceId: string;

  runId?: string;

  workflowId?: string;

  tenantId: string;

  actorId: string;

  productId: string;

  agentId?: string;

  releaseId: string;

  environment: string;
};
```

---

# 115. Cost Attribution

Debe atribuir:

- Provider cost.
- Model cost.
- Prompt cost.
- Tool cost.
- Storage cost.
- Worker cost.
- Embedding cost.
- Egress cost.
- Observability cost.

Por:

- Tenant.
- Product.
- Feature.
- Agent.
- Task.
- Workflow.
- Plan.
- Environment.

---

# 116. Cost Record

```ts
export type AIPlatformCostRecord = {
  tenantId: string;

  productId: string;

  featureId: string;

  agentId?: string;

  taskType: string;

  providerId?: string;

  costCategory: string;

  amount: number;

  currency: "EUR";

  traceId: string;

  occurredAt: string;
};
```

---

# 117. Budget Profiles

```ts
export type AIPlatformBudgetProfile = {
  id: string;

  maximumCostPerRun: number;

  maximumCostPerDay: number;

  maximumCostPerMonth: number;

  maximumInputTokens: number;

  maximumOutputTokens: number;

  maximumToolCalls: number;

  maximumRuntimeMs: number;

  onExceeded:
    | "block"
    | "queue"
    | "degrade"
    | "review";
};
```

---

# 118. FinOps Controls

- Forecast.
- Budget alerts.
- Anomaly detection.
- Unit economics.
- Cost per successful task.
- Cost per tenant.
- Cost per plan.
- Idle capacity.
- Retry cost.
- Fallback cost.
- Eval cost.

---

# 119. Developer Experience

Debe proporcionar:

- SDK tipado.
- CLI.
- Templates.
- Examples.
- Local runtime.
- Mocks.
- Fixtures.
- Eval templates.
- Dashboards.
- Runbooks.
- Documentation.
- Code generation.
- Debugging.

---

# 120. Developer Portal

Puede mostrar:

- Services.
- Agents.
- Prompts.
- Models.
- Tools.
- Owners.
- Docs.
- SLO.
- Incidents.
- Releases.
- Evals.
- Dependencies.
- Runbooks.

---

# 121. Trace Viewer

Debe permitir:

- Ver run.
- Ver model calls.
- Ver tool calls.
- Ver workflow.
- Ver costs.
- Ver errors.
- Ver retries.
- Ver versions.
- Ver approvals.
- Ver tenant.
- Redactar datos sensibles.

---

# 122. Test Utilities

- Mock provider.
- Mock tool.
- Synthetic tenant.
- Recorded trace.
- Failure injector.
- Fake clock.
- Queue simulator.
- Provider outage.
- Rate-limit simulation.
- Cost simulation.

---

# 123. Anti-Platform Platform

Síntomas:

- Muchas interfaces.
- Configuración incomprensible.
- Debugging opaco.
- Desarrollo más lento.
- Producto evita la plataforma.
- Casos específicos imposibles.
- Exceso de burocracia.
- No existe owner.

La plataforma debe medir adopción.

---

# 124. Platform Adoption Metrics

```text
platform_sdk_adoption_rate
direct_provider_calls_total
direct_tool_calls_total
unregistered_prompts_total
unregistered_agents_total
golden_path_usage_rate
developer_lead_time
platform_support_tickets_total
```

---

# 125. Build vs Buy

Evaluar:

- Diferenciación.
- Tiempo.
- Coste.
- Operación.
- Lock-in.
- Privacidad.
- Seguridad.
- Escala.
- Talento.
- Reversibilidad.
- SLA.
- Ecosistema.

---

# 126. Managed Service Decision

```ts
export type PlatformCapabilityDecision = {
  capability: string;

  option:
    | "build"
    | "buy"
    | "managed"
    | "open_source"
    | "hybrid";

  rationale: string;

  estimatedCost: number;

  operationalRisk: string;

  lockInRisk: string;

  reviewAt: string;
};
```

---

# 127. Aplicación a NORA

Plataforma común:

- Model Gateway.
- Prompt Registry.
- Agent Runtime.
- OCR workers.
- Playbook retrieval.
- CRM Tool Gateway.
- Workflow runtime.
- Tenant policies.
- Evaluation.
- Observability.
- Cost attribution.

Motor fiscal:

```text
servicio determinista separado
```

---

# 128. NORA Workloads

## Interactive

- Fiscal explanation.
- CRM copilot.
- Playbook chat.
- Smart forms.

## Background

- Document processing.
- Notifications.
- Monitoring.
- Summaries.

## Batch

- Reindex.
- Embeddings.
- Bulk imports.
- Evals.

## Critical

- Legal actions.
- Data exports.
- Sensitive workflow changes.

---

# 129. Aplicación a EcomScaling IA

Necesita:

- Shopify connector.
- Meta connector.
- Klaviyo connector.
- Sync jobs.
- Metrics store.
- Agent runtime.
- Recommendation pipeline.
- Tool Gateway.
- Approval runtime.
- Cost attribution.
- Workload separation.

---

# 130. EcomScaling Workloads

## Interactive

- Campaign explanation.
- Dashboard insights.
- Recommendations.

## Background

- Sync.
- Monitoring.
- Alerts.
- Daily summaries.

## Critical

- Budget changes.
- Campaign pause.
- Audience actions.

## Batch

- Historical reprocessing.
- Creative analysis.
- Evals.

---

# 131. Aplicación al CRM

Necesita:

- Shared context.
- RAG.
- CRUD Tool Gateway.
- Document workers.
- Copilot runtime.
- Notifications.
- Durable workflows.
- Review queues.
- Role policies.
- Tenant isolation.

---

# 132. Arquitectura de paquetes propuesta

```text
packages/
  ai-platform/
    core/
      identity/
      tenancy/
      policies/
      contracts/

    sdk/
    cli/

    control-plane/
      tasks/
      agents/
      models/
      prompts/
      schemas/
      tools/
      workflows/
      flags/
      tenants/
      budgets/

    data-plane/
      inference/
      agents/
      tools/
      workflows/
      retrieval/
      memory/
      streaming/

    infrastructure/
      queues/
      workers/
      storage/
      database/
      cache/
      secrets/
      networking/
      autoscaling/
      backups/

    evaluation/
    observability/
    cost/
    governance/
    security/
    privacy/

    developer-tools/
      mocks/
      fixtures/
      synthetic-tenants/
      local-runtime/
      templates/
      trace-viewer/

    adapters/
      nora/
      ecommerce/
      crm/
```

Adaptar al repositorio real.

---

# 133. Persistencia orientativa

Posibles tablas:

```text
ai_platform_services
ai_platform_tasks
ai_platform_agents
ai_platform_agent_versions
ai_platform_prompts
ai_platform_schemas
ai_platform_tools
ai_platform_model_policies
ai_platform_provider_capabilities
ai_platform_workflows
ai_platform_feature_flags
ai_platform_tenant_configurations
ai_platform_budget_profiles
ai_platform_queue_policies
ai_platform_worker_definitions
ai_platform_deployment_manifests
ai_platform_releases
ai_platform_shadow_results
ai_platform_canary_results
ai_platform_cost_records
ai_platform_slo
ai_platform_incidents
ai_platform_runbooks
```

No crear sin analizar el esquema existente.

---

# 134. Service Table orientativa

```sql
CREATE TABLE ai_platform_services (
  id uuid PRIMARY KEY,

  service_key text NOT NULL,

  name text NOT NULL,

  service_type text NOT NULL,

  version text NOT NULL,

  owner_id uuid NOT NULL,

  availability_target numeric NOT NULL,

  documentation_reference text NOT NULL,

  runbook_reference text NOT NULL,

  status text NOT NULL,

  UNIQUE (service_key, version)
);
```

---

# 135. Agent Table orientativa

```sql
CREATE TABLE ai_platform_agents (
  id uuid PRIMARY KEY,

  agent_key text NOT NULL,

  name text NOT NULL,

  product_scope jsonb NOT NULL,

  owner_id uuid NOT NULL,

  current_version_id uuid,

  status text NOT NULL,

  UNIQUE (agent_key)
);
```

---

# 136. Agent Version Table

```sql
CREATE TABLE ai_platform_agent_versions (
  id uuid PRIMARY KEY,

  agent_id uuid NOT NULL,

  version text NOT NULL,

  model_policy_id uuid NOT NULL,

  prompt_ids jsonb NOT NULL,

  allowed_tool_ids jsonb NOT NULL,

  execution_policy_id uuid NOT NULL,

  evaluation_suite_id uuid NOT NULL,

  governance_decision_id uuid NOT NULL,

  content_hash text NOT NULL,

  status text NOT NULL,

  UNIQUE (agent_id, version)
);
```

---

# 137. Prompt Table

```sql
CREATE TABLE ai_platform_prompts (
  id uuid PRIMARY KEY,

  prompt_key text NOT NULL,

  task_type text NOT NULL,

  version text NOT NULL,

  template_reference text NOT NULL,

  input_schema_id uuid NOT NULL,

  output_schema_id uuid,

  compatible_model_ids jsonb NOT NULL,

  evaluation_suite_id uuid NOT NULL,

  content_hash text NOT NULL,

  status text NOT NULL,

  UNIQUE (prompt_key, version)
);
```

---

# 138. Feature Flag Table

```sql
CREATE TABLE ai_platform_feature_flags (
  id uuid PRIMARY KEY,

  flag_key text NOT NULL,

  environment text NOT NULL,

  enabled boolean NOT NULL,

  targeting jsonb NOT NULL,

  configuration jsonb NOT NULL,

  owner_id uuid NOT NULL,

  starts_at timestamptz,

  ends_at timestamptz,

  UNIQUE (flag_key, environment)
);
```

---

# 139. Deployment Manifest Table

```sql
CREATE TABLE ai_platform_deployment_manifests (
  id uuid PRIMARY KEY,

  release_id text NOT NULL,

  environment text NOT NULL,

  application_version text NOT NULL,

  manifest jsonb NOT NULL,

  content_hash text NOT NULL,

  governance_decision_id uuid NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (release_id, environment)
);
```

---

# 140. Cost Table

```sql
CREATE TABLE ai_platform_cost_records (
  id uuid PRIMARY KEY,

  tenant_id uuid NOT NULL,

  product_id text NOT NULL,

  feature_id text NOT NULL,

  agent_id text,

  task_type text NOT NULL,

  provider_id text,

  cost_category text NOT NULL,

  amount numeric NOT NULL,

  currency text NOT NULL DEFAULT 'EUR',

  trace_id text NOT NULL,

  occurred_at timestamptz NOT NULL
);
```

---

# 141. Platform Metrics

```text
platform_requests_total
platform_request_latency_ms
platform_availability
platform_queue_depth
platform_oldest_job_age_ms
platform_worker_utilization
platform_provider_error_rate
platform_provider_latency_ms
platform_fallback_rate
platform_trace_coverage
platform_cost_attribution_coverage
platform_tenant_isolation_failures
platform_deployment_rollback_rate
platform_direct_provider_calls_total
platform_golden_path_adoption_rate
platform_developer_lead_time
```

---

# 142. Queue Metrics

```text
queue_depth
queue_oldest_message_age_ms
queue_processing_rate
queue_failure_rate
queue_retry_rate
queue_dlq_depth
queue_tenant_fairness_violations
```

---

# 143. Worker Metrics

```text
worker_active_jobs
worker_utilization
worker_cpu
worker_memory
worker_job_duration_ms
worker_timeout_rate
worker_restart_rate
worker_autoscaling_events
```

---

# 144. Cost Metrics

```text
cost_per_run
cost_per_successful_run
cost_per_tenant
cost_per_feature
cost_per_agent
cost_per_provider
cost_retry_ratio
cost_fallback_ratio
budget_utilization
cost_anomaly_total
```

---

# 145. Alerts críticas

- Tenant isolation failure.
- Secret exposure.
- Production manifest mismatch.
- Unapproved agent in production.
- Queue data loss.
- Critical worker unavailable.
- Database failover failed.
- Backup restore failed.
- Provider credentials compromised.
- Cost runaway.
- RLS disabled.
- Cross-tenant cache collision.
- Release without governance decision.

---

# 146. Alerts altas

- Queue age above SLO.
- DLQ growth.
- Provider degraded.
- Retry storm.
- Autoscaling maxed.
- Cost anomaly.
- Trace coverage low.
- Worker saturation.
- Feature flag expired.
- Prompt version mismatch.
- Config drift.
- Backup overdue.

---

# 147. Alerts medias

- Low platform adoption.
- Direct provider calls.
- Deprecated prompt in use.
- Deprecated agent in use.
- Low cost attribution coverage.
- Capacity forecast exceeded.
- Stale runbook.
- Owner missing.
- Unused feature flags.
- Local environment using real provider unexpectedly.

---

# 148. Unit Tests

- Registry validation.
- Model policy.
- Provider capability.
- Prompt version.
- Schema compatibility.
- Tool policy.
- Budget.
- Feature flag.
- Queue policy.
- Tenant quota.
- Cache key.
- Manifest hash.
- Rollback target.
- SLO calculation.

---

# 149. Integration Tests

- Product to gateway.
- Gateway to provider.
- Agent to tool.
- Workflow to queue.
- Retrieval.
- Memory.
- Cost attribution.
- Trace propagation.
- Feature flag targeting.
- Tenant config.
- Shadow.
- Canary.
- Rollback.
- Provider outage.
- Queue retry.
- DLQ.
- Backup restore.

---

# 150. Platform Evals

Evaluar:

- Routing.
- Fallback.
- Budget enforcement.
- Tenant isolation.
- Provider compatibility.
- Prompt compatibility.
- Tool availability.
- Trace completeness.
- Cost attribution.
- Release manifest.
- Shadow comparison.
- Canary stop.
- Recovery.

---

# 151. Chaos Tests

- Provider outage.
- Queue unavailable.
- Worker crash.
- Database latency.
- Storage failure.
- DNS failure.
- Secret revocation.
- Config corruption.
- Vector index unavailable.
- Autoscaling failure.
- Region outage.
- High tenant load.
- Retry storm.

---

# 152. Disaster Recovery Tests

- Restore database.
- Restore storage.
- Rebuild vector index.
- Recover queue.
- Rehydrate checkpoints.
- Rotate secrets.
- Switch provider.
- Restore configuration.
- Validate RPO.
- Validate RTO.

---

# 153. Security Tests

- Cross-tenant.
- Secret access.
- Network egress.
- SSRF.
- Queue poisoning.
- Worker privilege.
- Cache isolation.
- Feature flag authorization.
- Manifest tampering.
- Provider adapter injection.
- DLQ access.
- Synthetic tenant isolation.

---

# 154. Quality Gates

Bloquear release si:

- Direct provider call added.
- Prompt unregistered.
- Agent unregistered.
- Schema unversioned.
- Tool unregistered.
- Eval suite missing.
- Manifest missing.
- Governance decision missing.
- Tenant isolation tests fail.
- Cost attribution missing.
- SLO missing.
- Runbook missing.
- Rollback missing.
- Shadow/canary required but absent.
- Config drift.
- Provider privacy profile missing.
- Critical finding open.

---

# 155. Fase 0 — Análisis exhaustivo

Analizar:

- Services.
- Calls.
- Providers.
- Agents.
- Tools.
- Prompts.
- Schemas.
- Workflows.
- Queues.
- Workers.
- Storage.
- DB.
- Cache.
- Secrets.
- Networking.
- CI/CD.
- Observability.
- Costs.
- Local development.

Entregables:

- Inventarios.
- Maps.
- Matrices.
- Gaps.
- Architecture.
- Packages.
- Migration plan.
- Tests.
- Metrics.
- SLO.
- Runbooks.

No implementar todavía.

---

# 156. Fase 1 — Core Contracts

Implementar:

- Tenant Context.
- Actor Context.
- Task Contract.
- Agent Contract.
- Model Request.
- Tool Request.
- Trace Context.
- Cost Record.

---

# 157. Fase 2 — Model Gateway

Implementar:

- Provider adapter.
- Model policy.
- Routing.
- Budget.
- Telemetry.
- Cost.
- One provider.

---

# 158. Fase 3 — Prompt and Schema Registry

Implementar:

- Prompt versions.
- Schema versions.
- Validation.
- Compatibility.
- Promotion states.

---

# 159. Fase 4 — Agent Registry and Runtime

Implementar:

- Agent definitions.
- Runtime.
- Budgets.
- Trace.
- Cancellation.
- Tests.

---

# 160. Fase 5 — Tool Gateway

Implementar:

- Registry.
- Grants.
- Authorization.
- Idempotency.
- Verification.
- Audit.

---

# 161. Fase 6 — Queues and Workers

Implementar:

- Workload classes.
- Queue policies.
- Worker pools.
- Retry.
- DLQ.
- Tenant fairness.

---

# 162. Fase 7 — Retrieval and Memory

Implementar:

- Retrieval gateway.
- Memory gateway.
- Tenant policies.
- Privacy.
- Security.

---

# 163. Fase 8 — Feature Flags and Tenant Config

Implementar:

- Flags.
- Targeting.
- Tenant config.
- Versioning.
- Audit.

---

# 164. Fase 9 — CI/CD

Implementar:

- Manifest.
- Eval gate.
- Governance gate.
- Shadow.
- Canary.
- Rollback.

---

# 165. Fase 10 — Cost and Capacity

Implementar:

- Attribution.
- Budgets.
- Forecast.
- Alerts.
- Capacity dashboards.

---

# 166. Fase 11 — Developer Plane

Implementar:

- SDK.
- CLI.
- Local runtime.
- Mock provider.
- Synthetic tenant.
- Trace viewer.
- Templates.

---

# 167. Fase 12 — DR and SLO

Implementar:

- SLO.
- Error budgets.
- Backups.
- Restore tests.
- Failover.
- Runbooks.

---

# 168. Fase 13 — Product Adapters

Implementar:

- NORA.
- EcomScaling.
- CRM.

Reutilizar plataforma.

---

# 169. Instrucciones directas para Codex

## Misión

Diseñar e integrar una plataforma común de AI Platform & Infrastructure Engineering adaptada al SaaS real.

## Regla obligatoria

Antes de implementar, analiza:

- Repositorio.
- Servicios.
- Providers.
- Agents.
- Prompts.
- Tools.
- Schemas.
- Workflows.
- Queues.
- Workers.
- Storage.
- Cache.
- Secrets.
- Networking.
- CI/CD.
- Observability.
- Cost.
- Tenancy.
- Developer experience.

## Restricciones

1. No implementar antes del análisis.
2. No crear plataforma universal sin casos reales.
3. No acoplar productos a providers.
4. No crear caches globales.
5. No crear un worker pool único.
6. No desplegar prompts fuera del release.
7. No usar configuración manual.
8. No usar datos reales en local.
9. No hacer fallback indiscriminado.
10. No marcar terminado sin SLO.
11. No marcar terminado sin runbooks.
12. No ignorar costes.
13. No sustituir lógica de dominio.
14. No crear abstracciones opacas.
15. Documentar desviaciones.

---

# 170. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio y el producto para diseñar una
arquitectura de AI Platform & Infrastructure Engineering.

No implementes todavía nuevos paquetes de plataforma.

Objetivos:

1. Identificar productos.
2. Identificar servicios.
3. Identificar model calls.
4. Identificar providers.
5. Identificar prompts.
6. Identificar agents.
7. Identificar tools.
8. Identificar schemas.
9. Identificar workflows.
10. Identificar queues.
11. Identificar workers.
12. Identificar jobs.
13. Identificar storage.
14. Identificar caches.
15. Identificar vector indexes.
16. Identificar secrets.
17. Identificar networking.
18. Identificar environments.
19. Identificar feature flags.
20. Identificar CI/CD.
21. Identificar observability.
22. Identificar cost tracking.
23. Identificar tenant isolation.
24. Identificar local development.
25. Identificar runbooks.
26. Crear control-plane map.
27. Crear data-plane map.
28. Crear developer-plane map.
29. Crear service-product matrix.
30. Crear workload-worker matrix.
31. Crear provider-capability matrix.
32. Crear queue-policy matrix.
33. Crear environment-policy matrix.
34. Proponer Model Gateway.
35. Proponer Agent Runtime.
36. Proponer Tool Gateway.
37. Proponer Prompt Registry.
38. Proponer Schema Registry.
39. Proponer Workflow Runtime.
40. Proponer Retrieval Gateway.
41. Proponer Memory Gateway.
42. Proponer Eval Platform.
43. Proponer Feature Flags.
44. Proponer Tenant Configuration.
45. Proponer Queues.
46. Proponer Worker Pools.
47. Proponer Cost Attribution.
48. Proponer CI/CD.
49. Proponer Shadow/Canary.
50. Proponer Rollback.
51. Proponer DR.
52. Proponer SDK/CLI.
53. Proponer arquitectura.
54. Proponer persistencia.
55. Proponer paquetes.
56. Proponer fases.
57. Proponer tests.
58. Proponer métricas.
59. Proponer alertas.
60. Proponer SLO.

Antes de modificar código, entrega:

a) diagnóstico,
b) control-plane map,
c) data-plane map,
d) developer-plane map,
e) service-product matrix,
f) workload-worker matrix,
g) provider-capability matrix,
h) gaps,
i) architecture,
j) package structure,
k) exact files,
l) migration plan.

Restricciones:

- No implementes todavía.
- No inventes componentes.
- No copies una plataforma genérica.
- No sustituyas lógica de producto.
- No marques terminado sin validación.
```

---

# 171. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de
AI Platform & Infrastructure Engineering.

Implementa solo:

1. Common contracts.
2. Tenant Context.
3. Trace Context.
4. Task Registry.
5. Model Gateway con un provider.
6. Model Policy.
7. Prompt Registry.
8. Schema Registry.
9. Cost Attribution básica.
10. Observability básica.
11. Unit and integration tests.

No implementes todavía:

- Multi-provider fallback global.
- Agent Runtime completo.
- Tool Gateway completo.
- Workflow Runtime.
- Multi-region.
- DR completo.
- Todos los productos.

Mantén compatibilidad con el código actual.
Documenta cada desviación.
```

---

# 172. ADR recomendados

- ADR: control plane.
- ADR: data plane.
- ADR: developer plane.
- ADR: service catalog.
- ADR: model gateway.
- ADR: provider adapters.
- ADR: model policies.
- ADR: agent runtime.
- ADR: tool gateway.
- ADR: prompt registry.
- ADR: schema registry.
- ADR: workflow runtime.
- ADR: retrieval gateway.
- ADR: memory gateway.
- ADR: feature flags.
- ADR: tenant configuration.
- ADR: queue architecture.
- ADR: worker pools.
- ADR: tenant fairness.
- ADR: caching.
- ADR: secrets.
- ADR: networking.
- ADR: IaC.
- ADR: AI CI/CD.
- ADR: deployment manifests.
- ADR: shadow.
- ADR: canary.
- ADR: rollback.
- ADR: DR.
- ADR: cost attribution.
- ADR: developer experience.
- ADR: build vs buy.

---

# 173. Criterios de aceptación

- [ ] Existe Service Catalog.
- [ ] Existe Control Plane.
- [ ] Existe Data Plane.
- [ ] Existe Developer Plane.
- [ ] Existe Model Gateway.
- [ ] Existen Provider Adapters.
- [ ] Existe Model Policy.
- [ ] Existe Agent Registry.
- [ ] Existe Prompt Registry.
- [ ] Existe Schema Registry.
- [ ] Existe Tool Gateway.
- [ ] Existe Workflow Runtime.
- [ ] Existe Retrieval Gateway.
- [ ] Existe Memory Gateway.
- [ ] Existe Eval Platform.
- [ ] Existen Feature Flags.
- [ ] Existe Tenant Configuration.
- [ ] Existen Queue Policies.
- [ ] Existen Worker Pools.
- [ ] Existe Tenant Fairness.
- [ ] Existe Cost Attribution.
- [ ] Existe Deployment Manifest.
- [ ] Existe Shadow.
- [ ] Existe Canary.
- [ ] Existe Rollback.
- [ ] Existe DR.
- [ ] Existen SLO.
- [ ] Existen Runbooks.
- [ ] Existe SDK.
- [ ] Existe Local Runtime.
- [ ] Existen Synthetic Tenants.
- [ ] Product adapters validados.

---

# 174. Definición de terminado

Una capacidad de plataforma está terminada cuando:

1. Tiene owner.
2. Tiene contrato.
3. Tiene versionado.
4. Tiene tenant isolation.
5. Tiene security review.
6. Tiene privacy review.
7. Tiene observability.
8. Tiene cost attribution.
9. Tiene SLO.
10. Tiene runbook.
11. Tiene tests.
12. Tiene alerts.
13. Tiene rollback.
14. Tiene capacity plan.
15. Tiene documentation.
16. Tiene developer experience.
17. Tiene adopción real.
18. Tiene deprecation path.
19. Está validada en producto real.

---

# 175. Resumen ejecutivo

Secuencia correcta:

```text
IDENTIFICAR CAPACIDAD COMPARTIDA
  ↓
DEFINIR CONTRATO
  ↓
CREAR GOLDEN PATH
  ↓
APLICAR TENANCY Y POLICIES
  ↓
INSTRUMENTAR
  ↓
VERSIONAR
  ↓
DESPLEGAR
  ↓
OPERAR
  ↓
MEDIR
  ↓
MEJORAR O RETIRAR
```

La plataforma común debe proporcionar:

- Control Plane.
- Data Plane.
- Developer Plane.
- Model Gateway.
- Agent Runtime.
- Tool Gateway.
- Prompt Registry.
- Schema Registry.
- Workflow Runtime.
- Retrieval Gateway.
- Memory Gateway.
- Eval Platform.
- Feature Flags.
- Tenant Configuration.
- Queues.
- Worker Pools.
- Storage.
- Cache.
- Secrets.
- Networking.
- Cost Attribution.
- CI/CD.
- Shadow.
- Canary.
- Rollback.
- DR.
- SDK.
- CLI.
- Local Runtime.
- Synthetic Tenants.
- SLO.
- Runbooks.

Cada producto debe aportar:

- Domain logic.
- Product-specific tools.
- Product-specific workflows.
- Product-specific evals.
- Product-specific UI.
- Product-specific policies.

AI Platform & Infrastructure Engineering no es:

```text
una capa genérica que sustituye al producto
```

Es:

```text
la infraestructura común
que permite ejecutar capacidades de IA
de forma uniforme, segura,
observable y operable
```
