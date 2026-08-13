# AI Strategy, Portfolio, Maturity & Continuous Improvement Engineering

## Estado del documento

- **Tipo:** especificación estratégica, de portfolio, madurez y mejora continua.
- **Ámbito:** NORA, EcomScaling IA, CRM/SaaS y capacidades compartidas de IA.
- **Objetivo:** convertir los 21 dominios técnicos y organizativos anteriores en una estrategia ejecutable, un portfolio priorizado, un modelo de madurez, un roadmap por capacidades y un sistema permanente de aprendizaje y mejora.
- **Audiencia:** dirección, producto, arquitectura, ingeniería, IA, plataforma, operaciones, seguridad, privacidad, legal, QA, FinOps y Codex.
- **Prioridad:** crítica.
- **Principio rector:** la estrategia de IA debe indicar qué capacidades construir, por qué, en qué orden, con qué inversión, bajo qué restricciones y qué evidencia determinará si deben escalarse, corregirse o retirarse.
- **Estado esperado:** documento vivo, versionado y conectado con los 21 dominios anteriores.
- **Fecha de referencia:** 31 de julio de 2026.
- **Relación con el siguiente artefacto:** este documento cierra la definición conceptual. Después debe crearse un único roadmap maestro de implementación por etapas que actúe como archivo guía para Codex y enlace todos los MD especializados.

---

# 1. Propósito

Este documento define cómo implementar **AI Strategy, Portfolio, Maturity & Continuous Improvement Engineering** en una organización con múltiples productos SaaS y sistemas de IA.

Debe permitir:

- Definir una tesis estratégica de IA.
- Definir non-goals.
- Distinguir capacidades diferenciadoras y commodity.
- Crear un mapa de capacidades.
- Evaluar madurez.
- Definir target state.
- Identificar gaps.
- Crear iniciativas.
- Priorizar portfolio.
- Modelar dependencias.
- Crear olas de transformación.
- Crear roadmap.
- Establecer stage gates.
- Diseñar pilotos.
- Definir scale criteria.
- Definir stop criteria.
- Medir beneficios.
- Gestionar deuda de capacidades.
- Mantener technology radar.
- Gestionar experimentos.
- Realizar strategy reviews.
- Mantener aprendizaje continuo.
- Alinear NORA, EcomScaling IA y CRM.
- Preparar el roadmap maestro de implementación.

---

# 2. Regla obligatoria de análisis previo

Antes de crear una estrategia o roadmap, Codex debe analizar:

- Los 21 MD anteriores.
- El repositorio real.
- Los productos reales.
- Los sistemas de IA existentes.
- Los sistemas deterministas.
- Los agentes.
- Las tools.
- Los workflows.
- Los modelos.
- Los prompts.
- Los datos.
- Las knowledge bases.
- La arquitectura.
- La infraestructura.
- Los equipos.
- Los owners.
- Los costes.
- Los riesgos.
- Los incidentes.
- Los clientes.
- Los planes comerciales.
- Los contratos.
- Los gaps.
- Las dependencias.
- La capacidad humana.
- La madurez actual.

Codex no debe construir un roadmap genérico que ignore el estado real.

---

# 3. Prohibiciones para Codex

Codex no debe:

- Crear una estrategia basada únicamente en tendencias.
- Priorizar por entusiasmo.
- Convertir cada idea en agente.
- Usar IA cuando una solución determinista sea mejor.
- Crear un roadmap solo de features.
- Ignorar plataforma.
- Ignorar seguridad.
- Ignorar privacidad.
- Ignorar gobernanza.
- Ignorar operaciones.
- Ignorar FinOps.
- Ignorar owners.
- Ignorar capacidad.
- Empezar capas superiores sin dependencias.
- Mantener pilotos indefinidamente.
- Mantener sistemas por coste hundido.
- Confundir número de agentes con madurez.
- Confundir actividad con valor.
- Inventar fechas.
- Inventar presupuestos.
- Inventar planes.
- Inventar owners.
- Marcar iniciativas completas sin evidencia.
- Duplicar en el roadmap maestro todo el contenido de los MD.
- Convertir el archivo guía en otra especificación monolítica.
- Permitir que Codex elija libremente qué MD ignorar.
- Implementar varios dominios críticos simultáneamente sin secuencia.

---

# 4. Entregables previos obligatorios

Antes de modificar código, Codex debe entregar:

1. Inventario de capacidades.
2. Inventario de sistemas.
3. Inventario de productos.
4. Inventario de agentes.
5. Inventario de tools.
6. Inventario de workflows.
7. Inventario de modelos.
8. Inventario de prompts.
9. Inventario de datos.
10. Inventario de knowledge bases.
11. Inventario de riesgos.
12. Inventario de owners.
13. Inventario de costes.
14. Inventario de deuda.
15. Inventario de iniciativas.
16. Capability map.
17. Dependency graph.
18. Maturity assessment.
19. Target state.
20. Gap analysis.
21. Portfolio.
22. Prioritization.
23. Transformation waves.
24. Roadmap.
25. Stage gates.
26. Pilot criteria.
27. Scale criteria.
28. Stop criteria.
29. Benefits scorecard.
30. Improvement loop.
31. Technology radar.
32. Experiment portfolio.
33. Master architecture map.
34. Master implementation roadmap proposal.

---

# 5. Definición

**AI Strategy, Portfolio, Maturity & Continuous Improvement Engineering** conecta:

```text
ESTRATEGIA
  ↓
CAPACIDADES
  ↓
PORTFOLIO
  ↓
ROADMAP
  ↓
INVERSIÓN
  ↓
EJECUCIÓN
  ↓
RESULTADOS
  ↓
APRENDIZAJE
  ↓
NUEVA ESTRATEGIA
```

No es una presentación.

Es un sistema de decisión.

---

# 6. Por qué es el punto final

Los dominios anteriores responden:

- Cómo razonar.
- Cómo gestionar contexto.
- Cómo ejecutar tools.
- Cómo orquestar.
- Cómo mantener estado.
- Cómo recuperar.
- Cómo evaluar.
- Cómo supervisar.
- Cómo observar.
- Cómo proteger.
- Cómo gobernar.
- Cómo operar.
- Cómo medir coste.
- Cómo organizar personas.

Este dominio responde:

```text
¿Para qué?
¿Qué primero?
¿Qué después?
¿Qué compartir?
¿Qué mantener separado?
¿Qué escalar?
¿Qué retirar?
¿Cómo medir el avance?
```

---

# 7. AI Strategy Thesis

```ts
export type AIStrategyThesis = {
  id: string;

  organizationId: string;

  strategicPeriod: string;

  businessObjectives: string[];

  aiOpportunities: string[];

  nonGoals: string[];

  differentiatingCapabilities: string[];

  commodityCapabilities: string[];

  riskAppetite: string;

  investmentPrinciples: string[];

  approvedBy: string[];

  approvedAt: string;

  reviewAt: string;
};
```

---

# 8. Tesis estratégica recomendada

```text
La IA no sustituirá:

- Motores deterministas.
- Permisos.
- Fuentes canónicas.
- Revisión profesional.
- Decisiones humanas críticas.

La ventaja competitiva se construirá conectando:

- Datos empresariales.
- Conocimiento privado.
- Motores deterministas.
- Agentes especializados.
- Tools controladas.
- Workflows durables.
- Supervisión.
- Trazabilidad.
- Medición de valor.
```

---

# 9. Tesis por producto

## NORA

