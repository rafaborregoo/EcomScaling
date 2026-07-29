# Context Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica transversal
- **Ámbito:** productos SaaS, CRM, plataformas de analítica, copilotos y agentes operativos
- **Casos de referencia:** EcomScaling IA y CRM/SaaS inmobiliario
- **Objetivo:** construir una arquitectura de contexto reutilizable entre productos, sin acoplarla a un único dominio
- **Audiencia:** Codex, equipo técnico, arquitectura, producto, seguridad y responsables de IA
- **Prioridad:** crítica
- **Idioma:** castellano
- **Principio rector:** cada llamada al modelo debe recibir el contexto mínimo, autorizado, vigente y suficiente para tomar la siguiente decisión correcta

---

# 1. Propósito

Este documento define cómo implementar **Context Engineering** en una plataforma SaaS que utiliza agentes de IA.

La solución debe servir para productos diferentes, por ejemplo:

- Un SaaS que analiza y ayuda a escalar tiendas de comercio electrónico.
- Un CRM con copiloto y agentes capaces de consultar datos, crear tareas y ejecutar acciones.
- Una plataforma de analítica con recomendaciones.
- Un sistema documental con RAG.
- Un SaaS multiempresa con agentes especializados.
- Un producto con herramientas CRUD y aprobaciones humanas.

La arquitectura no debe quedar acoplada a:

- Leads.
- Reservas.
- Inmuebles.
- Shopify.
- Meta Ads.
- Campañas.
- Pedidos.
- Contratos.
- Facturas.

Esos conceptos pertenecen a los adaptadores de dominio.

La arquitectura común debe trabajar con conceptos transversales:

- Actor.
- Tenant.
- Tarea.
- Recurso.
- Fuente.
- Hecho.
- Evidencia.
- Política.
- Herramienta.
- Estado de ejecución.
- Memoria.
- Conocimiento.
- Presupuesto de contexto.
- Resultado esperado.

---

# 2. Definición

**Context Engineering** es la disciplina de diseñar qué información recibe un modelo en cada llamada, por qué la recibe, de qué fuente procede, con qué prioridad, en qué formato y durante cuánto tiempo permanece disponible.

No es únicamente escribir un buen prompt.

Incluye:

- Instrucciones del sistema.
- Identidad del usuario.
- Tenant.
- Rol.
- Permisos.
- Plan contratado y capacidades habilitadas.
- Petición actual.
- Tarea interpretada.
- Estado del loop.
- Datos vivos del producto.
- Resultados de herramientas.
- Documentos recuperados mediante RAG.
- Memoria.
- Políticas.
- Restricciones.
- Formato de salida.
- Límites de coste.
- Evidencias.
- Metadatos temporales.

Fórmula conceptual:

```text
Context Engineering =
identificar necesidades
+ recuperar fuentes
+ autorizar
+ filtrar
+ estructurar
+ priorizar
+ comprimir
+ entregar
+ actualizar
```

---

# 3. Objetivo real

El objetivo no es proporcionar al modelo toda la información disponible.

El objetivo es proporcionar:

```text
la información correcta
+ para la tarea correcta
+ en el momento correcto
+ en el formato correcto
+ dentro del ámbito autorizado
```

Un modelo con demasiado contexto puede rendir peor que con contexto reducido.

Problemas del exceso de contexto:

- Coste innecesario.
- Latencia.
- Contradicciones.
- Distracción.
- Datos obsoletos.
- Riesgo de filtración.
- Herramientas mal seleccionadas.
- Mayor dificultad de evaluación.
- Respuestas menos consistentes.

---

# 4. Arquitectura transversal

La arquitectura recomendada es:

```text
Solicitud del usuario
  ↓
Identidad autenticada
  ↓
Interpretación de tarea
  ↓
Resolución de recursos
  ↓
Definición de necesidades de contexto
  ↓
Selección de fuentes
  ↓
Autorización y aislamiento
  ↓
Recuperación
  ↓
Normalización
  ↓
Priorización
  ↓
Compresión
  ↓
Construcción del contexto
  ↓
Llamada al modelo
  ↓
Validación de salida
  ↓
Actualización del estado
```

---

# 5. Separación entre plataforma y dominio

## 5.1 Capa de plataforma

Debe ser reutilizable entre productos.

Responsabilidades:

- Identidad.
- Tenant.
- Sesión.
- Tareas.
- Context builder.
- Presupuesto.
- Ranking.
- Compresión.
- Redacción de datos.
- Versionado.
- Observabilidad.
- Políticas.
- Memoria.
- RAG.
- Catálogo de herramientas.
- Validación.

