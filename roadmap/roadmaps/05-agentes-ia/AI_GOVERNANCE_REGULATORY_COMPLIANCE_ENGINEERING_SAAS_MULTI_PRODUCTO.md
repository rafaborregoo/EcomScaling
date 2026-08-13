# AI Governance & Regulatory Compliance Engineering para plataformas SaaS con agentes de IA

## Estado del documento

- **Tipo:** especificación técnico-jurídica transversal.
- **Ámbito:** SaaS, CRM, agentes, copilotos, RAG, memoria, tools, workflows, modelos, proveedores, integraciones, decisiones automatizadas y sistemas multi-tenant.
- **Casos de referencia:** NORA, EcomScaling IA y CRM/SaaS.
- **Objetivo:** convertir la gobernanza y el cumplimiento regulatorio de la IA en inventarios, responsabilidades, clasificaciones, controles, evidencias, evaluaciones, gates de release y procesos de monitorización verificables.
- **Audiencia:** Codex, arquitectura, backend, IA, seguridad, privacidad, legal, DPO/DPD, QA, DevOps, producto, operaciones, dirección y auditoría.
- **Prioridad:** crítica.
- **Jurisdicción principal:** Unión Europea y España.
- **Fecha de referencia:** 30 de julio de 2026.
- **Principio rector:** ningún sistema de IA debe llegar a producción sin que la organización pueda explicar qué es, para qué sirve, quién responde, qué riesgo presenta, qué obligaciones le aplican, qué controles lo limitan y qué evidencia demuestra que la versión desplegada fue evaluada y aprobada.
- **Estado esperado:** documento vivo, versionado y conectado con el AI System Registry, Risk Register, RACI, evaluaciones, ADR, privacidad, seguridad, observabilidad, incidentes, contratos y release management.

---

# 1. Advertencia de alcance

Este documento diseña una arquitectura de gobernanza y cumplimiento.

No sustituye:

- La clasificación jurídica formal de cada sistema.
- La determinación del rol de proveedor, responsable del despliegue, importador, distribuidor u otro operador.
- El análisis de si una práctica está prohibida.
- La determinación de si un sistema es de alto riesgo.
- La evaluación de impacto sobre derechos fundamentales.
- La evaluación de impacto relativa a protección de datos.
- La interpretación de normas sectoriales.
- La evaluación de conformidad.
- El asesoramiento jurídico.
- La interlocución con autoridades.
- La documentación técnica legalmente exigible.

Codex no debe emitir conclusiones jurídicas definitivas cuando:

- La finalidad real no esté definida.
- Existan varios usos posibles.
- Falte información sobre el contexto.
- La clasificación dependa de hechos operativos.
- Haya una modificación sustancial.
- Existan dudas sobre la posición contractual.
- La regulación haya cambiado.
- El sistema se utilice en un sector regulado.

En estos casos debe:

1. Marcar `legal_review_required`.
2. Identificar la cuestión abierta.
3. Impedir el release si la respuesta es material.
4. Mantener el sistema en `assessment`, `limited_pilot` o `blocked`.
5. Reutilizar decisiones jurídicas aprobadas y versionadas.
6. No inventar una clasificación para continuar programando.

---

# 2. Estado regulatorio a 30 de julio de 2026

## 2.1 Reglamento de Inteligencia Artificial

El Reglamento (UE) 2024/1689 está en vigor y establece un marco basado en riesgo para sistemas de IA y modelos de IA de uso general.

## 2.2 AI Omnibus

El **AI Omnibus entró en vigor el 27 de julio de 2026**.

Entre los cambios relevantes para planificación:

- Las obligaciones específicas de sistemas de alto riesgo del **anexo III** se aplican desde el **2 de diciembre de 2027**.
- Las obligaciones de sistemas de alto riesgo integrados en productos regulados del **anexo I** se aplican desde el **2 de agosto de 2028**.
- Se amplían ciertas medidas de simplificación.
- Se introducen cambios en alfabetización, registros y supervisión.
- Se mantiene la necesidad de preparar controles con antelación.

## 2.3 Transparencia

Las obligaciones de transparencia del artículo 50 comienzan a aplicarse el **2 de agosto de 2026**.

Por tanto, a la fecha de este documento:

```text
Quedan pocos días para la aplicación obligatoria
de determinadas reglas de transparencia.
```

La ampliación del calendario de alto riesgo no suspende:

- Transparencia.
- Protección de datos.
- Seguridad.
- Obligaciones contractuales.
- Derechos de consumidores.
- Responsabilidad empresarial.
- Requisitos sectoriales.
- Gobernanza interna.

## 2.4 Cautela con herramientas de consulta

Algunas páginas del AI Act Service Desk advierten que el texto mostrado de determinados artículos aún puede no reflejar completamente las modificaciones del AI Omnibus.

La fuente de verdad debe ser:

1. Texto oficial consolidado cuando esté disponible.
2. Publicación oficial del acto modificador.
3. Comisión Europea.
4. AI Office.
5. Autoridad competente.
6. Asesoramiento jurídico aprobado.

No hardcodear el calendario en código sin un registro regulatorio versionado.

---

# 3. Propósito

La arquitectura debe permitir:

- Inventariar sistemas.
- Inventariar casos de uso.
- Inventariar componentes.
- Definir finalidades previstas.
- Definir usos prohibidos.
- Determinar si existe un sistema de IA.
- Identificar roles regulatorios.
- Clasificar riesgo jurídico.
- Clasificar riesgo interno.
- Resolver obligaciones.
- Mapear obligaciones a controles.
- Mapear controles a evidencias.
- Definir supervisión humana.
- Definir competencias.
- Evaluar impactos.
- Mantener un registro de riesgos.
- Aceptar o rechazar riesgos.
- Aprobar releases.
- Detectar cambios materiales.
- Reabrir evaluaciones.
- Monitorizar producción.
- Gestionar reclamaciones.
- Gestionar incidentes.
- Retirar sistemas.
- Preparar auditorías.
- Producir evidence packs.
- Actualizar requisitos regulatorios.

---

# 4. Definición de AI Governance

**AI Governance** es el conjunto de estructuras, roles, políticas, controles, procesos y evidencias que permiten dirigir y controlar los sistemas de IA durante todo su ciclo de vida.

Incluye:

```text
INVENTARIO
+ FINALIDAD
+ ROLES
+ CLASIFICACIÓN
+ RIESGO
+ OBLIGACIONES
+ CONTROLES
+ EVIDENCIAS
+ SUPERVISIÓN
+ EVALUACIÓN
+ RELEASE
+ MONITORIZACIÓN
+ INCIDENTES
+ RETIRADA
```

No consiste únicamente en:

- Una política.
- Un comité.
- Un Excel.
- Un aviso.
- Un contrato.
- Una presentación.
- Un documento del AI Act.
- Una lista de modelos.

---

# 5. Diferencia con Privacy Engineering

## Privacy Engineering

Responde:

```text
¿Podemos tratar estos datos personales
para esta finalidad y con este proveedor?
```

## AI Governance

Responde:

```text
¿Puede desplegarse este sistema?
¿Qué riesgo tiene?
¿Qué obligaciones le corresponden?
¿Quién responde?
¿Qué controles y evaluaciones necesita?
```

Ejemplo:

```text
Lead scoring.
```

Privacy analiza:

- Base jurídica.
- Profiling.
- Transparencia.
- Retención.
- Derechos.
- Datos.
- Proveedores.

Governance analiza:

- Si es un sistema de IA.
- Finalidad prevista.
- Riesgo.
- Autonomía.
- Impacto.
- Supervisión.
- Obligaciones.
- Evidence pack.
- Release.

---

# 6. Diferencia con Security Engineering

Security Engineering gestiona:

- Prompt injection.
- Exfiltración.
- Tool abuse.
- Sandboxing.
- Poisoning.
- Cross-tenant.
- Privilegios.

Governance gestiona:

- Inventario.
- Clasificación.
- Owners.
- Risk acceptance.
- Controles.
- Evidencias.
- Incidentes regulatorios.
- Release.
- Retirada.

Un sistema puede ser técnicamente seguro y seguir incumpliendo por:

- Falta de transparencia.
- Uso fuera de finalidad.
- Ausencia de supervisión.
- Falta de registro.
- Falta de evaluación.
- Falta de documentación.
- Falta de owner.
- Versión no aprobada.

---

# 7. Diferencia con Observability

Observability reconstruye:

- Qué ocurrió.
- Qué modelo se utilizó.
- Qué tool se ejecutó.
- Qué contexto se recuperó.
- Cuánto costó.
- Qué falló.

Governance decide:

- Qué debe permitirse.
- Qué debe medirse.
- Qué riesgo es aceptable.
- Qué evidencia debe conservarse.
- Quién debe aprobar.
- Cuándo detener.

Observability produce evidencia.

Governance define qué evidencia es necesaria y cómo se interpreta.

---

# 8. Regla obligatoria de análisis previo

Antes de implementar un registry, clasificador o compliance gate, Codex debe analizar el repositorio y el producto real.

Debe inspeccionar:

- Todos los agentes.
- Todos los copilotos.
- Todos los modelos.
- Prompts.
- Tools.
- Workflows.
- RAG.
- Memoria.
- Proveedores.
- Integraciones.
- Datos.
- Roles.
- Tenants.
- Interfaces.
- Outputs.
- Acciones.
- Autonomía.
- Revisión humana.
- Incidentes.
- Evals.
- Logs.
- Contratos.
- Marketing.
- Documentación.
- Features no etiquetadas como IA.
- Automatizaciones deterministas.
- Modelos de embeddings.
- Fine-tunes.
- Modelos externos.
- Uso interno.

---

# 9. Prohibiciones para Codex

Codex no debe:

- Clasificar todo el producto como un único sistema.
- Considerar todo software con IA como alto riesgo.
- Considerar toda automatización como IA.
- Asumir que usar una API externa excluye el rol de proveedor.
- Asumir que el cliente es siempre responsable del despliegue.
- Asumir que no ser alto riesgo elimina obligaciones.
- Aprobar una capacidad sin owner.
- Aprobar una capacidad sin finalidad prevista.
- Aprobar una capacidad sin usos prohibidos.
- Aprobar una capacidad sin evals.
- Aprobar una capacidad sin supervisión cuando proceda.
- Aprobar una capacidad sin transparencia cuando proceda.
- Aprobar una versión distinta de la evaluada.
- Reutilizar automáticamente un risk acceptance.
- Tratar un cambio de tool como cambio menor sin analizarlo.
- Copiar un checklist legal genérico.
- Hardcodear fechas regulatorias sin versionado.
- Declarar cumplimiento por existir código.
- Declarar cumplimiento por existir una política.
- Confundir logs con evidencia suficiente.
- Marcar controles como efectivos sin pruebas.
- Ignorar el uso real de clientes.
- Ignorar el uso interno.
- Ignorar marketing y claims comerciales.
- Ignorar reasonably foreseeable misuse.
- Ignorar el Reglamento de IA por no haber sistemas de alto riesgo.

---

# 10. Entregables previos obligatorios

Antes de modificar código:

1. Inventario de sistemas.
2. Inventario de casos de uso.
3. Inventario de componentes.
4. Inventario de modelos.
5. Inventario de agentes.
6. Inventario de tools.
7. Inventario de datasets.
8. Inventario de providers.
9. Inventario de outputs.
10. Inventario de decisiones.
11. Inventario de usuarios.
12. Inventario de personas afectadas.
13. Inventario de supervisores.
14. Inventario de incidentes.
15. Inventario de políticas.
16. Inventario de obligaciones.
17. Inventario de controles.
18. Inventario de evidencias.
19. Inventario de owners.
20. Inventario de documentación contractual.
21. Inventario de claims comerciales.
22. Mapa de sistemas.
23. Mapa de roles regulatorios.
24. Mapa de riesgo.
25. Mapa de uso previsto.
26. Mapa de usos previsibles.
27. Matriz sistema-obligación.
28. Matriz obligación-control.
29. Matriz control-evidencia.
30. Matriz RACI.
31. Matriz de supervisión.
32. Matriz de transparencia.
33. Calendario regulatorio.
34. Gaps.
35. Arquitectura.
36. Persistencia.
37. Fases.
38. Tests.
39. Evals.
40. Métricas.
41. Alertas.
42. Decisiones legales abiertas.

---

# 11. La unidad de gobierno

No debe gobernarse:

```text
La IA de NORA
```

como una única entidad.

Debe gobernarse cada sistema o caso de uso.

Ejemplo NORA:

```text
NORA-TAX-ENGINE
NORA-AI-SUMMARY
NORA-OCR
NORA-PLAYBOOK
NORA-CRM-COPILOT
NORA-LEGAL-ASSISTANT
NORA-DOCUMENT-CLASSIFIER
```

Ejemplo EcomScaling:

```text
ECOM-METRICS-ANALYST
ECOM-RECOMMENDER
ECOM-CAMPAIGN-MONITOR
ECOM-CAMPAIGN-EXECUTOR
ECOM-CREATIVE-ANALYST
```

Ejemplo CRM:

```text
CRM-INTENT-ROUTER
CRM-RAG-ASSISTANT
CRM-CALL-ANALYST
CRM-CRUD-COPILOT
CRM-LEAD-SCORER
CRM-DOCUMENT-EXTRACTOR
```

---

# 12. AI System Registry

```ts
export type AISystemStatus =
  | "draft"
  | "assessment"
  | "approved"
  | "limited_release"
  | "production"
  | "suspended"
  | "retired";

export type AISystemRecord = {
  id: string;

  name: string;
  version: string;

  product:
    | "nora"
    | "ecommerce"
    | "crm"
    | "shared";

  description: string;

  intendedPurpose: string;

  prohibitedPurposes: string[];

  reasonablyForeseeableMisuse: string[];

  operatorRoleAssignmentIds: string[];

  regulatoryClassificationId: string;

  internalRiskProfileId: string;

  modelIds: string[];
  agentIds: string[];
  toolIds: string[];
  workflowIds: string[];
  datasetIds: string[];

  inputDataCategories: string[];
  outputTypes: string[];

  userCategories: string[];
  affectedPersonCategories: string[];

  autonomyLevel: number;

  humanOversightPolicyId?: string;

  transparencyPolicyId?: string;

  evaluationSuiteId: string;

  ownerId: string;
  riskOwnerId: string;

  status: AISystemStatus;

  approvedVersionId?: string;

  createdAt: string;
  updatedAt: string;
};
```

---

# 13. Registry invariants

No permitir `production` si falta:

- Owner.
- Purpose.
- Classification.
- Risk profile.
- Eval suite.
- Security review.
- Privacy review.
- Transparency review.
- Release decision.
- Version match.
- Monitoring policy.
- Incident owner.
- Rollback.

---

# 14. Component Registry

```ts
export type AIComponentType =
  | "model"
  | "embedding_model"
  | "prompt"
  | "agent"
  | "tool"
  | "workflow"
  | "dataset"
  | "rag_index"
  | "memory_store"
  | "provider"
  | "guardrail"
  | "human_review";

export type AIComponentRecord = {
  id: string;

  type: AIComponentType;

  name: string;
  version: string;

  providerId?: string;

  ownerId: string;

  integrityHash?: string;

  approvedSystemIds: string[];

  active: boolean;
  deprecated: boolean;
};
```

---

# 15. System composition

```ts
export type AISystemComposition = {
  aiSystemId: string;
  aiSystemVersion: string;

  components: {
    componentId: string;
    version: string;
    required: boolean;
  }[];

  contentHash: string;

  createdAt: string;
};
```

El release gate debe comparar la composición evaluada con la desplegada.

---

# 16. Intended Purpose

Debe especificar:

- Acción.
- Usuario.
- Proceso.
- Inputs.
- Outputs.
- Decisiones.
- Acciones.
- Autonomía.
- Contexto.
- Límites.
- Región.
- Condiciones.

Ejemplo insuficiente:

```text
Ayuda mediante IA.
```

Ejemplo:

```text
Analizar métricas agregadas de campañas de una tienda,
generar recomendaciones no vinculantes para el equipo
y no ejecutar cambios sin aprobación.
```

---

# 17. Intended Purpose Contract

```ts
export type IntendedPurposeDefinition = {
  id: string;

  aiSystemId: string;
  version: string;

  targetUsers: string[];

  affectedPersons: string[];

  businessProcess: string;

  permittedInputs: string[];

  permittedOutputs: string[];

  permittedActions: string[];

  prohibitedActions: string[];

  requiredHumanDecisions: string[];

  operatingConditions: string[];

  geographicScope: string[];

  limitations: string[];

  approvedBy: string;
  approvedAt: string;
};
```

---

# 18. Uso fuera de finalidad

Debe detectarse cuando:

- Un tenant usa el asistente comercial para empleo.
- Un análisis agregado se usa para scoring individual.
- Un OCR se usa para inferir salud.
- Un copiloto de CRM toma decisiones crediticias.
- Un generador de email ejecuta acciones.
- Un Playbook se convierte en asesor jurídico autónomo.

```ts
export type OutOfPurposeUseEvent = {
  aiSystemId: string;

  tenantId: string;
  actorId: string;

  requestedUse: string;

  matchedProhibitedUse?: string;

  decision:
    | "blocked"
    | "review_required"
    | "allowed";

  policyVersion: string;

  createdAt: string;
};
```

---

# 19. Reasonably Foreseeable Misuse

No basta con prohibir usos.

Debe anticiparse:

- Qué puede intentar un usuario.
- Qué puede surgir por configuración.
- Qué puede provocar marketing ambiguo.
- Qué puede incentivar una UI.
- Qué puede ejecutar un agente.
- Qué usos adyacentes son previsibles.

Ejemplos:

- Usar lead scoring para discriminar.
- Usar análisis de llamadas para evaluar empleados.
- Usar asistente legal sin revisión.
- Usar recomendador para precios individualizados.
- Usar OCR para inferencias no autorizadas.
- Usar memoria para crear perfiles.

---

# 20. AI Act operator roles

```ts
export type AIOperatorRole =
  | "provider"
  | "deployer"
  | "downstream_provider"
  | "importer"
  | "distributor"
  | "product_manufacturer"
  | "authorised_representative";
```

---

# 21. Operator Role Assignment

```ts
export type AIOperatorRoleAssignment = {
  id: string;

  aiSystemId: string;

  organisationId: string;

  role: AIOperatorRole;

  applicableRegions: string[];

  legalAssessmentReference: string;

  roleRationale: string;

  effectiveFrom: string;
  effectiveUntil?: string;

  approvedBy: string;

  status:
    | "draft"
    | "approved"
    | "review_required";
};
```

---

# 22. Reglas de rol

No asumir:

```text
OpenAI es el proveedor,
por tanto nosotros somos deployer.
```

Una empresa puede ser proveedor del sistema integrado si:

- Desarrolla la solución.
- Encarga su desarrollo.
- La comercializa.
- La pone en servicio.
- Usa su nombre o marca.
- Define la finalidad integrada.
- Integra tools y workflows.

El proveedor del modelo y el proveedor del sistema pueden ser entidades distintas.

---

# 23. Clasificación regulatoria

```ts
export type AIRegulatoryClassification =
  | "not_ai_system"
  | "excluded"
  | "prohibited"
  | "high_risk_annex_i"
  | "high_risk_annex_iii"
  | "article_50_transparency"
  | "general_purpose_ai_model"
  | "general_purpose_ai_model_systemic_risk"
  | "general_purpose_ai_system"
  | "limited_or_minimal_risk"
  | "classification_pending";
```

Una capacidad puede tener varias obligaciones simultáneas.

Ejemplo:

```text
article_50_transparency
+
limited_or_minimal_risk
```

---

# 24. Clasification Decision

```ts
export type AIRegulatoryClassificationDecision = {
  aiSystemId: string;
  aiSystemVersion: string;

  classifications: AIRegulatoryClassification[];

  roleAssignments: string[];

  applicableProvisions: string[];

  nonApplicableProvisions: {
    provision: string;
    rationale: string;
  }[];

  unresolvedQuestions: string[];

  legalReviewRequired: boolean;

  sourceVersionIds: string[];

  approvedBy: string;

  approvedAt: string;
  reviewAt: string;
};
```