```text
Convertir conocimiento fiscal, jurídico y operativo inmobiliario
en un sistema de cierre, delegación y ejecución controlada.
```

## EcomScaling IA

```text
Convertir datos dispersos de ecommerce
en diagnóstico, recomendación y ejecución medible.
```

## CRM

```text
Convertir el CRM en una interfaz operativa
para consultar, decidir y ejecutar
sin perder permisos ni trazabilidad.
```

---

# 10. Strategic Non-Goals

```ts
export type AIStrategicNonGoal = {
  id: string;

  statement: string;

  rationale: string;

  prohibitedInvestments: string[];

  reviewAt: string;
};
```

---

# 11. Non-goals recomendados

- No crear un modelo fundacional propio.
- No sustituir el motor fiscal con un LLM.
- No ejecutar CRUD crítico sin autorización.
- No ofrecer autonomía ilimitada.
- No construir infraestructura genérica sin necesidad repetida.
- No crear conectores sin demanda.
- No guardar memoria por defecto.
- No convertir todo en chat.
- No crear agentes por marketing.
- No usar modelos para reglas deterministas.
- No degradar calidad por plan de forma silenciosa.
- No mantener sistemas sin owner.
- No mantener sistemas sin evals.
- No mantener sistemas sin valor medido.

---

# 12. Strategic Horizons

## Horizonte 1 — Fiabilidad y control

- Contratos.
- Evals.
- Tools.
- Permisos.
- Observabilidad.
- Seguridad.
- Durable execution.

## Horizonte 2 — Plataforma y reutilización

- Gateways.
- Registries.
- RAG.
- Memory.
- UX común.
- FinOps.
- Developer plane.

## Horizonte 3 — Escala y diferenciación

- Multi-product.
- Automatización avanzada.
- Enterprise.
- Ecosistema.
- Integraciones profundas.
- Servicios premium.
- Portfolio adaptativo.

---

# 13. Capability Map

```text
AI STRATEGY
├── Product & UX
├── Context
├── Tools
├── Agent Loops
├── Orchestration
├── State
├── Reliability
├── Durable Execution
├── Models
├── Data & Knowledge
├── Security
├── Privacy
├── Governance
├── Platform
├── Economics
├── Organization
└── Continuous Improvement
```

---

# 14. Capability Record

```ts
export type AICapabilityRecord = {
  id: string;

  name: string;

  domain: string;

  description: string;

  strategicImportance:
    | "commodity"
    | "enabling"
    | "differentiating"
    | "critical";

  currentMaturity: number;

  targetMaturity: number;

  ownerId: string;

  productIds: string[];

  dependencies: string[];

  mdReference: string;

  investmentStatus:
    | "not_planned"
    | "planned"
    | "funded"
    | "in_progress"
    | "operational"
    | "retiring";
};
```

---

# 15. Differentiating vs Commodity

## Diferenciadoras

- Motor fiscal inmobiliario.
- Playbook estructurado.
- Conocimiento jurídico inmobiliario.
- Agentes operativos especializados.
- Conexión cálculo + conocimiento + CRM.
- Automatización ecommerce basada en datos reales.
- Workflows inmobiliarios específicos.
- Servicios jurídicos integrados.

## Commodity

- Model inference.
- Vector storage.
- Queues.
- Object storage.
- Authentication.
- Generic OCR.
- Generic observability.
- Generic workflow engine.

---

# 16. Build vs Buy Principle

Construir cuando:

- Existe diferenciación.
- Existe necesidad específica.
- Existe ventaja estratégica.
- Existe volumen.
- Existe capacidad operativa.

Comprar o usar managed service cuando:

- La capacidad es commodity.
- El mercado ya resuelve bien.
- El coste operativo propio sería excesivo.
- No existe ventaja en construir.

---

# 17. AI Maturity Model

```ts
export type AIMaturityLevel = 0 | 1 | 2 | 3 | 4 | 5;
```

---

# 18. Nivel 0 — Ad hoc

- Uso personal.
- Prompts no versionados.
- Sin owners.
- Sin evals.
- Sin trazabilidad.
- Sin políticas.
- Dependencia individual.

---

# 19. Nivel 1 — Experimental

- Pilotos.
- Casos aislados.
- Revisión manual.
- Métricas limitadas.
- Valor hipotético.
- Sin plataforma común.

---

# 20. Nivel 2 — Repetible

- Contratos.
- Versionado.
- Owners.
- Evals básicas.
- Logs.
- Tools controladas.
- Releases reproducibles.
- Casos de uso definidos.

---

# 21. Nivel 3 — Operado

- SLO.
- Runbooks.
- Cost attribution.
- Security.
- Privacy.
- Governance.
- Support.
- Incident response.
- Human oversight.

---

# 22. Nivel 4 — Escalado

- Plataforma común.
- Multi-product.
- Equipos federados.
- FinOps.
- Portfolio.
- Capacity planning.
- Continuous evaluation.
- Tenant configuration.

---

# 23. Nivel 5 — Adaptativo

- Mejora continua.
- Portfolio dinámico.
- Valor medido.
- Model migrations.
- Incident learning.
- Cost optimization.
- Retirement.
- Rapid adaptation.

---

# 24. Maturity Assessment

```ts
export type AIMaturityAssessment = {
  id: string;

  scopeType:
    | "organization"
    | "product"
    | "capability"
    | "ai_system";

  scopeId: string;

  dimensions: {
    dimension: string;
    level: number;
    evidenceIds: string[];
    gaps: string[];
  }[];

  overallLevel: number;

  assessedBy: string[];

  assessedAt: string;

  reviewAt: string;
};
```

---

# 25. Dimensiones de madurez

- Strategy.
- Product.
- Context.
- Tools.
- Agents.
- Orchestration.
- State.
- Reliability.
- Models.
- Data.
- Knowledge.
- Security.
- Privacy.
- Governance.
- Human Experience.
- Platform.
- Economics.
- Organization.
- Operations.
- Evaluation.
- Continuous Improvement.

---

# 26. Target State

```ts
export type AITargetState = {
  id: string;

  targetDate: string;

  targetCapabilities: {
    capabilityId: string;
    targetMaturity: number;
    successCriteria: string[];
  }[];

  architecturePrinciples: string[];

  operatingModelPrinciples: string[];

  financialConstraints: string[];

  regulatoryConstraints: string[];

  approvedBy: string[];
};
```

---

# 27. Target State recomendado

La organización debe aspirar primero a:

```text
NIVEL 3 OPERADO
```

en dominios críticos:

- Security.
- Privacy.
- Governance.
- Reliability.
- Tools.
- Observability.
- Durable Execution.

Después a:

```text
NIVEL 4 ESCALADO
```

en:

- Platform.
- Multi-product reuse.
- FinOps.
- Organization.
- Continuous evaluation.

No es necesario alcanzar nivel 5 en todos los dominios.

---

# 28. Gap Analysis

```ts
export type AICapabilityGap = {
  capabilityId: string;

  currentState: string;

  targetState: string;

  gapType:
    | "technology"
    | "data"
    | "process"
    | "people"
    | "governance"
    | "economics"
    | "operations";

  severity:
    | "low"
    | "medium"
    | "high"
    | "critical";

  remediationInitiativeIds: string[];
};
```

---

# 29. Gap Prioritization

Prioridad máxima:

- Cross-tenant risk.
- Missing authorization.
- Missing source of truth.
- Missing evals in critical system.
- Missing owner.
- Missing recovery.
- Missing incident response.
- Missing privacy.
- Missing governance.
- Production without traceability.

