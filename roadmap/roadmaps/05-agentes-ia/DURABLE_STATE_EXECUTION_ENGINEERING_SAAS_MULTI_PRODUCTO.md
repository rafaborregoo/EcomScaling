# Durable State & Execution Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica transversal.
- **Ámbito:** SaaS, CRM, agentes, workflows, tools, jobs, colas, eventos, RAG, memoria, Human-in-the-Loop, integraciones y sistemas multi-tenant.
- **Casos de referencia:** NORA, EcomScaling IA y CRM/SaaS.
- **Objetivo:** diseñar una arquitectura de ejecución duradera que permita persistir, suspender, reanudar, versionar y auditar workflows sin repetir efectos ni perder estado.
- **Audiencia:** Codex, arquitectura, backend, IA, DevOps, QA, seguridad, producto y operaciones.
- **Prioridad:** crítica.
- **Principio rector:** ningún workflow importante debe depender de que un proceso, worker o petición HTTP permanezca vivo.

---

# 1. Propósito

Este documento define cómo implementar **Durable State & Execution Engineering** en una plataforma SaaS con agentes de IA.

La arquitectura debe servir para:

- NORA.
- EcomScaling IA.
- CRM/SaaS.
- Copilotos.
- Agentes operativos.
- Workflows de negocio.
- Jobs de larga duración.
- Procesos documentales.
- Aprobaciones humanas.
- Sincronizaciones.
- Integraciones externas.
- Sagas.
- Sistemas multiagente.
- Procesos que duran horas, días o semanas.

La arquitectura común debe permitir:

- Persistir el estado.
- Suspender ejecuciones.
- Esperar eventos.
- Esperar aprobaciones.
- Reanudar.
- Reintentar.
- Evitar duplicados.
- Recuperarse tras reinicios.
- Versionar workflows.
- Procesar eventos duplicados.
- Procesar eventos fuera de orden.
- Correlacionar jobs y eventos.
- Mantener auditoría.
- Reconciliar estado.
- Cancelar de forma segura.

---

# 2. Regla obligatoria de análisis previo

## 2.1 Principio

Antes de implementar un motor durable, Codex debe analizar exhaustivamente el sistema real.

No debe limitarse a crear una tabla `workflows`.

Debe adaptar la arquitectura a:

- Framework.
- Backend.
- Base de datos.
- RLS.
- Jobs.
- Colas.
- Eventos.
- Webhooks.
- Agentes.
- Tools.
- Servicios de dominio.
- HITL.
- RAG.
- Memoria.
- Multi-tenancy.
- Efectos externos.
- Idempotencia.
- Concurrencia.
- Despliegues.
- Versionado.
- Volumen.
- SLA.
- Privacidad.
- Reglamento de IA.
- Costes.

## 2.2 Prohibiciones

Codex no debe:

- Mantener procesos vivos durante horas.
- Mantener peticiones HTTP abiertas.
- Guardar solo `currentStep`.
- Mezclar estado del dominio y estado del workflow.
- Repetir modelos o tools durante replay.
- Ejecutar efectos dentro del reducer.
- Omitir el versionado de workflows.
- Omitir el versionado del estado.
- Confiar en semántica `exactly-once`.
- Procesar eventos sin deduplicación.
- Persistir secretos.
- Persistir payloads gigantes.
- Eliminar versiones antiguas con workflows activos.
- Reanudar sin revalidar permisos.
- Usar el modelo como fuente del tenant.
- Introducir locks indefinidos.
- Crear colas sin DLQ.
- Crear timers en memoria.
- Marcar como terminado sin probar reinicios y despliegues.

## 2.3 Entregables previos

Antes de modificar código, Codex debe entregar:

1. Mapa de workflows.
2. Mapa de estados de dominio.
3. Mapa de eventos.
4. Mapa de comandos.
5. Mapa de jobs.
6. Mapa de colas.
7. Mapa de timers.
8. Mapa de webhooks.
9. Mapa de aprobaciones.
10. Mapa de subworkflows.
11. Mapa de procesos largos.
12. Mapa de idempotencia.
13. Mapa de versionado.
14. Mapa de concurrencia.
15. Mapa de locks.
16. Mapa de checkpoints.
17. Mapa de replay.
18. Mapa de retención.
19. Mapa de datos sensibles.
20. Matriz de Durable Execution Levels.
21. Propuesta de arquitectura.
22. Propuesta de persistencia.
23. Propuesta de motor.
24. Propuesta de fases.
25. Propuesta de tests.
26. Propuesta de métricas.
27. Propuesta de alertas.

No debe implementarse antes de revisar este análisis.

---

# 3. Definición

**Durable State & Execution Engineering** es la disciplina que permite que un workflow conserve su progreso y continúe correctamente aunque:

- El servidor se reinicie.
- El worker desaparezca.
- La aplicación se despliegue.
- El usuario cierre la sesión.
- Exista una espera prolongada.
- Sea necesaria una aprobación.
- Llegue un webhook horas después.
- Una API externa tarde en responder.
- Se produzcan retries.
- Se reciba un evento duplicado.

Fórmula conceptual:

```text
Durable Execution =
workflow identity
+ persistent state
+ checkpoints
+ event history
+ deterministic orchestration
+ idempotent activities
+ resumability
+ versioning
+ reconciliation
```

---

# 4. Diferencia con Reliability & Recovery

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

Relación:

```text
Reliability decide la recuperación.
Durable Execution permite ejecutarla.
```

---

# 5. Workflow Instance

Cada ejecución debe tener identidad propia.

```ts
export type WorkflowInstance = {
  id: string;

  workflowDefinitionId: string;
  workflowVersion: string;
  stateSchemaVersion: string;

  tenantId: string;
  initiatedBy: string;

  status: WorkflowStatus;

  currentNodeId?: string;
  currentCheckpointId?: string;

  inputReference: string;
  outputReference?: string;

  version: number;

  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};
```

Una definición de workflow puede tener muchas instancias simultáneas.

```text
Workflow definition:
CancelReservationWorkflow v2

Instances:
wf_001 → reserva 148
wf_002 → reserva 149
wf_003 → reserva 150
```

---

# 6. Estados del workflow

```ts
export type WorkflowStatus =
  | "created"
  | "running"
  | "waiting"
  | "waiting_for_event"
  | "waiting_for_human"
  | "retry_scheduled"
  | "compensating"
  | "partially_completed"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"
  | "terminated";
```

## Reglas

- `running`: existe trabajo activo.
- `waiting_for_event`: no hay worker ocupado.
- `waiting_for_human`: existe una intervención pendiente.
- `retry_scheduled`: la ejecución está suspendida hasta el próximo intento.
- `partially_completed`: existen efectos válidos y tareas pendientes.
- `failed`: el workflow no pudo continuar automáticamente.
- `terminated`: se detuvo de forma forzada.

---

