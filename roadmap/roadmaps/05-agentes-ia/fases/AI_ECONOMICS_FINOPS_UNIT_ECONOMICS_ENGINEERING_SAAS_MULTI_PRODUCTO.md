# AI Economics, FinOps & Unit Economics Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnica, financiera y operativa transversal.
- **Ámbito:** SaaS, CRM, agentes, copilotos, RAG, memoria, tools, workflows, OCR, evaluaciones, infraestructura, soporte, revisión humana, pricing y planes comerciales.
- **Casos de referencia:** NORA, EcomScaling IA y CRM/SaaS.
- **Objetivo:** convertir cada capacidad de IA en una unidad económica medible, atribuible y gobernable, permitiendo decidir qué construir, operar, optimizar, limitar, cobrar, ampliar o retirar.
- **Audiencia:** Codex, arquitectura, backend, IA, plataforma, FinOps, producto, dirección, finanzas, operaciones, QA, seguridad, privacidad y soporte.
- **Prioridad:** crítica.
- **Moneda operativa por defecto:** EUR.
- **Principio rector:** la IA no debe optimizarse para gastar menos por llamada, sino para producir el mejor resultado económico posible manteniendo calidad, seguridad, privacidad y control.
- **Estado esperado:** documento vivo, versionado y conectado con cost attribution, pricing, planes, presupuestos, evals, observabilidad, soporte, contabilidad analítica y decisiones de producto.

---

# 1. Propósito

Este documento define cómo implementar **AI Economics, FinOps & Unit Economics Engineering** en una plataforma SaaS con agentes de IA.

La arquitectura debe permitir:

- Medir costes técnicos.
- Medir costes humanos.
- Medir costes operativos.
- Medir costes de soporte.
- Medir costes de fallos.
- Atribuir costes.
- Definir unidades económicas.
- Medir valor generado.
- Calcular coste por resultado correcto.
- Calcular margen por feature.
- Calcular margen por agente.
- Calcular margen por tenant.
- Calcular margen por plan.
- Definir price floors.
- Definir usage envelopes.
- Definir budgets.
- Detectar anomalías.
- Proyectar escenarios.
- Evaluar ROI.
- Evaluar build vs buy.
- Evaluar migraciones de modelos.
- Evaluar caching.
- Evaluar batch.
- Evaluar revisión humana.
- Evaluar escalado.
- Crear dashboards.
- Crear gates económicos.
- Conectar economía con pricing.
- Conectar economía con capacity planning.
- Conectar economía con decisiones de roadmap.

---

# 2. Regla obligatoria de análisis previo

Antes de implementar métricas, tablas o dashboards, Codex debe analizar el producto real.

Debe inspeccionar:

- Planes actuales.
- Precios actuales.
- Usuarios incluidos.
- Límites actuales.
- Features.
- Agents.
- Modelos.
- Providers.
- Tools.
- Workflows.
- Retries.
- Fallbacks.
- OCR.
- RAG.
- Memory.
- Storage.
- Workers.
- Queues.
- Logs.
- Evals.
- Support.
- Human review.
- Incidents.
- Refunds.
- Discounts.
- Churn.
- Acquisition.
- Usage by tenant.
- Cost by tenant.
- Revenue by tenant.
- Margin by plan.
- Enterprise agreements.
- Manual work.
- Unit economics currently tracked.
- Gaps in cost attribution.
- Gaps in value attribution.
- Existing accounting systems.
- Existing billing systems.

No debe asumir que:

```text
coste de IA = coste del modelo
```

---

# 3. Prohibiciones para Codex

Codex no debe:

- Medir solo tokens.
- Medir solo coste por llamada.
- Ignorar coste humano.
- Ignorar soporte.
- Ignorar incidencias.
- Ignorar coste de fallos.
- Ignorar coste fijo.
- Ignorar coste ocioso.
- Inventar ingresos atribuidos.
- Inventar tiempo ahorrado.
- Inventar margen.
- Inventar condiciones del plan intermedio de NORA.
- Cambiar pricing automáticamente.
- Bloquear usuarios por coste sin policy.
- Reducir calidad para ahorrar sin quality gate.
- Eliminar revisión humana obligatoria por coste.
- Considerar una feature rentable solo porque se usa mucho.
- Considerar una feature inútil solo porque monetiza indirectamente.
- Ocultar cross-subsidization.
- Presentar ROI sin supuestos.
- Hardcodear precios de providers en varios archivos.
- Usar precios desactualizados.
- Mezclar costes reales y estimados sin etiquetarlos.
- Mezclar valor medido y valor inferido.
- Marcar terminado sin reconciliación con facturación.
- Marcar terminado sin tests de atribución.
- Marcar terminado sin owner financiero.
- Marcar terminado sin forecast.

---

# 4. Entregables previos obligatorios

Antes de modificar código, Codex debe entregar:

1. Inventario de fuentes de coste.
2. Inventario de precios de providers.
3. Inventario de modelos.
4. Inventario de tools externas.
5. Inventario de infraestructura.
6. Inventario de workers.
7. Inventario de storage.
8. Inventario de observabilidad.
9. Inventario de soporte.
10. Inventario de revisión humana.
11. Inventario de fallos.
12. Inventario de refunds.
13. Inventario de planes.
14. Inventario de precios.
15. Inventario de features.
16. Inventario de agents.
17. Inventario de workflows.
18. Inventario de unidades de valor.
19. Inventario de métricas de outcome.
20. Inventario de ingresos.
21. Inventario de descuentos.
22. Inventario de overages.
23. Inventario de presupuestos.
24. Inventario de forecasts.
25. Matriz cost source → dimension.
26. Matriz feature → unit.
27. Matriz feature → value event.
28. Matriz plan → usage envelope.
29. Matriz plan → margin.
30. Matriz agent → cost.
31. Matriz workflow → human review.
32. Matriz failure → expected cost.
33. Matriz provider → price version.
34. Matriz environment → budget.
35. Arquitectura.
36. Persistencia.
37. Dashboards.
38. Fases.
39. Tests.
40. Evals.
41. Quality gates.
42. ADR.
43. Decisiones económicas abiertas.

---

# 5. Definición

**AI Economics, FinOps & Unit Economics Engineering** es la disciplina que conecta:

```text
USO
  ↓
COSTE TÉCNICO
  ↓
COSTE HUMANO
  ↓
COSTE DE FALLO
  ↓
RESULTADO
  ↓
VALOR
  ↓
MARGEN
```

No consiste únicamente en:

```text
tokens × precio
```

---

# 6. Diferencia con Cost Attribution de plataforma

La plataforma atribuye costes técnicos.

Economics Engineering determina:

- Coste total.
- Coste por outcome.
- Coste por tenant.
- Coste por plan.
- Margen.
- Price floor.
- ROI.
- Payback.
- Viabilidad.
- Optimización.
- Retirada.

---

# 7. Diferencia con FinOps cloud

FinOps cloud tradicional gestiona:

- Compute.
- Storage.
- Network.
- Databases.
- Licencias.

AI FinOps añade:

- Tokens.
- Model calls.
- Cached tokens.
- Embeddings.
- Vision.
- Audio.
- Batch.
- Tool APIs.
- Human review.
- Support.
- Eval costs.
- Provider migration.
- Failure costs.
- Value attribution.

---

# 8. Principios rectores

1. **Medir coste total, no solo coste directo.**
2. **Usar un denominador de negocio.**
3. **Distinguir coste medido y estimado.**
4. **Distinguir valor medido e inferido.**
5. **No reducir calidad por debajo del mínimo.**
6. **No eliminar controles obligatorios por coste.**
7. **Versionar precios.**
8. **Asignar owners.**
9. **Definir budgets.**
10. **Detectar anomalías.**
11. **Revisar planes con datos reales.**
12. **Modelar P50, P90 y P99.**
13. **Calcular costes humanos.**
14. **Calcular coste de fallos.**
15. **Conectar economía con release gates.**
16. **Conectar economía con roadmap.**

---

# 9. Cost Taxonomy

