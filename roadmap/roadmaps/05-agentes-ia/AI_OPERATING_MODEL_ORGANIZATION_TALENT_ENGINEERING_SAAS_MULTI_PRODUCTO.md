# AI Operating Model, Organization & Talent Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación organizativa, operativa y técnica transversal.
- **Ámbito:** SaaS, CRM, agentes, copilotos, RAG, memoria, tools, workflows, plataforma, seguridad, privacidad, gobernanza, FinOps, soporte, operaciones y talento.
- **Casos de referencia:** NORA, EcomScaling IA y CRM/SaaS.
- **Objetivo:** convertir una arquitectura de IA en una capacidad empresarial estable, definiendo equipos, ownership, decision rights, competencias, formación, capacidad, continuidad, soporte y procesos de operación.
- **Audiencia:** dirección, producto, ingeniería, IA, plataforma, operaciones, soporte, seguridad, privacidad, legal, QA, finanzas y recursos humanos.
- **Prioridad:** crítica.
- **Principio rector:** una capacidad de IA no está realmente implantada hasta que la organización puede diseñarla, aprobarla, operarla, corregirla y retirarla sin depender de una única persona.
- **Estado esperado:** documento vivo, versionado y conectado con governance, AI System Registry, ownership, RACI, runbooks, evals, soporte, capacidad, formación, incidentes y planes de sucesión.

---

# 1. Propósito

Este documento define cómo implementar **AI Operating Model, Organization & Talent Engineering** en una empresa que construye y opera productos SaaS con agentes de IA.

La arquitectura organizativa debe permitir:

- Definir estructura, equipos, roles y ownership.
- Definir decision rights y matrices RACI.
- Definir intake, handoffs y Definition of Ready.
- Planificar capacidad de roadmap, operación, soporte, incidentes y deuda técnica.
- Definir competencias, formación y autorizaciones ligadas a formación.
- Definir continuidad, backup owners, sucesión y onboarding.
- Definir soporte, escalado y on-call.
- Detectar shadow AI.
- Evitar bus factor crítico.
- Evitar ownership colectivo.
- Evitar que legal, seguridad o privacidad entren demasiado tarde.
- Conectar organización, gobernanza, plataforma, economía y operación.

---

# 2. Regla obligatoria de análisis previo

Antes de diseñar equipos o crear tablas, Codex debe analizar la organización real.

Debe inspeccionar:

- Personas, roles y responsabilidades reales.
- Equipos, reporting lines y forma real de trabajo.
- Producto, ingeniería, IA, datos, plataforma y QA.
- Seguridad, privacidad, legal, operaciones, soporte y finanzas.
- Sistemas de IA, agentes, tools, prompts, datasets, knowledge bases y workflows.
- Owners actuales, owners ausentes y responsabilidades de hecho.
- Runbooks, incidentes, on-call, soporte y escalados.
- Capacidad, carga operativa, vacaciones, rotación y dependencia personal.
- Formación, competencias, onboarding y knowledge transfer.
- Consultores, partners y proveedores.
- Automatizaciones no registradas y shadow AI.

No debe asumir que la solución correcta es simplemente contratar a un AI Engineer.

---

# 3. Prohibiciones para Codex

Codex no debe:

- Inventar organigramas, personas o roles.
- Asumir que cada rol requiere una persona diferente.
- Eliminar roles porque una persona acumule funciones.
- Asignar ownership a “el equipo de IA”, “Producto” o “Legal” sin accountable concreto.
- Crear procesos burocráticos incompatibles con el tamaño real.
- Crear RACI imposibles de mantener.
- Crear formación genérica sin relación con los sistemas reales.
- Permitir acciones críticas con formación caducada.
- Permitir releases sin Operations Owner, Incident Owner o soporte preparado.
- Crear on-call 24/7 sin necesidad.
- Ignorar holidays, bajas, rotación, carga operativa o burnout.
- Medir personas por prompts, agentes o líneas de código.
- Marcar una capacidad como terminada sin backup owner, runbook y continuidad.
- Duplicar datos personales de RR. HH. innecesariamente.
- Crear decisiones automáticas de contratación o desempeño.

---

# 4. Entregables previos obligatorios

Antes de modificar código o procesos, Codex debe entregar:

1. Inventario de equipos, personas y roles.
2. Inventario de responsabilidades reales y formales.
3. Inventario de owners y backup owners.
4. Inventario de decision rights y RACI.
5. Inventario de sistemas, agentes, tools, prompts, datasets, knowledge bases y workflows.
6. Inventario de runbooks, soporte, on-call e incidentes.
7. Inventario de formación, competencias y autorizaciones.
8. Inventario de capacidad y carga operativa.
9. Inventario de dependencia personal, consultores y partners.
10. Mapa organizativo.
11. Mapa de ownership.
12. Matriz decision rights.
13. Matriz RACI.
14. Matriz sistema-owner-backup.
15. Matriz tool-owner-maintainer.
16. Matriz prompt-owner-eval.
17. Matriz knowledge-owner.
18. Matriz competency-role.
19. Matriz training-action.
20. Matriz support-escalation.
21. Matriz on-call-service.
22. Matriz capacity-work.
23. Bus factor map.
24. Gaps.
25. Modelo operativo propuesto.
26. Arquitectura y persistencia.
27. Fases, tests, métricas, gates y plan de transición.

---

# 5. Definición

**AI Operating Model, Organization & Talent Engineering** diseña cómo funciona la organización alrededor de sus sistemas de IA.

```text
ESTRUCTURA
+ ROLES
+ OWNERSHIP
+ DECISION RIGHTS
+ EQUIPOS
+ CAPACIDAD
+ COMPETENCIAS
+ FORMACIÓN
+ SOPORTE
+ OPERACIONES
+ CONTINUIDAD
+ SUCESIÓN
```

---

# 6. Problema que resuelve

Sin operating model:

```text
Una persona
  ├── programa
  ├── diseña prompts
  ├── configura modelos
  ├── resuelve incidencias
  ├── habla con legal
  ├── revisa costes
  └── aprueba producción
```

Esto crea bus factor crítico, cuellos de botella, decisiones no documentadas, falta de revisión independiente, agotamiento y dificultad para escalar.

La organización debe evolucionar desde:

```text
persona que sabe de IA
```

hacia:

```text
sistema organizativo capaz de operar IA
```

---

# 7. Diferencia con AI Governance

AI Governance define qué sistemas existen, qué riesgo tienen, qué obligaciones aplican y si pueden desplegarse.

Operating Model define quién ejecuta esas obligaciones, quién toma decisiones, quién opera, quién mantiene y qué capacidad necesita la organización.

---

# 8. Diferencia con Platform Engineering

Platform Engineering construye gateways, runtimes, registries, queues, workers, SDK y observabilidad.