# 7. Estado efímero y estado duradero

## Estado efímero

```ts
let currentStep = 4;
let approved = false;
```

Se pierde si el proceso muere.

## Estado duradero

```ts
{
  workflowId: "wf_983",
  currentNodeId: "request_refund",
  status: "waiting_for_event",
  reservationCancelled: true,
  propertyReleased: true,
  refundStatus: "pending"
}
```

El estado duradero debe sobrevivir:

- Reinicios.
- Despliegues.
- Escalado horizontal.
- Cambio de worker.
- Esperas prolongadas.
- Errores transitorios.

---

# 8. Contrato de estado durable

```ts
export type DurableWorkflowState<TData> = {
  workflowInstanceId: string;

  workflowDefinitionId: string;
  workflowVersion: string;
  schemaVersion: string;

  status: WorkflowStatus;
  currentNodeId?: string;

  data: TData;

  revision: number;
  checksum: string;

  updatedAt: string;
};
```

El estado debe ser:

- Serializable.
- Versionable.
- Validable.
- Reducido.
- Seguro.
- Trazable.

---

# 9. Checkpoints

Un checkpoint es una fotografía persistente del estado en un punto seguro.

```ts
export type WorkflowCheckpoint<TState> = {
  id: string;
  workflowInstanceId: string;

  workflowVersion: string;
  stateSchemaVersion: string;

  nodeId: string;
  sequenceNumber: number;

  state: TState;
  stateHash: string;

  createdAt: string;
};
```

Los checkpoints permiten:

- Recuperar una ejecución.
- Reanudar después de aprobación.
- Evitar repetir pasos costosos.
- Investigar un incidente.
- Comparar estados.
- Crear replay.
- Ejecutar migraciones controladas.

---

# 10. Cuándo crear checkpoints

Crear checkpoint:

- Después de una tool con efectos.
- Antes de esperar aprobación.
- Después de aprobación.
- Antes de una llamada ambigua.
- Después de una operación costosa.
- Después de un pago.
- Después de un reembolso.
- Después de un lote.
- Antes de suspender.
- Después de compensar.
- Antes de un handoff.
- Después de un worker crítico.
- Después de una transformación documental costosa.
- Antes de cambiar de versión o estrategia.

---

# 11. Checkpoint Policy

```ts
export type CheckpointPolicy = {
  afterNodeTypes: string[];
  beforeWait: boolean;
  afterMutableAction: boolean;
  afterCompensation: boolean;
  maximumEventsBetweenCheckpoints: number;
};
```

No es necesario guardar un checkpoint tras cada línea.

Debe guardarse tras límites semánticos relevantes.

---

# 12. Historial de eventos

```ts
export type WorkflowHistoryEvent =
  | WorkflowStartedEvent
  | NodeEnteredEvent
  | ActivityScheduledEvent
  | ActivityCompletedEvent
  | ActivityFailedEvent
  | CheckpointCreatedEvent
  | TimerScheduledEvent
  | TimerFiredEvent
  | ExternalEventReceivedEvent
  | HumanDecisionReceivedEvent
  | WorkflowCompletedEvent
  | WorkflowCancelledEvent;
```

---

# 13. Evento base

```ts
export type WorkflowHistoryEventBase = {
  id: string;
  workflowInstanceId: string;

  sequenceNumber: number;

  type: string;
  version: string;

  occurredAt: string;

  correlationId: string;
  causationId?: string;

  payloadReference?: string;
};
```

El historial debe responder:

- Qué ocurrió.
- En qué orden.
- Qué actividad produjo el evento.
- Qué versión estaba activa.
- Qué resultado quedó persistido.
- Qué evento desbloqueó el workflow.

---

# 14. Replay

El replay reconstruye el estado a partir del historial.

Durante replay:

- No repetir modelos.
- No repetir tools.
- No repetir pagos.
- No repetir emails.
- No repetir CRUD.
- No repetir APIs externas.
- Reutilizar resultados persistidos.
- Reconstruir decisiones.
- Continuar desde el último punto.

Ejemplo:

```text
Activity getClient ya completada
→ reutilizar resultado

Activity getDocuments ya completada
→ reutilizar resultado

Activity generatePdf pendiente
→ continuar desde aquí
```

---

# 15. Determinismo

El orquestador debe ser determinista.

Evitar dentro del orquestador:

```ts
Math.random();
new Date();
fetch();
database.query();
model.call();
```

Usar activities persistidas:

```ts
const route = await activity("choose_route");
```

## Motivo

Si el workflow se reproduce, debe generar la misma secuencia de decisiones con el mismo historial.

---

# 16. Orquestador y actividad

## Orquestador

Coordina:

- Orden.
- Rutas.
- Esperas.
- Timers.
- Paralelismo.
- Estados.
- Condiciones.
- Compensaciones.
- Handoffs.
- Finalización.

## Actividad

Ejecuta:

- Modelo.
- Tool.
- API.
- DB.
- Email.
- PDF.
- Storage.
- Meta.
- Shopify.
- Supabase.
- Vector store.
- Notificaciones.

```text
ORCHESTRATOR
  ↓
ACTIVITY
  ↓
PERSIST RESULT
  ↓
ORCHESTRATOR
```

---

# 17. Contrato de actividad

```ts
export type DurableActivityDefinition<TInput, TOutput> = {
  id: string;
  version: string;

  timeoutMs: number;

  retryPolicyId: string;
  idempotencyRequired: boolean;

  execute(
    input: TInput,
    context: ActivityExecutionContext
  ): Promise<TOutput>;
};
```

---

# 18. Activity Execution Context

```ts
export type ActivityExecutionContext = {
  workflowInstanceId: string;
  workflowVersion: string;

  activityId: string;
  activityAttempt: number;

  tenantId: string;
  actorId: string;

  idempotencyKey: string;

  traceId: string;
  deadlineAt: string;
};
```

---

# 19. External Events

```ts
export type WorkflowExternalEvent = {
  id: string;

  workflowInstanceId?: string;

  tenantId: string;

  type: string;
  version: string;

  payloadReference?: string;

  correlationKey: string;

  receivedAt: string;
};
```

Ejemplos:

- `approval.received`
- `refund.confirmed`
- `document.uploaded`
- `signature.completed`
- `campaign.updated`
- `payment.failed`
- `client.replied`

---

# 20. Correlation

Un evento debe localizar la instancia correcta.

```ts
export type WorkflowCorrelation = {
  workflowInstanceId?: string;
  tenantId: string;

  correlationKey: string;

  resourceType: string;
  resourceId: string;
};
```

Ejemplos:

```text
refund_reference
reservation_id
document_request_id
signature_envelope_id
campaign_operation_id
```

---

# 21. Esperas duraderas

No usar:

```ts
await sleep(86_400_000);
```

Usar:

```text
persistir timer
+ suspender
+ reanudar
```

---

# 22. Durable Timer