## 5.2 Capa de dominio

Depende de cada SaaS.

### Ejemplo EcomScaling IA

- Tienda.
- Campaña.
- Producto.
- Pedido.
- Creatividad.
- Métrica.
- Cliente.
- Canal.
- Fuente publicitaria.
- Recomendación.

### Ejemplo CRM

- Lead.
- Cliente.
- Propiedad.
- Oportunidad.
- Reserva.
- Pago.
- Contrato.
- Documento.
- Tarea.
- Notificación.

## 5.3 Regla

La plataforma no debe conocer semántica específica del dominio.

Incorrecto:

```ts
contextBuilder.loadReservationDocuments()
```

Correcto:

```ts
domainContextProvider.loadResources({
  resourceTypes: requirements.resourceTypes,
  resourceIds: requirements.resourceIds,
});
```

El adaptador del CRM puede implementar internamente:

```ts
loadReservationDocuments()
```

El adaptador de EcomScaling puede implementar:

```ts
loadCampaignMetrics()
```

---

# 6. Contratos comunes

## 6.1 Actor

```ts
export type AuthenticatedActor = {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  locale: string;
  timezone: string;
  capabilities: string[];
};
```

El actor debe proceder de la sesión autenticada.

Nunca del modelo.

---

## 6.2 Tarea

```ts
export type AgentTask = {
  id: string;
  type: string;
  objective: string;
  intent: "read" | "analyze" | "generate" | "act";
  resourceRefs: ResourceReference[];
  constraints: string[];
  expectedOutputType: string;
  riskLevel: "read_only" | "low" | "medium" | "high" | "critical";
};
```

---

## 6.3 Recurso

```ts
export type ResourceReference = {
  resourceType: string;
  resourceId: string;
  tenantId: string;
  displayName?: string;
};
```

Ejemplos:

```ts
{
  resourceType: "store",
  resourceId: "store_123"
}
```

```ts
{
  resourceType: "reservation",
  resourceId: "reservation_456"
}
```

---

## 6.4 Hecho

```ts
export type ContextFact = {
  id: string;
  key: string;
  value: unknown;
  source: ContextSourceReference;
  confidence: number;
  verified: boolean;
  observedAt: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};
```

---

## 6.5 Fuente

```ts
export type ContextSourceReference = {
  sourceType:
    | "database"
    | "tool_result"
    | "document"
    | "memory"
    | "user_message"
    | "external_api"
    | "inference";
  sourceId: string;
  version?: string;
  tenantId?: string;
};
```

---

## 6.6 Contexto final

```ts
export type ModelContext = {
  system: SystemContext;
  actor: ActorContext;
  task: TaskContext;
  resources: ResourceContext[];
  facts: ContextFact[];
  knowledge: KnowledgeContext[];
  execution: ExecutionContext;
  tools: ToolContext[];
  output: OutputContext;
  metadata: ContextMetadata;
};
```

---

# 7. Tipos de contexto

---

## 7.1 Contexto de sistema

Contiene reglas globales y estables:

- Rol.
- Principios.
- Límites.
- Uso de herramientas.
- Política de seguridad.
- Verificación.
- Tratamiento de fuentes.
- Formato.

Debe ser breve y versionado.

No debe contener toda la lógica de negocio.

---

## 7.2 Contexto de identidad

Incluye:

- Usuario.
- Tenant.
- Roles.
- Permisos.
- Capacidades.
- Idioma.
- Zona horaria.

Debe inyectarse desde backend.

---

## 7.3 Contexto de producto

Describe el producto SaaS en el que se ejecuta el agente:

```ts
export type ProductContext = {
  productId: string;
  productType: string;
  enabledModules: string[];
  enabledCapabilities: string[];
  configurationVersion: string;
};
```

Ejemplos:

```ts
{
  productType: "ecommerce_intelligence",
  enabledModules: [
    "shopify",
    "meta_ads",
    "analytics",
    "recommendations"
  ]
}
```

```ts
{
  productType: "real_estate_crm",
  enabledModules: [
    "leads",
    "reservations",
    "documents",
    "tasks"
  ]
}
```

---

## 7.4 Contexto de tarea

Debe definir:

- Objetivo.
- Intención.
- Recursos.
- Restricciones.
- Riesgo.
- Resultado esperado.
- Criterio de finalización.

Ejemplo transversal:

```ts
{
  objective: "Analizar el rendimiento y proponer acciones",
  intent: "analyze",
  resourceRefs: [
    {
      resourceType: "campaign",
      resourceId: "campaign_18"
    }
  ],
  constraints: [
    "No modificar datos",
    "Diferenciar hechos de recomendaciones"
  ],
  expectedOutputType: "actionable_analysis"
}
```

