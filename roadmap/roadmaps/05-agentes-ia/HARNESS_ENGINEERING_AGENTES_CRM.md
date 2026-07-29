# Harness Engineering para agentes de IA en un CRM

## Estado del documento

- **Tipo:** especificación técnica y guía de implementación
- **Objetivo:** diseñar el entorno operativo que rodea a los agentes de IA del CRM
- **Audiencia:** Codex, equipo técnico, responsables de producto y seguridad
- **Idioma:** castellano
- **Prioridad:** alta
- **Principio rector:** el modelo propone; el sistema valida, autoriza, ejecuta y verifica

---

# 1. Propósito

Este documento define cómo implementar **Harness Engineering** en un CRM con agentes de IA capaces de:

- Consultar datos.
- Interpretar solicitudes humanas.
- Ejecutar acciones CRUD.
- Utilizar herramientas de dominio.
- Solicitar aprobaciones.
- Verificar resultados.
- Mantener estado.
- Recuperarse de errores.
- Generar trazabilidad completa.

El objetivo no es construir un simple chat conectado directamente a la base de datos.

El objetivo es construir un sistema agente fiable, controlado, auditable y seguro.

La arquitectura que debe evitarse es:

```text
Chat -> LLM -> Base de datos
```

La arquitectura objetivo es:

```text
Usuario
  |
  v
Autenticación y contexto de tenant
  |
  v
Intérprete de tarea
  |
  v
Constructor de contexto
  |
  v
Políticas, permisos y evaluación de riesgo
  |
  v
Bucle del agente
  |
  v
Herramientas de dominio
  |
  v
Servicios y base de datos
  |
  v
Verificación posterior
  |
  v
Auditoría, respuesta y evidencias
```

---

# 2. Definición de Harness Engineering

**Harness Engineering** es la disciplina de diseñar el sistema que rodea al modelo de IA y controla su funcionamiento.

El modelo es solamente una pieza.

El harness determina:

- Qué tarea debe realizarse.
- Qué contexto recibe el modelo.
- Qué herramientas puede utilizar.
- Qué acciones tiene prohibidas.
- Qué permisos deben comprobarse.
- Qué operaciones requieren aprobación humana.
- Cuántos pasos puede ejecutar.
- Cómo se controlan los reintentos.
- Cómo se conserva el estado.
- Cómo se verifica el resultado.
- Cómo se registran las decisiones.
- Cómo se detiene o recupera una ejecución.

Fórmula conceptual:

```text
Sistema agente = modelo + contexto + herramientas + bucle + estado
                 + permisos + validaciones + verificación
                 + observabilidad + recuperación
```

Un buen modelo con un harness deficiente genera un sistema poco fiable.

Un modelo razonable con un harness bien diseñado puede generar un producto estable y controlable.

---

# 3. Principios arquitectónicos

## 3.1 El modelo no es la autoridad final

El modelo puede:

- Interpretar lenguaje natural.
- Clasificar intenciones.
- Proponer planes.
- Seleccionar herramientas permitidas.
- Generar argumentos estructurados.
- Resumir resultados.
- Detectar ambigüedades.

El modelo no debe decidir por sí solo:

- Si el usuario tiene permisos.
- Si puede cruzar tenants.
- Si una operación financiera está autorizada.
- Si una fila puede eliminarse.
- Si una acción crítica requiere aprobación.
- Si una operación ya fue ejecutada.
- Si una regla jurídica o contable puede ignorarse.
- Si una transacción de base de datos es válida.

Estas decisiones deben implementarse mediante código determinista.

---

## 3.2 Separar razonamiento probabilístico y control determinista

### Adecuado para IA

- Interpretación de solicitudes ambiguas.
- Extracción de entidades desde lenguaje natural.
- Planificación.
- Selección razonada entre herramientas autorizadas.
- Redacción de mensajes.
- Resumen de información.
- Comparación de alternativas.

### Adecuado para código

- Autenticación.
- Autorización.
- Validación de esquemas.
- Comprobación de tenant.
- Reglas de negocio.
- Límites.
- Idempotencia.
- Transacciones.
- Cálculos.
- Integridad referencial.
- Registro de auditoría.
- Evaluación de riesgo basada en reglas.
- Requisitos de aprobación.

---

## 3.3 Mínimo privilegio

Cada agente y cada ejecución deben recibir únicamente:

- Los datos imprescindibles.
- Las herramientas necesarias.
- Los permisos correspondientes.
- El ámbito del tenant actual.
- El subconjunto de registros pertinente.

No debe existir una herramienta genérica de acceso ilimitado como:

```ts
executeSql(query: string)
```

Tampoco:

```ts
modifyAnyTable(table: string, payload: unknown)
```

En su lugar deben existir herramientas de dominio estrechas:

```ts
getLeadById()
searchLeads()
assignLead()
changeLeadStatus()
createReservation()
cancelReservation()
validateReservationPayment()
createTask()
completeTask()
```

---

## 3.4 Toda acción importante debe ser verificable

No debe considerarse completada una acción porque la herramienta devolvió `success: true`.

Después de una operación crítica se debe volver a consultar el estado real.

Ejemplo:

```text
1. Ejecutar assignLead().
2. Consultar getLeadById().
3. Confirmar assigned_to.
4. Confirmar tenant.
5. Confirmar updated_at.
6. Registrar evidencia.
7. Solo entonces declarar la tarea completada.
```

---

## 3.5 Cada ejecución debe ser trazable

Toda ejecución debe poder reconstruirse posteriormente.

Debe quedar registrado:

- Quién solicitó la acción.
- Desde qué empresa o tenant.
- Qué mensaje envió.
- Qué tarea interpretó el sistema.
- Qué contexto recibió el modelo.
- Qué versión de prompt se utilizó.
- Qué modelo se utilizó.
- Qué herramientas estaban disponibles.
- Qué herramientas se ejecutaron.
- Qué argumentos se enviaron.
- Qué resultados devolvieron.
- Qué validaciones se aplicaron.
- Qué aprobaciones se solicitaron.
- Quién aprobó.
- Qué errores ocurrieron.
- Qué resultado final se verificó.

---

# 4. Alcance del harness

El harness debe cubrir como mínimo las siguientes capas:

1. Contrato de tarea.
2. Intérprete de intención.
3. Resolución de entidades.
4. Construcción de contexto.
5. Catálogo de herramientas.
6. Selección de herramientas.
7. Autorización.
8. Evaluación de riesgo.
9. Bucle de ejecución.
10. Estado de ejecución.
11. Idempotencia.
12. Aprobaciones humanas.
13. Validación de resultados.
14. Verificación posterior.
15. Auditoría.
16. Observabilidad.
17. Gestión de errores.
18. Recuperación.
19. Límites de coste y ejecución.
20. Evaluación de calidad.