```ts
export type AICostCategory =
  | "model_input"
  | "model_output"
  | "model_cached_input"
  | "embedding"
  | "vision"
  | "audio"
  | "tool_api"
  | "compute"
  | "database"
  | "storage"
  | "network"
  | "observability"
  | "human_review"
  | "support"
  | "incident"
  | "refund"
  | "compliance"
  | "security"
  | "evaluation"
  | "engineering"
  | "idle_capacity";
```

---

# 10. Cost Ledger

```ts
export type AICostLedgerEntry = {
  id: string;

  tenantId?: string;

  productId: string;

  featureId?: string;

  agentId?: string;

  workflowId?: string;

  runId?: string;

  providerId?: string;

  modelId?: string;

  environment: string;

  costCategory: AICostCategory;

  quantity: number;

  unit: string;

  unitCost: number;

  totalCost: number;

  currency: "EUR";

  pricingVersionId?: string;

  measuredOrEstimated:
    | "measured"
    | "allocated"
    | "estimated";

  occurredAt: string;

  traceId?: string;
};
```

---

# 11. Ledger invariants

Toda entrada debe tener:

- Fecha.
- Categoría.
- Cantidad.
- Unidad.
- Coste unitario.
- Coste total.
- Moneda.
- Fuente.
- Entorno.
- Product.
- Medido o estimado.

No permitir:

- Costes sin owner.
- Costes sin pricing version.
- Duplicados.
- Monedas mezcladas sin conversión aprobada.
- Total inconsistente con cantidad × coste unitario.
- Costes de producción sin tenant cuando sea atribuible.

---

# 12. Cost Source Registry

```ts
export type AICostSource = {
  id: string;

  sourceType:
    | "provider_invoice"
    | "provider_usage_api"
    | "cloud_invoice"
    | "internal_meter"
    | "time_tracking"
    | "support_system"
    | "manual_allocation";

  sourceReference: string;

  refreshFrequency: string;

  ownerId: string;

  authoritative: boolean;

  reconciliationRequired: boolean;
};
```

---

# 13. Provider Price Registry

```ts
export type ProviderPriceVersion = {
  id: string;

  providerId: string;

  modelId?: string;

  serviceType: string;

  effectiveFrom: string;

  effectiveUntil?: string;

  inputUnitPrice?: number;

  outputUnitPrice?: number;

  cachedInputUnitPrice?: number;

  embeddingUnitPrice?: number;

  imageUnitPrice?: number;

  audioUnitPrice?: number;

  fixedRequestPrice?: number;

  currency: "EUR" | "USD";

  sourceReference: string;

  verifiedAt: string;
};
```

---

# 14. Pricing conversion

Si el provider factura en otra moneda:

- Registrar precio original.
- Registrar tipo de cambio aplicado.
- Registrar fecha.
- Registrar source.
- Mantener coste en EUR para contabilidad interna.
- No recalcular históricos salvo policy.

---

# 15. Provider Usage Record

```ts
export type ProviderUsageRecord = {
  providerId: string;

  modelId: string;

  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;

  imageUnits?: number;
  audioSeconds?: number;
  embeddingTokens?: number;

  pricingVersionId: string;

  calculatedCost: number;

  occurredAt: string;

  traceId: string;
};
```

---

# 16. Cost Allocation

Costes no atribuibles directamente deben asignarse.

```ts
export type CostAllocationMethod =
  | "direct"
  | "usage_based"
  | "revenue_based"
  | "user_based"
  | "tenant_based"
  | "equal"
  | "custom";

export type CostAllocationRule = {
  id: string;

  costCategory: AICostCategory;

  method: CostAllocationMethod;

  allocationDriver: string;

  scope: string[];

  effectiveFrom: string;

  ownerId: string;
};
```

---

# 17. Allocation consistency

La metodología debe:

- Ser estable.
- Ser documentada.
- Tener owner.
- Tener fecha.
- Ser revisable.
- No cambiar para maquillar márgenes.
- Reconciliar con contabilidad.

---

# 18. Fully Loaded Cost

El coste total de una unidad debe incluir:

- Coste directo.
- Coste variable indirecto.
- Coste humano.
- Soporte.
- Incidentes.
- Coste fijo asignado.
- Coste de calidad.
- Coste de fallo esperado.

---

# 19. Cost-to-Serve

```ts
export type AICostToServe = {
  tenantId?: string;

  productId: string;

  featureId: string;

  taskType: string;

  unitType: string;

  period: string;

  modelCost: number;

  embeddingCost: number;

  toolCost: number;

  infrastructureCost: number;

  storageCost: number;

  observabilityCost: number;

  humanReviewCost: number;

  supportCost: number;

  incidentCost: number;

  allocatedFixedCost: number;

  failureCost: number;

  totalCost: number;

  successfulOutcomes: number;

  costPerSuccessfulOutcome: number;
};
```

---

# 20. Unit Registry

```ts
export type AIUnitDefinition = {
  id: string;

  productId: string;

  unitType: string;

  description: string;

  successDefinition: string;

  measurementSource: string;

  ownerId: string;

  active: boolean;
};
```

---

# 21. Unidades NORA

- Estudio fiscal completado.
- Estudio fiscal descargado.
- Explicación generada.
- Documento OCR validado.
- Consulta Playbook resuelta.
- Acción CRM completada.
- Reserva procesada.
- Expediente jurídico gestionado.
- Usuario activo.
- Agencia activa.

---

# 22. Unidades EcomScaling IA

- Tienda sincronizada.
- Tienda analizada.
- Recomendación útil.
- Alerta accionable.
- Campaña revisada.
- Acción aprobada.
- Acción ejecutada correctamente.
- Informe completado.
- Hora de consultoría ahorrada.

---

# 23. Unidades CRM

- Lead procesado.
- Llamada resumida.
- Documento clasificado.
- Tarea creada.
- Acción CRUD completada.
- Reserva gestionada.
- Consulta resuelta.
- Usuario asistido.
- Caso cerrado.

---

# 24. AI Unit Economics

```ts
export type AIUnitEconomics = {
  unitType: string;

  productId: string;

  featureId?: string;

  period: string;

  unitsProcessed: number;

  unitsSuccessful: number;

  revenueAttributed: number;

  variableCost: number;

  allocatedFixedCost: number;

  totalCost: number;

  grossMargin: number;

  grossMarginPercentage: number;

  costPerUnit: number;

  costPerSuccessfulUnit: number;

  valuePerSuccessfulUnit?: number;
};
```

---

# 25. Denominator discipline

No usar:

```text
coste por run
```

cuando el outcome real es:

```text
documento validado
```

o:

```text
acción ejecutada correctamente
```

El denominador debe ser la unidad de valor.

---

# 26. Success Definition

```ts
export type AIOutcomeStatus =
  | "success"
  | "partial_success"
  | "failed"
  | "cancelled"
  | "requires_human_review"
  | "rejected";

export type AIOutcomeRecord = {
  id: string;

  unitType: string;

  productId: string;

  featureId: string;

  runId?: string;

  tenantId?: string;

  status: AIOutcomeStatus;

  qualityScore?: number;

  verified: boolean;

  humanReviewRequired: boolean;

  occurredAt: string;
};
```

---

# 27. Coste por intento vs coste por éxito

Ejemplo:

```text
Coste total: 20 €.
Runs: 100.
Éxitos verificados: 80.
```

```text
Coste por run:
0,20 €.

Coste por éxito:
0,25 €.
```

La segunda métrica es la relevante.

---

# 28. Human Review Cost

```ts
export type HumanReviewCostProfile = {
  id: string;

  taskType: string;

  reviewerRole: string;

  averageReviewMinutes: number;

  hourlyLoadedCost: number;

  reviewRate: number;

  correctionRate: number;

  escalationRate: number;

  averageCostPerRun: number;

  effectiveFrom: string;
};
```

---

# 29. Loaded Hourly Cost

Debe definirse con Finanzas.

Puede incluir:

- Salario.
- Costes sociales.
- Equipamiento.
- Formación.
- Gestión.
- Tiempo no productivo.
- Software.
- Espacio.
- Supervisión.

---

# 30. Human Work Record

```ts
export type HumanWorkRecord = {
  id: string;

  tenantId?: string;

  productId: string;

  featureId: string;

  workflowId?: string;

  taskType: string;

  userId: string;

  role: string;

  minutesSpent: number;

  workType:
    | "review"
    | "correction"
    | "support"
    | "escalation"
    | "incident"
    | "quality_check";

  cost: number;

  occurredAt: string;
};
```