---

# 25. AI system definition assessment

Debe analizarse si el sistema:

- Está basado en máquina.
- Opera con cierto grado de autonomía.
- Puede mostrar adaptabilidad.
- Infiere a partir de inputs.
- Genera outputs.
- Esos outputs influyen en entornos físicos o virtuales.

No todo:

- `if/else`.
- Regla fiscal.
- Fórmula.
- Workflow.
- Plantilla.
- Validador.
- Query SQL.

es un sistema de IA.

---

# 26. Not-AI decision

```ts
export type NotAISystemAssessment = {
  componentId: string;

  machineBased: boolean;

  autonomy: boolean;

  inference: boolean;

  outputInfluence: boolean;

  rationale: string;

  legalReviewReference?: string;

  decision:
    | "not_ai_system"
    | "ai_system"
    | "pending";
};
```

NORA Tax Engine puede ser determinista y no debe clasificarse como IA solo por pertenecer a NORA.

---

# 27. Prácticas prohibidas

Debe existir un assessment para determinar si el uso puede entrar en prácticas prohibidas.

No debe limitarse a comparar nombres.

Debe analizar:

- Función.
- Finalidad.
- Personas.
- Contexto.
- Efectos.
- Datos.
- Técnicas.
- Excepciones.
- Uso real.

---

# 28. Prohibited Practice Assessment

```ts
export type ProhibitedPracticeAssessment = {
  aiSystemId: string;

  assessedPractices: {
    practiceId: string;

    potentiallyApplicable: boolean;

    exceptionPotentiallyApplicable: boolean;

    rationale: string;

    legalReviewRequired: boolean;
  }[];

  conclusion:
    | "not_prohibited"
    | "potentially_prohibited"
    | "prohibited"
    | "pending";

  approvedBy: string;
};
```

Si existe posibilidad material:

```text
release blocked
```

hasta revisión.

---

# 29. High-risk classification

Debe analizar:

- Anexo I.
- Anexo III.
- Finalidad.
- Decisiones.
- Sector.
- Personas.
- Contexto.
- Excepciones.
- Modificaciones.
- Uso previsto.
- Uso real.

No basta:

```text
No trabajamos en sanidad,
por tanto no es alto riesgo.
```

Ámbitos como empleo, educación, acceso a servicios, biometría, migración o infraestructuras pueden ser relevantes.

---

# 30. High-risk timeline

Calendario actualizado:

```text
Anexo III:
2 de diciembre de 2027.

Anexo I:
2 de agosto de 2028.
```

Debe existir un `RegulatoryCalendarService`.

No debe utilizarse el retraso para posponer:

- Inventario.
- Clasificación.
- Risk management.
- Logging.
- Human oversight.
- Data governance.
- Documentation.
- Monitoring.

---

# 31. Transparency classification

Debe evaluarse si el sistema:

- Interactúa directamente con personas.
- Genera contenido sintético.
- Manipula contenido.
- Genera deepfakes.
- Realiza reconocimiento de emociones.
- Realiza categorización biométrica.
- Genera texto de interés público.
- Cumple alguna excepción.

---

# 32. Transparency obligations date

```text
2 de agosto de 2026
```

Debe estar representada como requisito efectivo.

A fecha 30 de julio de 2026:

```text
No es un requisito futuro lejano.
Es una obligación inminente.
```

---

# 33. Transparency Policy

```ts
export type AITransparencyPolicy = {
  aiSystemId: string;
  aiSystemVersion: string;

  userInteractionDisclosureRequired: boolean;

  disclosureTextByLanguage: Record<
    string,
    string
  >;

  disclosureMoment:
    | "before_interaction"
    | "at_first_interaction"
    | "persistent"
    | "before_action";

  generatedContentMarkingRequired: boolean;

  machineReadableMarkingRequired: boolean;

  deepfakeDisclosureRequired: boolean;

  publicInterestTextDisclosureRequired: boolean;

  emotionRecognitionDisclosureRequired: boolean;

  biometricCategorisationDisclosureRequired: boolean;

  exceptions: string[];

  legalAssessmentReference: string;

  policyVersion: string;
};
```

---

# 34. Chatbot disclosure

Para un chat:

- Debe determinarse si el usuario sabe que interactúa con IA.
- El aviso no debe ocultarse.
- Debe aparecer a tiempo.
- Debe ser comprensible.
- No debe inducir a pensar que es una persona.
- Debe indicar cómo contactar con una persona cuando proceda.
- Debe registrarse la versión del aviso.

---

# 35. AI Content Marking

La arquitectura debe ser capaz de:

- Marcar contenido.
- Mantener metadata.
- Insertar señal machine-readable.
- Mostrar label.
- Preservar marca en export.
- Registrar excepciones.
- Registrar la versión del sistema.

No todas las respuestas internas requerirán la misma forma de marcado.

Debe aplicarse el assessment del artículo 50 y sus directrices.

---

# 36. Internal risk classification

La clasificación interna no sustituye a la jurídica.

```ts
export type InternalAIRiskLevel =
  | "low"
  | "moderate"
  | "high"
  | "critical";
```

---

# 37. Internal Risk Profile

```ts
export type AIRiskProfile = {
  aiSystemId: string;

  legalClassifications:
    AIRegulatoryClassification[];

  internalRiskLevel: InternalAIRiskLevel;

  fundamentalRightsImpact: string[];

  safetyImpact: string[];

  financialImpact: string[];

  contractualImpact: string[];

  reputationalImpact: string[];

  privacyImpact: string[];

  securityImpact: string[];

  operationalImpact: string[];

  affectedPopulationScale: number;

  autonomyLevel: number;

  reversibility:
    | "reversible"
    | "partially_reversible"
    | "irreversible";

  decisionInfluence:
    | "informational"
    | "recommendation"
    | "material_influence"
    | "automatic_decision";

  approvedBy: string;
};
```

---

# 38. Risk scoring

No depender únicamente de una suma.

Debe considerar:

- Severidad.
- Probabilidad.
- Escala.
- Vulnerabilidad.
- Autonomía.
- Reversibilidad.
- Detectabilidad.
- Concentración.
- Dependencia.
- Derechos.
- Impacto económico.
- Incertidumbre.

---

# 39. Risk Classification Engine

```ts
export interface AIRiskClassificationEngine {
  classify(
    input: AISystemAssessmentInput
  ): Promise<AIRiskClassificationResult>;
}

export type AIRiskClassificationResult = {
  regulatoryClassifications:
    AIRegulatoryClassification[];

  internalRiskLevel: InternalAIRiskLevel;

  applicableProvisionIds: string[];

  legalReviewRequired: boolean;

  privacyReviewRequired: boolean;

  securityReviewRequired: boolean;

  impactAssessmentRequired: boolean;

  humanOversightRequired: boolean;

  reasons: string[];
};
```

---

# 40. Obligations Engine

```ts
export type AIComplianceObligationStatus =
  | "not_applicable"
  | "pending"
  | "implemented"
  | "verified"
  | "non_compliant"
  | "waived";

export type AIComplianceObligation = {
  id: string;

  regulationId: string;

  provision: string;

  applicableRoles: AIOperatorRole[];

  applicableClassifications:
    AIRegulatoryClassification[];

  requirement: string;

  effectiveFrom: string;

  implementationDeadline?: string;

  controlIds: string[];

  evidenceRequirements: string[];

  status: AIComplianceObligationStatus;

  ownerId: string;
};
```

---

# 41. Obligation Resolution

```ts
export interface AIObligationsEngine {
  resolve(input: {
    aiSystemId: string;
    version: string;
    roles: AIOperatorRoleAssignment[];
    classifications: AIRegulatoryClassification[];
    region: string;
    date: string;
  }): Promise<AIComplianceObligation[]>;
}
```

---

# 42. Obligation examples

Posibles obligaciones:

- Transparencia.
- Información al usuario.
- Marking.
- Risk management.
- Data governance.
- Technical documentation.
- Record keeping.
- Logs.
- Human oversight.
- Accuracy.
- Robustness.
- Cybersecurity.
- Quality management.
- Registration.
- Post-market monitoring.
- Incident reporting.
- Instructions for use.
- Fundamental rights impact assessment.
- Worker information.
- AI literacy.
- Cooperation.

No aplicarlas automáticamente a todos los sistemas.

---

# 43. Controls Library

```ts
export type AIControlType =
  | "preventive"
  | "detective"
  | "corrective"
  | "governance";

export type AIControlStatus =
  | "planned"
  | "implemented"
  | "tested"
  | "effective"
  | "ineffective"
  | "retired";

export type AIControl = {
  id: string;

  name: string;

  description: string;

  controlType: AIControlType;

  obligationIds: string[];

  riskIds: string[];

  implementationReferences: string[];

  ownerId: string;

  testIds: string[];

  evidenceIds: string[];

  frequency:
    | "continuous"
    | "per_run"
    | "per_release"
    | "monthly"
    | "quarterly"
    | "annual";

  status: AIControlStatus;
};
```

---

# 44. Control effectiveness

Implementado no equivale a efectivo.

```ts
export type ControlEffectivenessAssessment = {
  controlId: string;

  designEffective: boolean;

  operatingEffective: boolean;

  testResultIds: string[];

  incidentsSinceLastReview: string[];

  exceptions: string[];

  conclusion:
    | "effective"
    | "partially_effective"
    | "ineffective";

  assessedBy: string;

  assessedAt: string;
  reviewAt: string;
};
```

---

# 45. Evidence

```ts
export type ComplianceEvidenceType =
  | "policy"
  | "test_result"
  | "eval_result"
  | "trace"
  | "approval"
  | "training_record"
  | "technical_documentation"
  | "incident_record"
  | "contract"
  | "audit_report"
  | "monitoring_report"
  | "user_notice";

export type ComplianceEvidence = {
  id: string;

  aiSystemId: string;
  aiSystemVersion: string;

  obligationId: string;
  controlId: string;

  evidenceType: ComplianceEvidenceType;

  reference: string;

  contentHash?: string;

  createdAt: string;
  validUntil?: string;

  generatedBy?: string;
  verifiedBy?: string;
};
```