---

# 5. Contrato de tarea

Antes de ejecutar herramientas, la petición del usuario debe convertirse en una estructura explícita.

Ejemplo de mensaje:

```text
Asigna los leads nuevos de Málaga entre los comerciales disponibles.
```

Contrato interno:

```ts
export type AssignLeadsTask = {
  type: "assign_leads";
  tenantId: string;
  requestedBy: string;
  filters: {
    location?: string;
    status?: string[];
    unassignedOnly: boolean;
    createdFrom?: string;
    createdTo?: string;
  };
  assignmentStrategy:
    | "round_robin"
    | "least_loaded"
    | "weighted_capacity"
    | "manual_preview";
  requirePreview: boolean;
};
```

Una tarea debe incluir:

- Tipo de intención.
- Actor.
- Tenant.
- Entidades afectadas.
- Filtros.
- Acción solicitada.
- Restricciones.
- Suposiciones.
- Ambigüedades.
- Nivel de riesgo.
- Necesidad de aprobación.
- Resultado esperado.

---

## 5.1 Estados de interpretación

El intérprete debe devolver uno de estos estados:

```ts
type TaskInterpretationStatus =
  | "ready"
  | "needs_clarification"
  | "needs_entity_resolution"
  | "not_supported"
  | "forbidden";
```

Ejemplo:

```ts
type ParsedTask<T> = {
  status: TaskInterpretationStatus;
  task?: T;
  missingFields?: string[];
  ambiguities?: Array<{
    field: string;
    options: unknown[];
  }>;
  confidence: number;
};
```

No se debe ejecutar una tarea crítica si:

- Faltan campos obligatorios.
- Hay dos entidades posibles.
- No se conoce el tenant.
- La confianza está por debajo del umbral.
- El usuario no tiene permiso.
- El efecto no puede determinarse.

---

# 6. Resolución de entidades

Las referencias humanas suelen ser ambiguas.

Ejemplos:

- “Juan”.
- “La reserva de Marta”.
- “El piso de Málaga”.
- “La oportunidad grande”.
- “La factura pendiente”.

Antes de ejecutar una acción deben resolverse identificadores canónicos:

```ts
type ResolvedEntity = {
  entityType: "lead" | "client" | "property" | "reservation" | "task";
  entityId: string;
  tenantId: string;
  displayName: string;
  confidence: number;
  matchedBy: "exact" | "email" | "phone" | "reference" | "semantic";
};
```

Reglas:

1. Priorizar identificadores únicos.
2. No seleccionar silenciosamente entre varios resultados equivalentes.
3. No cruzar tenants.
4. Mostrar una selección cuando existan varios candidatos.
5. Registrar el criterio de resolución.
6. No reutilizar identificadores obtenidos de una ejecución anterior sin volver a comprobar su validez.

---

# 7. Construcción del contexto

El contexto debe construirse dinámicamente para cada tarea.

No se debe cargar:

- Toda la base de datos.
- Todo el historial del usuario.
- Todos los documentos del tenant.
- Todos los esquemas SQL.
- Todos los prompts del sistema.
- Todas las herramientas.

Debe cargarse únicamente lo necesario.

---

## 7.1 Tipos de contexto

### Contexto de identidad

- `user_id`
- `company_id`
- rol
- permisos
- oficina
- equipo
- ámbito territorial

### Contexto de tarea

- intención
- entidades
- restricciones
- estado actual
- resultado esperado

### Contexto de dominio

- reglas de negocio aplicables
- estados permitidos
- transiciones válidas
- políticas internas
- procedimientos

### Contexto histórico

- acciones recientes relevantes
- comunicaciones necesarias
- errores previos relacionados
- aprobaciones existentes

### Contexto documental

- fragmentos relevantes obtenidos mediante RAG
- versión del documento
- fecha de vigencia
- fuente

---

## 7.2 Context builder

```ts
export interface ContextBuilder {
  build(input: {
    actor: AuthenticatedActor;
    task: AgentTask;
  }): Promise<AgentContext>;
}
```

Ejemplo:

```ts
export type AgentContext = {
  actor: {
    userId: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
  };
  task: AgentTask;
  entities: ResolvedEntity[];
  domainRules: DomainRule[];
  relevantData: unknown;
  retrievedKnowledge: RetrievedChunk[];
  previousSteps: AgentStep[];
};
```

---

## 7.3 Reglas de calidad del contexto

- Debe tener fuente.
- Debe estar actualizado.
- Debe pertenecer al tenant.
- Debe poder auditarse.
- Debe limitarse por necesidad.
- Debe separar hechos de inferencias.
- Debe incluir fechas cuando la vigencia sea importante.
- Debe descartar información duplicada o contradictoria.
- Debe priorizar datos estructurados frente a texto libre cuando exista una fuente canónica.

---

# 8. Catálogo de herramientas

Las herramientas deben representar capacidades reales del dominio.

Estructura recomendada:

```ts
export type AgentTool<TInput, TOutput> = {
  name: string;
  description: string;
  inputSchema: unknown;
  riskLevel: "read" | "low" | "medium" | "high" | "critical";
  requiredPermissions: string[];
  requiresApproval: boolean | ApprovalRule;
  execute: (
    input: TInput,
    executionContext: ToolExecutionContext
  ) => Promise<ToolResult<TOutput>>;
};
```

---

## 8.1 Categorías de herramientas

### Lectura

- `get_lead`
- `search_leads`
- `get_client`
- `get_property`
- `get_reservation`
- `get_payment_status`
- `get_task`
- `search_documents`

### Escritura de bajo riesgo

- `create_note`
- `create_task`
- `mark_notification_read`
- `update_non_sensitive_preference`

### Escritura de riesgo medio

- `assign_lead`
- `change_lead_status`
- `change_opportunity_status`
- `reschedule_visit`
- `upload_document_metadata`

### Escritura de alto riesgo

- `change_property_price`
- `create_reservation`
- `cancel_reservation`
- `validate_reservation_payment`
- `issue_invoice`
- `send_contract`
- `change_sensitive_document_status`

### Operaciones críticas

- `refund_payment`
- `delete_client`
- `delete_reservation`
- `change_company_permissions`
- `export_sensitive_data`
- `execute_legal_filing`

Las operaciones críticas deben requerir controles reforzados y, normalmente, aprobación humana.

---

## 8.2 Diseño de una herramienta

Ejemplo:

```ts
import { z } from "zod";

export const AssignLeadInputSchema = z.object({
  leadId: z.string().uuid(),
  assignedToUserId: z.string().uuid(),
  reason: z.string().min(3).max(500),
  idempotencyKey: z.string().min(8),
});

export type AssignLeadInput = z.infer<typeof AssignLeadInputSchema>;

export type AssignLeadOutput = {
  leadId: string;
  previousAssignedTo: string | null;
  assignedTo: string;
  updatedAt: string;
};

export const assignLeadTool: AgentTool<
  AssignLeadInput,
  AssignLeadOutput
> = {
  name: "assign_lead",
  description:
    "Asigna un lead no asignado a un usuario activo del mismo tenant.",
  inputSchema: AssignLeadInputSchema,
  riskLevel: "medium",
  requiredPermissions: ["leads.assign"],
  requiresApproval: false,

  async execute(input, ctx) {
    const parsed = AssignLeadInputSchema.parse(input);

    ctx.assertTenant();
    ctx.assertPermission("leads.assign");

    return ctx.services.leads.assign({
      ...parsed,
      actorId: ctx.actor.userId,
      tenantId: ctx.actor.tenantId,
    });
  },
};
```

---

## 8.3 Reglas para las herramientas

Cada herramienta debe:

- Tener un nombre inequívoco.
- Tener una descripción operativa.
- Tener esquema de entrada.
- Tener esquema de salida.
- Rechazar campos desconocidos cuando proceda.
- Comprobar permisos en backend.
- Comprobar tenant en backend.
- Utilizar servicios de dominio existentes.
- Ser idempotente cuando produzca efectos.
- Generar auditoría.
- Devolver errores estructurados.
- No ocultar efectos secundarios.
- Permitir verificación posterior.
- Tener tests.

---

# 9. Registro dinámico de herramientas

No todas las herramientas deben estar disponibles en todas las ejecuciones.

```ts
export interface ToolPolicy {
  getAllowedTools(input: {
    actor: AuthenticatedActor;
    task: AgentTask;
    risk: RiskAssessment;
  }): Promise<AgentTool<unknown, unknown>[]>;
}
```

Ejemplo:

```ts
const tools = allTools.filter((tool) => {
  return tool.requiredPermissions.every((permission) =>
    actor.permissions.includes(permission)
  );
});
```

Además del permiso, deben considerarse:

- Tipo de tarea.
- Estado de la entidad.
- Tenant.
- Entorno.
- Riesgo.
- Aprobaciones previas.
- Sensibilidad de datos.
- Política de la empresa.
- Límites del plan contratado, si afectan a funcionalidad y no a calidad de respuesta.

---

# 10. Permisos

Nunca confiar exclusivamente en el prompt para controlar permisos.

Incorrecto:

```text
No elimines clientes salvo que el usuario sea administrador.
```

Correcto:

```ts
authorizationService.assertCan({
  actor,
  action: "clients.delete",
  resource,
});
```

---

## 10.1 Capas de autorización

### Capa 1: autenticación

Comprobar que el usuario está autenticado.

### Capa 2: tenant

Comprobar que actor, herramienta y recurso pertenecen al mismo tenant.

### Capa 3: rol y permiso

Comprobar permisos granulares.

### Capa 4: propiedad o asignación

Comprobar si el usuario puede actuar sobre recursos propios, asignados o globales.

### Capa 5: estado del recurso

Ejemplo: una reserva cancelada no puede volver a cancelarse.

### Capa 6: riesgo

Determinar si la operación necesita aprobación.

### Capa 7: política empresarial

Aplicar reglas específicas por empresa.

---

## 10.2 Ejemplo de política

```ts
const permissionMatrix = {
  "leads.read": [
    "sales_agent",
    "sales_manager",
    "administration",
    "direction",
    "admin",
  ],
  "leads.assign": [
    "sales_manager",
    "direction",
    "admin",
  ],
  "reservations.cancel": [
    "administration",
    "direction",
    "admin",
  ],
  "payments.refund": [
    "direction",
    "admin",
  ],
};
```

No debe asumirse que el rol por sí solo basta. La autorización real debe considerar el recurso y el tenant.

---

# 11. Evaluación de riesgo

Cada tarea y cada herramienta deben tener un nivel de riesgo.

```ts
type RiskLevel =
  | "read_only"
  | "low"
  | "medium"
  | "high"
  | "critical";
```

Criterios:

- ¿Modifica datos?
- ¿Afecta a dinero?
- ¿Afecta a contratos?
- ¿Afecta a derechos de terceros?
- ¿Envía comunicaciones externas?
- ¿Elimina información?
- ¿Expone datos sensibles?
- ¿Es reversible?
- ¿Afecta a muchos registros?
- ¿Puede producir una obligación jurídica?

---

## 11.1 Ejemplo de motor de riesgo

```ts
export function assessRisk(action: PlannedAction): RiskAssessment {
  let score = 0;

  if (action.mutatesData) score += 20;
  if (action.affectsMoney) score += 30;
  if (action.affectsContract) score += 25;
  if (action.isBulkOperation) score += 20;
  if (!action.isReversible) score += 30;
  if (action.exposesSensitiveData) score += 40;

  return {
    score,
    level:
      score >= 80
        ? "critical"
        : score >= 55
          ? "high"
          : score >= 30
            ? "medium"
            : "low",
  };
}
```

La IA puede aportar señales, pero la clasificación final debe apoyarse en reglas deterministas.

---

# 12. Aprobación humana

Una acción debe requerir aprobación cuando:

- Implica devolución de dinero.
- Cancela una reserva.
- Elimina información.
- Modifica precios.
- Afecta a contratos.
- Envía comunicaciones sensibles.
- Produce efectos masivos.
- Tiene baja reversibilidad.
- La confianza es baja.
- Existen varias interpretaciones válidas.
- La política de empresa lo exige.

---

## 12.1 Contrato de aprobación

```ts
export type ApprovalRequest = {
  id: string;
  runId: string;
  tenantId: string;
  requestedBy: string;
  action: {
    toolName: string;
    arguments: unknown;
  };
  summary: string;
  impact: string;
  riskLevel: RiskLevel;
  expiresAt: string;
  status: "pending" | "approved" | "rejected" | "expired";
};
```

El usuario debe ver:

- Qué se va a hacer.
- Sobre qué registro.
- Qué datos se modificarán.
- Qué consecuencias puede tener.
- Si es reversible.
- Qué herramienta se ejecutará.
- Qué riesgos existen.

No basta un botón genérico de “Aceptar”.

---

# 13. Bucle de ejecución

El harness controla el ciclo:

```text
Observar -> decidir -> actuar -> observar resultado
-> verificar -> continuar o finalizar
```