---

# 31. Review-by-Exception Economics

```ts
export type ReviewByExceptionProfile = {
  taskType: string;

  baselineReviewRate: number;

  targetReviewRate: number;

  qualityThreshold: number;

  riskTriggers: string[];

  exceptionTriggers: string[];

  expectedMonthlySavings: number;

  safetyConstraints: string[];
};
```

No aplicar si:

- La revisión es legalmente obligatoria.
- El riesgo es crítico.
- La calidad no está demostrada.
- La corrección es irreversible.
- No existe verification.

---

# 32. Support Cost

```ts
export type AISupportCost = {
  productId: string;

  featureId?: string;

  tenantId?: string;

  period: string;

  ticketCount: number;

  averageHandlingMinutes: number;

  loadedHourlyCost: number;

  totalSupportCost: number;

  costPerActiveTenant: number;
};
```

---

# 33. Incident Cost

```ts
export type AIIncidentCost = {
  incidentId: string;

  remediationCost: number;

  supportCost: number;

  engineeringCost: number;

  refundCost: number;

  legalCost: number;

  customerLossEstimate: number;

  totalCost: number;
};
```

---

# 34. Failure Cost

```ts
export type AIFailureCost = {
  failureType: string;

  frequency: number;

  directRemediationCost: number;

  expectedLegalCost: number;

  expectedCustomerLoss: number;

  expectedOperationalCost: number;

  expectedReputationalCost?: number;

  totalExpectedFailureCost: number;
};
```

---

# 35. Expected Total Cost

```text
Coste total esperado =
coste de ejecución
+ coste de revisión
+ coste de soporte
+ coste fijo asignado
+ probabilidad de fallo × impacto del fallo
```

---

# 36. Quality-Cost Frontier

```ts
export type QualityCostPoint = {
  configurationId: string;

  modelId: string;

  promptVersion: string;

  qualityScore: number;

  directCost: number;

  humanReviewCost: number;

  failureCost: number;

  totalExpectedCost: number;

  latencyMs: number;

  safetyPassed: boolean;

  privacyPassed: boolean;
};
```

---

# 37. Selección económica de modelo

No seleccionar solo:

```text
lowest direct cost
```

Seleccionar:

```text
minimum expected total cost
subject to quality, safety, privacy and latency constraints
```

---

# 38. Model Economics Profile

```ts
export type ModelEconomicsProfile = {
  modelId: string;

  taskType: string;

  averageDirectCost: number;

  successRate: number;

  reviewRate: number;

  correctionRate: number;

  averageLatencyMs: number;

  totalExpectedCostPerSuccess: number;

  qualityScore: number;
};
```

---

# 39. Model Routing by Economics

El router puede considerar:

- Quality floor.
- Privacy.
- Security.
- Latency.
- Budget.
- Total expected cost.
- Tenant plan.
- Workload class.

No debe usar un modelo peor por plan si el contrato de producto exige misma calidad.

En EcomScaling IA, Growth y Scale no deben diferenciarse por calidad de respuesta, sino por capacidades y volumen.

---

# 40. Value Engineering

Valor posible:

- Tiempo ahorrado.
- Ingresos generados.
- Conversión mejorada.
- Costes evitados.
- Errores evitados.
- Riesgo reducido.
- Capacidad adicional.
- Menor soporte.
- Retención.
- Menor churn.
- Mayor velocidad.
- Mejor calidad.

---

# 41. Value Event

```ts
export type AIValueEvent = {
  id: string;

  tenantId?: string;

  productId: string;

  featureId: string;

  agentId?: string;

  outcomeType:
    | "time_saved"
    | "revenue_generated"
    | "cost_avoided"
    | "error_avoided"
    | "risk_reduced"
    | "conversion_improved"
    | "retention_improved"
    | "capacity_created";

  estimatedValue: number;

  currency: "EUR";

  evidenceReferences: string[];

  confidence:
    | "measured"
    | "estimated"
    | "inferred";

  occurredAt: string;
};
```

---

# 42. Value attribution rules

Cada value event debe indicar:

- Método.
- Baseline.
- Periodo.
- Confidence.
- Source.
- Owner.
- Double-counting prevention.

No atribuir todo el revenue a la IA si:

- Hubo campañas.
- Hubo equipo humano.
- Hubo estacionalidad.
- Hubo descuentos.
- Hubo cambios externos.

---

# 43. Time Savings

```ts
export type TimeSavingsMeasurement = {
  workflowId: string;

  baselineMinutesPerCase: number;

  currentMinutesPerCase: number;

  monthlyVolume: number;

  loadedHourlyCost: number;

  monthlyHoursSaved: number;

  monthlyValue: number;

  measurementMethod:
    | "before_after"
    | "controlled_sample"
    | "time_tracking"
    | "estimated";
};
```

---

# 44. Automation ROI

```ts
export type AutomationROI = {
  workflowId: string;

  manualCostPerCase: number;

  automatedCostPerCase: number;

  implementationCost: number;

  monthlyMaintenanceCost: number;

  monthlyVolume: number;

  monthlySavings: number;

  paybackMonths: number;

  annualROI: number;
};
```

---

# 45. ROI formulas

```text
Ahorro mensual =
(coste manual − coste automatizado)
× volumen
− mantenimiento mensual
```

```text
Payback =
implementación
÷ ahorro mensual
```

```text
ROI anual =
(beneficio anual − coste anual)
÷ coste anual
```

---

# 46. Feature Business Case

```ts
export type AIFeatureBusinessCase = {
  featureId: string;

  problem: string;

  targetUsers: string[];

  expectedUsage: number;

  expectedValue: number;

  implementationCost: number;

  monthlyOperatingCost: number;

  monthlyMaintenanceCost: number;

  expectedRevenueImpact: number;

  expectedCostSavings: number;

  paybackMonths: number;

  risks: string[];

  assumptions: string[];

  decision:
    | "build"
    | "pilot"
    | "defer"
    | "reject";
};
```

---

# 47. Pilot Economics

Debe medir:

- Coste real.
- Volumen real.
- Review rate.
- Support rate.
- Failure rate.
- Value.
- Willingness to pay.
- Margin.
- P90.
- P99.
- Adoption.

---

# 48. Agent Economics

```ts
export type AgentEconomicsProfile = {
  agentId: string;
  agentVersion: string;

  period: string;

  monthlyRuns: number;

  successfulRuns: number;

  directCost: number;

  humanCost: number;

  supportCost: number;

  incidentCost: number;

  allocatedFixedCost: number;

  totalCost: number;

  attributedValue: number;

  netValue: number;

  costPerSuccess: number;

  roi: number;

  ownerId: string;
};
```

---

# 49. Feature Economics

```ts
export type FeatureEconomicsProfile = {
  featureId: string;

  period: string;

  activeTenants: number;

  activeUsers: number;

  usageUnits: number;

  revenueAttributed: number;

  totalCost: number;

  contributionMargin: number;

  contributionMarginPercentage: number;

  supportRate: number;

  churnImpact?: number;

  strategicValue?: string;
};
```

---

# 50. Tenant Economics

```ts
export type TenantAIEconomics = {
  tenantId: string;

  period: string;

  subscriptionRevenue: number;

  aiVariableCost: number;

  infrastructureAllocation: number;

  humanSupportCost: number;

  incidentAllocation: number;

  totalCostToServe: number;

  contributionMargin: number;

  contributionMarginPercentage: number;

  budgetUtilization: number;

  usagePercentile?: number;
};
```

---

# 51. Tenant segmentation

Puede segmentarse por:

- Plan.
- Industry.
- Size.
- Users.
- Usage.
- Support.
- Margin.
- Growth.
- Risk.
- Strategic value.

No penalizar automáticamente a un tenant estratégico sin decisión.

---

# 52. Plan Economics

```ts
export type PlanEconomicsProfile = {
  planId: string;

  pricePerMonth: number;

  includedUsers: number;

  activeTenants: number;

  averageRevenuePerTenant: number;

  averageCostToServe: number;

  p90CostToServe: number;

  p99CostToServe: number;

  averageContributionMargin: number;

  marginPercentage: number;

  supportCost: number;

  abuseRisk: string;
};
```