```ts
export type DurableTimer = {
  id: string;
  workflowInstanceId: string;

  type:
    | "delay"
    | "deadline"
    | "expiration"
    | "reminder";

  fireAt: string;

  status:
    | "scheduled"
    | "fired"
    | "cancelled";
};
```

---

# 23. Wait Policy

```ts
export type WorkflowWaitPolicy = {
  waitType:
    | "event"
    | "human"
    | "timer"
    | "condition";

  expiresAt?: string;

  onExpiration:
    | "cancel"
    | "escalate"
    | "continue_with_default"
    | "compensate";
};
```

---

# 24. Human-in-the-Loop durable

Secuencia:

```text
propuesta
  ↓
checkpoint
  ↓
interrupt
  ↓
waiting_for_human
  ↓
decision
  ↓
revalidate
  ↓
resume
```

El workflow debe poder esperar días sin ocupar un worker.

---

# 25. Resume Command

```ts
export type ResumeWorkflowCommand = {
  workflowInstanceId: string;

  resumeToken: string;

  eventId?: string;
  humanDecisionId?: string;

  requestedBy: string;
  requestedAt: string;
};
```

---

# 26. Revalidación al reanudar

Antes de continuar:

1. Tenant.
2. Workflow status.
3. Workflow version.
4. State schema.
5. Permisos actuales.
6. Recurso actual.
7. Approval validity.
8. Idempotency.
9. Concurrency version.
10. Deadline.
11. Policy.
12. Dependency health.
13. Freshness de datos.
14. Vigencia de la propuesta.
15. Que el workflow no se haya completado ya.

---

# 27. Exactly-once y at-least-once

No confiar en `exactly-once`.

Diseñar asumiendo:

```text
at-least-once
```

Controles:

- Idempotency keys.
- Inbox.
- Unique constraints.
- Deduplicación.
- Reconciliation.
- Read-before-write.
- Versiones.
- Hashes.
- Estados monotónicos.

---

# 28. Transactional Outbox

```ts
export type OutboxEvent = {
  id: string;

  tenantId: string;

  eventType: string;
  eventVersion: string;

  aggregateType: string;
  aggregateId: string;

  payloadReference: string;

  status:
    | "pending"
    | "published"
    | "failed";

  createdAt: string;
  publishedAt?: string;
};
```

El cambio de base de datos y el evento deben guardarse en la misma transacción.

Ejemplo:

```text
reservation.status = cancelled
+
outbox reservation.cancelled
```

---

# 29. Inbox

```ts
export type InboxRecord = {
  eventId: string;
  consumerName: string;

  tenantId: string;

  processedAt: string;

  resultReference?: string;
};
```

Evita procesar dos veces el mismo evento.

---

# 30. Eventos duplicados

```ts
if (await inbox.wasProcessed(event.id)) {
  return;
}
```

Toda integración externa debe asumir eventos duplicados.

---

# 31. Eventos fuera de orden

El workflow debe:

- Validar secuencia.
- Ignorar regresiones.
- Guardar eventos pendientes.
- Reconciliar.
- Procesar idempotentemente.
- Aplicar version checks.
- Mantener estados monotónicos cuando proceda.

Ejemplo:

```text
refund.completed
```

puede llegar antes de:

```text
refund.processing
```

---

# 32. Eventos perdidos

Implementar jobs de reconciliación.

```text
webhook no recibido
  ↓
consultar proveedor
  ↓
generar evento interno
```

---

# 33. Jobs y colas

```ts
export type DurableJob = {
  id: string;

  workflowInstanceId: string;
  activityId: string;

  tenantId: string;

  queueName: string;
  priority: number;

  attempt: number;
  maxAttempts: number;

  status:
    | "pending"
    | "leased"
    | "running"
    | "completed"
    | "failed"
    | "dead_lettered";

  scheduledAt: string;
  availableAt: string;
};
```

---

# 34. Leases

```ts
export type JobLease = {
  jobId: string;
  workerId: string;

  leasedAt: string;
  leaseExpiresAt: string;

  heartbeatAt?: string;
};
```

Si el worker cae:

```text
lease expires
  ↓
otro worker recupera el job
```

---

# 35. Heartbeats

```ts
export type ActivityHeartbeat = {
  activityId: string;

  progress?: number;
  cursor?: string;
  detailsReference?: string;

  recordedAt: string;
};
```

Útil para:

- Procesamiento masivo.
- Indexación.
- PDFs complejos.
- Sincronizaciones.
- Imports.
- Workers de larga duración.

---

# 36. Activity Timeouts

Definir:

- Schedule-to-start.
- Start-to-close.
- Heartbeat timeout.
- Total deadline.

```ts
export type ActivityTimeoutPolicy = {
  scheduleToStartMs: number;
  startToCloseMs: number;
  heartbeatTimeoutMs?: number;
};
```

---

# 37. Batch Processing

No procesar lotes enormes como una única actividad.

Patrón:

```text
batch
  ↓
checkpoint
  ↓
batch
  ↓
checkpoint
```

---

# 38. Batch State

```ts
export type BatchProgress = {
  totalItems: number;
  processedItems: number;
  failedItems: number;

  cursor?: string;

  completedItemIdsReference?: string;
};
```

---

# 39. Fan-out y Fan-in

## Fan-out

Distribuir trabajo.

## Fan-in

Combinar resultados.

```ts
export type FanOutState = {
  childWorkflowIds: string[];

  completed: string[];
  failed: string[];
  pending: string[];

  quorum?: number;
};
```

---

# 40. Parallel Execution Policy

```ts
export type ParallelExecutionPolicy = {
  maximumConcurrency: number;
  maximumPerTenant: number;

  failureStrategy:
    | "fail_fast"
    | "continue"
    | "minimum_quorum";
};
```

---

# 41. Child Workflows

```ts
export type ChildWorkflowPolicy = {
  cancellation:
    | "cancel"
    | "wait"
    | "detach"
    | "compensate";

  parentFailure:
    | "cancel_child"
    | "keep_running";

  childFailure:
    | "fail_parent"
    | "continue"
    | "retry_child";
};
```

---

# 42. Versionado de workflows

Cada instancia debe quedar fijada a una versión.

```ts
workflowVersion = "1.0.0";
```

Nuevas instancias:

```ts
workflowVersion = "2.0.0";
```

Una instancia activa no debe cambiar de comportamiento silenciosamente.

---

# 43. Workflow Definition

```ts
export type WorkflowDefinition = {
  id: string;
  version: string;

  stateSchemaVersion: string;

  active: boolean;

  compatibleFromVersions: string[];

  createdAt: string;
  deprecatedAt?: string;
};
```

---

# 44. Estrategias de versionado

- Version pinning.
- Compatibility branching.
- Explicit migration.
- Continue-as-new.
- Parallel legacy support.
- Controlled deprecation.

---

# 45. State Migration

