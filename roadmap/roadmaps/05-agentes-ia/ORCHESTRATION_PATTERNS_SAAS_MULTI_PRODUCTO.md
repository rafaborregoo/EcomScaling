# Orchestration Patterns para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica transversal
- **Ámbito:** SaaS, CRM, plataformas analíticas, copilotos, agentes operativos, workflows y sistemas multi-tenant
- **Casos de referencia:** EcomScaling IA y CRM/SaaS
- **Objetivo:** diseñar una arquitectura de orquestación reutilizable, observable, segura y adaptada al producto real
- **Audiencia:** Codex, equipo técnico, arquitectura, producto, seguridad, operaciones y responsables de IA
- **Prioridad:** crítica
- **Idioma:** castellano
- **Principio rector:** usar siempre el patrón más simple que resuelva correctamente el problema y analizar exhaustivamente el producto antes de introducir agentes, subagentes, handoffs o workflows complejos

---

# 1. Propósito

Este documento define cómo implementar **Orchestration Patterns** en una plataforma SaaS con agentes de IA.

La arquitectura debe servir para productos distintos, entre ellos:

- SaaS de analítica y escalado de tiendas.
- CRM/SaaS operativo.
- Copilotos empresariales.
- Plataformas documentales.
- Agentes especialistas.
- Sistemas multiempresa.
- Workflows con aprobaciones.
- Procesos de larga duración.
- Automatizaciones basadas en eventos.
- Sistemas con RAG, tools y memoria.

La arquitectura común no debe quedar acoplada a entidades concretas.

Ejemplos de dominio:

## EcomScaling IA

- Tiendas.
- Campañas.
- Creatividades.
- Productos.
- Pedidos.
- Márgenes.
- Experimentos.
- Recomendaciones.

## CRM/SaaS

- Leads.
- Clientes.
- Oportunidades.
- Reservas.
- Pagos.
- Documentos.
- Tareas.
- Notificaciones.

La plataforma común debe trabajar con conceptos transversales:

- Workflow.
- Nodo.
- Agente.
- Worker.
- Tool.
- Router.
- Estado.
- Evento.
- Handoff.
- Aprobación.
- Presupuesto.
- Contrato.
- Resultado.
- Error.
- Checkpoint.
- Reanudación.
- Verificación.

---

# 2. Regla obligatoria de análisis previo

## 2.1 Principio

Antes de diseñar o implementar cualquier patrón de orquestación, Codex debe analizar exhaustivamente el sistema real.

No debe asumirse que un sistema multiagente es necesario.

No debe asumirse que un workflow genérico puede copiarse directamente.

La orquestación debe adaptarse a:

- El producto.
- Los usuarios.
- Los casos de uso.
- Las fuentes.
- Los procesos reales.
- Los servicios.
- Las tools.
- Los agentes existentes.
- Los eventos.
- Los permisos.
- Los riesgos.
- Los estados.
- La persistencia.
- La infraestructura.
- La latencia aceptable.
- El coste.
- La necesidad de intervención humana.

## 2.2 Prohibiciones

Codex no debe:

- Crear un agente por módulo.
- Crear un agente por tabla.
- Crear un agente por función.
- Crear handoffs sin necesidad conversacional real.
- Crear workers sin contratos.
- Introducir un supervisor solo porque la arquitectura “parece más avanzada”.
- Convertir procesos deterministas en agentes.
- Paralelizar escrituras dependientes.
- Delegar sin límites.
- Permitir ciclos de delegación.
- Diseñar workflows sin estado persistente.
- Crear un router inteligente cuando basta un `if`.
- Usar multiagente antes de demostrar valor.
- Copiar una orquestación de otro SaaS sin analizar el dominio.

## 2.3 Entregables del análisis

Antes de implementar, Codex debe entregar:

1. Mapa de producto.
2. Mapa de casos de uso.
3. Mapa de agentes existentes.
4. Mapa de tools.
5. Mapa de servicios.
6. Mapa de eventos.
7. Mapa de estados.
8. Mapa de aprobaciones.
9. Mapa de tareas largas.
10. Mapa de dependencias.
11. Mapa de riesgos.
12. Mapa de puntos de fallo.
13. Mapa de necesidades de paralelismo.
14. Mapa de necesidades de handoff.
15. Mapa de necesidades de workers.
16. Propuesta de patrones.
17. Justificación de por qué cada patrón es necesario.
18. Propuesta de adaptación al producto concreto.

