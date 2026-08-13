# Tool Design para plataformas SaaS con agentes de IA

> La fundación operativa y el catálogo priorizado de tools están definidos en [AI-00A — Fundación del Tool Layer](./fases/AI-00A-tool-layer-foundation.md). Este documento conserva los principios transversales; AI-00A fija el contrato de implementación y el orden con Meta, Klaviyo e Instagram.

## Estado del documento

- **Tipo:** especificación técnica transversal
- **Ámbito:** SaaS, CRM, plataformas de analítica, copilotos, agentes operativos y sistemas multi-tenant
- **Casos de referencia:** EcomScaling IA y CRM/SaaS inmobiliario
- **Objetivo:** diseñar una arquitectura de herramientas reutilizable entre productos, segura, tipada, auditable y verificable
- **Audiencia:** Codex, equipo técnico, arquitectura, producto, seguridad y responsables de IA
- **Prioridad:** crítica
- **Idioma:** castellano
- **Principio rector:** el modelo propone una capacidad; la plataforma valida, autoriza, ejecuta, verifica y audita

---

# 1. Propósito

Este documento define cómo implementar **Tool Design** en una plataforma SaaS con agentes de IA.

La solución debe servir para productos diferentes, entre ellos:

- Un SaaS para analizar y escalar tiendas de comercio electrónico.
- Un CRM/SaaS con copiloto y agentes capaces de consultar y modificar datos.
- Un sistema documental con RAG y acciones.
- Un producto multiempresa con agentes especialistas.
- Una plataforma de analítica con recomendaciones ejecutables.
- Un sistema con aprobaciones humanas y operaciones críticas.

La arquitectura no debe quedar acoplada a entidades concretas como:

- Campañas.
- Tiendas.
- Productos.
- Pedidos.
- Leads.
- Reservas.
- Inmuebles.
- Contratos.
- Facturas.

Esos conceptos pertenecen a los adaptadores de dominio.

La infraestructura común debe trabajar con conceptos transversales:

- Tool.
- Actor.
- Tenant.
- Permiso.
- Recurso.
- Acción.
- Riesgo.
- Aprobación.
- Idempotencia.
- Ejecución.
- Verificación.
- Auditoría.
- Resultado.
- Error.
- Compensación.

---

# 2. Definición

**Tool Design** es la disciplina de convertir capacidades de negocio en interfaces que un modelo pueda utilizar de forma controlada.

Una tool no es simplemente una función del backend expuesta al modelo.

Una tool debe ser:

- Comprensible para el modelo.
- Estrecha.
- Tipada.
- Autorizable.
- Segura.
- Idempotente cuando tenga efectos.
- Verificable.
- Auditable.
- Observable.
- Reutilizable.
- Versionable.

Fórmula conceptual:

```text
Tool fiable =
capacidad de negocio clara
+ entrada tipada
+ salida tipada
+ permisos
+ aislamiento por tenant
+ riesgo
+ aprobación
+ idempotencia
+ verificación
+ auditoría
```

---

# 3. Qué problema resuelve Tool Design

Sin una capa de Tool Design, el sistema tiende a caer en arquitecturas peligrosas:

```text
LLM -> CRUD genérico
LLM -> SQL
LLM -> API arbitraria
LLM -> función universal
```

Ejemplos incorrectos:

```ts
executeSql(query: string)
```

```ts
crud({
  table,
  operation,
  filters,
  payload
})
```

```ts
manageEntity({
  entity,
  action,
  data
})
```

Problemas:

- El modelo decide demasiado.
- Los permisos son difíciles de aplicar.
- Se pueden cruzar tenants.
- La validación es débil.
- La auditoría pierde semántica.
- Los errores son poco interpretables.
- Las acciones son difíciles de verificar.
- Se multiplica la superficie de ataque.
- El sistema depende del esquema interno.

La arquitectura objetivo debe ser:

```text
Usuario
  ↓
Modelo
  ↓
Tool call estructurada
  ↓
Validación
  ↓
Autorización
  ↓
Evaluación de riesgo
  ↓
Aprobación si procede
  ↓
Servicio de dominio
  ↓
Resultado estructurado
  ↓
Verificación
  ↓
Auditoría
  ↓
Modelo
```

---

# 4. Separación entre plataforma y dominio

## 4.1 Núcleo de plataforma

Debe ser común a todos los productos.

Componentes:

- `AgentTool`
- `ToolRegistry`
- `ToolPolicy`
- `ToolSelector`
- `ToolExecutor`
- `ToolVerifier`
- `ToolAudit`
- `ToolError`
- `ToolResult`
- `ApprovalPolicy`
- `IdempotencyService`
- `RiskService`
- `RetryPolicy`
- `ToolMetrics`

## 4.2 Adaptadores de dominio

Cada SaaS aporta sus tools concretas.