---

# 46. Evidence validity

Evidencia inválida si:

- Es de otra versión.
- Es de otro modelo.
- Es de otro prompt.
- Es de otro dataset.
- Está caducada.
- No corresponde al control.
- No puede reproducirse.
- No tiene owner.
- Fue modificada.
- No cubre el uso real.

---

# 47. Evidence Pack

```ts
export type AIComplianceEvidencePack = {
  aiSystemId: string;
  aiSystemVersion: string;

  compositionHash: string;

  intendedPurposeReference: string;

  classificationReference: string;

  roleAssessmentReferences: string[];

  obligationIds: string[];

  controlEvidenceIds: string[];

  evaluationReportIds: string[];

  privacyReferences: string[];

  securityReferences: string[];

  humanOversightEvidenceIds: string[];

  transparencyEvidenceIds: string[];

  changeHistoryIds: string[];

  incidentIds: string[];

  releaseDecisionId: string;

  generatedAt: string;

  signedBy?: string;
};
```

---

# 48. System Card

```ts
export type AISystemCard = {
  aiSystemId: string;
  aiSystemVersion: string;

  intendedPurpose: string;

  capabilities: string[];

  limitations: string[];

  prohibitedUses: string[];

  reasonablyForeseeableMisuse: string[];

  userCategories: string[];

  affectedPersonCategories: string[];

  inputData: string[];

  outputTypes: string[];

  modelVersions: string[];

  toolSummary: string[];

  autonomyLevel: number;

  humanOversight: string;

  knownRisks: string[];

  evaluationSummary: string;

  transparencySummary: string;

  incidentContact: string;

  lastReviewedAt: string;
};
```

---

# 49. AI Risk Register

```ts
export type AIRiskCategory =
  | "safety"
  | "fundamental_rights"
  | "privacy"
  | "security"
  | "bias"
  | "misinformation"
  | "financial"
  | "contractual"
  | "operational"
  | "reputational"
  | "environmental"
  | "misuse";

export type AIRiskRecord = {
  id: string;

  aiSystemId: string;
  aiSystemVersion: string;

  riskCategory: AIRiskCategory;

  scenario: string;

  affectedStakeholders: string[];

  sources: string[];

  likelihood: number;
  impact: number;

  inherentRisk: number;

  controlIds: string[];

  residualRisk: number;

  uncertainty: number;

  riskOwnerId: string;

  treatment:
    | "avoid"
    | "reduce"
    | "transfer"
    | "accept";

  status:
    | "open"
    | "mitigating"
    | "accepted"
    | "closed";

  reviewAt: string;
};
```

---

# 50. Risk tolerance

Debe existir una tolerancia aprobada.

```ts
export type AIRiskTolerance = {
  riskCategory: AIRiskCategory;

  maximumResidualRisk: number;

  prohibitedScenarios: string[];

  requiredApprovalLevel: string;

  escalationThreshold: number;

  policyVersion: string;
};
```

---

# 51. Risk acceptance

```ts
export type AIRiskAcceptance = {
  id: string;

  riskId: string;

  acceptedResidualRisk: number;

  rationale: string;

  conditions: string[];

  compensatingControls: string[];

  acceptedBy: string;

  acceptedAt: string;
  expiresAt: string;

  status:
    | "active"
    | "expired"
    | "revoked";
};
```

No aceptar riesgo indefinidamente.

---

# 52. AI impact assessment

Debe evaluar:

- Beneficios.
- Personas afectadas.
- Derechos.
- Daños.
- Grupos vulnerables.
- Errores.
- Sesgos.
- Uso indebido.
- Supervisión.
- Reclamaciones.
- Reversibilidad.
- Riesgo residual.

```ts
export type AIImpactAssessment = {
  id: string;

  aiSystemId: string;
  aiSystemVersion: string;

  intendedPurpose: string;

  affectedPersons: string[];

  expectedBenefits: string[];

  foreseeableHarms: string[];

  fundamentalRights: string[];

  vulnerableGroups: string[];

  misuseScenarios: string[];

  humanOversightMeasures: string[];

  complaintMechanisms: string[];

  controlIds: string[];

  residualRisk: number;

  decision:
    | "approve"
    | "conditional"
    | "reject";

  approvedBy: string;
};
```

---

# 53. Fundamental Rights Impact Assessment

Debe distinguirse de la EIPD.

Puede analizar:

- Dignidad.
- No discriminación.
- Privacidad.
- Protección de datos.
- Libertad de expresión.
- Derecho a tutela.
- Consumidores.
- Empleo.
- Acceso a servicios.
- Derechos de menores.
- Derechos de personas vulnerables.

No crear una FRIA legal automática sin revisar aplicabilidad.

---

# 54. FRIA Record

```ts
export type FundamentalRightsImpactAssessment = {
  id: string;

  aiSystemId: string;
  aiSystemVersion: string;

  deployerOrganisationId: string;

  deploymentContext: string;

  durationAndFrequency: string;

  affectedPersonCategories: string[];

  fundamentalRights: string[];

  riskScenarios: string[];

  humanOversightMeasures: string[];

  complaintMechanisms: string[];

  mitigationMeasures: string[];

  residualRisk: string;

  status:
    | "draft"
    | "approved"
    | "review_required"
    | "not_applicable";

  legalAssessmentReference: string;

  approvedBy: string;
};
```

---

# 55. Human oversight

Debe definir:

- Quién.
- Cuándo.
- Qué información.
- Qué competencia.
- Qué autoridad.
- Qué puede detener.
- Qué puede modificar.
- Qué puede revertir.
- Cómo se escala.
- Cómo se registra.

---

# 56. Human Oversight Policy

```ts
export type HumanOversightPolicy = {
  id: string;

  aiSystemId: string;
  aiSystemVersion: string;

  requiredRoles: string[];

  requiredCompetencies: string[];

  reviewTriggers: string[];

  reviewInformation: string[];

  overrideAllowed: boolean;

  stopAllowed: boolean;

  reversalAllowed: boolean;

  maximumReviewDelayMs?: number;

  escalationPath: string[];

  evidenceRequired: boolean;

  fatigueMonitoringRequired: boolean;

  policyVersion: string;
};
```

---

# 57. Supervisión nominal

No es suficiente:

```text
El usuario revisa el resultado.
```

Debe demostrarse que:

- Entiende.
- Tiene fuentes.
- Tiene tiempo.
- Tiene autoridad.
- Puede rechazar.
- Puede detener.
- No sufre automatización complaciente.
- No está saturado.
- Se registra su decisión.

---

# 58. Oversight workload

```ts
export type OversightWorkloadMetric = {
  reviewerId: string;

  aiSystemId: string;

  reviewsPerHour: number;

  averageReviewDurationMs: number;

  overrideRate: number;

  missedDeadlineRate: number;

  fatigueRisk:
    | "low"
    | "medium"
    | "high";
};
```

Un volumen excesivo puede convertir HITL en control ficticio.

---

# 59. AI literacy

Debe gestionarse por rol.

```ts
export type AICompetencyRecord = {
  userId: string;

  role: string;

  aiSystemIds: string[];

  completedTrainingIds: string[];

  competencyAssessmentIds: string[];

  authorisedActions: string[];

  validFrom: string;
  validUntil?: string;
};
```

---

# 60. Training content

Debe cubrir:

- Finalidad.
- Capacidades.
- Limitaciones.
- Riesgos.
- Sesgos.
- Supervisión.
- Seguridad.
- Privacidad.
- Incidentes.
- Transparencia.
- Uso prohibido.
- Escalado.
- Cómo detectar errores.
- Cómo detener.

---

# 61. Governance roles

```ts
export type AIGovernanceRole =
  | "ai_system_owner"
  | "product_owner"
  | "model_owner"
  | "data_owner"
  | "risk_owner"
  | "security_reviewer"
  | "privacy_reviewer"
  | "legal_reviewer"
  | "human_oversight_owner"
  | "evaluation_owner"
  | "release_approver"
  | "incident_owner"
  | "internal_auditor";
```

---

# 62. RACI Assignment

```ts
export type GovernanceRaciAssignment = {
  aiSystemId: string;

  activity: string;

  responsibleIds: string[];

  accountableId: string;

  consultedIds: string[];

  informedIds: string[];
};
```

---

# 63. Segregación de funciones

Idealmente no debe coincidir completamente:

- Developer.
- Evaluator.
- Risk accepter.
- Release approver.
- Auditor.

Si el equipo es pequeño:

- Documentar conflicto.
- Añadir revisión externa o cruzada.
- Usar evidence pack.
- Limitar duración de excepción.
- Revalidar.

---

# 64. Governance exception

```ts
export type AIGovernanceException = {
  id: string;

  controlId: string;

  aiSystemId: string;

  reason: string;

  scope: string[];

  compensatingControls: string[];

  approvedBy: string;

  expiresAt: string;

  status:
    | "active"
    | "expired"
    | "revoked";
};
```

---

# 65. Change management

Un cambio puede afectar:

- Clasificación.
- Riesgo.
- Obligaciones.
- Transparencia.
- EIPD.
- FRIA.
- Contrato.
- Instrucciones.
- Evals.
- Supervisión.
- Proveedores.

---

# 66. Governance Change Event

```ts
export type AIGovernanceChangeEvent = {
  id: string;

  aiSystemId: string;

  componentType:
    | "model"
    | "prompt"
    | "tool"
    | "data"
    | "rag"
    | "memory"
    | "workflow"
    | "provider"
    | "purpose"
    | "oversight"
    | "interface"
    | "marketing_claim";

  oldVersion: string;
  newVersion: string;

  description: string;

  materiality:
    | "minor"
    | "significant"
    | "critical";

  requiresReclassification: boolean;

  requiresNewEvals: boolean;

  requiresLegalReview: boolean;

  requiresPrivacyReview: boolean;

  requiresSecurityReview: boolean;

  requiresCustomerNotice: boolean;

  requiresContractUpdate: boolean;

  createdAt: string;
};
```

