# Loop Engineering para el copiloto y los agentes del CRM

## Estado del documento

- **Tipo:** especificación técnica operativa
- **Objetivo:** integrar Loop Engineering en el CRM para que cada caso de uso utilice el ciclo de ejecución adecuado
- **Audiencia:** Codex, equipo técnico, responsables de producto, seguridad y operaciones
- **Idioma:** castellano
- **Prioridad:** crítica
- **Ámbito:** chat del copiloto, agentes especialistas, herramientas CRUD, RAG, automatizaciones, aprobaciones humanas y ejecución multi-tenant
- **Principio rector:** cada tipo de tarea debe utilizar un loop explícito, limitado, observable y verificable

---

# 1. Propósito

Este documento define cómo debe diseñarse e implementarse la **Loop Engineering** del CRM.

El sistema no debe utilizar un único bucle genérico para todas las tareas.

Los diferentes casos de uso requieren distintos patrones de ejecución:

- Consultas simples.
- Búsquedas progresivas.
- Acciones CRUD de un solo paso.
- Procesos de varios pasos.
- Operaciones masivas.
- Generación y revisión de documentos.
- Tareas que requieren aprobación humana.
- Procesos con errores recuperables.
- Procesos con efectos financieros.
- Procesos jurídicos o contractuales.
- Flujos que combinan RAG y datos vivos.
- Agentes especialistas.
- Tareas programadas o de larga duración.

El objetivo es que el CRM pueda decidir, de forma controlada, qué tipo de loop necesita cada petición y ejecutarlo sin improvisar.

La arquitectura que debe evitarse es:

```text
Usuario
  ↓
LLM
  ↓
Herramienta
  ↓
LLM
  ↓
Herramienta
  ↓
...
```

sin:

- Estado explícito.
- Presupuesto.
- Criterio de finalización.
- Verificación.
- Control de reintentos.
- Detección de repetición.
- Gestión de aprobaciones.
- Separación entre procesos deterministas y razonamiento.
- Persistencia.
- Observabilidad.

La arquitectura objetivo es:

```text
Usuario
  ↓
Interpretación de intención
  ↓
Clasificación del tipo de tarea
  ↓
Selección del loop apropiado
  ↓
Inicialización del estado
  ↓
Ejecución controlada
  ↓
Verificación de pasos
  ↓
Verificación global
  ↓
Respuesta, aprobación, pausa o fallo controlado
```

---

# 2. Definición de Loop Engineering

**Loop Engineering** es la disciplina de diseñar cómo un agente avanza desde una petición inicial hasta un resultado verificable.

El loop determina:

- Qué observa el agente.
- Qué decisión puede tomar.
- Qué herramientas puede ejecutar.
- Cuándo debe detenerse.
- Cuándo debe reintentar.
- Cuándo debe replanificar.
- Cuándo debe preguntar.
- Cuándo debe solicitar aprobación.
- Cómo conserva el estado.
- Cómo detecta falta de progreso.
- Cómo evita repeticiones.
- Cómo verifica cada acción.
- Cómo sabe que el objetivo está realmente cumplido.

Fórmula conceptual:

```text
Loop fiable =
objetivo estructurado
+ estado explícito
+ acción permitida
+ resultado real
+ verificación
+ presupuesto
+ criterio de finalización
```

---

# 3. Relación con el resto de la arquitectura de agentes

Loop Engineering no sustituye otras disciplinas.

```text
Harness Engineering
  ├── Context Engineering
  ├── Tool Design
  ├── Memory Architecture
  ├── Guardrails y permisos
  ├── Observabilidad
  ├── Evals
  ├── Human in the loop
  └── Loop Engineering
```

Responsabilidades:

| Disciplina | Responsabilidad |
|---|---|
| Harness Engineering | Sistema completo que rodea al agente |
| Loop Engineering | Dinámica de ejecución |
| Context Engineering | Información que recibe el agente |
| Tool Design | Acciones disponibles |
| Memory Architecture | Información persistente reutilizable |
| Orchestration | Coordinación entre agentes, pasos y servicios |
| Guardrails | Restricciones y permisos |
| Evals | Medición de calidad |
| Human in the loop | Intervención humana |
| Observabilidad | Trazas, métricas y depuración |

---

# 4. Principio central: no existe un único loop universal

El CRM no debe implementar una única función del tipo:

```ts
while (true) {
  const response = await model.call(messages);
  const result = await execute(response.toolCall);
  messages.push(result);
}
```

Ese patrón es insuficiente.

Los casos de uso del CRM tienen naturalezas distintas.

Ejemplos:

```text
¿Cuántos leads nuevos hay hoy?
```

requiere un loop simple de lectura.

```text
Busca a Marta, localiza su reserva y dime qué documentos faltan.
```

requiere búsqueda progresiva y verificación.

```text
Asigna todos los leads nuevos de Málaga a los comerciales disponibles.
```

requiere planificación, preview, aprobación y ejecución masiva programática.

```text
Cancela la reserva y devuelve el dinero.
```

requiere un proceso transaccional, aprobación humana y verificación financiera.

```text
Prepara un borrador de contrato y revisa si cumple la política interna.
```

requiere generación-evaluación-revisión.

Por tanto, debe existir un **router de loops**.

---

# 5. Router de loops

## 5.1 Responsabilidad

El router debe seleccionar el patrón de loop adecuado según:

- Intención.
- Riesgo.
- Número de entidades.
- Número de pasos.
- Necesidad de contexto.
- Necesidad de RAG.
- Efectos sobre datos.
- Efectos externos.
- Reversibilidad.
- Necesidad de aprobación.
- Duración estimada.
- Necesidad de evaluación iterativa.
- Necesidad de delegación.

## 5.2 Contrato

```ts
export type LoopType =
  | "single_read"
  | "single_action"
  | "progressive_search"
  | "plan_execute"
  | "bulk_programmatic"
  | "generator_evaluator"
  | "human_approval"
  | "transactional"
  | "supervisor_worker"
  | "long_running"
  | "hybrid_rag_tools";

export type LoopSelection = {
  loopType: LoopType;
  reason: string;
  riskLevel: "read_only" | "low" | "medium" | "high" | "critical";
  requiresApproval: boolean;
  requiresPersistentState: boolean;
  requiresVerification: boolean;
  maxSteps: number;
};
```