Operating Model define qué equipo mantiene la plataforma, qué SLO ofrece, cómo se prioriza, cómo se financia y cómo recibe soporte.

---

# 9. Diferencia con Recursos Humanos

No consiste solo en contratar y formar.

También define ownership, decision rights, handoffs, cadencias, capacidad, sucesión, soporte, on-call, métricas e incentivos.

---

# 10. Principios rectores

1. Todo sistema debe tener owner.
2. Todo owner debe tener backup.
3. Toda decisión debe tener autoridad definida.
4. Todo sistema debe tener Domain Owner.
5. Toda tool debe tener Tool Owner.
6. Todo prompt debe tener Prompt Owner.
7. Toda knowledge base debe tener Knowledge Owner.
8. Toda evaluación debe tener Evaluation Owner.
9. Todo incidente debe tener Incident Owner.
10. Toda feature debe tener Operations Owner.
11. Toda capacidad crítica debe tener continuidad.
12. La formación debe estar ligada al sistema real.
13. La capacidad operativa debe reservarse.
14. El modelo debe adaptarse al tamaño real.
15. No debe existir ownership colectivo difuso.
16. No debe existir shadow AI sin registro.
17. La documentación es parte del trabajo.

---

# 11. Modelos organizativos

## 11.1 Centralizado

Un equipo de IA construye todo.

Ventajas: consistencia, especialización y control.

Riesgos: cuello de botella, distancia del dominio y priorización lenta.

## 11.2 Descentralizado

Cada producto construye su IA.

Ventajas: velocidad local y conocimiento del dominio.

Riesgos: duplicación, shadow platforms, costes y seguridad desiguales.

## 11.3 Federado

```text
PLATAFORMA Y POLÍTICAS CENTRALES
+
CAPACIDADES DE PRODUCTO DISTRIBUIDAS
```

Es el modelo recomendado para NORA, EcomScaling IA y CRM.

---

# 12. Operating Model federado recomendado

## Núcleo común

- Contratos y registries.
- Model Gateway, Agent Runtime y Tool Gateway.
- Observability y evals comunes.
- Security, Privacy, Governance y FinOps.
- Golden paths, SDK y developer experience.
- Estándares de incidentes, soporte y runbooks.

## Equipos de producto

- Casos de uso.
- Domain logic.
- Product tools y prompts.
- UX y adoption.
- Product evals.
- Business outcomes.
- Support knowledge.

---

# 13. Contrato de Operating Model

```ts
export type AIOperatingModelType =
  | "centralized"
  | "decentralized"
  | "federated";

export type AIOperatingModelDefinition = {
  id: string;
  type: AIOperatingModelType;
  description: string;
  centralResponsibilities: string[];
  productResponsibilities: string[];
  crossCuttingResponsibilities: string[];
  escalationModel: string;
  approvedBy: string;
  reviewAt: string;
};
```

---

# 14. Team Registry

```ts
export type AITeamType =
  | "platform"
  | "product"
  | "enablement"
  | "security"
  | "privacy"
  | "legal"
  | "evaluation"
  | "operations"
  | "support"
  | "finops";

export type AITeamDefinition = {
  id: string;
  name: string;
  teamType: AITeamType;
  mission: string;
  ownedCapabilities: string[];
  supportedProducts: string[];
  memberIds: string[];
  leadId: string;
  backupLeadId?: string;
  serviceCatalogIds: string[];
  operatingHours: string;
  active: boolean;
};
```

---

# 15. Role Registry

```ts
export type AIOperatingRole =
  | "executive_sponsor"
  | "ai_portfolio_owner"
  | "ai_system_owner"
  | "product_owner"
  | "domain_owner"
  | "ai_platform_owner"
  | "model_owner"
  | "prompt_owner"
  | "tool_owner"
  | "workflow_owner"
  | "data_owner"
  | "knowledge_owner"
  | "evaluation_owner"
  | "security_owner"
  | "privacy_owner"
  | "legal_owner"
  | "finops_owner"
  | "operations_owner"
  | "support_owner"
  | "incident_owner"
  | "release_owner"
  | "technical_maintainer";
```

---

# 16. Role Definition

```ts
export type AIOperatingRoleDefinition = {
  role: AIOperatingRole;
  purpose: string;
  responsibilities: string[];
  decisionRights: string[];
  requiredCompetencies: string[];
  incompatibleRoles?: string[];
  escalationPath: string[];
  trainingRequirements: string[];
  active: boolean;
};
```

---

# 17. Role Assignment

```ts
export type AIOperatingRoleAssignment = {
  id: string;
  role: AIOperatingRole;
  userId: string;
  scopeType:
    | "organization"
    | "product"
    | "ai_system"
    | "agent"
    | "tool"
    | "workflow"
    | "dataset"
    | "knowledge_base"
    | "provider";
  scopeId: string;
  responsibilities: string[];
  decisionRights: string[];
  backupUserIds: string[];
  effectiveFrom: string;
  effectiveUntil?: string;
  status: "active" | "temporary" | "expired" | "revoked";
};
```

---

# 18. Ownership

Ownership significa accountability, no necesariamente mantenimiento técnico.

El owner responde de que la finalidad esté clara, el sistema tenga calidad, los riesgos estén controlados, existan evals, haya capacidad operativa y exista retirada cuando corresponda.

---

# 19. Ownership Registry

```ts
export type AIOwnershipRecord = {
  id: string;
  resourceType:
    | "product"
    | "ai_system"
    | "agent"
    | "model"
    | "prompt"
    | "tool"
    | "workflow"
    | "dataset"
    | "knowledge_base"
    | "provider"
    | "runbook";
  resourceId: string;
  accountableOwnerId: string;
  technicalMaintainerIds: string[];
  domainOwnerIds: string[];
  backupOwnerIds: string[];
  effectiveFrom: string;
  reviewAt: string;
  status: "active" | "review_required" | "orphaned";
};
```

---

# 20. Ownership Coverage

```ts
export type OwnershipCoverage = {
  totalResources: number;
  ownedResources: number;
  orphanedResources: number;
  resourcesWithoutBackup: number;
  coveragePercentage: number;
};
```

---

# 21. Responsabilidades por owner

## System Owner

- Finalidad.
- Roadmap.
- Riesgo.
- Calidad.
- Evals.
- Presupuesto.
- Incidentes.
- Supervisión.
- Documentación.
- Retirada.

## Domain Owner

- Terminología.
- Reglas.
- Casos límite.
- Fuentes.
- Evals.
- Validación.

## Tool Owner

- Finalidad.
- Permisos.
- Riesgo.
- Inputs y outputs.
- Reglas de negocio.
- Resultado esperado.

## Technical Maintainer

- Código.
- Tests.
- Deploy.
- Rendimiento.
- Dependencias.
- Incidentes técnicos.
- Runbook.

## Prompt Owner

- Finalidad.
- Versión.
- Model compatibility.
- Eval suite.
- Change policy.
- Rollback.