No debe escribirse código hasta completar este análisis.

---

# 3. Definición

**Orchestration Patterns** es la disciplina de diseñar cómo se coordinan:

- Modelos.
- Agentes.
- Tools.
- Servicios.
- Funciones.
- Procesos.
- Workers.
- Aprobaciones.
- Eventos.
- Estado.
- Errores.
- Reintentos.
- Verificaciones.
- Humanos.

Fórmula conceptual:

```text
Orquestación fiable =
responsabilidades claras
+ contratos
+ estado
+ límites
+ aislamiento
+ verificación
+ recuperación
```

---

# 4. Diferencia con otras ingenierías

## Harness Engineering

Diseña el sistema completo.

## Loop Engineering

Controla cómo itera un agente.

## Context Engineering

Controla qué información recibe.

## Tool Design

Define qué capacidades puede ejecutar.

## Memory Architecture

Controla qué información se conserva.

## Orchestration Patterns

Coordina componentes, agentes, tools, workflows y humanos.

---

# 5. Principio de simplicidad

La arquitectura debe seguir esta jerarquía:

```text
1. Función determinista
2. Tool
3. Workflow
4. Agente
5. Agente especialista
6. Multiagente
```

No debe avanzarse al siguiente nivel si el anterior resuelve correctamente el problema.

Ejemplo:

```text
No:
Agente de leads.

Sí:
Tools de leads + workflow de asignación.
```

```text
No:
Agente de facturación para sumar importes.

Sí:
Servicio determinista.
```

```text
No:
Multiagente para revisar tres métricas.

Sí:
Un agente con tres tools.
```

---

# 6. Workflow frente a agente

## Workflow

El código controla:

- Pasos.
- Orden.
- Condiciones.
- Transiciones.
- Reintentos.
- Aprobaciones.
- Verificación.

Adecuado cuando:

- El proceso es conocido.
- El orden importa.
- Existen efectos reales.
- Se necesita previsibilidad.
- Se necesita auditoría.

## Agente

El modelo decide:

- Qué pasos necesita.
- Qué herramienta usar.
- Qué investigar.
- Cuándo replanificar.

Adecuado cuando:

- La tarea es abierta.
- El camino no puede predecirse.
- Se necesita interpretación.
- Existen múltiples estrategias válidas.

## Arquitectura híbrida

La opción habitual debe ser:

```text
Agente decide o interpreta
  ↓
Workflow valida y ejecuta
  ↓
Agente resume
```

---

# 7. Catálogo de patrones

```ts
export type OrchestrationPattern =
  | "sequential"
  | "routing"
  | "parallel"
  | "orchestrator_workers"
  | "agent_as_tool"
  | "handoff"
  | "evaluator_optimizer"
  | "voting"
  | "state_machine"
  | "event_driven"
  | "human_in_the_loop"
  | "hybrid";
```

---

# 8. Patrón secuencial

## Uso

Proceso conocido y ordenado.

```text
Entrada
  ↓
Paso A
  ↓
Paso B
  ↓
Paso C
  ↓
Verificación
```

## Casos

### EcomScaling

```text
Obtener métricas
  ↓
Calcular break-even
  ↓
Detectar problemas
  ↓
Generar recomendaciones
```

### CRM

```text
Resolver cliente
  ↓
Consultar expediente
  ↓
Consultar documentos
  ↓
Comparar checklist
```

## Ventajas

- Previsible.
- Auditable.
- Testeable.
- Fácil de reanudar.

## Riesgos

- Rigidez.
- Latencia acumulada.
- Propagación de errores.

---

# 9. Patrón routing

## Uso

Clasificar una solicitud y enviarla al flujo correcto.

```text
Petición
  ↓
Router
  ├── Analítica
  ├── Documentación
  ├── Operaciones
  └── Soporte
```

## Contrato

```ts
export type RouteDecision = {
  route: string;
  confidence: number;
  reason: string;
  requiresClarification: boolean;
};
```

## Regla

El router clasifica.

No debe resolver toda la tarea.

## Implementación

Usar reglas deterministas cuando sea posible.

No usar un modelo para distinguir dos rutas obvias.

---

# 10. Patrón paralelo

## Uso

Subtareas independientes.