### EcomScaling IA

- `get_store_overview`
- `get_campaign_metrics`
- `get_product_margin`
- `get_inventory_status`
- `create_growth_recommendation`
- `pause_campaign`
- `create_experiment`

### CRM/SaaS

- `get_lead`
- `search_clients`
- `get_opportunity`
- `get_reservation`
- `search_documents`
- `create_task`
- `assign_lead`
- `change_opportunity_status`
- `cancel_reservation`

## 4.3 Regla

La plataforma común no debe conocer reglas específicas del dominio.

Incorrecto:

```ts
toolExecutor.cancelReservation(...)
```

Correcto:

```ts
toolExecutor.execute({
  toolName,
  input,
  runtime
})
```

La tool de dominio decide qué servicio empresarial utilizar.

---

# 5. Tool como contrato operativo

La tool es un contrato entre:

- Razonamiento probabilístico.
- Sistema determinista.
- Servicios de dominio.
- Seguridad.
- Auditoría.

Debe responder:

1. ¿Qué capacidad representa?
2. ¿Cuándo debe usarse?
3. ¿Cuándo no debe usarse?
4. ¿Qué argumentos requiere?
5. ¿Qué devuelve?
6. ¿Qué permisos exige?
7. ¿Qué riesgo tiene?
8. ¿Qué efectos produce?
9. ¿Es reversible?
10. ¿Cómo se verifica?
11. ¿Cómo se reintenta?
12. ¿Cómo se audita?

---

# 6. Contrato base `AgentTool`

```ts
export type RiskLevel =
  | "read_only"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ToolCategory =
  | "read"
  | "write"
  | "generate"
  | "external"
  | "bulk"
  | "transactional";

export type AgentTool<TInput, TOutput> = {
  name: string;
  title: string;
  description: string;
  version: string;

  productTypes: string[];
  domain: string;
  category: ToolCategory;
  toolGroup: string;

  inputSchema: Schema<TInput>;
  outputSchema: Schema<TOutput>;

  riskLevel: RiskLevel;
  requiredPermissions: string[];

  isReadOnly: boolean;
  isIdempotent: boolean;
  reversibility:
    | "fully_reversible"
    | "compensatable"
    | "partially_reversible"
    | "irreversible";

  requiresApproval: boolean | ApprovalPolicy;
  timeoutMs: number;
  retryPolicy: RetryPolicy;

  execute(
    input: TInput,
    runtime: ToolRuntimeContext
  ): Promise<ToolResult<TOutput>>;

  verify?(
    input: TInput,
    result: TOutput,
    runtime: ToolRuntimeContext
  ): Promise<VerificationResult>;
};
```

---

# 7. Naming

## 7.1 Convención

Usar:

```text
verbo_objeto
```

Ejemplos:

```text
get_campaign
search_campaigns
pause_campaign
resume_campaign

get_lead
search_clients
assign_lead
cancel_reservation
```

## 7.2 Nombres prohibidos

Evitar:

```text
process
handle
manage
execute
do_action
tool_1
run_business
```

## 7.3 Reglas

- Debe expresar una acción.
- Debe expresar el objeto.
- Debe evitar ambigüedad.
- Debe ser consistente.
- Debe permanecer estable entre versiones.

---

# 8. Descripción

La descripción guía al modelo.

Debe explicar:

- Qué hace.
- Qué no hace.
- Cuándo usarla.
- Qué modifica.
- Qué consecuencias tiene.
- Qué necesita.

Ejemplo de lectura:

```text
Obtiene las métricas verificadas de una campaña publicitaria
para un periodo concreto. No modifica la campaña. Utilizar
cuando se necesiten gasto, ingresos atribuidos, ROAS, CTR,
CPC, conversiones o comparación temporal.
```

Ejemplo de escritura:

```text
Pausa una campaña publicitaria activa. Esta acción impide
que la campaña continúe consumiendo presupuesto. Requiere
permiso campaigns.pause y puede exigir aprobación humana.
No utilizar para editar presupuesto ni eliminar la campaña.
```

Ejemplo CRM:

```text
Asigna un lead actualmente no asignado a un usuario activo
del mismo tenant. No reasigna leads ya trabajados sin una
política específica y una aprobación válida.
```

---

# 9. Entrada tipada

## 9.1 Ejemplo analítico

```ts
const GetCampaignMetricsInput = z.object({
  campaignId: z.string().uuid(),

  dateRange: z.object({
    from: z.string().date(),
    to: z.string().date(),
  }),

  comparison: z
    .enum([
      "none",
      "previous_period",
      "previous_year",
    ])
    .default("none"),
});
```

## 9.2 Ejemplo CRM

```ts
const AssignLeadInput = z.object({
  leadId: z.string().uuid(),
  assignedToUserId: z.string().uuid(),
  reason: z.string().min(3).max(500),
});
```