---

# 53. NORA plan constraints

Datos confirmados:

- Plan inicial: 159 €/mes.
- Incluye 3 usuarios.
- Plan superior: 799 €/mes.

No inventar:

- Precio del plan intermedio.
- Usuarios del plan intermedio.
- Límites del plan intermedio.

El análisis debe trabajar con placeholders explícitos.

---

# 54. Price Floor

```ts
export type PlanPriceFloor = {
  planId: string;

  expectedMonthlyVariableCost: number;

  expectedMonthlySupportCost: number;

  allocatedFixedCost: number;

  riskReserve: number;

  targetGrossMarginPercentage: number;

  minimumSustainablePrice: number;
};
```

---

# 55. Price Floor formula

```text
Precio mínimo =
coste esperado total
÷ (1 − margen objetivo)
```

Ejemplo:

```text
Coste esperado:
40 €.

Margen objetivo:
80 %.

Precio mínimo:
200 €.
```

---

# 56. Usage Envelope

```ts
export type PlanUsageEnvelope = {
  planId: string;

  includedUsers: number;

  includedRuns?: number;

  includedDocuments?: number;

  includedStorageGb?: number;

  includedToolActions?: number;

  includedHumanReviews?: number;

  softLimits: Record<string, number>;

  hardLimits: Record<string, number>;

  overagePolicyId?: string;

  fairUsePolicyId?: string;
};
```

---

# 57. Units of pricing

Preferir unidades que el cliente comprende:

- Usuarios.
- Estudios.
- Documentos.
- Tiendas.
- Campañas.
- Expedientes.
- Acciones.
- Storage.

No vender:

```text
millones de tokens
```

salvo producto técnico.

---

# 58. Overage Policy

```ts
export type OveragePolicy = {
  id: string;

  planId: string;

  metric: string;

  freeBurstAllowance: number;

  action:
    | "charge"
    | "throttle"
    | "queue"
    | "block"
    | "upgrade_prompt"
    | "manual_review";

  unitPrice?: number;

  notificationThresholds: number[];

  gracePeriod?: string;
};
```

---

# 59. Fair Use Policy

Debe definir:

- Qué significa uso razonable.
- Qué constituye abuso.
- Qué señales se utilizan.
- Qué aviso se da.
- Qué acciones se aplican.
- Qué escalado existe.
- Cómo se revisa.

No usar “ilimitado” de forma engañosa.

---

# 60. Free Tier Economics

```ts
export type FreeTierEconomics = {
  planId: string;

  activeUsers: number;

  averageMonthlyCostPerUser: number;

  conversionRate: number;

  supportCostPerUser: number;

  abuseRate: number;

  customerAcquisitionValue: number;

  paybackMonths: number;
};
```

---

# 61. Cross-subsidization

```ts
export type CrossSubsidyDecision = {
  sourcePlanOrFeatureId: string;

  targetPlanOrFeatureId: string;

  monthlyAmount: number;

  rationale: string;

  expectedStrategicValue: string;

  approvedBy: string;

  reviewAt: string;
};
```

---

# 62. Cost Budget

```ts
export type AICostBudget = {
  scopeType:
    | "company"
    | "product"
    | "feature"
    | "tenant"
    | "agent"
    | "workflow"
    | "environment";

  scopeId: string;

  period: string;

  budgetAmount: number;

  warningThresholdPercentage: number;

  criticalThresholdPercentage: number;

  actionOnExceeded:
    | "alert"
    | "throttle"
    | "queue"
    | "block"
    | "require_approval";

  ownerId: string;
};
```

---

# 63. Budget Hierarchy

```text
COMPANY
  ↓
PRODUCT
  ↓
FEATURE
  ↓
TENANT
  ↓
AGENT
  ↓
RUN
```

---

# 64. Budget invariants

- Child budgets cannot exceed parent without override.
- Overrides require owner.
- Production and non-production separated.
- Critical workflows may have reserved budget.
- Evals have separate budget.
- Support and incidents have separate tracking.
- Budget exhaustion must not silently degrade quality.

---

# 65. Budget Utilization

```ts
export type BudgetUtilization = {
  scopeType: string;

  scopeId: string;

  period: string;

  budget: number;

  consumed: number;

  forecasted: number;

  utilizationPercentage: number;

  status:
    | "healthy"
    | "warning"
    | "critical"
    | "exceeded";
};
```

---

# 66. Cost Anomaly Detection

Señales:

- Cost spike.
- Token spike.
- Review spike.
- Retry spike.
- Fallback spike.
- Context growth.
- Tool fan-out.
- Storage growth.
- Eval duplication.
- Provider price change.
- Abuse.
- Idle cost.

---

# 67. Cost Anomaly Contract

```ts
export type AICostAnomaly = {
  id: string;

  scopeType: string;

  scopeId: string;

  expectedCost: number;

  observedCost: number;

  deviationPercentage: number;

  suspectedCauses: string[];

  severity:
    | "low"
    | "medium"
    | "high"
    | "critical";

  recommendedActions: string[];

  detectedAt: string;

  resolvedAt?: string;
};
```

---

# 68. Baselines

Puede usar:

- Rolling average.
- Same day of week.
- Tenant cohort.
- Plan cohort.
- Volume-normalized cost.
- Cost per unit.
- Cost per success.

No detectar anomalías solo por total absoluto.

---

# 69. Idle Economics

```ts
export type IdleCostRecord = {
  resourceType: string;

  resourceId: string;

  environment: string;

  period: string;

  provisionedCost: number;

  utilizedCost: number;

  idleCost: number;

  utilizationPercentage: number;

  recommendedAction: string;
};
```

---

# 70. Cost Optimization Hierarchy

Orden recomendado:

1. Eliminar trabajo innecesario.
2. Usar lógica determinista.
3. Reducir contexto.
4. Reducir reintentos.
5. Mejorar retrieval.
6. Evitar fan-out.
7. Usar cache segura.
8. Usar batch.
9. Elegir modelo adecuado.
10. Optimizar infraestructura.
11. Revisar pricing.

---

# 71. Deterministic First

Si una tarea puede resolverse con:

- SQL.
- Regla.
- Fórmula.
- Lookup.
- Template.
- Validator.
- Parser.

no debe usarse LLM por defecto.

---

# 72. Context Economics

```ts
export type ContextEconomics = {
  taskType: string;

  averageInputTokens: number;

  relevantTokenRatio: number;

  retrievalCost: number;

  modelCost: number;

  wastedTokenCost: number;

  optimizationOpportunity: string;
};
```

---

# 73. Retry Economics

```ts
export type RetryEconomics = {
  taskType: string;

  totalRuns: number;

  retriedRuns: number;

  retryRate: number;

  retryCost: number;

  recoveredSuccesses: number;

  costPerRecoveredSuccess: number;

  unnecessaryRetryRate: number;
};
```

---

# 74. Fallback Economics

```ts
export type FallbackEconomics = {
  taskType: string;

  primaryModelId: string;

  fallbackModelId: string;

  fallbackRate: number;

  fallbackCost: number;

  qualityDelta: number;

  latencyDeltaMs: number;

  successDelta: number;

  economicallyJustified: boolean;
};
```

---

# 75. Cache Economics

```ts
export type AICacheEconomics = {
  cacheType: string;

  hitRate: number;

  costAvoided: number;

  storageCost: number;

  invalidationCost: number;

  staleResultCost: number;

  privacyCost?: number;

  netSavings: number;
};
```

---

# 76. Batch Economics

```ts
export type AIBatchEconomics = {
  workloadType: string;

  interactiveCost: number;

  batchCost: number;

  costSavings: number;

  latencyIncreaseMs: number;

  slaCompatible: boolean;

  netBenefit: number;
};
```

---

# 77. RAG Economics

Debe incluir:

- Ingestion.
- OCR.
- Chunking.
- Embeddings.
- Storage.
- Retrieval.
- Reranking.
- Reindex.
- Deletion.
- Eval.
- Support.

---

# 78. RAG Cost Profile