## 5.3 Entrada del router

```ts
export type LoopRoutingInput = {
  actor: AuthenticatedActor;
  task: AgentTask;
  entityCountEstimate?: number;
  requiresKnowledgeRetrieval: boolean;
  requiresLiveData: boolean;
  mutatesData: boolean;
  affectsMoney: boolean;
  affectsContracts: boolean;
  sendsExternalCommunication: boolean;
  isBulkOperation: boolean;
  isReversible: boolean;
  expectedComplexity: "simple" | "moderate" | "complex";
};
```

## 5.4 Regla de selección

El router puede utilizar una combinación de:

- Reglas deterministas.
- Clasificación estructurada mediante modelo.
- Metadatos de herramientas.
- Políticas del dominio.
- Evaluación de riesgo.

La selección final del loop no debe depender exclusivamente del modelo.

```ts
export function selectLoop(input: LoopRoutingInput): LoopSelection {
  if (input.affectsMoney || input.affectsContracts) {
    return {
      loopType: "transactional",
      reason: "La tarea produce efectos financieros o contractuales.",
      riskLevel: "critical",
      requiresApproval: true,
      requiresPersistentState: true,
      requiresVerification: true,
      maxSteps: 12,
    };
  }

  if (input.isBulkOperation) {
    return {
      loopType: "bulk_programmatic",
      reason: "La tarea afecta a múltiples registros.",
      riskLevel: input.mutatesData ? "high" : "medium",
      requiresApproval: input.mutatesData,
      requiresPersistentState: true,
      requiresVerification: true,
      maxSteps: 8,
    };
  }

  if (input.requiresKnowledgeRetrieval && input.requiresLiveData) {
    return {
      loopType: "hybrid_rag_tools",
      reason: "La tarea combina conocimiento documental y datos vivos.",
      riskLevel: input.mutatesData ? "high" : "medium",
      requiresApproval: input.mutatesData,
      requiresPersistentState: true,
      requiresVerification: true,
      maxSteps: 10,
    };
  }

  if (input.expectedComplexity === "complex") {
    return {
      loopType: "plan_execute",
      reason: "La tarea necesita planificación de varios pasos.",
      riskLevel: input.mutatesData ? "high" : "medium",
      requiresApproval: input.mutatesData,
      requiresPersistentState: true,
      requiresVerification: true,
      maxSteps: 12,
    };
  }

  if (input.mutatesData) {
    return {
      loopType: "single_action",
      reason: "La tarea implica una única acción de escritura.",
      riskLevel: "medium",
      requiresApproval: false,
      requiresPersistentState: true,
      requiresVerification: true,
      maxSteps: 4,
    };
  }

  return {
    loopType: "single_read",
    reason: "La tarea es una consulta simple de lectura.",
    riskLevel: "read_only",
    requiresApproval: false,
    requiresPersistentState: false,
    requiresVerification: true,
    maxSteps: 3,
  };
}
```

---

# 6. Máquina de estados común

Todos los loops deben compartir una máquina de estados coherente.

```ts
export type AgentRunStatus =
  | "created"
  | "interpreting"
  | "routing"
  | "planning"
  | "executing"
  | "verifying"
  | "waiting_for_user"
  | "waiting_for_approval"
  | "paused"
  | "completed"
  | "partially_completed"
  | "failed"
  | "cancelled";
```

## 6.1 Transiciones permitidas

```text
created
  ↓
interpreting
  ├── waiting_for_user
  ├── failed
  └── routing
        ↓
      planning
        ├── waiting_for_user
        ├── waiting_for_approval
        ├── failed
        └── executing
              ├── waiting_for_approval
              ├── paused
              ├── failed
              └── verifying
                    ├── executing
                    ├── planning
                    ├── completed
                    ├── partially_completed
                    └── failed
```

## 6.2 Reglas

No se debe permitir:

- Ejecutar desde `cancelled`.
- Completar desde `created`.
- Aprobar una ejecución ya completada.
- Reanudar una aprobación rechazada sin crear una nueva acción.
- Ejecutar una acción crítica sin pasar por `waiting_for_approval`.
- Declarar `completed` sin verificación final.
- Volver a ejecutar una acción idempotente ya confirmada.
- Cambiar de tenant al reanudar una ejecución.

---

# 7. Estado persistente del loop

```ts
export type AgentRunState = {
  runId: string;
  companyId: string;
  actorId: string;
  conversationId?: string;
  status: AgentRunStatus;
  loopType: LoopType;
  objective: AgentObjective;
  task: AgentTask;
  currentStep: number;
  maxSteps: number;
  plan?: AgentPlan;
  completedSteps: AgentStep[];
  pendingSteps: AgentStep[];
  observations: AgentObservation[];
  errors: AgentRunError[];
  approvals: ApprovalRequest[];
  budget: LoopBudget;
  progress: ProgressState;
  createdAt: string;
  updatedAt: string;
};
```

Persistencia obligatoria para:

- Escrituras.
- Operaciones masivas.
- Operaciones financieras.
- Operaciones contractuales.
- Procesos con aprobación.
- Procesos de larga duración.
- Procesos reanudables.
- Procesos con múltiples herramientas.

---

# 8. Presupuesto del loop

```ts
export type LoopBudget = {
  maxSteps: number;
  maxModelCalls: number;
  maxToolCalls: number;
  maxRetriesPerTool: number;
  maxDurationMs: number;
  maxTokens?: number;
  maxEstimatedCost?: number;
  maxAffectedRecords?: number;
  maxExternalMessages?: number;
};
```

| Loop | Pasos recomendados | Reintentos | Persistencia |
|---|---:|---:|---|
| single_read | 2-3 | 1 | opcional |
| single_action | 3-4 | 1 | sí |
| progressive_search | 5-8 | 1-2 | recomendable |
| plan_execute | 8-12 | 1-2 | sí |
| bulk_programmatic | 5-8 | por lote | sí |
| generator_evaluator | 3-5 ciclos | 0-1 | recomendable |
| human_approval | variable | 1 | sí |
| transactional | 8-12 | controlado | sí |
| supervisor_worker | 8-15 | controlado | sí |
| long_running | configurable | checkpoint | sí |
| hybrid_rag_tools | 6-10 | 1-2 | sí |