## 9.3 Reglas

- Campos obligatorios explícitos.
- Enumeraciones cerradas.
- Longitudes limitadas.
- Fechas inequívocas.
- Unidades explícitas.
- Monedas explícitas.
- Rechazo de campos desconocidos cuando proceda.
- Sin secretos.
- Sin permisos.
- Sin tenant generado por el modelo.

---

# 10. Datos que el modelo nunca debe controlar

No aceptar como argumentos del modelo:

- `tenantId`
- `companyId`
- `userId` autenticado
- roles
- permisos
- API keys
- tokens
- secretos
- conexiones
- credenciales
- `traceId`
- configuración de seguridad

Incorrecto:

```ts
const ToolInput = z.object({
  tenantId: z.string(),
  permissions: z.array(z.string()),
  resourceId: z.string()
});
```

Correcto:

```ts
tool.execute(modelInput, {
  actor: authenticatedActor,
  tenantId: authenticatedActor.tenantId,
  permissions: authenticatedActor.permissions,
});
```

---

# 11. Runtime seguro

```ts
export type ToolRuntimeContext = {
  actor: {
    userId: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
  };

  product: {
    productType: string;
    enabledModules: string[];
    capabilities: string[];
  };

  runId: string;
  traceId: string;
  stepNumber: number;

  idempotencyKey?: string;
  approvedActionId?: string;

  services: DomainServices;
  audit: AuditService;
  logger: Logger;
  metrics: MetricsService;
};
```

El runtime procede del backend.

---

# 12. Salida tipada

## 12.1 Ejemplo analítico

```ts
const CampaignMetricsOutput = z.object({
  campaignId: z.string(),
  currency: z.string(),
  spend: z.number(),
  attributedRevenue: z.number(),
  roas: z.number().nullable(),
  purchases: z.number(),
  ctr: z.number().nullable(),
  cpc: z.number().nullable(),

  period: z.object({
    from: z.string(),
    to: z.string(),
  }),

  fetchedAt: z.string(),
});
```

## 12.2 Ejemplo CRM

```ts
const AssignLeadOutput = z.object({
  leadId: z.string().uuid(),
  previousAssignedTo: z.string().uuid().nullable(),
  assignedTo: z.string().uuid(),
  updatedAt: z.string(),
});
```

## 12.3 Regla

No devolver texto libre si el sistema necesita utilizar el resultado.

---

# 13. Resultado para código y modelo

```ts
export type ToolResult<T> = {
  ok: boolean;
  raw?: T;
  modelView?: unknown;

  evidence?: ToolEvidence[];

  metadata: {
    sourceId?: string;
    fetchedAt: string;
    durationMs: number;
    truncated: boolean;
    cached: boolean;
  };

  error?: ToolError;
};
```

## 13.1 Ejemplo de resultado grande

```ts
{
  raw: fullOrders,
  modelView: {
    totalOrders: 20000,
    revenue: 1354000,
    averageOrderValue: 67.70,
    refundRate: 0.041,
    topProducts: [...]
  },
  metadata: {
    sourceId: "tool_result_482",
    truncated: true
  }
}
```

El modelo no debe recibir miles de filas si no las necesita.

---

# 14. Clasificación de tools

## 14.1 Lectura

Ejemplos:

```text
get_store
get_campaign_metrics
search_products
get_lead
get_reservation
search_documents
```

Características:

- No modifican estado.
- Menor riesgo.
- Sin aprobación en condiciones normales.
- Necesitan permisos.
- Necesitan aislamiento por tenant.

## 14.2 Escritura de bajo riesgo

Ejemplos:

```text
create_internal_note
create_task
mark_notification_read
```

## 14.3 Escritura de riesgo medio

Ejemplos:

```text
assign_lead
change_opportunity_status
reschedule_visit
create_recommendation
```

## 14.4 Alto riesgo

Ejemplos:

```text
pause_campaign
change_property_price
cancel_reservation
send_contract
```

## 14.5 Críticas

Ejemplos:

```text
refund_payment
delete_customer
change_user_permissions
export_sensitive_data
execute_legal_filing
```

---

# 15. Riesgo

## 15.1 Contrato

```ts
export type ToolRiskAssessment = {
  level: RiskLevel;
  score: number;

  affectsMoney: boolean;
  affectsContract: boolean;
  affectsThirdParty: boolean;
  mutatesData: boolean;
  isBulk: boolean;
  exposesSensitiveData: boolean;
  reversible: boolean;

  requiresApproval: boolean;
};
```

## 15.2 Factores

- Dinero.
- Contratos.
- Datos sensibles.
- Cambios masivos.
- Comunicación externa.
- Eliminación.
- Irreversibilidad.
- Derechos de terceros.
- Permisos.
- Dependencias externas.

---

# 16. Permisos

No usar prompts como mecanismo de autorización.