---

## 7.5 Contexto de datos vivos

Son datos actuales de servicios y base de datos.

Ejemplos EcomScaling:

- Ingresos.
- ROAS.
- CAC.
- CTR.
- Pedidos.
- Stock.
- Margen.
- Creatividades.
- Campañas.
- Cohortes.

Ejemplos CRM:

- Estados.
- Asignaciones.
- Pagos.
- Tareas.
- Reservas.
- Documentos.
- Oportunidades.
- Notificaciones.

Los datos vivos deben prevalecer sobre:

- Resúmenes.
- Memoria.
- Historial de chat.
- Inferencias.

---

## 7.6 Contexto documental

Se recupera mediante RAG.

Ejemplos:

- Playbooks.
- Procedimientos.
- Manuales.
- Políticas.
- Contratos.
- Guías.
- Documentación interna.
- Normativa.
- Briefs.
- Estrategia de marca.
- Conocimiento de producto.

Cada fragmento debe incluir:

- Fuente.
- Documento.
- Sección.
- Versión.
- Fecha.
- Tenant.
- Relevancia.

---

## 7.7 Contexto de memoria

La memoria puede contener:

- Preferencias persistentes.
- Decisiones.
- Resúmenes.
- Aprendizajes aprobados.
- Hechos estables.
- Configuración de la empresa.
- Objetivos estratégicos.

La memoria no debe tratarse como fuente canónica de datos vivos.

Ejemplo:

```text
Memoria:
La empresa prioriza margen frente a volumen.

Dato vivo:
El margen actual es 18,4 %.
```

Ambas piezas son útiles, pero cumplen funciones distintas.

---

## 7.8 Contexto de conversación

Debe incluir solo:

- Petición actual.
- Aclaraciones necesarias.
- Decisiones recientes.
- Referencias activas.
- Restricciones acordadas.

No debe incluir automáticamente todo el chat.

---

## 7.9 Contexto de ejecución

Incluye:

- Run actual.
- Loop.
- Paso.
- Plan.
- Resultados.
- Errores.
- Aprobaciones.
- Presupuesto.
- Trabajo pendiente.

---

## 7.10 Contexto de herramientas

El modelo solo debe ver herramientas relevantes para la tarea.

Ejemplo:

```text
Tarea: analizar rendimiento de campaña
```

Herramientas:

- `get_campaign_metrics`
- `get_creative_performance`
- `get_product_margin`

No debería recibir:

- `delete_store`
- `refund_order`
- `cancel_reservation`
- `change_user_role`

---

## 7.11 Contexto de salida

Define:

- Esquema.
- Campos.
- Formato.
- Evidencias.
- Nivel de detalle.
- Prohibiciones.

Ejemplo:

```ts
export const AnalysisOutputSchema = z.object({
  summary: z.string(),
  facts: z.array(
    z.object({
      statement: z.string(),
      sourceIds: z.array(z.string())
    })
  ),
  findings: z.array(z.string()),
  recommendations: z.array(
    z.object({
      action: z.string(),
      expectedImpact: z.string(),
      confidence: z.number()
    })
  ),
  missingInformation: z.array(z.string())
});
```

---

# 8. Context Requirements Registry

Cada tipo de tarea debe declarar qué contexto necesita.

```ts
export type ContextRequirements = {
  taskType: string;

  requiredResourceTypes: string[];
  optionalResourceTypes: string[];

  needsLiveData: boolean;
  needsKnowledge: boolean;
  needsMemory: boolean;
  needsConversationHistory: boolean;

  requiredFacts: string[];
  requiredPolicies: string[];

  allowedToolGroups: string[];

  maxHistoryTokens: number;
  maxKnowledgeTokens: number;
  maxToolResultTokens: number;

  freshnessPolicy: FreshnessPolicy;
};
```

---

## 8.1 Ejemplo EcomScaling

```ts
{
  taskType: "analyze_campaign_performance",
  requiredResourceTypes: [
    "store",
    "campaign"
  ],
  optionalResourceTypes: [
    "product",
    "creative"
  ],
  needsLiveData: true,
  needsKnowledge: true,
  needsMemory: true,
  needsConversationHistory: false,
  requiredFacts: [
    "revenue",
    "spend",
    "roas",
    "cac",
    "margin"
  ],
  requiredPolicies: [
    "analysis_methodology"
  ],
  allowedToolGroups: [
    "analytics.read",
    "ads.read",
    "store.read"
  ],
  maxHistoryTokens: 1000,
  maxKnowledgeTokens: 5000,
  maxToolResultTokens: 6000,
  freshnessPolicy: {
    maxAgeSeconds: 3600
  }
}
```