---

# 9. Contrato de decisión del agente

```ts
export type AgentDecision =
  | {
      type: "tool_call";
      toolName: string;
      arguments: unknown;
      expectedOutcome: string;
    }
  | {
      type: "request_clarification";
      question: string;
      missingFields: string[];
    }
  | {
      type: "request_approval";
      action: PlannedAction;
    }
  | {
      type: "replan";
      reason: string;
      updatedPlan: AgentPlan;
    }
  | {
      type: "finish";
      result: unknown;
      evidence: unknown[];
    }
  | {
      type: "fail";
      reason: string;
      errorCode: string;
    };
```

El modelo no debe indicar acciones internas mediante texto ambiguo.

---

# 10. Contrato de paso

```ts
export type AgentStep = {
  id: string;
  runId: string;
  stepNumber: number;
  type:
    | "model_decision"
    | "tool_call"
    | "verification"
    | "approval"
    | "clarification"
    | "replan"
    | "finalization";
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "skipped";
  objective: string;
  input?: unknown;
  output?: unknown;
  startedAt?: string;
  completedAt?: string;
};
```

---

# 11. Criterios de progreso

Cada paso debe producir al menos uno de estos resultados:

- Nuevo dato relevante.
- Cambio de estado.
- Subobjetivo completado.
- Ambigüedad reducida.
- Error clasificado.
- Aprobación solicitada.
- Plan corregido.
- Evidencia obtenida.

```ts
export type ProgressState = {
  completedSubgoals: string[];
  newFacts: string[];
  changedState: boolean;
  unresolvedBlockers: string[];
  repeatedActionCount: number;
  stagnantStepCount: number;
};
```

Regla:

```text
1. Detectar tres pasos sin progreso.
2. Replanificar una vez.
3. Si continúa sin progreso, detener.
4. Solicitar aclaración si falta información.
5. Fallar si no existe una continuación segura.
```

---

# 12. Detección de acciones repetidas

```ts
export function createActionFingerprint(input: {
  toolName: string;
  arguments: unknown;
}): string {
  return hash({
    toolName: input.toolName,
    arguments: normalizeArguments(input.arguments),
  });
}
```

Reglas:

- Si una acción idéntica ya se ejecutó correctamente, no repetirla.
- Si falló por error no reintentable, no repetirla.
- Si falló por error temporal, reintentar con la misma clave de idempotencia.

---

# 13. Clasificación de errores

```ts
export type AgentErrorCategory =
  | "temporary"
  | "validation"
  | "authorization"
  | "tenant"
  | "domain"
  | "ambiguity"
  | "conflict"
  | "external"
  | "verification"
  | "budget"
  | "internal";
```

| Categoría | Respuesta |
|---|---|
| temporary | retry limitado |
| validation | corregir argumentos |
| authorization | detener |
| tenant | detener y auditar |
| domain | replanificar o informar |
| ambiguity | pedir aclaración |
| conflict | refrescar estado y replanificar |
| external | retry o fallback permitido |
| verification | corregir o compensar |
| budget | detener |
| internal | fallar de forma controlada |

---

# 14. Retry, replan, rollback y fail

## Retry

Misma estrategia, mismo objetivo, error temporal.

## Replan

La estrategia ya no es válida.

## Rollback o compensación

Se ejecutó un efecto parcial que debe revertirse.

## Fail

No existe una continuación segura.

Muchos agentes defectuosos confunden estas cuatro respuestas.

---

# 15. Tipos de loop que debe soportar el CRM

## 15.1 `single_read`

### Uso

- Consultar leads.
- Consultar clientes.
- Consultar oportunidades.
- Consultar reservas.
- Consultar pagos.
- Consultar tareas.
- Consultar documentos.

### Flujo

```text
Interpretar
  ↓
Resolver entidad
  ↓
Ejecutar herramienta de lectura
  ↓
Validar resultado
  ↓
Responder
```

### Reglas

- Máximo 3 pasos.
- No necesita planificación.
- Verificar tenant.
- Diferenciar “sin resultados” de “error”.
- No inventar datos ausentes.

---

## 15.2 `single_action`

### Uso

- Crear tarea.
- Añadir nota.
- Asignar lead.
- Marcar notificación.
- Cambiar estado permitido.
- Reprogramar visita.

### Flujo

```text
Interpretar
  ↓
Resolver entidad
  ↓
Validar permiso y estado
  ↓
Ejecutar
  ↓
Volver a consultar
  ↓
Verificar
  ↓
Responder
```

### Reglas

- Persistencia obligatoria.
- Idempotencia obligatoria.
- Verificación posterior.
- Máximo 4 pasos.
- No usar para pagos, contratos o acciones masivas.

---

## 15.3 `progressive_search`

### Uso

- Buscar cliente por nombre.
- Localizar documentos de una reserva.
- Encontrar propiedad por referencia incompleta.
- Identificar oportunidad.
- Buscar conversaciones o incidencias.

### Estrategia

1. Identificador exacto.
2. Email.
3. Teléfono.
4. Referencia interna.
5. Nombre completo.
6. Coincidencia parcial.
7. Búsqueda semántica.
8. Pregunta al usuario.

### Reglas

- Máximo 3 reformulaciones.
- No seleccionar silenciosamente entre candidatos equivalentes.
- Registrar cómo se resolvió la entidad.
- No cruzar tenants.
- Finalizar si no existe progreso.

---

## 15.4 `plan_execute`

### Uso

- Preparar expediente.
- Revisar oportunidad.
- Preparar firma.
- Crear plan de seguimiento.
- Analizar incidencia.
- Completar flujo operativo.

```ts
export type AgentPlan = {
  objective: string;
  steps: Array<{
    id: string;
    description: string;
    toolName?: string;
    dependsOn: string[];
    requiresApproval: boolean;
    verificationRequired: boolean;
    status:
      | "pending"
      | "running"
      | "completed"
      | "failed"
      | "skipped";
  }>;
};
```

### Reglas

- Plan explícito.
- Dependencias explícitas.
- No ejecutar pasos fuera de orden.
- Una replanificación automática completa como máximo.
- La replanificación no puede eliminar controles de seguridad.
- Verificación global final.