Incorrecto:

```text
Solo utiliza refund_payment si el usuario es administrador.
```

Correcto:

```ts
authorization.assertCan({
  actor: runtime.actor,
  permission: "payments.refund",
  resource,
});
```

## 16.1 Capas

1. Autenticación.
2. Tenant.
3. Rol.
4. Permiso.
5. Propiedad del recurso.
6. Estado.
7. Riesgo.
8. Política de empresa.
9. Aprobación.

---

# 17. Multi-tenant

Toda tool debe validar el ámbito.

```ts
if (resource.tenantId !== runtime.actor.tenantId) {
  throw new ToolExecutionError({
    code: "TENANT_MISMATCH",
    retryable: false,
  });
}
```

Medidas:

- RLS cuando sea posible.
- Filtros por tenant en servicios.
- Validación previa.
- Verificación posterior.
- Tests de aislamiento.
- Auditoría.

---

# 18. Aprobación humana

## 18.1 Contrato

```ts
export type ApprovalPolicy = {
  required: boolean;
  reasons: string[];
  expiresInSeconds: number;
  allowedApproverPermissions: string[];
};
```

## 18.2 Acción aprobable

```ts
export type ApprovalRequest = {
  id: string;
  runId: string;
  tenantId: string;

  toolName: string;
  toolVersion: string;
  normalizedArguments: unknown;
  argumentsHash: string;

  impact: unknown;
  riskLevel: RiskLevel;

  requestedBy: string;
  approvedBy?: string;

  status:
    | "pending"
    | "approved"
    | "rejected"
    | "expired";

  expiresAt: string;
};
```

## 18.3 Regla

Si cambian los argumentos tras la aprobación:

```text
la aprobación deja de ser válida
```

---

# 19. Preview y dry run

Las acciones importantes deben permitir previsualización.

```ts
createCampaignPausePreview({
  campaignIds
})
```

Resultado:

```json
{
  "wouldAffect": 18,
  "alreadyPaused": 2,
  "invalid": 1,
  "dailyBudgetAffected": 1450
}
```

Después:

```ts
executeCampaignPause({
  previewId: "preview_456",
  approvedActionId: "approval_789"
})
```

No recalcular silenciosamente una acción diferente.

---

# 20. Idempotencia

## 20.1 Obligatoria para

- Pagos.
- Facturas.
- Reservas.
- Correos.
- Notificaciones.
- Pedidos.
- Cambios de estado.
- Operaciones masivas.
- Integraciones externas.

## 20.2 Clave

```ts
const idempotencyKey =
  `${runId}:${stepNumber}:${toolName}:${resourceId}`;
```

## 20.3 Repositorio

```ts
const previous =
  await idempotencyRepository.find(idempotencyKey);

if (previous) {
  return previous.result;
}
```

---

# 21. Verificación

## 21.1 Contrato

```ts
export type VerificationResult = {
  passed: boolean;
  evidence: ToolEvidence[];
  errors: string[];
};
```

## 21.2 Tool verifier

```ts
export interface ToolVerifier<TInput, TOutput> {
  verify(input: {
    toolInput: TInput;
    toolOutput: TOutput;
    runtime: ToolRuntimeContext;
  }): Promise<VerificationResult>;
}
```

## 21.3 Ejemplo

```ts
const result =
  await pauseCampaignTool.execute(input, runtime);

const campaign =
  await campaignService.getById(input.campaignId);

const verification = {
  passed: campaign.status === "paused",
  evidence: [{
    resourceId: campaign.id,
    field: "status",
    actual: campaign.status
  }]
};
```

---

# 22. Errores estructurados

```ts
export type ToolErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "PERMISSION_DENIED"
  | "TENANT_MISMATCH"
  | "RESOURCE_NOT_FOUND"
  | "AMBIGUOUS_RESOURCE"
  | "INVALID_STATE"
  | "APPROVAL_REQUIRED"
  | "APPROVAL_EXPIRED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "EXTERNAL_SERVICE_ERROR"
  | "TIMEOUT"
  | "VERIFICATION_FAILED"
  | "INTERNAL_ERROR";
```

```ts
export type ToolError = {
  code: ToolErrorCode;
  message: string;
  retryable: boolean;
  details?: unknown;
};
```

---

# 23. Retry policy

```ts
export type RetryPolicy = {
  maxRetries: number;
  retryableCodes: ToolErrorCode[];
  backoff:
    | "none"
    | "linear"
    | "exponential";
};
```

## 23.1 Reintentables

- Timeout.
- Rate limit.
- Servicio temporalmente no disponible.
- Error de red.

## 23.2 No reintentables

- Falta de permiso.
- Tenant incorrecto.
- Estado inválido.
- Validación.
- Aprobación rechazada.
- Recurso inexistente.

---

# 24. Granularidad