---

## 8.2 Ejemplo CRM

```ts
{
  taskType: "review_case_readiness",
  requiredResourceTypes: [
    "case",
    "client"
  ],
  optionalResourceTypes: [
    "document",
    "payment",
    "task"
  ],
  needsLiveData: true,
  needsKnowledge: true,
  needsMemory: false,
  needsConversationHistory: true,
  requiredFacts: [
    "current_status",
    "required_documents",
    "present_documents"
  ],
  requiredPolicies: [
    "case_checklist"
  ],
  allowedToolGroups: [
    "cases.read",
    "documents.read",
    "tasks.read"
  ],
  maxHistoryTokens: 2500,
  maxKnowledgeTokens: 6000,
  maxToolResultTokens: 5000,
  freshnessPolicy: {
    maxAgeSeconds: 300
  }
}
```

---

# 9. Context Builder común

```ts
export interface ContextBuilder {
  build(input: ContextBuildInput): Promise<ModelContext>;
}
```

```ts
export type ContextBuildInput = {
  actor: AuthenticatedActor;
  product: ProductContext;
  task: AgentTask;
  runState: AgentRunState;
  loopType: LoopType;
};
```

---

## 9.1 Implementación conceptual

```ts
export async function buildContext(
  input: ContextBuildInput
): Promise<ModelContext> {
  const requirements =
    contextRequirementsRegistry.get(input.task.type);

  const authorizedResources =
    await resourceResolver.resolveAndAuthorize({
      actor: input.actor,
      task: input.task,
      requirements,
    });

  const liveData =
    requirements.needsLiveData
      ? await domainContextProvider.loadLiveData({
          actor: input.actor,
          resources: authorizedResources,
          requiredFacts: requirements.requiredFacts,
        })
      : [];

  const knowledge =
    requirements.needsKnowledge
      ? await knowledgeProvider.retrieve({
          tenantId: input.actor.tenantId,
          task: input.task,
          policies: requirements.requiredPolicies,
          maxTokens: requirements.maxKnowledgeTokens,
        })
      : [];

  const memory =
    requirements.needsMemory
      ? await memoryProvider.retrieve({
          actor: input.actor,
          task: input.task,
        })
      : [];

  const history =
    requirements.needsConversationHistory
      ? await conversationProvider.retrieveRelevant({
          conversationId: input.runState.conversationId,
          task: input.task,
          maxTokens: requirements.maxHistoryTokens,
        })
      : [];

  const tools =
    await toolContextProvider.getAllowedTools({
      actor: input.actor,
      task: input.task,
      allowedGroups: requirements.allowedToolGroups,
    });

  const rawContext = {
    system: systemContextRegistry.get(input.task.type),
    actor: buildActorContext(input.actor),
    product: input.product,
    task: input.task,
    resources: authorizedResources,
    liveData,
    knowledge,
    memory,
    history,
    execution: buildExecutionContext(input.runState),
    tools,
    output: outputContextRegistry.get(input.task.type),
  };

  const normalized =
    contextNormalizer.normalize(rawContext);

  const filtered =
    contextPolicy.filterUnauthorized(normalized, input.actor);

  const ranked =
    contextRanker.rank(filtered, input.task);

  const compressed =
    contextCompressor.compress(ranked, requirements);

  return contextValidator.validate(compressed);
}
```

---

# 10. Proveedores de contexto

La plataforma debe usar proveedores desacoplados.

```ts
export interface ContextProvider<TInput, TOutput> {
  load(input: TInput): Promise<TOutput>;
}
```

Proveedores recomendados:

```text
IdentityContextProvider
ProductContextProvider
DomainContextProvider
KnowledgeContextProvider
MemoryContextProvider
ConversationContextProvider
ExecutionContextProvider
ToolContextProvider
OutputContextProvider
```

Cada producto implementa su adaptador de dominio.

---

# 11. Adaptador de EcomScaling IA

```ts
export class EcommerceDomainContextProvider
  implements DomainContextProvider
{
  async loadLiveData(input: DomainContextInput) {
    // Tienda
    // Campañas
    // Creatividades
    // Productos
    // Pedidos
    // Márgenes
    // Métricas
    // Canales
  }
}
```

---

## 11.1 Posibles context packs

```text
store_overview
campaign_performance
creative_analysis
product_economics
customer_cohorts
inventory_risk
growth_opportunities
```

Ejemplo:

```ts
{
  contextPack: "campaign_performance",
  includes: [
    "campaign_metrics",
    "creative_metrics",
    "product_margin",
    "attribution_window",
    "date_range",
    "comparison_period"
  ]
}
```

---

# 12. Adaptador de CRM/SaaS

```ts
export class CrmDomainContextProvider
  implements DomainContextProvider
{
  async loadLiveData(input: DomainContextInput) {
    // Leads
    // Clientes
    // Oportunidades
    // Casos
    // Reservas
    // Pagos
    // Documentos
    // Tareas
  }
}
```

---

## 12.1 Posibles context packs

```text
lead_qualification
client_360
opportunity_review
case_readiness
reservation_status
payment_validation
document_completeness
task_planning
```

---

# 13. Context Packs

Un **Context Pack** es una definición reutilizable de información necesaria para una familia de tareas.

```ts
export type ContextPackDefinition = {
  id: string;
  productType: string;
  resourceTypes: string[];
  facts: string[];
  policies: string[];
  toolGroups: string[];
  outputSchemaId: string;
};
```

Ventajas:

- Consistencia.
- Reutilización.
- Menos prompts gigantes.
- Menos lógica duplicada.
- Mejor testing.
- Versionado.
- Observabilidad.
- Evaluación separada.

---

# 14. Selección dinámica de contexto

El contexto debe depender de:

- Producto.
- Tipo de tarea.
- Actor.
- Rol.
- Tenant.
- Recurso.
- Loop.
- Riesgo.
- Estado.
- Herramienta siguiente.
- Presupuesto.

Ejemplo:

```ts
const contextPack =
  contextPackRegistry.resolve({
    productType: product.type,
    taskType: task.type,
    loopType,
    riskLevel: task.riskLevel,
  });
```

---

# 15. Presupuesto de contexto

```ts
export type ContextBudget = {
  maxInputTokens: number;
  reserveOutputTokens: number;

  system: number;
  task: number;
  resources: number;
  liveData: number;
  knowledge: number;
  memory: number;
  conversation: number;
  toolResults: number;
};
```

---

## 15.1 Regla de reparto

No debe existir un reparto fijo universal.

Debe adaptarse por tarea.

### Tarea analítica

Mayor presupuesto para:

- Datos vivos.
- Periodos comparativos.
- Evidencias.

### Tarea documental

Mayor presupuesto para:

- Fragmentos RAG.
- Plantillas.
- Políticas.

### Tarea CRUD

Mayor prioridad para:

- Estado actual.
- Invariantes.
- Permisos.
- Resultado de herramientas.

---

# 16. Ranking de contexto

Cada elemento debe recibir puntuación.

```ts
export type ContextCandidate = {
  id: string;
  relevance: number;
  authority: number;
  freshness: number;
  specificity: number;
  tokenCost: number;
  risk: number;
};
```

Puntuación conceptual:

```text
score =
relevancia
+ autoridad
+ actualidad
+ especificidad
- coste
- riesgo
```

No es obligatorio usar exactamente esta fórmula.

El objetivo es hacer explícita la decisión.

---

# 17. Jerarquía de fuentes

Orden recomendado:

1. Datos vivos verificados.
2. Resultado de herramienta verificado.
3. Documento firmado o política aprobada.
4. Fuente externa autorizada.
5. Memoria aprobada.
6. Resumen de conversación.
7. Mensaje del usuario.
8. Inferencia del modelo.

La prioridad puede variar por dominio.

Debe documentarse.

---

# 18. Resolución de contradicciones

```ts
export type ContextConflict = {
  key: string;
  candidates: ContextFact[];
  resolution:
    | "canonical_source"
    | "freshest_source"
    | "human_required"
    | "unresolved";
};
```

Reglas:

- No mezclar valores incompatibles.
- Registrar el conflicto.
- No ocultarlo.
- Preferir fuente canónica.
- Solicitar intervención humana si afecta a una acción crítica.

---

# 19. Actualidad

```ts
export type FreshnessPolicy = {
  maxAgeSeconds?: number;
  requireEffectiveDate?: boolean;
  refreshBeforeAction?: boolean;
};
```

Ejemplos:

### Métricas publicitarias

Pueden tolerar minutos u horas.

### Estado de una reserva

Debe refrescarse antes de ejecutar.

### Permisos

Siempre actuales.

### Política documental

Debe incluir versión y vigencia.

---

# 20. Progressive disclosure

El sistema debe recuperar contexto progresivamente.

Ejemplo EcomScaling:

```text
1. Vista general de tienda.
2. Detectar problema en campañas.
3. Cargar campañas afectadas.
4. Cargar creatividades relevantes.
5. Cargar margen de productos afectados.
```