## Knowledge Owner

- Autoridad.
- Vigencia.
- Corrección.
- Reindexación.
- Permisos.
- Retirada.

## Evaluation Owner

- Dataset.
- Coverage.
- Judges.
- Regression gates.
- Incident-to-eval.

## Operations Owner

- Runbooks.
- Alerts.
- Capacity.
- Recovery.
- Handoff.

## Support Owner

- Knowledge base.
- Triage.
- Escalation.
- SLA.
- Feedback loop.

## Incident Owner

- Containment.
- Comunicación.
- Evidencia.
- Postmortem.
- Action tracking.

---

# 22. Decision Rights

Debe definirse quién puede crear sistemas, agentes y tools; cambiar modelos, prompts, memoria y RAG; conectar providers; aumentar autonomía; aceptar riesgo; aprobar release; modificar límites; suspender o retirar.

```ts
export type AIDecisionRight = {
  id: string;
  decisionType: string;
  scopeType: string;
  requiredRoles: string[];
  approverRoles: string[];
  consultedRoles: string[];
  informedRoles: string[];
  evidenceRequired: string[];
  emergencyOverrideAllowed: boolean;
  overrideRoles: string[];
  policyVersion: string;
};
```

---

# 23. Decision Record

```ts
export type AIOperatingDecisionRecord = {
  id: string;
  decisionType: string;
  scopeType: string;
  scopeId: string;
  requestedBy: string;
  approverIds: string[];
  consultedIds: string[];
  evidenceIds: string[];
  decision:
    | "approved"
    | "approved_with_conditions"
    | "rejected"
    | "deferred";
  rationale: string;
  decidedAt: string;
  reviewAt?: string;
};
```

---

# 24. RACI

```ts
export type AIRaciAssignment = {
  activity: string;
  scopeType: string;
  scopeId: string;
  responsibleIds: string[];
  accountableId: string;
  consultedIds: string[];
  informedIds: string[];
};
```

Reglas:

- Un único accountable.
- Varios responsible posibles.
- Consulted no aprueba salvo policy.
- Informed no bloquea.
- El mismo usuario puede acumular roles, pero debe quedar registrado.
- Debe existir backup.

---

# 25. Segregación de funciones

Separar idealmente implementación, evaluación, risk acceptance, release approval y auditoría.

En equipos pequeños:

- Documentar acumulación.
- Añadir revisión cruzada.
- Usar evidencia.
- Aplicar excepciones temporales.
- Revisar periódicamente.

```ts
export type SegregationConflict = {
  userId: string;
  conflictingRoles: string[];
  scopeId: string;
  riskLevel: string;
  compensatingControls: string[];
  approvedBy: string;
  expiresAt: string;
  status: "active" | "expired" | "resolved";
};
```

---

# 26. Team Topology recomendada

```text
AI PLATFORM / ENABLEMENT
  ├── Platform
  ├── Runtime
  ├── Evaluation
  └── DevOps / SRE

NORA PRODUCT SQUAD
  ├── Product
  ├── Fiscal / Legal Domain
  ├── Full-Stack
  ├── AI
  └── QA

ECOMSCALING PRODUCT SQUAD
  ├── Product
  ├── Ecommerce Domain
  ├── Data
  ├── AI
  └── Integrations

CRM PRODUCT SQUAD
  ├── Product
  ├── CRM Domain
  ├── Backend
  ├── Frontend
  └── AI
```

---

# 27. Team Interaction Modes

```ts
export type TeamInteractionMode =
  | "collaboration"
  | "x_as_a_service"
  | "facilitating";

export type AITeamInteraction = {
  fromTeamId: string;
  toTeamId: string;
  mode: TeamInteractionMode;
  serviceOrCapability: string;
  expectations: string[];
  escalationPath: string[];
  reviewAt: string;
};
```

---

# 28. Portfolio Management

Debe existir un portfolio de ideas, pilotos, producción, suspendidos, retirados, apuestas estratégicas, deuda técnica y obligaciones regulatorias.

```ts
export type AIPortfolioItem = {
  id: string;
  productId: string;
  capabilityName: string;
  stage:
    | "idea"
    | "assessment"
    | "pilot"
    | "production"
    | "suspended"
    | "retired";
  businessValue: number;
  riskLevel: string;
  complexity: number;
  estimatedCost: number;
  ownerId: string;
  priority: number;
  dependencies: string[];
};
```

---

# 29. Use Case Intake

```ts
export type AIUseCaseIntake = {
  id: string;
  productId: string;
  problem: string;
  targetUsers: string[];
  currentProcess: string;
  expectedOutcome: string;
  expectedVolume: number;
  deterministicAlternativeConsidered: boolean;
  dataRequired: string[];
  risks: string[];
  expectedValue: number;
  estimatedComplexity: string;
  proposedOwnerId: string;
  domainOwnerId?: string;
  status:
    | "submitted"
    | "assessment"
    | "pilot"
    | "approved"
    | "rejected"
    | "deferred";
};
```

Proceso:

```text
IDEA
  ↓
PROBLEMA
  ↓
OWNER
  ↓
DOMAIN REVIEW
  ↓
ALTERNATIVA DETERMINISTA
  ↓
VALOR
  ↓
RIESGO
  ↓
DATOS
  ↓
CAPACIDAD
  ↓
PILOTO
```

---

# 30. Definition of Ready organizativa

No iniciar desarrollo si falta:

- Problem statement.
- User.
- Owner.
- Domain Owner.
- Expected outcome.
- Data source.
- Risk assessment.
- Eval strategy.
- Operations plan.
- Support plan.
- Budget.
- Capacity.
- Maintenance owner.

```ts
export type AIOrganizationalReadiness = {
  useCaseId: string;
  problemDefined: boolean;
  ownerAssigned: boolean;
  domainOwnerAssigned: boolean;
  dataAvailable: boolean;
  riskAssessed: boolean;
  valueHypothesisDefined: boolean;
  evalStrategyDefined: boolean;
  operationsPlanDefined: boolean;
  supportPlanDefined: boolean;
  budgetApproved: boolean;
  capacityAvailable: boolean;
  ready: boolean;
  blockers: string[];
};
```

---

# 31. Handoffs

Handoffs críticos:

- Product → Engineering.
- Engineering → QA.
- QA → Governance.
- Governance → Release.
- Release → Operations.
- Operations → Support.
- Support → Product.
- Incident → Evals.
- Correction → Knowledge.

```ts
export type AIOrganizationalHandoff = {
  id: string;
  fromRole: string;
  toRole: string;
  handoffType: string;
  requiredArtifacts: string[];
  acceptanceCriteria: string[];
  rejectedIf: string[];
  escalationPath: string[];
  ownerId: string;
};
```

---

# 32. Handoffs mínimos

## Product → Engineering

