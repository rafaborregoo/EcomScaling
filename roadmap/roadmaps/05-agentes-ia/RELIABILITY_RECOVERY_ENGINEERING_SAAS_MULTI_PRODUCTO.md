# Reliability & Recovery Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica transversal
- **Ámbito:** SaaS, CRM, agentes, workflows, tools, RAG, memoria, HITL, jobs, colas, APIs externas y sistemas multi-tenant
- **Casos de referencia:** NORA, EcomScaling IA y CRM/SaaS
- **Objetivo:** diseñar e implementar una arquitectura fiable que detecte, clasifique, contenga y recupere fallos sin duplicar efectos, perder estado ni ocultar resultados parciales
- **Audiencia:** Codex, arquitectura, backend, IA, DevOps, QA, seguridad, producto y operaciones
- **Prioridad:** crítica
- **Idioma:** castellano
- **Principio rector:** ningún fallo debe provocar reintentos ciegos, duplicación de acciones, pérdida de trazabilidad o declaraciones falsas de éxito

---

# 1. Propósito

Este documento define cómo implementar **Reliability & Recovery Engineering** en una plataforma SaaS con agentes de IA.

La arquitectura debe servir para:

- NORA.
- EcomScaling IA.
- CRM/SaaS.
- Copilotos.
- Agentes operativos.
- Workflows.
- Jobs.
- Colas.
- Procesos documentales.
- Integraciones externas.
- Operaciones financieras.
- Procesos con aprobación humana.
- Sistemas multiagente.
- Workflows de larga duración.

La arquitectura común no debe quedar acoplada a una única entidad o producto.

Debe permitir responder:

- Qué falló.
- Dónde falló.
- Por qué falló.
- Si el fallo es temporal.
- Si el fallo es permanente.
- Si es seguro reintentar.
- Qué ya se ejecutó.
- Qué quedó pendiente.
- Qué debe verificarse.
- Qué debe compensarse.
- Qué debe escalarse.
- Qué debe comunicarse al usuario.

---

# 2. Regla obligatoria de análisis previo

## 2.1 Principio

Antes de implementar retries, circuit breakers, fallbacks o compensaciones, Codex debe analizar exhaustivamente el sistema real.

No debe copiar políticas genéricas.

Debe adaptar Reliability & Recovery a:

- Arquitectura.
- Proveedores.
- Modelos.
- Tools.
- APIs.
- Servicios.
- Base de datos.
- Colas.
- Jobs.
- Eventos.
- Workflows.
- RAG.
- Memoria.
- HITL.
- Multi-tenancy.
- Idempotencia.
- Transacciones.
- Acciones reversibles.
- Acciones irreversibles.
- Riesgo.
- Coste.
- Latencia.
- Requisitos jurídicos.
- SLA.
- Operación real.

## 2.2 Prohibiciones

Codex no debe:

- Reintentar todo.
- Reintentar errores permanentes.
- Reintentar inmediatamente.
- Reintentar en varias capas sin coordinación.
- Reiniciar workflows completos por defecto.
- Repetir escrituras sin idempotencia.
- Usar un timeout como prueba de que no hubo efecto.
- Declarar éxito por un HTTP 200.
- Compensar eliminando historial.
- Ocultar resultados parciales.
- Usar fallbacks no evaluados.
- Permitir que el modelo decida reintentos críticos.
- Introducir circuit breakers sin métricas.
- Implementar DLQ sin proceso de revisión.
- Introducir colas sin entender ordering e idempotencia.
- Crear políticas sin tests.
- Marcar como terminado con fallos activos.

## 2.3 Entregables previos

Antes de modificar código, Codex debe entregar:

1. Mapa de workflows.
2. Mapa de tools.
3. Mapa de APIs externas.
4. Mapa de servicios.
5. Mapa de base de datos.
6. Mapa de jobs y colas.
7. Mapa de eventos.
8. Mapa de escrituras.
9. Mapa de efectos externos.
10. Mapa de idempotencia.
11. Mapa de timeouts.
12. Mapa de retries.
13. Mapa de fallbacks.
14. Mapa de compensaciones.
15. Mapa de verificación.
16. Mapa de fallos históricos.
17. Mapa de riesgos.
18. Matriz de recuperación.
19. Matriz de niveles de fiabilidad.
20. Propuesta de arquitectura.
21. Propuesta de archivos.
22. Propuesta de tests.
23. Propuesta de métricas.
24. Propuesta de alertas.

No debe implementarse antes de revisar este análisis.

---

# 3. Definición

**Reliability & Recovery Engineering** es la disciplina que garantiza que un sistema:

- Siga operando cuando fallan componentes.
- Contenga los fallos.
- No duplique acciones.
- Preserve resultados válidos.
- Pueda reanudar.
- Pueda compensar.
- Pueda verificar.
- Pueda degradarse de forma controlada.
- Pueda escalar a personas.
- Comunique el estado real.

Fórmula conceptual:

```text
Reliability & Recovery =
clasificación de fallos
+ timeouts
+ retries
+ idempotencia
+ circuit breakers
+ aislamiento
+ fallbacks
+ compensaciones
+ reconciliación
+ verificación
+ escalado
```

---

# 4. Diferencia con Durable State & Execution

## Reliability & Recovery

Responde:

```text
¿Qué hacemos cuando algo falla?
```

## Durable State & Execution

Responde:

```text
¿Dónde está guardado el proceso y cómo continúa?
```

Reliability define la estrategia.

Durable Execution proporciona el mecanismo persistente.