```ts
export interface WorkflowStateMigrator {
  fromVersion: string;
  toVersion: string;

  migrate(
    state: unknown
  ): unknown;
}
```

---

# 46. Reglas de migración

- No mutar historia.
- Crear backup.
- Validar checksum.
- Ejecutar dry run.
- Permitir rollback.
- Auditar.
- Migrar solo workflows elegibles.
- Verificar tools antiguas.
- Verificar prompts y modelos antiguos.
- Mantener compatibilidad de payloads.

---

# 47. No eliminar versiones antiguas

Mantener mientras:

```text
active_workflows(version) > 0
```

o exista un plan de migración aprobado.

---

# 48. Estado de dominio y estado de workflow

## Domain State

```text
reservation.status = cancelled
```

## Workflow State

```text
waiting_for_refund_confirmation
```

No son equivalentes.

---

# 49. Domain Source of Truth

Definir:

```text
Domain DB
→ verdad de negocio

Workflow Store
→ verdad del proceso
```

El motor de workflow no debe sustituir el modelo de dominio.

---

# 50. Invariantes de consistencia

```text
No completar workflow si domain state no coincide.
No ejecutar refund si reserva no está validada.
No ejecutar dos mutations concurrentes.
No resumir aprobación si cambió el recurso.
No declarar PDF disponible si storage no confirma.
```

---

# 51. Reconciliation

```ts
export type DurableReconciliationResult = {
  workflowInstanceId: string;

  workflowStateReference: string;
  domainStateReference: string;
  externalStateReference?: string;

  matches: boolean;

  discrepancies: string[];

  recommendedAction:
    | "none"
    | "advance_workflow"
    | "repair_domain"
    | "compensate"
    | "escalate";
};
```

---

# 52. Payloads grandes

No guardar:

- PDFs.
- Audios.
- Vídeos.
- Documentos completos.
- Miles de chunks.
- Secretos.
- Respuestas completas innecesarias.

Guardar referencias:

```ts
{
  snapshotId: "snap_28",
  documentReference: "storage://doc/81",
  resultHash: "sha256:..."
}
```

---

# 53. Serialización

```ts
export type SerializedWorkflowState = {
  schemaVersion: string;
  data: unknown;
  checksum: string;
};
```

---

# 54. Validación al cargar estado

1. Schema.
2. Checksum.
3. Version.
4. Tenant.
5. Corruption.
6. Migration.
7. Permissions.
8. References.
9. Retention status.
10. Legal hold.

---

# 55. Optimistic Concurrency

```sql
UPDATE workflow_instances
SET state = :state,
    version = version + 1
WHERE id = :id
  AND version = :expected_version;
```

Sin filas actualizadas:

```text
CONCURRENCY_CONFLICT
```

---

# 56. Resource Serialization

Para operaciones críticas:

```text
resource_key = reservation_148
```

Solo una mutation activa.

Opciones:

- Advisory lock.
- Queue partition.
- Entity workflow.
- Optimistic lock.
- Distributed lock.
- DB constraint.

---

# 57. Entity Workflows

Ejemplo:

```text
ReservationWorkflow(reservation_148)
```

Todas las órdenes pasan por una única instancia lógica.

Ventaja:

- Serialización natural.

Riesgos:

- Historial grande.
- Hot entity.
- Long lifetime.
- Coupling.
- Necesidad de `continue-as-new`.

---

# 58. Continue-as-new

Usar para workflows muy largos.

```text
history segment 1
  ↓
new run
  ↓
minimal carried state
```

Permite limitar:

- Tamaño del historial.
- Tiempo de replay.
- Coste.
- Complejidad.

---

# 59. Commands, Events y Signals

## Command

```text
CancelReservation
```

## Event

```text
ReservationCancelled
```

## Signal

```text
ApprovalReceived
```

No mezclar.

---

# 60. Workflow Command

```ts
export type WorkflowCommand =
  | ScheduleActivityCommand
  | ScheduleTimerCommand
  | StartChildWorkflowCommand
  | PublishEventCommand
  | RequestHumanReviewCommand
  | CompleteWorkflowCommand
  | FailWorkflowCommand;
```

---

# 61. Workflow Transition

```ts
export type WorkflowTransition<TState, TOutput> = {
  nextState: TState;

  commands: WorkflowCommand[];

  status: WorkflowStatus;

  output?: TOutput;

  checkpointRequired: boolean;
};
```

---

# 62. Durable Workflow Definition

```ts
export type DurableWorkflowDefinition<
  TInput,
  TState,
  TOutput
> = {
  id: string;
  version: string;

  initialState(
    input: TInput
  ): TState;

  handle(
    state: TState,
    event: WorkflowEvent
  ): WorkflowTransition<TState, TOutput>;
};
```

---

# 63. State Machine

Patrón:

```text
state + event = new state + commands
```

Las transiciones deben ser deterministas.

Los efectos deben ejecutarse fuera.

---

# 64. Invariant Contract

```ts
export type WorkflowInvariant = {
  id: string;

  check(
    state: unknown,
    event: WorkflowEvent
  ): boolean;

  errorCode: string;
};
```

---

# 65. Cancelación

```ts
export type WorkflowCancellationState = {
  requested: boolean;

  requestedAt?: string;
  requestedBy?: string;

  mode:
    | "graceful"
    | "immediate"
    | "compensating";
};
```

---

# 66. Graceful Cancellation

1. No iniciar nuevos pasos.
2. Esperar actividad segura.
3. Cancelar jobs.
4. Persistir estado.
5. Compensar.
6. Auditar.
7. Comunicar.
8. Liberar locks.
9. Cancelar timers.
10. Resolver children según política.

---

# 67. Termination

Usar solo para emergencias.

Puede:

- No compensar.
- Dejar inconsistencias.
- Requerir reparación.
- Exigir auditoría.
- Exigir postmortem.

---

# 68. Redrive

Debe:

- Revalidar idempotencia.
- Comprobar efectos previos.
- Registrar actor.
- Registrar checkpoint origen.
- Crear nueva ejecución o intento.
- No repetir mutations a ciegas.
- Aplicar permisos.
- Mantener correlación.

---

# 69. Time Travel

Crear workflow derivado.

No modificar historia original.

```ts
export type WorkflowFork = {
  sourceWorkflowId: string;
  sourceCheckpointId: string;

  newWorkflowId: string;

  createdBy: string;
  reason: string;
};
```

---

# 70. Models y replay

Un model call es una activity.

```text
model_call
  ↓
persist result
```

Durante replay:

```text
reuse persisted result
```

No volver a facturar, ni volver a generar un output potencialmente distinto.

---

# 71. Tools y replay

Una tool call es una activity.

No repetir durante replay.

Especialmente:

- CRUD.
- Email.
- Payments.
- Meta.
- Shopify.
- PDF.
- Storage.
- Notifications.
- Reservations.
- Facturación.
- Contratos.