- Problema.
- User journey.
- Acceptance criteria.
- Risk.
- Data.
- UX.
- Outcome.
- Metrics.
- Eval cases.
- Owner.
- Budget.

## Engineering → QA

- Version.
- Test plan.
- Known limitations.
- Feature flags.
- Synthetic tenant.
- Rollback.
- Trace examples.
- Eval suite.
- Open issues.

## Release → Operations

- Manifest.
- SLO.
- Alerts.
- Dashboards.
- Runbook.
- On-call.
- Failure modes.
- Rollback.
- Support notes.
- Owners.

## Operations → Support

- Síntomas.
- Problemas conocidos.
- Triage questions.
- Logs/traces.
- Escalation.
- Workarounds.
- SLA.

---

# 33. Incident-to-Learning Loop

```text
INCIDENTE
  ↓
CONTENCIÓN
  ↓
ROOT CAUSE
  ↓
FIX
  ↓
EVAL
  ↓
POLICY
  ↓
TRAINING
  ↓
ROADMAP
```

```ts
export type AIIncidentLearning = {
  incidentId: string;
  rootCause: string;
  codeChanges: string[];
  evalChanges: string[];
  policyChanges: string[];
  trainingChanges: string[];
  documentationChanges: string[];
  owners: string[];
  dueDates: string[];
  verifiedAt?: string;
};
```

---

# 34. Capacity Planning

Reservar capacidad para:

- Roadmap.
- Operations.
- Incidents.
- Security.
- Privacy.
- Governance.
- Evals.
- Technical debt.
- Support.
- Documentation.
- Training.
- Cost optimization.

```ts
export type AITeamCapacityPlan = {
  teamId: string;
  period: string;
  availableHours: number;
  roadmapHours: number;
  operationsHours: number;
  incidentReserveHours: number;
  governanceHours: number;
  evaluationHours: number;
  technicalDebtHours: number;
  documentationHours: number;
  trainingHours: number;
  capacityUtilization: number;
};
```

Reglas:

- No planificar el 100 % en roadmap.
- Reservar incident capacity.
- Incluir holidays, on-call recovery y support load.
- No aceptar más sistemas de los que pueden operarse.

---

# 35. Operational Load

```ts
export type OperationalLoad = {
  teamId: string;
  period: string;
  incidentHours: number;
  supportHours: number;
  maintenanceHours: number;
  onCallHours: number;
  releaseHours: number;
  reviewHours: number;
  totalOperationalHours: number;
  percentageOfCapacity: number;
};
```

---

# 36. Staffing Forecast

```ts
export type AIStaffingForecast = {
  period: string;
  capability: string;
  currentFte: number;
  requiredFte: number;
  gapFte: number;
  sourcingRecommendation: string;
  assumptions: string[];
};
```

---

# 37. Cadencias operativas

## Diario

- Incidentes críticos.
- Provider outages.
- Security alerts.
- Production blockers.

## Semanal

- Incidentes.
- Calidad.
- Cost anomalies.
- Support patterns.
- Capacity blockers.
- Releases.

## Mensual

- Portfolio.
- Adoption.
- Cost.
- Value.
- Evals.
- Risk.
- Platform health.
- Ownership gaps.

## Trimestral

- Roadmap.
- Risk acceptance.
- Provider review.
- Team capacity.
- Competencies.
- Training.
- Succession.
- Retirement.

---

# 38. AI Operations Review

```ts
export type AIOperationsReview = {
  id: string;
  period: string;
  aiSystemIds: string[];
  incidents: string[];
  qualityFindings: string[];
  costFindings: string[];
  securityFindings: string[];
  privacyFindings: string[];
  capacityFindings: string[];
  supportFindings: string[];
  actions: string[];
  owners: string[];
  dueDates: string[];
  status: "open" | "in_progress" | "closed";
};
```

---

# 39. Competency Framework

```ts
export type AICompetencyArea =
  | "ai_product"
  | "prompting"
  | "agent_architecture"
  | "evaluation"
  | "data"
  | "security"
  | "privacy"
  | "governance"
  | "platform"
  | "finops"
  | "domain"
  | "human_oversight"
  | "operations"
  | "support";

export type AICompetencyLevel =
  | "awareness"
  | "working"
  | "advanced"
  | "expert";
```

---

# 40. Competency Profile

```ts
export type AICompetencyProfile = {
  userId: string;
  roleId: string;
  competencies: {
    area: AICompetencyArea;
    level: AICompetencyLevel;
    evidenceIds: string[];
  }[];
  assessedAt: string;
  nextReviewAt: string;
};
```

---

# 41. Competency Gap

```ts
export type AICompetencyGap = {
  userId: string;
  roleId: string;
  area: AICompetencyArea;
  requiredLevel: AICompetencyLevel;
  currentLevel: AICompetencyLevel;
  remediationActions: string[];
  dueAt: string;
};
```

---

# 42. Perfiles mínimos

## Usuario general

- Qué puede y no puede hacer la IA.
- Cómo verificar.
- Cómo reportar.
- Cómo proteger datos.
- Cómo distinguir sugerencia y acción.

## Supervisor humano

- Limitaciones.
- Evidencia.
- Override.
- Stop.
- Escalation.
- Automation bias.

## Product Owner

- Use cases.
- Outcomes.
- Risk.
- Evals.
- Governance.
- Economics.
- Adoption.

## AI Engineer

- Models.
- Agents.
- Tools.
- Evals.
- Security.
- Observability.
- Cost.
- Reliability.

## Domain Expert

- Reglas.
- Casos límite.
- Fuentes.
- Terminología.
- Validación.
- Change impact.

---

# 43. AI Literacy

La formación debe ser específica por sistema, rol, acción y riesgo.

No basta con un curso general de ChatGPT.

```ts
export type AITrainingDefinition = {
  id: string;
  name: string;
  targetRoles: string[];
  aiSystemIds: string[];
  competencies: string[];
  assessmentRequired: boolean;
  minimumScore?: number;
  validityMonths?: number;
  ownerId: string;
  active: boolean;
};
```

---

# 44. Training Record y Gate

```ts
export type AITrainingRecord = {
  id: string;
  userId: string;
  trainingId: string;
  completedAt: string;
  assessmentScore?: number;
  validUntil?: string;
  status: "valid" | "expired" | "failed" | "revoked";
};

export type TrainingAuthorizationRule = {
  actionType: string;
  requiredTrainingIds: string[];
  minimumCompetencyLevels: Record<string, string>;
  expirationBehavior: "block" | "read_only" | "escalate";
  policyVersion: string;
};
```

Ejemplo:

```text
No permitir aprobar una acción crítica
si la formación de supervisión está caducada.
```

---

# 45. Training Effectiveness

Medir:

- Assessment.
- Error detection.
- Correct escalation.
- Review quality.
- Incident reduction.
- Policy compliance.