---

# 30. AI Initiative

```ts
export type AIInitiative = {
  id: string;

  name: string;

  strategicObjectiveIds: string[];

  capabilityIds: string[];

  productIds: string[];

  ownerId: string;

  expectedValue: number;

  estimatedCost: number;

  riskLevel: string;

  dependencies: string[];

  mdReferences: string[];

  startDate?: string;
  targetDate?: string;

  status:
    | "proposed"
    | "assessing"
    | "funded"
    | "in_progress"
    | "blocked"
    | "completed"
    | "stopped";
};
```

---

# 31. Proyecto vs capacidad

```text
Proyecto:
Implantar Model Gateway.

Capacidad:
Operar routing, providers, budgets,
fallbacks, versions and incidents.
```

El roadmap debe financiar:

- Implementación.
- Operación.
- Mantenimiento.
- Mejora.
- Retirada.

---

# 32. Portfolio Structure

```text
AI PORTFOLIO
├── Product & Revenue
├── Platform & Reuse
├── Reliability
├── Security & Privacy
├── Governance & Compliance
├── Data & Knowledge
├── Economics
├── Organization
├── Technical Debt
└── Research
```

---

# 33. Portfolio Balance

Ejemplo orientativo:

```text
45 % Product & Revenue
20 % Platform & Reuse
15 % Reliability & Security
10 % Governance & Compliance
5 % Technical Debt
5 % Research
```

No usar estos porcentajes sin análisis real.

---

# 34. Portfolio Prioritization

Debe considerar:

- Strategic alignment.
- Expected value.
- User impact.
- Reuse.
- Regulatory urgency.
- Risk reduction.
- Delivery confidence.
- Cost.
- Complexity.
- Dependencies.
- Capacity.
- Time to value.
- Differentiation.
- Learning value.

---

# 35. Portfolio Score

```ts
export type AIPortfolioScore = {
  initiativeId: string;

  strategicAlignment: number;

  expectedValue: number;

  userImpact: number;

  reusePotential: number;

  regulatoryUrgency: number;

  riskReduction: number;

  deliveryConfidence: number;

  cost: number;

  complexity: number;

  dependencyPenalty: number;

  finalScore: number;
};
```

---

# 36. Dependency Graph

Dependencias críticas:

```text
Tools
→ Authorization
→ Audit
→ Idempotency
→ Verification

Agent Runtime
→ Contracts
→ Context
→ Model Gateway
→ Observability

Autonomous Workflows
→ Durable Execution
→ Approvals
→ Recovery

Memory
→ Privacy
→ Deletion
→ Authority

Platform Scale
→ FinOps
→ Operating Model
→ Governance
```

---

# 37. Initiative Dependency

```ts
export type AIInitiativeDependency = {
  initiativeId: string;

  dependsOnInitiativeId: string;

  dependencyType:
    | "hard"
    | "soft"
    | "regulatory"
    | "organizational";

  rationale: string;

  satisfied: boolean;
};
```

---

# 38. No iniciar capas superiores

Ejemplos:

- No implantar autonomía sin durable execution.
- No implantar memory sin privacy.
- No escalar agents sin evals.
- No implantar CRUD sin permissions.
- No implantar platform sin repeated need.
- No implantar pricing dinámico sin economics.
- No implantar enterprise sin operating model.

---

# 39. Transformation Waves

## Ola 0 — Inventario y verdad

- Systems.
- Agents.
- Tools.
- Models.
- Prompts.
- Data.
- Owners.
- Costs.
- Risks.
- Existing architecture.

## Ola 1 — Contratos y control

- Input/output contracts.
- Tool schemas.
- Permissions.
- Audit.
- Evals.
- Observability.
- Security foundations.

## Ola 2 — Fiabilidad y ejecución

- Durable state.
- Idempotency.
- Recovery.
- Verification.
- SLO.
- Runbooks.
- Incident response.

## Ola 3 — Datos, conocimiento y modelos

- Data contracts.
- RAG.
- Memory.
- Model Gateway.
- Prompt Registry.
- Schema Registry.

## Ola 4 — Plataforma y experiencia

- Agent Runtime.
- Tool Gateway.
- Developer plane.
- Contextual UX.
- Approval UX.
- Review queues.
- Product adapters.

## Ola 5 — Economía y organización

- Cost Ledger.
- Unit economics.
- Budgets.
- Margins.
- Teams.
- Ownership.
- Training.
- Capacity.

## Ola 6 — Escala y mejora continua

- Multi-product reuse.
- Portfolio.
- Technology radar.
- Model migrations.
- Benefits realization.
- Retirement.
- Continuous improvement.

---

# 40. Roadmap Item

```ts
export type AIRoadmapItem = {
  id: string;

  initiativeId: string;

  wave: number;

  milestone: string;

  targetDate?: string;

  ownerId: string;

  deliverables: string[];

  entryCriteria: string[];

  exitCriteria: string[];

  dependencyIds: string[];

  mdReferences: string[];

  status:
    | "not_started"
    | "ready"
    | "in_progress"
    | "blocked"
    | "completed";
};
```

---

# 41. Roadmap capability-based

Incorrecto:

```text
Q1 chatbot
Q2 agent
Q3 automation
```

Correcto:

```text
Fase 1:
contracts, permissions, evals, observability.

Fase 2:
durable execution, recovery, verification.

Fase 3:
shared runtime and platform.

Fase 4:
product workflows.

Fase 5:
economics, organization and scale.
```

---

# 42. Stage Gates

```text
IDEA
  ↓
DISCOVERY
  ↓
BUSINESS CASE
  ↓
RISK REVIEW
  ↓
PILOT
  ↓
PRODUCTION
  ↓
SCALE
  ↓
OPTIMIZE
  ↓
RETIRE
```

---

# 43. Stage Gate Decision

```ts
export type AIStageGateDecision = {
  initiativeId: string;

  gate:
    | "discovery"
    | "business_case"
    | "pilot"
    | "production"
    | "scale"
    | "retirement";

  requiredEvidence: string[];

  submittedEvidenceIds: string[];

  decision:
    | "advance"
    | "advance_with_conditions"
    | "hold"
    | "stop";

  rationale: string;

  approverIds: string[];

  decidedAt: string;
};
```

---

# 44. Pilot Design

Todo piloto debe definir:

- Hypothesis.
- Target users.
- Scope.
- Duration.
- Baseline.
- Metrics.
- Risk.
- Cost.
- Support.
- Stop criteria.
- Scale criteria.
- Owner.
- Product.
- Tenant.
- Data policy.

---

# 45. Pilot Contract

```ts
export type AIPilotDefinition = {
  id: string;

  initiativeId: string;

  hypothesis: string;

  targetUsers: string[];

  tenantIds: string[];

  baselineMetrics: Record<string, number>;

  successThresholds: Record<string, number>;

  stopThresholds: Record<string, number>;

  maximumCost: number;

  maximumDurationDays: number;

  ownerId: string;
};
```

---

# 46. Scale Criteria

Escalar cuando:

- Calidad suficiente.
- Security approved.
- Privacy approved.
- Governance approved.
- Value measured.
- Cost sustainable.
- Support ready.
- Owners assigned.
- Evals stable.
- Incident rate acceptable.
- Capacity available.
- Rollback ready.
- Monitoring active.

---

# 47. Stop Criteria

Detener cuando:

- No existe adoption.
- No existe value.
- Cost excessive.
- Risk uncontrollable.
- Quality stagnant.
- Support unsustainable.
- Deterministic alternative better.
- Provider unavailable.
- Regulation blocks.
- No operational capacity.
- No owner.
- No viable margin.
- No evidence.

---

# 48. Kill, Fix or Scale

```ts
export type AIInitiativeReviewDecision =
  | "scale"
  | "continue"
  | "fix"
  | "pause"
  | "merge"
  | "retire"
  | "kill";
```

---

# 49. Benefits Realization

Debe comparar:

- Expected value.
- Actual value.
- Expected cost.
- Actual cost.
- Adoption.
- Quality.
- Risk.
- Margin.
- Capacity.
- Support.

---

# 50. Benefits Record

```ts
export type AIBenefitsRealization = {
  initiativeId: string;

  period: string;

  expectedBenefits: Record<string, number>;

  realizedBenefits: Record<string, number>;

  expectedCost: number;

  actualCost: number;

  adoptionRate: number;

  varianceReasons: string[];

  correctiveActions: string[];

  ownerId: string;
};
```

---

# 51. Strategy Scorecard

## Value

- Revenue.
- Cost savings.
- Time saved.
- Adoption.
- Retention.

## Quality

- Eval score.
- Success rate.
- Correction rate.
- User trust.

## Risk

- Incidents.
- Security findings.
- Privacy findings.
- Governance gaps.

## Operations

- Availability.
- Latency.
- Recovery.
- Support.

## Capability

- Ownership.
- Training.
- Bus factor.
- Platform adoption.
- Maturity.

---

# 52. Strategy KPI

```ts
export type AIStrategyKPI = {
  id: string;

  strategicObjectiveId: string;

  name: string;

  definition: string;

  source: string;

  baseline: number;

  target: number;

  currentValue: number;

  ownerId: string;

  status:
    | "on_track"
    | "at_risk"
    | "off_track";
};
```

---

# 53. North Star Metrics

## NORA

Posibles:

- Operaciones inmobiliarias gestionadas con éxito.
- Tiempo ahorrado por expediente.
- Estudios convertidos en servicio o cierre.
- Workflows completados.

## EcomScaling IA

Posibles:

- Recomendaciones útiles ejecutadas.
- Valor incremental por consultor.
- Acciones correctas por tienda.

## CRM

Posibles:

- Workflows completados sin error.
- Tiempo administrativo ahorrado.
- Oportunidades con seguimiento correcto.

No usar:

```text
número de mensajes
```

como métrica principal.

---

# 54. Leading Indicators

- Adoption.
- Usage.
- Eval coverage.
- Tool success.
- Review rate.
- Training.
- Platform adoption.
- Owner coverage.
- Data freshness.

---

# 55. Lagging Indicators

- Revenue.
- Margin.
- Churn.
- Incidents.
- Retention.
- Cost savings.
- Support load.
- Failure cost.

---

# 56. Capability Debt

```ts
export type AICapabilityDebt = {
  id: string;

  capabilityId: string;

  debtType:
    | "technical"
    | "data"
    | "evaluation"
    | "security"
    | "privacy"
    | "governance"
    | "operations"
    | "organization"
    | "economics";

  description: string;

  impact: string;

  severity: string;

  remediationCost: number;

  ownerId: string;

  targetDate?: string;

  status:
    | "open"
    | "funded"
    | "remediating"
    | "accepted"
    | "closed";
};
```

---

# 57. Capability Debt examples

- Agent without owner.
- Tool without tests.
- Prompt without evals.
- RAG without Knowledge Owner.
- Workflow without runbook.
- Model without migration path.
- Feature without value metrics.
- Team without backup.
- System without retirement plan.
- Cost attribution missing.
- Privacy deletion missing.
- Governance classification pending.
- Support handoff missing.

---

# 58. Debt Portfolio

Debe tener:

- Budget.
- Owner.
- Priority.
- Deadline.
- Risk acceptance.
- Metrics.
- Review.

No dejar toda deuda detrás de features.

---

# 59. Continuous Improvement Loop

```text
OBSERVE
  ↓
MEASURE
  ↓
COMPARE
  ↓
LEARN
  ↓
PRIORITIZE
  ↓
CHANGE
  ↓
EVALUATE
  ↓
DEPLOY
```

---

# 60. Improvement Opportunity

```ts
export type AIImprovementOpportunity = {
  id: string;

  source:
    | "incident"
    | "eval"
    | "user_feedback"
    | "support"
    | "cost"
    | "security"
    | "privacy"
    | "regulatory_change"
    | "market_change";

  scopeId: string;

  problem: string;

  expectedImprovement: string;

  evidenceIds: string[];

  priority: number;

  ownerId: string;

  status:
    | "identified"
    | "assessing"
    | "planned"
    | "implemented"
    | "verified"
    | "rejected";
};
```

---

# 61. Learning System

Toda señal relevante debe poder convertirse en:

- Eval.
- Policy.
- Roadmap item.
- Training.
- Tool change.
- Product change.
- Prompt change.
- Data fix.
- Knowledge fix.
- Retirement.

---

# 62. Learning Sources

- Evals.
- Incidents.
- Human corrections.
- Support.
- Product analytics.
- Cost anomalies.
- Security tests.
- Privacy requests.
- Regulatory changes.
- Provider changes.
- Market changes.
- Customer feedback.
- Sales feedback.

---

# 63. Strategy Review Cadence

## Mensual

- Portfolio health.
- Cost.
- Adoption.
- Incidents.
- Blockers.
- Benefits.

## Trimestral

- Objectives.
- Maturity.
- Roadmap.
- Investment.
- Providers.
- Risk.
- Capacity.

## Anual

- Strategy thesis.
- Target state.
- Portfolio.
- Operating model.
- Budget.
- Build vs buy.
- Positioning.

## Event-driven

- Critical incident.
- Regulatory change.
- Provider failure.
- Major price change.
- Material new technology.
- Enterprise customer.
- Acquisition.

---

# 64. Strategy Review

```ts
export type AIStrategyReview = {
  id: string;

  reviewPeriod: string;

  thesisChanges: string[];

  portfolioChanges: string[];

  maturityChanges: string[];

  investmentChanges: string[];

  riskChanges: string[];

  stoppedInitiativeIds: string[];

  newInitiativeIds: string[];

  decisions: string[];

  approvedBy: string[];

  reviewedAt: string;
};
```

---

# 65. External Scanning

Monitorizar:

- Model capabilities.
- Provider changes.
- Prices.
- Regulation.
- Security threats.
- Competitors.
- Standards.
- Open source.
- Customer expectations.
- Infrastructure.

No modificar el roadmap por cada novedad.

---

# 66. Technology Radar

```ts
export type AITechnologyRadarItem = {
  id: string;

  technology: string;

  category:
    | "model"
    | "framework"
    | "provider"
    | "database"
    | "evaluation"
    | "security"
    | "tooling";

  recommendation:
    | "adopt"
    | "trial"
    | "assess"
    | "hold";

  rationale: string;

  evidenceIds: string[];

  ownerId: string;

  reviewAt: string;
};
```

---

# 67. Innovation Portfolio

Separar:

- Production.
- Pilots.
- Research.
- Experiments.
- Exploration.

Research no debe tener acceso automático a:

- Production data.
- Critical tools.
- Customers.
- Secrets.
- Real emails.
- Real payments.
- Sensitive documents.

---