---

# 67. Materiality assessment

```ts
export type MaterialChangeAssessment = {
  changeEventId: string;

  intendedPurposeChanged: boolean;

  autonomyIncreased: boolean;

  newToolRisk: boolean;

  affectedPersonsChanged: boolean;

  newDataCategory: boolean;

  modelBehaviorChanged: boolean;

  decisionImpactChanged: boolean;

  providerChanged: boolean;

  transparencyChanged: boolean;

  oversightReduced: boolean;

  conclusion:
    | "minor"
    | "significant"
    | "substantial_modification_candidate";

  legalReviewRequired: boolean;
};
```

---

# 68. Release governance

```text
CODE COMPLETE
  ↓
SYSTEM REGISTERED
  ↓
COMPOSITION FROZEN
  ↓
ROLE ASSESSED
  ↓
CLASSIFIED
  ↓
OBLIGATIONS RESOLVED
  ↓
CONTROLS TESTED
  ↓
EVALS PASSED
  ↓
PRIVACY PASSED
  ↓
SECURITY PASSED
  ↓
TRANSPARENCY READY
  ↓
OVERSIGHT READY
  ↓
EVIDENCE PACK
  ↓
APPROVAL
  ↓
CANARY
  ↓
PRODUCTION
```

---

# 69. Release Decision

```ts
export type AIGovernanceReleaseDecision = {
  id: string;

  aiSystemId: string;
  aiSystemVersion: string;

  compositionHash: string;

  decision:
    | "approved"
    | "approved_with_conditions"
    | "limited_pilot"
    | "blocked"
    | "retire";

  conditions: string[];

  unresolvedRisks: string[];

  monitoringRequirements: string[];

  approvedBy: string[];

  approvedAt: string;
  expiresAt?: string;

  rollbackPlanReference: string;
};
```

---

# 70. Version mismatch

Bloquear si:

```text
deployed composition hash
≠
approved composition hash
```

---

# 71. Limited pilot

Debe definir:

- Tenants.
- Usuarios.
- Geografía.
- Duración.
- Volumen.
- Tools.
- Riesgo.
- Monitorización.
- Kill switch.
- Success criteria.
- Stop criteria.

```ts
export type LimitedPilotPolicy = {
  aiSystemId: string;

  tenantIds: string[];

  maximumUsers: number;

  maximumRuns: number;

  startAt: string;
  endAt: string;

  allowedTools: string[];

  monitoringThresholds: Record<string, number>;

  stopConditions: string[];
};
```

---

# 72. Post-market monitoring

Debe monitorizar:

- Performance.
- Errors.
- Drift.
- Bias.
- Overrides.
- Complaints.
- Incidents.
- Misuse.
- Costs.
- Security.
- Privacy.
- Transparency.
- Human review.
- Out-of-purpose use.

---

# 73. Post-Market Monitoring Plan

```ts
export type PostMarketMonitoringPlan = {
  aiSystemId: string;
  aiSystemVersion: string;

  metrics: string[];

  thresholds: Record<string, number>;

  dataSources: string[];

  reportingFrequency: string;

  responsibleIds: string[];

  escalationRules: string[];

  suspensionRules: string[];

  reviewAt: string;
};
```

---

# 74. Continuous compliance

No basta una revisión anual.

Debe existir:

- Per-run enforcement.
- Per-release review.
- Continuous metrics.
- Periodic control testing.
- Regulatory updates.
- Incident-triggered review.
- Complaint-triggered review.
- Drift-triggered review.

---

# 75. Misuse monitoring

```ts
export type AIMisuseEvent = {
  id: string;

  aiSystemId: string;

  actorId: string;
  tenantId: string;

  misuseType: string;

  attemptedAction: string;

  blocked: boolean;

  policyVersion: string;

  occurredAt: string;
};
```

---

# 76. Complaint handling

```ts
export type AIComplaint = {
  id: string;

  aiSystemId: string;

  complainantReference?: string;

  complaintType: string;

  affectedDecisionId?: string;

  description: string;

  status:
    | "received"
    | "investigating"
    | "resolved"
    | "rejected";

  ownerId: string;

  receivedAt: string;
  dueAt: string;
  resolvedAt?: string;
};
```

---

# 77. Incident taxonomy

```ts
export type AIIncidentType =
  | "performance_failure"
  | "bias_or_discrimination"
  | "fundamental_rights_harm"
  | "safety_harm"
  | "security_incident"
  | "privacy_incident"
  | "misinformation"
  | "unauthorised_action"
  | "out_of_purpose_use"
  | "regulatory_non_compliance"
  | "provider_failure";
```

---

# 78. AI Incident

```ts
export type AIIncident = {
  id: string;

  aiSystemId: string;
  aiSystemVersion: string;

  incidentType: AIIncidentType;

  severity:
    | "low"
    | "medium"
    | "high"
    | "critical";

  affectedPersons: string[];

  affectedRights: string[];

  affectedTenants: string[];

  reportabilityAssessmentReference?: string;

  status:
    | "detected"
    | "contained"
    | "investigating"
    | "reported"
    | "resolved";

  ownerId: string;

  detectedAt: string;
  resolvedAt?: string;
};
```

---

# 79. Incident governance

```text
DETECT
  ↓
CONTAIN
  ↓
CLASSIFY
  ↓
PRESERVE EVIDENCE
  ↓
ASSESS REPORTABILITY
  ↓
NOTIFY
  ↓
REMEDIATE
  ↓
REVALIDATE SYSTEM
  ↓
UPDATE EVALS
  ↓
POSTMORTEM
```

---

# 80. Serious incident assessment

La clasificación de reporte regulatorio debe ser revisada jurídicamente.

Codex debe:

- Recopilar hechos.
- Identificar personas afectadas.
- Identificar daño.
- Identificar sistema y versión.
- Calcular deadlines configurados.
- Escalar.
- Mantener evidencia.
- No autoexcluir notificación sin aprobación.

---

# 81. System suspension

```ts
export type AISystemSuspension = {
  aiSystemId: string;

  reason: string;

  triggeredBy:
    | "incident"
    | "risk_threshold"
    | "regulatory_change"
    | "provider_issue"
    | "manual";

  disabledCapabilities: string[];

  suspendedAt: string;

  authorisedBy: string;

  recoveryConditions: string[];
};
```

---

# 82. Kill switch

Debe permitir:

- Desactivar sistema.
- Desactivar tool.
- Desactivar modelo.
- Desactivar proveedor.
- Desactivar tenant feature.
- Pasar a read-only.
- Requerir revisión.
- Desactivar memoria.
- Detener jobs.
- Cancelar workflows.

---

# 83. Retirement

```ts
export type AISystemRetirementPlan = {
  aiSystemId: string;

  reason: string;

  stopNewUseAt: string;

  fullShutdownAt: string;

  dataRetentionActions: string[];

  modelAndPromptActions: string[];

  providerTerminationActions: string[];

  customerCommunicationReference: string;

  archiveEvidencePack: boolean;

  ownerId: string;
};
```

---

# 84. Regulatory Change Registry

```ts
export type RegulatoryRequirementVersion = {
  id: string;

  regulation: string;

  provision: string;

  version: string;

  effectiveFrom: string;
  effectiveUntil?: string;

  implementationDeadline?: string;

  sourceReference: string;

  affectedClassifications: string[];

  affectedRoles: string[];

  reviewedBy: string;

  active: boolean;
};
```

---

# 85. Regulatory Change Event

```ts
export type RegulatoryChangeEvent = {
  id: string;

  sourceId: string;

  publishedAt: string;

  effectiveAt: string;

  affectedSystemIds: string[];

  affectedObligationIds: string[];

  requiredActions: string[];

  ownerId: string;

  status:
    | "identified"
    | "assessing"
    | "implementing"
    | "completed";
};
```

---

# 86. Regulatory calendar

Debe incluir:

- Fecha de publicación.
- Fecha de entrada en vigor.
- Fecha de aplicación.
- Transición.
- Excepciones.
- Sistemas afectados.
- Obligaciones.
- Owners.
- Evidencia.

---

# 87. AI Act calendar record

```ts
export type RegulatoryCalendarEntry = {
  id: string;

  regulation: string;

  milestone: string;

  date: string;

  affectedObligations: string[];

  affectedSystemIds: string[];

  sourceReference: string;

  verifiedAt: string;

  status:
    | "upcoming"
    | "effective"
    | "superseded";
};
```

---

# 88. AI Act dates to seed

A 30 de julio de 2026:

```text
27/07/2026
AI Omnibus entra en vigor.

02/08/2026
Aplicación de obligaciones de transparencia
del artículo 50.

02/12/2027
Aplicación de requisitos de alto riesgo
para anexo III.

02/08/2028
Aplicación de requisitos de alto riesgo
para anexo I.
```

Debe confirmarse mediante fuentes oficiales antes de cada release regulatorio.

---

# 89. Contractual governance

Contratos deben cubrir:

- Intended purpose.
- Role allocation.
- Data.
- Tools.
- Autonomy.
- Human oversight.
- Instructions.
- Limitations.
- Prohibited uses.
- Changes.
- Incidents.
- Support.
- Audit.
- Suspension.
- Termination.
- Transparency.
- Logs.
- Providers.
- Security.
- Privacy.

---

# 90. Customer instructions for use

```ts
export type AIInstructionsForUse = {
  aiSystemId: string;
  aiSystemVersion: string;

  intendedPurpose: string;

  installationOrActivationRequirements: string[];

  inputDataRequirements: string[];

  outputInterpretationGuidance: string[];

  humanOversightRequirements: string[];

  knownLimitations: string[];

  foreseeableMisuse: string[];

  prohibitedUses: string[];

  incidentReportingInstructions: string[];

  minimumCompetencyRequirements: string[];

  version: string;
};
```

---

# 91. Marketing governance

Marketing no puede afirmar:

- “100 % autónomo” si existe supervisión obligatoria.
- “Sin errores” si hay limitaciones.
- “Cumple automáticamente” sin alcance.
- “Decide por ti” si es apoyo.
- “Exactitud garantizada” sin evidencia.
- “AI Act compliant” de forma global y no versionada.

---

# 92. Claim Registry

```ts
export type AIProductClaim = {
  id: string;

  aiSystemIds: string[];

  claimText: string;

  channel: string;

  evidenceIds: string[];

  legalReviewReference: string;

  validFrom: string;
  validUntil?: string;

  status:
    | "draft"
    | "approved"
    | "withdrawn";
};
```

---

# 93. Tenant governance profile

```ts
export type TenantAIGovernanceProfile = {
  tenantId: string;

  enabledAISystems: string[];

  allowedUseCases: string[];

  prohibitedUseCases: string[];

  approvalPolicies: string[];

  humanOversightRoles: string[];

  dataRestrictions: string[];

  regionalRestrictions: string[];

  customRiskTolerance?: number;

  governanceVersion: string;
};
```

---

# 94. Non-configurable controls

Tenant no puede desactivar:

- Tenant isolation.
- Legally required transparency.
- Mandatory audit.
- Security gates.
- Privacy gates.
- Prohibited-use controls.
- Incident reporting.
- Required oversight.
- Regulatory retention.
- Version tracking.

---

# 95. Application to NORA

## 95.1 NORA Tax Engine

Características:

- Determinista.
- Reglas fiscales.
- Output canónico.
- No debe depender de LLM.

Governance:

- Assessment de si es sistema de IA.
- Puede resultar `not_ai_system`.
- Debe seguir teniendo QA, legal versioning y audit.
- No mezclar con clasificación de capacidades generativas.

## 95.2 NORA AI Summary

Finalidad:

- Explicar TAX_RESULT.
- No recalcular.
- No sustituir fuente canónica.

Controles:

- Prompt contract.
- Data binding.
- No unsupported claims.
- Evals.
- Citations.
- Transparency.
- Human review según uso.

## 95.3 NORA OCR

Riesgos:

- Extracción errónea.
- Identidad.
- Documentos sensibles.
- Decisiones posteriores.

Controles:

- Confidence.
- Verification.
- Field-level review.
- Source preservation.
- No automatic legal conclusion.

## 95.4 NORA Playbook

Riesgos:

- Knowledge poisoning.
- Stale content.
- Cross-tenant.
- Unauthorized advice.
- Prompt injection.

Governance:

- Source authority.
- Owners.
- Approval.
- Retrieval evals.
- Use limitations.
- System card.

## 95.5 NORA CRM Copilot

Riesgos:

- CRUD.
- Data access.
- Automation.
- Misuse.
- Transparency.

Controles:

- Tool risk levels.
- Approval.
- Oversight.
- Audit.
- Tenant governance.
- Intended purpose.

## 95.6 NORA Legal Assistant

Finalidad:

- Apoyo profesional.
- No decisión jurídica definitiva.
- No firma.
- No representación automática.
- No envío sin aprobación.

Governance:

- Strong limitations.
- Legal owner.
- Evaluation suite.
- Source requirements.
- Escalation.
- Human review.

---

# 96. Application to EcomScaling IA

## Analyst

- Read-only.
- Aggregated metrics.
- Recommendations.
- Lower autonomy.

## Recommender

- Generates proposals.
- May affect budget decisions.
- Requires evidence and evaluation.

## Monitor

- Continuous checks.
- Alerting.
- False-positive controls.

## Campaign Executor

- Writes to Meta.
- Financial impact.
- High internal risk.
- Approval and rollback.
- Strict intended purpose.
- Post-action verification.

---

# 97. EcomScaling governance rule

No governar igual:

```text
analizar métricas
```

y:

```text
cambiar presupuestos
```

A mayor autonomía:

- Mayor risk level.
- Más approval.
- Más oversight.
- Más monitoring.
- Más evidence.
- Más rollback.
- Menor blast radius.

---

# 98. Application to CRM

Capacidades:

- Intent routing.
- RAG.
- Call analysis.
- Lead scoring.
- Drafting.
- CRUD.
- Employee analytics.
- Document extraction.
- Notifications.

Especial cuidado:

- Empleo.
- Monitoring.
- Profiling.
- Access to services.
- Sensitive documents.
- Automated communications.
- Scoring.

---

# 99. Lead scoring governance

Debe definir:

- Intended purpose.
- Factors.
- Data.
- Output.
- Who uses it.
- Whether it materially influences decisions.
- Bias evals.
- Human review.
- Contestability.
- Privacy assessment.
- Prohibited uses.

No permitir que un score de ventas se utilice para:

- Denegar servicios.
- Evaluar solvencia.
- Discriminar.
- Tomar decisiones laborales.

sin nueva evaluación.

---

# 100. Architecture proposed

```text
src/
  ai/
    governance/
      governance.types.ts
      governance.config.ts

      inventory/
        ai-system.registry.ts
        ai-component.registry.ts
        use-case.registry.ts
        system-composition.service.ts

      purpose/
        intended-purpose.registry.ts
        foreseeable-misuse.service.ts
        prohibited-use.service.ts

      roles/
        operator-role.service.ts
        governance-raci.service.ts
        owner.registry.ts

      classification/
        ai-system-definition.service.ts
        prohibited-practice.service.ts
        regulatory-classification.service.ts
        high-risk-classification.service.ts
        transparency-classification.service.ts
        internal-risk-classification.service.ts

      obligations/
        regulatory-requirement.registry.ts
        regulatory-calendar.service.ts
        obligations-engine.ts
        control-mapping.service.ts

      controls/
        ai-control.registry.ts
        control-effectiveness.service.ts

      evidence/
        compliance-evidence.repository.ts
        evidence-pack.service.ts
        system-card.service.ts

      risk/
        ai-risk.registry.ts
        risk-tolerance.registry.ts
        risk-assessment.service.ts
        risk-treatment.service.ts
        risk-acceptance.service.ts

      impact/
        ai-impact-assessment.service.ts
        fundamental-rights-impact.service.ts
        vulnerable-group.service.ts

      oversight/
        human-oversight.policy.ts
        competency.registry.ts
        oversight-workload.service.ts
        escalation.service.ts

      transparency/
        transparency.policy.ts
        interaction-disclosure.service.ts
        content-marking.service.ts
        claim-governance.service.ts

      lifecycle/
        governance-change.service.ts
        material-change.service.ts
        governance-release-gate.ts
        pilot.service.ts
        suspension.service.ts
        retirement.service.ts

      monitoring/
        post-market-monitoring.service.ts
        misuse-monitoring.service.ts
        complaint.service.ts

      incidents/
        ai-incident.service.ts
        regulatory-reportability.service.ts
        evidence-preservation.service.ts

      regulatory/
        regulatory-change.registry.ts
        implementation-calendar.service.ts

      contracts/
        instructions-for-use.service.ts
        customer-ai-terms.service.ts

      tenants/
        tenant-governance-profile.service.ts

      evaluation/
        governance-eval.service.ts
        compliance-regression-gate.ts

      audit/
        governance-audit.service.ts

      tests/
      evals/

      adapters/
        nora/
        ecommerce/
        crm/
```

Adaptar al repositorio.

---

# 101. Persistencia orientativa

Posibles tablas:

```text
ai_governance_systems
ai_governance_system_versions
ai_governance_components
ai_governance_system_compositions
ai_governance_intended_purposes
ai_governance_use_cases
ai_governance_prohibited_uses
ai_governance_foreseeable_misuse
ai_governance_operator_roles
ai_governance_classifications
ai_governance_obligations
ai_governance_controls
ai_governance_control_assessments
ai_governance_evidence
ai_governance_risks
ai_governance_risk_acceptances
ai_governance_impact_assessments
ai_governance_fria_records
ai_governance_oversight_policies
ai_governance_competencies
ai_governance_transparency_policies
ai_governance_release_decisions
ai_governance_pilots
ai_governance_change_events
ai_governance_incidents
ai_governance_complaints
ai_governance_regulatory_requirements
ai_governance_regulatory_calendar
ai_governance_tenant_profiles
ai_governance_product_claims
```

---

# 102. AI System Table orientativa

```sql
CREATE TABLE ai_governance_systems (
  id uuid PRIMARY KEY,

  system_key text NOT NULL,

  name text NOT NULL,

  product text NOT NULL,

  owner_id uuid NOT NULL,

  risk_owner_id uuid NOT NULL,

  status text NOT NULL,

  current_version_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),

  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (system_key)
);
```

---

# 103. AI System Version Table

```sql
CREATE TABLE ai_governance_system_versions (
  id uuid PRIMARY KEY,

  ai_system_id uuid NOT NULL,

  version text NOT NULL,

  description text NOT NULL,

  intended_purpose_id uuid NOT NULL,

  regulatory_classification_id uuid,

  internal_risk_profile_id uuid,

  human_oversight_policy_id uuid,

  transparency_policy_id uuid,

  evaluation_suite_id uuid NOT NULL,

  composition_hash text NOT NULL,

  status text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (ai_system_id, version)
);
```

---

# 104. Obligation Table

```sql
CREATE TABLE ai_governance_obligations (
  id uuid PRIMARY KEY,

  regulation_id text NOT NULL,

  provision text NOT NULL,

  requirement text NOT NULL,

  effective_from date NOT NULL,

  implementation_deadline date,

  applicable_roles jsonb NOT NULL,

  applicable_classifications jsonb NOT NULL,

  evidence_requirements jsonb NOT NULL,

  active boolean NOT NULL DEFAULT true
);
```

---

# 105. Control Table

```sql
CREATE TABLE ai_governance_controls (
  id uuid PRIMARY KEY,

  control_key text NOT NULL,

  name text NOT NULL,

  description text NOT NULL,

  control_type text NOT NULL,

  owner_id uuid NOT NULL,

  frequency text NOT NULL,

  status text NOT NULL,

  UNIQUE (control_key)
);
```

---

# 106. Evidence Table