```ts
export type TrainingEffectiveness = {
  trainingId: string;
  cohortId: string;
  completionRate: number;
  averageAssessmentScore: number;
  preTrainingErrorRate: number;
  postTrainingErrorRate: number;
  preTrainingIncidentRate: number;
  postTrainingIncidentRate: number;
  conclusion:
    | "effective"
    | "partially_effective"
    | "ineffective";
};
```

---

# 46. Hiring Strategy

No contratar por título abstracto.

Definir:

- Capability gap.
- Problems to solve.
- Decision rights.
- Interfaces.
- First 90 days.
- Success metrics.
- Seniority.

```ts
export type AIHiringRoleProfile = {
  roleTitle: string;
  mission: string;
  problemsToSolve: string[];
  requiredCompetencies: string[];
  decisionRights: string[];
  collaborationInterfaces: string[];
  first90DayOutcomes: string[];
  successMetrics: string[];
  seniority: string;
};
```

---

# 47. Build, Hire, Train or Partner

```ts
export type CapabilitySourcingDecision = {
  capability: string;
  currentMaturity: string;
  requiredMaturity: string;
  option:
    | "build_internal"
    | "hire"
    | "train"
    | "contract"
    | "partner"
    | "managed_service";
  rationale: string;
  cost: number;
  timeToCapabilityMonths: number;
  risks: string[];
  ownerId: string;
  reviewAt: string;
};
```

Criterios:

- Strategic differentiation.
- Frequency.
- Criticality.
- Confidentiality.
- Scale.
- Time.
- Cost.
- Talent availability.
- Compliance.
- Continuity.
- Vendor dependency.
- Exit path.

---

# 48. Consultant Governance

Consultores y partners deben tener:

- Scope.
- Access.
- Deliverables.
- Documentation.
- Ownership transfer.
- IP.
- Security.
- Privacy.
- Exit.
- Knowledge transfer.
- Support period.

---

# 49. Knowledge Continuity

El conocimiento debe vivir en:

- ADR.
- Runbooks.
- System cards.
- Repositories.
- Registries.
- Playbooks.
- Evals.
- Postmortems.
- Training.
- Architecture docs.

No solo en chats, reuniones, notas locales o memoria personal.

---

# 50. Bus Factor

```ts
export type AIKnowledgeContinuityRisk = {
  capabilityId: string;
  primaryExpertIds: string[];
  backupExpertIds: string[];
  documentationCoverage: number;
  automationCoverage: number;
  runbookCoverage: number;
  busFactor: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  mitigationActions: string[];
};
```

Es crítico si solo una persona puede desplegar, restaurar, aprobar, operar providers o comprender RAG y prompts.

---

# 51. Succession Plan

```ts
export type AISuccessionPlan = {
  roleAssignmentId: string;
  primaryUserId: string;
  successorUserIds: string[];
  readinessLevels: Record<string, string>;
  trainingActions: string[];
  shadowingActions: string[];
  targetReadinessDate: string;
  ownerId: string;
};
```

---

# 52. Onboarding

## Técnico

1. Arquitectura.
2. Local runtime.
3. Synthetic tenant.
4. Trace viewer.
5. Evals.
6. Prompt change.
7. Tool segura.
8. Staging.
9. Runbooks.
10. Ownership.

## Funcional

- Producto.
- Cliente.
- Dominio.
- Terminología.
- Riesgos.
- Métricas.
- Pricing.
- Support.
- Outcomes.

```ts
export type AIOnboardingPlan = {
  roleId: string;
  requiredModules: string[];
  requiredShadowing: string[];
  requiredPracticalTasks: string[];
  assessmentIds: string[];
  expectedCompletionDays: number;
  ownerId: string;
};
```

---

# 53. Support Operating Model

## Nivel 1

- Uso.
- Configuración.
- FAQ.
- Problemas conocidos.

## Nivel 2

- Integraciones.
- Datos.
- Workflows.
- Reproducción.
- Tenant configuration.

## Nivel 3

- Runtime.
- Models.
- Tools.
- Security.
- Incidents.
- Platform.

```ts
export type AISupportTierDefinition = {
  tier: 1 | 2 | 3;
  scope: string[];
  requiredCompetencies: string[];
  escalationConditions: string[];
  targetResponseMinutes: number;
  targetResolutionMinutes?: number;
  ownerTeamId: string;
};
```

---

# 54. Support Escalation Contract

```ts
export type AISupportEscalation = {
  issueType: string;
  initialTeam: string;
  escalationConditions: string[];
  targetTeam: string;
  requiredEvidence: string[];
  responseTargetMinutes: number;
  resolutionTargetMinutes?: number;
};
```

Antes de escalar debe existir tenant, user, product, feature, run ID, trace ID, hora, error, pasos y workaround intentado.

---

# 55. On-call Model

Opciones:

- Business hours.
- Extended hours.
- Critical only.
- Enterprise.
- 24/7.

Debe seleccionarse según SLA, impacto, compromisos, geografía, revenue y criticidad.

```ts
export type AIOnCallPolicy = {
  serviceId: string;
  coverageMode:
    | "business_hours"
    | "extended_hours"
    | "critical_only"
    | "enterprise"
    | "always_on";
  primaryRotationIds: string[];
  secondaryRotationIds: string[];
  severityThreshold: string;
  escalationMinutes: number;
  handoffProcedureReference: string;
  compensationPolicyReference?: string;
};
```

---

# 56. On-call Readiness y Load

No incluir a una persona si falta training, access, runbook, escalation, backup y autoridad.

```ts
export type AIOnCallLoad = {
  userId: string;
  period: string;
  shifts: number;
  pages: number;
  incidents: number;
  afterHoursMinutes: number;
  falsePositivePages: number;
  fatigueRisk: "low" | "medium" | "high";
};
```

---

# 57. Burnout Prevention

- Capacity reserve.
- Rotation.
- Backup.
- False-positive reduction.
- Incident review.
- No hero culture.
- Documentation.
- Recovery time.
- Workload visibility.
- Escalation.

---

# 58. Shadow AI

Incluye:

- Tools no registradas.
- Prompts personales.
- Providers personales.
- Uploads no autorizados.
- Automations sin review.
- Scripts locales.
- Copias de datos.

```ts
export type ShadowAIUse = {
  id: string;
  detectedBy: string;
  userId?: string;
  toolOrProvider: string;
  purpose: string;
  dataCategories: string[];
  riskLevel: string;
  status:
    | "detected"
    | "assessing"
    | "approved"
    | "migrating"
    | "blocked";
  ownerId: string;
};
```

Respuesta:

```text
DETECTAR
  ↓
EVALUAR
  ↓
OFRECER ALTERNATIVA SEGURA
  ↓
MIGRAR
  ↓
FORMAR
  ↓
BLOQUEAR SI ES NECESARIO
```

---