# 68. Experiment Contract

```ts
export type AIExperiment = {
  id: string;

  hypothesis: string;

  scope: string;

  environment: string;

  dataPolicyId: string;

  maximumCost: number;

  maximumDurationDays: number;

  successCriteria: string[];

  stopCriteria: string[];

  ownerId: string;

  outcome:
    | "pending"
    | "validated"
    | "invalidated"
    | "inconclusive";
};
```

---

# 69. Master Architecture Map

```text
STRATEGY
  ↓
PORTFOLIO
  ↓
OPERATING MODEL
  ↓
GOVERNANCE
  ↓
PLATFORM
  ↓
AGENTS / DATA / TOOLS
  ↓
RELIABILITY / SECURITY / PRIVACY
  ↓
OBSERVABILITY / EVALS
  ↓
ECONOMICS
  ↓
CONTINUOUS IMPROVEMENT
```

---

# 70. Master Capability Registry

```ts
export type AIMasterCapabilityReference = {
  capabilityId: string;

  strategyReferenceId: string;

  mdReference: string;

  systemRegistryId?: string;

  platformServiceId?: string;

  ownerAssignmentId: string;

  maturityAssessmentId: string;

  economicsProfileId?: string;

  riskProfileId?: string;

  roadmapItemIds: string[];

  status: string;
};
```

---

# 71. Strategic Architecture Principles

1. Deterministic first.
2. LLMs do not own truth.
3. Tools over hallucinated action.
4. Least privilege.
5. Tenant isolation.
6. Human oversight proportional to risk.
7. Evidence over claims.
8. Version everything.
9. Evaluate before scale.
10. Shared capabilities after repeated need.
11. Cost per successful outcome.
12. Every production system needs an owner.
13. Every capability needs a retirement path.
14. Product quality must not degrade silently by plan.
15. Continuous improvement must be measurable.
16. No production without observability.
17. No autonomy without durable execution.
18. No memory without privacy.
19. No RAG without knowledge ownership.
20. No release without rollback.

---

# 72. Aplicación a NORA

Target state:

```text
NORA =
motor fiscal determinista
+ CRM inmobiliario
+ Playbook empresarial
+ agentes especializados
+ servicios jurídicos
+ workflows controlados
```

---

# 73. NORA strategic priorities

1. Consolidar contratos canónicos.
2. Estabilizar motor fiscal.
3. Integrar CRM y estudio.
4. Implantar observabilidad.
5. Implantar evals.
6. Construir Playbook.
7. Añadir copiloto contextual.
8. Implantar tools seguras.
9. Implantar workflows durables.
10. Medir valor y margen.
11. Escalar servicios jurídicos.
12. Reutilizar platform core.

---

# 74. NORA Strategy Scorecard

- Estudios completados.
- Tiempo hasta estudio.
- Operaciones gestionadas.
- Conversión a servicios.
- Uso Playbook.
- Acciones CRM.
- Correcciones.
- Incidentes.
- Coste por operación.
- Margen por plan.
- Retención.
- Support load.
- Owner coverage.

---

# 75. Aplicación a EcomScaling IA

Target state:

```text
datos multicanal
+ diagnóstico
+ memoria empresarial
+ recomendaciones
+ acciones controladas
+ valor medido
```

---

# 76. EcomScaling sequence

1. Data quality.
2. Metric definitions.
3. Connectors.
4. Analysis agents.
5. Recommendation evals.
6. Alerts.
7. Human approvals.
8. Controlled execution.
9. ROI.
10. Multi-store scale.

---

# 77. EcomScaling Strategy Scorecard

- Tiendas activas.
- Data freshness.
- Recomendaciones útiles.
- Alertas accionables.
- Acciones correctas.
- Tiempo ahorrado.
- Consultant leverage.
- Incremental value.
- Cost per store.
- Margin per plan.
- Incidents.
- Provider reliability.

---

# 78. Aplicación al CRM

Target state:

```text
CRM estructurado
+ RAG
+ copiloto contextual
+ tools CRUD
+ workflows durables
+ trazabilidad
```

---

# 79. CRM sequence

1. Domain services.
2. Permission model.
3. Tool Registry.
4. Intent routing.
5. RAG.
6. Contextual copilot.
7. CRUD approvals.
8. Durable workflows.
9. Analytics.
10. Continuous improvement.

---

# 80. CRM Strategy Scorecard

- Active users.
- Leads processed.
- Admin time saved.
- Tool success.
- Correction rate.
- Tasks completed.
- Reservations processed.
- Errors avoided.
- Support tickets.
- Cost per tenant.
- Retention.
- Workflow success.

---

# 81. Arquitectura técnica propuesta

```text
src/
  ai/
    strategy/
      strategy.types.ts
      strategy.config.ts

      thesis/
        strategy-thesis.service.ts
        strategic-non-goals.service.ts
        architecture-principles.service.ts

      capabilities/
        capability.registry.ts
        capability-map.service.ts
        capability-gap.service.ts
        capability-debt.service.ts

      maturity/
        maturity-model.service.ts
        maturity-assessment.service.ts
        target-state.service.ts

      portfolio/
        initiative.registry.ts
        portfolio.service.ts
        prioritization.service.ts
        dependency-graph.service.ts
        portfolio-balance.service.ts

      roadmap/
        transformation-wave.service.ts
        roadmap.service.ts
        milestone.service.ts

      gates/
        stage-gate.service.ts
        pilot-gate.service.ts
        scale-gate.service.ts
        retirement-gate.service.ts

      benefits/
        benefits-realization.service.ts
        strategy-kpi.service.ts
        scorecard.service.ts

      improvement/
        improvement-opportunity.service.ts
        learning-loop.service.ts
        strategy-review.service.ts

      research/
        technology-radar.service.ts
        experiment.service.ts
        external-scanning.service.ts

      master/
        master-capability.registry.ts
        architecture-map.service.ts
        roadmap-index.service.ts
        md-reference.registry.ts

      audit/
        strategy-audit.service.ts

      tests/

      adapters/
        nora/
        ecommerce/
        crm/
```

---

# 82. Persistencia orientativa

Posibles tablas:

```text
ai_strategy_theses
ai_strategy_non_goals
ai_strategy_architecture_principles
ai_strategy_capabilities
ai_strategy_maturity_assessments
ai_strategy_target_states
ai_strategy_capability_gaps
ai_strategy_capability_debt
ai_strategy_initiatives
ai_strategy_dependencies
ai_strategy_portfolio_scores
ai_strategy_roadmap_items
ai_strategy_stage_gate_decisions
ai_strategy_pilots
ai_strategy_benefits
ai_strategy_kpis
ai_strategy_improvement_opportunities
ai_strategy_reviews
ai_strategy_technology_radar
ai_strategy_experiments
ai_strategy_master_capabilities
ai_strategy_md_references
```

No crear sin revisar los registries especializados existentes.

---

# 83. Strategy Thesis Table orientativa

```sql
CREATE TABLE ai_strategy_theses (
  id uuid PRIMARY KEY,

  organization_id uuid NOT NULL,

  strategic_period text NOT NULL,

  business_objectives jsonb NOT NULL,

  ai_opportunities jsonb NOT NULL,

  non_goals jsonb NOT NULL,

  differentiating_capabilities jsonb NOT NULL,

  commodity_capabilities jsonb NOT NULL,

  risk_appetite text NOT NULL,

  investment_principles jsonb NOT NULL,

  approved_by jsonb NOT NULL,

  approved_at timestamptz NOT NULL,

  review_at timestamptz NOT NULL
);
```