```text
                 ┌── Subtarea A
Objetivo ────────┼── Subtarea B
                 └── Subtarea C
                        ↓
                   Consolidación
```

## Casos

### EcomScaling

- Paid media.
- Margen.
- Stock.
- Retención.

### CRM

- Documentos.
- Pagos.
- Tareas.
- Comunicaciones.

## Reglas

- Sin escrituras concurrentes sobre el mismo recurso.
- Sin dependencias ocultas.
- Contrato de salida común.
- Límite de concurrencia.
- Timeout por worker.
- Resultado parcial permitido.

---

# 11. Patrón orchestrator-workers

## Uso

Tarea compleja con subtareas no predecibles.

```text
Orquestador
  ├── Worker A
  ├── Worker B
  └── Worker C
        ↓
  Consolidación
```

## Requisitos

- Contrato de delegación.
- Presupuesto por worker.
- Aislamiento de contexto.
- Límite de workers.
- Verificación.
- Propietario único del estado.
- Sin recursividad ilimitada.

## Regla

No crear workers fijos para todo.

Activar solo los necesarios.

---

# 12. Patrón agent-as-tool

## Uso

Un agente principal mantiene el control y llama a especialistas.

```text
Usuario
  ↓
Agente principal
  ├── Agente financiero
  ├── Agente documental
  └── Agente analítico
        ↓
  Agente principal sintetiza
```

## Adecuado cuando

- Existe especialización real.
- Cada especialista necesita contexto distinto.
- El supervisor conserva conversación.
- El especialista devuelve un resultado estructurado.

## No usar cuando

- Basta una tool.
- Basta una función.
- El especialista no aporta razonamiento distinto.
- El contexto no necesita aislamiento.

---

# 13. Patrón handoff

## Uso

Un agente transfiere el control conversacional a otro.

```text
Agente inicial
  ↓ handoff
Agente especialista
  ↓
Continúa con el usuario
```

## Diferencia

### Agent-as-tool

El supervisor sigue controlando.

### Handoff

El especialista toma el control.

## Casos válidos

- Soporte por departamentos.
- Flujos conversacionales por etapas.
- Especialista que necesita preguntar al usuario.
- Cambio real de propietario de la conversación.

## Reglas

- Estado transferido explícitamente.
- Contexto limitado.
- Propietario actual visible.
- Posibilidad de retorno.
- Auditoría.
- Evitar handoffs circulares.

---

# 14. Patrón evaluator-optimizer

## Uso

Generar, evaluar y revisar.

```text
Generador
  ↓
Evaluador
  ├── aprobado
  └── feedback
         ↓
      revisión
```

## Casos

### EcomScaling

- Estrategias.
- Briefs.
- Recomendaciones.
- Informes.

### CRM

- Contratos.
- Correos.
- Resúmenes.
- Informes.

## Reglas

- Rúbrica clara.
- Máximo de revisiones.
- Escalado humano tras fallos.
- Evaluador independiente.
- Registro de versiones.

---

# 15. Patrón voting

## Uso

Obtener múltiples perspectivas.

```text
Analista A
Analista B
Analista C
    ↓
Agregador
```

## Reglas

- Ejecuciones independientes.
- Evidencias.
- Rúbrica.
- Método de agregación.
- Umbral de acuerdo.
- No tratar mayoría como verdad.

## Contrato

```ts
export type VotingResult = {
  votes: AgentVote[];
  agreement: number;
  evidenceCoverage: number;
  finalDecision: string;
};
```

---

# 16. Patrón state machine

## Uso

Procesos empresariales con estados.

```text
DRAFT
  ↓
ANALYZING
  ↓
WAITING_APPROVAL
  ↓
EXECUTING
  ↓
VERIFYING
  ↓
COMPLETED
```

## Casos

### EcomScaling

```text
recommendation_generated
reviewed
approved
executing
measuring
validated
```

### CRM

```text
draft
pending_payment
active
pending_signing
completed
```

## Reglas

Cada estado define:

- Tools disponibles.
- Agentes permitidos.
- Contexto.
- Transiciones.
- Aprobaciones.
- Criterios de salida.

---

# 17. Patrón event-driven

## Uso

Procesos activados por eventos.

```text
Evento
  ↓
Router
  ↓
Workflow
  ↓
Acciones
  ↓
Nuevos eventos
```

## Ejemplos

```text
campaign_performance_dropped
recommendation_approved
lead_created
payment_validated
document_rejected
```