Implementación conceptual:

```ts
for (let step = 0; step < maxSteps; step++) {
  const decision = await model.next({
    task,
    context,
    tools,
  });

  if (decision.type === "tool_call") {
    validateToolCall(decision);
    authorizeToolCall(decision);
    assessToolRisk(decision);

    if (requiresApproval(decision)) {
      return createApprovalRequest(decision);
    }

    const result = await executeTool(decision);
    recordStep(decision, result);
    context.add(result);

    continue;
  }

  if (decision.type === "final_answer") {
    const verification = await verifyCompletion({
      task,
      context,
      answer: decision.content,
    });

    if (!verification.passed) {
      context.add(verification.feedback);
      continue;
    }

    return decision.content;
  }
}
```

---

## 13.1 Límites obligatorios

Cada ejecución debe tener:

- Máximo de pasos.
- Tiempo máximo.
- Número máximo de reintentos.
- Límite de llamadas por herramienta.
- Límite de coste o tokens.
- Límite de registros afectados.
- Límite de acciones externas.
- Condiciones de detención.
- Condiciones de escalado.

Ejemplo:

```ts
type AgentRunLimits = {
  maxSteps: number;
  maxToolCalls: number;
  maxRetriesPerTool: number;
  maxDurationMs: number;
  maxAffectedRecords: number;
  maxExternalMessages: number;
};
```

---

# 14. Estado de ejecución

El estado debe persistirse fuera del contexto efímero del modelo.

```ts
export type AgentRunState = {
  runId: string;
  tenantId: string;
  actorId: string;
  status:
    | "created"
    | "interpreting"
    | "running"
    | "waiting_approval"
    | "verifying"
    | "completed"
    | "failed"
    | "cancelled";
  task: AgentTask;
  currentStep: number;
  completedSteps: AgentStep[];
  pendingActions: PlannedAction[];
  approvals: ApprovalRequest[];
  errors: AgentRunError[];
  createdAt: string;
  updatedAt: string;
};
```

El estado persistente evita:

- Repetición de operaciones.
- Pérdida de progreso.
- Duplicación de mensajes.
- Duplicación de pagos.
- Duplicación de reservas.
- Imposibilidad de reanudar.
- Falta de trazabilidad.

---

# 15. Idempotencia

Toda herramienta con efectos debe soportar idempotencia.

Ejemplo:

```ts
const idempotencyKey = `${runId}:${step}:${toolName}:${resourceId}`;
```

La capa de servicios debe comprobar si una operación con la misma clave ya fue ejecutada.

```ts
const previous = await idempotencyStore.find(idempotencyKey);

if (previous) {
  return previous.result;
}
```

Después:

```ts
await idempotencyStore.save({
  key: idempotencyKey,
  result,
  createdAt: new Date().toISOString(),
});
```

Casos especialmente importantes:

- Crear reservas.
- Validar pagos.
- Reembolsar dinero.
- Enviar correos.
- Crear facturas.
- Generar documentos.
- Actualizar estados críticos.
- Llamar a servicios externos.

---

# 16. Transacciones y consistencia

Las operaciones relacionadas deben ejecutarse de forma atómica cuando sea posible.

Ejemplo de cancelación de reserva:

```text
1. Validar permiso.
2. Comprobar estado actual.
3. Comprobar pagos.
4. Cancelar reserva.
5. Liberar inmueble.
6. Registrar motivo.
7. Crear evento.
8. Crear notificaciones.
9. Confirmar transacción.
```

Si falla una operación crítica, el sistema debe:

- Revertir la transacción.
- No dejar estados parciales.
- Registrar el error.
- Informar de qué no se ejecutó.
- Permitir reintento seguro.

Las notificaciones no críticas pueden ejecutarse después de confirmar la transacción principal, pero sus errores deben quedar registrados.

---

# 17. Verificación posterior

Cada herramienta de escritura debe definir cómo se verifica.

```ts
export interface ToolVerifier<TInput, TOutput> {
  verify(input: {
    toolInput: TInput;
    toolOutput: TOutput;
    context: ToolExecutionContext;
  }): Promise<VerificationResult>;
}
```

Ejemplo:

```ts
type VerificationResult = {
  passed: boolean;
  evidence: unknown;
  errors: string[];
};
```

---

## 17.1 Tipos de verificación

### Verificación estructural

- El resultado cumple el esquema.
- Están presentes los identificadores.
- Los valores tienen tipos correctos.

### Verificación de persistencia

- El cambio existe realmente en la base de datos.

### Verificación de negocio

- La transición de estado es válida.
- No se ha incumplido una invariante.

### Verificación de tenant

- Todos los recursos pertenecen al mismo tenant.

### Verificación de efectos externos

- El proveedor externo aceptó la petición.
- Existe identificador de entrega.
- El webhook posterior confirma la operación cuando proceda.

### Verificación de completitud

- Todos los objetivos de la tarea fueron cubiertos.
- No quedan pasos pendientes.

---

# 18. Invariantes de dominio

Las invariantes deben codificarse.

Ejemplos:

```ts
assertSameTenant(actor, resource);
assertLeadCanBeAssigned(lead);
assertAgentIsActive(agent);
assertPropertyCanBeReserved(property);
assertReservationCanBeCancelled(reservation);
assertPaymentCanBeRefunded(payment);
assertNoDuplicateAssignment(plan);
assertNoDuplicateReservation(property);
```

No deben depender de que el modelo “recuerde” una regla.

---

# 19. Errores estructurados

Las herramientas deben devolver errores clasificables.

```ts
export type ToolErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "PERMISSION_DENIED"
  | "TENANT_MISMATCH"
  | "RESOURCE_NOT_FOUND"
  | "AMBIGUOUS_RESOURCE"
  | "INVALID_STATE_TRANSITION"
  | "APPROVAL_REQUIRED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXTERNAL_SERVICE_ERROR"
  | "VERIFICATION_FAILED"
  | "INTERNAL_ERROR";
```

Ejemplo:

```ts
export type ToolError = {
  code: ToolErrorCode;
  message: string;
  retryable: boolean;
  details?: unknown;
};
```

El modelo no debe recibir excepciones técnicas sin filtrar.

---

# 20. Política de reintentos

No todos los errores deben reintentarse.

### Reintentables

- Timeout.
- Error temporal del proveedor.
- Rate limit con espera.
- Conflicto transitorio.
- Fallo de red.

### No reintentables

- Falta de permiso.
- Tenant incorrecto.
- Entidad inexistente.
- Estado inválido.
- Validación fallida.
- Aprobación rechazada.
- Ambigüedad no resuelta.

Ejemplo:

```ts
function shouldRetry(error: ToolError): boolean {
  return error.retryable;
}
```

Debe aplicarse backoff y límite máximo.

---

# 21. Auditoría

Debe existir un registro de alto nivel de cada ejecución.

Tablas sugeridas:

```text
agent_runs
agent_run_steps
agent_tool_calls
agent_approvals
agent_verifications
agent_errors
agent_prompt_versions
```

---

## 21.1 Tabla agent_runs

Campos mínimos:

```sql
id uuid primary key
company_id uuid not null
user_id uuid not null
conversation_id uuid null
status text not null
task_type text null
user_input text not null
model text not null
prompt_version text not null
started_at timestamptz not null
completed_at timestamptz null
duration_ms integer null
total_tokens integer null
estimated_cost numeric null
final_summary text null
error_code text null
metadata jsonb not null default '{}'::jsonb
```

---

## 21.2 Tabla agent_tool_calls

```sql
id uuid primary key
run_id uuid not null
step_number integer not null
tool_name text not null
risk_level text not null
input jsonb not null
output jsonb null
status text not null
idempotency_key text null
started_at timestamptz not null
completed_at timestamptz null
duration_ms integer null
error_code text null
metadata jsonb not null default '{}'::jsonb
```

No almacenar secretos ni datos sensibles sin necesidad.

---

## 21.3 Redacción de datos sensibles

Antes de registrar entradas o salidas:

- Eliminar tokens.
- Eliminar contraseñas.
- Eliminar claves API.
- Minimizar datos personales.
- Enmascarar datos bancarios.
- Aplicar políticas de retención.
- Separar logs técnicos y auditoría jurídica.

---

# 22. Observabilidad

El sistema debe medir:

- Número de ejecuciones.
- Tasa de éxito.
- Tasa de fallo.
- Tasa de abandono.
- Aprobaciones solicitadas.
- Aprobaciones rechazadas.
- Herramientas más utilizadas.
- Errores por herramienta.
- Duración media.
- Tokens por ejecución.
- Coste estimado.
- Reintentos.
- Verificaciones fallidas.
- Acciones revertidas.
- Incidentes por permisos.
- Incidentes por tenant.
- Satisfacción del usuario.
- Correcciones humanas posteriores.

---

## 22.1 Trazas

Cada paso debe relacionarse con:

```text
trace_id
run_id
span_id
parent_span_id
```

Flujo:

```text
agent_run
  ├── interpret_task
  ├── resolve_entities
  ├── build_context
  ├── model_call
  ├── tool_call
  ├── verify_tool_result
  ├── model_call
  └── final_verification
```

---

# 23. Recuperación y compensación

No todas las operaciones pueden revertirse automáticamente.

Deben clasificarse:

```ts
type Reversibility =
  | "fully_reversible"
  | "compensatable"
  | "partially_reversible"
  | "irreversible";
```

Ejemplos:

- Cambiar una asignación: reversible.
- Enviar un correo: no reversible.
- Cancelar una reserva: puede requerir compensación.
- Reembolsar dinero: difícilmente reversible.
- Eliminar un documento: depende de papelera y retención.

Para acciones compensables deben definirse acciones inversas:

```ts
type CompensationAction = {
  originalTool: string;
  compensationTool: string;
  conditions: string[];
};
```

---

# 24. Arquitectura propuesta

## 24.1 Módulos

```text
src/
  features/
    ai-agent/
      application/
        agent-runner.ts
        task-interpreter.ts
        context-builder.ts
        entity-resolver.ts
        completion-verifier.ts

      domain/
        agent-task.ts
        agent-state.ts
        agent-step.ts
        risk-assessment.ts
        approval.ts
        tool.ts

      infrastructure/
        model-client.ts
        agent-run.repository.ts
        trace.service.ts
        idempotency.repository.ts

      policies/
        tool-policy.ts
        authorization-policy.ts
        approval-policy.ts
        retry-policy.ts
        data-access-policy.ts

      tools/
        leads/
        clients/
        properties/
        opportunities/
        reservations/
        payments/
        tasks/
        documents/
        notifications/

      verifiers/
        lead-assignment.verifier.ts
        reservation.verifier.ts
        payment.verifier.ts

      prompts/
        system/
        task-interpreter/
        planner/
        response/

      tests/
        unit/
        integration/
        security/
        evals/
```

Adaptar esta estructura al repositorio real. No imponerla si ya existe una arquitectura equivalente.

---

# 25. Runner del agente

Ejemplo simplificado:

```ts
export async function runAgent(input: {
  message: string;
  actor: AuthenticatedActor;
  conversationId?: string;
}): Promise<AgentRunResponse> {
  const run = await runRepository.create({
    actorId: input.actor.userId,
    tenantId: input.actor.tenantId,
    userInput: input.message,
    status: "created",
  });

  try {
    await runRepository.updateStatus(run.id, "interpreting");

    const interpretation = await taskInterpreter.parse({
      message: input.message,
      actor: input.actor,
    });

    if (interpretation.status !== "ready") {
      return handleNonReadyInterpretation(run, interpretation);
    }

    const task = interpretation.task;

    const entities = await entityResolver.resolve({
      actor: input.actor,
      task,
    });

    const context = await contextBuilder.build({
      actor: input.actor,
      task,
      entities,
    });

    const risk = riskService.assessTask(task);

    const tools = await toolPolicy.getAllowedTools({
      actor: input.actor,
      task,
      risk,
    });

    await runRepository.updateStatus(run.id, "running");

    for (let stepNumber = 1; stepNumber <= 12; stepNumber++) {
      const decision = await modelClient.next({
        task,
        context,
        tools,
      });

      if (decision.type === "tool_call") {
        const tool = toolRegistry.get(decision.toolName);

        tool.inputSchema.parse(decision.arguments);

        await authorizationPolicy.assertAllowed({
          actor: input.actor,
          task,
          tool,
          arguments: decision.arguments,
        });

        const actionRisk = riskService.assessAction({
          tool,
          arguments: decision.arguments,
        });

        if (
          approvalPolicy.requiresApproval({
            actor: input.actor,
            task,
            tool,
            risk: actionRisk,
          })
        ) {
          const approval = await approvalService.create({
            runId: run.id,
            tool,
            arguments: decision.arguments,
            risk: actionRisk,
          });

          await runRepository.updateStatus(
            run.id,
            "waiting_approval"
          );

          return {
            status: "waiting_approval",
            runId: run.id,
            approval,
          };
        }

        const idempotencyKey =
          `${run.id}:${stepNumber}:${tool.name}`;

        const result = await toolExecutor.execute({
          tool,
          arguments: {
            ...decision.arguments,
            idempotencyKey,
          },
          actor: input.actor,
          runId: run.id,
          stepNumber,
        });

        const verification = await verifierRegistry.verify({
          tool,
          arguments: decision.arguments,
          result,
          actor: input.actor,
        });

        await runRepository.recordStep({
          runId: run.id,
          stepNumber,
          decision,
          result,
          verification,
        });

        if (!verification.passed) {
          context.add({
            type: "verification_failure",
            content: verification,
          });
        } else {
          context.add({
            type: "tool_result",
            content: result,
          });
        }

        continue;
      }

      if (decision.type === "final_answer") {
        await runRepository.updateStatus(run.id, "verifying");

        const completion = await completionVerifier.verify({
          task,
          context,
          answer: decision.content,
        });

        if (!completion.passed) {
          context.add({
            type: "completion_feedback",
            content: completion,
          });
          continue;
        }

        await runRepository.complete({
          runId: run.id,
          finalSummary: decision.content,
        });

        return {
          status: "completed",
          runId: run.id,
          answer: decision.content,
          evidence: completion.evidence,
        };
      }
    }

    throw new AgentRunError(
      "MAX_STEPS_EXCEEDED",
      "La ejecución superó el número máximo de pasos."
    );
  } catch (error) {
    await runRepository.fail({
      runId: run.id,
      error,
    });

    throw error;
  }
}
```