Ejemplo:

```text
Reliability:
La API de Meta ha fallado.
Debemos decidir si reintentar o esperar.

Durable Execution:
Debemos saber qué campañas ya se procesaron.
```

---

# 5. Taxonomía de fallos

```ts
export type FailureCategory =
  | "transient"
  | "rate_limit"
  | "permanent"
  | "ambiguous"
  | "partial"
  | "semantic"
  | "data"
  | "concurrency"
  | "human"
  | "security"
  | "unknown";
```

---

# 6. Fallo transitorio

Problema temporal.

Ejemplos:

- Red.
- Timeout breve.
- 502.
- 503.
- Base de datos ocupada.
- Proveedor reiniciándose.

Respuesta habitual:

```text
retry limitado
+ backoff
+ jitter
```

---

# 7. Rate limit

Ejemplos:

- HTTP 429.
- Tokens por minuto.
- Concurrencia superada.
- Cola saturada.

Respuesta:

```text
Retry-After
+ backoff
+ reducir concurrencia
+ encolar
```

Nunca reintentar inmediatamente en bucle.

---

# 8. Fallo permanente

Ejemplos:

- ID inexistente.
- Permiso denegado.
- Estado inválido.
- Argumento inválido.
- Recurso eliminado.
- Regla de negocio incumplida.

Respuesta:

```text
no retry
+ corregir
+ detener
+ escalar
```

---

# 9. Fallo ambiguo

La operación pudo ejecutarse, pero la respuesta no llegó.

Ejemplos:

- Reembolso.
- Pausa de campaña.
- Creación de reserva.
- Envío de comunicación.
- Generación de PDF remoto.

Respuesta:

```text
read before retry
+ idempotencia
+ reconciliación
```

---

# 10. Fallo parcial

Parte del workflow completó.

Ejemplo:

```text
Reserva cancelada.
Inmueble liberado.
Reembolso fallido.
```

Resultado:

```text
partially_completed
```

No:

```text
completed
```

---

# 11. Fallo semántico

El sistema funcionó técnicamente pero produjo un resultado incorrecto.

Ejemplos:

- Tool correcta con interpretación incorrecta.
- PDF generado con cifras equivocadas.
- Campaña pausada por una regla mal aplicada.
- Documento identificado erróneamente.

Detección:

- Evals.
- Invariantes.
- Verificadores.
- Fuentes canónicas.
- Revisión humana.

---

# 12. Fallo de datos

Ejemplos:

- Dato ausente.
- Dato obsoleto.
- Fuentes contradictorias.
- Documento no indexado.
- Margen desconocido.
- Métricas incompletas.
- Referencia duplicada.
- Cross-tenant.

Respuesta:

```text
no inventar
+ devolver parcial
+ solicitar datos
+ escalar
```

---

# 13. Fallo de concurrencia

Ejemplos:

- Dos agentes actualizan el mismo recurso.
- Doble reembolso.
- Dos jobs procesan el mismo evento.
- Cambio de estado simultáneo.

Controles:

- Optimistic locking.
- Pessimistic locking cuando proceda.
- Versiones.
- Idempotencia.
- Serialización por recurso.
- Revalidación.
- Transacciones.

---

# 14. Fallo humano

Ejemplos:

- Aprobación caducada.
- Revisor sin permisos.
- No respuesta.
- Argumentos cambiados.
- Rechazo.
- Revisor equivocado.

Recuperación:

- Nueva revisión.
- Escalado.
- Cancelación.
- Replanificación.
- Takeover humano.

---

# 15. Fallo de seguridad

Ejemplos:

- Tenant mismatch.
- Tool prohibida.
- Prompt injection.
- Approval bypass.
- Escalada de privilegios.
- Secreto expuesto.

Respuesta:

```text
fail closed
+ bloquear
+ preservar evidencia
+ alertar
+ escalar
```

---

# 16. Los seis objetivos

```text
1. Prevenir
2. Detectar
3. Contener
4. Recuperar
5. Compensar
6. Comunicar
```

---

# 17. Prevención

Controles:

- Validación.
- Schemas.
- Permisos.
- Tenant.
- Idempotencia.
- Invariantes.
- Timeouts.
- Límites.
- Datos canónicos.
- Concurrencia.
- Feature flags.
- Canaries.

---

# 18. Detección

Detectar:

- Timeout.
- Error.
- Output inválido.
- No progreso.
- Repetición.
- Duplicación.
- Desviación de estado.
- Circuito abierto.
- Saturación.
- Fallo de verificación.

---

# 19. Contención

Medidas:

- Circuit breaker.
- Bulkheads.
- Pools separados.
- Colas separadas.
- Rate limiting.
- Cancelación.
- Aislamiento por tenant.
- Límites de concurrencia.
- Feature kill switch.

---

# 20. Recuperación

Estrategias:

- Retry.
- Wait.
- Resume.
- Fallback.
- Replan.
- Reconciliation.
- Manual intervention.
- Partial continuation.

---

# 21. Compensación

Estrategias:

- Revertir estado.
- Crear operación compensatoria.
- Liberar recurso.
- Reabrir.
- Restaurar configuración.
- Emitir rectificación.
- Crear tarea correctiva.

---

# 22. Comunicación

El usuario debe saber:

- Qué funcionó.
- Qué falló.
- Qué sigue pendiente.
- Qué se reintentará.
- Qué necesita acción humana.
- Qué no debe repetirse.

Ejemplo:

```text
El estudio fiscal está guardado.
El PDF no pudo generarse.
La regeneración está programada.
```