## Reglas

- El evento representa algo ocurrido.
- Debe ser idempotente.
- Debe tener schema.
- Debe incluir tenant.
- Debe poder reintentarse.
- Debe generar trazabilidad.

---

# 18. Patrón human-in-the-loop

## Uso

El humano forma parte del workflow.

```text
Agente prepara
  ↓
Humano revisa
  ├── aprueba
  ├── rechaza
  └── modifica
        ↓
     reanudación
```

## Estados

```ts
export type WorkflowStatus =
  | "running"
  | "waiting_for_user"
  | "waiting_for_approval"
  | "paused"
  | "completed"
  | "failed";
```

## Casos

- Pausar campañas.
- Cambiar presupuestos.
- Cancelar reservas.
- Devolver dinero.
- Enviar contratos.
- Aplicar cambios masivos.
- Modificar políticas.

---

# 19. Patrón híbrido

## Uso

Combinar:

- Funciones.
- Tools.
- Modelos.
- Agentes.
- Workers.
- Aprobaciones.
- Condiciones.
- Eventos.
- Paralelismo.

Ejemplo:

```text
Función determinista
  ↓
Agente analítico
  ↓
Workers paralelos
  ↓
Evaluador
  ↓
Aprobación humana
  ↓
Tool transaccional
```

## Regla

Híbrido no significa improvisado.

Debe tener:

- Grafo.
- Estado.
- Contratos.
- Límites.
- Verificación.
- Persistencia.
- Recuperación.
- Observabilidad.

---

# 20. Control plane y execution plane

## Control plane

Responsable de:

- Routing.
- Estado.
- Políticas.
- Presupuesto.
- Selección de patrón.
- Selección de agentes.
- Aprobaciones.
- Trazabilidad.

## Execution plane

Responsable de:

- Tools.
- Workers.
- Jobs.
- APIs.
- Subagentes.
- Procesos.
- Colas.

```text
CONTROL PLANE
  Orchestrator
  State
  Policies
  Routing
  Budget
  Trace

EXECUTION PLANE
  Agents
  Tools
  Workers
  APIs
  Queues
  Jobs
```

---

# 21. Estado global

Debe existir un propietario único del estado.

```ts
export type WorkflowState = {
  workflowId: string;
  tenantId: string;
  actorId: string;

  status: WorkflowStatus;
  pattern: OrchestrationPattern;

  objective: string;
  currentNodeId?: string;

  completedNodes: string[];
  pendingNodes: string[];

  outputs: Record<string, unknown>;
  errors: StructuredError[];
  approvals: ApprovalState[];

  budget: WorkflowBudget;

  createdAt: string;
  updatedAt: string;
};
```

Workers y agentes pueden tener estado local.

El estado global pertenece al orquestador.

---

# 22. Contrato de workflow

```ts
export type OrchestrationPlan = {
  id: string;
  pattern: OrchestrationPattern;
  objective: string;

  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  budget: WorkflowBudget;
  completionCriteria: CompletionCriteria;
};
```

---

# 23. Nodo

```ts
export type WorkflowNode = {
  id: string;

  type:
    | "function"
    | "tool"
    | "agent"
    | "worker"
    | "router"
    | "approval"
    | "evaluator";

  inputSchema: unknown;
  outputSchema: unknown;

  timeoutMs: number;
  retryPolicy: RetryPolicy;

  requiredPermissions: string[];
  riskLevel: RiskLevel;
};
```

---

# 24. Edge

```ts
export type WorkflowEdge = {
  from: string;
  to: string;

  condition?:
    | "always"
    | "success"
    | "failure"
    | "approved"
    | "rejected"
    | "custom";
};
```

---

# 25. Contrato de delegación

```ts
export type DelegatedTask = {
  id: string;

  objective: string;

  scope: {
    includedResources: ResourceReference[];
    excludedAreas: string[];
  };

  constraints: string[];

  expectedOutput: {
    schemaId: string;
    requiredEvidence: boolean;
  };

  budget: {
    maxSteps: number;
    maxTokens: number;
    timeoutMs: number;
  };
};
```

---

# 26. Resultado de worker

```ts
export type WorkerResult = {
  taskId: string;

  status:
    | "completed"
    | "partial"
    | "failed";

  facts: Fact[];
  findings: Finding[];
  evidence: Evidence[];
  uncertainties: string[];
  recommendations: Recommendation[];
};
```