---

## 15.5 `bulk_programmatic`

### Uso

- Repartir leads.
- Crear tareas masivas.
- Actualizar estados por lote.
- Enviar notificaciones internas.
- Aplicar políticas sobre oportunidades.
- Preparar exportaciones.

### Flujo

```text
Interpretar
  ↓
Obtener conjunto objetivo
  ↓
Calcular plan
  ↓
Preview
  ↓
Aprobación
  ↓
Ejecución programática por lotes
  ↓
Verificación por lote
  ↓
Reintento selectivo
  ↓
Resumen
```

### Regla crítica

El modelo no debe ejecutar una inferencia por cada fila.

El modelo propone la estrategia. El código ejecuta el lote.

### Controles

- Máximo de registros.
- Preview obligatorio.
- Aprobación si hay escrituras.
- Idempotencia por lote.
- Resultado parcial explícito.
- Reintentos solo sobre elementos fallidos.

---

## 15.6 `generator_evaluator`

### Uso

- Contratos.
- Correos jurídicos.
- Informes.
- Resúmenes de expediente.
- Argumentarios.
- Documentos internos.

```text
Generador
  ↓
Evaluador
  ├── aprobado -> entregar
  └── defectuoso -> feedback -> corregir
```

### Criterios

- Exactitud.
- Fuentes.
- Ausencia de invenciones.
- Coherencia.
- Completitud.
- Tono.
- Privacidad.
- Cumplimiento normativo.

### Reglas

- Máximo 2 o 3 revisiones.
- El evaluador devuelve feedback estructurado.
- Si sigue fallando, escalar a humano.
- Registrar versiones.

---

## 15.7 `human_approval`

### Uso

- Cancelar reserva.
- Cambiar precio.
- Validar pago.
- Emitir factura.
- Enviar contrato.
- Exportar datos sensibles.
- Acción masiva.

### Flujo

```text
Preparar acción
  ↓
Calcular impacto
  ↓
Crear preview
  ↓
Pausar run
  ↓
Aprobación humana
  ├── aprobar -> revalidar y ejecutar
  ├── rechazar -> cancelar
  └── modificar -> crear nuevo plan
```

### Reglas

- Aprobación ligada a una acción exacta.
- Debe caducar.
- Registrar aprobador.
- Mostrar impacto.
- Refrescar estado al reanudar.
- No reutilizar para argumentos diferentes.
- Si el estado cambia, nueva aprobación.

---

## 15.8 `transactional`

### Uso

- Crear reserva.
- Cancelar reserva.
- Validar pago.
- Ejecutar devolución.
- Emitir factura.
- Cerrar oportunidad ganada.
- Liberar inmueble.

### Reglas

- Estado persistente obligatorio.
- Idempotencia obligatoria.
- Transacción de base de datos.
- Compensación si existe fallo parcial.
- Verificación posterior.
- Auditoría completa.
- Aprobación humana.
- No ocultar estados parciales.

---

## 15.9 `supervisor_worker`

### Uso

- Analizar una oportunidad desde ventas, legal y financiero.
- Preparar expediente completo.
- Revisar contrato, pagos y documentación.
- Auditar una promoción.

### Reglas

- No crear agentes especialistas sin necesidad real.
- Cada worker con herramientas limitadas.
- Contratos de entrada y salida.
- Presupuesto por worker.
- Sin recursividad.
- Supervisor verifica contradicciones.
- No usar para tareas simples.

Antes de implementar, comprobar si basta con servicios deterministas o llamadas paralelas.

---

## 15.10 `long_running`

### Uso

- Importaciones.
- Procesamiento de documentos.
- Sincronizaciones.
- Revisión masiva de expedientes.
- Generación de informes complejos.
- Tareas programadas.

### Requisitos

- Checkpoints.
- Estado persistente.
- Reanudación.
- Cancelación.
- Progreso.
- Heartbeat.
- Idempotencia.
- Particionado.
- Compensación.

---

## 15.11 `hybrid_rag_tools`

### Uso

- Revisar si una reserva cumple el procedimiento.
- Determinar documentos faltantes.
- Preparar una firma.
- Analizar una incidencia con procedimientos internos.

### Flujo

```text
Interpretar
  ↓
Recuperar conocimiento
  ↓
Consultar datos vivos
  ↓
Cruzar hechos y reglas
  ↓
Generar conclusión
  ↓
Proponer acciones
  ↓
Aprobación si procede
  ↓
Ejecutar
  ↓
Verificar
```

Regla:

```text
RAG = conocimiento
Tools = estado real y acciones
```

---

# 16. Mapeo de loops a módulos del CRM

## Leads

| Caso | Loop |
|---|---|
| Consultar lead | single_read |
| Buscar lead ambiguo | progressive_search |
| Asignar lead | single_action |
| Repartir leads masivamente | bulk_programmatic |
| Cambiar estado | single_action |
| Analizar calidad | plan_execute |
| Crear seguimiento | plan_execute |

## Clientes

| Caso | Loop |
|---|---|
| Consultar cliente | single_read |
| Resolver cliente por nombre | progressive_search |
| Crear cliente | single_action |
| Fusionar duplicados | human_approval + transactional |
| Exportar datos | human_approval |
| Analizar expediente | hybrid_rag_tools |
| Preparar comunicación | generator_evaluator |

## Propiedades

| Caso | Loop |
|---|---|
| Consultar propiedad | single_read |
| Buscar por referencia | progressive_search |
| Cambiar estado | single_action |
| Cambiar precio | human_approval |
| Actualización masiva | bulk_programmatic |
| Reservar propiedad | transactional |
| Liberar propiedad | transactional |

## Oportunidades

| Caso | Loop |
|---|---|
| Consultar oportunidad | single_read |
| Cambiar etapa | single_action |
| Analizar probabilidad | plan_execute |
| Cerrar ganada | transactional |
| Cerrar perdida | single_action o human_approval |
| Crear seguimiento | plan_execute |
| Evaluar pipeline | bulk_programmatic o supervisor_worker |

## Reservas