```ts
export type RAGEconomicsProfile = {
  knowledgeBaseId: string;

  ingestionCost: number;

  monthlyStorageCost: number;

  monthlyRetrievalCost: number;

  monthlyRerankingCost: number;

  monthlyMaintenanceCost: number;

  monthlyEvalCost: number;

  resolvedQueries: number;

  costPerResolvedQuery: number;

  timeSavingsValue: number;

  netValue: number;
};
```

---

# 79. Memory Economics

```ts
export type MemoryEconomicsProfile = {
  memoryStoreId: string;

  storageCost: number;

  embeddingCost: number;

  retrievalCost: number;

  consolidationCost: number;

  privacyOperationsCost: number;

  deletionCost: number;

  usefulMemoryHitRate: number;

  attributedValue: number;

  netValue: number;
};
```

---

# 80. Observability Economics

```ts
export type ObservabilityEconomics = {
  serviceId: string;

  traceStorageCost: number;

  logStorageCost: number;

  metricCost: number;

  exportCost: number;

  incidentValue: number;

  debuggingTimeSavedValue: number;

  netValue: number;
};
```

---

# 81. Eval Economics

```ts
export type EvalEconomicsProfile = {
  suiteId: string;

  modelCallCost: number;

  judgeCost: number;

  humanReviewCost: number;

  infrastructureCost: number;

  totalCost: number;

  regressionsPrevented: number;

  estimatedFailureCostAvoided: number;

  netValue: number;
};
```

---

# 82. Build vs Buy

```ts
export type AITotalCostOfOwnership = {
  capability: string;

  evaluationPeriodMonths: number;

  implementationCost: number;

  licenseCost: number;

  infrastructureCost: number;

  operationsCost: number;

  securityCost: number;

  complianceCost: number;

  supportCost: number;

  migrationCost: number;

  exitCost: number;

  totalCost: number;
};
```

---

# 83. Build vs Buy Decision

```ts
export type BuildBuyDecision = {
  capability: string;

  options: {
    optionId: string;

    type:
      | "build"
      | "buy"
      | "managed"
      | "open_source"
      | "hybrid";

    tco: number;

    timeToMarketMonths: number;

    operationalRisk: string;

    lockInRisk: string;

    strategicFit: string;
  }[];

  selectedOptionId: string;

  rationale: string;

  approvedBy: string;
};
```

---

# 84. Forecasting

Debe proyectar:

- Tenants.
- Users.
- Usage.
- Cost.
- Revenue.
- Human review.
- Support.
- Infrastructure.
- Price changes.
- Model migrations.
- Abuse.
- Enterprise deals.
- Seasonality.

---

# 85. Forecast Scenarios

```ts
export type AIForecastScenario =
  | "base"
  | "growth"
  | "high_usage"
  | "provider_price_increase"
  | "model_migration"
  | "abuse"
  | "enterprise_customer"
  | "recession"
  | "seasonal_peak";
```

---

# 86. Cost Forecast

```ts
export type AICostForecast = {
  scenario: AIForecastScenario;

  period: string;

  projectedTenants: number;

  projectedUsers: number;

  projectedRuns: number;

  projectedRevenue: number;

  projectedVariableCost: number;

  projectedFixedCost: number;

  projectedHumanCost: number;

  projectedSupportCost: number;

  projectedGrossMargin: number;

  projectedMarginPercentage: number;

  assumptions: string[];
};
```

---

# 87. Forecast confidence

Toda previsión debe incluir:

- Fuente.
- Supuestos.
- Confidence.
- Range.
- Sensitivity.
- Owner.
- Date.
- Review date.

---

# 88. P50, P90 y P99

Medir:

- Cost per tenant.
- Runs.
- Tokens.
- Support.
- Review.
- Documents.
- Tool actions.

No diseñar pricing solo con promedio.

---

# 89. Margin Waterfall

```text
INGRESOS
− MODELOS
− TOOLS
− INFRA VARIABLE
− REVISIÓN HUMANA
− SOPORTE VARIABLE
− INCIDENTES
────────────────────
MARGEN DE CONTRIBUCIÓN
− COSTES FIJOS ASIGNADOS
────────────────────
MARGEN DEL PRODUCTO
```

---

# 90. Margin Record

```ts
export type AIMarginRecord = {
  scopeType:
    | "tenant"
    | "plan"
    | "feature"
    | "product"
    | "agent";

  scopeId: string;

  period: string;

  revenue: number;

  variableCost: number;

  contributionMargin: number;

  allocatedFixedCost: number;

  operatingMargin: number;

  marginPercentage: number;
};
```

---

# 91. Strategic Value

Una feature puede mantenerse aunque no tenga margen directo si:

- Reduce churn.
- Facilita upsell.
- Reduce soporte.
- Aumenta diferenciación.
- Permite vender servicio premium.
- Genera datos.
- Mejora onboarding.
- Reduce riesgo.

Debe documentarse.

---

# 92. Economics Gate

Antes de lanzar:

- Unit defined.
- Cost model.
- Value hypothesis.
- Usage forecast.
- Margin impact.
- Budget.
- Price compatibility.
- P90/P99.
- Alerts.
- Owner.
- Review date.
- Kill switch.

---

# 93. Economics Release Decision

```ts
export type AIEconomicsReleaseDecision = {
  featureId: string;

  decision:
    | "approve"
    | "pilot"
    | "approve_with_budget"
    | "defer"
    | "reject";

  maximumMonthlyCost: number;

  expectedMarginImpact: number;

  conditions: string[];

  ownerId: string;

  approvedAt: string;

  reviewAt: string;
};
```

---

# 94. Dashboards

Debe existir:

- Company FinOps dashboard.
- Product dashboard.
- Feature dashboard.
- Tenant dashboard.
- Agent dashboard.
- Plan dashboard.
- Budget dashboard.
- Forecast dashboard.
- Anomaly dashboard.
- Provider dashboard.

---

# 95. Company Dashboard

Mostrar:

- Total AI cost.
- Revenue.
- Gross margin.
- Contribution margin.
- Cost by product.
- Cost by provider.
- Cost by category.
- Budget utilization.
- Forecast.
- Anomalies.
- Top expensive tenants.
- Top valuable features.

---

# 96. Product Dashboard

Mostrar:

- Cost.
- Revenue.
- Margin.
- Unit economics.
- Active tenants.
- Cost per success.
- Human review.
- Support.
- Failure cost.
- Feature breakdown.

---

# 97. Feature Dashboard

Mostrar:

- Runs.
- Success rate.
- Cost per success.
- Value.
- Margin.
- P50/P90/P99.
- Review rate.
- Support rate.
- Retry cost.
- Fallback cost.
- Incidents.
- Trend.

---

# 98. Tenant Dashboard

Mostrar internamente:

- Revenue.
- Cost.
- Margin.
- Usage.
- Budget.
- Support.
- Review.
- Plan fit.
- Upgrade opportunity.
- Abuse signals.

No mostrar margen al cliente salvo decisión.

---

# 99. Provider Dashboard

Mostrar:

- Usage.
- Cost.
- Price changes.
- Error rate.
- Latency.
- Fallback.
- Quality.
- Cost per success.
- Availability.
- Forecast.

---

# 100. Application to NORA

Medir:

- Coste por estudio.
- Coste por explicación.
- Coste por PDF.
- Coste por OCR.
- Coste por Playbook query.
- Coste por CRM action.
- Coste por servicio jurídico.
- Coste por agency.
- Margin by plan.
- Support by plan.

---

# 101. NORA Tax Engine

Debe mantener:

- Coste marginal bajo.
- Alta trazabilidad.
- No usar LLM para cálculo.
- Coste de mantenimiento jurídico separado.
- Coste de actualización normativa separado.

---

# 102. NORA AI Summary

Medir:

- Model cost.
- Review rate.
- Correction rate.
- PDF generation.
- Support.
- Value from faster delivery.
- Upgrade impact.

---

# 103. NORA OCR

Medir:

- Pages.
- Vision cost.
- Extraction cost.
- Human review.
- Correction.
- Failure.
- Storage.
- Cost per validated document.

---

# 104. NORA Playbook

Medir:

- Ingestion.
- Reindex.
- Storage.
- Embeddings.
- Retrieval.
- Reranking.
- Answer.
- Time saved.
- Repeat-question reduction.
- Cost per resolved query.

---

# 105. NORA Legal Services

Medir:

- Professional time.
- AI time.
- Review.
- Communication.
- Documents.
- Liability reserve.
- Support.
- Margin per case.

No confundir margen SaaS con margen de servicio jurídico.

---

# 106. NORA Plans

Plan inicial:

```text
159 €/mes.
3 usuarios.
```

Plan superior:

```text
799 €/mes.
```

Plan intermedio:

```text
PENDING_CONFIGURATION
```

El modelo de rentabilidad debe usar:

```ts
{
  planId: "nora_intermediate",
  pricePerMonth: null,
  includedUsers: null,
  status: "pending_definition"
}
```

---

# 107. Application to EcomScaling IA

Medir:

- Coste por tienda.
- Coste por sync.
- Coste por analysis.
- Coste por alert.
- Coste por actionable alert.
- Coste por recommendation.
- Coste por executed action.
- Consultant leverage.
- Revenue uplift.
- Margin by plan.

---

# 108. EcomScaling quality parity

Growth y Scale:

- No deben usar modelos peores por plan.
- No deben reducir profundidad.
- No deben reducir calidad.

La diferenciación económica debe venir de:

- Volumen.
- Número de stores.
- Features.
- Automation capabilities.
- Integrations.
- Seats.
- Support.
- SLA.

---

# 109. EcomScaling Alert Economics

```ts
export type AlertEconomics = {
  alertType: string;

  totalAlerts: number;

  actionableAlerts: number;

  falsePositiveAlerts: number;

  computeCost: number;

  humanAttentionCost: number;

  costPerActionableAlert: number;

  valueGenerated: number;

  netValue: number;
};
```

---

# 110. EcomScaling Consultant Leverage

```ts
export type ConsultantLeverageMetric = {
  consultantId: string;

  clientsManagedBefore: number;

  clientsManagedAfter: number;

  hoursPerClientBefore: number;

  hoursPerClientAfter: number;

  qualityBefore: number;

  qualityAfter: number;

  incrementalCapacityValue: number;
};
```

---

# 111. Application to CRM

Medir:

- Coste por query.
- Coste por task.
- Coste por call summary.
- Coste por document.
- Coste por CRUD action.
- Time saved.
- Error avoided.
- Follow-up improved.
- Conversion impact.
- Margin by tenant.

---

# 112. CRM CRUD Economics

El valor puede superar ampliamente el coste del modelo.

Debe medir:

- Time saved.
- Error rate.
- Correction.
- Verification.
- Support.
- Failure cost.
- Adoption.

---

# 113. Arquitectura técnica propuesta

```text
src/
  ai/
    economics/
      economics.types.ts
      economics.config.ts

      ledger/
        cost-ledger.service.ts
        cost-source.registry.ts
        provider-price.registry.ts
        cost-reconciliation.service.ts
        cost-allocation.service.ts

      units/
        ai-unit.registry.ts
        outcome.service.ts
        unit-economics.service.ts
        cost-to-serve.service.ts

      human/
        human-review-cost.service.ts
        loaded-cost.registry.ts
        support-cost.service.ts
        incident-cost.service.ts

      value/
        value-event.service.ts
        time-savings.service.ts
        revenue-attribution.service.ts
        value-attribution.service.ts

      margins/
        tenant-margin.service.ts
        feature-margin.service.ts
        plan-margin.service.ts
        agent-margin.service.ts
        margin-waterfall.service.ts

      pricing/
        price-floor.service.ts
        usage-envelope.service.ts
        overage-policy.service.ts
        fair-use.service.ts
        cross-subsidy.service.ts

      budgets/
        cost-budget.service.ts
        budget-hierarchy.service.ts
        budget-utilization.service.ts
        anomaly-detection.service.ts

      forecasting/
        usage-forecast.service.ts
        cost-forecast.service.ts
        scenario.service.ts
        percentile.service.ts

      optimization/
        quality-cost.service.ts
        model-economics.service.ts
        context-economics.service.ts
        retry-economics.service.ts
        fallback-economics.service.ts
        cache-economics.service.ts
        batch-economics.service.ts
        rag-economics.service.ts
        memory-economics.service.ts
        observability-economics.service.ts

      business-cases/
        feature-business-case.service.ts
        automation-roi.service.ts
        build-buy.service.ts
        tco.service.ts

      reporting/
        company-finops-dashboard.service.ts
        product-finops-dashboard.service.ts
        feature-finops-dashboard.service.ts
        tenant-finops-dashboard.service.ts
        provider-finops-dashboard.service.ts
        showback.service.ts

      evaluation/
        economics-eval.service.ts
        economics-regression-gate.ts

      audit/
        economics-audit.service.ts

      tests/
      evals/

      adapters/
        nora/
        ecommerce/
        crm/
```

Adaptar al repositorio real.

---

# 114. Persistencia orientativa

Posibles tablas:

```text
ai_economics_cost_sources
ai_economics_provider_prices
ai_economics_cost_ledger
ai_economics_allocation_rules
ai_economics_units
ai_economics_outcomes
ai_economics_human_work
ai_economics_human_cost_profiles
ai_economics_support_costs
ai_economics_incident_costs
ai_economics_failure_costs
ai_economics_value_events
ai_economics_time_savings
ai_economics_unit_economics
ai_economics_tenant_margins
ai_economics_feature_margins
ai_economics_plan_margins
ai_economics_agent_margins
ai_economics_usage_envelopes
ai_economics_overage_policies
ai_economics_fair_use_policies
ai_economics_budgets
ai_economics_budget_utilization
ai_economics_cost_anomalies
ai_economics_forecasts
ai_economics_business_cases
ai_economics_release_decisions
```

---

# 115. Cost Ledger Table orientativa

```sql
CREATE TABLE ai_economics_cost_ledger (
  id uuid PRIMARY KEY,

  tenant_id uuid,

  product_id text NOT NULL,

  feature_id text,

  agent_id text,

  workflow_id text,

  run_id text,

  provider_id text,

  model_id text,

  environment text NOT NULL,

  cost_category text NOT NULL,

  quantity numeric NOT NULL,

  unit text NOT NULL,

  unit_cost numeric NOT NULL,

  total_cost numeric NOT NULL,

  currency text NOT NULL DEFAULT 'EUR',

  pricing_version_id uuid,

  measurement_type text NOT NULL,

  occurred_at timestamptz NOT NULL,

  trace_id text
);
```

---

# 116. Provider Price Table

```sql
CREATE TABLE ai_economics_provider_prices (
  id uuid PRIMARY KEY,

  provider_id text NOT NULL,

  model_id text,

  service_type text NOT NULL,

  effective_from timestamptz NOT NULL,

  effective_until timestamptz,

  pricing jsonb NOT NULL,

  currency text NOT NULL,

  source_reference text NOT NULL,

  verified_at timestamptz NOT NULL
);
```

---

# 117. Unit Table

```sql
CREATE TABLE ai_economics_units (
  id uuid PRIMARY KEY,

  product_id text NOT NULL,

  unit_type text NOT NULL,

  description text NOT NULL,

  success_definition text NOT NULL,

  measurement_source text NOT NULL,

  owner_id uuid NOT NULL,

  active boolean NOT NULL DEFAULT true,

  UNIQUE (product_id, unit_type)
);
```

---

# 118. Outcome Table

```sql
CREATE TABLE ai_economics_outcomes (
  id uuid PRIMARY KEY,

  tenant_id uuid,

  product_id text NOT NULL,

  feature_id text NOT NULL,

  unit_type text NOT NULL,

  run_id text,

  status text NOT NULL,

  quality_score numeric,

  verified boolean NOT NULL,

  human_review_required boolean NOT NULL,

  occurred_at timestamptz NOT NULL
);
```

---

# 119. Value Event Table

```sql
CREATE TABLE ai_economics_value_events (
  id uuid PRIMARY KEY,

  tenant_id uuid,

  product_id text NOT NULL,

  feature_id text NOT NULL,

  agent_id text,

  outcome_type text NOT NULL,

  estimated_value numeric NOT NULL,

  currency text NOT NULL DEFAULT 'EUR',

  evidence_references jsonb NOT NULL,

  confidence text NOT NULL,

  occurred_at timestamptz NOT NULL
);
```

---

# 120. Budget Table