No aceptar resultados vagos.

---

# 27. Aislamiento de contexto

Cada worker debe recibir solo lo necesario.

## Worker financiero

- Ingresos.
- Costes.
- Margen.
- Presupuesto.

## Worker analítico

- Campañas.
- Métricas.
- Atribución.

## Worker documental

- Documentos.
- Checklist.
- Metadatos.

## Regla

No compartir todo con todos.

---

# 28. Consolidación

El sintetizador debe:

1. Deduplicar.
2. Resolver contradicciones.
3. Validar fuentes.
4. Identificar lagunas.
5. Priorizar.
6. Separar hechos y recomendaciones.
7. Emitir resultado coherente.

```ts
export type SynthesisResult = {
  verifiedFacts: Fact[];
  findings: Finding[];
  conflicts: Conflict[];
  missingInformation: string[];
  recommendations: Recommendation[];
};
```

---

# 29. Presupuestos

## Por agente

```ts
export type AgentBudget = {
  maxSteps: number;
  maxToolCalls: number;
  maxTokens: number;
  maxDurationMs: number;
  maxEstimatedCost: number;
};
```

## Por workflow

```ts
export type WorkflowBudget = {
  maxAgents: number;
  maxTotalCalls: number;
  maxParallelism: number;
  maxDurationMs: number;
  maxEstimatedCost: number;
};
```

---

# 30. Control de delegación

```ts
export type DelegationTrace = {
  path: string[];
  depth: number;
  maxDepth: number;
};
```

Reglas:

- Profundidad máxima.
- Detección de ciclos.
- Máximo de workers.
- Sin autodelegación.
- Presupuesto heredado.
- Sin creación ilimitada de agentes.

---

# 31. Errores

```ts
export type OrchestrationNodeResult<T> = {
  status:
    | "completed"
    | "partial"
    | "failed"
    | "waiting";

  output?: T;
  error?: StructuredError;
  retryable: boolean;
};
```

El orquestador decide:

- Retry.
- Fallback.
- Continuar.
- Replanificar.
- Escalar.
- Cancelar.

---

# 32. Persistencia y checkpoints

Todo workflow relevante debe poder:

- Persistir estado.
- Reanudarse.
- Cancelarse.
- Esperar aprobación.
- Esperar usuario.
- Recuperarse de fallo.

```ts
export type WorkflowCheckpoint = {
  workflowId: string;
  nodeId: string;
  state: WorkflowState;
  createdAt: string;
};
```

---

# 33. Idempotencia

Eventos, tools y nodos con efectos deben ser idempotentes.

Ejemplo:

```ts
const idempotencyKey =
  `${workflowId}:${nodeId}:${resourceId}`;
```

---

# 34. Verificación

Debe existir:

## Verificación por nodo

```text
¿Este nodo produjo el resultado esperado?
```

## Verificación global

```text
¿El workflow completó el objetivo?
```

## Verificación de consolidación

```text
¿La síntesis representa correctamente los outputs?
```

---

# 35. Selección de patrón

```ts
export type OrchestrationSelectionInput = {
  taskType: string;
  complexity: "simple" | "moderate" | "complex";
  requiresDynamicPlanning: boolean;
  hasIndependentSubtasks: boolean;
  requiresConversationTransfer: boolean;
  requiresApproval: boolean;
  isLongRunning: boolean;
  isEventTriggered: boolean;
  isStatefulBusinessProcess: boolean;
};
```

```ts
export type OrchestrationSelection = {
  pattern: OrchestrationPattern;
  reason: string;
  requiresPersistentState: boolean;
  requiresHumanApproval: boolean;
};
```

---

# 36. Matriz de selección

| Caso | Patrón |
|---|---|
| Consulta simple | tool |
| Procedimiento conocido | secuencial |
| Clasificación | routing |
| Subtareas independientes | paralelo |
| Subtareas dinámicas | orchestrator-workers |
| Especialista devuelve resultado | agent-as-tool |
| Especialista toma conversación | handoff |
| Resultado revisable | evaluator-optimizer |
| Perspectivas múltiples | voting |
| Proceso empresarial | state machine |
| Activación por evento | event-driven |
| Acción sensible | human-in-the-loop |
| Proceso complejo | híbrido |

---

# 37. Diseño para EcomScaling IA