---

# 84. Capability Table orientativa

```sql
CREATE TABLE ai_strategy_capabilities (
  id uuid PRIMARY KEY,

  capability_key text NOT NULL,

  name text NOT NULL,

  domain text NOT NULL,

  description text NOT NULL,

  strategic_importance text NOT NULL,

  current_maturity integer NOT NULL,

  target_maturity integer NOT NULL,

  owner_id uuid NOT NULL,

  product_ids jsonb NOT NULL,

  dependencies jsonb NOT NULL,

  md_reference text NOT NULL,

  investment_status text NOT NULL,

  UNIQUE (capability_key)
);
```

---

# 85. Initiative Table orientativa

```sql
CREATE TABLE ai_strategy_initiatives (
  id uuid PRIMARY KEY,

  initiative_key text NOT NULL,

  name text NOT NULL,

  strategic_objective_ids jsonb NOT NULL,

  capability_ids jsonb NOT NULL,

  product_ids jsonb NOT NULL,

  owner_id uuid NOT NULL,

  expected_value numeric,

  estimated_cost numeric,

  risk_level text NOT NULL,

  dependencies jsonb NOT NULL,

  md_references jsonb NOT NULL,

  status text NOT NULL,

  UNIQUE (initiative_key)
);
```

---

# 86. Roadmap Table orientativa

```sql
CREATE TABLE ai_strategy_roadmap_items (
  id uuid PRIMARY KEY,

  initiative_id uuid NOT NULL,

  wave integer NOT NULL,

  milestone text NOT NULL,

  target_date date,

  owner_id uuid NOT NULL,

  deliverables jsonb NOT NULL,

  entry_criteria jsonb NOT NULL,

  exit_criteria jsonb NOT NULL,

  dependency_ids jsonb NOT NULL,

  md_references jsonb NOT NULL,

  status text NOT NULL
);
```

---

# 87. Benefits Table orientativa

```sql
CREATE TABLE ai_strategy_benefits (
  id uuid PRIMARY KEY,

  initiative_id uuid NOT NULL,

  period text NOT NULL,

  expected_benefits jsonb NOT NULL,

  realized_benefits jsonb NOT NULL,

  expected_cost numeric NOT NULL,

  actual_cost numeric NOT NULL,

  adoption_rate numeric NOT NULL,

  variance_reasons jsonb NOT NULL,

  corrective_actions jsonb NOT NULL,

  owner_id uuid NOT NULL
);
```

---

# 88. Improvement Table orientativa

```sql
CREATE TABLE ai_strategy_improvement_opportunities (
  id uuid PRIMARY KEY,

  source text NOT NULL,

  scope_id text NOT NULL,

  problem text NOT NULL,

  expected_improvement text NOT NULL,

  evidence_ids jsonb NOT NULL,

  priority numeric NOT NULL,

  owner_id uuid NOT NULL,

  status text NOT NULL
);
```

---

# 89. Strategy Metrics

```text
ai_strategy_objectives_on_track
ai_capability_maturity_average
ai_capability_maturity_gap
ai_portfolio_value
ai_portfolio_cost
ai_portfolio_risk
ai_initiatives_on_track
ai_initiatives_blocked
ai_pilots_active
ai_pilots_stopped
ai_benefits_realization_rate
ai_capability_debt_total
ai_improvement_cycle_time
ai_retired_systems_total
```

---

# 90. Portfolio Metrics

```text
portfolio_product_percentage
portfolio_platform_percentage
portfolio_reliability_percentage
portfolio_security_percentage
portfolio_governance_percentage
portfolio_debt_percentage
portfolio_research_percentage
portfolio_dependency_blockers
portfolio_capacity_utilization
```

---

# 91. Maturity Metrics

```text
maturity_strategy
maturity_product
maturity_tools
maturity_agents
maturity_reliability
maturity_security
maturity_privacy
maturity_governance
maturity_platform
maturity_economics
maturity_organization
maturity_operations
```

---

# 92. Benefits Metrics

```text
expected_value
realized_value
benefit_variance
expected_cost
actual_cost
cost_variance
adoption_rate
time_to_value
payback_months
initiative_roi
```

---

# 93. Alertas críticas

- Production system outside strategy.
- Initiative without owner.
- Critical dependency ignored.
- Scale without evidence.
- Pilot without stop criteria.
- Negative value after review.
- Critical debt unfunded.
- Maturity regression in security.
- Maturity regression in privacy.
- Maturity regression in governance.
- Strategic initiative without capacity.
- Initiative complete without benefits review.

---

# 94. Alertas altas

- Roadmap blocked.
- Benefits below threshold.
- Cost above forecast.
- Pilot duration exceeded.
- Initiative without operations plan.
- Technology radar item overdue.
- Strategy review overdue.
- Target state off track.
- Portfolio imbalance.
- Capability debt growing.

---

# 95. Alertas medias

- Low maturity evidence coverage.
- KPI source stale.
- Initiative score outdated.
- Non-goal review overdue.
- Experiment inconclusive.
- Improvement opportunity stale.
- MD reference missing.
- Owner review overdue.

---

# 96. Unit Tests

- Maturity level validation.
- Capability dependency.
- Portfolio score.
- Stage gate.
- Pilot thresholds.
- Scale criteria.
- Stop criteria.
- Benefits calculation.
- Capability debt.
- Strategy KPI status.
- Improvement status.
- Technology radar status.
- Master capability references.

---

# 97. Integration Tests

- System Registry to capability.
- Capability to initiative.
- Initiative to roadmap.
- Roadmap to stage gate.
- Economics to benefits.
- Governance to scale gate.
- Operating model to capacity.
- Incident to improvement.
- Eval failure to roadmap.
- Debt to portfolio.
- MD reference to guide.

---

# 98. Strategy Evals

Evaluar:

- Strategic alignment.
- Dependency correctness.
- Portfolio balance.
- Maturity evidence.
- Roadmap realism.
- Pilot design.
- Scale decision quality.
- Stop decision quality.
- Benefits evidence.
- Improvement loop.
- Product alignment.

---

# 99. Scenario Tests

## New AI feature request

Expected:

- Intake.
- Strategic alignment.
- Capability mapping.
- Dependency check.
- Business case.
- Pilot.

## Critical incident

Expected:

- Strategy review if material.
- Improvement opportunity.
- Capability debt.
- Roadmap update.
- Training update.

## Provider price increase

Expected:

- Economics forecast.
- Technology radar.
- Model migration assessment.
- Portfolio decision.

## Low adoption

Expected:

- Benefits review.
- Product analysis.
- Fix, merge or retire.

## New regulation

Expected:

- Regulatory change.
- Strategy review.
- Roadmap reprioritization.
- Governance gate.

---

# 100. Quality Gates

Bloquear una iniciativa si:

- No existe alignment.
- No existe owner.
- No existe problem.
- No existe unit of value.
- No existe baseline.
- No existe business case.
- No existe risk assessment.
- No existen dependencies.
- No existe capacity.
- No existe budget.
- No existe pilot design.
- No existen stop criteria.
- No existen scale criteria.
- No existe operations plan.
- No existe retirement path.
- No existe maturity target.
- No existe benefits review.
- No existe MD reference.
- No existe source-of-truth guide reference.

---

# 101. Fase 0 — Consolidación documental

Objetivo:

- Reunir los 22 MD.
- Normalizar nombres.
- Crear índice.
- Identificar duplicidades.
- Identificar contradicciones.
- Identificar gaps.
- Mapear dependencias.
- Mapear owners.
- Mapear fuentes de verdad.

No implementar código.

---

# 102. Fase 1 — Strategy Thesis

Implementar:

- Thesis.
- Non-goals.
- Principles.
- Horizons.
- Product theses.
- Review cadence.

---

# 103. Fase 2 — Capability Map

Implementar:

- Capability Registry.
- MD references.
- Product mapping.
- Owners.
- Strategic importance.
- Dependencies.

---

# 104. Fase 3 — Maturity

Implementar:

- Maturity model.
- Assessments.
- Evidence.
- Target state.
- Gaps.

---

# 105. Fase 4 — Portfolio

Implementar:

- Initiative Registry.
- Scores.
- Portfolio balance.
- Owners.
- Capacity.
- Dependencies.

---

# 106. Fase 5 — Roadmap

Implementar:

- Transformation waves.
- Milestones.
- Entry criteria.
- Exit criteria.
- Dependencies.
- Product adapters.
- Shared capabilities.

---

# 107. Fase 6 — Gates

Implementar:

- Discovery gate.
- Business case gate.
- Pilot gate.
- Production gate.
- Scale gate.
- Retirement gate.

---

# 108. Fase 7 — Benefits

Implementar:

- KPIs.
- Scorecards.
- Expected value.
- Realized value.
- Cost variance.
- Adoption.
- Benefits review.

---

# 109. Fase 8 — Debt and Improvement

Implementar:

- Capability debt.
- Improvement opportunities.
- Learning loops.
- Incident-to-roadmap.
- Eval-to-roadmap.
- Support-to-roadmap.

---

# 110. Fase 9 — Technology Radar

Implementar:

- External scanning.
- Radar.
- Experiments.
- Build/buy reassessment.
- Provider review.

---

# 111. Fase 10 — Master Integration

Implementar:

- Master Capability Registry.
- Master Architecture Map.
- Master Roadmap Index.
- MD Reference Registry.
- Cross-domain gates.
- Product mappings.

---

# 112. Instrucciones directas para Codex

## Misión

Diseñar e integrar la capa estratégica final que conecte los 21 dominios anteriores.

## Regla obligatoria

Antes de implementar:

- Leer todos los MD.
- Analizar el repositorio.
- Crear capability map.
- Crear dependency graph.
- Crear maturity assessment.
- Crear target state.
- Crear portfolio.
- Crear transformation waves.
- Crear roadmap.
- Crear stage gates.
- Crear benefits scorecard.
- Crear master implementation proposal.

## Restricciones

1. No implementar antes del análisis.
2. No crear roadmap genérico.
3. No duplicar MD.
4. No ignorar dependencias.
5. No inventar fechas.
6. No inventar owners.
7. No inventar budgets.
8. No priorizar por entusiasmo.
9. No escalar sin evidence.
10. No mantener pilots indefinitely.
11. No marcar complete sin benefits review.
12. No sustituir los MD con un único documento.
13. El futuro archivo guía debe referenciar, no copiar.
14. Documentar contradicciones.
15. Documentar gaps.

---

# 113. Primera tarea recomendada para Codex

```text
Analiza los 22 documentos de arquitectura y el repositorio real
para construir una estrategia, capability map, maturity model,
portfolio y roadmap maestro de implementación.

No implementes código todavía.

Objetivos:

1. Indexar los 22 MD.
2. Identificar el propósito de cada MD.
3. Identificar dependencias.
4. Identificar solapamientos.
5. Identificar contradicciones.
6. Identificar gaps.
7. Identificar capabilities.
8. Identificar products.
9. Identificar systems.
10. Identificar owners.
11. Identificar current maturity.
12. Identificar target maturity.
13. Identificar critical risks.
14. Identificar product priorities.
15. Identificar shared platform priorities.
16. Crear Strategy Thesis.
17. Crear Non-Goals.
18. Crear Architecture Principles.
19. Crear Capability Map.
20. Crear Maturity Assessment.
21. Crear Target State.
22. Crear Gap Analysis.
23. Crear Initiative Registry.
24. Crear Portfolio.
25. Crear Dependency Graph.
26. Crear Transformation Waves.
27. Crear Stage Gates.
28. Crear Pilot Criteria.
29. Crear Scale Criteria.
30. Crear Stop Criteria.
31. Crear Benefits Scorecard.
32. Crear Capability Debt.
33. Crear Continuous Improvement Loop.
34. Crear Technology Radar.
35. Crear Master Architecture Map.
36. Proponer el Master Implementation Roadmap.

Antes de modificar código, entrega:

a) index de los 22 MD,
b) capability map,
c) dependency graph,
d) maturity assessment,
e) target state,
f) gaps,
g) portfolio,
h) transformation waves,
i) stage gates,
j) master implementation roadmap proposal.

Restricciones:

- No implementes todavía.
- No dupliques los MD.
- No inventes datos.
- No ignores contradicciones.
- No marques terminado sin validación.
```

---

# 114. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar únicamente
la capa documental y de control estratégica.

Implementa:

1. Strategy Thesis.
2. Non-Goals.
3. Architecture Principles.
4. Capability Registry.
5. MD Reference Registry.
6. Maturity Model.
7. Target State.
8. Initiative Registry.
9. Dependency Graph.
10. Roadmap Registry.
11. Stage Gate Records.
12. Benefits Records.
13. Capability Debt.
14. Strategy Reviews.
15. Tests.

No implementes todavía features de producto.

No dupliques contenido de los MD.