| Caso | Loop |
|---|---|
| Consultar reserva | single_read |
| Crear reserva | transactional |
| Cancelar reserva | human_approval + transactional |
| Revisar documentación | hybrid_rag_tools |
| Preparar firma | plan_execute |
| Generar contrato | generator_evaluator |
| Validar pagos | human_approval + transactional |
| Enviar documentación | human_approval |

## Pagos y facturación

| Caso | Loop |
|---|---|
| Consultar pago | single_read |
| Validar pago | human_approval + transactional |
| Emitir factura | transactional |
| Ejecutar devolución | human_approval + transactional |
| Conciliar pagos | bulk_programmatic |
| Detectar discrepancias | plan_execute |
| Generar informe | generator_evaluator |

## Documentos

| Caso | Loop |
|---|---|
| Buscar documento | progressive_search |
| Consultar metadatos | single_read |
| Clasificar documento | generator_evaluator o plan_execute |
| Extraer información | plan_execute |
| Revisar cumplimiento | hybrid_rag_tools |
| Aprobar/rechazar | human_approval |
| Procesar muchos documentos | long_running |

## Tareas y agenda

| Caso | Loop |
|---|---|
| Crear tarea | single_action |
| Completar tarea | single_action |
| Reabrir tarea | single_action |
| Reprogramar visita | single_action |
| Generar plan | plan_execute |
| Crear tareas por lote | bulk_programmatic |
| Revisar agenda | single_read |
| Resolver conflictos | plan_execute |

## Notificaciones

| Caso | Loop |
|---|---|
| Consultar | single_read |
| Marcar leída | single_action |
| Enviar interna | single_action |
| Enviar masiva | bulk_programmatic |
| Comunicación sensible | human_approval |
| Recuperar fallo | retry controlado |

## Playbook y conocimiento

| Caso | Loop |
|---|---|
| Buscar procedimiento | progressive_search |
| Responder pregunta interna | hybrid_rag_tools |
| Crear libro estructurado | long_running |
| Revisar consistencia | generator_evaluator |
| Aplicar procedimiento | hybrid_rag_tools |
| Actualizar conocimiento | human_approval |

---

# 17. Casos detallados

## 17.1 Asignación masiva de leads

Solicitud:

```text
Asigna los leads nuevos de Málaga entre los comerciales disponibles.
```

Loop:

```text
bulk_programmatic
```

Fases:

1. Interpretar filtros.
2. Obtener leads objetivo.
3. Obtener comerciales activos.
4. Obtener política de reparto.
5. Generar plan.
6. Mostrar preview.
7. Solicitar aprobación.
8. Ejecutar por lotes en código.
9. Verificar asignaciones.
10. Reintentar solo fallidos temporales.
11. Notificar únicamente asignaciones confirmadas.
12. Devolver resultado real.

Invariantes:

- Mismo tenant.
- Leads sin asignación previa.
- Comerciales activos.
- No duplicidades.
- Capacidad respetada.
- Sin reasignar leads trabajados salvo orden explícita.

---

## 17.2 Cancelar reserva y devolver dinero

Solicitud:

```text
Cancela la reserva de Juan y devuelve el dinero.
```

Loop:

```text
human_approval + transactional
```

Fases:

1. Resolver cliente.
2. Resolver reserva.
3. Validar tenant.
4. Consultar estado.
5. Consultar pagos.
6. Consultar contrato.
7. Calcular devolución.
8. Generar preview.
9. Solicitar aprobación.
10. Revalidar estado.
11. Ejecutar cancelación.
12. Liberar inmueble.
13. Crear devolución.
14. Registrar contabilidad.
15. Verificar cancelación.
16. Verificar devolución.
17. Enviar comunicación.
18. Registrar auditoría.

Condiciones de parada:

- Cliente ambiguo.
- Reserva inexistente.
- Permiso denegado.
- Estado inválido.
- Importe no determinado.
- Aprobación rechazada.
- Verificación fallida.
- Cambio de estado tras aprobación.

---

## 17.3 Preparar expediente de firma

Solicitud:

```text
Prepara el expediente para la firma de la reserva de Marta.
```

Loop:

```text
plan_execute + hybrid_rag_tools
```

Plan:

1. Resolver reserva.
2. Consultar cliente.
3. Consultar inmueble.
4. Consultar documentos.
5. Recuperar checklist interno.
6. Comparar documentos presentes.
7. Detectar faltantes.
8. Crear tareas.
9. Generar resumen.
10. Verificar completitud.

---

## 17.4 Generar y revisar contrato

Solicitud:

```text
Genera el contrato de reserva y comprueba que cumple el procedimiento.
```

Loop:

```text
generator_evaluator + hybrid_rag_tools
```

Fases:

1. Obtener datos vivos.
2. Obtener plantilla y política.
3. Generar borrador.
4. Evaluar campos obligatorios.
5. Evaluar coherencia.
6. Evaluar riesgos.
7. Corregir.
8. Solicitar revisión humana.
9. Guardar versión.
10. No enviar sin aprobación.

---

## 17.5 Consulta ambigua

Solicitud:

```text
Mueve la reunión de Marta al viernes.
```

Loop:

```text
progressive_search + single_action
```

Resolver:

- Qué Marta.
- Qué reunión.
- Qué viernes.
- Zona horaria.
- Disponibilidad.
- Necesidad de notificar.

No ejecutar con dos reuniones candidatas.

---

# 18. Runner común