## Caso

```text
Analiza la tienda y dime qué está frenando el crecimiento.
```

## Patrón recomendado

```text
Router
  ↓
Overview determinista
  ↓
Orchestrator de diagnóstico
  ├── Worker adquisición
  ├── Worker conversión
  ├── Worker producto y margen
  ├── Worker retención
  └── Worker stock
        ↓
Consolidación
  ↓
Evaluator
  ↓
Plan priorizado
```

## Regla

No ejecutar todos los workers siempre.

Primero detectar áreas sospechosas.

---

# 38. Diseño para CRM/SaaS

## Caso

```text
Revisa el expediente y prepáralo para la firma.
```

## Patrón recomendado

```text
Resolver expediente
  ↓
Workflow secuencial
  ├── Consultar documentos
  ├── Consultar pagos
  ├── Consultar tareas
  └── Consultar estado
        ↓
Comparar checklist
  ↓
Plan de acciones
  ↓
Aprobación
  ↓
Tools
  ↓
Verificación
```

## Regla

No crear un agente por módulo.

Usar workflow + tools + un agente para interpretación.

---

# 39. Eventos

```ts
export type DomainEvent = {
  id: string;
  tenantId: string;
  type: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  payload: unknown;
};
```

Ejemplos:

```text
recommendation_approved
campaign_performance_dropped
lead_created
payment_validated
document_rejected
```

---

# 40. Event Router

```ts
export interface EventRouter {
  route(
    event: DomainEvent
  ): Promise<OrchestrationPlan | null>;
}
```

Debe:

- Validar schema.
- Validar tenant.
- Evitar duplicados.
- Registrar evento.
- Seleccionar workflow.
- Aplicar permisos y políticas.

---

# 41. Human in the loop

Aprobación debe ser parte del grafo.

```ts
export type ApprovalNode = {
  id: string;
  actionSummary: string;
  impact: unknown;
  expiresAt: string;
  allowedApprovers: string[];
};
```

Al reanudar:

- Recargar estado.
- Revalidar permisos.
- Revalidar recurso.
- Revalidar impacto.
- Revalidar aprobación.

---

# 42. Observabilidad

Registrar:

- Workflow.
- Patrón.
- Nodos.
- Agentes.
- Tools.
- Handoffs.
- Delegaciones.
- Errores.
- Reintentos.
- Aprobaciones.
- Paralelismo.
- Presupuestos.
- Costes.
- Checkpoints.
- Resultado.

---

# 43. Métricas

- Workflows iniciados.
- Completados.
- Parciales.
- Fallidos.
- Tiempo total.
- Tiempo por nodo.
- Coste.
- Número de agentes.
- Número de workers.
- Reintentos.
- Handoffs.
- Aprobaciones.
- Errores por patrón.
- Ciclos evitados.
- Workers inútiles.
- Calidad frente a arquitectura simple.

---

# 44. Evals

Evaluar:

- Selección correcta del patrón.
- Necesidad real de multiagente.
- Calidad de delegación.
- Contrato de salida.
- Context isolation.
- Consolidación.
- Verificación.
- Coste.
- Latencia.
- Handoffs.
- Routing.
- Detección de ciclos.
- Resultado parcial.
- Reanudación.
- Aprobaciones.

---

# 45. Tests

## Unitarios

- Selector de patrón.
- Máquina de estados.
- Router.
- Presupuesto.
- Delegación.
- Detección de ciclos.
- Consolidación.
- Verificación.

## Integración

- Secuencial.
- Paralelo.
- Agent-as-tool.
- Handoff.
- Human-in-the-loop.
- Event-driven.
- Reanudación.
- Fallo parcial.
- Checkpoint.

## Seguridad

- Cruce de tenant.
- Escalada de permisos.
- Delegación no autorizada.
- Handoff indebido.
- Worker con tools prohibidas.
- Evento malicioso.
- Aprobación reutilizada.

---

# 46. Antipatrones prohibidos

- Un agente por tabla.
- Un agente por módulo.
- Un agente por función.
- Router innecesario.
- Multiagente por moda.
- Handoff sin cambio conversacional.
- Workers sin contrato.
- Contexto completo para todos.
- Síntesis por concatenación.
- Delegación ilimitada.
- Ciclos.
- Escrituras paralelas dependientes.
- Workflow sin persistencia.
- Agentes controlando procesos deterministas.
- Estado global duplicado.
- Implementar sin análisis.