## 24.1 Demasiado genérica

```ts
manageCampaign({
  action,
  payload
})
```

## 24.2 Demasiado fragmentada

```text
set_status
write_audit_row
update_timestamp
send_notification
```

## 24.3 Correcta

```ts
pauseCampaign({
  campaignId,
  reason
})
```

La tool representa una unidad de intención empresarial.

---

# 25. Tools y servicios de dominio

Arquitectura correcta:

```text
Modelo
  ↓
Tool
  ↓
Servicio de dominio
  ↓
Repositorio o API
```

Ejemplo:

```ts
async execute(input, runtime) {
  return runtime.services.campaigns.pause({
    campaignId: input.campaignId,
    reason: input.reason,
    actorId: runtime.actor.userId,
    tenantId: runtime.actor.tenantId,
  });
}
```

La lógica de negocio debe permanecer en servicios.

---

# 26. Tool Registry

```ts
export class ToolRegistry {
  private readonly tools =
    new Map<string, AgentTool<unknown, unknown>>();

  register(
    tool: AgentTool<unknown, unknown>
  ): void {
    this.tools.set(tool.name, tool);
  }

  get(
    name: string
  ): AgentTool<unknown, unknown> {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    return tool;
  }

  list(): AgentTool<unknown, unknown>[] {
    return [...this.tools.values()];
  }
}
```

---

# 27. Metadatos del Registry

```ts
export type ToolRegistration = {
  name: string;
  version: string;
  productTypes: string[];
  domain: string;
  toolGroup: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  requiredPermissions: string[];
  enabled: boolean;
};
```

---

# 28. Tool groups

Ejemplos transversales:

```text
analytics.read
analytics.write

stores.read
stores.write

campaigns.read
campaigns.write

leads.read
leads.write

reservations.read
reservations.write

documents.read
documents.write

payments.read
payments.write
```

---

# 29. Selección dinámica

```ts
export type ToolSelectionInput = {
  productType: string;
  taskType: string;
  actorPermissions: string[];
  riskLevel: RiskLevel;
  enabledModules: string[];
};
```

```ts
const tools =
  toolRegistry.getAllowed({
    productType,
    taskType,
    actorPermissions,
    riskLevel,
  });
```

No exponer todas las tools.

---

# 30. Tool Policy

```ts
export interface ToolPolicy {
  getAllowedTools(input: {
    actor: AuthenticatedActor;
    product: ProductContext;
    task: AgentTask;
    risk: RiskAssessment;
  }): Promise<AgentTool<unknown, unknown>[]>;
}
```

Debe considerar:

- Tenant.
- Producto.
- Módulo.
- Rol.
- Permiso.
- Tarea.
- Riesgo.
- Estado del recurso.
- Plan contratado.
- Política de empresa.

---

# 31. Planes comerciales y capacidades

Los planes pueden habilitar funcionalidades.

No deben degradar la calidad de razonamiento.

Ejemplo:

```ts
type ProductCapabilities = {
  canUseCampaignActions: boolean;
  canUseBulkOperations: boolean;
  canUseAdvancedReports: boolean;
};
```

No:

```ts
if (plan === "basic") {
  answerPoorly();
}
```

---

# 32. Bulk tools

## 32.1 Regla

No usar una llamada al modelo por registro.

Incorrecto:

```text
Modelo llama assign_lead 300 veces
```

Correcto:

```text
Modelo propone estrategia
  ↓
Código genera plan
  ↓
Preview
  ↓
Aprobación
  ↓
Bulk tool
  ↓
Verificación
```

## 32.2 Contrato

```ts
export type BulkToolInput = {
  planId: string;
  mode: "preview" | "execute";
  approvedActionId?: string;
};
```

## 32.3 Resultado

```ts
export type BulkToolOutput = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  failures: Array<{
    resourceId: string;
    code: string;
  }>;
};
```

---

# 33. Tools transaccionales

Ejemplos:

- Crear reserva.
- Cancelar reserva.
- Validar pago.
- Emitir factura.
- Ejecutar devolución.

Requisitos:

- Transacción.
- Invariantes.
- Idempotencia.
- Aprobación.
- Auditoría.
- Verificación.
- Compensación.

---

# 34. Compensación

```ts
export type CompensationDefinition = {
  toolName: string;
  compensationToolName: string;
  conditions: string[];
};
```

Ejemplo:

```text
Original:
cancel_reservation

Compensación:
restore_reservation
```

Solo si el dominio permite reversión segura.

---

# 35. Paralelismo

Puede ejecutarse en paralelo:

- Lecturas independientes.
- Métricas.
- Consultas no relacionadas.

No debe ejecutarse en paralelo:

- Escrituras sobre el mismo recurso.
- Acciones financieras.
- Transacciones.
- Operaciones dependientes.
- Cambios cuyo orden importe.

---