Ejemplo CRM:

```text
1. Resolver caso.
2. Consultar estado.
3. Detectar falta documental.
4. Cargar checklist aplicable.
5. Consultar documentos concretos.
```

No cargar todo desde el inicio.

---

# 21. Tool context

Las tools forman parte del contexto.

Cada herramienta debe incluir:

- Nombre.
- Objetivo.
- Esquema.
- Riesgo.
- Restricciones.
- Resultado.
- Coste estimado.
- Grupo.

```ts
export type ToolContext = {
  name: string;
  description: string;
  inputSchema: unknown;
  riskLevel: string;
  toolGroup: string;
};
```

---

## 21.1 Selección de herramientas

```ts
const tools =
  toolRegistry.getAllowed({
    productType,
    taskType,
    actorPermissions,
    riskLevel,
  });
```

No exponer todas las herramientas.

---

# 22. Contexto para tools

Las herramientas reciben dos entradas separadas.

## Argumentos del modelo

```ts
{
  campaignId: "campaign_12",
  dateRange: "last_30_days"
}
```

## Runtime seguro

```ts
{
  actorId,
  tenantId,
  permissions,
  services,
  traceId,
  runId
}
```

Nunca permitir que el modelo establezca:

- Tenant.
- Permisos.
- Secretos.
- Conexiones.
- API keys.
- Rol.
- Identidad.

---

# 23. Resultados de herramientas

Los resultados deben estar diseñados para dos consumidores:

1. Código.
2. Modelo.

```ts
export type ToolResult<T> = {
  raw: T;
  modelView: unknown;
  metadata: {
    sourceId: string;
    fetchedAt: string;
    truncated: boolean;
  };
};
```

Ejemplo:

```ts
{
  raw: [...5000 registros...],
  modelView: {
    total: 5000,
    eligible: 412,
    excluded: {
      inactive: 301,
      invalid: 4287
    },
    sample: [...]
  }
}
```

---

# 24. Compresión

Estrategias:

- Trimming.
- Resumen.
- Deduplicación.
- Agrupación.
- Agregación estadística.
- Offloading.
- Referencias a artefactos.
- Extracción de hechos.
- Aislamiento de subtareas.

---

## 24.1 Compresión segura

La compresión debe preservar:

- Decisiones.
- Restricciones.
- Fechas.
- Incertidumbres.
- Fuentes.
- Entidades.
- Errores.
- Trabajo pendiente.

No debe convertir:

```text
El usuario no ha aprobado el cambio.
```

en:

```text
Cambio aprobado.
```

---

# 25. Contexto de conversación

Estrategia recomendada:

```text
Últimos turnos relevantes
+ resumen estructurado
+ decisiones persistentes
+ referencias activas
```

No usar:

```text
historial completo sin filtrar
```

---

# 26. Contexto de memoria

La memoria debe consultarse por necesidad.

```ts
const memories = await memoryProvider.retrieve({
  tenantId,
  actorId,
  taskType,
  resourceRefs,
});
```

No introducir toda la memoria del tenant.

---

# 27. Seguridad

## 27.1 Multi-tenant

Todo contexto debe estar limitado por tenant.

```ts
if (fact.source.tenantId !== actor.tenantId) {
  throw new TenantMismatchError();
}
```

## 27.2 Datos sensibles

Aplicar:

- Redacción.
- Minimización.
- Permisos.
- Retención.
- Cifrado.
- Auditoría.

## 27.3 Prompt injection

Documentos, correos, páginas y resultados externos son datos no confiables.

No pueden:

- Cambiar permisos.
- Activar tools.
- Alterar instrucciones del sistema.
- Solicitar secretos.
- Saltarse aprobaciones.

---

# 28. Observabilidad

Cada construcción de contexto debe registrar:

- `context_build_id`
- `run_id`
- `task_type`
- `product_type`
- fuentes consultadas
- fuentes seleccionadas
- elementos descartados
- tokens estimados
- compresiones
- conflictos
- antigüedad
- herramientas expuestas
- versión del context pack
- versión de políticas

---

# 29. Métricas

- Tokens por tipo de contexto.
- Tiempo de construcción.
- Tasa de truncamiento.
- Tasa de conflicto.
- Tasa de contexto obsoleto.
- Número de fuentes.
- Precisión del retrieval.
- Herramientas expuestas.
- Herramientas utilizadas.
- Ratio de contexto utilizado.
- Coste por tarea.
- Incidentes multi-tenant.
- Errores por contexto insuficiente.
- Errores por contexto excesivo.
- Correcciones humanas.