# 59. Incentivos

No incentivar solo features, velocidad, uso de IA, agentes o prompts.

También medir:

- Calidad.
- Fiabilidad.
- Coste.
- Riesgo.
- Reutilización.
- Adopción.
- Documentación.
- Reducción de incidentes.
- Knowledge sharing.
- User outcomes.

---

# 60. Team Metrics

```text
ai_team_lead_time
ai_team_release_frequency
ai_team_rework_rate
ai_team_eval_coverage
ai_team_documentation_coverage
ai_team_bus_factor
ai_team_training_completion
ai_team_capacity_utilization
ai_team_operational_load
ai_team_support_load
ai_team_owner_coverage
```

---

# 61. Organizational Health Metrics

```text
ai_systems_without_owner
ai_systems_without_backup_owner
ai_tools_without_domain_owner
ai_prompts_without_owner
ai_knowledge_bases_without_owner
ai_expired_training_assignments
ai_on_call_fatigue_risk
ai_capacity_overcommitment
ai_handoff_rejection_rate
ai_shadow_ai_cases
ai_bus_factor_critical
```

---

# 62. Operating Model by maturity

## Etapa 1 — Founder-led

- Ownership concentrado.
- Procesos manuales.
- Documentación básica.
- Alto riesgo de dependencia.

## Etapa 2 — Product-led

- Owners por sistema.
- Evals.
- Runbooks.
- Product squads.
- Support handoffs.

## Etapa 3 — Platform-led

- Shared platform.
- Federated teams.
- Governance.
- FinOps.
- Formal training.

## Etapa 4 — Scale

- SRE.
- Audit.
- Portfolio governance.
- Specialization.
- Succession.
- Multi-region operations.

```ts
export type AIOperatingModelTransition = {
  currentStage: string;
  targetStage: string;
  capabilityGaps: string[];
  roleChanges: string[];
  teamChanges: string[];
  processChanges: string[];
  hiringNeeds: string[];
  trainingNeeds: string[];
  timeline: string;
  ownerId: string;
};
```

---

# 63. Aplicación a NORA

NORA necesita ownership para:

- Motor fiscal.
- Tax rules.
- AI summary.
- OCR.
- Playbook.
- CRM.
- Legal assistant.
- NIE.
- Licencia turística.
- Platform.
- Security.
- Privacy.
- FinOps.
- Support.

## Motor fiscal

- Fiscal/Legal Domain Owner.
- Technical Maintainer.
- Evaluation Owner.
- Product Owner.
- Release Owner.
- Backup owner.

## AI Summary

- System Owner.
- Fiscal Domain Owner.
- Prompt Owner.
- Evaluation Owner.
- Technical Maintainer.
- UX Owner.

## OCR

- System Owner.
- Document Domain Owner.
- Technical Maintainer.
- Evaluation Owner.
- Privacy Owner.
- Operations Owner.

## Playbook

- Knowledge Owner.
- Product Owner.
- RAG Maintainer.
- Evaluation Owner.
- Security Reviewer.
- Privacy Reviewer.
- Operations Owner.

## CRM Copilot

- CRM Domain Owner.
- System Owner.
- Tool Owners.
- Prompt Owner.
- Evaluation Owner.
- Security Owner.
- Operations Owner.
- Support Owner.

## Legal Assistant

- Legal Owner.
- System Owner.
- AI Engineer.
- Evaluation Owner.
- Privacy Reviewer.
- Security Reviewer.
- Human Oversight Owner.
- Support Owner.

---

# 64. Aplicación a EcomScaling IA

Ownership para:

- Shopify.
- Meta.
- Klaviyo.
- Metrics.
- Recommendations.
- Campaign execution.
- Store memory.
- Agents.
- Platform.
- Economics.
- Support.

El Domain Owner de performance marketing valida KPIs, attribution, campaign logic, recommendations, evals, thresholds y edge cases.

Cada integración necesita functional owner, technical maintainer, security reviewer, incident path, runbook, provider contact y backup.

---

# 65. Aplicación al CRM

Ownership para:

- Leads.
- Clients.
- Opportunities.
- Reservations.
- Documents.
- Billing.
- Notifications.
- Copilot.
- RAG.
- CRUD tools.
- Roles.
- Permissions.
- Support.

Ejemplo `change_property_status`:

- Domain Owner.
- Tool Owner.
- Technical Maintainer.
- Security Reviewer.
- Evaluation Owner.
- Incident path.
- Backup owner.

---

# 66. Arquitectura técnica propuesta

```text
src/
  ai/
    operating-model/
      operating-model.types.ts
      operating-model.config.ts

      organization/
        team.registry.ts
        team-topology.service.ts
        operating-model.service.ts
        portfolio.service.ts

      roles/
        operating-role.registry.ts
        role-assignment.service.ts
        decision-rights.service.ts
        raci.service.ts
        segregation-conflict.service.ts

      ownership/
        ownership.registry.ts
        system-owner.service.ts
        tool-owner.service.ts
        prompt-owner.service.ts
        knowledge-owner.service.ts
        ownership-coverage.service.ts

      capacity/
        team-capacity.service.ts
        operational-load.service.ts
        staffing-forecast.service.ts

      intake/
        use-case-intake.service.ts
        definition-of-ready.service.ts
        portfolio-prioritization.service.ts

      handoffs/
        organizational-handoff.service.ts
        acceptance-contract.service.ts

      competencies/
        competency-framework.service.ts
        competency-assessment.service.ts
        competency-gap.service.ts

      training/
        training.registry.ts
        training-record.service.ts
        authorization-training-gate.ts
        training-effectiveness.service.ts

      sourcing/
        capability-sourcing.service.ts
        build-hire-train-partner.service.ts
        consultant-governance.service.ts

      continuity/
        knowledge-continuity.service.ts
        bus-factor.service.ts
        succession.service.ts
        onboarding.service.ts

      operations/
        operations-review.service.ts
        support-operating-model.service.ts
        support-escalation.service.ts
        on-call-policy.service.ts
        on-call-load.service.ts

      shadow-ai/
        shadow-ai.registry.ts
        shadow-ai-response.service.ts

      metrics/
        team-metrics.service.ts
        organizational-health.service.ts

      audit/
        operating-model-audit.service.ts

      adapters/
        nora/
        ecommerce/
        crm/
```

---

# 67. Persistencia orientativa

Posibles tablas:

```text
ai_operating_models
ai_operating_teams
ai_operating_team_interactions
ai_operating_roles
ai_operating_role_assignments
ai_operating_decision_rights
ai_operating_decision_records
ai_operating_raci_assignments
ai_operating_ownership
ai_operating_segregation_conflicts
ai_operating_portfolio_items
ai_operating_capacity_plans
ai_operating_operational_load
ai_operating_staffing_forecasts
ai_operating_use_case_intakes
ai_operating_readiness
ai_operating_handoffs
ai_operating_incident_learning
ai_operating_competencies
ai_operating_competency_profiles
ai_operating_competency_gaps
ai_operating_trainings
ai_operating_training_records
ai_operating_training_effectiveness
ai_operating_sourcing_decisions
ai_operating_continuity_risks
ai_operating_bus_factor
ai_operating_succession_plans
ai_operating_onboarding_plans
ai_operating_operations_reviews
ai_operating_support_tiers
ai_operating_support_escalations
ai_operating_on_call_policies
ai_operating_on_call_load
ai_operating_shadow_ai
```

No crear sin revisar tablas existentes de users, profiles, roles, permissions, teams, notifications y audit.

---

# 68. SQL orientativo

```sql
CREATE TABLE ai_operating_ownership (
  id uuid PRIMARY KEY,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  accountable_owner_id uuid NOT NULL,
  technical_maintainer_ids jsonb NOT NULL,
  domain_owner_ids jsonb NOT NULL,
  backup_owner_ids jsonb NOT NULL,
  effective_from timestamptz NOT NULL,
  review_at timestamptz NOT NULL,
  status text NOT NULL,
  UNIQUE (resource_type, resource_id)
);
```

```sql
CREATE TABLE ai_operating_role_assignments (
  id uuid PRIMARY KEY,
  role text NOT NULL,
  user_id uuid NOT NULL,
  scope_type text NOT NULL,
  scope_id text NOT NULL,
  responsibilities jsonb NOT NULL,
  decision_rights jsonb NOT NULL,
  backup_user_ids jsonb NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  status text NOT NULL
);
```

```sql
CREATE TABLE ai_operating_capacity_plans (
  id uuid PRIMARY KEY,
  team_id uuid NOT NULL,
  period text NOT NULL,
  available_hours numeric NOT NULL,
  roadmap_hours numeric NOT NULL,
  operations_hours numeric NOT NULL,
  incident_reserve_hours numeric NOT NULL,
  governance_hours numeric NOT NULL,
  evaluation_hours numeric NOT NULL,
  technical_debt_hours numeric NOT NULL,
  documentation_hours numeric NOT NULL,
  training_hours numeric NOT NULL,
  capacity_utilization numeric NOT NULL,
  UNIQUE (team_id, period)
);
```

```sql
CREATE TABLE ai_operating_training_records (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  training_id uuid NOT NULL,
  completed_at timestamptz NOT NULL,
  assessment_score numeric,
  valid_until timestamptz,
  status text NOT NULL
);
```

---

# 69. Alertas críticas

- Production system without owner.
- Critical tool without owner.
- No backup owner.
- Incident without Incident Owner.
- Critical action by untrained user.
- On-call unavailable.
- Bus factor 1 in critical system.
- Operations handoff missing.
- Support cannot reproduce.
- Release without Operations Owner.
- Shadow AI with sensitive data.
- Role assignment expired during active responsibility.

---

# 70. Alertas altas y medias

## Altas

- Training expiring.
- Capacity above threshold.
- Operational load too high.
- Handoff rejection spike.
- Documentation stale.
- Runbook stale.
- Support escalation SLA at risk.
- Succession gap.
- Segregation conflict expiring.
- Tool without Domain Owner.

## Medias

- Team interaction review overdue.
- Competency assessment overdue.
- Portfolio item without priority.
- Intake without owner.
- Low onboarding completion.
- Shadow AI unresolved.
- Capacity plan overdue.
- Support knowledge stale.

---

# 71. Tests

## Unit tests

- Role assignment.
- Ownership coverage.
- Backup owner validation.
- Decision rights.
- RACI invariants.
- Segregation conflict.
- Training authorization.
- Competency gap.
- Capacity calculation.
- Operational load.
- Bus factor.
- Succession readiness.
- Support escalation.
- On-call eligibility.
- Shadow AI status.

## Integration tests

- System registry → ownership.
- Tool registry → Tool Owner.
- Prompt registry → Prompt Owner.
- Knowledge base → Knowledge Owner.
- Release gate → training.
- Release gate → Operations Owner.
- Incident → Incident Owner.
- Support → escalation.
- Training → authorization.
- Capacity → portfolio.
- Shadow AI → migration.
- Handoff → acceptance.

## Scenario tests

- Owner unavailable.
- Critical incident.
- Training expired.
- Employee leaves.
- Shadow AI detected.
- Support unable to reproduce.
- On-call fatigue.
- Capacity overcommitment.

---

# 72. Quality Gates

Bloquear release si:

- No existe System Owner.
- No existe Domain Owner.
- No existe Evaluation Owner.
- No existe Operations Owner.
- No existe Incident Owner.
- No existe backup owner.
- Training requerido caducado.
- Capacity no disponible.
- Support handoff ausente.
- Runbook ausente.
- On-call ausente cuando procede.
- Bus factor crítico.
- Handoff incompleto.
- Ownership orphaned.
- Decision rights sin resolver.
- Segregation conflict inaceptable.
- Maintenance plan ausente.
- Retirement owner ausente.

---

# 73. Fases de implementación

## Fase 0 — Análisis

Organización, equipos, roles, owners, backups, decision rights, RACI, capacity, competencies, training, support, on-call, handoffs, incidents, continuity, shadow AI y bus factor.

## Fase 1 — Roles y Ownership

Role Registry, assignments, Ownership Registry, backups, coverage y tests.

## Fase 2 — Decision Rights y RACI

Decision rights, decision records, RACI, segregation conflicts y audit.

## Fase 3 — Intake y Readiness

Use Case Intake, Definition of Ready, portfolio, prioritization y owners.

## Fase 4 — Handoffs

Product → Engineering, Engineering → QA, Release → Operations, Operations → Support e Incident → Learning.

## Fase 5 — Capacity

Team capacity, operational load, staffing forecast, alerts y dashboards.

## Fase 6 — Competencies

Framework, profiles, gaps, assessments y owners.

## Fase 7 — Training

Registry, records, expiración, authorization gates y effectiveness.

## Fase 8 — Continuity

Bus factor, knowledge coverage, backups, succession y onboarding.

## Fase 9 — Support y On-call

Support tiers, escalation, on-call policies, readiness, load y fatigue.

## Fase 10 — Shadow AI

Detection, assessment, safe alternatives, migration, training y blocking.

## Fase 11 — Metrics y Audit

Organizational metrics, health metrics, reviews, audit y quality gates.

## Fase 12 — Product Adapters

NORA, EcomScaling IA y CRM.

---

# 74. Instrucciones directas para Codex

## Misión

Diseñar e integrar un operating model de IA federado adaptado a la organización real.

## Restricciones