---

# 47. Arquitectura técnica

```text
src/
  ai/
    orchestration/
      orchestration.types.ts
      orchestration.selector.ts
      orchestration.registry.ts
      workflow.runner.ts
      workflow.state-machine.ts
      workflow.repository.ts
      workflow.checkpoint.ts

      routing/
      delegation/
      workers/
      handoffs/
      approvals/
      events/
      synthesis/
      verification/
      budgets/
      observability/
      evals/
      tests/

      adapters/
        ecommerce/
        crm/
```

---

# 48. Fases de implementación

## Fase 0. Análisis exhaustivo

Analizar:

- Producto.
- Dominio.
- Casos de uso.
- Agentes.
- Tools.
- Eventos.
- Estados.
- Aprobaciones.
- Infraestructura.
- Colas.
- Jobs.
- Persistencia.
- Riesgos.
- Coste.
- Latencia.

Entregables:

- Diagnóstico.
- Mapa actual.
- Patrones propuestos.
- Justificación.
- Riesgos.
- Archivos.
- Plan.

No implementar todavía.

## Fase 1. Contratos

Crear tipos comunes.

## Fase 2. Workflow Runner

Implementar secuencial.

## Fase 3. Persistencia

Añadir estado y checkpoints.

## Fase 4. Routing

Añadir router simple.

## Fase 5. Paralelismo

Añadir lecturas paralelas.

## Fase 6. Human-in-the-loop

Añadir aprobaciones.

## Fase 7. Event-driven

Añadir eventos.

## Fase 8. Agent-as-tool

Solo si análisis lo justifica.

## Fase 9. Handoffs

Solo si existe cambio conversacional real.

## Fase 10. Orchestrator-workers

Solo si se demuestra necesidad.

## Fase 11. Evals y observabilidad

Medir.

---

# 49. Criterios de aceptación

- [ ] Se realizó análisis previo.
- [ ] Cada patrón está justificado.
- [ ] Existe propietario único del estado.
- [ ] Existen contratos.
- [ ] Existen presupuestos.
- [ ] Existen límites de delegación.
- [ ] Existen checkpoints.
- [ ] Existen aprobaciones.
- [ ] Existen verificaciones.
- [ ] Existen tests.
- [ ] Existe observabilidad.
- [ ] Existe multi-tenant.
- [ ] No hay ciclos.
- [ ] No hay agentes innecesarios.
- [ ] No hay handoffs innecesarios.
- [ ] No hay escrituras paralelas peligrosas.
- [ ] La arquitectura sirve para varios productos.
- [ ] El multiagente aporta valor medible.
- [ ] El workflow puede reanudarse.
- [ ] El resultado parcial se comunica.

---

# 50. Instrucciones directas para Codex

## Misión

Diseñar e integrar una arquitectura transversal de orquestación adaptada al producto real.

## Regla obligatoria

Antes de proponer patrones, debes analizar exhaustivamente:

- Repositorio.
- Producto.
- Dominio.
- Casos de uso.
- Agentes.
- Tools.
- Eventos.
- Estados.
- Aprobaciones.
- Riesgos.
- Infraestructura.
- Persistencia.
- Coste.
- Latencia.
- Multi-tenancy.

## Restricciones

1. No implementar antes del análisis.
2. No crear agentes innecesarios.
3. No crear handoffs sin necesidad.
4. No crear workers sin contrato.
5. No crear ciclos.
6. No delegar sin límites.
7. No duplicar estado global.
8. No usar IA para procesos deterministas.
9. No paralelizar escrituras dependientes.
10. No cruzar tenants.
11. No copiar una orquestación sin adaptarla.
12. No implementar multiagente primero.
13. Empezar por workflows simples.
14. Añadir persistencia.
15. Añadir tests.
16. Añadir observabilidad.
17. Documentar decisiones.
18. Medir valor real.
19. No marcar como terminado con tests fallando.
20. Mantener reanudación y cancelación.

---

# 51. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio y el producto para diseñar una
arquitectura de orquestación adaptada al sistema real.

No implementes todavía agentes nuevos, handoffs ni multiagente.

Objetivos:

1. Identificar todos los agentes existentes.
2. Identificar todas las tools.
3. Identificar todos los servicios deterministas.
4. Identificar todos los workflows.
5. Identificar todos los eventos.
6. Identificar todos los estados.
7. Identificar todas las aprobaciones.
8. Identificar jobs y colas.
9. Identificar persistencia y checkpoints.
10. Identificar riesgos.
11. Identificar procesos secuenciales.
12. Identificar procesos paralelizables.
13. Identificar procesos event-driven.
14. Identificar procesos human-in-the-loop.
15. Identificar casos donde un agente especialista aportaría valor.
16. Identificar casos donde basta una tool.
17. Identificar casos donde basta una función.
18. Proponer patrones:
    - sequential
    - routing
    - parallel
    - orchestrator_workers
    - agent_as_tool
    - handoff
    - evaluator_optimizer
    - voting
    - state_machine
    - event_driven
    - human_in_the_loop
    - hybrid
19. Justificar cada patrón.
20. Proponer contratos:
    - OrchestrationPlan
    - WorkflowNode
    - WorkflowEdge
    - WorkflowState
    - WorkflowBudget
    - DelegatedTask
    - WorkerResult
    - DomainEvent
21. Proponer arquitectura.
22. Proponer archivos.
23. Proponer fases.
24. Proponer tests.
25. Proponer evals.

Antes de modificar código, entrega:

a) diagnóstico completo,
b) mapa de producto,
c) mapa de casos de uso,
d) mapa de agentes,
e) mapa de tools,
f) mapa de workflows,
g) patrones propuestos,
h) justificación,
i) riesgos,
j) archivos exactos.

Restricciones:

- No inventes agentes.
- No inventes eventos.
- No inventes estados.
- No implementes todavía.
- No copies patrones sin adaptarlos.
- No introduzcas multiagente por defecto.
- No marques como terminado sin validación.
```

---

# 52. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de la
arquitectura de orquestación.

Implementa solo:

1. Contratos comunes.
2. Workflow Runner secuencial.
3. Workflow State.
4. Persistencia.
5. Checkpoints.
6. Un router determinista simple.
7. Un workflow real de lectura.
8. Verificación.
9. Observabilidad.
10. Tests.

No implementes:

- Handoffs.
- Multiagente.
- Orchestrator-workers.
- Voting.
- Escrituras críticas.
- Paralelismo de escritura.

Reutiliza el análisis previo y documenta cualquier desviación.
```

---

# 53. ADR recomendados

- ADR: análisis previo.
- ADR: workflow vs agente.
- ADR: selección de patrones.
- ADR: estado global.
- ADR: checkpoints.
- ADR: routing.
- ADR: paralelismo.
- ADR: delegación.
- ADR: handoffs.
- ADR: agent-as-tool.
- ADR: event-driven.
- ADR: human-in-the-loop.
- ADR: multiagente.
- ADR: presupuestos.
- ADR: observabilidad.
- ADR: adaptación por producto.

---

# 54. Definición de terminado

Una orquestación está terminada cuando:

1. Se analizó el producto.
2. Se justificó el patrón.
3. Se definió el propietario del estado.
4. Se definieron nodos.
5. Se definieron edges.
6. Se definieron contratos.
7. Se definieron presupuestos.
8. Se definieron permisos.
9. Se definieron aprobaciones.
10. Se definieron errores.
11. Se definieron reintentos.
12. Se definieron checkpoints.
13. Se definió la reanudación.
14. Se definió la cancelación.
15. Se definió la verificación.
16. Se definieron tests.
17. Se definieron evals.
18. Se definió observabilidad.
19. Se evitó complejidad innecesaria.
20. Se validó en el producto real.

---

# 55. Resumen ejecutivo

La secuencia correcta es:

```text
ANALIZAR
  ↓
SIMPLIFICAR
  ↓
SELECCIONAR PATRÓN
  ↓
DISEÑAR CONTRATOS
  ↓
IMPLEMENTAR
  ↓
VERIFICAR
  ↓
MEDIR
```

La arquitectura común debe proporcionar:

- Workflow Runner.
- State Store.
- Routing.
- Delegation.
- Budgets.
- Checkpoints.
- Verification.
- Observability.

Cada producto debe aportar:

- Casos de uso.
- Adaptadores.
- Eventos.
- Agentes.
- Tools.
- Políticas.
- Workflows concretos.

La buena orquestación no es la que tiene más agentes.

Es la que coordina correctamente el mínimo número de componentes necesarios.