---

# 23. Contrato de error

```ts
export type RecoverableError = {
  code: string;

  category: FailureCategory;

  message: string;

  retryable: boolean;
  safeToRetry: boolean;

  retryAfterMs?: number;

  idempotencyRequired: boolean;
  verificationRequired: boolean;

  suggestedRecovery:
    | "retry"
    | "fallback"
    | "wait"
    | "verify"
    | "reconcile"
    | "compensate"
    | "request_input"
    | "escalate"
    | "terminate";

  metadata?: Record<string, unknown>;
};
```

---

# 24. Error codes

## Modelo

```text
MODEL_TIMEOUT
MODEL_RATE_LIMITED
MODEL_UNAVAILABLE
MODEL_OUTPUT_INVALID
MODEL_CONTEXT_OVERFLOW
MODEL_EMPTY_RESPONSE
```

## Tool

```text
TOOL_TIMEOUT
TOOL_ARGUMENT_INVALID
TOOL_NOT_ALLOWED
TOOL_RESULT_INVALID
TOOL_EXTERNAL_ERROR
```

## Datos

```text
DATA_MISSING
DATA_STALE
DATA_CONFLICT
DATA_CROSS_TENANT
```

## Workflow

```text
NO_PROGRESS
MAX_STEPS_REACHED
PARTIAL_COMPLETION
DUPLICATE_ACTION
STATE_DIVERGENCE
```

## Seguridad

```text
PERMISSION_DENIED
TENANT_MISMATCH
APPROVAL_REQUIRED
APPROVAL_EXPIRED
PROMPT_INJECTION_DETECTED
```

---

# 25. Recovery Decision Engine

```ts
export interface RecoveryDecisionEngine {
  decide(input: {
    error: RecoverableError;
    operation: OperationMetadata;
    workflow: WorkflowState;
    budget: RecoveryBudget;
  }): Promise<RecoveryDecision>;
}
```

```ts
export type RecoveryDecision = {
  action:
    | "retry"
    | "fallback"
    | "wait"
    | "verify"
    | "reconcile"
    | "compensate"
    | "continue_partial"
    | "escalate"
    | "fail";

  reason: string;

  delayMs?: number;
  nextNodeId?: string;
};
```

---

# 26. Política de timeout

```ts
export type TimeoutPolicy = {
  connectionTimeoutMs: number;
  executionTimeoutMs: number;
  totalDeadlineMs: number;
};
```

Toda operación remota debe declarar:

- Connection timeout.
- Read timeout.
- Execution timeout.
- Workflow deadline.

---

# 27. Deadline global

```ts
export type WorkflowDeadline = {
  startedAt: string;
  expiresAt: string;
  maximumDurationMs: number;
};
```

Los reintentos deben caber dentro del deadline.

---

# 28. Retry Policy

```ts
export type RetryPolicy = {
  maxAttempts: number;

  initialDelayMs: number;
  maximumDelayMs: number;

  backoffMultiplier: number;
  jitter: boolean;

  retryableErrorCodes: string[];
  nonRetryableErrorCodes: string[];

  respectRetryAfter: boolean;

  totalRetryBudgetMs: number;
};
```

---

# 29. Backoff

Ejemplo:

```text
1 s
2 s
4 s
8 s
```

---

# 30. Jitter

Ejemplo:

```text
1,2 s
2,8 s
4,5 s
7,3 s
```

Evita retry storms.

---

# 31. Retry Budget

```ts
export type RecoveryBudget = {
  maxRetriesPerOperation: number;
  maxRetriesPerRun: number;

  maxRetryDurationMs: number;
  maxRecoveryDurationMs: number;

  maxRetryCost: number;
  maxRecoveryCost: number;
};
```

---

# 32. Política por capa

Debe existir una única capa responsable del retry principal.

Ejemplo incorrecto:

```text
SDK x3
Tool x3
Workflow x3
```

Resultado:

```text
27 llamadas
```

Ejemplo correcto:

```text
SDK: retry mínimo o desactivado
Tool: errores normalizados
Workflow: política central
```

---

# 33. Idempotencia

```ts
export type IdempotencyMetadata = {
  key: string;
  operationName: string;
  resourceId?: string;
  workflowId: string;
  nodeId: string;

  status:
    | "started"
    | "completed"
    | "failed"
    | "ambiguous";
};
```

---

# 34. Generación de claves

```ts
const idempotencyKey =
  `${workflowId}:${nodeId}:${resourceId}`;
```

Debe ser estable entre retries.

---

# 35. Operaciones que requieren idempotencia

- Pagos.
- Reembolsos.
- Reservas.
- Tareas.
- Notificaciones.
- Emails.
- Webhooks.
- PDFs.
- Facturación.
- Campañas.
- Cambios de presupuesto.
- Creación de documentos.
- Sincronizaciones.

---

# 36. Read Before Retry

Proceso:

```text
timeout
  ↓
consultar estado
  ↓
ya ejecutado → success
no ejecutado → retry
desconocido → wait/escalate
```

---

# 37. Circuit Breaker

```ts
export type CircuitBreakerState =
  | "closed"
  | "open"
  | "half_open";
```

```ts
export type CircuitBreakerPolicy = {
  failureThreshold: number;
  failureWindowMs: number;
  openDurationMs: number;
  halfOpenMaxCalls: number;
  successThresholdToClose: number;
};
```

---

# 38. Comportamiento del Circuit Breaker

## Closed

Llamadas normales.

## Open

Falla rápido.

## Half-open