---

# 26. Ejemplo completo: cancelar una reserva y devolver dinero

Petición:

```text
Cancela la reserva de Juan y devuelve el dinero.
```

Esta petición no debe ejecutarse directamente.

---

## 26.1 Datos necesarios

- Identidad exacta de Juan.
- Reserva concreta.
- Tenant.
- Inmueble.
- Estado actual de la reserva.
- Pagos asociados.
- Importe pagado.
- Método de pago.
- Condiciones contractuales.
- Política de cancelación.
- Motivo.
- Usuario solicitante.
- Permisos.
- Autorizador.
- Estado contable.
- Posibles penalizaciones.
- Reversibilidad.

---

## 26.2 Herramientas

```text
search_clients
search_reservations
get_reservation
get_reservation_payments
get_contract_terms
calculate_refund
create_cancellation_preview
cancel_reservation
release_property
create_refund_request
execute_refund
create_accounting_event
send_cancellation_notification
verify_reservation_cancelled
verify_refund_status
```

---

## 26.3 Flujo correcto

```text
1. Resolver cliente.
2. Resolver reserva.
3. Comprobar tenant.
4. Comprobar permiso.
5. Consultar estado.
6. Consultar pagos.
7. Consultar condiciones.
8. Calcular devolución.
9. Generar preview.
10. Solicitar aprobación.
11. Cancelar transaccionalmente.
12. Liberar inmueble.
13. Solicitar o ejecutar devolución.
14. Registrar evento contable.
15. Verificar cancelación.
16. Verificar devolución.
17. Enviar comunicación.
18. Registrar auditoría.
19. Informar del resultado real.
```

---

## 26.4 Lo que nunca debe hacer el modelo

- Elegir silenciosamente entre varios Juan.
- Inventar el importe.
- Suponer que todo pago es reembolsable.
- Ignorar una penalización.
- Ejecutar sin permiso.
- Ejecutar dos veces por un reintento.
- Declarar que el dinero fue devuelto sin confirmación.
- Ocultar un fallo parcial.
- Enviar una comunicación antes de confirmar la cancelación.

---

# 27. Ejemplo completo: reparto de leads

Petición:

```text
Asigna los leads nuevos de Málaga entre los comerciales disponibles.
```

---

## 27.1 Definiciones que deben ser canónicas

### Lead nuevo

Ejemplo:

```text
status = "new"
assigned_to IS NULL
deleted_at IS NULL
```

### Málaga

Debe resolverse mediante:

- Provincia.
- Municipio.
- Desarrollo.
- Oficina.
- Etiqueta canónica.

No mediante coincidencia textual no controlada si existe un campo estructurado.

### Comercial disponible

Debe definirse mediante reglas:

- Usuario activo.
- Rol comercial.
- No ausente.
- Capacidad no agotada.
- Pertenece al equipo correcto.
- Puede recibir leads del ámbito correspondiente.

---

## 27.2 Estrategias posibles

- Round robin.
- Menor carga.
- Capacidad ponderada.
- Especialización.
- Idioma.
- Zona.
- Promoción.
- Reparto manual mediante preview.

La estrategia debe ser explícita y auditable.

---

## 27.3 Invariantes

```ts
assertAllLeadsUnassigned(leads);
assertAllLeadsSameTenant(leads, actor.tenantId);
assertAllAgentsActive(agents);
assertAllAgentsSameTenant(agents, actor.tenantId);
assertNoLeadAssignedTwice(plan);
assertCapacityLimits(plan);
```

---

# 28. Seguridad multi-tenant

Este punto es crítico.

Toda consulta debe estar limitada por `company_id` o el identificador equivalente.

Nunca confiar únicamente en que el modelo incluya el tenant correcto.

Debe aplicarse:

- RLS en base de datos cuando sea posible.
- Filtros por tenant en servicios.
- Verificación de tenant antes de ejecutar.
- Verificación posterior.
- Tests de aislamiento.
- Auditoría de intentos de cruce.

Ejemplo:

```ts
if (resource.companyId !== actor.companyId) {
  throw new ToolError({
    code: "TENANT_MISMATCH",
    message: "El recurso no pertenece al tenant actual.",
    retryable: false,
  });
}
```

---

# 29. Integración con RAG

RAG aporta conocimiento; no sustituye herramientas.

Usar RAG para:

- Procedimientos.
- Manuales.
- Políticas.
- Contratos.
- Documentación interna.
- Preguntas frecuentes.
- Normativa.
- Información no estructurada.

Usar herramientas para:

- Consultar registros vivos.
- Crear o modificar datos.
- Ejecutar procesos.
- Validar estados.
- Aplicar reglas.
- Obtener información transaccional.

Arquitectura:

```text
Consulta del usuario
  |
  +--> ¿Necesita conocimiento? -> RAG
  |
  +--> ¿Necesita datos vivos? -> Tools
  |
  +--> ¿Necesita actuar? -> Tools + permisos + verificación
```

No es obligatorio crear un agente independiente para decidir entre RAG y herramientas.

Puede implementarse inicialmente mediante:

- Clasificador estructurado.
- Router determinista.
- Una llamada de modelo con salida tipada.
- Reglas por intención.

---

# 30. Versionado de prompts

Los prompts deben versionarse.