1. No implementar antes del análisis.
2. No inventar organigrama.
3. No asumir una persona por rol.
4. No eliminar roles por acumulación.
5. No usar ownership colectivo.
6. No crear burocracia innecesaria.
7. No diseñar on-call 24/7 sin necesidad.
8. No permitir acciones críticas con training expirado.
9. No ignorar support.
10. No ignorar capacity.
11. No ignorar bus factor.
12. No marcar terminado sin backups.
13. No marcar terminado sin runbooks.
14. No marcar terminado sin transition plan.
15. Documentar desviaciones.

---

# 75. Primer prompt recomendado para Codex

```text
Analiza exhaustivamente la organización y el repositorio para diseñar
un AI Operating Model, Organization & Talent Engineering adaptado
a la empresa real.

No implementes todavía nuevas tablas organizativas.

Objetivos:

1. Identificar teams, people, roles y responsabilidades.
2. Identificar system, tool, prompt, knowledge, evaluation,
   operations, support e incident owners.
3. Identificar backup owners.
4. Identificar decision rights y RACI.
5. Identificar capacity y operational load.
6. Identificar competencies y trainings.
7. Identificar support tiers y on-call.
8. Identificar handoffs y runbooks.
9. Identificar bus factor y succession.
10. Identificar consultants, partners y shadow AI.
11. Crear organization map.
12. Crear ownership map.
13. Crear decision-rights matrix.
14. Crear RACI matrix.
15. Crear system-owner-backup matrix.
16. Crear tool-owner-maintainer matrix.
17. Crear competency-role matrix.
18. Crear training-action matrix.
19. Crear support-escalation matrix.
20. Crear on-call-service matrix.
21. Crear capacity-work matrix.
22. Crear bus-factor map.
23. Proponer federated operating model.
24. Proponer Team, Role y Ownership Registries.
25. Proponer Decision Rights y RACI.
26. Proponer Capacity Planning.
27. Proponer Intake, Readiness y Handoffs.
28. Proponer Competency Framework y Training.
29. Proponer Continuity, Support, On-call y Shadow AI.
30. Proponer arquitectura, persistencia, fases, tests y métricas.

Antes de modificar código, entrega:

a) diagnóstico,
b) organization map,
c) ownership map,
d) decision-rights matrix,
e) RACI,
f) capacity map,
g) competency map,
h) continuity map,
i) support map,
j) gaps,
k) architecture,
l) persistence,
m) transition plan.

No inventes roles, personas u organigramas.
```

---

# 76. Prompt de implementación posterior

```text
Utiliza el análisis aprobado para implementar la primera fase de
AI Operating Model, Organization & Talent Engineering.

Implementa solo:

1. Common types.
2. Role Registry.
3. Role Assignments.
4. Ownership Registry.
5. Backup owners.
6. Decision Rights.
7. RACI.
8. Ownership Coverage.
9. Basic audit events.
10. Unit and integration tests.

No implementes todavía:

- Full HR integration.
- Full training LMS.
- Full on-call tooling.
- Full capacity forecasting.
- All product adapters.
- Automatic hiring decisions.

Usa users, profiles y roles existentes.
No dupliques datos personales innecesarios.
Documenta cada desviación.
```

---

# 77. ADR recomendados

- Operating model.
- Federated topology.
- Team registry.
- Role registry.
- Role assignments.
- Ownership.
- Backup owners.
- Decision rights.
- RACI.
- Segregation.
- Portfolio.
- Intake.
- Definition of Ready.
- Handoffs.
- Capacity planning.
- Operational load.
- Competency framework.
- Training registry.
- Training gates.
- Sourcing.
- Consultant governance.
- Knowledge continuity.
- Bus factor.
- Succession.
- Onboarding.
- Support tiers.
- On-call.
- Shadow AI.
- Organizational metrics.

---

# 78. Criterios de aceptación

- [ ] Existe Operating Model.
- [ ] Existe Team Registry.
- [ ] Existe Role Registry.
- [ ] Existen Role Assignments.
- [ ] Existe Ownership Registry.
- [ ] Cada sistema tiene owner.
- [ ] Cada sistema crítico tiene backup.
- [ ] Cada tool tiene owner.
- [ ] Cada prompt tiene owner.
- [ ] Cada knowledge base tiene owner.
- [ ] Existen Decision Rights.
- [ ] Existe RACI.
- [ ] Existen Capacity Plans.
- [ ] Existe Use Case Intake.
- [ ] Existe Definition of Ready.
- [ ] Existen Handoffs.
- [ ] Existe Competency Framework.
- [ ] Existen Training Records.
- [ ] Existen Training Gates.
- [ ] Existe Support Model.
- [ ] Existe On-call Policy cuando procede.
- [ ] Existe Bus Factor.
- [ ] Existe Succession.
- [ ] Existe Shadow AI workflow.
- [ ] Existen métricas.
- [ ] Existen quality gates.
- [ ] NORA validada.
- [ ] EcomScaling validada.
- [ ] CRM validado.

---

# 79. Definición de terminado

Una capacidad organizativa está terminada cuando:

1. Tiene owner.
2. Tiene backup owner.
3. Tiene Domain Owner.
4. Tiene Technical Maintainer.
5. Tiene Evaluation Owner.
6. Tiene Operations Owner.
7. Tiene Support Owner cuando procede.
8. Tiene Incident Owner.
9. Tiene decision rights.
10. Tiene RACI.
11. Tiene capacity.
12. Tiene training.
13. Tiene competencies.
14. Tiene handoff.
15. Tiene runbook.
16. Tiene support path.
17. Tiene continuity plan.
18. Tiene succession.
19. Tiene metrics.
20. Está validada en la organización real.

---

# 80. Resumen ejecutivo

Secuencia correcta:

```text
IDENTIFICAR CAPACIDAD
  ↓
ASIGNAR OWNER
  ↓
ASIGNAR BACKUP
  ↓
DEFINIR DECISION RIGHTS
  ↓
DEFINIR EQUIPO
  ↓
CERRAR GAPS
  ↓
FORMAR
  ↓
CONSTRUIR
  ↓
TRANSFERIR A OPERACIONES
  ↓
MEDIR
  ↓
APRENDER
  ↓
DESARROLLAR SUCESIÓN
```

La organización común debe proporcionar:

- Federated Operating Model.
- Team Registry.
- Role Registry.
- Ownership Registry.
- Backup Owners.
- Decision Rights.
- RACI.
- Capacity Planning.
- Use Case Intake.
- Definition of Ready.
- Handoffs.
- Competency Framework.
- Training Registry.
- Training Gates.
- Sourcing.
- Continuity.
- Bus Factor.
- Succession.
- Onboarding.
- Support Model.
- On-call.
- Shadow AI workflow.
- Metrics.
- Audit.

AI Operating Model, Organization & Talent Engineering no es:

```text
contratar a alguien que sepa IA
```

Es:

```text
crear una organización capaz
de construir, operar, gobernar
y mejorar sistemas de IA
de forma repetible y sostenible
```