Prueba algunas llamadas.

---

# 39. Circuit Breaker por dependencia

Separar:

- OpenAI.
- Anthropic.
- Meta.
- Shopify.
- Supabase.
- Storage.
- Email.
- PDF renderer.
- Vector store.

No usar un único circuito global.

---

# 40. Bulkheads

Aislar:

- Lecturas.
- Escrituras.
- Operaciones críticas.
- Jobs.
- Agentes interactivos.
- Integraciones.
- Tenants de alto volumen.
- Modelos.
- Productos.

---

# 41. Concurrency Limits

```ts
export type ConcurrencyPolicy = {
  globalLimit: number;
  perTenantLimit: number;
  perToolLimit: number;
  perResourceLimit: number;
};
```

---

# 42. Fallbacks

```ts
export type FallbackPolicy = {
  primary: string;
  alternatives: string[];

  activationConditions: string[];

  requiresEvalApproval: boolean;
  allowedRiskLevels: string[];

  degradationMessage: string;
};
```

---

# 43. Fallback de modelo

Debe verificar:

- Tool calling.
- Structured output.
- Context.
- Calidad.
- Seguridad.
- Coste.
- Latencia.
- Evals.

No cambiar a un modelo no evaluado.

---

# 44. Fallback funcional

Ejemplo NORA:

```text
Resumen IA falla
  ↓
usar resumen determinista
```

Nunca reemplazar cálculo fiscal por estimación generativa.

---

# 45. Fallback de datos

Puede usar snapshot anterior si:

- Está identificado.
- Está fechado.
- Se informa antigüedad.
- Se limita el alcance.
- No afecta decisión crítica.

---

# 46. Fallback humano

```text
Automatización insegura
  ↓
crear tarea humana
```

---

# 47. Graceful Degradation

```ts
export type DegradationMode =
  | "full"
  | "read_only"
  | "no_rag"
  | "no_memory"
  | "no_external_actions"
  | "deterministic_only"
  | "maintenance";
```

---

# 48. Ejemplos de degradación

## RAG caído

- Permitir datos estructurados.
- Bloquear respuestas documentales.
- Informar.

## Modelo caído

- Usar cálculo determinista.
- Desactivar generación.
- Encolar.

## Observabilidad externa caída

- Buffer local.
- Continuar bajo riesgo.
- Bloquear críticos si la trazabilidad es obligatoria.

---

# 49. Dead-Letter Queue

```ts
export type DeadLetterItem = {
  id: string;
  queueName: string;

  payloadReference: string;

  errorCode: string;
  attempts: number;

  firstFailedAt: string;
  lastFailedAt: string;

  tenantId: string;
  workflowId?: string;

  status:
    | "pending_review"
    | "reprocessed"
    | "discarded"
    | "resolved";
};
```

---

# 50. Reprocesamiento de DLQ

Debe requerir:

- Análisis.
- Corrección.
- Confirmación de idempotencia.
- Revalidación.
- Trazabilidad.
- Permisos.

No añadir botón “retry all” sin control.

---

# 51. Saga Pattern

```ts
export type SagaStep = {
  id: string;

  execute: () => Promise<void>;

  compensate?: () => Promise<void>;

  compensationRequired: boolean;
};
```

---

# 52. Compensaciones

Ejemplos:

| Acción | Compensación |
|---|---|
| Reservar inmueble | Liberar |
| Crear tarea | Cancelar |
| Cambiar presupuesto | Restaurar |
| Crear documento | Marcar anulado |
| Cancelar reserva | Reabrir si procede |
| Enviar email | Rectificación |

---

# 53. Compensation Registry

```ts
export interface CompensationRegistry {
  getCompensation(
    operationName: string
  ): CompensationHandler | null;
}
```

---

# 54. Compensación y trazabilidad

Registrar:

- Acción original.
- Error.
- Compensación.
- Resultado.
- Actor.
- Fecha.
- Efecto final.

---

# 55. Verificación posterior

```ts
export type VerificationPolicy = {
  required: boolean;
  verifierName: string;
  maximumWaitMs: number;
  retryPolicy?: RetryPolicy;
};
```

---

# 56. Verificación de estado

```ts
export type PostExecutionVerification = {
  operationId: string;

  expectedState: unknown;
  actualState: unknown;

  passed: boolean;
  discrepancies: string[];

  verifiedAt: string;
};
```

---

# 57. Reconciliation

```ts
export type ReconciliationResult = {
  expectedState: unknown;
  actualState: unknown;

  matches: boolean;

  discrepancies: string[];

  suggestedAction:
    | "none"
    | "retry"
    | "repair"
    | "compensate"
    | "escalate";
};
```

---

# 58. Jobs de reconciliación

Ejemplos:

- Pagos.
- Reembolsos.
- Campañas.
- Documentos.
- PDFs.
- Webhooks.
- Vector store.
- Sincronizaciones.
- Estado de reservas.

---

# 59. Resultados parciales

```ts
export type PartialResult<T> = {
  status: "partial";

  completed: T[];
  failed: FailedItem[];
  pending: PendingItem[];

  nextActions: string[];
};
```

---

# 60. Comunicación de parcialidad

Debe indicar:

- Porcentaje.
- Elementos completados.
- Pendientes.
- Motivo.
- Próximo intento.
- Acción humana necesaria.

---

# 61. Cancelación

```ts
export type CancellationRequest = {
  workflowId: string;
  requestedBy: string;
  reason: string;
  requestedAt: string;
};
```

---

# 62. Cancelación segura