---

# 72. Config Versioning

Registrar:

- Agent version.
- Prompt version.
- Tool version.
- Model.
- Policy version.
- Context Builder version.
- Memory policy version.
- Guardrail version.
- Retrieval index version.

---

# 73. Model Change Policy

```ts
export type WorkflowModelPolicy = {
  mode:
    | "pinned"
    | "upgrade_at_checkpoint"
    | "dynamic_routing";

  modelVersion: string;

  fallbackPolicyId?: string;
};
```

---

# 74. Deployment Safety

Antes de desplegar:

- Contar workflows activos.
- Identificar versiones.
- Probar replay.
- Mantener activities antiguas.
- Validar state migrations.
- Revisar schemas.
- Preparar rollback.
- Revisar queues.
- Revisar timers.
- Revisar feature flags.
- Revisar workers compatibles.
- Revisar alertas.
- Revisar capacidad del storage.

---

# 75. Replay Testing

Casos:

- History v1 + code v1.
- History v1 + compatible v2.
- History v1 + incompatible v2.
- Models not repeated.
- Tools not repeated.
- Activities reused.
- State reconstructed.
- Logs replay-safe.
- Timers preserved.
- Human decisions preserved.
- Child workflows preserved.

---

# 76. Observabilidad durable

Registrar:

- Workflow ID.
- Version.
- State version.
- Status.
- Current node.
- Checkpoint.
- Attempts.
- Wait reason.
- Timers.
- Events.
- Child workflows.
- Active duration.
- Waiting duration.
- Replay count.
- Resume count.
- Compensation state.
- Correlation IDs.
- Tenant.
- Actor.

---

# 77. Duraciones

Separar:

```text
wall_clock_duration
active_compute_duration
waiting_for_human_duration
waiting_for_event_duration
waiting_for_dependency_duration
```

Un workflow que dura tres días puede consumir solo 20 segundos de computación real.

---

# 78. Retención

```ts
export type WorkflowRetentionPolicy = {
  activeRetentionDays: number;
  completedRetentionDays: number;
  failedRetentionDays: number;

  archiveAfterDays?: number;
  anonymizeAfterDays?: number;

  legalHoldSupported: boolean;
};
```

---

# 79. Privacidad

Aplicar:

- Minimización.
- Cifrado.
- RLS.
- Tenant isolation.
- Referencias.
- Borrado.
- Anonimización.
- Retención.
- Legal hold.
- Acceso auditado.
- Redacción.
- Clasificación de datos.

---

# 80. Multi-tenancy

Todo workflow debe tener tenant obtenido del backend.

```ts
workflow.tenantId =
  authenticatedActor.tenantId;
```

Nunca del modelo.

---

# 81. Multi-tenant Isolation

Aplicar a:

- Workflow store.
- Checkpoints.
- Events.
- Jobs.
- Timers.
- Inbox.
- Outbox.
- Query API.
- Dashboard.
- Resume endpoint.
- Reconciliation.
- Metrics.
- Audit logs.
- DLQ.

---

# 82. Authorization on Resume

Revalidar permisos actuales.

No usar permisos históricos automáticamente.

También comprobar:

- Rol actual.
- Tenant actual.
- Estado del recurso.
- Política vigente.
- Autoridad para compensar.
- Autoridad para redrive.

---

# 83. Identity and Impersonation

Registrar:

- Initiator.
- Current actor.
- System actor.
- Tenant.
- Integration identity.
- Approval actor.
- Compensation actor.
- Service account.

---

# 84. Secrets

No persistir:

- API keys.
- OAuth tokens.
- Passwords.
- Cookies.
- Bank credentials.
- Refresh tokens.

Persistir referencias:

```text
integrationConnectionId
```

---

# 85. Durable Execution Levels

```ts
export type DurableExecutionLevel =
  | "stateless"
  | "persisted_result"
  | "checkpointed"
  | "event_driven"
  | "transactional";
```

---

# 86. Stateless

Adecuado para:

- Consulta simple.
- Cálculo corto.
- Chat sin efectos.
- Clasificación aislada.

---

# 87. Persisted Result

Adecuado para:

- Guardar input y output.
- No requiere espera.
- Permite auditoría básica.

---

# 88. Checkpointed

Adecuado para:

- Varias actividades.
- Recuperación tras fallo.
- Operaciones costosas.
- Procesamiento documental.

---

# 89. Event-driven

Adecuado para:

- Webhooks.
- HITL.
- Timers.
- Esperas.
- Respuestas de clientes.
- Firmas.

---

# 90. Transactional

Adecuado para:

- Reservas.
- Pagos.
- Reembolsos.
- Contratos.
- Sagas.
- Operaciones críticas.

---

# 91. Durable Profile

```ts
export type DurableExecutionProfile = {
  level: DurableExecutionLevel;

  persistentStateRequired: boolean;
  eventHistoryRequired: boolean;
  checkpointRequired: boolean;
  versionPinningRequired: boolean;
  idempotencyRequired: boolean;
  reconciliationRequired: boolean;
  humanResumeSupported: boolean;
};
```

---

# 92. Aplicación a NORA

## CreateStudyWorkflow

```text
NormalizeInput
  ↓ checkpoint
ComputeTaxSnapshot
  ↓ checkpoint
GenerateAiSummary
  ↓ checkpoint
RenderPdf
  ↓ checkpoint
UploadPdf
  ↓ complete
```

---

# 93. NORA: fallo de upload

No repetir:

- Cálculo.
- Beneficios.
- Resumen.
- Render.

Reintentar solo upload.

---

# 94. NORA: servicios jurídicos

Ejemplo:

```text
Solicitar NIE
  ↓
Esperar documentos
  ↓
Revisar
  ↓
Esperar cita
  ↓
Completar
```

Puede durar días o semanas.

Requiere:

- Timers.
- Eventos.
- Checkpoints.
- Aprobaciones.
- Escalados.
- Reanudación.
- Retención.
- Auditoría.

---

# 95. Aplicación a EcomScaling

## CampaignOptimizationWorkflow

```text
LoadMetrics
  ↓ checkpoint
CalculateProfitability
  ↓ checkpoint
GenerateRecommendations
  ↓ wait approval
RevalidateMetrics
  ↓
ExecuteApprovedActions
  ↓
Verify
```

---

# 96. EcomScaling: aprobación tardía

Si llega al día siguiente:

- Revalidar métricas.
- Recalcular impacto.
- Invalidar propuestas obsoletas.
- Ejecutar solo acciones vigentes.
- Mantener el hash de la propuesta.
- Crear nueva aprobación si cambió sustancialmente.

---

# 97. EcomScaling: fan-out

```text
200 campañas
  ↓
lotes
  ↓
workers
  ↓
checkpoints
  ↓
fan-in
```

---

# 98. Aplicación al CRM