# 36. Diseño para EcomScaling IA

## 36.1 Tools de lectura

```text
get_store_overview
get_campaign_metrics
get_creative_performance
get_product_margin
get_inventory_status
get_customer_cohorts
get_attribution_settings
```

## 36.2 Tools de generación

```text
create_growth_recommendation
generate_experiment_plan
generate_creative_brief
```

## 36.3 Tools de escritura

```text
create_experiment
pause_campaign
resume_campaign
create_internal_task
```

## 36.4 Tools críticas

```text
change_campaign_budget
pause_campaigns_bulk
modify_tracking_configuration
```

---

# 37. Caso EcomScaling: campañas no rentables

Solicitud:

```text
Dime qué campañas están quemando dinero y qué harías.
```

Tools:

```text
get_store_financial_targets
get_campaign_metrics
get_product_margin
get_attribution_settings
```

Resultado:

```json
{
  "underperformingCampaigns": [
    {
      "campaignId": "campaign_14",
      "spend": 1200,
      "revenue": 780,
      "roas": 0.65,
      "breakEvenRoas": 1.72
    }
  ],
  "recommendations": [
    {
      "campaignId": "campaign_14",
      "action": "pause",
      "confidence": 0.93
    }
  ]
}
```

Para actuar:

```text
create_campaign_action_preview
pause_campaign
```

No mezclar análisis y ejecución irreversible en una única tool.

---

# 38. Diseño para CRM/SaaS

## 38.1 Lectura

```text
get_lead
search_clients
get_opportunity
get_reservation
get_payment_status
search_documents
search_tasks
```

## 38.2 Escritura

```text
create_task
assign_lead
change_lead_status
change_opportunity_status
reschedule_visit
```

## 38.3 Alto riesgo

```text
change_property_price
create_reservation
cancel_reservation
send_contract
```

## 38.4 Críticas

```text
refund_payment
delete_client
export_sensitive_data
change_user_permissions
```

---

# 39. Caso CRM: asignación masiva

Solicitud:

```text
Asigna los leads nuevos de Málaga entre los comerciales disponibles.
```

Tools de lectura:

```text
search_unassigned_leads
get_available_sales_agents
get_assignment_policy
```

Servicio determinista:

```text
generate_assignment_plan
```

Tools de ejecución:

```text
create_assignment_preview
execute_lead_assignment_plan
```

Verificación:

```text
verify_assignment_plan
```

---

# 40. Caso CRM: cancelar reserva

Solicitud:

```text
Cancela la reserva de Juan y devuelve el dinero.
```

Tools:

```text
search_clients
search_reservations
get_reservation
get_reservation_payments
get_contract_terms
calculate_refund
create_cancellation_preview
cancel_reservation
create_refund_request
verify_reservation_cancelled
verify_refund_status
```

No usar:

```text
manage_reservation
execute_payment_action
```

---

# 41. Tools y RAG

RAG y tools no son equivalentes.

```text
RAG = conocimiento
Tools = datos vivos y acciones
```

Ejemplo:

```text
RAG:
política de cancelación

Tool:
get_reservation_payments
```

El agente cruza ambos.

---

# 42. MCP

MCP puede usarse para exponer tools de forma estándar.

Eso no elimina la necesidad de buen diseño.

Una tool peligrosa sigue siendo peligrosa aunque use MCP.

Antes de exponer una tool mediante MCP:

- Definir intención.
- Tipar entrada y salida.
- Añadir permisos.
- Añadir tenant.
- Añadir riesgo.
- Añadir auditoría.
- Añadir verificación.
- Añadir tests.

---

# 43. Versionado

```ts
export type ToolVersion = {
  name: string;
  version: string;
  status:
    | "draft"
    | "active"
    | "deprecated";
  schemaHash: string;
  createdAt: string;
};
```

Registrar en cada ejecución:

- Tool.
- Versión.
- Esquema.
- Actor.
- Run.
- Resultado.

---

# 44. Deprecación

Una tool no debe eliminarse de golpe si existen:

- Runs pendientes.
- Aprobaciones.
- Automatizaciones.
- Integraciones.
- Historial.

Proceso:

1. Marcar `deprecated`.
2. Impedir nuevas selecciones.
3. Mantener ejecución de runs existentes.
4. Migrar consumidores.
5. Retirar.

---

# 45. Auditoría

Tablas sugeridas:

```text
tool_definitions
tool_executions
tool_approvals
tool_verifications
tool_errors
tool_versions
```

## 45.1 `tool_executions`