Debe:

1. Detener nuevos pasos.
2. Esperar operaciones seguras.
3. Cancelar tareas.
4. Liberar recursos.
5. Compensar.
6. Guardar estado.
7. Auditar.
8. Comunicar.

---

# 63. Recovery Status

```ts
export type RecoveryStatus =
  | "not_required"
  | "retry_scheduled"
  | "fallback_active"
  | "waiting_for_dependency"
  | "waiting_for_human"
  | "compensating"
  | "reconciling"
  | "partially_recovered"
  | "recovered"
  | "unrecoverable";
```

---

# 64. Tool Reliability Contract

```ts
export type ToolReliabilityContract = {
  timeoutPolicy: TimeoutPolicy;

  retryPolicy: RetryPolicy;

  idempotent: boolean;
  supportsIdempotencyKey: boolean;

  verificationPolicy: VerificationPolicy;

  compensationTool?: string;

  circuitBreakerPolicyId?: string;

  fallbackTool?: string;

  failureModes: string[];
};
```

---

# 65. Requisitos por tool

Toda tool debe declarar:

- Timeout.
- Retry.
- Idempotencia.
- Verificación.
- Compensación.
- Circuit breaker.
- Fallback.
- Errores permanentes.
- Errores retryable.
- Coste.

---

# 66. Fallos de modelos

## Rate limit

- Retry-After.
- Backoff.
- Queue.
- Model routing.

## Output inválido

- Schema.
- Repair limitado.
- Retry con feedback.
- Fallback.
- Escalado.

## Context overflow

- Compresión.
- Retrieval.
- División.
- No truncar datos críticos.

## Empty response

- Retry limitado.
- Finish reason.
- Fallback.

## Provider unavailable

- Secondary model.
- Queue.
- Degradation.

---

# 67. Model Fallback Matrix

```ts
export type ModelFallbackRule = {
  taskType: string;
  primaryModel: string;
  fallbackModels: string[];
  minimumEvalScore: number;
  allowedRiskLevels: string[];
};
```

---

# 68. Fallos de RAG

- Vector store caído.
- Retrieval vacío.
- Documento obsoleto.
- Chunk corrupto.
- Tenant filter ausente.
- Reranker fallido.

Recuperación:

- Fuente canónica.
- Search estructurada.
- Reindexación.
- Devolver limitación.
- No inventar.

---

# 69. Fallos de memoria

- Obsolescencia.
- Conflictos.
- Scope incorrecto.
- Cross-tenant.
- Escritura fallida.

Prioridad:

```text
datos vivos
>
fuente canónica
>
memoria
```

---

# 70. Fallos de Human-in-the-Loop

- Aprobación caducada.
- Revisor no responde.
- Estado cambia.
- Argumentos editados.
- Permiso revocado.

Recuperación:

- Nueva aprobación.
- Escalado.
- Revalidación.
- Cancelación.

---

# 71. Fallos multiagente

Debe poder:

- Reintentar worker fallido.
- Conservar outputs válidos.
- Continuar parcial.
- Reemplazar worker.
- Cancelar síntesis.
- Escalar.

No repetir todos los workers.

---

# 72. Reliability Levels

```ts
export type ReliabilityLevel =
  | "best_effort"
  | "recoverable"
  | "verified"
  | "transactional"
  | "critical";
```

---

# 73. Nivel best effort

Adecuado para:

- Sugerencias.
- Borradores.
- Resúmenes.
- Contenido no crítico.

---

# 74. Nivel recoverable

Adecuado para:

- Lecturas.
- Análisis.
- Tareas internas.
- Indexación.

---

# 75. Nivel verified

Adecuado para:

- Escrituras.
- Cambios de estado.
- Comunicaciones.
- PDFs.

---

# 76. Nivel transactional

Adecuado para:

- Reservas.
- Pagos.
- Presupuestos.
- Contratos.
- Operaciones masivas.

---

# 77. Nivel critical

Adecuado para:

- Reembolsos.
- Permisos.
- Datos sensibles.
- Alto impacto.
- Decisiones reguladas.

---

# 78. Reliability Profile

```ts
export type ReliabilityProfile = {
  level: ReliabilityLevel;

  requiresIdempotency: boolean;
  requiresVerification: boolean;
  requiresCompensation: boolean;
  requiresPersistentState: boolean;
  requiresHumanEscalation: boolean;

  maximumRecoveryCost: number;
};
```

---

# 79. Aplicación a NORA

## Workflow

```text
Normalizar input
  ↓
Calcular fiscalidad
  ↓
Aplicar beneficios
  ↓
Generar resumen
  ↓
Generar PDF
  ↓
Guardar
```

---

# 80. Fallo del motor fiscal

Respuesta:

```text
bloquear
+ no generar resumen
+ no generar PDF definitivo
+ error crítico
```

El motor fiscal es la fuente de verdad.

---

# 81. Fallo del resumen IA

Respuesta:

```text
conservar cálculo
+ resumen determinista
+ degradación controlada
```

---

# 82. Fallo del PDF

Respuesta:

```text
guardar snapshot
+ programar regeneración
+ no recalcular
```

---

# 83. Fallo de storage

Respuesta:

```text
no declarar disponible
+ retry idempotente
+ conservar referencia
```

---

# 84. Doble clic del usuario

Respuesta:

```text
misma idempotency key
+ un único estudio lógico
+ un único PDF lógico
```

---

# 85. Aplicación a EcomScaling IA

## Workflow