El archivo guía será la fuente de secuencia y estado,
pero cada MD seguirá siendo la fuente de detalle técnico.
```

---

# 115. ADR recomendados

- ADR: AI strategy thesis.
- ADR: strategic non-goals.
- ADR: architecture principles.
- ADR: capability map.
- ADR: maturity model.
- ADR: target state.
- ADR: capability gaps.
- ADR: initiative registry.
- ADR: portfolio scoring.
- ADR: portfolio balance.
- ADR: dependency graph.
- ADR: transformation waves.
- ADR: roadmap.
- ADR: stage gates.
- ADR: pilots.
- ADR: scale criteria.
- ADR: stop criteria.
- ADR: benefits realization.
- ADR: strategy scorecard.
- ADR: capability debt.
- ADR: continuous improvement.
- ADR: technology radar.
- ADR: experiment governance.
- ADR: master architecture map.
- ADR: MD reference registry.
- ADR: master implementation guide.

---

# 116. Criterios de aceptación

- [ ] Existe Strategy Thesis.
- [ ] Existen Non-Goals.
- [ ] Existen Architecture Principles.
- [ ] Existe Capability Map.
- [ ] Los 22 MD están indexados.
- [ ] Cada capability referencia su MD.
- [ ] Existe Maturity Model.
- [ ] Existe Maturity Assessment.
- [ ] Existe Target State.
- [ ] Existe Gap Analysis.
- [ ] Existe Initiative Registry.
- [ ] Existe Portfolio.
- [ ] Existe Dependency Graph.
- [ ] Existen Transformation Waves.
- [ ] Existe Roadmap.
- [ ] Existen Stage Gates.
- [ ] Existen Pilot Criteria.
- [ ] Existen Scale Criteria.
- [ ] Existen Stop Criteria.
- [ ] Existe Benefits Realization.
- [ ] Existe Strategy Scorecard.
- [ ] Existe Capability Debt.
- [ ] Existe Continuous Improvement.
- [ ] Existe Technology Radar.
- [ ] Existe Master Architecture Map.
- [ ] Existe Master Capability Registry.
- [ ] Existe propuesta de archivo guía.
- [ ] NORA está mapeada.
- [ ] EcomScaling IA está mapeada.
- [ ] CRM está mapeado.

---

# 117. Definición de terminado

Este dominio está terminado cuando:

1. La estrategia está documentada.
2. Los non-goals están documentados.
3. Las capabilities están inventariadas.
4. Cada capability tiene owner.
5. Cada capability tiene MD.
6. Cada capability tiene maturity.
7. Cada capability tiene target state.
8. Los gaps están priorizados.
9. Las iniciativas están registradas.
10. Las dependencias están modeladas.
11. El roadmap está secuenciado.
12. Los stage gates existen.
13. Los pilotos tienen stop criteria.
14. Los beneficios se miden.
15. La deuda se gestiona.
16. La mejora continua está activa.
17. El technology radar existe.
18. El master architecture map existe.
19. El master implementation guide está definido.
20. Todo ha sido validado con el estado real.

---

# 118. Índice conceptual de los 22 dominios

## Bloque 1 — Fundamentos del sistema

1. Harness Engineering.
2. Context Engineering.
3. Tool Engineering.
4. Agent Loop Engineering.
5. Multi-Agent Orchestration Engineering.

## Bloque 2 — Control y ejecución

6. State Engineering.
7. Evaluation Engineering.
8. Human-in-the-Loop Engineering.
9. Permission & Authorization Engineering.
10. Observability & Trace Engineering.

## Bloque 3 — Operación y robustez

11. Reliability & Recovery Engineering.
12. Durable State & Execution Engineering.
13. Model & Inference Engineering.
14. Data & Knowledge Engineering.

## Bloque 4 — Confianza

15. Security & Adversarial Engineering.
16. Privacy & Data Protection Engineering.
17. AI Governance & Regulatory Compliance Engineering.
18. AI Product & Human Experience Engineering.

## Bloque 5 — Escala

19. AI Platform & Infrastructure Engineering.
20. AI Economics, FinOps & Unit Economics Engineering.
21. AI Operating Model, Organization & Talent Engineering.

## Bloque 6 — Dirección

22. AI Strategy, Portfolio, Maturity & Continuous Improvement Engineering.

---

# 119. Relación con el roadmap maestro posterior

Después de completar este MD debe crearse un archivo distinto:

```text
00_AI_MASTER_IMPLEMENTATION_ROADMAP.md
```

Su función será:

- Ser la entrada principal para Codex.
- Explicar qué MD leer en cada fase.
- Definir orden de implementación.
- Definir dependencias.
- Definir estados.
- Definir gates.
- Definir entregables.
- Definir qué no debe implementarse todavía.
- Definir cómo actualizar progreso.
- Definir cómo registrar decisiones.
- Definir cómo evitar contradicciones.
- Enlazar a cada MD especializado.

No debe:

- Copiar miles de líneas.
- Sustituir los MD.
- Crear una arquitectura distinta.
- Contener todos los contratos técnicos.
- Repetir todos los tests.
- Permitir saltarse los gates.

---

# 120. Jerarquía documental recomendada

```text
00_AI_MASTER_IMPLEMENTATION_ROADMAP.md
  ↓
00_AI_ARCHITECTURE_INDEX.md
  ↓
MD especializados 01–22
  ↓
ADR_LOG.md
  ↓
ESTADO_GLOBAL.md
  ↓
ESTADOS_Y_EVIDENCIA.md
  ↓
RIESGOS.md
  ↓
PREGUNTAS_ABIERTAS.md
```

---

# 121. Fuente de verdad documental

## Archivo guía

```text
00_AI_MASTER_IMPLEMENTATION_ROADMAP.md
```

Fuente de verdad para:

- Secuencia.
- Estado.
- Dependencias.
- Fases.
- Gates.
- Prioridad.
- Progreso.

## MD especializados

Fuente de verdad para:

- Diseño técnico.
- Contratos.
- Arquitectura.
- Tests.
- Evals.
- Quality gates.
- Definition of Done.

## ADR_LOG.md

Fuente de verdad para:

- Decisiones aprobadas.
- Decisiones rechazadas.
- Razones.
- Alternativas.

## ESTADO_GLOBAL.md

Fuente de verdad para:

- Estado ejecutivo.
- Fase activa.
- Próximo milestone.
- Bloqueadores.

## ESTADOS_Y_EVIDENCIA.md

Fuente de verdad para:

- Evidencia de completitud.
- Tests.
- Evals.
- Links.
- Commits.
- Migrations.

## RIESGOS.md

Fuente de verdad para:

- Riesgos abiertos.
- Owners.
- Mitigaciones.
- Aceptaciones.

## PREGUNTAS_ABIERTAS.md

Fuente de verdad para:

- Decisiones pendientes.
- Datos faltantes.
- Bloqueos.
- Legal review.
- Product review.

---

# 122. Regla de lectura para Codex

Codex debe leer:

```text
1. Master Roadmap.
2. Estado Global.
3. MD de la fase activa.
4. MD dependientes.
5. ADR relevantes.
6. Riesgos.
7. Preguntas abiertas.
8. Código real.
```

No debe leer los 22 MD completos en cada cambio si no son relevantes.

Debe utilizar referencias y scope.

---

# 123. Regla de actualización

Después de cada fase:

1. Actualizar estado del roadmap.
2. Actualizar evidencia.
3. Añadir ADR.
4. Actualizar riesgos.
5. Cerrar o añadir preguntas.
6. Actualizar maturity.
7. Actualizar dependencies.
8. No reescribir documentos completos.
9. Mantener historial.
10. No marcar done sin evidence.

---

# 124. Regla final

```text
No se construye una organización AI-native
añadiendo modelos a productos.

Se construye cuando:

estrategia,
producto,
datos,
agentes,
seguridad,
operaciones,
economía
y personas

funcionan como un único sistema.
```

---

# 125. Resumen ejecutivo

Secuencia final:

```text
DEFINIR ESTRATEGIA
  ↓
MAPEAR CAPACIDADES
  ↓
EVALUAR MADUREZ
  ↓
DEFINIR TARGET STATE
  ↓
IDENTIFICAR GAPS
  ↓
CREAR PORTFOLIO
  ↓
MODELAR DEPENDENCIAS
  ↓
CREAR ROADMAP
  ↓
EJECUTAR POR OLAS
  ↓
MEDIR BENEFICIOS
  ↓
APRENDER
  ↓
REPRIORIZAR
```

El sistema completo debe proporcionar:

- Strategy Thesis.
- Non-Goals.
- Architecture Principles.
- Capability Map.
- Maturity Model.
- Target State.
- Gap Analysis.
- Initiative Registry.
- Portfolio.
- Dependency Graph.
- Transformation Waves.
- Roadmap.
- Stage Gates.
- Pilot Criteria.
- Scale Criteria.
- Stop Criteria.
- Benefits Realization.
- Scorecard.
- Capability Debt.
- Continuous Improvement.
- Technology Radar.
- Master Architecture Map.
- Master Capability Registry.
- Master Implementation Guide.

Este punto no es:

```text
el último documento aislado
```

Es:

```text
la capa que convierte
los 21 dominios anteriores
en un único programa de transformación
ejecutable, medible y gobernable
```