```ts
export async function runAgentLoop(
  run: AgentRun,
  dependencies: AgentDependencies
): Promise<AgentRunResult> {
  const {
    model,
    router,
    toolRegistry,
    authorization,
    riskService,
    approvalService,
    verifier,
    runRepository,
    progressService,
  } = dependencies;

  await runRepository.updateStatus(run.id, "routing");

  const loopSelection = await router.select({
    actor: run.actor,
    task: run.task,
  });

  await runRepository.setLoopType(run.id, loopSelection.loopType);

  const executedActions = new Map<string, ToolResult>();

  for (let stepNumber = 1; stepNumber <= loopSelection.maxSteps; stepNumber++) {
    await assertBudgetAvailable(run);

    if (await progressService.noProgressDetected(run.id)) {
      const canReplan = await progressService.canReplan(run.id);

      if (!canReplan) {
        return failRun(run, "NO_PROGRESS_DETECTED");
      }
    }

    const decision = await model.next({
      objective: run.objective,
      state: await runRepository.getState(run.id),
      tools: await toolRegistry.describeAllowed({
        actor: run.actor,
        task: run.task,
      }),
    });

    await runRepository.recordDecision({
      runId: run.id,
      stepNumber,
      decision,
    });

    if (decision.type === "request_clarification") {
      await runRepository.pause(run.id, "waiting_for_user");
      return {
        status: "waiting_for_user",
        question: decision.question,
      };
    }

    if (decision.type === "request_approval") {
      const approval = await approvalService.create({
        runId: run.id,
        action: decision.action,
      });

      await runRepository.pause(run.id, "waiting_for_approval");
      return {
        status: "waiting_for_approval",
        approval,
      };
    }

    if (decision.type === "replan") {
      await runRepository.updatePlan({
        runId: run.id,
        plan: decision.updatedPlan,
      });
      continue;
    }

    if (decision.type === "tool_call") {
      const tool = toolRegistry.get(decision.toolName);
      const parsedInput = tool.inputSchema.parse(decision.arguments);

      await authorization.assertAllowed({
        actor: run.actor,
        tool,
        arguments: parsedInput,
      });

      const fingerprint = createActionFingerprint({
        toolName: tool.name,
        arguments: parsedInput,
      });

      if (executedActions.has(fingerprint)) {
        const previousResult = executedActions.get(fingerprint);
        await runRepository.recordObservation({
          runId: run.id,
          stepNumber,
          type: "already_executed",
          content: previousResult,
        });
        continue;
      }

      const risk = riskService.assess({
        tool,
        arguments: parsedInput,
      });

      if (risk.requiresApproval) {
        const approval = await approvalService.create({
          runId: run.id,
          action: {
            toolName: tool.name,
            arguments: parsedInput,
          },
        });

        await runRepository.pause(run.id, "waiting_for_approval");
        return {
          status: "waiting_for_approval",
          approval,
        };
      }

      const result = await executeWithRetry({
        tool,
        arguments: parsedInput,
        context: {
          actor: run.actor,
          runId: run.id,
          stepNumber,
          idempotencyKey: `${run.id}:${stepNumber}:${tool.name}`,
        },
      });

      executedActions.set(fingerprint, result);

      const verification = await verifier.verifyToolResult({
        tool,
        arguments: parsedInput,
        result,
        actor: run.actor,
      });

      await runRepository.recordToolResult({
        runId: run.id,
        stepNumber,
        toolName: tool.name,
        result,
        verification,
      });

      if (!verification.passed) {
        await runRepository.addError({
          runId: run.id,
          code: "VERIFICATION_FAILED",
          details: verification.errors,
        });
      }

      continue;
    }

    if (decision.type === "finish") {
      await runRepository.updateStatus(run.id, "verifying");

      const completion = await verifier.verifyCompletion({
        runId: run.id,
        objective: run.objective,
        proposedResult: decision.result,
      });

      if (!completion.passed) {
        await runRepository.addObservation({
          runId: run.id,
          type: "completion_feedback",
          content: completion,
        });
        continue;
      }

      return completeRun(run, {
        result: decision.result,
        evidence: completion.evidence,
      });
    }

    if (decision.type === "fail") {
      return failRun(run, decision.errorCode, decision.reason);
    }
  }

  return failRun(run, "MAX_STEPS_EXCEEDED");
}
```

---

# 19. Paralelismo

Usar en lecturas independientes.

No usar si:

- Hay escrituras sobre el mismo registro.
- El orden importa.
- Una acción depende de otra.
- Existe riesgo de conflicto.
- La operación es financiera.
- La operación es contractual.

```ts
export type ParallelStepGroup = {
  id: string;
  steps: AgentStep[];
  strategy: "all" | "all_settled" | "first_success";
  maxConcurrency: number;
};
```

---

# 20. Gestión del contexto dentro del loop

Cada iteración debe incluir:

- Objetivo.
- Estado actual.
- Plan.
- Resultados relevantes.
- Errores activos.
- Presupuesto restante.
- Herramientas disponibles.
- Evidencias necesarias.

Debe excluir:

- Resultados obsoletos.
- Logs extensos.
- Datos completos innecesarios.
- Respuestas duplicadas.
- Historial irrelevante.
- Datos sensibles no necesarios.

```ts
export type AgentObservation = {
  type:
    | "tool_result"
    | "verification"
    | "error"
    | "approval"
    | "user_input"
    | "progress";
  summary: string;
  structuredData?: unknown;
  sourceStepId: string;
};
```

---

# 21. Persistencia recomendada

Tablas sugeridas:

```text
agent_runs
agent_run_steps
agent_run_plans
agent_tool_calls
agent_observations
agent_approvals
agent_verifications
agent_errors
agent_checkpoints
```

No crearlas sin revisar antes el esquema real.

Aplicar RLS y aislamiento multi-tenant.

---

# 22. Reanudación

Una ejecución puede reanudarse después de:

- Aprobación.
- Respuesta del usuario.
- Recuperación de proveedor.
- Reinicio del proceso.
- Checkpoint.
- Pausa programada.

Al reanudar:

1. Cargar estado.
2. Verificar tenant.
3. Verificar actor.
4. Refrescar datos.
5. Comprobar caducidad.
6. Comprobar si el recurso cambió.
7. Revalidar permisos.
8. Revalidar aprobación.
9. Continuar desde el paso correcto.

---

# 23. Idempotencia

Toda herramienta con efectos debe recibir:

```ts
idempotencyKey: string;
```

Ejemplos:

```ts
`${runId}:${stepNumber}:${toolName}:${resourceId}`
`${runId}:batch:${batchNumber}`
`${runId}:email:${recipientId}`
```

---

# 24. Verificación

## Verificación de paso

Comprueba si la herramienta hizo lo esperado.

## Verificación global

Comprueba si la tarea completa se resolvió.

```ts
export type CompletionEvidence = {
  entityType: string;
  entityId: string;
  expectedState: unknown;
  actualState: unknown;
  verifiedAt: string;
};
```

---

# 25. Resultado parcial

El sistema debe soportar:

```ts
status: "partially_completed"
```