```text
Obtener campañas
  ↓
Calcular rentabilidad
  ↓
Aprobar
  ↓
Pausar
  ↓
Verificar
```

---

# 86. Timeout al pausar

Proceso:

```text
consultar estado
  ↓
pausada → success
activa → retry
desconocido → pending
```

---

# 87. Resultado parcial EcomScaling

```text
7 campañas pausadas.
1 pendiente de confirmación.
```

---

# 88. Aplicación al CRM

## Workflow

```text
Validar
  ↓
Aprobar
  ↓
Cancelar reserva
  ↓
Liberar inmueble
  ↓
Crear devolución
  ↓
Verificar
```

---

# 89. Fallo de devolución

Resultado:

```text
Reserva cancelada.
Inmueble liberado.
Reembolso pendiente.
```

Acciones:

- Retry seguro.
- Reconciliation.
- Tarea urgente.
- Compensación.
- Escalado.

---

# 90. Fallos específicos de comunicaciones

Enviar email es irreversible.

Si falla tras timeout:

- Consultar message ID.
- Consultar provider.
- No repetir sin confirmar.
- Enviar rectificación si se duplicó.
- Registrar.

---

# 91. Fallos específicos de PDFs

- Generación.
- Upload.
- URL.
- Firma.
- Descarga.

Debe distinguirse cada paso.

No declarar PDF generado si solo existe en memoria.

---

# 92. Fallos específicos de sincronizaciones

Ejemplos:

- Shopify.
- Meta.
- Google Sheets.
- Dolibarr.
- Portales.

Debe:

- Usar external IDs.
- Reconciliar.
- Detectar duplicados.
- Registrar offsets.
- Reprocesar.
- DLQ.

---

# 93. Métricas

```text
workflow_success_rate
workflow_partial_completion_rate
workflow_recovery_rate
retry_success_rate
retry_exhaustion_rate
fallback_activation_rate
circuit_breaker_open_rate
verification_failure_rate
compensation_success_rate
duplicate_action_rate
reconciliation_discrepancy_rate
mean_time_to_recovery
```

---

# 94. Métricas de coste

```text
recovery_cost_total
retry_cost_total
fallback_cost_total
compensation_cost_total
reconciliation_cost_total
```

---

# 95. SLO

Ejemplos:

```text
unauthorized_execution = 0
duplicate_refund = 0
verified_write_success >= 99 %
recoverable_jobs_within_30m >= 99 %
```

Definir tras baseline.

---

# 96. Alertas

## Críticas

- Doble reembolso.
- Cross-tenant.
- Compensation failure.
- Critical verification failure.
- Unrecoverable transaction.

## Altas

- Circuit breaker open.
- DLQ growing.
- Retry storm.
- External provider degraded.
- Reconciliation mismatch.

## Medias

- Elevated latency.
- Partial results increasing.
- Fallback usage high.
- Memory unavailable.

---

# 97. Playbooks

Toda alerta debe tener:

- Diagnóstico.
- Contención.
- Recuperación.
- Escalado.
- Comunicación.
- Postmortem.
- Regression case.

---

# 98. Incident Lifecycle

```text
Detectar
  ↓
Contener
  ↓
Recuperar
  ↓
Verificar
  ↓
Comunicar
  ↓
Postmortem
  ↓
Eval de regresión
```

---

# 99. Postmortem

Debe incluir:

- Qué ocurrió.
- Impacto.
- Timeline.
- Causa.
- Contribuyentes.
- Detección.
- Recuperación.
- Qué funcionó.
- Qué falló.
- Acciones.
- Tests.
- Evals.
- Owner.
- Fecha.

---

# 100. Chaos Testing

Simular:

- Modelo caído.
- API lenta.
- DB caída.
- Cola saturada.
- Worker reiniciado.
- Evento duplicado.
- Evento fuera de orden.
- Output inválido.
- Timeout ambiguo.
- Storage caído.
- RAG vacío.
- Aprobación caducada.

---

# 101. Fault Injection

```ts
export type FaultInjectionScenario = {
  id: string;
  component: string;
  failureMode: string;
  durationMs: number;
  probability: number;
  expectedRecovery: string;
};
```

---

# 102. Tests unitarios

- Error classifier.
- Retry policy.
- Backoff.
- Jitter.
- Idempotency.
- Recovery engine.
- Circuit breaker.
- Compensation registry.
- Fallback selector.
- Reliability profile.

---

# 103. Tests de integración

- Timeout.
- 429.
- 500.
- Partial.
- Ambiguous.
- Duplicate event.
- Worker restart.
- Queue retry.
- DLQ.
- Compensation.
- Reconciliation.
- Verification.

---

# 104. Tests end-to-end

## NORA

- Cálculo OK, PDF falla.
- Storage falla.
- Resumen IA falla.
- Doble clic.

## EcomScaling

- Meta timeout.
- Partial pause.
- Rate limit.
- Fallback model.

## CRM

- Cancelación parcial.
- Reembolso duplicado.
- Approval expires.
- Concurrent update.

---

# 105. Evals

Evaluar:

- Clasificación del fallo.
- Retry correcto.
- No retry permanente.
- Fallback adecuado.
- No duplicación.
- Partial result.
- Comunicación.
- Escalado.
- Compensation.
- Verification.
- Recovery cost.
- Time to recovery.

---

# 106. Quality Gates

Bloquear release si:

- Escrituras sin idempotencia.
- Tools sin timeout.
- Errores sin clasificación.
- Acciones críticas sin verificación.
- Fallback sin evals.
- Retry sin budget.
- Circuit breaker sin métricas.
- DLQ sin proceso.
- Compensation sin test.
- Partial results ocultos.