```sql
CREATE TABLE ai_economics_budgets (
  id uuid PRIMARY KEY,

  scope_type text NOT NULL,

  scope_id text NOT NULL,

  period text NOT NULL,

  budget_amount numeric NOT NULL,

  warning_threshold_percentage numeric NOT NULL,

  critical_threshold_percentage numeric NOT NULL,

  action_on_exceeded text NOT NULL,

  owner_id uuid NOT NULL,

  UNIQUE (scope_type, scope_id, period)
);
```

---

# 121. Forecast Table

```sql
CREATE TABLE ai_economics_forecasts (
  id uuid PRIMARY KEY,

  scenario text NOT NULL,

  period text NOT NULL,

  assumptions jsonb NOT NULL,

  metrics jsonb NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  created_by uuid NOT NULL
);
```

---

# 122. Business Case Table

```sql
CREATE TABLE ai_economics_business_cases (
  id uuid PRIMARY KEY,

  feature_id text NOT NULL,

  assumptions jsonb NOT NULL,

  expected_usage numeric NOT NULL,

  expected_value numeric NOT NULL,

  implementation_cost numeric NOT NULL,

  monthly_operating_cost numeric NOT NULL,

  payback_months numeric,

  decision text NOT NULL,

  approved_by uuid,

  approved_at timestamptz
);
```

---

# 123. Metrics

```text
ai_total_cost
ai_cost_per_run
ai_cost_per_success
ai_cost_per_unit
ai_cost_per_tenant
ai_cost_per_feature
ai_cost_per_agent
ai_cost_per_workflow
ai_human_review_cost
ai_support_cost
ai_failure_cost
ai_value_generated
ai_net_value
ai_gross_margin
ai_contribution_margin
ai_roi
ai_payback_months
```

---

# 124. Operational economics metrics

```text
token_waste_ratio
retry_cost_ratio
fallback_cost_ratio
idle_cost_ratio
cache_net_savings
batch_net_savings
rag_cost_per_resolved_query
memory_value_ratio
cost_anomaly_rate
budget_utilization
provider_cost_variance
```

---

# 125. Pricing metrics

```text
plan_average_cost_to_serve
plan_p90_cost_to_serve
plan_p99_cost_to_serve
plan_margin_percentage
free_tier_cost_per_user
overage_revenue
overage_cost
upgrade_trigger_rate
fair_use_violation_rate
```

---

# 126. Value metrics

```text
time_saved_hours
revenue_generated
cost_avoided
errors_avoided
risk_reduction_value
capacity_created
consultant_leverage
support_reduction
churn_reduction
```

---

# 127. Alertas críticas

- Cost runaway.
- Budget exceeded.
- Negative margin.
- Provider price spike.
- Billing mismatch.
- Cost attribution missing.
- Tenant abuse.
- Human review spike.
- Retry storm.
- Fallback storm.
- Incident cost spike.
- Plan P99 exceeds sustainable price.
- Free tier abuse.
- Cost ledger reconciliation failure.

---

# 128. Alertas altas

- Margin below target.
- Cost per success degradation.
- Support cost spike.
- Review cost spike.
- Idle cost high.
- RAG cost rising.
- Cache negative savings.
- Forecast deviation.
- Usage envelope exceeded.
- Price version stale.
- Value evidence missing.

---

# 129. Alertas medias

- Low feature adoption.
- Low value event coverage.
- Unknown plan margin.
- Cost source stale.
- Allocation rule old.
- Budget owner missing.
- Forecast overdue.
- Business case review overdue.
- Cross-subsidy review overdue.

---

# 130. Unit Tests

- Cost calculation.
- Price version resolution.
- Currency handling.
- Allocation.
- Ledger deduplication.
- Unit definition.
- Outcome status.
- Human review cost.
- Failure cost.
- Cost-to-serve.
- Margin.
- Price floor.
- Budget hierarchy.
- Anomaly detection.
- Forecast.
- ROI.
- Payback.

---

# 131. Integration Tests

- Provider usage to ledger.
- Ledger to tenant margin.
- Human review to cost.
- Support to cost.
- Outcome to cost per success.
- Value event to ROI.
- Plan usage to envelope.
- Budget to alert.
- Forecast to dashboard.
- Invoice reconciliation.
- Feature release economics gate.

---

# 132. Economics Evals

Evaluar:

- Cost attribution completeness.
- Cost per success accuracy.
- Value attribution quality.
- Review cost estimates.
- Failure cost coverage.
- Plan margin.
- Forecast accuracy.
- Budget behavior.
- Anomaly detection.
- Pricing compatibility.

---

# 133. Economics Eval Case

```ts
export type EconomicsEvalCase = {
  id: string;

  scenario: string;

  inputCosts: AICostLedgerEntry[];

  outcomes: AIOutcomeRecord[];

  valueEvents: AIValueEvent[];

  expectedCostToServe: number;

  expectedCostPerSuccess: number;

  expectedMargin: number;

  tolerance: number;
};
```

---

# 134. Reconciliation Tests

Comparar:

- Provider invoice.
- Usage API.
- Internal ledger.
- Cloud invoice.
- Support records.
- Billing records.

Tolerancia configurable.

---

# 135. Quality Gates

Bloquear lanzamiento si:

- No existe unidad económica.
- No existe cost model.
- No existe value hypothesis.
- No existe usage forecast.
- No existe budget.
- No existe owner económico.
- No existe pricing compatibility.
- No existe P90/P99.
- No se incluye revisión humana.
- No se incluye soporte.
- No se incluye failure cost.
- Cost attribution coverage insuficiente.
- Margin negativo sin aprobación.
- Cost anomaly detection ausente.
- No existe review date.
- No existe kill switch.
- Cost ledger no reconcilia.

---

# 136. Fase 0 — Análisis exhaustivo

Analizar:

- Costs.
- Prices.
- Plans.
- Agents.
- Features.
- Usage.
- Providers.
- Human work.
- Support.
- Failures.
- Value.
- Margins.
- Budgets.
- Forecasts.
- Billing.

Entregables:

- Inventarios.
- Matrices.
- Cost map.
- Value map.
- Unit map.
- Margin map.
- Gaps.
- Architecture.
- Persistence.
- Dashboards.
- Tests.
- Evals.
- Owners.

No implementar todavía.

---

# 137. Fase 1 — Cost Ledger

Implementar:

- Cost categories.
- Cost sources.
- Provider prices.
- Ledger.
- Reconciliation.
- Basic dashboard.

---

# 138. Fase 2 — Units and Outcomes

Implementar:

- Unit registry.
- Outcome records.
- Success definitions.
- Cost per success.
- Tests.

---

# 139. Fase 3 — Human and Support Costs

Implementar:

- Loaded cost.
- Human work.
- Review costs.
- Support costs.
- Incident costs.

---

# 140. Fase 4 — Cost-to-Serve

Implementar:

- Feature.
- Tenant.
- Agent.
- Workflow.
- Product.
- Allocation.

---

# 141. Fase 5 — Value Events

Implementar:

- Time saved.
- Cost avoided.
- Revenue attribution.
- Evidence.
- Confidence.

---

# 142. Fase 6 — Margins

Implementar:

- Tenant margin.
- Feature margin.
- Agent margin.
- Plan margin.
- Waterfall.

---

# 143. Fase 7 — Pricing

Implementar:

- Price floors.
- Usage envelopes.
- Overage.
- Fair use.
- Cross-subsidy.

---

# 144. Fase 8 — Budgets

Implementar:

- Hierarchy.
- Utilization.
- Alerts.
- Actions.
- Overrides.

---

# 145. Fase 9 — Forecasting

Implementar:

- Usage.
- Cost.
- Revenue.
- Margin.
- Scenarios.
- P50/P90/P99.

---

# 146. Fase 10 — Optimization

Implementar:

- Quality-cost.
- Retry economics.
- Fallback economics.
- Cache economics.
- Batch economics.
- RAG economics.
- Memory economics.

---

# 147. Fase 11 — Business Cases

Implementar:

- ROI.
- Payback.
- Build vs buy.
- TCO.
- Release economics gate.

---

# 148. Fase 12 — Product Adapters

Implementar:

- NORA.
- EcomScaling.
- CRM.