---

# 30. Evals

Crear evals para:

- Selección de fuentes.
- Resolución de recursos.
- Separación de tenants.
- Vigencia.
- Contradicciones.
- Recuperación documental.
- Priorización.
- Compresión.
- Herramientas expuestas.
- Formato final.
- Datos faltantes.
- Prompt injection.

---

## 30.1 Casos EcomScaling

- Campaña sin margen disponible.
- Métricas con diferente ventana.
- Datos de tienda desactualizados.
- Recomendación basada en campaña equivocada.
- Conflicto entre Shopify y plataforma publicitaria.
- Contexto de otra tienda.
- Documento con instrucciones maliciosas.

## 30.2 Casos CRM

- Cliente ambiguo.
- Recurso inexistente.
- Pago actualizado después de una pausa.
- Documento sustituido.
- Contexto de otra empresa.
- Política antigua.
- Tarea duplicada.
- Historial contradictorio.

---

# 31. Testing

## Unitarios

- Requirements registry.
- Ranking.
- Freshness.
- Conflictos.
- Presupuesto.
- Compresión.
- Filtrado.
- Tool selection.
- Output schema.

## Integración

- Context Builder completo.
- Adaptador EcomScaling.
- Adaptador CRM.
- RAG.
- Memoria.
- Tools.
- Persistencia.
- Observabilidad.

## Seguridad

- Tenant mismatch.
- Permission bypass.
- Prompt injection.
- Exfiltración.
- Context poisoning.
- Documento malicioso.
- Datos sensibles.

---

# 32. Arquitectura propuesta

```text
src/
  ai/
    context/
      context-builder.ts
      context-requirements.registry.ts
      context-pack.registry.ts
      context-budget.ts
      context-ranker.ts
      context-compressor.ts
      context-validator.ts
      context-policy.ts
      context-conflict-resolver.ts

      providers/
        identity-context.provider.ts
        product-context.provider.ts
        domain-context.provider.ts
        knowledge-context.provider.ts
        memory-context.provider.ts
        conversation-context.provider.ts
        execution-context.provider.ts
        tool-context.provider.ts
        output-context.provider.ts

      adapters/
        ecommerce/
        crm/

      observability/
      evals/
      tests/
```

Adaptar a cada repositorio real.

---

# 33. Fases de implementación

## Fase 0. Auditoría

Analizar:

- Cómo se construye hoy el prompt.
- Qué datos se cargan.
- Cómo se obtiene el tenant.
- Cómo se recupera RAG.
- Cómo funciona la memoria.
- Qué tools se exponen.
- Qué datos se repiten.
- Qué datos están obsoletos.
- Qué riesgos existen.

## Fase 1. Contratos

Crear:

- `ModelContext`
- `ContextFact`
- `ContextSourceReference`
- `ContextRequirements`
- `ContextPackDefinition`
- `ContextBudget`
- `FreshnessPolicy`
- `ContextConflict`

## Fase 2. Context Builder

Implementar pipeline común.

## Fase 3. Adaptador de primer producto

Elegir un único caso de lectura.

## Fase 4. Context Packs

Crear packs por familias de tareas.

## Fase 5. RAG y memoria

Integrar con fuentes y metadatos.

## Fase 6. Tools

Selección dinámica.

## Fase 7. Compresión

Añadir resumen, offloading y referencias.

## Fase 8. Seguridad

Multi-tenant, redacción e injection.

## Fase 9. Segundo producto

Reutilizar plataforma con nuevo adaptador.

## Fase 10. Evals y observabilidad

Medir calidad.

---

# 34. Criterios de aceptación

- [ ] Existe Context Builder común.
- [ ] La plataforma no depende de entidades concretas.
- [ ] Cada producto usa adaptadores.
- [ ] Cada tarea declara requisitos.
- [ ] Existen Context Packs.
- [ ] El tenant procede de autenticación.
- [ ] Las fuentes tienen metadatos.
- [ ] Los datos vivos prevalecen.
- [ ] Existen políticas de vigencia.
- [ ] Se resuelven contradicciones.
- [ ] Existe presupuesto.
- [ ] Se comprime contexto.
- [ ] Los outputs grandes se resumen.
- [ ] Las tools se filtran.
- [ ] El modelo no controla secretos.
- [ ] RAG se trata como dato no confiable.
- [ ] Existen evals.
- [ ] Existen métricas.
- [ ] Se puede reutilizar entre EcomScaling y CRM.

---

# 35. Instrucciones para Codex

## Misión

Diseñar una capa transversal de Context Engineering reutilizable entre productos SaaS con agentes.