---

# 107. Arquitectura técnica

```text
src/
  ai/
    reliability/
      reliability.types.ts
      error-classifier.ts
      recovery-decision-engine.ts

      timeout/
        timeout-policy.ts
        deadline.service.ts

      retry/
        retry-policy.ts
        retry-budget.ts
        backoff.ts
        jitter.ts

      idempotency/
        idempotency.service.ts
        idempotency.repository.ts

      circuit-breaker/
        circuit-breaker.ts
        circuit-breaker.registry.ts

      bulkheads/
        concurrency-policy.ts
        isolation.service.ts

      fallbacks/
        fallback.registry.ts
        model-fallback.service.ts
        functional-fallback.service.ts

      compensation/
        saga.service.ts
        compensation.registry.ts

      verification/
        verification.service.ts
        reconciliation.service.ts

      queues/
        dead-letter.service.ts
        retry-queue.service.ts

      incidents/
        incident.service.ts
        postmortem.service.ts
        playbook.registry.ts

      metrics/
      alerts/
      evals/
      tests/

      adapters/
        nora/
        ecommerce/
        crm/
```

Adaptar al repositorio real.

---

# 108. Persistencia orientativa

Tablas posibles:

```text
idempotency_records
recovery_attempts
circuit_breaker_states
dead_letter_items
compensation_runs
reconciliation_runs
recovery_incidents
recovery_postmortems
```

No crear sin analizar esquema actual.

---

# 109. Fase 0 — Análisis exhaustivo

Analizar:

- Workflows.
- Tools.
- APIs.
- Escrituras.
- Idempotencia.
- Retries.
- Timeouts.
- Fallbacks.
- Compensaciones.
- Verificación.
- Reconciliación.
- Jobs.
- Colas.
- Incidentes.
- Coste.
- SLA.

Entregables:

- Diagnóstico.
- Mapa de fallos.
- Matriz de recuperación.
- Matriz de fiabilidad.
- Arquitectura.
- Archivos.
- Tests.
- Métricas.
- Alertas.

No implementar todavía.

---

# 110. Fase 1 — Contratos

Crear:

- `RecoverableError`
- `RecoveryDecision`
- `RetryPolicy`
- `RecoveryBudget`
- `TimeoutPolicy`
- `ToolReliabilityContract`
- `ReliabilityProfile`

---

# 111. Fase 2 — Error Classifier

Implementar clasificación central.

---

# 112. Fase 3 — Timeouts y retries

Implementar:

- Deadlines.
- Backoff.
- Jitter.
- Budgets.

---

# 113. Fase 4 — Idempotencia

Aplicar primero a una escritura real.

---

# 114. Fase 5 — Verification

Añadir verificación posterior.

---

# 115. Fase 6 — Circuit Breakers

Añadir por proveedor.

---

# 116. Fase 7 — Fallbacks

Añadir fallbacks evaluados.

---

# 117. Fase 8 — DLQ

Añadir jobs fallidos.

---

# 118. Fase 9 — Compensation

Añadir Saga en un flujo transaccional.

---

# 119. Fase 10 — Reconciliation

Añadir comparación de estados.

---

# 120. Fase 11 — Chaos Testing

Probar fallos deliberados.

---

# 121. Fase 12 — Segundo producto

Reutilizar núcleo.

---

# 122. Criterios de aceptación

- [ ] Se realizó análisis previo.
- [ ] Existe taxonomía de errores.
- [ ] Existen timeouts.
- [ ] Existe deadline global.
- [ ] Existen retries limitados.
- [ ] Existe backoff.
- [ ] Existe jitter.
- [ ] Existe retry budget.
- [ ] Existe idempotencia.
- [ ] Existe read-before-retry.
- [ ] Existen circuit breakers.
- [ ] Existen bulkheads.
- [ ] Existen fallbacks evaluados.
- [ ] Existe degradación controlada.
- [ ] Existe DLQ.
- [ ] Existen compensaciones.
- [ ] Existe verificación.
- [ ] Existe reconciliación.
- [ ] Se preservan resultados parciales.
- [ ] Existe cancelación segura.
- [ ] Existen métricas.
- [ ] Existen alertas.
- [ ] Existen playbooks.
- [ ] Existen tests.
- [ ] Existen chaos tests.
- [ ] Existen evals.
- [ ] No se duplican acciones.
- [ ] No se declara éxito sin verificar.
- [ ] Se comunica el estado real.

---

# 123. Instrucciones directas para Codex

## Misión

Diseñar e integrar una arquitectura transversal de Reliability & Recovery adaptada al SaaS real.

## Regla obligatoria

Antes de implementar, analiza exhaustivamente:

- Repositorio.
- Agentes.
- Workflows.
- Tools.
- APIs.
- Jobs.
- Colas.
- Eventos.
- DB.
- Idempotencia.
- Timeouts.
- Retries.
- Fallbacks.
- Compensaciones.
- Verificación.
- Reconciliación.
- Incidentes.
- Costes.
- SLA.

## Restricciones

1. No implementar antes del análisis.
2. No reintentar todo.
3. No reintentar errores permanentes.
4. No repetir escrituras sin idempotencia.
5. No asumir que timeout significa fracaso.
6. No declarar éxito por HTTP 200.
7. No ocultar parcialidad.
8. No borrar historial al compensar.
9. No usar fallback no evaluado.
10. No dejar retry en múltiples capas.
11. No permitir recovery ilimitado.
12. No implementar DLQ sin workflow operativo.
13. No usar modelo para decisiones críticas.
14. No marcar terminado con tests fallando.
15. Documentar desviaciones.
16. Adaptar al producto real.