## CancelReservationWorkflow

```text
Validate
  ↓
WaitForApproval
  ↓
Revalidate
  ↓
CancelReservation
  ↓ checkpoint
ReleaseProperty
  ↓ checkpoint
RequestRefund
  ↓
WaitForWebhook
  ↓
Verify
  ↓
Complete
```

---

# 99. CRM: preparación de firma

```text
LoadCase
  ↓
CheckDocuments
  ↓
CreateMissingTasks
  ↓
WaitForDocuments
  ↓
Review
  ↓
ReadyForSigning
```

---

# 100. RAG e indexación

```text
UploadDocument
  ↓
Extract
  ↓ checkpoint
Chunk
  ↓ checkpoint
Embed
  ↓ checkpoint
Index
  ↓
Verify
```

---

# 101. Sincronizaciones

Aplicable a:

- Meta.
- Shopify.
- Google Sheets.
- Dolibarr.
- Portales.
- Storage.
- Email.
- Webhooks.

Usar:

- External IDs.
- Inbox/outbox.
- Offsets.
- Checkpoints.
- Reconciliation.
- DLQ.
- Idempotency.

---

# 102. Motor especializado o propio

## Motor especializado

Opciones conceptuales:

- Temporal.
- Azure Durable Functions.
- AWS Step Functions.
- LangGraph con checkpointer.
- Otros engines equivalentes.

## Motor propio

Solo si:

- Workflows sencillos.
- El equipo controla concurrencia.
- Existe infraestructura.
- Se acepta mantenimiento.
- Se documenta la deuda técnica.

---

# 103. Riesgo de motor propio

Debe resolver:

- State store.
- Checkpoints.
- Events.
- Timers.
- Leases.
- Heartbeats.
- Retries.
- DLQ.
- Concurrency.
- Versioning.
- Replay.
- Observability.
- Reconciliation.
- Cancellation.
- Security.
- Migrations.

---

# 104. LangGraph y workflows de negocio

Posible arquitectura:

```text
Domain Workflow Engine
  ↓
Agent Workflow
  ↓
Activities
```

LangGraph puede coordinar agentes.

El workflow de dominio debe controlar procesos contractuales y financieros.

---

# 105. Arquitectura técnica propuesta

```text
src/
  ai/
    durable-execution/
      durable.types.ts
      durable.config.ts

      workflows/
        workflow-definition.ts
        workflow-instance.service.ts
        workflow-transition.service.ts
        workflow-invariant.service.ts

      state/
        workflow-state.repository.ts
        checkpoint.repository.ts
        state-serializer.ts
        state-migrator.registry.ts

      history/
        workflow-history.repository.ts
        replay.service.ts
        replay-validator.ts

      activities/
        activity.registry.ts
        activity-executor.ts
        activity-result.repository.ts
        heartbeat.service.ts

      events/
        external-event.service.ts
        correlation.service.ts
        inbox.repository.ts
        outbox.repository.ts

      timers/
        durable-timer.service.ts
        expiration.service.ts

      queues/
        durable-job.service.ts
        lease.service.ts
        dead-letter.service.ts

      concurrency/
        optimistic-lock.service.ts
        resource-lock.service.ts
        partitioning.service.ts

      children/
        child-workflow.service.ts
        fanout-fanin.service.ts

      versioning/
        workflow-version.registry.ts
        workflow-migration.service.ts
        compatibility.service.ts

      cancellation/
        cancellation.service.ts
        termination.service.ts
        redrive.service.ts

      reconciliation/
        workflow-reconciliation.service.ts

      security/
        workflow-authorization.service.ts
        workflow-tenant.service.ts
        secret-reference.service.ts

      observability/
        durable.metrics.ts
        durable.tracing.ts
        durable.alerts.ts

      tests/
      evals/

      adapters/
        nora/
        ecommerce/
        crm/
```

Adaptar al repositorio real.

---

# 106. Persistencia orientativa

Tablas posibles:

```text
workflow_definitions
workflow_instances
workflow_states
workflow_checkpoints
workflow_history_events
workflow_activities
workflow_activity_results
workflow_external_events
workflow_timers
workflow_jobs
workflow_leases
workflow_inbox
workflow_outbox
workflow_children
workflow_migrations
workflow_reconciliation_runs
```

No crear sin analizar el esquema actual.

---

# 107. Índices recomendados

- `workflow_instance_id`.
- `tenant_id`.
- `status`.
- `workflow_definition_id`.
- `workflow_version`.
- `correlation_key`.
- `resource_type + resource_id`.
- `available_at`.
- `fire_at`.
- `lease_expires_at`.
- `event_id`.
- `sequence_number`.
- `updated_at`.

---

# 108. Particionado

Para alto volumen:

- Por fecha.
- Por tenant.
- Por status.
- Por queue.
- Por workflow type.

Depende del motor y la base real.

---

# 109. Métricas

```text
workflow_instances_total
workflow_active_total
workflow_waiting_total
workflow_completed_total
workflow_failed_total
workflow_partial_total
workflow_resume_total
workflow_replay_total
workflow_checkpoint_total
workflow_checkpoint_failure_total
workflow_version_mismatch_total
workflow_concurrency_conflict_total
workflow_event_duplicate_total
workflow_event_out_of_order_total
workflow_stuck_total
workflow_timer_delay_ms
workflow_lease_expiration_total
```

---

# 110. Métricas de tiempo

```text
workflow_wall_clock_duration_ms
workflow_active_duration_ms
workflow_waiting_human_duration_ms
workflow_waiting_event_duration_ms
workflow_waiting_dependency_duration_ms
activity_duration_ms
replay_duration_ms
```

---

# 111. Métricas de volumen

- Active workflows.
- History size.
- Checkpoint size.
- Events per workflow.
- Jobs per queue.
- Timers pending.
- DLQ depth.
- Children per parent.
- Payload references.
- Workflows por versión.
- Estados corruptos detectados.

---

# 112. Alertas

## Críticas

- Cross-tenant.
- State corruption.
- Double mutation.
- Financial workflow stuck.
- Version mismatch.
- Checkpoint loss.
- Unauthorized resume.
- Replay que repite una mutation.

## Altas

- Stuck workflow.
- Queue backlog.
- Timer delay.
- Lease expiration loop.
- Replay failure.
- Event correlation failure.
- Reconciliation mismatch.
- Outbox no publicada.

## Medias

- History too large.
- Payload too large.
- Old workflow version active.
- Excessive checkpoints.
- High replay latency.
- Demasiados workflows en `waiting`.

---

# 113. Stuck Workflow Policy

```ts
export type StuckWorkflowPolicy = {
  maximumNoProgressMs: number;

  statusesToMonitor: WorkflowStatus[];

  action:
    | "alert"
    | "retry"
    | "escalate"
    | "cancel";
};
```

---

# 114. Playbooks

Todo fallo importante debe tener:

- Diagnóstico.
- Scope.
- Tenant impact.
- Workflow impact.
- Recovery.
- Resume.
- Compensation.
- Communication.
- Postmortem.
- Regression test.
- Owner.
- Deadline de resolución.

---

# 115. Unit Tests

- State transitions.
- Invariants.
- Serialization.
- Checksums.
- State migration.
- Event deduplication.
- Correlation.
- Expiration.
- Cancellation.
- Child policies.
- Optimistic locking.
- Resume authorization.
- Version pinning.
- Timer creation.

---

# 116. Integration Tests

- Worker crash.
- Server restart.
- Delayed event.
- Duplicate event.
- Out-of-order event.
- Approval after deployment.
- Lease expiry.
- Queue retry.
- Timer fire.
- Checkpoint restore.
- Reconciliation.
- Child workflow failure.
- Outbox publish.
- Inbox dedupe.

---

# 117. Replay Tests

- v1 history + v1 code.
- v1 history + compatible v2.
- v1 history + incompatible v2.
- Models not repeated.
- Tools not repeated.
- Activities reused.
- State reconstructed.
- Logs replay-safe.
- Timers preserved.
- Human decisions preserved.
- Child workflows preserved.
- Compensation history preserved.

---

# 118. Chaos Tests

Simular:

- Crash before checkpoint.
- Crash after checkpoint.
- Crash after external effect.
- Double worker.
- Delayed DB.
- Lost webhook.
- Duplicate webhook.
- Deployment during wait.
- Removed activity version.
- Corrupt checkpoint.
- Queue unavailable.
- Timer delay.
- Outbox blocked.
- Stale approval.
- External provider recovered after hours.

---

# 119. Security Tests

- Cross-tenant resume.
- Cross-tenant query.
- Forged event.
- Forged resume token.
- Replay attack.
- Event tampering.
- State tampering.
- Secret leakage.
- Unauthorized redrive.
- Unauthorized termination.
- Support role overreach.
- Actor permissions revoked during wait.
- Integration identity changed.

---

# 120. Evals

Evaluar:

- Reanuda desde el punto correcto.
- No repite model.
- No repite tool.
- No repite mutation.
- Respeta versión.
- Revalida.
- Mantiene partial results.
- Procesa duplicate events.
- Procesa out-of-order events.
- Comunica estado real.
- Cancela correctamente.
- Reconcilia discrepancias.
- Detecta stale approval.
- No usa datos de otro tenant.

---

# 121. Quality Gates

Bloquear release si:

- No hay workflow version.
- No hay state schema version.
- No hay idempotency.
- No hay replay test.
- No hay resume authorization.
- No hay tenant isolation.
- No hay event deduplication.
- No hay checkpoint.
- No hay reconciliation.
- No hay cancellation policy.
- No hay observability.
- No hay migration plan.
- Se eliminan activities todavía activas.
- No hay outbox en operaciones que emiten eventos.
- No hay DLQ para jobs importantes.

---

# 122. Fase 0 — Análisis exhaustivo

Analizar:

- Workflows.
- State.
- Events.
- Commands.
- Activities.
- Queues.
- Jobs.
- Timers.
- Webhooks.
- HITL.
- Versioning.
- Concurrency.
- Idempotency.
- Security.
- Retention.
- Cost.
- SLA.

Entregables:

- Diagnóstico.
- Mapa de workflows.
- Matriz durable.
- Arquitectura.
- Persistencia.
- Motor recomendado.
- Archivos.
- Fases.
- Tests.
- Métricas.
- Alertas.

No implementar todavía.

---

# 123. Fase 1 — Contratos

Crear:

- `WorkflowInstance`.
- `WorkflowStatus`.
- `DurableWorkflowState`.
- `WorkflowCheckpoint`.
- `WorkflowEvent`.
- `WorkflowCommand`.
- `WorkflowTransition`.
- `ActivityDefinition`.
- `ResumeCommand`.

---

# 124. Fase 2 — State Store

Implementar:

- Workflow repository.
- State repository.
- Checkpoints.
- Serialization.
- Checksums.
- Optimistic concurrency.

---

# 125. Fase 3 — History y Replay

Implementar:

- History events.
- Replay service.
- Replay tests.
- Activity result reuse.

---

# 126. Fase 4 — Activities

Implementar:

- Activity registry.
- Job scheduling.
- Leases.
- Heartbeats.
- Activity results.

---

# 127. Fase 5 — Events y Timers

Implementar:

- External events.
- Correlation.
- Inbox.
- Outbox.
- Durable timers.
- Expiration.

---

# 128. Fase 6 — HITL

Implementar:

- Interrupt.
- Wait.
- Resume.
- Revalidation.
- Expiration.

---

# 129. Fase 7 — Versioning

Implementar:

- Version registry.
- Pinning.
- Migration interface.
- Compatibility checks.
- Replay gate.

---

# 130. Fase 8 — Concurrency

Implementar:

- Optimistic locks.
- Resource serialization.
- Event dedupe.
- Idempotency.

---

# 131. Fase 9 — Children y Fan-out

Implementar:

- Child workflows.
- Parallel policy.
- Quorum.
- Fan-in.

---

# 132. Fase 10 — Cancellation y Redrive

Implementar:

- Graceful cancel.
- Termination.
- Redrive.
- Audit.

---

# 133. Fase 11 — Reconciliation

Implementar:

- Domain comparison.
- External provider comparison.
- Auto-advance.
- Escalation.

---

# 134. Fase 12 — Segundo producto

Reutilizar núcleo con adaptadores.

---

# 135. Criterios de aceptación

- [ ] Se realizó análisis previo.
- [ ] Cada workflow tiene ID.
- [ ] Cada workflow tiene versión.
- [ ] El estado tiene schema version.
- [ ] Existe persistencia.
- [ ] Existen checkpoints.
- [ ] Existe history.
- [ ] Existe replay.
- [ ] El orquestador es determinista.
- [ ] Models son activities.
- [ ] Tools son activities.
- [ ] No se repiten efectos en replay.
- [ ] Existen external events.
- [ ] Existen durable timers.
- [ ] Existe resume.
- [ ] Se revalidan permisos.
- [ ] Existe idempotencia.
- [ ] Existe inbox.
- [ ] Existe outbox.
- [ ] Existen jobs.
- [ ] Existen leases.
- [ ] Existen heartbeats.
- [ ] Existe fan-out/fan-in.
- [ ] Existe versioning.
- [ ] Existe migration.
- [ ] Existe optimistic concurrency.
- [ ] Existe cancellation.
- [ ] Existe redrive.
- [ ] Existe reconciliation.
- [ ] Existe multi-tenant isolation.
- [ ] No se persisten secretos.
- [ ] Existen métricas.
- [ ] Existen alertas.
- [ ] Existen replay tests.
- [ ] Existen chaos tests.
- [ ] Se puede sobrevivir a reinicio.
- [ ] Se puede sobrevivir a deployment.
- [ ] Se comunica el estado real.