Ejemplo:

```text
24 leads objetivo.
22 asignados.
2 fallaron por conflicto.
4 comerciales notificados.
```

No debe responder “completado” si existen fallos no resueltos.

---

# 26. Observabilidad específica del loop

Métricas:

- Tipo de loop.
- Pasos por run.
- Llamadas al modelo.
- Llamadas a herramientas.
- Reintentos.
- Replanificaciones.
- Aprobaciones.
- Pausas.
- Tiempo total.
- Tiempo por paso.
- Coste.
- Tasa de éxito.
- Tasa de finalización parcial.
- Tasa de falta de progreso.
- Tasa de acciones repetidas.
- Tasa de verificación fallida.
- Tasa de intervención humana.
- Herramientas más usadas.
- Errores por loop.

Alertas:

- Cruce de tenant.
- Bucle sin progreso.
- Exceso de pasos.
- Reintentos anómalos.
- Acciones duplicadas.
- Verificaciones fallidas.
- Operaciones críticas sin aprobación.
- Runs bloqueados.
- Coste anómalo.

---

# 27. Evals de Loop Engineering

Medir:

- Selección correcta del loop.
- Número de pasos.
- Uso correcto de herramientas.
- Ausencia de repeticiones.
- Finalización correcta.
- Capacidad de pedir aclaración.
- Capacidad de solicitar aprobación.
- Capacidad de replanificar.
- Capacidad de detenerse.
- Corrección del resultado parcial.
- Verificación real.
- Ausencia de efectos duplicados.

Dataset mínimo:

- Consulta simple.
- Entidad ambigua.
- Recurso inexistente.
- Falta de permiso.
- Cruce de tenant.
- Acción ya ejecutada.
- Error temporal.
- Error permanente.
- Operación masiva.
- Operación financiera.
- Aprobación rechazada.
- Aprobación caducada.
- Cambio de estado durante pausa.
- Verificación fallida.
- Falta de progreso.
- Presupuesto agotado.
- Resultado parcial.

---

# 28. Tests

## Unitarios

- Router de loops.
- Máquina de estados.
- Presupuestos.
- Detección de repetición.
- Detección de progreso.
- Retry policy.
- Replan policy.
- Completion criteria.
- Approval policy.
- Verificadores.

## Integración

- single_read.
- single_action.
- progressive_search.
- plan_execute.
- bulk_programmatic.
- human_approval.
- transactional.
- hybrid_rag_tools.
- Reanudación.
- Fallo parcial.
- Compensación.

## Seguridad

- Tenant mismatch.
- Escalada de permisos.
- Acción crítica sin aprobación.
- Reutilización de aprobación.
- Reutilización de idempotency key.
- Prompt injection.
- Herramienta no autorizada.
- Alteración de argumentos tras preview.

---

# 29. Antipatrones prohibidos

1. Un solo loop para todo.
2. `while (true)` sin límites.
3. Una llamada al modelo por fila.
4. El modelo decide unilateralmente si terminó.
5. Reintentos ciegos.
6. Aprobación genérica.
7. Ocultar fallos parciales.
8. Ejecutar RAG como CRUD.
9. Crear agentes múltiples innecesarios.
10. Acumular todo el contexto sin control.

---

# 30. Arquitectura propuesta

```text
src/
  features/
    ai-agent/
      loops/
        loop-router.ts
        loop-runner.ts
        loop-budget.ts
        loop-state-machine.ts
        progress-detector.ts
        action-fingerprint.ts

        implementations/
          single-read.loop.ts
          single-action.loop.ts
          progressive-search.loop.ts
          plan-execute.loop.ts
          bulk-programmatic.loop.ts
          generator-evaluator.loop.ts
          human-approval.loop.ts
          transactional.loop.ts
          supervisor-worker.loop.ts
          long-running.loop.ts
          hybrid-rag-tools.loop.ts

      approvals/
      tools/
      verifiers/
      policies/
      persistence/
      observability/
      evals/
      tests/
```

Adaptar al repositorio real. No imponer esta estructura si ya existe una equivalente.

---

# 31. Fases de implementación

## Fase 0. Auditoría

Analizar:

- Chat actual.
- Runtime de IA.
- Servicios CRUD.
- Herramientas.
- Estados.
- Roles.
- Permisos.
- RLS.
- Persistencia.
- Logs.
- Agentes.
- RAG.
- Aprobaciones.
- Jobs.
- Colas.
- Eventos.

No modificar todavía.

## Fase 1. Contratos comunes

Crear:

- `LoopType`
- `LoopSelection`
- `AgentRunState`
- `AgentDecision`
- `AgentStep`
- `AgentPlan`
- `LoopBudget`
- `ProgressState`
- `CompletionEvidence`

## Fase 2. Router

Implementar selección determinista inicial.

## Fase 3. Máquina de estados

Implementar transiciones, persistencia, pausa, reanudación y cancelación.

## Fase 4. Loops de lectura

- single_read.
- progressive_search.
- hybrid_rag_tools solo lectura.

## Fase 5. Escrituras simples

- single_action.
- Idempotencia.
- Verificación.

## Fase 6. Planificación

- plan_execute.
- Replanificación.
- Detección de progreso.
- Presupuestos.

## Fase 7. Operaciones masivas

- bulk_programmatic.
- Preview.
- Aprobación.
- Ejecución por lotes.
- Resultado parcial.

## Fase 8. Human in the loop

- Aprobaciones.
- Caducidad.
- Reanudación.
- Revalidación.
- Auditoría.

## Fase 9. Transaccional

- transactional.
- Compensación.
- Pagos.
- Reservas.
- Facturación.

## Fase 10. Generador-evaluador

- Contratos.
- Correos.
- Informes.
- Revisiones limitadas.

## Fase 11. Agentes especialistas

Solo después de demostrar necesidad.

## Fase 12. Observabilidad y evals

- Dashboards.
- Alertas.
- Datasets.
- Pruebas adversariales.
- Regression evals.

---

# 32. Criterios de aceptación