## Restricciones

1. No acoplar la plataforma a un dominio.
2. No inventar tablas ni servicios.
3. Analizar el repositorio real.
4. Mantener multi-tenant.
5. No cargar todos los datos.
6. No usar un prompt monolítico.
7. No exponer todas las tools.
8. No confiar en memoria como dato vivo.
9. No tratar RAG como fuente autorizadora.
10. No permitir que el modelo determine tenant o permisos.
11. Versionar Context Packs.
12. Añadir tests.
13. Medir tokens y fuentes.
14. No duplicar lógica entre productos.
15. Separar plataforma, producto y dominio.
16. No implementar todo de golpe.
17. Empezar por una tarea de lectura.
18. No marcar como terminado con tests fallando.

---

# 36. Primera tarea recomendada para Codex

```text
Analiza el repositorio para diseñar una capa transversal de Context Engineering
que pueda reutilizarse en distintos productos SaaS con agentes.

La arquitectura debe servir tanto para un SaaS de analítica y escalado de
tiendas como para un CRM/SaaS operativo.

No implementes todavía acciones de escritura.

Objetivos:

1. Localizar cómo se construye actualmente el contexto.
2. Identificar prompts, RAG, memoria, tools y datos vivos.
3. Identificar dependencias acopladas al dominio.
4. Identificar cómo se obtiene usuario, tenant, roles y permisos.
5. Diseñar contratos comunes:
   - AuthenticatedActor
   - AgentTask
   - ResourceReference
   - ContextFact
   - ContextSourceReference
   - ModelContext
   - ContextRequirements
   - ContextPackDefinition
   - ContextBudget
   - FreshnessPolicy
   - ContextConflict
6. Diseñar un Context Builder común.
7. Diseñar interfaces de proveedores.
8. Diseñar adaptadores de dominio.
9. Implementar un único Context Pack de lectura.
10. Implementar un adaptador para el producto actual.
11. Añadir:
    - filtrado por tenant
    - ranking
    - presupuesto
    - validación
    - observabilidad mínima
12. Añadir tests:
    - contexto correcto
    - recurso inexistente
    - tenant incorrecto
    - fuente obsoleta
    - contradicción
    - exceso de tokens
    - tool no autorizada
13. Documentar cómo se reutilizaría en un segundo producto.

Antes de modificar código, entrega:

a) diagnóstico,
b) dependencias actuales,
c) arquitectura propuesta,
d) contratos,
e) archivos exactos que crearías o modificarías,
f) riesgos.

Restricciones:

- No inventes columnas.
- No conectes el modelo directamente a SQL.
- No uses un prompt monolítico.
- No cargues todo el historial.
- No expongas todas las tools.
- No implementes escrituras.
- No rompas el comportamiento actual.
- No marques el trabajo como completado si typecheck, lint o tests fallan.
```

---

# 37. Antipatrones prohibidos

- Context dump.
- Prompt gigante.
- Historial completo.
- Datos sin fuente.
- RAG sin metadatos.
- Memoria usada como estado vivo.
- Tools ilimitadas.
- Datos de otro tenant.
- Tool results gigantes.
- Contexto obsoleto.
- Lógica duplicada por producto.
- Context Builder acoplado a entidades.
- Inferencias presentadas como hechos.
- Compresión sin trazabilidad.
- Permisos generados por el modelo.

---

# 38. Definición de terminado

La Context Engineering de una tarea está terminada cuando:

1. La tarea tiene requisitos de contexto.
2. Existe un Context Pack.
3. Las fuentes están identificadas.
4. El tenant está validado.
5. Los recursos están resueltos.
6. Los hechos tienen fuente.
7. Se controla vigencia.
8. Se resuelven contradicciones.
9. Existe presupuesto.
10. Existe compresión.
11. Las tools están filtradas.
12. La salida está tipada.
13. Existen tests.
14. Existen métricas.
15. La arquitectura puede reutilizarse en otro producto.

---

# 39. Resumen ejecutivo

La arquitectura debe dividirse en tres niveles:

```text
PLATAFORMA
  Context Builder
  Presupuesto
  Ranking
  Compresión
  Seguridad
  Observabilidad

PRODUCTO
  Módulos habilitados
  Capacidades
  Context Packs
  Configuración

DOMINIO
  Tiendas, campañas y productos
  o
  Leads, clientes y reservas
```

La plataforma debe ser común.

Cada producto define qué tareas existen.

Cada dominio implementa cómo obtener sus datos.

El modelo no debe recibir todo.

Debe recibir exactamente el contexto necesario para tomar la siguiente decisión correcta.