```ts
type PromptVersion = {
  name: string;
  version: string;
  contentHash: string;
  createdAt: string;
  status: "draft" | "active" | "deprecated";
};
```

Cada ejecución debe registrar:

- Nombre.
- Versión.
- Hash.
- Modelo.
- Parámetros relevantes.

No editar prompts de producción sin:

- Revisión.
- Tests.
- Evals.
- Despliegue controlado.
- Posibilidad de rollback.

---

# 31. Testing

## 31.1 Tests unitarios

- Validadores.
- Permisos.
- Evaluación de riesgo.
- Política de aprobación.
- Idempotencia.
- Selección de herramientas.
- Transiciones de estado.
- Verificadores.

## 31.2 Tests de integración

- Agente con servicios reales de prueba.
- Escritura y consulta posterior.
- Transacciones.
- Fallos de proveedor.
- Reintentos.
- Aprobaciones.
- Recuperación.

## 31.3 Tests de seguridad

- Cruce de tenants.
- Escalada de privilegios.
- Herramientas no autorizadas.
- Manipulación de argumentos.
- Prompt injection.
- Exfiltración de datos.
- Acceso a documentos sensibles.
- Reutilización de aprobaciones.
- Repetición de idempotency keys.

## 31.4 Evals

- Interpretación correcta.
- Selección correcta de herramientas.
- Número de pasos.
- Tasa de éxito.
- Tasa de acciones innecesarias.
- Tasa de falsos completados.
- Tasa de aclaraciones innecesarias.
- Cumplimiento de políticas.
- Corrección de la respuesta final.

---

# 32. Criterios de aceptación del harness

El harness no se considerará terminado hasta que:

- [ ] Ningún agente pueda acceder directamente a SQL arbitrario.
- [ ] Todas las herramientas tengan esquemas de entrada y salida.
- [ ] Todas las escrituras validen permisos.
- [ ] Todas las escrituras validen tenant.
- [ ] Las operaciones críticas requieran aprobación.
- [ ] Las operaciones con efectos sean idempotentes.
- [ ] Exista estado persistente de ejecución.
- [ ] Exista límite de pasos.
- [ ] Exista límite de reintentos.
- [ ] Exista registro de llamadas a herramientas.
- [ ] Exista verificación posterior para escrituras.
- [ ] Existan errores estructurados.
- [ ] Existan tests de aislamiento multi-tenant.
- [ ] Existan métricas de éxito, error y duración.
- [ ] Los prompts estén versionados.
- [ ] Las acciones críticas puedan auditarse.
- [ ] Los logs oculten secretos.
- [ ] El agente no declare éxito sin evidencia.
- [ ] Los fallos parciales se comuniquen explícitamente.
- [ ] Exista una estrategia de recuperación o compensación.

---

# 33. Fases de implementación

## Fase 0. Auditoría del repositorio

Objetivo:

- Entender la arquitectura real.
- Identificar servicios existentes.
- Identificar CRUDs.
- Identificar roles y permisos.
- Identificar tablas.
- Identificar funciones SQL.
- Identificar eventos y auditoría.
- Identificar el chat existente.
- Identificar cualquier integración de IA.

Entregables:

- Mapa del flujo actual.
- Inventario de capacidades.
- Riesgos.
- Puntos de integración.
- Diferencias entre arquitectura actual y objetivo.

No modificar código todavía.

---

## Fase 1. Contratos base

Crear:

- `AgentTask`
- `AgentRun`
- `AgentStep`
- `AgentTool`
- `ToolResult`
- `ToolError`
- `RiskAssessment`
- `ApprovalRequest`
- `VerificationResult`

Añadir esquemas Zod o equivalente.

---

## Fase 2. Persistencia y trazabilidad

Crear o adaptar:

- `agent_runs`
- `agent_run_steps`
- `agent_tool_calls`
- `agent_approvals`
- `agent_verifications`
- `agent_errors`

Aplicar RLS y aislamiento por tenant.

---

## Fase 3. Tool registry

Implementar:

- Registro central.
- Metadatos.
- Esquemas.
- Permisos.
- Riesgo.
- Aprobación.
- Ejecución.
- Verificación.

Empezar solo con herramientas de lectura.

---

## Fase 4. Herramientas de lectura

Implementar primero:

- Leads.
- Clientes.
- Inmuebles.
- Oportunidades.
- Reservas.
- Tareas.
- Documentos no sensibles.

Validar aislamiento y calidad de contexto.

---

## Fase 5. Escrituras de bajo riesgo

Añadir:

- Crear nota.
- Crear tarea.
- Actualizar preferencia no sensible.
- Marcar notificación.

Añadir idempotencia y verificación.

---

## Fase 6. Escrituras de riesgo medio

Añadir:

- Asignar lead.
- Cambiar estado.
- Reprogramar visita.
- Actualizar oportunidad.

Añadir preview cuando afecte a múltiples registros.

---

## Fase 7. Aprobaciones

Implementar:

- Solicitud.
- Vista de impacto.
- Aprobación.
- Rechazo.
- Caducidad.
- Reanudación del run.
- Registro de autorizador.

---

## Fase 8. Operaciones críticas

Solo después de estabilizar lo anterior:

- Cancelaciones.
- Pagos.
- Reembolsos.
- Contratos.
- Facturación.
- Exportación sensible.

---

## Fase 9. Observabilidad y evals

Añadir:

- Dashboards.
- Trazas.
- Métricas.
- Dataset de pruebas.
- Pruebas adversariales.
- Alertas.
- Revisión de fallos.

---

# 34. Instrucciones concretas para Codex

## Misión

Analiza el repositorio real e implementa progresivamente el harness del agente siguiendo esta especificación.

## Restricciones

1. No inventes tablas, columnas, funciones, roles ni servicios.
2. Primero inspecciona el código y la base de datos existente.
3. Reutiliza los servicios de dominio actuales.
4. No conectes el modelo directamente a SQL.
5. No expongas herramientas genéricas de acceso total.
6. Mantén el aislamiento multi-tenant.
7. No sustituyas permisos reales por instrucciones de prompt.
8. No implementes operaciones críticas en la primera iteración.
9. No reescribas módulos completos sin necesidad.
10. Presenta cambios pequeños, revisables y testeables.
11. Añade tests con cada capacidad.
12. Documenta decisiones y riesgos.
13. No reduzcas la calidad del agente según el plan comercial.
14. Separa capacidades configurables de la calidad de razonamiento.
15. No uses RAG para ejecutar CRUD.
16. No uses herramientas CRUD como fuente documental.
17. No declares una fase terminada sin criterios verificables.
18. Preserva el chat existente salvo que exista una razón arquitectónica documentada.
19. No crees múltiples agentes si un router o servicio determinista basta.
20. No introduzcas abstracciones sin un caso de uso real.