---

# 124. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio y el producto para diseñar una
arquitectura de Reliability & Recovery adaptada al sistema real.

No implementes todavía retries, fallbacks ni compensaciones.

Objetivos:

1. Identificar todos los workflows.
2. Identificar todas las tools.
3. Identificar todas las APIs.
4. Identificar todas las escrituras.
5. Identificar todos los jobs.
6. Identificar todas las colas.
7. Identificar todos los eventos.
8. Identificar timeouts actuales.
9. Identificar retries actuales.
10. Identificar idempotencia actual.
11. Identificar circuit breakers.
12. Identificar fallbacks.
13. Identificar compensaciones.
14. Identificar verificaciones.
15. Identificar reconciliación.
16. Identificar incidentes históricos.
17. Identificar acciones ambiguas.
18. Identificar acciones parciales.
19. Identificar acciones irreversibles.
20. Clasificar fallos:
    - transient
    - rate_limit
    - permanent
    - ambiguous
    - partial
    - semantic
    - data
    - concurrency
    - human
    - security
21. Proponer Reliability Levels.
22. Proponer RecoverableError.
23. Proponer RetryPolicy.
24. Proponer RecoveryBudget.
25. Proponer ToolReliabilityContract.
26. Proponer RecoveryDecisionEngine.
27. Proponer circuit breakers.
28. Proponer bulkheads.
29. Proponer fallbacks.
30. Proponer DLQ.
31. Proponer Saga.
32. Proponer reconciliación.
33. Proponer métricas.
34. Proponer alertas.
35. Proponer playbooks.
36. Proponer arquitectura.
37. Proponer archivos.
38. Proponer fases.
39. Proponer tests.
40. Proponer evals.

Antes de modificar código, entrega:

a) diagnóstico,
b) mapa de fallos,
c) matriz de recuperación,
d) matriz de fiabilidad,
e) políticas de retry,
f) idempotencia,
g) compensaciones,
h) fallbacks,
i) arquitectura,
j) archivos exactos.

Restricciones:

- No inventes componentes.
- No implementes todavía.
- No copies políticas genéricas.
- No marques terminado sin validación.
```

---

# 125. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de
Reliability & Recovery.

Implementa solo:

1. Contratos comunes.
2. Error Classifier.
3. TimeoutPolicy.
4. RetryPolicy.
5. Backoff.
6. Jitter.
7. RecoveryBudget.
8. Una tool de lectura con retry seguro.
9. Una escritura con idempotencia.
10. Verificación posterior.
11. Métricas básicas.
12. Tests.

No implementes todavía:

- Saga completa.
- Doble proveedor de modelos.
- DLQ global.
- Reconciliación masiva.
- Segundo producto.
- Operaciones financieras críticas.

Reutiliza el análisis previo y documenta cualquier desviación.
```

---

# 126. ADR recomendados

- ADR: taxonomía de fallos.
- ADR: retry ownership.
- ADR: timeout.
- ADR: retry budget.
- ADR: idempotencia.
- ADR: read-before-retry.
- ADR: circuit breaker.
- ADR: bulkheads.
- ADR: fallbacks.
- ADR: graceful degradation.
- ADR: DLQ.
- ADR: Saga.
- ADR: compensation.
- ADR: verification.
- ADR: reconciliation.
- ADR: partial results.
- ADR: incident management.
- ADR: chaos testing.
- ADR: adaptación por producto.

---

# 127. Definición de terminado

Una capacidad está terminada cuando:

1. Se analizó el producto.
2. Se clasificaron fallos.
3. Se definió timeout.
4. Se definió deadline.
5. Se definió retry.
6. Se definió budget.
7. Se definió idempotencia.
8. Se definió verificación.
9. Se definió fallback.
10. Se definió circuit breaker.
11. Se definió compensación.
12. Se definió reconciliación.
13. Se definió parcialidad.
14. Se definió cancelación.
15. Se definieron métricas.
16. Se definieron alertas.
17. Se definieron playbooks.
18. Se definieron tests.
19. Se definieron evals.
20. Se validó en producto real.

---

# 128. Resumen ejecutivo

La secuencia correcta es:

```text
DETECTAR
  ↓
CLASIFICAR
  ↓
CONTENER
  ↓
DECIDIR RECUPERACIÓN
  ↓
REINTENTAR O COMPENSAR
  ↓
VERIFICAR
  ↓
RECONCILIAR
  ↓
COMUNICAR
  ↓
CONVERTIR EN TEST Y EVAL
```

La plataforma común debe proporcionar:

- Error Classifier.
- Recovery Decision Engine.
- Timeout Policy.
- Retry Policy.
- Retry Budget.
- Idempotency Service.
- Circuit Breaker.
- Bulkheads.
- Fallback Registry.
- Compensation Registry.
- Verification.
- Reconciliation.
- DLQ.
- Incident Management.

Cada producto debe aportar:

- Acciones.
- Efectos.
- Riesgos.
- Compensaciones.
- Fallbacks.
- Verificadores.
- Métricas de negocio.
- Adaptadores.

Reliability & Recovery no es:

```text
catch → retry
```

Es:

```text
saber qué falló
+ saber qué ya ocurrió
+ saber si repetir es seguro
+ saber cómo recuperar
+ saber cuándo detenerse
```