- [ ] Existe un router de loops.
- [ ] Cada caso de uso declara su loop.
- [ ] Existe máquina de estados.
- [ ] Los runs persisten estado.
- [ ] Existen presupuestos.
- [ ] Existe detección de progreso.
- [ ] Existe detección de repetición.
- [ ] Los errores están clasificados.
- [ ] Retry, replan y fail están separados.
- [ ] Las escrituras son idempotentes.
- [ ] Las escrituras se verifican.
- [ ] Las operaciones masivas usan código.
- [ ] Las operaciones críticas requieren aprobación.
- [ ] Las aprobaciones son reanudables.
- [ ] El estado se revalida tras una pausa.
- [ ] Existe resultado parcial.
- [ ] El modelo no decide unilateralmente el éxito.
- [ ] Los loops tienen tests.
- [ ] Los loops tienen métricas.
- [ ] Existe aislamiento multi-tenant.
- [ ] RAG y tools están separados.
- [ ] Los agentes especialistas se usan solo cuando aportan valor real.

---

# 33. Instrucciones directas para Codex

## Misión

Analiza e integra Loop Engineering en el copiloto y los agentes del CRM.

El sistema debe seleccionar diferentes loops según el caso de uso.

## Restricciones

1. No inventes tablas, columnas, servicios, roles o permisos.
2. Inspecciona el repositorio real antes de modificar.
3. Reutiliza servicios existentes.
4. No conectes el modelo directamente a SQL.
5. No implementes un loop universal.
6. No uses una llamada de modelo por registro en operaciones masivas.
7. No uses IA para permisos.
8. No declares éxito sin verificación.
9. No ocultes fallos parciales.
10. No implementes pagos o cancelaciones antes de tener aprobaciones e idempotencia.
11. No crees múltiples agentes sin necesidad demostrada.
12. No uses RAG para ejecutar CRUD.
13. Mantén multi-tenant.
14. Añade tests.
15. Documenta decisiones mediante ADR.
16. No cambies la calidad del razonamiento según el plan comercial.
17. No introduzcas abstracciones sin uso real.
18. No reescribas módulos completos sin necesidad.
19. No marques una fase como terminada con tests fallando.
20. Cada cambio debe ser pequeño, revisable y reversible.

---

# 34. Primera tarea recomendada para Codex

```text
Analiza el repositorio real del CRM para diseñar e integrar la primera capa de
Loop Engineering del copiloto.

No implementes todavía operaciones financieras, contractuales ni masivas.

Objetivos:

1. Localizar el chat y el runtime actual de IA.
2. Identificar cómo se ejecutan actualmente herramientas y acciones CRUD.
3. Identificar los servicios de dominio reutilizables.
4. Identificar roles, permisos y RLS.
5. Identificar si existe persistencia de ejecuciones.
6. Identificar si existen reintentos, verificaciones, aprobaciones o límites.
7. Clasificar los casos de uso actuales según estos loops:
   - single_read
   - single_action
   - progressive_search
   - plan_execute
   - bulk_programmatic
   - generator_evaluator
   - human_approval
   - transactional
   - supervisor_worker
   - long_running
   - hybrid_rag_tools
8. Proponer los contratos TypeScript de:
   - LoopType
   - LoopSelection
   - AgentRunState
   - AgentDecision
   - AgentStep
   - AgentPlan
   - LoopBudget
   - ProgressState
   - CompletionEvidence
9. Diseñar un Loop Router inicial basado en reglas deterministas.
10. Implementar solo:
   - single_read
   - progressive_search
   - máquina de estados
   - presupuesto
   - trazabilidad mínima
   - tests
11. Reutilizar una herramienta de lectura existente.
12. Añadir pruebas de:
   - lectura correcta
   - recurso inexistente
   - entidad ambigua
   - falta de permiso
   - cruce de tenant
   - presupuesto agotado
   - falta de progreso
13. Documentar:
   - arquitectura
   - ADR
   - riesgos
   - evidencias
   - siguientes fases

Restricciones:

- No inventes servicios ni columnas.
- No conectes el LLM directamente a SQL.
- No implementes un while(true).
- No implementes herramientas de escritura todavía.
- No crees múltiples agentes.
- No cambies el comportamiento funcional del CRM fuera del módulo de IA.
- No declares el trabajo completo si typecheck, lint o tests fallan.
- Antes de modificar, entrega:
  a) diagnóstico,
  b) mapa de casos de uso,
  c) loops recomendados,
  d) archivos exactos que crearías o modificarías.
```

---

# 35. ADR que deben crearse

- Selección de loops.
- Máquina de estados.
- Persistencia de runs.
- Presupuestos.
- Retry y replan.
- Idempotencia.
- Aprobaciones.
- Operaciones masivas.
- Separación RAG/tools.
- Supervisor-worker.
- Verificación.
- Compensación.
- Observabilidad.

---

# 36. Definición de terminado

Una capacidad del CRM basada en agente está terminada cuando:

1. Tiene un loop definido.
2. Tiene objetivo estructurado.
3. Tiene estados.
4. Tiene presupuesto.
5. Tiene herramientas limitadas.
6. Tiene permisos.
7. Tiene idempotencia.
8. Tiene detección de repetición.
9. Tiene verificación de pasos.
10. Tiene verificación global.
11. Tiene manejo de errores.
12. Tiene estrategia de retry.
13. Tiene estrategia de replan.
14. Tiene estrategia de aprobación.
15. Tiene persistencia.
16. Tiene trazabilidad.
17. Tiene métricas.
18. Tiene tests.
19. Tiene criterios de finalización.
20. Tiene documentación.

---

# 37. Resumen ejecutivo

El CRM no debe ejecutar todas las tareas con el mismo ciclo.

Debe distinguir entre:

- Lectura.
- Búsqueda.
- Escritura simple.
- Planificación.
- Operación masiva.
- Evaluación iterativa.
- Aprobación.
- Transacción.
- Trabajo especializado.
- Proceso largo.
- Combinación de RAG y tools.

El modelo propone el siguiente paso.

El loop:

- Limita.
- Valida.
- Ejecuta.
- Mide progreso.
- Evita repeticiones.
- Reintenta solo cuando procede.
- Replanifica cuando es necesario.
- Solicita aprobación.
- Verifica.
- Finaliza.

La Loop Engineering no consiste en dejar que el modelo siga pensando.

Consiste en convertir una tarea abierta en un proceso controlado, medible y verificable.