---

## Proceso obligatorio

### Paso 1. Inspección

Analiza:

- Estructura del proyecto.
- Stack.
- Módulos de IA.
- Chat actual.
- Servicios CRUD.
- Esquema de base de datos.
- RLS.
- Roles.
- Permisos.
- Auditoría.
- Eventos.
- Notificaciones.
- Tests.
- Integraciones externas.

### Paso 2. Informe

Entrega:

- Estado actual.
- Riesgos.
- Deuda técnica.
- Componentes reutilizables.
- Componentes ausentes.
- Propuesta de estructura.
- Plan por fases.
- Archivos que se modificarían.

### Paso 3. Primera implementación

Implementa únicamente:

- Contratos base.
- Registro de herramientas.
- Una herramienta de lectura.
- Trazabilidad mínima.
- Tests.

### Paso 4. Validación

Ejecuta:

- Typecheck.
- Lint.
- Tests.
- Prueba de aislamiento.
- Prueba de error.
- Prueba de herramienta no autorizada.

### Paso 5. Documentación

Actualiza:

- ADR.
- Estado global.
- Riesgos.
- Evidencias.
- Roadmap.

---

# 35. Primera tarea recomendada para Codex

```text
Analiza el repositorio completo para diseñar la primera capa de Harness
Engineering del copiloto del CRM.

No implementes todavía acciones críticas ni herramientas de escritura.

Objetivos:

1. Identificar cómo funciona actualmente el chat y la integración con IA.
2. Identificar los servicios CRUD existentes y sus contratos.
3. Identificar roles, permisos, RLS y aislamiento multi-tenant.
4. Identificar los puntos donde el modelo podría acceder o actuar sin control.
5. Proponer los contratos TypeScript para:
   - AgentTask
   - AgentRun
   - AgentStep
   - AgentTool
   - ToolResult
   - ToolError
   - RiskAssessment
   - ApprovalRequest
   - VerificationResult
6. Diseñar un Tool Registry central.
7. Implementar una única herramienta de lectura de bajo riesgo reutilizando
   un servicio existente del dominio.
8. Registrar cada ejecución y llamada de herramienta.
9. Añadir tests unitarios y de aislamiento.
10. Documentar lo realizado y lo pendiente.

Restricciones:

- No inventes columnas ni funciones.
- No conectes el LLM directamente a SQL.
- No expongas una herramienta SQL genérica.
- No cambies el comportamiento actual del CRM fuera del módulo de IA.
- No implementes todavía herramientas de escritura.
- No crees múltiples agentes salvo necesidad demostrada.
- No uses RAG para operaciones CRUD.
- No marques el trabajo como completado si typecheck, lint o tests fallan.

Antes de modificar, entrega un diagnóstico del repositorio y la lista exacta
de archivos que propones crear o modificar.
```

---

# 36. Decisiones que deben documentarse mediante ADR

Crear ADR para decisiones como:

- Arquitectura del runner.
- Tool registry.
- Estrategia de aislamiento multi-tenant.
- Política de aprobaciones.
- Persistencia de estado.
- Idempotencia.
- Separación RAG/tools.
- Versionado de prompts.
- Política de reintentos.
- Modelo de auditoría.
- Estrategia de compensación.
- Router único frente a múltiples agentes.

---

# 37. Antipatrones

## Antipatrón 1: prompt gigante

Introducir todas las reglas del CRM en un prompt enorme.

Problemas:

- Contradicciones.
- Coste.
- Contexto desperdiciado.
- Reglas obsoletas.
- Difícil de probar.
- Sin garantías.

---

## Antipatrón 2: acceso SQL directo

Permitir al agente generar SQL libre.

Problemas:

- Riesgo de datos.
- Cruce de tenants.
- Cambios irreversibles.
- Difícil auditoría.
- Inyección.
- Dependencia del esquema.

---

## Antipatrón 3: una herramienta CRUD universal

```ts
crud({
  table,
  action,
  filters,
  data,
});
```

Problemas:

- Superficie de ataque enorme.
- Descripciones ambiguas.
- Permisos difíciles.
- Validaciones insuficientes.
- Auditoría pobre.

---

## Antipatrón 4: confiar en `success: true`

Una respuesta exitosa de una API no demuestra que el objetivo final se haya cumplido.

---

## Antipatrón 5: usar IA para permisos

Los permisos no son una decisión probabilística.

---

## Antipatrón 6: múltiples agentes innecesarios

No crear:

- Un agente router.
- Un agente CRUD.
- Un agente RAG.
- Un agente verificador.
- Un agente permisos.

si un servicio determinista o una única ejecución estructurada resuelve el caso.

Los agentes adicionales aumentan:

- Coste.
- Latencia.
- Complejidad.
- Superficie de error.
- Dificultad de depuración.

---

## Antipatrón 7: considerar la respuesta final como evidencia

La frase “he cancelado la reserva” no es evidencia.

La evidencia es:

- Estado consultado.
- Identificador.
- Marca temporal.
- Resultado de verificación.
- Evento registrado.
- Confirmación externa cuando proceda.

---

# 38. Definición de terminado

Una capacidad del agente está terminada cuando:

1. Tiene contrato de tarea.
2. Tiene herramientas estrechas.
3. Tiene esquema de entrada y salida.
4. Comprueba permisos.
5. Comprueba tenant.
6. Evalúa riesgo.
7. Solicita aprobación cuando corresponde.
8. Ejecuta con idempotencia.
9. Verifica el resultado.
10. Registra trazabilidad.
11. Tiene tests.
12. Tiene métricas.
13. Tiene estrategia de error.
14. Tiene estrategia de recuperación.
15. Está documentada.

---

# 39. Resumen ejecutivo

El harness es la infraestructura que convierte un modelo lingüístico en un agente operativo.

El modelo no debe controlar directamente:

- Seguridad.
- Permisos.
- Transacciones.
- Integridad.
- Dinero.
- Eliminaciones.
- Aprobaciones.
- Auditoría.

El modelo interpreta y propone.

El harness:

- Limita.
- Valida.
- Autoriza.
- Ejecuta.
- Verifica.
- Registra.
- Recupera.

La prioridad inicial no debe ser añadir muchas herramientas.

La prioridad debe ser crear una base segura y repetible que permita incorporar nuevas capacidades sin multiplicar el riesgo.

La arquitectura correcta no busca que el agente pueda hacer cualquier cosa.

Busca que pueda hacer exactamente las acciones autorizadas, con el contexto correcto, mediante herramientas seguras y con evidencia verificable.