```sql
id uuid primary key
run_id uuid not null
tenant_id uuid not null
actor_id uuid not null
tool_name text not null
tool_version text not null
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

Aplicar redacción de datos sensibles.

---

# 46. Observabilidad

Métricas:

- Ejecuciones por tool.
- Tasa de éxito.
- Tasa de error.
- Latencia.
- Reintentos.
- Verificaciones fallidas.
- Aprobaciones.
- Denegaciones.
- Uso por tenant.
- Coste.
- Resultados truncados.
- Duplicados evitados.
- Incidentes multi-tenant.
- Herramientas no utilizadas.
- Tools seleccionadas incorrectamente.

---

# 47. Evals

Evaluar:

- Selección correcta.
- Argumentos correctos.
- Tool innecesaria.
- Tool peligrosa.
- Tool no autorizada.
- Uso correcto de lectura/escritura.
- Capacidad de pedir aclaración.
- Resultado estructurado.
- Verificación.
- Manejo de errores.
- Evitación de duplicados.
- Aprobación correcta.

---

# 48. Tests

## 48.1 Unitarios

- Entrada válida.
- Entrada inválida.
- Campos desconocidos.
- Salida válida.
- Salida inválida.
- Riesgo.
- Política de aprobación.
- Retry policy.
- Idempotencia.
- Verificación.

## 48.2 Integración

- Servicio de dominio.
- Base de datos.
- API externa.
- Auditoría.
- RLS.
- Resultados.
- Reintentos.
- Errores.

## 48.3 Seguridad

- Tenant mismatch.
- Escalada de permisos.
- Argumentos manipulados.
- Prompt injection.
- Reutilización de aprobación.
- Reutilización de idempotency key.
- Tool no autorizada.
- Exportación sensible.

---

# 49. Antipatrones prohibidos

- `execute_sql`
- CRUD universal.
- API arbitraria.
- Tenant como argumento.
- Permisos en prompt.
- Tool sin esquema.
- Tool sin verificación.
- Tool sin auditoría.
- Tool con efectos ocultos.
- Tool demasiado genérica.
- Tool por cada campo.
- Tool masiva sin preview.
- Acción crítica sin aprobación.
- Resultado gigante sin resumen.
- Todas las tools expuestas siempre.
- Una inferencia por cada fila.
- Lógica de negocio duplicada en tools.

---

# 50. Arquitectura propuesta

```text
src/
  ai/
    tools/
      tool.types.ts
      tool.registry.ts
      tool.policy.ts
      tool.selector.ts
      tool.executor.ts
      tool.verifier.ts
      tool.audit.ts
      tool.errors.ts
      tool.result.ts
      tool.risk.ts
      tool.retry.ts
      tool.idempotency.ts
      tool.approval.ts

      adapters/
        ecommerce/
        crm/

      groups/
      observability/
      evals/
      tests/
```

Adaptar al repositorio real.

---

# 51. Fases de implementación

## Fase 0. Auditoría

Analizar:

- Servicios de dominio.
- CRUDs.
- Funciones SQL.
- APIs externas.
- Roles.
- Permisos.
- RLS.
- Acciones existentes.
- Logs.
- Aprobaciones.
- Integraciones de IA.

No modificar todavía.

## Fase 1. Contratos comunes

Crear:

- `AgentTool`
- `ToolResult`
- `ToolError`
- `ToolRuntimeContext`
- `RiskLevel`
- `ApprovalPolicy`
- `RetryPolicy`
- `VerificationResult`

## Fase 2. Registry

Implementar registro y descubrimiento.

## Fase 3. Lectura

Implementar una única tool de lectura.

## Fase 4. Tool Policy

Selección por producto, permiso y tarea.

## Fase 5. Escritura de bajo riesgo

Añadir idempotencia y verificación.

## Fase 6. Aprobaciones

Añadir preview y reanudación.

## Fase 7. Bulk tools

Añadir ejecución por lotes.

## Fase 8. Transaccionales

Solo después de estabilizar lo anterior.

## Fase 9. Segundo producto

Reutilizar núcleo con nuevo adaptador.

## Fase 10. Evals y observabilidad

Medir calidad y seguridad.

---

# 52. Criterios de aceptación

- [ ] Existe `AgentTool` común.
- [ ] Existe Tool Registry.
- [ ] Existe Tool Policy.
- [ ] Cada tool tiene nombre inequívoco.
- [ ] Cada tool tiene descripción operativa.
- [ ] Cada tool tiene entrada tipada.
- [ ] Cada tool tiene salida tipada.
- [ ] El modelo no envía tenant.
- [ ] El modelo no envía permisos.
- [ ] Las tools usan servicios de dominio.
- [ ] Existe riesgo.
- [ ] Existe aprobación.
- [ ] Existe idempotencia.
- [ ] Existe verificación.
- [ ] Existen errores estructurados.
- [ ] Existe auditoría.
- [ ] Existen métricas.
- [ ] Existen tests.
- [ ] Las tools se seleccionan dinámicamente.
- [ ] La arquitectura sirve para varios productos.
- [ ] No existe acceso SQL genérico.

---

# 53. Instrucciones para Codex

## Misión

Diseñar una capa transversal de Tool Design reutilizable entre productos SaaS con agentes.

## Restricciones

1. No acoplar el núcleo a un dominio.
2. No inventar servicios ni columnas.
3. Analizar el repositorio real.
4. Reutilizar servicios de dominio.
5. No exponer SQL.
6. No crear CRUD universal.
7. No aceptar tenant desde el modelo.
8. No usar prompt como autorización.
9. No implementar tools críticas primero.
10. Empezar por lectura.
11. Añadir tests.
12. Añadir auditoría.
13. Añadir verificación.
14. Añadir idempotencia en escrituras.
15. Mantener aislamiento multi-tenant.
16. No exponer todas las tools.
17. No duplicar lógica de negocio.
18. No degradar calidad por plan comercial.
19. No marcar como terminado con tests fallando.
20. Documentar decisiones mediante ADR.

---

# 54. Primera tarea recomendada para Codex

```text
Analiza el repositorio para diseñar una capa transversal de Tool Design
reutilizable entre distintos productos SaaS con agentes.