---

# 136. Instrucciones directas para Codex

## Misión

Diseñar e integrar una arquitectura transversal de Durable State & Execution adaptada al SaaS real.

## Regla obligatoria

Antes de implementar, analiza exhaustivamente:

- Repositorio.
- Workflows.
- Agents.
- Tools.
- Events.
- Commands.
- Jobs.
- Queues.
- Timers.
- Webhooks.
- DB.
- RLS.
- State.
- Checkpoints.
- Idempotency.
- Concurrency.
- Versioning.
- Security.
- Retention.
- SLA.

## Restricciones

1. No implementar antes del análisis.
2. No mantener procesos vivos.
3. No usar `currentStep` como único estado.
4. No repetir effects durante replay.
5. No repetir models durante replay.
6. No repetir tools durante replay.
7. No confiar en exactly-once.
8. No procesar eventos sin inbox.
9. No publicar sin outbox cuando haya cambio de DB.
10. No persistir secretos.
11. No eliminar versiones activas.
12. No reanudar sin autorización.
13. No aceptar tenant del modelo.
14. No crear motor propio sin justificarlo.
15. No marcar terminado sin replay tests.
16. Documentar desviaciones.
17. Adaptar al producto real.

---

# 137. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio y el producto para diseñar una
arquitectura de Durable State & Execution adaptada al sistema real.

No implementes todavía workflows durables.

Objetivos:

1. Identificar workflows.
2. Identificar estados de dominio.
3. Identificar actividades.
4. Identificar eventos.
5. Identificar comandos.
6. Identificar jobs.
7. Identificar colas.
8. Identificar timers.
9. Identificar webhooks.
10. Identificar HITL.
11. Identificar procesos largos.
12. Identificar subworkflows.
13. Identificar fan-out.
14. Identificar idempotencia.
15. Identificar retries.
16. Identificar concurrencia.
17. Identificar locks.
18. Identificar versionado.
19. Identificar datos sensibles.
20. Identificar retención.
21. Identificar motores posibles.
22. Proponer Durable Execution Levels.
23. Proponer WorkflowInstance.
24. Proponer DurableWorkflowState.
25. Proponer Checkpoint.
26. Proponer History.
27. Proponer Replay.
28. Proponer Activities.
29. Proponer Events.
30. Proponer Inbox/Outbox.
31. Proponer Timers.
32. Proponer Jobs y Leases.
33. Proponer Versioning.
34. Proponer Migration.
35. Proponer Reconciliation.
36. Proponer arquitectura.
37. Proponer persistencia.
38. Proponer archivos.
39. Proponer fases.
40. Proponer tests.
41. Proponer métricas.
42. Proponer alertas.

Antes de modificar código, entrega:

a) diagnóstico,
b) mapa de workflows,
c) matriz durable,
d) propuesta de motor,
e) contratos,
f) persistencia,
g) versionado,
h) seguridad,
i) arquitectura,
j) archivos exactos.

Restricciones:

- No inventes componentes.
- No implementes todavía.
- No copies arquitectura genérica.
- No marques terminado sin validación.
```

---

# 138. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de
Durable State & Execution.

Implementa solo:

1. Contratos comunes.
2. WorkflowInstance.
3. DurableWorkflowState.
4. WorkflowStatus.
5. Checkpoint repository.
6. State serialization.
7. Optimistic concurrency.
8. History events.
9. Una activity.
10. Un workflow simple checkpointed.
11. Reanudación tras reinicio.
12. Tests.

No implementes todavía:

- Sagas completas.
- Fan-out masivo.
- Motor enterprise completo.
- Migración global.
- Redrive administrativo.
- Segundo producto.
- Pagos críticos.

Reutiliza el análisis previo y documenta cualquier desviación.
```

---

# 139. ADR recomendados

- ADR: motor durable.
- ADR: workflow state.
- ADR: history.
- ADR: replay.
- ADR: determinismo.
- ADR: activities.
- ADR: checkpoints.
- ADR: inbox.
- ADR: outbox.
- ADR: timers.
- ADR: jobs.
- ADR: leases.
- ADR: heartbeats.
- ADR: idempotency.
- ADR: workflow versioning.
- ADR: state migration.
- ADR: concurrency.
- ADR: resource serialization.
- ADR: cancellation.
- ADR: redrive.
- ADR: reconciliation.
- ADR: multi-tenancy.
- ADR: retention.

---

# 140. Definición de terminado

Una capacidad durable está terminada cuando:

1. Se analizó el producto.
2. Se definió workflow ID.
3. Se definió workflow version.
4. Se definió state schema.
5. Se definió persistencia.
6. Se definió checkpoint.
7. Se definió history.
8. Se definió replay.
9. Se definieron activities.
10. Se definieron events.
11. Se definió correlation.
12. Se definieron timers.
13. Se definieron jobs.
14. Se definieron leases.
15. Se definieron heartbeats.
16. Se definió idempotency.
17. Se definió inbox.
18. Se definió outbox.
19. Se definió versioning.
20. Se definió migration.
21. Se definió concurrency.
22. Se definió cancellation.
23. Se definió redrive.
24. Se definió reconciliation.
25. Se definió multi-tenancy.
26. Se definió privacy.
27. Se definieron métricas.
28. Se definieron alertas.
29. Se definieron tests.
30. Se validó reinicio.
31. Se validó deployment.
32. Se validó replay.
33. Se validó en producto real.

---

# 141. Resumen ejecutivo

La secuencia correcta es:

```text
CREAR INSTANCIA
  ↓
PERSISTIR ESTADO
  ↓
EJECUTAR ACTIVIDAD
  ↓
PERSISTIR RESULTADO
  ↓
CREAR CHECKPOINT
  ↓
ESPERAR EVENTO
  ↓
REANUDAR
  ↓
REVALIDAR
  ↓
CONTINUAR
  ↓
RECONCILIAR
  ↓
COMPLETAR
```

La plataforma común debe proporcionar:

- Workflow Registry.
- Workflow Instance Service.
- State Store.
- Checkpoint Store.
- History Store.
- Replay Service.
- Activity Registry.
- Event Correlation.
- Inbox.
- Outbox.
- Durable Timers.
- Jobs.
- Leases.
- Heartbeats.
- Versioning.
- Migration.
- Cancellation.
- Reconciliation.
- Observability.

Cada producto debe aportar:

- Estados.
- Eventos.
- Commands.
- Activities.
- Invariantes.
- Policies.
- Adaptadores.
- Métricas de negocio.

Durable State & Execution no es:

```text
guardar currentStep
```

Es:

```text
identidad
+ estado
+ historial
+ checkpoints
+ eventos
+ versiones
+ idempotencia
+ replay
+ reanudación
+ reconciliación
```