---

# 149. Fase 13 — Dashboards and Audit

Implementar:

- Company.
- Product.
- Feature.
- Tenant.
- Provider.
- Audit.
- Reconciliation.
- Reports.

---

# 150. Instrucciones directas para Codex

## Misión

Diseñar e integrar una arquitectura de AI Economics, FinOps & Unit Economics Engineering adaptada al SaaS real.

## Regla obligatoria

Antes de implementar, analiza:

- Usage.
- Costs.
- Provider prices.
- Human review.
- Support.
- Failures.
- Value.
- Revenue.
- Plans.
- Pricing.
- Budgets.
- Forecasts.
- Margins.
- Billing.

## Restricciones

1. No implementar antes del análisis.
2. No medir solo tokens.
3. No ignorar costes humanos.
4. No ignorar soporte.
5. No ignorar fallos.
6. No inventar valor.
7. No inventar plan intermedio.
8. No cambiar pricing automáticamente.
9. No reducir calidad sin gate.
10. No eliminar HITL obligatorio.
11. No marcar terminado sin reconciliación.
12. No marcar terminado sin forecast.
13. Distinguir measured, allocated y estimated.
14. Documentar desviaciones.

---

# 151. Primera tarea recomendada para Codex

```text
Analiza exhaustivamente el repositorio, la facturación y el producto
para diseñar una arquitectura de AI Economics, FinOps & Unit Economics.

No implementes todavía nuevas tablas económicas.

Objetivos:

1. Identificar sources de coste.
2. Identificar provider prices.
3. Identificar model usage.
4. Identificar tool costs.
5. Identificar infrastructure costs.
6. Identificar storage costs.
7. Identificar observability costs.
8. Identificar human review.
9. Identificar support.
10. Identificar incidents.
11. Identificar failures.
12. Identificar plans.
13. Identificar prices.
14. Identificar usage limits.
15. Identificar features.
16. Identificar agents.
17. Identificar workflows.
18. Identificar economic units.
19. Identificar outcomes.
20. Identificar value events.
21. Identificar revenue.
22. Identificar margins.
23. Identificar budgets.
24. Identificar forecasts.
25. Identificar billing.
26. Crear cost-source matrix.
27. Crear unit map.
28. Crear value map.
29. Crear plan-envelope matrix.
30. Crear plan-margin matrix.
31. Crear human-review matrix.
32. Crear failure-cost matrix.
33. Proponer Cost Ledger.
34. Proponer Provider Price Registry.
35. Proponer Unit Registry.
36. Proponer Outcome Registry.
37. Proponer Cost-to-Serve.
38. Proponer Value Events.
39. Proponer Margin Services.
40. Proponer Price Floor.
41. Proponer Usage Envelopes.
42. Proponer Budgets.
43. Proponer Forecasting.
44. Proponer Anomaly Detection.
45. Proponer ROI.
46. Proponer Dashboards.
47. Proponer arquitectura.
48. Proponer persistencia.
49. Proponer archivos.
50. Proponer fases.
51. Proponer tests.
52. Proponer evals.
53. Proponer metrics.
54. Proponer alerts.

Antes de modificar código, entrega:

a) diagnóstico,
b) cost map,
c) unit map,
d) value map,
e) plan economics,
f) gaps,
g) architecture,
h) persistence,
i) exact files,
j) migration plan.

Restricciones:

- No implementes todavía.
- No inventes costes.
- No inventes ingresos.
- No inventes plan intermedio.
- No marques terminado sin validación.
```

---

# 152. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de
AI Economics, FinOps & Unit Economics Engineering.

Implementa solo:

1. Cost categories.
2. Cost Source Registry.
3. Provider Price Registry.
4. Cost Ledger.
5. Unit Registry.
6. Outcome Registry.
7. Basic Cost-to-Serve.
8. Cost per successful outcome.
9. Basic tenant and feature attribution.
10. Reconciliation tests.
11. Basic FinOps dashboard.

No implementes todavía:

- Pricing automation.
- Full plan economics.
- Full forecasting.
- Full ROI.
- All products.
- Automatic budget blocking.

No inventes valores.
Usa null, pending o configurable.
Documenta cada desviación.
```

---

# 153. ADR recomendados

- ADR: cost taxonomy.
- ADR: cost sources.
- ADR: provider price registry.
- ADR: cost ledger.
- ADR: allocation methods.
- ADR: AI units.
- ADR: outcome definitions.
- ADR: cost-to-serve.
- ADR: human review economics.
- ADR: support costs.
- ADR: failure costs.
- ADR: value events.
- ADR: time savings.
- ADR: revenue attribution.
- ADR: tenant economics.
- ADR: feature economics.
- ADR: plan economics.
- ADR: price floors.
- ADR: usage envelopes.
- ADR: overage.
- ADR: fair use.
- ADR: budgets.
- ADR: anomaly detection.
- ADR: forecasting.
- ADR: quality-cost frontier.
- ADR: build vs buy.
- ADR: dashboards.
- ADR: economics release gate.

---

# 154. Criterios de aceptación

- [ ] Existe Cost Ledger.
- [ ] Existen fuentes de coste.
- [ ] Existen precios versionados.
- [ ] Existen unidades económicas.
- [ ] Existen outcomes.
- [ ] Existe coste por éxito.
- [ ] Existe coste humano.
- [ ] Existe coste de soporte.
- [ ] Existe coste de fallos.
- [ ] Existe Cost-to-Serve.
- [ ] Existen Value Events.
- [ ] Existe margen por feature.
- [ ] Existe margen por tenant.
- [ ] Existe margen por agente.
- [ ] Existe margen por plan.
- [ ] Existen price floors.
- [ ] Existen usage envelopes.
- [ ] Existen budgets.
- [ ] Existe anomaly detection.
- [ ] Existen forecasts.
- [ ] Existe ROI.
- [ ] Existe build vs buy.
- [ ] Existen dashboards.
- [ ] Existe reconciliation.
- [ ] Existe economics gate.
- [ ] NORA validada.
- [ ] EcomScaling validada.
- [ ] CRM validado.

---

# 155. Definición de terminado

Una capacidad económica está terminada cuando:

1. Tiene owner.
2. Tiene unit.
3. Tiene cost sources.
4. Tiene price versions.
5. Tiene cost attribution.
6. Tiene outcome definition.
7. Tiene cost per success.
8. Tiene human cost.
9. Tiene support cost.
10. Tiene failure cost.
11. Tiene value hypothesis.
12. Tiene value measurement.
13. Tiene margin.
14. Tiene budget.
15. Tiene forecast.
16. Tiene anomaly detection.
17. Tiene dashboard.
18. Tiene reconciliation.
19. Tiene review date.
20. Está validada con datos reales.

---

# 156. Resumen ejecutivo

Secuencia correcta:

```text
DEFINIR UNIDAD
  ↓
MEDIR COSTE
  ↓
MEDIR OUTCOME
  ↓
CALCULAR COSTE POR ÉXITO
  ↓
MEDIR VALOR
  ↓
CALCULAR MARGEN
  ↓
FIJAR BUDGET
  ↓
FORECAST
  ↓
OPTIMIZAR
  ↓
REVISAR PRECIO, LÍMITES O ROADMAP
```

La plataforma común debe proporcionar:

- Cost Source Registry.
- Provider Price Registry.
- Cost Ledger.
- Cost Allocation.
- Unit Registry.
- Outcome Registry.
- Cost-to-Serve.
- Human Cost.
- Support Cost.
- Failure Cost.
- Value Events.
- Margin Services.
- Price Floors.
- Usage Envelopes.
- Overage.
- Fair Use.
- Budgets.
- Anomaly Detection.
- Forecasting.
- Quality-Cost Frontier.
- ROI.
- Build vs Buy.
- Dashboards.
- Economics Gate.

Cada producto debe aportar:

- Units.
- Outcomes.
- Value definitions.
- Plan assumptions.
- Product-specific costs.
- Product-specific margins.
- Product-specific dashboards.
- Product-specific owners.

AI Economics, FinOps & Unit Economics Engineering no es:

```text
contar tokens
```

Es:

```text
entender el coste total,
el resultado correcto,
el valor creado
y el margen sostenible
de cada capacidad de IA
```