La arquitectura debe poder servir tanto para un SaaS de analítica y escalado
de tiendas como para un CRM/SaaS operativo.

No implementes todavía herramientas de escritura ni operaciones críticas.

Objetivos:

1. Localizar los servicios de dominio existentes.
2. Localizar CRUDs, APIs externas y funciones SQL.
3. Identificar cómo se aplican tenant, roles, permisos y RLS.
4. Identificar si el agente accede actualmente a funciones genéricas.
5. Diseñar los contratos:
   - AgentTool
   - ToolResult
   - ToolError
   - ToolRuntimeContext
   - RiskLevel
   - ApprovalPolicy
   - RetryPolicy
   - VerificationResult
6. Diseñar:
   - Tool Registry
   - Tool Policy
   - Tool Selector
   - Tool Executor
   - Tool Verifier
   - Tool Audit
7. Implementar una única tool de lectura de bajo riesgo.
8. Reutilizar un servicio de dominio existente.
9. Añadir:
   - validación de entrada
   - validación de salida
   - tenant
   - permisos
   - auditoría
   - observabilidad mínima
10. Añadir tests:
    - entrada válida
    - entrada inválida
    - permiso denegado
    - tenant incorrecto
    - recurso inexistente
    - resultado estructurado
    - auditoría
11. Documentar cómo se añadiría un segundo adaptador de producto.
12. Proponer el catálogo inicial de tools sin implementarlas.

Antes de modificar código, entrega:

a) diagnóstico,
b) mapa de servicios,
c) riesgos,
d) arquitectura propuesta,
e) contratos,
f) archivos exactos que crearías o modificarías.

Restricciones:

- No inventes columnas ni servicios.
- No conectes el modelo directamente a SQL.
- No crees una tool CRUD universal.
- No implementes escrituras.
- No expongas todas las tools.
- No cambies el comportamiento actual fuera del módulo de IA.
- No marques el trabajo como completado si typecheck, lint o tests fallan.
```

---

# 55. ADR recomendados

- ADR: contrato `AgentTool`.
- ADR: Tool Registry.
- ADR: Tool Policy.
- ADR: separación tools/servicios.
- ADR: multi-tenant.
- ADR: idempotencia.
- ADR: aprobaciones.
- ADR: bulk tools.
- ADR: verificación.
- ADR: errores.
- ADR: versionado.
- ADR: MCP.
- ADR: observabilidad.

---

# 56. Definición de terminado

Una tool está terminada cuando:

1. Representa una capacidad de negocio.
2. Tiene responsabilidad única.
3. Tiene nombre claro.
4. Tiene descripción.
5. Tiene entrada tipada.
6. Tiene salida tipada.
7. Comprueba tenant.
8. Comprueba permisos.
9. Define riesgo.
10. Define aprobación.
11. Define idempotencia.
12. Define retry.
13. Define verificación.
14. Devuelve errores estructurados.
15. Genera auditoría.
16. Tiene métricas.
17. Tiene tests.
18. Está versionada.
19. No sobrecarga contexto.
20. Reutiliza servicios existentes.

---

# 57. Resumen ejecutivo

La arquitectura debe dividirse así:

```text
PLATAFORMA COMÚN
  Tool Registry
  Tool Policy
  Tool Executor
  Tool Verifier
  Tool Audit
  Risk
  Approval
  Idempotency

PRODUCTO
  Capacidades habilitadas
  Grupos de tools
  Configuración

DOMINIO
  Tools de e-commerce
  o
  Tools de CRM
```

La plataforma controla:

- Qué tool existe.
- Quién puede usarla.
- Cuándo se ejecuta.
- Cómo se valida.
- Cómo se verifica.
- Cómo se audita.

El modelo solamente propone la capacidad y los argumentos de negocio autorizados.