```sql
CREATE TABLE ai_governance_evidence (
  id uuid PRIMARY KEY,

  ai_system_id uuid NOT NULL,

  ai_system_version_id uuid NOT NULL,

  obligation_id uuid NOT NULL,

  control_id uuid NOT NULL,

  evidence_type text NOT NULL,

  reference text NOT NULL,

  content_hash text,

  created_at timestamptz NOT NULL DEFAULT now(),

  valid_until timestamptz,

  verified_by uuid
);
```

---

# 107. Risk Table

```sql
CREATE TABLE ai_governance_risks (
  id uuid PRIMARY KEY,

  ai_system_id uuid NOT NULL,

  ai_system_version_id uuid NOT NULL,

  risk_category text NOT NULL,

  scenario text NOT NULL,

  affected_stakeholders jsonb NOT NULL,

  likelihood numeric NOT NULL,

  impact numeric NOT NULL,

  inherent_risk numeric NOT NULL,

  residual_risk numeric NOT NULL,

  risk_owner_id uuid NOT NULL,

  treatment text NOT NULL,

  status text NOT NULL,

  review_at timestamptz NOT NULL
);
```

---

# 108. Release Decision Table

```sql
CREATE TABLE ai_governance_release_decisions (
  id uuid PRIMARY KEY,

  ai_system_id uuid NOT NULL,

  ai_system_version_id uuid NOT NULL,

  composition_hash text NOT NULL,

  decision text NOT NULL,

  conditions jsonb NOT NULL DEFAULT '[]',

  unresolved_risks jsonb NOT NULL DEFAULT '[]',

  monitoring_requirements jsonb NOT NULL DEFAULT '[]',

  approved_by jsonb NOT NULL,

  approved_at timestamptz NOT NULL,

  expires_at timestamptz,

  rollback_plan_reference text NOT NULL
);
```

---

# 109. Regulatory Calendar Table

```sql
CREATE TABLE ai_governance_regulatory_calendar (
  id uuid PRIMARY KEY,

  regulation text NOT NULL,

  milestone text NOT NULL,

  milestone_date date NOT NULL,

  affected_obligations jsonb NOT NULL,

  source_reference text NOT NULL,

  verified_at timestamptz NOT NULL,

  status text NOT NULL
);
```

---

# 110. Governance Audit Event

```ts
export type GovernanceAuditEvent = {
  id: string;

  aiSystemId?: string;
  aiSystemVersion?: string;

  eventType: string;

  actorId?: string;

  decision:
    | "approved"
    | "blocked"
    | "review_required"
    | "suspended"
    | "retired";

  reasonCodes: string[];

  evidenceIds: string[];

  policyVersion: string;

  traceId: string;

  createdAt: string;
};
```

---

# 111. Metrics

```text
ai_systems_total
ai_systems_unclassified
ai_systems_without_owner
ai_systems_without_evals
ai_systems_without_oversight
ai_systems_without_transparency_policy
ai_systems_pending_review
ai_obligations_non_compliant
ai_controls_ineffective
ai_risks_above_tolerance
ai_risk_acceptances_expired
ai_release_blocks_total
ai_version_mismatches_total
ai_transparency_failures_total
ai_incidents_total
ai_complaints_total
ai_material_changes_pending_review
```

---

# 112. Quality metrics

```text
governance_inventory_coverage
governance_classification_coverage
governance_control_coverage
governance_evidence_completeness
governance_review_timeliness
human_oversight_effectiveness
complaint_resolution_time
risk_treatment_completion_rate
release_gate_failure_rate
post_market_signal_detection_rate
```

---

# 113. Alerts critical

- Unregistered AI in production.
- Version mismatch.
- Prohibited-practice candidate.
- Critical risk without treatment.
- Transparency missing after applicable date.
- High-risk candidate without review.
- Suspended system receiving traffic.
- Expired release approval.
- Evidence pack missing.
- Unapproved provider.
- Incident with fundamental-rights impact.
- Governance controls disabled.

---

# 114. Alerts high

- Material change pending.
- Risk acceptance expiring.
- Oversight overload.
- Complaint spike.
- Eval degradation.
- Out-of-purpose use.
- Product claim without evidence.
- Regulatory deadline approaching.
- System card stale.
- Training expired.

---

# 115. Unit tests

- Registry invariants.
- Role assignment.
- Classification branches.
- Transparency date.
- Obligation resolution.
- Risk scoring.
- Control mapping.
- Evidence validity.
- Materiality assessment.
- Release gate.
- Version matching.
- Risk acceptance expiry.
- Pilot limits.
- Suspension.
- Regulatory calendar.

---

# 116. Integration tests

- Feature registration.
- System composition.
- Eval evidence ingestion.
- Privacy gate.
- Security gate.
- Release decision.
- Canary.
- Monitoring.
- Incident.
- Complaint.
- Suspension.
- Retirement.
- Regulatory update.
- Tenant profile.

---

# 117. Governance evals

Evaluate:

- Correct system boundary.
- Correct not-AI classification.
- Correct role escalation.
- Correct prohibited-practice block.
- High-risk review routing.
- Transparency disclosure.
- Intended-purpose enforcement.
- Misuse detection.
- Oversight effectiveness.
- Evidence completeness.
- Release blocking.
- Change-materiality detection.

---

# 118. Governance Eval Case

```ts
export type GovernanceEvalCase = {
  id: string;

  systemDescription: string;

  intendedPurpose: string;

  actors: string[];

  dataCategories: string[];

  decisions: string[];

  actions: string[];

  autonomyLevel: number;

  expectedClassifications: string[];

  expectedRequiredReviews: string[];

  expectedReleaseDecision:
    | "approve"
    | "conditional"
    | "block";
};
```

---

# 119. Compliance Regression Gate

Bloquear si:

- Unclassified system.
- Missing owner.
- Wrong classification.
- Missing transparency.
- Missing oversight.
- Missing evidence.
- Risk above tolerance.
- Material change ignored.
- Deployed version not approved.
- Product claim unsupported.
- Regulatory calendar outdated.
- Complaint workflow broken.
- Incident workflow broken.

---

# 120. Quality Gates

Bloquear release si:

- Sistema no inventariado.
- Falta finalidad prevista.
- Falta owner.
- Falta risk owner.
- Falta assessment de sistema de IA.
- Falta role assignment.
- Falta classification.
- Falta obligations resolution.
- Falta control mapping.
- Falta control testing.
- Falta eval suite.
- Falta privacy review.
- Falta security review.
- Falta transparency.
- Falta oversight.
- Falta monitoring.
- Falta evidence pack.
- Existen riesgos críticos.
- Existe change event sin resolver.
- No existe rollback.
- Composition hash no coincide.

---

# 121. Fase 0 — Análisis exhaustivo

Analizar:

- Sistemas.
- Casos de uso.
- Modelos.
- Agentes.
- Tools.
- Workflows.
- Datos.
- Personas.
- Roles.
- Contratos.
- Transparencia.
- Riesgo.
- Evals.
- Incidentes.
- Claims.
- Regulatory calendar.

Entregables:

- Inventarios.
- System maps.
- Role map.
- Classification map.
- Obligation map.
- Control map.
- Evidence map.
- RACI.
- Gaps.
- Arquitectura.
- Persistencia.
- Tests.
- Evals.
- Metrics.
- Alerts.
- Legal questions.

No implementar todavía.

---

# 122. Fase 1 — Registry

Implementar:

- AI System Registry.
- Component Registry.
- System versions.
- Composition hash.
- Owner.
- Status.

---

# 123. Fase 2 — Purpose and Roles

Implementar:

- Intended Purpose.
- Prohibited Uses.
- Foreseeable Misuse.
- Operator Roles.
- Instructions for Use.

---

# 124. Fase 3 — Classification

Implementar:

- AI definition assessment.
- Prohibited practice assessment.
- High-risk review routing.
- Transparency classification.
- Internal risk profile.

No automatizar conclusiones legales dudosas.

---

# 125. Fase 4 — Obligations and Controls

Implementar:

- Regulatory Registry.
- Calendar.
- Obligations Engine.
- Controls Library.
- Control mappings.

---

# 126. Fase 5 — Risk

Implementar:

- Risk Register.
- Risk tolerance.
- Treatment.
- Acceptance.
- Impact assessment.

---

# 127. Fase 6 — Oversight

Implementar:

- Oversight policies.
- Competency records.
- Review triggers.
- Override.
- Stop.
- Workload monitoring.

---

# 128. Fase 7 — Transparency

Implementar:

- Chat disclosure.
- Marking policies.
- Notice versioning.
- Claims registry.
- Article 50 gate.

Prioridad inmediata por fecha 2 de agosto de 2026.

---

# 129. Fase 8 — Evidence

Implementar:

- Evidence records.
- Control assessments.
- Evidence packs.
- System cards.
- Hashes.

---

# 130. Fase 9 — Release Gate

Implementar:

- Composition freeze.
- Governance gate.
- Limited pilot.
- Approval.
- Canary.
- Rollback.

---

# 131. Fase 10 — Monitoring

Implementar:

- Metrics.
- Thresholds.
- Misuse.
- Complaints.
- Drift signals.
- Periodic reviews.

---

# 132. Fase 11 — Incidents

Implementar:

- Incident taxonomy.
- Reportability review.
- Suspension.
- Evidence.
- Postmortem.
- Revalidation.

---

# 133. Fase 12 — Regulatory Changes

Implementar:

- Change registry.
- Calendar updates.
- Affected system analysis.
- Review tasks.
- Release blocks.

---

# 134. Fase 13 — Tenant Governance

Implementar:

- Tenant profiles.
- Use restrictions.
- Oversight roles.
- Non-configurable controls.
- Contract mapping.

---

# 135. Fase 14 — Evals and Audit

Implementar:

- Governance eval dataset.
- Regression gate.
- Audit reports.
- Control effectiveness.
- Evidence completeness.

---

# 136. Application priority for current date

Priority 1:

```text
Article 50 transparency readiness.
```

Priority 2:

```text
Complete inventory and system boundaries.
```

Priority 3:

```text
Role and classification assessments.
```

Priority 4:

```text
Release gate and version evidence.
```

Priority 5:

```text
Preparation for high-risk controls
where roadmap creates possible exposure.
```

---

# 137. Direct instructions for Codex

## Mission

Design and integrate an AI Governance & Regulatory Compliance Engineering architecture adapted to the actual SaaS.

## Mandatory rule

Before implementation, analyze:

- Systems.
- Use cases.
- Models.
- Agents.
- Tools.
- Workflows.
- Data.
- People.
- Operator roles.
- Intended purposes.
- Foreseeable misuse.
- Transparency.
- Risk.
- Evals.
- Owners.
- Incidents.
- Claims.
- Contracts.
- Regulatory calendar.

## Restrictions

1. Do not implement before analysis.
2. Do not govern the whole product as one system.
3. Do not classify all automation as AI.
4. Do not classify all AI as high risk.
5. Do not assume operator roles.
6. Do not assume API use prevents provider status.
7. Do not approve without intended purpose.
8. Do not approve without owners.
9. Do not approve without evals.
10. Do not approve a version other than the evaluated version.
11. Do not hardcode dates without regulatory registry.
12. Do not treat a policy as evidence of effectiveness.
13. Do not ignore actual customer use.
14. Do not ignore foreseeable misuse.
15. Do not ignore marketing claims.
16. Do not mark complete without release gate.
17. Escalate material legal uncertainty.
18. Document deviations.

---

# 138. First recommended Codex task

```text
Analyze the repository and product exhaustively to design an
AI Governance & Regulatory Compliance Engineering architecture.

Do not implement new governance tables yet.

Objectives:

1. Identify AI systems.
2. Identify non-AI deterministic components.
3. Identify use cases.
4. Identify models.
5. Identify agents.
6. Identify tools.
7. Identify workflows.
8. Identify datasets.
9. Identify providers.
10. Identify intended purposes.
11. Identify prohibited uses.
12. Identify foreseeable misuse.
13. Identify affected users.
14. Identify affected persons.
15. Identify decisions.
16. Identify actions.
17. Identify autonomy levels.
18. Identify human oversight.
19. Identify transparency surfaces.
20. Identify operator roles.
21. Identify legal classifications already approved.
22. Identify internal risks.
23. Identify obligations.
24. Identify controls.
25. Identify evidence.
26. Identify owners.
27. Identify RACI.
28. Identify incidents.
29. Identify complaints.
30. Identify marketing claims.
31. Identify regulatory dates.
32. Propose AI System Registry.
33. Propose Component Registry.
34. Propose Intended Purpose Registry.
35. Propose Role Registry.
36. Propose Classification Engine.
37. Propose Obligations Engine.
38. Propose Controls Library.
39. Propose Evidence Pack.
40. Propose Risk Register.
41. Propose Human Oversight Registry.
42. Propose Transparency Policy.
43. Propose Release Gate.
44. Propose Monitoring.
45. Propose Incident Governance.
46. Propose Regulatory Change Registry.
47. Propose architecture.
48. Propose persistence.
49. Propose files.
50. Propose phases.
51. Propose tests.
52. Propose evals.
53. Propose metrics.
54. Propose alerts.

Before modifying code, deliver:

a) diagnosis,
b) AI system inventory,
c) non-AI component inventory,
d) intended-purpose map,
e) operator-role map,
f) classification matrix,
g) obligation-control-evidence matrix,
h) RACI,
i) regulatory calendar,
j) open legal questions,
k) architecture,
l) persistence,
m) exact files.

Restrictions:

- Do not invent classifications.
- Do not invent roles.
- Do not implement yet.
- Do not copy a generic architecture.
- Do not mark complete without validation.
```

---

# 139. Subsequent implementation prompt

```text
Use the approved analysis to implement the first phase of
AI Governance & Regulatory Compliance Engineering.

Implement only:

1. Common contracts.
2. AI System Registry.
3. AI System Version Registry.
4. AI Component Registry.
5. System Composition Hash.
6. Intended Purpose Registry.
7. Prohibited Use Registry.
8. Owner assignments.
9. Basic Operator Role Registry.
10. Transparency Policy for one conversational system.
11. Governance audit events.
12. Registry invariant tests.

Do not implement yet:

- Automated legal classification.
- Full high-risk compliance.
- Full FRIA.
- Full regulatory reporting.
- All products.
- Automatic risk acceptance.
- Automatic legal conclusions.

Use pending-review states for unresolved legal questions.
Document every deviation.
```

---

# 140. ADR recommended

- ADR: AI system boundary.
- ADR: AI/non-AI classification.
- ADR: intended purpose.
- ADR: foreseeable misuse.
- ADR: operator roles.
- ADR: regulatory classification.
- ADR: internal risk classification.
- ADR: obligations engine.
- ADR: controls library.
- ADR: evidence model.
- ADR: risk register.
- ADR: risk acceptance.
- ADR: human oversight.
- ADR: AI literacy.
- ADR: transparency.
- ADR: Article 50 readiness.
- ADR: system cards.
- ADR: release governance.
- ADR: material changes.
- ADR: post-market monitoring.
- ADR: complaints.
- ADR: incidents.
- ADR: regulatory changes.
- ADR: tenant governance.
- ADR: product claims.
- ADR: retirement.

---

# 141. Acceptance criteria

- [ ] Every production AI system is registered.
- [ ] Deterministic components are separated.
- [ ] Every system has a version.
- [ ] Every system has an owner.
- [ ] Every system has an intended purpose.
- [ ] Every system has prohibited uses.
- [ ] Foreseeable misuse is documented.
- [ ] Operator roles are assessed.
- [ ] Regulatory classification exists or is pending with block.
- [ ] Internal risk profile exists.
- [ ] Obligations are resolved.
- [ ] Controls are mapped.
- [ ] Evidence is linked.
- [ ] Human oversight is defined where required.
- [ ] Competency requirements exist.
- [ ] Transparency policy exists where required.
- [ ] Article 50 readiness is verified.
- [ ] Risk register exists.
- [ ] Impact assessment exists.
- [ ] Privacy review exists.
- [ ] Security review exists.
- [ ] Release decision exists.
- [ ] Composition hash matches.
- [ ] Monitoring plan exists.
- [ ] Complaints workflow exists.
- [ ] Incident workflow exists.
- [ ] Regulatory calendar exists.
- [ ] Rollback exists.
- [ ] Retirement exists.
- [ ] Real product validation completed.

---

# 142. Definition of Done

An AI capability is finished when:

1. It is inventoried.
2. Its system boundary is defined.
3. It has a version.
4. It has a composition hash.
5. It has an intended purpose.
6. It has prohibited uses.
7. Foreseeable misuse is documented.
8. Its operator roles are assessed.
9. Its regulatory classification is approved.
10. Its internal risk is approved.
11. Applicable obligations are resolved.
12. Controls are implemented.
13. Controls are tested.
14. Evidence is complete.
15. Privacy is approved.
16. Security is approved.
17. Oversight is ready.
18. Transparency is ready.
19. Evals pass.
20. Risks are within tolerance.
21. Release is approved.
22. Monitoring is active.
23. Incident owner exists.
24. Rollback is ready.
25. It is validated in the actual product.

---

# 143. Executive summary

Correct sequence:

```text
IDENTIFY SYSTEM
  ↓
DEFINE BOUNDARY
  ↓
DEFINE INTENDED PURPOSE
  ↓
IDENTIFY ROLES
  ↓
CLASSIFY
  ↓
MAP OBLIGATIONS
  ↓
IMPLEMENT CONTROLS
  ↓
GENERATE EVIDENCE
  ↓
EVALUATE
  ↓
APPROVE
  ↓
MONITOR
  ↓
REVIEW CHANGES
  ↓
SUSPEND OR RETIRE
```

Common platform capabilities:

- AI System Registry.
- Component Registry.
- Intended Purpose Registry.
- Operator Role Registry.
- Regulatory Classification.
- Internal Risk Classification.
- Obligations Engine.
- Controls Library.
- Compliance Evidence.
- Risk Register.
- Impact Assessment.
- Human Oversight.
- AI Literacy.
- Transparency.
- Release Gate.
- Monitoring.
- Complaints.
- Incidents.
- Regulatory Change Registry.
- Tenant Governance.
- Retirement.

Each product must provide:

- System boundaries.
- Purposes.
- Roles.
- Risks.
- Obligations.
- Controls.
- Evals.
- Human oversight.
- Transparency.
- Product-specific incidents.
- Owners.
- Evidence.

AI Governance is not:

```text
a policy about AI
```

It is:

```text
a versioned operating system
for deciding which AI capabilities
may exist, under which conditions,
and with which evidence
```

---

# 144. Official sources

## EU Artificial Intelligence Act

Regulation (EU) 2024/1689:

- https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng
- https://eur-lex.europa.eu/legal-content/es/AUTO/?uri=CELEX:32024R1689

## AI Act Service Desk

Article 3 — Definitions:

- https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-3
- https://ai-act-service-desk.ec.europa.eu/es/ai-act/article-3

Article 26 — Obligations of deployers of high-risk AI systems:

- https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26

Article 27 — Fundamental rights impact assessment:

- https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-27
- https://ai-act-service-desk.ec.europa.eu/es/ai-act/article-27

## AI Omnibus

Entry into force, 27 July 2026:

- https://digital-strategy.ec.europa.eu/en/news/ai-omnibus-enters-force

High-risk timeline and simplification:

- https://digital-strategy.ec.europa.eu/en/news/eu-agrees-simplify-ai-rules-boost-innovation-and-ban-nudification-apps-protect-citizens

## Article 50 transparency

Guidelines published 20 July 2026:

- https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems
- https://digital-strategy.ec.europa.eu/es/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems

Quick facts:

- https://digital-strategy.ec.europa.eu/en/factpages/quick-facts-transparency-rules-ai-systems

## NIST AI Risk Management Framework

AI RMF 1.0:

- https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10
- https://airc.nist.gov/airmf-resources/airmf/

AI RMF Core:

- https://airc.nist.gov/airmf-resources/airmf/5-sec-core/

AI RMF Playbook:

- https://airc.nist.gov/airmf-resources/playbook/
